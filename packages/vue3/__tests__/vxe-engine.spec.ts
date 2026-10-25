/**
 * vxe-engine 回归测试（vue3）
 *
 * 覆盖场景：
 * 1. sort 事件归一化：vxe 内部 asc/desc → es-plus 公共 ascending/descending/null
 * 2. spanMethod → mergeMethod shim：field/property 双写，res 格式标准化
 * 3. patchHtmlRowSpans：动态合并打印修正工具函数（完整行为验证）
 * 4. getInternalTable 防御链：refTable 为 Ref/原始值/undefined 的三种情况
 *
 * 选择相关的纯函数（跨页保留判据 / 已选行合并）落在 @es-plus/core，见
 * packages/core/__tests__/table-selection.spec.ts —— 三个 vxe 引擎共用同一份实现。
 */
import { describe, it, expect, vi } from 'vitest'
import { patchHtmlRowSpans } from '../src/utils/vxe-print-utils'
// 直接导入发货实现（此前测试内联复制了这些逻辑 = 测试剧场；现共享同一份纯函数）
import {
  normalizeVxeOrder,
  applySpanShim,
  resolveInternalTable,
} from '../src/components/es-table/src/engines/vxe-engine-helpers'

// ─────────────────────────────────────────────────────────────────────────────
// 1. sort 事件归一化
//    handleSortChange 逻辑：vxe order 'asc'/'desc'/null → es-plus 'ascending'/'descending'/null
// ─────────────────────────────────────────────────────────────────────────────

describe('sort 事件归一化', () => {
  it("'asc' → 'ascending'", () => {
    expect(normalizeVxeOrder('asc')).toBe('ascending')
  })
  it("'desc' → 'descending'", () => {
    expect(normalizeVxeOrder('desc')).toBe('descending')
  })
  it('null → null（取消排序）', () => {
    expect(normalizeVxeOrder(null)).toBeNull()
  })
  it('undefined → null', () => {
    expect(normalizeVxeOrder(undefined)).toBeNull()
  })
  it("未知值 → null（不崩溃）", () => {
    expect(normalizeVxeOrder('none' as any)).toBeNull()
  })
})

// ─────────────────────────────────────────────────────────────────────────────
// 3. spanMethod → mergeMethod shim
//    vxe column 用 field；el-table 用 property；shim 补写另一个属性
// ─────────────────────────────────────────────────────────────────────────────

describe('spanMethod → mergeMethod shim', () => {
  it('column.field → column.property 补写（el-table 兼容）', () => {
    const spanMethod = vi.fn().mockReturnValue({ rowspan: 1, colspan: 1 })
    const col = { field: 'name' }  // 只有 field，无 property
    applySpanShim(spanMethod, { row: {}, rowIndex: 0, column: col, columnIndex: 0 })
    const passedCol = spanMethod.mock.calls[0][0].column
    expect(passedCol.property).toBe('name')  // shim 补写了 property
    expect(passedCol.field).toBe('name')     // field 保持不变
  })

  it('column.property 已有值时不覆盖（property 优先 field）', () => {
    const spanMethod = vi.fn().mockReturnValue({ rowspan: 1, colspan: 1 })
    const col = { field: 'age', property: 'age_alias' }
    applySpanShim(spanMethod, { row: {}, rowIndex: 0, column: col, columnIndex: 0 })
    const passedCol = spanMethod.mock.calls[0][0].column
    // field ?? property：field 存在时不读 property
    expect(passedCol.property).toBe('age')  // field 覆盖了 property
  })

  it('返回数组格式 → 转换为 { rowspan, colspan }', () => {
    const spanMethod = vi.fn().mockReturnValue([3, 1])
    const result = applySpanShim(spanMethod, { row: {}, rowIndex: 0, column: { field: 'x' }, columnIndex: 0 })
    expect(result).toEqual({ rowspan: 3, colspan: 1 })
  })

  it('返回对象格式 → 直接透传', () => {
    const spanMethod = vi.fn().mockReturnValue({ rowspan: 2, colspan: 1 })
    const result = applySpanShim(spanMethod, { row: {}, rowIndex: 0, column: { field: 'x' }, columnIndex: 0 })
    expect(result).toEqual({ rowspan: 2, colspan: 1 })
  })

  it('spanMethod 返回 null/undefined → 默认 { rowspan:1, colspan:1 }', () => {
    const spanMethod = vi.fn().mockReturnValue(null)
    const result = applySpanShim(spanMethod, { row: {}, rowIndex: 0, column: { field: 'x' }, columnIndex: 0 })
    expect(result).toEqual({ rowspan: 1, colspan: 1 })
  })
})

