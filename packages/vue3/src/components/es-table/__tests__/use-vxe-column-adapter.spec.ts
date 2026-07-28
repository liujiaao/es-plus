import { describe, it, expect } from 'vitest'
import { ref } from 'vue'
import { useVxeColumnAdapter } from '../src/engines/use-vxe-column-adapter'
import type { TableColumn, TableOptions } from '../../../types'

function baseOptions(overrides: Partial<TableOptions> = {}): TableOptions {
  return { multiSelect: false, snIndex: false, expand: false, ...overrides } as TableOptions
}

describe('useVxeColumnAdapter — 自动插入系统列', () => {
  it('multiSelect:true 且无 selection 列 → 前置 checkbox 列', () => {
    const cols = ref([{ prop: 'name', label: '姓名' }] as TableColumn[])
    const { adaptedColumns } = useVxeColumnAdapter(cols, baseOptions({ multiSelect: true }))
    expect(adaptedColumns.value[0].type).toBe('checkbox')
    expect(adaptedColumns.value[1].field).toBe('name')
  })

  it('snIndex:true 且无 index 列 → 前置 seq 列', () => {
    const cols = ref([{ prop: 'name', label: '姓名' }] as TableColumn[])
    const { adaptedColumns } = useVxeColumnAdapter(cols, baseOptions({ snIndex: true }))
    expect(adaptedColumns.value[0].type).toBe('seq')
    expect(adaptedColumns.value[0].title).toBe('#')
  })

  it('expand:true 且无 expand 列 → 前置 expand 列', () => {
    const cols = ref([{ prop: 'name', label: '姓名' }] as TableColumn[])
    const { adaptedColumns } = useVxeColumnAdapter(cols, baseOptions({ expand: true }))
    expect(adaptedColumns.value[0].type).toBe('expand')
  })

  it('已有 type:selection 列时不重复插入 checkbox', () => {
    const cols = ref([
      { type: 'selection' },
      { prop: 'name', label: '姓名' },
    ] as TableColumn[])
    const { adaptedColumns } = useVxeColumnAdapter(cols, baseOptions({ multiSelect: true }))
    const checkboxCols = adaptedColumns.value.filter(c => c.type === 'checkbox')
    expect(checkboxCols).toHaveLength(1)
  })
})

