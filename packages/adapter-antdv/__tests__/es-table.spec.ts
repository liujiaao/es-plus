/**
 * EsTable 组件测试 (ADV 版本)
 */
import { describe, it, expect, vi, beforeEach } from 'vitest'
import { mount, flushPromises } from '@vue/test-utils'
import { h, nextTick } from 'vue'
import EsTable from '../src/components/es-table/src/component.vue'

// Mock ant-design-vue 组件避免完整渲染
vi.mock('ant-design-vue', () => ({
  Table: { name: 'ATable', template: '<div class="mock-table"><slot name="bodyCell" :column="{}" :text="{}" :record="{}" :index="0" /></div>', props: ['columns', 'dataSource', 'rowKey', 'pagination', 'loading', 'bordered', 'size', 'showHeader', 'rowSelection', 'rowClassName', 'customRow', 'scroll', 'sortDirections', 'locale'] },
  Pagination: { name: 'APagination', template: '<div class="mock-pagination" />', props: ['current', 'pageSize', 'total', 'showSizeChanger', 'showQuickJumper', 'pageSizeOptions', 'size', 'showTotal'] },
  Spin: { name: 'ASpin', template: '<div class="mock-spin"><slot /></div>', props: ['spinning', 'tip'] },
  ConfigProvider: { name: 'AConfigProvider', template: '<div class="mock-config"><slot /></div>', props: ['locale'] },
  Button: { name: 'AButton', template: '<button class="mock-btn"><slot /></button>', props: ['type', 'size', 'loading', 'disabled'] },
  Tooltip: { name: 'ATooltip', template: '<div class="mock-tooltip"><slot /></div>', props: ['title', 'placement'] },
}))

describe('EsTable — 基础渲染', () => {
  const defaultProps = {
    dataSource: [
      { id: '1', name: '张三', email: 'zhang@test.com' },
      { id: '2', name: '李四', email: 'li@test.com' },
    ],
    columns: [
      { prop: 'id', label: 'ID', width: 80 },
      { prop: 'name', label: '姓名', width: 120 },
      { prop: 'email', label: '邮箱' },
    ],
    options: {} as any,
    pagination: { total: 2 },
  }

  it('正常挂载不报错', () => {
    const wrapper = mount(EsTable, { props: defaultProps })
    expect(wrapper.exists()).toBe(true)
    expect(wrapper.find('.table_component').exists()).toBe(true)
  })

  it('暴露方法存在', () => {
    const wrapper = mount(EsTable, { props: defaultProps })
    const vm = wrapper.vm as any
    expect(typeof vm.httpRequestInstance).toBe('function')
    expect(typeof vm.clearSelection).toBe('function')
    expect(typeof vm.clearAllSelection).toBe('function')
    expect(typeof vm.refresh).toBe('function')
  })

  it('column 适配 — prop→dataIndex', () => {
    const wrapper = mount(EsTable, { props: defaultProps })
    const vm = wrapper.vm as any
    // adaptedColumns 包含 dataIndex
    const cols = vm.adaptedColumns
    expect(cols).toBeTruthy()
    expect(Array.isArray(cols)).toBe(true)
    if (cols.length) {
      expect(cols[0]).toHaveProperty('dataIndex')
    }
  })

  it('snIndex 模式 → 序号列', () => {
    const wrapper = mount(EsTable, {
      props: { ...defaultProps, options: { snIndex: true } as any },
    })
    const vm = wrapper.vm as any
    const hasSnCol = vm.adaptedColumns.some((c: any) => c.dataIndex === '_sn')
    expect(hasSnCol).toBe(true)
  })

  it('操作列 → dataIndex="operate"', () => {
    const wrapper = mount(EsTable, {
      props: {
        ...defaultProps,
        columns: [
          ...defaultProps.columns,
          {
            prop: 'operate', label: '操作', width: 120,
            btns: [{ name: '编辑', clickEvent: () => {} }],
          },
        ],
      },
    })
    const vm = wrapper.vm as any
    const hasOperateCol = vm.adaptedColumns.some((c: any) => c.dataIndex === 'operate')
    expect(hasOperateCol).toBe(true)
  })

  it('hidCol → 列被过滤', () => {
    const wrapper = mount(EsTable, {
      props: {
        ...defaultProps,
        columns: [
          { prop: 'name', label: 'Name' },
          { prop: 'hidden', label: 'Hidden', hidCol: true },
        ],
      },
    })
    const vm = wrapper.vm as any
    expect(vm.adaptedColumns).toHaveLength(1)
  })
})

