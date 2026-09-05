/**
 * vue2 use-vxe-column-adapter — 直接从源文件导入测试
 *
 * 注意：vxe-engine.spec.ts 中仅测试了内联重写的 convertMapToEntries 逻辑，
 * 本文件直接 import 源文件，确保真实源码中的 bug 不会被漏掉。
 *
 * 环境：happy-dom（无 @vue/composition-api），通过 vue-compat 的 ref/computed 运行。
 */
import { describe, it, expect, vi } from 'vitest'
import { ref } from '../src/vue-compat'
import { useVxeColumnAdapter } from '../src/components/es-table/engines/use-vxe-column-adapter'
import type { TableColumn, TableOptions } from '@es-plus/core'

// ─── 辅助工厂 ──────────────────────────────────────────────────────────────

function makeOptions(overrides: Partial<TableOptions> = {}): TableOptions {
  return { multiSelect: false, snIndex: false, expand: false, ...overrides }
}

function col(overrides: Partial<TableColumn>): TableColumn {
  return { prop: overrides.prop ?? 'col', label: overrides.label ?? 'Col', ...overrides }
}

// ─── 1. 基础列类型 ──────────────────────────────────────────────────────────

describe('useVxeColumnAdapter（vue2）— 列类型映射', () => {
  it('selection 列 → type:checkbox + fixed:left', () => {
    const cols = ref<TableColumn[]>([col({ type: 'selection', width: 55 })])
    const { adaptedColumns } = useVxeColumnAdapter(cols as any, makeOptions())
    const c = adaptedColumns.value.find((c: any) => c.type === 'checkbox')
    expect(c).toBeDefined()
    expect(c?.fixed).toBe('left')
    expect(c?.width).toBe(55)
  })

  it('index 列 → type:seq + align:center', () => {
    const cols = ref<TableColumn[]>([col({ type: 'index', label: '#' })])
    const { adaptedColumns } = useVxeColumnAdapter(cols as any, makeOptions())
    const c = adaptedColumns.value.find((c: any) => c.type === 'seq')
    expect(c).toBeDefined()
    expect(c?.align).toBe('center')
  })

  it('expand 列 → type:expand + fixed:left', () => {
    const cols = ref<TableColumn[]>([col({ type: 'expand' })])
    const { adaptedColumns } = useVxeColumnAdapter(cols as any, makeOptions())
    const c = adaptedColumns.value.find((c: any) => c.type === 'expand')
    expect(c).toBeDefined()
    expect(c?.fixed).toBe('left')
  })

  it('普通列 → field=prop + title=label', () => {
    const cols = ref<TableColumn[]>([col({ prop: 'name', label: '姓名' })])
    const { adaptedColumns } = useVxeColumnAdapter(cols as any, makeOptions())
    const c = adaptedColumns.value[0] as any
    expect(c.field).toBe('name')
    expect(c.title).toBe('姓名')
  })

  it('hidCol:true 的列被过滤', () => {
    const cols = ref<TableColumn[]>([
      col({ prop: 'visible' }),
      col({ prop: 'hidden', hidCol: true }),
    ])
    const { adaptedColumns } = useVxeColumnAdapter(cols as any, makeOptions())
    expect(adaptedColumns.value.some((c: any) => c.field === 'hidden')).toBe(false)
    expect(adaptedColumns.value.some((c: any) => c.field === 'visible')).toBe(true)
  })
})

// ─── 2. options 自动注入列 ──────────────────────────────────────────────────

describe('useVxeColumnAdapter（vue2）— options 自动注入', () => {
  it('multiSelect:true → 前置 checkbox 列（无 selection 列时）', () => {
    const cols = ref<TableColumn[]>([col({ prop: 'name' })])
    const { adaptedColumns } = useVxeColumnAdapter(cols as any, makeOptions({ multiSelect: true }))
    const checkboxes = adaptedColumns.value.filter((c: any) => c.type === 'checkbox')
    expect(checkboxes).toHaveLength(1)
    expect(checkboxes[0].fixed).toBe('left')
  })

  it('multiSelect:true + 已有 selection 列 → 不重复注入', () => {
    const cols = ref<TableColumn[]>([col({ type: 'selection' }), col({ prop: 'name' })])
    const { adaptedColumns } = useVxeColumnAdapter(cols as any, makeOptions({ multiSelect: true }))
    expect(adaptedColumns.value.filter((c: any) => c.type === 'checkbox')).toHaveLength(1)
  })

  it('snIndex:true → 前置 seq 列', () => {
    const cols = ref<TableColumn[]>([col({ prop: 'name' })])
    const { adaptedColumns } = useVxeColumnAdapter(cols as any, makeOptions({ snIndex: true }))
    expect(adaptedColumns.value.filter((c: any) => c.type === 'seq')).toHaveLength(1)
  })

  it('expand:true → 前置 expand 列', () => {
    const cols = ref<TableColumn[]>([col({ prop: 'name' })])
    const { adaptedColumns } = useVxeColumnAdapter(cols as any, makeOptions({ expand: true }))
    expect(adaptedColumns.value.filter((c: any) => c.type === 'expand')).toHaveLength(1)
  })
})

