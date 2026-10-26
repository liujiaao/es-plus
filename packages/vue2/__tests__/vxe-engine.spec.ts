/**
 * vxe-engine vue2 版本测试
 *
 * 覆盖场景（不依赖 Vue 2 运行时，测试纯逻辑）：
 * - M-1: vxeAvailable 检测逻辑（三层检测策略）
 * - M-2: renderSlotEntries 转换（Map → 对象数组）
 * - M-3: RenderSlotBridge 组件结构验证
 * - M-6: vxe 模式下 dataSource watch 跳过 initSelection
 * - P2: clearActived 兜底 clearEdit ?? clearActived（v3 用 clearActived，无 clearEdit）
 * - P5: provide getTableInstantce 在 vxe 模式下委托给 vxeEngineRef
 * - L3: rowkey 缺失警告仅在开发环境输出
 *
 * 注意：vue2 包的 vitest 环境基于 happy-dom，不含 @vue/composition-api，
 * 故测试纯 JS 逻辑函数而非 Vue 组件挂载。
 */
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'

// ─── M-1: vxeAvailable 检测逻辑 ───────────────────────────────────────

describe('M-1 fix: vxeAvailable 三层检测策略', () => {
  function checkVxeAvailable(proxy: any): boolean {
    try {
      if (!proxy) return false
      const ctorComps: Record<string, any> = proxy.constructor?.options?.components || {}
      if (ctorComps['vxe-grid'] || ctorComps['VxeGrid']) return true
      const localComps: Record<string, any> = proxy.$options?.components || {}
      if (localComps['vxe-grid'] || localComps['VxeGrid']) return true
      let parent = proxy.$parent
      while (parent) {
        const pComps: Record<string, any> = parent.$options?.components || {}
        if (pComps['vxe-grid'] || pComps['VxeGrid']) return true
        parent = parent.$parent || null
      }
      return false
    } catch {
      return false
    }
  }

  it('proxy 为 null → false', () => {
    expect(checkVxeAvailable(null)).toBe(false)
  })

  it('constructor.options.components 中有 vxe-grid → true（全局注册路径）', () => {
    const proxy = {
      constructor: { options: { components: { 'vxe-grid': {} } } },
      $options: { components: {} },
      $parent: null,
    }
    expect(checkVxeAvailable(proxy)).toBe(true)
  })

  it('constructor.options.components 中有 VxeGrid（大写）→ true', () => {
    const proxy = {
      constructor: { options: { components: { VxeGrid: {} } } },
      $options: { components: {} },
      $parent: null,
    }
    expect(checkVxeAvailable(proxy)).toBe(true)
  })

  it('$options.components 中有 vxe-grid → true（局部注册路径）', () => {
    const proxy = {
      constructor: { options: { components: {} } },
      $options: { components: { 'vxe-grid': {} } },
      $parent: null,
    }
    expect(checkVxeAvailable(proxy)).toBe(true)
  })

  it('$parent.$options.components 中有 vxe-grid → true（父组件链路径）', () => {
    const proxy = {
      constructor: { options: { components: {} } },
      $options: { components: {} },
      $parent: {
        $options: { components: { 'vxe-grid': {} } },
        $parent: null,
      },
    }
    expect(checkVxeAvailable(proxy)).toBe(true)
  })

  it('多层父级：在第三层找到 → true', () => {
    const proxy = {
      constructor: { options: { components: {} } },
      $options: { components: {} },
      $parent: {
        $options: { components: {} },
        $parent: {
          $options: { components: {} },
          $parent: {
            $options: { components: { VxeGrid: {} } },
            $parent: null,
          },
        },
      },
    }
    expect(checkVxeAvailable(proxy)).toBe(true)
  })

  it('所有层级均无 vxe-grid → false', () => {
    const proxy = {
      constructor: { options: { components: { OtherComp: {} } } },
      $options: { components: { ElTable: {} } },
      $parent: null,
    }
    expect(checkVxeAvailable(proxy)).toBe(false)
  })

  it('proxy.$parent 访问抛出时不崩溃 → false', () => {
    const proxy = {
      get constructor() { throw new Error('access denied') },
    }
    expect(checkVxeAvailable(proxy)).toBe(false)
  })
})

