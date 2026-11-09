# es-plus 能力全量审查报告

> 审查日期：2026-11-08  
> 审查对象：`es-plus` monorepo（vue3 / vue2 / adapter-antdv / core / shared / mcp-server / cli / docs）  
> 审查性质：只读静态审查 + 既有守卫、示例与评测产物核对；**未新增性能压测或浏览器交互测试**  
> 评价原则：**运行时能力、声明式能力、AI 生成能力分开评价**。三者上限不同，混在一起会得出错误结论。

---

## 0. 结论摘要

**总判断：es-plus 足以支撑“中等复杂度 CRUD 页面”，工程质量在同类组件库中偏高；但“复杂交互”主要靠 `engine: 'vxe'` 与函数逃生舱，默认引擎和声明式 / AI 前门有清晰天花板。它不是低代码平台，也不应以“任意复杂交互都能声明式表达”来预期它。**

| 维度 | 评分 | 判断 |
|---|---:|---|
| 中等复杂度 CRUD | 8 / 10 | 查询 / 表格 / 表单 / 弹窗 / 分页 / 权限 / 联动齐全，主战场够用 |
| 复杂表格交互 | 5 / 10（走 vxe 路线 8 / 10） | 行内编辑、筛选、导出、汇总、键盘、拖拽全部集中在 vxe |
| 声明式表达力 | 6 / 10 | JSON 能覆盖常见 CRUD，但复杂交互大量落在函数 / 逃生舱 |
| AI 生成能力 | 6.5 / 10 | compileRate 100%，definition95 89.2%，但严格意图命中仅 34%；前门只覆盖 22 / 41 个能力 token |
| 三端一致性 | 7 / 10 | 列构造、跨页选择、权限判定已单源化；但真实能力差异仍大，且有宣称漂移 |
| 测试与守卫 | 8.5 / 10 | 188 个 spec、123 个 check 脚本、能力矩阵对账 + 注入自证 |
| 文档准确性 | 5 / 10 | 总体诚实，但存在 3 处高影响漂移，其中 1 处直接污染 AI schema |
| i18n / a11y / 移动端 | 4 / 10 | 仅有 labelKey、aria-sort、按钮键盘可达；内置文案写死、表格行不可聚焦、无移动端卡片模式 |
| 性能与大数据 | 5 / 10 | 仅 vue3 有虚拟引擎；仓库没有性能基准 harness |

**三个必须优先修的信任问题**

1. **antdv 虚拟滚动被四处宣称支持，实际不支持。** 运行时适配器明确告警并降级，但 `packages/shared/src/capability.ts:107`、AI Zod schema、antdv 文档与 README 都写成支持。AI 前门会把 `virtual: true` 发给 antdv 用户，生产环境静默全量渲染。
2. **`permissionValue` 的 fail-closed 语义与两份文档相反。** 代码在宿主未配置 `permission()` 时**拒绝**；`permission-i18n.md:96`、`faq.md:49` 却写“所有按钮默认显示、permissionValue 被忽略”。
3. **默认引擎的 `exportData()` 是静默 no-op。** `packages/vue3/src/components/es-table/src/component.vue:1336` 只代理到引擎，默认 el-table 引擎没有该方法；而 `packages/core/src/types.ts:1248` 的注释仍写“Element 引擎走内置导出”。

**一句话选型建议**：标准 CRUD 用默认引擎；复杂表格把 `engine: 'vxe'` 当作硬依赖；需要 antdv 虚拟滚动、移动端卡片、严格键盘网格、表单数组/嵌套的，当前版本不要承诺。

---

## 1. 三层能力模型（本报告的分析框架）

同一个“能力”，在 es-plus 里有三种到达方式，上限依次降低：

| 层 | 使用者 | 典型入口 | 上限 | 证据 |
|---|---|---|---|---|
| L1 运行时 | 手写 Vue / SFC | `engine: 'vxe'`、`vxeConfig`、`render`、`spanMethod`、`vxeInstance()` | **高**：vxe 60+ 方法、45+ 事件、完整编辑/筛选/导出/键盘/拖拽 | `packages/vue3/src/components/es-table/src/engines/vxe-engine.vue` |
| L2 声明式 | JSON / schema 配置 | `TableOptions`、`TableColumn`、`FormItem`、`CrudPageSchema` | **中**：覆盖常见 CRUD，复杂交互缺键 | `packages/core/src/types.ts:504-1096` |
| L3 AI 前门 | LLM / MCP / CLI | `generate_crud`、`generate_table`、`generate_form`、`generate_dialog` | **中低**：只覆盖前门已声明且生成器会发射的键 | `docs/ai/ai-capability-matrix.json` |

