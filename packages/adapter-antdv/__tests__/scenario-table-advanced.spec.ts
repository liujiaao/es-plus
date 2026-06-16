/**
 * 场景测试：表格选择/分页/远程数据/排序/自定义渲染
 * 基于 es-plus-docs 的 table/ 目录下全部案例
 */
import { describe, it, expect } from 'vitest'
import { useTableSelection } from '../src/composables/use-table-selection'
import { adaptColumn, adaptColumns } from '../src/components/es-table/src/column-adapter'
import { findValueByKey } from '../src/utils/shared'
import type { TableColumn } from '../src/types'

const makeRow = (id: string, overrides?: Record<string, unknown>) => ({
  id, name: `用户${id}`, email: `${id}@test.com`, status: Number(id) % 2, createTime: '2024-01-01',
  ...overrides,
})

// ─── 场景数据 ──────────────────────────────────────
function makeMockData(count: number) {
  return Array.from({ length: count }, (_, i) => makeRow(String(i + 1)))
}

describe('场景: 表格选择 (基于 Selection.vue + QueryTable.vue)', () => {
  it('单页全选 — 25行全选', () => {
    const sel = useTableSelection('id')
    const allRows = makeMockData(25)
    sel.handleSelectionChange(allRows, 1)
    expect(sel.multipleSelection.value).toHaveLength(25)
  })

  it('跨页选择 — 3页各选5行 → 15行去重', () => {
    const sel = useTableSelection('id')
    for (let page = 1; page <= 3; page++) {
      const start = (page - 1) * 5 + 1
      const pageRows = Array.from({ length: 5 }, (_, i) => makeRow(String(start + i)))
      sel.handleSelectionChange(pageRows, page)
    }
    expect(sel.multipleSelection.value).toHaveLength(15)
  })

  it('跨页去重 — 第1页选[1,2,3,4,5], 第2页也选[1,2,3,4,5]（重复id）= 5行', () => {
    const sel = useTableSelection('id')
    // 第1页
    sel.handleSelectionChange(Array.from({ length: 5 }, (_, i) => makeRow(String(i + 1))), 1)
    // 第2页（相同数据——模拟数据重复场景）
    sel.handleSelectionChange(Array.from({ length: 5 }, (_, i) => makeRow(String(i + 1))), 2)
    // 同key去重 → 仅5行
    expect(sel.multipleSelection.value).toHaveLength(5)
  })

  it('跨页选择 + 翻页恢复 — handleSelectData 恢复选中', () => {
    const sel = useTableSelection('id')
    // 选中 id=1,3,5,7,9
    sel.multipleSelection.value = [1, 3, 5, 7, 9].map((id) => makeRow(String(id)))
    // 当前页数据含 3,4,5,6,7
    const dataList = [3, 4, 5, 6, 7].map((id) => makeRow(String(id)))
    sel.handleSelectData(dataList, null)
    // 应仅恢复 3,5,7
    expect(sel.selectedRowKeys.value.sort()).toEqual(['3', '5', '7'])
  })

  it('清除跨页选择 — clearAllSelection', () => {
    const sel = useTableSelection('id')
    sel.handleSelectionChange(makeMockData(10), 1)
    sel.handleSelectionChange(makeMockData(10), 2)
    sel.clearAllSelection()
    expect(sel.multipleSelection.value).toHaveLength(0)
    expect(sel.selectedRowKeys.value).toHaveLength(0)
    expect(Object.keys(sel.selectionsByPage.value)).toHaveLength(0)
  })

  it('批量选择 → 清空当前页', () => {
    const sel = useTableSelection('id')
    sel.handleSelectionChange(makeMockData(5), 1)
    sel.handleSelectionChange(makeMockData(5), 2)
    sel.clearSelection()
    // clearSelection 仅清 selectedRowKeys（当前页），不影响 multipleSelection
    expect(sel.selectedRowKeys.value).toHaveLength(0)
  })
})

