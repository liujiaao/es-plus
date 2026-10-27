# AI 展示案例矩阵 — 诊断与设计方案

> 回答一个问题：**为什么旗舰案例与 AI 生成的「优势案例」这么少，尤其缺少「组件之间组合」的 AI 案例？** 以及：如何在不注水、不重复造轮子、不把评测产物当宣传品的前提下，把 es-plus AI 生成的全场景特色变成**可运行、可断言、可维护**的公开案例。
>
> 关联文档：[example-audit-and-flagship-plan.md](./example-audit-and-flagship-plan.md)（§6 旗舰设计 F1–F7、§11 四引擎复核）、[AI-SCENE-COVERAGE-PLAN.md](../../packages/mcp-server/AI-SCENE-COVERAGE-PLAN.md)（场景/语料度量）、[wave-2-production-trust-design.md](./wave-2-production-trust-design.md)（P1 编译不变量 / P2 收敛口径）、[docs/ai/ai-tools.md](../ai/ai-tools.md)（工具链文案单源）。
>
> **状态（2026-10-26）：🟢 Wave A 已落地。** §9 是落地记录（含实测数字与 5 处偏离设计原文的地方）；§0–§4 保留为落地前的诊断快照，凡与 §9 冲突的以 §9 为准。

## 0. 结论摘要

1. **数量不是主要问题，口径才是。** 站点公开的 AI 案例只有 1 个（`purchase-approval`），它演示的能力令牌按**实测**是 9/40（落地后用词表 + 产物取证重算，见 §9.2；原文的「≈7/40」是概念计数，不是账本计数）；12 个公开 MCP 工具里只有 `generate_crud` 有公开产物（且走的是 CLI 路径，不是 MCP 的 `surfaces` 路径），9 个零案例；18 例组合语料**有度量、无展示**。
2. **「少」有结构性原因，不是没人写。** ①产物形态决定成本：schema JSON 可三站同源运行，sfc/片段是分端源码，团队只做了最便宜的那种；②守卫是「一案例一脚本」的定制写法（330/391 行），新增一例边际成本高；③分层账本按 **demo 写法** 分档，把组合整体压到 D 类，丢掉「值得展示」的标签；④度量产物（golden）与站点之间没有消费通道。
3. **账本已经与生成器能力脱节。** 至少 4 个令牌（`defaultSort` / `tableBtns` / `mergeConfig` / `vxeFirstClass`）在令牌级已是前门声明式，账本却因某个 demo 的实现写法落到 B/C。需要一张**能力级**矩阵，与现有的 demo 级 tier 分开。
4. **证明链不可重放。** `create --ai` 生成完就把 config 丢掉了，站点的 JSON 无法机械证明「等于那次模型输出的确定性编译结果」；`sync-cases.mjs` 硬编码 3 份文件；没有任何「产物 ↔ 意图表」的冻结记录。
5. **方案：manifest 单一真源 + 能力矩阵 + 通用宿主/画廊 + 覆盖门禁。**
   - **S1 展示页 10 例**（新增 9）：每例一个真实业务场景，覆盖 12 个能力簇；
   - **S2 组合画廊**：复用 18 例 composition golden，零新产物；
   - **S3 工作流页**：把 `detect / validate / refine / scaffold / doctor / ingest / list_form_types / get_component_api` 这些零案例工具，加上片段三件套 `generate_form / generate_table / generate_dialog`，做成可重放的工作流记录（前门 12 个工具全覆盖）；
   - **`check:ai-cases`**：manifest、产物、宿主、覆盖、可重放性、站点字节一致、e2e 登记七类断言；覆盖门保证「每个前门可达令牌至少一例」。
6. **CI 零模型调用，accuracy 产物不入库。** 模型只在新增/重生成案例时调用（本文全部案例合计约 9 次）；夜间漂移观测只进 CI artifact，不做门禁、不发布。

## 1. 口径：什么叫「优势案例」

本文把「案例」与「demo」分开：

| 名词 | 定义 | 现有资产 |
|---|---|---|
| 功能 demo | 单组件、单能力的文档示例，证明「这个键有用」 | `docs/ai/feature-coverage.json` 102 个 |
| 核心案例 | Cases 页 L1–L5 梯度，讲痛点/解法/链接 | `docs/cases/cases.json` 15 个 |
| 旗舰案例 | 手工打造、三站同源、有守卫的整页 | `flagship-approval` 1 个 |
| AI 生成案例 | 模型产出的配置/代码，未手工修改，有 provenance | `generated/purchase-approval` 1 个 |
| 组合语料 | 评测用 gold，验证 surfaces → 三端代码的结构正确性 | `__tests__/golden/composition` 18 个 |

**优势案例**的判据（三条同时成立）：

1. 演示的是 es-plus **独有差异**——配置即页面、声明式联动、四引擎、字段级权限、跨端同源、AI 可可靠生成；
2. **可运行**：在至少一个站点真实渲染，关键交互有断言；
3. **主张可追溯**：页面上每句「卖点」都能映射到一个配置键/能力令牌，并被守卫断言，不靠文案自证。

**claim level**（本文新引入，用来替代含糊的「支持」）：

| level | 含义 | 证明手段 |
|---|---|---|
| `execute` | 在 N 个站点真实渲染并可交互 | 站点构建 + e2e 断言 |
| `compile` | 生成源码可编译/类型检查，展示源码但不执行 | golden vite build / typecheck |
| `measure` | 只被评测语料度量，无公开页面 | 现有 scorers / composition |

## 2. 现状盘点（均为实测）

### 2.1 资产

| 资产 | 数量 | 守卫 |
|---|---|---|
| `docs/cases/cases.json` 核心案例 | 15（L1 3 / L2 1 / L3 4 / L4 4 / L5 3） | `cases:check`、`check:case-titles`、`check:cases-links` |
| 手工旗舰 `flagship-approval.*` | 1 | `check:flagship-case`（15 条断言） |
| AI 生成展示 `generated/purchase-approval.*` | 1 | `check:generated-case`（13 条断言） |
| 功能 demo | 102（es-form 20、es-table 19、linkage 24、use-dialog 12、vxe 15、crud-page 10、其它 2） | `check:feature-coverage` |
| 能力令牌 | 40 个 distinct token | 同上 |
| 站点案例镜像 | 215 条（es-eui 96 / es-pc 119），tier A 33 / B 7 / C 54 / D 121 | 同上 |
| 组合语料 | 18（3 形状 × 3 target × 2 例） | `check:composition` |
| 全量 golden | 279（cases）+ 22（prd）+ 2（ingest） | `golden:e2e`、`check:scene-coverage` |
| 公开 MCP 工具 | 12（15 减去 3 个 legacy/advanced） | `check:tool-surface`、`check:tool-shapes` |

### 2.2 能力面

`StructuredCrudConfig` 约 50 个可配置键；`tableOptions` 30+；能力令牌 40 个。按「是否前门（`generate_crud`）一步可达」分：

| 分类 | 数量 | 令牌 |
|---|---|---|
| 前门可达（任一站点有 A 级 demo） | 19 | apiParams, cellDataOptions, columnStyle, configTableOut, dialogs, expandConfig, fieldVisibility, formLayout, formtype, inlineEdit, operationColumn, pagination, permissions, reactions, tableBase, toolbarBtns, treeConfig, validation, virtualScroll |
| 仅 `generate_crud_from_config`（B） | 4 | columnGroups, columnSortable, columnsDecl, defaultSortⓘ |
| 仅函数/宿主编排（C/D） | 15 | crudPage, fieldEventFn, formatterFn, hostOrchestration, hostSkeleton, httpRequestFn, mergeConfigⓘ, renderBtnFn, renderFn, sfcSlot, spanMethodFn, tableBtnsⓘ, useDialogApi, validatorFn, vxeFirstClassⓘ |
| 未映射（独立组件） | 2 | errorBoundary, svgIcon |

ⓘ = 账本口径滞后：`defaultSort` 在 `tableOptions` 里、`tableBtns` / `mergeConfig` 是前门显式参数、`vxeFirstClass`（`engine:'vxe'` + `editConfig`）在 `tableOptions` 里——四者都已是 A，见 §3 G3。

### 2.3 展示覆盖率

| 指标 | 现状（落地前） | 说明 |
|---|---|---|
| 能力令牌被公开 AI 案例演示 | **≈7/40（18%）**（实测 9/40，见 §9.2） | `purchase-approval` 用到 reactions / isHidden / permissionValue / operationColumn / dataOptions / apiParams / toolbarBtns |
| 前门可达令牌被公开案例演示 | ≈7/19（37%）→ 实测 9/21（43%） | 剩下 12 个只在 demo 里；分母 19 是落地前按 demo 口径数的，按源码现算的声明式前门可达令牌是 21 个（§9.1） |
| 组合形状被公开案例演示 | **0/3** | full / table+form / form+dialog 全部只在 golden 里 |
| 公开工具端到端覆盖 | **1/12** | `generate_crud`（CLI 路径）；`validate` / `refine` 只在文案里；9 个零案例 |
| 三端 × 两模式的展示矩阵 | 生成侧 1 格（vue3 × schema），运行侧 3 格 | 其余 5 格为空 |

## 3. 缺口诊断

### G1 一例撑全场：把「AI 能生成 CRUD」当成了全部价值主张

`purchase-approval` 是整页 CRUD，但它**没有把组合说出来**：页面标题是「一句话 → 采购申请审批页」，读者看到的是一个页面，而不是「模型只填意图表，确定性生成器把它拆成 query / table / form / dialog 四个面，并保证三端一致」这条真正的差异。前门的核心设计（`surfaces` 意图表 + 确定性路由）在公开页面上不可见。

证据：`packages/mcp-server/src/tools/generate-crud.ts:203` 的工具描述里写得很清楚（「Your ONE job is to fill `surfaces`」），但站点没有一页展示 surfaces 长什么样。

### G2 组合能力「有度量、无展示」

- 18 例 composition golden：3 形状 × 3 target，`scripts/eval/composition-scorers.mjs` 有完整的组合事实（`membership` / `duplicates` / `actions` / `dialogKeys` / `legacyDialogFormItems` / `operationColumn`）。
- `check:composition` 进 `check:consistency`，每次 CI 都跑；gold vs gold 全绿。
- 但站点**没有任何页面消费这些语料**——它们只存在于测试目录。度量做完了，展示没做。

### G3 账本口径：把「demo 怎么写」当成了「能力能不能生成」

`feature-coverage.json` 的 tier 是**站点案例条目**的属性，不是**能力令牌**的属性。一个 demo 只要自己写了 `spanMethod` 函数，`mergeConfig` 令牌就被归到 C——尽管声明式 `mergeConfig` 早已是前门参数且三端消费。

| 令牌 | 令牌级真实可达性 | 账本现档 | 证据 |
|---|---|---|---|
| `defaultSort` | A（`tableOptions.defaultSort` 前门透传） | B | `structured-config.schema.ts:656`；`generate-crud.ts` 的 `tableOptions` 描述 |
| `tableBtns` | A（`generate_crud.tableBtns`） | C | `generate-crud.ts` crudShape；`TableBtnSchema` |
| `mergeConfig` | A（顶层 `mergeConfig`，三端消费） | C | `structured-config.schema.ts:789`；`capability.ts` `mergeConfig` 行 |
| `vxeFirstClass` | A（`tableOptions.engine:'vxe'` + `editConfig`） | C | `capability.ts` 的 `engine` / `editConfig` 行 |
| `columnGroups` / `columnSortable` / `columnsDecl` | B（前门不收 `columns`，需 `from_config`） | B（正确） | `capability.ts` 与 `ColumnSchema.groups/sortable` |

**结论：** 需要一张**能力级矩阵**（token → 声明式可达性 → 配置路径 → 展示案例），与 demo 级 tier 并存；覆盖门禁只认能力级矩阵。

### G4 12 个公开工具，9 个零案例

| 工具 | 有无案例 | 备注 |
|---|---|---|
| `generate_crud` | 1（CLI `--ai` 路径，非 MCP surfaces 路径） | 组合/路由能力未展示 |
| `validate_config` / `refine_config` | 仅文案 | 收敛主张无页面 |
| `detect_project_target` | 无 | 「AI 自己判断项目是 Vue2/3/AntDV」是最直观的魔法 |
| `generate_form` / `generate_table` / `generate_dialog` | 无 | 片段拼装能力未展示 |
| `ingest_schema` | 无（有 2 例 golden） | 「接管既有表单」的入口 |
| `list_form_types` / `get_component_api` | 无 | 让宿主 LLM 自查询的支撑工具 |
| `scaffold_page` / `doctor_page` | 无 | 工作流闭环（生成→诊断→修） |

→ **部分闭环（2026-10-26，见 §17）**：12 个工具在 S3 工作流页各至少一次**真调用**（W4 补上片段三件套）。
但「有页面演示」不等于「有案例」：~~A8 `fragment-dashboard` 仍未开工~~ → **已落地（见 §18）**：
片段拼进非 CRUD 分析页，es-plus-docs 的主张抬到 `execute`（e2e 背书），另两端停在 `compile`。

### G5 证明链不可重放

1. **CLI 丢弃 config**：`packages/cli/src/commands/create.ts:245-260` 的 AI 分支拿到 `aiConfig` 后直接 `emitFromStructuredConfig`，不落盘 config JSON。展示用的 `purchase-approval.json` 因此无法机械证明「等于那次模型输出的编译输入」。
2. **无 surfaces 冻结**：meta 只记 NL/模型/时间/attempts，不记模型填出的意图表；换模型/换中继后无法区分「模型变了」还是「生成器变了」。
3. **sync 硬编码**：`scripts/sync-cases.mjs:41-52` 手写 3 份文件清单，新增案例必须改脚本，漏改就漏同步。
4. **守卫定制化**：`check-generated-case.mjs` 391 行、`check-flagship-case.mjs` 330 行，每例一套断言；没有「矩阵级」的通用断言。
5. **e2e 不绑定案例**：案例页没有 e2e 断言；`golden:e2e` 只覆盖语料，不覆盖站点页面。

### G6 展示与度量两条腿脱钩

`check:scene-coverage` 只断言「有语料、可编译」；`composition-scorers` 只打分；站点只消费 `cases.json` + 两个手写案例。三者之间没有「一个案例同时出现在度量、展示、守卫」的绑定，于是任何一条腿单独退化都不会被另一个发现。

## 4. 设计方案

### 4.1 三层案例体系

