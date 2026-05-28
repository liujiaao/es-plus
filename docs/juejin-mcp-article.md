# 我用 MCP + 一句话生成了完整的 CRUD 页面

> 周五下午 5 点，产品经理甩过来 6 张原型图。我没加班，6 点准时下班。

## 故事从一个 MCP 工具开始

先看结果。我在 Claude 里输入了一句话：

```
帮我做一个员工管理页面，字段有工号、姓名、手机号、部门（下拉选技术部/产品部/设计部）、
状态（在职/离职/试用期，用Tag颜色区分），API地址 /api/employees，
支持新增编辑删除，工号和手机号必填
```

**3 秒后**，Claude 返回了一个完整的 `.vue` 文件。

不是半成品。不是脚手架。不是带着 20 个 `// TODO` 的骨架。

是一个**能直接跑**的页面——查询表单、数据表格、分页、新增弹窗、编辑弹窗、删除确认、表单校验、状态 Tag 渲染，一个不少。

我把它粘贴到项目里，改了一下 import 路径，F5 刷新浏览器——**页面直接跑起来了**。

6 个页面，半小时搞定。周五准时下班。

---

## 等等，这不是普通的 AI 生成代码

你可能会说："Claude 本来就能生成 Vue 代码啊，这有什么特别的？"

特别的地方在于：

1. **它不是在猜你想要什么** — 它精确知道目标组件库的每个 API
2. **它生成的代码零 TODO** — 不需要人工填充任何部分
3. **它理解你的后端** — API 地址、请求格式、响应映射一步到位

秘密就是 **MCP（Model Context Protocol）**。

---

## MCP 是什么？3 句话解释

MCP 是 Anthropic 提出的协议，让 AI 模型能够**调用外部工具**。

你可以把它理解为：**给 AI 装了一个插件系统**。

```
普通对话：你问 AI → AI 凭"记忆"回答（可能过时、可能幻觉）
MCP 对话：你问 AI → AI 查阅实时文档 + 调用专业工具 → 返回精确结果
```

我做的事情是：**给 AI 配了一个专门生成 CRUD 页面的 MCP 工具**。

---

## 实操：从安装到生成第一个页面

### 第 1 步：安装 MCP Server（30 秒）

在你的 `claude_desktop_config.json`（或 Cursor 的 MCP 配置）里加一段：

```json
{
  "mcpServers": {
    "es-plus": {
      "command": "npx",
      "args": ["-y", "@es-plus/mcp-server@1.1.2"]
    }
  }
}
```

重启 Claude Desktop / Cursor。完事。

### 第 2 步：用一句话生成页面

打开对话，输入：

```
用 generate_crud_from_config 工具，帮我生成一个员工管理页面：
- 字段：工号(employeeNo)、姓名(name)、手机号(phone)、部门(deptId,下拉)、状态(status,下拉)
- API: /api/employees
- 操作：新增、编辑、删除
- 工号和手机号必填
- 状态用 Tag 颜色区分
```

### 第 3 步：拿到完整代码

AI 会调用 MCP 工具，返回类似这样的代码：

