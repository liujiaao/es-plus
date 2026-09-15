/**
 * 列配置适配器测试 — EP TableColumn → ADV Column
 */
import { describe, it, expect } from 'vitest'
import { adaptColumn, adaptColumns } from '../src/components/es-table/src/column-adapter'
import type { TableColumn } from '../src/types'

describe('adaptColumn — 单列转换', () => {
  it('基础映射: prop→dataIndex, label→title', () => {
    const col: TableColumn = { prop: 'name', label: '姓名', width: 120, align: 'center' }
    const result = adaptColumn(col)
    expect(result.dataIndex).toBe('name')
    expect(result.title).toBe('姓名')
    expect(result.width).toBe(120)
    expect(result.align).toBe('center')
  })

  it('prop 缺失时回退 key', () => {
    const col: TableColumn = { key: 'uniqueKey', label: 'Key列' }
    const result = adaptColumn(col)
    expect(result.dataIndex).toBe('uniqueKey')
  })

  it('fixed=true → fixed="left"', () => {
    const col: TableColumn = { prop: 'name', label: 'Name', fixed: true }
    const result = adaptColumn(col)
    expect(result.fixed).toBe('left')
  })

  it('fixed="right" → 保持', () => {
    const col: TableColumn = { prop: 'action', label: '操作', fixed: 'right' }
    const result = adaptColumn(col)
    expect(result.fixed).toBe('right')
  })

  it('ellipsis=true', () => {
    const col: TableColumn = { prop: 'desc', label: 'Desc', ellipsis: true }
    const result = adaptColumn(col)
    expect(result.ellipsis).toBe(true)
  })

  it('sortable=true → sorter=true', () => {
    const col: TableColumn = { prop: 'date', label: 'Date', sortable: true }
    const result = adaptColumn(col)
    expect(result.sorter).toBe(true)
  })

  it('sortable="custom" → sorter=true（服务端排序，对齐 vue3）', () => {
    const col: TableColumn = { prop: 'date', label: 'Date', sortable: 'custom' }
    const result = adaptColumn(col)
    expect(result.sorter).toBe(true)
  })

  it('保留 _esCol 原始引用', () => {
    const col: TableColumn = { prop: 'name', label: 'Name' }
    const result = adaptColumn(col)
    expect(result._esCol).toBe(col)
  })

  it('minWidth 透传', () => {
    const col: TableColumn = { prop: 'name', label: 'Name', minWidth: 100 }
    const result = adaptColumn(col)
    expect(result.minWidth).toBe(100)
  })
})

describe('adaptColumns — 批量转换', () => {
  it('snIndex=true → 前插序号列', () => {
    const cols: TableColumn[] = [
      { prop: 'name', label: 'Name' },
      { prop: 'email', label: 'Email' },
    ]
    const result = adaptColumns(cols, { snIndex: true })
    expect(result).toHaveLength(3)
    expect(result[0].dataIndex).toBe('_sn')
    expect(result[0].title).toBe('#')
    expect(result[0].width).toBe(60)
    expect(result[0].align).toBe('center')
  })

  it('snIndex=false → 不添加序号列', () => {
    const cols: TableColumn[] = [{ prop: 'name', label: 'Name' }]
    const result = adaptColumns(cols)
    expect(result).toHaveLength(1)
  })

  it('空列数组', () => {
    const result = adaptColumns([])
    expect(result).toEqual([])
  })

  it('分组列 → children 递归（对齐 vue3 groups，ADV 用 children 实现表头分组）', () => {
    const col: TableColumn = {
      prop: 'groupCol', label: 'Group', groups: [
        { prop: 'sub1', label: 'Sub1' },
        { prop: 'sub2', label: 'Sub2' },
      ],
    }
    const result = adaptColumn(col)
    // 分组列：仅 title + children，不设 dataIndex
    expect(result.dataIndex).toBeUndefined()
    expect(result.title).toBe('Group')
    expect(Array.isArray(result.children)).toBe(true)
    expect((result.children as any[]).length).toBe(2)
    expect((result.children as any[])[0].dataIndex).toBe('sub1')
    // _esCol 保留原始引用含 groups
    expect(result._esCol.groups).toHaveLength(2)
  })
})

