# Vue 2 指南

`@es-plus/vue2` 是 ES-Plus 的 Vue 2 + Element UI 渲染层，与 Vue 3 版（`@es-plus/vue3`）共用同一份 JSON 配置 schema。本文聚焦 Vue 2 特有的安装、用法、差异与限制。

> **同 schema、双渲染。** 同一份 `columns` / `formItemList` / `options` 配置在 Vue 2 与 Vue 3 项目中渲染结果一致。

---

## 安装

| 依赖 | 版本 |
|---|---|
| Vue | `^2.6.14 \|\| ^2.7.0`（自 1.1.0 起原生兼容两条线） |
| Element UI | `^2.15.0` |
| `@vue/composition-api` | **不需要安装**（自 1.1.1 起已内联进 dist） |

::: tip 1.1.x 后的兼容设计
**自 `@es-plus/vue2@1.1.0` 起**，包内 `vue-compat` 在模块加载时读取 `Vue.version` 并自动选择 Composition API 来源：Vue 2.7+ 走原生，Vue 2.6 走 polyfill；并由 `install()` 自动 `Vue.use(VueCompositionAPI)`（Vue 2.6 时）。

**自 1.1.1 起**，`@vue/composition-api` 被内联进 dist —— Vue 2.7 用户**不再需要**在 `package.json` 里声明这个依赖，bundler 也不会报 `UNRESOLVED_IMPORT`。

**用户 `main.js` 不需要写 `Vue.use(VueCompositionAPI)`**——不论 Vue 2.6 还是 2.7。
:::

### Vue 2.7+（推荐）

```bash
npm install @es-plus/vue2 element-ui
```

```javascript
// main.js
import Vue from 'vue'
import ElementUI from 'element-ui'
import 'element-ui/lib/theme-chalk/index.css'
import EsPlus from '@es-plus/vue2'
import '@es-plus/vue2/dist/style.css'

Vue.use(ElementUI)
Vue.use(EsPlus)
```

### Vue 2.6

```bash
npm install @es-plus/vue2 element-ui
```

```javascript
// main.js — 与 Vue 2.7 完全相同
import Vue from 'vue'
import ElementUI from 'element-ui'
import 'element-ui/lib/theme-chalk/index.css'
import EsPlus from '@es-plus/vue2'
import '@es-plus/vue2/dist/style.css'

Vue.use(ElementUI)
Vue.use(EsPlus)  // ← install() 内部检测到 Vue 2.6 会自动 use 内联的 polyfill
```

::: warning 从 1.1.0 之前升级
如果你之前的 `main.js` 写过：

```javascript
import VueCompositionAPI from '@vue/composition-api'
Vue.use(VueCompositionAPI)
```

**升级到 1.1.0+ 后请删除这两行**。如果保留，在 Vue 2.7 上会触发 `setup()` 双跑警告（原生 setup 与 polyfill 的 `data()` wrapper 同时执行），`install()` 内部会打 `console.warn` 提示你删除。
:::

---

## 全局配置

`Vue.use(EsPlus, options)` 接受与 Vue 3 版本完全一致的 options 形状：

```javascript
Vue.use(EsPlus, {
  // 权限控制 — 按钮通过 permissionValue 声明权限码
  permission: (value) => userStore.permissions.includes(value),

  // 国际化 — 表单 label / 按钮 name 通过 labelKey 翻译
  t: (key) => i18n.t(key),

  // 全局组件尺寸（透传给 Element UI）
  componentSize: 'small',

  // EsTable 全局配置
  EsTable: {
    methods: {
      // 全局 HTTP 请求函数
      $httpRequest: async ({ url, formParams, pageIndex, pageSize }) => {
        const { data } = await axios.post(url, { ...formParams, pageIndex, pageSize })
        return data
      },
      // 分页配置（自 1.1.0 起新增 prevText / nextText 透传）
      paginationLayout: () => ({
        layout: 'prev, pager, next, jumper, sizes, total',
        pageSizes: [10, 20, 50, 100],
        pageSize: 20,
        background: true,
        prevText: '上一页',  // 1.1.0+ 透传给 <el-pagination> 的 prev-text；省略则显示默认箭头
        nextText: '下一页',
      }),
      // 响应字段映射
      configQueryFieldOutput: () => ({
        total: 'total',
        tableData: 'data',
        pageSize: 'pageSize',
        current: 'pageIndex',
      }),
    },
  },

  // EsForm 全局配置
  EsForm: {
    methods: {
      $httpRequest: async ({ url, formParams }) => {
        const { data } = await axios.post(url, formParams)
        return data
      },
      fieldFieldOutput: () => ({
        total: 'total',
        pageSize: 'pageSize',
        current: 'pageIndex',
        listData: 'data',
      }),
    },
  },

  // 是否跳过组件全局注册（按需导入场景置 true）
  skipComponentRegistration: false,

  // 是否注入 Vue.prototype.$useDialog（默认 true）
  globalProperties: true,
})
```