```
S1 展示层（≤10 页，三站可见，execute）
   ├─ A0 采购审批（已有，迁移进 manifest）
   ├─ A1 员工花名册 · 字段三面扇出 + 布局 + 弹窗底座
   ├─ A2 订单批量 · 跨页选择 + 批量按钮 + 导出
   ├─ A3 同一配置三引擎 · el-table / virtual / vxe 行编辑
   ├─ A4 工单处理流 · 多弹窗 + 自定义 key + 每弹窗字段覆盖
   ├─ A5 异构后端 · configTableOut + apiParams + 本地分页
   ├─ A6 复杂表头 · 树形 / 合并 / 展开 / 多级表头（B 级路径）
   ├─ A7 字段级权限 + i18n · 角色切换
   ├─ A8 片段拼装页 · 表单/表格/弹窗嵌进非 CRUD 页面
   └─ A9 三栏对照 · 原生 / 手写 es-plus / AI 生成（带实测数字）
S2 组合画廊（1 页，复用 18 golden，measure + compile）
S3 工作流页（1 页，W1–W4，覆盖前门 12 个工具 / 其中 11 个此前零页面演示）
```

约束：
- **一页一簇**：每页只主打 1–2 个能力簇，页面顶部用 claim 徽章标明 level 与本页演示的令牌；
- **S1 上限 10 页**，超出的能力用 S2/S3 或 ledger 表格承载，避免站点变成案例仓库；
- 每页必须回答「AI 写了什么」：展示产物（JSON/源码）、模型/时间/attempts、以及「哪些是宿主提供的」（mock、权限注入、引擎开关）。

### 4.2 能力簇 → 案例映射

| 簇 | 令牌 | 配置路径 | 展示案例 | 最高 claim |
|---|---|---|---|---|
| C1 字段三面扇出 | formtype, validation, formLayout, columnsDecl | `fields[].inQuery/inTable/inForm/querySpan/formSpan` | A1, A9 | execute |
| C2 声明式联动 | reactions, fieldVisibility | `fields[].reactions{when,fulfill}`, `isHidden`（EXPR_OPS） | A0, A4 | execute |
| C3 码值语义 | cellDataOptions, dataOptions, columnStyle | `fields[].dataOptions[].tagType` | A0, A1 | execute |
| C4 权限端到端 | permissions, operationColumn | `permissions`, `fields[].permissionValue`, 按钮 `permissionValue` | A0, A7 | execute |
| C5 动作编排 | operationColumn, toolbarBtns, tableBtns | `actions`, `operationColumn`, `toolbarBtns`, `tableBtns` | A2, A9 | execute |
| C6 弹窗体系 | dialogs | `dialogs.<key>`（formItems/width/fullscreen/destroyOnClose/cacheKey/configBtn） | A1, A4 | execute |
| C7 跨页选择 | tableBase, pagination | `tableOptions.multiSelect/cachePageSelection/rowkey/localPagination` | A2 | execute |
| C8 引擎切换 | virtualScroll, inlineEdit, vxeFirstClass, treeConfig, expandConfig, mergeConfig, columnGroups, columnSortable | `tableOptions.engine/virtual/editConfig`, `treeConfig`, `mergeConfig`, `columns[].groups` | A3, A6 | execute（A6 部分 compile） |
| C9 后端适配 | configTableOut, apiParams | `tableOptions.configTableOut`, `fields[].apiParams`, `localPagination/refetchKeepPage` | A5 | execute |
| C10 布局与 i18n | formLayout, validation | `formLayout`, `querySpan/formSpan`, `i18n` + `labelKey` | A1, A7 | execute |
| C11 逃生舱 | renderFn, formatterFn, validatorFn, spanMethodFn, fieldEventFn, httpRequestFn, sfcSlot | `fields[].render/formatter`, `tableOptions.spanMethod` | A9（对照列） | compile |
| C12 片段与宿主 | useDialogApi, crudPage, hostOrchestration, hostSkeleton | `generate_form/table/dialog`, `useDialog`, `scaffold_page` | A8, W1–W4 | execute / compile |

> **诚实边界：** C11 的函数值无法用纯 JSON 表达（`render`/`formatter` 是源码字符串，schema 模式降级为 TODO/告警）。A9 里只作为**对照组**出现，claim 必须写 `compile`，不得说成「AI 一步生成」。

### 4.3 S1 案例清单

每例 = 3 份产物（`<id>.json` / `.meta.json` / `.mock.js`）+ 1 条 manifest + 1 条 registry + 1 个 e2e spec；宿主共用（§4.6）。「模型调用」只算真实生成，不算 CI。

| id | 业务场景 | 组合形状 | 主打簇 | NL 种子（摘要） | target × mode | claim | 模型调用 |
|---|---|---|---|---|---|---|---|
| `purchase-approval`（已有） | 采购审批 | full | C2/C3/C4/C5 | 现有 NL | vue3 × schema（JSON 三站运行） | execute | 0（迁移时补 config 落盘需 1） |
| `employee-roster` | 员工花名册 | full | C1/C6/C10 | 「查询姓名/部门/在职状态；列表展示工号、姓名、部门、在职状态、入职日期；新增/编辑/查看三个弹窗，查看全屏且关闭即销毁」 | all × schema | execute | 1 |
| `order-batch` | 订单批量处理 | full | C5/C7/C9 | 「订单列表，支持跨页勾选；工具栏左侧批量通过、导出已选；分页在组件内做」 | all × schema | execute | 1 |
| `ticket-flow` | 工单处理流 | full | C6/C2/C4 | 「工单列表；查看、驳回（必填原因）、指派（选择处理人）三个弹窗；驳回/指派需要 ticket:handle 权限」 | all × schema | execute | 1 |
| `legacy-erp-api` | 异构后端接管 | full | C9 | 「商品列表，接口返回 data.list / 总条数 totalCount，页码从 0 开始」 | all × schema | execute | 1 |
| `org-tree-table` | 组织架构表 | table+form | C8 | 「部门树形表格，按 parentId 平铺数据构树；部门列与负责人列相邻相同值合并；支持展开行看备注」 | all × schema | execute（multilevel header 部分 compile） | 1 |
| `role-portal` | 角色门户 | full | C4/C10 | 「员工列表；薪资列仅 hr:salary 可见；姓名/部门列随语言切换中英文」 | all × schema | execute | 1 |
| `engine-lab` | 引擎实验室 | full | C8 | 「订单列表 5000 行，支持行内编辑金额并校验为正数」 | all × schema（宿主加引擎开关） | execute | 1 |
| `fragment-dashboard` | 片段拼装仪表盘 | 片段 | C12/C11 | 「一个分析页：顶部用 es-form 做筛选，中间用 es-table 展示结果，右侧原生图表；点行打开一个 useDialog 弹窗」 | vue3 × sfc（另两端 compile） | execute / compile | 1 |
| `native-vs-ai` | 三栏对照 | full | C1–C5 | 同 `filter-table` 场景（`docs/examples`） | all × schema | execute + metric | 0（复用 A1 产物） |

**A6（复杂表头）走 B 级路径**：`columns[].groups` / `sortable` 不在前门参数里（§3 G3），这一例用 `generate_crud_from_config` 生成，并在页面上明确标注「B 级：手写配置 → 确定性生成」——这本身就是一个诚实且有说服力的卖点（前门覆盖 80%，剩下的用配置直达）。

**A9（三栏对照）是「优势案例」的头牌**：把 F6 的原生 vs 手写，扩成「原生 / 手写 es-plus / AI 生成」三栏，数字仍由 `scripts/gen-cases-metrics.mjs` 实测（不手写百分比）。它一页就能回答「AI 生成到底省了什么」——行数、事件数、自写函数数、v-if 分支数四个维度。

### 4.4 S2 组合画廊

> **已落地（2026-10-26，见 §13）**。一处偏离：站点侧不现算，而是由生成器把同一批纯函数的
> 结果落成确定性数据模块（es-eui 没有 TS loader、三站三个打包器）—— 单源未让步，理由见 §13.2。

- **零新产物**：直接消费 `__tests__/golden/composition/*.json`（6 个逻辑案例 × 3 target）。
- 页面交互：选形状（full / table+form / form+dialog）→ 选 target（vue3 / vue2 / antdv）→ 左右分栏展示「意图表 surfaces」与「生成后的 config 结构」；高亮 `membership`（同一个字段在几个面出现）与 target 差异（例如某键在 vue2 降级）。
- claim：`measure + compile`（golden 已由 `check:composition` 与 `golden:e2e` 双重把关；页面不运行，但可点开每个 case 的源码）。
- 价值：把已有的 18 例度量**变成可见的组合证据**，边际成本接近 0。

### 4.5 S3 工作流页

| 工作流 | 工具序列 | 展示内容 | 可重放性 |
|---|---|---|---|
| W1 一句话 → 页面 → 纠偏 | `detect_project_target` → `generate_crud` → `validate_config` → `refine_config` | 每步的入参/出参、最终产物、refine diff | 确定性步骤可重放；模型步冻结记录 |
| W2 脚手架 → 诊断 → 修 | `scaffold_page` → `doctor_page` | 生成的文件树、doctor 的问题清单与修复建议 | 全确定性，快照断言 |
| W3 接管既有表单 | `ingest_schema` → `list_form_types` → `get_component_api` | 从既有 schema 草拟的 config、字段类型建议 | 全确定性，快照断言 |
| W4 片段拆装 | `generate_form` → `generate_table` → `generate_dialog` | 三份独立产物（表单 SFC / 表格 SFC / 弹窗 SFC）与各自的集成契约 | 全确定性，快照断言 |

W1 覆盖 `generate_crud` 的 **surfaces 路径**（现有 hero 走的是 CLI NL→config 路径，不是 MCP 路径）；W2/W3 各覆盖 2 个零案例工具；**W4 覆盖三个片段工具**（表单 / 表格 / 弹窗各自独立产物）。因此前门 12 个公开工具在本页**全部至少一次真调用** → **已落地（见 §17）**。A8 是另一件事：把片段拼进非 CRUD 页面并把 claim 抬到 `execute`，与「工具有没有页面演示」是两条轴。

### 4.6 单一真源与宿主架构

**manifest**：新增 `docs/cases/ai-cases.json` 作为矩阵单一真源。

```jsonc
{
  "id": "order-batch",
  "title": "订单批量处理",
  "tier": "S1",
  "cluster": ["C5", "C7", "C9"],
  "tokens": ["tableBtns", "tableBase", "pagination", "configTableOut"],
  "scene": "crud",
  "shape": "full",
  "targets": ["vue3", "vue2", "antdv"],
  "mode": "schema",
  "claim": { "level": "execute", "sites": { "es-plus-docs": "execute", "es-pc": "execute", "es-eui": "execute" } },
  "provenance": {
    "nl": "……",
    "command": "es-plus create order-batch --ai --emit-config -m schema",
    "model": "deepseek-v4-flash",
    "generatedAt": "2026-10-26",
    "attempts": 1,
    "surfacesFrozen": true
  },
  "artifacts": { "config": "docs/cases/generated/order-batch.json", "mock": "…", "meta": "…" },
  "controls": [{ "key": "withBatch", "type": "switch", "label": "批量通过权限" }],
  "e2e": ["cross-page-selection", "batch-export"],
  "guards": ["check:ai-cases"]
}
```

**通用宿主**：每站一个 `AiCaseHost`（Vue3 两个站点共用一份，Vue2 一份），按 `:id` 从 registry 取 `{ config, meta, mock }`，渲染 `<es-crud-page>`；`controls` 驱动权限/引擎/语言开关。现有 `AiGenerated.vue` 保留为 hero 定制页（它的三条试玩主线有叙事价值），其余案例走通用宿主。

**registry**：由 `scripts/sync-cases.mjs` 生成 `src/cases/generated/registry.js`（静态 import 每个案例的 JSON/mock），避免三套打包器的动态 glob 差异。`sync-cases.mjs` 改为**读 manifest** 分发，不再硬编码文件清单。

**画廊**：`/ai-gallery`（三站），列出 manifest 全部案例（按簇分组）、claim 徽章、产物下载链接、S2 组合卡片入口。

**mock 契约**（统一，让通用宿主可行）：

```js
export const controls = [/* 开关声明，可选 */]
export function createPermission(policy) { /* 返回 (code) => boolean */ }
export function createHttpRequest(options) { /* 遵守 rows/records/pageNo 契约 */ }
export function handleRowAction(key, row, payload) { /* 可选：行按钮副作用 */ }
```

### 4.7 守卫设计：`check:ai-cases`

新增 `scripts/check-ai-cases.mjs`（进 `check:consistency`），断言：

| # | 断言 | 防止 |
|---|---|---|
| 1 | manifest 通过 schema；id 唯一；必填字段齐全 | 手滑/半成品 |
| 2 | 产物存在；meta 与 manifest 的 model/target/mode/date/attempts 一致 | 页面说的和产物不符 |
| 3 | config 是纯 JSON（无函数式键、无函数体字样） | 把宿主代码藏进配置 |
| 4 | **可重放**：有 `surfaces` 的案例，用确定性生成器重放，结构事实（membership/actions/dialogKeys）必须与产物一致；无 surfaces 的必须显式 `replay: "unavailable"` 且原因 | 「AI 生成」无法追溯 |
| 5 | **能力证据**：`tokens[]` 经能力矩阵映射到配置路径，产物里该路径非空 | 只写卖点、没真用 |
| 6 | **覆盖门**：每个「前门可达」令牌至少被一个 `execute`/`compile` 案例引用 | 令牌永远没人演示 |
| 7 | **claim 不越界**：`claim.sites[site]` 不得超过 `packages/shared/src/capability.ts` 的 `CAPABILITIES` 格子（如 vue2 的 `virtual` 是 `none`，就不许写 execute） | 跨端过度承诺 |
| 8 | 宿主接线：host 文件存在、registry 有条目、路由注册、Cases/画廊页有入口 | 「案例在库里但站点看不到」 |
| 9 | 站点副本与单源逐字节一致（复用 `sync-cases --check`） | 漂移 |
| 10 | e2e 登记：`e2e[]` 的 spec 必须被运行器 loader 实际加载（import loader 断言名单，不重扫目录） | 静默跳过（见 memory `e2e-runner-filter-silent-skip`） |
| 11 | 不引用评测产物：manifest/产物中不得出现 `accuracy` / `last-accuracy` 路径 | 评测产物被当宣传品发布 |

补充：能力矩阵文件 `docs/ai/ai-capability-matrix.json` 由脚本从 `packages/shared/src/capability.ts` + `StructuredCrudConfigSchema` **现场生成**（不手抄），`check:ai-cases` 校验它与源码一致。

### 4.8 可重放性与漂移观测

1. **`--emit-config`**（CLI 小改）：AI 分支把模型产出的 `StructuredCrudConfig` 写成 `<name>.config.json`，meta 同时记录原始 NL/命令/模型。这是整条证明链的第一块砖。
2. **冻结 surfaces**：新案例生成时，把前门最终采用的意图表冻结进 manifest（`surfaces`），之后 `check:ai-cases` 用**确定性生成器**重放，证明「产物 = 编译(冻结意图)」，无需模型。
3. **措辞校准**：不再宣称「模型输出逐字节可重现」；改为「生成于 \<日期\>，模型 \<model\>；配置已冻结，可由确定性生成器逐字节重放」。模型那一步不承诺可重现（中继/温度/版本都不受控）。
4. **夜间漂移**（非门禁）：`scripts/eval/ai-case-drift.mjs` 用当前模型重跑 NL→config，与冻结配置做结构距离（membership/actions/dialogKeys/knobs），报告写 CI artifact，**不入库、不发布**。模型升级时先看漂移报告再决定是否重生成案例。

