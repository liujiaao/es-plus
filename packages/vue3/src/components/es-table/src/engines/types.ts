import type { TableColumn, TableOptions } from '../../../../types'

export type { TableEngineExposed } from '@es-plus/core'

export interface TableEngineProps {
  columns: TableColumn[]
  dataSource: Record<string, unknown>[]
  tableHeight: number
  options: TableOptions
  parentSlots: Record<string, (...args: any[]) => any>
}

export interface TableEngineEmits {
  (e: 'sort-change', payload: { column: any; prop: string; order: string }): void
  (e: 'selection-change', rows: Record<string, unknown>[]): void
}
