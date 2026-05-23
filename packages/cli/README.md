# @es-plus/cli

[es-plus-ui](https://www.npmjs.com/package/es-plus-ui) 官方命令行工具 —— 用自然语言生成 Vue 3 CRUD 页面，校验 JSON 配置，快速搭建页面脚手架。

## 安装

```bash
# 方式一：npx 直接运行（无需安装）
npx @es-plus/cli create user-management

# 方式二：全局安装
npm install -g @es-plus/cli

# 方式三：项目内安装
npm install -D @es-plus/cli
```

安装后，终端可直接使用 `es-plus` 命令。

> **环境要求：** Node.js >= 18，npm >= 8

---

## 命令总览

| 命令 | 说明 | 示例 |
|------|------|------|
| `es-plus create <name>` | 自然语言 → 完整 CRUD 页面 | `es-plus create user-management` |
| `es-plus validate <file>` | 校验 JSON 配置文件 | `es-plus validate ./config.json` |
| `es-plus scaffold <name>` | 生成最小页面脚手架 | `es-plus scaffold dashboard` |

---

## create — 生成 CRUD 页面

从自然语言描述生成完整的 Vue 3 CRUD 页面（.vue SFC），包含查询表单、数据表格、新增/编辑弹窗、删除确认。

### 基本用法

```bash
# 交互式 — 引导选择预设或输入描述
es-plus create user-management

# 非交互式 — 直接传入描述
es-plus create user-management \
  -d "用户管理，查询姓名、手机号、状态，表格显示姓名、手机号、邮箱、状态、创建时间，支持新增编辑删除"

# 指定输出路径
es-plus create user-management \
  -d "用户管理，查询姓名、手机号、状态，表格显示姓名、手机号、邮箱、状态、创建时间，支持新增编辑删除" \
  -o ./src/views/system/UserManagement.vue
```

### 参数说明

| 参数 | 说明 | 默认值 |
|------|------|--------|
| `<name>` | 页面名称（kebab-case） | **必填** |
| `-d, --description` | 跳过交互，直接用此描述生成 | 无（进入交互模式） |
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
    文章管理
    系统配置

? 请描述页面功能: 订单列表，查询订单号、客户名称、日期范围、状态，
  表格显示订单号、客户、金额、状态、创建时间，支持查看详情和删除

? 输出路径: ./src/views/OrderList.vue

⏳ 正在生成...

✔ 已生成: ./src/views/OrderList.vue
  Generated CRUD page with:
  - 4 query form fields
  - 6 table columns (including actions)
  - Actions: view, delete
  - Dialog form with 5 fields and validation
  - Status column with ElTag render
  - Delete with confirmation dialog
```

### 描述技巧

描述越明确，生成代码越精确。格式：**页面名称 + 查询字段 + 表格字段 + 操作类型**

```bash
# ✅ 好 — 明确分段
"用户管理页面，
 查询条件有姓名、手机号、状态，
 表格显示姓名、手机号、邮箱、状态、创建时间，
 支持新增编辑删除"

# ✅ 好 — 简洁罗列（自动推断查询和表格共用）
"员工管理：姓名、部门、职位、手机号、状态"

# ✅ 好 — 只读列表
"操作日志查询，查询关键词、级别、日期范围，表格显示时间、级别、操作人、内容，只查看"

# ❌ 差 — 太模糊
"做一个管理页面"
```

### 关键词智能识别

引擎根据字段名自动推断控件类型：

| 字段关键词 | 映射控件 | 示例字段 |
|-----------|---------|---------|
| 状态、类型、分类、级别、来源 | Select 下拉选择 | 订单状态、用户类型 |
| 日期、创建时间、更新时间 | datePicker 日期选择器 | 注册日期、下单时间 |
| 时间、时刻 | timePicker 时间选择器 | 开始时间 |
| 开关、启用、是否 | Switch 开关 | 是否启用 |
| 评分、星级 | Rate 评分 | 满意度评分 |
| 头像、图片、文件、附件 | Upload 上传 | 用户头像 |
| 备注、描述、内容、简介 | Input(textarea) 多行文本 | 备注信息 |
| 性别、单选 | Radio 单选框 | 性别 |
| 多选、标签、兴趣 | Checkbox 多选框 | 兴趣爱好 |
| 省市、城市、地区、层级 | Cascader 级联选择 | 所在城市 |
| 进度、区间、范围 | Slider 滑块 | 完成进度 |
| 穿梭、分配 | Transfer 穿梭框 | 权限分配 |
| 其他 | Input 输入框 | 姓名、手机号 |

### 操作类型识别

在描述中用"支持 XXX"指定操作：

| 关键词 | 生成内容 |
|--------|---------|
| 新增 / 添加 / 创建 | 新增按钮 + 弹窗表单 |
| 编辑 / 修改 / 更新 | 编辑按钮 + 弹窗表单（回填数据） |
| 删除 / 移除 | 删除按钮 + ElMessageBox 确认 |
| 查看 / 详情 | 查看按钮 + 只读弹窗 |
| 导出 | 导出按钮 |
| 导入 | 导入按钮 |
| 只查看 / 只读 | 仅生成表格，无操作按钮 |
| 不指定 | 默认生成新增、编辑、删除 |

### 8 个内置预设

| 预设 | 查询 | 表格 | 操作 |
|------|------|------|------|
| 用户管理 | 姓名、手机号、状态 | 姓名、手机号、邮箱、状态、创建时间 | 增删改 |
| 订单列表 | 订单号、客户、日期、状态 | 订单号、客户、金额、状态、创建时间 | 查看、删除 |
| 商品管理 | 名称、分类、状态 | 名称、分类、价格、库存、状态 | 增删改 |
| 日志查询 | 关键词、级别、日期 | 时间、级别、操作人、内容 | 只读 |
| 角色权限 | 角色名称、状态 | 角色名称、描述、状态、创建时间 | 增删改 |
| 员工花名册 | 姓名、部门、职位 | 姓名、性别、年龄、部门、职位、手机号、状态 | 新增、编辑 |
| 文章管理 | 标题、分类、状态 | 标题、分类、创建人、创建时间、状态 | 增删改 |
| 系统配置 | 名称、类型 | 名称、编号、类型、描述、状态 | 增删改导出 |

---

## validate — 校验配置

校验 JSON 配置文件是否符合 es-plus-ui 组件的 Schema 规范。

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
| `form-item` | 表单项配置 | EsForm 的 `formItemList` |
| `table-column` | 表格列配置 | EsTable 的 `columns` |
| `table-options` | 表格选项配置 | EsTable 的 `options` |
| `dialog-options` | 弹窗配置 | useDialog 参数 |

### 自动检测规则

不指定 `--schema` 时，根据 JSON 内容自动判断：

| JSON 中包含 | 判定为 |
|-------------|--------|
| `columns` / `tableData` | `table-column` |
| `httpRequest` / `configTableOut` / `apiParams` | `table-options` |
| `render` / `configBtn` / `isDraggable` | `dialog-options` |
| 其他 | `form-item` |

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

生成最小化的 es-plus 页面模板，适合需要手动编写配置的场景。

### 基本用法

```bash
# 默认：查询 + 表格
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
|---------|---------|
| `query` | EsForm 查询表单 + 查询/重置按钮 |
| `table` | EsTable 表格 + 分页 + httpRequest 模板 |
| `dialog` | useDialog 引入 + dialog 实例 |

### 生成结果

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
  stripe: true,
  highlightCurrentRow: true,
  headerCellStyle: { background: '#f5f7fa' },
  httpRequest: async (params) => {
    // TODO: 替换为实际接口调用
  },
  configTableOut: { total: 'total', tableData: 'data', pageSize: 'pageSize', current: 'pageIndex' },
}
</script>
```

---

## 生成代码说明

生成的代码是完整可运行的 Vue 3 SFC，通常只需修改以下部分：

### 1. 替换接口地址

```js
// 修改 options 中的 httpRequest
const options = {
  httpRequest: async (params) => {
    const res = await axios.get('/api/user/list', { params: params.formParams })
    return res.data
  },
  configTableOut: {
    total: 'total',       // 总条数字段名
    tableData: 'records', // 列表数据字段名（根据实际接口调整）
    pageSize: 'pageSize',
    current: 'pageIndex'
  }
}
```

### 2. 替换删除接口

```js
function handleDelete(row) {
  ElMessageBox.confirm('确定删除该条数据吗？', '提示', { type: 'warning' })
    .then(async () => {
      await axios.delete(`/api/user/${row.id}`)  // 替换为实际接口
      ElMessage.success('删除成功')
      tableRef.value?.httpRequestInstance()
    })
}
```

### 3. 替换保存接口

```js
// openForm 函数中的确定按钮
click: async (_, { close, getRefs }) => {
  try {
    await getRefs('form')?.validate()
    await axios.post('/api/user/save', formData)  // 替换为实际接口
    close()
    tableRef.value?.httpRequestInstance()
  } catch { /* 表单验证失败 */ }
}
```

### 4. 调整 Select 选项数据

```js
// 默认生成的是占位选项，替换为实际数据或从接口获取
{ prop: 'status', label: '状态', formtype: 'Select',
  dataOptions: [{ label: '启用', value: 1 }, { label: '禁用', value: 0 }] }
