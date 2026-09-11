---
"@es-plus/core": minor
"@es-plus/vue3": minor
"@es-plus/vue2": minor
"@es-plus/adapter-antdv": minor
---

修复表单透传逃生舱在 Vue 3 下静默失效的问题，并实现 item 级校验配置。

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
