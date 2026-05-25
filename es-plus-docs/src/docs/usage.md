# 使用

## 引入方式

ES-Plus 支持两种引入方式，根据你的项目配置选择其一：

### 方式一：全量引入（简单直接）

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

### 方式二：自动按需导入（推荐，需配合 unplugin）

如果项目使用 `unplugin-vue-components` + `ElementPlusResolver` 做按需自动导入，**必须额外配置 `EsPlusResolver`**：

```typescript
// vite.config.ts
import { defineConfig } from 'vite'
import vue from '@vitejs/plugin-vue'
import AutoImport from 'unplugin-auto-import/vite'
import Components from 'unplugin-vue-components/vite'
import { ElementPlusResolver } from 'unplugin-vue-components/resolvers'
import { EsPlusResolver } from 'es-plus-ui/resolver'

export default defineConfig({
  plugins: [
    vue(),
    AutoImport({
      resolvers: [ElementPlusResolver()]
    }),
    Components({
      resolvers: [
        ElementPlusResolver(),
        EsPlusResolver()
      ]
    })
  ]
})
```

```typescript
// main.ts — 按需模式下只需注册 ESPlus 插件，无需手动引入样式
import { createApp } from 'vue'
import ESPlus from 'es-plus-ui'
import App from './App.vue'

const app = createApp(App)
app.use(ESPlus)
app.mount('#app')
```

:::warning 为什么需要 EsPlusResolver？
`ElementPlusResolver` 只扫描你自己 `.vue` 模板中的 `<el-xxx>` 标签。es-plus 是预编译的第三方包，它内部使用的 `<el-table>`、`<el-form>` 等组件存在于已编译的 JS 中，resolver 扫描不到它们，导致 Element Plus 样式缺失（表格无边框、表单无布局等）。

`EsPlusResolver` 在检测到 `<es-table>`、`<es-form>` 等组件时，自动注入 es-plus 自身样式和其内部依赖的全部 Element Plus 组件样式。
:::

### EsPlusResolver 配置项

| 选项 | 类型 | 默认值 | 说明 |
|------|------|--------|------|
| `importElementStyles` | `boolean` | `true` | 是否自动注入 EP 组件样式。已全量引入时可设为 `false` |
| `importStyle` | `'css' \| 'sass'` | `'css'` | 样式格式。自定义主题时用 `'sass'` |

```typescript
// 示例：已全量引入 EP 样式，只需 es-plus 自身样式
EsPlusResolver({ importElementStyles: false })

// 示例：配合 Element Plus 主题定制
EsPlusResolver({ importStyle: 'sass' })
```

---

## 全局配置

通过 `app.use(ESPlus, options)` 可以全局配置各组件的默认行为，避免在每个组件中重复传入相同的配置。

```typescript
import { createApp } from 'vue'
import ElementPlus from 'element-plus'
import ESPlus from 'es-plus-ui'
import 'es-plus-ui/dist/style.css'
import 'element-plus/dist/index.css'
import App from './App.vue'

const app = createApp(App)
app.use(ElementPlus)
app.use(ESPlus, {
  EsTable: {
    methods: {
      // 全局请求方法 — 所有 EsTable 共享，无需逐个传入 httpRequest
      $httpRequest: async ({ url, formParams }) => {
        const res = await fetch(url, { method: 'POST', body: JSON.stringify(formParams) })
        return res.json()
      },
      // 分页布局配置
      paginationLayout: () => ({
        layout: 'total, sizes, prev, pager, next, jumper',
        pageSizes: [10, 20, 50, 100],
        isSmall: true,
        background: true
      }),
      // 接口字段映射 — 适配后端返回格式
      configQueryFieldOutput: () => ({
        total: 'total',
        pageSize: 'pageSize',
        current: 'pageIndex',
        tableData: 'data'
      })
    }
  },
  EsForm: {
    methods: {
      // 全局请求方法 — 用于表单的异步数据源加载
      $httpRequest: async ({ url, formParams }) => {
        const res = await fetch(url, { method: 'POST', body: JSON.stringify(formParams) })
        return res.json()
      },
      // 表单查询字段映射
      fieldFieldOutput: () => ({
        total: 'total',
        pageSize: 'pageSize',
        current: 'pageIndex',
        listData: 'data'
      })
    }
  }
})
app.mount('#app')
```

