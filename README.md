# ES-Plus

基于 Vue 3 + Element Plus 的企业级中后台 CRUD 组件库 — 配置化驱动表单、表格、弹窗全链路联动

中文 | [English](./README.en.md)

[![npm version](https://img.shields.io/npm/v/es-plus-ui.svg)](https://www.npmjs.com/package/es-plus-ui)
[![npm downloads](https://img.shields.io/npm/dm/es-plus-ui.svg)](https://www.npmjs.com/package/es-plus-ui)
[![license](https://img.shields.io/npm/l/es-plus-ui.svg)](https://www.npmjs.com/package/es-plus-ui)
[![github stars](https://img.shields.io/github/stars/liujiaao/es-plus?style=social)](https://github.com/liujiaao/es-plus)

**[在线文档](https://liujiaao.github.io/es-plus/)** · **[Playground](https://liujiaao.github.io/es-plus/#/playground)** · **[更新日志](https://github.com/liujiaao/es-plus/releases)**

## 核心特性

- **配置化开发** — JSON 配置生成复杂表单与表格，替代大量模板代码
- **表单↔表格↔弹窗联动** — 查询/重置/分页全自动，零事件代码
- **编程式弹窗** — `useDialog` Hook 命令式调用，支持 JSX 渲染、嵌套弹窗
- **自适应高度** — `ResizeObserver` 自动重算表格高度
- **跨页选择** — `rowkey` + `cachePageSelection` 解决分页选择丢失
- **任意后端适配** — `configTableOut` + `qrcb` 配置化适配不同后端响应格式
- **TypeScript** — 完整类型定义

## 快速安装

```bash
npm install es-plus-ui element-plus @element-plus/icons-vue
```

## 快速上手

```typescript
import { createApp } from 'vue'
import ElementPlus from 'element-plus'
import 'element-plus/dist/index.css'
import ESPlus from 'es-plus-ui'
import 'es-plus-ui/dist/style.css'
import App from './App.vue'

const app = createApp(App)
app.use(ElementPlus)
app.use(ESPlus)
app.mount('#app')
```

## 最小示例

```vue
<template>
  <es-table
    :columns="columns"
    :options="options"
    v-model:data-source="tableData"
    v-model:pagination="pagination"
  >
    <es-form :model="form" :form-item-list="formItems" :config-btn="btns" />
  </es-table>
</template>

<script setup>
import { reactive, ref } from 'vue'

const form = reactive({ keyword: '' })
const tableData = ref([])
const pagination = ref({ current: 1, pageSize: 10, total: 0 })

const formItems = [
  { prop: 'keyword', label: '关键词', formtype: 'Input', span: 6 }
]
const btns = [
  { name: '查询', type: 'primary', key: 'query', triggerEvent: true },
  { name: '重置', key: 'reset', triggerEvent: true }
]
const columns = [
  { prop: 'name', label: '姓名' },
  { prop: 'status', label: '状态' }
]
const options = {
  border: true,
  httpRequest: async (params) => { /* 调用后端 API */ }
}
</script>
```

> 表单嵌套在表格内，查询/重置/分页全自动联动，无需手动编写事件处理。

## 组件总览

| 组件 | 说明 |
|------|------|
| **EsForm** | 配置化表单 — 13 种输入类型，动态显隐，异步数据加载，折叠展开 |
| **EsTable** | 配置化表格 — 远程数据，跨页选择，自适应高度，多级表头 |
| **useDialog** | 编程式弹窗 — JSX 渲染，表单集成，嵌套弹窗 |
| **EsDialog** | 增强弹窗 — 拖拽，全屏切换，自定义渲染 |
| **SvgIcon** | SVG 图标组件 |

完整 API 文档见 [packages/es-plus/README.md](packages/es-plus/README.md)

## 项目结构

```
es-plus/
├── packages/es-plus/     # 组件库源码（npm: es-plus-ui）
├── es-plus-docs/         # 文档站点（Vite + Vue 3）
└── es-eui/               # Vue 2 + Element UI 版本
```

## 开发

```bash
# 组件库构建
cd packages/es-plus && npm install && npm run build

# 文档站点开发
cd es-plus-docs && npm install && npm run dev
```

## 相关项目

- [es-eui](https://github.com/liujiaao/es-eui) — Vue 2 + Element UI 版本

## 贡献

欢迎提交 Issue 和 Pull Request！

1. Fork 本仓库
2. 创建功能分支：`git checkout -b feature/your-feature`
3. 提交更改：`git commit -m 'feat: add your feature'`
4. 推送分支：`git push origin feature/your-feature`
5. 提交 Pull Request

## License

[MIT](LICENSE)
