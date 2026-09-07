<template>
  <div>
    <el-alert
      type="success"
      :closable="false"
      style="margin-bottom: 10px;"
      description="多选批量编辑：勾选若干行 → 批量修改部门/状态 → api.batchUpdate 一次提交 → refetch 当前页并清空勾选。工具栏实时显示已选数量。"
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
  </div>
</template>

<script lang="jsx">
/**
 * 多选 + 批量编辑 —— 补齐「批量写」场景
 *
 * 关键点：
 *   1. selection 列 + tableRef.getSelectionRows() 读取当前勾选行。
 *   2. 批量弹窗只提交「被勾选启用」的字段（部门/状态），避免误覆盖。
 *   3. api.batchUpdate(ids, patch) 成功后 refetch + clearSelection。
 */
import { defineComponent, ref, reactive } from '@vue/composition-api'
import { useDialog } from '@es-plus/vue2'
import { Message } from 'element-ui'
import { createEmployeeService, DEPARTMENT_OPTIONS, STATUS_OPTIONS, STATUS_MAP } from '../_mock/crud-service'

export default defineComponent({
  name: 'CombinationBatchEdit',
  setup() {
    const tableRef = ref(null)
    const dialog = useDialog()
    const api = createEmployeeService({ seedCount: 42 })

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

    const openBatchEdit = () => {
      const rows = tableRef.value?.getSelectionRows?.() || []
      if (!rows.length) {
        Message.warning('请先勾选要修改的行')
        return
      }
      const ids = rows.map((r) => r.id)
      // 勾选字段才纳入 patch，未勾选保持原值
      const patchForm = reactive({ useDept: false, department: '技术部', useStatus: false, status: 'active' })

      const ctx = dialog({
        title: `批量修改（已选 ${ids.length} 项）`,
        width: '440px',
        // eslint-disable-next-line no-unused-vars -- h 供 JSX 使用
        render: (h) => (
          <es-form
            ref="formRef"
            model={patchForm}
            form-item-list={[
              {
                prop: 'useDept', label: '修改部门', span: 24, formtype: 'Switch'
              },
              {
                prop: 'department', label: '目标部门', span: 24, formtype: 'Select',
                dataOptions: DEPARTMENT_OPTIONS, attrs: { disabled: !patchForm.useDept }
              },
              {
                prop: 'useStatus', label: '修改状态', span: 24, formtype: 'Switch'
              },
              {
                prop: 'status', label: '目标状态', span: 24, formtype: 'Select',
                dataOptions: STATUS_OPTIONS, attrs: { disabled: !patchForm.useStatus }
              }
            ]}
            layout-form-props={{ fromLayProps: { isBtnHidden: true, labelWidth: '90px' } }}
          />
        ),
        configBtn: [
          { name: '取消', key: 'cancel', click: (_, { close }) => close() },
          {
            name: '确定', type: 'primary', key: 'save',
            click: async (_, { close }) => {
              const patch = {}
              if (patchForm.useDept) patch.department = patchForm.department
              if (patchForm.useStatus) patch.status = patchForm.status
              if (!Object.keys(patch).length) {
                Message.warning('请至少选择一个要修改的字段')
                return
              }
              if (ctx.instance) ctx.instance.loading = true
              try {
                const res = await api.batchUpdate(ids, patch)
                Message.success(`已更新 ${res.count} 条`)
                close()
                tableRef.value?.httpRequestInstance()
                tableRef.value?.clearSelection?.()
              } catch (e) {
                Message.error(e.message)
              } finally {
                if (ctx.instance) ctx.instance.loading = false
              }
            }
          }
        ]
      })
    }

    const columns = [
      { type: 'selection', width: 48 },
      { prop: 'id', label: 'ID', width: 70 },
      { prop: 'name', label: '姓名', minWidth: 110 },
      { prop: 'department', label: '部门', width: 120 },
      { prop: 'position', label: '职位', width: 120 },
      {
        prop: 'status', label: '状态', width: 90,
        render: (h, { row }) => {
          const [label, type] = STATUS_MAP[row.status] || [row.status, '']
          return <el-tag type={type} size="small">{label}</el-tag>
        }
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
      configTableOut: { total: 'total', tableData: 'data', pageSize: 'pageSize', current: 'pageIndex' },
      configBtn: [
        { name: '批量修改', type: 'primary', icon: 'Edit', click: () => openBatchEdit() }
      ]
    }

    return { tableRef, queryForm, formItems, formBtns, columns, tableOptions }
  }
})
</script>