// ─── 3. render / scopedSlots / formatter 列 ──────────────────────────────

describe('useVxeColumnAdapter（vue2）— render/scopedSlots/formatter', () => {
  it('render 列 → 注册到 renderSlotMap', () => {
    const renderFn = vi.fn()
    const cols = ref<TableColumn[]>([col({ prop: 'age', label: '年龄', render: renderFn })])
    const { adaptedColumns, renderSlotMap } = useVxeColumnAdapter(cols as any, makeOptions())
    const c = adaptedColumns.value[0] as any
    expect(c.slots?.default).toBeTruthy()
    const slotName = c.slots.default as string
    expect((renderSlotMap.value as Map<string, any>).has(slotName)).toBe(true)
    expect((renderSlotMap.value as Map<string, any>).get(slotName)).toMatchObject({ prop: 'age' })
  })

  it('scopedSlots.customRender 列 → slots.default = customRender 值', () => {
    const cols = ref<TableColumn[]>([col({
      prop: 'status',
      scopedSlots: { customRender: 'statusSlot' },
    })])
    const { adaptedColumns } = useVxeColumnAdapter(cols as any, makeOptions())
    const c = adaptedColumns.value[0] as any
    expect(c.slots?.default).toBe('statusSlot')
  })

  it('formatter 列 → 包装为 vxe formatter 签名', () => {
    const cols = ref<TableColumn[]>([col({
      prop: 'date',
      formatter: (row: any) => `fmt_${row.date}`,
    })])
    const { adaptedColumns } = useVxeColumnAdapter(cols as any, makeOptions())
    const c = adaptedColumns.value[0] as any
    expect(typeof c.formatter).toBe('function')
    const result = c.formatter({ cellValue: '2024-01-01', row: { date: '2024-01-01' }, rowIndex: 0, column: {} })
    expect(result).toBe('fmt_2024-01-01')
  })

  it('多个 render 列 → renderSlotMap 键名唯一', () => {
    const renderFn = vi.fn()
    const cols = ref<TableColumn[]>([
      col({ prop: 'a', render: renderFn }),
      col({ prop: 'b', render: renderFn }),
    ])
    const { renderSlotMap } = useVxeColumnAdapter(cols as any, makeOptions())
    expect((renderSlotMap.value as Map<string, any>).size).toBe(2)
    const keys = [...(renderSlotMap.value as Map<string, any>).keys()]
    expect(new Set(keys).size).toBe(2)
  })
})

// ─── 4. groups 列（子列）──────────────────────────────────────────────────

describe('useVxeColumnAdapter（vue2）— groups 子列', () => {
  it('groups 列 → vxe children 数组', () => {
    const cols = ref<TableColumn[]>([{
      prop: 'parent', label: '父列',
      groups: [
        { prop: 'c1', label: '子1' },
        { prop: 'c2', label: '子2' },
      ],
    }])
    const { adaptedColumns } = useVxeColumnAdapter(cols as any, makeOptions())
    const parent = adaptedColumns.value[0] as any
    expect(parent.children).toHaveLength(2)
    expect(parent.children[0].field).toBe('c1')
    expect(parent.children[1].field).toBe('c2')
  })
})

// ─── 5. vxeColumn 逃生舱 ─────────────────────────────────────────────────

describe('useVxeColumnAdapter（vue2）— vxeColumn 逃生舱', () => {
  it('vxeColumn 属性合并到结果', () => {
    const cols = ref<TableColumn[]>([col({
      prop: 'name',
      vxeColumn: { treeNode: true, showOverflow: 'tooltip' },
    } as any)])
    const { adaptedColumns } = useVxeColumnAdapter(cols as any, makeOptions())
    const c = adaptedColumns.value[0] as any
    expect(c.treeNode).toBe(true)
    expect(c.showOverflow).toBe('tooltip')
  })

  it('vxeColumn.slots 与已有 slots 合并（不覆盖 render 注册的 default）', () => {
    const renderFn = vi.fn()
    const cols = ref<TableColumn[]>([col({
      prop: 'name',
      render: renderFn,
      vxeColumn: { slots: { header: 'nameHeader' } },
    } as any)])
    const { adaptedColumns } = useVxeColumnAdapter(cols as any, makeOptions())
    const c = adaptedColumns.value[0] as any
    expect(c.slots.header).toBe('nameHeader')
    expect(c.slots.default).toBeTruthy()
  })

  it('selection 列 vxeColumn.checkMethod 被合并', () => {
    const checkMethod = () => true
    const cols = ref<TableColumn[]>([col({ type: 'selection', vxeColumn: { checkMethod } } as any)])
    const { adaptedColumns } = useVxeColumnAdapter(cols as any, makeOptions())
    const c = adaptedColumns.value[0] as any
    expect(c.checkMethod).toBe(checkMethod)
  })
})

