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
   - **S3 工作流页**：把 `detect / validate / refine / scaffold / doctor / ingest / list_form_types / get_component_api` 这些零案例工具做成可重放的工作流记录；
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
S3 工作流页（1 页，W1–W3，覆盖 8 个零案例工具）
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
| C12 片段与宿主 | useDialogApi, crudPage, hostOrchestration, hostSkeleton | `generate_form/table/dialog`, `useDialog`, `scaffold_page` | A8, W1–W3 | execute / compile |

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

W1 覆盖 `generate_crud` 的 **surfaces 路径**（现有 hero 走的是 CLI NL→config 路径，不是 MCP 路径）；W2/W3 各覆盖 2 个零案例工具。加上 A8 覆盖 3 个片段工具，12 个公开工具全部至少一例。

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
- **feature-coverage 增列**：给 `docs/ai/feature-coverage.json` 的 demo 加 `aiCase` 字段（指向 manifest id），`check:feature-coverage` 校验引用存在；tier 仍按 demo 保留，能力级判断改由新矩阵承担。
- **ROADMAP 映射**：S1/S2/S3 分别对应 AI-28（案例矩阵）、AI-29（组合可见性）、AI-30（工具工作流），落地时同步 `packages/mcp-server/ROADMAP.md`。

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
- A8 `fragment-dashboard`（vue3 execute，另两端 compile）；
- A9 `native-vs-ai`（扩 `gen-cases-metrics.mjs` 的 AI 列）；
- S3 工作流页 W1–W3（覆盖 8 个零案例工具）；
- 夜间漂移作业 + 文档（`docs/ai/ai-showcase.md` 面向用户的案例导览）。

**验收：** 12/12 公开工具有案例；三端 compile 腿绿；漂移作业能跑通 `--limit 1`；站点上线 `ai-gallery` 与三条工作流。

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
- S2 组合画廊（18 golden，零模型调用）与 S3 工作流页未开工；
- `docs/ai/feature-coverage.json` 的 demo 尚未加 `aiCase` 字段（§4.9 的接缝，需要另一个守卫 `check:feature-coverage` 配合）；
- `packages/mcp-server/ROADMAP.md` 的 AI-28/29/30 状态待同步。