describe('EsTable — 分页', () => {
  const baseProps = {
    dataSource: [],
    columns: [{ prop: 'name', label: 'Name' }],
    options: {} as any,
    pagination: { current: 1, pageSize: 10, total: 100 },
  }

  it('pagination.total=undefined → 不显示分页', () => {
    const wrapper = mount(EsTable, {
      props: { ...baseProps, pagination: {} },
    })
    const vm = wrapper.vm as any
    expect(vm.showPagination).toBe(false)
  })

  it('pagination.total=50 → 显示分页', () => {
    const wrapper = mount(EsTable, {
      props: { ...baseProps, pagination: { total: 50 } },
    })
    const vm = wrapper.vm as any
    expect(vm.showPagination).toBe(true)
  })

  it('请求模式 (apiParams) + 无 total → 显示分页', () => {
    const wrapper = mount(EsTable, {
      props: {
        ...baseProps,
        options: { apiParams: { url: '/api/users' }, isInitRun: false } as any,
        pagination: { pageSize: 10 },
      },
    })
    const vm = wrapper.vm as any
    expect(vm.showPagination).toBe(true)
  })

  it('请求模式 (actionUrl) + 无 total → 显示分页', () => {
    const wrapper = mount(EsTable, {
      props: {
        ...baseProps,
        options: { actionUrl: '/api/list', isInitRun: false } as any,
        pagination: {},
      },
    })
    const vm = wrapper.vm as any
    expect(vm.showPagination).toBe(true)
  })

  it('pagination 同步 paginationConfig', async () => {
    const wrapper = mount(EsTable, {
      props: { ...baseProps, pagination: { current: 2, pageSize: 20, total: 50 } },
    })
    const vm = wrapper.vm as any
    expect(vm.paginationConfig.current).toBe(2)
    expect(vm.paginationConfig.pageSize).toBe(20)
    expect(vm.paginationConfig.total).toBe(50)
  })

  it('handleAdvPageChange → 发射事件', async () => {
    const wrapper = mount(EsTable, { props: baseProps })
    const vm = wrapper.vm as any
    vm.handleAdvPageChange(3)
    await nextTick()
    expect(wrapper.emitted('update:pagination')).toBeTruthy()
  })
})

describe('EsTable — 滚动与列宽铺满', () => {
  it('无固定列 → 不设 scroll.x，让表格铺满容器', () => {
    const wrapper = mount(EsTable, {
      props: {
        dataSource: [],
        columns: [
          { prop: 'name', label: '姓名', width: 120 },
          { prop: 'addr', label: '地址', minWidth: 150 },
        ],
        options: {} as any,
        pagination: {},
      },
    })
    const vm = wrapper.vm as any
    expect(vm.hasFixedColumn).toBe(false)
    expect(vm.tableScroll?.x).toBeUndefined()
  })

  it('有固定列 → 设 scroll.x=max-content 支持固定列', () => {
    const wrapper = mount(EsTable, {
      props: {
        dataSource: [],
        columns: [
          { prop: 'name', label: '姓名', fixed: 'left' },
          { prop: 'addr', label: '地址' },
        ],
        options: {} as any,
        pagination: {},
      },
    })
    const vm = wrapper.vm as any
    expect(vm.hasFixedColumn).toBe(true)
    expect(vm.tableScroll?.x).toBe('max-content')
  })
})

describe('EsTable — 选择 (multiSelect)', () => {
  const baseProps = {
    dataSource: [{ id: '1', name: 'A' }, { id: '2', name: 'B' }],
    columns: [{ prop: 'name', label: 'Name' }],
    options: { multiSelect: true, rowkey: 'id' } as any,
    pagination: { total: 2 },
  }

  it('multiSelect=true → rowSelection 配置存在', () => {
    const wrapper = mount(EsTable, { props: baseProps })
    const vm = wrapper.vm as any
    expect(vm.rowSelection).toBeTruthy()
    const config = vm.rowSelection
    expect(config).toHaveProperty('selectedRowKeys')
    expect(config).toHaveProperty('preserveSelectedRowKeys', true)
    expect(typeof config.onChange).toBe('function')
  })

  it('暴露方法 clearSelection → 清除 selectedRowKeys', () => {
    const wrapper = mount(EsTable, { props: baseProps })
    const vm = wrapper.vm as any
    vm.clearSelection()
    const config = vm.rowSelection
    expect(config.selectedRowKeys).toEqual([])
  })

  it("columns 中 type:'selection' → 等价 multiSelect：启用 rowSelection 且不生成空列", () => {
    const wrapper = mount(EsTable, {
      props: {
        dataSource: [{ id: '1', name: 'A' }, { id: '2', name: 'B' }],
        columns: [
          { type: 'selection', width: 50 },
          { prop: 'name', label: 'Name' },
        ],
        options: { rowkey: 'id' } as any,
        pagination: { total: 2 },
      },
    })
    const vm = wrapper.vm as any
    // hasSelection 由 selection 列触发
    expect(vm.hasSelection).toBe(true)
    // rowSelection 配置存在，并把列宽/对齐合并进去
    const config = vm.resolvedRowSelection
    expect(config).toHaveProperty('selectedRowKeys')
    expect(config.columnWidth).toBe(50)
    // adaptedColumns 不含空 dataIndex 的 selection 列
    const cols = vm.adaptedColumns as any[]
    expect(cols.every((c) => c.dataIndex !== 'selection')).toBe(true)
    expect(cols.some((c) => c.dataIndex === 'name')).toBe(true)
  })

  it("type:'selection' 同时设 options.multiSelect → 不重复", () => {
    const wrapper = mount(EsTable, {
      props: {
        dataSource: [{ id: '1', name: 'A' }],
        columns: [{ type: 'selection', width: 55 }, { prop: 'name', label: 'Name' }],
        options: { multiSelect: true, rowkey: 'id' } as any,
        pagination: { total: 1 },
      },
    })
    const vm = wrapper.vm as any
    expect(vm.hasSelection).toBe(true)
    const cols = vm.adaptedColumns as any[]
    expect(cols.filter((c) => c.dataIndex === 'selection')).toHaveLength(0)
    expect(cols).toHaveLength(1)
  })
})

