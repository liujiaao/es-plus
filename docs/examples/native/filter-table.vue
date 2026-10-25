<template>
  <div class="order-page">
    <!-- 查询区：每个字段一遍 el-form-item + 控件 + 属性 + 事件绑定 -->
    <el-form :inline="true" :model="query" @submit.prevent>
      <el-form-item label="订单号">
        <el-input
          v-model="query.orderNo"
          clearable
          placeholder="请输入订单号"
          @keyup.enter="handleSearch"
        />
      </el-form-item>
      <el-form-item label="状态">
        <el-select v-model="query.status" clearable placeholder="请选择" style="width: 140px">
          <el-option v-for="s in STATUS" :key="s.value" :label="s.label" :value="s.value" />
        </el-select>
      </el-form-item>
      <el-form-item>
        <el-button type="primary" @click="handleSearch">查询</el-button>
        <el-button @click="handleReset">重置</el-button>
      </el-form-item>
    </el-form>

    <!-- 表格：列要一列列声明；状态标签要自己写 v-if 分支 -->
    <el-table v-loading="loading" :data="rows" border>
      <el-table-column prop="orderNo" label="订单号" width="150" />
      <el-table-column prop="customer" label="客户" width="120" />
      <el-table-column prop="amount" label="金额" width="110" />
      <el-table-column label="状态" width="110">
        <template #default="{ row }">
          <el-tag v-if="row.status === 'pending'" type="warning">待发货</el-tag>
          <el-tag v-else-if="row.status === 'shipped'" type="success">已发货</el-tag>
          <el-tag v-else type="danger">已取消</el-tag>
        </template>
      </el-table-column>
      <el-table-column label="操作" width="90">
        <template #default="{ row }">
          <el-button link type="primary" @click="handleView(row)">查看</el-button>
        </template>
      </el-table-column>
    </el-table>

    <!-- 分页：当前页 / 页大小 / 总数都是自己维护的响应式状态 -->
    <el-pagination
      v-model:current-page="page.current"
      v-model:page-size="page.size"
      :total="page.total"
      :page-sizes="[5, 10, 20]"
      layout="total, sizes, prev, pager, next"
      @current-change="handlePageChange"
      @size-change="handleSizeChange"
    />
  </div>
</template>

<script setup>
import { reactive, ref } from 'vue'
import { ElMessage } from 'element-plus'

// 演示数据（真实项目里换成接口返回；两端示例用同一份）
const DB = [
  { orderNo: 'SO-2026-001', customer: '张伟', amount: 1280, status: 'pending' },
  { orderNo: 'SO-2026-002', customer: '李娜', amount: 899, status: 'shipped' },
  { orderNo: 'SO-2026-003', customer: '王强', amount: 4500, status: 'pending' },
  { orderNo: 'SO-2026-004', customer: '刘洋', amount: 320, status: 'canceled' },
  { orderNo: 'SO-2026-005', customer: '陈静', amount: 2380, status: 'shipped' },
  { orderNo: 'SO-2026-006', customer: '赵磊', amount: 760, status: 'pending' },
  { orderNo: 'SO-2026-007', customer: '孙悦', amount: 1520, status: 'canceled' },
  { orderNo: 'SO-2026-008', customer: '周涛', amount: 980, status: 'shipped' },
  { orderNo: 'SO-2026-009', customer: '吴敏', amount: 16800, status: 'pending' },
  { orderNo: 'SO-2026-010', customer: '郑爽', amount: 240, status: 'shipped' },
  { orderNo: 'SO-2026-011', customer: '冯磊', amount: 3350, status: 'canceled' },
  { orderNo: 'SO-2026-012', customer: '许晴', amount: 610, status: 'pending' },
]

const STATUS = [
  { label: '待发货', value: 'pending' },
  { label: '已发货', value: 'shipped' },
  { label: '已取消', value: 'canceled' },
]

const query = reactive({ orderNo: '', status: '' })
const page = reactive({ current: 1, size: 5, total: 0 })
const rows = ref([])
const loading = ref(false)

/** 取数：过滤 + 分页 + 装填，全部手写 */
async function fetchList() {
  loading.value = true
  const list = DB.filter((row) => (query.orderNo ? row.orderNo.includes(query.orderNo) : true)).filter(
    (row) => (query.status ? row.status === query.status : true),
  )
  const start = (page.current - 1) * page.size
  rows.value = list.slice(start, start + page.size)
  page.total = list.length
  loading.value = false
}

function handleSearch() {
  page.current = 1
  fetchList()
}

function handleReset() {
  query.orderNo = ''
  query.status = ''
  page.current = 1
  fetchList()
}

function handlePageChange(current) {
  page.current = current
  fetchList()
}

function handleSizeChange(size) {
  page.size = size
  page.current = 1
  fetchList()
}

function handleView(row) {
  ElMessage.info(`查看 ${row.orderNo}`)
}

fetchList()
</script>

<style scoped>
.order-page {
  padding: 16px;
}

.el-pagination {
  margin-top: 12px;
  justify-content: flex-end;
}
</style>