describe('useVxeColumnAdapter — 普通列映射', () => {
  it('prop/label → field/title', () => {
    const cols = ref([{ prop: 'email', label: '邮箱', width: 200 }] as TableColumn[])
    const { adaptedColumns } = useVxeColumnAdapter(cols, baseOptions())
    const col = adaptedColumns.value[0]
    expect(col.field).toBe('email')
    expect(col.title).toBe('邮箱')
    expect(col.width).toBe(200)
  })

  it('key 作为 field 备用（无 prop 时）', () => {
    const cols = ref([{ key: 'code', label: 'Code' }] as TableColumn[])
    const { adaptedColumns } = useVxeColumnAdapter(cols, baseOptions())
    expect(adaptedColumns.value[0].field).toBe('code')
  })

  it('minWidth 映射', () => {
    const cols = ref([{ prop: 'addr', label: '地址', minWidth: 180 }] as TableColumn[])
    const { adaptedColumns } = useVxeColumnAdapter(cols, baseOptions())
    expect(adaptedColumns.value[0].minWidth).toBe(180)
  })

  it('fixed:true → fixed:"left"', () => {
    const cols = ref([{ prop: 'a', label: 'A', width: 80, fixed: true }] as TableColumn[])
    const { adaptedColumns } = useVxeColumnAdapter(cols, baseOptions())
    expect(adaptedColumns.value[0].fixed).toBe('left')
  })

  it('fixed:"right" 透传', () => {
    const cols = ref([{ prop: 'a', label: 'A', width: 80, fixed: 'right' }] as TableColumn[])
    const { adaptedColumns } = useVxeColumnAdapter(cols, baseOptions())
    expect(adaptedColumns.value[0].fixed).toBe('right')
  })

  it('sortable:true → sortable:true（布尔）', () => {
    const cols = ref([{ prop: 'age', label: '年龄', sortable: true }] as TableColumn[])
    const { adaptedColumns } = useVxeColumnAdapter(cols, baseOptions())
    expect(adaptedColumns.value[0].sortable).toBe(true)
  })

  it('sortable:"custom" 也映射为 sortable:true（列级标识；remote 由 gridConfig 控制）', () => {
    const cols = ref([{ prop: 'age', label: '年龄', sortable: 'custom' as any }] as TableColumn[])
    const { adaptedColumns } = useVxeColumnAdapter(cols, baseOptions())
    expect(adaptedColumns.value[0].sortable).toBe(true)
  })

  it('ellipsis → showOverflow:"tooltip"', () => {
    const cols = ref([{ prop: 'desc', label: '描述', ellipsis: true }] as TableColumn[])
    const { adaptedColumns } = useVxeColumnAdapter(cols, baseOptions())
    expect(adaptedColumns.value[0].showOverflow).toBe('tooltip')
  })

  it('hidCol:true 过滤掉该列', () => {
    const cols = ref([
      { prop: 'hidden', label: '隐藏', hidCol: true },
      { prop: 'visible', label: '可见' },
    ] as TableColumn[])
    const { adaptedColumns } = useVxeColumnAdapter(cols, baseOptions())
    expect(adaptedColumns.value).toHaveLength(1)
    expect(adaptedColumns.value[0].field).toBe('visible')
  })
})

describe('useVxeColumnAdapter — 特殊列类型', () => {
  it('type:"index" → type:"seq"', () => {
    const cols = ref([{ type: 'index', label: '序号', width: 70 }] as TableColumn[])
    const { adaptedColumns } = useVxeColumnAdapter(cols, baseOptions())
    expect(adaptedColumns.value[0].type).toBe('seq')
    expect(adaptedColumns.value[0].width).toBe(70)
  })

  it('type:"expand" → type:"expand"', () => {
    const cols = ref([{ type: 'expand' }] as TableColumn[])
    const { adaptedColumns } = useVxeColumnAdapter(cols, baseOptions())
    expect(adaptedColumns.value[0].type).toBe('expand')
  })

  it('type:"selection" → type:"checkbox" + fixed:"left"', () => {
    const cols = ref([{ type: 'selection', width: 60 }] as TableColumn[])
    const { adaptedColumns } = useVxeColumnAdapter(cols, baseOptions())
    const col = adaptedColumns.value[0]
    expect(col.type).toBe('checkbox')
    expect(col.width).toBe(60)
    expect(col.fixed).toBe('left')
  })
})

