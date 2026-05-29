# 快速开始

ES-Plus 是企业级中后台组件库，通过配置化方式将常见 CRUD 页面代码量减少 70%。提供两套渲染层：

- **`@es-plus/vue3`** — Vue 3 + Element Plus（活跃开发）
- **`@es-plus/vue2`** — Vue 2 + Element UI（同 schema 兼容版本）

两个包共用同一份 `columns` / `formItemList` / `options` JSON 配置。本指南以 Vue 3 为主示例，Vue 2 用法详见 [Vue 2 指南](/guide/vue2)。

:::tip v1.4.0 包名重命名
v1.4.0 起，原 `es-plus-ui` 已重命名为 **`@es-plus/vue3`**。旧包仍可通过 stub 正常使用，但已被 `npm deprecate` 标记。详见 [迁移指南](/guide/migration)。
:::

## 安装

```bash
npm install @es-plus/vue3 element-plus @element-plus/icons-vue
```

## 注册插件

在入口文件中注册 ES-Plus，所有组件将全局可用：

```typescript
import { createApp } from 'vue'
import ElementPlus from 'element-plus'
import ESPlus from '@es-plus/vue3'
import '@es-plus/vue3/dist/style.css'
import 'element-plus/dist/index.css'

import App from './App.vue'

const app = createApp(App)
app.use(ElementPlus)
app.use(ESPlus)
app.mount('#app')
```

## 第一个表单

用 JSON 配置替代逐行编写 `el-form-item`：

```vue
<template>
  <es-form
    :model="form"
    :form-item-list="formItems"
    :config-btn="btns"
    @confirm="handleConfirm"
  />
</template>

<script setup>
import { reactive } from 'vue'

const form = reactive({ name: '', status: '' })

const formItems = [
  { prop: 'name', label: '姓名', formtype: 'Input', span: 12 },
  { prop: 'status', label: '状态', formtype: 'Select', span: 12,
    dataOptions: [
      { label: '启用', value: 1 },
      { label: '禁用', value: 0 }
    ] }
]

const btns = [
  { name: '查询', type: 'primary', key: 'query', triggerEvent: true },
  { name: '重置', key: 'rest', triggerEvent: true }
]

const handleConfirm = ({ key, model }) => {
  console.log(key, model) // 'query' { name: '...', status: 1 }
}
</script>
```

对比传统写法，同样功能少写 **70%** 代码：

| 传统 Element Plus | ES-Plus |
|---|---|
| 每个字段 5-8 行 `<el-form-item>` + `<el-input>` | 一行配置 `{ prop, label, formtype }` |
| 手动 `v-model` 绑定每个字段 | 自动绑定到 `model` |
| 手动 `@click` + `resetFields()` | `triggerEvent: true` 自动处理 |

### 在线试一下

<demo name="form-basic" />

## 第一个表格

配置化列定义 + 自动分页 + 请求联动：

```vue
<template>
  <es-table
    :columns="columns"
    :options="options"
    v-model:data-source="tableData"
    v-model:pagination="pagination"
  >
    <es-form
      :model="form"
      :form-item-list="formItems"
      :config-btn="btns"
    />
  </es-table>
</template>

<script setup>
import { reactive, ref } from 'vue'

const form = reactive({ name: '' })
const tableData = ref([])
const pagination = ref({ current: 1, pageSize: 10, total: 0 })

const formItems = [
  { prop: 'name', label: '姓名', formtype: 'Input', span: 6 }
]
const btns = [
  { name: '查询', type: 'primary', key: 'query', triggerEvent: true },
  { name: '重置', key: 'rest', triggerEvent: true }
]

const columns = [
  { prop: 'name', label: '姓名' },
  { prop: 'age', label: '年龄' }
]

const options = {
  border: true,
  httpRequest: async ({ page }) => {
    const res = await fetch(`/api/list?page=${page.current}&size=${page.pageSize}`)
    return res.json()
  }
}
</script>
```

`EsForm` 嵌套在 `EsTable` 内时，查询/重置/分页全自动联动，无需手动编写事件处理。

### 在线试一下

<demo name="table-basic" />

## 第一个弹窗

编程式调用，告别模板声明：

```typescript
import { useDialog } from '@es-plus/vue3'

const dialog = useDialog()

function openEditDialog(row) {
  dialog({
    title: '编辑',
    width: '500px',
    render: () => h('p', `编辑用户: ${row.name}`),
    configBtn: [
      { name: '取消', click: (_, { close }) => close() },
      { name: '确定', type: 'primary', click: (_, { close }) => {
        // 处理提交逻辑
        close()
      } }
    ]
  })
}
```

无需在模板中声明 `<el-dialog>`，无需手动管理 `visible` 状态。

## 下一步

- [安装](/guide/installation) — 详细安装与环境要求
- [使用](/guide/usage) — 全局配置、按需引入、TypeScript 支持
- [Vue 2 指南](/guide/vue2) — Vue 2 + Element UI 渲染层用法
- [迁移指南](/guide/migration) — 从 `es-plus-ui` / 原生 Element Plus 迁移
- [EsForm 文档](/components/es-form) — 表单完整 API 与高级用法
- [EsTable 文档](/components/es-table) — 表格完整 API 与数据联动
- [useDialog 文档](/advanced/use-dialog) — 弹窗高级功能
