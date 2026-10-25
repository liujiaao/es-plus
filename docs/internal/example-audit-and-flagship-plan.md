# 三站案例复核终审报告与旗舰案例方案

> 日期：2026-10-24
> 范围：`es-plus-docs`（Vue3 + Element Plus）、`es-pc`（Vue3 + Ant Design Vue）、`es-eui`（Vue2 + Element UI）
> 定位：本文是 2026-09-14《[三站文档深度审计报告](./three-sites-audit-report.md)》之后的**案例层复核**。
> 旧报告的 P0/P1 已全部关闭，本文不重复其结论；本文只回答"每个案例是否讲清了 es-plus 的优势"。

---

## 0. 结论速览

1. **案例本身没坏，坏的是叙事。**
   298 个示例文件全部登记、可解析、四道站点守卫（`check:cases-links`、`check:docs-layout`、`sites:check`、`check:site-nav`）全绿。
   但**37 处 `isHidden` 全是函数、0 处声明式、0 处 `reactions`、0 处 JSON 表达式**——
   三站示例整体在教用户写回调，而这正是 es-plus 宣称要消灭的"胶水代码"。

2. **最强的旗舰案例其实已经存在，只是没被组织起来。**
   `advanced/ZeroCodeQuery.vue`（零事件查询）与 `advanced/CrudPage.vue`（schema 驱动整页、嵌套 CrudPage、CSV 导入导出）
   都达到了旗舰水准；缺的是"一条业务主线 + 横向组合"，而不是从零发明。

3. **两个已发组件三站零案例**：`EsErrorBoundary`、`SvgIcon`。三端都已导出、有源码、无文档页、无示例。

4. **真实缺陷不多但确实存在**：假按钮（导出/查询只弹 toast）、标题与内容不符、参考示例里的调试残留、
   3 个文件 CRCRLF 行尾、代码展示里的悬空空白行。

5. **冗余不是"复制粘贴"**：三站同名示例已各自演进（字面重复 ≈ 0）。冗余在**能力颗粒度**——
   基础演示占绝大多数，能体现"组合联动"的案例不足，且组合案例多为"两两拼接"。

---

## 1. 复核方法与证据范围

| 项 | 数量 | 证据 |
| --- | --- | --- |
| 主站示例 `.vue` | 97 | `es-plus-docs/src/components/examples/**`，97/97 已登记 |
| AntDV 站示例 `.vue` | 110 | `es-pc/src/views/**`，其中 98 个 `CodeDemo` 登记 |
| Vue2 站示例 `.vue` | 91 | `es-eui/src/examples/**`，89 登记 + 2 个 `vue2-compat` 参考示例 |
| 合计 | 298 | 四道站点守卫全绿 |

源码依据（用于判断"能力是否真的存在"，而非只看宣传）：

- `packages/core/src/reactions.ts` —— 声明式联动（纯 JSON，只读 model，fail-safe）
- `packages/core/src/expr.ts` —— 冻结的表达式白名单（`EXPR_OPS`，无 `eval` / `new Function`）
- `packages/core/src/field-resolver.ts:102` `compileHiddenCondition` —— `isHidden` 的 JSON 形态编译
- `packages/core/src/config.ts` —— 全局 `permission` / `httpRequest`（决定了"纯 JSON schema 能否活体运行"）
- 三端 `es-form` / `es-table` 的 `checkPermission` 调用点（字段 / 列 / 按钮三级权限）
- `packages/shared/src/ai-nl-to-config-prompt.ts:511,681,813` —— AI 生成契约**要求** `reactions`，并明确禁止 `on: {}` 回调

---

## 2. 问题清单

级别：**P0** 影响对外可信度 / **P1** 影响体验与维护 / **P2** 风格与卫生。

