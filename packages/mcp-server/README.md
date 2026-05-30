# @es-plus/mcp-server

[`@es-plus/vue3`](https://www.npmjs.com/package/@es-plus/vue3) / [`@es-plus/vue2`](https://www.npmjs.com/package/@es-plus/vue2) 官方 MCP Server —— 让 AI 编码工具自动生成 CRUD 页面。同一 Schema 可生成 Vue 3 或 Vue 2 版本代码。

支持 Claude Code、Cursor、Windsurf、Continue 等所有兼容 [MCP 协议](https://modelcontextprotocol.io/) 的 AI 编码工具。

## 30 秒快速配置

### Claude Code

```bash
claude mcp add es-plus -- npx -y @es-plus/mcp-server
```

或在项目根目录 `.mcp.json` 中添加：

```json
{
  "mcpServers": {
    "es-plus": {
      "command": "npx",
      "args": ["-y", "@es-plus/mcp-server"]
    }
  }
}
```

### Cursor

在 `.cursor/mcp.json` 中添加：

```json
{
  "mcpServers": {
    "es-plus": {
      "command": "npx",
      "args": ["-y", "@es-plus/mcp-server"]
    }
  }
}
```

### Windsurf

在 `~/.codeium/windsurf/mcp_config.json` 中添加：

```json
{
  "mcpServers": {
    "es-plus": {
      "command": "npx",
      "args": ["-y", "@es-plus/mcp-server"]
    }
  }
}
```

### VS Code (GitHub Copilot)

在 `.vscode/mcp.json` 中添加：

```json
{
  "servers": {
    "es-plus": {
      "command": "npx",
      "args": ["-y", "@es-plus/mcp-server"]
    }
  }
}
```

> **前提条件：** Node.js >= 18，项目已安装 `@es-plus/vue3` + `element-plus`（Vue 3）或 `@es-plus/vue2` + `element-ui`（Vue 2）。

---

## 使用方式

配置完成后，直接在 AI 编码工具中用自然语言描述需求即可：

```
帮我生成一个用户管理页面，查询条件有姓名、手机号、状态，
表格显示姓名、手机号、邮箱、状态、创建时间，支持新增编辑删除
```

AI 会自动调用 MCP Server 的 `generate_crud_page` 工具，返回一个完整可运行的 `.vue` 文件，包含：

- 查询表单（自动推断 Input / Select / DatePicker 等控件类型）
- 数据表格（含状态列渲染、操作按钮）
- 新增/编辑弹窗（含表单验证）
- 删除确认提示
- 分页与接口请求模板

**你只需替换 `httpRequest` 中的接口地址即可投入使用。**

---

## 工具 (Tools)

MCP Server 提供 5 个工具，AI 编码工具会根据你的描述自动选择调用。

### generate_crud_page

从自然语言生成完整的 Vue 3 CRUD 页面（.vue SFC）。

| 参数 | 类型 | 说明 |
|------|------|------|
| `description` | string | 页面功能描述（中文或英文） |

**描述技巧：**

```
# ✅ 好的描述 — 分段说明查询、表格、操作
"用户管理页面，
 查询条件有姓名、手机号、状态，
 表格显示姓名、手机号、邮箱、状态、创建时间，
 支持新增编辑删除"

# ✅ 精简描述 — 自动推断全部字段
"员工管理：姓名、部门、职位、手机号、状态、创建时间"

# ✅ 只读列表
"操作日志查询，查询关键词、级别、日期范围，表格显示时间、级别、操作人、内容，只查看不编辑"
```

**关键词智能识别：**

| 字段关键词 | 自动映射为 |
|-----------|-----------|
| 状态、类型、分类、级别、来源 | Select 下拉选择 |
| 日期、创建时间、更新时间 | datePicker 日期选择器 |
| 时间、时刻 | timePicker 时间选择器 |
| 开关、启用、是否 | Switch 开关 |
| 评分、星级 | Rate 评分 |
| 头像、图片、文件、附件 | Upload 上传 |
| 备注、描述、内容、简介 | Input(textarea) 多行文本 |
| 性别、单选 | Radio 单选框 |
| 多选、标签、兴趣 | Checkbox 多选框 |
| 省市、城市、地区、层级 | Cascader 级联选择 |
| 进度、区间、范围 | Slider 滑块 |
| 穿梭、分配 | Transfer 穿梭框 |
| 其他 | Input 输入框 |

### validate_config

校验 JSON 配置是否符合 es-plus 组件规范，返回错误详情和修复建议（Vue 3 / Vue 2 共用同一份 Schema）。

| 参数 | 类型 | 说明 |
|------|------|------|
| `config` | string | JSON 配置字符串 |
| `type` | string? | Schema 类型，不传则自动检测 |

支持的 Schema 类型：`form-item`、`table-column`、`table-options`、`dialog-options`

### list_form_types

列出 es-plus 支持的全部 13 种表单控件类型及用法示例。无需参数。

### get_component_api

获取组件完整 API 文档，包含 TypeScript 接口定义、Props、方法、使用示例。

| 参数 | 类型 | 说明 |
|------|------|------|
| `component` | enum | `EsForm` / `EsTable` / `useDialog` |

### scaffold_page

生成最小化页面脚手架，适合需要手动填充配置的场景。

| 参数 | 类型 | 说明 |
|------|------|------|
| `name` | string | 页面名称（kebab-case） |
| `features` | string[]? | 功能列表，默认 `['query', 'table']` |

可选 features：`query`（查询表单）、`table`（数据表格）、`dialog`（弹窗）

---

## 资源 (Resources)

AI 工具可通过 MCP 资源协议读取 es-plus 的 Schema 定义和类型信息。

| 资源 URI | 内容 |
|----------|------|
| `esplus://schemas/form-item` | 表单项配置 JSON Schema |
| `esplus://schemas/table-column` | 表格列配置 JSON Schema |
| `esplus://schemas/table-options` | 表格选项 JSON Schema |
| `esplus://schemas/dialog-options` | 弹窗配置 JSON Schema |
| `esplus://schemas/btn-config` | 按钮配置 JSON Schema |
| `esplus://schemas/api-params` | 远程数据加载 JSON Schema |
| `esplus://types` | 完整 TypeScript 类型定义 |
| `esplus://examples` | 8 个预设 CRUD 示例（含生成代码） |

---

## 提示模板 (Prompts)

| 模板名 | 参数 | 用途 |
|--------|------|------|
| `crud-page` | `description` | 生成完整 CRUD 页面的系统提示 |
| `form-config` | `description` | 仅生成表单配置 JSON 的系统提示 |

---

## 内置预设示例

以下 8 个业务场景可直接使用或作为描述参考：

| 预设 | 查询字段 | 表格列 | 操作 |
|------|---------|--------|------|
| 用户管理 | 姓名、手机号、状态 | 姓名、手机号、邮箱、状态、创建时间 | 新增、编辑、删除 |
| 订单列表 | 订单号、客户名称、日期范围、状态 | 订单号、客户、金额、状态、创建时间 | 查看、删除 |
| 商品管理 | 商品名称、分类、状态 | 名称、分类、价格、库存、状态 | 新增、编辑、删除 |
| 日志查询 | 关键词、级别、日期范围 | 时间、级别、操作人、内容 | 只读 |
| 角色权限 | 角色名称、状态 | 角色名称、描述、状态、创建时间 | 新增、编辑、删除 |
| 员工花名册 | 姓名、部门、职位 | 姓名、性别、年龄、部门、职位、手机号、状态 | 新增、编辑 |
| 文章管理 | 标题、分类、状态 | 标题、分类、创建人、创建时间、状态 | 新增、编辑、删除 |
| 系统配置 | 名称、类型 | 名称、编号、类型、描述、状态 | 新增、编辑、删除、导出 |

---

## 生成代码示例

输入描述：

```
用户管理页面，查询姓名、手机号、状态，表格显示姓名、手机号、邮箱、状态、创建时间，支持新增编辑删除
```

生成的代码结构：

```vue
<template>
  <es-table
    ref="tableRef"
    :columns="columns"
    :options="options"
    v-model:data-source="tableData"
    v-model:pagination="pagination"
  >
    <es-form :model="queryForm" :form-item-list="formItems" :config-btn="queryBtns" />
  </es-table>
</template>

<script setup>
import { reactive, ref, h } from 'vue'
import { useDialog } from '@es-plus/vue3'
import { ElTag, ElMessageBox, ElMessage } from 'element-plus'

// 查询表单配置
const formItems = [
  { prop: 'name', label: '姓名', formtype: 'Input', span: 6, attrs: { clearable: true } },
  { prop: 'phone', label: '手机号', formtype: 'Input', span: 6, attrs: { clearable: true } },
  { prop: 'status', label: '状态', formtype: 'Select', span: 6,
    attrs: { clearable: true },
    dataOptions: [{ label: '启用', value: 1 }, { label: '禁用', value: 0 }] }
]

// 表格列 — 状态列自动渲染 ElTag，操作列自动绑定事件
const columns = [
  { prop: 'name', label: '姓名' },
  { prop: 'phone', label: '手机号' },
  { prop: 'email', label: '邮箱' },
  { prop: 'status', label: '状态',
    render: (_, { row }) => h(ElTag, { type: row.status === 1 ? 'success' : 'danger' },
      () => row.status === 1 ? '启用' : '禁用') },
  { prop: 'createTime', label: '创建时间' },
  { prop: 'operate', label: '操作',
    btns: [
      { name: '编辑', type: 'primary', clickEvent: (row) => openForm('编辑', row) },
      { name: '删除', type: 'danger', clickEvent: (row) => handleDelete(row) }
    ] }
]

// 删除 — 带确认提示
function handleDelete(row) {
  ElMessageBox.confirm('确定删除该条数据吗？', '提示', { type: 'warning' })
    .then(async () => {
      // TODO: 调用删除接口
      ElMessage.success('删除成功')
      tableRef.value?.httpRequestInstance()
    })
    .catch(() => {})
}

// 新增/编辑弹窗 — 含表单验证
function openForm(title, row = {}) {
  const formData = reactive({ name: '', phone: '', email: '', status: '', createTime: '', ...row })
  dialog({
    title,
    width: '500px',
    render: (h, { registerRef }) => (
      <EsForm ref={el => el && registerRef('form', el)} model={formData} formItemList={dialogFormItems} />
    ),
    configBtn: [
      { name: '取消', click: (_, { close }) => close() },
      { name: '确定', type: 'primary', click: async (_, { close, getRefs }) => {
        try {
          await getRefs('form')?.validate()
          // TODO: 调用保存接口
          close()
          tableRef.value?.httpRequestInstance()
        } catch { /* 表单验证失败 */ }
      }}
    ]
  })
}
</script>
```

**只需替换 `httpRequest` 和删除接口即可投入使用。**

---

## 与 @es-plus/cli 的区别

| 特性 | @es-plus/mcp-server | @es-plus/cli |
|------|---------------------|--------------|
| 使用方式 | AI 编码工具自动调用 | 终端手动运行 |
| 适用场景 | AI 对话式开发 | 批量生成、CI/CD |
| 输出 | 返回代码给 AI 工具 | 直接写入 .vue 文件 |

**推荐组合：** 项目初始化用 CLI 批量生成，日常开发用 MCP Server 让 AI 辅助迭代。

---

## 本地开发

```bash
git clone https://github.com/liujiaao/es-plus.git
cd es-plus/packages/mcp-server
npm install
npm run build
npm start
```

## 环境要求

- Node.js >= 18
- npm >= 8

## License

[MIT](./LICENSE)