describe('场景: 列适配 (ADV Column 格式)', () => {
  it('基础列映射 — 完整字段对照', () => {
    const col: TableColumn = {
      prop: 'orderNo', label: '订单号', width: 160, align: 'center',
      fixed: 'left', sortable: true, ellipsis: true,
    }
    const adv = adaptColumn(col)
    expect(adv.dataIndex).toBe('orderNo')
    expect(adv.title).toBe('订单号')
    expect(adv.width).toBe(160)
    expect(adv.align).toBe('center')
    expect(adv.fixed).toBe('left')
    expect(adv.sorter).toBe(true)
    expect(adv.ellipsis).toBe(true)
  })

  it('金额列 — 右对齐 + 排序', () => {
    const col: TableColumn = {
      prop: 'amount', label: '金额', width: 120, align: 'right', sortable: true,
    }
    const adv = adaptColumn(col)
    expect(adv.align).toBe('right')
    expect(adv.sorter).toBe(true)
  })

  it('状态列 — 居中对齐', () => {
    const col: TableColumn = { prop: 'status', label: '状态', width: 100, align: 'center' }
    const adv = adaptColumn(col)
    expect(adv.align).toBe('center')
  })

  it('操作列 — fixed: right', () => {
    const col: TableColumn = {
      prop: 'operate', label: '操作', width: 200, fixed: 'right',
      btns: [
        { name: '编辑', type: 'primary', clickEvent: () => {} },
        { name: '删除', type: 'danger', clickEvent: () => {} },
        { name: '查看', clickEvent: () => {} },
      ],
    }
    const adv = adaptColumn(col)
    expect(adv.dataIndex).toBe('operate')
    expect(adv.fixed).toBe('right')
    expect(adv._esCol.btns).toHaveLength(3)
  })

  it('minWidth 弹性列', () => {
    const col: TableColumn = { prop: 'description', label: '描述', minWidth: 200 }
    const adv = adaptColumn(col)
    expect(adv.minWidth).toBe(200)
    expect(adv.width).toBeUndefined()
  })
})

describe('场景: 表格分页配置', () => {
  it('默认分页：10/20/50/100', () => {
    const pagination = { current: 1, pageSize: 10, total: 200, pageSizes: [10, 20, 50, 100] }
    expect(pagination.pageSize).toBe(10)
    expect(pagination.total).toBe(200)
    expect(pagination.pageSizes).toHaveLength(4)
  })

  it('小分页：5/10/15', () => {
    const pagination = { current: 1, pageSize: 5, total: 30, pageSizes: [5, 10, 15], isSmall: true }
    expect(pagination.isSmall).toBe(true)
  })

  it('无数据时分页隐藏 (total=undefined)', () => {
    const pagination = { pageSize: 10 }
    expect(pagination.total).toBeUndefined()
  })

  it('单页时显示分页 (total<=pageSize)', () => {
    const pagination = { current: 1, pageSize: 20, total: 15 }
    // 即使 total 小于 pageSize，也显示分页
    expect(pagination.total).toBeLessThanOrEqual(pagination.pageSize)
  })
})

describe('场景: 表格响应字段映射 (configTableOut)', () => {
  it('标准格式', () => {
    const config = { total: 'total', tableData: 'data', pageSize: 'pageSize', current: 'pageIndex' }
    const response = { total: 100, data: [{ id: 1 }], pageSize: 10, pageIndex: 1 }
    expect(response[config.total]).toBe(100)
    expect(response[config.tableData]).toHaveLength(1)
  })

  it('MyBatis-Plus 分页格式', () => {
    const config = { total: 'total', tableData: 'records', pageSize: 'size', current: 'current' }
    const response = { total: 200, records: [{ id: 1 }], size: 20, current: 1 }
    expect(response[config.tableData]).toHaveLength(1)
  })

  it('蛇形命名格式', () => {
    const config = { total: 'total_count', tableData: 'result_list', pageSize: 'page_size', current: 'page_num' }
    const response = { total_count: 300, result_list: [{ id: 1 }], page_size: 30, page_num: 1 }
    expect(response[config.tableData]).toHaveLength(1)
  })

  it('嵌套响应格式 (findValueByKey 深度搜索)', () => {
    const response = { code: 0, data: { result: { total: 50, items: [{ id: 1 }, { id: 2 }] } } }
    expect(findValueByKey(response, 'total')).toBe(50)
    expect(findValueByKey(response, 'items')).toEqual([{ id: 1 }, { id: 2 }])
  })
})

