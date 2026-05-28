# @es-plus/mcp-server

`@es-plus/mcp-server` 是 ES-Plus 官方的 MCP (Model Context Protocol) Server，让 AI 编码工具一行配置即可获得 @es-plus/vue3 的 CRUD 页面生成能力。

## 什么是 MCP？

MCP (Model Context Protocol) 是 Anthropic 提出的开放协议标准，用于连接 AI 助手与外部工具/数据源。通过 MCP，AI 编码工具可以：

- 调用 **Tools**（工具）—— 执行操作，如生成代码、校验配置
- 读取 **Resources**（资源）—— 获取上下文信息，如 Schema 定义、类型文档
- 使用 **Prompts**（提示模板）—— 获取结构化的系统提示

ES-Plus 的 MCP Server 将组件库的能力暴露给 AI 工具，让 AI 能够**精准**生成 @es-plus/vue3 的配置代码。

## 支持的 AI 工具

| 工具 | 支持状态 | 配置方式 |
|------|----------|----------|
| Claude Code (CLI / Desktop / Web) | ✅ 完整支持 | `.claude/settings.json` |
| Cursor | ✅ 完整支持 | `.cursor/mcp.json` |
| Continue | ✅ 完整支持 | `~/.continue/config.json` |
| Windsurf | ✅ 完整支持 | MCP 配置文件 |
| VS Code + Copilot Chat | 🔜 待支持 | - |

## 快速配置

### Claude Code

在项目根目录创建或编辑 `.claude/settings.json`：

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

在项目根目录创建或编辑 `.cursor/mcp.json`：

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

### Continue

在 `~/.continue/config.json` 的 `mcpServers` 数组中添加：

```json
{
  "mcpServers": [
    {
      "name": "es-plus",
      "command": "npx",
      "args": ["-y", "@es-plus/mcp-server"]
    }
  ]
}
```

### 本地开发模式

如果你克隆了 es-plus 仓库进行开发，可以直接指向本地构建产物：

```json
{
  "mcpServers": {
    "es-plus": {
      "command": "node",
      "args": ["./packages/mcp-server/build/index.js"]
    }
  }
}
```

## MCP Tools（可调用工具）

配置完成后，AI 工具会自动发现并使用以下 6 个工具：

### generate_crud_from_config（推荐）

**功能**：从结构化 JSON 配置生成**生产级** CRUD 页面代码（零 TODO、零占位符）

与 `generate_crud_page`（自然语言模式）不同，此工具接收精确的字段定义、真实 API 地址、数据选项和验证规则，输出可直接投入生产的代码。

**输入参数**：

| 参数 | 类型 | 必填 | 说明 |
|------|------|------|------|
| config | string | ✅ | StructuredCrudConfig 的 JSON 字符串 |

**输出模式**：

- **schema 模式**（默认）：输出 CrudPageSchema JSON + 包装 SFC（约 30 行）
- **sfc 模式**：输出完整独立的 Vue 3 SFC（约 200 行）

**基础配置示例**：

```json
{
  "name": "UserManage",
  "apiUrl": "/api/system/users",
  "fields": [
    { "prop": "username", "label": "用户名", "formtype": "Input", "required": true },
    { "prop": "phone", "label": "手机号", "formtype": "Input" },
    { "prop": "status", "label": "状态", "formtype": "Select",
      "dataOptions": [{ "label": "启用", "value": 1 }, { "label": "禁用", "value": 0 }],
      "render": "(_, { row }) => h(ElTag, { type: row.status === 1 ? 'success' : 'danger' }, () => row.status === 1 ? '启用' : '禁用')" },
    { "prop": "createTime", "label": "创建时间", "formtype": "datePicker",
      "attrs": { "type": "daterange", "valueFormat": "YYYY-MM-DD" }, "inForm": false, "querySpan": 8 }
  ],
  "actions": ["add", "edit", "delete"],
  "permissions": { "add": "system:user:add", "edit": "system:user:edit", "delete": "system:user:delete" }
}
```

**多弹窗配置示例**：

