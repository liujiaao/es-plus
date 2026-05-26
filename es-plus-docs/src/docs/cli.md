# @es-plus/cli

`@es-plus/cli` 是 ES-Plus 官方命令行工具，支持从自然语言生成 CRUD 页面、校验 JSON 配置、快速生成页面脚手架。

## 安装

```bash
# 方式一：npx 直接运行（无需安装）
npx @es-plus/cli create user-management

# 方式二：全局安装
npm install -g @es-plus/cli

# 方式三：项目级安装
npm install -D @es-plus/cli
```

安装完成后，`es-plus` 命令即可在终端使用。

## 命令总览

| 命令 | 说明 | 示例 |
|------|------|------|
| `es-plus create <name>` | 交互式 / 从配置生成 CRUD 页面 | `es-plus create user-management` |
| `es-plus create --from-config` | 从 JSON 配置生成生产级代码 | `es-plus create --from-config ./config.json` |
| `es-plus validate <file>` | 校验 JSON 配置文件 | `es-plus validate ./config.json` |
| `es-plus scaffold <name>` | 生成最小页面脚手架 | `es-plus scaffold dashboard` |

---

## create — 生成 CRUD 页面

从自然语言描述生成完整的 Vue 3 CRUD 页面。内置 6 个常用业务预设，也支持自定义描述。

### 基本用法

```bash
# 交互式（会引导选择预设或输入描述）
es-plus create user-management

# 非交互式（直接传入描述）
es-plus create user-management \
  -d "用户管理，查询姓名、手机号、状态，表格显示姓名、手机号、邮箱、状态、创建时间，支持新增编辑删除" \
  -o ./src/views/UserManagement.vue
```

### 参数说明

| 参数 | 说明 | 默认值 |
|------|------|--------|
| `<name>` | 页面名称（kebab-case） | **必填** |
| `-d, --description` | 跳过交互，直接使用此描述生成 | 无（进入交互模式） |
| `-o, --output <path>` | 输出文件路径 | `./src/views/<PascalName>.vue` |

### 交互流程

```
$ es-plus create order-list

? 选择预设或自定义描述
  ❯ 自定义描述
    用户管理
    订单列表
    商品管理
    日志查询
    角色权限
    员工花名册

? 请描述页面功能（自然语言）: 订单列表，查询订单号、客户名称、日期范围、状态，
  表格显示订单号、客户、金额、状态、创建时间，支持查看详情和删除

? 输出路径: ./src/views/OrderList.vue

⏳ 正在生成...

✔ 已生成: ./src/views/OrderList.vue
  Generated CRUD page with:
  - 4 query form fields
  - 5 table columns
  - Actions: view, delete
```

### 内置预设

| 预设名 | 描述 |
|--------|------|
| 用户管理 | 查询姓名/手机号/状态，表格含基本信息，支持增删改 |
| 订单列表 | 查询订单号/客户/日期/状态，表格含金额，支持查看删除 |
| 商品管理 | 查询名称/分类/状态，表格含价格库存，支持增删改 |
| 日志查询 | 查询关键词/级别/日期，只读表格 |
| 角色权限 | 查询角色名/状态，表格含描述，支持增删改 |
| 员工花名册 | 查询姓名/部门/职位，表格含个人信息，支持新增编辑 |

### 生成代码示例

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
import { reactive, ref } from 'vue'
import { useDialog } from 'es-plus-ui'

const queryForm = reactive({ name: '', phone: '', status: '' })
const tableData = ref([])
const tableRef = ref(null)
const pagination = ref({ current: 1, pageSize: 10, total: 0 })
const dialog = useDialog()

const formItems = [
  { prop: 'name', label: '姓名', formtype: 'Input', span: 6 },
  { prop: 'phone', label: '手机号', formtype: 'Input', span: 6 },
  { prop: 'status', label: '状态', formtype: 'Select', span: 6,
    dataOptions: [{ label: '启用', value: 1 }, { label: '禁用', value: 0 }] }
]

const columns = [
  { prop: 'name', label: '姓名' },
  { prop: 'phone', label: '手机号' },
  { prop: 'email', label: '邮箱' },
  { prop: 'status', label: '状态' },
  { prop: 'createTime', label: '创建时间' },
  { prop: 'operate', label: '操作', btns: [...] }
]

// ... 完整 CRUD 逻辑（httpRequest、新增/编辑弹窗、删除确认）
</script>
```

### 自然语言描述技巧

描述越清晰，生成代码越精确：

```bash
# ✅ 好的描述 — 明确字段和操作
"用户管理，查询姓名、手机号、状态，表格显示姓名、手机号、邮箱、状态、创建时间，支持新增编辑删除"

