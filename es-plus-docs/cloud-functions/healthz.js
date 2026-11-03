/**
 * `GET /healthz` —— 中继存活探针（EdgeOne Makers Node.js 函数）。
 *
 * 单独一个文件是因为 EdgeOne 按目录生成路由：`v1/chat/completions.js` 只能接管
 * `/v1/chat/completions`，`/healthz` 需要自己的入口。探针不泄露任何配置：
 * 只回 `{ ok, disabled }`，不碰上游。
 */
import { createRelay } from '../../infra/ai-relay/src/relay.js'

const handle = createRelay()

export default function onRequest(context) {
  return handle(context.request, context.env ?? {}, { clientIp: context.clientIp })
}