关键数据：能力矩阵登记 41 个 token，其中 **前门可达 22 个（53.7%）**；`docs/ai/feature-coverage.json` 登记 103 个示例，但示例覆盖不等于声明式覆盖。`scripts/feature-coverage.data.mjs` 的 41 个 tier 条目为 **A 23 / B 3 / C 9 / D 6**——约 37% 的能力不在“前门一步可达”范围内。

尤其注意：`vxeFirstClass` 这一簇被整体登记为 **Tier C**，理由是“两处 AI Zod 零声明 + 生成器零发射（经 AI 入口静默 strip）”（`scripts/feature-coverage.data.mjs:123-129`）。需要分开看：

- **JSON 可序列化、但当前没声明**：`toolbarConfig` / `exportConfig` / `printConfig` / `columnConfig` / `keyboardConfig` / `mouseConfig` / `validConfig` / `seqConfig` / `showFooter` / `footerData` / `keepSource`；
- **已声明**：`editConfig` / `treeConfig`（vxe 富子集）/ `expandConfig`；
- **真正含函数、应留在 Tier C**：`footerMethod` / `vxeOn` / `vxeConfig` / `proxyConfig`（`ajax.query`）。

第一类不是“天生不可声明”，而是**当前没有声明**。这是 AI 复杂表格能力最大的结构性损失。

---

## 2. 能力全景

### 2.1 目标端 × 引擎

| 端 | 默认引擎 | 虚拟引擎 | vxe 引擎 | 说明 |
|---|---|---|---|---|
| vue3 | `el-table` | `el-table-v2` | `vxe-grid` | 唯一有虚拟引擎的端 |
| vue2 | `el-table`（Element UI） | ❌ | `vxe-grid` | 无虚拟；大数据走 vxe |
| antdv | `a-table` | ❌（告警降级） | `vxe-grid` | a-table 无虚拟滚动 |

### 2.2 声明的四个面

| 面 | 组件 | 核心配置 |
|---|---|---|
| 查询 | `EsForm` | `formItemList`、`layoutFormProps`、`configBtn`、`reactions`、`isHidden` |
| 表格 | `EsTable` | `columns`、`options`、`formatter` / `render` / `btns`、`dataOptions`、`treeConfig` / `mergeConfig` / `expandConfig` |
| 表单 | `EsForm` | 14 种 `formtype`、`rules`、`formItemOptions`、`dataOptions`、`apiParams`、`permissionValue` |
| 弹窗 / 页面 | `useDialog` / `EsCrudPage` | `configBtn`、`render`、`dialogs`、`toolbarBtns`、`tableBtns`、`operationColumn`、`cacheKey` |

### 2.3 声明式表格能力（`TableColumn` + `TableOptions`）

- 列：`prop` / `label` / `labelKey` / `width` / `minWidth` / `align` / `fixed` / `sortable` / `formatter` / `render` / `scopedSlots` / `groups` / `expandConfig` / `ellipsis` / `emptyPlaceholder` / `dataOptions` / `hidCol` / `permissionValue` / `btns` / `editRender` / `footerFormatter`
- 表：`border` / `stripe` / `size` / `heightType` / `height` / `rowkey` / `multiSelect` / `expand` / `snIndex` / `cachePageSelection` / `sortParam` / `defaultSort` / `localPagination` / `mergeConfig` / `spanMethod` / `rowClassName` / `rowStyle` / `cellClassName` / `cellStyle` / `headerCellClassName` / `entryQuery` / `configTableOut` / `httpRequest` / `apiParams`
- 引擎相关（vxe 一等公民）：`showFooter` / `footerMethod` / `footerData` / `editConfig` / `keepSource` / `exportConfig` / `printConfig` / `toolbarConfig` / `columnConfig` / `keyboardConfig` / `mouseConfig` / `validConfig` / `treeConfig` / `proxyConfig` / `expandConfig` / `seqConfig` / `vxeConfig` / `vxeOn` / `vxeColumn`

### 2.4 表单能力

14 种控件：`Input` / `InputNumber` / `Select` / `DatePicker` / `TimePicker` / `Slider` / `ColorPicker` / `Transfer` / `Cascader` / `Radio` / `Checkbox` / `Switch` / `Rate` / `Upload`（`packages/core/src/types.ts:117-140`）。