// ─── M-2: renderSlotEntries 转换 ──────────────────────────────────────

describe('M-2 fix: renderSlotEntries Map→Array 转换', () => {
  function convertMapToEntries(
    map: Map<string, any>,
  ): Array<{ name: string; col: any }> {
    const entries: Array<{ name: string; col: any }> = []
    map.forEach((col, name) => entries.push({ name, col }))
    return entries
  }

  it('空 Map → 空数组', () => {
    expect(convertMapToEntries(new Map())).toEqual([])
  })

  it('Map 有 1 项 → 1 个 entry', () => {
    const col = { prop: 'name', render: vi.fn() }
    const map = new Map([['_render_name_0', col]])
    const entries = convertMapToEntries(map)
    expect(entries).toHaveLength(1)
    expect(entries[0].name).toBe('_render_name_0')
    expect(entries[0].col).toBe(col)
  })

  it('Map 有多项 → 顺序保留', () => {
    const map = new Map<string, any>([
      ['slot_a', { prop: 'a' }],
      ['slot_b', { prop: 'b' }],
      ['slot_c', { prop: 'c' }],
    ])
    const entries = convertMapToEntries(map)
    expect(entries.map((e) => e.name)).toEqual(['slot_a', 'slot_b', 'slot_c'])
  })

  it('每个 entry.col 是 Map 的原始引用（非拷贝）', () => {
    const col = { prop: 'x', render: vi.fn() }
    const map = new Map([['slot_x', col]])
    const entries = convertMapToEntries(map)
    expect(entries[0].col).toBe(col)
  })
})

// ─── M-3: RenderSlotBridge 结构验证 ──────────────────────────────────

describe('M-3 fix: RenderSlotBridge 组件结构', () => {
  // 不在 happy-dom 中挂载 Vue 2 组件，仅验证导出结构
  it('render-dom-tb.ts 导出 RenderSlotBridge 组件对象', async () => {
    // 动态导入避免 @vue/composition-api 初始化副作用
    const mod = await import('../src/components/es-table/engines/render-dom-tb')
    expect(mod.RenderSlotBridge).toBeDefined()
    expect(mod.RenderSlotBridge.name).toBe('RenderSlotBridge')
  })

  it('RenderSlotBridge 有 slotFn 和 slotProps 两个 props', async () => {
    const { RenderSlotBridge } = await import('../src/components/es-table/engines/render-dom-tb')
    expect(RenderSlotBridge.props).toBeDefined()
    const props = RenderSlotBridge.props as Record<string, any>
    expect(props.slotFn).toBeDefined()
    expect(props.slotProps).toBeDefined()
  })

  it('RenderSlotBridge 有 render 方法', async () => {
    const { RenderSlotBridge } = await import('../src/components/es-table/engines/render-dom-tb')
    expect(typeof (RenderSlotBridge as any).render).toBe('function')
  })

  it('RenderDomTb 默认导出存在且有 render 方法', async () => {
    const mod = await import('../src/components/es-table/engines/render-dom-tb')
    expect(mod.default).toBeDefined()
    expect(mod.default.name).toBe('RenderDomTb')
    expect(typeof (mod.default as any).render).toBe('function')
  })
})

// ─── M-6: vxe 模式下 dataSource watch 跳过 initSelection ──────────

describe('M-6 fix: vxe 模式下 initSelection 跳过', () => {
  function makeWatchHandler(
    isVxeEngine: () => boolean,
    initSelection: (val: any, ref: any) => void,
    tableRef: any,
  ) {
    return (val: any) => {
      if (isVxeEngine()) return
      initSelection(val, tableRef)
    }
  }

  it('vxe 模式：不调用 initSelection', () => {
    const fn = vi.fn()
    makeWatchHandler(() => true, fn, {})([ {id: 1} ])
    expect(fn).not.toHaveBeenCalled()
  })

  it('el-table 模式：调用 initSelection 并传递 tableRef', () => {
    const fn = vi.fn()
    const ref = { fake: 'tableRef' }
    makeWatchHandler(() => false, fn, ref)([ {id: 1} ])
    expect(fn).toHaveBeenCalledWith([{ id: 1 }], ref)
  })
})