/**
 * AN-09 —— 前置列合成（与 vue3 / vue2 同一判据，ADV 的差异在消费者）。
 *
 * ADV 的两处差异是**语义**而不是漂移：选择列由 `rowSelection` 渲染、展开列由
 * `expandedRowRender` 整行渲染，二者都不进 `adaptedColumns`。序号列是三端共有的
 * 数据列，因此它必须：(1) 走 core 默认值（title `#` / width 60 / center），
 * (2) 排在最前，(3) 显式 `type:'index'` 时不被重复注入。
 */
describe('EsTable — AN-09 前置列合成', () => {
  const baseProps = {
    dataSource: [{ id: '1', name: 'A' }],
    columns: [{ prop: 'name', label: 'Name' }],
    pagination: { total: 1 },
  }
  const colsOf = (options: any, columns?: any[]) => {
    const wrapper = mount(EsTable, {
      props: { ...baseProps, columns: columns ?? baseProps.columns, options },
    })
    return (wrapper.vm as any).adaptedColumns as any[]
  }

  it('snIndex → 序号列取 core 默认（title # / width 60 / center）', () => {
    const cols = colsOf({ snIndex: true })
    expect(cols[0]).toMatchObject({ dataIndex: '_sn', title: '#', width: 60, align: 'center' })
    expect(typeof cols[0].customRender).toBe('function')
  })

  it('multiSelect + snIndex → 序号列仍在首位（选择不进列集合）', () => {
    const cols = colsOf({ multiSelect: true, snIndex: true, rowkey: 'id' })
    expect(cols[0]).toMatchObject({ dataIndex: '_sn' })
    expect(cols.map((c) => c.dataIndex)).toEqual(['_sn', 'name'])
  })

  it("显式 type:'index' 列 + options.snIndex → 只保留显式那条（不重复）", () => {
    const cols = colsOf({ snIndex: true }, [{ type: 'index', width: 70 }, { prop: 'name', label: 'Name' }])
    const sn = cols.filter((c) => c.dataIndex === '_sn')
    expect(sn).toHaveLength(1)
    // 显式列的 width 覆盖默认值（默认值只兜底）
    expect(sn[0].width).toBe(70)
  })

  // 回归：判据必须看**原始列**（core `synthesizeLeadingColumns` 的 @param 明写
  // 「原始列（未做权限/隐藏过滤）」；vue3/vue2 传的都是 columnRowList.value）。
  // ADV 此前把 filteredColumns 传进去 → 被 hidCol / 权限筛掉的 type:'index' 列
  // 不再「算作已声明」，于是又合成一条默认序号列 —— 用户的隐藏/拒绝被合成列推翻。
  it('hidCol 的 type:index 列仍算已声明 → 不再合成默认序号列', () => {
    const cols = colsOf({ snIndex: true }, [{ type: 'index', hidCol: true }, { prop: 'name', label: 'Name' }])
    expect(cols.filter((c) => c.dataIndex === '_sn')).toHaveLength(0)
    expect(cols.map((c) => c.dataIndex)).toEqual(['name'])
  })

  it('无权限的 type:index 列不得被合成列「复活」（权限未被绕过）', async () => {
    const { configureEsPlus, resetGlobalConfig } = await import('@es-plus/core')
    try {
      configureEsPlus({ permission: (v: string) => v !== 'sn:view' })
      const cols = colsOf({ snIndex: true }, [
        { type: 'index', permissionValue: 'sn:view' },
        { prop: 'name', label: 'Name' },
      ])
      expect(cols.filter((c) => c.dataIndex === '_sn')).toHaveLength(0)
      expect(cols.map((c) => c.dataIndex)).toEqual(['name'])
    } finally {
      resetGlobalConfig()
    }
  })
})

