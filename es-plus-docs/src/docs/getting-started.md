# 快速开始

ES-Plus 是基于 Vue 3 和 Element Plus 的企业级中后台组件库，通过配置化方式将常见 CRUD 页面代码量减少 70%。

## 安装

```bash
npm install es-plus-ui element-plus @element-plus/icons-vue
```

## 注册插件

### 全量引入

在入口文件中注册 ES-Plus，所有组件将全局可用：

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

### 按需自动导入

如果项目使用 `unplugin-vue-components` 按需导入 Element Plus，需在 `vite.config.ts` 中添加 `EsPlusResolver`：

```typescript
// vite.config.ts
import Components from 'unplugin-vue-components/vite'
import { ElementPlusResolver } from 'unplugin-vue-components/resolvers'
import { EsPlusResolver } from 'es-plus-ui/resolver'

export default defineConfig({
  plugins: [
    Components({
      resolvers: [ElementPlusResolver(), EsPlusResolver()]
    })
  ]
})
```

:::tip
`EsPlusResolver` 会自动注入 es-plus 内部依赖的 Element Plus 组件样式，无需手动 `import 'element-plus/dist/index.css'`。详见 [安装文档 - 自动导入](/guide/installation)。
:::

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

## 第一个弹窗

编程式调用，告别模板声明：

```typescript
import { useDialog } from 'es-plus-ui'

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
- [EsForm 文档](/components/es-form) — 表单完整 API 与高级用法
- [EsTable 文档](/components/es-table) — 表格完整 API 与数据联动
- [useDialog 文档](/advanced/use-dialog) — 弹窗高级功能
