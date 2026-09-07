<template>
  <div>
    <el-alert
      type="info"
      :closable="false"
      style="margin-bottom: 10px;"
      description="只读详情抽屉：点击「查看」按 id 异步拉取最新详情（api.get），抽屉内展示加载态；与列表分离，适合「列表精简、详情完整」的场景。"
    />
    <es-table
      ref="tableRef"
      :columns="columns"
      :options="tableOptions"
    >
      <es-form
        :model="queryForm"
        :form-item-list="formItems"
        :config-btn="formBtns"
        :layout-form-props="{ fromLayProps: { minFoldRows: 1 } }"
      />
    </es-table>

    <el-drawer
      :visible.sync="drawerVisible"
      title="员工详情"
      size="420px"
      :append-to-body="true"
    >
      <div v-loading="detailLoading" style="padding: 0 20px; min-height: 320px;">
        <el-descriptions v-if="detail" :column="1" border size="medium">
          <el-descriptions-item label="ID">{{ detail.id }}</el-descriptions-item>
          <el-descriptions-item label="姓名">{{ detail.name }}</el-descriptions-item>
          <el-descriptions-item label="部门">{{ detail.department }}</el-descriptions-item>
          <el-descriptions-item label="职位">{{ detail.position }}</el-descriptions-item>
          <el-descriptions-item label="薪资">¥{{ Number(detail.salary).toLocaleString() }}</el-descriptions-item>
          <el-descriptions-item label="状态">
            <el-tag :type="statusTag(detail.status)" size="small">{{ statusLabel(detail.status) }}</el-tag>
          </el-descriptions-item>
          <el-descriptions-item label="邮箱">{{ detail.email }}</el-descriptions-item>
          <el-descriptions-item label="电话">{{ detail.phone }}</el-descriptions-item>
          <el-descriptions-item label="入职日期">{{ detail.joinDate }}</el-descriptions-item>
        </el-descriptions>
      </div>
    </el-drawer>
  </div>
</template>

<script lang="jsx">
/**
 * 只读详情抽屉 —— 补齐「列表 → 详情」的读路径
 *
 * 关键点：
 *   1. 列表本身仍走服务端分页（httpRequest），只展示概要列。
 *   2. 点「查看」时 drawer 立即打开并 loading，api.get(id) 拉取完整详情后填充。
 *   3. 详情与列表数据解耦：即便列表行是旧快照，抽屉里也是最新详情。
 */
import { defineComponent, ref, reactive } from '@vue/composition-api'
import { Message } from 'element-ui'
import { createEmployeeService, DEPARTMENT_OPTIONS, STATUS_MAP } from '../_mock/crud-service'

export default defineComponent({
  name: 'TableDetailDrawer',
  setup() {
    const tableRef = ref(null)
    const api = createEmployeeService({ seedCount: 36 })

    const queryForm = reactive({ keyword: '', department: '' })
    const formItems = [
      { prop: 'keyword', label: '姓名/邮箱', formtype: 'Input', placeholder: '模糊搜索', attrs: { clearable: true } },
      {
        prop: 'department', label: '部门', formtype: 'Select',
        dataOptions: [{ label: '全部', value: '' }, ...DEPARTMENT_OPTIONS],
        attrs: { clearable: true, placeholder: '全部' }
      }
    ]
    const formBtns = [
      { name: '查询', type: 'primary', key: 'query', triggerEvent: true, icon: 'Search' },
      { name: '重置', key: 'rest', triggerEvent: true, icon: 'RefreshLeft' }
    ]

    const drawerVisible = ref(false)
    const detailLoading = ref(false)
    const detail = ref(null)

    const statusLabel = (s) => (STATUS_MAP[s] || [s])[0]
    const statusTag = (s) => (STATUS_MAP[s] || ['', ''])[1]

    const viewDetail = async (row) => {
      detail.value = null
      drawerVisible.value = true
      detailLoading.value = true
      try {
        detail.value = await api.get(row.id)
      } catch (e) {
        Message.error(e.message)
        drawerVisible.value = false
      } finally {
        detailLoading.value = false
      }
    }

    const columns = [
      { prop: 'id', label: 'ID', width: 70 },
      { prop: 'name', label: '姓名', minWidth: 110 },
      { prop: 'department', label: '部门', width: 120 },
      {
        prop: 'status', label: '状态', width: 90,
        render: (h, { row }) => {
          const [label, type] = STATUS_MAP[row.status] || [row.status, '']
          return <el-tag type={type} size="small">{label}</el-tag>
        }
      },
      {
        prop: 'operate', label: '操作', width: 100, fixed: 'right',
        btns: [{ name: '查看', type: 'primary', clickEvent: (row) => viewDetail(row) }]
      }
    ]

    const tableOptions = {
      isInitRun: true,
      border: true,
      rowkey: 'id',
      size: 'small',
      height: 460,
      heightType: 'height',
      httpRequest: (params) => api.list(params),
      apiParams: { url: '/api/employees', method: 'GET', model: queryForm },
      configTableOut: { total: 'total', tableData: 'data', pageSize: 'pageSize', current: 'pageIndex' }
    }

    return {
      tableRef, queryForm, formItems, formBtns, columns, tableOptions,
      drawerVisible, detailLoading, detail, statusLabel, statusTag
    }
  }
})
</script>