支持：栅格 `span`、`rules`、`formItemOptions`、`dataOptions`、远程 `apiParams`、`reactions`（选项/必填/禁用/值联动）、`isHidden`（JSON 表达式）、`permissionValue`、`listenToCallBack`、`on` 事件袋、按钮区（含折叠/展开、`setOptions`）。自定义控件可通过 `item.render` 走函数逃生舱；未知 `formtype` 会告警并**不渲染该字段**（`packages/vue3/src/composables/use-form-inputs.ts:397-425`）。

### 2.5 AI 工具链

- MCP 19 个工具：`generate_scene` / `generate_crud` / `generate_table` / `generate_form` / `generate_dialog` / `validate_config` / `generate_crud_from_config` / `validate_intent` / `coverage_report` 等（`packages/mcp-server/src/tools/index.ts`）。
- Zod schema + `preflight` + 确定性生成器；schema 模式产出纯 JSON，SFC 模式产出可编译源码。
- 场景：crud / table / form / dialog。
- 当前评测（`__tests__/golden/last-accuracy.json`，2026-11-07，deepseek-flash）：
  - 语料 216 例、heldout 194 例、scoredRows 407、erroredRows 0
  - definition95 **89.18%（173/194）**，目标 95%，`passed: false`
  - compileRate **100%**
  - exactIntentFull **34.02%**
  - convergence@k=3 **90%（27/30）**，meanTurnsToConverge 0.37
  - typecheck **99.54%**（仍有 1 个 TS2353：`TableColumnDataOption.children`）
  - byLanguage：zh 49.48% / en 24.85%

### 2.6 测试与守卫

- 188 个 spec 文件（`packages/**/*.spec.*` / `*.test.*`）。
- 123 个 `check:*` 脚本，覆盖能力矩阵、三端列一致、生成物、文档示例、i18n、权限、场景覆盖等。
- Playwright e2e 三个 project：`vue2`、`ai-gallery-docs`、`mobile-docs`；**没有 vue3 / antdv 真实浏览器表格交互项目**。
- golden 语料 216 例，含 heldout 与收敛语料。

---

## 3. 复杂交互逐项评估

> “复杂交互”在本报告中指：行内编辑、列筛选、多列排序、行/列拖拽、懒加载树、汇总行、键盘导航/剪贴板、虚拟滚动、表单数组/嵌套、详情只读、移动端适配。

### 3.1 表格

| 能力 | 默认引擎 | 虚拟引擎 | vxe 引擎 | 评价 / 证据 |
|---|---|---|---|---|
| 服务端分页 / 排序 | ✅ | ✅ | ✅ | `sortParam` + 请求票据竞态保护；`requestTicket` 只让最后一次请求写数据 |
| 本地分页 | ✅ | ✅ | ✅ | 分页由外层统一管理，引擎无关 |
| 多选 / 跨页保留 | ✅ | ✅ | ✅ | 三端语义统一：`selection-change` 只带当前页，全集用 `getSelectionRows()`；vxe 清空需同时 `clearCheckboxReserve` |
| 静态树表 | ✅ | ✅ | ✅ | 顶层 `treeConfig`（`childrenField` / `expandAll`），三端与 vxe 同名不同层 |
| 懒加载树 | ❌ | ❌ | ⚠️ 仅 `vxeConfig.treeConfig` | schema 明示“Static trees only — lazy/async loading is out of scope”（`structured-config.schema.ts:782`） |
| 分组表头 | ✅ | ❌ 摊平 + 告警 | ✅ | `use-column-adapter.ts:95-101`：virtual 丢父级标题；antdv 支持 N 级 |
| 合并单元格 | ✅ | ❌ | ✅ | `mergeConfig` 三端；antdv 无函数式 `spanMethod`，只有声明式 `mergeConfig` |
| 展开行 | ✅ | ⚠️ 仅树 `children` | ✅ | virtual 无法渲染自定义展开内容（`use-column-adapter.ts:207-215`） |
| 行内编辑 | ❌ | ❌ | ✅ | `editConfig` 仅 vxe；`cell-edit` 载荷归一为 `{ row, prop, value, oldValue }` |
| 列筛选 | ⚠️ 可透传但无契约 | ❌ | ⚠️ 仅 `vxeConfig.filterConfig` | `TableColumn` 无 `filters` / `filterMethod`；配置里写 `filters` 会被 `collectUnknownKeys` 报为未知键并剥掉——不是静默，但**没有可加的能力** |
| 多列排序 | ❌ | ❌ | ⚠️ 逃生舱 | 无声明式多列排序状态机 |
| 行 / 列拖拽 | ❌ | ❌ | ⚠️ `vxeConfig` / `columnConfig` | 列宽调整同理 |
| 导出 / 打印 | ❌ `exportData()` 静默 no-op | ❌ | ✅ | `component.vue:1336`；`print` 同样只代理到引擎 |
| 汇总行 / 聚合 | ❌ | ❌ | ✅ | `showFooter` / `footerMethod` / `footerData` 默认引擎会被 strip（`component.vue:612`） |
| 键盘导航 / 剪贴板 / 单元格校验 | ❌ | ❌ | ✅ | `keyboardConfig` / `mouseConfig` / `validConfig` 仅 vxe |
| 虚拟滚动 | ❌（vue3 默认引擎） | ✅ | ✅ | vue2 无；antdv 无（运行时告警降级） |
| 单元格点击 / 双击 / 右键 | ✅ | ✅ | ✅ | antdv 用列级 `customCell` shim 出 `cell-click` |
| 空态 / 自定义 render / slot | ✅ | ⚠️ 有边界 | ✅ | virtual 的 expand / group 有明确降级告警 |
| 权限列 / 按钮 | ✅ | ✅ | ✅ | 单一真源 `checkPermissionValue`，fail-closed |

