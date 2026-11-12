# @es-plus/vue3

## 1.9.0

### Minor Changes

- ae61615: 三端渲染器新能力：抽屉弹窗、表单详情/分组/嵌套、列筛选、内置文案单源

  三个渲染器同批落地（同一份配置，三端行为对齐）：

  - **弹窗**：新增 `type: 'drawer'` 抽屉底座；`useDialog` 的调用入参收窄为按 type 判别的
    `DialogCallOptions`（抽屉拒绝 `isDraggable` / `fullscreen` / `hiddenFullBtn` /
    `alignCenter` / `top`，弹窗拒绝 `direction`）。**类型行为变化**：这类误配此前能编译通过、
    运行时静默无效，现在 `tsc` 直接报错；`DialogOptions` 本身仍是扁平全量，配置槽与缓存合并
    不受影响。
  - **表单**：`mode="detail"` 只读详情模式；分组容器 Tabs / Steps / Collapse
    （`formLayout.layout` 与 `dialogs.<id>.formLayout.layout`）；嵌套对象容器（字段 `children`
    一层摊平 + 标题行）；新增 `TreeSelect` / `Autocomplete` 两种 formtype。
  - **表格**：列级 `autoFilters` 从 `dataOptions` 自动派生筛选（`ColumnFilterMode` 三端同规）；
    默认引擎的 `exportData()` 改为内置 CSV 兜底（此前是静默 no-op）；`import` 按钮发出专用
    事件；vxe-only 键在非 vxe 引擎上运行时剥离并告警。
  - **文案与无障碍**：内置按钮文案改走 core 的 `resolveBuiltinText`，支持运行期切换语言；
    三端补齐廉价可访问名（图标按钮、表单标签、表格操作列）。
  - **新增公开类型**：`FormGroupOption` / `FormGroupLayout` / `DialogModalOptions` /
    `DialogDrawerOptions` / `DialogCallOptions` / `ColumnFilterMode` / `TableColumnFilterOption`。
  - 依赖 `@es-plus/core` 的下限同步抬到 `^1.5.0`（上述能力由 core 新增模块提供）。

### Patch Changes

- Updated dependencies [a9ff37c]
- Updated dependencies [ae61615]
  - @es-plus/core@1.5.0

## 1.8.0

### Minor Changes

- 3b30d00: 三端渲染与列合成收口（AI 原生化 AN-06…AN-11）

  - **前导列合成单一真源**：选择列 / 序号列 / 展开列改由 core 的
    `synthesizeLeadingColumns` + `buildLeadingColumns` 生成，顺序统一为
    `selection → index → expand`。此前 8 条列产出路径（三端各自的默认 / 虚拟 / vxe 引擎，
    外加 antdv 的 `adaptColumns`）里，三份 vxe 适配器各写一份 if，两处默认引擎则完全没有
    —— 同一配置切换引擎就少一列，现在收敛到一处。
  - **幂等且不覆盖显式列**：已显式声明同类型列（含 `hidCol`）时不再注入；合成列不参与
    formatter 注入与 `width → minWidth` 转换。
  - **`ellipsis` / `defaultSort` 生效**：`ellipsis` 发射为 `column.showOverflowTooltip`
    （含 vxe 适配），`defaultSort` 三端映射。
  - **`multiSelect` / `snIndex` 运行时接线**：生成配置即可用，不再是「生成器懂、运行时不懂」。
  - **无静默丢弃**：字段/列级 `permissions`、`editConfig` 等此前被吞掉的配置现在要么生效、
    要么显式告警。
  - **antdv 的差异是消费者差异**：选择列由 `rowSelection`、展开列由 `expandedRowRender`
    渲染，二者都不进 `adaptedColumns`；只有序号列是真实列，其默认值改取 core 的
    `LEADING_COLUMN_DEFAULTS.index`，不再各写一份字面量。
  - 回归：三端 mount 测试与 vxe 引擎测试补齐（含「显式 index 不重复」「与选择列共存仍在
    首位」「antdv 序号列取 core 默认」），`check:capability-parity` 对账矩阵 ↔ schema ↔
    运行时消费点。