describe('EsTable — 暴露的实例方法', () => {
  const baseProps = {
    dataSource: [],
    columns: [{ prop: 'name', label: 'Name' }],
    options: {} as any,
    pagination: { total: 0 },
  }

  it('httpRequestInstance — 无 action/apiParams → 不请求', async () => {
    const wrapper = mount(EsTable, { props: baseProps })
    const vm = wrapper.vm as any
    const result = vm.httpRequestInstance()
    expect(result).toBeInstanceOf(Promise)
    // 无 url/apiParams 时内部 fail(...) 会拒绝该 Promise。必须在此显式 await 捕获，
    // 否则拒绝逃逸为 Unhandled Rejection，导致 vitest 整轮退出码 1（三端无法同批全绿）。
    await expect(result).rejects.toThrow()
  })

  it('httpRequestInstance — 裸数组响应直接作为表格数据（回归：此前渲染空表）', async () => {
    const httpRequest = vi.fn().mockResolvedValue([{ id: 1 }, { id: 2 }])
    const wrapper = mount(EsTable, {
      props: {
        ...baseProps,
        options: { httpRequest, apiParams: { url: '/api/list' }, isInitRun: false } as any
      }
    })
    const vm = wrapper.vm as any
    await vm.httpRequestInstance()
    expect(vm.tableData).toHaveLength(2)
    expect(vm.tableData[0]).toEqual({ id: 1 })
  })

  it('httpRequestInstance — 空/undefined 响应仍 settle（回归：此前永久挂起）', async () => {
    const httpRequest = vi.fn().mockResolvedValue(undefined)
    const wrapper = mount(EsTable, {
      props: {
        ...baseProps,
        options: { httpRequest, apiParams: { url: '/api/list' }, isInitRun: false } as any
      }
    })
    const vm = wrapper.vm as any
    const outcome = await Promise.race([
      vm.httpRequestInstance().then(() => 'settled'),
      new Promise((r) => setTimeout(() => r('timeout'), 300))
    ])
    expect(outcome).toBe('settled')
  })

  it('getSelectionRows — 返回数组', () => {
    const wrapper = mount(EsTable, { props: baseProps })
    const vm = wrapper.vm as any
    const rows = vm.getSelectionRows()
    expect(Array.isArray(rows)).toBe(true)
  })

  it('refresh — 不抛异常（无url时不发起请求）', () => {
    const wrapper = mount(EsTable, { props: baseProps })
    const vm = wrapper.vm as any
    // refresh 调用 httpRequestInstance, 无 url/apiParams 时不应抛错
    expect(() => vm.refresh()).not.toThrow()
  })
})

describe('EsTable — refresh/reload/refetchKeepPage 语义（对齐 vue3）', () => {
  // 请求模式挂载：注入内存 httpRequest，捕获每次请求的 pageIndex。
  // isInitRun:false 关掉 onMounted 自动首拉，避免污染 current 初值（否则默认分支挂载即回 1）。
  const makeReqProps = (opts: Record<string, any> = {}, pagination: Record<string, any> = {}) => {
    const calls: any[] = []
    const httpRequest = vi.fn(async (params: any) => {
      calls.push(params)
      return { records: 100, rows: [{ id: `r${params.pageIndex}` }] }
    })
    const props = {
      dataSource: [] as any[],
      columns: [{ prop: 'id', label: 'ID' }],
      options: { httpRequest, isInitRun: false, ...opts } as any,
      pagination: { current: 3, pageSize: 10, total: 100, ...pagination },
    }
    return { props, httpRequest, calls }
  }

  it('新增暴露 reload / doLayout 方法', () => {
    const { props } = makeReqProps()
    const vm = mount(EsTable, { props }).vm as any
    expect(typeof vm.reload).toBe('function')
    expect(typeof vm.doLayout).toBe('function')
    expect(typeof vm.refresh).toBe('function')
  })

  it('默认（无 refetchKeepPage）：httpRequestInstance 回到第 1 页', async () => {
    const { props, calls } = makeReqProps()
    const vm = mount(EsTable, { props }).vm as any
    expect(vm.paginationConfig.current).toBe(3)
    await vm.httpRequestInstance()
    expect(vm.paginationConfig.current).toBe(1)
    expect(calls[calls.length - 1].pageIndex).toBe(1)
  })

  it('refetchKeepPage:true：httpRequestInstance 保留当前页', async () => {
    const { props, calls } = makeReqProps({ refetchKeepPage: true })
    const vm = mount(EsTable, { props }).vm as any
    expect(vm.paginationConfig.current).toBe(3)
    await vm.httpRequestInstance()
    expect(vm.paginationConfig.current).toBe(3)
    expect(calls[calls.length - 1].pageIndex).toBe(3)
  })

  it('keepPage:false 显式覆盖 refetchKeepPage（查询语义回第 1 页）', async () => {
    const { props, calls } = makeReqProps({ refetchKeepPage: true })
    const vm = mount(EsTable, { props }).vm as any
    await vm.httpRequestInstance({}, { keepPage: false })
    expect(vm.paginationConfig.current).toBe(1)
    expect(calls[calls.length - 1].pageIndex).toBe(1)
  })

  it('reload 回第 1 页取数；refresh 保留当前页取数', async () => {
    const { props, calls } = makeReqProps()
    const vm = mount(EsTable, { props }).vm as any
    // refresh：keepPage:true → 停留第 3 页
    await vm.refresh()
    expect(vm.paginationConfig.current).toBe(3)
    expect(calls[calls.length - 1].pageIndex).toBe(3)
    // reload：回到第 1 页
    await vm.reload()
    expect(vm.paginationConfig.current).toBe(1)
    expect(calls[calls.length - 1].pageIndex).toBe(1)
  })
})

