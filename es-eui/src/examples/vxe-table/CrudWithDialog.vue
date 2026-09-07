<template>
  <div>
    <el-alert
      type="info"
      :closable="false"
      style="margin-bottom: 10px;"
      description="企业级增删改查闭环：EsForm 查询 + vxe 服务端分页 + configBtn 工具栏（新增/全屏/列设置/导出/打印）+ useDialog 表单弹窗"
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
    <!-- 全屏缩放退出按钮：vxe-grid zoom() 覆盖整个视口，configBtn 被遮挡，
         需用 fixed 定位浮动按钮在全屏下可见 -->
    <el-button
      v-if="isZoomed"
      style="position: fixed; top: 12px; right: 12px; z-index: 99999;"
      type="warning"
      size="small"
      icon="el-icon-close"
      circle
      @click="exitZoom"
    />
  </div>
</template>

<script lang="jsx">
/**
 * 增删改查闭环 —— EsForm 查询 + vxe 服务端分页 + useDialog 表单弹窗
 *
 * 关键点（Vue2）：
 *   1. 服务端请求 httpRequest(params)：params 顶层带 pageIndex/pageSize，
 *      formParams 为查询表单字段（configTableOut 映射响应字段）。
 *   2. configBtn.click 只收到 EsTable 实例，故用闭包 getGrid 拿 vxe-grid：
 *      grid = tableRef.value.vxeEngineRef.vxeInstance()，zoom/openCustom/exportData/print 直接调。
 *   3. 增删改后调用 tableRef.value.httpRequestInstance() 重新拉取当前页。
 *   4. useDialog + 内嵌 EsForm，弹窗内用字符串 ref + getRefs('formRef').validate()。
 */
import { defineComponent, ref, reactive } from '@vue/composition-api'
import { useDialog } from '@es-plus/vue2'
import { Message, MessageBox } from 'element-ui'

const departments = ['技术部', '产品部', '市场部', '设计部']
const positions = ['工程师', '高级工程师', '架构师', '经理']
const statusMap = { active: ['在职', 'success'], leave: ['离职', 'danger'] }