### 配置项说明

| 配置 | 组件 | 说明 |
|---|---|---|
| `$httpRequest` | EsTable / EsForm | 全局 HTTP 请求方法，组件内可被 prop 覆盖 |
| `paginationLayout` | EsTable | 分页器布局配置（layout、pageSizes、isSmall、background） |
| `configQueryFieldOutput` | EsTable | 后端分页字段映射（total、pageSize、current、tableData） |
| `fieldFieldOutput` | EsForm | 后端表单查询字段映射（total、pageSize、current、listData） |

### 实际项目示例（axios）

```typescript
import axios from 'axios'

app.use(ESPlus, {
  EsTable: {
    methods: {
      $httpRequest: async ({ url, formParams, pageIndex, pageSize }) => {
        const { data } = await axios.post(url, { ...formParams, pageIndex, pageSize })
        return data
      },
      configQueryFieldOutput: () => ({
        total: 'total',
        tableData: 'records',  // 适配 MyBatis-Plus 分页格式
        pageSize: 'size',
        current: 'current'
      })
    }
  }
})
```

配置一次后，所有 `EsTable` 无需再传 `httpRequest`，只需声明 `apiParams.url` 即可发起请求。

## EsForm 用法

### 基础表单

通过 `formItemList` 配置生成表单，无需手写 `<el-form-item>`：

```vue
<template>
  <es-form
    :model="form"
    :form-item-list="formItems"
  />
</template>

<script setup>
import { reactive } from 'vue'

const form = reactive({
  name: '',
  status: '',
  date: []
})

const formItems = [
  { prop: 'name', label: '姓名', formtype: 'Input', span: 8 },
  { prop: 'status', label: '状态', formtype: 'Select', span: 8,
    dataOptions: [
      { label: '启用', value: 1 },
      { label: '禁用', value: 0 }
    ] },
  { prop: 'date', label: '日期范围', formtype: 'datePicker', span: 8,
    attrs: { type: 'daterange', valueFormat: 'YYYY-MM-DD' } }
]
</script>
```

### 带查询/重置按钮

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

const form = reactive({ name: '' })
const formItems = [
  { prop: 'name', label: '姓名', formtype: 'Input', span: 6 }
]

const btns = [
  { name: '查询', type: 'primary', key: 'query', triggerEvent: true },
  { name: '重置', key: 'rest', triggerEvent: true }
]

const handleConfirm = ({ key, model }) => {
  if (key === 'query') {
    console.log('查询参数:', model)
  }
}
</script>
```

### 字段联动

通过 `linkage` 配置实现字段间联动，当上游字段变化时自动更新下游选项：

```javascript
const formItems = [
  {
    prop: 'province', label: '省份', formtype: 'Select', span: 8,
    dataOptions: provinceList,
    linkage: {
      effect: ['city'],   // 联动下游字段
      action: (val, formModel) => {
        formModel.city = ''                    // 清空下游值
        return { dataOptions: getCityOptions(val) }  // 更新下游选项
      }
    }
  },
  {
    prop: 'city', label: '城市', formtype: 'Select', span: 8,
    dataOptions: []
  }
]
```

## EsTable 用法

### 基础表格

```vue
<template>
  <es-table
    :columns="columns"
    :options="options"
    v-model:data-source="tableData"
  />
</template>

<script setup>
import { ref } from 'vue'

const tableData = ref([])

const columns = [
  { prop: 'name', label: '姓名', width: 120 },
  { prop: 'status', label: '状态', width: 100 },
  { prop: 'operate', label: '操作', width: 160,
    btns: [
      { name: '编辑', type: 'primary', clickEvent: (row) => handleEdit(row) },
      { name: '删除', type: 'danger', clickEvent: (row) => handleDelete(row) }
    ] }
]

