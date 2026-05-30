# ES-Plus

企业级 CRUD 组件库 —— 配置驱动、表单表格弹窗全链路联动、AI 原生支持。**同时支持 Vue 3 + Element Plus 和 Vue 2 + Element UI**，同一份配置两个渲染器通用。

中文 | [English](./README.en.md)

[![@es-plus/vue3](https://img.shields.io/npm/v/%40es-plus%2Fvue3.svg?label=%40es-plus%2Fvue3)](https://www.npmjs.com/package/@es-plus/vue3)
[![@es-plus/vue2](https://img.shields.io/npm/v/%40es-plus%2Fvue2.svg?label=%40es-plus%2Fvue2)](https://www.npmjs.com/package/@es-plus/vue2)
[![@es-plus/core](https://img.shields.io/npm/v/%40es-plus%2Fcore.svg?label=%40es-plus%2Fcore)](https://www.npmjs.com/package/@es-plus/core)
[![license](https://img.shields.io/npm/l/%40es-plus%2Fvue3.svg)](https://www.npmjs.com/package/@es-plus/vue3)
[![GitHub stars](https://img.shields.io/github/stars/liujiaao/es-plus?style=social)](https://github.com/liujiaao/es-plus)

**[在线文档](https://liujiaao.github.io/es-plus/)** · **[Playground](https://liujiaao.github.io/es-plus/#/playground)** · **[AI CRUD 生成器](https://liujiaao.github.io/es-plus/#/ai-crud)** · **[更新日志](https://github.com/liujiaao/es-plus/releases)** · **[v1.4 迁移指南](./docs/migrate-v1.4.md)**

> **v1.4.0 起重命名**：`es-plus-ui` 已重命名为 [`@es-plus/vue3`](https://www.npmjs.com/package/@es-plus/vue3)，同时新增 Vue 2 渲染器 [`@es-plus/vue2`](https://www.npmjs.com/package/@es-plus/vue2) 与框架无关的 [`@es-plus/core`](https://www.npmjs.com/package/@es-plus/core)。原 `es-plus-ui` 包继续作为 stub 包工作，详见 [迁移指南](./docs/migrate-v1.4.md)。

---

## 为什么选择 ES-Plus

中后台系统 80% 的页面是 CRUD：表单查询 → 表格展示 → 弹窗编辑。用原生 Element Plus 每个页面需要 200+ 行模板代码，用 ES-Plus 只需 **30 行配置**。

| 传统写法 | ES-Plus |
|---------|---------|
| 每个字段 5-8 行 `<el-form-item>` + `<el-input>` | 一行配置 `{ prop, label, formtype }` |
| 手动 `v-model` 绑定每个字段 | 自动绑定到 `model` |
| 手动 `@click` 查询 + `resetFields()` 重置 | `triggerEvent: true` 全自动 |
| 模板声明 `<el-dialog v-model="visible">` | 函数调用 `dialog({ title, render })` |
| 手动编写分页事件处理 | 分页切换自动触发请求 |

**减少 70% 代码量，零事件处理代码。**

---

## 核心特性

- **配置驱动** — JSON 配置生成表单、表格、弹窗，替代大量模板代码
- **全链路联动** — EsForm 嵌套在 EsTable 中，查询/重置/分页全自动联动
- **编程式弹窗** — `useDialog()` 命令式调用，JSX 渲染，表单验证集成
- **13 种表单控件** — Input、Select、datePicker、timePicker、Cascader、Radio、Checkbox、Switch、Slider、Rate、ColorPicker、Transfer、Upload
- **自适应高度** — ResizeObserver 自动重算表格高度
- **跨页选择** — `cachePageSelection` 分页切换保留勾选
- **任意后端适配** — `configTableOut` 配置化映射 API 响应字段
- **权限控制** — `permissionValue` 声明式按钮权限，无需 v-if
- **国际化** — `labelKey` + 自定义翻译函数，兼容任意 i18n 方案
- **TypeScript** — 完整类型定义，11 个核心接口可导入
- **AI 原生支持** — 配套 MCP Server 和 CLI 工具，自然语言生成完整页面

---

## 快速开始

### 安装（Vue 3）

```bash
npm install @es-plus/vue3 element-plus @element-plus/icons-vue
```

### 注册插件（Vue 3）

```typescript
import { createApp } from 'vue'
import ElementPlus from 'element-plus'
import 'element-plus/dist/index.css'
import ESPlus from '@es-plus/vue3'
import '@es-plus/vue3/dist/style.css'
import App from './App.vue'

const app = createApp(App)
app.use(ElementPlus)
app.use(ESPlus)
app.mount('#app')
```

### Vue 2 项目？

```bash
npm install @es-plus/vue2 element-ui
# Vue 2.6 还需要 @vue/composition-api
```

参见 [`@es-plus/vue2` README](./packages/vue2/README.md)，配置 API 与 Vue 3 版本完全一致。

### 第一个 CRUD 页面

```vue
<template>
  <es-table
    ref="tableRef"
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

const form = reactive({ name: '', status: '' })
const tableData = ref([])
const pagination = ref({ current: 1, pageSize: 10, total: 0 })

const formItems = [
  { prop: 'name', label: '姓名', formtype: 'Input', span: 6, attrs: { clearable: true } },
  { prop: 'status', label: '状态', formtype: 'Select', span: 6,
    dataOptions: [{ label: '启用', value: 1 }, { label: '禁用', value: 0 }] }
]

const btns = [
  { name: '查询', type: 'primary', key: 'query', triggerEvent: true },
  { name: '重置', key: 'rest', triggerEvent: true }
]

const columns = [
  { prop: 'name', label: '姓名' },
  { prop: 'status', label: '状态' },
  { prop: 'operate', label: '操作',
    btns: [
      { name: '编辑', type: 'primary', clickEvent: (row) => edit(row) },
      { name: '删除', type: 'danger', clickEvent: (row) => del(row) }
    ] }
]

const options = {
  border: true,
  stripe: true,
  httpRequest: async (params) => {
    // 替换为你的 API 调用
    const res = await fetch('/api/list', { method: 'POST', body: JSON.stringify(params.formParams) })
    return res.json()
  },
  configTableOut: { total: 'total', tableData: 'data', pageSize: 'pageSize', current: 'pageIndex' }
}
</script>
```

> EsForm 嵌套在 EsTable 中，查询/重置/分页全自动联动，**零事件处理代码**。

---

## 联动机制

```
┌───────────────────────────────────────────────┐
│  EsTable（通过 provide/inject 提供表格实例）     │
│  ┌─────────────────────────────────────────┐  │
│  │  EsForm（自动发现父级 EsTable）           │  │
│  │  [查询] → 自动调用 table.httpRequest()   │  │
│  │  [重置] → 重置表单 + 重新查询             │  │
│  └─────────────────────────────────────────┘  │
│  ┌─────────────────────────────────────────┐  │
│  │  表格数据（自动分页）                     │  │
│  └─────────────────────────────────────────┘  │
│  ┌─────────────────────────────────────────┐  │
│  │  分页器（翻页自动触发 httpRequest）       │  │
│  └─────────────────────────────────────────┘  │
└───────────────────────────────────────────────┘
```

EsForm 放在 EsTable 的默认插槽中，通过 Vue 的 provide/inject 自动发现父级表格。按钮配置 `triggerEvent: true` 后，自动调用表格的数据请求方法，无需手动连接。

---

## 组件一览

| 组件 | 说明 | 典型场景 |
|------|------|---------|
| **EsForm** | 配置化表单 | 查询表单、弹窗编辑表单、筛选条件 |
| **EsTable** | 配置化表格 | 数据列表、跨页多选、多级表头 |
| **useDialog** | 编程式弹窗 | 新增/编辑弹窗、详情查看、嵌套弹窗 |
| **EsDialog** | 增强弹窗组件 | 拖拽、全屏切换、自定义头部/底部 |
| **EsCrudPage** | CRUD 页面组件 | 传入 Schema 一键生成完整 CRUD 页面 |
| **SvgIcon** | SVG 图标 | 图标展示 |

---

## EsForm 表单配置

```typescript
const formItems = [
  // 文本输入
  { prop: 'name', label: '姓名', formtype: 'Input', span: 6 },
  // 下拉选择（静态选项）
  { prop: 'status', label: '状态', formtype: 'Select', span: 6,
    dataOptions: [{ label: '启用', value: 1 }, { label: '禁用', value: 0 }] },
  // 日期范围
  { prop: 'date', label: '日期', formtype: 'datePicker', span: 8,
    attrs: { type: 'daterange', valueFormat: 'YYYY-MM-DD' } },
  // 远程数据加载
  { prop: 'category', label: '分类', formtype: 'Select', span: 6,
    apiParams: { url: '/api/categories' },
    callOptionListFormat: (data) => data.map(i => ({ label: i.name, value: i.id })) },
  // 条件显隐
  { prop: 'remark', label: '备注', formtype: 'Input', span: 12,
    attrs: { type: 'textarea' },
    isHidden: (model) => model.status !== 1 }
]
```

### 核心配置项

| 字段 | 类型 | 说明 |
|------|------|------|
| `prop` | `string` | 字段名（必填） |
| `label` | `string` | 标签（必填） |
| `formtype` | `string` | 控件类型（13 种） |
| `span` | `number` | 栅格列宽（1-24） |
| `attrs` | `object` | 透传到 Element Plus 组件 |
| `dataOptions` | `array` | Select/Radio/Checkbox 选项 |
| `isHidden` | `(model) => boolean` | 条件显隐 |
| `render` | `(h, model) => VNode` | 自定义渲染 |
| `apiParams` | `object` | 远程加载选项数据 |
| `labelKey` | `string` | i18n 翻译键 |

---

## EsTable 表格配置

```typescript
const columns = [
  { prop: 'name', label: '姓名' },
  { prop: 'amount', label: '金额', formatter: (row) => `¥${row.amount.toFixed(2)}` },
  // 自定义渲染
  { prop: 'status', label: '状态',
    render: (_, { row }) => h(ElTag,
      { type: row.status === 1 ? 'success' : 'danger' },
      () => row.status === 1 ? '启用' : '禁用') },
  // 操作按钮（prop 必须为 'operate'）
  { prop: 'operate', label: '操作',
    btns: [
      { name: '编辑', type: 'primary', clickEvent: (row) => openForm('编辑', row) },
      { name: '删除', type: 'danger', clickEvent: (row) => handleDelete(row) }
    ] }
]

const options = {
  border: true,
  stripe: true,
  highlightCurrentRow: true,
  httpRequest: fetchList,
  configTableOut: { total: 'total', tableData: 'records', pageSize: 'size', current: 'page' },
  rowkey: 'id',
  cachePageSelection: true
}
```

### 后端响应映射

后端返回 `{ result: { items: [...], count: 50 } }`？只需配置：

```typescript
configTableOut: { total: 'count', tableData: 'items', pageSize: 'pageSize', current: 'pageIndex' }
```

组件会递归查找响应中的字段，适配任意嵌套结构。

### 请求/响应拦截

```typescript
options: {
  listenToCallBack: {
    brcb: (params) => ({ ...params, token: getToken() }),   // 请求前拦截
    qrcb: (response) => transformResponse(response)          // 响应后转换
  }
}
```

---

## useDialog 编程式弹窗

```tsx
import { useDialog } from '@es-plus/vue3'

const dialog = useDialog()

function openEditForm(row) {
  const formData = reactive({ ...row })
  dialog({
    title: '编辑用户',
    width: '500px',
    render: (h, { registerRef }) => (
      <EsForm
        ref={el => el && registerRef('form', el)}
        model={formData}
        formItemList={[
          { prop: 'name', label: '姓名', formtype: 'Input', span: 24 },
          { prop: 'email', label: '邮箱', formtype: 'Input', span: 24 }
        ]}
      />
    ),
    configBtn: [
      { name: '取消', click: (_, { close }) => close() },
      { name: '确定', type: 'primary', click: async (_, { close, getRefs }) => {
        try {
          await getRefs('form')?.validate()
          await api.updateUser(formData)
          close()
        } catch { /* 表单验证失败 */ }
      }}
    ]
  })
}
```

---

## 权限控制

安装时配置权限函数，按钮自动按权限显隐：

```typescript
app.use(ESPlus, {
  permission: (value) => userPermissions.includes(value)
})
```

```typescript
// 按钮配置中声明权限标识
const btns = [
  { name: '新增', type: 'primary', permissionValue: 'user:add', click: () => add() },
  { name: '删除', type: 'danger', permissionValue: 'user:delete', click: (row) => del(row) }
]
// 无 'user:delete' 权限时，删除按钮自动隐藏，无需 v-if
```

---

## 国际化

安装时配置翻译函数，配合任意 i18n 库：

```typescript
import { useI18n } from 'vue-i18n'

app.use(ESPlus, {
  t: (key) => useI18n().t(key)
})
```

```typescript
const formItems = [
  { prop: 'name', label: '姓名', labelKey: 'form.name', formtype: 'Input' }
]
// 有 labelKey 时使用 t(labelKey) 翻译，否则回退到 label
```

---

## TypeScript 类型

```typescript
import type {
  FormItemOption,    // 表单项配置
  BtnConfig,         // 按钮配置
  LayoutFormProps,   // 表单布局配置
  TableColumn,       // 表格列配置
  TableOptions,      // 表格选项
  PaginationConfig,  // 分页配置
  DialogOptions,     // 弹窗选项
  ApiParams,         // 接口参数
  EsFormInstance,    // 表单实例方法
  EsTableInstance,   // 表格实例方法
  EsPlusOptions      // 全局配置
} from '@es-plus/vue3'
```

> 跨 Vue 2 / Vue 3 共享类型时，从 `@es-plus/core/types` 导入 — 同一份 `columns` / `formItemList` 在两个渲染器中通用。

---

## AI 工具链

ES-Plus 从设计上拥抱 AI 编码，配套两个官方工具：

### @es-plus/mcp-server — AI 编码工具集成

让 Claude Code、Cursor 等 AI 工具直接调用 CRUD 生成能力：

```bash
# Claude Code 一行配置
claude mcp add es-plus -- npx -y @es-plus/mcp-server
```

然后在 AI 对话中直接说：

> "生成一个用户管理页面，查询姓名、手机号、状态，表格显示姓名、邮箱、状态、创建时间，支持新增编辑删除"

AI 自动调用 MCP Server 生成完整可运行的 .vue 文件。

### @es-plus/cli — 命令行工具

终端直接生成 CRUD 页面：

```bash
# 交互式生成
npx @es-plus/cli create user-management

# 非交互式
npx @es-plus/cli create user-management \
  -d "用户管理，查询姓名、手机号、状态，表格显示姓名、手机号、邮箱、状态、创建时间，支持新增编辑删除"

# 校验 JSON 配置
npx @es-plus/cli validate ./config.json --schema form-item

# 生成页面脚手架
npx @es-plus/cli scaffold dashboard --features query,table,dialog
```

---

## 全局配置

```typescript
app.use(ESPlus, {
  // 权限控制
  permission: (value) => userPermissions.includes(value),
  // 国际化
  t: (key) => i18n.global.t(key),
  // 表格全局默认配置
  EsTable: {
    methods: {
      $httpRequest: async (params) => axios(params).then(r => r.data),
      configQueryFieldOutput: () => ({
        total: 'total', tableData: 'data', pageSize: 'pageSize', current: 'pageIndex'
      }),
      paginationLayout: () => ({
        layout: 'total, sizes, prev, pager, next, jumper',
        pageSizes: [10, 20, 50, 100]
      })
    }
  }
})
```

---

## 项目结构

```
es-plus/
├── packages/
│   ├── es-plus/          # Vue 3 渲染器源码（npm: @es-plus/vue3）
│   ├── vue2/             # Vue 2 渲染器源码（npm: @es-plus/vue2）
│   ├── core/             # 框架无关核心层（npm: @es-plus/core）
│   ├── es-plus-legacy/   # 兼容 stub（npm: es-plus-ui，re-export @es-plus/vue3）
│   ├── shared/           # MCP/CLI 共享逻辑
│   ├── mcp-server/       # MCP Server（npm: @es-plus/mcp-server）
│   └── cli/              # CLI 工具（npm: @es-plus/cli）
├── es-plus-docs/         # 文档站点（Vite + Vue 3）
└── docs/                 # 设计文档与迁移指南
```

## 本地开发

```bash
# Vue 3 组件库构建
cd packages/vue3 && npm install && npm run build

# Vue 2 组件库构建
cd packages/vue2 && npm install && npm run build

# 文档站点开发
cd es-plus-docs && npm install && npm run dev

# 运行测试
cd packages/vue3 && npm test
cd packages/core && npm test
```

## 相关链接

| 包 | 说明 | 链接 |
|---|---|---|
| `@es-plus/vue3` | Vue 3 + Element Plus 渲染器 | [npm](https://www.npmjs.com/package/@es-plus/vue3) |
| `@es-plus/vue2` | Vue 2 + Element UI 渲染器 | [npm](https://www.npmjs.com/package/@es-plus/vue2) |
| `@es-plus/core` | 框架无关核心层（类型/工具/算法） | [npm](https://www.npmjs.com/package/@es-plus/core) |
| `@es-plus/mcp-server` | AI 编码工具集成 | [npm](https://www.npmjs.com/package/@es-plus/mcp-server) |
| `@es-plus/cli` | 命令行工具 | [npm](https://www.npmjs.com/package/@es-plus/cli) |
| `es-plus-ui` (deprecated) | 已迁移至 `@es-plus/vue3` | [迁移指南](./docs/migrate-v1.4.md) |
| 在线文档 | 完整 API 与示例 | [文档](https://liujiaao.github.io/es-plus/) |

## 贡献

欢迎提交 Issue 和 Pull Request！

1. Fork 本仓库
2. 创建功能分支：`git checkout -b feature/your-feature`
3. 提交更改：`git commit -m 'feat: add your feature'`
4. 推送分支：`git push origin feature/your-feature`
5. 提交 Pull Request

## License

[MIT](LICENSE)