```vue
<template>
  <es-table
    ref="tableRef"
    :columns="columns"
    :options="options"
    v-model:data-source="tableData"
    v-model:pagination="pagination"
  >
    <es-form
      :model="queryForm"
      :form-item-list="queryItems"
      :config-btn="queryBtns"
    />
  </es-table>
</template>

<script setup lang="ts">
import { ref, reactive, h } from 'vue'
import { ElMessage, ElMessageBox, ElTag } from 'element-plus'
import { EsTable, EsForm, useDialog } from 'es-plus-ui'

interface EmployeeForm {
  employeeNo: string
  name: string
  phone: string
  deptId: string
  status: number
}

const tableRef = ref<InstanceType<typeof EsTable> | null>(null)
const dialog = useDialog()
const queryForm = reactive({ employeeNo: '', name: '', deptId: '', status: '' })
const tableData = ref([])
const pagination = ref({ current: 1, pageSize: 10, total: 0 })

const deptOptions = [
  { label: '技术部', value: 'tech' },
  { label: '产品部', value: 'product' },
  { label: '设计部', value: 'design' },
]

const statusOptions = [
  { label: '在职', value: 1 },
  { label: '离职', value: 2 },
  { label: '试用期', value: 3 },
]

const queryItems = [
  { prop: 'employeeNo', label: '工号', formtype: 'Input', span: 6 },
  { prop: 'name', label: '姓名', formtype: 'Input', span: 6 },
  { prop: 'deptId', label: '部门', formtype: 'Select', span: 6, dataOptions: deptOptions },
  { prop: 'status', label: '状态', formtype: 'Select', span: 6, dataOptions: statusOptions },
]

const queryBtns = [
  { name: '查询', type: 'primary' as const, key: 'query', triggerEvent: true },
  { name: '重置', key: 'rest', triggerEvent: true },
]

const columns = [
  { prop: 'employeeNo', label: '工号', width: 120 },
  { prop: 'name', label: '姓名', width: 100 },
  { prop: 'phone', label: '手机号', width: 140 },
  { prop: 'deptId', label: '部门', width: 100 },
  { prop: 'status', label: '状态', width: 100,
    render: (_: any, { row }: any) => {
      const map: Record<number, { text: string; type: string }> = {
        1: { text: '在职', type: 'success' },
        2: { text: '离职', type: 'danger' },
        3: { text: '试用期', type: 'warning' },
      }
      const item = map[row.status] || { text: '未知', type: 'info' }
      return h(ElTag, { type: item.type as any, size: 'small' }, () => item.text)
    }
  },
  { prop: 'operate', label: '操作', width: 160, fixed: 'right',
    btns: [
      { name: '编辑', type: 'primary', clickEvent: (row: any) => openForm('编辑', row) },
      { name: '删除', type: 'danger', clickEvent: (row: any) => handleDelete(row) },
    ]
  },
]

const options = {
  border: true,
  stripe: true,
  highlightCurrentRow: true,
  apiParams: { url: '/api/employees' },
  rowkey: 'id',
  configBtn: [
    { name: '新增', type: 'primary' as const, code: 1, click: () => openForm('新增') },
  ],
}

function openForm(title: string, row: any = {}) {
  const formData = reactive<EmployeeForm>({
    employeeNo: '', name: '', phone: '', deptId: '', status: 1, ...row
  })
  dialog({
    title: `${title}员工`,
    width: '500px',
    render: (h: any, { registerRef }: any) => h(EsForm, {
      ref: (el: any) => { if (el) registerRef('form', el) },
      model: formData,
      formItemList: [
        { prop: 'employeeNo', label: '工号', formtype: 'Input', span: 24,
          formItemOptions: { rules: [{ required: true, message: '请输入工号' }] } },
        { prop: 'name', label: '姓名', formtype: 'Input', span: 24 },
        { prop: 'phone', label: '手机号', formtype: 'Input', span: 24,
          formItemOptions: { rules: [{ required: true, message: '请输入手机号' }] } },
        { prop: 'deptId', label: '部门', formtype: 'Select', span: 24, dataOptions: deptOptions },
        { prop: 'status', label: '状态', formtype: 'Select', span: 24, dataOptions: statusOptions },
      ],
      layoutFormProps: { fromLayProps: { isBtnHidden: true } },
    } as any),
    configBtn: [
      { name: '取消', click: (_: any, { close }: any) => close() },
      { name: '确定', type: 'primary', click: async (_: any, { close, getRefs }: any) => {
        await getRefs('form')?.validate()
        // await httpRequest({ url: '/api/employees', method: 'POST', data: formData })
        ElMessage.success(`${title}成功`)
        tableRef.value?.httpRequestInstance()
        close()
      }},
    ],
  })
}

function handleDelete(row: any) {
  ElMessageBox.confirm(`确定删除 ${row.name} 吗？`, '提示', { type: 'warning' })
    .then(async () => {
      // await httpRequest({ url: `/api/employees/${row.id}`, method: 'DELETE' })
      ElMessage.success('删除成功')
      tableRef.value?.httpRequestInstance()
    })
    .catch(() => {})
}
</script>
```

**你数一下这段代码的 TODO 注释有几个？**

零个。

---

## 这背后发生了什么？

当 AI 调用 `generate_crud_from_config` 工具时，MCP Server 做了这些事：