- b71d8c5: 扁平配置键、默认值层与 fail-closed 权限门（P5 / P5b / P6）

  这一批在 `ai-native-runtime` 之后落地，此前没有任何 changeset 覆盖 —— 本轮补记。

  > **行为变更（需要留意）**：`permission` 门由 fail-open 改为 **fail-closed**。
  > 只有「声明了 `permissionValue` 但宿主没配 `permission()`」这一种错配会从**放行**变成
  > **拒绝并告警**；既没声明门、或门与判定函数都配齐的项目行为不变。见下方 core 段落。

  **`@es-plus/core`**

  - 新增 `checkPermissionValue`：无 `permissionValue` 放行；声明了门且配了 `permission()`
    以函数结果为准；声明了门但宿主漏配判定函数 → **拒绝**，并按权限码告警一次
    （去重）。`filterButtonsByPermission` / `normalizeButtonsHideState` 改为委托它，
    此前"没配就放行"的回退已删除。
  - 新增 `normalizeSectionConfig`（写入时归一）：展平 `EsTable` / `EsForm` / `EsDialog`
    下的 `methods` 嵌套（同名键以 `methods` 内为准）、剥掉 `$httpRequest` 的 `$` 前缀但
    保留原名、把 `configQueryfieldOutput` 改名为 `configQueryFieldOutput`。
  - 新增 `resolveComponentConfig`：两条安装路径（`app.use(EsPlus, { EsTable: {...} })` 与
    `configureEsPlus`）写进「组件能读到的那份配置」的形状原本不同，现在统一为读时视图 ——
    安装之后再调 `configureEsPlus` 才真的能改到组件。
  - `TableOptions` 补上 `mergeConfig: { rowsBy: [...] }`（声明式合并单元格）：它早就被
    antdv 渲染器、schema 与 MCP 提示词消费，却从未在任何一份契约里声明过，用户照着写会撞
    TS2353。
  - `core` ↔ `shared` 同名契约常量加全等守卫，两边不再可能各自漂移。

  **三端渲染器（`@es-plus/vue3` / `@es-plus/vue2` / `@es-plus/adapter-antdv`）**

  - 接入扁平配置键与 **defaults 层**：`options` prop 默认值改为 `{}`，内置默认值移进
    `tableOptions` computed（`{ ...内置默认, ...全局 defaults, ...props.options }`）。
    此前每个键都算「显式传入」，**全局默认值永远赢不了内置值**；现在实例 > 全局 > 内置。
    模板与脚本统一读 `tableOptions`（vue3 约 40 处）。
  - `provide` 从安装时的快照改为读时视图（`createGlobalConfigView` /
    `createComponentConfigView`），`install` 之后调 `configureEsPlus` 才生效。
  - 三端 12 处本地 `checkPermission` / `hasPermission` 实现全部替换为 core 的单一真源。
  - `dataOptions` 形状三端统一：放行 `children` / `tagType`，前门校验通过的配置不再被
    本库自己的类型判红；新增逐键对账守卫。
  - `es-crud-page` 的 `formLayout.labelWidth` 落到**字段**（此前误取
    `layout.labelBtnWidth`，只改了空按钮行，查询字段标签宽度不变）；按钮行专用键保持独立。
  - `operationColumn.fixed` 不再用 `|| 'right'` 把显式 `fixed: false` 顶成右固定。
  - antdv 权限位与分页 `layout` 与 vue3 对齐。

### Patch Changes

- Updated dependencies [3b30d00]
- Updated dependencies [b71d8c5]
  - @es-plus/core@1.4.0

## 1.7.0

### Minor Changes

