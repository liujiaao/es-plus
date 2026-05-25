# 使用

## 全局配置（Options）

无论使用哪种引入方式，**都需要调用 `app.use(ESPlus, options)` 来注入全局配置**。全局配置通过 Vue 的 `provide/inject` 机制注入，与组件注册是独立的两个功能：

- **组件注册**：让 `<es-table>` 在模板中可用（可由 `app.component` 或自动导入完成）
- **全局配置**：注入 `$httpRequest`、`configQueryFieldOutput`、`permission`、`t` 等（只能通过 `app.use` 完成）

:::tip 核心原理
ES-Plus 组件内部通过 `inject('$esPlusTable')` / `inject('$EsPlus')` 获取全局配置。这些配置只有在 `app.use(ESPlus, options)` 执行后才会被注入。自动导入只负责按需引入组件代码和样式，不会注入这些运行时配置。
:::

---

## 三种使用模式

### 模式一：全量引入 + 全局配置（最简单）

适合不在意包体积的项目，或后台管理系统：

```typescript
// main.ts
import { createApp } from 'vue'
import ElementPlus from 'element-plus'
import 'element-plus/dist/index.css'
import ESPlus from 'es-plus-ui'
import 'es-plus-ui/dist/style.css'
import axios from 'axios'
import App from './App.vue'

const app = createApp(App)
app.use(ElementPlus)
app.use(ESPlus, {
  // 权限控制
  permission: (value) => userStore.permissions.includes(value),
  // 国际化
  t: (key) => i18n.global.t(key),
  // EsTable 全局配置
  EsTable: {
    methods: {
      $httpRequest: async ({ url, formParams, pageIndex, pageSize }) => {
        const { data } = await axios.post(url, { ...formParams, pageIndex, pageSize })
        return data
      },
      paginationLayout: () => ({
        layout: 'total, sizes, prev, pager, next, jumper',
        pageSizes: [10, 20, 50, 100],
        background: true
      }),
      configQueryFieldOutput: () => ({
        total: 'total',
        tableData: 'data',
        pageSize: 'pageSize',
        current: 'pageIndex'
      })
    }
  },
  // EsForm 全局配置
  EsForm: {
    methods: {
      $httpRequest: async ({ url, formParams }) => {
        const { data } = await axios.post(url, { ...formParams })
        return data
      },
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

### 模式二：自动按需导入 + 全局配置（推荐）

适合对包体积有要求的项目。**`EsPlusResolver` 负责样式注入，`app.use` 负责全局配置**：

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
      resolvers: [ElementPlusResolver(), EsPlusResolver()]
    })
  ]
})
```

```typescript
// main.ts — 自动导入模式
import { createApp } from 'vue'
import ESPlus from 'es-plus-ui'
import axios from 'axios'
import App from './App.vue'

const app = createApp(App)

// 关键：skipComponentRegistration 避免与自动导入重复注册
app.use(ESPlus, {
  skipComponentRegistration: true,  // 组件由 EsPlusResolver 自动导入，跳过全局注册
  permission: (value) => userStore.permissions.includes(value),
  t: (key) => i18n.global.t(key),
  EsTable: {
    methods: {
      $httpRequest: async ({ url, formParams, pageIndex, pageSize }) => {
        const { data } = await axios.post(url, { ...formParams, pageIndex, pageSize })
        return data
      },
      configQueryFieldOutput: () => ({
        total: 'total',
        tableData: 'records',
        pageSize: 'size',
        current: 'current'
      }),
      paginationLayout: () => ({
        layout: 'total, sizes, prev, pager, next, jumper',
        pageSizes: [10, 20, 50, 100],
        background: true
      })
    }
  },
  EsForm: {
    methods: {
      $httpRequest: async ({ url, formParams }) => {
        const { data } = await axios.post(url, { ...formParams })
        return data
      }
    }
  }
})

app.mount('#app')
```

:::warning 重要
即使使用自动导入，**仍然需要 `app.use(ESPlus, options)`**。自动导入只解决组件注册和样式，全局 HTTP 请求、字段映射、权限、i18n 等配置必须通过 `app.use` 注入。
:::

### 模式三：按需手动导入 + 全局配置（精确控制）

只注册需要的组件，手动管理样式：

```typescript
// main.ts
import { createApp } from 'vue'
import ElementPlus from 'element-plus'
import 'element-plus/dist/index.css'
import { EsForm, EsTable, useDialog } from 'es-plus-ui'
import 'es-plus-ui/dist/style.css'
import ESPlus from 'es-plus-ui'
import axios from 'axios'
import App from './App.vue'

const app = createApp(App)
app.use(ElementPlus)

// 手动注册需要的组件
app.component('EsForm', EsForm)
app.component('EsTable', EsTable)

// 全局配置仍通过 app.use 注入（跳过组件注册，因为已经手动注册了）
app.use(ESPlus, {
  skipComponentRegistration: true,
  EsTable: {
    methods: {
      $httpRequest: async (params) => {
        const { data } = await axios(params)
        return data
      },
      configQueryFieldOutput: () => ({
        total: 'total',
        tableData: 'list',
        pageSize: 'pageSize',
        current: 'page'
      })
    }
  }
})

app.mount('#app')
```

---

## Options 配置项参考

### 顶层配置

| 配置 | 类型 | 说明 |
|------|------|------|
| `skipComponentRegistration` | `boolean` | 跳过全局组件注册（自动导入时使用） |
| `permission` | `(value: string) => boolean` | 权限校验函数，控制按钮显隐 |
| `t` | `(key: string) => string` | 翻译函数，配合 labelKey 使用 |
| `EsTable` | `{ methods: {...} }` | EsTable 全局方法配置 |
| `EsForm` | `{ methods: {...} }` | EsForm 全局方法配置 |

### EsTable.methods

| 方法 | 类型 | 说明 |
|------|------|------|
| `$httpRequest` | `(params) => Promise<any>` | 全局请求方法，未传 `options.httpRequest` 时使用 |
| `paginationLayout` | `() => PaginationConfig` | 分页布局（layout/pageSizes/isSmall/background） |
| `configQueryFieldOutput` | `(defaults) => FieldMap` | API 响应字段映射 |

### EsForm.methods

| 方法 | 类型 | 说明 |
|------|------|------|
| `$httpRequest` | `(params) => Promise<any>` | 全局请求方法，用于远程加载选项数据 |
| `fieldFieldOutput` | `(defaults) => FieldMap` | API 响应字段映射 |

### 优先级规则

```
组件 props/options > 全局配置（app.use 注入） > 组件默认值
```

例如：`options.configTableOut` > `configQueryFieldOutput()` > 内置默认 `{ total: 'records', tableData: 'rows' }`

---

## 实际项目示例（MyBatis-Plus 后端）

```typescript
app.use(ESPlus, {
  EsTable: {
    methods: {
      $httpRequest: async ({ url, formParams, pageIndex, pageSize }) => {
        const { data } = await axios.post(url, { ...formParams, pageNo: pageIndex, pageSize })
        return data
      },
      configQueryFieldOutput: () => ({
        total: 'total',
        tableData: 'records',  // MyBatis-Plus IPage.records
        pageSize: 'size',
        current: 'current'
      }),
      paginationLayout: () => ({
        layout: 'total, sizes, prev, pager, next, jumper',
        pageSizes: [10, 20, 50, 100],
        background: true
      })
    }
  }
})
```

配置一次后，所有 `EsTable` 无需再传 `httpRequest` 和 `configTableOut`，只需在 `options` 中声明 `apiParams.url` 即可发起请求。

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
