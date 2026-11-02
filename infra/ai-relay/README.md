# AI 中继（`infra/ai-relay`）

线上站点是 **GitHub Pages（纯静态）**：没有后端，浏览器直连任何 OpenAI 兼容网关都会撞
CORS，而把上游 key 打进前端等于公开泄露。结果是「配了模型才有全场景 AI」这句话在线上
实际上不成立 —— 访客必须先自备一个允许 CORS 的网关和自己的 key。

这个中继把这一步补上：**访客零配置**，密钥只在中继的环境变量里。

```
浏览器 ──POST /v1/chat/completions──▶ 中继（CORS 白名单/限流/模型白名单）
                                        └──注入 UPSTREAM_API_KEY──▶ 上游网关
```

## 它替站点守住的四件事

| 风险 | 中继的做法 |
| --- | --- |
| 上游 key 泄露 | 只存在于 `wrangler secret`；**浏览器带来的 `Authorization` 一律丢弃** |
| 被第三方站点盗用 | `ALLOWED_ORIGINS` 白名单；预检与正式请求都校验，非白名单直接 403 |
| 被人拿去做生产 | `ALLOWED_MODELS` + `MAX_TOKENS` 双上限；`stream`/`tools` 不透传 |
| 账单失控 | `RATE_LIMIT`/`RATE_WINDOW_SEC` 每 IP 滑窗；`DISABLED=true` 一键熔断 |

## 部署（Cloudflare Workers）

```bash
cd infra/ai-relay
npx wrangler login
npx wrangler secret put UPSTREAM_API_KEY     # 上游网关的 key
npx wrangler secret put UPSTREAM_BASE_URL    # 例：https://api.openai.com/v1
# 改 wrangler.toml 里的 ALLOWED_ORIGINS / ALLOWED_MODELS，然后：
npx wrangler deploy
```

上线后中继地址形如 `https://es-plus-ai-relay.<account>.workers.dev`。

### 接到站点

在仓库 **Settings → Secrets and variables → Actions → Variables** 里加三项：

| 变量 | 值 |
| --- | --- |
| `VITE_AI_BASE_URL` | `https://es-plus-ai-relay.<account>.workers.dev/v1` |
| `VITE_AI_RELAY` | `true` |
| `VITE_AI_MODEL` | `gpt-4o-mini`（需在 `ALLOWED_MODELS` 内） |

`deploy-docs.yml` 会把它们注入 `es-plus-docs` 的构建。三项都没配也不会构建失败：
页面回到「访客自备 CORS 网关 + key」的默认形态。

> `VITE_AI_RELAY=true` 与 `VITE_AI_BASE_URL` **必须同时存在**才进入免 key 模式
> （判据见 `es-plus-docs/src/utils/ai-endpoint.ts`）。只给地址不给标志时，页面仍会要求
> 访客填 key —— 那不是 bug，是防止把「普通网关」误当成「会替你补密钥的中继」。

## 本地调试

```bash
cd infra/ai-relay
npx wrangler dev            # 默认 http://localhost:8787
# 在 es-plus-docs/.env.local 里：
#   VITE_AI_BASE_URL=http://localhost:8787/v1
#   VITE_AI_RELAY=true
```

记得把 `http://localhost:5173` 加进 `ALLOWED_ORIGINS`（或本地临时用 `wrangler dev --var ALLOWED_ORIGINS:http://localhost:5173`）。

## 不用 Cloudflare 也行

`src/relay.js` 不依赖 Workers 专有 API（除可选的 `RATE_LIMITER` 绑定），`createRelay()`
返回的是一个标准 `(request, env) => Response` 函数，Node 18+/Deno/Bun 可直接挂：

```js
import { createRelay } from './infra/ai-relay/src/relay.js'
const handle = createRelay()
// 把 Node 的 req 适配成 fetch Request 后：const res = await handle(request, process.env)
```

此时没有 `RATE_LIMITER` 绑定，限流退回**进程内**滑窗（单进程有效）。

## 测试

```bash
npm run test:ai-relay     # 15 条：CORS / 模型 / 密钥注入 / 熔断 / 限流 / 上游故障
npm run check:ai-relay    # consistency 里跑的跨系统子集（站点侧三种宿主 + 中继四条止损线）
```

## 已知边界

- **不转发 `stream`**：演示用不上，且流式在 CDN/Workers 下更容易踩超时。
- **不记录请求内容**：中继无日志、无存储；想审成本请看上游网关自己的用量页。
- **限流按 IP**：同一 NAT 后的多人共享额度；正式对外时建议加 Cloudflare Turnstile。
- 公开写死 `ALLOWED_ORIGINS` 只防浏览器跨站盗用，**挡不住**脚本直接发请求（脚本可以伪造
  Origin 头）。真正的兜底是 `RATE_LIMIT` + `MAX_TOKENS` + 上游账户的额度上限。
