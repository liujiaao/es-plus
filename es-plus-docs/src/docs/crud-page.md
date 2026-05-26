# EsCrudPage 一站式 CRUD 页面

`EsCrudPage` 是基于 EsTable + EsForm + useDialog 封装的高级组件，通过一份 JSON Schema 即可生成完整的查询表单 + 数据表格 + 多弹窗交互页面。

## 核心特性

- **Schema 驱动** — 一份 JSON 定义整页功能（查询、表格、弹窗）
- **多弹窗架构** — 支持多个独立弹窗，按钮通过 `dialogKey` 声明式绑定
- **灵活按钮配置** — 工具栏和操作列按钮完全自定义
- **自定义弹窗内容** — 支持表单模式和自定义 render 模式
- **向后兼容** — 旧版 `actions` + `dialogFormItems` 配置仍可使用

---

## 基础用法

### 最小配置

```vue
<template>
  <es-crud-page :schema="schema" @dialog-confirm="handleConfirm" />
</template>

<script setup lang="ts">
import type { CrudPageSchema } from 'es-plus-ui'

const schema: CrudPageSchema = {
  formItems: [
    { prop: 'name', label: '姓名', formtype: 'Input' },
    { prop: 'status', label: '状态', formtype: 'Select',
      dataOptions: [{ label: '启用', value: 1 }, { label: '禁用', value: 0 }] }
  ],
  columns: [
    { prop: 'name', label: '姓名', width: 120 },
    { prop: 'status', label: '状态' },
    { prop: 'createTime', label: '创建时间' }
  ],
  tableOptions: {
    border: true,
    apiParams: { url: '/api/users' }
  },
  actions: ['add', 'edit', 'delete'],
  dialogFormItems: [
    { prop: 'name', label: '姓名', formtype: 'Input',
      formItemOptions: { rules: [{ required: true, message: '请输入姓名' }] } },
    { prop: 'status', label: '状态', formtype: 'Select',
      dataOptions: [{ label: '启用', value: 1 }, { label: '禁用', value: 0 }] }
  ]
}

function handleConfirm(dialogKey: string, data: Record<string, unknown>) {
  console.log(`弹窗 ${dialogKey} 确认:`, data)
}
</script>
```

---

## 多弹窗模式（推荐）

v1.4+ 推荐使用显式声明模式，完全控制按钮和弹窗的对应关系：

### 完整示例

