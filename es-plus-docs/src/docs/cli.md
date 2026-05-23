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
| `es-plus create <name>` | 交互式生成 CRUD 页面 | `es-plus create user-management` |
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
