#!/usr/bin/env node
/**
 * check:ai-relay —— 线上 AI 接入的两条止损线。
 *
 * 线上是纯静态托管，浏览器直连网关会撞 CORS，把密钥放前端等于公开。解法是
 * `infra/ai-relay`（Cloudflare Worker）+ 构建时注入 `VITE_AI_BASE_URL`。
 * 这条守卫钉两件**一旦写错、线上才炸**的事：
 *
 *   A. 站点侧：`resolveAiEndpoint` 必须在三种宿主下给出正确结论 ——
 *      尤其「只给 base、没给 relay 标志」不能被当成免 key（否则页面看着能用、一按 401）。
 *   B. 中继侧：CORS 白名单 / 上游 key 注入 / 模型白名单 / 熔断。它手里握着唯一一把
 *      上游密钥，任何一条失守都是「任何人用我们的钱跑模型」。
 *
 * 全量中继用例在 `infra/ai-relay/test/relay.test.mjs`（`npm --prefix infra/ai-relay test`）；
 * 这里只挑跨系统、最贵的那几条，保证 `check:consistency` 不依赖网络也不慢。
 */
import { build } from 'esbuild'
import { fileURLToPath } from 'node:url'
import path from 'node:path'
import fs from 'node:fs'

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..')
const OUT_DIR = path.join(ROOT, '.tmp-guard')
fs.mkdirSync(OUT_DIR, { recursive: true })

const failures = []
const fail = (m) => failures.push(m)

// ── A. 站点侧：三种宿主 ────────────────────────────────────────────────
{
  const outfile = path.join(OUT_DIR, 'ai-endpoint.mjs')
  await build({
    entryPoints: [path.join(ROOT, 'es-plus-docs/src/utils/ai-endpoint.ts')],
    outfile,
    bundle: true,
    format: 'esm',
    platform: 'node',
    logLevel: 'silent',
  })
  const { resolveAiEndpoint } = await import(`file://${outfile.replace(/\\/g, '/')}?t=${Date.now()}`)

  const dev = resolveAiEndpoint({ DEV: true })
  if (dev.baseUrl !== '/openai/v1') fail(`本地开发 base=${dev.baseUrl}，应为 /openai/v1`)
  if (dev.relay || !dev.keyRequired) fail('本地开发不应进入免 key 模式')

  const prod = resolveAiEndpoint({})
  if (prod.baseUrl !== '') fail(`线上默认 base="${prod.baseUrl}"，应为空（不能给必然 404 的 /openai/v1）`)
  if (!prod.keyRequired) fail('线上默认必须要求访客自备 key')

  const relay = resolveAiEndpoint({ VITE_AI_BASE_URL: 'https://relay.example/v1', VITE_AI_RELAY: 'true' })
  if (!relay.relay || relay.keyRequired) fail('配了 base + relay=true 时应免 key')
  if (relay.baseUrl !== 'https://relay.example/v1') fail('中继模式下 base 应取注入值')

  // 只给 base 不给 relay：可能只是访客网关，不能假装免 key
  const half = resolveAiEndpoint({ VITE_AI_BASE_URL: 'https://relay.example/v1' })
  if (half.relay || !half.keyRequired) fail('只有 VITE_AI_BASE_URL、没有 VITE_AI_RELAY=true 时不得免 key')

  // relay=true 但没 base：无地址可发，同样不能免 key
  const nobase = resolveAiEndpoint({ VITE_AI_RELAY: 'true' })
  if (nobase.relay || !nobase.keyRequired) fail('relay=true 但缺 base 时不得免 key')

  if (resolveAiEndpoint({ VITE_AI_MODEL: '  ' }).model !== 'gpt-4o-mini') {
    fail('空白的 VITE_AI_MODEL 应回落到默认模型')
  }
}