```json
{
  "name": "UserManage",
  "apiUrl": "/api/system/users",
  "fields": [
    { "prop": "username", "label": "用户名", "formtype": "Input", "required": true },
    { "prop": "status", "label": "状态", "formtype": "Select",
      "dataOptions": [{ "label": "启用", "value": 1 }, { "label": "禁用", "value": 0 }] }
  ],
  "toolbarBtns": [
    { "name": "新增", "type": "primary", "icon": "Plus", "dialogKey": "add" },
    { "name": "导入", "icon": "Upload", "dialogKey": "import" },
    { "name": "导出", "icon": "Download", "actionType": "export" }
  ],
  "operationColumn": {
    "label": "操作",
    "width": 240,
    "fixed": "right",
    "btns": [
      { "name": "编辑", "type": "primary", "dialogKey": "edit" },
      { "name": "审批", "type": "warning", "dialogKey": "approve" },
      { "name": "删除", "type": "danger", "key": "delete", "confirm": "确定删除该条数据吗？" }
    ]
  },
  "dialogs": {
    "add": {
      "title": "新增用户",
      "width": "600px",
      "formItems": [
        { "prop": "username", "label": "用户名", "formtype": "Input", "required": true },
        { "prop": "phone", "label": "手机号", "formtype": "Input" }
      ]
    },
    "edit": {
      "title": "编辑用户",
      "width": "600px",
      "formItems": [
        { "prop": "username", "label": "用户名", "formtype": "Input" },
        { "prop": "phone", "label": "手机号", "formtype": "Input" }
      ]
    },
    "approve": {
      "title": "审批",
      "width": "500px",
      "formItems": [
        { "prop": "result", "label": "审批结果", "formtype": "Radio" },
        { "prop": "remark", "label": "备注", "formtype": "Input" }
      ]
    },
    "import": {
      "title": "批量导入",
      "width": "500px",
      "hasCustomRender": true
    }
  }
}
```

**StructuredCrudConfig 完整字段说明**：

| 字段 | 类型 | 必填 | 说明 |
|------|------|------|------|
| `name` | string | ✅ | PascalCase 组件名 |
| `apiUrl` | string | ✅ | 真实 API 端点 |
| `fields` | FieldConfig[] | ✅ | 字段配置数组 |
| `actions` | string[] | 旧模式必填 | CRUD 操作：add/edit/delete/view/export/import |
| `toolbarBtns` | object[] | 否 | 工具栏按钮（多弹窗模式） |
| `operationColumn` | object \| false | 否 | 操作列配置（多弹窗模式） |
| `dialogs` | Record<string, object> | 否 | 弹窗配置（多弹窗模式） |
| `mode` | 'schema' \| 'sfc' | 否 | 输出模式，默认 schema |
| `typescript` | boolean | 否 | 是否生成 TypeScript，默认 true |
| `permissions` | Record<string, string> | 否 | 权限标识映射 |
| `tableOptions` | object | 否 | 表格选项 |
| `pagination` | object | 否 | 分页配置 |

**FieldConfig 字段说明**：

| 字段 | 类型 | 说明 |
|------|------|------|
| `prop` | string | 后端字段名 |
| `label` | string | 显示标签 |
| `formtype` | string | 表单类型（13 种） |
| `inQuery` | boolean | 是否在查询表单中显示（默认 true） |
| `inTable` | boolean | 是否在表格中显示（默认 true） |
| `inForm` | boolean | 是否在弹窗表单中显示（默认 true） |
| `required` | boolean | 是否必填 |
| `rules` | object[] | 自定义验证规则 |
| `attrs` | object | 透传给 Element Plus 组件的属性 |
| `dataOptions` | object[] | 静态选项数据 |
| `apiParams` | object | 远程选项加载配置 |
| `querySpan` | number | 查询表单栅格宽度 |
| `render` | string | 表格列渲染表达式 |
| `width` | number \| string | 表格列宽 |

**示例对话**：

```
用户：帮我生成一个用户管理页面，要有新增、编辑、审批功能，每个操作独立弹窗

AI：[读取 esplus://conventions 获取规范]
    [构建 StructuredCrudConfig JSON]
    [调用 generate_crud_from_config]
    
    生成了 UserManage 页面：
    - schema.ts：CrudPageSchema 配置（含 3 个弹窗定义）
    - Page.vue：30 行包装组件（处理弹窗确认逻辑）
```