| ID | 级别 | 位置 | 现象 | 证据 | 影响 |
| --- | --- | --- | --- | --- | --- |
| D1 | P0 | 三站全部示例 | 联动全用函数：`isHidden: (model) => …`，0 处 JSON 形态 | `grep` 三站：函数 37 / JSON 0 / `reactions` 0 | 配置不可序列化、不能存库、不能由 AI/服务端下发，**与头号卖点相反** |
| D2 | P0 | `component-doc.data.ts:70,73,82,85` | 导航文案直接写"`isHidden` + `on.change` 实现联动"、"`on.change + on.input` 实现计算" | 同上 | 文案把"胶水写法"当成推荐解法 |
| D3 | P1 | `form/AdvancedButtons.vue:63,73`（docs 与 pc 各一份） | "导出"与"查询"只 `ElMessage.success(JSON.stringify(model))`，无任何数据动作 | 两个文件同样实现 | 假交互，且是"高级按钮区"这个标题下的主案例 |
| D4 | P1 | `table/RowActions.vue:96-99` | 工具栏"新增 / 批量审核 / 导出"只弹 toast；行内按钮是真的 | 行内 `handleEdit/handleSubmit/handleDelete` 真改数据 | 一半真一半假，观众无法判断哪半可信 |
| D5 | P1 | `es-eui/src/examples/combination/DataFlowManagement.vue:1` | **复核更正**：文件名叫 "DataFlowManagement"，但导航标题已是「行内编辑 + EsForm」，与内容一致；只是**文件名**陈旧 | 文件 93 行；`examples/index.js` 的 sidebar 标题正确 | 仅文件名不达意，不改代码，记为命名遗留 |
| D6 | P1 | `es-eui/src/examples/vue2-compat/RechargeRecord.vue`、`RechargeForm.vue` | **复核更正**：这两个文件是 `router/index.js:140-145` 明确保留的「参考示例」，文件头也有说明；`[brcb]`/`[qrcb]` 日志是文档化的调试辅助 | 路由注释 + 文件头注释 | 不是死文件；只清 3 处明显残留（`formName`/`shuaxin///`/`row click333` 及其空转的 `@row-click` 绑定） |
| D7 | P1 | `packages/vue3/src/index.ts:14` 与三端组件目录 | `EsErrorBoundary`、`SvgIcon` 三端已导出，三站 0 示例、0 文档页 | 全仓 `grep` 示例目录命中 0 | 6 个组件里有 2 个对用户不可见 |
| D8 | P2 | `es-pc/src/views/Cases.vue`（全文）、`es-eui/.../TabMultiTable.vue`（3 行）、`es-eui/.../raw-sources.generated.js` | CRCRLF（`\r\r\n`）行尾 | `cat -A` 可见 `^M^M$` | 代码块可能多出空行、diff 噪音、生成物字节不稳 |
| D9 | P2 | `AdvancedButtons.vue:52`（docs 与 pc） | `attrs` 对象里有一行只含 4 个空格的悬空行；daterange 同时给了 `placeholder` 与 `start/end-placeholder` | 代码 tab 原样展示 | 展示代码不够干净 |
| D10 | P2 | `dialog/Advanced.vue`（docs/pc 各 25 处）、`eui/table/CrudEdgeCases.vue`（11）、`eui/dialog/Confirm.vue`（10） | 大量内联 `style` | 行内样式计数 | 与"优雅"的自我要求不符 |
| D11 | P2 | `es-eui` 多数表格示例用 `key:`，docs/pc 用 `prop:` | 三端都兼容（`column-item.vue` 做了双向映射），但**同一份配置**的写法漂移 | `component.vue:109`、`column-adapter.ts:34` | 削弱"一份配置三端跑"的示范性 |
| D12 | P2 | `docs/cases/cases.json` 案例 4–15 | `links` 指向组件文档页，不是具体案例；案例 6 的 `win` 写 `apiParams + isHidden`（又是回调） | `docs/cases/cases.json` | 用户点进去看不到"那个案例" |

> 说明：D8 的 `raw-sources.generated.js` 与当前源码**逐字节一致**（本次已只读重算校验，91 个条目、365259 字节），
> 问题只是行尾混合与"无 `--check` 守卫"，不是内容漂移。

---

## 3. 冗余分析

**结论：不要靠删案例来解决"冗余感"。**

- 字面重复：docs 与 pc 同名示例的 `<script>` 归一化后 **0 组完全相同**（最近几次提交刚做过三端语义对齐）。
- 真正的问题有两层：
  1. **基础演示密度过高**：`form/Basic`、`table/Basic`、`dialog/Basic` 这类入门案例每站都有，
     而 `advanced` 只有 23 个、`combination` 只有 17 个。
  2. **组合案例是"两两拼接"**：`DialogTableForm`（弹窗 + 表格）、`FormTable`（表单 + 表格）、
     `CascadeFormTable`（级联 + 表格）——每条只证明两个组件能拼，没有一条证明"一次交互驱动多个组件协同"。
- 建议：**保留基础案例**（它们是 30 秒上手的入口），把组合案例升级为旗舰主线（见 §6），
  基础案例里改为交叉引用（"这里用回调是为了对照，声明式写法见『报销单』"）。

---

## 4. 卖点叙事缺口（本次核心）

用户提出的四点，逐条对照证据：

### 4.1 配置驱动 ✗ —— 示例里的配置**不是数据**

`computedFields`（三站同名）用 `on: { input: … }` 手写 `recalc`；
`conditional`（三站同名）用 `isHidden: (model) => …`；
`asyncOptions` 用 `on: { change }` 驱动级联。

而源码侧：`packages/core/src/types.ts:211` 明确支持 `FieldHiddenExpr`（JSON 表达式），
`types.ts:305` 支持 `reactions`，`ai-nl-to-config-prompt.ts:825` 甚至把 `on` 列为
**"schema 会静默丢弃的宿主键"**。

> 也就是说：**人工示例教的是 AI 契约明令禁止的写法。** 这是本次复核最尖锐的一条。

### 4.2 简单易用 / 减少胶水代码 △ —— 只有"查询"这一条腿是干净的

`ZeroCodeQuery.vue` 真正做到 0 事件（`triggerEvent: true` + `apiParams.model`）。
但一旦涉及"字段 A 决定字段 B"，示例立刻退回函数回调，胶水代码回来了。

### 4.3 灵活适配 / 可扩展 △ —— 有逃生舱，缺"同一配置换引擎"

`render` 逃生舱覆盖充分（`VirtualTableCustomRender`、`vxe/EscapeHatch`、`DialogTableForm`）。
`engine` 切换有 `vxe-table/BasicSwitch.vue`，但只是切换一个玩具表格；
没有"同一业务页从 500 行切到 5 万行、选择与排序不丢"的证据。

