<template>
  <div class="example-crud-multi-dialog">
    <es-crud-page ref="crud" :schema="schema" />
  </div>
</template>

<script>
/**
 * 多弹窗：同一张表挂「详情」和「编辑」两个弹窗。
 *
 * dialogs 里的键就是按钮 dialogKey 取的值；
 * 需要完全自定义内容时用 render(h, { row, model, registerRef, close, refresh })。
 */
const ROWS = [
  { id: 1, name: '张三', dept: '技术部', role: 'admin', score: 92 },
  { id: 2, name: '李四', dept: '产品部', role: 'user', score: 78 },
  { id: 3, name: '王五', dept: '设计部', role: 'user', score: 85 }
]

export default {
  name: 'CrudMultiDialog',
  data() {
    return {
      rows: ROWS.map((r) => ({ ...r })),
      schema: {
        columns: [
          { prop: 'name', label: '姓名', width: 120 },
          { prop: 'dept', label: '部门', width: 140 },
          { prop: 'role', label: '角色', width: 100 },
          { prop: 'score', label: '评分', width: 90 }
        ],
        // 行内操作列用 operationColumn 声明（而不是手写一列 btns）：
        // 组件会给每个按钮接上 clickEvent，dialogKey / confirm / click 才会生效。
        operationColumn: {
          label: '操作',
          width: 160,
          btns: [
            { name: '详情', type: 'primary', dialogKey: 'view' },
            { name: '编辑', dialogKey: 'edit' }
          ]
        },
        tableOptions: { border: true, rowkey: 'id', httpRequest: this.fetchRows },
        dialogs: {
          // 只读详情：用 render 自定义内容，没有表单
          view: {
            title: (row) => `详情 - ${row && row.name}`,
            width: '460px',
            isHiddenFooter: true,
            render: (h, { row }) =>
              h('el-descriptions', { props: { column: 2, border: true } }, [
                h('el-descriptions-item', { props: { label: '姓名' } }, row.name),
                h('el-descriptions-item', { props: { label: '部门' } }, row.dept),
                h('el-descriptions-item', { props: { label: '角色' } }, row.role),
                h('el-descriptions-item', { props: { label: '评分' } }, String(row.score))
              ])
          },
          // 可编辑：同一份字段配置，onConfirm 里写回
          edit: {
            title: (row) => `编辑 - ${row && row.name}`,
            width: '460px',
            formItems: [
              { prop: 'name', label: '姓名', formtype: 'Input' },
              { prop: 'dept', label: '部门', formtype: 'Input' },
              {
                prop: 'role',
                label: '角色',
                formtype: 'Select',
                dataOptions: [
                  { label: '管理员', value: 'admin' },
                  { label: '普通用户', value: 'user' }
                ]
              }
            ],
            onConfirm: (data, { row, close }) => {
              Object.assign(row, data)
              this.$message.success(`已保存「${row.name}」`)
              close()
            }
          }
        }
      }
    }
  },
  methods: {
    async fetchRows({ pageIndex, pageSize } = {}) {
      const start = (pageIndex - 1) * pageSize
      return { data: this.rows.slice(start, start + pageSize), total: this.rows.length }
    }
  }
}
</script>

<style scoped>
.example-crud-multi-dialog {
  padding: 0;
}
</style>
