/**
 * AI 接入点的解析规则（站点唯一的判断处）。
 *
 * 三种宿主，三种答案，**不要**在组件里各判一遍：
 *
 *   1. 本地开发：有 vite 同源代理 `/openai` → base 默认 `/openai/v1`，仍要访客自己的 key；
 *   2. 线上 + 自建中继：构建时注入 `VITE_AI_BASE_URL` + `VITE_AI_RELAY=true` →
 *      **免 key**（key 只在 `infra/ai-relay` 的环境变量里，浏览器永远看不到）；
 *   3. 线上 + 访客自带网关：什么都没注入 → base 留空、必须填 key 与网关。
 *
 * 第 2 条写错的代价是「页面看着能用、一按就 401」，所以 relay 只在
 * **两个变量同时成立**时才启用 —— 只给了 base 而没声明 relay 的，一律按第 3 条处理。
 */
export interface AiEnvVars {
  VITE_AI_BASE_URL?: string
  VITE_AI_MODEL?: string
  VITE_AI_RELAY?: string
  /** vite 的 import.meta.env.DEV */
  DEV?: boolean
}

export interface AiEndpoint {
  baseUrl: string
  model: string
  /** 中继模式：上游密钥由中继托管，访客无需填 key */
  relay: boolean
  /** 是否必须由访客填写 API Key */
  keyRequired: boolean
}

const DEV_PROXY_BASE = '/openai/v1'
const DEFAULT_MODEL = 'gpt-4o-mini'

export function resolveAiEndpoint(env: AiEnvVars): AiEndpoint {
  const injected = (env.VITE_AI_BASE_URL ?? '').trim()
  const baseUrl = injected || (env.DEV ? DEV_PROXY_BASE : '')
  const relay = env.VITE_AI_RELAY === 'true' && injected !== ''
  return {
    baseUrl,
    model: (env.VITE_AI_MODEL ?? '').trim() || DEFAULT_MODEL,
    relay,
    keyRequired: !relay,
  }
}
