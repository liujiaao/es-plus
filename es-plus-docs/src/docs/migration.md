# 从 Element Plus 迁移

如果你已经在使用 Element Plus，迁移到 ES-Plus 非常简单。ES-Plus 构建在 Element Plus 之上，完全兼容其 API，只是提供了更高层的配置化抽象。

## 迁移策略

ES-Plus 不替代 Element Plus，而是增强它。你可以：

1. **渐进迁移** — 新页面用 ES-Plus，旧页面保持不变
2. **混合使用** — 同一页面中 ES-Plus 组件与 Element Plus 原生组件并存
3. **全量迁移** — 用 ES-Plus 重写现有 CRUD 页面

## 表单迁移

### Element Plus 原生写法

```vue
<template>
  <el-form :model="form" :rules="rules" ref="formRef" label-width="80px">
    <el-row :gutter="20">
      <el-col :span="6">
        <el-form-item label="姓名" prop="name">
          <el-input v-model="form.name" placeholder="请输入" clearable />
        </el-form-item>
      </el-col>
      <el-col :span="6">
        <el-form-item label="状态" prop="status">
          <el-select v-model="form.status" clearable placeholder="请选择">
            <el-option v-for="item in statusOptions" :key="item.value"
              :label="item.label" :value="item.value" />
          </el-select>
        </el-form-item>
      </el-col>
      <el-col :span="6">
        <el-form-item label="日期" prop="date">
          <el-date-picker v-model="form.date" type="daterange"
            value-format="YYYY-MM-DD" start-placeholder="开始" end-placeholder="结束" />
        </el-form-item>
      </el-col>
      <el-col :span="6">
        <el-form-item label-width="0">
          <el-button type="primary" @click="handleQuery">查询</el-button>
          <el-button @click="handleReset">重置</el-button>
        </el-form-item>
      </el-col>
    </el-row>
  </el-form>
</template>

<script setup>
import { ref, reactive } from 'vue'
const formRef = ref()
const form = reactive({ name: '', status: '', date: [] })
const rules = { name: [{ required: true, message: '请输入姓名' }] }
const statusOptions = [{ label: '启用', value: 1 }, { label: '禁用', value: 0 }]
const handleQuery = () => { /* 手动触发查询 */ }
const handleReset = () => { formRef.value.resetFields() }
</script>
```

### ES-Plus 写法

```vue
<template>
  <es-form
    :model="form"
    :form-item-list="formItems"
    :config-btn="btns"
  />
</template>

<script setup>
import { reactive } from 'vue'
const form = reactive({ name: '', status: '', date: [] })
const formItems = [
  { prop: 'name', label: '姓名', formtype: 'Input', span: 6, attrs: { placeholder: '请输入', clearable: true } },
  { prop: 'status', label: '状态', formtype: 'Select', span: 6,
    dataOptions: [{ label: '启用', value: 1 }, { label: '禁用', value: 0 }],
    attrs: { clearable: true } },
  { prop: 'date', label: '日期', formtype: 'datePicker', span: 6,
    attrs: { type: 'daterange', valueFormat: 'YYYY-MM-DD', startPlaceholder: '开始', endPlaceholder: '结束' } }
]
const btns = [
  { name: '查询', type: 'primary', key: 'query', triggerEvent: true },
  { name: '重置', key: 'reset', triggerEvent: true }
]
</script>
```

**关键差异：**

| Element Plus | ES-Plus | 说明 |
|---|---|---|
| `el-form-item` + `el-input` 每个字段 5-8 行 | `formItemList` 一行配置 | 配置替代模板 |
| 手动 `v-model` 绑定 | 自动绑定到 `model` | 减少重复代码 |
| 手动 `@click` 查询/重置 | `triggerEvent: true` 自动触发 | 零事件代码 |
| 手动 `resetFields()` | 自动重置 | 无需手动调用 |

## 表格迁移

### Element Plus 原生写法