### 3.2 表单

| 能力 | 现状 | 评价 |
|---|---|---|
| 14 种基础控件 | ✅ | 覆盖常规业务表单 |
| 栅格布局 | ✅ | `span` / `layoutFormProps` |
| 校验 | ✅ | `rules`；自定义 validator 是函数，属 Tier C |
| 联动 | ✅ | `reactions`（选项 / 必填 / 禁用 / 值）+ `isHidden`，JSON 可承载 |
| 远程数据源 | ✅ | `apiParams` / `dataOptions` |
| 权限 | ✅ | 字段级 `permissionValue`，三端接线 |
| 自定义控件 | ⚠️ | 仅 `item.render` 函数逃生舱；无声明式组件注册 |
| 数组 / 嵌套子表单 | ❌ | 无 `FormList` / 嵌套 schema |
| 只读 / 详情模式 | ❌ | 只能逐控件传 `disabled` / `readonly`，无表单级模式 |
| 分组 / Tabs / Steps | ❌ | 只有平铺 + `span` |
| 内置文案 i18n | ❌ | 按钮 / 空态 / loading 文案写死中文 |

### 3.3 弹窗与 CRUD 页面

| 能力 | 现状 |
|---|---|
| 拖拽 / 全屏 / 挂载点 | ✅ `isDraggable` / `fullscreen` / `appendTo` |
| 多实例 / 嵌套弹窗 | ✅ `useDialog` 工厂 |
| 自定义内容 | ✅ `render`（函数，Tier C） |
| 自动新增 / 编辑 / 删除 | ✅ 标题、按钮、确认文案可覆盖 |
| 查询区 + 表格 + 弹窗组合 | ✅ `EsCrudPage` |
| Drawer | ❌ 未提供 |
| 详情只读页 | ❌ 未提供，需自行用 `EsForm` + disabled 拼 |
| 移动端 | ⚠️ 仅 `table-btns.vue` 有 `@media (max-width: 768px)`；无卡片模式 |

### 3.4 非功能项

| 维度 | 现状 | 风险 |
|---|---|---|
| i18n | `labelKey` + 全局 `t`；Element locale 可经 `ElConfigProvider` / `elLocale` 注入 | **es-plus 自己的文案写死中文**：`暂无数据`、`新增`、`编辑`、`操作`、`取消`、`确定`（`constants.ts:139-150`、`es-crud-page.vue:605-612` 等） |
| a11y | 表头 `aria-sort`、按钮原生 `<button>`、装饰图标 `aria-hidden` | **表格行不可聚焦、方向键不能遍历**（文档已诚实标注）；无 grid role / roving tabindex |
| 移动端 | 仅操作按钮窄屏换行 | 无响应式卡片、无列折叠策略 |
| 性能 | vue3 虚拟引擎；vxe 自带虚拟 | **无性能基准 harness**；默认引擎全量渲染；无行数阈值建议 |
| 主题 | 设计 token + 暗色 | 表头默认底色问题已修（不再内联覆盖主题） |
| SSR | 未审查 | 动态 slot / 浏览器 API 需自行验证 |

---

## 4. 核心短板（按优先级）

### P0 —— 信任与正确性（建议立即修）

#### P0-1 antdv 虚拟滚动：文档、能力矩阵、AI schema 三处宣称支持，运行时明确不支持

**证据**

