# Security Policy

## 当前支持的版本

仅最新 minor 版本接受安全补丁。具体见各包：

| 包 | 当前 | 安全维护 |
|---|---|---|
| `@es-plus/vue3` | 1.4.x | ✅ |
| `@es-plus/vue2` | 1.1.x | ✅ |
| `@es-plus/core` | 1.0.x | ✅ |
| `@es-plus/shared` | 1.1.x | ✅ |
| `@es-plus/cli` | 1.2.x | ✅ |
| `@es-plus/mcp-server` | 1.2.x | ✅ |
| `es-plus-ui` (legacy) | 1.4.x stub | ⚠️ 仅 critical 漏洞 |

## 报告漏洞

**请勿在公开 GitHub Issue / Discussions 里报告安全漏洞。**

请走以下任一渠道：

### 优先：GitHub Security Advisories（推荐）

1. 打开仓库的 [Security 标签页](https://github.com/liujiaao/es-plus/security/advisories/new)
2. 点 "Report a vulnerability"
3. 描述漏洞 + 复现步骤 + 影响范围

GHSA 自带加密通信、CVE 申请通道、修复后协调披露流程。

### 备用：邮件

如无法使用 GHSA：发送至 **liujiao_63@aliyun.com**，标题前缀 `[security]`，包含：

- 漏洞所在的包 + 版本范围
- 漏洞类型（XSS / 原型污染 / 命令注入 / 等）
- 复现步骤（最小化示例）
- 影响评估（攻击者能做什么）
- 你期望的披露时间表

## 响应时间承诺

| 阶段 | 时长 |
|---|---|
| 首次响应 | **24 小时**（工作日） |
| 漏洞验证 | 72 小时 |
| 修复方案确认 | 7 天 |
| 补丁发布 | 14 天（critical）/ 30 天（high）/ 90 天（medium 及以下） |
| 公开披露 | 修复发布后 7-14 天，与报告者协商 |

## 致谢

修复发布后，我们会在 CHANGELOG 和 GHSA 公告中署名报告者（除非你要求匿名）。我们暂不提供 bug bounty 现金奖励。

## 范围

**包含**：

- `@es-plus/*` 任何 npm 包的代码漏洞
- `es-plus-docs` 文档站的 XSS / 注入风险
- mcp-server 协议层面的认证/授权问题
- cli 生成代码中的注入风险（如果生成的代码有可执行漏洞）

**不包含**：

- 用户在自己业务代码中的漏洞（即使配置使用了 es-plus）
- 第三方依赖的已知漏洞——请直接报告给上游（element-ui / element-plus / vue / 等）
- 仅在恶意配置下才能触发的"漏洞"（参考"输入即代码"原则——我们不防御注入恶意配置的开发者）

## 已知不维护边界

- ES-Plus 不防御 XSS：传入 `render` 函数的内容由开发者自行 escape。如果你的业务把用户输入直接塞给 `render`，那是业务代码的安全问题
- mcp-server 默认信任运行它的 MCP 客户端进程；不做沙箱隔离

如有疑问，先邮件咨询再决定是否走 GHSA。