describe('useVxeColumnAdapter — render/formatter/scopedSlots', () => {
  it('render 函数列 → slots.default 设置 + 进入 renderSlotMap', () => {
    const renderFn = () => null
    const cols = ref([{ prop: 'status', label: '状态', render: renderFn }] as unknown as TableColumn[])
    const { adaptedColumns, renderSlotMap } = useVxeColumnAdapter(cols, baseOptions())
    const col = adaptedColumns.value[0]
    expect(col.slots?.default).toMatch(/^_render_status/)
    expect(renderSlotMap.value.size).toBe(1)
    expect(renderSlotMap.value.values().next().value).toHaveProperty('render', renderFn)
  })

  it('多个 render 列 → slotName 唯一不冲突', () => {
    const cols = ref([
      { prop: 'a', label: 'A', render: () => null },
      { prop: 'b', label: 'B', render: () => null },
    ] as unknown as TableColumn[])
    const { renderSlotMap } = useVxeColumnAdapter(cols, baseOptions())
    const names = Array.from(renderSlotMap.value.keys())
    expect(names[0]).not.toBe(names[1])
  })

  it('scopedSlots.customRender → slots.default = slotName，不进入 renderSlotMap', () => {
    const cols = ref([
      { prop: 'x', label: 'X', scopedSlots: { customRender: 'mySlot' } },
    ] as TableColumn[])
    const { adaptedColumns, renderSlotMap } = useVxeColumnAdapter(cols, baseOptions())
    expect(adaptedColumns.value[0].slots?.default).toBe('mySlot')
    expect(renderSlotMap.value.size).toBe(0)
  })

  it('formatter 签名适配：(row,col,val,idx) → ({cellValue,row,rowIndex})', () => {
    const calls: any[] = []
    const fmtFn = (row: any, _col: any, val: any, idx: number) => {
      calls.push({ row, val, idx })
      return `fmt:${val}`
    }
    const cols = ref([{ prop: 'price', label: '价格', formatter: fmtFn }] as TableColumn[])
    const { adaptedColumns } = useVxeColumnAdapter(cols, baseOptions())
    const col = adaptedColumns.value[0]
    const result = col.formatter!({ cellValue: 100, row: { price: 100 }, rowIndex: 2, column: {} })
    expect(result).toBe('fmt:100')
    expect(calls[0]).toMatchObject({ val: 100, idx: 2 })
  })
})

describe('useVxeColumnAdapter — 分组列（groups）', () => {
  it('groups → children 递归映射', () => {
    const cols = ref([
      {
        label: '基础信息',
        groups: [
          { prop: 'name', label: '姓名', width: 100 },
          { prop: 'age', label: '年龄', width: 80 },
        ],
      },
    ] as TableColumn[])
    const { adaptedColumns } = useVxeColumnAdapter(cols, baseOptions())
    const group = adaptedColumns.value[0]
    expect(group.children).toHaveLength(2)
    expect(group.children![0].field).toBe('name')
    expect(group.children![1].field).toBe('age')
  })
})

describe('useVxeColumnAdapter — vxeColumn 逃生舱', () => {
  it('vxeColumn 字段合并到列配置', () => {
    const cols = ref([
      {
        prop: 'amount', label: '金额',
        vxeColumn: { editRender: { name: 'input' }, cellType: 'number' },
      },
    ] as TableColumn[])
    const { adaptedColumns } = useVxeColumnAdapter(cols, baseOptions())
    const col = adaptedColumns.value[0]
    expect((col as any).editRender).toEqual({ name: 'input' })
    expect((col as any).cellType).toBe('number')
  })

  it('vxeColumn.slots 与已有 slots 合并（不覆盖 render 的 default）', () => {
    const cols = ref([
      {
        prop: 'x', label: 'X',
        render: () => null,
        vxeColumn: { slots: { header: 'myHeader' } },
      },
    ] as unknown as TableColumn[])
    const { adaptedColumns } = useVxeColumnAdapter(cols, baseOptions())
    const col = adaptedColumns.value[0]
    expect(col.slots?.header).toBe('myHeader')
    expect(col.slots?.default).toMatch(/^_render_x/)
  })
})

describe('useVxeColumnAdapter — i18n labelKey', () => {
  it('labelKey + t 函数 → title 使用翻译值', () => {
    const t = (key: string) => `translated:${key}`
    const cols = ref([{ prop: 'name', labelKey: 'table.name' }] as TableColumn[])
    const { adaptedColumns } = useVxeColumnAdapter(cols, baseOptions(), t)
    expect(adaptedColumns.value[0].title).toBe('translated:table.name')
  })

  it('无 t 函数时 labelKey 回退为 label', () => {
    const cols = ref([{ prop: 'name', labelKey: 'table.name', label: '姓名' }] as TableColumn[])
    const { adaptedColumns } = useVxeColumnAdapter(cols, baseOptions())
    expect(adaptedColumns.value[0].title).toBe('姓名')
  })
})

