/**
 * CRUD schema —— 与 Tier 1（vue3 / adapter-antdv）的 makeSchema() 逐字段同构。
 * onConfirm / delete click 通过闭包访问注入的 backend（在 App.vue 里创建后传入）。
 */
import type { Backend } from './backend'

export function makeSchema(backend: Backend) {
  const addConfirm = async (formData: Record<string, unknown>, ctx: any) => {
    await backend.httpRequest({ url: '/api/create', method: 'post', formParams: { ...formData } })
    ctx.close()
    ctx.refresh()
  }
  const editConfirm = async (formData: Record<string, unknown>, ctx: any) => {
    await backend.httpRequest({ url: '/api/update', method: 'put', formParams: { id: ctx.row.id, ...formData } })
    ctx.close()
    ctx.refresh()
  }
  const deleteClick = (row: Record<string, unknown>, ctx: any) => {
    backend.httpRequest({ url: '/api/delete', method: 'delete', formParams: { id: row.id } }).then(() => ctx.refresh())
  }

  return {
    columns: [
      { prop: 'id', label: 'ID' },
      { prop: 'name', label: '姓名' },
    ],
    formItems: [{ prop: 'name', label: '姓名', formtype: 'Input', span: 8 }],
    tableOptions: { actionUrl: '/api/list', rowkey: 'id' },
    toolbarBtns: [{ name: '新增', key: 'add', type: 'primary', dialogKey: 'add' }],
    dialogs: {
      add: { title: '新增', formItems: [{ prop: 'name', label: '姓名', formtype: 'Input' }], onConfirm: addConfirm },
      edit: { title: '编辑', formItems: [{ prop: 'name', label: '姓名', formtype: 'Input' }], onConfirm: editConfirm },
    },
    operationColumn: {
      label: '操作',
      btns: [
        { name: '编辑', key: 'edit', type: 'primary', dialogKey: 'edit' },
        { name: '删除', key: 'delete', type: 'danger', click: deleteClick },
      ],
    },
  }
}
