# 迁移指南

本文涵盖两类迁移：

1. **v1.4.0 包名重命名** — 从 `es-plus-ui` 迁移到 `@es-plus/vue3`
2. **从原生 Element Plus 迁移** — 把现有 `el-form` / `el-table` 重写为 `es-form` / `es-table`

---

## v1.4.0 包名重命名（`es-plus-ui` → `@es-plus/vue3`）

v1.4.0 起 npm 包名调整：

| v1.3.x 之前 | v1.4.0+ |
|---|---|
| `es-plus-ui` | **`@es-plus/vue3`**（Vue 3 + Element Plus） |
| — | **`@es-plus/vue2`**（Vue 2 + Element UI，新增） |
| — | **`@es-plus/core`**（框架无关核心，新增） |

> **TL;DR — 你的代码继续运行。** `es-plus-ui@1.4.0` 已变为 stub，内部 re-export `@es-plus/vue3@1.4.0`。现有项目无需立刻调整即可用，运行时会打印一次性 deprecation 警告。建议在下一次例行升级时一并迁移。

### 1. 更新 `package.json`

```diff
{
  "dependencies": {
-   "es-plus-ui": "^1.3.5"
+   "@es-plus/vue3": "^1.4.0"
  }
}
```

### 2. 更新 import

```diff
- import EsPlus from 'es-plus-ui'
- import 'es-plus-ui/dist/style.css'
+ import EsPlus from '@es-plus/vue3'
+ import '@es-plus/vue3/dist/style.css'
```

### 3. 更新 auto-import resolver（如果使用）

```diff
// vite.config.ts
- import { EsPlusResolver } from 'es-plus-ui/resolver'
+ import { EsPlusResolver } from '@es-plus/vue3/resolver'
```

### 4.（可选）更新类型 import

```diff
- import type { TableColumn, FormItemOption } from 'es-plus-ui'
+ import type { TableColumn, FormItemOption } from '@es-plus/vue3'
```

**公共 API 100% 不变。** 如果不愿立刻迁移，可设置 `ES_PLUS_SILENCE_DEPRECATION=1` 暂时抑制 stub 警告。

### Deprecation 时间线

| 版本范围 | 状态 |
|---|---|
| `es-plus-ui@<1.4.0` | 已 `npm deprecate`，仍可安装但 install 时会提示 |
| `es-plus-ui@1.4.0+` | Stub 包，re-export `@es-plus/vue3`，仅维护向后兼容、不再增加新功能 |
| `@es-plus/vue3@1.4.0+` | **活跃开发分支**。新功能 / bug fix / 版本发布在此 |

### 同时使用 Vue 2 渲染层

如果你的项目同时维护 Vue 2 与 Vue 3 代码库，可让两端共享同一份配置：

```bash
# Vue 2 项目
npm install @es-plus/vue2 element-ui
```

详见 [Vue 2 指南](/guide/vue2)。

```ts
// shared/columns.ts —— 在两个项目中复用
import type { TableColumn } from '@es-plus/core/types'

export const userColumns: TableColumn[] = [
  { prop: 'name', label: '姓名', width: 120 },
  { prop: 'email', label: '邮箱' },
]
```

---

## 从原生 Element Plus 迁移

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
  { name: '重置', key: 'rest', triggerEvent: true }
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
