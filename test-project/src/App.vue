<template>
  <div class="verify-app">
    <h1>es-plus-ui 生产包验证</h1>
    <p class="status" :class="{ ok: allOk, fail: !allOk }">
      {{ allOk ? 'ALL PASS' : 'HAS FAILURES' }}
    </p>

    <!-- 验证1: EsForm 配置渲染 -->
    <section class="test-section">
      <h2>1. EsForm 配置渲染</h2>
      <es-form
        ref="formRef"
        :model="formModel"
        :form-item-list="formItems"
        :config-btn="formBtns"
        @confirm="onFormConfirm"
      />
      <div class="test-result">
        <span :class="formRendered ? 'pass' : 'fail'">
          {{ formRendered ? 'PASS: EsForm 渲染成功' : 'FAIL: EsForm 渲染失败' }}
        </span>
        <span v-if="formConfirmTriggered" class="pass">
          PASS: confirm 事件触发成功
        </span>
      </div>
    </section>

    <!-- 验证2: EsTable 静态数据渲染 -->
    <section class="test-section">
      <h2>2. EsTable 静态数据 + 分页</h2>
      <es-table
        :columns="tableColumns"
        :data-source="tableData"
        :pagination="tablePagination"
      />
      <div class="test-result">
        <span :class="tableRendered ? 'pass' : 'fail'">
          {{ tableRendered ? 'PASS: EsTable 渲染成功' : 'FAIL: EsTable 渲染失败' }}
        </span>
      </div>
    </section>

    <!-- 验证3: EsTable 远程请求 + 分页联动 -->
    <section class="test-section">
      <h2>3. EsTable 远程请求 + 分页联动</h2>
      <es-table
        ref="remoteTableRef"
        :columns="remoteColumns"
        :options="remoteOptions"
        v-model:data-source="remoteData"
        v-model:pagination="remotePagination"
      >
        <es-form
          :model="queryForm"
          :form-item-list="queryItems"
          :config-btn="queryBtns"
        />
      </es-table>
      <div class="test-result">
        <span :class="remoteRequestTriggered ? 'pass' : 'loading'">
          {{ remoteRequestTriggered ? 'PASS: 远程请求触发成功' : '等待请求...' }}
        </span>
        <span v-if="remoteDataLoaded" class="pass">
          PASS: 数据加载成功 ({{ remoteData.length }} 条)
        </span>
        <span v-if="paginationUpdated" class="pass">
          PASS: 分页联动成功 (total={{ remotePagination.total }})
        </span>
      </div>
    </section>

    <!-- 验证4: useDialog 编程式弹窗 -->
    <section class="test-section">
      <h2>4. useDialog 编程式弹窗</h2>
      <el-button type="primary" @click="openTestDialog">打开弹窗</el-button>
      <div class="test-result">
        <span :class="dialogCreated ? 'pass' : 'fail'">
          {{ dialogCreated ? 'PASS: useDialog 创建成功' : 'FAIL: useDialog 创建失败' }}
        </span>
        <span v-if="dialogClosed" class="pass">
          PASS: 弹窗关闭回调成功
        </span>
      </div>
    </section>

    <!-- 验证5: EsForm expose 方法 -->
    <section class="test-section">
      <h2>5. EsForm expose 方法</h2>
      <el-button @click="testFormMethods">测试 validate/resetFields</el-button>
      <div class="test-result">
        <span v-if="validateExists !== null" :class="validateExists ? 'pass' : 'fail'">
          {{ validateExists ? 'PASS: validate 方法存在' : 'FAIL: validate 方法不存在' }}
        </span>
        <span v-if="resetFieldsExists !== null" :class="resetFieldsExists ? 'pass' : 'fail'">
          {{ resetFieldsExists ? 'PASS: resetFields 方法存在' : 'FAIL: resetFields 方法不存在' }}
        </span>
      </div>
    </section>

    <!-- 验证6: EsTable expose 方法 -->
    <section class="test-section">
      <h2>6. EsTable expose 方法</h2>
      <el-button @click="testTableMethods">测试 httpRequestInstance/getSelectionRows</el-button>
      <div class="test-result">
        <span v-if="httpRequestExists !== null" :class="httpRequestExists ? 'pass' : 'fail'">
          {{ httpRequestExists ? 'PASS: httpRequestInstance 方法存在' : 'FAIL: httpRequestInstance 方法不存在' }}
        </span>
        <span v-if="getSelectionRowsExists !== null" :class="getSelectionRowsExists ? 'pass' : 'fail'">
          {{ getSelectionRowsExists ? 'PASS: getSelectionRows 方法存在' : 'FAIL: getSelectionRows 方法不存在' }}
        </span>
      </div>
    </section>
  </div>
</template>

<script setup>
import { reactive, ref, computed, onMounted, nextTick } from 'vue'
import { useDialog } from 'es-plus-ui'

// ============ 验证1: EsForm ============
const formRef = ref(null)
const formRendered = ref(false)
const formConfirmTriggered = ref(false)
const formModel = reactive({ keyword: '', status: '' })
const formItems = [
  { prop: 'keyword', label: '关键词', formtype: 'Input', span: 6, attrs: { clearable: true } },
  { prop: 'status', label: '状态', formtype: 'Select', span: 6,
    dataOptions: [{ label: '启用', value: 1 }, { label: '禁用', value: 0 }] }
]
const formBtns = [
  { name: '查询', type: 'primary', key: 'query', triggerEvent: true },
  { name: '重置', key: 'reset', triggerEvent: true }
]
const onFormConfirm = () => { formConfirmTriggered.value = true }