### 4.9 与现有资产的接缝

- **不新增评测语料**：S2 直接用 `__tests__/golden/composition`；S1 案例的 config 可作为 `from_config` 的 smoke 输入，但不进 gold 语料（避免「既当选手又当裁判」）。
- **复用 `capability.ts`**：claim 边界直接用 AN-09 矩阵，不另造一套三端支持表。
- **复用 composition scorer**：S2 画廊的 membership 高亮与 `compositionFacts()` 同函数，保证「页面展示的事实 = 评测打分的事实」。
- **feature-coverage 增列**：给 `docs/ai/feature-coverage.json` 的 demo 加 `aiCase` 字段（指向 manifest id），`check:feature-coverage` 校验引用存在；tier 仍按 demo 保留，能力级判断改由新矩阵承担。→ **已落地（见 §16）**；实现上 `aiCase` 是 **id 数组**（一页能力可由两个案例分别演示，见 §16.2）。
- ~~**ROADMAP 映射**：S1/S2/S3 分别对应 AI-28（案例矩阵）、AI-29（组合可见性）、AI-30（工具工作流），落地时同步 `packages/mcp-server/ROADMAP.md`~~ → **映射不成立（2026-10-26 更正）**：`packages/mcp-server/ROADMAP.md` 的 AI-28/29/30 是 `useDialog` 骨架 / `vxeFirstClass` 降档 / SFC-schema 对齐，该文件**没有任何 S1–S3 条目**。展示矩阵以本文为唯一跟踪面，不另建第二份台账（两份必然漂移）。

## 5. 排期

### Wave A — 可见性地基（约 3–4 天，2 次模型调用）

- `--emit-config` + 用新命令重新生成 `purchase-approval`（补 config 落盘与 surfaces 冻结）；
- `docs/cases/ai-cases.json`（先迁 2 个现有案例）+ `docs/ai/ai-capability-matrix.json`（生成脚本）；
- `sync-cases.mjs` 改 manifest 驱动 + 生成 registry；
- `check-ai-cases.mjs`（断言 1–5、7–11）+ `check:ai-cases` 进 `check:consistency`；
- 通用宿主 + `/ai-gallery`（三站）；
- A1 `employee-roster`（1 次模型调用）。

**验收：** `npm run check:ai-cases` / `cases:sync --check` / `check:consistency` 全绿；三站构建通过；A1 在三个站点可交互；e2e spec 被 loader 实际加载。

### Wave B — 覆盖面（约 5–7 天，5 次模型调用）

- A2 / A4 / A5 / A6 / A7 五页（通用宿主，无需新宿主代码）；
- S2 组合画廊（18 golden，0 模型调用）；
- 打开覆盖门（断言 6）：所有前门可达令牌至少一例；
- A6 走 `from_config`，页面标注 B 级。

**验收：** 19 个前门可达令牌全部被 execute/compile 引用；画廊能切换 3 形状 × 3 target；`check:capability-parity` 仍绿（claim 不越界）。

### Wave C — 代码生成与工作流（约 5 天，2 次模型调用）

- A3 `engine-lab`（宿主引擎开关，验证四引擎差异与 memory 中的跨页选择结论）；
- ~~A8 `fragment-dashboard`（vue3 execute，另两端 compile）~~ → **已落地（见 §18）**，
  主张按站分开：`es-plus-docs` = `execute`（e2e 背书）、`es-pc` / `es-eui` = `compile`；
- ~~A9 `native-vs-ai`（扩 `gen-cases-metrics.mjs` 的 AI 列）~~ → **已落地（见 §19）**，claim 按「数字页没有可执行的产物」停在 `measure + compile`；
- S3 工作流页 W1–W4（覆盖前门 12 个工具，其中 11 个此前零页面演示）；
- ~~夜间漂移作业 + 文档（`docs/ai/ai-showcase.md` 面向用户的案例导览）~~ → **已落地（见 §20）**：
  `scripts/eval/ai-case-drift.mjs` + 非门禁 workflow + 用户导览。

**验收：** 12/12 公开工具有页面演示（S3 工作流页，每条一次真调用）；三端 compile 腿绿；漂移作业能跑通 `--limit 1`；站点上线 `ai-gallery` 与四条工作流。

## 6. 风险与边界

| # | 风险/边界 | 处置 |
|---|---|---|
| B1 | 「未经手工修改」不可机械证明 | 只证明「产物 = 编译(冻结配置)」；文案写清模型步不可重放；meta 记录生成时刻与模型 |
| B2 | 结构事实 ≠ 运行时正确 | `execute` 案例必须有 e2e（跨页勾选、条件必填、权限开关）；只靠 `check:ai-cases` 的案例最多 `compile` |
| B3 | 四引擎语义不同（虚拟表事件、vxe 静默 API） | 案例按引擎标注已验证交互；claim.sites 受 `capability.ts` 约束；A3 专门呈现差异而不是掩盖 |
| B4 | B/C/D 级能力被说成「AI 一步生成」 | claim 徽章 + 矩阵 `declarative` 字段；页面文案必须与 claim 一致（守卫可选做人审清单） |
| B5 | 案例数量膨胀 | S1 硬上限 10；每簇 ≤2 例；连续两次夜间漂移未处理则降级为 `measure` |
| B6 | 评测/accuracy 产物被发布 | 断言 11；漂移报告只进 CI artifact；`docs/cases/generated` 只放案例产物 |
| B7 | 三端字节一致只对 schema JSON 成立 | sfc/片段按端生成，分别记录产物与 claim；不混用「同一份字节」措辞 |
| B8 | 模型/中继不可用导致 CI 红 | CI 零模型；所有模型步离线完成并冻结；漂移作业独立、非门禁 |

## 7. 不做什么

- **不做「一令牌一页面」**：40 个令牌 → 40 个页面会失控；令牌级覆盖由 ledger 表格 + 覆盖门承担。
- **不展示 legacy 工具**（`generate_crud_page` / `generate_crud_schema`）：前门档已隐藏，展示它们会误导。
- **不把评测语料搬进站点**：S2 只读现有 golden，不复制、不改写。
- **不宣称模型可重现**：只宣称配置已冻结、编译可重放。
- **不为了凑数新增能力**：案例必须对应真实业务场景与真实配置键；没有配置键支撑的卖点一律不写。

## 8. 最小落地切片（Wave A 第一个 PR）

按依赖顺序，文件级：

1. `packages/cli/src/commands/create.ts` + `packages/cli/src/ai/nl-to-config.ts`：`--emit-config` 落盘 + 返回原始/归一后的 config；
2. `docs/cases/ai-cases.json`（迁 `purchase-approval`、`flagship-approval`）；
3. `scripts/gen-ai-capability-matrix.mjs` → `docs/ai/ai-capability-matrix.json`；
4. `scripts/check-ai-cases.mjs` + `package.json` 的 `check:ai-cases` + 进 `check:consistency`；
5. `scripts/sync-cases.mjs` 改 manifest 驱动 + 生成 `registry.js`；
6. 三站 `AiCaseHost` + `/ai-gallery` 路由 + Cases 页入口；
7. `docs/cases/generated/employee-roster.*`（1 次模型调用）+ e2e spec。

第一个 PR 完成后，矩阵的「骨架 + 1 个新案例 + 覆盖门」即可运行；Wave B/C 只是往 manifest 里加条目。

## 9. 落地记录（Wave A，2026-10-26）

### 9.1 落地了什么

| 步骤 | 文件 | 说明 |
|---|---|---|
| 证明链第一块砖 | [packages/cli/src/commands/create.ts](../../packages/cli/src/commands/create.ts) | `--emit-config <path>`：AI 分支把**模型产出的** `StructuredCrudConfig` 落盘（走 `writeGeneratedFiles`，与其它产物同一条覆盖确认/落盘路径）。没有它，「可重放」只能是口号 |
| manifest 单一真源 | [docs/cases/ai-cases.json](../cases/ai-cases.json) + [schema](../cases/ai-cases.schema.json) | 3 个案例（旗舰 / 采购审批 / 员工花名册）；含 `clusters` 名字表（画廊分组标题的唯一来源）、`replay` 口径、`e2e` 登记 |
| 能力级矩阵 | [scripts/gen-ai-capability-matrix.mjs](../../scripts/gen-ai-capability-matrix.mjs) → [docs/ai/ai-capability-matrix.json](../ai/ai-capability-matrix.json) | 40 令牌 × 配置路径 × **现场推导**的前门可达性 × AN-09 三端支持表。`--check` 进 `check:consistency` |
| 令牌词表 | [scripts/lib/ai-token-map.mjs](../../scripts/lib/ai-token-map.mjs) | 令牌 → `structuredPath`（可达性判据）+ `artifactPaths`（"真的用了"判据）。拼错的键会让矩阵生成器直接报错 |
| 分发计划 | [scripts/lib/case-plan.mjs](../../scripts/lib/case-plan.mjs) | 「单源 → 三站副本 + registry」的**唯一**算法，`sync-cases` 与 `check-ai-cases` 共用（避免"同步写的位置"与"守卫校验的位置"各说各话） |
| 同步器 | [scripts/sync-cases.mjs](../../scripts/sync-cases.mjs) | 删掉硬编码文件清单，改读 manifest；生成 `src/cases/generated/registry.js`（三端逐字节相同，静态 import 而非 glob —— 三站打包器不同） |
| 守卫 | [scripts/check-ai-cases.mjs](../../scripts/check-ai-cases.mjs) → `npm run check:ai-cases` | 断言 1–5、7–11 为门禁；断言 6（覆盖门）默认只报告，`--strict-coverage` 才红。已进 `check:consistency` |
| 确定性重放器 | [scripts/gen-ai-case-artifact.mjs](../../scripts/gen-ai-case-artifact.mjs) → `npm run ai:case:artifact` | `validateAndRepair` → `generateFromConfig` → 抽 `pageSchema` → 写产物。产物**只经此路生成**，手改会被重放断言抓住 |
| 通用宿主 | 三站各一份 `AiCaseHost`（[docs](../../es-plus-docs/src/components/AiCaseHost.vue) / [pc](../../es-pc/src/components/AiCaseHost.vue) / [eui](../../es-eui/src/components/ai-case-host.vue)） | 不含业务规则：请求 / 权限 / 副作用全部来自案例 mock 的统一契约。Vue2 版多一层站点响应适配（本站 `configQueryfieldOutput` 是 data/total/pageIndex） |
| 画廊 | 三站 `AiGallery` + `/ai-gallery`、`/ai-gallery/:id` 路由 + Cases 页入口 | 按能力簇分组、claim 徽章、可机械重放徽章、产物与冻结配置**浏览器内下载**（Blob，不发布文件） |
| 新案例 A1 | [docs/cases/generated/employee-roster.*](../cases/generated/) | 模型 1 次调用（另有 3 次失败试跑，记录在 meta.promptTrials），产物由 `--emit-config` 的配置确定性编译；覆盖 C1/C3/C6/C10 |
| e2e | [__tests__/e2e-runtime/tests/ai-gallery.spec.ts](../../__tests__/e2e-runtime/tests/ai-gallery.spec.ts) | 真实站点（es-plus-docs dev server）里的 5 条断言；Playwright 配置新增 `ai-gallery-docs` project + 第二个 webServer |

### 9.2 实测数字（`npm run check:ai-cases` / `npm run ai:matrix` 的输出）

- **令牌账本**：40 个令牌 = 声明式 **23**（其中前门一步可达 **21**、仅 `from_config` **2**：`columnGroups` / `columnSortable`）+ 无条件发射 4 + 逃生舱 13。
  —— 比 §2.2 的 19 多两个，因为按源码现算把 `defaultSort` / `mergeConfig` / `tableBtns` / `vxeFirstClass` 归位，且 `formLayout` / `operationColumn` 等透传键也被算进"可达"。
- **案例覆盖**：`purchase-approval` 取证 **9** 个令牌、`employee-roster` 取证 **5** 个，并集 **10/40**（前门可达 10/21 = 48%）。旗舰案例 `tokens: []` —— 它是手写的，不冒充"AI 生成的能力演示"。
- **未覆盖的前门可达令牌（11）**：apiParams, configTableOut, defaultSort, expandConfig, formLayout, inlineEdit, mergeConfig, tableBtns, treeConfig, virtualScroll, vxeFirstClass —— 这就是 Wave B 的作业清单，`--strict-coverage` 会逐条点名。
- **可机械重放**：3 个案例里 1 个 `frozen-config`（员工花名册，逐字节可重算）、1 个 `handcrafted`（旗舰，由 `check:flagship-case` 承担）、1 个 `unavailable`（采购审批，历史产物没有 config，见 §3 G5）。

### 9.3 与设计原文的五处偏离（都是为了让主张**可验证**而去掉不可验证的部分）

1. **重放等式换成「产物 = 编译(冻结配置)」，而不是「冻结输入 = 前门意图」**（§4.8.2）。站点加载的 `<id>.json` 是生成器的输出（CrudPageSchema），不是模型输出的 config；能机械重算的只有"这份配置编译出这份产物"。模型那一步（中继 / 温度 / 版本）不作承诺。
2. **`surfaces` 重放冻结的是 `replay.args`（前门完整入参），且只断言结构事实**（membership / actions / dialogKeys），不做逐字节比较 —— 前门不表达 `columns` 等 B 级细节，逐字节比较会让「能表达」与「能再现」混为一谈。（当前没有案例用这条路径，代码已就位。）
3. **"不可重放"必须点名承担者**：`replay.kind` 为 `unavailable` / `handcrafted` 时，`guards[]` 里必须有 `check:ai-cases` 之外的守卫；同理 `sites[site] = execute` 时必须有 `e2e[]` 或专属守卫（§6 B2 的机械化）。于是旗舰与采购审批能保留 `execute`，而只靠 manifest 校验的案例会被压回 `compile`。
4. **"专属守卫"也可以是 e2e spec，不必新写一个 `.mjs`**（§4.3 的清单把"1 个 e2e spec"与"1 条 manifest"并列）。`employee-roster` 的 `guards` 只有 `check:ai-cases`，但它有 `e2e: ["ai-gallery.spec.ts"]` —— 按 §6 B2 的判据（execute 需 e2e 或专属守卫），二者满足其一即可；新增一页的边际成本因此是"manifest + 产物 + 一条 spec"，而不是"再写一个 330 行的脚本"。
5. **覆盖门默认不是门禁**（§4.7 断言 6）。Wave A 只有 10/40，直接开门禁会让 `check:consistency` 常红；`--strict-coverage` 留作 Wave B 的准入开关。

### 9.4 验证记录（本次实际跑过的）