describe('EsTable — EDGE CASES', () => {
  it('空 dataSource', () => {
    const wrapper = mount(EsTable, {
      props: {
        dataSource: [],
        columns: [{ prop: 'name', label: 'Name' }],
        options: {} as any,
        pagination: {},
      },
    })
    expect(wrapper.exists()).toBe(true)
  })

  it('空 columns', () => {
    const wrapper = mount(EsTable, {
      props: {
        dataSource: [{ id: '1' }],
        columns: [],
        options: {} as any,
        pagination: {},
      },
    })
    expect(wrapper.exists()).toBe(true)
  })

  it('所有列 hidCol → adaptedColumns 为空', () => {
    const wrapper = mount(EsTable, {
      props: {
        dataSource: [{ id: '1' }],
        columns: [
          { prop: 'a', label: 'A', hidCol: true },
          { prop: 'b', label: 'B', hidCol: true },
        ],
        options: {} as any,
        pagination: {},
      },
    })
    const vm = wrapper.vm as any
    expect(vm.adaptedColumns).toHaveLength(0)
  })
})

describe('EsTable — 内建客户端分页 (localPagination)', () => {
  const makeData = (n: number) =>
    Array.from({ length: n }, (_, i) => ({ id: String(i + 1), name: `姓名${i + 1}` }))
  const columns = [
    { prop: 'id', label: 'ID' },
    { prop: 'name', label: '姓名' },
  ]

  it('切当前页：displayDataSource 只返回当前页数据，total 回填全量长度', async () => {
    const wrapper = mount(EsTable, {
      props: {
        dataSource: makeData(25),
        columns,
        options: { localPagination: true } as any,
        pagination: { pageSize: 10 },
      },
    })
    await nextTick()
    const vm = wrapper.vm as any
    expect(vm.displayDataSource).toHaveLength(10)
    expect(vm.displayDataSource[0].id).toBe('1')
    expect(vm.paginationConfig.total).toBe(25)
    expect(vm.showPagination).toBe(true)
  })

  it('翻页：current 变化后 displayDataSource 切到对应页', async () => {
    const wrapper = mount(EsTable, {
      props: {
        dataSource: makeData(25),
        columns,
        options: { localPagination: true } as any,
        pagination: { pageSize: 10 },
      },
    })
    await nextTick()
    const vm = wrapper.vm as any
    vm.paginationConfig.current = 3
    await nextTick()
    // 第三页只剩 5 条
    expect(vm.displayDataSource).toHaveLength(5)
    expect(vm.displayDataSource[0].id).toBe('21')
  })

  it('边界回收：数据缩短使当前页越界时回退到最后有效页', async () => {
    const wrapper = mount(EsTable, {
      props: {
        dataSource: makeData(25),
        columns,
        options: { localPagination: true } as any,
        pagination: { pageSize: 10 },
      },
    })
    await nextTick()
    const vm = wrapper.vm as any
    vm.paginationConfig.current = 3
    await nextTick()
    // 数据缩短到 8 条，只有 1 页
    await wrapper.setProps({ dataSource: makeData(8) })
    await nextTick()
    expect(vm.paginationConfig.total).toBe(8)
    expect(vm.paginationConfig.current).toBe(1)
    expect(vm.displayDataSource).toHaveLength(8)
  })

  it('请求模式下不启用本地分页（displayDataSource 不切片）', async () => {
    const wrapper = mount(EsTable, {
      props: {
        dataSource: makeData(25),
        columns,
        options: { localPagination: true, actionUrl: '/api/list' } as any,
        pagination: { pageSize: 10 },
      },
    })
    await nextTick()
    const vm = wrapper.vm as any
    expect(vm.isLocalPagination).toBe(false)
    // 请求模式 tableData 为空 → 回退到全量 dataSource（不切片）
    expect(vm.displayDataSource).toHaveLength(25)
  })
})