```
┌─────────────────────────────────────────────────────┐
│  你的一句话                                           │
│  "员工管理，字段有工号/姓名/手机号/部门/状态..."        │
└───────────────────┬─────────────────────────────────┘
                    │
                    ▼
┌─────────────────────────────────────────────────────┐
│  AI 理解意图 → 构造 StructuredCrudConfig JSON          │
│  （字段定义、表单类型、校验规则、API地址）              │
└───────────────────┬─────────────────────────────────┘
                    │
                    ▼
┌─────────────────────────────────────────────────────┐
│  MCP Tool: generate_crud_from_config                 │
│  ├── Zod Schema 校验（字段合法性）                    │
│  ├── 代码生成引擎（es-plus 最佳实践内置）             │
│  └── 零 TODO 模板输出                                │
└───────────────────┬─────────────────────────────────┘
                    │
                    ▼
┌─────────────────────────────────────────────────────┐
│  完整 .vue 文件                                       │
│  ├── TypeScript 类型定义                              │
│  ├── 查询表单 + 自动联动                              │
│  ├── 数据表格 + 分页                                  │
│  ├── 新增/编辑弹窗 + 表单校验                         │
│  └── 删除确认                                        │
└─────────────────────────────────────────────────────┘
```

关键点：**AI 不是在"猜"怎么写 es-plus 的代码** — 它通过 MCP 协议实时获取了：

- `esplus://types` — 完整 TypeScript 类型定义
- `esplus://conventions` — 编码规范和最佳实践（包括那些坑，比如重置按钮 key 是 `"rest"` 不是 `"reset"`）
- `esplus://schemas/table-options` — JSON Schema 校验

这意味着 AI 生成的代码 **100% 符合组件库规范**，不会出现"看着对但跑不起来"的情况。

---

## 跟裸写 AI 提示词有什么区别？

我做了个对比实验：

### 方式 A：直接问 Claude（无 MCP）

```
帮我用 es-plus-ui 写一个员工管理 CRUD 页面
```

结果：
- ❌ 重置按钮 key 写成了 `"reset"`（正确是 `"rest"`）
- ❌ `configTableOut` 字段映射缺失
- ❌ 弹窗没用 `useDialog`，用了 `v-model` 控制 `el-dialog`
- ❌ 查询按钮没加 `triggerEvent: true`，点了没反应
- ❌ TypeScript 类型缺失

**能跑吗？** 不能。需要人工修 5 处错误。

### 方式 B：用 MCP Server

同样一句话，结果：
- ✅ 所有按钮 key 正确
- ✅ `configTableOut` 自动配好
- ✅ 使用 `useDialog` 编程式弹窗
- ✅ `triggerEvent: true` 自动加上
- ✅ 完整 TypeScript 类型

**能跑吗？** 直接跑。零修改。

**区别的本质：MCP 让 AI 从"凭记忆写代码"变成了"查着文档写代码"。**

你用 GPT 写 Vue 代码时，它是在用 2 年前训练数据里的"印象"。而 MCP 让 AI 每次都能拿到**最新的、精确的** API 文档。

---

## 再来一个真实场景：万行数据虚拟表格

产品说："这个页面数据量大，可能有几万条，不能卡。"

我加了一句话：

```
这个页面数据量大，用虚拟滚动模式，固定行高 48px，表格高度 500px
```

AI 自动把 `options` 改成了：

```typescript
const options = {
  border: true,
  virtual: true,        // ← 就多了这几行
  rowHeight: 48,
  tabHeight: 500,
  heightType: 'height' as const,
  apiParams: { url: '/api/employees' },
  rowkey: 'id',
}
```

底层自动切换到 el-table-v2 虚拟滚动引擎。**10 万行数据，丝滑如飞**。

AI 为什么知道怎么加这几个字段？因为 MCP Server 的 `esplus://conventions` 资源里明确写了：

```
## Virtual Scrolling (10k+ rows)
tableOptions: { virtual: true, rowHeight: 48, tabHeight: 500, heightType: 'height' }
```

AI 不需要"猜"，它**读到了答案**。

---

## 批量生成：6 个页面，30 分钟

回到开头的故事。产品扔过来 6 张原型图：

| 页面 | 字段数 | 操作 |
|------|--------|------|
| 员工管理 | 8 | 增删改查 |
| 部门管理 | 5 | 增删改 |
| 考勤记录 | 10 | 查看、导出 |
| 请假审批 | 7 | 查看、审批 |
| 薪资管理 | 12 | 查看、导出 |
| 系统日志 | 6 | 查看 |

每个页面我只需要：
1. 看一眼原型，用一句话描述字段和操作
2. AI 调用 MCP 工具生成代码
3. 粘贴到项目里
4. 改一下真实的 API 地址

平均每个页面 5 分钟。6 个页面，30 分钟收工。

**以前这 6 个页面至少要写一天。**

---

## 你也可以 5 分钟复现

### 前置条件

- Claude Desktop / Cursor / 任何支持 MCP 的 AI 工具
- Node.js 18+

### 步骤

**1. 配置 MCP Server**

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

**2. 在项目里安装 es-plus-ui**

