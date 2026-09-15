# @es-plus/adapter-antdv

## 1.2.0

### Minor Changes

- 修复三端同构中的「静默失效」类缺陷 —— 这些问题的共同点是**不报错、只是行为悄悄不对**，
  是同一份配置在某一端"没反应"时最难排查的一类。同时收敛若干跨端 API 差异。

  **`@es-plus/adapter-antdv`**

  - **EP 专有属性不再被静默吞掉**：`clearable` / `filterable` / `show-word-limit` / `collapse-tags`
    此前被原样透传给不认识它们的 Ant Design Vue 组件而失效（`grep allowClear` 曾为 0 命中）。
    现按 formtype 限定作用域映射为 `allowClear` / `showSearch` / `showCount` / `maxTagCount`；
    `collapse-tags-tooltip` 无等价物，改为**开发期一次性告警后丢弃**，不再无声消失。
  - **修复插件重复注册**：`install()` 补回 `isPlugin && Plugin` 守卫（vue3 早有针对该场景的守卫，
    本端遗漏且注释写着"完全对齐 vue3"），消除 dev 环境的
    `Component "EsForm" has already been registered` 告警。
  - **`useDialog` 返回值对齐三端的 `DialogResult`**：由裸 vNode 改为
    `{ instance, close, destroy }`，使 `const { close, instance } = dialog({...})` 这种
    在 vue3/vue2 与官方示例中通用的写法在本端也能工作。callable 上的 `.close()` / `.destroy()`
    保留不变，属纯增量变更。
  - **默认列对齐收敛为 `center`**：此前仅在显式配置时才设置 align，落到 a-table 默认的 `left`，
    造成"同一份配置三端三种对齐"，且与本包 vxe 引擎（center）自相矛盾。
  - **列 key 兜底改为确定性**：既无 `key` 又无 `prop` 的列此前用 `Math.random()` 生成身份，
    每次 computed 重算都产生新 key，破坏 a-table 的列状态（排序/筛选/列宽）并让快照失稳。
  - 自动 span 计算改回调用 `@es-plus/core` 的 `applyAutoSpan`，消除内联重写。

  **`@es-plus/vue2`**

  - **`validateField` 由 `void` 桥接为 Promise**：element-ui 的 `validateField` 是纯 callback 式，
    而 vue3(Element Plus) / antdv 返回 Promise。此前本端直接透传，导致
    `await form.validateField('name')` **立刻返回、完全不等待校验** —— 三端里唯独 vue2
    无法用 await 拦截字段级校验。现按 EP/ADV 语义桥接（通过 resolve、不通过 reject），
    并对"未匹配到字段"的情况直接放行，避免 Promise 永不 settle 造成调用方挂起。
  - `isFold` / `getBtnColSpan` / isFold 标注改回调用 core 的同名函数（逐行等价，纯去重）。

  **`@es-plus/shared` / `@es-plus/mcp-server`**

  - **`tableBtns` 接受 `position` 并归一化为 `code`**：schema 此前只声明 `code`，而 Zod 默认
    strip 未知键 —— 宿主 LLM 按 `esplus://crud-page-schema` 示例写 `position: 'right'` 时会被
    **静默改写成 `code: 1`（左侧）**：解析成功、零告警，按钮落到错误的一侧。
    现接受 `position`（渲染器契约里的推荐字段，三端 `BtnConfig` 均把 `code` 标为 deprecated）
    并通过 `.transform()` 归一化出与之一致的 `code`，保证下游读 `code` 的路径（生成物 JSON、
    golden 评分器）始终正确。
  - `toolbarBtns` 同样接受 `position`，不再被 strip。
  - **统一 `position` / `code` 的口径**：`esplus://conventions` 资源此前写着
    "Do NOT use a `position` field"，理由为"vue2 会忽略它"——**该理由不成立**（vue2 的
    `es-table/src/table-btns.vue` 与 `es-crud-page.vue` 都经由 core 的 `getButtonPosition`
    优先读取 `position`，已在源码上核实）。
    该错误口径与 `esplus://types`（标注 `code` 已 deprecated）、`esplus://crud-page-schema`
    （示例通篇用 `position`）三方互相矛盾，会把宿主 LLM 推向已废弃字段。三处口径现已统一。
  - NL→ 配置的 system prompt 同步修正按钮定位指引。

  > `tableBtns` 的 `position` 归一化同时被 `scripts/check-schema-contract.mjs` 守卫，
  > 并新增 golden 用例 `24-position-tablebtns.json` 覆盖该路径。

