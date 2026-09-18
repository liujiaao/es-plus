<template>
  <div class="user-manage">
    <!-- 查询表单：每个字段一遍 el-form-item + 控件 + 属性 -->
    <el-form ref="queryRef" :model="query" :inline="true">
      <el-form-item label="姓名" prop="name">
        <el-input v-model="query.name" placeholder="请输入姓名" clearable />
      </el-form-item>
      <el-form-item label="状态" prop="status">
        <el-select v-model="query.status" placeholder="请选择状态" clearable>
          <el-option v-for="item in statusOptions" :key="item.value" :label="item.label" :value="item.value" />
        </el-select>
      </el-form-item>
      <el-form-item label="部门" prop="deptId">
        <el-select v-model="query.deptId" placeholder="请选择部门" clearable filterable :loading="deptLoading">
          <el-option v-for="item in deptOptions" :key="item.value" :label="item.label" :value="item.value" />
        </el-select>
      </el-form-item>
      <el-form-item label="创建时间" prop="createdAt">
        <el-date-picker
          v-model="query.createdAt"
          type="daterange"
          range-separator="至"
          start-placeholder="开始日期"
          end-placeholder="结束日期"
          value-format="YYYY-MM-DD"
        />
      </el-form-item>
      <el-form-item>
        <el-button type="primary" :loading="loading" @click="handleQuery">查询</el-button>
        <el-button @click="handleReset">重置</el-button>
      </el-form-item>
    </el-form>

    <!-- 表格：列、状态渲染、操作列全部写在模板里 -->
    <el-table v-loading="loading" :data="tableData" border stripe>
      <el-table-column prop="name" label="姓名" min-width="120" />
      <el-table-column prop="status" label="状态" width="100">
        <template #default="{ row }">
          <el-tag :type="row.status === '1' ? 'success' : 'info'">
            {{ row.status === '1' ? '启用' : '禁用' }}
          </el-tag>
        </template>
      </el-table-column>
      <el-table-column prop="deptName" label="部门" min-width="140" />
      <el-table-column prop="createdAt" label="创建时间" min-width="170" />
      <el-table-column label="操作" width="180" fixed="right">
        <template #default="{ row }">
          <el-button link type="primary" @click="handleEdit(row)">编辑</el-button>
          <el-button link type="danger" @click="handleDelete(row)">删除</el-button>
        </template>
      </el-table-column>
    </el-table>

    <el-pagination
      v-model:current-page="pagination.current"
      v-model:page-size="pagination.pageSize"
      :total="pagination.total"
      :page-sizes="[10, 20, 50]"
      layout="total, sizes, prev, pager, next"
      @current-change="handlePageChange"
      @size-change="handleSizeChange"
    />
  </div>
</template>

<script setup>
import { ref, reactive, onMounted } from 'vue'
import { ElMessage, ElMessageBox } from 'element-plus'

const queryRef = ref()
const loading = ref(false)
const deptLoading = ref(false)

const query = reactive({ name: '', status: '', deptId: '', createdAt: [] })
const tableData = ref([])
const deptOptions = ref([])
const pagination = reactive({ current: 1, pageSize: 10, total: 0 })

const statusOptions = [
  { label: '启用', value: '1' },
  { label: '禁用', value: '0' },
]

// 每个动作都要自己接：拉部门、查列表、重置、翻页、改页大小、编辑、删除
const fetchDeptOptions = async () => {
  deptLoading.value = true
  try {
    const res = await fetch('/api/depts').then((r) => r.json())
    deptOptions.value = res.data
  } finally {
    deptLoading.value = false
  }
}

const fetchData = async () => {
  loading.value = true
  try {
    const res = await fetch('/api/users', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        current: pagination.current,
        pageSize: pagination.pageSize,
        ...query,
      }),
    }).then((r) => r.json())
    tableData.value = res.data
    pagination.total = res.total
  } finally {
    loading.value = false
  }
}

const handleQuery = () => {
  pagination.current = 1
  fetchData()
}

const handleReset = () => {
  queryRef.value.resetFields()
  handleQuery()
}

const handlePageChange = (current) => {
  pagination.current = current
  fetchData()
}

const handleSizeChange = (pageSize) => {
  pagination.pageSize = pageSize
  pagination.current = 1
  fetchData()
}

const handleEdit = (row) => {
  // 打开编辑弹窗：弹窗内的表单要在模板里再写一遍 el-form-item
  ElMessage.info(`编辑 ${row.name}`)
}

const handleDelete = async (row) => {
  await ElMessageBox.confirm(`确认删除「${row.name}」？`, '提示', { type: 'warning' })
  await fetch(`/api/users/${row.id}`, { method: 'DELETE' })
  ElMessage.success('删除成功')
  fetchData()
}

onMounted(() => {
  fetchDeptOptions()
  fetchData()
})
</script>
