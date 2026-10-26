# ES-Plus AI 案例导览（面向用户）

> 这份导览回答一个问题：**站点上那些「AI 原生」页面，各自证明了什么、证据在哪、边界在哪。**
> 它不重复营销文案 —— 每个页面下方都写着它的 `claim`，这里只是把那一套词汇和证据链讲清楚。
>
> 维护者视角的落地记录在 [`docs/internal/ai-showcase-matrix-plan.md`](../internal/ai-showcase-matrix-plan.md)；
> 清单单一真源是 [`docs/cases/ai-cases.json`](../cases/ai-cases.json)。

## 一分钟版

ES-Plus 的 AI 原生能力可以压缩成一句话：**模型只写一份 JSON 配置，渲染器负责把配置变成页面，三端（Vue 3 + Element Plus / Vue 3 + Ant Design Vue / Vue 2 + Element UI）共用同一份产物。**
案例页展示的就是这句话的每一段 —— 写配置的那一段、跑起来的那一段、以及「到底省了多少代码」的那一段。

## 页面地图

| 页面 | 它证明什么 | 证据（可机械复查） |
| --- | --- | --- |
| `/#/ai-gallery` | manifest 里的全部 AI 案例按能力簇列出，产物可下载 | 清单来自 `docs/cases/ai-cases.json`；新增案例不必改页面 |
| `/#/ai-gallery/:id` | 单个案例的产物**真的能跑**：查询、分页、弹窗、批量、树表、行内编辑 | 16 条 Playwright e2e（`__tests__/e2e-runtime/tests/ai-gallery.spec.ts`） |
| `/#/ai-generated` | 一句话 → 采购申请审批页，产物未手改 | `check:generated-case` 逐条断言（reactions / permissionValue / 操作列 / dataOptions） |
| `/#/ai-gallery/workflows` | 前门 12 个公开工具各被**真调用**一次，出参即页面证据 | `check:ai-workflows`（调用记录与页面逐项对账） |
| `/#/ai-gallery/composition` | 组合片段在三端渲染一致，切换渲染端只差包名 | `check:composition` + `check:composition-gallery` |
| `/#/fragment-dashboard` | 片段工具（表单 / 表格 / 弹窗）拼进**非 CRUD** 页面，宿主自己搭布局 | `check:fragment-dashboard`（9 份产物重算逐字节 + 语法解析） |
| `/#/native-vs-ai` | 同一场景三种写法的**实测**成本：原生 / 手写 es-plus / AI 产物 | `cases:metrics:check`（数字与源码同源，改示例即改数字） |
| `/#/flagship-approval` | 手写 JSON 也能三端跑（对照组：证明能力不依赖模型） | `check:flagship-case` 的 13 条断言 |

## 三个 claim 词，别混用

站点每个 AI 页都标着一个 `claim`，含义是**证据等级**，不是宣传强度：

- **`measure`** — 数字是从真实文件里量出来的，可复算（`scripts/gen-cases-metrics.mjs`）。
- **`compile`** — 产物能被解析 / 编译通过，并且已接线；但**没有**自动化证据证明它在浏览器里跑过。
- **`execute`** — 真的跑过，且有 e2e 断言背书。

规则只有一条：**「跑过的才叫 execute」**。所以：

- `es-pc`（Ant Design Vue 端）与 `es-eui`（Vue 2 端）的页面**人工验证过也得停在 `compile`** ——
  本仓没有这两端的 e2e project，人工点一遍不算证据；
- `/#/native-vs-ai` 连 `compile` 都只算「源码可解析」：它是一页**数字与源码**，没有可执行的产物，
  所以它标 `measure + compile`，并在页面里明写「本页不认领 execute」。

## 数字从哪来

`/#/native-vs-ai` 与 `/#/cases` 的成本对照表都**不手写百分比**：

- 场景实现：`docs/examples/native/<场景>.vue` 与 `docs/examples/es/<场景>.vue`，两侧同一功能范围、无省略号；
- 度量：`scripts/gen-cases-metrics.mjs` 用同一套计数器量四个口径 —— 非空行 / 模板事件绑定 / 自写函数 / `v-if` 分支；
- 产物：`docs/cases/cases-metrics.json`（页面读它）+ `docs/cases/generated/native-vs-ai-sources.js`（三栏原文）；
- 守卫：`npm run cases:metrics:check` 重算比对，示例改了而产物没更新就红。

一处刻意的「不吹」：AI 产物那一栏的行数是**不降反升**的（JSON 逐标量一行）。页面把这一栏明写成
「不当作优点」—— 换个序列化风格数字就会变，物理行数不是复杂度信号。真正可比的是事件 / 函数 /
`v-if` 三项归零，以及「一份产物三端跑」。

## 漂移观测（模型升级后先看这个）

案例页展示的产物是「某次模型写过这版配置」，不是「模型必然写出这版」。所以有一个**非门禁**的夜间作业：

```bash
# 探针：只观测一个案例（约 30 s）
npm run drift:ai-cases -- --limit 1

# 全量
npm run drift:ai-cases
```

它用**当前模型**重跑同一段 NL→config，与冻结配置做结构距离（字段集合 / 动作集合 / 弹窗键集合 /
四项字段旋钮），报告写到 `drift-report/ai-case-drift.json`。

- 报告**不入库、不发布**：`drift-report/` 已 gitignore，CI 只把它上传成 artifact；
- **不做门禁**：模型与中继都会抖，漂移变红只会教会大家忽略红色；
- 用法：换模型 / 换中继之后先读漂移报告，再决定要不要重生成案例（而不是凭「页面还绿着」判断）。

## 新增一个 AI 案例

1. 用工具或模型产出配置，落进 `docs/cases/generated/<id>.json`（纯 JSON，无函数值）；
2. 在 `docs/cases/ai-cases.json` 里登记：`id` / `shape` / `mode` / `targets` / `claim` / `sites` /
   `artifacts` / `replay`（能机械重放的写 `frozen-config`，不能的写清原因）；
3. `npm run ai:check` 与 `npm run check:ai-cases -- --strict-coverage` 必须绿 —— 画廊与详情页都是
   manifest 驱动的，登记完不用改页面；
4. 想让 claim 抬到 `execute`：给该案例补一条 e2e，并在 manifest 的 `e2e[]` 里登记。

## 已知边界（如实）

- **`es-pc` / `es-eui` 没有 e2e project**：这两端的 AI 页主张封顶 `compile`，根因在这里；
- **模型那一步不可重放**：可机械重放的只有「产物 → 渲染」这一段；
- **渲染器的成本不在任何一栏里**：声明式的行数优势来自「把复杂度搬进渲染器」，那是 es-plus 自己的
  代码库，按页摊薄但确实存在；
- **`/#/native-vs-ai` 的第三栏不是严格同场景产物**：它是同能力的**超集**（多查询项 / 多列 / 多弹窗），
  偏差方向对 AI 不利，所以保留；
- **片段之间没有编排契约**：片段拼装靠底层组件的既有属性名接线（见 `/#/fragment-dashboard` 的边界清单）。