---

### generate_crud_page

**功能**：从自然语言描述生成完整的 `.vue` CRUD 页面

**输入参数**：

| 参数 | 类型 | 必填 | 说明 |
|------|------|------|------|
| description | string | ✅ | 页面需求的自然语言描述（支持中文/英文） |

**输出**：完整的 Vue 3 SFC 代码，包含：
- `<template>` — EsTable + EsForm 组合
- `<script setup>` — 响应式状态、配置对象、useDialog 弹窗逻辑

**示例对话**：

```
用户：帮我生成一个用户管理页面，查询条件有姓名、手机号、状态，
     表格显示姓名、手机号、邮箱、状态、创建时间，支持新增编辑删除

AI：[调用 generate_crud_page] 生成包含查询表单、数据表格、操作列和弹窗表单的完整代码
```

**支持的描述格式**：

```
# 格式一：明确区分查询和表格字段
"查询条件有 A、B，表格显示 A、B、C、D，支持新增编辑删除"

# 格式二：仅列出字段（自动同时用于查询和表格）
"用户管理：姓名、手机号、邮箱、状态"

# 格式三：指定具体操作
"订单列表，支持查看详情和导出"
```

### validate_config

**功能**：校验 @es-plus/vue3 JSON 配置是否符合 Schema，并给出修复建议

**输入参数**：

| 参数 | 类型 | 必填 | 说明 |
|------|------|------|------|
| config | string | ✅ | JSON 格式的配置字符串 |
| type | string | 否 | Schema 类型，默认 `form-item`。可选：`form-item`、`table-column`、`table-options`、`dialog-options`、`btn-config`、`api-params` |

**示例对话**：

```
用户：帮我检查这个配置对不对
     { "prop": "name", "formtype": "Inputx", "label": "姓名" }

AI：[调用 validate_config]
    ✗ formtype 值 "Inputx" 不在允许的枚举范围内
    → 有效值：Input, Select, datePicker, timePicker, Slider, ColorPicker, 
      Transfer, Cascader, Radio, Checkbox, Switch, Rate, Upload
```

### list_form_types

**功能**：列出 @es-plus/vue3 支持的全部 13 种表单字段类型

**输入参数**：无

**输出**：每种 formtype 的名称、描述和适用场景

**示例对话**：

```
用户：es-plus 有哪些表单类型可以用？

AI：[调用 list_form_types]
    1. Input — 输入框（文本/数字/密码）
    2. Select — 下拉选择器（单选/多选）
    3. datePicker — 日期选择器
    ...共 13 种
```

### get_component_api

**功能**：获取组件的完整 API 文档，包括 TypeScript 接口定义、Props、Methods 和使用示例

**输入参数**：

| 参数 | 类型 | 必填 | 说明 |
|------|------|------|------|
| component | string | ✅ | 组件名：`EsForm`、`EsTable` 或 `useDialog` |

**示例对话**：

```
用户：EsTable 的 options 怎么配置？httpRequest 回调的参数是什么格式？

AI：[调用 get_component_api { component: "EsTable" }]
    返回 TableOptions 完整接口定义，包含 httpRequest、configTableOut、
    listenToCallBack 等属性的类型和用法说明
```

### scaffold_page

**功能**：生成最小化的 @es-plus/vue3 页面脚手架模板

**输入参数**：

| 参数 | 类型 | 必填 | 说明 |
|------|------|------|------|
| name | string | ✅ | 页面名称（kebab-case），如 `user-management` |
| features | string[] | 否 | 包含的功能模块，默认 `["query", "table"]`。可选：`query`、`table`、`dialog` |

**示例对话**：

```
用户：给我一个空的 es-plus 页面模板，需要查询表单、表格和弹窗

AI：[调用 scaffold_page { name: "order-list", features: ["query", "table", "dialog"] }]
    生成包含基本结构的 .vue 文件，所有配置项为空数组待填充
```

## MCP Resources（可读取资源）

AI 工具可以主动读取以下资源来获取上下文信息：