```vue
<template>
  <es-crud-page
    ref="crudRef"
    :schema="schema"
    @dialog-confirm="handleDialogConfirm"
    @dialog-cancel="handleDialogCancel"
    @btn-click="handleBtnClick"
  />
</template>

<script setup lang="ts">
import { ref } from 'vue'
import { ElMessage } from 'element-plus'
import type { CrudPageSchema } from 'es-plus-ui'
import ImportUploader from './ImportUploader.vue'

const crudRef = ref()

const schema: CrudPageSchema = {
  // ─── 查询区 ───
  formItems: [
    { prop: 'name', label: '姓名', formtype: 'Input' },
    { prop: 'phone', label: '手机号', formtype: 'Input' },
    { prop: 'status', label: '状态', formtype: 'Select',
      dataOptions: [{ label: '启用', value: 1 }, { label: '禁用', value: 0 }] },
    { prop: 'createTime', label: '创建时间', formtype: 'datePicker',
      attrs: { type: 'daterange', valueFormat: 'YYYY-MM-DD' } }
  ],
  formLayout: { labelWidth: '80px' },

  // ─── 表格列 ───
  columns: [
    { prop: 'name', label: '姓名', width: 120 },
    { prop: 'phone', label: '手机号', width: 140 },
    { prop: 'status', label: '状态', width: 100 },
    { prop: 'createTime', label: '创建时间' }
  ],
  tableOptions: {
    border: true,
    stripe: true,
    apiParams: { url: '/api/users' }
  },

  // ─── 工具栏按钮 ───
  toolbarBtns: [
    { name: '新增', type: 'primary', icon: 'Plus', dialogKey: 'add' },
    { name: '批量导入', icon: 'Upload', dialogKey: 'import' },
    { name: '导出', icon: 'Download', actionType: 'export' },
  ],

  // ─── 操作列 ───
  operationColumn: {
    label: '操作',
    width: 240,
    fixed: 'right',
    btns: [
      { name: '编辑', type: 'primary', dialogKey: 'edit' },
      { name: '审批', type: 'warning', dialogKey: 'approve' },
      { name: '删除', type: 'danger', key: 'delete', confirm: '确定删除该条数据吗？' },
    ]
  },

  // ─── 多弹窗配置 ───
  dialogs: {
    add: {
      title: '新增用户',
      width: '600px',
      formItems: [
        { prop: 'name', label: '姓名', formtype: 'Input',
          formItemOptions: { rules: [{ required: true, message: '请输入姓名' }] } },
        { prop: 'phone', label: '手机号', formtype: 'Input',
          formItemOptions: { rules: [{ required: true, message: '请输入手机号' }] } },
        { prop: 'status', label: '状态', formtype: 'Select',
          dataOptions: [{ label: '启用', value: 1 }, { label: '禁用', value: 0 }] }
      ]
    },
    edit: {
      title: '编辑用户',
      width: '600px',
      formItems: [
        { prop: 'name', label: '姓名', formtype: 'Input' },
        { prop: 'phone', label: '手机号', formtype: 'Input' },
        { prop: 'status', label: '状态', formtype: 'Select',
          dataOptions: [{ label: '启用', value: 1 }, { label: '禁用', value: 0 }] }
      ]
    },
    approve: {
      title: '审批',
      width: '500px',
      formItems: [
        { prop: 'result', label: '审批结果', formtype: 'Radio',
          dataOptions: [{ label: '通过', value: 1 }, { label: '拒绝', value: 0 }] },
        { prop: 'remark', label: '备注', formtype: 'Input', attrs: { type: 'textarea', rows: 4 } }
      ]
    },
    import: {
      title: '批量导入',
      width: '500px',
      render: (h, { close, refresh }) => h(ImportUploader, {
        onSuccess: () => { close(); refresh(); ElMessage.success('导入成功') }
      })
    }
  }
}

// 弹窗确认处理
async function handleDialogConfirm(dialogKey: string, data: Record<string, unknown>) {
  switch (dialogKey) {
    case 'add':
      await fetch('/api/users', { method: 'POST', body: JSON.stringify(data) })
      ElMessage.success('新增成功')
      crudRef.value.refresh()
      break
    case 'edit':
      await fetch(`/api/users/${data.id}`, { method: 'PUT', body: JSON.stringify(data) })
      ElMessage.success('编辑成功')
      crudRef.value.refresh()
      break
    case 'approve':
      await fetch(`/api/users/${data.id}/approve`, { method: 'POST', body: JSON.stringify(data) })
      ElMessage.success('审批完成')
      crudRef.value.refresh()
      break
  }
}

function handleDialogCancel(dialogKey: string) {
  console.log(`弹窗 ${dialogKey} 取消`)
}

// 非弹窗按钮处理
function handleBtnClick(key: string, payload?: Record<string, unknown>) {
  if (key === 'export') {
    window.open('/api/users/export?' + new URLSearchParams(payload as any))
  }
  if (key === 'delete') {
    fetch(`/api/users/${payload?.id}`, { method: 'DELETE' })
      .then(() => { ElMessage.success('删除成功'); crudRef.value.refresh() })
  }
}
</script>
```

---

## 按钮与弹窗绑定机制

核心设计思路：**按钮通过 `dialogKey` 声明打开哪个弹窗，弹窗通过 key 被按钮引用**。

```
toolbarBtns[0].dialogKey = 'add'  ──→  dialogs.add
operationColumn.btns[0].dialogKey = 'edit'  ──→  dialogs.edit
operationColumn.btns[1].dialogKey = 'approve'  ──→  dialogs.approve
```

### 工具栏按钮（toolbarBtns）

```typescript
toolbarBtns: [
  // 点击打开弹窗（dialogKey 指定弹窗 key）
  { name: '新增', type: 'primary', icon: 'Plus', dialogKey: 'add' },
  
  // 点击发出事件（actionType 指定事件 key）
  { name: '导出', icon: 'Download', actionType: 'export' },
  
  // 点击前确认
  { name: '批量删除', type: 'danger', confirm: '确定批量删除选中项？', actionType: 'batchDelete' },
]
```

### 操作列按钮（operationColumn）