const options = {
  border: true,
  httpRequest: async () => {
    const res = await fetch('/api/list')
    return res.json()
  }
}
</script>
```

### 表单 + 表格联动

将 `EsForm` 嵌套在 `EsTable` 内，查询/重置/分页自动联动：

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
  { prop: 'status', label: '状态' }
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

## useDialog 用法

### 编程式弹窗

无需在模板中声明 `<el-dialog>`，直接函数调用：

```typescript
import { useDialog } from 'es-plus-ui'
import { h } from 'vue'

const dialog = useDialog()

// 简单提示
dialog({
  title: '提示',
  render: () => h('p', '确定要删除吗？')
})
```

### 带表单的弹窗

```typescript
import { reactive } from 'vue'

function openEditDialog(row) {
  const formData = reactive({ ...row })

  dialog({
    title: '编辑',
    width: '600px',
    render: (h, { registerRef }) => h(EsForm, {
      ref: (el) => { if (el) registerRef('formRef', el) },
      model: formData,
      formItemList: [
        { prop: 'name', label: '名称', formtype: 'Input', span: 24 }
      ]
    }),
    configBtn: [
      { name: '取消', click: (_, { close }) => close() },
      { name: '确定', type: 'primary', click: (_, { close, getRefs }) => {
        getRefs('formRef')?.validate().then(() => {
          // 提交逻辑
          close()
        })
      } }
    ]
  })
}
```

### 确认弹窗

```typescript
dialog({
  title: '确认删除',
  render: () => h('p', '此操作不可撤销，是否继续？'),
  configBtn: [
    { name: '取消', click: (_, { close }) => close() },
    { name: '确定', type: 'danger', click: (_, { close }) => {
      // 执行删除
      close()
    } }
  ]
})
```

## TypeScript 支持

ES-Plus 使用 TypeScript 编写，提供完整的类型定义，无需额外安装 `@types` 包：

```typescript
import type { FormItemOption, TableColumn, TableOptions, BtnConfig } from 'es-plus-ui'

const formItems: FormItemOption[] = [
  { prop: 'name', label: '姓名', formtype: 'Input', span: 12 },
  { prop: 'status', label: '状态', formtype: 'Select', span: 6,
    dataOptions: [{ label: '启用', value: 1 }, { label: '禁用', value: 0 }] }
]

const columns: TableColumn[] = [
  { prop: 'name', label: '姓名', width: 120 },
  { prop: 'status', label: '状态' },
  { prop: 'operate', label: '操作', btns: [
    { name: '编辑', type: 'primary', clickEvent: (row) => edit(row) }
  ] }
]

const btns: BtnConfig[] = [
  { name: '查询', type: 'primary', key: 'query', triggerEvent: true },
  { name: '重置', key: 'rest', triggerEvent: true }
]

const options: TableOptions = {
  border: true,
  httpRequest: async (params) => fetchList(params),
  configTableOut: { total: 'total', tableData: 'data', pageSize: 'pageSize', current: 'pageIndex' }
}
```

### JSON Schema（IDE 智能提示）

ES-Plus 还提供 JSON Schema 文件，在 VS Code 中编辑配置时可获得自动补全：

```jsonc
// .vscode/settings.json
{
  "json.schemas": [
    {
      "fileMatch": ["**/form-config.json"],
      "url": "./node_modules/es-plus-ui/schemas/form-item.schema.json"
    }
  ]
}
```

配合 AI IDE（Cursor、Copilot）时，Schema 可作为上下文让 AI 精确生成配置。

## 更多资源

- [EsForm 完整 API](/components/es-form) — 所有属性、事件、方法
- [EsTable 完整 API](/components/es-table) — 所有属性、事件、方法
- [useDialog 高级用法](/advanced/use-dialog) — 嵌套弹窗、JSX 渲染
- [迁移指南](/guide/migration) — 从 Element Plus 迁移到 ES-Plus
