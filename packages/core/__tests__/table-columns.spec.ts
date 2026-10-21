import { describe, it, expect } from 'vitest'
import {
  synthesizeLeadingColumns,
  buildLeadingColumns,
  leadingColumnToTableColumn,
  LEADING_COLUMN_ORDER,
  LEADING_COLUMN_DEFAULTS,
} from '../src/table-columns'
import type { TableColumn } from '../src/types'

/**
 * AN-09 前置非数据列合成 —— core 纯函数。
 *
 * 这是五个列产出路径（vue3 虚拟引擎、vue3/vue2/antdv 的 vxe 适配器、vue3/vue2 默认引擎、
 * antdv 标准引擎）**唯一的判据来源**。修前三份 vxe 适配器各写一份 if，vue3/vue2 默认引擎
 * 干脆没写 —— 同一份配置切到默认引擎就少一列。这里把约定钉死：
 * 顺序固定「选择 → 序号 → 展开」、开关必须严格 `=== true`、显式声明过就不再注入。
 */
describe('synthesizeLeadingColumns — 开关 → 前置列', () => {
  it('三个开关都关 → 空', () => {
    expect(synthesizeLeadingColumns({}, [])).toEqual([])
  })

  it('multiSelect → 选择列（宽 50、固定左侧）', () => {
    const out = synthesizeLeadingColumns({ multiSelect: true }, [])
    expect(out).toHaveLength(1)
    expect(out[0]).toEqual({ type: 'selection', width: 50, fixed: 'left', align: 'center' })
  })

  it('snIndex → 序号列（宽 60、表头 #、不固定）', () => {
    const out = synthesizeLeadingColumns({ snIndex: true }, [])
    expect(out[0]).toEqual({ type: 'index', width: 60, label: '#', align: 'center' })
    expect(out[0].fixed).toBeUndefined()
  })

  it('expand → 展开列（宽 50、固定左侧）', () => {
    const out = synthesizeLeadingColumns({ expand: true }, [])
    expect(out[0]).toEqual({ type: 'expand', width: 50, fixed: 'left', align: 'center' })
  })

  it('三开全开 → 顺序固定「选择 → 序号 → 展开」（修前虚拟引擎与之漂移）', () => {
    const out = synthesizeLeadingColumns({ multiSelect: true, snIndex: true, expand: true }, [])
    expect(out.map(s => s.type)).toEqual(['selection', 'index', 'expand'])
    expect(LEADING_COLUMN_ORDER).toEqual(['selection', 'index', 'expand'])
  })

  it('options 为 undefined/null → 空（宿主可能不传 options）', () => {
    const dataColumns: TableColumn[] = [{ prop: 'a' }]
    expect(synthesizeLeadingColumns(undefined, dataColumns)).toEqual([])
    expect(synthesizeLeadingColumns(null, dataColumns)).toEqual([])
  })

  it('只认严格 true（1 / "true" 这类真值不触发）', () => {
    expect(synthesizeLeadingColumns({ multiSelect: 1 } as any, [])).toEqual([])
    expect(synthesizeLeadingColumns({ snIndex: 'true' } as any, [])).toEqual([])
  })
})

describe('synthesizeLeadingColumns — 显式声明去重', () => {
  it('已有同类型列 → 不再注入该类型，其余照常', () => {
    const columns: TableColumn[] = [{ type: 'index', width: 70 }]
    const out = synthesizeLeadingColumns({ multiSelect: true, snIndex: true }, columns)
    expect(out.map(s => s.type)).toEqual(['selection'])
  })

  it('hidCol 的显式列也算「声明过」（权限/隐藏是另一层，不改变注入判据）', () => {
    const columns: TableColumn[] = [{ type: 'selection', hidCol: true }]
    expect(synthesizeLeadingColumns({ multiSelect: true }, columns)).toEqual([])
  })

  it('数据列不影响注入', () => {
    const columns: TableColumn[] = [{ prop: 'name' }, { prop: 'age' }]
    const out = synthesizeLeadingColumns({ multiSelect: true, snIndex: true }, columns)
    expect(out.map(s => s.type)).toEqual(['selection', 'index'])
  })
})

describe('synthesizeLeadingColumns — 返回副本', () => {
  it('每次返回新对象，改返回值不污染 LEADING_COLUMN_DEFAULTS', () => {
    const a = synthesizeLeadingColumns({ multiSelect: true }, [])
    const b = synthesizeLeadingColumns({ multiSelect: true }, [])
    expect(a[0]).not.toBe(b[0])
    a[0].width = 999
    expect(b[0].width).toBe(50)
    expect(LEADING_COLUMN_DEFAULTS.selection.width).toBe(50)
  })
})

describe('buildLeadingColumns / leadingColumnToTableColumn — TableColumn 形态', () => {
  it('选择列：type/width/align/fixed 就位，不带 label', () => {
    const col = leadingColumnToTableColumn(LEADING_COLUMN_DEFAULTS.selection)
    expect(col).toEqual({ type: 'selection', width: 50, fixed: 'left', align: 'center' })
  })

  it('序号列：带 label "#"，不带 fixed', () => {
    const col = leadingColumnToTableColumn(LEADING_COLUMN_DEFAULTS.index)
    expect(col.type).toBe('index')
    expect(col.label).toBe('#')
    expect('fixed' in col).toBe(false)
  })

  it('buildLeadingColumns = 合成 + 转 TableColumn，顺序不变', () => {
    const dataColumns: TableColumn[] = [{ prop: 'name' }]
    const cols = buildLeadingColumns(
      { multiSelect: true, snIndex: true, expand: true },
      dataColumns
    )
    expect(cols.map(c => c.type)).toEqual(['selection', 'index', 'expand'])
    expect(cols[2]).toEqual({ type: 'expand', width: 50, fixed: 'left', align: 'center' })
  })

  it('buildLeadingColumns 每次都新建对象（调用方会往上加引擎字段）', () => {
    const a = buildLeadingColumns({ snIndex: true }, [])
    const b = buildLeadingColumns({ snIndex: true }, [])
    expect(a[0]).not.toBe(b[0])
    a[0].width = 1
    expect(b[0].width).toBe(60)
  })
})