也可以通过 `configureEsPlus()`（模块级单例，无需 `Vue.use()` 即可生效）：

```javascript
import { configureEsPlus } from '@es-plus/vue2'

configureEsPlus({
  permission: (v) => true,
  EsTable: { /* ... */ },
})
```

---

## 表单示例

```vue
<template>
  <es-form
    :model="form"
    :form-item-list="formItems"
    :config-btn="btns"
    @confirm="handleConfirm"
  />
</template>

<script>
export default {
  data: () => ({
    form: { name: '', status: '' },
    formItems: [
      { prop: 'name', label: '姓名', formtype: 'Input', span: 12 },
      { prop: 'status', label: '状态', formtype: 'Select', span: 12,
        dataOptions: [
          { label: '启用', value: 1 },
          { label: '禁用', value: 0 },
        ] },
    ],
    btns: [
      { name: '查询', type: 'primary', key: 'query', triggerEvent: true },
      { name: '重置', key: 'rest', triggerEvent: true },
    ],
  }),
  methods: {
    handleConfirm({ key, model }) {
      console.log(key, model)
    },
  },
}
</script>
```

也支持 `<script setup>` + Composition API（Vue 2.7+）：

```vue
<script setup>
import { reactive } from 'vue'

const form = reactive({ name: '', status: '' })
const formItems = [/* ... */]
const btns = [/* ... */]
</script>
```

---

## 表格示例

```vue
<template>
  <es-table
    :columns="columns"
    :options="options"
    :data-source.sync="tableData"
    :pagination.sync="pagination"
  >
    <es-form :model="form" :form-item-list="formItems" :config-btn="btns" />
  </es-table>
</template>

<script>
export default {
  data: () => ({
    form: { name: '' },
    tableData: [],
    pagination: { current: 1, pageSize: 10, total: 0 },
    formItems: [
      { prop: 'name', label: '姓名', formtype: 'Input', span: 6 },
    ],
    btns: [
      { name: '查询', type: 'primary', key: 'query', triggerEvent: true },
      { name: '重置', key: 'rest', triggerEvent: true },
    ],
    columns: [
      { prop: 'name', label: '姓名' },
      { prop: 'status', label: '状态' },
    ],
    options: {
      border: true,
      stripe: true,
      httpRequest: async ({ formParams, pageIndex, pageSize }) => {
        const res = await axios.post('/api/list', { ...formParams, pageIndex, pageSize })
        return res.data
      },
      configTableOut: { total: 'total', tableData: 'data', pageSize: 'pageSize', current: 'pageIndex' },
    },
  }),
}
</script>
```

:::tip Vue 2 v-model 语法
Vue 2 使用 `:prop.sync` 替代 Vue 3 的 `v-model:prop`，例如 `:data-source.sync` 等价于 Vue 3 的 `v-model:data-source`。
:::

---

## 编程式弹窗 — `useDialog`

API 与 Vue 3 版完全一致：

```javascript
import { useDialog } from '@es-plus/vue2'

const dialog = useDialog()

function openEditDialog(row) {
  dialog({
    title: '编辑',
    width: '500px',
    render: (h, { registerRef }) => h('div', [
      h('p', `编辑用户：${row.name}`),
    ]),
    configBtn: [
      { name: '取消', click: (_, { close }) => close() },
      { name: '确定', type: 'primary', click: (_, { close }) => {
        // 处理提交
        close()
      } },
    ],
  })
}
```

也可通过 `Vue.prototype.$useDialog` 在 Options API 中调用：

```javascript
export default {
  methods: {
    openDialog() {
      const dialog = this.$useDialog()
      dialog({ title: '提示', render: (h) => h('p', '内容') })
    },
  },
}
```

> **JSX 用法。** Vue 2 的 `render(h, ctx)` 中的 `h` 是 `createElement`（Vue 2 风格），与 Vue 3 中的 `h()` 调用方式接近，但 props 传递语法略有差异。如需 JSX，安装 `@vue/babel-preset-jsx` 与 `@vue/babel-helper-vue-jsx-merge-props`。

---

## 与 Vue 3 版的差异

### 完全兼容（无需感知差异）

| 能力 | 说明 |
|---|---|
| `columns` 配置 | 字段、render、btns、ellipsis、formatter 完全一致 |
| `formItemList` 配置 | 13 种 formtype、dataOptions、attrs 透传完全一致 |
| `options` 配置 | httpRequest、configTableOut、apiParams、border、stripe 等完全一致 |
| `useDialog` API | `dialog()` 调用签名、configBtn、registerRef、getRefs 完全一致 |
| 跨页选择 | `getSelectionRows()` 行为一致 |
| 工具栏按钮 | `tableBtns` 分区、权限过滤、code 分组完全一致 |
| 表单折叠 | `formLayout.minFoldRows` 算法一致 |
| 全局配置 | `permission` / `t` / `componentSize` / `$httpRequest` 注入方式一致 |

