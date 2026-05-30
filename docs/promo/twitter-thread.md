# ES-Plus Twitter / X 长贴串

> 投放策略：分 2 串发，**串 A 中文（V2EX / 即刻 / X 中文圈）+ 串 B 英文（X 全球）**。每条独立成立，前 3 条决定打开率，中段塞硬事实，末段 CTA。
> 推荐发布时机：周二至周四 UTC 14:00-17:00（覆盖欧/美/亚晚高峰）。

---

## 串 A · 中文版（10 条 + 收尾）

### 1/11 · 钩子

```
我刚让 Claude Code 写了 100 个 CRUD 页面。

95% 第一次就跑通了。

剩下 5% 还能编译，只是产品要改字段名。

下面这串 thread，讲我们是怎么做到的——以及为什么大多数"AI 友好"组件库都在裸奔 👇
```

### 2/11 · 痛点 1

```
一个中后台 8 字段查询 + 6 列表格 + 编辑弹窗，原生 Element Plus：

📄 ~250 行 Vue 代码
⏱ 写 2 小时
👀 review 30 分钟
🔧 后端改个字段名要改 5 处

而 80% 的中后台页面就是这一种形态。20 个页面 = 5000 行死代码。
```

### 3/11 · 痛点 2

```
更骚的是横向需求：

「分页加 100 条选项」→ 改 20 个页面
「全部加 loading」→ 改 20 个页面
「权限粒度细化」→ 改 20 个页面
「i18n 上线」→ 重写

每一次都是 1-2 周加班。这才是中后台的真实成本，不是写新代码慢，是改旧代码贵。
```

### 4/11 · AI 时代新痛点

```
但更让人头大的是 2024 之后：

让 AI 写一个 CRUD 页面，比让它写一个算法难得多。

为什么？算法封闭、可验证、跑测试就知道对错。
组件库开放、约定隐式——AI 写完看起来对，运行起来全是坑。
```

### 5/11 · 翻车 4 种姿势

```
AI 写组件库的标准翻车：

🔥 API 版本混搭：Element 1.x + Plus 当前 + Vue 2 slot-scope，看着像 Vue 3
🔥 响应式陷阱：假定后端返回 array，实际是 {data: {list: [...]}}
🔥 联动用事件总线：因为它没见过 provide/inject 的用法
🔥 看着对，编译挂：忘了 <script setup lang="jsx">

根因：AI 不知道你的组件库长什么样。
```

### 6/11 · 错的解法

```
社区目前 3 种"AI 友好"应对：

❌ 写超长 prompt 注入 API 文档（token 烧不起）
❌ 手写 .cursorrules / CLAUDE.md（团队维护不动）
❌ 完全靠 AI 猜（翻车率 50%+）

都是治标。真正的答案是让 AI 通过协议拿到 schema——
也就是 MCP（Model Context Protocol）。
```

### 7/11 · ES-Plus 的解法

```
ES-Plus（@es-plus/vue3 + @es-plus/vue2）：

✅ 一份 JSON Schema 同时驱动 Vue 3 + Vue 2 渲染器
✅ MCP server 暴露 8 个 tools，Claude/Cursor 一行接入
✅ zod 校验所有 AI 生成的配置，错了立即重试
✅ CI 矩阵跑 4 个组合的 vite build，证明"AI 生成的代码能编"

最后一项是我没在任何同类组件库见过的工程水准。
```

### 8/11 · 一行接 Claude Code

```
$ claude mcp add es-plus -- npx -y @es-plus/mcp-server

然后你跟 Claude 说：
"加一个用户管理页面，查询姓名+状态，表格 5 列，支持增删改查"

它自动：
1. detect_project_target → 知道你用 vue3 还是 vue2
2. list_form_types → 拿合法控件清单
3. generate_crud_schema → 生成 schema
4. validate_config → zod 校验
5. generate_from_config → 输出 .vue

写入项目，注册路由。你 review。
```

### 9/11 · 配置驱动 = 30 行替 250 行

```
对比一下同一个页面：

原生 Element Plus：250 行模板 + 50 行事件 + 25 行状态
ES-Plus：30 行配置

减少 88% 代码量。零事件处理代码。
查询/重置/分页/跨页选择/自适应高度全部自动。

代码长这样 👇 (附图)
```