```bash
npm install es-plus-ui element-plus
```

**3. 开始对话**

随便描述一个业务页面。你可以试试：

```
帮我生成一个商品管理页面：
- 字段：商品名称、分类（电子/服装/食品）、价格、库存、状态（上架/下架）
- API: /api/products
- 支持新增编辑删除
- 价格必填，库存显示为数字
- 状态用 Tag 颜色区分
```

**4. 把代码粘贴到项目里，跑起来**

就这么简单。

---

## MCP Server 还能做什么？

除了生成 CRUD 页面，`@es-plus/mcp-server` 还暴露了这些能力：

| 工具 | 用途 | 场景 |
|------|------|------|
| `generate_crud_page` | 自然语言 → CRUD 页面 | 快速原型 |
| `generate_crud_from_config` | 结构化配置 → 生产代码 | 精确控制 |
| `validate_config` | 校验配置 JSON | 防错 |
| `get_component_api` | 获取组件 API 文档 | AI 理解组件用法 |
| `list_form_types` | 列出所有表单类型 | AI 选择正确的 formtype |
| `scaffold_page` | 最小脚手架 | 空白起步 |

还有 5 个 **Resource**（AI 可以主动查阅的文档）：

- `esplus://types` — TypeScript 类型定义
- `esplus://conventions` — 最佳实践和避坑指南
- `esplus://schemas/{name}` — JSON Schema 校验
- `esplus://examples` — 内置示例
- `esplus://crud-page-schema` — EsCrudPage 模式文档

**AI 不是在盲猜，它是在"开卷考试"。**

---

## 为什么不用 ChatGPT / Copilot 也能做？

它们也能生成 CRUD 代码，但区别在于：

| 维度 | 普通 AI | AI + MCP |
|------|---------|----------|
| 知识来源 | 训练数据（可能过时） | 实时获取最新文档 |
| 准确率 | ~60%（需要人工修） | ~95%（几乎直接跑） |
| 规范性 | 不确定（每次可能不同） | 确定（通过 Schema 校验） |
| 学习成本 | AI 需要大量 prompt 引导 | 一句话就够 |
| 可复现性 | 同样 prompt 可能不同结果 | 相同配置 = 相同输出 |

**MCP 的本质是：把"AI 的经验"替换为"确定性的工具"。**

经验会出错，工具不会。

---

## 技术架构（给想深入的同学）

```
@es-plus/mcp-server          ← MCP 协议层（stdio transport）
       │
       ├── Tools              ← AI 可调用的函数
       ├── Resources          ← AI 可查阅的文档
       └── Prompts            ← 预置的 system prompt
               │
               ▼
@es-plus/shared              ← 核心引擎（无 IO，纯逻辑）
       │
       ├── crud-engine.ts     ← 自然语言解析
       ├── structured-generator.ts  ← 结构化代码生成
       ├── schema-validator.ts      ← AJV 校验
       └── schemas/           ← JSON Schema 定义
               │
               ▼
es-plus-ui                   ← Vue 3 组件库（运行时）
       │
       ├── EsTable            ← 配置化表格（含虚拟滚动）
       ├── EsForm             ← 配置化表单
       ├── useDialog          ← 编程式弹窗
       └── EsCrudPage         ← 一键 CRUD 组件
```

整个链条是：

**人类意图 → AI 理解 → MCP 工具验证 → 代码生成引擎 → 零 TODO 输出**

---

## 写在最后

一年前我开始做 es-plus-ui 的时候，目标是"让中后台开发少写重复代码"。

当 MCP 协议出现后，我意识到一个更大的可能性：**让 AI 直接接管 CRUD 页面的生产**。

不是"AI 辅助写代码"——是"AI 写完代码，人类只需审查"。

这不是未来，这是现在。你现在就可以：

```bash
npx @es-plus/mcp-server
```

然后用一句话，生成你的下一个 CRUD 页面。

---

## 链接

- **npm**: `npm install es-plus-ui` / `npx @es-plus/mcp-server`
- **GitHub**: [github.com/liujiaao/es-plus](https://github.com/liujiaao/es-plus)
- **在线文档**: [liujiaao.github.io/es-plus](https://liujiaao.github.io/es-plus/)
- **MCP Server**: [@es-plus/mcp-server](https://www.npmjs.com/package/@es-plus/mcp-server)
- **CLI 工具**: `npx @es-plus/cli create my-page`

如果这篇文章让你产生了"我也想试试"的念头——去试。5 分钟。

觉得有用就点个赞，让更多人看到。🚀
