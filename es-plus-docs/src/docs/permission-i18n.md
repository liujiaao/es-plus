# 权限控制与国际化

@es-plus/vue3 内置了按钮级权限控制和 i18n 国际化支持，通过插件安装时注入配置即可全局生效。

## 权限控制

### 配置方式

在 `app.use()` 时传入 `permission` 函数，接收权限标识字符串，返回 `boolean`：

```typescript
import ESPlus from '@es-plus/vue3'

const userPermissions = ['user:add', 'user:edit', 'user:view']

app.use(ESPlus, {
  permission: (value: string) => userPermissions.includes(value)
})
```

### 按钮配置

在 `BtnConfig`（EsForm `configBtn`、EsTable `configBtn`、useDialog `configBtn`）或表格操作列 `btns` 中，通过 `permissionValue` 声明按钮所需权限：

```typescript
const queryBtns = [
  { name: '查询', type: 'primary', key: 'query', triggerEvent: true },
  { name: '重置', key: 'rest', triggerEvent: true },
  { name: '新增', type: 'primary', key: 'add', permissionValue: 'user:add', click: handleAdd },
  { name: '删除', type: 'danger', key: 'delete', permissionValue: 'user:delete', click: handleBatchDelete },
  { name: '导出', key: 'export', permissionValue: 'user:export', click: handleExport },
]
```

当 `permission('user:delete')` 返回 `false` 时，删除按钮自动隐藏，无需手写 `v-if`。

### 表格操作列

```typescript
const columns = [
  { prop: 'name', label: '姓名' },
  {
    prop: 'operate', label: '操作',
    btns: [
      { name: '编辑', type: 'primary', permissionValue: 'user:edit', clickEvent: handleEdit },
      { name: '删除', type: 'danger', permissionValue: 'user:delete', clickEvent: handleDelete },
    ]
  }
]
```

### 弹窗按钮

```typescript
dialog({
  title: '编辑用户',
  configBtn: [
    { name: '取消', click: (_, { close }) => close() },
    {
      name: '保存',
      type: 'primary',
      permissionValue: 'user:edit',
      click: async (_, { close }) => { /* ... */ }
    }
  ]
})
```

### 权限覆盖范围

| 组件 | 配置位置 | 说明 |
|------|----------|------|
| EsForm | `configBtn` | 查询区域工具栏按钮 |
| EsTable | `options.configBtn` | 表格上方工具栏按钮 |
| EsTable | `columns[].btns` | 操作列行内按钮（prop="operate"） |
| useDialog | `configBtn` | 弹窗底部按钮 |

### 动态权限

`permission` 函数在每次渲染时调用，因此权限变更会实时生效：

```typescript
const permissions = reactive(new Set(['user:view']))

app.use(ESPlus, {
  permission: (value) => permissions.has(value)
})

// 之后动态添加权限
permissions.add('user:edit')
// → 编辑按钮自动显示
```

### 未配置时的行为

如果安装时未传入 `permission` 函数，所有按钮默认显示（向后兼容）。`permissionValue` 字段会被忽略。

---

## 国际化 (i18n)

### 配置方式

在 `app.use()` 时传入 `t` 翻译函数：

```typescript
import ESPlus from '@es-plus/vue3'
import { createI18n } from 'vue-i18n'

const i18n = createI18n({
  locale: 'en',
  messages: {
    en: {
      form: { name: 'Name', phone: 'Phone', status: 'Status' },
      table: { name: 'Name', phone: 'Phone', email: 'Email' }
    },
    zh: {
      form: { name: '姓名', phone: '手机号', status: '状态' },
      table: { name: '姓名', phone: '手机号', email: '邮箱' }
    }
  }
})

app.use(i18n)
app.use(ESPlus, {
  t: (key: string) => i18n.global.t(key)
})
```

### 表单项使用

在 `FormItemOption` 中添加 `labelKey` 字段。组件优先使用 `t(labelKey)` 的结果，如果未配置 `t` 函数则回退到 `label`：

```typescript
const formItems = [
  { prop: 'name', label: '姓名', labelKey: 'form.name', formtype: 'Input', span: 6 },
  { prop: 'phone', label: '手机号', labelKey: 'form.phone', formtype: 'Input', span: 6 },
  { prop: 'status', label: '状态', labelKey: 'form.status', formtype: 'Select', span: 6 }
]
```

当 `locale` 切换为 `'en'` 时，表单标签自动显示为 `Name`、`Phone`、`Status`。

### 表格列使用

在 `TableColumn` 中同样支持 `labelKey`：

```typescript
const columns = [
  { prop: 'name', label: '姓名', labelKey: 'table.name' },
  { prop: 'phone', label: '手机号', labelKey: 'table.phone' },
  { prop: 'email', label: '邮箱', labelKey: 'table.email' }
]
```

### 回退机制

| 条件 | 显示内容 |
|------|----------|
| 有 `labelKey` + 有 `t` 函数 | `t(labelKey)` 的返回值 |
| 有 `labelKey` + 无 `t` 函数 | `label` 原始值 |
| 无 `labelKey` | `label` 原始值 |

### 不使用 vue-i18n

`t` 函数不依赖任何特定 i18n 库，只要是 `(key: string) => string` 的函数即可：

```typescript
// 简单的键值对翻译
const messages = {
  'form.name': 'Name',
  'form.status': 'Status'
}

app.use(ESPlus, {
  t: (key) => messages[key] || key
})
```

---

## 组合使用

权限和 i18n 可以同时配置：

```typescript
app.use(ESPlus, {
  permission: (value) => userPermissions.includes(value),
  t: (key) => i18n.global.t(key)
})
```

### TypeScript 类型

```typescript
import type { EsPlusOptions } from '@es-plus/vue3'

const options: EsPlusOptions = {
  permission: (value) => checkPermission(value),
  t: (key) => translate(key)
}

app.use(ESPlus, options)
```

### 完整示例

```vue
<template>
  <es-table ref="tableRef" :columns="columns" :options="options"
    v-model:data-source="tableData" v-model:pagination="pagination">
    <es-form :model="queryForm" :form-item-list="formItems" :config-btn="queryBtns" />
  </es-table>
</template>

<script setup>
import { reactive, ref } from 'vue'

const queryForm = reactive({ name: '', status: '' })

const formItems = [
  { prop: 'name', label: '姓名', labelKey: 'form.name', formtype: 'Input', span: 6 },
  { prop: 'status', label: '状态', labelKey: 'form.status', formtype: 'Select', span: 6,
    dataOptions: [{ label: '启用', value: 1 }, { label: '禁用', value: 0 }] }
]

const queryBtns = [
  { name: '查询', type: 'primary', key: 'query', triggerEvent: true },
  { name: '重置', key: 'rest', triggerEvent: true },
  { name: '新增', type: 'primary', permissionValue: 'user:add', click: () => {} },
  { name: '删除', type: 'danger', permissionValue: 'user:delete', click: () => {} },
]

const columns = [
  { prop: 'name', label: '姓名', labelKey: 'table.name' },
  { prop: 'status', label: '状态', labelKey: 'table.status' },
  { prop: 'operate', label: '操作', btns: [
    { name: '编辑', type: 'primary', permissionValue: 'user:edit', clickEvent: () => {} },
    { name: '删除', type: 'danger', permissionValue: 'user:delete', clickEvent: () => {} },
  ]}
]

const tableData = ref([])
const pagination = ref({ current: 1, pageSize: 10, total: 0 })
const options = { border: true }
</script>
```
