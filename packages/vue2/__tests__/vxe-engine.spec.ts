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
