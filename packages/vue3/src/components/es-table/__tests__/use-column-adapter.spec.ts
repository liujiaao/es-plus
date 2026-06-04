import { describe, it, expect, vi } from 'vitest'
import { ref, computed } from 'vue'
import { useColumnAdapter } from '../src/engines/use-column-adapter'
import type { TableColumn } from '../../../types'

function createOptions(overrides = {}) {
  return {
    multiSelect: false,
    snIndex: false,
    expand: false,
    selectedKeys: ref(new Set<string>()),
    allSelected: computed(() => false),
    indeterminate: computed(() => false),
    onSelectAll: vi.fn(),
    onSelectRow: vi.fn(),
    rowkey: 'id',
    ...overrides,
  }
}

describe('useColumnAdapter', () => {
  it('converts basic columns with prop/label/width', () => {
    const columns = ref([
      { prop: 'name', label: '姓名', width: 120 },
      { prop: 'email', label: '邮箱', minWidth: 200 },
    ] as TableColumn[])
    const result = useColumnAdapter(columns, createOptions())

    expect(result.value).toHaveLength(2)
    expect(result.value[0]).toMatchObject({ key: 'name', dataKey: 'name', title: '姓名', width: 120 })
    expect(result.value[1]).toMatchObject({ key: 'email', dataKey: 'email', title: '邮箱', width: 200 })
  })

  it('uses default width 150 when no width/minWidth specified', () => {
    const columns = ref([{ prop: 'field', label: 'Field' }])
    const result = useColumnAdapter(columns, createOptions())

    expect(result.value[0].width).toBe(150)
  })

  it('preserves fixed column setting', () => {
    const columns = ref([
      { prop: 'a', label: 'A', width: 100, fixed: 'left' },
      { prop: 'b', label: 'B', width: 100, fixed: 'right' },
      { prop: 'c', label: 'C', width: 100, fixed: true },
    ])
    const result = useColumnAdapter(columns, createOptions())

    expect(result.value[0].fixed).toBe('left')
    expect(result.value[1].fixed).toBe('right')
    expect(result.value[2].fixed).toBe('left')
  })

  it('adds selection column when multiSelect is true', () => {
    const columns = ref([{ prop: 'name', label: '姓名', width: 100 }])
    const result = useColumnAdapter(columns, createOptions({ multiSelect: true }))

    expect(result.value[0].key).toBe('__selection__')
    expect(result.value[0].width).toBe(50)
    expect(result.value[0].fixed).toBe('left')
    expect(result.value[1].key).toBe('name')
  })

  it('adds index column when snIndex is true', () => {
    const columns = ref([{ prop: 'name', label: '姓名', width: 100 }])
    const result = useColumnAdapter(columns, createOptions({ snIndex: true }))

    expect(result.value[0].key).toBe('__index__')
    expect(result.value[0].width).toBe(60)
    expect(result.value[1].key).toBe('name')
  })

  it('creates index column from type: "index"', () => {
    const columns = ref([
      { type: 'index', label: '序号', width: 70 },
      { prop: 'name', label: '姓名', width: 100 },
    ] as TableColumn[])
    const result = useColumnAdapter(columns, createOptions())

    expect(result.value[0].key).toBe('__index__')
    expect(result.value[0].title).toBe('序号')
    expect(result.value[0].width).toBe(70)
  })

  it('creates selection column from type: "selection" in columns', () => {
    const columns = ref([
      { type: 'selection', width: 60 },
      { prop: 'name', label: '姓名', width: 100 },
    ] as TableColumn[])
    const result = useColumnAdapter(columns, createOptions())

    expect(result.value).toHaveLength(2)
    expect(result.value[0].key).toBe('__selection__')
    expect(result.value[0].width).toBe(60)
    expect(result.value[1].key).toBe('name')
  })

  it('does not duplicate selection column when both multiSelect and type:"selection" exist', () => {
    const columns = ref([
      { type: 'selection', width: 55 },
      { prop: 'name', label: '姓名', width: 100 },
    ] as TableColumn[])
    const result = useColumnAdapter(columns, createOptions({ multiSelect: true }))

    const selectionCols = result.value.filter(c => c.key === '__selection__')
    expect(selectionCols).toHaveLength(1)
    expect(selectionCols[0].width).toBe(55)
  })

  it('creates cellRenderer for columns with render function', () => {
    const renderFn = vi.fn((_h: any, { row }: any) => row.name)
    const columns = ref([{ prop: 'name', label: '姓名', width: 100, render: renderFn }])
    const result = useColumnAdapter(columns, createOptions())

    expect(result.value[0].cellRenderer).toBeDefined()
    result.value[0].cellRenderer!({
      cellData: 'test',
      column: result.value[0],
      columnIndex: 0,
      rowData: { name: 'John' },
      rowIndex: 0,
    })
    expect(renderFn).toHaveBeenCalledWith(expect.any(Function), { value: 'test', row: { name: 'John' }, index: 0 })
  })

  it('creates cellRenderer for columns with ellipsis', () => {
    const columns = ref([{ prop: 'desc', label: '描述', width: 200, ellipsis: true }])
    const result = useColumnAdapter(columns, createOptions())

    expect(result.value[0].cellRenderer).toBeDefined()
  })

  it('flattens grouped columns', () => {
    const columns = ref([{
      label: '地址',
      groups: [
        { prop: 'province', label: '省份', width: 100 },
        { prop: 'city', label: '城市', width: 100 },
      ]
    }])
    const result = useColumnAdapter(columns, createOptions())

    expect(result.value).toHaveLength(2)
    expect(result.value[0].key).toBe('province')
    expect(result.value[1].key).toBe('city')
  })

  it('handles sortable columns', () => {
    const columns = ref([{ prop: 'name', label: '姓名', width: 100, sortable: true }])
    const result = useColumnAdapter(columns, createOptions())

    expect(result.value[0].sortable).toBe(true)
  })

  it('resolves labelKey via t function', () => {
    const t = vi.fn((key: string) => `translated:${key}`)
    const columns = ref([{ prop: 'name', labelKey: 'field.name', width: 100 }])
    const result = useColumnAdapter(columns, createOptions({ t }))

    expect(result.value[0].title).toBe('translated:field.name')
    expect(t).toHaveBeenCalledWith('field.name')
  })

  it('handles string width values', () => {
    const columns = ref([{ prop: 'a', label: 'A', width: '180' }])
    const result = useColumnAdapter(columns, createOptions())

    expect(result.value[0].width).toBe(180)
  })
})
