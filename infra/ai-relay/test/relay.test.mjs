import { test, describe, beforeEach } from 'node:test'
import assert from 'node:assert/strict'
import { createRelay, __resetRateLimit, parseList } from '../src/relay.js'

/**
 * 中继的判据全在这里。它跑在**每个访客**的请求路径上，且手里握着唯一一把上游 key ——
 * 因此测试重点不是「能转发」，而是三条止损线：
 *
 *   1. 谁都能调（CORS 白名单）→ 任何人都能用我们的 key 烧钱；
 *   2. 模型不设限 → 有人用它跑最贵的模型；
 *   3. 浏览器带的 Authorization 被转发 → 访客自己的 key 泄露给上游日志。
 */

const ORIGIN = 'https://liujiaao.github.io'
const ENV = {
  ALLOWED_ORIGINS: ORIGIN,
  ALLOWED_MODELS: 'gpt-4o-mini,deepseek-chat',
  MAX_TOKENS: '512',
  RATE_LIMIT: '100',
  UPSTREAM_BASE_URL: 'https://upstream.example/v1',
  UPSTREAM_API_KEY: 'sk-upstream-secret',
}

function makeRelay(env = ENV, upstream) {
  const calls = []
  const relay = createRelay({
    fetch: async (url, init) => {
      calls.push({ url, init })
      return (upstream ?? (() => new Response('{"choices":[]}', { status: 200 })))(url, init)
    },
  })
  return { handle: (req, e) => relay(req, { ...env, ...e }), calls }
}

const post = (body, headers = {}) =>
  new Request('https://relay.example/v1/chat/completions', {
    method: 'POST',
    headers: { 'content-type': 'application/json', origin: ORIGIN, ...headers },
    body: JSON.stringify(body),
  })

const validBody = {
  model: 'gpt-4o-mini',
  messages: [{ role: 'user', content: 'hi' }],
}

beforeEach(() => __resetRateLimit())

describe('CORS 白名单', () => {
  test('允许的 origin 预检得到 204 + 回显 origin', async () => {
    const { handle } = makeRelay()
    const res = await handle(
      new Request('https://relay.example/v1/chat/completions', {
        method: 'OPTIONS',
        headers: { origin: ORIGIN },
      }),
    )
    assert.equal(res.status, 204)
    assert.equal(res.headers.get('access-control-allow-origin'), ORIGIN)
  })

  test('非白名单 origin 预检 403，且不带 CORS 头', async () => {
    const { handle } = makeRelay()
    const res = await handle(
      new Request('https://relay.example/v1/chat/completions', {
        method: 'OPTIONS',
        headers: { origin: 'https://evil.example' },
      }),
    )
    assert.equal(res.status, 403)
    assert.equal(res.headers.get('access-control-allow-origin'), null)
  })

  test('没有 Origin 的非浏览器调用同样拒绝（不是开放代理）', async () => {
    const { handle, calls } = makeRelay()
    const res = await handle(
      new Request('https://relay.example/v1/chat/completions', {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify(validBody),
      }),
    )
    assert.equal(res.status, 403)
    assert.equal(calls.length, 0) // 连上游都没碰
  })
})

describe('模型白名单与成本上限', () => {
  test('白名单外的模型 400，不转发', async () => {
    const { handle, calls } = makeRelay()
    const res = await handle(post({ ...validBody, model: 'gpt-4-turbo' }))
    assert.equal(res.status, 400)
    assert.match(await res.text(), /model_not_allowed/)
    assert.equal(calls.length, 0)
  })

  test('max_tokens 被压到 MAX_TOKENS 以下，且只透传白名单字段', async () => {
    const { handle, calls } = makeRelay()
    await handle(post({ ...validBody, max_tokens: 9000, stream: true, tools: [{ type: 'x' }] }))
    const sent = JSON.parse(calls[0].init.body)
    assert.equal(sent.max_tokens, 512)
    assert.equal(sent.stream, undefined)
    assert.equal(sent.tools, undefined)
  })
})

describe('上游 key 只在中继侧', () => {
  test('注入 UPSTREAM_API_KEY，且浏览器带来的 Authorization 一律不转发', async () => {
    const { handle, calls } = makeRelay()
    await handle(post(validBody, { authorization: 'Bearer sk-visitor-own-key' }))
    assert.equal(calls[0].init.headers.authorization, 'Bearer sk-upstream-secret')
    assert.ok(!calls[0].init.body.includes('sk-visitor-own-key'))
    // 请求体里也不能夹带 key
    assert.equal(JSON.parse(calls[0].init.body).api_key, undefined)
  })

  test('未配置上游 key → 500 relay_misconfigured（不带着空 key 去打上游）', async () => {
    const { handle, calls } = makeRelay({ ...ENV, UPSTREAM_API_KEY: '' })
    const res = await handle(post(validBody))
    assert.equal(res.status, 500)
    assert.match(await res.text(), /relay_misconfigured/)
    assert.equal(calls.length, 0)
  })

  test('成功响应带回 CORS 头，浏览器才拿得到', async () => {
    const { handle } = makeRelay()
    const res = await handle(post(validBody))
    assert.equal(res.status, 200)
    assert.equal(res.headers.get('access-control-allow-origin'), ORIGIN)
  })
})

describe('止损开关', () => {
  test('DISABLED=true → 503，且不碰上游', async () => {
    const { handle, calls } = makeRelay({ ...ENV, DISABLED: 'true' })
    const res = await handle(post(validBody))
    assert.equal(res.status, 503)
    assert.match(await res.text(), /relay_disabled/)
    assert.equal(calls.length, 0)
  })

  test('超过窗口配额 → 429', async () => {
    const { handle } = makeRelay({ ...ENV, RATE_LIMIT: '2' })
    assert.equal((await handle(post(validBody))).status, 200)
    assert.equal((await handle(post(validBody))).status, 200)
    const third = await handle(post(validBody))
    assert.equal(third.status, 429)
    assert.equal(third.headers.get('access-control-allow-origin'), ORIGIN) // 429 也要能读
  })

  test('Workers 原生限流绑定优先于进程内计数', async () => {
    let calls = 0
    const RATE_LIMITER = {
      limit: async () => {
        calls += 1
        return { success: false }
      },
    }
    const { handle } = makeRelay({ ...ENV, RATE_LIMITER })
    assert.equal((await handle(post(validBody))).status, 429)
    assert.equal(calls, 1)
  })

  test('上游故障原样回传状态码（便于访客自查），仍带 CORS', async () => {
    const { handle } = makeRelay(ENV, () =>
      new Response('{"error":{"message":"quota"}}', { status: 429, headers: { 'content-type': 'application/json' } }),
    )
    const res = await handle(post(validBody))
    assert.equal(res.status, 429)
    assert.match(await res.text(), /quota/)
    assert.equal(res.headers.get('access-control-allow-origin'), ORIGIN)
  })
})

describe('杂项', () => {
  test('GET /healthz 无需 Origin', async () => {
    const { handle } = makeRelay()
    const res = await handle(new Request('https://relay.example/healthz'))
    assert.equal(res.status, 200)
    assert.equal((await res.json()).ok, true)
  })

  test('未知路径 404', async () => {
    const { handle } = makeRelay()
    const res = await handle(new Request('https://relay.example/v1/models', { method: 'POST', headers: { origin: ORIGIN } }))
    assert.equal(res.status, 404)
  })

  test('parseList 去空去空格', () => {
    assert.deepEqual(parseList(' a, b ,,c '), ['a', 'b', 'c'])
    assert.deepEqual(parseList(undefined), [])
  })
})