- 运行时真相：`packages/adapter-antdv/src/components/es-table/src/component.vue:390-399` 明确写“a-table 从未实现虚拟滚动”，`virtual` 告警并按默认引擎渲染。
- 能力矩阵：`packages/shared/src/capability.ts:107` `antdv: full('透传 <a-table :virtual>（Ant Design Vue 4 原生虚拟滚动）')`；`:142` 同义。
- AI schema：`packages/shared/src/structured-config.schema.ts:584-588`、`:594` 告诉模型“Ant Design Vue 4 has native virtual scroll”。
- 文档：`es-plus-docs/src/docs/adapter-antdv.md:139`、`packages/adapter-antdv/README.md:112`。
- 守卫盲区：`check-capability-parity` 只保证“`none` 会告警”“矩阵键存在于 schema”，**不验证 `full` 有运行时证据**。因此把 antdv 的 virtual 写成 `full`，生成器不会告警，反而让用户以为可用。

**影响**：LLM 生成的 antdv 页面会带 `virtual: true`；开发环境只有一条 console warning，生产环境静默全量渲染，大数据页面直接卡死。这是“幻影能力”的典型形态。

**修法**

1. 能力矩阵 antdv virtual 改为 `none`（或新增 `degraded` 级别，但当前只有 `none` 会产告警，改 `none` 最直接）。
2. 同步修 schema 描述、antdv 文档、README：明确“请改用 `engine: 'vxe'`”。
3. 增加“`full` 声明必须有运行时证据”的守卫：维护一份 claim → spec/e2e 映射，至少对高风险能力（virtual / edit / export / tree）强制。
4. 重新生成 `docs/ai/ai-capability-matrix.json` 并跑 `check:capability-parity`。

**验收**：antdv + `virtual: true` 在 `generateFromConfig` 阶段产生 warning；四处文本一致；守卫在回退时变红。

#### P0-2 `permissionValue` fail-closed 与文档相反

**证据**

- 实现：`packages/core/src/field-resolver.ts:295-329`。无 `permissionValue` → 放行；有值且宿主配置 `permission()` → 用函数结果；有值但未配置 → **拒绝 + 一次性 warning**。
- 文档：`es-plus-docs/src/docs/permission-i18n.md:96`、`es-plus-docs/src/docs/faq.md:49` 写“所有按钮默认显示、`permissionValue` 被忽略”。

**影响**：宿主漏配 `permission()` 时，用户看到的是“按钮消失”，按文档排查会得出完全相反的结论。对权限敏感系统，这是上线级问题。

**修法**：以代码为准改文档，并给迁移说明（v? 起改为 fail-closed；如需旧行为，显式传 `permission: () => true`）。**不建议**加 fail-open 开关——那会把“配了门”重新变成“谁都能看见”。

**验收**：两份文档与实现一致；新增 spec 断言“未配 permission 时声明了门的按钮不渲染且告警一次”。

#### P0-3 默认引擎 `exportData()` 静默 no-op

**证据**

- `packages/vue3/src/components/es-table/src/component.vue:1336`：`exportData: (opts) => activeEngineRef.value?.exportData?.(opts)`。
- `activeEngineRef` 在默认引擎下为 `null`（同文件 `:1223` 附近），因此返回 `undefined`，无异常、无提示。
- `packages/core/src/types.ts:1248` 注释写“Element 引擎走内置导出”，与实现不符。
- vue2 / antdv 同样只代理到 vxe 引擎。

**影响**：用户接上导出按钮，点击后什么都没发生；没有错误，难以定位。属于“静默能力丢失”，比报错更糟。

**修法（二选一）**

- A（推荐，成本低）：默认引擎实现纯前端 CSV 导出（读取 `dataSource` + 可见列），支持 `exportConfig` 的子集；复杂格式仍走 vxe。
- B：无引擎能力时 `throw new Error` 或 `console.error` + 返回 rejected Promise，并在文档写清“导出仅 vxe”。

**验收**：默认引擎调用 `exportData` 要么产出文件，要么明确失败；类型注释同步。

### P1 —— 复杂交互能力缺口

