---
title: 'SvgIcon 图标'
route: '/components/svg-icon'
canonical: 'https://liujiaao.github.io/es-plus/components/svg-icon/'
source: 'es-plus-docs/src/views/component-doc.data.ts'
type: 'component'
---

# SvgIcon 图标

> 统一的图标出口：雪碧图符号按 currentColor 着色、尺寸随字号，也能直接吃 http(s) 外部图片 —— 业务里不必再各写一套 <svg><use>。

## 能力

- **雪碧图符号** —— iconClass 自动拼成 #icon-xxx，引用页面注入的 <symbol>
- **随主题着色** —— fill: currentColor，放进按钮/标签自动跟随颜色与禁用态
- **尺寸即字号** —— 宽高都是 1em，字号多大图标就多大，无需尺寸 prop
- **外部图片** —— 协议开头（http(s)/mailto/tel/open）自动切到外部图片模式

## 示例

- 一个图标出口：尺寸 / 着色 / 类名 / 外部图片 —— 内联一份雪碧图即可跑：字号控制尺寸、color 控制颜色、className 追加装饰样式，最后的协议地址切到外部图片模式。组件只输出那一个 1em 的图标，其余全部交给宿主。

## API

### props

| 名称 | 类型 | 默认值 | 说明 |
| --- | --- | --- | --- |
| iconClass | string | 必填 | 图标名。非协议开头 → 渲染 <svg><use href="#icon-{iconClass}">；以 http(s)/mailto/tel/open 开头 → 外部图片模式 |
| className | string | '' | 追加到根节点的类名，装饰性样式不必改组件 |


## 主题（CSS 变量）

> 没有 CSS 变量的必要：图标 fill / background-color 都是 currentColor，颜色由外层的 color 决定 —— 放进主按钮就是主色、放进禁用按钮自动变灰，宿主不需要为图标单独配一套颜色变量。

继承：currentColor（外层元素的 color）

## 可访问性

- 装饰性图标默认 aria-hidden="true"：读屏会跳过它，不会在朗读按钮文案前后多念一句「图形」（证据：`packages/vue3/src/components/svg-icon/src/svg-icon.vue` 含 `aria-hidden`）
- 颜色跟随 currentColor：禁用 / hover 等状态的灰阶由父元素的 color 传递，图标不必自己感知状态，也就不会出现「按钮灰了图标还亮着」（证据：`packages/vue3/src/components/svg-icon/src/svg-icon.vue` 含 `currentColor`）
- 边界：组件没有 name / title 属性，也不渲染 aria-label —— 图标本身不带可访问名称。承载语义时请把可访问名称写在承载它的 <button>/<a> 上，并把图标留作装饰（证据：`packages/vue3/src/components/svg-icon/src/svg-icon.vue` 含 `aria-hidden`）

## 相关

- **es-table**（/components/es-table）—— 工具栏与行操作按钮里的图标：放进去自动跟随按钮颜色，不必传尺寸

## 版本

| 端 | 首个包含本组件的版本 |
| --- | --- |
| vue3 | 1.4.0 |
| vue2 | 1.2.0 |
| antdv | 1.0.0 |