- 守卫：`check:ai-cases` / `ai:matrix --check` / `cases:check` / `data-schemas:check` / `check:data-schemas` / `check:generated-case` / `check:flagship-case` / `check:eol-hygiene` / `check:case-titles` / `check:cases-links` 全绿。
- 负向验证：手改 `employee-roster.json` 的 `pagination.pageSize` → 断言 4（重放）与断言 9（副本一致）同时变红；还原后复绿。
- 站点构建：`es-plus-docs` / `es-pc` / `es-eui` 三站 `npm run build` 全部通过。
- e2e：`ai-gallery.spec.ts` 5/5 通过（清单渲染 / 10 行 + 彩色标签 / 必填校验 + 落库刷新 / fullscreen 弹窗 / 下载 schema）；vue2 项目 17/17 仍绿。
- 浏览器抽查（`vite preview` / `serve`）：es-pc 10 行 + `ant-tag-success/error`；es-eui 14 条总数 + 10 行、`el-tag--success`、新增弹窗三条必填校验、确认后提示 + 首行落库（Vue2 版响应适配生效）。

### 9.5 已知缺口（Wave B 入口）

- 覆盖门 11 个令牌零案例（A2/A4/A5/A6/A7 各页对应到 §4.3）；
- ~~S2 组合画廊（18 golden，零模型调用）与 S3 工作流页未开工~~ → **均已闭环（S2 见 §13 / S3 见 §17）**；
- ~~`docs/ai/feature-coverage.json` 的 demo 尚未加 `aiCase` 字段（§4.9 的接缝，需要另一个守卫 `check:feature-coverage` 配合）~~ → **已落地（见 §16）**；
- ~~`packages/mcp-server/ROADMAP.md` 的 AI-28/29/30 状态待同步~~ → **映射本身写错了（2026-10-26 更正，见 §17.3）**：该文件没有 S1–S3 条目，AI-28/29/30 是别的项。

## 10. 落地记录（Wave B，2026-10-26）

### 10.1 落地了什么

| 主题 | 文件 | 说明 |
|---|---|---|
| 5 个新案例 | [docs/cases/generated/](../cases/generated/) `order-batch` / `org-tree-table` / `expand-row` / `grouped-report` / `legacy-erp-api` / `engine-lab` | 全部 `origin: "config"`：手写冻结配置 → `generateFromConfig`（0 次模型调用）。补齐 11 个未覆盖令牌 |
| `origin` 语义 | [schema](../cases/ai-cases.schema.json) + [check-ai-cases.mjs](../../scripts/check-ai-cases.mjs) | `ai`（必须有 `provenance.model`）/ `config`（必须 `frozen-config` 可重放）/ `handcrafted`（不许声称可重放）。「模型生成」与「手写配置」从此不可混说 |
| 覆盖门开启 | [package.json](../../package.json) | `check:ai-cases -- --strict-coverage` 进 `check:consistency`：前门可达 **21/21** |
| 令牌证据修正 | [ai-token-map.mjs](../../scripts/lib/ai-token-map.mjs) | `expandConfig` 的产物路径补齐 `columns[].expandConfig`（声明式内容落在那列上，`tableOptions.expandConfig` 是 vxe 开关） |
| 宿主：全局请求接管 | 三站 `AiCaseHost` | 字段级 `apiParams` 由 EsForm 自己去取数，读的是**全局** `httpRequest`，不是 `<es-crud-page>` 的 prop。宿主进页把全局请求换成案例 mock、离开恢复原函数 |
| 宿主：勾选传递 | 三站 `AiCaseHost` | `getSelectedRows()` → `handleRowAction(key, row, { selection })`，批量按钮才可能作用在跨页勾选上 |
| 宿主：eui 条件信封 | [ai-case-host.vue](../../es-eui/src/components/ai-case-host.vue) | 案例自己声明了 `configTableOut` 时不再套站点信封（否则 `{list, totalCount}` 会被改写成 `{rows, records}`，映射永远读不到） |
| 画廊切换修复 | 三站 `AiGallery` | `:key="caseId"`：`/ai-gallery/a → /b` 复用同一路由组件，不重建宿主时 `<es-crud-page>` 会拿旧实例配新列 —— 实测表现是「表头换了、行还是上一个案例的、新列全渲染成 `-`」。三端一致（eui 本来就这么写） |

### 10.2 实测数字

- **覆盖**：前门可达 21 个令牌，被引用 21 个（未引用：无）。`check:ai-cases` 通过：9 个案例（7 个可机械重放）、三站副本逐字节一致、claim 未越 AN-09。
- **案例分工**：`order-batch`（tableBtns / configTableOut / formLayout / defaultSort）、`org-tree-table`（treeConfig）、`expand-row`（expandConfig）、`grouped-report`（mergeConfig）、`legacy-erp-api`（apiParams / configTableOut）、`engine-lab`（virtualScroll / inlineEdit / vxeFirstClass）。
- **构建**：`es-plus-docs` / `es-pc` / `es-eui` 三站 `npm run build` 全部通过（eui 因 `dist/` 有文件被系统句柄占用，改 `--dest dist-verify` 验证后删除）。

### 10.3 与设计原文的偏离 + 三条新发现的结构约束

1. **零模型调用的案例必须自报家门**：Wave B 的 5 页不是模型产出，硬说「AI 生成」就是 §6 B4 的反面。故 `origin: "config"` + `replay.kind: "frozen-config"`：能机械证明的是「这份配置编译出这份产物」，用的正是 AI 路径同一个生成器（`generateFromConfig`）。
2. **Element Plus 的展开列与树表互斥**（本计划此前没写）：`table-body/render-helper.mjs` 的 `wrappedRowRender` 一旦发现 `type: 'expand'` 列就走展开行分支，树表分支（`treeData`）整棵走不到 —— 声明式 `expandConfig` 会**静默**吃掉 `treeConfig`。故拆成 `org-tree-table`（树）与 `expand-row`（展开行）两例，不是把两个令牌硬塞进一页。
3. **`mergeConfig` 与 `defaultSort` 互斥**（同理但方向相反）：合并只认**相邻**同值，全局排序会把分组打散，于是合并单元格跨到不相干的行上（实测：`产品中心` 被合到 `前端组` 头上）。故 `defaultSort` 迁到不依赖行序的 `order-batch`。
4. **antdv 的 `sortable` 是服务端语义**：`adaptColumn` 把 `sortable` 映射成 `sorter: true`，而 a-table 的 `sorter: true` **不排本地数据**，只切指示器并抛 `change`；es-plus 目前也不把排序参数透传给 `httpRequest`。结果：同一份 `defaultSort` 在 el-table 会真的倒序、在 a-table 只亮箭头。案例的解法是**后端按金额倒序返回**（三端首屏一致），并在 meta tip 里写明；根治（排序参数进请求）留作缺口。
5. **字段级 `apiParams` 读全局请求**：只给 `<es-crud-page>` 配 `http-request` prop，远端下拉会静默落到站点自带的 demo 请求上。宿主因此接管全局并在卸载时恢复。

### 10.4 验证记录（本次实际跑过的）

- `npm run check:consistency` → 退出码 0（含 `check:ai-cases --strict-coverage`、`ai:matrix --check`、`cases:check`、`check:feature-coverage` 等全链）。
- 浏览器实测（三站 dev server：docs `:4181` / pc `:4182` / eui `:4183`）：
  - `order-batch`：8 行 + 共 26 条，`{list,count}` 被 `configTableOut` 读懂；未勾选就点「批量通过」→「请先勾选要处理的订单」；第 1 页勾 2 行 + 第 2 页勾 1 行 →「已通过 3 个订单」且行状态改到 `已发货`（跨页勾选真的传到了 mock）；三端金额均按降序。
  - `org-tree-table`：三端 3 个根节点、展开后 6 行（子树按 `children` 自动缩进）。
  - `expand-row`：三端 8 行 + 共 18 条，点行首箭头展开「合同条款」只读字段表。
  - `grouped-report`：三端 `研发中心` 跨 4 行、`平台组/前端组` 各跨 2 行；第 2 页 `运营中心` 跨 2 行。
  - `legacy-erp-api`：三端共 23 条（`totalCount` 生效）、供应商列显示名称；下拉选项来自 `/api/suppliers`（4 家），选「鹏程电子」查询后 6 行且全部为该供应商。
  - `engine-lab`：三端切到 vxe，5000 条里只渲染 50 行；双击「数量」出现数值编辑器，改成 42 后点别处落值。
- 站点构建：三站 `npm run build` 通过；docs/es-pc 浏览器回访无 `error` 级控制台消息（vxe 只有 es-plus 自己那条 `keepSource` 提示）。

### 10.5 已知缺口（Wave C 入口）

- ~~**排序参数未进请求**：三端 `sortable` 语义不同（el-table 本地排 / a-table 服务端），es-plus 没有 `sortField/sortOrder` 透传通道 —— 案例只能靠后端预排序对齐首屏，点击排序头在 antdv 侧仍无数据变化。~~ → **已闭环（见 §12）**
- ~~**新案例没有 e2e**~~ → **已闭环（见 §11）**：`ai-gallery.spec.ts` 从 5 条扩到 11 条，5 页升到 `execute`；`engine-lab` 因 inlineEdit 在 AN-09 是 partial 仍停 `compile`（e2e 已登记，主张不越界）。
- ~~S2 组合画廊（18 golden）与 S3 工作流页仍未开工~~ → **均已闭环（S2 见 §13 / S3 见 §17）**；~~`docs/ai/feature-coverage.json` 的 `aiCase` 接缝未做~~ → **已落地（见 §16）**。
- ~~展开行内容改动只存在 vxe 引擎的内部副本（`keepSource`），案例未接 `edit-closed` 持久化 —— `engine-lab` 的 meta 已写明这一点。~~ → **前提错了（2026-10-26 更正）**：vxe 的 `loadTableData` 只做 `reactive(datas.slice(0))`，编辑写的就是 `:data-source` 里那一行；`keepSource` 只是给 `revertData()` 留快照。宿主缺的是「改了哪一格、旧值多少」，已由 `cell-edit` 补上，见 §14。

## 11. 落地记录（Wave B 补课：e2e 主张承担者，2026-10-26）

§10.5 的第一条缺口（新案例没有 e2e）已闭环。这一批只动 `__tests__/e2e-runtime/tests/ai-gallery.spec.ts` 与 manifest 的 `e2e` / `sites` / `claim`，不动任何组件源码。

### 11.1 落地了什么

| 主题 | 位置 | 说明 |
|---|---|---|
| 11 条 spec（原 5 条） | [ai-gallery.spec.ts](../../__tests__/e2e-runtime/tests/ai-gallery.spec.ts) | 新增 6 条：跨页勾选 + 批量动作、树展开、展开行、合并单元格、异构后端（信封 + 远端下拉）、vxe 大表 + 行内编辑 |
| 画廊断言改为 manifest 驱动 | 同上 | 卡片数 / 标题 / 能力簇标题 / 「可机械重放」条数都从 `docs/cases/ai-cases.json` 现算 —— 加案例只改 manifest，spec 不会假红 |
| claim 抬升（仅 docs） | [ai-cases.json](../cases/ai-cases.json) | `order-batch` / `org-tree-table` / `expand-row` / `grouped-report` / `legacy-erp-api` 的 `es-plus-docs` → `execute`，顶层 `claim` 随之 `execute`；`es-pc` / `es-eui` 仍是 `compile`（那两端没有 e2e，主张按站分开写） |
| e2e 登记 | 同上 | 6 页 `e2e: ["ai-gallery.spec.ts"]`；`engine-lab` 也登记（测试真的跑），但 claim 停在 `compile` |

### 11.2 实测数字

- `npx playwright test -c __tests__/e2e-runtime/playwright.config.ts --project=ai-gallery-docs` → **11 passed**（约 21–40 s，含 vite dev server 起停）。
- `npm run check:ai-cases` → 通过：9 个案例（7 个可机械重放）、三站副本一致、claim 未越 AN-09；覆盖报告仍 21/21（`--strict-coverage` 绿）。
- `npm run cases:sync` 重新生成三站 registry（改 manifest 后必须跑，否则断言 8 红）。

### 11.3 这一批新发现的四条结构约束（都写进 spec 注释里）

1. **manifest 的 `replay` 是对象、registry 里是字符串**：`{kind: "frozen-config"}` 在 `cases:sync` 时压成 `"frozen-config"`。spec 直接读 manifest，所以要两种形态都认（`replayKind()`）。这也是「断言跟 manifest 走」的代价：单一真源有两种投影。
2. **Element Plus 的折叠子树留在 DOM 里**：折叠态子行是 `display:none` 的 `tr.el-table__row`，所以数行必须 `:visible`；而 `el-table__row--level-N` 只加在**有子树**的行上 —— 叶子根节点（职能中心）没有 level 类，根节点数只能靠可见行数（3），不能靠 `--level-0`（只有 2）。
3. **树表里不能用 `hasText` 认子节点**：备注列（`note`，inTable）就写着「下设平台组、前端组、测试组」，`hasText: "平台组"` 会命中父行。改成「层级类 + 第一列文本数组」（`toHaveText([...])` 逐行比对）。
4. **vxe 的单元格编辑提交在失焦，不在回车**：`handleGlobalKeydownEvent` 的 Enter/Esc 分支都在 `keyboardConfig` 下，本案例没开 `keyboardConfig`，回车在输入框里什么也不做（实测：按 Enter 输入框仍在、单元格仍是空文本，因为 input 的 value 不算 `innerText`）。spec 因此点另一个单元格触发提交 —— 这也解释了为什么「Enter 保存」的直觉在这个案例上是错的。

### 11.4 仍未闭环

- `es-pc` / `es-eui` 没有对应的 e2e project，5 页在那两端的 claim 保持 `compile`（诚实：跑过的才叫 execute）。
- `engine-lab` 的 execute 需要 inlineEdit 在 AN-09 的 vue3 格子从 partial 变 full。**这条此前写错了原因**：`tableOptions.editConfig` 的 `partial` 是**引擎域**的事实（只有 vxe 引擎吃它），不是「编辑不回写」；回写本来就有，缺的是给宿主的 `cell-edit`，已于 §14 补上。claim 天花板是**结构性**的（`check-ai-cases` 断言 7：令牌非 full ⟹ 站点主张封顶 compile），改代码不会把它抬到 execute。

## 12. 落地记录（服务端排序契约 `tableOptions.sortParam`，2026-10-26）

§10.5 的第一条缺口（排序参数未进请求）已闭环。这一批补的是**一个契约**，不是一个开关：
「表头点一下 → 后端按新顺序重取**当前页**」在 el-table / element-ui / a-table 三种事件形态下
语义一致，且参数名可改（`{ field, order }`）。改前 antdv 侧点表头只有箭头动、数据不动
（§10.3 第 4 条）；改后三端走同一个求值点与同一条请求漏斗。

### 12.1 落地了什么

