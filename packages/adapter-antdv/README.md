# @es-plus/adapter-antdv

> Ant Design Vue 4.x 适配器 — 配置驱动的企业级 CRUD 组件

[![npm version](https://img.shields.io/npm/v/@es-plus/adapter-antdv)](https://www.npmjs.com/package/@es-plus/adapter-antdv)
[![license](https://img.shields.io/npm/l/@es-plus/adapter-antdv)](https://github.com/liujiaao/es-plus/blob/master/LICENSE)

## 简介

`@es-plus/adapter-antdv` 是 [ES-Plus](https://github.com/liujiaao/es-plus) 的 **Ant Design Vue 4.x** 渲染适配器。
它与 `@es-plus/vue3`（Element Plus 版）共享**完全相同的 JSON 配置 Schema**，
将配置映射为 Ant Design Vue 组件。

### 与 @es-plus/vue3 的关系

```
同一份 JSON 配置
    ├── @es-plus/vue3          → Element Plus 组件
    ├── @es-plus/vue2          → Element UI 组件
    └── @es-plus/adapter-antdv → Ant Design Vue 组件  ← 你在这里
```

## 快速开始

```bash
npm install @es-plus/adapter-antdv ant-design-vue @ant-design/icons-vue
```

```ts
// main.ts
import { createApp } from 'vue'
import Antd from 'ant-design-vue'
import ESPlus from '@es-plus/adapter-antdv'
import 'ant-design-vue/dist/reset.css'
import '@es-plus/adapter-antdv/dist/style.css'
import axios from 'axios'

const app = createApp(App)
app.use(Antd)
app.use(ESPlus, {
  // 全局权限校验（按钮 permissionValue → boolean）
  permission: (value) => userStore.permissions.includes(value),
  // 全局 i18n 翻译（labelKey / nameKey → text）
  t: (key) => i18n.global.t(key),
  // EsTable 全局方法
  EsTable: {
    methods: {
      // 全局请求方法（未传 options.httpRequest 时使用）
      $httpRequest: async ({ url, formParams, pageIndex, pageSize }) => {
        const { data } = await axios.post(url, { ...formParams, pageIndex, pageSize })
        return data
      },
      // API 响应字段映射
      configQueryFieldOutput: () => ({
        total: 'total',
        tableData: 'data',
        pageSize: 'pageSize',
        current: 'pageIndex',
      }),
      // 分页布局配置
      paginationLayout: () => ({
        layout: 'total, sizes, prev, pager, next, jumper',
        pageSizes: [10, 20, 50, 100],
        background: true,
      }),
    },
  },
  // EsForm 全局方法
  EsForm: {
    methods: {
      // 远程选项加载
      $httpRequest: async ({ url, formParams }) => {
        const { data } = await axios.post(url, { ...formParams })
        return data
      },
    },
  },
})
app.mount('#app')
```

## 引入方式

- **全量引入**：`app.use(ESPlus, options)`，注册所有组件与全局方法（见上方「快速开始」）。适合大多数后台管理项目。
- **按需引入**：直接使用命名导出，配合打包工具的 Tree Shaking 仅打包用到的组件：

  ```ts
  import { EsForm, EsTable } from '@es-plus/adapter-antdv'
  import '@es-plus/adapter-antdv/dist/style.css'
  ```

- **自动导入**：见下方「[自动导入 (unplugin-vue-components)](#自动导入-unplugin-vue-components)」小节。

## 组件 API

| 组件 | 说明 | 与 vue3 版本兼容 |
|------|------|------------------|
| `EsForm` | 动态表单，13 种控件 | ✅ 100% |
| `EsTable` | 动态表格，虚拟滚动 | ✅ 兼容 |
| `EsDialog` | 动态弹窗 | ✅ 兼容 |
| `EsCrudPage` | CRUD 编排组件 | ✅ 兼容 |
| `useDialog` | 命令式弹窗 | ✅ 100% |

### 与 vue3 版本的 API 差异

| 功能 | vue3 (Element Plus) | antdv (Ant Design Vue) |
|------|--------------------|------------------------|
| 表格组件 | `<el-table>` | `<a-table>` |
| 弹窗组件 | `<el-dialog>` | `<a-modal>` |
| 虚拟滚动 | `engine: 'virtual'` → `<el-table-v2>` | `virtual: true` → ADV 原生 |
| 加载状态 | `v-loading` 指令 | `<a-spin>` 包裹 |
| 确认弹窗 | `ElMessageBox.confirm()` | `Modal.confirm()` |
| ColorPicker | `<ElColorPicker>` | `input[type=color]`（降级） |
| v-model (表单) | `modelValue/onUpdate:modelValue` | `value/onUpdate:value` 等 |

**配置 Schema 100% 兼容** — 所有 `FormItemOption`、`TableColumn`、`TableOptions`、`DialogOptions` 等
类型定义与 `@es-plus/vue3` 完全相同。

## 使用示例

### 动态表单

```vue
<template>
  <es-form
    ref="formRef"
    :model="formModel"
    :form-item-list="formItems"
    :config-btn="configBtn"
    :layout-form-props="layoutProps"
  />
</template>

<script setup>
import { reactive } from 'vue'
import { EsForm } from '@es-plus/adapter-antdv'

const formRef = ref()
const formModel = reactive({ name: '', status: '' })

const formItems = [
  { prop: 'name', label: '姓名', formtype: 'Input', span: 8, attrs: { placeholder: '请输入' } },
  { prop: 'status', label: '状态', formtype: 'Select', span: 8, dataOptions: [
    { label: '启用', value: 1 }, { label: '禁用', value: 0 }
  ]},
  { prop: 'createTime', label: '创建时间', formtype: 'DatePicker', span: 8 },
]

const configBtn = [
  {
    name: '查询',
    key: 'query',               // 内置 key：自动触发表单校验 + 联动表格刷新
    type: 'primary',
    direction: 'right',
    click: (model) => {
      console.log('查询参数:', model)
    },
  },
  {
    name: '重置',
    key: 'rest',                // 内置 key：自动重置表单
    direction: 'right',
  },
]

const layoutProps = {
  formLayProps: {
    labelWidth: '100px',        // 标签宽度
    minFoldRows: 2,             // 超过2行自动折叠
  },
}
</script>
```

### 动态表格

```vue
<template>
  <es-table
    :columns="columns"
    :dataSource="tableData"
    :options="tableOptions"
    :pagination="pagination"
  />
</template>

<script setup>
import { ref } from 'vue'
import { EsTable } from '@es-plus/adapter-antdv'

const columns = [
  { prop: 'name', label: '姓名', width: 120 },
  { prop: 'email', label: '邮箱', minWidth: 160 },
  { prop: 'status', label: '状态', width: 100, align: 'center' },
]

const tableOptions = {
  border: true,
  rowkey: 'id',
  apiParams: { url: '/api/users' },
  httpRequest: async ({ pageIndex, pageSize, formParams }) => {
    const res = await fetch(`/api/users?page=${pageIndex}&size=${pageSize}`)
    return res.json()
  },
  configTableOut: {
    total: 'total', tableData: 'data', pageSize: 'pageSize', current: 'pageIndex',
  },
}

const pagination = { pageSize: 10 }
const tableData = ref([])
</script>
```

### CRUD 页面

```vue
<template>
  <es-crud-page ref="crudRef" :schema="schema" @delete="handleDelete" />
</template>

<script setup>
import { EsCrudPage } from '@es-plus/adapter-antdv'

const schema = {
  formItemList: [ /* 查询字段 */ ],
  columns: [ /* 表格列 */ ],
  tableOptions: { /* 表格选项 */ },
  pagination: { pageSize: 10 },
  toolbarBtns: [
    { name: '新增', type: 'primary', key: 'add', dialogKey: 'add' },
  ],
  operationColumn: {
    btns: [
      { name: '编辑', type: 'primary', dialogKey: 'edit' },
      { name: '删除', type: 'danger', confirm: '确定删除？' },
    ],
  },
  dialogs: {
    add: {
      title: '新增用户',
      width: '600px',
      formItems: [ /* 弹窗表单字段 */ ],
    },
    edit: {
      title: (row) => `编辑 - ${row?.name}`,
      width: '600px',
      formItems: [ /* 弹窗表单字段 */ ],
    },
  },
  dialogFormItems: [ /* 兼容旧版 actions 模式 */ ],
}

// 编程式打开弹窗
const crudRef = ref()
crudRef.value?.openDialog('add')
crudRef.value?.openDialog('edit', rowData)
</script>
```

## 自动导入 (unplugin-vue-components)

```ts
// vite.config.ts
import Components from 'unplugin-vue-components/vite'
import { EsPlusResolver } from '@es-plus/adapter-antdv/resolver'

export default {
  plugins: [
    Components({
      resolvers: [EsPlusResolver()],
    }),
  ],
}
```

## Peer Dependencies

| 包 | 版本 | 说明 |
|----|------|------|
| `vue` | `^3.2.0` | 渲染框架 |
| `ant-design-vue` | `^4.0.0` | UI 组件库 |
| `@ant-design/icons-vue` | `^7.0.0` | 图标 |
| `dayjs` | `^1.10.5` | 与 ant-design-vue 共用同一实例，必须由宿主提供，避免 DatePicker 跨实例失效 |

## 常见问题（FAQ）

**Q: DatePicker / RangePicker 报错 `isDayjs is not a function` 或语言包失效？**
A: `dayjs` 是 peerDependency，必须由宿主项目安装，确保 `ant-design-vue` 与 `@es-plus/adapter-antdv` 使用同一个 dayjs 实例。本包构建时已将 `dayjs` 设为 external，切勿被打包工具重复打包进产物。

**Q: ColorPicker 控件为什么是原生 `<input type="color">`？**
A: Ant Design Vue 4.x 早期版本没有独立的 ColorPicker 组件，故降级为原生颜色选择器，以保持配置 Schema 与 vue3 版一致。如需高级取色器，可通过 `formtype: 'Slot'` 自定义渲染。

**Q: 表单 v-model 字段名与 vue3 版不同？**
A: Ant Design Vue 表单控件使用 `value/onUpdate:value`（部分组件为 `checked`、`fileList` 等），而 Element Plus 统一为 `modelValue/onUpdate:modelValue`。本适配器已在内部完成映射，**JSON 配置层 100% 兼容**，你无需关心底层差异；仅在自定义 `Slot` 透传 attrs 时需注意该差异。

**Q: 可以和 `@es-plus/vue3` 同时使用吗？**
A: 不推荐。两者导出的组件同名（`EsForm`/`EsTable` 等），同时全局注册会冲突。同一项目请选择一种 UI 适配器；配置 JSON 可在两者间无缝迁移。

## License

MIT © [liujiaao](https://github.com/liujiaao)

---

更多架构、构建与发布信息见 [DEVELOP.md](./DEVELOP.md)。