// ─── P2: clearActived 兜底（vue2 / vxe v3 无 clearEdit，有 clearActived） ──

describe('P2 fix: clearActived 兜底（vue2 vxe v3 路径）', () => {
  const callClearActived = (grid: any) => {
    const g = grid as any
    ;(g?.clearEdit ?? g?.clearActived)?.()
  }

  it('vxe v3 路径：无 clearEdit，有 clearActived → 调用 clearActived', () => {
    const clearActived = vi.fn()
    callClearActived({ clearActived })
    expect(clearActived).toHaveBeenCalledOnce()
  })

  it('vxe v4+ 路径：有 clearEdit → 优先调用 clearEdit', () => {
    const clearEdit = vi.fn()
    const clearActived = vi.fn()
    callClearActived({ clearEdit, clearActived })
    expect(clearEdit).toHaveBeenCalledOnce()
    expect(clearActived).not.toHaveBeenCalled()
  })

  it('grid 为 null → 不抛出', () => {
    expect(() => callClearActived(null)).not.toThrow()
  })

  it('grid 无任何清除方法 → 不抛出', () => {
    expect(() => callClearActived({})).not.toThrow()
  })
})

// ─── P5: provide getTableInstantce vxe 委托 ──────────────────────────

describe('P5 fix: provide getTableInstantce 在 vxe 模式下委托给 vxeEngineRef', () => {
  function makeGetTableInstantce(
    isVxeEngine: boolean,
    vxeEngineRef: { toggleRowSelection?: (r: any) => void; clearSelection?: () => void; vxeInstance?: () => any } | null,
    tableRef: any,
    httpRequestInstance: () => void,
  ) {
    return () => ({
      tableRef: { value: tableRef },
      toggleSelection: (rows: any[] | null) => {
        if (isVxeEngine) {
          if (rows) rows.forEach((r) => vxeEngineRef?.toggleRowSelection?.(r))
          else vxeEngineRef?.clearSelection?.()
        } else if (rows) {
          rows.forEach((r) => tableRef?.toggleRowSelection?.(r))
        } else {
          tableRef?.clearSelection?.()
        }
      },
      clearAllSelection: () => {
        if (isVxeEngine) vxeEngineRef?.clearSelection?.()
        else tableRef?.clearAllSelection?.()
      },
      refsInstance: () => isVxeEngine
        ? vxeEngineRef?.vxeInstance?.()
        : tableRef,
      httpRequestInstance,
    })
  }

  it('vxe 模式：toggleSelection 委托给 vxeEngineRef.toggleRowSelection', () => {
    const vxeFn = vi.fn()
    const provide = makeGetTableInstantce(true, { toggleRowSelection: vxeFn }, null, vi.fn())
    provide().toggleSelection([{ id: '1' }, { id: '2' }])
    expect(vxeFn).toHaveBeenCalledTimes(2)
  })

  it('vxe 模式：toggleSelection(null) 调用 clearSelection', () => {
    const clearSel = vi.fn()
    const provide = makeGetTableInstantce(true, { clearSelection: clearSel }, null, vi.fn())
    provide().toggleSelection(null as any)
    expect(clearSel).toHaveBeenCalledOnce()
  })

  it('vxe 模式：clearAllSelection 调用 vxeEngineRef.clearSelection', () => {
    const clearSel = vi.fn()
    const provide = makeGetTableInstantce(true, { clearSelection: clearSel }, null, vi.fn())
    provide().clearAllSelection()
    expect(clearSel).toHaveBeenCalledOnce()
  })

  it('非 vxe 模式：toggleSelection 使用 tableRef', () => {
    const tableToggle = vi.fn()
    const tableRef = { toggleRowSelection: tableToggle }
    const provide = makeGetTableInstantce(false, null, tableRef, vi.fn())
    provide().toggleSelection([{ id: '1' }])
    expect(tableToggle).toHaveBeenCalledWith({ id: '1' })
  })

  it('vxe 模式：refsInstance 返回 vxeInstance()', () => {
    const vxeInst = { table: 'vxeTable' }
    const vxeEngineRef = { vxeInstance: () => vxeInst }
    const provide = makeGetTableInstantce(true, vxeEngineRef, null, vi.fn())
    expect(provide().refsInstance()).toBe(vxeInst)
  })

  it('非 vxe 模式：refsInstance 返回 tableRef', () => {
    const tableRef = { table: 'elTable' }
    const provide = makeGetTableInstantce(false, null, tableRef, vi.fn())
    expect(provide().refsInstance()).toBe(tableRef)
  })
})