// 回归：并发分页请求竞态（此前用全局 loadingStatus 当互斥锁，在途请求直接 fail，
// 且 handleAdvPageChange 先改页码再发请求 → 快速翻页时旧页数据覆盖/误报 request-error）
describe('EsTable — 并发分页请求竞态', () => {
  const deferred = <T = unknown>() => {
    let resolve!: (value: T) => void
    let reject!: (reason?: unknown) => void
    const promise = new Promise<T>((res, rej) => {
      resolve = res
      reject = rej
    })
    return { promise, resolve, reject }
  }

  const mountRaceTable = (pagination: Record<string, any> = { current: 1, pageSize: 10, total: 100 }) => {
    const pending: Array<{ opts: any; d: ReturnType<typeof deferred> }> = []
    const httpRequest = vi.fn((params: any) => {
      const d = deferred()
      pending.push({ opts: params, d })
      return d.promise
    })
    const wrapper = mount(EsTable, {
      props: {
        dataSource: [],
        columns: [{ prop: 'name', label: 'Name' }],
        options: {
          isInitRun: false,
          httpRequest,
          apiParams: { url: '/api/list' },
          configTableOut: { total: 'records', tableData: 'rows' },
        } as any,
        pagination,
      },
    })
    return { wrapper, httpRequest, pending }
  }

  const emitPageChange = async (wrapper: any, page: number) => {
    await wrapper.findComponent({ name: 'APagination' }).vm.$emit('change', page)
    await nextTick()
  }

  it('快速翻页：被淘汰请求的响应静默丢弃，只有最新页写入数据', async () => {
    const { wrapper, httpRequest, pending } = mountRaceTable()
    await flushPromises()
    expect(httpRequest).not.toHaveBeenCalled()

    await emitPageChange(wrapper, 2)
    await emitPageChange(wrapper, 3)

    // 旧实现第二发会被 loadingStatus 锁挡掉；修复后两次请求都应发出
    expect(httpRequest).toHaveBeenCalledTimes(2)
    const req2 = pending.find((p) => p.opts.pageIndex === 2)
    const req3 = pending.find((p) => p.opts.pageIndex === 3)
    expect(req2, '第 2 页请求应发出').toBeTruthy()
    expect(req3, '第 3 页请求应发出').toBeTruthy()

    // 旧页先返回 → 不得写入，也不得触发 request-error
    req2!.d.resolve({ records: 100, rows: [{ name: 'stale-page-2' }] })
    await flushPromises()
    expect(wrapper.emitted('request-error')).toBeFalsy()
    expect((wrapper.vm as any).requestError).toBeFalsy()

    // 最新页返回 → 写入
    req3!.d.resolve({ records: 100, rows: [{ name: 'latest-page-3' }] })
    await flushPromises()
    const updates = wrapper.emitted('update:dataSource') as any[]
    expect(updates.length).toBeGreaterThan(0)
    const latest = updates[updates.length - 1][0]
    expect(latest).toHaveLength(1)
    expect(latest[0].name).toBe('latest-page-3')
  })

  it('被淘汰请求失败静默丢弃，不触发 request-error', async () => {
    const { wrapper, pending } = mountRaceTable()
    await flushPromises()

    await emitPageChange(wrapper, 2)
    await emitPageChange(wrapper, 3)

    const req2 = pending.find((p) => p.opts.pageIndex === 2)
    const req3 = pending.find((p) => p.opts.pageIndex === 3)
    req2!.d.reject(new Error('stale page failed'))
    await flushPromises()

    expect(wrapper.emitted('request-error'), '旧请求失败不应暴露').toBeFalsy()
    expect((wrapper.vm as any).requestError).toBeFalsy()

    // 最新请求仍能正常写入
    req3!.d.resolve({ records: 100, rows: [{ name: 'latest-page-3' }] })
    await flushPromises()
    const updates = wrapper.emitted('update:dataSource') as any[]
    expect(updates[updates.length - 1][0][0].name).toBe('latest-page-3')
  })

  it('最新请求失败仍按原有行为触发 request-error', async () => {
    const { wrapper, pending } = mountRaceTable()
    await flushPromises()

    await emitPageChange(wrapper, 2)
    const req2 = pending.find((p) => p.opts.pageIndex === 2)!
    req2.d.reject(new Error('latest failed'))
    await flushPromises()

    expect(wrapper.emitted('request-error'), '最新请求失败应暴露').toBeTruthy()
    expect((wrapper.vm as any).requestError).toBeTruthy()
  })

  it('边界回退的递归请求不被序号机制误杀（keepPage 空页回退后取到有效页数据）', async () => {
    const { wrapper, pending } = mountRaceTable({ current: 20, pageSize: 10, total: 100 })
    await flushPromises()

    const refreshPromise = (wrapper.vm as any).refresh()
    await nextTick()
    expect(pending).toHaveLength(1)

    // 首个 keepPage 请求返回空 → 递归回退到 maxPage=10
    pending[0].d.resolve({ records: 100, rows: [] })
    await flushPromises()
    expect(pending, '回退应发起第二次请求').toHaveLength(2)
    expect(pending[1].opts.pageIndex).toBe(10)

    pending[1].d.resolve({ records: 100, rows: [{ name: 'page-10' }] })
    await refreshPromise
    await flushPromises()

    const updates = wrapper.emitted('update:dataSource') as any[]
    const latest = updates[updates.length - 1][0]
    expect(latest[0].name).toBe('page-10')
    expect(wrapper.emitted('request-error')).toBeFalsy()
  })
})