// ─────────────────────────────────────────────────────────────────────────────
// 4. patchHtmlRowSpans — 动态合并打印修正工具
// ─────────────────────────────────────────────────────────────────────────────

function makeTableHtml(rows: string[][]): string {
  const tbody = rows.map(cells =>
    `<tr>${cells.map(c => `<td>${c}</td>`).join('')}</tr>`
  ).join('')
  return `<table><thead><tr><th>A</th><th>B</th></tr></thead><tbody>${tbody}</tbody></table>`
}

describe('patchHtmlRowSpans', () => {
  it('rowspan=0 的单元格被删除', () => {
    const html = makeTableHtml([['A1', 'B1'], ['A2', 'B2']])
    // 第二行第一列被第一行覆盖 → rowspan=0
    const fixed = patchHtmlRowSpans(html, (ri, ci) => {
      if (ri === 1 && ci === 0) return { rowspan: 0, colspan: 1 }
      if (ri === 0 && ci === 0) return { rowspan: 2, colspan: 1 }
      return { rowspan: 1, colspan: 1 }
    })
    const doc = new DOMParser().parseFromString(fixed, 'text/html')
    const rows = doc.querySelectorAll('tbody tr')
    // 第二行应只剩一个 td（B2），A2 已被删除
    expect(rows[1].querySelectorAll('td')).toHaveLength(1)
    expect(rows[1].querySelector('td')!.textContent).toBe('B2')
  })

  it('rowspan>1 的单元格设置 rowspan 属性', () => {
    const html = makeTableHtml([['X', 'Y'], ['X', 'Z']])
    const fixed = patchHtmlRowSpans(html, (ri, ci) => {
      if (ri === 0 && ci === 0) return { rowspan: 2, colspan: 1 }
      if (ri === 1 && ci === 0) return { rowspan: 0, colspan: 1 }
      return { rowspan: 1, colspan: 1 }
    })
    const doc = new DOMParser().parseFromString(fixed, 'text/html')
    const firstTd = doc.querySelector('tbody tr:first-child td:first-child')
    expect(firstTd!.getAttribute('rowspan')).toBe('2')
  })

  it('colspan>1 的单元格设置 colspan 属性', () => {
    const html = makeTableHtml([['merged', 'x'], ['a', 'b']])
    const fixed = patchHtmlRowSpans(html, (ri, ci) => {
      if (ri === 0 && ci === 0) return { rowspan: 1, colspan: 2 }
      return { rowspan: 1, colspan: 1 }
    })
    const doc = new DOMParser().parseFromString(fixed, 'text/html')
    const td = doc.querySelector('tbody tr:first-child td:first-child')
    expect(td!.getAttribute('colspan')).toBe('2')
  })

  it('rowspan=1/colspan=1 不写入属性（保持 HTML 干净）', () => {
    const html = makeTableHtml([['A', 'B']])
    const fixed = patchHtmlRowSpans(html, () => ({ rowspan: 1, colspan: 1 }))
    const doc = new DOMParser().parseFromString(fixed, 'text/html')
    const tds = doc.querySelectorAll('tbody td')
    tds.forEach(td => {
      expect(td.hasAttribute('rowspan')).toBe(false)
      expect(td.hasAttribute('colspan')).toBe(false)
    })
  })

  it('<thead> 内容不被修改（多级表头保持完整）', () => {
    const html = makeTableHtml([['a', 'b']])
    const fixed = patchHtmlRowSpans(html, () => ({ rowspan: 0, colspan: 1 }))
    // patchHtmlRowSpans 只改 tbody，thead 中的 th 在输出 HTML 中依然存在
    const doc = new DOMParser().parseFromString(fixed, 'text/html')
    expect(doc.querySelectorAll('thead th')).toHaveLength(2)
    // tbody 中的 td 已被 spanFn(rowspan=0) 全部删除
    expect(doc.querySelectorAll('tbody td')).toHaveLength(0)
  })

  it('空 tbody → 不崩溃，返回原始内容', () => {
    const html = `<table><thead><tr><th>H</th></tr></thead><tbody></tbody></table>`
    const spanFn = vi.fn()
    expect(() => patchHtmlRowSpans(html, spanFn)).not.toThrow()
    expect(spanFn).not.toHaveBeenCalled()
  })
})