### 4.4 大型复杂业务 ✗ —— 没有一条案例同时用 ≥4 个横切能力

现有最复杂的 `CrudPage.vue`（348 行）用了 schema 驱动、嵌套 CrudPage、CSV 导入导出，
但**没有** `reactions`、**没有**字段/列级权限、**没有**跨页选择、**没有**引擎切换。
真实中后台的复杂度恰恰来自这些横切能力的叠加。

### 4.5 组合联动 ✗ —— 缺"一次交互、多组件响应"

`CrossPageSelect.vue` 是"表格 × 选择 × 批量删除"的好例子，但只碰了表格；
`FormTableDialog.vue` 是"表单 × 表格 × 弹窗"，但每个组件各干各的。
没有案例展示：查询表单的 `reactions` → 表格请求参数 → 弹窗字段 → 详情子表 这样的**链式传导**。

### 4.6 三端一致 △ —— 证据是"同名文件 diff"，不是"同一份文件"

`docs/tri-render/` 的 `pairs.json` 证明的是"三端同名示例只差一行 import"，
`schema.json` 是 EsForm + EsTable 的玩具配置。
**真正能证明头号卖点的形态**是：一个 `CrudPageSchema` 文件放在 `docs/cases/`，
三站各写一个 15 行的宿主页把它渲染出来，并公开这个 JSON 可下载。

---

## 5. 能力矩阵

> **本表是 2026-10-24 复核当刻的基线**，作为审计证据保留、修复后不回写 —— 否则就看不出当初缺的是什么。
> 逐行现状见 **§11.7**（含两处「原判本身写错」的更正）。

| 能力 | 源码证据 | 三端 | 现有案例 | 差距 |
| --- | --- | --- | --- | --- |
| `reactions` 声明式联动 | `core/reactions.ts`、三端 `es-form.vue` 的 `resolveReactionOverlay` | ✅ | **0** | 完全未展示 |
| JSON 表达式 DSL | `core/expr.ts`（`EXPR_OPS` 白名单） | ✅ | **0** | 完全未展示 |
| 声明式 `isHidden` | `field-resolver.ts:102` | ✅ | **0** | 37 处全是函数 |
| 字段 / 列 / 按钮权限 | `es-form.vue:384`、`es-table:435`、`es-dialog:67` | ✅ | 4 个文件 | 未与 CRUD 主线结合 |
| 跨页选择 | `core/table-selection.ts`、`cachePageSelection` | ✅ | 3 个文件 | 未与批量审批/权限结合 |
| 引擎切换 | `engine: 'vxe'` | vue3/vue2 | `vxe/BasicSwitch` | 玩具数据，无业务闭环 |
| schema 驱动整页 | `EsCrudPage` + `CrudPageSchema` | ✅ | `CrudPage.vue`、eui `crud/Basic` | 未单源、未跨端同源 |
| 全局 `permission` / `httpRequest` | `core/config.ts` | ✅ | 权限 4 个；全局请求 3 站各 1 例（2026-10-25 补） | 已补齐：入口配一次，页面只声明 `apiParams`（见 §11.6） |
| `mergeConfig` | 三端表格 | ✅ | 3 | 可并入旗舰 |
| `printConfig` | `vxe-print.ts` | ✅ | 11 | 覆盖足够 |
| ~~`clipboardConfig`~~ | **无** —— vxe 里没有这个属性 | ❌ | — | **幻影字段，已删**（见 §11.4 R8）：真名 `clipConfig`，且要区域选择模块才生效 |
| `listenToCallBack` | 表格 | ✅ | 16 | 有，但未用于"跨组件刷新"叙事 |
| `entryQuery` | 表格 | ✅ | 2 | 有，粒度偏小 |
| `EsErrorBoundary` | `vue3/src/index.ts:14` | ✅ | **0** | 组件隐身 |
| `SvgIcon` | 同上 | ✅ | **0** | 组件隐身 |
| 列 code→label 映射 | `TableColumn` **无** | ❌ | — | **纯 JSON 表格的最后一处函数洞** |

最后一行是本次分析发现的**能力级缺口**：`TableColumn` 只有函数型 `formatter` / `render`，
没有 `dataOptions` 式的 code→label 映射。于是任何"状态列显示中文 + 颜色"的表格都必须写函数，
纯 JSON schema 无法独立完成一张业务表格。AI 侧只能生成 `render` 源码字符串（经 esbuild 编译），
与"配置即数据"的主张相抵。

> **2026-10-25 已落地**（批 6）：`TableColumn.dataOptions` + `tagType`（`packages/core/src/types.ts:530-594`），
> 三端 `es-table` 同一张映射表渲染，三站 `table/CodeLabel.vue` 示教；矩阵其余行的现状见 §11.7。

---

## 6. 旗舰案例设计

设计原则：每条案例都要**同时**满足 ①真实中后台业务 ②原生写法明显更痛 ③能用源码证明能力存在 ④可断言验证。

### F1 · 三端同源的审批工作台（旗舰中的旗舰）

- **业务**：合同审批。查询条件含"合同类型 → 条款模板"联动；列表跨页勾选后批量通过；
  行内"查看/驳回/通过"受权限码控制；点金额超过阈值的行弹出审批详情。