- 4541d3e: 移除 `DialogOptions.onSubmit` —— 该选项从未生效，请改用 `configBtn[].click`。

  **这不是「删功能」，是承认该 API 不存在。** 三端没有任何一个 dialog 组件 emit `submit`：
  vue3 声明了事件并写了一个**零引用**的 `handleConfirm`（唯一会 emit `submit` 的地方）；vue2 把
  `'submit'` 列进了 `emits` 却从不 emit；antdv 连声明都没有。而三端 `useDialog` 合计 17 处在包装
  `onSubmit`、4 个类型文件声明了它 —— 除最后一步外整条链都接好了，唯独没有触发点。

  因此升级后：

  - **运行时行为完全不变** —— 传 `onSubmit` 的代码本来就不会被调用（弹窗底部按钮只在 `configBtn`
    非空时渲染，写了 `onSubmit` 的调用其实一个按钮都没有）；
  - **类型上会看到错误** —— `DialogOptions` 不再有该字段，这是本次唯一的破坏性变更，故记 minor。

  迁移方式（把确认逻辑挂到按钮自己的 `click` 上）：

  ```ts
  dialog({
    render: (h) =>
      h(EsForm, {
        /* … */
      }),
    configBtn: [
      { name: "取消", click: (_, { close }) => close() },
      {
        name: "确定",
        type: "primary",
        click: (_, { close, getRefs }) => {
          getRefs("form")
            ?.validate()
            .then(() => close());
        },
      },
    ],
  });
  ```

  一并删除：三端 `useDialog` 里的 17 处包装、vue3 的 `submit` 事件声明与死代码 `handleConfirm`、
  vue2 `emits` 里的 `'submit'`、`dialog-options.schema.json` 里的 `onSubmit`（已同步三份副本）、
  `get_component_api` 中「exposed by the type but the runtime never wires it up」那条说明。

  文档站的 4 处示例与 API 表已迁移到上述写法（迁移前这些「点击确定」的示例其实点不动，因为压根
  没有按钮）。

### Patch Changes

- Updated dependencies [4541d3e]
  - @es-plus/core@1.3.0

## 1.6.0

### Minor Changes

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

## 1.5.0

### Minor Changes

- 9869180: 修复 crud-page 确定按钮校验/onConfirm rejection 冒泡为 unhandled rejection、httpRequest 未传 :pagination 时加载后自动显示分页器、请求失败统一暴露；对齐三端暴露 API。

### Patch Changes

- Updated dependencies [9869180]
  - @es-plus/core@1.1.0

## 1.4.1 — Virtual table horizontal scroll fix

### Fixed

- **`EsTable` with `options.virtual: true` now horizontally scrolls when the
  column total exceeds the viewport.** Previously the underlying `el-table-v2`
  was instantiated without the (mis-named) `fixed` prop, which gates Element
  Plus's `bodyWidth = max(columnsTotalWidth, viewport)` computation —
  without it, `bodyWidth` was hard-pinned to viewport width and horizontal
  overflow could never occur, regardless of how wide the columns were
  configured. Affected every virtual-table demo in the docs site and every
  user-side virtual table with `fixed: 'right'` columns (the right-anchored
  column would render detached from the table body at viewport sizes
  smaller than the column total).

- **Horizontal scrollbar is now always visible when overflow exists** via
  `:scrollbar-always-on="true"` on `el-table-v2`. Previously the scrollbar
  auto-hid behind a CSS `opacity: 0` rule, with the `.always-on` class
  needed to make it visible — and even when scrollable, mouse wheel doesn't
  drive horizontal scroll, so users had no discoverable way to scroll.

### Notes

This is a pure bug fix — no API change. Users on `^1.4.0` get the fix
automatically. The combined behavior shift is:

- BEFORE: virtual tables silently couldn't horizontally scroll; fixed-right
  columns visually detached on overflow.
- AFTER: virtual tables horizontally scroll when overflow exists; fixed
  columns anchor correctly; scrollbar is always discoverable.

No source changes outside `components/es-table/src/engines/virtual-engine.vue`.