| 主题 | 位置 | 说明 |
|---|---|---|
| 单求值点 | [table-sort.ts](../../packages/core/src/table-sort.ts)（新） | `resolveSortParam` / `normalizeSortOrder` / `toTableSortState` / `sameSortState` / `seedSortState` / `buildSortParams`；`DEFAULT_SORT_PARAM_NAMES = { field: 'sortField', order: 'sortOrder' }`。纯函数，三端只 import 不重写 |
| 请求漏斗合并 | 三端 `es-table` 的 `component.vue` | `{ ...params, ...buildSortParams(options, sortState) }` 拼在**唯一**出口（首屏 / 翻页 / 边界回退 / 表头重取都走它）；`changeTableSort` 归一 → 去重（`sameSortState`）→ `httpRequestInstance(undefined, { keepPage: true })` |
| 本地排序关闭 | 同上 + 三个 `vxe-engine.vue` | el-table / element-ui 的列降为 `sortable: 'custom'`；vxe 的 `sortConfig.remote` 在「有代理配置 / 列是 custom / 声明了 sortParam」时置真；a-table 的 `sorter: true` 本来就是服务端语义 |
| vxe 事件归口 | vue2 / vue3 / antdv 的 `vxe-engine.vue` | `sort-change` 与 el-table 同形（`prop` / `order`），此前 vxe 分支**完全没有**排序处理器 —— 点表头不动数据；现在汇到同一个 `changeTableSort` |
| AI 契约七层同步 | shared zod4 / mcp inline zod4 / fragment zod3 / 前门旋钮 zod3 / JSON schema ×4 / 生成器双模式 / 矩阵+令牌表 | 新增 `tableOptions` 键要七层同时表态。zod3 与 zod4 不能共享对象，前门用 union 形态镜像；`check:tool-shapes` 逐键比对，漏一层即红 |
| 案例 | [order-batch](../cases/generated/order-batch.json) | `sortParam: true` + mock 真的按 `sortField/sortOrder` 排整份数据（参数没到就保持金额倒序），令牌覆盖仍 22/22 |
| e2e | [ai-gallery.spec.ts](../../__tests__/e2e-runtime/tests/ai-gallery.spec.ts) | 新增「点金额表头按服务端排序重取，且保留当前页」：跨页不等式（第 2 页每一行都大于第 1 页每一行）证明后端排了整份数据，页码停在 2 证明保留当前页 |

### 12.2 语义（三条不变量，都有单测）

1. **声明才发参数**：未声明 `sortParam` 时请求逐字节不变（`buildSortParams` 返回 `{}`）。
2. **无方向就不发**：清除排序时**省略**两个键，不发空串（严格后端会把空串当非法枚举）。
3. **播种与去重同源**：`defaultSort` 同时播种首屏参数与表头指示器；引擎挂载回抛的同一状态不触发第二次请求；排序变化保留当前页（`keepPage: true`），只有「查询/翻页」才回第 1 页。

### 12.3 实测数字

- 单测：core + shared **1240**、vue3 **639**、vue2 **393**、antdv **684** 全绿（core 新增 `table-sort.spec.ts` 19 条，三端各补接线用例）。
- e2e：`npx playwright test -c __tests__/e2e-runtime/playwright.config.ts --project=ai-gallery-docs` → **12 passed**（23.6 s）。
- 守卫：`npm run check:consistency` 退出码 0；其中 `check:tool-shapes` 8 颗旋钮逐键一致、`check:threeway-consistency` 的探针把 tableOptions 改成 `{ probeSort, probeDir }`（证明改键形态不会被剥掉）、`check:capability-parity` 15 键 × 3 端全绿、`check:ai-cases --strict-coverage` 覆盖 22/22。
- 矩阵：**41** 令牌 / **24** 声明式 / **22** 前门可达。
- 构建：`es-plus-docs` / `es-pc` 的 `vite build` 通过；`es-eui` 走 `npm run build -- --dest dist-verify`（`dist/` 有文件被系统句柄占用），验证后删除。

### 12.4 这一批新发现的四条结构约束

1. **Element Plus 的点击循环是 ascending → descending → null**，不是回到 ascending。所以 `defaultSort` 播种 descending 的列，第一次点击是**清除**（`aria-sort` 变空、参数消失、数据回落到后端默认序），第二次点击才是升序。e2e 因此按 `aria-sort` 断言（`th` 上 `ariaSort: column.sortable ? column.order : undefined`，是可靠指示器），而不是数箭头图标。
2. **vxe 的 `sort-change` 不接就等于没排序**：它的负载与 el-table 同形，但没有 el-table 那套内置状态机；vue2 / antdv 的 vxe 分支此前零处理，服务端排序下点表头只切箭头。三端都补了 `handleVxeSortChange` → 同一个处理器。
3. **a-table 的清除是 legacy 形态**：第三击 `sorter` 只剩 `{ field, order: null }`（`column` 已空），`toTableSortState` 必须接受 `prop/field/key/column.prop` 四种来源才归一得掉。
4. **`FieldConfig` 没有 `sortable`**（只有顶层 `ColumnSchema` 有）⟹ 由 `fields` 派生的列，只有在 `defaultSort` 点名时才可排；`columns[]` 轴仍可任意声明 `sortable`。本批**没有**为 AI 字段面扩这个键（那是另一条轴），案例因此用 `defaultSort` 点名的 `amount` 列做演示。

### 12.5 仍未闭环

- **多列排序未建模**：`sorter` 是数组时只取第一列（三端一致地降级），按优先级的多列排序属 Wave C。
- **参数只进请求、不改宿主数据**：后端没按参数排时，组件照原样显示（不本地兜底）—— 这是刻意选择，本地兜底会掩盖后端契约违约。
- ~~Wave C 其余项不变：S2 组合画廊（18 golden）~~ → **已闭环（见 §13）**；~~S3 工作流页~~ → **已闭环（见 §17）**、~~`feature-coverage.json` 的 `aiCase` 接缝~~ → **已闭环（见 §16）**、`engine-lab` 的 `edit-closed` 回写 → **`cell-edit` 已落地（见 §14）**，但 claim 仍停在 compile（结构性封顶，不是这个事件没做）。

## 13. 落地记录（S2 组合画廊，2026-10-26）

§4.4 的 S2 已落地：`/ai-gallery/composition` 一页承载 **18 例组合语料（6 个逻辑案例 × 3 端）**，
claim 仍是 `measure + compile` —— 页面**不运行**生成的页面（「三端可交互」那句由 S1 案例自己的
e2e 承担），只证明两件事：**度量对得上**（每个字段在几个面出现）、**产物编译得过**。

### 13.1 落地了什么

| 主题 | 位置 | 说明 |
|---|---|---|
| 生成器 + 守卫 | [gen-composition-gallery.mjs](../../scripts/gen-composition-gallery.mjs)（新） | 用**评测同一个函数**（`composeInputOf` → `composeCrudConfig` → `compositionFacts` → `generateFromConfig`，片段形状走真前门）算出 18 例的 facts / 逐项对照 / 产物，落成确定性数据模块；`--check` 重算并与仓库字节比对，同时验三站副本、页面/路由/入口接线、双页同源，以及 6 条非空证明 |
| 单源数据 | [composition-gallery.js](../cases/generated/composition-gallery.js)（新，226,928 B） | `COMPOSITION_GALLERY = { version, shapes, targets, cases[18], bases[6] }`；三站副本由 `npm run cases:sync` 分发（`case-plan.mjs` 新增 `composition-gallery` 条目） |
| 判据单源 | [composition-scorers.mjs](../../scripts/eval/composition-scorers.mjs) | 新增 `composeInputOf` / `compositionFactProblems` / `fragmentProblems`：评测与画廊共用同一份「怎么喂 compose」「怎么判 facts ↔ expect」，`composition-scorers.test.mjs` 里原来的本地副本删掉 |
| 页面 | [AiComposition.vue](../../es-plus-docs/src/views/AiComposition.vue)、[es-pc 同名](../../es-pc/src/views/AiComposition.vue)、[ai-composition.vue](../../es-eui/src/views/ai-composition.vue) | 左「意图表 surfaces」右「组合事实（含成员关系矩阵）」+「三端对照」+「生成产物」；只用原生控件与本地 CSS 变量，**不引 UI 库组件** ⇒ 三站视图形状一致（前两站逐字节相同，es-eui 仅 script 换 Options API） |
| 接线 | 三站 router + 三站 `AiGallery` 入口卡 | `/ai-gallery/composition` 排在 `/ai-gallery/:id` 之前；画廊页新增 `.ai-gallery-comp` 入口（`check:composition-gallery` 断言三处都在，删掉即红） |
| e2e | [ai-gallery.spec.ts](../../__tests__/e2e-runtime/tests/ai-gallery.spec.ts) | 新增一条：列表点入口进页面 → 逐项对照全绿 + `data-faces="3"` 的字段存在 → 切 antdv 后 pageSchema **逐字节不变** → 切 form+dialog 出 `useAddDialog` 片段 → 片段跨端归一化后逐字节相同 |
| npm | `composition:gallery` / `check:composition-gallery` | 后者已进 `check:consistency` |

### 13.2 与 §4.4 原文的偏离（一处，有结构性理由）

§4.4 写的是「**零新产物**：直接消费 `__tests__/golden/composition/*.json`」。实际落地是
**生成一份确定性数据模块**，理由有两条，都是硬约束：

1. **es-eui 的 webpack 链路没有 TS loader**，而组合计算的全部入口（`compose-crud-config.ts` /
   `structured-generator.ts` / 前门）都是 TS。站点侧「现算」在 es-eui 上根本无法编译。
2. 三个站点是三个不同的打包器（vite ×2 + vue-cli/webpack）。把 shared 源码拖进站点产物意味着
   三种 bundler 各自的解析行为都要被验证一遍 —— 成本远高于「Node 里算一次、发一份 JS 数据」。

**没有让步的是单源**：数据仍由 `composeCrudConfig` 与 `compositionFacts` 现算（不落 JSON 快照、
不手抄数字），`--check` 每次重算并逐字节比对；页面**只渲染**，不在浏览器里重写判据 ——
否则同一件事会有第三份实现，与评测漂移时页面仍会自信地显示「全绿」。

### 13.3 实测数字

- 语料：18 例 = 6 个逻辑案例 × 3 端；形状 3 × 6 例；6 个基案例的 `factsEqual` 全真（端间差异不会被当成能力差异）。
- 端间差异**只有两类，且都是结构性的**：① 片段形状的产物只差渲染端包名（`codeEqual=false` 但
  `generatedEqualIgnoringTargetImports=true`）；② 宿主装配块按端不同（Element Plus / Ant Design / Element UI），
  这是宿主预检块，不是组合差异。有表形状是 **schema 模式下 pageSchema 与生成代码三端逐字节相同**。
- 生成提示（页面如实展示）：`full` 6 / 12 条「自动归一」（弹窗表单项补键）、`form+dialog` 1 条
  （antdv 片段是 `.tsx`，需 `@vite-jsx`）、`table+form` 0 条。（这 12 条属噪音，§15 之后归零。）
- 守卫：`npm run check:composition-gallery` 绿（单源新鲜 + 三站副本一致 + 接线完整 + 6 条非空证明）；
  `npm run check:composition` 仍绿（同一批 fact 判据）；`npm run check:consistency` 退出码 0。
- e2e：`--project ai-gallery-docs` → **13 passed**（24.2 s，含新增那条）。
- 构建：`es-plus-docs`（1m08s）/ `es-pc`（30.5s）/ `es-eui`（`npm run build -- --dest dist-verify`，54.7s，验后删除）。
- 台账：`npm run sites:coverage:gen` 把 `AiComposition` 登记进 es-pc 的 `siteUncovered`（与 `AiGallery` 同级：
  它是检视页，不是同名单源演示）。

### 13.4 这一批新发现的三条结构约束

1. **「不许信产物里的自述判据」**：第一版守卫只断言 `factsMatchExpect`（生成物里写死的标记），
   于是「篡改组合事实」的非空证明当场失效 —— 判据读的是被篡改者自己。现在 `modelProblems` 用
   `compositionFactProblems(c, c.facts)` 与 `canonJson(checksOf(c))` **重算**再比对；同一课适用于任何
   「生成物自带判定结果」的守卫。
2. **schema 模式下的产物是端无关的**：这点此前只是「观察到」，S2 把它变成了页面上的可读事实
   （切渲染端后 pageSchema 逐字节相同）与 e2e 断言。⟹ 「三端差异」此后只有 **渲染端 import** 与
   **宿主装配块** 两处可解释来源；出现第三种就是缺陷。
3. **弹窗表单项的成员键是死键**：`dialogs[*].formItems[*]` 上的 `inQuery/inTable/inForm` 在三个渲染端
   都不被读取（弹窗体只看 `prop/label/formtype/attrs/options`），schema 又给它们 `.default(true)`，
   于是展开时从顶层字段整份抄进来并各发一条「自动归一」——这是**噪音**。（原文写「schema 要求必填」
   不准确：省略并不报错，是 Zod 把默认值实体化；见 §15.1 的复核。）是否顺手改成「只补 `inForm: true`、
   其余置 false」属于 shared 契约变更，当初登记为开放项 —— **已在 §15 按「不抄」落地**。

### 13.5 仍未闭环

- es-pc / es-eui 没有对应的 e2e project，S2 在两端的 claim 保持 `measure + compile`（与 §11.4 同一条纪律）。
- ~~§12.5 的 Wave C 余项：S3 工作流页（W1–W3 覆盖 8 个零案例 MCP 工具）仍未开工~~ → **已落地（见 §17）**；
  ~~`feature-coverage.json` 的 `aiCase` 接缝~~ → **已落地（见 §16）**（`engine-lab` 的 `cell-edit` 见 §14）。
- 上面 13.4 第 3 条的「弹窗体成员键」**已在 §15 落地**（展开只投影表单面，噪音归零）。

## 14. 落地记录（vxe 行内编辑归一为 `cell-edit`，2026-10-26）

起因是 §11.4 那条「`engine-lab` 的 execute 需要 vxe 侧把编辑结果回写 `data-source`」。
按源码复核，**这条前提是错的**，三件事一起更正。

### 14.1 调查结论（先证伪，再补缺）

1. **编辑本来就回写**：vxe 的 `loadTableData` 对入参只做 `reactive(datas.slice(0))` —— 那是**同一批行对象**，
   编辑写进去的就是宿主传进 `:data-source` 的那一行；es-table 的深监听照常发 `update:dataSource`。
   `keepSource` 只是另存一份快照供 `revertData()` 用，不是「内部副本」。引擎里那条「改动不回写」的
   DEV 警告因此是**错的**，已删除（三端同）。
2. **claim 天花板是结构性的**：`tableOptions.editConfig` 在 AN-09 能力矩阵里是 `partial`（只有 vxe 引擎吃它，
   这是**引擎域事实**、不是缺陷）。`check-ai-cases.mjs` 断言 7：任何非 `full` 的令牌把该站主张封顶在 `compile`。
   ⟹ `engine-lab` 停在 `compile` 与「编辑回不回写」无关，改代码抬不上去。仍停 `compile`。