- 2d748f6: 修复表单透传逃生舱在 Vue 3 下静默失效的问题，并实现 item 级校验配置。

  **`props` / `on` 逃生舱（三端拉平）**

  - `props` 此前在 vue3 / adapter-antdv 从未被展开，而 core 的 `FormItemOption` 文档承诺
    「Vue 3 适配器中 `props` 与 `attrs` 会被合并透传」—— 同一份配置在 vue2 生效、在 Vue 3 静默丢弃。
  - `on` 此前为裸展开（`...row.on`）。Vue 3 的 `h()` 要求监听器是 `onXxx` 形式，裸键名会被当作普通
    prop，导致 14 种控件里只有 Upload 的 `on` 能生效。
  - 现在三端统一为：合并 `props` 与 `attrs` 透传，`on` 的事件名转换为 `onXxx`
    （已是 `onXxx` 的键名原样保留）。内部的 `onUpdate:modelValue` 等双向绑定仍然优先。

  **item 级校验（新能力）**

  - 新增 `FormItemOption.required` / `.rules`，注入到底层 form-item 的 `required` / `rules`。
  - 优先级：**`formItemOptions` 中的同名键优先**，`item.required` / `item.rules` 仅在前者未提供时注入
    （低层逃生舱优先，与 `attrs` > `placeholder`/`clearable`/`disabled` 的既有约定同构）。
  - item 级规则与 form 级规则是**叠加**关系（底层组件语义：item 级在前，消息优先）。

  **全局配置修复**

  - `EsPlusGlobalConfig.EsForm.rules` 此前是**死配置** —— 组件从未读取它，配置后静默不生效。
    现在它作为 form 级规则的兜底，与组件 `props.rules` 按字段名浅合并（组件同名键优先）。

  **其它**

  - core 新增导出 `resolveItemValidateProps` / `resolveFormRules`，三端共用同一份优先级实现。
  - 补齐 vue3 / adapter-antdv 的类型：`FormItemOption` 增加 `props` / `required` / `rules` /
    `formItemOptions`，`formtype` 联合补回漏掉的 `'InputNumber'`；`EsTableInstance` 补上运行时
    早已暴露但类型缺失的 `reload` / `doLayout`。
  - 修复 vue2 `EsErrorBoundary` 的模板：其根节点是两个 `<slot>`，违反 Vue 2 单根约束
    （编译器报 `Cannot use <slot> as component root element`），默认插槽为多节点时无法渲染。
    现包一层 `display: contents` 容器，不改变宿主布局。
  - 修复 vue3 vxe 引擎中 `<template v-for>` 的 `key` 放置位置。
  - 新增 vue2 SFC 模板编译守卫测试，防止单根类问题再次潜伏。

### Patch Changes