### 不支持（Element UI 没有对应能力）

| Vue 3 能力 | Vue 2 替代方案 |
|---|---|
| 虚拟滚动 (`virtual: true` / `el-table-v2`) | **不支持** — Element UI 无对应组件，配置中 `virtual` 字段被忽略 |
| `ElConfigProvider` 国际化 | 使用 Element UI 的 `Vue.use(ElementUI, { locale })` 全局配置 |
| `@element-plus/icons-vue`（组件式图标） | Element UI 使用 class 字符串：`<i class="el-icon-edit" />` |
| `ElAutoResizer` | EsTable 内部已通过 `ResizeObserver` 自实现宽度监听 |
| 按需导入 `unplugin-vue-components` resolver | Vue 2 项目通常使用全量 `Vue.use(ElementUI)`，或手动 import 单组件 |
| Vue 3.3+ `defineSlots` 类型推导 | 无（Vue 2 无此特性） |

### 行为有差异

| 维度 | Vue 3 | Vue 2 |
|---|---|---|
| Dialog 双向绑定 | `v-model:visible` | `:visible.sync` |
| Pagination 双向绑定 | `v-model:current-page` | `:current-page.sync` |
| 渲染函数 `h` | 全局 `import { h } from 'vue'` | `render: (h, ctx) => ...` 中传入的 `createElement` |
| Provide / Inject | `app.provide()` | `Vue.mixin({ provide: { ... } })`（内部已处理） |
| 插件安装 | `app.use(EsPlus)` | `Vue.use(EsPlus)` |

---

## 从 `es-eui` 迁移

如果你的旧项目使用过我们早期的 `es-eui`（Vue 2 + Element UI 独立实现），切换到 `@es-plus/vue2` 几乎零改动：

```diff
- import esEui from 'es-eui'
- import 'es-eui/dist/style.css'
+ import EsPlus from '@es-plus/vue2'
+ import '@es-plus/vue2/dist/style.css'

- Vue.use(esEui, {
+ Vue.use(EsPlus, {
    EsTable: {
      methods: {
        $httpRequest: ...,
        configQueryfieldOutput: ...,   // 旧字段名（小写 f）仍可用，自动归一化
      },
    },
  })
```

`@es-plus/vue2` 内部包含兼容垫片 `normalizeLegacyOptions`，自动展平 `EsTable.methods` 嵌套结构、并把旧的 `configQueryfieldOutput` 字段映射到新的 `configQueryFieldOutput`。**用户配置无需调整即可切换。**

---

## 跨项目共享配置类型

Monorepo 中，把列定义 / 表单定义提到独立 `shared/` 包，使用 `@es-plus/core/types` 的框架无关类型：

```ts
// shared/types/user.ts
import type { TableColumn, FormItemOption } from '@es-plus/core/types'

export const userColumns: TableColumn[] = [
  { prop: 'name', label: '姓名', width: 120 },
  { prop: 'email', label: '邮箱' },
]

export const userFormItems: FormItemOption[] = [
  { prop: 'name', label: '姓名', formtype: 'Input', span: 12 },
]
```

```vue
<!-- vue3-app/src/UserList.vue -->
<script setup>
import { userColumns, userFormItems } from '@my/shared/types/user'
</script>

<template>
  <es-table :columns="userColumns" :options="options">
    <es-form :form-item-list="userFormItems" :model="form" />
  </es-table>
</template>
```

```vue
<!-- vue2-app/src/UserList.vue -->
<script>
import { userColumns, userFormItems } from '@my/shared/types/user'
export default {
  data: () => ({ userColumns, userFormItems, form: {} }),
}
</script>

<template>
  <es-table :columns="userColumns" :options="options">
    <es-form :form-item-list="userFormItems" :model="form" />
  </es-table>
</template>
```

同一份配置，两套渲染。

---

## 已知限制

- **不支持虚拟滚动** — Element UI 无 `el-table-v2` 等价组件，配置中的 `virtual: true` 在 Vue 2 版被忽略
- **不支持 `ElConfigProvider`** — 国际化通过 Element UI 的 `Vue.use(ElementUI, { locale })` 配置
- **图标使用 class 字符串** — `el-icon-edit` 之类，而非 Vue 3 的组件式图标
- **TypeScript 类型推导精度略低** — Vue 2 `<script setup>` 类型推导能力不如 Vue 3.3+
- **打包产物略大** — Vue 2 + Element UI 整体生态体积大于 Vue 3 + Element Plus

---

## 下一步

- [安装](/guide/installation) — 完整安装流程
- [使用](/guide/usage) — 全局配置详解（Vue 3 / Vue 2 通用）
- [迁移指南](/guide/migration) — 从 `es-plus-ui` 迁移到 `@es-plus/vue3`
- [EsForm 文档](/components/es-form) — 表单 API
- [EsTable 文档](/components/es-table) — 表格 API
- [useDialog 文档](/advanced/use-dialog) — 弹窗 API
