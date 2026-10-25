import { describe, it, expect, vi } from 'vitest'
import {
  createSelectionState,
  applySelectionChange,
  restoreSelectionForPage,
  clearAllSelection,
  wantsCrossPageSelection,
  mergeSelectedRows,
} from '../src/table-selection'

const row = (id: number, name = `n${id}`) => ({ id, name })

describe('table-selection', () => {
  it('createSelectionState 返回空状态', () => {
    const s = createSelectionState()
    expect(s.multipleSelection).toEqual([])
    expect(s.selectionsByPage).toEqual({})
    expect(s.isInitChange).toBe(false)
  })

  it('单页（无 rowkey） 直接覆盖', () => {
    const s = createSelectionState()
    applySelectionChange(s, [row(1), row(2)], 1)
    expect(s.multipleSelection).toHaveLength(2)
    applySelectionChange(s, [row(3)], 1)
    expect(s.multipleSelection).toEqual([row(3)])
  })

  it('多页累加（带 rowkey）', () => {
    const s = createSelectionState()
    applySelectionChange(s, [row(1), row(2)], 1, 'id')
    applySelectionChange(s, [row(3)], 2, 'id')
    expect(s.multipleSelection.map((r) => (r as { id: number }).id)).toEqual([1, 2, 3])
  })

  it('翻页后清空当前页 → 该页选择被移除但其它页保留', () => {
    const s = createSelectionState()
    applySelectionChange(s, [row(1)], 1, 'id')
    applySelectionChange(s, [row(2)], 2, 'id')
    expect(s.multipleSelection).toHaveLength(2)
    applySelectionChange(s, [], 2, 'id')
    expect(s.multipleSelection.map((r) => (r as { id: number }).id)).toEqual([1])
  })

  it('isInitChange=true 时跳过', () => {
    const s = createSelectionState()
    s.isInitChange = true
    applySelectionChange(s, [row(1)], 1, 'id')
    expect(s.multipleSelection).toEqual([])
  })

  it('restoreSelectionForPage 调用 toggleRowSelection', () => {
    const s = createSelectionState()
    applySelectionChange(s, [row(1), row(2)], 1, 'id')
    const tableRef = { toggleRowSelection: vi.fn() }
    restoreSelectionForPage(s, [row(1), row(3)], tableRef, 'id')
    expect(tableRef.toggleRowSelection).toHaveBeenCalledTimes(1)
    expect(tableRef.toggleRowSelection).toHaveBeenCalledWith(row(1), true)
  })

  it('clearAllSelection 重置全部', () => {
    const s = createSelectionState()
    applySelectionChange(s, [row(1)], 1, 'id')
    const tableRef = { clearSelection: vi.fn() }
    clearAllSelection(s, tableRef)
    expect(s.multipleSelection).toEqual([])
    expect(s.selectionsByPage).toEqual({})
    expect(tableRef.clearSelection).toHaveBeenCalled()
  })

  // ─── 回归：去重表的键归一化（此前是裸对象 + 两套归一化）───────────────
  describe('行键归一化', () => {
    it('行键是 Object.prototype 上的既有键（toString/constructor/valueOf/hasOwnProperty）时仍能选中', () => {
      // 回归：去重表此前是裸 `{}`，`!uniqueMap['toString']` 恒为 false ——
      // 这些行**永远选不中**（一行都进不了 multipleSelection）。
      const s = createSelectionState()
      const rows = ['toString', 'constructor', 'valueOf', 'hasOwnProperty'].map((id) => ({ id }))
      applySelectionChange(s, rows, 1, 'id')
      expect(s.multipleSelection.map((r) => (r as { id: string }).id)).toEqual([
        'toString',
        'constructor',
        'valueOf',
        'hasOwnProperty',
      ])
    })

    it("行键是 '__proto__' 时不会被重复收进全集", () => {
      // 回归：`uniqueMap['__proto__'] = true` 写的是原型而非自有属性，
      // 去重形同虚设 —— 同一行会被收两次。
      const s = createSelectionState()
      applySelectionChange(s, [{ id: '__proto__' }], 1, 'id')
      applySelectionChange(s, [{ id: '__proto__' }], 2, 'id')
      expect(s.multipleSelection).toHaveLength(1)
    })

    it('数字键与字符串键视为同一行：翻页回显不再丢勾选', () => {
      // 回归：去重用 String(key)、回显用 `===`。第 1 页选中的 { id: 1 }
      // 在第 2 页（后端把 id 序列化成 '1'）里 `1 === '1'` 为假 → 勾选丢失。
      const s = createSelectionState()
      applySelectionChange(s, [{ id: 1 }], 1, 'id')
      const tableRef = { toggleRowSelection: vi.fn() }
      restoreSelectionForPage(s, [{ id: '1' }], tableRef, 'id')
      expect(tableRef.toggleRowSelection).toHaveBeenCalledTimes(1)
      expect(tableRef.toggleRowSelection).toHaveBeenCalledWith({ id: '1' }, true)
    })

    it('键缺失（undefined/null）的行不参与跨页去重', () => {
      const s = createSelectionState()
      applySelectionChange(s, [{ id: undefined }, { id: null }], 1, 'id')
      expect(s.multipleSelection).toEqual([])
    })

    it('清空后再选：clearAllSelection 复位 isInitChange（否则表永远选不中）', () => {
      // 回归：isInitChange 残留 true 会让 applySelectionChange 直接 return，
      // 「清空」之后用户再也选不中任何行。
      const s = createSelectionState()
      s.isInitChange = true
      clearAllSelection(s, { clearSelection: vi.fn() })
      expect(s.isInitChange).toBe(false)
      applySelectionChange(s, [row(1)], 1, 'id')
      expect(s.multipleSelection).toHaveLength(1)
    })
  })

  describe('restoreSelectionForPage 的复杂度', () => {
    it('对行的 rowkey 读取次数是 O(pageSize + 选中数)，不是 pageSize × 选中数', () => {
      // 不测时间（不稳定），测访问次数：嵌套比较会对每个 (行, 选中) 组合读两次 rowkey。
      const s = createSelectionState()
      const pageSize = 200
      const selectionCount = 200
      applySelectionChange(
        s,
        Array.from({ length: selectionCount }, (_, i) => ({ id: i })),
        1,
        'id'
      )

      let reads = 0
      const pageRows = Array.from({ length: pageSize }, (_, i) =>
        new Proxy(
          { id: i },
          {
            get(target, prop, recv) {
              if (prop === 'id') reads += 1
              return Reflect.get(target, prop, recv)
            },
          }
        )
      )

      restoreSelectionForPage(s, pageRows, { toggleRowSelection: vi.fn() }, 'id')

      // 线性实现：每行读 1 次 = pageSize；嵌套实现：200 × 200 × 2 = 80000
      expect(reads).toBeLessThanOrEqual(pageSize + selectionCount)
    })
  })
})