- **形态**：单源 JSON `docs/cases/flagship-approval.json`（`CrudPageSchema`），
  由 `scripts/sync-cases.mjs` 分发到三站 `src/cases/`；每站只写一个约 15 行的宿主页
  （`configureEsPlus({ httpRequest, permission })` + `<es-crud-page :schema="schema" />`）。
- **证明**：一份**可下载、可 diff、无函数**的 JSON，在三端活体渲染；页面提供"查看 Schema"入口。
- **为什么原生难**：三套 UI 库各写一遍页面；权限要在模板里 `v-if` 三处；跨页勾选要自己缓存。
- **验收**：`JSON.parse(JSON.stringify(schema))` 深等于原对象；三站同名路由截图一致；
  切换角色（admin/editor/viewer）后按钮/列/字段同时收口。

### F2 · 报销单：零回调的字段联动

- **业务**：省份 → 城市 → 门店三级下拉；发票号"填了城市才必填"；大区自动等于省份且禁改；
  金额 > 5000 时"说明"必填；退款方式 ≠ 部分退款时隐藏"退款原因"。
- **形态**：`form/DeclarativeLinkage.vue` + 同目录 `declarative-linkage.config.ts`
  （纯对象，`reactions` + JSON `isHidden`，**0 个函数值**）。
- **证明**：把 `usage.md` 里已经写好的 `reactions` 文档变成可跑案例；与现有 `Conditional.vue`、`ComputedFields.vue` 并排对照。
- **验收（可自动化）**：新增 `scripts/check-declarative-demo.mjs`，断言配置文件
  `JSON.stringify→JSON.parse` 后深等（任何函数/undefined 都会失败），三站各一份配置。

### F3 · 万行工单：同一页从 500 行切到 5 万行

- **业务**：工单列表，可切 `engine: 'default' | 'vxe'`；切换后**已勾选行、排序、列宽、滚动位置**保持。
- **形态**：`advanced/EngineSwitchWorkbench.vue`，数据用生成器造 5 万行；
  切换控件显示"渲染耗时 / 内存"两个实测数字（`performance.now()`）。
- **证明**：把 `engine` 从"玩具开关"升级为"业务可观测的能力上限"。
- **为什么原生难**：换 `el-table` → `el-table-v2` → `vxe-grid` 意味着重写列定义、插槽、选择逻辑。

### F4 · 主子联动：行选中驱动从表

- **业务**：左侧订单表，选中一行 → 右侧明细子表按订单号请求；明细的"编辑"打开嵌套 `EsCrudPage`；
  明细变更后主表"已修改"标记通过 `listenToCallBack` 回写。
- **形态**：`advanced/MasterDetailFlow.vue`（替代 eui 现有 `MasterDetail.vue` 的静态版）。
- **证明**：一次点击 → 三组件（主表 / 从表 / 弹窗）链式响应；`listenToCallBack` 从"16 处零散使用"变成主线叙事。

### F5 · 可回滚的批量导入向导

- **业务**：上传 CSV → 前端校验（必填/枚举/重复）→ 错误行就地修正 → 分批提交 → 部分失败可重试。
- **形态**：`advanced/ImportWizard.vue`，复用 `StepImportWizard.vue` 的骨架但补上"错误行修复"与"回滚"。
- **证明**：把 `StepImportWizard` 从"流程演示"升级为"真的能导入"；展示 `entryQuery` 带入批次号。

### F6 · 「原生 vs es-plus」成本对照页（可选）

- **形态**：不写死数字，用脚本统计同目录下 `examples/native/*.vue` 与 `examples/es/*.vue` 的
  行数、事件处理器数、`v-if` 数，生成 `cases-metrics.json`；`Cases.vue` 展示实测值。
- **证明**：现有 `cases.json` 的 `pain`/`win` 是手写文案，容易被质疑；实测数字可复查。

### F7 · 「一句话 → 页面」：生成器产物对照（可选）

- **形态**：GitHub Actions 里跑 `eval` 的同一句 NL，把 `schema-generator` 产物贴到文档；
  重点展示生成的 `reactions` / `permissionValue` / `operationColumn` 直接可用。
- **证明**：把"AI 可生成"从宣传语变成可复查的产物；与 F2 的纯 JSON 配置互为佐证。

---

## 7. 落地方案（分批提交，不 push）

> 约束：按主题分批；每批只跑该批涉及的站点构建与守卫；**不提交 accuracy / eval 产物**；不 push。

### 批 1 · 缺陷修复（低风险，独立可回滚）

- D3 假按钮：`AdvancedButtons` 的导出改为真的生成 CSV；查询改为真的过滤一张小表。
- D4 `RowActions` 工具栏三键接真实动作（新增插一行、批量审核改状态、导出 CSV）。
- D5 `DataFlowManagement.vue` —— **复核后不改**：仅文件名陈旧，导航标题已正确（见 §2 更正）。
- D6 **复核后不删**：`vue2-compat/` 是刻意保留的参考示例；只清 3 处调试残留。
- D8 统一行尾为 LF（`Cases.vue`、`TabMultiTable.vue`、重生成的 `raw-sources`）；生成器归一化行尾并新增 `--check`。
- D9 清掉悬空空白行与冗余 `placeholder`（docs + pc 两份）。
- 守卫：`node scripts/check-cases-links.mjs`、`node scripts/generate-raw-sources.js`、`cd es-eui && npm run build`。

