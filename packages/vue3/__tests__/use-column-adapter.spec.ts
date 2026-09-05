import { describe, it, expect, vi } from 'vitest'
import { ref, computed } from 'vue'
import { useColumnAdapter } from '../src/components/es-table/src/engines/use-column-adapter'
import type { TableColumn } from '../src/types'

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

  // ─── expand 列 ─────────────────────────────────────────────────────────────

  it('options.expand=true → 注入 __expand__ 列（columns 中无 type:expand 时）', () => {
    const expandedKeys = ref(new Set<string>())
    const onToggleExpand = vi.fn()
    const columns = ref([{ prop: 'name', label: '姓名', width: 100 }])
    const result = useColumnAdapter(columns, createOptions({ expand: true, expandedKeys, onToggleExpand }))

    expect(result.value[0].key).toBe('__expand__')
    expect(result.value[0].fixed).toBe('left')
    expect(result.value[1].key).toBe('name')
  })

  it('col.type="expand" → 生成 __expand__ 列', () => {
    const expandedKeys = ref(new Set<string>())
    const onToggleExpand = vi.fn()
    const columns = ref([
      { type: 'expand', label: '展开', width: 55 },
      { prop: 'name', label: '姓名', width: 100 },
    ] as TableColumn[])
    const result = useColumnAdapter(columns, createOptions({ expandedKeys, onToggleExpand }))

    expect(result.value[0].key).toBe('__expand__')
    expect(result.value[0].width).toBe(55)
  })

  it('expand cellRenderer 点击 → 调用 onToggleExpand', () => {
    const expandedKeys = ref(new Set<string>(['1']))
    const onToggleExpand = vi.fn()
    const columns = ref([{ prop: 'name', label: '姓名', width: 100 }])
    const result = useColumnAdapter(columns, createOptions({ expand: true, expandedKeys, onToggleExpand }))

    const expandCol = result.value.find(c => c.key === '__expand__')!
    const e = { stopPropagation: vi.fn() }
    const rendered = expandCol.cellRenderer!({
      cellData: null,
      column: expandCol,
      columnIndex: 0,
      rowData: { id: '1' },
      rowIndex: 0,
    })
    // rendered 是 h() 返回值，onClick 挂在其 props 上
    rendered.props.onClick(e)
    expect(e.stopPropagation).toHaveBeenCalled()
    expect(onToggleExpand).toHaveBeenCalledWith('1')
  })

  it('options.expand + col.type:expand 共存 → 不重复注入', () => {
    const expandedKeys = ref(new Set<string>())
    const columns = ref([
      { type: 'expand' },
      { prop: 'name', label: '姓名', width: 100 },
    ] as TableColumn[])
    const result = useColumnAdapter(columns, createOptions({ expand: true, expandedKeys }))

    const expandCols = result.value.filter(c => c.key === '__expand__')
    expect(expandCols).toHaveLength(1)
  })

  // ─── scopedSlots.customRender ──────────────────────────────────────────────

  it('col.scopedSlots.customRender → createSlotCellRenderer：有 slot 时调用 slotFn', () => {
    const slotFn = vi.fn().mockReturnValue(null)
    const parentSlots = { mySlot: slotFn }
    const columns = ref([{
      prop: 'name',
      label: '姓名',
      width: 100,
      scopedSlots: { customRender: 'mySlot' },
    }] as TableColumn[])
    const result = useColumnAdapter(columns, createOptions({ parentSlots }))

    result.value[0].cellRenderer!({
      cellData: 'Alice',
      column: result.value[0],
      columnIndex: 0,
      rowData: { name: 'Alice' },
      rowIndex: 2,
    })
    expect(slotFn).toHaveBeenCalledWith(expect.objectContaining({
      row: { name: 'Alice' },
      value: 'Alice',
    }))
  })

  it('col.scopedSlots.customRender → slot 不存在时降级为 h("span", cellData)', () => {
    const parentSlots = {}
    const columns = ref([{
      prop: 'name',
      label: '姓名',
      width: 100,
      scopedSlots: { customRender: 'missingSlot' },
    }] as TableColumn[])
    const result = useColumnAdapter(columns, createOptions({ parentSlots }))

    const rendered = result.value[0].cellRenderer!({
      cellData: 'fallback',
      column: result.value[0],
      columnIndex: 0,
      rowData: { name: 'fallback' },
      rowIndex: 0,
    })
    // 降级为 h('span', 'fallback') — 检查非 null
    expect(rendered).toBeDefined()
  })

  // ─── formatter cellRenderer ────────────────────────────────────────────────

  it('col.formatter → createFormatterCellRenderer：调用 formatter 并渲染文本', () => {
    const formatter = vi.fn().mockReturnValue('formatted!')
    const columns = ref([{
      prop: 'price',
      label: '价格',
      width: 100,
      formatter,
    }] as TableColumn[])
    const result = useColumnAdapter(columns, createOptions())

    expect(result.value[0].cellRenderer).toBeDefined()
    result.value[0].cellRenderer!({
      cellData: 99,
      column: result.value[0],
      columnIndex: 0,
      rowData: { price: 99 },
      rowIndex: 3,
    })
    expect(formatter).toHaveBeenCalledWith({ price: 99 }, expect.anything(), 99, 3)
  })

  // ─── ellipsis + formatter 组合 ─────────────────────────────────────────────

  it('col.ellipsis=true + col.formatter → createEllipsisCellRenderer 使用 formatter 的文本', () => {
    const formatter = vi.fn().mockReturnValue('tooltip text')
    const columns = ref([{
      prop: 'desc',
      label: '描述',
      width: 200,
      ellipsis: true,
      formatter,
    }] as TableColumn[])
    const result = useColumnAdapter(columns, createOptions())

    expect(result.value[0].cellRenderer).toBeDefined()
    result.value[0].cellRenderer!({
      cellData: 'raw',
      column: result.value[0],
      columnIndex: 0,
      rowData: { desc: 'raw' },
      rowIndex: 0,
    })
    expect(formatter).toHaveBeenCalledWith({ desc: 'raw' }, expect.anything(), 'raw', 0)
  })

  it('col.ellipsis=true（无 formatter）→ 直接用 cellData 文本', () => {
    const columns = ref([{
      prop: 'note',
      label: '备注',
      width: 150,
      ellipsis: true,
    }] as TableColumn[])
    const result = useColumnAdapter(columns, createOptions())

    // 仅验证 cellRenderer 存在且不抛出
    expect(() => result.value[0].cellRenderer!({
      cellData: 'some long text',
      column: result.value[0],
      columnIndex: 0,
      rowData: { note: 'some long text' },
      rowIndex: 0,
    })).not.toThrow()
  })
})
