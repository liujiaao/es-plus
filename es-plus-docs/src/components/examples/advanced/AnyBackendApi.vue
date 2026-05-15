<template>
  <div class="example-any-backend-api">
    <div class="api-switch">
      <span class="switch-label">切换后端接口格式：</span>
      <el-radio-group v-model="apiFormat" size="small">
        <el-radio-button label="standard">标准格式</el-radio-button>
        <el-radio-button label="snake">蛇形命名</el-radio-button>
        <el-radio-button label="nested">嵌套结构</el-radio-button>
      </el-radio-group>
    </div>
    <es-table
      :key="apiFormat"
      :columns="columns"
      :options="currentOptions"
      v-model:data-source="tableData"
      v-model:pagination="pagination"
    />
    <div class="hint">
      <ElAlert type="success" :closable="false" show-icon>
        <template #title>
          <b>configTableOut + qrcb</b> — 三种后端响应格式，仅需修改配置即可适配，无需写任何适配代码。
          传统方式需要为每种后端格式写数据转换层。
        </template>
      </ElAlert>
    </div>
  </div>
</template>

<script setup lang="jsx">
import { ref, computed } from 'vue'
import { ElTag, ElAlert } from 'element-plus'
import EsTable from 'es-plus/components/es-table'

const tableData = ref([])
const pagination = ref({ pageSize: 5, current: 1, total: 0, pageSizes: [5, 10, 20] })
const apiFormat = ref('standard')

const statusMap = {
  active: { text: '在职', type: 'success' },
  leave: { text: '休假', type: 'warning' },
  resigned: { text: '离职', type: 'danger' }
}

const columns = [
  { prop: 'id', label: '工号', width: 80 },
  { prop: 'name', label: '姓名', width: 90 },
  { prop: 'department', label: '部门' },
  {
    prop: 'status', label: '状态',
    render: (_, { row }) => {
      const s = statusMap[row.status] || { text: '-', type: 'info' }
      return <ElTag type={s.type} size="small">{s.text}</ElTag>
    }
  },
  { prop: 'salary', label: '薪资', width: 120, formatter: (r) => `¥${r.salary.toLocaleString()}` },
  { prop: 'joinDate', label: '入职日期' }
]

const allEmployees = Array.from({ length: 22 }, (_, i) => ({
  id: 1001 + i,
  name: ['张三', '李四', '王五', '赵六'][i % 4],
  department: ['技术部', '产品部', '市场部', '财务部'][i % 4],
  status: ['active', 'leave', 'resigned'][i % 3],
  salary: [8000, 15000, 25000, 40000][i % 4],
  joinDate: `2022-${String((i % 12) + 1).padStart(2, '0')}-15`
}))

// 格式1：标准格式 { data: [], total, pageSize, current }
const standardRequest = async (params) => {
  const { formParams, ...rest } = params || {}
  const { pageIndex = 1, pageSize = 5 } = { ...formParams, ...rest }
  const start = (pageIndex - 1) * pageSize
  return {
    data: allEmployees.slice(start, start + pageSize),
    total: allEmployees.length,
    pageSize,
    current: pageIndex
  }
}

// 格式2：蛇形命名后端 — 字段名全部 snake_case，分页用 page_num
const snakeRequest = async (params) => {
  const { formParams, ...rest } = params || {}
  const { pageIndex = 1, pageSize = 5 } = { ...formParams, ...rest }
  const start = (pageIndex - 1) * pageSize
  return {
    result_list: allEmployees.slice(start, start + pageSize).map(item => ({
      emp_id: item.id,
      emp_name: item.name,
      dept_name: item.department,
      emp_status: item.status,
      emp_salary: item.salary,
      entry_date: item.joinDate
    })),
    total_count: allEmployees.length,
    page_size: pageSize,
    page_num: pageIndex
  }
}

// 格式3：嵌套结构 — 数据在 result.list，分页在 result.pagination
const nestedRequest = async (params) => {
  const { formParams, ...rest } = params || {}
  const { pageIndex = 1, pageSize = 5 } = { ...formParams, ...rest }
  const start = (pageIndex - 1) * pageSize
  return {
    result: {
      list: allEmployees.slice(start, start + pageSize).map(item => ({
        userId: item.id,
        userName: item.name,
        userDept: item.department,
        userStatus: item.status,
        userSalary: item.salary,
        hireDate: item.joinDate
      })),
      pagination: { total: allEmployees.length, size: pageSize, num: pageIndex }
    }
  }
}

const formatConfigs = {
  standard: {
    httpRequest: standardRequest,
    configTableOut: { total: 'total', tableData: 'data', pageSize: 'pageSize', current: 'current' },
    apiParams: { url: '/api/standard', method: 'GET' }
  },
  snake: {
    httpRequest: snakeRequest,
    configTableOut: { total: 'total_count', tableData: 'result_list', pageSize: 'page_size', current: 'page_num' },
    apiParams: { url: '/api/snake', method: 'GET' },
    // qrcb 将后端蛇形字段转回前端字段，前端 columns 无需修改
    listenToCallBack: {
      qrcb: (res) => {
        if (!res?.result_list) return res
        return {
          ...res,
          result_list: res.result_list.map(item => ({
            id: item.emp_id, name: item.emp_name, department: item.dept_name,
            status: item.emp_status, salary: item.emp_salary, joinDate: item.entry_date
          }))
        }
      }
    }
  },
  nested: {
    httpRequest: nestedRequest,
    // configTableOut 用简单 key 名，findValueByKey 自动递归查找嵌套字段
    configTableOut: { total: 'total', tableData: 'list', pageSize: 'size', current: 'num' },
    apiParams: { url: '/api/nested', method: 'GET' },
    listenToCallBack: {
      qrcb: (res) => {
        if (!res?.result?.list) return res
        return {
          ...res,
          result: {
            ...res.result,
            list: res.result.list.map(item => ({
              id: item.userId, name: item.userName, department: item.userDept,
              status: item.userStatus, salary: item.userSalary, joinDate: item.hireDate
            }))
          }
        }
      }
    }
  }
}

const currentOptions = computed(() => ({
  border: true,
  ...formatConfigs[apiFormat.value],
  rowkey: 'id',
  heightType: 'height',
  tabHeight: 380
}))
</script>

<style scoped>
.example-any-backend-api {
  padding: 0;
}
.api-switch {
  display: flex;
  align-items: center;
  gap: 8px;
  padding-bottom: 10px;
}
.switch-label {
  font-size: 13px;
  color: #606266;
  white-space: nowrap;
}
.hint {
  margin-top: 12px;
}
</style>