```typescript
operationColumn: {
  label: '操作',
  width: 200,
  fixed: 'right',
  btns: [
    // 点击打开弹窗，自动将当前行数据传入弹窗
    { name: '编辑', type: 'primary', dialogKey: 'edit' },
    
    // 点击前确认 + 发出 btn-click 事件
    { name: '删除', type: 'danger', key: 'delete', confirm: '确定删除吗？' },
    
    // 动态隐藏
    { name: '审批', type: 'warning', dialogKey: 'approve',
      hidden: (row) => row.status !== 'pending' },
    
    // 自定义点击
    { name: '下载', click: (row, { refresh }) => downloadFile(row.fileUrl) },
  ]
}
```

隐藏操作列：设置 `operationColumn: false`。

---

## 弹窗配置（dialogs）

每个弹窗以唯一 key 标识，支持两种内容模式：

### 模式 1：表单弹窗（formItems）

适合新增、编辑、审批等标准表单场景：

```typescript
dialogs: {
  add: {
    title: '新增用户',
    width: '600px',
    formItems: [
      { prop: 'name', label: '姓名', formtype: 'Input',
        formItemOptions: { rules: [{ required: true, message: '请输入' }] } },
      { prop: 'email', label: '邮箱', formtype: 'Input',
        formItemOptions: { rules: [{ type: 'email', message: '格式错误' }] } }
    ],
    formLayout: { labelWidth: '80px' }
  }
}
```

### 模式 2：自定义渲染（render）

适合导入上传、详情预览、复杂交互等非标准场景：

```typescript
dialogs: {
  import: {
    title: '批量导入',
    width: '500px',
    isHiddenFooter: true,  // 隐藏默认底部按钮
    render: (h, context) => {
      // context: { row, model, registerRef, close, refresh }
      return h(ImportUploader, {
        onSuccess: () => {
          context.close()
          context.refresh()
        }
      })
    }
  },
  detail: {
    title: (row) => `${row?.name} 的详情`,  // 动态标题
    width: '800px',
    isHiddenFooter: true,
    render: (h, { row }) => h(UserDetail, { userId: row.id })
  }
}
```

### 弹窗生命周期

```typescript
dialogs: {
  edit: {
    title: '编辑',
    formItems: [...],
    onOpen: (row) => {
      console.log('弹窗打开，当前行:', row)
    },
    onConfirm: async (data, { close, refresh, row }) => {
      await api.updateUser(row.id, data)
      close()
      refresh()
    },
    onClose: () => {
      console.log('弹窗关闭')
    }
  }
}
```

### 自定义弹窗底部按钮

```typescript
dialogs: {
  review: {
    title: '审核',
    formItems: [...],
    configBtn: [
      { name: '取消', action: 'cancel' },
      { name: '拒绝', type: 'danger', action: 'custom',
        click: (_, { close }) => { rejectAction(); close() } },
      { name: '通过', type: 'primary', action: 'confirm' }
    ]
  }
}
```

---

## 事件

| 事件名 | 参数 | 说明 |
|--------|------|------|
| `dialog-confirm` | `(dialogKey: string, data: Record<string, unknown>)` | 弹窗确认按钮点击（表单校验通过后） |
| `dialog-cancel` | `(dialogKey: string)` | 弹窗取消按钮点击 |
| `dialog-open` | `(dialogKey: string, row?: Record<string, unknown>)` | 弹窗打开时 |
| `btn-click` | `(key: string, payload?: Record<string, unknown>)` | 非弹窗按钮点击 |
| `query` | `(model: Record<string, unknown>)` | 查询按钮点击 |
| `add` | `()` | 新增按钮点击（向后兼容） |
| `edit` | `(row: Record<string, unknown>)` | 编辑按钮点击（向后兼容） |
| `delete` | `(row: Record<string, unknown>)` | 删除按钮点击（向后兼容） |
| `view` | `(row: Record<string, unknown>)` | 查看按钮点击（向后兼容） |
| `export` | `(model: Record<string, unknown>)` | 导出按钮点击（向后兼容） |

---

## Props

| 属性 | 类型 | 默认值 | 说明 |
|------|------|--------|------|
| `schema` | `CrudPageSchema` | — | CRUD 页面完整配置（必填） |
| `httpRequest` | `(params) => Promise<any>` | — | 自定义 HTTP 请求方法 |
| `autoLoad` | `boolean` | `true` | 是否在挂载时自动请求数据 |