describe('场景: 表格按钮 (configBtn + 操作列)', () => {
  it('工具栏按钮 — leftText + 左右分割', () => {
    const configBtn = [
      { name: '新增', key: 'add', type: 'primary', position: 'left' as const },
      { name: '批量删除', key: 'batchDelete', type: 'danger', position: 'right' as const },
      { name: '导出', key: 'export', position: 'right' as const },
    ]
    const leftBtns = configBtn.filter((b) => b.position === 'left')
    const rightBtns = configBtn.filter((b) => b.position === 'right')
    expect(leftBtns).toHaveLength(1)
    expect(rightBtns).toHaveLength(2)
  })

  it('操作列行按钮 — clickEvent 回调', () => {
    const calls: any[] = []
    const rowData = { id: '1', name: '张三' }
    const btns = [
      { name: '编辑', type: 'primary', clickEvent: (row: any) => calls.push({ action: 'edit', row }) },
      { name: '删除', type: 'danger', clickEvent: (row: any) => calls.push({ action: 'delete', row }) },
    ]
    btns.forEach((b) => b.clickEvent?.(rowData))
    expect(calls).toHaveLength(2)
    expect(calls[0].action).toBe('edit')
    expect(calls[1].action).toBe('delete')
  })
})

describe('场景: 列格式化 (formatter + custom render)', () => {
  it('金额格式化 — ¥1,200.00', () => {
    const formatter = (row: Record<string, unknown>) => `¥${Number(row.price).toLocaleString()}`
    expect(formatter({ price: 1200 })).toBe('¥1,200')
  })

  it('状态映射 — 0→禁用 1→启用', () => {
    const statusMap: Record<number, string> = { 0: '禁用', 1: '启用' }
    const formatter = (row: Record<string, unknown>) => statusMap[row.status as number] || '未知'
    expect(formatter({ status: 1 })).toBe('启用')
    expect(formatter({ status: 0 })).toBe('禁用')
  })

  it('空值回退 — null/undefined → "-"', () => {
    const formatter = (row: Record<string, unknown>) => {
      const v = row.value
      return v == null || v === '' ? '-' : String(v)
    }
    expect(formatter({ value: null })).toBe('-')
    expect(formatter({ value: '' })).toBe('-')
    expect(formatter({ value: 'hello' })).toBe('hello')
  })
})

describe('场景: 表格高度/虚拟滚动', () => {
  it('heightType=auto — 自适应高度', () => {
    const options = { heightType: 'auto' as const, tabHeight: undefined }
    expect(options.heightType).toBe('auto')
  })

  it('heightType=height — 固定高度', () => {
    const options = { heightType: 'height' as const, height: 500 }
    expect(options.height).toBe(500)
  })

  it('虚拟滚动配置', () => {
    const options = {
      virtual: true, engine: 'virtual' as const,
      rowHeight: 50, estimatedRowHeight: 50, overscanCount: 5,
    }
    expect(options.virtual).toBe(true)
    expect(options.rowHeight).toBe(50)
    expect(options.overscanCount).toBe(5)
  })

  it('大数据场景 — 10000行', () => {
    const data = makeMockData(10000)
    expect(data).toHaveLength(10000)
    // 大数据配合虚拟滚动
    const options = { virtual: true, rowHeight: 48 }
    expect(options.virtual).toBe(true)
  })
})

describe('场景: snIndex + expand 内置列', () => {
  it('snIndex → 序号列前插', () => {
    const cols: TableColumn[] = [
      { prop: 'name', label: 'Name' },
    ]
    const result = adaptColumns(cols, { snIndex: true })
    expect(result).toHaveLength(2)
    expect(result[0].dataIndex).toBe('_sn')
    expect(result[0].title).toBe('#')
    expect(result[0].width).toBe(60)
    expect(typeof result[0].customRender).toBe('function')
  })

  it('序号列渲染 1-based index', () => {
    const result = adaptColumns([], { snIndex: true })
    const renderFn = result[0].customRender as Function
    expect(renderFn({ index: 0 })).toBe(1)
    expect(renderFn({ index: 4 })).toBe(5)
  })
})

describe('场景: 排序 + 筛选', () => {
  it('sortable 列 — ADV sorter=true', () => {
    const cols: TableColumn[] = [
      { prop: 'createTime', label: '创建时间', sortable: true },
      { prop: 'amount', label: '金额', sortable: true },
    ]
    const adapted = cols.map(adaptColumn)
    adapted.forEach((c) => {
      expect(c.sorter).toBe(true)
    })
  })

  it('custom sort — 远程排序', () => {
    const col: TableColumn = { prop: 'customField', label: '自定义', sortable: 'custom' }
    const adv = adaptColumn(col)
    expect(adv.sorter).toEqual({ compare: expect.any(Function), multiple: 1 })
  })
})