```vue
<template>
  <el-table :data="tableData" border>
    <el-table-column prop="name" label="姓名" width="120" />
    <el-table-column prop="status" label="状态" width="100">
      <template #default="{ row }">
        <el-tag :type="row.status === 1 ? 'success' : 'info'">
          {{ row.status === 1 ? '启用' : '禁用' }}
        </el-tag>
      </template>
    </el-table-column>
    <el-table-column prop="operate" label="操作" width="160">
      <template #default="{ row }">
        <el-button type="primary" text @click="handleEdit(row)">编辑</el-button>
        <el-button type="danger" text @click="handleDelete(row)">删除</el-button>
      </template>
    </el-table-column>
  </el-table>
  <el-pagination
    background
    layout="total, sizes, prev, pager, next"
    :total="total"
    :page-size="pageSize"
    :current-page="currentPage"
    @size-change="handleSizeChange"
    @current-change="handlePageChange"
  />
</template>
```

### ES-Plus 写法

```vue
<template>
  <es-table
    :columns="columns"
    :options="options"
    v-model:data-source="tableData"
    v-model:pagination="pagination"
  />
</template>

<script setup>
const columns = [
  { prop: 'name', label: '姓名', width: 120 },
  { prop: 'status', label: '状态', width: 100,
    render: (_, { row }) => h(ElTag, { type: row.status === 1 ? 'success' : 'info' }, () => row.status === 1 ? '启用' : '禁用') },
  { prop: 'operate', label: '操作', width: 160,
    btns: [
      { name: '编辑', type: 'primary', clickEvent: (row) => handleEdit(row) },
      { name: '删除', type: 'danger', clickEvent: (row) => handleDelete(row) }
    ] }
]
const options = { border: true, httpRequest: mockRequest, apiParams: { url: '/api/list' }, rowkey: 'id' }
</script>
```

## 弹窗迁移

### Element Plus 原生写法

```vue
<template>
  <el-dialog v-model="visible" title="编辑" width="600px">
    <el-form :model="form" ref="formRef">
      <!-- 表单内容 -->
    </el-form>
    <template #footer>
      <el-button @click="visible = false">取消</el-button>
      <el-button type="primary" @click="handleSubmit">确定</el-button>
    </template>
  </el-dialog>
</template>

<script setup>
const visible = ref(false)
const formRef = ref()
const open = () => { visible.value = true }
const handleSubmit = async () => {
  await formRef.value.validate()
  // 提交逻辑
  visible.value = false
}
</script>
```

### ES-Plus 写法

```tsx
const dialog = useDialog()

function openEditDialog(row) {
  const formData = reactive({ ...row })
  dialog({
    title: '编辑',
    width: '600px',
    render: (h, { registerRef }) => (
      <es-form
        ref={(el) => { if (el) registerRef('formRef', el) }}
        model={formData}
        formItemList={[{ prop: 'name', label: '名称', formtype: 'Input', span: 24 }]}
      />
    ),
    configBtn: [
      { name: '取消', click: (_, { close }) => close() },
      { name: '确定', type: 'primary', click: (_, { close, getRefs }) => {
        getRefs('formRef')?.validate().then(() => { /* 提交 */ close() })
      }}
    ]
  })
}
```

**关键差异：**

| Element Plus | ES-Plus | 说明 |
|---|---|---|
| 模板声明 `<el-dialog>` | 函数调用 `dialog()` | 命令式，无需模板 |
| 手动管理 `visible` 状态 | 自动管理 | 减少状态管理 |
| `ref` 引用表单 | `registerRef` + `getRefs` | 更安全的引用传递 |

## 兼容性

- ES-Plus 组件内部使用 Element Plus 原生组件，**所有 Element Plus 属性均可通过 `attrs` 透传**
- ES-Plus 的 `el-form`、`el-table` 实例可通过 `getFormRef()`、`refs` 获取，支持所有 Element Plus 方法
- Element Plus 的全局配置（`app.use(ElementPlus, { size: 'small' })`）对 ES-Plus 同样生效