- db7eb46: 对齐三端表格同构缺陷，并移除从未生效的契约字段。

  **`@es-plus/core`**

  - **移除 `BtnConfig.nameKey`**：该字段自声明起就无任何读取（三端按钮均直接渲染 `name`），
    属「契约声明 ≠ 实际消费」。经评估接线需改约 30 处三端按钮渲染点、收益不成比例，故移除；
    同步更正 `config.ts` 的 `t` 注释与 `adapter-antdv/README.md` 的 i18n 说明
    （此前写作「labelKey / nameKey → text」）。
    说明：纯类型面移除，运行时行为不变（该字段从未生效）。

  **`@es-plus/vue2` / `@es-plus/adapter-antdv`**

  - **并发分页/请求竞态对齐 vue3**：`es-table` 的本地请求函数改为递增请求序号（requestTicket），
    只让最新请求写数据 / 清 `requestError` / 复位 loading；被淘汰请求静默 `resolve(undefined)`，
    不再误报 `request-error`；边界回退的递归请求不被序号机制误杀。
  - **`useTableResize` 运行期快照对齐 vue3**：`heightType` / `tabHeight` 支持 ref/getter，
    运行期修改生效；`heightType` 变化时重挂 ResizeObserver。
  - **（antdv）`useTableSelection` rowkey 运行期读取**：`rowkey` 支持 ref/getter，
    运行期切换后选择按新键判定。

  **本次复核补充修复（对抗式审计发现）**

  - **`dataOptions.disabled` 透传**（vue3 / adapter-antdv）：Select/Radio/Checkbox 选项此前丢弃
    `disabled`，禁用项仍可点；现随选项透传（vue2 本就已支持）。
  - **antdv 嵌套路径支持方括号**：`toAdvNamePath` / `nestDottedRuleKeys` 此前只按 `.` 切分，
    会破坏 schema 明确支持的 `prop: 'a[0].b'`（ADV 读 `model['a[0]']` → 校验必错）。
    改为复用 core 新增的**单源分词器** `parsePathSegments`（与 `getNestedValue/setNestedValue` 同源）。
  - **antdv 透传不得覆盖 v-model**：`rowPassThrough` 现在剔除 `value/checked/targetKeys/fileList`，
    用户经 `props/attrs` 透传的同名值不再覆盖内部 model 绑定（与 vue3 剔除 `modelValue` 同构）。
  - **左栏 / 单行按钮 `triggerEvent` 对齐**（vue3 / adapter-antdv）：此前只有右栏走 `clickBtn`，
    查询/重置在左栏或单行布局下不生效，与 vue2 不一致；现三端统一。
  - **表格请求提前返回不再卡 loading**（三端）：无 url / 无 httpRequest 的 fail 分支补收
    `loadingStatus`，避免上一请求在途时其 `finally` 因序号过期跳过复位而永久转圈。
  - **useTableResize 观察器不再在连续变更时泄漏**（三端）：仅 `heightType` 变化才重挂 observer，
    `tabHeight` 变化只重算；`startObserver` 幂等（先断开旧 observer）。
  - **vue2 `onlyInstance` 延迟销毁加 visible 守卫**：关闭后 300ms 内被重新打开不再误销毁。

  **门禁加固（脚本层，非发布包）**

  - `check-renderer-parity`：去注释后再匹配组件 token（此前把组件名写进注释即可绕过）。
  - `check-contract-consumption`：去注释 + 花括号深度识别字段（此前写死两格缩进、注释也算消费）。
  - 新增 `props` 到 `form-item.schema.json`（此前 MCP/LLM 按 schema 无法发现该逃生舱）。
  - CLI `isSafePathSegment` 拒绝 Windows 会规范化的结尾空格/点（`'.. '` 绕过）。

  **验证**：全量测试全绿；各修复均补回归测试并逐条反向验证。

- 5fa0a46: 修复 TimePicker 范围模式渲染与占位符映射。

  - **范围模式静默降级**：ADV 4.x 的范围时间选择器是独立导出的 `TimeRangePicker`，
    `TimePicker.RangePicker` 已不存在 —— 此前 `TimePicker` 的 range 模式会静默退化为**单选**组件。
    现改为 `isRange ? TimeRangePicker : TimePicker`。
  - **占位符映射对齐 DatePicker**：补 `start-placeholder` / `end-placeholder` → ADV
    `placeholder: [start, end]` 的映射（只配字符串 `placeholder` 时复制为数组），并清理透传给 ADV 的
    EP 专属键（`is-range` / `start-placeholder` / `end-placeholder`）。此前这些配置被当未知 attr 丢弃。

  各修复均补回归测试并反向验证。