export default defineComponent({
  name: 'VxeTableCrudWithDialog',
  setup() {
    const tableRef = ref(null)
    const getGrid = () => tableRef.value?.vxeEngineRef?.vxeInstance?.()
    const dialog = useDialog()
    let idSeq = 60

    // 全屏缩放状态：驱动浮动退出按钮显隐
    const isZoomed = ref(false)
    const exitZoom = () => {
      getGrid()?.zoom?.()
      isZoomed.value = false
    }

    // 模拟后端数据池
    const mockDatabase = Array.from({ length: 57 }, (_, i) => ({
      id: i + 1,
      name: `员工${i + 1}`,
      department: departments[i % departments.length],
      position: positions[i % positions.length],
      salary: 8000 + i * 700,
      status: i % 5 === 0 ? 'leave' : 'active'
    }))

    // 模拟真实接口：服务端过滤 + 服务端分页
    const mockRequest = (params) => new Promise((resolve) => {
      setTimeout(() => {
        const { formParams = {}, pageIndex = 1, pageSize = 10 } = params
        let filtered = [...mockDatabase]
        if (formParams.keyword) filtered = filtered.filter(r => r.name.includes(formParams.keyword))
        if (formParams.department) filtered = filtered.filter(r => r.department === formParams.department)
        if (formParams.status) filtered = filtered.filter(r => r.status === formParams.status)
        if (formParams.position) filtered = filtered.filter(r => r.position.includes(formParams.position))
        const start = (pageIndex - 1) * pageSize
        resolve({
          data: filtered.slice(start, start + pageSize),
          total: filtered.length,
          pageIndex,
          pageSize
        })
      }, 300)
    })

    // 搜索区
    const queryForm = reactive({ keyword: '', department: '', status: '', position: '' })

    const formItems = [
      { prop: 'keyword', label: '姓名', formtype: 'Input', placeholder: '模糊搜索', attrs: { clearable: true } },
      {
        prop: 'department', label: '部门', formtype: 'Select',
        dataOptions: [{ label: '全部', value: '' }, ...departments.map(d => ({ label: d, value: d }))],
        attrs: { clearable: true, placeholder: '全部' }
      },
      {
        prop: 'status', label: '状态', formtype: 'Select',
        dataOptions: [{ label: '全部', value: '' }, { label: '在职', value: 'active' }, { label: '离职', value: 'leave' }],
        attrs: { clearable: true, placeholder: '全部' }
      },
      { prop: 'position', label: '职位', formtype: 'Input', placeholder: '模糊搜索', attrs: { clearable: true } }
    ]

    // triggerEvent:true 的查询/重置按钮由 EsTable 内建联动，自动触发 httpRequestInstance
    const formBtns = [
      { name: '查询', type: 'primary', key: 'query', triggerEvent: true, icon: 'Search' },
      { name: '重置', key: 'rest', triggerEvent: true, icon: 'RefreshLeft' }
    ]

    // ─── CRUD ─────────────────────────────────────────────────
    const openForm = (row) => {
      const isEdit = !!row
      const formData = reactive(
        isEdit
          ? { ...row }
          : { name: '', department: '技术部', position: '工程师', salary: 8000, status: 'active' }
      )

      dialog({
        title: isEdit ? '编辑员工' : '新增员工',
        width: '480px',
        // eslint-disable-next-line no-unused-vars -- h 供 JSX 使用
        render: (h) => (
          <es-form
            ref="formRef"
            model={formData}
            form-item-list={[
              { prop: 'name', label: '姓名', span: 24, formtype: 'Input', formItemOptions: { rules: [{ required: true, message: '请输入姓名' }] } },
              { prop: 'department', label: '部门', span: 24, formtype: 'Select', dataOptions: departments.map(d => ({ label: d, value: d })) },
              { prop: 'position', label: '职位', span: 24, formtype: 'Select', dataOptions: positions.map(p => ({ label: p, value: p })) },
              { prop: 'salary', label: '薪资', span: 24, formtype: 'Input', attrs: { type: 'number' } },
              { prop: 'status', label: '状态', span: 24, formtype: 'Select', dataOptions: [{ label: '在职', value: 'active' }, { label: '离职', value: 'leave' }] }
            ]}
            layout-form-props={{ fromLayProps: { isBtnHidden: true, labelWidth: '80px' } }}
          />
        ),
        configBtn: [
          { name: '取消', key: 'cancel', click: (_, { close }) => close() },
          {
            name: '确定', type: 'primary', key: 'save',
            click: async (_, { close, getRefs }) => {
              const valid = await getRefs('formRef')?.validate?.().catch(() => false)
              if (!valid) return
              if (isEdit) {
                const target = mockDatabase.find(r => r.id === row.id)
                if (target) Object.assign(target, formData)
              } else {
                mockDatabase.unshift({ ...formData, id: ++idSeq })
              }
              tableRef.value?.httpRequestInstance()
              close()
              Message.success(isEdit ? '编辑成功' : '新增成功')
            }
          }
        ]
      })
    }

    const deleteRow = (row) => {
      MessageBox.confirm(`确定删除「${row.name}」？`, '提示', { type: 'warning' })
        .then(() => {
          const idx = mockDatabase.findIndex(r => r.id === row.id)
          if (idx > -1) mockDatabase.splice(idx, 1)
          tableRef.value?.httpRequestInstance()
          Message.success('删除成功')
        })
        .catch(() => {})
    }

    const columns = [
      { type: 'selection', width: 50 },
      { type: 'index', label: '序号', width: 70 },
      { prop: 'name', label: '姓名', minWidth: 120 },
      { prop: 'department', label: '部门', width: 120 },
      { prop: 'position', label: '职位', width: 120 },
      {
        prop: 'salary', label: '薪资', width: 120, align: 'right',
        formatter: (row) => `¥${Number(row.salary).toLocaleString()}`
      },
      {
        prop: 'status', label: '状态', width: 90,
        render: (h, { value }) => {
          const [label, type] = statusMap[value] || [value, '']
          return <el-tag type={type} size="small">{label}</el-tag>
        }
      },
      {
        prop: 'operate', label: '操作', width: 160, fixed: 'right',
        btns: [
          { name: '编辑', type: 'primary', clickEvent: (row) => openForm(row) },
          { name: '删除', type: 'danger', clickEvent: (row) => deleteRow(row) }
        ]
      }
    ]

    const tableOptions = {
      height: 600,
      heightType: 'height',
      engine: 'vxe',
      border: true,
      rowkey: 'id',
      httpRequest: mockRequest,
      apiParams: { url: '/api/employees', method: 'GET', model: queryForm },
      configTableOut: { total: 'total', tableData: 'data', pageSize: 'pageSize', current: 'pageIndex' },
      // printConfig:true 展开为 {}（vxe 必需，否则 print() 报缺少 print-config 参数）
      printConfig: true,
      // configBtn.click 仅收到 EsTable 实例，故用闭包 getGrid 拿 vxe-grid 实例
      configBtn: [
        { name: '新增', type: 'success', icon: 'Plus', code: 1, click: () => openForm(null) },
        { name: '全屏', icon: 'FullScreen', code: 2, click: () => { getGrid()?.zoom?.(); isZoomed.value = true } },
        { name: '列设置', icon: 'Setting', code: 2, click: () => getGrid()?.openCustom?.() },
        { name: '导出', icon: 'Download', code: 2, click: () => getGrid()?.exportData?.() },
        { name: '打印', icon: 'Printer', code: 2, click: () => getGrid()?.print?.() }
      ]
    }

    return { tableRef, isZoomed, exitZoom, queryForm, formItems, formBtns, columns, tableOptions }
  }
})
</script>