### 批 2 · 声明式标杆（F2）

- 新增 `declarative-linkage.config.js` + `DeclarativeLinkage.vue`（三站各一）。配置用 `.js` 而非 `.ts`：
  Vue2 站（es-eui/webpack）没有 TS loader，而这份文件是**纯数据**，`.js` 三端通吃、也更能说明"配置即 JSON"。
- 导航文案：`component-doc.data.ts:70,73,82` 改为"声明式 `reactions` 解法见…，回调解法仅作对照"。
- 新增 `scripts/check-declarative-demo.mjs`（断言配置纯 JSON），接入 `check:consistency`。
- 守卫：`npm run check:docs-layout`、三站构建。

### 批 3 · 旗舰主案例（F1）

- 新增 `docs/cases/flagship-approval.json`；扩展 `scripts/sync-cases.mjs` 分发；
  三站各加一个宿主页路由。
- 守卫：`sites:check`、`check:cases-links`、`check:site-nav`、三站构建；
  新增断言：三站渲染的是同一份 JSON（比对 hash）。

### 批 4 · 组合升级（F3 / F4 / F5）

- 逐条接入，每条独立提交；`listenToCallBack` 与 `entryQuery` 的叙事在此批补齐。

### 批 5 · 补齐隐身组件（D7）

- `EsErrorBoundary`：错误边界 + 降级 UI；`SvgIcon`：雪碧图/外部 SVG。
- 三站各一例，导航新增两个组件页。

### 批 6 · 产品小改（可选，需先拍板）

- `TableColumn` 增加声明式 `dataOptions`（code→label，可选 tag 颜色 class），三端引擎消费，
  同步 `packages/shared/schemas` 与 AI 提示词。**这是唯一需要改运行时的批次，单独评估。**

### 批 7 · 对照页（F6 / F7，可选）

每批的验证命令（**必须检查退出码，禁止 `| tail`**）：

```bash
node scripts/check-cases-links.mjs
node scripts/check-docs-layout.mjs
node scripts/gen-site-modules.mjs --check
node scripts/check-site-nav.mjs
npm run -s check:site-api-drift
# 站点构建要 cd 进目录
(cd es-plus-docs && npm run build)
(cd es-pc && npm run build)
(cd es-eui && npm run build)
```

---

## 8. 验收标准（可判定）

| 项 | 判定方式 |
| --- | --- |
| 案例讲的是配置而不是回调 | `check:declarative-demo` 通过（配置无函数值） |
| 一份 JSON 三端跑 | 三站宿主页读取同一文件；hash 相同；三站路由可访问 |
| 旗舰案例真的能用 | 构建通过 + 手动走一遍主路径（查询→勾选→批量→详情→刷新） |
| 标题达意 | `check:case-titles` 判可判定的部分（空标题 / 占位标题 / 同组重名）+ 打印超 12 字条数；「达意」本身是人工评审：211 条里 39 条超 12 字，都因含英文标识符（`rules`/`validator`/`proxyConfig`/`render`/`vxeConfig`）—— 按字面裁会丢掉「手段」，反而更说不清 |
| 无调试残留 | `check:demo-residue`：示例目录 `console.log` 计数为 0（3 条逐文件白名单） |
| 行尾卫生 | `check:eol-hygiene`：全仓无 `\r\r\n` / 孤立 `\r`；`check:raw-sources` 通过（生成物与源码同步） |

---

## 9. 不做的事与风险

- **不删基础案例**：入门入口保留，只做交叉引用与标题校准。
- **不改运行时**（批 6 除外）：本轮 95% 工作是"把已有能力展示出来"，不是造能力。
- **不追求单页三端同屏**：Vue2 与 Vue3 无法同应用挂载（旧审计已确认），用"同源 JSON + 三站路由"替代。
- **不动 eval / accuracy 产物**：案例改造不改变评测语料与门槛。
- **风险**：F2 的纯 JSON 配置若被未来 schema 变更破坏，需靠 `check:declarative-demo` 与
  `check:schema` 双重兜底；F1 的单源 JSON 若某端适配缺失，会在批 3 的构建期暴露，不会带到线上。

---

## 10. 与旧审计的关系

| 旧报告项 | 状态 | 本次是否重做 |
| --- | --- | --- |
| P0-1 三端渲染无证据 | ✅ 已修（`tri-render/pairs.json`） | 不重做，升级为 F1 的"同一份文件" |
| P0-4 schema 手写副本 | ✅ 已修 | 不重做 |
| P1-9 es-eui 运行期 bug | ✅ 已修 | 不重做 |
| P1-13 死代码/误导 | ✅ 已修 | **D5/D6 是同类问题的新实例**，本次补掉 |
| P2 设计取舍 | — | 本次把"回调示例"从取舍升级为 P0 叙事问题 |

---

## 11. 交付后的逐项复核（2026-10-25）

批 1–7 全部落地后，按「有无遗漏 / 未完成 / 未知隐患」再走一遍。结论：批 1–7 的功能项都在
（F1–F7、D3–D9；F3 的载体是 `vxe-table/BasicSwitch.vue`、F5 是升级后的
`advanced/StepImportWizard.vue`），但**验收口径里有一条没有守卫**，且三处"自说自话"的数字/叙事漏在守卫之外。