// ─────────────────────────────────────────────────────────────────────────────
// 跨页保留判据（三份 vxe 引擎与虚拟引擎共用）
//
// 回归背景：三份 vxe 引擎此前只看 options.multiSelect ——
//   · 显式 `type:'selection'` 列（el-table 端同样跨页保留）在 vxe 端丢勾选；
//   · cachePageSelection:false（文档写明关闭跨页缓存）在 vxe 端被无视。
// ─────────────────────────────────────────────────────────────────────────────
describe('wantsCrossPageSelection', () => {
  it('multiSelect:true → 跨页保留', () => {
    expect(wantsCrossPageSelection({ multiSelect: true }, [])).toBe(true)
  })

  it('显式 type:selection 列 → 跨页保留（与 multiSelect 等价）', () => {
    expect(wantsCrossPageSelection({}, [{ type: 'selection' }])).toBe(true)
  })

  it('cachePageSelection:false 一律关闭（即便 multiSelect:true）', () => {
    expect(wantsCrossPageSelection({ multiSelect: true, cachePageSelection: false }, [])).toBe(false)
    expect(
      wantsCrossPageSelection({ cachePageSelection: false }, [{ type: 'selection' }])
    ).toBe(false)
  })

  it('没有多选列 → 不保留', () => {
    expect(wantsCrossPageSelection({}, [{ prop: 'name' }])).toBe(false)
    expect(wantsCrossPageSelection({}, undefined)).toBe(false)
  })

  it('options 缺失 → 不保留（不崩溃）', () => {
    expect(wantsCrossPageSelection(undefined, [{ type: 'selection' }])).toBe(false)
    expect(wantsCrossPageSelection(null, null)).toBe(false)
  })
})

// ─────────────────────────────────────────────────────────────────────────────
// vxe 已选行合并：getCheckboxRecords() 只覆盖当前数据，跨页行在 reserve 里
// ─────────────────────────────────────────────────────────────────────────────
describe('mergeSelectedRows', () => {
  it('当前数据已选 + 跨页保留 → 合并', () => {
    expect(mergeSelectedRows([row(1), row(2)], [row(3)])).toEqual([row(1), row(2), row(3)])
  })

  it('任一侧为空/undefined → 不崩溃', () => {
    expect(mergeSelectedRows([row(1)], undefined)).toEqual([row(1)])
    expect(mergeSelectedRows(undefined, [row(1)])).toEqual([row(1)])
    expect(mergeSelectedRows(undefined, undefined)).toEqual([])
  })

  it('传 rowkey 时按 key 去重（数字/字符串键同源归一化）', () => {
    // 同一行在 `String(key)` 序列化过的页里回来时 key 是字符串：去重必须认成同一行
    expect(mergeSelectedRows([row(1)], [{ id: '1' } as any], 'id')).toEqual([row(1)])
  })

  it('key 缺失的行不参与去重但保留', () => {
    const noKey = { name: 'x' } as any
    expect(mergeSelectedRows([noKey], [row(1)], 'id')).toEqual([noKey, row(1)])
  })

  it('不传 rowkey → 直接平铺（不去重）', () => {
    expect(mergeSelectedRows([row(1)], [row(1)])).toEqual([row(1), row(1)])
  })
})