---

## Expose（组件实例方法）

通过 `ref` 获取组件实例后可调用：

| 方法/属性 | 类型 | 说明 |
|-----------|------|------|
| `refresh()` | `() => void` | 刷新表格数据 |
| `getSelectedRows()` | `() => Record<string, unknown>[]` | 获取表格选中行 |
| `openDialog(key, row?)` | `(key: string, row?: Record<string, unknown>) => void` | 主动打开弹窗 |
| `closeDialog(key)` | `(key: string) => void` | 主动关闭弹窗 |
| `tableRef` | `Ref` | 内部 EsTable 实例 |
| `formRef` | `Ref` | 内部 EsForm 实例 |
| `queryModel` | `Record<string, unknown>` | 当前查询表单模型（响应式） |

```typescript
// 用法示例
const crudRef = ref()

// 刷新数据
crudRef.value.refresh()

// 程序化打开弹窗
crudRef.value.openDialog('add')
crudRef.value.openDialog('edit', { id: 1, name: '张三' })

// 获取选中行
const rows = crudRef.value.getSelectedRows()
```

---

## CrudPageSchema 完整类型

```typescript
interface CrudPageSchema {
  // 查询区
  formItems?: FormItemOption[]
  formLayout?: { span?: number; labelWidth?: string | number }
  
  // 工具栏按钮
  toolbarBtns?: CrudBtnConfig[]
  
  // 表格
  columns: TableColumn[]
  tableOptions?: Partial<TableOptions>
  pagination?: PaginationConfig
  
  // 操作列
  operationColumn?: OperationColumnConfig | false
  
  // 多弹窗
  dialogs?: Record<string, CrudDialogConfig>
  
  // 向后兼容（已废弃）
  actions?: CrudAction[]
  dialogFormItems?: FormItemOption[]
  dialogOptions?: Partial<DialogOptions>
  queryBtns?: BtnConfig[]
}
```

### CrudBtnConfig（工具栏按钮）

继承 `BtnConfig`，扩展以下属性：

| 属性 | 类型 | 说明 |
|------|------|------|
| `dialogKey` | `string` | 点击时打开的弹窗 key |
| `actionType` | `string` | 语义动作类型（btn-click 事件的 key） |
| `confirm` | `string \| boolean` | 点击前确认提示 |

### OperationColumnConfig（操作列）

| 属性 | 类型 | 默认值 | 说明 |
|------|------|--------|------|
| `label` | `string` | `'操作'` | 列标题 |
| `width` | `number \| string` | 自动计算 | 列宽 |
| `fixed` | `boolean \| 'left' \| 'right'` | `'right'` | 固定方向 |
| `btns` | `RowBtnConfig[]` | — | 行按钮列表（必填） |

### RowBtnConfig（行按钮）

| 属性 | 类型 | 说明 |
|------|------|------|
| `name` | `string` | 按钮文字 |
| `key` | `string` | 按钮标识（btn-click 事件的 key） |
| `type` | `string` | 按钮类型（primary/danger/warning 等） |
| `icon` | `string` | 图标名称 |
| `permissionValue` | `string` | 权限标识 |
| `dialogKey` | `string` | 点击时打开的弹窗 key，自动传入当前行数据 |
| `confirm` | `string \| boolean` | 点击前确认提示 |
| `hidden` | `boolean \| (row) => boolean` | 是否隐藏 |
| `click` | `(row, context) => void` | 自定义点击处理 |

### CrudDialogConfig（弹窗配置）

| 属性 | 类型 | 说明 |
|------|------|------|
| `title` | `string \| (row?) => string` | 弹窗标题（支持动态） |
| `width` | `string \| number` | 弹窗宽度 |
| `formItems` | `FormItemOption[]` | 表单字段（简单模式） |
| `formLayout` | `{ span?, labelWidth? }` | 表单布局 |
| `render` | `(h, context) => VNode` | 自定义渲染（复杂模式） |
| `configBtn` | `DialogBtnConfig[]` | 自定义底部按钮 |
| `isDraggable` | `boolean` | 可拖拽 |
| `maxHeight` | `string \| number` | 最大高度 |
| `fullscreen` | `boolean` | 全屏 |
| `isHiddenFooter` | `boolean` | 隐藏底部按钮区 |
| `onOpen` | `(row?) => void` | 打开回调 |
| `onConfirm` | `(data, context) => void \| Promise` | 确认回调 |
| `onClose` | `() => void` | 关闭回调 |