### 11.1 本轮修掉的（各自带守卫，防回归）

| # | 问题 | 为什么算缺陷 | 修法 / 守卫 |
| --- | --- | --- | --- |
| R1 | `es-plus-docs` / `es-pc` 的 F7 宿主把 `configureEsPlus({ permission })` 写在模块顶层，**离开页面不恢复** | 权限是模块级单例，活得比路由久：关着审批开关离开 `/ai-generated`，`approval:audit` 之外的**所有**权限码随之被拒（`createPermission(false)` 对任何 code 都返回 false）。旗舰页与 eui 宿主都恢复了，只有这两页漏 | `onUnmounted(() => configureEsPlus({ permission: () => true }))`；`check:generated-case` 新增「离开页面恢复全局权限」一项 |
| R2 | F6 的两组成对示例**从未真正渲染过**，只有编译检查 | 编译通过 ≠ 渲染正确；Cases 页把实算数字贴在它们旁边，示例悄悄坏掉就变成「用更少代码做到了（其实没做到）」 | `packages/vue3/__tests__/f6-cost-examples.spec.ts`：两侧挂载后行数/标签序列/查询区/分页/空值占位必须一致 |
| R3 | `cases-metrics.json` 的 `totals.files` 存的是**两侧行数之和** | 名字与内容不符，且这个和没有含义（123 + 77 = 200 说明不了任何事） | 改成 `totals.native / totals.es` 两组，键与场景内一致 |
| R4 | `getting-started.md` 顶部写「减少 76.5%」、同一页第 104 行写「少写 70%」；`getting-started.en.md` 写「70%」且说「Two render targets」 | 同一页两个数字、英文少一个渲染端 | 统一 76.5% / three render targets；`check:site-claims` 的降幅正则补 `少写` 与英文 `saves/cuts/reduces/less`（这正是 70% 长期漏网的原因） |
| R5 | 案例 6 的 `win` 仍写「apiParams + isHidden」 | D2 已把「回调当推荐解法」定为叙事问题，这张卡片漏改 | 改为「apiParams 拉选项 + 声明式 isHidden（纯 JSON，非回调）」 |
| R6 | §8 验收写「示例目录 console.log 计数为 0（白名单除外）」，但**没有任何守卫** | 于是 `vxe-table/EscapeHatch.vue` 的 `console.log('[vxeOn sort-change]')` 一直活着 —— 而且它是**死代码**：没有任何列声明 `sortable`，`sort-change` 根本不会触发 | 新增 `check:demo-residue`（322 个文件，3 条逐文件白名单）；`EscapeHatch` 给 ID/级别列加 `sortable`，排序与点选结果都渲染成页面上的 tag；`raw-sources` 重算 |
| R7 | Cases 页的实测表与首页「减少 76.5%」并列出现，口径不同（整文件 vs 胶水代码）却不说明 | 观众会读成两个互相矛盾的数字 | 三条 Cases 页的 caveat 各加一句口径差异说明 |

### 11.2 复核后仍未做的（P2，需要单独立项）—— 2026-10-25 已全部结案

| # | 项 | 规模 | 结案方式 |
| --- | --- | --- | --- |
| D10 ✅ | 示例里的内联 `style`（`dialog/Advanced.vue` docs+pc 各 25 处、`eui/table/CrudEdgeCases.vue` 11、`eui/dialog/Confirm.vue` 10） | 71 处 | 已抽成 scoped 样式块（`d535ae9`）；样式块放示例组件自己的 `<style scoped>`，代码 tab 展示的仍是原字符 |
| D11 ✅ | `es-eui` 示例 66 个文件、544 处列定义仍写 `key:`，docs/pc 写 `prop:` | 544 处 | 示例 133 处（`f4efd03`）+ 本轮文档样例 26 处（`quickstart` / `EsEuiDeveloperGuide` / `home`）全部改 `prop:`，`check:eui-column-prop` 的扫描范围从 `examples/` 扩到 `views/` |
| D12 ✅ | `cases.json` 案例 4–15 的 `links` 仍指向组件文档首页，不是该案例所在的小节 | 45 条链接 + 三站 demo 锚点支持 | 三站补齐 demo 级锚点（docs `demo-<key>` / es-pc 静态 `id` / eui `demo-<示例 key>`），`check:cases-links` 按四种锚点来源逐个校验；docs 站的惰性示例由 `hash-anchor.ts` 二次对准（`05492d5`、`1453450`、`a6e8c0a`） |

### 11.3 本轮新增守卫的边界（写清"不覆盖什么"）

- `check:demo-residue` 只扫**示例组件**（`.vue`/`.jsx`/`.ts`）：`es-plus-docs/src/components/examples`、
  `es-pc/src/views`、`es-eui/src/examples`。文档正文（`.md`）里的 `console.log` 是教学素材，
  站点基础设施（`es-eui/src/utils/server/request.js`）不是示例，都不扫。
- `f6-cost-examples.spec.ts` 只断言「两侧产出同一份可见结果」。新增对照场景时**必须**在这里补一组，
  否则新数字仍然只有编译兜底。