```

---

## 与 @es-plus/mcp-server 的区别

| 特性 | @es-plus/cli | @es-plus/mcp-server |
|------|-------------|---------------------|
| 使用方式 | 终端命令行 | AI 编码工具自动调用 |
| 适用场景 | 批量生成、CI/CD | AI 对话式开发 |
| 交互方式 | 终端问答 / 命令参数 | AI 自然语言对话 |
| 输出 | 直接写入 .vue 文件 | 返回代码字符串给 AI |

**推荐组合：** 项目初始化用 CLI 批量生成 → 日常迭代用 MCP Server 让 AI 辅助修改。

---

## 常见问题

### Q: 支持 TypeScript 吗？

生成的是 `<script setup>` 格式（JavaScript）。如需 TypeScript，将 `<script setup>` 改为 `<script setup lang="ts">` 并添加类型注解即可。

### Q: 生成的代码依赖什么？

- `vue` >= 3.3
- `es-plus-ui` — 提供 EsForm、EsTable、useDialog
- `element-plus` — 提供 ElTag、ElMessageBox、ElMessage 等

### Q: Windows 下 npx 报错？

确保使用 PowerShell 或 Git Bash，Node.js >= 18：

```bash
npx @es-plus/cli create user-management
```

---

## 相关链接

- [es-plus-ui 组件库](https://www.npmjs.com/package/es-plus-ui)
- [@es-plus/mcp-server AI 集成](https://www.npmjs.com/package/@es-plus/mcp-server)
- [GitHub 仓库](https://github.com/es-plus-ui/es-plus)

## License

[MIT](./LICENSE)