1. **行内编辑只有 vxe。** 默认 / 虚拟 / antdv 都没有 `editConfig`。真实业务里“表格直接改数”非常常见，当前必须整表切 vxe。建议：文档把 vxe 标为“可编辑表格的默认答案”；中期评估默认引擎的单元格编辑（成本高，可先做“双击弹表单”的轻量方案）。
2. **列筛选、多列排序无声明式契约。** `TableColumn` 没有 `filters` / `filterMethod`；AI schema 也没有。配置里写 `filters` 会被 `collectUnknownKeys` 报为未知键并剥掉——入口有告警，但用户**找不到可加的能力**。建议：先加 `filters` + `filterMethod`（el-table / a-table 原生支持，vxe 映射 `filterConfig`），并让 preflight 对列上的未知键继续告警。
3. **虚拟引擎是能力子集，且没有自动选路。** 分组表头摊平、合并/详情行/汇总/编辑缺失；只有 vue3 有。建议：`engine: 'auto'`（按能力需求 + 已安装依赖选 vxe/default），或在 DEV 下按配置特征给出“当前配置在 virtual 下会降级”的聚合告警。
4. **vxe 一等公民 JSON 块被 AI 前门静默 strip。** `vxeConfig` / `toolbarConfig` / `exportConfig` / `footerMethod` / `keyboardConfig` / `columnConfig` 等全是 JSON，却被登记 Tier C。建议：把这些块声明进 Zod schema 与生成器，Tier 升到 A/B。这是提升“AI 生成复杂表格”性价比最高的一步。
5. **懒加载树不在声明式范围。** 静态树三端可用；异步子节点只能 `vxeConfig`。建议：至少文档给出 vxe lazy 示例，避免用户误以为 `treeConfig` 支持。
6. **表单表达力停在“平铺 14 控件”。** 缺数组/嵌套子表单、只读详情模式、分组/Tabs/Steps。对“复杂表单”场景这是硬缺口；短期可用 `render` 逃生舱，但 AI 前门不可达。
7. **导出/打印/汇总/键盘/剪贴板与 vxe 强绑定。** 前三者尤其容易被误认为通用能力（见 P0-3）。建议在 `TableOptions` 文档逐项标注“仅 vxe”。
8. **i18n 只覆盖标签，不覆盖内置文案。** `暂无数据`、`新增`、`编辑`、`操作`、`取消`、`确定`、loading 文案写死。`EsPlusOptions` 没有 `locale` 包。建议：新增 `locale` 文案表（默认中文），所有内置字符串走 `t()`。
9. **a11y 上限明确但偏低。** 行不可聚焦、无方向键遍历、无 grid role。对政企/无障碍合规项目，这是选型阻断项。建议：中期提供 `keyboardNav`（roving tabindex + Enter 进入编辑 + Esc 退出），或明确写入“不支持”。
10. **移动端只有按钮换行。** 复杂表格在手机上仍是一张宽表。建议：提供 `mobileCard` 渲染模式（列 → 卡片字段），或明确“移动端请用列表组件”。
11. **无性能基准。** roadmap 已承认没有 render-performance harness。建议：定义 1k / 5k / 20k 行 + 宽列 + 展开行的基准，纳入 CI 趋势（不必门禁，先可观测）。
12. **e2e 没有 vue3 / antdv 真实表格交互。** 现有 project 是 vue2、AI gallery、mobile docs。建议：补一个 vue3 表格交互 project（排序/选择/分页/编辑/导出），至少覆盖 P0/P1 的修复。
13. **请求只防竞态、不取消网络。** `requestTicket` 保证旧响应不覆盖新数据，但没有 `AbortController`。对慢接口，旧请求仍占连接。建议：可选 `abortPrevious`。
14. **CRUD 无 Drawer、无详情只读页。** 复杂业务常用“列表 → 抽屉详情 → 编辑”。建议：`useDialog` 增加 drawer 变体，或文档给出组合示例。

### P2 —— 工程质量与文档

1. **旧内部报告已过期。** `docs/internal/es-plus-evaluation-report.md`（2026-05-26）仍写“无虚拟滚动 / 树 / 编辑”，与现状相反。建议归档或标注 superseded。
2. **未知列键在入口报错、在产物中被剥掉。** `collectUnknownKeys` 能报出 `/columns/0/filters`，这一步不静默；但报完之后该键仍然消失，用户没有对应的声明式能力可用。新增能力时应同步扩列契约，而不是靠透传碰运气。
3. **能力矩阵的 `full` 声明缺少运行时证据链。** 这是 P0-1 的根因，也是系统性风险：矩阵是手写的，守卫只校验结构。建议把“声明 → 测试”的映射纳入 `check-capability-parity`。
4. **示例数量 ≠ 声明式覆盖。** 103 个 demo 很可观，但大量复杂能力靠函数/宿主编排演示；AI 前门仍只覆盖 22/41 token。建议 coverage 报告同时给“demo 覆盖”和“前门覆盖”两个数。
5. **帮助文档与实现偶有措辞漂移。** 本次发现 3 处高影响项；建议把“文档声明”纳入可 grep 的守卫（例如 antdv 文档出现“虚拟滚动”必须伴随“不支持”或改词）。

---

## 5. 亮点（应保留的工程资产）