// ============ 验证2: EsTable 静态数据 ============
const tableRendered = ref(false)
const tableData = ref([
  { id: 1, name: '张三', age: 28, status: '启用' },
  { id: 2, name: '李四', age: 32, status: '禁用' },
  { id: 3, name: '王五', age: 25, status: '启用' }
])
const tableColumns = [
  { prop: 'name', label: '姓名', width: 120 },
  { prop: 'age', label: '年龄', width: 80 },
  { prop: 'status', label: '状态' }
]
const tablePagination = reactive({ current: 1, pageSize: 10, total: 3 })

// ============ 验证3: EsTable 远程请求 ============
const remoteTableRef = ref(null)
const remoteRequestTriggered = ref(false)
const remoteDataLoaded = ref(false)
const paginationUpdated = ref(false)
const queryForm = reactive({ keyword: '' })
const remoteData = ref([])
const remotePagination = reactive({ current: 1, pageSize: 10, total: 0 })
const queryItems = [
  { prop: 'keyword', label: '关键词', formtype: 'Input', span: 6 }
]
const queryBtns = [
  { name: '查询', type: 'primary', key: 'query', triggerEvent: true },
  { name: '重置', key: 'reset', triggerEvent: true }
]
const remoteColumns = [
  { prop: 'id', label: 'ID', width: 80 },
  { prop: 'name', label: '姓名' },
  { prop: 'email', label: '邮箱' }
]
const mockUsers = Array.from({ length: 53 }, (_, i) => ({
  id: i + 1, name: `用户${i + 1}`, email: `user${i + 1}@test.com`
}))
const mockRemoteRequest = async (params) => {
  remoteRequestTriggered.value = true
  const { formParams = {}, ...rest } = params || {}
  const { pageIndex = 1, pageSize = 10 } = { ...formParams, ...rest }
  await new Promise(r => setTimeout(r, 300))
  const start = (pageIndex - 1) * pageSize
  return {
    records: mockUsers.length,
    pageSize,
    pageNo: pageIndex,
    rows: mockUsers.slice(start, start + pageSize)
  }
}
const remoteOptions = {
  border: true,
  httpRequest: mockRemoteRequest,
  apiParams: { url: '/api/users', method: 'GET' },
  configTableOut: { total: 'records', pageSize: 'pageSize', current: 'pageNo', tableData: 'rows' },
  rowkey: 'id'
}

// ============ 验证4: useDialog ============
const dialogCreated = ref(false)
const dialogClosed = ref(false)
let testDialog = null
try {
  testDialog = useDialog()
  dialogCreated.value = true
} catch (e) {
  dialogCreated.value = false
}
const openTestDialog = () => {
  dialogClosed.value = false
  testDialog({
    title: '验证弹窗',
    width: '400px',
    render: () => h('p', '弹窗内容正常显示'),
    configBtn: [
      { name: '关闭', click: (_, { close }) => close() }
    ],
    onClosed: () => { dialogClosed.value = true }
  })
}

// ============ 验证5: EsForm 方法 ============
const validateExists = ref(null)
const resetFieldsExists = ref(null)
const testFormMethods = () => {
  const vm = formRef.value
  validateExists.value = typeof vm?.validate === 'function'
  resetFieldsExists.value = typeof vm?.resetFields === 'function'
}

// ============ 验证6: EsTable 方法 ============
const httpRequestExists = ref(null)
const getSelectionRowsExists = ref(null)
const testTableMethods = () => {
  const vm = remoteTableRef.value
  httpRequestExists.value = typeof vm?.httpRequestInstance === 'function'
  getSelectionRowsExists.value = typeof vm?.getSelectionRows === 'function'
}

// ============ 总体状态 ============
const allOk = computed(() => {
  return formRendered.value && tableRendered.value && dialogCreated.value
})

// ============ 初始化检测 ============
onMounted(async () => {
  await nextTick()
  // 检测 EsForm 是否渲染
  formRendered.value = !!document.querySelector('.es-form')
  // 检测 EsTable 是否渲染
  tableRendered.value = !!document.querySelector('.table_component')
  // 监听远程数据加载
  const unwatch = setInterval(() => {
    if (remoteData.value.length > 0) {
      remoteDataLoaded.value = true
      clearInterval(unwatch)
    }
    if (remotePagination.total > 0) {
      paginationUpdated.value = true
    }
  }, 500)
  // 10秒后停止检测
  setTimeout(() => clearInterval(unwatch), 10000)
})
</script>

<style>
body { margin: 0; font-family: -apple-system, sans-serif; }
.verify-app { max-width: 900px; margin: 0 auto; padding: 40px 20px; }
h1 { font-size: 28px; margin-bottom: 8px; }
h2 { font-size: 18px; margin: 24px 0 12px; color: #303133; }
.status { display: inline-block; padding: 4px 16px; border-radius: 4px; font-weight: 700; font-size: 14px; margin-bottom: 24px; }
.status.ok { background: #f0f9eb; color: #67c23a; }
.status.fail { background: #fef0f0; color: #f56c6c; }
.test-section { margin-bottom: 40px; padding: 24px; border: 1px solid #ebeef5; border-radius: 8px; }
.test-result { margin-top: 16px; display: flex; flex-wrap: wrap; gap: 12px; }
.pass { color: #67c23a; font-weight: 600; font-size: 14px; }
.fail { color: #f56c6c; font-weight: 600; font-size: 14px; }
.loading { color: #e6a23c; font-weight: 600; font-size: 14px; }
</style>