| URI | 内容说明 |
|-----|----------|
| `esplus://conventions` | 代码生成规范（formtype、按钮key、多弹窗模式、configureEsPlus等） |
| `esplus://schemas/form-item` | FormItemOption 完整 JSON Schema 定义 |
| `esplus://schemas/table-column` | TableColumn 完整 JSON Schema 定义 |
| `esplus://schemas/table-options` | TableOptions 完整 JSON Schema 定义 |
| `esplus://schemas/dialog-options` | DialogOptions 完整 JSON Schema 定义 |
| `esplus://schemas/btn-config` | BtnConfig 按钮配置 JSON Schema |
| `esplus://schemas/api-params` | ApiParams 远程数据加载 JSON Schema |
| `esplus://types` | 完整 TypeScript 类型定义文件（所有接口） |
| `esplus://examples` | 6 个预设 CRUD 页面示例（含完整代码） |

**作用**：当 AI 工具需要精确了解某个配置项的类型定义时，会自动读取对应的 Schema 资源，确保生成的代码类型正确。

## MCP Prompts（提示模板）

提供结构化的系统提示模板，帮助 AI 更准确地生成代码：

| Prompt 名 | 参数 | 用途 |
|-----------|------|------|
| `crud-page` | `description: string` | 包含 es-plus 最佳实践的 CRUD 页面生成系统提示 |
| `form-config` | `description: string` | 仅生成 formItemList JSON 配置的系统提示 |

## 使用场景与示例

### 场景 1：从零创建 CRUD 页面

```
用户：创建一个商品管理页面，需要：
     - 查询：商品名称、分类、状态
     - 表格：名称、分类、价格、库存、状态
     - 操作：新增、编辑、删除
```

AI 自动调用 `generate_crud_page`，生成约 80 行的完整 `.vue` 文件，包括：
- 查询表单（3 个字段 + 查询/重置/新增按钮）
- 数据表格（5 列 + 操作列）
- useDialog 弹窗（新增/编辑表单）

### 场景 2：查询 API 用法

```
用户：EsForm 的 apiParams 怎么用？我想让下拉框的选项从接口加载

AI：[调用 get_component_api] 返回完整说明：
    apiParams: {
      url: '/api/options',    // 接口地址
      method: 'GET',          // 请求方法
      model: { type: 'dept' } // 额外参数
    }
    配合 isInitRun: true（默认）自动在组件挂载时加载
```

### 场景 3：校验现有配置

```
用户：这个表格配置有问题吗？
     { "columns": [{ "prop": "name", "lable": "姓名" }], "options": { "border": "yes" } }

AI：[调用 validate_config]
    1. columns[0].lable → 应为 "label"（拼写错误）
    2. options.border → 应为 boolean 类型，当前是 string "yes"
    建议修复为：{ "label": "姓名" } 和 { "border": true }
```

### 场景 4：渐进式开发

```
用户：先给我一个空的页面结构，我后面再填配置

AI：[调用 scaffold_page { name: "report-dashboard", features: ["query", "table"] }]
    生成骨架代码，formItems 和 columns 为空数组
```

```
用户：现在帮我添加查询字段：日期范围、报表类型

AI：[读取 esplus://schemas/form-item 了解字段结构]
    向 formItems 中添加：
    { prop: 'dateRange', label: '日期范围', formtype: 'datePicker', 
      attrs: { type: 'daterange', valueFormat: 'YYYY-MM-DD' }, span: 8 }
    { prop: 'reportType', label: '报表类型', formtype: 'Select', 
      dataOptions: [...], span: 6 }
```

## 工作原理