- `check:first-class-vxe-keys` 只认 `build-grid-config.ts` 里 `opts.<key>` 的**直传字段**。走
  `vxeConfig` 逃生舱的任意 vxe 配置不在其列（那本来就允许写上游才知道的键），
  所以它挡的是「ES-Plus 自造 API」，不是「上游改版」。

### 11.4 复核中新发现的幻影能力（2026-10-25）

| # | 问题 | 证据 | 修法 |
| --- | --- | --- | --- |
| R8 | `TableOptions.clipboardConfig` 三端导出、文档写「Ctrl+C 复制 / Ctrl+V 粘贴，需先开启 mouseConfig.selected」，实际配了没反应 | vxe 的表属性叫 `clipConfig`（`table/src/props.js`），**没有** `clipboardConfig`；vxe-grid 只透传 `tableProps` 里声明过的键，其余进 `$attrs` 被丢弃 —— 浏览器里读 VxeGrid 实例可证：`'clipConfig' in props === true`、`'clipboardConfig' in props === false`。且 `clipConfig` 本身只在装了区域选择模块（`$xeTable.triggerCelllAreaMnEvent` 存在）时生效，免费栈会打 `vxe.error.notProp` | 删掉该字段与 `VxeClipboardConfig` 类型（三端 export / `types/index.ts` / MCP bundled / 四张 API 表 / 构建映射），`build-grid-config.ts` 留一条「刻意没有」的注释指向逃生舱 `vxeConfig.clipConfig`；新增 `check:first-class-vxe-keys` 对上游 props 断言（探针验证过：把字段加回去立刻红） |
| R9 | 三处文案把 `mouseConfig.selected` 说成「框选（类 Excel）」 | 浏览器实测：点击单元格得 `col--selected` + 行 `row--current`，方向键能在单元格间移动 —— 是**单格选中**，不是区域框选（区域同样要给钱的模块）。`selected` 本身是好的，只是被吹大了 | 三站示例卡片 / API 表 / 正文统一改「点击选中单元格（方向键移动）」 |

> 教训写进守卫注释：这类错误「名字只差两个字母、编译不报、测试不红」，唯一的确定性判据
> 是拿上游的 props 列表对名字 —— 不是看名字像不像。

### 11.5 §8 两条「没有守卫」的验收项，现在各有一半守卫（2026-10-25）

| 项 | 可判定的部分 → 守卫 | 剩下的（明确不守） |
| --- | --- | --- |
| 行尾卫生 | 新增 `check:eol-hygiene`：`git ls-files` 全量扫文本文件，`\r\r\n` 与孤立 `\r` 直接红（二进制按后缀 + NUL 跳过；解析不出文件清单也红，拒绝空跑）。探针：往 `.gitignore` 塞一个 `\r\r\n` 立刻红 | 不规定用 CRLF 还是 LF —— 两种都合法，混着也合法（本仓本来就只有坏行尾才是问题） |
| 标题达意 | 新增 `check:case-titles`：四处台账（docs 组件页 / docs 进阶页 / eui 示例目录 / `cases.json`）共 211 条标题，判空标题、占位标题（`示例`/`Demo`/`基础用法`…）、**同组重名**（重名会让侧栏与 demo 锚点指向同一个），并把「超 12 字」的条数打印出来（39 条，均为含英文标识符的标题） | 不设长度门槛：`校验：rules + 自定义 validator` 这类按字面裁到 12 字会丢掉「手段」，反而更说不清。「侧重对不对」只能人工评审 |

> 守卫的价值在于把人已经做过的判断**固定成回归线**，不是替人做判断。这两条都刻意把
> 「不守什么」写进了脚本注释和这张表 —— 否则半年后没人知道绿灯管到哪。

### 11.6 §5 最后一个能力缺口：全局请求（2026-10-25）

矩阵里的「权限有，全局请求无」不是能力缺失 —— `core/config.ts` 的 `resolveHttpRequest`
一直支持顶层 `httpRequest`，是**没有一个页面证明纯 JSON schema 只靠入口配置就能跑起来**：
所有示例都把 `httpRequest` 塞在 `tableOptions` 里，等于每个页面各配一份，「配置即数据」在
最需要它的地方断了。

新增三站同名案例「全局请求：页面零请求代码」（docs `advanced/25-global-request`、
es-pc `Advanced.vue#global-request`、eui `combination/GlobalRequest`）：

- 页面只有一份 `pageSchema`（查询字段 + 列 + `apiParams` + `configTableOut`），**0 个函数值**；
- 请求函数在站点入口配一次（docs `install-app-plugins.ts`、es-pc / eui 的 `main.js`），
  组件一律不传 `httpRequest`；
- 表下的「请求检查器」显示全局函数被调用的次数与最近一次参数 —— 数据确实来自全局函数，
  而不是某个藏在组件里的本地 mock（三站均用浏览器点过查询 / 分页 / 重置验证）。

顺带收紧 eui 入口：原先 `$httpRequest` 在 `EsTable.methods` 与 `EsForm.methods` 里各写一份
（两份实现重复），现合并成一个顶层 `httpRequest`（`/api/demo/*` 走本地 mock，其余地址仍交给
原 axios 实例）。这不只是去重：注入的 `$esPlusTable.$httpRequest` 优先级**高于**全局，
只要 `EsTable.methods.$httpRequest` 还在，「顶层 httpRequest 配了也不生效」就是 eui 独有的坑。