- 146d155: 收尾修复审计剩余的三项跨端差异。

  **adapter-antdv**

  - **Upload `limit` → `maxCount`**：此前 `limit` 被静默忽略（ADV 用 `maxCount` 限制文件数），
    超限限制失效；现自动映射。`on-exceed` 在 ADV 无对应事件，改为显式告警而非静默透传无效 prop。
  - **DatePicker/TimePicker 回写统一为原生 `Date`**：未配置 `valueFormat` 时此前回写 dayjs，
    与 vue3/vue2 的 Element 语义（回写 Date）分歧，导致 `model.date.getTime()` 在 antdv 抛错。
    现统一回写 `Date`；配置 `valueFormat` 时仍回写字符串（对齐 EP value-format）。
    **行为变化**：依赖 antdv 侧拿到 dayjs 的代码需改为读 `Date`。

  **三端 `es-table`**

  - **裸数组响应直接作为表格数据**：此前只有 core 的 `formatConfigOut` 有数组直传路径，
    三端表格的本地映射没有，导致「接口直接返回数组」时渲染空表。现三端本地 `formatConfigOut`
    在收到数组时把数组作为 `tableData`、`total` 取长度。

  各修复均补回归测试并反向验证。

- 8d66e9b: 修复源码审计结构性档（`docs/source-audit-report.md` 第七节）中的 P1 缺陷。

  **vue3**

  - **分页/请求竞态**：`es-table` 此前用全局 `loadingStatus` 当互斥锁，在途时直接
    `fail(request already in progress)`；而翻页先改页码再发请求。现改为递增请求序号，
    只让最新请求写数据/清错误，被淘汰的请求静默 `resolve(undefined)`（不再误报 request-error）。
  - **`modelValue` 被透传覆盖**：`rowPassThrough` 现在剔除用户经 `props`/`attrs`/`on`
    透传的 `modelValue` 与 `onUpdate:modelValue`，保持内部双向绑定优先。
  - **运行期配置快照失效**：`useTableResize` 支持 ref/getter 并在 `heightType`/`tabHeight`
    变化时重挂 observer / 重算；`useVirtualSelection` / `useColumnAdapter` 的 `rowkey` 改为
    动态读取（支持 ref）。

  **adapter-antdv**

  - **Transfer**：补 `label→title`、`value→key` 映射，并让 `row.dataOptions` 成为数据源
    （优先级 `dataSource` > `data` > `dataOptions`）。
  - **`props` 参与字段映射**：新增 `mergedRowAttrs`（attrs 优先），使 `props.type`、
    `props['active-value']`、`props.texts/max`、`value-format` 等同名配置不再被忽略；
    保留「`attrs.type` 优先于 `props.type`」的历史回归守卫。
  - **嵌套 prop 校验**：`a-form-item` 的 `name` 改为数组 name path；form 级规则绑定前把
    `'user.name'` 展开为嵌套结构，item 级与 form 级嵌套规则同时生效。

  **vue2**

  - **单行/左栏按钮 `triggerEvent` 失效**：统一走 `clickBtn`，查询/重置按钮在任何布局下都生效。
  - **数组下标赋值非响应式**：远端字段 `dataOptions` 重载改为整体替换数组，视图正确刷新。
  - **use-dialog 延迟销毁竞态**：延迟回调只销毁自己那次创建的实例，关闭后 300ms 内重开不再误销毁新弹窗。

  **验证**：全量 1889 passed（7 包）、7 包 typecheck 全过、lint 0 error、
  `check:consistency` 22 项全绿；各修复均补回归测试并逐条反向验证。