3. **真正缺的那一块是事件**：vxe 原生 `edit-closed` 只给 `{ row, column }` —— 没有旧值，字段名还埋在
   `column.property` / `field` / `prop` 里。宿主想知道「改了哪一格的什么值」只能自己拍快照。

### 14.2 落地

| 层 | 位置 | 说明 |
|---|---|---|
| 判定（单一实现点） | `packages/core/src/table-edit.ts`（新） | `resolveEditProp` / `snapshotEditRow` / `diffEditRow`；三端引擎都只调这三个，不再各写一遍 |
| 载荷类型 | `packages/core/src/types.ts` `CellEditPayload` | `{ row, prop, value, oldValue }`。**刻意不带 `rowIndex`**：`dataSource.indexOf(row)` 在响应式代理下不可靠 |
| 引擎（vxe） | 三端 `engines/vxe-engine.vue` | `edit-actived` 拍快照、`edit-closed` 比一遍 → 每处改动发一条 `cell-edit`；未改值不发；会话对不上（换行 / 数据被替换）时不猜旧值 |
| 转发 | 三端 `es-table` → `es-crud-page` | Vue 3 端已声明事件不在 `$attrs` 里，必须显式接；Vue 2 端 es-table **不**重新 emit（`v-on="$listeners"` 与具名 `@cell-edit` 会各触发一次） |
| 案例 | `docs/cases/generated/engine-lab.{mock.js,meta.json}` + 三站 `AiCaseHost` | mock 加 `handleCellEdit`；宿主**不**走 `notify()`（它顺手 `refresh()`，会把没落库的编辑当场打回原值），只弹提示 |
| 案例配置 | `engine-lab.config.json` 的 `editRender` | 由 `$input` + `type: 'number'` 换成 `VxeNumberInput`：只有真进编辑态才会暴露的 deprecation 警告（es-pc 上实测，见 §14.5），两个 vxe 大版本都提供这个 renderer |
| 文档 | 三站 es-table 事件表 / `structured-config.schema.ts` / `table-options.schema.json` / `ai-nl-to-config-prompt.ts` / `conventions.ts` | 事件表加 `cell-edit`；契约文本把「tracked on an internal copy」改成「直写行对象 + `cell-edit`」 |
| e2e | `ai-gallery.spec.ts` 引擎实验室那条 | 失焦提交后断言宿主弹出的提示里带「哪一行 + 旧值 → 新值」，即事件真的到达宿主 |

### 14.3 这一批的三条硬约束

1. **会话槽不能用 `ref`**：`ref(obj)` 会深转成 `reactive`，读 `session.row` 拿到的是 `reactive(row)` 代理，
   与 `edit-closed` 递进来的行对象不是同一引用 —— 身份校验永远失败、事件永远不发。真实环境看不出（vxe 的行
   本来就是代理，`reactive(代理)` 返回同一个代理），只有单测用裸对象时才暴露。三端一律用普通变量。
2. **两端的事件合并语义相反**：Vue 3 的 `mergeProps` 把 `v-bind` 里的 `onEditClosed` 与模板 `@edit-closed`
   合成**数组**；Vue 2 的 `v-on="obj"` 与同名具名监听**互相覆盖**（逃生舱会被静默吞掉）。于是 Vue 3 走
   模板监听（数组天然串起来），Vue 2 走 `computed` 里显式 compose。单测的桩必须容忍数组形态。
3. **案例标题此前越界**：原题「5000 行虚拟滚动」不成立 —— `pagination.pageSize` 是 50，既没有 `virtual`
   也没有 vxe `scrollY`，只渲染 50 行谈不上虚拟滚动（vxe 的差异化优势在**换引擎的成本**与虚拟化能力，
   不在这一页的 50 行）。标题改为「一个枚举换引擎，5000 条里原地编辑」，e2e 注释同步更正。

### 14.4 验证记录

- 单测：core 430 / vue3 646 / vue2 398 / antdv 690 全绿（新增 `table-edit.spec.ts` 13 条 + 三端接线各 4–5 条）。
- 守卫：`check:exports`（公开契约类型 36）/ `cases:check` / `schemas:check` / `check:ai-cases` 等见 §14.5。

### 14.5 全量守卫与站点验证（实测）

- **`npm run check:consistency` → 退出码 0**（全量 ~70 条守卫）。与本批相关的三条是重点：
  - `check:parity`：`EMIT_CONTRACT['es-table'].expected` 收录 `cell-edit`；Vue 2 端登进 `forwarded.vue2`
    并附**投递证明**（`<vxe-engine` 锚点 + `v-on="$listeners"` token），因此它**不能**再出现在 `emits` 里
    （既声明又透传会被判「声明了却从不 emit」）。
  - `check:site-api-drift`：三站 es-crud-page 事件表与 es-eui EsTable 事件表补上 `cell-edit`；Vue 2 的透传
    走 `FORWARDED_EVENTS` 豁免（附链路文件清单）。顺带修掉了一个**假阳性源**：注释里带引号的 `$listeners` /
    `$attrs` 会被 `typeLiteralKeys` / `topLevelKeys` 当成 emit 名，本批三处注释已改成不带引号的写法。
  - `check:readme`：README / README.en.md 的契约类型计数 35 → **36**（新增 `CellEditPayload`）。
- **单测**：core 430 / vue3 646 / vue2 398 / antdv 690 / shared 823，全绿。
  （新增：`table-edit.spec.ts` 13 条；三端引擎各 4–5 条；es-table、es-crud-page 三端各 1 条转发断言。）
- **三站构建**：es-plus-docs 59.69s、es-pc 20.33s、es-eui 退出码 0（产物落 `--dest dist-verify`，验完即删，
  避开 `dist/` 的句柄占用）。三站均无新增告警。（构建跑在「案例配置改 `VxeNumberInput`」之前；那之后只动了
  JSON 数据，由 e2e 与两个 dev 站点复验，不再重复构建三站。）
- **e2e**（`__tests__/e2e-runtime`）：`--project=ai-gallery-docs` 单跑引擎实验室 → 1 passed（1.7s）；
  整项目 → **13 passed（24.2s）**。新增断言用 `.el-message` 末条校验提示文案含 `SO-100000` 与
  `1000.5 → 1234.5` —— 即「事件真的到达宿主、且带旧值」，而不只是「单元格显示变了」。
- **浏览器实测**（dev，三站各一次真手改）：双击 `amount` 改值、失焦 ——
  es-pc 与 es-eui 的单元格显示都变成新值，宿主各弹**一条**「SO-100000 · 金额：1000.5 → 1234.5
  （已就地写入 :data-source…）」，表格不回滚（宿主没调 `notify()`）；es-pc 上另测 `qty`（`1 → 5`），确认
  「未改值不发」之外的常规路径也只发一条（用只统计 `.ant-message-notice` 节点的 observer 复核，先前把
  文本节点的重复 mutation 误读成了三条）。
