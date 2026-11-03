/**
 * AI 中继（relay）—— 让**线上静态站**也能用 AI，而不要求每个访客自备网关。
 *
 * 问题：GitHub Pages 是纯静态托管，没有后端。浏览器直连任何 OpenAI 兼容网关都会
 * 撞 CORS（网关不放行本站 origin），而且把上游 key 放进前端等于公开泄露。
 *
 * 做法：一个无状态中继。浏览器只认本站、只发同一种请求；**上游 key 只存在于中继的
 * 环境变量里**，并在这里完成三件访客做不了的事：
 *   1. CORS 白名单（只回显本站 origin；**同源部署**时自动放行）；
 *   2. 模型白名单 + max_tokens 上限（公开演示被别人拿去跑 GPT-4 的止损线）；
 *   3. 限流 + 一键熔断（`DISABLED=true`）。
 *
 * 这个文件**不依赖任何运行时**：Workers / Node / Deno / 腾讯云 EdgeOne 都能跑，
 * `createRelay` 接受注入了 fetch 的依赖，所以测试不需要网络（见 test/relay.test.mjs）。
 * 托管方拿不到 `cf-connecting-ip` 时（EdgeOne 就是），可把平台给出的真实 IP 通过
 * 第三个参数 `hints.clientIp` 传进来 —— 它比任何请求头都可信。
 */

const JSON_TYPE = 'application/json; charset=utf-8'

/** 只把上游的这几类头带回来；CORS 头一律由中继自己写。 */
const PASSTHROUGH_STATUS = new Set([200])

export function parseList(value) {
  return String(value ?? '')
    .split(',')
    .map((s) => s.trim())
    .filter(Boolean)
}

function jsonResponse(body, status, extraHeaders) {
  return new Response(JSON.stringify(body), {
    status,
    headers: { 'content-type': JSON_TYPE, ...(extraHeaders ?? {}) },
  })
}

function corsHeaders(origin, allowedOrigins, requestUrl) {
  if (!origin) return null
  // 同源部署（中继与站点在同一个域名下，例如 EdgeOne 项目里的 `cloud-functions`）：
  // 浏览器会把本站 origin 带在最前面，但它不必写进 ALLOWED_ORIGINS。换自定义域名、
  // 用预览域名时也就不会因为漏配一行而 403。
  let sameOrigin = false
  try {
    sameOrigin = new URL(requestUrl).origin === origin
  } catch {
    sameOrigin = false
  }
  if (!sameOrigin && !allowedOrigins.includes(origin)) return null
  return {
    'access-control-allow-origin': origin,
    'access-control-allow-methods': 'POST, OPTIONS',
    'access-control-allow-headers': 'content-type, authorization',
    'access-control-max-age': '86400',
    vary: 'origin',
  }
}

/**
 * 进程内滑动窗口限流（兜底用）。
 *
 * Cloudflare 的 isolate 会被复制到多个边缘节点，**内存计数不跨节点**，所以它只挡得住
 * 同一个节点上的连发；真正的配额要绑 `RATE_LIMITER`（Workers 原生限流绑定）。
 * 两条都实现，是因为本中继也打算能在 Node 上直接跑（自托管/内网演示）。
 */
const buckets = new Map()

function allowInMemory(key, limit, windowMs, now = Date.now()) {
  const hits = (buckets.get(key) ?? []).filter((t) => now - t < windowMs)
  if (hits.length >= limit) {
    buckets.set(key, hits)
    return false
  }
  hits.push(now)
  buckets.set(key, hits)
  // 防止 Map 无限增长：超过 1 万个 key 时清一次过期项
  if (buckets.size > 10_000) {
    for (const [k, v] of buckets) {
      if (v.every((t) => now - t >= windowMs)) buckets.delete(k)
    }
  }
  return true
}

/** 测试用：清空进程内计数。 */
export function __resetRateLimit() {
  buckets.clear()
}

/**
 * @param {{ fetch?: typeof fetch }} [deps]
 * @returns {(request: Request, env?: Record<string, any>, hints?: { clientIp?: string }) => Promise<Response>}
 *
 * `hints.clientIp` 是托管平台**可信**的访客 IP（EdgeOne 的 `context.clientIp` 之类）。
 * 它优先于请求头：`x-forwarded-for` 谁都能伪造，拿它当限流键等于没有限流。
 */