// 回归：列级 permissionValue 此前 schema+prompt+scorer 都认，组件 filteredColumns 却只按 hidCol
// 过滤 → 无权限的列照样渲染（假承诺）。接线后应与 hidCol 同层被过滤。
describe('EsTable(ADV) - 列级 permissionValue 门控', () => {
  const gateProps = () => ({
    dataSource: [],
    columns: [
      { prop: 'id', label: 'ID', width: 80 },
      { prop: 'salary', label: '工资', permissionValue: 'salary:view' },
    ],
    options: {} as any,
    pagination: { total: 0 },
  })

  it('无权限的列不渲染，有权限的列正常渲染', async () => {
    const { configureEsPlus, resetGlobalConfig } = await import('@es-plus/core')
    try {
      configureEsPlus({ permission: (v: string) => v !== 'salary:view' })
      const wrapper = mount(EsTable, { props: gateProps() })
      await nextTick()
      const vm = wrapper.vm as any
      expect(vm.adaptedColumns.map((c: any) => c.dataIndex)).toEqual(['id'])
    } finally {
      resetGlobalConfig()
    }
  })

  it('未配置全局 permission 时一律放行', async () => {
    const wrapper = mount(EsTable, { props: gateProps() })
    await nextTick()
    const vm = wrapper.vm as any
    expect(vm.adaptedColumns).toHaveLength(2)
  })
})

// ── 尺寸契约：number | string 都必须是真能力（三端同规）──────────────────────
describe('EsTable(antdv) — 尺寸契约 number | string', () => {
  const heightOf = (options: Record<string, unknown>) => {
    const wrapper = mount(EsTable, {
      props: {
        dataSource: [],
        columns: [{ prop: 'id', label: 'ID', width: 80 }],
        options: options as any,
        pagination: { total: 0 },
      },
    })
    return (wrapper.find('.table_component').element as HTMLElement).style.height
  }

  it('height：数字 / 纯数字字符串 / px 字符串等价', () => {
    expect(heightOf({ heightType: 'height', height: 420 })).toBe('420px')
    expect(heightOf({ heightType: 'height', height: '420' })).toBe('420px')
    expect(heightOf({ heightType: 'height', height: '420px' })).toBe('420px')
  })

  it('tabHeight：字符串被采纳（旧实现静默忽略）且优先于 height', () => {
    expect(heightOf({ heightType: 'height', height: 420, tabHeight: '40px' })).toBe('40px')
  })

  it('百分比等带单位字符串原样透传', () => {
    expect(heightOf({ heightType: 'height', height: '70vh' })).toBe('70vh')
  })
})