### DialogRenderContext（render 函数参数）

| 属性 | 类型 | 说明 |
|------|------|------|
| `row` | `Record<string, unknown>` | 打开弹窗时传入的行数据 |
| `model` | `Record<string, unknown>` | 响应式表单模型 |
| `registerRef` | `(name, el) => void` | 注册组件引用 |
| `close` | `() => void` | 关闭弹窗 |
| `refresh` | `() => void` | 刷新表格 |

### DialogActionContext（onConfirm 参数）

| 属性 | 类型 | 说明 |
|------|------|------|
| `close` | `() => void` | 关闭弹窗 |
| `refresh` | `() => void` | 刷新表格 |
| `getRefs` | `(name?) => any` | 获取弹窗内组件引用 |
| `row` | `Record<string, unknown>` | 当前行数据 |

---

## 向后兼容

旧版配置（`actions` + `dialogFormItems`）仍然可用，组件内部自动转换为新格式：

| 旧配置 | 自动转换为 |
|--------|-----------|
| `actions: ['add']` | `toolbarBtns: [{ name: '新增', dialogKey: 'add' }]` |
| `actions: ['edit', 'delete']` | `operationColumn.btns: [{ name: '编辑', dialogKey: 'edit' }, { name: '删除', confirm: '...' }]` |
| `actions: ['export']` | `toolbarBtns: [{ name: '导出', actionType: 'export' }]` |
| `dialogFormItems: [...]` | `dialogs: { add: { formItems: [...] }, edit: { formItems: [...] } }` |

旧版事件同样保持兼容：

```typescript
// 旧事件仍然正常触发
@add → 点击新增按钮时
@edit → 点击编辑按钮时
@delete → 点击删除按钮时
@btn-click="(key, data)" → key='add-confirm' / 'edit-confirm'
```

---

## 与 AI 工具集成

### 使用 MCP Server 生成

AI 编码工具可通过 `generate_crud_from_config` 工具生成 EsCrudPage 的完整配置：

```json
{
  "name": "UserManage",
  "apiUrl": "/api/users",
  "fields": [...],
  "toolbarBtns": [
    { "name": "新增", "type": "primary", "icon": "Plus", "dialogKey": "add" }
  ],
  "operationColumn": {
    "btns": [
      { "name": "编辑", "type": "primary", "dialogKey": "edit" },
      { "name": "删除", "type": "danger", "confirm": true }
    ]
  },
  "dialogs": {
    "add": { "title": "新增用户", "formItems": [...] },
    "edit": { "title": "编辑用户", "formItems": [...] }
  }
}
```

详见 [MCP Server 文档](/guide/mcp-server) 和 [CLI 工具文档](/guide/cli)。

---

## 常见问题

### Q: 弹窗打开后如何获取行数据？

操作列按钮（`operationColumn.btns`）点击时会自动将当前行传入弹窗。在 `formItems` 模式下，表单会自动用行数据填充。在 `render` 模式下，通过 `context.row` 访问。

### Q: 如何在弹窗中做异步校验？

使用 `onConfirm` 回调，它在表单校验通过后才触发：

```typescript
onConfirm: async (data, { close, refresh, getRefs }) => {
  const form = getRefs('dialogForm')
  // 表单已通过 validate，直接提交
  await submitData(data)
  close()
  refresh()
}
```

### Q: 如何隐藏操作列？

设置 `operationColumn: false`：

```typescript
const schema = {
  columns: [...],
  operationColumn: false,  // 不显示操作列
  toolbarBtns: [...]
}
```

### Q: 如何混用新旧模式？

不建议混用。如果提供了 `toolbarBtns`、`operationColumn` 或 `dialogs` 中的任一配置，组件将使用新模式。否则从 `actions` + `dialogFormItems` 推导。

### Q: 如何程序化控制弹窗？

通过组件 ref 调用 `openDialog` / `closeDialog`：

```typescript
const crudRef = ref()

// 打开新增弹窗
crudRef.value.openDialog('add')

// 打开编辑弹窗并传入数据
crudRef.value.openDialog('edit', { id: 1, name: '张三' })

// 关闭弹窗
crudRef.value.closeDialog('edit')
```
