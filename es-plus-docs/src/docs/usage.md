# 使用

## 完整引入

```typescript
import { createApp } from 'vue'
import ESPlus from 'es-plus'
import 'element-plus/dist/index.css'
import App from './App.vue'

const app = createApp(App)
app.use(ESPlus)
app.mount('#app')
```

## 按需引入

```typescript
import { EsForm, EsTable, useDialog } from 'es-plus'

export default {
  components: { EsForm, EsTable }
}
```

## 开始使用

### EsForm 示例

```vue
<template>
  <es-form
    :model="formModel"
    :form-item-list="formItems"
    @confirm="handleSubmit"
  />
</template>

<script setup>
import { ref } from 'vue'

const formModel = ref({ name: '' })
const formItems = [
  { prop: 'name', label: '姓名', formtype: 'Input', span: 24 }
]

const handleSubmit = (ref, model) => {
  console.log(model)
}
</script>
```

### EsTable 示例

```vue
<template>
  <es-table
    :data-source="tableData"
    :columns="columns"
  />
</template>

<script setup>
const tableData = [
  { name: '张三', age: 28 }
]
const columns = [
  { prop: 'name', label: '姓名' },
  { prop: 'age', label: '年龄' }
]
</script>
```
