// Auto-generated from undefined
// Do not edit manually — run "npm run bundle-types" to update

import type { FormItemOption, BtnConfig, TableColumn, TableOptions, PaginationConfig, DialogOptions } from '../../../types'

export interface CrudPageSchema {
  /** 查询表单字段配置 */
  formItems?: FormItemOption[]
  /** 查询按钮配置 */
  queryBtns?: BtnConfig[]
  /** 表格列配置 */
  columns: TableColumn[]
  /** 表格选项配置 */
  tableOptions?: Partial<TableOptions>
  /** 弹窗表单字段配置（新增/编辑使用） */
  dialogFormItems?: FormItemOption[]
  /** 弹窗选项 */
  dialogOptions?: Partial<DialogOptions>
  /** 启用的操作类型 */
  actions?: CrudAction[]
  /** 分页配置 */
  pagination?: PaginationConfig
  /** 表单布局配置 */
  formLayout?: {
    span?: number
    labelWidth?: string | number
  }
}

export type CrudAction = 'add' | 'edit' | 'delete' | 'view' | 'export'

export interface CrudPageProps {
  /** CRUD 页面完整配置 */
  schema: CrudPageSchema
  /** 自定义 HTTP 请求方法（覆盖 schema.tableOptions.httpRequest） */
  httpRequest?: (params: Record<string, unknown>) => Promise<unknown>
  /** 是否在挂载时自动请求数据，默认 true */
  autoLoad?: boolean
}

export interface CrudPageEmits {
  (e: 'query', model: Record<string, unknown>): void
  (e: 'add'): void
  (e: 'edit', row: Record<string, unknown>): void
  (e: 'delete', row: Record<string, unknown>): void
  (e: 'view', row: Record<string, unknown>): void
  (e: 'export', model: Record<string, unknown>): void
  (e: 'row-click', row: Record<string, unknown>): void
  (e: 'btn-click', key: string, row?: Record<string, unknown>): void
}

export interface CrudPageExpose {
  /** 刷新表格数据 */
  refresh: () => void
  /** 获取选中行 */
  getSelectedRows: () => Record<string, unknown>[]
  /** 表格组件实例 */
  tableRef: any
  /** 表单组件实例 */
  formRef: any
  /** 当前查询表单模型 */
  queryModel: Record<string, unknown>
}
