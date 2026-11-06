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

## 部署（腾讯云 EdgeOne Makers，同源）

仓库里的 `es-plus-docs` 已经由 EdgeOne Makers 部署（项目名 `es-plus-vue3`，生产域名
`https://main.esplus-ai.com`）。中继直接挂进**同一个项目**，于是站点与中继同源：

```
https://main.esplus-ai.com/v1/chat/completions   ← 浏览器同源请求，不必配 CORS
        └─ es-plus-docs/cloud-functions/v1/chat/completions.js
             └─ createRelay(context.request, context.env, { clientIp: context.clientIp })
```

三个站点的线上地址（只有主站承载 AI 工作台，另外两站不需要函数）：

| 站点 | EdgeOne 项目 | 生产域名 |
| --- | --- | --- |
| `es-plus-docs`（Vue 3，含 `/ai-crud`） | `es-plus-vue3` | `https://main.esplus-ai.com` |
| `es-eui`（Vue 2） | `es-plus-vue2` | `https://esui.esplus-ai.com` |
| `es-pc`（Ant Design Vue） | `es-plus-antdv` | `https://antdv.esplus-ai.com` |

仓库里已经放好入口，**不需要新建项目**：

| 文件 | 路由 | 作用 |
| --- | --- | --- |
| `es-plus-docs/cloud-functions/v1/chat/completions.js` | `/v1/chat/completions` | 中继主入口 |
| `es-plus-docs/cloud-functions/healthz.js` | `/healthz` | 存活探针 |
| `es-plus-docs/edgeone.json` | — | `cloudFunctions.nodejs.maxDuration = 120` |

> 前提：EdgeOne 项目的**根目录是 `es-plus-docs`**（现有部署就是这样：`vite.config.ts`
> 里写着「edgeone 只装 es-plus-docs」）。若根目录被改成仓库根，把 `cloud-functions/`
> 与 `edgeone.json` 一起挪到新的根目录即可，路由不变。

### 1. 配环境变量

EdgeOne Makers 控制台 → 项目 → **项目设置 → 构建部署配置 → 环境变量**（改完必须
**重新部署**，旧部署不会热更新）。变量同时供构建期（`VITE_*` 被 Vite 内联）与函数运行时
（`context.env`）使用：

| 变量 | 值 | 说明 |
| --- | --- | --- |
| `VITE_AI_BASE_URL` | `/v1` | **相对路径**：同源，换域名不用改 |
| `VITE_AI_RELAY` | `true` | 缺了它站点仍会要求访客填 key |
| `VITE_AI_MODEL` | 例 `gpt-4o-mini` | 必须在 `ALLOWED_MODELS` 里 |
| `UPSTREAM_BASE_URL` | 例 `https://api.openai.com/v1` | 上游 OpenAI 兼容网关，**不要**带 `/chat/completions` |
| `UPSTREAM_API_KEY` | `sk-...` | 建议存成 **Secret** 类型；只在这里出现 |
| `ALLOWED_MODELS` | 例 `gpt-4o-mini,deepseek-chat` | 公开演示的止损线 |
| `MAX_TOKENS` | `2048` | 压住单次成本 |
| `RATE_LIMIT` / `RATE_WINDOW_SEC` | `20` / `60` | 每 IP 每窗口次数 |
| `DISABLED` | `false` | 出事时改 `true` 一键熔断 |

同源部署**不需要** `ALLOWED_ORIGINS`：中继会认出 `origin === 自身域名` 并放行，
所以 `https://main.esplus-ai.com` 不必写进去。只有「跨站调用」才需要名单 —— 例如
GitHub Pages 版本也走这个中继，或将来 `esui` / `antdv` 也要调主站中继时：

```bash
ALLOWED_ORIGINS=https://liujiaao.github.io,https://esui.esplus-ai.com,https://antdv.esplus-ai.com
```

### 2. 部署并验证

推送/重新部署后（`cloud-functions/` 会被自动识别，目录即路由）：

```bash
BASE=https://main.esplus-ai.com
curl -s $BASE/healthz            # {"ok":true,"disabled":false}
curl -s -X POST $BASE/v1/chat/completions \
  -H 'origin: '$BASE -H 'content-type: application/json' \
  -d '{"model":"gpt-4o-mini","messages":[{"role":"user","content":"ping"}]}'
```

浏览器侧不需要填 API Key：AI 设置里只要页面显示「由本站中继提供」即可。
`npm run check:ai-relay` 会同时核对入口文件、相对 import、`context.env`/`clientIp`
与 `maxDuration`，避免「构建绿、线上 404/403/超时」。

### 为什么是 Cloud Functions 而不是 Edge Functions

Edge Functions 的免费配额只承诺 200 ms **CPU** 时间，也没有文档化的单次挂起上限；模型
补全的墙钟时间常见 10–60 s。Cloud Functions（Node.js）默认 30 s、可在 `edgeone.json`
配到 120 s，且本中继不依赖 Workers 专有 API，原样可用。

### 区域限制

控制台显示「全球可用区（不含中国大陆）」：**中继与站点同区**，所以不会出现「站点能开、
中继被墙」的割裂；但中国大陆访客仍走境外节点，延迟与可达性与现有站点一致。要覆盖
中国大陆需要另行开通 EdgeOne 中国内地节点并完成备案。

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
返回的是一个标准 `(request, env, hints?) => Response` 函数，Node 18+/Deno/Bun 可直接挂：

```js
import { createRelay } from './infra/ai-relay/src/relay.js'
const handle = createRelay()
// 把 Node 的 req 适配成 fetch Request 后：
const res = await handle(request, process.env, { clientIp })
```

第三个参数是**平台判定的真实 IP**（EdgeOne 的 `context.clientIp`、Node 的 socket
remoteAddress 等）。不传就会退回 `cf-connecting-ip` / `x-forwarded-for` —— 后者可伪造，
公开站点不要把它当限流键。

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