同批修掉一个渲染缺陷：es-pc `OneLineCrud.vue` 的模板用了 `<PlusOutlined />` 但没 import，
Vue 只打一条 `Failed to resolve component` 警告，按钮图标静默消失 —— 构建、守卫全绿都拦不住。

覆盖边界：本案例证明「入口配置 → 组件零传参」，不覆盖 `import { httpRequest }` 自由函数
（那是 AI 生成代码的入口，与 `resolveHttpRequest` 共用同一份实现）。

### 11.7 §5 能力矩阵的现状复核（2026-10-25）

§5 那张表是 2026-10-24 的基线，批 1–7 落地后有 10 行已经变了；还有 1 行的「差距」**当初就写错了** ——
它把 `listenToCallBack` 当成跨组件信号，按那个假设设计出来的 F4 在落地时必然写不通。逐行核对如下，
证据都是能在仓库里重新跑出来的东西（不是「我记得做过」）：

| §5 行 | 2026-10-24 基线 | 2026-10-25 现状 | 证据 / 守卫 |
| --- | --- | --- | --- |
| `reactions` 声明式联动 | **0**，完全未展示 | 三站各 1 例 | `form/DeclarativeLinkage.vue` + `declarative-linkage.config.js`；`check:declarative-demo` 断言配置 `JSON.stringify→parse` 后深等（任何函数都会失败）、三站字节一致、且三站宿主真 import 它（不是死数据） |
| JSON 表达式 DSL | **0** | 同上，9 个字段 / 17 个白名单算子 | 同上；表达式只经 `EXPR_OPS` 求值，无 `eval` / `new Function` |
| 声明式 `isHidden` | 37 处全函数 | 声明式已有，函数仍在 | `DeclarativeLinkage` 的 `isHidden` 是 JSON 形态；`conditional` / `computedFields` 保留函数写法，但标题与正文已改成「声明式解法见报销单，回调仅作对照」（D2）—— 它们现在的身份是**对照组**，不是推荐解法 |
| 权限未与 CRUD 主线结合 | 4 个零散文件 | 主线里三级权限 | `docs/cases/flagship-approval.json` 的 `permissionValue` ×7（字段 / 列 / 行内按钮）；角色切 admin/editor/viewer 三处同时收口；`check:flagship-case` 断言「每个码都登记在 `ROLE_PERMISSIONS`、且 viewer 不能审批」 |
| 跨页选择未与批量审批结合 | 3 个零散文件 | 主线里跨页勾选 → 批量通过 | 同一份 JSON 的 `cachePageSelection` + `multiSelect`；`check:flagship-case` 断言「跨页勾选与分页契约」 |
| 引擎切换无业务闭环 | 玩具表格 | 工作台 | `vxe-table/BasicSwitch.vue`：500 / 5,000 / 50,000 三档，实时显示表体 DOM 行数、已选行数、JS 堆；勾选、排序、列宽跨引擎保持；5 万行直接禁掉 el-table 并当场写明原因。**仍未收口**：滚动位置依赖底层引擎自己的滚动容器 —— 案例正文如实写着，没有假装它能保住 |
| schema 整页未单源 | `CrudPage.vue` / eui `crud/Basic` | 单源四份同哈希 | `docs/cases/flagship-approval.json` 由 `scripts/sync-cases.mjs` 分发；源与三站副本 sha256 同为 `b857da158381…`；三站宿主各一薄壳 |
| 全局 `httpRequest` | 「有，但无页面证明」 | 三站各 1 例 | 见 §11.6 |
| `EsErrorBoundary` / `SvgIcon` | **0**，组件隐身 | 三站各 1 例 | `error-boundary/Basic.vue`、`svg-icon/Basic.vue`（es-pc 另有 `SvgIcon.vue` 组件页） |
| 列 code→label | `TableColumn` **无** | 已实现 | `TableColumnDataOption`（`label/value/tagType/disabled/children`，`packages/core/src/types.ts:530-594`），三端 `es-table` 的 `component.vue` 都在消费；三站 `table/CodeLabel.vue` |
| `listenToCallBack` 未用于跨组件刷新 | 差距栏这么写 | **差距栏本身是错的** | 它的语义是参数 / 响应转换钩子（`beforeRequest` / `afterResponse`），从来不是跨组件信号。F4 `advanced/MasterDetailFlow.vue` 的主从通信改成「共享状态 + `httpRequestInstance()` 重查」，并在文件头明写这条边界；`listenToCallBack` 在案例里保留真实用途（响应到达后补每行小计） |

这张表的用途不是宣布「都做完了」，而是把「基线 → 现状 → 证据」钉在一起：前 10 行任何一处回退，
点名的守卫都会红；第 11 行是**文档判断错误**，没有守卫能守，只能靠复核的人去读源码 ——
这正是它值得单列一行、而不是悄悄改掉的原因。

截至本轮，§5 表里除已删的幻影字段（R8 `clipboardConfig`）外，每一行都有可运行的案例或可跑的守卫；
仍未被案例覆盖的只剩 §11.6 末尾那条 —— `import { httpRequest }` 自由函数。