export function createRelay(deps = {}) {
  const doFetch = deps.fetch ?? ((...args) => fetch(...args))

  return async function handle(request, env = {}, hints = {}) {
    const url = new URL(request.url)
    const origin = request.headers.get('origin') ?? ''
    const allowedOrigins = parseList(env.ALLOWED_ORIGINS)
    const cors = corsHeaders(origin, allowedOrigins, request.url)

    // 健康检查（无条件放行，便于 uptime 探针；不泄露任何配置）
    if (url.pathname === '/healthz') {
      return jsonResponse({ ok: true, disabled: env.DISABLED === 'true' }, 200, cors ?? {})
    }

    // 预检：不白名单就不给 CORS 头 —— 浏览器会自己拦下，比 200 后失败更好排查。
    if (request.method === 'OPTIONS') {
      if (!cors) return new Response(null, { status: 403 })
      return new Response(null, { status: 204, headers: cors })
    }

    if (request.method !== 'POST') {
      return jsonResponse({ error: 'method_not_allowed' }, 405, cors ?? {})
    }

    // 路径固定：站点填的 Base URL 是 `<relay>/v1`，请求落到 /v1/chat/completions。
    if (url.pathname !== '/v1/chat/completions' && url.pathname !== '/chat/completions') {
      return jsonResponse({ error: 'not_found' }, 404, cors ?? {})
    }

    // 有 Origin 却不在白名单（或压根没配白名单）→ 403。没 Origin 的非浏览器调用同样拒绝：
    // 这个中继是给公开演示站用的，不是开放代理。
    if (!cors) {
      return jsonResponse({ error: 'origin_not_allowed' }, 403)
    }

    if (env.DISABLED === 'true') {
      return jsonResponse({ error: 'relay_disabled' }, 503, cors)
    }

    if (!env.UPSTREAM_BASE_URL || !env.UPSTREAM_API_KEY) {
      return jsonResponse({ error: 'relay_misconfigured' }, 500, cors)
    }

    // ── 限流：优先用 Workers 原生绑定，其次进程内窗口 ────────────────────
    const limit = Number(env.RATE_LIMIT ?? 20)
    const windowSec = Number(env.RATE_WINDOW_SEC ?? 60)
    const ip =
      hints.clientIp ||
      request.headers.get('cf-connecting-ip') ||
      request.headers.get('x-forwarded-for') ||
      'unknown'
    const rateKey = `${ip}:${url.pathname}`
    if (env.RATE_LIMITER?.limit) {
      const { success } = await env.RATE_LIMITER.limit({ key: rateKey })
      if (!success) return jsonResponse({ error: 'rate_limited' }, 429, cors)
    } else if (limit > 0 && !allowInMemory(rateKey, limit, windowSec * 1000)) {
      return jsonResponse({ error: 'rate_limited' }, 429, cors)
    }

    // ── 请求体：只接受白名单字段 ────────────────────────────────────────
    let body
    try {
      body = await request.json()
    } catch {
      return jsonResponse({ error: 'invalid_json' }, 400, cors)
    }

    const allowedModels = parseList(env.ALLOWED_MODELS)
    const model = typeof body?.model === 'string' ? body.model : ''
    if (allowedModels.length > 0 && !allowedModels.includes(model)) {
      return jsonResponse(
        { error: 'model_not_allowed', detail: `allowed: ${allowedModels.join(', ')}` },
        400,
        cors,
      )
    }
    if (!model) return jsonResponse({ error: 'model_required' }, 400, cors)

    const messages = Array.isArray(body?.messages) ? body.messages : null
    if (!messages || messages.length === 0) {
      return jsonResponse({ error: 'messages_required' }, 400, cors)
    }

    const maxTokens = Math.min(
      Number(body?.max_tokens) > 0 ? Number(body.max_tokens) : Number(env.MAX_TOKENS ?? 2048),
      Number(env.MAX_TOKENS ?? 2048),
    )

    // 透传字段刻意只有这几个：stream 关掉（CDN/Workers 下更稳），工具调用不在演示范围。
    const upstreamBody = {
      model,
      messages,
      temperature: typeof body.temperature === 'number' ? body.temperature : 0.2,
      max_tokens: maxTokens,
      response_format: body.response_format,
    }
    if (!upstreamBody.response_format) delete upstreamBody.response_format

    let upstream
    try {
      const init = {
        method: 'POST',
        headers: {
          'content-type': 'application/json',
          // 关键：用中继自己的 key，**永不转发**浏览器带来的 Authorization
          authorization: `Bearer ${env.UPSTREAM_API_KEY}`,
        },
        body: JSON.stringify(upstreamBody),
      }
      // `AbortSignal.timeout` 不是所有边缘运行时都有（Workers / Node 18+ 有）。
      // 缺了它就不设超时，而不是在请求发出前先 TypeError —— 后者会被下面 catch 成
      // 502「upstream_unreachable」，把「运行时不支持」误报成「上游挂了」。
      if (typeof AbortSignal !== 'undefined' && typeof AbortSignal.timeout === 'function') {
        init.signal = AbortSignal.timeout(Number(env.UPSTREAM_TIMEOUT_MS ?? 60_000))
      }
      upstream = await doFetch(`${String(env.UPSTREAM_BASE_URL).replace(/\/$/, '')}/chat/completions`, init)
    } catch (err) {
      return jsonResponse(
        { error: 'upstream_unreachable', detail: String(err?.message ?? err).slice(0, 200) },
        502,
        cors,
      )
    }

    // 上游的错误体原样回传（OpenAI 兼容错误结构对调试最有用），但不带它的任何 CORS/Set-Cookie 头。
    if (!PASSTHROUGH_STATUS.has(upstream.status)) {
      const text = await upstream.text().catch(() => '')
      return new Response(text.slice(0, 8000) || JSON.stringify({ error: 'upstream_error' }), {
        status: upstream.status,
        headers: { 'content-type': upstream.headers.get('content-type') ?? JSON_TYPE, ...cors },
      })
    }

    const text = await upstream.text()
    return new Response(text, {
      status: 200,
      headers: { 'content-type': JSON_TYPE, ...cors },
    })
  }
}