// ─── L3: rowkey 缺失警告仅在开发环境 ────────────────────────────────

describe('L3 fix: rowkey 警告仅在开发环境', () => {
  const originalEnv = process.env.NODE_ENV
  let warnSpy: ReturnType<typeof vi.spyOn>

  beforeEach(() => {
    warnSpy = vi.spyOn(console, 'warn').mockImplementation(() => {})
  })

  afterEach(() => {
    process.env.NODE_ENV = originalEnv
    warnSpy.mockRestore()
  })

  function maybeWarnRowkey(multiSelect: boolean, rowkey: string | undefined) {
    if (process.env.NODE_ENV !== 'production' && multiSelect && !rowkey) {
      console.warn('[es-plus] engine:"vxe" + multiSelect:true 建议设置 options.rowkey')
    }
  }

  it('开发环境 + multiSelect + 无 rowkey → 输出警告', () => {
    process.env.NODE_ENV = 'development'
    maybeWarnRowkey(true, undefined)
    expect(warnSpy).toHaveBeenCalledOnce()
    expect(warnSpy.mock.calls[0][0]).toContain('rowkey')
  })

  it('生产环境 + multiSelect + 无 rowkey → 不输出警告', () => {
    process.env.NODE_ENV = 'production'
    maybeWarnRowkey(true, undefined)
    expect(warnSpy).not.toHaveBeenCalled()
  })

  it('开发环境 + multiSelect + 有 rowkey → 不输出警告', () => {
    process.env.NODE_ENV = 'development'
    maybeWarnRowkey(true, 'id')
    expect(warnSpy).not.toHaveBeenCalled()
  })

  it('开发环境 + multiSelect=false + 无 rowkey → 不输出警告', () => {
    process.env.NODE_ENV = 'development'
    maybeWarnRowkey(false, undefined)
    expect(warnSpy).not.toHaveBeenCalled()
  })
})

// ─── P3: vue2 useVxeColumnAdapter unrefOptions 辅助函数 ───────────

describe('P3 fix: unrefOptions 辅助函数', () => {
  // 直接测试 unrefOptions 的逻辑（inline 实现）
  function unrefOptions<T>(options: { value: T } | T): T {
    return options && typeof (options as any).value !== 'undefined'
      ? (options as any).value as T
      : options as T
  }

  it('plain object → 直接返回', () => {
    const obj = { multiSelect: true }
    expect(unrefOptions(obj)).toBe(obj)
  })

  it('Ref-shaped object ({ value: T }) → 返回 .value', () => {
    const inner = { multiSelect: true }
    const ref = { value: inner }
    expect(unrefOptions(ref)).toBe(inner)
  })

  it('value 为 false 时不误判（falsy value edge case）', () => {
    // options.value = false: { value: false } → 返回 false
    expect(unrefOptions({ value: false })).toBe(false)
  })

  it('null → 返回 null', () => {
    expect(unrefOptions(null as any)).toBeNull()
  })
})

// ─── 行内编辑 → `cell-edit`（内核判定在 core/table-edit.ts，这里断言接线）─────────
/**
 * Vue 2 端的接线与 Vue 3 不同：原生事件走 `v-on="vxeOnListeners"` 对象，而不是模板
 * `@edit-*`。原因是 Vue 2 里 `v-on="obj"` 与同名具名监听会互相覆盖（Vue 3 的
 * mergeProps 则是合成数组）—— 逃生舱 `options.vxeOn['edit-closed']` 会被静默吞掉。
 * 故 compose 在 computed 里做：用户 handler 先跑（原样载荷），再拍快照/比一遍。
 */