- 2d748f6: 修复源码审计（`docs/source-audit-report.md`）中的 5 条「立即」级缺陷。

  **C1 请求 Promise 永久挂起（core + 三端）**

  - `queryTableListMethod` 此前仅在响应为非空对象/数组时调用 `success`，而非对象响应（204 空响应、
    拦截器 `return undefined`、原始值）既不触发 `success` 也不触发 `fail`，导致
    `httpRequestFormInstance` 的 Promise 永不 settle，`getEveryFormQueryField` 的 `Promise.all`
    整体挂起（远端下拉选项加载不出来且无报错）。现非对象响应归一为 `{}` 后仍调用 `success`。
  - **同类缺陷同时存在于三端表格组件的本地请求函数**：`isObject(res) && Object.keys(res).length`
    守卫会跳过空响应与数组响应，而 `httpRequestInstance` 的 Promise 只在 success/fail 中 settle
    → 表格加载永久挂起。三端一并修复。
    **行为变化**：空 / 非对象响应（如 204、拦截器 `return undefined`）现在会 settle 并被视为空列表
    （清空行、`total` 归 0），此前是 Promise 挂起；数组响应也会 settle，但表格本地映射不含数组直传分支，
    会渲染为空表（如需支持裸数组列表响应，是独立的后续需求）。

  **C2 antdv 代码生成不可编译（shared）**

  - `schema-generator` 的 Vue3/antdv 共用 `<script setup>` 分支此前漏调 `rewriteElementUsage`：
    import 已被映射为 `Modal` / `message`，代码体却仍引用 `ElMessageBox` / `ElMessage`。
    现该分支的删除确认块复用 `buildDeleteConfirmBlock`（antdv 走 `Modal.confirm` 对象式），
    并在返回前统一改写 UI 库命名；`summary` 的 target 文案同步修正（antdv 不再误标 Element Plus）。

  **C3 顶层快捷字段静默丢弃（core + 三端）**

  - `FormItemOption.placeholder` / `clearable` / `disabled` 文档承诺自动注入 `attrs`，但
    `normalizeFormItem` 除 core 自身外零调用，三端全部静默丢弃。现三端 `es-form` 的
    `formItemListFilter` 统一接入 `normalizeFormItem`。
  - `normalizeFormItem` / `normalizeFormItemList` 改为泛型，只约束真正使用的字段
    （新增 `FormItemShortcutSource`）—— 三端各自特化的 `render` / `isHidden` 签名与 core 的
    `FormItemOption` 不兼容，直接收完整类型会导致 antdv / vue2 编译失败。

  **C4 跨页选择列不渲染（shared）**

  - `crud-engine` 自然语言解析误写 `options.selection`（非法键），三端只识别 `options.multiSelect`。
    现改为 `multiSelect`，提示文案同步。

  **C8 CLI 路径穿越（cli + shared）**

  - `name` 此前只约束 `min(1)`，`toPascalCase` 不剥离分隔符，`--from-config` 载入不可信配置时
    可通过 `name: "../../evil"` 把产物写出输出目录。现：契约层对 `StructuredCrudConfigSchema.name`
    增加 refine 拒绝路径分隔符 / `.` / `..` / 盘符；CLI 侧新增 `isSafePathSegment` / `isPathInside`
    守卫（`create` 的 `[name]`、`--from-config` 两条路径，以及 `scaffold` 的 `[name]`），
    并在拼出文件路径后做输出目录越界兜底。

  **测试**

  - 全部修复均补回归测试，并逐条反向验证（临时拆掉修复后测试确实变红）：
    C1（core）、C2、C3（三端）、C4、C8（含 create / scaffold 接线级测试）、三端表格 settle。
  - 新增 `packages/vue2/__tests__/es-table.spec.ts`（此前 vue2 无表格挂载测试）。
  - 全量：core 244 / shared 277 / cli 42 / vue3 450 / vue2 285 / adapter-antdv 499 / mcp-server 59；
    7 包 typecheck 全过；lint 0 error；`check:consistency` 全绿。

- Updated dependencies [db7eb46]
- Updated dependencies [2d748f6]
- Updated dependencies [2d748f6]
  - @es-plus/core@1.2.0

## 1.1.0

### Minor Changes

- 9869180: 补齐 localPagination 客户端分页（对齐 vue3/vue2）；修复弹窗拖拽卸载泄漏、toggleRowSelection 无 rowkey 开发期告警、翻页失败暴露、crud-page 校验拦截。

### Patch Changes

- Updated dependencies [9869180]
  - @es-plus/core@1.1.0