```
┌────────────────────────────────────────────────────┐
│            AI 编码工具 (Claude / Cursor)             │
│                                                    │
│  用户输入: "生成用户管理页面，查询姓名状态..."        │
└──────────────────────┬─────────────────────────────┘
                       │ MCP Protocol (JSON-RPC over stdio)
                       ▼
┌────────────────────────────────────────────────────┐
│              @es-plus/mcp-server                    │
│                                                    │
│  ┌─────────────┐  ┌──────────────┐  ┌──────────┐  │
│  │  Tools (5)  │  │ Resources(8) │  │Prompts(2)│  │
│  │             │  │              │  │          │  │
│  │ 解析描述 →   │  │ JSON Schema  │  │ 系统提示 │  │
│  │ 生成配置 →   │  │ TS 类型定义  │  │ 最佳实践 │  │
│  │ 输出代码    │  │ 预设示例     │  │          │  │
│  └─────────────┘  └──────────────┘  └──────────┘  │
│                                                    │
│  Core Engine:                                      │
│  ├── crud-engine    (NLP → Config)                 │
│  ├── code-generator (Config → .vue SFC)            │
│  └── schema-validator (JSON Schema 校验)           │
└────────────────────────────────────────────────────┘
                       │
                       ▼ 输出
┌────────────────────────────────────────────────────┐
│           完整 .vue SFC 文件                        │
│                                                    │
│  <es-table :columns="columns" :options="options">  │
│    <es-form :model="query" :form-item-list="..." />│
│  </es-table>                                       │
│                                                    │
│  + useDialog() 弹窗逻辑                            │
│  + 响应式状态管理                                   │
│  + 类型安全的配置对象                               │
└────────────────────────────────────────────────────┘
```

## 自然语言解析规则

`generate_crud_page` 工具使用基于规则的 NLP 引擎，支持以下模式：

### 字段类型自动推断

| 关键词 | 推断 formtype | 示例 |
|--------|--------------|------|
| 状态、类型、分类、性别、级别 | Select | "状态" → Select + 启用/禁用选项 |
| 日期、时间、创建时间 | datePicker | "日期范围" → datePicker + daterange |
| 开关、是否、启用 | Switch | "是否启用" → Switch |
| 评分、星级 | Rate | "满意度评分" → Rate |
| 颜色 | ColorPicker | "标签颜色" → ColorPicker |
| 图片、头像、文件 | Upload | "头像" → Upload |
| 备注、描述、内容 | Input(textarea) | "备注" → Input + textarea |
| 其他 | Input | 默认为文本输入框 |

### 字段名自动映射

常见中文字段名会自动映射为英文 prop：

| 中文名 | prop 值 | 中文名 | prop 值 |
|--------|---------|--------|---------|
| 姓名 | name | 手机号 | phone |
| 邮箱 | email | 状态 | status |
| 创建时间 | createTime | 订单号 | orderNo |
| 金额 | amount | 分类 | category |
| 部门 | department | 职位 | position |

### 操作识别

| 关键词 | 识别的操作 |
|--------|-----------|
| 新增、添加、创建 | add（生成新增按钮 + 弹窗） |
| 编辑、修改、更新 | edit（生成编辑按钮 + 弹窗） |
| 删除、移除 | delete（生成删除按钮） |
| 查看、详情 | view（生成查看按钮） |
| 导出 | export（生成导出按钮） |

## 常见问题

### Q: MCP Server 需要网络连接吗？

不需要。`@es-plus/mcp-server` 完全在本地运行，所有代码生成基于内置的规则引擎，不依赖任何外部 API 或 LLM 服务。

### Q: 生成的代码能直接运行吗？

可以。生成的 `.vue` 文件可直接复制到你的项目中使用，前提是项目已安装并配置 `@es-plus/vue3`。你只需要：
1. 替换 `httpRequest` 中的注释为实际的 API 调用
2. 根据业务需求调整 `dataOptions` 的选项值

### Q: 支持英文输入吗？

支持。你可以用英文描述字段，如 "User management, query by name and status, table shows name, phone, email, status"。但中文描述的识别精度更高。

### Q: 如何自定义生成的代码风格？

MCP Server 生成的是标准 @es-plus/vue3 配置代码。如果需要调整风格（如使用 TypeScript、调整缩进），可以在 AI 工具中追加指令，如："请把上面的代码改为 TypeScript 版本，并添加类型注解"。

### Q: 与 AI CRUD 生成器（文档站）有什么区别？

两者使用相同的核心引擎（crud-engine），区别在于：
- **文档站 AI CRUD 生成器**：在浏览器中运行，通过 Web UI 交互
- **MCP Server**：在本地 Node.js 中运行，通过 AI 编码工具的对话界面交互，可直接将代码写入项目文件

## 版本说明

| 版本 | 变更 |
|------|------|
| 1.1.0 | 新增 `generate_crud_from_config` 工具，支持多弹窗配置生成 |
| 1.0.0 | 初始发布：5 Tools + 8 Resources + 2 Prompts |
