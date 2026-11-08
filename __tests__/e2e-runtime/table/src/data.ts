/**
 * 表格 fixture 的共享数据与列定义（vue3 / antdv 两条腿复用）。
 *
 * 数据形状刻意设计成「排序后首行会变」：`amount` 递减，升序排序后第一页首行从
 * `amount` 最大变成最小 —— 断言可以只看首行文本，不必校验整页顺序。
 */
export interface FixtureRow {
  id: number
  name: string
  amount: number
  status: 'on' | 'off'
}

export interface FixtureColumn {
  prop: string
  label: string
  width?: number
  minWidth?: number
  sortable?: boolean
  dataOptions?: Array<{ label: string; value: string }>
  editRender?: { name: string }
}

export function makeRows(count: number): FixtureRow[] {
  return Array.from({ length: count }, (_, i) => ({
    id: i + 1,
    name: `用户${i + 1}`,
    amount: count - i,
    status: i % 2 === 0 ? 'on' : 'off',
  }))
}

export function makeColumns(): FixtureColumn[] {
  return [
    { prop: 'id', label: 'ID', width: 80, sortable: true },
    { prop: 'name', label: '姓名', minWidth: 120 },
    { prop: 'amount', label: '金额', width: 120, sortable: true },
    {
      prop: 'status',
      label: '状态',
      width: 120,
      dataOptions: [
        { label: '启用', value: 'on' },
        { label: '停用', value: 'off' },
      ],
    },
  ]
}

/** vxe 行内编辑用列：ID 只读，其余列挂 `$input` 编辑器。 */
export function makeEditableColumns(): FixtureColumn[] {
  return makeColumns().map((col) =>
    col.prop === 'id' ? col : { ...col, editRender: { name: '$input' } },
  )
}