1. **请求票据竞态保护**：`requestTicket` 只让最后一次请求写数据与 loading，三端一致；配合 `refetchKeepPage` 处理排序/筛选后的页码语义。
2. **能力矩阵 + 注入自证守卫**：`check-capability-parity.mjs` 不只是比对，还用 P1-P4 四种注入证明守卫本身有效（删消费点、加假键、让 `isSet` 失明、让 partial 也告警）。这是高于平均水平的测试设计。
3. **列构造单源化**：`buildLeadingColumns` / `synthesizeLeadingColumns` 统一七个列产出路径，保证“同一配置三端列集合一致”。
4. **权限判定 fail-closed**：`checkPermissionValue` 是单一真源，声明了门但没配判定函数就拒绝，避免“门看起来存在、实际失效”。
5. **确定性生成器 + preflight**：compileRate 100% 是硬指标；schema 模式纯 JSON、SFC 模式可编译，边界清楚。
6. **vxe 逃生舱是类型化的一等公民**：`vxeConfig` 深合并、`vxeOn` 事件注入、`vxeColumn` 列级逃生、`vxeInstance()` 原始实例，且 `vxe-types-augment.ts` 给了类型提示。
7. **跨页选择语义归一**：vxe 的 `selection-change` 只发当前页、全集走 `getSelectionRows()`，与 el-table / a-table 对齐；`clearSelection` 同时清 reserve，修掉了“清空后翻页又勾上”的真实 bug。
8. **文档总体诚实**：`comparison.md` / `benchmark.md` / `roadmap.md` 明确写了边界（无低代码平台、无第二组件体系、无性能 harness），a11y 边界也写进了组件文档。本次发现的漂移是例外，不是常态。
9. **测试密度**：188 个 spec + 123 个 check 脚本，对三端组件库来说属于高投入。

---

## 6. 文档 / 实现漂移清单

| # | 漂移 | 严重度 | 证据 | 修法 |
|---|---|---|---|---|
| 1 | antdv 虚拟滚动被宣称支持 | **P0** | `capability.ts:107,142` / `schema:584-594` / `adapter-antdv.md:139` / `README:112` vs `adapter-antdv/component.vue:390-399` | 矩阵改 `none`，文档改“请用 vxe”，重新生成矩阵 |
| 2 | permission 未配置时“默认显示” | **P0** | `permission-i18n.md:96` / `faq.md:49` vs `field-resolver.ts:295-329` | 以代码为准改文档 + 迁移说明 |
| 3 | 默认引擎“内置导出” | **P0** | `types.ts:1248` vs `component.vue:1336` | 实现 CSV 或明确报错 |
| 4 | 旧评测报告称“无虚拟/树/编辑” | P2 | `docs/internal/es-plus-evaluation-report.md`（2026-05-26） | 标注 superseded / 归档 |
| 5 | 列未知键入口报错、产物剥掉 | P2 | `collectUnknownKeys` + `sanitizeExplicitColumns` | 新增能力时同步扩列契约 |

---

## 7. 改进路线图（建议）

### Phase 0 —— 信任修复（1-2 天）

| 任务 | 验收 |
|---|---|
| antdv virtual 矩阵/文档/schema 改口 | `generateFromConfig(antdv, virtual)` 产 warning；四处文本一致 |
| permission 文档改为 fail-closed | 文档与 spec 一致；新增“未配 permission → 不渲染 + warn”测试 |
| `exportData` 默认引擎实现 CSV 或明确失败 | 默认引擎调用有确定结果；类型注释同步 |
| 加“full 声明 → 运行时证据”守卫雏形 | 至少 virtual/edit/export/tree 四条 claim 有映射，回退变红 |

### Phase 1 —— 复杂交互可达性（1-2 周）

| 任务 | 验收 |
|---|---|
| 把 vxe JSON 块声明进 Zod schema + 生成器（toolbar/export/footer/keyboard/column/tree/proxy） | 这些能力从 Tier C 升到 A/B；`check:capability-parity` 绿；生成物可编译 |
| 列筛选 + 多列排序声明式 | 三端至少 el-table / a-table / vxe 映射；AI 可生成；未知键不再静默丢 |
| `engine: 'auto'` 或降级聚合告警 | 配置含分组表头/合并/编辑时，virtual 选择会被提示 |
| 默认引擎 CSV 导出 | 1k 行导出可用；大文件走 vxe |

### Phase 2 —— 表达力与非功能（2-4 周）

