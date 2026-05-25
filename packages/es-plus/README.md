# es-plus-ui

基于 Vue 3 + Element Plus 的企业级中后台 CRUD 组件库 — 配置化驱动表单、表格、弹窗全链路联动

[![npm version](https://img.shields.io/npm/v/es-plus-ui.svg)](https://www.npmjs.com/package/es-plus-ui)
[![npm downloads](https://img.shields.io/npm/dm/es-plus-ui.svg)](https://www.npmjs.com/package/es-plus-ui)
[![license](https://img.shields.io/npm/l/es-plus-ui.svg)](https://www.npmjs.com/package/es-plus-ui)
[![github stars](https://img.shields.io/github/stars/liujiaao/es-plus?style=social)](https://github.com/liujiaao/es-plus)

**[在线文档](https://liujiaao.github.io/es-plus/)** · **[Playground](https://liujiaao.github.io/es-plus/#/playground)** · **[GitHub](https://github.com/liujiaao/es-plus)** · **[更新日志](https://github.com/liujiaao/es-plus/releases)**

## 核心特性

- **配置化开发** — JSON 配置生成复杂表单与表格，替代大量模板代码
- **表单↔表格↔弹窗联动** — 查询/重置/分页全自动，零事件代码
- **编程式弹窗** — `useDialog` Hook 命令式调用，支持 JSX 渲染、嵌套弹窗
- **自适应高度** — `ResizeObserver` 自动重算表格高度，表单展开/收起自动响应
- **跨页选择** — `rowkey` + `cachePageSelection` 解决分页选择丢失痛点
- **任意后端适配** — `configTableOut` + `qrcb` 配置化适配不同后端响应格式
- **权限控制** — `permissionValue` 声明式按钮权限，无需 v-if
- **国际化** — `labelKey` + 自定义翻译函数，兼容任意 i18n 方案
- **TypeScript** — 完整类型定义，11 个核心接口可导入
- **AI 原生支持** — 配套 [@es-plus/mcp-server](https://www.npmjs.com/package/@es-plus/mcp-server) 和 [@es-plus/cli](https://www.npmjs.com/package/@es-plus/cli)
- **13 种表单类型** — Input、Select、datePicker、timePicker、Slider、ColorPicker、Transfer、Cascader、Radio、Checkbox、Switch、Rate、Upload

## 为什么选择 es-plus-ui？

> 同样的 CRUD 页面，传统写法 ~200 行，es-plus-ui ~20 行

| 痛点 | 传统 Element Plus | es-plus-ui |
|------|-------------------|------------|
| 表单字段 | 每个字段 5-8 行 `el-form-item` + `v-model` | 一行 `{ prop, label, formtype }` |
| 查询/重置 | 手动 `@click` + `resetFields()` | `triggerEvent: true` 自动处理 |
| 分页请求 | 手动绑定 `current-page` + `size-change` 事件 | 分页切换自动请求 |
| 表单↔表格 | 手动传参、手动刷新 | 自动发现、自动合并参数 |
| 弹窗管理 | 模板声明 + `visible` 状态 | `useDialog()` 编程式调用 |
| 选择丢失 | 分页后选中清空 | 跨页选择缓存 + 去重 |
| 后端适配 | 每个接口手动映射字段 | `configTableOut` 统一映射 |

## 安装

```bash
npm install es-plus-ui element-plus @element-plus/icons-vue
# 或
yarn add es-plus-ui element-plus @element-plus/icons-vue
# 或
pnpm add es-plus-ui element-plus @element-plus/icons-vue
```

前置依赖：`vue ^3.2.0`、`element-plus ^2.2.0`、`@element-plus/icons-vue ^2.1.0`

## 快速上手

### 全局引入

```typescript
import { createApp } from 'vue'
import ElementPlus from 'element-plus'
import 'element-plus/dist/index.css'
import EsPlus from 'es-plus-ui'
import 'es-plus-ui/dist/style.css'
import App from './App.vue'

const app = createApp(App)
app.use(ElementPlus)
app.use(EsPlus)
app.mount('#app')
```

### 自动按需导入（unplugin-vue-components）

如果项目使用 `ElementPlusResolver` 按需导入 Element Plus，**必须同时配置 `EsPlusResolver`**，否则 es-plus 内部依赖的 EP 组件样式不会被注入：

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

`EsPlusResolver` 会在检测到 `<es-table>`、`<es-form>` 等组件时，自动注入 es-plus 自身样式及其依赖的全部 Element Plus 组件样式。与 `ElementPlusResolver` 不冲突、不重复。

### 全局配置

通过 `app.use(EsPlus, options)` 第二个参数配置全局默认值，避免每个组件重复传入相同的请求方法、字段映射、分页布局等配置：

```typescript
import axios from 'axios'

const app = createApp(App)

app.use(EsPlus, {
  EsTable: {
    methods: {
      // 全局 HTTP 请求方法，所有 EsTable 共用
      $httpRequest: async ({ url, formParams, headers, ...rest }) => {
        const res = await axios({ url, method: rest.method || 'GET', headers, params: formParams, ...rest })
        return res.data
      },
      // 分页布局配置
      paginationLayout: () => ({
        layout: 'total, sizes, prev, pager, next, jumper',
        pageSizes: [10, 20, 50, 100],
        isSmall: true,
        background: true
      }),
      // API 响应字段映射（后端返回字段 → 组件内部字段）
      configQueryFieldOutput: () => ({
        total: 'total',        // 后端总数字段名
        pageSize: 'pageSize',  // 后端每页条数字段名
        current: 'pageIndex',  // 后端当前页码字段名
        tableData: 'data'      // 后端数据列表字段名
      })
    }
  },
  EsForm: {
    methods: {
      // 全局 HTTP 请求方法，所有 EsForm 共用
      $httpRequest: async ({ url, formParams, headers, ...rest }) => {
        const res = await axios({ url, method: rest.method || 'GET', headers, params: formParams, ...rest })
        return res.data
      },
      // API 响应字段映射（后端返回字段 → 组件内部字段）
      fieldFieldOutput: () => ({
        total: 'total',        // 后端总数字段名
        pageSize: 'pageSize',  // 后端每页条数字段名
        current: 'pageIndex',  // 后端当前页码字段名
        listData: 'data'       // 后端选项列表字段名
      })
    }
  }
})
```

#### 配置项说明

| 组件 | 配置键 | 类型 | 说明 |
|------|--------|------|------|
| EsTable | `$httpRequest` | `(params) => Promise` | 全局请求方法，未传 `options.httpRequest` 时使用 |
| EsTable | `paginationLayout` | `() => PaginationLayoutConfig` | 分页布局配置（layout/pageSizes/isSmall/background） |
| EsTable | `configQueryFieldOutput` | `() => FieldMap` | API 响应字段映射，未传 `options.configTableOut` 时使用 |
| EsForm | `$httpRequest` | `(params) => Promise` | 全局请求方法，未传 `formItem.httpRequest` 时使用 |
| EsForm | `fieldFieldOutput` | `(defaults) => FieldMap` | API 响应字段映射，未传 `formItem.configFormOut` 时使用 |

> **优先级**：组件 props / 选项 > 全局配置 > 组件默认值。例如 `options.configTableOut` 优先于 `configQueryFieldOutput`。

#### paginationLayout 配置

```typescript
paginationLayout: () => ({
  layout: 'total, sizes, prev, pager, next, jumper',  // Element Plus 分页布局字符串
  pageSizes: [10, 20, 50, 100],                        // 每页条数选项
  isSmall: true,                                        // 是否使用小型分页器
  background: true                                      // 是否显示背景色
})
```

#### fieldFieldOutput / configQueryFieldOutput 配置

函数接收默认字段映射作为参数，返回自定义映射：

```typescript
// 默认映射（不配置时的值）
{
  total: 'records',
  pageSize: 'pageSize',
  current: 'pageNo',
  listData: 'rows'     // EsForm 用 listData
  // tableData: 'rows' // EsTable 用 tableData
}

// 自定义示例：后端返回 { data: { list: [...], pagination: { total: 100 } } }
fieldFieldOutput: (defaults) => ({
  total: 'total',
  pageSize: 'pageSize',
  current: 'pageNo',
  listData: 'list'
})
```

### 按需引入

```typescript
import { EsForm, EsTable, useDialog } from 'es-plus-ui'
import 'es-plus-ui/dist/style.css'
```

### 最小示例

**EsForm**：

```vue
<template>
  <es-form :model="form" :form-item-list="items" :config-btn="btns" />
</template>

<script setup>
import { reactive } from 'vue'
const form = reactive({ keyword: '', status: '' })
const items = [
  { prop: 'keyword', label: '关键词', formtype: 'Input', span: 6, attrs: { clearable: true } },
  { prop: 'status', label: '状态', formtype: 'Select', span: 6, dataOptions: [{ label: '启用', value: 1 }, { label: '禁用', value: 0 }] }
]
const btns = [
  { name: '查询', type: 'primary', key: 'query', triggerEvent: true },
  { name: '重置', key: 'rest', triggerEvent: true }
]
</script>
```

**EsTable**：

```vue
<template>
  <es-table
    :columns="columns"
    :options="options"
    v-model:data-source="tableData"
    v-model:pagination="pagination"
  />
</template>

<script setup>
import { ref } from 'vue'
const tableData = ref([])
const pagination = ref({ pageSize: 10, current: 1, total: 0 })
const columns = [
  { prop: 'id', label: 'ID', width: 80 },
  { prop: 'name', label: '姓名' },
  { prop: 'status', label: '状态' }
]
const mockRequest = async (params) => {
  const { formParams, ...rest } = params || {}
  const { pageIndex = 1, pageSize = 10 } = { ...formParams, ...rest }
  // 实际项目中替换为真实 API 调用
  return { data: [], total: 0, pageSize, pageIndex }
}
const options = {
  border: true,
  httpRequest: mockRequest,
  apiParams: { url: '/api/list', method: 'GET' },
  configTableOut: { total: 'total', tableData: 'data', pageSize: 'pageSize', current: 'pageIndex' },
  rowkey: 'id',
  heightType: 'height',
  tabHeight: 400
}
</script>
```

**useDialog**：

```tsx
import { useDialog } from 'es-plus-ui'
import EsForm from 'es-plus-ui/components/es-form'

const dialog = useDialog()
function openAddDialog() {
  dialog({
    title: '新增',
    width: '600px',
    render: (h, { registerRef }) => (
      <EsForm
        ref={(el) => { if (el) registerRef('formRef', el) }}
        model={formData}
        formItemList={[{ prop: 'name', label: '名称', formtype: 'Input', span: 24 }]}
      />
    ),
    configBtn: [
      { name: '取消', click: (_, { close }) => close() },
      { name: '提交', type: 'primary', click: (_, { close, getRefs }) => {
        getRefs('formRef')?.validate().then(() => { close() })
      }}
    ]
  })
}
```

---

## EsForm 表单组件

配置化驱动的表单组件，支持 13 种输入类型、动态显隐、异步数据加载、折叠展开等功能。

### Props

| 属性 | 类型 | 默认值 | 说明 |
|------|------|--------|------|
| model | `Record<string, unknown>` | `{}` | 表单数据对象（必填） |
| formItemList | `FormItemOption[]` | `[]` | 表单项配置数组（必填） |
| layoutFormProps | `LayoutFormProps` | `{}` | 布局配置 |
| configBtn | `BtnConfig[]` | `[]` | 按钮配置 |
| renderBtn | `Function \| boolean` | `false` | 自定义按钮渲染函数 |
| btnColSpanRow | `boolean` | `true` | 按钮是否独占一行 |
| rules | `Record<string, unknown>` | `{}` | 验证规则（Element Plus 格式） |
| fieldFieldOutput | `(defaults) => Record<string, string>` | — | API 响应字段映射 |

### FormItemOption 配置

| 字段 | 类型 | 默认值 | 说明 |
|------|------|--------|------|
| prop | `string` | — | 字段名（必填） |
| label | `string` | — | 标签文本（必填） |
| formtype | `string` | — | 输入组件类型（见下表） |
| span | `number` | `6` | 栅格占列数（24 列布局） |
| attrs | `Record<string, unknown>` | — | 透传给 Element Plus 组件的属性（placeholder、clearable 等） |
| on | `Record<string, unknown>` | — | 事件监听（change、input 等） |
| dataOptions | `Array<{ label, value }>` | — | 选项数据（Select/Radio/Checkbox/Cascader） |
| isHidden | `(model, item, formProps) => boolean` | — | 条件隐藏函数，返回 `true` 时隐藏 |
| render | `(h, model, ctx) => VNode \| string` | — | 自定义渲染函数 |
| apiParams | `ApiParams` | — | 从接口加载选项数据 |
| isInitRun | `boolean` | `true` | 是否在初始化时自动加载接口数据 |
| callOptionListFormat | `(data) => unknown[]` | — | 将 API 响应转换为 dataOptions 格式 |
| httpRequest | `(params) => Promise` | — | 自定义请求方法（覆盖全局配置） |
| listenToCallBack | `Record<string, Function>` | — | 回调映射，`crtn` 用于选项格式转换 |
| width | `number \| string` | — | 字段宽度 |
| formItemOptions | `Record<string, unknown>` | — | el-form-item 附加属性（rules、labelWidth 等） |
| components | `Record<string, unknown>` | — | 自定义组件映射 |

### formtype 类型

| 类型 | 对应组件 | 常用配置 |
|------|----------|----------|
| `Input` | ElInput | `attrs: { placeholder, clearable, type: 'textarea' }` |
| `Select` | ElSelect | `dataOptions: [{ label, value }]`, `attrs: { clearable, multiple }` |
| `datePicker` | ElDatePicker | `attrs: { type: 'daterange/datetimerange', valueFormat }` |
| `timePicker` | ElTimePicker | `attrs: { isRange }` |
| `Slider` | ElSlider | `attrs: { min, max, step }` |
| `ColorPicker` | ElColorPicker | `attrs: { showAlpha }` |
| `Transfer` | ElTransfer | `dataOptions` |
| `Cascader` | ElCascader | `dataOptions`（树形结构）, `attrs: { props: { checkStrictly: true } }` |
| `Radio` | ElRadioGroup | `dataOptions: [{ label, value }]` |
| `Checkbox` | ElCheckboxGroup | `dataOptions: [{ label, value }]` |
| `Switch` | ElSwitch | `attrs: { activeText, inactiveText }` |
| `Rate` | ElRate | `attrs: { max, allowHalf }` |
| `Upload` | ElUpload | `attrs: { action, listType, limit }` |

### LayoutFormProps 配置

| 字段 | 类型 | 说明 |
|------|------|------|
| fromLayProps | `Object` | 表单级别属性 |
| fromLayProps.labelWidth | `string` | 标签宽度，如 `'100px'` |
| fromLayProps.minFoldRows | `number` | 折叠时显示的行数，`0` 不折叠 |
| fromLayProps.isBtnHidden | `boolean` | 是否隐藏按钮区域 |
| fromLayProps.btnColSpan | `number` | 按钮列占位宽度 |
| fromLayProps.labelBtnWidth | `string \| number` | 按钮标签宽度 |
| rowLayProps | `Object` | 行级别属性 |
| rowLayProps.gutter | `number` | 栅格间距 |
| setOptions | `boolean` | 是否启用设置下拉 |

### BtnConfig 配置

| 字段 | 类型 | 说明 |
|------|------|------|
| name | `string` | 按钮文本 |
| key | `string` | 按钮唯一标识 |
| type | `string` | 按钮类型（primary/success/warning/danger/info） |
| icon | `string` | 图标名称 |
| size | `string` | 按钮尺寸 |
| direction | `'left' \| 'right'` | 按钮位置 |
| loading | `boolean` | 加载状态 |
| disabled | `boolean \| () => boolean` | 禁用状态，支持函数形式 |
| click | `(model, formRef, httpRequestInstance?) => void` | 点击回调 |
| triggerEvent | `boolean` | `true` 时自动触发表格查询/表单重置 |

> `triggerEvent: true` + `key: 'query'` → 自动调用父级 EsTable 的 `httpRequestInstance`；`triggerEvent: true` + `key: 'rest'` → 自动重置表单。

### Events

| 事件 | 参数 | 说明 |
|------|------|------|
| confirm | `(formRef, model)` | 点击确认按钮时触发 |
| reset | `(formRef, model)` | 点击重置按钮时触发 |

### Methods（通过 ref 调用）

| 方法 | 说明 |
|------|------|
| `validate()` | 校验整个表单，返回 `Promise<boolean>` |
| `resetFields()` | 重置所有字段 |
| `clearValidate(props?)` | 清除校验状态 |
| `validateField(props)` | 校验指定字段 |
| `scrollToField(prop)` | 滚动到指定字段 |
| `formItmeRequestInstance(propsList)` | 手动触发指定字段的 API 数据加载 |
| `getFormRef()` | 获取底层 ElForm 实例 |

### 高级用法

#### 条件隐藏

```typescript
const items = [
  { prop: 'type', label: '类型', formtype: 'Select', span: 6,
    dataOptions: [{ label: '个人', value: 'personal' }, { label: '企业', value: 'company' }]
  },
  { prop: 'companyName', label: '企业名称', formtype: 'Input', span: 6,
    isHidden: (model) => model.type !== 'company'  // 类型不是企业时隐藏
  }
]
```

#### 异步数据加载

```typescript
const items = [
  { prop: 'category', label: '分类', formtype: 'Select', span: 6,
    apiParams: { url: '/api/categories', method: 'GET' },
    callOptionListFormat: (data) => data.map(item => ({ label: item.name, value: item.id }))
  }
]
```

#### 自定义渲染

```tsx
const items = [
  { prop: 'amount', label: '金额', span: 6,
    render: (h, model) => <span style="color: red">¥{model.amount?.toLocaleString()}</span>
  }
]
```

---

## EsTable 表格组件

配置化驱动的数据表格，内置分页、远程数据、跨页选择、自适应高度等功能。

### Props

| 属性 | 类型 | 默认值 | 说明 |
|------|------|--------|------|
| dataSource | `Record<string, unknown>[]` | `[]` | 表格数据（必填，支持 v-model） |
| columns | `TableColumn[]` | `[]` | 列配置数组（必填） |
| options | `TableOptions` | `{}` | 表格选项配置 |
| pagination | `PaginationConfig` | — | 分页配置（支持 v-model） |
| initTabHeight | `number` | `400` | 初始表格高度 |
| showHeaderBar | `boolean` | `true` | 是否显示头部栏区域 |
| headBarClass | `string \| Object` | — | 头部栏样式类 |

### TableColumn 配置

| 字段 | 类型 | 说明 |
|------|------|------|
| prop | `string` | 数据字段名 |
| key | `string` | 列唯一标识 |
| label | `string` | 列标题 |
| width | `number \| string` | 列宽度 |
| minWidth | `number \| string` | 最小列宽度 |
| align | `string` | 对齐方式 |
| fixed | `boolean \| string` | 固定列（`'left'` / `'right'`） |
| formatter | `(row) => string` | 格式化函数 |
| render | `(h, { row, value, index }) => VNode` | 自定义渲染函数 |
| scopedSlots | `{ customRender: string }` | 插槽配置 |
| groups | `TableColumn[]` | 多级表头子列 |
| ellipsis | `boolean` | 文本溢出省略 |
| hidCol | `boolean` | 是否隐藏该列 |
| btns | `Array<{ name, type?, clickEvent? }>` | 行操作按钮 |
| type | `string` | 特殊列类型（`'selection'`、`'expand'`、`'index'`） |

#### render 函数

```tsx
{
  prop: 'status', label: '状态', width: 100,
  render: (_, { row }) => {
    const map = { active: 'success', leave: 'warning', resigned: 'danger' }
    return <ElTag type={map[row.status]} size="small">{row.status}</ElTag>
  }
}
```

#### btns 行操作按钮

```typescript
{
  prop: 'operate', label: '操作', width: 160,
  btns: [
    { name: '编辑', type: 'primary', clickEvent: (row) => openEditDialog(row) },
    { name: '删除', type: 'danger', clickEvent: (row) => handleDelete(row) }
  ]
}
```

#### 多级表头

```typescript
{
  label: '基本信息',
  groups: [
    { prop: 'name', label: '姓名' },
    { prop: 'age', label: '年龄' },
    { label: '地址', groups: [
      { prop: 'province', label: '省份' },
      { prop: 'city', label: '城市' }
    ]}
  ]
}
```

### TableOptions 配置

| 字段 | 类型 | 默认值 | 说明 |
|------|------|--------|------|
| border | `boolean` | `false` | 是否显示边框 |
| stripe | `boolean` | `false` | 是否显示斑马纹 |
| size | `'large' \| 'default' \| 'small'` | `'small'` | 表格尺寸 |
| headerCellStyle | `Record<string, unknown>` | `{ background: '#f5f7fa' }` | 表头样式 |
| highlightCurrentRow | `boolean` | `true` | 高亮当前行 |
| multiSelect | `boolean` | `false` | 启用多选列 |
| expand | `boolean` | `false` | 启用展开行 |
| snIndex | `boolean` | `false` | 显示序号列 |
| loading | `boolean` | `false` | 加载状态 |
| heightType | `'height' \| 'auto'` | — | 高度类型（`'height'` 推荐，`'auto'` 为 maxHeight） |
| tabHeight | `number \| string` | — | 表格容器高度（配合 heightType 使用） |
| cachePageSelection | `boolean` | `true` | 启用跨页选择缓存 |
| rowkey | `string` | — | 行唯一标识字段名（跨页选择必填） |
| isInitRun | `boolean` | — | 初始化时是否自动请求数据 |
| httpRequest | `(params) => Promise` | — | 自定义请求方法 |
| apiParams | `ApiParams` | — | API 请求配置 |
| configTableOut | `Record<string, string>` | — | 响应字段映射 |
| listenToCallBack | `Record<string, Function>` | — | 请求/响应回调管线 |
| entryQuery | `Record<string, unknown>` | — | 默认查询参数 |
| actionUrl | `string` | — | 请求地址（简写） |

### configTableOut 字段映射

映射后端响应字段到表格内部使用的字段：

```typescript
configTableOut: {
  total: 'total',        // 总数对应的字段名
  tableData: 'data',     // 数据列表对应的字段名
  pageSize: 'pageSize',  // 每页条数对应的字段名
  current: 'pageIndex'   // 当前页码对应的字段名
}
```

> **注意**：`configTableOut` 的值应使用简单 key 名（如 `'total'`、`'list'`），不支持点号路径（如 `'result.pagination.total'`）。内部使用 `findValueByKey` 递归查找嵌套对象中的 key，无需写完整路径。

### listenToCallBack 回调管线

```typescript
listenToCallBack: {
  // 请求前回调（Before Request CallBack）— 转换请求参数
  brcb: (params) => {
    return { ...params, timestamp: Date.now() }
  },
  // 请求后回调（Query Result CallBack）— 转换响应数据
  qrcb: (res) => {
    if (!res?.data) return res
    return {
      ...res,
      data: res.data.map(item => ({
        id: item.emp_id,
        name: item.emp_name  // 后端蛇形字段转前端驼峰
      }))
    }
  }
}
```

### PaginationConfig 配置

| 字段 | 类型 | 说明 |
|------|------|------|
| pageSize | `number` | 每页条数 |
| current | `number` | 当前页码 |
| total | `number` | 总条数 |
| pageSizes | `number[]` | 每页条数选项 |
| size | `'large' \| 'default' \| 'small'` | 分页器尺寸 |
| isSmall | `boolean` | 使用小型分页器 |

### Events

| 事件 | 参数 | 说明 |
|------|------|------|
| update:dataSource | `(data)` | 数据更新 |
| update:pagination | `(pagination)` | 分页更新 |
| selection-change | `(rows)` | 选择变化（通过 fallthrough attrs 传递） |
| pagination-current-change | `(current)` | 页码变化 |
| size-change | `(pageSize)` | 每页条数变化 |
| change-table-sort | `(sort)` | 排序变化 |

### Methods（通过 ref 调用）

| 方法 | 说明 |
|------|------|
| `httpRequestInstance(model?)` | 手动触发表格数据请求，可传入额外查询参数 |
| `getSelectionRows()` | 获取当前选中行（含跨页缓存） |
| `clearSelection()` | 清除当前页选择 |
| `clearAllSelection()` | 清除所有页面选择（含跨页缓存） |
| `refresh()` | 强制重新计算表格布局（`doLayout`） |

### 高级用法

#### 远程数据请求

```typescript
const mockRequest = async (params) => {
  const { formParams, ...rest } = params || {}
  const { pageIndex = 1, pageSize = 10, ...filters } = { ...formParams, ...rest }
  const res = await fetch('/api/list')
  const data = await res.json()
  const total = data.length
  const start = (pageIndex - 1) * pageSize
  return { data: data.slice(start, start + pageSize), total, pageSize, pageIndex }
}

const options = {
  border: true,
  httpRequest: mockRequest,
  apiParams: { url: '/api/list', method: 'GET', model: queryModel },
  configTableOut: { total: 'total', tableData: 'data', pageSize: 'pageSize', current: 'pageIndex' },
  rowkey: 'id'
}
```

#### 跨页选择持久化

```vue
<es-table
  ref="tableRef"
  :columns="columns"
  :options="{ rowkey: 'id', cachePageSelection: true, multiSelect: true }"
  @selection-change="onSelectionChange"
/>

<script setup>
const tableRef = ref(null)
const selectedCount = ref(0)

const onSelectionChange = (rows) => {
  selectedCount.value = rows?.length || 0
}

function getSelected() {
  return tableRef.value?.getSelectionRows() || []
}

function clearSelected() {
  tableRef.value?.clearAllSelection()
}
</script>
```

#### 自适应高度

```typescript
const options = {
  heightType: 'height',  // 必须 'height'，非 'auto'
  tabHeight: 400         // 容器高度，表格自动 = 容器 - 表单 - 分页
}
```

> 表单展开/收起时，`ResizeObserver` 自动触发高度重算，无需手动监听。

#### 动态 options 需使用 `:key`

> es-table 的 `httpRequest`、`configTableOut`、`listenToCallBack` 等选项在挂载后不可动态响应。如需切换，请使用 `:key` 强制重建：

```vue
<es-table :key="activeFormat" :options="currentOptions" ... />
```

---

## EsDialog 弹窗组件

模板式增强弹窗，支持拖拽、全屏切换、自定义头尾等功能。

### Props

| 属性 | 类型 | 默认值 | 说明 |
|------|------|--------|------|
| title | `string` | — | 弹窗标题 |
| visible | `boolean` | `false` | 显示状态（支持 v-model） |
| width | `string \| number` | `'50%'` | 弹窗宽度 |
| isDraggable | `boolean` | `false` | 是否可拖拽 |
| fullscreen | `boolean` | `false` | 是否全屏 |
| hiddenFullBtn | `boolean` | `false` | 隐藏全屏切换按钮 |
| isHiddenFooter | `boolean` | `false` | 隐藏底部按钮区 |
| maxHeight | `string \| number` | — | 内容区最大高度 |
| appendTo | `string \| HTMLElement` | — | 挂载目标 |
| confirmText | `string` | — | 确认按钮文本 |
| cancelText | `string` | — | 取消按钮文本 |
| configBtn | `BtnConfig[]` | `[]` | 底部按钮配置 |
| render | `Function` | — | 自定义内容渲染函数 |
| renderHeader | `Function` | — | 自定义头部渲染函数 |
| renderFooter | `Function` | — | 自定义底部渲染函数 |

### Events

| 事件 | 说明 |
|------|------|
| update:visible | 显示状态变化 |
| closed | 弹窗关闭后触发 |
| submit | 点击确认时触发 |

---

## useDialog 编程式弹窗 Hook

命令式调用弹窗，支持 JSX 渲染、表单集成、嵌套弹窗等高级功能。

### 基本用法

```typescript
import { useDialog } from 'es-plus-ui'

const dialog = useDialog()

// 打开弹窗
dialog({
  title: '提示',
  width: '500px',
  render: (h) => <div>弹窗内容</div>,
  configBtn: [
    { name: '确定', type: 'primary', click: (_, { close }) => close() }
  ]
})
```

### DialogOptions 配置

| 参数 | 类型 | 默认值 | 说明 |
|------|------|--------|------|
| title | `string` | — | 弹窗标题 |
| width | `string \| number` | `'50%'` | 弹窗宽度 |
| key | `string` | — | 唯一标识（相同 key 复用实例） |
| height | `string \| number` | — | 弹窗高度 |
| maxHeight | `string \| number` | — | 内容区最大高度 |
| render | `(h, instance, components) => VNode` | — | 内容渲染函数 |
| renderHeader | `(h, instance) => VNode` | — | 头部渲染函数 |
| renderFooter | `(h, instance) => VNode` | — | 底部渲染函数 |
| configBtn | `BtnConfig[]` | `[]` | 底部按钮配置 |
| isDraggable | `boolean` | `false` | 是否可拖拽 |
| fullscreen | `boolean` | `false` | 是否全屏 |
| hiddenFullBtn | `boolean` | `false` | 隐藏全屏按钮 |
| isHiddenFooter | `boolean` | `false` | 隐藏底部 |
| center | `boolean` | — | 垂直居中 |
| closeOnClickModal | `boolean` | `false` | 点击遮罩关闭 |
| closeOnPressEscape | `boolean` | `false` | 按 ESC 关闭 |
| showClose | `boolean` | `true` | 显示关闭按钮 |
| destroyOnClose | `boolean` | — | 关闭时销毁 |
| showDefaultButtons | `boolean` | — | 显示默认确定/取消按钮 |
| loading | `boolean` | `false` | 加载状态 |
| customClass | `string` | — | 自定义样式类 |
| appendToBody | `boolean` | — | 挂载到 body |
| appendTo | `string \| HTMLElement` | — | 挂载目标 |
| modal | `boolean` | — | 显示遮罩 |
| lockScroll | `boolean` | — | 锁定滚动 |
| onlyInstance | `boolean` | — | 单实例模式（复用同一弹窗） |
| onSubmit | `(close) => void` | — | 提交回调 |
| onClosed | `() => void` | — | 关闭回调 |
| onOpen | `() => void` | — | 打开回调 |

### configBtn click 回调签名

```typescript
{
  name: '提交',
  type: 'primary',
  click: (instance, { close, getRefs, dialogVm }) => {
    // instance: 渲染组件的内部实例
    // close(): 关闭弹窗
    // getRefs(name): 获取通过 registerRef 注册的引用
    // dialogVm: 弹窗组件实例
  }
}
```

### registerRef + getRefs 模式

在 render 中使用 `registerRef` 注册引用，在 configBtn 的 click 中通过 `getRefs` 获取：

```tsx
dialog({
  title: '编辑',
  render: (h, { registerRef }) => (
    <EsForm
      ref={(el) => { if (el) registerRef('formRef', el) }}
      model={formData}
      formItemList={formItems}
    />
  ),
  configBtn: [
    { name: '取消', click: (_, { close }) => close() },
    { name: '提交', type: 'primary', click: (_, { close, getRefs }) => {
      const formRef = getRefs('formRef')
      formRef?.validate().then(() => {
        // 提交逻辑...
        close()
      })
    }}
  ]
})
```

### onlyInstance 模式

```typescript
// 默认：每次调用创建新弹窗
const dialog = useDialog()

// 单实例模式：复用同一弹窗，后续调用更新内容
const singleDialog = useDialog(null, { onlyInstance: true })
```

### 多实例独立弹窗

```typescript
// 创建多个独立弹窗，可同时打开
const dialog1 = useDialog()
const dialog2 = useDialog()

// 嵌套弹窗：父弹窗内打开子弹窗
dialog1({
  title: '父弹窗',
  render: (h) => (
    <div>
      <ElButton onClick={() => dialog2({ title: '子弹窗', render: (h) => <div>嵌套内容</div> })}>
        打开子弹窗
      </ElButton>
    </div>
  )
})
```

---

## SvgIcon 图标组件

支持外部 URL 图标和 SVG Symbol Sprite 的图标组件。

### Props

| 属性 | 类型 | 默认值 | 说明 |
|------|------|--------|------|
| iconClass | `string` | — | 图标名称或外部 URL（必填） |
| className | `string` | — | 额外样式类 |

### 使用

```vue
<!-- SVG Sprite 图标 -->
<svg-icon icon-class="user" />

<!-- 外部 URL 图标（自动检测 http/https 开头） -->
<svg-icon icon-class="https://example.com/icon.svg" />
```

---

## TypeScript 类型

es-plus-ui 导出以下 TypeScript 接口，可直接导入使用：

```typescript
import type {
  FormItemOption,
  BtnConfig,
  LayoutFormProps,
  TableColumn,
  TableOptions,
  PaginationConfig,
  DialogOptions,
  ApiParams,
  EsFormInstance,
  EsTableInstance
} from 'es-plus-ui'
```

| 接口 | 说明 |
|------|------|
| `FormItemOption` | 表单项配置 |
| `BtnConfig` | 按钮配置 |
| `LayoutFormProps` | 表单布局配置 |
| `TableColumn` | 表格列配置 |
| `TableOptions` | 表格选项配置 |
| `PaginationConfig` | 分页配置 |
| `DialogOptions` | 弹窗选项配置 |
| `ApiParams` | API 请求配置 |
| `EsFormInstance` | EsForm 暴露的方法类型 |
| `EsTableInstance` | EsTable 暴露的方法类型 |

---

## 表单+表格+弹窗联动

es-plus-ui 的核心优势在于 EsForm、EsTable、useDialog 三者的深度联动，实现配置即开发。

### 零代码查询

将 EsForm 放入 EsTable 的 default 插槽，按钮设置 `triggerEvent: true`，即可实现零事件代码的查询/重置：

```vue
<es-table
  :columns="columns"
  :options="tableOptions"
  v-model:data-source="tableData"
  v-model:pagination="pagination"
>
  <es-form
    :model="queryModel"
    :form-item-list="queryItems"
    :config-btn="queryBtns"
  />
</es-table>
```

```typescript
const queryModel = reactive({ keyword: '', status: '' })
const queryItems = [
  { prop: 'keyword', label: '关键词', formtype: 'Input', span: 6 },
  { prop: 'status', label: '状态', formtype: 'Select', span: 6, dataOptions: [...] }
]
const queryBtns = [
  { name: '查询', type: 'primary', key: 'query', triggerEvent: true },
  { name: '重置', key: 'rest', triggerEvent: true }
]
const tableOptions = {
  httpRequest: mockRequest,
  apiParams: { url: '/api/list', method: 'GET', model: queryModel },
  configTableOut: { total: 'total', tableData: 'data', pageSize: 'pageSize', current: 'pageIndex' }
}
```

> `triggerEvent: true` + `key: 'query'` → EsForm 自动调用父级 EsTable 的 `httpRequestInstance`；`key: 'rest'` → 自动重置表单。

### CRUD 弹窗

useDialog + JSX EsForm 实现增/编辑弹窗：

```tsx
const dialog = useDialog()

function openEditDialog(row) {
  const formData = reactive({ ...row })
  dialog({
    title: '编辑',
    width: '600px',
    render: (h, { registerRef }) => (
      <EsForm
        ref={(el) => { if (el) registerRef('formRef', el) }}
        model={formData}
        formItemList={[
          { prop: 'name', label: '名称', formtype: 'Input', span: 24 },
          { prop: 'status', label: '状态', formtype: 'Select', span: 24, dataOptions: [...] }
        ]}
      />
    ),
    configBtn: [
      { name: '取消', click: (_, { close }) => close() },
      { name: '保存', type: 'primary', click: (_, { close, getRefs }) => {
        getRefs('formRef')?.validate().then(() => {
          // 保存逻辑...
          close()
          tableRef.value?.httpRequestInstance()  // 刷新表格
        })
      }}
    ]
  })
}
```

### 弹窗内嵌套表格

```tsx
dialog({
  title: '选择商品',
  width: '800px',
  render: (h, { registerRef }) => (
    <EsTable
      ref={(el) => { if (el) registerRef('tableRef', el) }}
      dataSource={productList}
      columns={productColumns}
      options={{ border: true, multiSelect: true, rowkey: 'id' }}
      @selection-change={(rows) => selectedRows = rows}
    />
  ),
  configBtn: [
    { name: '取消', click: (_, { close }) => close() },
    { name: '确定', type: 'primary', click: (_, { close, getRefs }) => {
      const selection = getRefs('tableRef')?.getSelectionRows() || []
      // 处理选中数据...
      close()
    }}
  ]
})
```

---

## 常见问题

### CSS 未加载

确保引入了样式文件：`import 'es-plus-ui/dist/style.css'`

### 图标不显示

确保安装了 `@element-plus/icons-vue`：`npm install @element-plus/icons-vue`

### 表格高度不自适应

1. 设置 `heightType: 'height'`（不是 `'auto'`）
2. 设置 `tabHeight` 为容器高度
3. 确保父容器有固定高度

### configTableOut 映射不生效

使用简单 key 名（如 `'total'`、`'list'`），不要使用点号路径（如 `'result.pagination.total'`）。内部 `findValueByKey` 会递归查找嵌套对象。

### 切换 options 无效

es-table 的 `httpRequest`、`configTableOut`、`listenToCallBack` 等选项在挂载后不可响应。使用 `:key` 强制重建：

```vue
<es-table :key="activeFormat" :options="currentOptions" ... />
```

### httpRequest 参数格式

es-table 传给 `httpRequest` 的参数格式为：

```typescript
{
  url: string,
  method: string,
  headers: Record<string, string>,
  formParams: Record<string, unknown>,  // 合并后的查询参数
  pageIndex: number,
  pageSize: number
}
```

mockRequest 中应使用此模式解构：

```typescript
const mockRequest = async (params) => {
  const { formParams, ...rest } = params || {}
  const { pageIndex = 1, pageSize = 10, ...filters } = { ...formParams, ...rest }
  // ...
}
```

### 选择变化不触发 computed 更新

`getSelectionRows()` 在 computed 中不是响应式的。请使用 `@selection-change` 事件 + ref：

```typescript
const selectedCount = ref(0)
const handleSelectionChange = (rows) => {
  selectedCount.value = rows?.length || 0
}
```

---

## 权限控制

安装时配置权限函数，按钮自动按权限显隐，无需 v-if：

```typescript
app.use(ESPlus, {
  permission: (value) => userPermissions.includes(value)
})
```

在任意 `BtnConfig` 中声明 `permissionValue`：

```typescript
const btns = [
  { name: '新增', type: 'primary', permissionValue: 'user:add', click: () => add() },
  { name: '删除', type: 'danger', permissionValue: 'user:delete', click: (row) => del(row) }
]
// 用户无 'user:delete' 权限时，删除按钮自动隐藏
```

适用于 EsForm `configBtn`、EsTable `configBtn`、表格列 `btns`、useDialog `configBtn`。

---

## 国际化（i18n）

安装时配置翻译函数，兼容任意 i18n 库：

```typescript
app.use(ESPlus, {
  t: (key) => i18n.global.t(key)
})
```

表单项和表格列使用 `labelKey` 字段：

```typescript
const formItems = [
  { prop: 'name', label: '姓名', labelKey: 'form.name', formtype: 'Input' }
]
const columns = [
  { prop: 'name', label: '姓名', labelKey: 'table.name' }
]
// 有 labelKey 且配置了 t 函数时，使用 t(labelKey)；否则回退到 label
```

---

## EsCrudPage — 一键 CRUD 页面

传入 Schema 即可生成完整的查询表单 + 数据表格 + 弹窗编辑页面：

```vue
<template>
  <es-crud-page :schema="schema" :http-request="fetchList" />
</template>

<script setup>
const schema = {
  formItems: [
    { prop: 'name', label: '姓名', formtype: 'Input', span: 6 },
    { prop: 'status', label: '状态', formtype: 'Select', span: 6,
      dataOptions: [{ label: '启用', value: 1 }, { label: '禁用', value: 0 }] }
  ],
  columns: [
    { prop: 'name', label: '姓名' },
    { prop: 'status', label: '状态' }
  ],
  actions: ['add', 'edit', 'delete']
}
</script>
```

```typescript
import type { CrudPageSchema, CrudAction } from 'es-plus-ui'
```

---

## AI 工具链

ES-Plus 配套两个官方 AI 工具，支持自然语言生成完整 CRUD 页面：

### @es-plus/mcp-server

让 Claude Code、Cursor 等 AI 编码工具直接调用 CRUD 生成能力：

```bash
claude mcp add es-plus -- npx -y @es-plus/mcp-server
```

在 AI 对话中直接说"生成一个用户管理页面"，AI 自动调用 MCP Server 生成完整 .vue 文件。

详见：[@es-plus/mcp-server](https://www.npmjs.com/package/@es-plus/mcp-server)

### @es-plus/cli

终端生成 CRUD 页面、校验配置、生成脚手架：

```bash
npx @es-plus/cli create user-management
npx @es-plus/cli validate ./config.json --schema form-item
npx @es-plus/cli scaffold dashboard --features query,table,dialog
```

详见：[@es-plus/cli](https://www.npmjs.com/package/@es-plus/cli)

---

## 更新日志

### v1.3.0

- 新增 `EsPlusResolver` — 适配 `unplugin-vue-components` 按需导入场景，自动注入 ES-Plus 内部依赖的 Element Plus 组件样式
- 新增 `es-plus-ui/resolver` 子路径导出（支持 ESM/CJS + TypeScript 类型）
- 修复组件注册失败问题 — EsTable、EsDialog、SvgIcon 补充 `defineOptions({ name })` 声明，打包后 `component.name` 不再为 undefined

### v1.2.0

- 导出全部 TypeScript 类型定义（FormItemOption、TableColumn 等 11 个核心接口）
- 新增 EsCrudPage 一键 CRUD 页面组件
- 新增权限控制（permissionValue 声明式按钮权限）
- 新增国际化支持（labelKey + 自定义翻译函数）
- 新增 @es-plus/mcp-server AI 编码工具集成
- 新增 @es-plus/cli 命令行工具
- 修复 EsForm 按钮模板嵌套问题
- 修复 EsDialog v-if/v-for 优先级问题

### v1.0.0

- 初始发布
- EsForm 配置化表单组件
- EsTable 配置化表格组件
- EsDialog 增强弹窗组件
- useDialog 编程式弹窗 Hook
- SvgIcon 图标组件

## License

MIT