// ─── 6. 属性透传（width/minWidth/sortable/ellipsis/fixed/align）─────────

describe('useVxeColumnAdapter（vue2）— 属性透传', () => {
  it('width 透传', () => {
    const cols = ref<TableColumn[]>([col({ prop: 'code', width: 200 })])
    const { adaptedColumns } = useVxeColumnAdapter(cols as any, makeOptions())
    expect((adaptedColumns.value[0] as any).width).toBe(200)
  })

  it('minWidth 透传', () => {
    const cols = ref<TableColumn[]>([col({ prop: 'desc', minWidth: 120 })])
    const { adaptedColumns } = useVxeColumnAdapter(cols as any, makeOptions())
    expect((adaptedColumns.value[0] as any).minWidth).toBe(120)
  })

  it('sortable:true → vxe sortable:true', () => {
    const cols = ref<TableColumn[]>([col({ prop: 'date', sortable: true })])
    const { adaptedColumns } = useVxeColumnAdapter(cols as any, makeOptions())
    expect((adaptedColumns.value[0] as any).sortable).toBe(true)
  })

  it('ellipsis:true → showOverflow:"tooltip"', () => {
    const cols = ref<TableColumn[]>([col({ prop: 'long', ellipsis: true })])
    const { adaptedColumns } = useVxeColumnAdapter(cols as any, makeOptions())
    expect((adaptedColumns.value[0] as any).showOverflow).toBe('tooltip')
  })

  it('fixed:"right" → vxe fixed:"right"', () => {
    const cols = ref<TableColumn[]>([col({ prop: 'op', fixed: 'right' })])
    const { adaptedColumns } = useVxeColumnAdapter(cols as any, makeOptions())
    expect((adaptedColumns.value[0] as any).fixed).toBe('right')
  })

  it('fixed:true → vxe fixed:"left"（布尔转换）', () => {
    const cols = ref<TableColumn[]>([col({ prop: 'check', fixed: true })])
    const { adaptedColumns } = useVxeColumnAdapter(cols as any, makeOptions())
    expect((adaptedColumns.value[0] as any).fixed).toBe('left')
  })

  it('align 透传', () => {
    const cols = ref<TableColumn[]>([col({ prop: 'amount', align: 'right' })])
    const { adaptedColumns } = useVxeColumnAdapter(cols as any, makeOptions())
    expect((adaptedColumns.value[0] as any).align).toBe('right')
  })
})

// ─── 7. unrefOptions：Ref<TableOptions> 形式兼容 ─────────────────────────

describe('useVxeColumnAdapter（vue2）— unrefOptions 兼容性', () => {
  it('Ref<TableOptions> 形式：options.value 中读取字段', () => {
    const opts = ref<TableOptions>(makeOptions({ multiSelect: true }))
    const cols = ref<TableColumn[]>([col({ prop: 'name' })])
    const { adaptedColumns } = useVxeColumnAdapter(cols as any, opts as any)
    expect(adaptedColumns.value.filter((c: any) => c.type === 'checkbox')).toHaveLength(1)
  })

  it('plain object options 同样正常工作', () => {
    const cols = ref<TableColumn[]>([col({ prop: 'name' })])
    const { adaptedColumns } = useVxeColumnAdapter(cols as any, makeOptions({ snIndex: true }))
    expect(adaptedColumns.value.filter((c: any) => c.type === 'seq')).toHaveLength(1)
  })
})

// ─── 8. labelKey 国际化支持 ───────────────────────────────────────────────

describe('useVxeColumnAdapter（vue2）— labelKey 国际化', () => {
  it('labelKey + t 函数 → 使用翻译后的 title', () => {
    const t = (key: string) => `[i18n:${key}]`
    const cols = ref<TableColumn[]>([{ prop: 'name', labelKey: 'table.name' } as any])
    const { adaptedColumns } = useVxeColumnAdapter(cols as any, makeOptions(), t)
    expect((adaptedColumns.value[0] as any).title).toBe('[i18n:table.name]')
  })

  it('无 t 函数时回退到 label', () => {
    const cols = ref<TableColumn[]>([{ prop: 'name', label: '姓名', labelKey: 'table.name' }])
    const { adaptedColumns } = useVxeColumnAdapter(cols as any, makeOptions())
    expect((adaptedColumns.value[0] as any).title).toBe('姓名')
  })
})
