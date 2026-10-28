---
title: 'EsErrorBoundary 错误边界'
route: '/components/es-error-boundary'
canonical: 'https://liujiaao.github.io/es-plus/#/components/es-error-boundary'
source: 'es-plus-docs/src/views/component-doc.data.ts'
type: 'component'
---

# EsErrorBoundary 错误边界

> 组件级错误围栏：子树在渲染 / 生命周期 / 侦听器里出错时只降级这一块，通过 error 事件上报、reset() 原地恢复 —— 一个坏组件不会拖垮整页。

## 能力

- **故障隔离** —— 只降级出错的子树，边界外照常交互
- **降级 UI 可定制** —— fallback 插槽拿到 error / reset；零配置时用 fallbackText
- **错误上报** —— error 事件带 (err, info)，可直接接埋点与日志
- **原地恢复** —— reset() 清除错误态，修好数据即重新挂载子树

## 示例

- 故障注入台：一处坏掉，整页还在 —— 两个会抛错的子组件分别走「自定义 fallback + reset」与「只给 fallback-text + ref.reset()」两条恢复路径；error 事件实时落到日志，边界外的按钮全程可点 —— 隔离是能被操作验证的。

## API

### props

| 名称 | 类型 | 默认值 | 说明 |
| --- | --- | --- | --- |
| fallbackText | string | '' | 默认降级文案；未提供 fallback 插槽时显示 |

### slots

| 名称 | 参数 | 说明 |
| --- | --- | --- |
| default | - | 正常渲染的子树：其渲染 / 生命周期 / 侦听器错误会被本边界捕获 |
| fallback | { error, reset } | 捕获错误后替代渲染；error 为原始错误，reset() 清除错误态（须先修好数据） |

### events

| 名称 | 参数 | 说明 |
| --- | --- | --- |
| error | (err, info) | 捕获到子树错误时触发；info 是出错钩子名（如 render function）。边界返回 false，错误不再冒泡到 app.config.errorHandler |

### methods

| 名称 | 参数 | 说明 |
| --- | --- | --- |
| reset | - | 清除错误态并重新挂载子树；若导致错误的数据没修好，会立刻再次降级 |


## 主题（CSS 变量）

> 这个组件是唯一没有接主题变量的一个：降级块的颜色写死成 #cf1322 / #fff2f0 / #ffccc7（antd 的红），深色站点需要自己覆盖 .es-error-boundary 的三条背景与文字色。写在这里而不是藏着，是因为「没做」也是 API 的一部分。

颜色写死，没有开放变量 —— 宿主需自行覆盖。

## 可访问性

- 降级块根节点是 role="alert"：出错瞬间读屏立即播报，不需要用户移动到它上面才发现内容变了（证据：`packages/vue3/src/components/es-error-boundary/src/es-error-boundary.vue` 含 `role="alert"`）
- reset() 通过 defineExpose 暴露：宿主从模板 ref 调用即可原地恢复，不用整页刷新（刷新会丢掉用户已填的表单）（证据：`packages/vue3/src/components/es-error-boundary/src/es-error-boundary.vue` 含 `defineExpose`）
- 捕获本身用 onErrorCaptured 并返回 false：错误被真正围栏在本边界内，不会再冒泡到 app.config.errorHandler（证据：`packages/vue3/src/components/es-error-boundary/src/es-error-boundary.vue` 含 `onErrorCaptured`）

## 相关

- **es-crud-page**（/components/es-crud-page）—— 自定义 dialogs[].render 里的业务代码出错时，用边界围住弹窗内容，页面其余部分照常可用
- **es-table**（/components/es-table）—— EsTable 的单元格 render 自带 try/catch（只兜单格），本边界兜子树的生命周期 / 渲染错误 —— 两者互补，不是重复

## 版本

| 端 | 首个包含本组件的版本 |
| --- | --- |
| vue3 | 1.5.0 |
| vue2 | 1.2.0 |
| antdv | 1.1.0 |