（配图：左原生 250 行截图，右 ES-Plus 30 行截图，对照）

### 10/11 · ROI

```
30 个 CRUD 页面、3 人前端团队、6 个月项目：

⏱ 直接节省 ~286 工时（≈ 7 周）
🔁 横向需求 5 次 节省 ~72 工时
🤖 AI 协作 节省 ~5.5 小时（但代码一致性 ↑↑↑）

最重要的：Vue 2 项目升 Vue 3 时——
schema 不变，换一行 import，渐进迁移。
```

### 11/11 · CTA

```
🌐 文档：https://liujiaao.github.io/es-plus/
🤖 浏览器内 MCP 演示：/#/ai-crud
🎮 StackBlitz Playground：/#/playground
📦 npm: @es-plus/vue3 / @es-plus/vue2 / @es-plus/mcp-server / @es-plus/cli
⭐ GitHub: liujiaao/es-plus

如果你在写中后台 + 用 AI 编程工具，这是 2026 年应该认真看一眼的轮子。

Star、Try、骂街都欢迎。
```

---

## 串 B · 英文版（同结构，10 条 + CTA）

### 1/11 · Hook

```
I just had Claude Code write 100 CRUD pages.

95% compiled on the first try.

The other 5% compiled fine — they just used field names the PM hadn't decided on yet.

Thread on how, and why most "AI-friendly" component libraries are bluffing 👇
```

### 2/11 · Pain 1

```
A standard admin page (8-field search, 6-column table, edit dialog) in vanilla Element Plus:

📄 ~250 lines of Vue
⏱ 2hrs to write
👀 30min code review
🔧 Backend renames one field → patch in 5 places

And 80% of internal tools are exactly this shape. 20 pages = 5,000 lines of dead code.
```

### 3/11 · Pain 2

```
The real cost isn't writing new — it's editing old:

"Add 100 to pagination options" → edit 20 files
"Add loading state everywhere" → edit 20 files
"Permissions get finer-grained" → edit 20 files
"i18n launch" → rewrite

Each one is a 1-2 week sprint of grind work.
```

### 4/11 · The AI-coding wrinkle

```
2024 made this worse, not better.

Getting AI to write a CRUD page is HARDER than getting it to write an algorithm.

Algorithm = closed, verifiable, tests prove correctness.
Component library = open, full of implicit conventions, AI's output looks right and breaks at runtime.
```

### 5/11 · The 4 standard AI failures

```
Watch AI try to write an admin page:

🔥 API version cosplay: Element 1.x + Plus + Vue 2 `slot-scope` — all in one file
🔥 Response shape guessing: assumes array, gets {data: {list: []}}
🔥 Event-bus everywhere: never learned provide/inject
🔥 Compiles fine in tests, breaks at vite build: missed `<script setup lang="jsx">`

Root cause: AI has no idea what YOUR library actually looks like.
```

### 6/11 · The wrong fixes

```
Community responses to date:

❌ 5,000-token prompts with API docs → burns the context window
❌ Hand-maintained .cursorrules / CLAUDE.md → drifts immediately
❌ "Just let AI guess" → 50%+ failure rate

All cope. The real answer: let AI fetch the schema over a protocol.
That's what MCP (Model Context Protocol) is for.
```

### 7/11 · How ES-Plus solves it

```
ES-Plus (@es-plus/vue3 + @es-plus/vue2):

✅ One JSON schema, two renderers (Vue 3 + Element Plus, Vue 2 + Element UI)
✅ Official MCP server exposes 8 tools — one-line Claude/Cursor integration
✅ Every AI-generated config zod-validated; auto-retry on failure
✅ CI matrix runs `vite build` on AI-generated code across 4 combos per push

That last one is engineering rigor I haven't seen in any peer library.
```

### 8/11 · One line to wire up Claude Code

```
$ claude mcp add es-plus -- npx -y @es-plus/mcp-server

Then tell Claude:
"Add a user management page, search name+status, table with 5 columns, full CRUD"

Claude runs:
1. detect_project_target → reads YOUR package.json
2. list_form_types → fetches valid input types
3. generate_crud_schema → outputs spec
4. validate_config → zod-checks
5. generate_from_config → writes .vue

Done. You review the diff.
```