describe('useVxeColumnAdapter — editRender 一等公民字段', () => {
  it('editRender 直传到列配置', () => {
    const cols = ref([{
      prop: 'price', label: '价格',
      editRender: { name: '$input', props: { type: 'number' } },
    }] as TableColumn[])
    const { adaptedColumns } = useVxeColumnAdapter(cols, baseOptions())
    expect((adaptedColumns.value[0] as any).editRender).toEqual({ name: '$input', props: { type: 'number' } })
  })

  it('editRender + vxeColumn 共存：vxeColumn 追加字段不覆盖 editRender', () => {
    const cols = ref([{
      prop: 'type', label: '类型',
      editRender: { name: '$select', options: [] },
      vxeColumn: { cellType: 'string' } as any,
    }] as TableColumn[])
    const { adaptedColumns } = useVxeColumnAdapter(cols, baseOptions())
    const col = adaptedColumns.value[0] as any
    expect(col.editRender).toEqual({ name: '$select', options: [] })
    expect(col.cellType).toBe('string')
  })

  it('vxeColumn.editRender 后写覆盖一等公民 editRender（逃生舱优先级高）', () => {
    const cols = ref([{
      prop: 'amt', label: '金额',
      editRender: { name: '$input' },
      vxeColumn: { editRender: { name: '$textarea' } } as any,
    }] as TableColumn[])
    const { adaptedColumns } = useVxeColumnAdapter(cols, baseOptions())
    expect((adaptedColumns.value[0] as any).editRender).toEqual({ name: '$textarea' })
  })
})

describe('useVxeColumnAdapter — footerFormatter 一等公民字段', () => {
  it('footerFormatter 包装为 vxe 签名，正确计算并返回字符串', () => {
    const cols = ref([{
      prop: 'total', label: '合计',
      footerFormatter: ({ items }: any) =>
        `¥${(items as number[]).reduce((s, v) => s + Number(v), 0).toFixed(2)}`,
    }] as TableColumn[])
    const { adaptedColumns } = useVxeColumnAdapter(cols, baseOptions())
    const col = adaptedColumns.value[0] as any
    expect(typeof col.footerFormatter).toBe('function')
    const result = col.footerFormatter({ items: [10, 20, 30], _columnIndex: 0, column: [], columns: [] })
    expect(result).toBe('¥60.00')
  })

  it('footerFormatter 数字返回值自动转字符串', () => {
    const cols = ref([{
      prop: 'qty', label: '数量',
      footerFormatter: () => 999 as any,
    }] as TableColumn[])
    const { adaptedColumns } = useVxeColumnAdapter(cols, baseOptions())
    const col = adaptedColumns.value[0] as any
    const result = col.footerFormatter({ items: [], _columnIndex: 0, column: [], columns: [] })
    expect(typeof result).toBe('string')
    expect(result).toBe('999')
  })

  it('footerFormatter 返回 null → 空字符串', () => {
    const cols = ref([{
      prop: 'n', label: 'N',
      footerFormatter: (() => null) as any,
    }] as TableColumn[])
    const { adaptedColumns } = useVxeColumnAdapter(cols, baseOptions())
    const col = adaptedColumns.value[0] as any
    const result = col.footerFormatter({ items: [], _columnIndex: 0, column: [], columns: [] })
    expect(result).toBe('')
  })

  it('editRender + footerFormatter 同时设置互不影响', () => {
    const cols = ref([{
      prop: 'val', label: '值',
      editRender: { name: '$input' },
      footerFormatter: () => 'sum',
    }] as TableColumn[])
    const { adaptedColumns } = useVxeColumnAdapter(cols, baseOptions())
    const col = adaptedColumns.value[0] as any
    expect(col.editRender).toEqual({ name: '$input' })
    expect(typeof col.footerFormatter).toBe('function')
    expect(col.footerFormatter({ items: [], _columnIndex: 0, column: [], columns: [] })).toBe('sum')
  })
})
