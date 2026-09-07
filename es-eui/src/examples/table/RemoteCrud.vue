<template>
  <div>
    <el-alert
      type="success"
      :closable="false"
      style="margin-bottom: 10px;"
      description="端到端远程 CRUD 闭环：服务端搜索 + 服务端分页 + 新增/编辑弹窗（编辑前拉取最新详情）+ 删除，写操作走假后端并在成功后 refetch 当前页。"
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
 * 完整远程 CRUD（el-table 引擎）—— 对标 vxe 的 CrudWithDialog，但补齐真实请求闭环
 *
 * 关键点：
 *   1. 所有数据经由共享假后端 createEmployeeService（延迟 + 服务端过滤/分页），
 *      不再直接 mutate 本地数组。httpRequest 返回 { data, total, pageIndex, pageSize }，
 *      由 configTableOut 映射；翻页由 EsTable 内部自动 refetch。
 *   2. 编辑前先 api.get(id) 拉取最新详情再回填（体现数据新鲜度/并发场景），
 *      弹窗打开即 loading，详情到达后关闭遮罩。
 *   3. 保存/删除是真实异步：按钮/遮罩 loading + try/catch 错误提示（含服务端字段错误）
 *      + 成功后 tableRef.httpRequestInstance() 重新拉取当前页。
 */
import { defineComponent, ref, reactive } from '@vue/composition-api'
import { useDialog } from '@es-plus/vue2'
import { Message, MessageBox } from 'element-ui'
import {
  createEmployeeService,
  DEPARTMENT_OPTIONS,
  POSITION_OPTIONS,
  STATUS_OPTIONS,
  STATUS_MAP
} from '../_mock/crud-service'

export default defineComponent({
  name: 'TableRemoteCrud',
  setup() {
    const tableRef = ref(null)
    const dialog = useDialog()
    const api = createEmployeeService({ seedCount: 48 })

    // 搜索区（服务端过滤）
    const queryForm = reactive({ keyword: '', department: '', status: '' })
    const formItems = [
      { prop: 'keyword', label: '姓名/邮箱', formtype: 'Input', placeholder: '模糊搜索', attrs: { clearable: true } },
      {
        prop: 'department', label: '部门', formtype: 'Select',
        dataOptions: [{ label: '全部', value: '' }, ...DEPARTMENT_OPTIONS],
        attrs: { clearable: true, placeholder: '全部' }
      },
      {
        prop: 'status', label: '状态', formtype: 'Select',
        dataOptions: [{ label: '全部', value: '' }, ...STATUS_OPTIONS],
        attrs: { clearable: true, placeholder: '全部' }
      }
    ]
    // triggerEvent:true 由 EsTable 内建联动，自动触发 httpRequestInstance
    const formBtns = [
      { name: '查询', type: 'primary', key: 'query', triggerEvent: true, icon: 'Search' },
      { name: '重置', key: 'rest', triggerEvent: true, icon: 'RefreshLeft' }
    ]

    // ─── 新增 / 编辑弹窗 ───────────────────────────────
    const openForm = (row) => {
      const isEdit = !!row
      const formData = reactive(
        isEdit
          ? { id: row.id, name: '', department: '', position: '', salary: 0, status: 'active', email: '' }
          : { name: '', department: '技术部', position: '工程师', salary: 8000, status: 'active', email: '' }
      )

      const ctx = dialog({
        title: isEdit ? '编辑员工' : '新增员工',
        width: '480px',
        loading: isEdit, // 编辑：打开即 loading，等详情拉回
        // eslint-disable-next-line no-unused-vars -- h 供 JSX 使用
        render: (h) => (
          <es-form
            ref="formRef"
            model={formData}
            form-item-list={[
              { prop: 'name', label: '姓名', span: 24, formtype: 'Input', formItemOptions: { rules: [{ required: true, message: '请输入姓名' }] } },
              { prop: 'email', label: '邮箱', span: 24, formtype: 'Input' },
              { prop: 'department', label: '部门', span: 24, formtype: 'Select', dataOptions: DEPARTMENT_OPTIONS },
              { prop: 'position', label: '职位', span: 24, formtype: 'Select', dataOptions: POSITION_OPTIONS },
              { prop: 'salary', label: '薪资', span: 24, formtype: 'Input', attrs: { type: 'number' } },
              { prop: 'status', label: '状态', span: 24, formtype: 'Select', dataOptions: STATUS_OPTIONS }
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
              if (ctx.instance) ctx.instance.loading = true
              try {
                if (isEdit) await api.update(row.id, { ...formData })
                else await api.create({ ...formData })
                Message.success(isEdit ? '编辑成功' : '新增成功')
                close()
                tableRef.value?.httpRequestInstance()
              } catch (e) {
                // 服务端字段错误（如姓名重复）优先提示字段信息
                Message.error(e.fields ? Object.values(e.fields)[0] : e.message)
              } finally {
                if (ctx.instance) ctx.instance.loading = false
              }
            }
          }
        ]
      })

      // 编辑：拉取最新详情回填，失败则关闭弹窗
      if (isEdit) {
        api.get(row.id)
          .then((fresh) => {
            Object.assign(formData, fresh)
            if (ctx.instance) ctx.instance.loading = false
          })
          .catch((e) => { Message.error(e.message); ctx.close() })
      }
    }

    const deleteRow = (row) => {
      MessageBox.confirm(`确定删除「${row.name}」？`, '提示', { type: 'warning' })
        .then(async () => {
          try {
            await api.remove(row.id)
            Message.success('删除成功')
            tableRef.value?.httpRequestInstance()
          } catch (e) {
            Message.error(e.message)
          }
        })
        .catch(() => {})
    }

    const columns = [
      { prop: 'id', label: 'ID', width: 70 },
      { prop: 'name', label: '姓名', minWidth: 110 },
      { prop: 'email', label: '邮箱', minWidth: 180 },
      { prop: 'department', label: '部门', width: 110 },
      { prop: 'position', label: '职位', width: 110 },
      {
        prop: 'salary', label: '薪资', width: 120, align: 'right',
        formatter: (row) => `¥${Number(row.salary).toLocaleString()}`
      },
      {
        prop: 'status', label: '状态', width: 90,
        render: (h, { row }) => {
          const [label, type] = STATUS_MAP[row.status] || [row.status, '']
          return <el-tag type={type} size="small">{label}</el-tag>
        }
      },
      {
        prop: 'operate', label: '操作', width: 150, fixed: 'right',
        btns: [
          { name: '编辑', type: 'primary', clickEvent: (row) => openForm(row) },
          { name: '删除', type: 'danger', clickEvent: (row) => deleteRow(row) }
        ]
      }
    ]

    const tableOptions = {
      isInitRun: true,
      border: true,
      rowkey: 'id',
      size: 'small',
      height: 460,
      heightType: 'height',
      // 编辑/删除后停留在当前页而非跳回第 1 页；删除本页最后一条时自动回退一页
      refetchKeepPage: true,
      httpRequest: (params) => api.list(params),
      apiParams: { url: '/api/employees', method: 'GET', model: queryForm },
      configTableOut: { total: 'total', tableData: 'data', pageSize: 'pageSize', current: 'pageIndex' },
      configBtn: [
        { name: '新增', type: 'success', icon: 'Plus', click: () => openForm(null) },
        { name: '刷新', icon: 'Refresh', click: () => tableRef.value?.httpRequestInstance() }
      ]
    }

    return { tableRef, queryForm, formItems, formBtns, columns, tableOptions }
  }
})
</script>
