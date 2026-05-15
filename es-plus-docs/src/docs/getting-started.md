# 快速开始

## 简介

ES-Plus 是一套基于 Vue 3 和 Element Plus 的企业级中后台前端组件库，提供配置化、联动化、抽象化的组件设计。

## 特性

- 🚀 **配置化** - 通过 JSON 配置生成表单和表格
- 🔗 **联动化** - 支持字段间联动和数据交互
- 🎯 **抽象化** - 封装常用业务逻辑，简化开发
- 📦 **TypeScript** - 完整的类型支持

## 安装

```bash
# npm
npm install element-plus @element-plus/icons-vue

# yarn
yarn add element-plus @element-plus/icons-vue

# pnpm
pnpm add element-plus @element-plus/icons-vue
```

## 使用

### 完整引入

```typescript
import { createApp } from 'vue'
import ElementPlus from 'element-plus'
import 'element-plus/dist/index.css'
import App from './App.vue'

const app = createApp(App)
app.use(ElementPlus)
app.mount('#app')
```

### 按需引入

```typescript
import { ElButton, ElInput } from 'element-plus'

app.component(ElButton.name, ElButton)
app.component(ElInput.name, ElInput)
```

## 下一步

- [EsForm 高级表单](/components/es-form)
- [EsTable 高级表格](/components/es-table)
- [useDialog 弹窗](/advanced/use-dialog)
