/**
 * Cloudflare Workers 入口。
 *
 * 只做一件事：把请求交给 relay.js。所有策略都在 relay.js 里（可被 Node/Deno 复用，
 * 也有不依赖网络的测试），这里保持薄到没有分支，避免「线上跑的和测的不是同一份」。
 */
import { createRelay } from './relay.js'

export default {
  fetch: createRelay(),
}
