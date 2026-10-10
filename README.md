# ES-Plus

让 AI 生成的 CRUD 页面**可以直接合进代码库**：LLM 只写一份 JSON 配置，ES-Plus 负责 Schema 校验 + 确定性编译，一次产出 **Vue 3 + Element Plus / Vue 2 + Element UI / Vue 3 + Ant Design Vue** 三套可运行代码 —— 同一份配置、三端一致、可复现。

中文 | [English](./README.en.md)

[![@es-plus/vue3](https://img.shields.io/npm/v/%40es-plus%2Fvue3.svg?label=%40es-plus%2Fvue3)](https://www.npmjs.com/package/@es-plus/vue3)
[![@es-plus/vue2](https://img.shields.io/npm/v/%40es-plus%2Fvue2.svg?label=%40es-plus%2Fvue2)](https://www.npmjs.com/package/@es-plus/vue2)
[![@es-plus/adapter-antdv](https://img.shields.io/npm/v/%40es-plus%2Fadapter-antdv.svg?label=%40es-plus%2Fadapter-antdv)](https://www.npmjs.com/package/@es-plus/adapter-antdv)
[![@es-plus/core](https://img.shields.io/npm/v/%40es-plus%2Fcore.svg?label=%40es-plus%2Fcore)](https://www.npmjs.com/package/@es-plus/core)
[![license](https://img.shields.io/npm/l/%40es-plus%2Fvue3.svg)](https://www.npmjs.com/package/@es-plus/vue3)
[![GitHub stars](https://img.shields.io/github/stars/liujiaao/es-plus?style=social)](https://github.com/liujiaao/es-plus)
[![heldout accuracy](https://img.shields.io/endpoint?url=https%3A%2F%2Fraw.githubusercontent.com%2Fliujiaao%2Fes-plus%2Fmaster%2F__tests__%2Fgolden%2Flast-accuracy-badge.json)](./docs/internal/wave-1-eval-trust-design.md)

<sub>准确率徽章 = 夜间 Layer-2 评估对 golden 语料**留出集**（few-shot 未见域、已排除近变体）实测的 in-schema intent「零编辑」命中率，门禁即此数；**不是营销数字**。语料目前 25 例，是回归哨兵而非统计显著的 benchmark，提升靠补语料而非调口径。</sub>

**[在线文档](https://liujiaao.github.io/es-plus/)** · **[Playground](https://liujiaao.github.io/es-plus/#/playground)** · **[AI CRUD 生成器](https://liujiaao.github.io/es-plus/#/ai-crud)** · **[更新日志](https://github.com/liujiaao/es-plus/releases)** · **[v1.4 迁移指南](./docs/migrate-v1.4.md)**

> **v1.4.0 起重命名**：`es-plus-ui` 已重命名为 [`@es-plus/vue3`](https://www.npmjs.com/package/@es-plus/vue3)，同时新增 Vue 2 渲染器 [`@es-plus/vue2`](https://www.npmjs.com/package/@es-plus/vue2) 与框架无关的 [`@es-plus/core`](https://www.npmjs.com/package/@es-plus/core)。原 `es-plus-ui` 包继续作为 stub 包工作，详见 [迁移指南](./docs/migrate-v1.4.md)。

---

## 为什么选择 ES-Plus

2026 年用 AI 生成前端早不稀奇，稀奇的是**敢不敢把生成结果直接合并**。多数 AI codegen 是「凭感觉」：每次输出都不一样、对不上你的设计系统、没人替它校验 —— 于是你还得逐行 review、改、再 review。

ES-Plus 把这件事反过来做：**让 LLM 只做它擅长的语义推理（需求 → 一份配置），把「生成正确代码」这件必须确定的事交给编译器**。

- **LLM 产出配置，不产出代码** —— 通过 MCP 把 Schema/约定交给宿主 LLM（Claude Code / Cursor），它只输出一份 JSON
- **库做校验** —— zod + JSON Schema 在编译前拦下非法配置，坏配置到不了产物
- **确定性编译** —— 同一份配置永远编译出字节级相同的三端代码，golden 用例语料 × 多类确定性不变量 + esbuild 真语法解析在 CI 守着
- **三端一致** —— 一份配置通吃 Vue 3 + Element Plus、Vue 2 + Element UI、Vue 3 + Ant Design Vue

而且它首先是个**好用的 CRUD 库**：中后台系统 80% 的页面是 CRUD —— 表单查询 → 表格展示 → 弹窗编辑。用原生 Element Plus 每个页面需要 200+ 行模板代码，用 ES-Plus 只需 **30 行配置**。

| 传统写法 | ES-Plus |
|---------|---------|
| 每个字段 5-8 行 `<el-form-item>` + `<el-input>` | 一行配置 `{ prop, label, formtype }` |
| 手动 `v-model` 绑定每个字段 | 自动绑定到 `model` |
| 手动 `@click` 查询 + `resetFields()` 重置 | `triggerEvent: true` 全自动 |
| 模板声明 `<el-dialog v-model="visible">` | 函数调用 `dialog({ title, render })` |
| 手动编写分页事件处理 | 分页切换自动触发请求 |

**同一页面、同一功能范围：模板与事件胶水代码减少 76.5%（115 → 27 行），整页非空行减少 44.1%（136 → 76 行）；查询 / 重置 / 翻页 / 取数零事件代码。**

> 数字由 `npm run one-config:gen` 从 `docs/brand/one-config/{native,esplus}.vue` 实测得出，
> 由 `npm run check:site-claims` 守住院线。口径：模板区行数 + `handle*`/`fetch*` 事件与取数函数行数。

---

## 核心特性

- **配置驱动** — JSON 配置生成表单、表格、弹窗，替代大量模板代码
- **全链路联动** — EsForm 嵌套在 EsTable 中，查询/重置/分页全自动联动
- **编程式弹窗** — `useDialog()` 命令式调用，JSX 渲染，表单验证集成
- **14 种表单控件** — Input、InputNumber、Select、DatePicker、TimePicker、Cascader、Radio、Checkbox、Switch、Slider、Rate、ColorPicker、Transfer、Upload
- **自适应高度** — ResizeObserver 自动重算表格高度
- **跨页选择** — `cachePageSelection` 分页切换保留勾选
- **任意后端适配** — `configTableOut` 配置化映射 API 响应字段
- **权限控制** — `permissionValue` 声明式按钮权限，无需 v-if
- **国际化** — `labelKey` + 自定义翻译函数，兼容任意 i18n 方案
- **TypeScript** — 完整类型定义 + 35 个跨渲染器契约类型（CI 强制三端同构导出，数量由 `check:readme` 校验）
- **AI 原生支持** — 配套 MCP Server 和 CLI：MCP 通过协议把 Schema/约定交给宿主 LLM（Claude Code/Cursor）做语义推理，es-plus 负责约束校验 + 确定性编译成可运行页面

---

## 快速开始

### 一行起步（推荐）

```bash
npm create es-plus@latest
```

交互式选渲染器（Vue 3 + Element Plus / Vue 2 + Element UI / Vue 3 + Ant Design Vue），可选一键写入 MCP（AI 生成）配置，产出一个**装上就能跑**的 CRUD 示例项目（查询表单 + 表格，零后端）。CI 用脚手架 smoke 守着三端 `scaffold → install → build` 全绿。详见 [`create-es-plus`](./packages/create-es-plus/README.md)。

想手动集成到已有项目，继续往下看。

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

### Ant Design Vue 项目？

```bash
npm install @es-plus/adapter-antdv ant-design-vue @ant-design/icons-vue dayjs
```

```typescript
import { createApp } from 'vue'
import Antd from 'ant-design-vue'
import 'ant-design-vue/dist/reset.css'
import ESPlus from '@es-plus/adapter-antdv'
import '@es-plus/adapter-antdv/dist/style.css'

const app = createApp(App)
app.use(Antd)
app.use(ESPlus)
app.mount('#app')
```

[`@es-plus/adapter-antdv`](./packages/adapter-antdv/README.md) 是 Ant Design Vue 4.x 渲染适配器，**与 `@es-plus/vue3` 共享同一份 JSON 配置 Schema**，配置 API 完全一致，仅底层 UI 组件不同。详见 [adapter-antdv 文档](./packages/adapter-antdv/README.md)。

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
| `formtype` | `string` | 控件类型（14 种） |
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

> 跨 Vue 2 / Vue 3 / AntDV 共享类型时，从 `@es-plus/core/types` 导入 — 同一份 `columns` / `formItemList` 在三个渲染器中通用。

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
│   ├── vue3/             # Vue 3 + Element Plus 渲染器（npm: @es-plus/vue3）
│   ├── vue2/             # Vue 2 + Element UI 渲染器（npm: @es-plus/vue2）
│   ├── adapter-antdv/    # Vue 3 + Ant Design Vue 渲染器（npm: @es-plus/adapter-antdv）
│   ├── core/             # 框架无关核心层（npm: @es-plus/core）
│   ├── es-plus-legacy/   # 兼容 stub（npm: es-plus-ui，re-export @es-plus/vue3）
│   ├── shared/           # MCP/CLI 共享逻辑（npm: @es-plus/shared）
│   ├── mcp-server/       # MCP Server（npm: @es-plus/mcp-server）
│   └── cli/              # CLI 工具（npm: @es-plus/cli）
├── es-plus-docs/         # 主文档站（Vite + Vue 3 + Element Plus）
├── es-eui/               # Vue 2 + Element UI 文档站
├── es-pc/                # Ant Design Vue 文档站
├── scripts/              # 一致性/契约校验脚本（check:consistency 等）
├── __tests__/            # e2e 矩阵 + Playwright 运行时测试
└── docs/                 # 设计文档与迁移指南
```

## 本地开发

```bash
# 根目录一次性装依赖（workspaces monorepo，无需逐包 install）
npm install --legacy-peer-deps

# 构建全部可发布包（按依赖顺序：shared → vue3 → vue2 → adapter-antdv → cli → mcp-server）
npm run build:packages

# 文档站点开发
cd es-plus-docs && npm run dev

# 运行全部包单测
npm test

# 跨包 e2e 矩阵（vue2/vue3/antdv × schema/sfc）
npm run test:e2e

# 类型检查（逐包）
npm run typecheck --workspaces --if-present

# 一致性校验（三端类型导出 / schema 单一真源）
npm run check:consistency
```

## 相关链接

| 包 | 说明 | 链接 |
|---|---|---|
| `@es-plus/vue3` | Vue 3 + Element Plus 渲染器 | [npm](https://www.npmjs.com/package/@es-plus/vue3) |
| `@es-plus/vue2` | Vue 2 + Element UI 渲染器 | [npm](https://www.npmjs.com/package/@es-plus/vue2) |
| `@es-plus/adapter-antdv` | Vue 3 + Ant Design Vue 渲染器 | [npm](https://www.npmjs.com/package/@es-plus/adapter-antdv) |
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