| 任务 | 验收 |
|---|---|
| 表单数组 / 嵌套 / 只读详情 | schema + 生成器 + 三端渲染 + golden |
| i18n locale 包 | 内置文案零硬编码；中英切换 e2e |
| a11y 键盘网格 | 行可聚焦、方向键遍历、Enter 编辑、Esc 退出；或明确不支持 |
| 移动端卡片模式 | 窄屏列 → 卡片；e2e 断点回归 |
| 性能基准 | 1k/5k/20k 行基线；CI 趋势可观测 |
| vue3 / antdv e2e 表格交互 | 排序、选择、分页、编辑、导出至少各一条 |

### Phase 3 —— AI 准确率

- definition95 从 89.2% → 95%：继续修语料/尺子（参见既有 eval 债务），而不是只加文档。
- 前门覆盖率从 22/41 提升：优先把 JSON 可序列化的 vxe 块纳入，而不是把函数能力硬塞进 schema。

---

## 8. 选型结论

| 场景 | 结论 | 说明 |
|---|---|---|
| 标准 CRUD（列表 / 查询 / 表单 / 弹窗） | ✅ 推荐默认引擎 | 主战场；AI 生成 compile 100%，definition95 89.2% |
| 中等复杂度表格（树、合并、展开、跨页选择、权限列） | ✅ 默认引擎可用 | 声明式覆盖，三端语义已对齐 |
| 复杂表格（行内编辑 / 筛选 / 导出 / 汇总 / 键盘 / 拖拽） | ✅ 仅 `engine: 'vxe'` | 把 vxe 当硬依赖，不要期待默认引擎补齐 |
| 大数据（>5k 行） | ✅ vue3 virtual 或 vxe | antdv / vue2 无虚拟；antdv 必须 vxe |
| 移动端为主 | ⚠️ 不推荐 | 无卡片模式，窄屏体验未验证 |
| 多语言产品 | ⚠️ 需自建文案层 | 内置按钮/空态文案写死中文 |
| 严格无障碍 / 政企合规 | ❌ 当前不满足 | 表格行不可聚焦、无键盘网格 |
| AI 一键生成标准页面 | ✅ 可用 | 复杂交互预期要人工走 Tier C |
| 低代码平台 / 任意页面搭建 | ❌ 不是目标 | 无画布、无任意组件编排、无运行时 schema 热更新 |

**最终建议**：把 es-plus 定位为 **“带 AI 前门的业务组件库”**，而不是“低代码引擎”。对外承诺“复杂表格请用 vxe”，比承诺“默认引擎声明式什么都能做”更可信，也更符合代码现状。当前最值得投入的不是再加组件，而是：**修三处信任漂移 + 把 JSON 可序列化的 vxe 能力接进 AI 前门 + 补表单数组/只读与移动端**。

---

## 附录 A：本次审查的主要证据文件

| 主题 | 文件 |
|---|---|
| 表格主组件 | `packages/vue3/src/components/es-table/src/component.vue` |
| 列渲染 | `packages/vue3/src/components/es-table/src/column-item.vue` |
| 虚拟引擎 | `packages/vue3/src/components/es-table/src/engines/{virtual-engine.vue,use-column-adapter.ts,use-virtual-selection.ts,use-virtual-sort.ts}` |
| vxe 引擎 | `packages/vue3/src/components/es-table/src/engines/{vxe-engine.vue,use-vxe-column-adapter.ts,use-vxe-grid-config.ts}` |
| 类型契约 | `packages/core/src/types.ts` |
| 权限 | `packages/core/src/field-resolver.ts` |
| AI schema | `packages/shared/src/structured-config.schema.ts` |
| 能力矩阵 | `packages/shared/src/capability.ts`、`docs/ai/ai-capability-matrix.json` |
| 功能覆盖 | `scripts/feature-coverage.data.mjs`、`docs/ai/feature-coverage.json` |
| 评测产物 | `__tests__/golden/last-accuracy.json`、`last-accuracy-badge.json` |
| 守卫 | `scripts/check-capability-parity.mjs`、`package.json` 的 `check:*` |
| 文档 | `es-plus-docs/src/docs/{adapter-antdv,permission-i18n,faq,comparison,benchmark,roadmap}.md` |
| antdv 适配 | `packages/adapter-antdv/src/components/es-table/src/component.vue` |
| vue2 适配 | `packages/vue2/src/components/es-table/component.vue` |
| CRUD | `packages/vue3/src/components/es-crud-page/src/es-crud-page.vue` |
| 表单 | `packages/vue3/src/components/es-form/src/es-form.vue`、`packages/vue3/src/composables/use-form-inputs.ts` |

> 说明：本报告没有运行新的性能测试或浏览器交互测试；性能与移动端结论来自代码结构与既有文档，不是实测数字。评测数字来自 `last-accuracy.json`（2026-11-07），不是本次重跑。
