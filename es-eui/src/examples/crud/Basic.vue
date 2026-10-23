<template>
  <div class="example-crud-basic">
    <es-crud-page
      ref="crud"
      :schema="schema"
      @btn-click="onBtnClick"
      @dialog-confirm="onDialogConfirm"
    />
  </div>
</template>

<script>
/**
 * EsCrudPage —— 一份 schema 生成「查询表单 + 表格 + 分页 + 新增/编辑弹窗」。
 *
 * 三个配置面：
 *   formItems        查询表单字段（交给 EsForm）
 *   columns          表格列（交给 EsTable）
 *   dialogs          弹窗表（add / edit / view 会被自动识别）
 *   toolbarBtns      表格上方按钮；operationColumn 是行内操作列
 * 按钮上的 dialogKey 决定「点它开哪个弹窗」。
 */

// 演示数据：46 条，前端切片分页，不发网络请求
const ALL_ROWS = Array.from({ length: 46 }, (_, i) => ({
  id: i + 1,
  name: ['张三', '李四', '王五', '赵六', '孙七'][i % 5],
  phone: `138${String(i).padStart(8, '0')}`,
  status: i % 3 === 0 ? 0 : 1,
  createTime: `2024-0${(i % 9) + 1}-${String((i % 28) + 1).padStart(2, '0')}`
}))

let nextId = 47

const statusOptions = [
  { label: '启用', value: 1 },
  { label: '禁用', value: 0 }
]

export default {
  name: 'CrudBasic',
  data() {
    return {
      rows: ALL_ROWS.map((r) => ({ ...r })),
      schema: {
        // ① 查询表单
        formItems: [
          { prop: 'name', label: '姓名', formtype: 'Input', span: 6, attrs: { placeholder: '请输入姓名', clearable: true } },
          { prop: 'status', label: '状态', formtype: 'Select', span: 6, dataOptions: statusOptions, attrs: { placeholder: '请选择状态', clearable: true } }
        ],
        // 声明了 operationColumn 就视为「按钮面交给用户」，工具栏按钮不再自动派生，
        // 所以这里显式给一个「新增」。dialogKey 指向 dialogs 里的 add。
        toolbarBtns: [{ name: '新增', type: 'primary', key: 'add', dialogKey: 'add' }],
        // ② 表格
        columns: [
          { prop: 'name', label: '姓名', width: 120 },
          { prop: 'phone', label: '手机号', width: 160 },
          { prop: 'status', label: '状态', width: 100 },
          { prop: 'createTime', label: '创建时间', minWidth: 140 }
        ],
        // 行内操作列用 operationColumn 声明（而不是手写一列 btns）：
        // 组件会给每个按钮接上 clickEvent，dialogKey / confirm / click 才会生效。
        operationColumn: {
          label: '操作',
          width: 150,
          btns: [
            { name: '编辑', type: 'primary', dialogKey: 'edit' },
            { name: '删除', type: 'danger', confirm: '确定删除该记录？', click: (row) => this.removeRow(row) }
          ]
        },
        tableOptions: {
          border: true,
          stripe: true,
          rowkey: 'id',
          httpRequest: this.fetchRows
        },
        // ③ 弹窗
        dialogs: {
          add: {
            title: '新增用户',
            width: '520px',
            formItems: this.formFields(),
            onConfirm: (data) => this.saveRow(null, data)
          },
          edit: {
            title: (row) => `编辑「${row.name}」`,
            width: '520px',
            formItems: this.formFields(),
            onConfirm: (data, { row }) => this.saveRow(row, data)
          }
        }
      }
    }
  },
  methods: {
    // 列 / 表单共用一套字段（新增和编辑一致，只是标题与回填不同）
    formFields() {
      return [
        {
          prop: 'name',
          label: '姓名',
          formtype: 'Input',
          formItemOptions: { rules: [{ required: true, message: '请输入姓名' }] }
        },
        { prop: 'phone', label: '手机号', formtype: 'Input' },
        { prop: 'status', label: '状态', formtype: 'Select', dataOptions: statusOptions }
      ]
    },
    // 表格取数：签名与表格的 httpRequest 一致，返回 { data, total }
    async fetchRows({ pageIndex, pageSize, formParams } = {}) {
      let rows = this.rows
      const name = formParams && formParams.name
      const status = formParams && formParams.status
      if (name) rows = rows.filter((r) => r.name.includes(name))
      if (status !== '' && status !== undefined && status !== null) {
        rows = rows.filter((r) => r.status === status)
      }
      const start = (pageIndex - 1) * pageSize
      return {
        data: rows.slice(start, start + pageSize),
        total: rows.length
      }
    },
    saveRow(row, data) {
      if (row) Object.assign(row, data)
      else this.rows.unshift({ ...data, id: nextId++, createTime: new Date().toISOString().slice(0, 10) })
      this.refreshTable()
    },
    removeRow(row) {
      this.rows = this.rows.filter((r) => r.id !== row.id)
      this.refreshTable()
      this.$message.success(`已删除「${row.name}」`)
    },
    refreshTable() {
      // EsCrudPage 暴露的 refresh()：刷新当前页（不会跳回第一页）
      const crud = this.$refs.crud
      if (crud && typeof crud.refresh === 'function') crud.refresh()
    },
    onBtnClick(key, data) {
      this.$message.success(`按钮 ${key}：${JSON.stringify(data || {})}`)
    },
    // dialog-confirm 在弹窗配置的 onConfirm 之后触发，适合在这里记审计日志 / 埋点
    onDialogConfirm(key, data) {
      this.$message.success(`弹窗 ${key} 已确认：${data && data.name}`)
    }
  }
}
</script>

<style scoped>
.example-crud-basic {
  padding: 0;
}
</style>
