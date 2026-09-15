# @es-plus/core

## 1.2.0

### Minor Changes

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

## 1.1.0

### Minor Changes

- 9869180: 新增 InputNumber 控件、全局 httpRequest、三端分页请求判定去重；提供 CJS 双格式构建修复 .umd.cjs require 崩溃；BoundaryRollbackInput 类型放宽。