- **顺带修掉的两处噪声**（真进编辑态 / 真看页面才暴露，单测与构建都看不见）：
  1. `editRender: $input + type: 'number'` 在 **vxe 3.16 / 4.20 两端都会**打 `不建议使用 <vxe-input type="number">`
     警告（vxe-ui 的 `input` onMounted）。改成 `VxeNumberInput` renderer 后三站控制台 0 warning；
     两个大版本的 `es/table/render/index.js` 都已内置这个 renderer，所以一份 schema 仍跨版本成立。
  2. 案例 `tip` 由宿主以 `{{ meta.tip }}` **纯文本**渲染 —— 原先带的 `` ` `` / `**` 只会在三站页面上原样露出
     反引号与星号。已改成无 Markdown 装饰的纯文本（`cases:sync` 分发到三站）。

## 15. 落地记录（弹窗表单项不再继承表格/查询面键，2026-10-26）

§13.4③ 登记的开放项。先复核它的前提：「schema 要求必填」**不成立** ——
`FieldConfigSchema` 的 `inQuery/inTable/inForm` 带 `.default(true)`，省略不报错，是 **Zod 把默认值
实体化**成 `true`；三个渲染端也都不读它们（弹窗 `formItems` 原样交给 EsForm，三端组件里零处引用 `inForm`）。
真实缺陷只有一条。

### 15.1 缺陷：`normalizeConfig` 把顶层字段**整份**抄进弹窗表单项

`expandDialogFormItems` 形态②按 `Object.keys(field)` 补「缺失键」，形态①（字符串简写）直接
`cloneValue(field)`。两个后果：

1. **噪音**：顶层字段通常带 `querySpan/align/inQuery/...`，于是**每一条**弹窗表单项都发一条「自动归一」。
   S2 组合画廊实测：18 例里 6 例 `full` 各 12 条、`form+dialog` 1 条 —— 全是这一类。
2. **错值**：顶层字段的 `inForm: false`（只查不录）被抄进弹窗条目 —— 一个明明要在弹窗里渲染的条目
   被标成「不进表单」，语义自相矛盾；`inQuery: true` 同理，让弹窗条目看着像查询字段。

### 15.2 落地

| 位置 | 说明 |
|---|---|
| `shared/src/normalize-config.ts` | 新增 `DIALOG_FORM_ITEM_KEYS` + `projectDialogFormItem`：只投影**表单面**（`prop/label/labelKey/formtype/required/rules/attrs/dataOptions/apiParams/formSpan/permissionValue/isHidden/reactions`）。形态①②都改走投影 |
| `shared/src/repair-config.ts` ⑤ | 同一投影（`repairConfig` 单独被调用的兜底路径） |
| 单测 | normalize +3（零改写零告警 / 不继承 `inForm:false` / 表单面键照样补全），repair +1 |
| 组合画廊 | `npm run composition:gallery` 重生成：**只有 `warnings` 变空**，`pageSchema` 与判据逐字节不变 |

### 15.3 为什么不按 §13.4③ 的备选「只补 `inForm: true`、其余置 false」

那仍然是在替宿主编造归属键；`repair-config` 头注的纪律是「**不补 `.default()`** ——省略就保持省略」。
既然弹窗面没有消费者，正确做法是**不抄**，而不是抄成另一组值。

### 15.4 验证

- **产物不变**：重跑 `gen-ai-case-artifact` 生成 `engine-lab` → 4 条「自动归一」消失，`engine-lab.json`
  **逐字节不变**（`git status` 无改动）。
- **组合画廊**：重生成的 diff 只有 `warnings` 段（12 插入 / 132 删除），`pageSchema`/判据零变化 ——
  这正是「只去掉噪音、不动语义」的证据。
- 单测：shared **827**（+4）/ mcp-server 340 / cli 79 全绿。
- `npm run check:consistency` → **退出码 0**（含 `check:composition-gallery` 的「单源新鲜 + 三站副本一致」）。
- e2e：`--project=ai-gallery-docs -g "组合画廊|引擎实验室"` → **2 passed**。

### 15.5 仍存在的（刻意不动）

`StructuredCrudConfigSchema` 的弹窗表单项仍复用 `FieldConfigSchema`，`safeParse` 会把缺省的三成员布尔
实体化成 `true`。它只活在**进程内解析结果**里：产物走 `buildFormItem` 投影、`refine_config` 的 diff 吃
原始 JSON、生成工具只回代码与 warnings —— 没有任何用户可见出口。把它拆成专用 schema 会动 AI 契约与
`check-schema-contract` 的键集，收益为零，登记不改。

## 16. 落地记录（`aiCase` 接缝：文档演示 ↔ AI 案例，2026-10-26）

§4.9 登记的接缝。缺口本身不是缺陷：台账能回答「这页 AI 可达吗（tier）」，但**指不出**「哪份 AI
案例真的演示了它」——「有案例演示」这句话只能靠人去 `docs/cases/ai-cases.json` 里猜。

### 16.1 落地

| 位置 | 说明 |
|---|---|
| `docs/ai/feature-coverage.schema.json` | demo 增可选 `aiCase: string[]`（`minItems 1`、`uniqueItems`、kebab id）；`additionalProperties:false` 照旧咬住拼错的键 |
| `docs/ai/feature-coverage.json` | **23/103** 例登记，9 个案例全部被指到（关联行的 tier 分布：A 12 / B 1 / C 8 / D 2） |
| `scripts/check-feature-coverage.mjs` | 新增断言 ⑥（原摘要顺延为 ⑦）：每个 id 必须 ∈ `docs/cases/ai-cases.json` 的 `cases[].id`；顺带把头部注释里过期的「97 例 / 96 例」按实测更正为 **103** |
| schema 发布副本 | `node scripts/sync-data-schemas.mjs` → `es-plus-docs/public/ai/feature-coverage.schema.json`；`check:data-schemas` 用 Ajv 对新数组形态做正负向校验 |

### 16.2 与 §4.9 原文的偏离（一处）：`aiCase` 是数组

原文写「指向 manifest id」（单数）。但台账里存在**一页两能力**的行：`table/11-expand` 的标题就是
「展开行与树形」，而这两个能力分别由 `expand-row`（`expandConfig`）与 `org-tree-table`（`treeConfig`）
演示。单值字段只能在两者里挑一个，剩下半个标题就成了无对照的断言。数组如实表达「这页的能力由这
两份案例分别演示」，代价只是消费端渲染多个链接。

### 16.3 登记规则（为什么是 23/103）

只给**案例的冻结配置里真的出现该页招牌键**的行登记；未登记 ≠ 不支持，只表示「现有案例没有以它
为主角」。据此刻意**不登记**的几类：

- **每案都有的通用件**（`fields`/`formItems`/`dialogs`/`tableOptions`/`pagination`/`actions`）不足以
  证明「这一页」——否则 103 行里 90 行都能指到 `employee-roster`，字段就退化成噪音；
- **函数值令牌**（`httpRequestFn`/`renderFn`/`spanMethodFn`/`fieldEventFn`）：案例宿主的副作用走 mock
  契约、配置里 0 个函数（这正是断言 3 要的），所以 `table/16-callback-pipeline`、
  `crud-page/10-full-business` 一类没有案例可指；
- **D 档行也可以有关联**：`aiCase` 回答的是「这个能力有没有 AI 案例演示」，与行的 tier（**这一页**
  是否 AI 生成目标）是两根轴。`advanced/08-row-approval` 是 D（`useDialogApi` 是组件命令式 API），
  但它的「通过 / 驳回 + 权限码」由 `purchase-approval` 的 `operationColumn` 演示。

### 16.4 验证

- 守卫**非空转**：把 `table/05-edit` 的 `aiCase` 改成 `no-such-case` → `check:feature-coverage`
  退出码 **1** 并指名悬空 id；还原后复绿（`git diff --numstat` 回到 74/1）。
- `npm run check:feature-coverage` → ✅（103 例；分档 A 28 / B 5 / C 39 / D 31；aiCase 关联 23 例）。
- `npm run check:data-schemas` → 5 份声明全部「可解析且有效力」（含新 `aiCase` 数组的 Ajv 校验）。
- `npm run check:consistency` → **退出码 0**。
- `es-plus-docs` 站点构建 → ✅（59.60s）。

### 16.5 仍未闭环

~~S3 工作流页（W1–W3，8 个零案例 MCP 工具）是 Wave C 唯一未开工项~~ → **已落地（见 §17）**。台账侧的**反向**索引（从案例跳到
它覆盖的文档演示）不必再存一份——由 `aiCase` 现场反查即可。

## 17. 落地记录（S3 工具工作流页，2026-10-26）

### 17.1 落了什么

- **生成器 + 原语**：`scripts/gen-ai-workflows.mjs`（工作流定义、记录、渲染、守卫）与
  `scripts/lib/mcp-tools.mjs`（esbuild 现打包 `packages/mcp-server/src/tools/*.ts` → 假 server
  捕获 9 个注册函数 → 入参先过工具**自己的** `z.object(shape).parse()`（与 MCP 客户端同一道校验）
  → 真 handler → 出参逐字节）。
- **单源 + 三站副本**：`docs/cases/generated/ai-workflows.js`（约 40 KB）分发到
  `es-plus-docs` / `es-pc` / `es-eui` 的 `src/cases/generated/`，逐字节一致。
- **三站页面**：`/ai-gallery/workflows`。`es-plus-docs/src/views/AiWorkflows.vue` 与
  `es-pc/src/views/AiWorkflows.vue` 逐字节相同；`es-eui/src/views/ai-workflows.vue` 是 Vue2 移植。
  路由都排在 `/ai-gallery/:id` 之前；画廊页各加一张 S3 入口卡（与 S2 卡同款）。
- **守卫** `npm run check:ai-workflows`（已进 `check:consistency`）：新鲜度（重算逐字节比对，
  忽略行尾）＋同进程两遍确定性＋覆盖（前门 12 个工具全部出现，其中 11 个此前零页面演示）＋预期失败
  （恰好一步、且**真的**失败）＋接线（三站页面/路由/入口 + docs↔pc 页面逐字节）。
- **e2e**：`ai-gallery.spec.ts` 新增第 14 条——「渲染 ↔ 记录」逐项一致（工具数 / 每条工作流的
  步数 / 工具名 / 成功与预期失败分布 / 截断条数全部读单源，不抄常量）。

实测 12 次调用（字节）：W1 `detect_project_target` 316 / `generate_crud` 8265（截断） /
`validate_config` 545（**预期失败**） / `refine_config` 462；W2 `scaffold_page` 4119（截断） /
`doctor_page` 1297；W3 `ingest_schema` 1159 / `list_form_types` 1573 / `get_component_api` 2302；
W4 `generate_form` 1242 / `generate_table` 1316 / `generate_dialog` 3521（截断）。

### 17.2 偏离与取舍

1. **不起 stdio MCP server**：客户端路径要求先 `build`，守卫就变成「测构建产物」，陈旧 build 会让它
   静默失明（与 `scripts/lib/front-door.mjs` 头注同一条理由）。改为源码打包 + 假 server + 真 handler。
2. **按 `front-door` 档注册**：默认档会把 legacy 三个工具也注册上，`detect_project_target` 的
   「Next step」便指向它们；前门档下那些指针是 dead-end。故记录里显示
   `generate_crud / generate_form / generate_table / generate_dialog / get_component_api`。
3. **模型步是冻结输入**：`refine_config` 不调模型（见其头注），W1 的 revised 配置是字面量。
   页面用 `claim: compile` 明示「模型那一步不在记录里」，不暗示可重现。
4. **预览截断是诚实的**：出参预览 3000 字符，另存完整字节数并标「预览截断」——页面既不吞 8 KB
   代码，也不假装那就是全文。
5. **口径是「此前只有文档、没有页面演示」，不是「零案例」**：本仓此前没有工具覆盖台账；
   `list_form_types` 已有 spec（AI-39）但没有任何页面演示，`ai-tools.json` / `AiCrud.vue` 是文档与
   NL→config 演示。11（= 12 个前门工具减去已有页面的 `generate_crud`）这个数字的判据是「站点页面里搜不到这些工具的调用」，已写进生成器注释。
6. **守卫不锚前导 `/`**：`es-pc` 的路由表用相对段写法（`ai-gallery/workflows`），锚死会假红。
7. **台账连带同步**：`es-pc` 的新视图是 `sites` 段第 123 例（D 档「站点骨架 / 未收录视图」），由
   `npm run sites:coverage:gen` 重算；`es-eui` 不动（其台账扫的是 `src/examples`，不含 views）。
8. **S2 的 e2e 选择器改 `filter({ hasText: '组合画廊' })`**：`.ai-gallery-comp` 现在有两张，
   不收窄会触发 strict mode。

### 17.3 仍未闭环（如实）

- ~~前门 12 个工具只覆盖 9 个~~ → **已补齐（2026-10-26，W4）**：`generate_form` / `generate_table` /
  `generate_dialog` 各有一份真调用记录与产物（校验器、生成器都真跑过），本页现在 12/12。
  ~~**A8 `fragment-dashboard` 仍未开工**~~ → **已落地（见 §18）** —— 那是另一件事：把片段拼进非 CRUD 页面并把 claim 抬到
  `execute`，与「工具有没有页面演示」是两条轴，别用一个数字盖住另一个缺口。
- ~~§4.9 的 ROADMAP 映射是错的~~ → **已更正（见 §4.9）**：ROADMAP 的 AI-28/29/30 是
  `useDialog` 骨架 / `vxeFirstClass` 降档 / SFC-schema 对齐，不是案例矩阵 / 组合可见性 / 工具工作流；
  该文件里没有 S1–S3 条目，展示矩阵以本文为唯一跟踪面。
- 记录只覆盖**确定性**工具。任何形状依赖模型输出的步骤（真正的 NL→config 一次成功/一次失败）
  只能冻结保存，不能靠本页的守卫机制证明；要看那部分，走 S1 案例与 `check:ai-cases`。

### 17.4 验证

- `npm run check:ai-workflows` → ✅（4 条工作流 / 12 次调用；零页面演示工具 11/11 覆盖；单源 + 三站
  副本逐字节一致；接线完整）。
- `npm run check:consistency` → **退出码 0**（含 `check:ai-workflows`，以及重算后的 `sites` 台账）。
- 三站构建：`es-plus-docs` ✅（1m 4s）、`es-pc` ✅（20.99s）、`es-eui` ✅（`--dest dist-verify`
  构建后删除，避开 dist 句柄锁）。
- e2e `--project=ai-gallery-docs` → **14/14**（含新增第 14 条）。


## 18. 落地记录（A8 片段拼装仪表盘，2026-10-26）

### 18.1 落了什么

- **生成器 + 守卫**：`scripts/gen-fragment-dashboard.mjs`（`npm run fragment:dashboard` /
  `npm run check:fragment-dashboard`，已进 `check:consistency`）。三个片段工具 × 三个 target
  （`vue3` / `vue2` / `antdv`）各真调一次，共 9 份产物；`--check` 重算逐字节比对 + 同进程两遍确定性
  + 9 份各过一次语法解析（`scripts/lib/compile-check.mjs`）+ 纯 JSON + 无绝对路径 + 接线 + manifest 对账。
- **单源 + 站点副本**：产物 `docs/cases/generated/fragment-dashboard.json`（6.1 KB 纯 JSON：冻结入参、
  每片段行数/字节、三端字节表、宿主接线、边界清单、逐站 claim）；源码模块
  `docs/cases/generated/fragment-dashboard-sources.js`（17 KB，三端 × 三片段的原样 ```vue 产物）分发到三站。
- **真跑的片段**：`es-plus-docs/src/cases/generated/fragments/{FilterBar,ResultTable,OrderDialog}.vue`
  （target=vue3）与 `es-pc/src/cases/generated/fragments/…`（target=antdv）。vue3 与 antdv 的表单/表格
  逐字节相同，弹窗只差 `httpRequest` 的 import 源 —— 这一点由产物里的字节表如实反映。
- **宿主页**：`/fragment-dashboard`，docs 与 es-pc 共用**同一份文件**（逐字节，守卫比对）。
  页面里没有任何 schema：布局是 CSS grid，数据是宿主自己 `httpRequest(/api/demo/orders)`，
  图表是手写 `<svg>`；三个片段一行未改，靠 Vue 属性透传接线 ——
  `:model` + `:config-btn`（筛选）、`:data-source` + `:pagination` + `@row-click`（表格）、
  `ref.open(title, row)`（弹窗）。`es-eui` 是同容器的 Vue2 只读页（产物 + 编译结论 + 三端源码）。
- **manifest**：`docs/cases/ai-cases.json` 新增 `fragment-dashboard`（`shape: fragment`、`mode: sfc`、
  `origin: handcrafted`、`replay.kind: handcrafted` + 原因 + 守卫），三站 Cases 页各加一张入口卡。
- **e2e**：`ai-gallery.spec.ts` 新增第 15 条 —— 从 Cases 页 CTA 点进 → 37 条命中 / 8 行 / ¥183,082
  → 筛选 `恒佳` → 6 条 / ¥27,614 → 柱高变化 → 点行开「查看」弹窗（只剩关闭、客户与金额回填）
  → 三端页签与三块源码 → 接线表与边界条数。结构类期望值全部读产物，数据类读演示后端语料。

实测（浏览器）：首屏 37 单 / 8 行 / ¥183,082，柱高 92·31·22；关键词「恒佳」→ 6 单 / ¥27,614，
柱高 92·82·28；点行 → 弹窗标题「查看」、页脚只剩「关闭」、客户 深圳恒佳电子 / 金额 2514。
docs（Element Plus）与 es-pc（Ant Design Vue）两端口径逐项一致。

### 18.2 偏离与取舍（五处，都有结构性理由）

1. **`origin: handcrafted` 而不是 `ai`**：产物是「工具(冻结入参)」的确定性结果，没有模型参与；
   写成 `ai` 会把「片段工具能拼页面」冒领成「模型写对了配置」。代价是它不进 `check:ai-cases`
   的模型产物统计 —— 这正是想要的：两条轴别混。
2. **`es-pc` 停在 `compile`（初稿写成 `execute`，已改回）**：那一端**确实在跑**（同一份宿主页 +
   antdv 三片段，已人工验证），但本仓没有 es-pc 的 e2e project，`check:fragment-dashboard` 只证到
   「解析 + 接线」。按 §11.4「跑过的才叫 execute」，无自动化证据的一端主张封顶 `compile` ——
   与 `order-batch` 等在 es-pc 上的写法一致；页面徽章旁如实写明原因，不靠读者猜。
3. **表格片段刻意不给 `apiUrl`**：给了就会出现「宿主筛完、片段又自己拉一遍」的第二真相。
   代价是这份片段不声明 props，数据只能靠 Vue 属性透传覆盖根组件的内部绑定 —— 契约是隐式的，
   已写进页面的「当前边界」而不是藏起来。
4. **`es-eui` 只做编译验证**：vue2 目标从 `vue` 导入 `defineComponent` / `reactive`（Vue 2.7 语义），
   而 es-eui 是 Vue 2.6 + `@vue/composition-api`，跑不了。该端页面展示三端源码 + 9/9 语法解析结论，
   不假装可交互。
5. **与 S1 通用案例的分工**：通用案例渲染 `CrudPageSchema`（`<es-crud-page :schema>`），页面形状由
   schema 定；本页没有 schema —— 宿主自己写布局、取数、图表。两者的 claim 都是 `execute`，
   但证据链不同（S1 = 产物编译 + e2e；A8 = 冻结片段重算逐字节 + e2e）。

### 18.3 页面「当前边界」的四条（产物 `knownGaps`，页面原样展示）

1. 表单片段不 emit：查询/重置走「祖先 es-table 注入」这条路，独立宿主只能用底层 `es-form` 的
   `configBtn` 契约接管点击；
2. 表格片段在不给 `apiUrl` 时不声明 props：数据靠同名属性覆盖根组件绑定（隐式契约）；
3. 片段之间没有编排契约（无 props / emits / provide 约定）：拼装靠底层组件的既有属性名，换组件要重接线；
4. vue2 产物面向 Vue 2.7，es-eui 停在编译验证。

这四条是**当前产物的形状**，不是「以后再说」的注脚 —— 页面的接线方式就是它们的结果。

### 18.4 验证

- `npm run check:fragment-dashboard` → ✅（9/9 片段可解析；产物 6.1 KB 纯 JSON；单源 + 三站副本逐字节；
  三站接线完整；manifest 逐站 claim 对账）。
- `npm run check:ai-cases -- --strict-coverage` → ✅（10 个案例、7 个可机械重放；覆盖门绿）。
- `npm run check:consistency` → **退出码 0**（含 `check:fragment-dashboard` 与重算后的 `sites` 台账：
  es-eui 97 / es-pc 124 / 合计 221）。
- 三站构建：`es-plus-docs` ✅（1m 41s）、`es-pc` ✅（27.4s）、`es-eui` ✅（`--dest dist-verify` 后删除）。
- e2e `--project=ai-gallery-docs -g "A8 片段拼装"` → ✅；全量 15 条见提交记录。

### 18.5 仍未闭环

- **es-pc 没有 e2e project**：这是「另两端只能 `compile`」的唯一根因（不止本案例）。要抬主张就得
  先给 es-pc 起一条 playwright project（dev server + baseURL），那是独立一件事。
- **片段之间仍无编排契约**：宿主现在靠底层属性名接线；若要让片段真正可组合，需要给片段产物补
  `defineProps` / `defineEmits`（会改动三个工具的生成模板，影响全部片段 case 与 golden）。
- ~~**A9 `native-vs-ai`（三栏对照）未开工**~~ → **已落地（见 §19）**：`gen-cases-metrics.mjs` 的实测数字扩成三栏（原生 / 手写 es-plus / AI 产物），claim 停在 `measure + compile`。
- ~~**夜间漂移作业 + `docs/ai/ai-showcase.md` 用户导览**仍未落~~ → **已落地（见 §20）**。

## 19. 落地记录（A9 三栏对照 `native-vs-ai`，2026-10-26）

### 19.1 落了什么

- **度量扩列**：`scripts/gen-cases-metrics.mjs` 新增 AI 列 —— `AI_SCENES` 登记「哪个场景用哪份产物」
  （`filter-table` → `employee-roster`），`measureAi()` 用**同一把尺子**（`blocks` / `countEvents` /
  `countFunctions` / `countVIf`）去量纯 JSON，产出
  `scenarios[].ai = { file, lines, bytes, events, functions, vIf, features }`。四个口径之外另附 `features`
  （formItems / columns / dialogs / actions / dataOptions / permissionValue），全部由 JSON 本身数出来 ——
  页面那句「第三栏是超集」有数据支撑，不是文案。
- **源码单源**：新增 `docs/cases/generated/native-vs-ai-sources.js`（19 KB），三栏原文（原生 `.vue` /
  手写 es-plus `.vue` / AI 产物 `.json` + meta）逐字节嵌入，另写三份站点副本；`cases:metrics:check`
  一并对账（`sameText`）—— 示例或产物一改，模块过期即红。行尾统一 `toLF`，避免检出设置影响字节。
- **页面**：`/native-vs-ai`。`es-plus-docs` 与 `es-pc` 共用**同一份** `NativeVsAi.vue`（逐字节，
  `checkNvsWiring` 比对）；`es-eui` 是 Vue2 Options 投影页（同 testid、同数字）。
  页面结构：三栏 → 四个维度 → 「读法」五条 → 三份源码页签 → 「这一页没有证明的事」四条。
  页面**不含任何数字**：数字读 `cases-metrics.json`，源码读 `native-vs-ai-sources.js`。
- **接线**：三站路由 + 三站 Cases 页入口卡（`a.nva-cta`，琥珀徽章，第四种来源色）；
  `checkNvsWiring()` 校验「页面存在 + 引用源码模块 + testid + 路由 + Cases 入口 + 两端页面逐字节」。
- **e2e**：`ai-gallery.spec.ts` 新增第 16 条 —— 从 Cases 页 CTA 进入，12 个数字单元格（3 栏 × 4 维度）
  逐个断言等于 `cases-metrics.json`；`features` 行含四个计数；三栏源码切换后 `<pre>` 文本与模块里的
  原文一致（空白归一后比对）；4 条 gaps 含「第三栏不是严格同场景产物」。

实测（浏览器，三站一致）：原生 123 行 / 7 事件 / 6 函数 / 2 个 v-if；手写 es-plus 77 / 1 / 2 / 0；
AI 产物 363 行 / 0 / 0 / 0（7.5 KB，按 LF 归一计 —— 见 §21.1）。产物自述：查询项 3 · 列 5 · 弹窗 3 ·
行按钮 3 · 码值表 5 · 内嵌脚本串 0。

### 19.2 偏离与取舍（五处）

1. **claim = `measure + compile`，不是「execute + metric」**：本页没有「被执行的产物」—— 它展示源码
   与数字。按 §11.4「跑过的才叫 execute」，把数字页说成交互演示就是越界。AI 栏**真正跑起来**的样子在
   `/ai-gallery/employee-roster`，有它自己的 e2e（第 2–5 条）背书。页面徽章旁原样写明，不靠读者猜。
2. **第三栏不是 `filter-table` 的严格同场景产物**（如实声明）：本仓没有为这个场景调过模型，硬造一份
   就等于把「确定性工具产物」冒充成「模型产物」。选 `employee-roster` 是因为它是**超集**
   （多一枚查询项、多一列、多三个弹窗、多三个行按钮），偏差方向**对 AI 不利**（多做功能、行数却没省），
   所以三个「归零」维度不会被放宽。这句话同时进产物注释、页面 gaps 与 e2e 断言。
3. **AI 栏的三个 0 是计数器的输出，不是手写**：JSON 里没有 `<template>` / `<script>`，`blocks()` 取到空串，
   `countEvents` / `countFunctions` / `countVIf` 必然为 0 —— 注意这三项**对 JSON 没有定义**，不是
  「将来带脚本就会变非 0」（§21.3 更正）：schema 允许的 `formatter` / `render` 是 JSON 字符串，
  `<script>` 派生计数器看不见，故另记 `features.scriptStrings` 把它们显性化。
   但「0 事件」是**形状**（纯 JSON 无胶水），不是「AI 写得更少」的因果。
4. **行数一栏不设结论**：363 行是「逐标量一行」的序列化结果，换个写法数字就变；页面把这一栏明写成
   「不当作优点」。与 #2 同源：宁可少一个卖点，也不留一个可被一句话推翻的比较。
5. **es-eui 页的度量字段叫 `id` 不叫 `key`**：`check:eui-column-prop` 的保守判据是「同一行 `key:` +
   `label:` → 判为列定义」，本页的 `metricsKeys` 恰好命中（它不是列定义）。判据放宽会放过真正的列定义，
   所以让开的是页面字段名 —— 守卫未动，理由写在字段旁。

### 19.3 页面「这一页没有证明的事」四条（`data-testid="nva-gaps"`，e2e 断言条数）

1. 第三栏不是严格同场景产物（见 19.2 #2）；
2. 模型那一步不可重放（可机械重放的只有「产物 → 渲染」，`check:ai-cases` 断言 4）；
3. 渲染器的成本不在任何一栏里（声明式的行数优势来自「把复杂度搬进渲染器」）；
4. 只对照了一个场景（`status-column` 这类小场景里声明式反而更长，Cases 页降幅显示成 +x%）。

### 19.4 验证

- `npm run cases:metrics:check` → ✅（2 个场景，其中 1 个有 AI 对照栏；源码模块与三份副本逐字节一致）。
- `npm run check:consistency` → 首轮**红**：`check:eui-column-prop` 抓住新页的 4 处 `key:`（见 19.2 #5）；
  改字段名后重跑受影响尾部（`check:eui-column-prop` / `check:example-inline-style` / `check:declarative-demo` /
  `check:flagship-case` / `check:generated-case`）全绿，其余各项首轮已绿。
- 三站构建：`es-plus-docs` ✅（1m 31s）、`es-pc` ✅（24.8s）、`es-eui` ✅（`--dest dist-verify` 后删除）。
- e2e `--project=ai-gallery-docs` 全量 **16 条通过**（27.5 s），第 16 条即 A9；es-eui 页面另经浏览器复核
  （12 个单元格与另两端逐个相同、4 条 gaps、控制台 0 error）。
- `sites:coverage:gen` 后的台账：es-pc 125 / 合计 222（`check:feature-coverage` 绿）。

### 19.5 仍未闭环

- **只有 `filter-table` 有 AI 对照栏**：`status-column` 没有对应模型产物，故不设第三栏 —— 要扩场景就得
  真调一次模型并登记 `AI_SCENES`，不能拿工具产物补位。
- **es-pc / es-eui 没有 e2e project**（与 A8 同一根因）：本页 claim 是 `measure + compile`，不受影响；
  任何想抬到 `execute` 的页面都卡在这里。
- **「一份产物三端跑」只有字节证据**：三站副本逐字节一致由守卫保证；三站各自**跑起来**的那一段仍要靠
  各案例自己的 e2e（`employee-roster` 在 docs 有，另两端没有）。
- ~~**夜间漂移作业 + `docs/ai/ai-showcase.md` 用户导览**仍未落（Wave C 最后一项）~~ → **已落地（见 §20）**。

## 20. 落地记录（漂移观测作业 + 用户导览，2026-10-26）

### 20.1 落了什么

- **漂移观测脚本** `scripts/eval/ai-case-drift.mjs`（`npm run drift:ai-cases`）：
  对每个「有 NL + 有冻结配置」的案例，用**当前模型**重跑 NL→config（复用 eval:llm 的 system prompt、
  few-shot、自修复环与中继冷却），再与冻结配置算结构距离：字段集合 F1 / 动作集合 / 弹窗键集合 /
  四项字段旋钮（formtype / inQuery / inTable / inForm）。报告写 `--out`（默认 `drift-report/ai-case-drift.json`）。
- **口径自测** `scripts/eval/ai-case-drift.test.mjs`（`npm run check:ai-case-drift`，已进 `check:consistency`）：
  报告不进仓库，算错时没有任何门会红，所以把四条口径钉死 —— 集合 F1（空 vs 空 = 1）、成员布尔缺省归一、
  旋钮只对交集字段、选案规则（无冻结配置 / 无 NL 逐条记跳过原因）。
- **夜间作业** `.github/workflows/eval-drift.yml`：每日 04:17 UTC（与 eval-llm 的 03:17 错开一小时，
  避免抢同一份中继配额）+ 手动 `limit` 输入；只读权限、**无 commit-back**、报告走 artifact（30 天）。
- **不发布**：`.gitignore` 增 `drift-report/`；报告与 accuracy 产物同一条纪律 —— 不入库、不上站点。
- **用户导览** `docs/ai/ai-showcase.md`：页面地图（8 条 AI 页各自证明什么 + 守卫在哪）、三个 claim 词、
  数字来源、漂移作业用法、新增案例四步、已知边界；README「AI 工具链」一节加了入口链接。

### 20.2 偏离与取舍（六处）

1. **只观测「有冻结配置」的案例**（当前 1 个：`employee-roster`）：`purchase-approval` 的历史产物没保存
   模型配置（`replay.kind: unavailable`），拿它现存的 schema 硬比会把「产物没保存」混进「模型漂移」。
   跳过项逐条写进报告（id + 原因），不静默。
2. **缺省归一放两侧**：`inQuery` / `inTable` / `inForm` 的 schema 默认值是 `true`，只归一候选侧会把
   「显式 true vs 省略」判成漂移 —— 这是 golden 语料 inQuery 陷阱的镜像，故冻结侧与候选侧用同一套归一。
3. **旋钮只在交集字段上算一致率**：候选少一个字段已由 membership 记差异，若旋钮再按「冻结侧全集」算，
   同一个缺失会被罚两遍（报告读起来像漂移更大）。交集为空时旋钮记 1，`exact` 仍为 false。
4. **「模型答错」与「没测到」分开记**：前者（拿到过真产出但 schema 不过）是一次合法观测 —— 模型变了；
   后者（空轮 / 截断 / 超时 / 中继挂）若混在一起，报告会把基础设施故障读成模型漂移。
5. **workflow 用 `--require-key`**：缺密钥时显式失败，而不是 SKIP 后绿着假装测过（本仓反复踩过静默跳过）；
   它仍不做门禁 —— 独立 workflow、只读权限、不参与 PR 与部署链。
6. **本轮探针跑的是本机中继**：`newapi-devops.szlanyou.com` 只服务 deepseek 系，故探针用
   `deepseek-v4-flash`（恰好也是冻结产物的模型）；生产夜间作业走京东云中继 + `claude-opus-4-6`。
   探针证明的是**管线跑通**，不是生产口径的数字。

### 20.3 验证

- `npm run check:ai-case-drift` → ✅（四条口径全成立）。
- 探针 `npm run drift:ai-cases -- --limit 1` → ✅ 端到端跑通（1 案例 / 跳过 9）：`employee-roster` 实测
  props F1 **0.8** —— 模型把 `dept` 写成 `department`，其余维度（actions / dialogKeys / 四项旋钮）全一致，
  `exact: false`。这正是漂移报告该给出的信号：一处命名漂移，而不是整页失配。
- `check:docs-layout`（123 处链接）、`check:readme`、`check:eol-hygiene` → ✅。

### 20.4 仍未闭环

- **可漂移案例只有 1 个**：其余 9 例是手工 / 确定性工具产物，没有「模型重跑」这条轴。补法是真调一次模型
  并保存冻结配置（`purchase-approval` 是最直接的候选），不是放宽观测口径。
- **导览没进站点导航**：`docs/ai/` 是数据源目录，`ai-showcase.md` 目前只从 README 链接；要不要做成站点页
  是产品决定（站点已有 8 条 AI 页，再建一条「讲这些页」的页需要先确定它不重复画廊）。
- **漂移不做门禁是设计选择**（见 20.2 #5）：代价是「没人看报告」不会有人管 —— 目前靠模型升级时的人工动作。

## 21. 复核修正（A9 + 漂移作业，2026-10-27）

独立复查（另一位只读评审 + 本机复现）在 §19/§20 的落地物里找出 1 个会挡 CI 的缺陷与 5 个口径/守卫缺口，
全部已修：

### 21.1 HIGH — `cases:metrics:check` 只在 Linux CI 上红（EOL 敏感字节数）

`measureAi` 的 `bytes` 用了**原始文本**：本仓无 `.gitattributes`、本地 `core.autocrlf=true`，同一份 JSON
工作树是 CRLF（7994 B）而 git blob 是 LF（7631 B）。于是本地 `--check` 绿、`ubuntu-latest` 上红 ——
而 `check:consistency` 在 Typecheck 里，Typecheck 红 ⟹ `deploy-docs` skipped：新页永远发不上去。
修法：`bytes` 按 `toLF` 归一后的文本计（7631），并新增 `scripts/gen-cases-metrics.test.mjs`（同一份 JSON 的
LF/CRLF 两版必须逐字段相同）进 `check:consistency` 的 `check:cases-metrics`。

### 21.2 MEDIUM — 漂移把 `DatePicker` / `datePicker` 报成结构漂移

`datePicker` / `timePicker` 是 schema 承认、三端运行时都过 `normalizeFormType` 的别名；冻配置里 `hireDate`
正是 `DatePicker`，模型挑另一写法就会得到 `knobs.formtype: 0 / exact: false` —— 一份「噪声漂移」，
正是让人学会忽略报告的那类信号。修法：`knobOf` 两侧都过 `normalizeFormType`，单测补别名用例。

### 21.3 MEDIUM — 「三项归零」对 JSON 无定义，原写法把边界说反了

§19.2 #3 原文说「将来产物若带出脚本，这三项会自动变成非 0」—— 不成立：`formatter` / `render` 是 JSON
字符串，`<script>` 派生计数器永远看不见。修法：新增 `features.scriptStrings`（`"formatter"` / `"render"`
键出现次数），页面在「产物自述」里显示它；单测断言「带脚本时 functions 仍 0、scriptStrings 为 2」，
把这条边界钉成事实而不是措辞。当前 `employee-roster` 的 `scriptStrings` 为 0。

### 21.4 MEDIUM/LOW — es-eui 的数字写死也没人管

`checkNvsWiring` 原来只查「文件存在 + 含源码模块名 + testid」，es-eui 又没有 e2e —— 把 12 个数字写死
到页面里依然全绿。修法：三站页面都必须出现 `cases-metrics.json` 且**按 id 从 `scenarios` 取值**
（正则兜住 docs 的类型标注写法），否则 `cases:metrics:check`（`checkNvsWiring`）直接红。

### 21.5 LOW — e2e 的断言有子串空洞

`toContainText("列 5")` 会被「列 50」满足；「没有证明的事」只断言了 4 条里的一条。修法：
改用 `(?!\d)` 负向前瞻，并断言 `nva-gaps li` 恰为 4 条且四条 caveat 文案都在。

### 21.6 LOW — `--limit=1` 被静默当成「没传」+ 漂移作业超时 < 中继冷却预算

`argValue` 只认空格写法，`npm run drift:ai-cases -- --limit=1` 会跑全量（案例变多后是真金白银）；
workflow 的 60 min 上限小于 `createResilientTransport` 的 90 min 冷却预算，超时被硬杀时 artifact 不保。
修法：两种写法都解析（空值报错），workflow 上限抬到 120 min。

### 21.7 复核确认无问题的部分

- `eval-drift.yml` 的 YAML / secrets / 步骤顺序 / artifact 路径与 `.gitignore` 对齐；
- `outcome` 归因（`model-failure` / `no-answer` / `truncated`）与实际 `OUTCOME` 常量一致；
- 两个生成/观测脚本都有 main-guard，import 不写文件；
- docs 与 es-pc 的 `NativeVsAi.vue` 逐字节相同；三站路由与 Cases 入口齐全；
- 没有 accuracy / eval 产物进仓库。