# ✅ 分段描述
"商品管理页面，
 查询条件有商品名称、分类、上架状态，
 表格显示名称、分类、价格、库存、状态，
 支持新增、编辑、删除操作"

# ❌ 太模糊
"做一个管理页面"
```

**关键词识别规则：**

| 关键词 | 映射为 |
|--------|--------|
| 状态、类型、分类、性别 | Select 下拉选择 |
| 日期、时间 | datePicker 日期选择器 |
| 开关、启用/禁用 | Switch 开关 |
| 评分、星级 | Rate 评分 |
| 头像、图片、附件 | Upload 上传 |
| 其他 | Input 输入框 |

---

## create --from-config — 从结构化配置生成（推荐）

当需要生产级代码（零 TODO、零占位符、真实 API 地址）时，使用 `--from-config` 从 JSON 配置文件生成：

### 基本用法

```bash
# 从 JSON 配置文件生成
es-plus create --from-config ./user-manage.json

# 指定输出路径和模式
es-plus create --from-config ./user-manage.json -o ./src/views/user/ --mode schema

# 从 stdin 读取（配合其他工具）
cat config.json | es-plus create --from-config -
```

### 参数说明

| 参数 | 说明 | 默认值 |
|------|------|--------|
| `--from-config <file>` | JSON 配置文件路径（`-` 表示 stdin） | **必填** |
| `-o, --output <path>` | 输出目录 | `./src/views/<Name>/` |
| `--mode <mode>` | 输出模式：`schema` 或 `sfc` | `schema` |
| `--typescript` | 生成 TypeScript 代码 | `true` |

### 配置文件格式（StructuredCrudConfig）

```json
{
  "name": "UserManage",
  "apiUrl": "/api/system/users",
  "fields": [
    { "prop": "username", "label": "用户名", "formtype": "Input", "required": true,
      "rules": [{ "min": 2, "max": 20, "message": "用户名长度 2-20 个字符" }] },
    { "prop": "phone", "label": "手机号", "formtype": "Input", "required": true,
      "rules": [{ "pattern": "^1[3-9]\\d{9}$", "message": "手机号格式不正确" }] },
    { "prop": "email", "label": "邮箱", "formtype": "Input", "inQuery": false,
      "rules": [{ "type": "email", "message": "邮箱格式不正确" }] },
    { "prop": "status", "label": "状态", "formtype": "Select",
      "dataOptions": [{ "label": "启用", "value": 1 }, { "label": "禁用", "value": 0 }],
      "render": "(_, { row }) => h(ElTag, { type: row.status === 1 ? 'success' : 'danger' }, () => row.status === 1 ? '启用' : '禁用')" },
    { "prop": "deptId", "label": "部门", "formtype": "Select", "inTable": false,
      "apiParams": { "url": "/api/system/depts/options" } },
    { "prop": "createTime", "label": "创建时间", "formtype": "datePicker",
      "attrs": { "type": "daterange", "valueFormat": "YYYY-MM-DD" }, "inForm": false, "querySpan": 8 }
  ],
  "actions": ["add", "edit", "delete"],
  "tableOptions": { "rowkey": "userId" },
  "permissions": { "add": "system:user:add", "edit": "system:user:edit", "delete": "system:user:delete" }
}
```

### 多弹窗配置文件示例

```json
{
  "name": "OrderManage",
  "apiUrl": "/api/orders",
  "fields": [
    { "prop": "orderNo", "label": "订单号", "formtype": "Input" },
    { "prop": "customerName", "label": "客户", "formtype": "Input" },
    { "prop": "amount", "label": "金额", "formtype": "Input", "inQuery": false,
      "attrs": { "type": "number" } },
    { "prop": "status", "label": "状态", "formtype": "Select",
      "dataOptions": [
        { "label": "待审核", "value": 0 },
        { "label": "已通过", "value": 1 },
        { "label": "已拒绝", "value": 2 }
      ] }
  ],
  "toolbarBtns": [
    { "name": "新建订单", "type": "primary", "icon": "Plus", "dialogKey": "add" },
    { "name": "导出", "icon": "Download", "actionType": "export" }
  ],
  "operationColumn": {
    "width": 280,
    "btns": [
      { "name": "编辑", "type": "primary", "dialogKey": "edit" },
      { "name": "审批", "type": "warning", "dialogKey": "approve" },
      { "name": "查看", "dialogKey": "detail" },
      { "name": "删除", "type": "danger", "confirm": "确定删除该订单？" }
    ]
  },
  "dialogs": {
    "add": {
      "title": "新建订单",
      "width": "700px",
      "formItems": [
        { "prop": "customerName", "label": "客户名称", "formtype": "Input", "required": true },
        { "prop": "amount", "label": "金额", "formtype": "Input", "required": true,
          "attrs": { "type": "number" } },
        { "prop": "remark", "label": "备注", "formtype": "Input",
          "attrs": { "type": "textarea", "rows": 3 } }
      ]
    },
    "edit": {
      "title": "编辑订单",
      "width": "700px",
      "formItems": [
        { "prop": "customerName", "label": "客户名称", "formtype": "Input" },
        { "prop": "amount", "label": "金额", "formtype": "Input",
          "attrs": { "type": "number" } }
      ]
    },
    "approve": {
      "title": "审批",
      "width": "500px",
      "formItems": [
        { "prop": "result", "label": "审批结果", "formtype": "Radio",
          "dataOptions": [{ "label": "通过", "value": 1 }, { "label": "拒绝", "value": 2 }] },
        { "prop": "remark", "label": "审批意见", "formtype": "Input",
          "attrs": { "type": "textarea" } }
      ]
    },
    "detail": {
      "title": "订单详情",
      "width": "800px",
      "isHiddenFooter": true,
      "hasCustomRender": true
    }
  }
}
```

### 输出结构

**schema 模式**（默认）输出两个文件：

```
src/views/OrderManage/
├── schema.ts      # CrudPageSchema 配置 JSON
└── index.vue      # 包装 SFC（~30 行，处理事件和 API 调用）
```

**sfc 模式** 输出单个完整 SFC：

```
src/views/OrderManage.vue   # 独立 SFC（~200 行，包含全部逻辑）
```

### 与自然语言模式对比

| 特性 | `es-plus create -d "..."` | `es-plus create --from-config` |
|------|--------------------------|-------------------------------|
| 输入 | 自然语言描述 | 精确 JSON 配置 |
| API 地址 | 占位符（需手动替换） | 真实地址（直接可用） |
| 验证规则 | 无 | 完整规则 |
| 多弹窗 | 不支持 | 完整支持 |
| 权限 | 不支持 | 支持 |
| TODO 注释 | 有（需手动处理） | 零 TODO |
| 适用阶段 | 原型开发 | 生产部署 |

### 配合 CI/CD 使用

```yaml
# .github/workflows/generate.yml
- name: Generate pages from configs
  run: |
    for f in ./configs/*.json; do
      npx @es-plus/cli create --from-config "$f" -o ./src/views/
    done
```

---

## validate — 校验配置

校验 JSON 配置文件是否符合 es-plus 组件的 Schema 规范。

### 基本用法

```bash
# 指定 schema 类型
es-plus validate ./config/form-items.json --schema form-item

# 自动检测 schema 类型
es-plus validate ./config/table-options.json
```

### 参数说明

| 参数 | 说明 | 默认值 |
|------|------|--------|
| `<file>` | JSON 配置文件路径 | **必填** |
| `-s, --schema <type>` | Schema 类型 | 自动检测 |

### 支持的 Schema 类型

| 类型 | 验证内容 | 对应组件 |
|------|----------|----------|
| `form-item` | 表单项配置 | EsForm `formItemList` |
| `table-column` | 表格列配置 | EsTable `columns` |
| `table-options` | 表格选项配置 | EsTable `options` |
| `dialog-options` | 弹窗配置 | useDialog 参数 |

### 输出示例

**校验通过：**

```
✔ 校验通过 (schema: form-item)
```

**校验失败：**

```
✗ 校验失败（2 个错误）:
  (root): must have required property 'prop'
  /formtype: must be equal to one of the allowed values

建议:
  - Add missing property "prop"
  - Valid values for /formtype: Input, Select, datePicker, timePicker,
    Slider, ColorPicker, Transfer, Cascader, Radio, Checkbox, Switch, Rate, Upload

可用 schema: form-item, table-column, table-options, dialog-options
```

### 自动检测逻辑

当不指定 `--schema` 时，CLI 会根据 JSON 内容自动判断：

| 包含字段 | 判定为 |
|----------|--------|
| `columns` / `tableData` | `table-column` |
| `httpRequest` / `configTableOut` / `apiParams` | `table-options` |
| `render` / `configBtn` / `isDraggable` | `dialog-options` |
| 其他 | `form-item` |

### 配合 CI 使用

```yaml
# .github/workflows/validate.yml
- name: Validate es-plus configs
  run: |
    npx @es-plus/cli validate ./src/configs/user-form.json --schema form-item
    npx @es-plus/cli validate ./src/configs/table-options.json --schema table-options
```

---

## scaffold — 生成脚手架

生成最小化的 es-plus 页面模板，适合快速启动新页面开发。

### 基本用法

```bash
# 默认（查询 + 表格）
es-plus scaffold user-list

# 查询 + 表格 + 弹窗
es-plus scaffold user-management --features query,table,dialog

# 只有表格
es-plus scaffold data-view --features table

# 指定输出路径
es-plus scaffold report -o ./src/views/report/Index.vue
```

### 参数说明

| 参数 | 说明 | 默认值 |
|------|------|--------|
| `<name>` | 页面名称（kebab-case） | **必填** |
| `-f, --features <list>` | 功能列表（逗号分隔） | `query,table` |
| `-o, --output <path>` | 输出文件路径 | `./src/views/<PascalName>.vue` |

### 可用 features

| Feature | 生成内容 |
|---------|----------|
| `query` | EsForm 查询表单 + 查询/重置按钮 |
| `table` | EsTable 表格 + 分页 + httpRequest 模板 |
| `dialog` | useDialog 引入 + dialog 实例 |

### 生成结果对比

**`--features query,table`（默认）：**

```vue
<template>
  <div class="user-list-page">
    <es-table ref="tableRef" :columns="columns" :options="options"
      v-model:data-source="tableData" v-model:pagination="pagination">
      <es-form :model="queryForm" :form-item-list="formItems" :config-btn="queryBtns" />
    </es-table>
  </div>
</template>

<script setup>
import { reactive, ref } from 'vue'

const queryForm = reactive({})
const formItems = []
const queryBtns = [
  { name: '查询', type: 'primary', key: 'query', triggerEvent: true },
  { name: '重置', key: 'rest', triggerEvent: true },
]

const tableRef = ref(null)
const tableData = ref([])
const pagination = ref({ current: 1, pageSize: 10, total: 0 })
const columns = []
const options = {
  border: true,
  httpRequest: async (params) => {
    // TODO: Replace with your API call
  },
  configTableOut: { total: 'total', tableData: 'data', pageSize: 'pageSize', current: 'pageIndex' },
}
</script>
```

**`--features query,table,dialog`：**

额外包含：

```js
import { useDialog } from 'es-plus-ui'
const dialog = useDialog()
```

---

## 与 MCP Server 的区别

| 特性 | @es-plus/cli | @es-plus/mcp-server |
|------|-------------|---------------------|
| 使用方式 | 命令行直接运行 | AI 编码工具自动调用 |
| 适用场景 | 开发者手动创建页面 | AI 辅助开发 |
| 交互方式 | 终端交互式问答 | AI 对话式 |
| 输出 | 直接写入文件 | 返回代码字符串给 AI |
| 依赖 | Node.js | AI 编码工具 + MCP 协议 |

**推荐组合使用：**
- 项目初始化阶段 → 用 CLI 批量生成页面
- 日常开发中 → 用 MCP Server 让 AI 辅助修改

---

## 常见问题

### Q: 生成的代码需要修改什么？

生成的代码是完整可运行的 Vue 3 SFC，通常需要修改：

1. **`httpRequest`** — 替换为实际的 API 请求地址
2. **`configTableOut`** — 根据后端接口响应结构调整字段映射
3. **表单校验规则** — 如需要在弹窗表单中添加验证

### Q: 支持 TypeScript 吗？

当前生成的是 `<script setup>` 格式（JavaScript）。如需 TypeScript，可将 `<script setup>` 改为 `<script setup lang="ts">` 并添加类型注解。

### Q: 如何自定义生成模板？

CLI 使用内置的代码生成引擎。如需深度自定义，建议：

1. 先用 CLI 生成基础代码
2. 再按项目需求手动调整
3. 或者使用 `scaffold` 命令生成最小模板，手动填充配置

### Q: Windows 下 npx 报错？

确保 Node.js >= 18，并使用 PowerShell 或 Git Bash：

```bash
# PowerShell
npx @es-plus/cli create user-management

# 或全局安装后使用
npm i -g @es-plus/cli
es-plus create user-management
```

---

## 版本要求

- Node.js >= 18
- npm >= 8

## 相关链接

- [es-plus-ui 组件库](https://www.npmjs.com/package/es-plus-ui)
- [@es-plus/mcp-server AI 集成](https://www.npmjs.com/package/@es-plus/mcp-server)
- [GitHub 仓库](https://github.com/liujiaao/es-plus)