// ── B. 中继侧：最贵的四条 ──────────────────────────────────────────────
{
  const { createRelay } = await import(
    `file://${path.join(ROOT, 'infra/ai-relay/src/relay.js').replace(/\\/g, '/')}`
  )
  const ENV = {
    ALLOWED_ORIGINS: 'https://liujiaao.github.io',
    ALLOWED_MODELS: 'gpt-4o-mini',
    MAX_TOKENS: '512',
    RATE_LIMIT: '100',
    UPSTREAM_BASE_URL: 'https://upstream.example/v1',
    UPSTREAM_API_KEY: 'sk-upstream-secret',
  }
  const seen = []
  const handle = createRelay({
    fetch: async (url, init) => {
      seen.push({ url, init })
      return new Response('{"choices":[]}', { status: 200 })
    },
  })
  const req = (body, headers = {}, method = 'POST') =>
    new Request('https://relay.example/v1/chat/completions', {
      method,
      headers: { 'content-type': 'application/json', origin: 'https://liujiaao.github.io', ...headers },
      body: method === 'POST' ? JSON.stringify(body) : undefined,
    })

  const evil = await handle(
    req({ model: 'gpt-4o-mini', messages: [{ role: 'user', content: 'hi' }] }, { origin: 'https://evil.example' }),
    ENV,
  )
  if (evil.status !== 403) fail(`非白名单 origin 应 403，实际 ${evil.status}`)

  const badModel = await handle(
    req({ model: 'gpt-4-turbo', messages: [{ role: 'user', content: 'hi' }] }),
    ENV,
  )
  if (badModel.status !== 400) fail(`白名单外模型应 400，实际 ${badModel.status}`)

  const ok = await handle(
    req(
      { model: 'gpt-4o-mini', messages: [{ role: 'user', content: 'hi' }], max_tokens: 9000 },
      { authorization: 'Bearer sk-visitor-key' },
    ),
    ENV,
  )
  if (ok.status !== 200) fail(`正常请求应 200，实际 ${ok.status}`)
  if (ok.headers.get('access-control-allow-origin') !== 'https://liujiaao.github.io') {
    fail('成功响应缺 CORS 头 —— 浏览器会丢弃整个响应')
  }
  const call = seen.at(-1)
  if (!call) fail('正常请求没有打到上游')
  else {
    if (call.init.headers.authorization !== 'Bearer sk-upstream-secret') {
      fail('上游 Authorization 必须是中继自己的 key')
    }
    if (JSON.stringify(call.init).includes('sk-visitor-key')) fail('访客带来的 key 被转发到了上游')
    if (JSON.parse(call.init.body).max_tokens !== 512) fail('max_tokens 未被 MAX_TOKENS 截断')
  }

  const off = await handle(req({ model: 'gpt-4o-mini', messages: [{ role: 'user', content: 'hi' }] }), {
    ...ENV,
    DISABLED: 'true',
  })
  if (off.status !== 503) fail(`熔断时应 503，实际 ${off.status}`)
}

// ── C. 接线：部署侧与站点侧不能各说各话 ────────────────────────────────
{
  const yml = fs.readFileSync(path.join(ROOT, '.github/workflows/deploy-docs.yml'), 'utf8')
  for (const v of ['VITE_AI_BASE_URL', 'VITE_AI_RELAY']) {
    if (!yml.includes(`vars.${v}`)) fail(`deploy-docs.yml 没有把 ${v} 传进构建 —— 线上永远是「访客自备网关」`)
  }

  const aiCrud = fs.readFileSync(path.join(ROOT, 'es-plus-docs/src/views/AiCrud.vue'), 'utf8')
  if (!aiCrud.includes("from '@/utils/ai-endpoint'")) {
    fail('AiCrud.vue 没有走 resolveAiEndpoint —— 三种宿主的判断会散落成各写一遍')
  }

  const flow = fs.readFileSync(path.join(ROOT, 'es-plus-docs/src/utils/mcp-flow.ts'), 'utf8')
  const conditionalAuth = /\.\.\.\(\s*ai\.apiKey\s*\?/.test(flow)
  const bareAuth = /^\s*Authorization:\s*`Bearer/m.test(flow)
  if (bareAuth || !conditionalAuth) {
    fail('mcp-flow.ts 无条件发 Authorization —— 中继模式会带着空 Bearer，部分网关直接 401')
  }
}

if (failures.length > 0) {
  console.error(`\n✗ check:ai-relay — ${failures.length} 处线上 AI 接入问题：\n`)
  for (const f of failures) console.error(`  - ${f}`)
  console.error('')
  process.exit(1)
}

console.log('✓ check:ai-relay — 三种宿主的免 key 判定正确；中继守住 origin / 模型 / 密钥 / 熔断')
