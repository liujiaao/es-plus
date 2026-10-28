---
title: 'useDialog 高级弹窗'
route: '/advanced/use-dialog'
canonical: 'https://liujiaao.github.io/es-plus/#/advanced/use-dialog'
source: 'es-plus-docs/src/views/advanced-doc.data.ts'
type: 'advanced'
---

# useDialog 高级弹窗

> 基于 Vue 3 的编程式弹窗 Hook，支持 JSX 渲染、表单集成、嵌套弹窗等高级功能。

## 能力

- **编程式调用** —— 通过函数调用打开弹窗，无需模板声明
- **JSX 渲染** —— 支持使用 render 函数自定义弹窗内容
- **表单集成** —— 与 EsForm 无缝集成
- **嵌套支持** —— 支持弹窗嵌套，自动管理层级

## 示例

- 弹窗基础与内容变体 —— 三种最小调用：纯提示、多段内容、maxHeight 限高内部滚动。
- 表单弹窗 —— 弹窗中使用 EsForm，支持表单验证与提交闭环。
- 确认弹窗：三档语气 + 关闭拦截 —— 图标与按钮 type 同步语气：危险删除（danger）、警告发布（warning）、中立退出（primary）；beforeClose 让点 X 前先确认是否丢弃改动。
- 嵌套弹窗 —— 独立 useDialog 实例，支持父子弹窗通信与层级管理。
- 弹窗定制与实例缓存 —— 可拖拽、自定义头尾、全屏、maxHeight 限高，以及 cacheKey 缓存实例：关闭再打开，内容还在。
- 异步组件弹窗 —— defineAsyncComponent 实现弹窗内容延迟加载。
- 详情预览弹窗 —— ElDescriptions 配置化详情展示，isHiddenFooter 无按钮模式，动态渲染不同业务对象。
- 弹窗内嵌表格 —— 弹窗中放置 EsTable + multiSelect 多选 + registerRef 获取表格实例读取选中行。
- 分步向导弹窗 —— ElSteps + 多步骤 EsForm 切换，每步独立校验；renderFooter 按当前步骤动态渲染上一步/下一步/提交。
- 动态按钮状态弹窗 —— 审批场景：Radio 切换操作类型，按钮 disabled 函数式动态禁用，条件校验。
- 多实例独立弹窗 —— onlyInstance: true 模式：每次调用创建独立容器，可同时打开多个弹窗，各自拖拽互不影响。
- 表单+表格+弹窗闭环 —— 弹窗内 EsTable 展示数据 + 操作列 btns 触发编辑弹窗 + configBtn 新增弹窗，两级弹窗嵌套 CRUD。

## API

### DialogOptions

| 名称 | 类型 | 说明 |
| --- | --- | --- |
| title | string | 弹窗标题 |
| width | string \| number | 弹窗宽度，默认 "50%" |
| visible | boolean | 显示状态。useDialog 未显式传入时补 true；缓存实例的开关也靠翻转它 |
| loading | boolean | 内容加载态：true 时在弹窗主体显示 loading 遮罩，默认 false |
| render | (h, instance, components) => VNode | 内容渲染函数；h 为 Vue createVNode，instance 为弹窗实例，components 包含所有注册的 el-icon 图标 |
| renderHeader | (h, instance) => VNode | 头部渲染函数（覆盖默认标题区） |
| renderFooter | (h, instance) => VNode | 底部渲染函数（覆盖默认按钮区） |
| configBtn | BtnConfig[] | 底部按钮配置（同 EsForm BtnConfig，click 回调见下表） |
| isDraggable | boolean | 是否可拖拽，默认 false |
| fullscreen | boolean | 是否全屏，默认 false |
| hiddenFullBtn | boolean | 隐藏右上角全屏切换按钮 |
| isHiddenFooter | boolean | 隐藏底部按钮区，默认 false |
| maxHeight | string \| number | 内容区最大高度（超出滚动） |
| appendTo | string \| HTMLElement | 弹窗挂载的目标容器，默认 document.body；可传 CSS 选择器或 DOM 元素 |
| closeOnClickModal | boolean | 点击遮罩是否关闭，默认 true（继承 el-dialog 默认值） |
| closeOnPressEscape | boolean | 按 ESC 是否关闭，默认 true（继承 el-dialog 默认值） |
| beforeClose | (done: () => void) => void | 关闭前拦截回调，必须调用 done() 才真正关闭；可用于二次确认 |
| destroyOnClose | boolean | 关闭时销毁内容区，下次打开重新渲染，默认 true（useDialog 已注入） |
| modal | boolean | 是否显示遮罩层，默认 true |
| alignCenter | boolean | 是否垂直居中，默认 false |
| top | string | 弹窗距顶部的距离（仅非居中时生效），默认 "15vh" |
| modalClass | string | 遮罩层的自定义类名 |
| showClose | boolean | 是否显示关闭按钮，默认 true；传 false 彻底隐藏（内置头部自绘的与自定义头部时原生的都隐藏） |
| onClosed | () => void | 弹窗完全关闭后的回调（过渡动画结束时触发） |

### configBtn click 回调

| 名称 | 类型 | 说明 |
| --- | --- | --- |
| click(instance, ctx) | (instance, { close, getRefs, dialogVm }) => void | BtnConfig 的 click 回调，instance 为弹窗 Vue 实例 |
| ctx.close() | Function | 关闭当前弹窗 |
| ctx.getRefs(name) | (name: string) => any | 获取 registerRef 注册的引用（如内嵌 EsForm 实例） |
| ctx.dialogVm | ComponentInstance | 弹窗组件实例 |

### useDialog 参数

| 名称 | 类型 | 说明 |
| --- | --- | --- |
| Component | Component (可选) | 自定义弹窗内容组件，不传则使用内置 EsDialog；传入 DialogOptions.render 可替代 |
| opt.onlyInstance | boolean | true：每次调用新建一个弹窗实例（多实例并发）；false（默认）：复用同一实例（更新 props） |
| opt.cacheKey | string | 实例缓存键：同名 cacheKey 的弹窗关闭后不卸载（TTL 延迟回收），下次打开复用并保留内部状态；同时是 destroy(cacheKey) 的寻址键 |
| opt.(其余 DialogOptions 字段) | DialogOptions | title / width / render / configBtn / isDraggable / fullscreen / beforeClose 等原样下发到弹窗组件 |
