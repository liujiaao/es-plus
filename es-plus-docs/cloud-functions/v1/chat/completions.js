/**
 * 线上 AI 中继的 **EdgeOne Makers（Node.js 函数）** 入口。
 *
 * 站点与中继在**同一个项目、同一个域名**下：浏览器请求 `/v1/chat/completions`，
 * 由这个函数接管并交给 `infra/ai-relay/src/relay.js`。于是：
 *
 *   · 不需要 CORS 白名单（同源；relay 的 `corsHeaders` 也会自动认可同源 Origin）；
 *   · 上游 key 只存在于本项目的「环境变量」里，浏览器永远拿不到；
 *   · 预览域名 / 自定义域名换了也不用改代码。
 *
 * 为什么用 **Cloud Functions（Node.js）而不是 Edge Functions**：
 * Edge Functions 只承诺 200 ms **CPU** 时间且没有文档化的单次挂起上限，而模型补全的
 * 墙钟时间常见 10–60 s；Cloud Functions 的单次执行时长默认 30 s、可在
 * `edgeone.json` 里配到 120 s（本目录上级的 `edgeone.json` 已配）。
 *
 * 目录即路由（与 Edge Functions 同一套规则）：
 *   es-plus-docs/cloud-functions/v1/chat/completions.js → https://<项目域名>/v1/chat/completions
 *
 * `context.env` 是 EdgeOne 注入的项目环境变量（不是 process.env 的等价物，别混）；
 * `context.clientIp` 是平台判定的真实访客 IP —— 必须交给中继，否则限流键会退化成
 * 可伪造的 x-forwarded-for，等于没有限流。
 */
import { createRelay } from '../../../../infra/ai-relay/src/relay.js'

const handle = createRelay()

export default function onRequest(context) {
  return handle(context.request, context.env ?? {}, { clientIp: context.clientIp })
}