describe('EsTable(ADV) — AN-10 列选项（省略号 / 默认排序）', () => {
  const colsOf = (options: any, columns: any[]) => {
    const wrapper = mount(EsTable, {
      props: { dataSource: [{ id: '1', name: 'A' }], columns, options, pagination: { total: 1 } },
    })
    return (wrapper.vm as any).adaptedColumns as any[]
  }

  it('契约键 ellipsis → 列 ellipsis（a-table 的 CSS 截断 + 原生 title）', () => {
    const cols = colsOf({}, [{ prop: 'name', label: 'Name', ellipsis: true }])
    expect(cols[0].ellipsis).toBe(true)
  })

  it('存量写法 showOverflowTooltip 一并认（老配置换端不静默失效）', () => {
    const cols = colsOf({}, [{ prop: 'name', label: 'Name', showOverflowTooltip: true } as any])
    expect(cols[0].ellipsis).toBe(true)
  })

  it('未设置省略号 → 不发 ellipsis（不制造默认截断）', () => {
    const cols = colsOf({}, [{ prop: 'name', label: 'Name' }])
    expect(cols[0].ellipsis).toBeUndefined()
  })

  it('ellipsis + formatter 可叠加：formatter 仍落 customRender（不再被省略号分支吞掉）', () => {
    const cols = colsOf({}, [
      { prop: 'name', label: 'Name', ellipsis: true, formatter: (row: any) => `#${row.name}` },
    ])
    expect(cols[0].ellipsis).toBe(true)
    expect(typeof cols[0].customRender).toBe('function')
    // formatter 真的被调用（此前 a-tooltip 分支直接吐原始 text，绕过它）
    expect(cols[0].customRender({ text: 'A', record: { name: 'A' } })).toBe('#A')
  })

  it('defaultSort → 目标列 defaultSortOrder（a-table 无整表 prop）', () => {
    const cols = colsOf(
      { defaultSort: { prop: 'name', order: 'descending' } },
      [
        { prop: 'name', label: 'Name', sortable: true },
        { prop: 'other', label: 'Other' },
      ],
    )
    expect(cols[0].defaultSortOrder).toBe('descend')
    // 别的列不沾默认排序状态
    expect(cols[1].defaultSortOrder).toBeUndefined()
  })

  it('ascending → ascend', () => {
    const cols = colsOf(
      { defaultSort: { prop: 'name', order: 'ascending' } },
      [{ prop: 'name', label: 'Name', sortable: true }],
    )
    expect(cols[0].defaultSortOrder).toBe('ascend')
  })

  it('目标列不可排序 → 不落 defaultSortOrder（antd 同样静默忽略，也不硬塞 sorter）', () => {
    const cols = colsOf(
      { defaultSort: { prop: 'name', order: 'descending' } },
      [{ prop: 'name', label: 'Name' }],
    )
    expect(cols[0].defaultSortOrder).toBeUndefined()
    expect(cols[0].sorter).toBeUndefined()
  })

  it('defaultSort 指向不存在的列 → 静默跳过，不抛错', () => {
    expect(() =>
      colsOf(
        { defaultSort: { prop: 'nope', order: 'descending' } },
        [{ prop: 'name', label: 'Name', sortable: true }],
      ),
    ).not.toThrow()
  })
})

/**
 * AN-11⑥ —— `<es-table @row-click>` 在 ADV 端此前是**死监听**。
 *
 * a-table 没有 `row-click` 事件：行点击只能经 `customRow` 返回的 `onClick` 挂。
 * 之前 `onRowClick` 被当普通 attr 绑到 a-table 上（永不触发），与 vue3/vue2
 * （原生事件透传）结构性不一致。
 */
describe('EsTable — AN-11⑥ row-click → customRow', () => {
  const baseProps = {
    dataSource: [{ id: '1', name: '张三' }],
    columns: [{ prop: 'name', label: '姓名' }],
    options: {} as any,
    pagination: { total: 1 },
  }
  const findTable = (wrapper: any) => wrapper.findComponent({ name: 'ATable' })

  it('父级 @row-click → a-table customRow 的 onClick 真的回调', () => {
    const onRowClick = vi.fn()
    const wrapper = mount(EsTable, { props: baseProps, attrs: { onRowClick } })
    const customRow = findTable(wrapper).props('customRow')
    expect(typeof customRow).toBe('function')
    const rowProps = customRow({ id: '1', name: '张三' }, 0)
    expect(typeof rowProps.onClick).toBe('function')
    rowProps.onClick(new Event('click'))
    expect(onRowClick).toHaveBeenCalledTimes(1)
    expect(onRowClick.mock.calls[0][0]).toEqual({ id: '1', name: '张三' })
    expect(onRowClick.mock.calls[0][1]).toBe(0)
  })

  it('无监听且无 rowStyle/highlight 时 customRow 仍为 undefined（不无谓给每行挂监听）', () => {
    const wrapper = mount(EsTable, {
      props: { ...baseProps, options: { highlightCurrentRow: false } as any },
    })
    expect(findTable(wrapper).props('customRow')).toBeUndefined()
  })

  it('highlightCurrentRow 与 row-click 共用同一个 onClick（两件事都发生）', () => {
    const onRowClick = vi.fn()
    const wrapper = mount(EsTable, {
      props: { ...baseProps, options: { highlightCurrentRow: true } as any },
      attrs: { onRowClick },
    })
    const customRow = findTable(wrapper).props('customRow')
    customRow({ id: '1' }, 0).onClick(new Event('click'))
    expect(onRowClick).toHaveBeenCalledTimes(1)
    // 高亮内部状态真的被写进去（component.vue 的 currentRowKey）
    expect((wrapper.vm as any).currentRowKey).toBe('1')
  })
})