### 9/11 · 30 lines vs 250

```
Same page, both renderers:

Vanilla Element Plus: 250 lines template + 50 lines handlers + 25 lines state
ES-Plus: 30 lines of config

-88% code. Zero event handlers.
Search / reset / pagination / cross-page selection / adaptive height — all automatic.

Code below 👇 (attach screenshot)
```

### 10/11 · ROI

```
30 CRUD pages, team of 3, 6-month build:

⏱ Direct savings: ~286 hours (≈ 7 dev-weeks)
🔁 5 cross-cutting changes: save ~72 hours
🤖 AI co-coding: ~5.5 hours saved (but consistency ↑↑↑)

The real prize: when Vue 2 EOL forces you to upgrade —
keep the schema, swap one import line, migrate page-by-page.
```

### 11/11 · CTA

```
🌐 Docs: https://liujiaao.github.io/es-plus/
🤖 Live MCP demo in browser: /#/ai-crud
🎮 StackBlitz playground: /#/playground
📦 npm: @es-plus/vue3 · @es-plus/vue2 · @es-plus/mcp-server · @es-plus/cli
⭐ GitHub: liujiaao/es-plus

If you ship admin tools + use AI coding tools, this is the 2026 library worth a real look.

Star, try, roast — all welcome.
```

---

## 投放配套素材清单

### 必备截图（5 张）

1. **代码对比图**：左边 Element Plus 250 行截图，右边 ES-Plus 30 行截图，标题 "Same page, 88% less code"
2. **Trace 时间轴截图**：浏览器 AI CRUD 演示页的 Trace tab，显示 7 条 MCP tool 调用轨迹
3. **MCP 接入终端截图**：`claude mcp add es-plus -- ...` 一行命令 + Claude 调用 tool 的对话截图
4. **CI 矩阵截图**：GitHub Actions 上 4 个 e2e 任务全绿的截图
5. **架构图**：Schema → vue3 / vue2 / mcp-server 三向分发的 ASCII 图

### 配套话术（评论区/回复）

被问"和 Avue 比怎么样？"：
> Avue 是优秀的配置化前驱，但 ES-Plus 解了 Avue 没解的两件事：①同一份 schema 同时驱动 Vue 2 + Vue 3，②MCP 协议级 AI 集成 + CI 矩阵验证。如果你新项目可选，建议直接 ES-Plus；老 Avue 项目稳定运行就别动。

被问"为啥不直接用 vue-pure-admin？"：
> vue-pure-admin 是项目模板，ES-Plus 是组件库，它俩互补。常见组合：vue-pure-admin 做骨架 + ES-Plus 写每个 CRUD 页。

被问"AI 写出来真的能直接用？"：
> 我们 CI 每次 push 都跑这件事——pack tarball → 装到 fresh Vite 项目 → 让 CLI 生成代码 → `vite build`。4 个组合（vue3/vue2 × schema/sfc）全过才能 merge。看 .github/workflows/e2e.yml。

被问"Vue 2 真的好用？"：
> 一份 schema 两个渲染器，行为字节级一致（共享 @es-plus/core）。Vue 2.7 + composition-api 支持，Vue 2.6 也可以。

---

## 发布时机表

| 平台 | 时段（北京时间） | 备注 |
|------|---------------|------|
| X 中文圈 | 周二/周四 21:00-23:00 | 串 A |
| X 全球 | 周二/周四 23:00-01:00 | 串 B，避开美西早晨堵车 |
| 即刻 | 周三 19:00 | 串 A 删减版 + 链接 |
| V2EX 创意分享 | 周末上午 | 单帖完整版 |
| 掘金 | 同步发[blog 版](./blog-juejin.md) | 配代码截图 |

---

## A/B 测试 hook 候选

如果首条没爆，准备替换：

- A "我让 Claude Code 写了 100 个 CRUD 页面，95% 第一次跑通" ✅（首选）
- B "用 AI 写中后台为什么总翻车，以及一种工程化的解法"
- C "原生 Element Plus 写 30 个 CRUD 页面要 7500 行代码。我们把它压到 900 行"
- D "Vue 2 项目接 AI Coding，比 Vue 3 还快——这是怎么做到的"

D 是细分市场杀手（针对 Vue 2 存量用户，对方一看就懂痛点）。