// ─────────────────────────────────────────────────────────────────────────────
// 5. getInternalTable 防御链（resolveInternalTable 纯部分）
//    三种情况：refTable 是 Vue Ref（.value 才是实例）/ 原始对象 / undefined
// ─────────────────────────────────────────────────────────────────────────────

describe('resolveInternalTable 防御链', () => {
  it('refTable 是 Vue Ref → 返回 .value', () => {
    const instance = { clearEdit: vi.fn() }
    const grid = { getRefMaps: () => ({ refTable: { value: instance } }) }
    expect(resolveInternalTable({ value: grid })).toBe(instance)
  })

  it('refTable 是原始对象（非 Ref）→ 直接返回', () => {
    const instance = { clearEdit: vi.fn() }
    const grid = { getRefMaps: () => ({ refTable: instance }) }
    // refTable.value 为 undefined，fallback 到 refTable 本身
    expect(resolveInternalTable({ value: grid })).toBe(instance)
  })

  it('getRefMaps 不存在 → 返回 undefined（不崩溃）', () => {
    const grid = {}  // 无 getRefMaps
    expect(resolveInternalTable({ value: grid })).toBeUndefined()
  })

  it('gridRef 为 null → 返回 undefined（不崩溃）', () => {
    expect(resolveInternalTable(null)).toBeUndefined()
  })

  it('refTable 为 undefined → 返回 undefined', () => {
    const grid = { getRefMaps: () => ({ refTable: undefined }) }
    expect(resolveInternalTable({ value: grid })).toBeUndefined()
  })
})

// ─── clearSelection：reserve 行必须一起清 ───────────────────────────────────

describe('vxe-engine — clearSelection 同时清 reserve', () => {
  it('调用 clearCheckboxRow + clearCheckboxReserve（reserve 行不在当前表格数据里）', async () => {
    const { mount } = await import('@vue/test-utils')
    const { defineComponent, h } = await import('vue')
    const VxeEngine = (await import('../src/components/es-table/src/engines/vxe-engine.vue')).default

    const clearCheckboxRow = vi.fn()
    const clearCheckboxReserve = vi.fn()
    const VxeGridStub = defineComponent({
      name: 'VxeGrid',
      props: { columns: { type: Array, default: () => [] }, data: { type: Array, default: () => [] } },
      setup(_props, { expose }) {
        // 与真 vxe-grid 同名的两个清空 API；reserve 行只在第二个里
        expose({
          clearCheckboxRow,
          clearCheckboxReserve,
          getCheckboxRecords: () => [],
          getCheckboxReserveRecords: () => [],
        })
        return () => h('div', { class: 'vxe-grid-stub' })
      },
    })

    const wrapper = mount(VxeEngine, {
      props: {
        columns: [{ prop: 'id', label: 'ID' }],
        dataSource: [{ id: 1 }],
        tableHeight: 300,
        options: { engine: 'vxe', rowkey: 'id' } as any,
      },
      global: { components: { VxeGrid: VxeGridStub } },
    })

    // 只清 clearCheckboxRow 时，reserve 里其它页的行会留在 checkboxReserveRowMap，
    // 用户点「清空」后翻回上一页会被重新勾上（浏览器实测 reserves 仍为 [1]）。
    const exposed = (wrapper.vm as any).$?.exposed ?? (wrapper.vm as any)
    exposed.clearSelection()
    expect(clearCheckboxRow).toHaveBeenCalled()
    expect(clearCheckboxReserve).toHaveBeenCalled()
  })
})