import Vue from 'vue'
import VxeEngine from '../src/components/es-table/engines/vxe-engine.vue'

// 必须**全局**注册：Vue 2 的局部 components 只对声明它的那个组件的模板生效，
// 不沿父链下传（引擎模板里的 `<vxe-grid>` 解析不到根实例上注册的 VxeGrid）。
// 这也正是引擎 `vxeAvailable` 优先查 `constructor.options.components` 的原因。
let stubVm: any = null
const VxeGridStub = {
  name: 'VxeGrid',
  props: ['columns', 'data'],
  created(this: any) { stubVm = this },
  render(h: any) { return h('div', { class: 'vxe-grid-stub' }) },
}
Vue.component('VxeGrid', VxeGridStub as any)

function mountEngine(options: any, dataSource: Record<string, unknown>[]) {
  stubVm = null
  const onCellEdit = vi.fn()
  const vm = new Vue({
    render: (h: any) => h(VxeEngine as any, {
      props: {
        columns: [{ prop: 'amount', label: '金额' }],
        dataSource,
        tableHeight: 300,
        options,
      },
      on: { 'cell-edit': onCellEdit },
    }),
  }).$mount() as any
  const fire = {
    actived: (p: any) => stubVm.$listeners['edit-actived']?.(p),
    closed: (p: any) => stubVm.$listeners['edit-closed']?.(p),
    listeners: () => Object.keys(stubVm.$listeners),
  }
  return { vm, fire, onCellEdit }
}

describe('vxe-engine(vue2) — 行内编辑归一为 cell-edit', () => {
  it('cell 模式：发 { row, prop, value, oldValue }', () => {
    const row: Record<string, unknown> = { id: 1, amount: 1000.5 }
    const { fire, onCellEdit } = mountEngine({ engine: 'vxe', rowkey: 'id', editConfig: { mode: 'cell' } }, [row])
    fire.actived({ row, column: { property: 'amount' } })
    row.amount = 7
    fire.closed({ row, column: { property: 'amount' } })
    expect(onCellEdit).toHaveBeenCalledTimes(1)
    expect(onCellEdit.mock.calls[0][0]).toEqual({ row, prop: 'amount', value: 7, oldValue: 1000.5 })
  })

  it('行模式：一次会话改多格 → 每格一条，且互不串味', () => {
    const row: Record<string, unknown> = { id: 1, amount: 1000.5, qty: 3 }
    const { fire, onCellEdit } = mountEngine({ engine: 'vxe', rowkey: 'id', editConfig: { mode: 'row' } }, [row])
    fire.actived({ row, column: { property: 'amount' } })
    row.qty = 5
    fire.closed({ row, column: { property: 'qty' } })
    expect(onCellEdit.mock.calls.map((c: any[]) => c[0].prop)).toEqual(['qty'])
  })

  it('未改值 → 不发', () => {
    const row: Record<string, unknown> = { id: 1, amount: 1 }
    const { fire, onCellEdit } = mountEngine({ engine: 'vxe', rowkey: 'id', editConfig: {} }, [row])
    fire.actived({ row, column: { property: 'amount' } })
    fire.closed({ row, column: { property: 'amount' } })
    expect(onCellEdit).not.toHaveBeenCalled()
  })

  it('逃生舱：vxeOn 的 edit-closed 与归一处理**都**收到，且用户 handler 只跑一次', () => {
    const onUserClosed = vi.fn()
    const row: Record<string, unknown> = { id: 1, amount: 1 }
    const { fire, onCellEdit } = mountEngine(
      { engine: 'vxe', rowkey: 'id', editConfig: {}, vxeOn: { 'edit-closed': onUserClosed } },
      [row],
    )
    fire.actived({ row, column: { property: 'amount' } })
    row.amount = 2
    fire.closed({ row, column: { property: 'amount' } })
    // 只挂一次：具名 @edit-closed + v-on 对象同键在 Vue 2 会互相覆盖，故必须走 compose
    expect(onUserClosed).toHaveBeenCalledTimes(1)
    expect(onCellEdit).toHaveBeenCalledTimes(1)
    expect(onCellEdit.mock.calls[0][0].value).toBe(2)
  })
})