describe('adaptColumns — type 列（selection/index）', () => {
  it("type:'selection' → 跳过（ADV 由 rowSelection 渲染，不生成空列）", () => {
    const cols: TableColumn[] = [
      { type: 'selection', width: 50 },
      { prop: 'name', label: 'Name' },
    ]
    const result = adaptColumns(cols)
    // selection 列被剔除，仅剩普通列
    expect(result).toHaveLength(1)
    expect(result[0].dataIndex).toBe('name')
    expect(result.find((c) => c.dataIndex === 'selection')).toBeUndefined()
  })

  it("type:'index' → 序号列（等价 snIndex）", () => {
    const cols: TableColumn[] = [
      { type: 'index', width: 80 },
      { prop: 'name', label: 'Name' },
    ]
    const result = adaptColumns(cols)
    expect(result).toHaveLength(2)
    expect(result[0].dataIndex).toBe('_sn')
    expect(result[0].title).toBe('#')
    expect(result[0].width).toBe(80)
    expect(typeof result[0].customRender).toBe('function')
    expect((result[0].customRender as Function)({ index: 0 })).toBe(1)
  })

  it("type:'index' 与 options.snIndex 同时存在 → 不重复", () => {
    const cols: TableColumn[] = [
      { type: 'index' },
      { prop: 'name', label: 'Name' },
    ]
    const result = adaptColumns(cols, { snIndex: true })
    expect(result).toHaveLength(2)
    expect(result.filter((c) => c.dataIndex === '_sn')).toHaveLength(1)
  })

  it("type:'index' 自定义 label", () => {
    const cols: TableColumn[] = [{ type: 'index', label: '序号' }]
    const result = adaptColumns(cols)
    expect(result[0].title).toBe('序号')
  })
})

/**
 * 三端同构回归：对齐方式与列身份。
 *
 * - 对齐：vue3/vue2 的 column-item 在未显式配置时强制 center；此前 ADV 默认引擎
 *   不设 align → 落到 a-table 的 left，造成「同一份配置三端三种对齐」，
 *   且本包 vxe 引擎默认 center，同包内两引擎也不一致。
 * - 列身份：既无 key 又无 prop 的列此前用 Math.random() 兜底，
 *   每次 computed 重算都产生新 key，破坏 a-table 列状态并让快照失稳。
 */
describe('adaptColumn — 对齐默认值与列身份确定性（三端同构）', () => {
  it('未显式配置 align 时默认为 center（对齐 vue3/vue2）', () => {
    const result = adaptColumn({ prop: 'name', label: '姓名' })
    expect(result.align).toBe('center')
  })

  it('显式 align 优先于默认值', () => {
    expect(adaptColumn({ prop: 'a', label: 'A', align: 'left' }).align).toBe('left')
    expect(adaptColumn({ prop: 'b', label: 'B', align: 'right' }).align).toBe('right')
  })

  it('adaptColumns 生成的普通列同样默认 center', () => {
    const result = adaptColumns([{ prop: 'name', label: '姓名' }])
    expect(result[0].align).toBe('center')
  })

  it('groups 子列同样默认 center', () => {
    const result = adaptColumn({
      label: '分组',
      groups: [{ prop: 'child', label: '子列' }],
    })
    expect((result.children as Record<string, unknown>[])[0].align).toBe('center')
  })

  it('无 key 无 prop 的列，key 兜底是确定性的（不再用 Math.random）', () => {
    const a = adaptColumns([{ prop: 'x', label: 'X' }, { label: '无绑定列' }])
    const b = adaptColumns([{ prop: 'x', label: 'X' }, { label: '无绑定列' }])
    expect(a[1].key).toBe(b[1].key)
    expect(a[1].key).toBe('col_1')
  })

  it('groups 子列的兜底 key 与顶层不冲突', () => {
    const result = adaptColumn({
      label: '分组',
      groups: [{ label: '无绑定子列' }],
    })
    const child = (result.children as Record<string, unknown>[])[0]
    expect(child.key).toBe('col_0_0')
  })
})
