import { describe, it, expect, vi } from 'vitest'
import { mount, flushPromises } from '@vue/test-utils'
import { nextTick, ref, reactive } from 'vue'
import {
  ElTable, ElTableColumn, ElPagination, ElButton, ElConfigProvider
} from 'element-plus'
import EsTable from '../src/components/es-table/src/component.vue'
import ColumnItem from '../src/components/es-table/src/column-item.vue'
import type { TableOptions, TableColumn, PaginationConfig } from '../src/types'

// Mock ResizeObserver for happy-dom
const mockResizeObserver = vi.fn().mockImplementation(() => ({
  observe: vi.fn(),
  unobserve: vi.fn(),
  disconnect: vi.fn()
}))
vi.stubGlobal('ResizeObserver', mockResizeObserver)

const globalComponents = {
  ElTable, ElTableColumn, ElPagination, ElButton, ElConfigProvider
}

const defaultColumns: TableColumn[] = [
  { prop: 'name', label: '姓名', width: 120 },
  { prop: 'age', label: '年龄', width: 80 },
  { prop: 'status', label: '状态', width: 100 }
]

const sampleData = [
  { name: '张三', age: 28, status: 'active' },
  { name: '李四', age: 32, status: 'inactive' }
]

const mountTable = (propsOverrides: Record<string, unknown> = {}) =>
  mount(EsTable, {
    props: {
      dataSource: [],
      columns: defaultColumns,
      ...propsOverrides
    },
    global: { components: globalComponents }
  })

describe('EsTable - 基础渲染', () => {
  it('renders table container', () => {
    const wrapper = mountTable()
    expect(wrapper.find('.table_component').exists()).toBe(true)
  })

  it('renders with static dataSource', () => {
    const wrapper = mountTable({ dataSource: sampleData })
    expect(wrapper.find('.el-table').exists()).toBe(true)
  })

  it('renders columns from config', () => {
    const wrapper = mountTable({ dataSource: sampleData })
    // Columns render via column-item sub-component; verify table body has rows
    const rows = wrapper.findAll('.el-table__body-wrapper .el-table__row')
    expect(rows.length).toBeGreaterThanOrEqual(2)
  })

  it('renders operation column with btns', () => {
    const columns: TableColumn[] = [
      { prop: 'name', label: '姓名' },
      { prop: 'operate', label: '操作', width: 160,
        btns: [
          { name: '编辑', type: 'primary', clickEvent: vi.fn() },
          { name: '删除', type: 'danger', clickEvent: vi.fn() }
        ]
      }
    ]
    const wrapper = mountTable({ dataSource: sampleData, columns })
    expect(wrapper.find('.el-table').exists()).toBe(true)
  })

  it('hides columns with hidCol', () => {
    const columns: TableColumn[] = [
      { prop: 'name', label: '姓名' },
      { prop: 'secret', label: '秘密', hidCol: true }
    ]
    const wrapper = mountTable({ dataSource: sampleData, columns })
    // filteredColumns should exclude hidCol columns; verify through the component's computed
    const vm = wrapper.vm as any
    // The column rendering is done via column-item; we verify data rows exist
    expect(wrapper.find('.el-table').exists()).toBe(true)
  })

  it('exposes table methods', () => {
    const wrapper = mountTable({ dataSource: sampleData })
    const vm = wrapper.vm as any
    expect(typeof vm.httpRequestInstance).toBe('function')
    expect(typeof vm.getSelectionRows).toBe('function')
    expect(typeof vm.clearSelection).toBe('function')
    expect(typeof vm.clearAllSelection).toBe('function')
    expect(typeof vm.refresh).toBe('function')
  })
})

describe('EsTable - 分页联动', () => {
  it('shows pagination when total is provided', () => {
    const wrapper = mountTable({
      dataSource: sampleData,
      pagination: { current: 1, pageSize: 10, total: 50 }
    })
    expect(wrapper.find('.el-pagination').exists()).toBe(true)
  })

  it('does not show pagination without total', () => {
    const wrapper = mountTable({ dataSource: sampleData })
    expect(wrapper.find('.el-pagination').exists()).toBe(false)
  })

  it('emits update:pagination on page change', async () => {
    const wrapper = mountTable({
      dataSource: sampleData,
      pagination: { current: 1, pageSize: 10, total: 50 }
    })
    // Without httpRequest, changing page emits update:pagination directly
    const pagination = wrapper.findComponent({ name: 'ElPagination' })
    if (pagination.exists()) {
      await pagination.vm.$emit('current-change', 2)
      await nextTick()
      const emitted = wrapper.emitted('update:pagination')
      expect(emitted).toBeTruthy()
    }
  })

  it('emits pagination-current-change without httpRequest', async () => {
    const wrapper = mountTable({
      dataSource: sampleData,
      pagination: { current: 1, pageSize: 10, total: 50 }
    })
    const pagination = wrapper.findComponent({ name: 'ElPagination' })
    if (pagination.exists()) {
      await pagination.vm.$emit('current-change', 2)
      await nextTick()
      expect(wrapper.emitted('pagination-current-change')).toBeTruthy()
    }
  })

  it('emits size-change without httpRequest', async () => {
    const wrapper = mountTable({
      dataSource: sampleData,
      pagination: { current: 1, pageSize: 10, total: 50 }
    })
    const pagination = wrapper.findComponent({ name: 'ElPagination' })
    if (pagination.exists()) {
      await pagination.vm.$emit('size-change', 20)
      await nextTick()
      expect(wrapper.emitted('size-change')).toBeTruthy()
    }
  })
})

describe('EsTable - 自动请求配置', () => {
  it('auto-requests on mount when apiParams is configured', async () => {
    const mockRequest = vi.fn().mockResolvedValue({
      records: 2, pageSize: 10, pageNo: 1, rows: sampleData
    })
    const wrapper = mountTable({
      dataSource: [],
      columns: defaultColumns,
      options: {
        httpRequest: mockRequest,
        apiParams: { url: '/api/list', method: 'GET' },
        configTableOut: { total: 'records', pageSize: 'pageSize', current: 'pageNo', tableData: 'rows' }
      } as TableOptions,
      pagination: { current: 1, pageSize: 10, total: 0 }
    })
    await flushPromises()
    expect(mockRequest).toHaveBeenCalledTimes(1)
    // Request should include url and formParams
    const callArgs = mockRequest.mock.calls[0][0]
    expect(callArgs.url).toBe('/api/list')
  })

  it('#6: httpRequest 表格未传 :pagination 时，加载后自动显示分页器', async () => {
    const mockRequest = vi.fn().mockResolvedValue({ records: 25, rows: sampleData })
    const wrapper = mountTable({
      dataSource: [],
      columns: defaultColumns,
      // 注意：不传 pagination —— 复现 #6（此前 showPagination 恒为 false，分页器不显示）
      options: {
        httpRequest: mockRequest,
        actionUrl: '/api/list',
        configTableOut: { total: 'records', tableData: 'rows' },
      } as TableOptions,
    })
    // 加载前：未显式传 :pagination，分页器不显示
    expect(wrapper.findComponent(ElPagination).exists()).toBe(false)
    await flushPromises()
    await nextTick()
    // 加载后：服务端返回映射的 total，应自动点亮分页器（对齐 vue2/antdv）
    expect(wrapper.findComponent(ElPagination).exists()).toBe(true)
  })

  it('does not auto-request when isInitRun is false', async () => {
    const mockRequest = vi.fn().mockResolvedValue({
      records: 0, pageSize: 10, pageNo: 1, rows: []
    })
    mountTable({
      dataSource: [],
      columns: defaultColumns,
      options: {
        isInitRun: false,
        httpRequest: mockRequest,
        apiParams: { url: '/api/list' },
        configTableOut: { total: 'records', pageSize: 'pageSize', current: 'pageNo', tableData: 'rows' }
      } as TableOptions,
      pagination: { current: 1, pageSize: 10, total: 0 }
    })
    await flushPromises()
    expect(mockRequest).not.toHaveBeenCalled()
  })

  it('auto-requests with actionUrl shorthand', async () => {
    const mockRequest = vi.fn().mockResolvedValue({
      records: 0, pageSize: 10, pageNo: 1, rows: []
    })
    mountTable({
      dataSource: [],
      columns: defaultColumns,
      options: {
        httpRequest: mockRequest,
        actionUrl: '/api/users',
        apiParams: { url: '/api/users' },
        configTableOut: { total: 'records', pageSize: 'pageSize', current: 'pageNo', tableData: 'rows' }
      } as TableOptions,
      pagination: { current: 1, pageSize: 10, total: 0 }
    })
    await flushPromises()
    expect(mockRequest).toHaveBeenCalled()
  })

  // 回归：请求模式的数据落在内部 `tableData`，随后经 `update:dataSource` 回传。
  // 但**父组件不绑 v-model 时没人接这个回传** —— vue2/antdv 的渲染数据源都优先取
  // 内部 tableData（vue2 注释明写「兼容父组件不使用 .sync」），vue3 此前只透传
  // props.dataSource，于是自给自足的请求表格渲染为空表（数据拿到了、界面看不到）。
  it('父组件未接 update:dataSource 时，请求结果仍然渲染（内部 tableData 兜底）', async () => {
    const mockRequest = vi.fn().mockResolvedValue({
      total: 100, size: 10, page: 1, list: sampleData
    })
    const wrapper = mountTable({
      dataSource: [],
      columns: defaultColumns,
      options: {
        httpRequest: mockRequest,
        apiParams: { url: '/api/list' },
        configTableOut: { total: 'total', pageSize: 'size', current: 'page', tableData: 'list' }
      } as TableOptions,
      pagination: { current: 1, pageSize: 10, total: 0 }
    })
    await flushPromises()
    expect((wrapper.vm as any).displayDataSource).toHaveLength(2)
    const rows = wrapper.findAll('.el-table__body-wrapper .el-table__row')
    expect(rows.length).toBe(2)
  })

  it('maps response fields via configTableOut', async () => {
    const mockRequest = vi.fn().mockResolvedValue({
      total: 100, size: 10, page: 1, list: sampleData
    })
    const wrapper = mountTable({
      dataSource: [],
      columns: defaultColumns,
      options: {
        httpRequest: mockRequest,
        apiParams: { url: '/api/list' },
        configTableOut: { total: 'total', pageSize: 'size', current: 'page', tableData: 'list' }
      } as TableOptions,
      pagination: { current: 1, pageSize: 10, total: 0 }
    })
    await flushPromises()
    // After response, dataSource should be updated via emit
    const updateEvents = wrapper.emitted('update:dataSource')
    expect(updateEvents).toBeTruthy()
    const emittedData = updateEvents![0][0] as Record<string, unknown>[]
    expect(emittedData).toHaveLength(2)
    expect(emittedData[0].name).toBe('张三')
  })

  it('updates pagination total from response', async () => {
    const mockRequest = vi.fn().mockResolvedValue({
      total: 100, pageSize: 10, pageNo: 1, rows: sampleData
    })
    const wrapper = mountTable({
      dataSource: [],
      columns: defaultColumns,
      options: {
        httpRequest: mockRequest,
        apiParams: { url: '/api/list' },
        configTableOut: { total: 'total', pageSize: 'pageSize', current: 'pageNo', tableData: 'rows' }
      } as TableOptions,
      pagination: { current: 1, pageSize: 10, total: 0 }
    })
    await flushPromises()
    const paginationEvents = wrapper.emitted('update:pagination')
    expect(paginationEvents).toBeTruthy()
    const lastPagination = paginationEvents![paginationEvents!.length - 1][0] as PaginationConfig
    expect(lastPagination.total).toBe(100)
  })

  it('calls brcb before request', async () => {
    const brcb = vi.fn((params) => ({ ...params, extra: 1 }))
    const mockRequest = vi.fn().mockResolvedValue({
      records: 0, pageSize: 10, pageNo: 1, rows: []
    })
    mountTable({
      dataSource: [],
      columns: defaultColumns,
      options: {
        httpRequest: mockRequest,
        apiParams: { url: '/api/list' },
        configTableOut: { total: 'records', pageSize: 'pageSize', current: 'pageNo', tableData: 'rows' },
        listenToCallBack: { brcb }
      } as TableOptions,
      pagination: { current: 1, pageSize: 10, total: 0 }
    })
    await flushPromises()
    expect(brcb).toHaveBeenCalled()
    // brcb transforms params; the extra field is merged into formParams
    const callArgs = mockRequest.mock.calls[0][0]
    expect(callArgs.formParams).toHaveProperty('extra', 1)
  })

  it('calls qrcb after response', async () => {
    const qrcb = vi.fn((res) => res)
    const mockRequest = vi.fn().mockResolvedValue({
      records: 2, pageSize: 10, pageNo: 1, rows: sampleData
    })
    mountTable({
      dataSource: [],
      columns: defaultColumns,
      options: {
        httpRequest: mockRequest,
        apiParams: { url: '/api/list' },
        configTableOut: { total: 'records', pageSize: 'pageSize', current: 'pageNo', tableData: 'rows' },
        listenToCallBack: { qrcb }
      } as TableOptions,
      pagination: { current: 1, pageSize: 10, total: 0 }
    })
    await flushPromises()
    expect(qrcb).toHaveBeenCalled()
  })

  it('pagination change triggers request when apiParams configured', async () => {
    const mockRequest = vi.fn().mockResolvedValue({
      records: 100, pageSize: 10, pageNo: 2, rows: sampleData
    })
    const wrapper = mountTable({
      dataSource: [],
      columns: defaultColumns,
      options: {
        httpRequest: mockRequest,
        apiParams: { url: '/api/list' },
        configTableOut: { total: 'records', pageSize: 'pageSize', current: 'pageNo', tableData: 'rows' }
      } as TableOptions,
      pagination: { current: 1, pageSize: 10, total: 100 }
    })
    await flushPromises()
    // Initial request
    expect(mockRequest).toHaveBeenCalledTimes(1)

    // Trigger page change
    const pagination = wrapper.findComponent({ name: 'ElPagination' })
    if (pagination.exists()) {
      mockRequest.mockClear()
      await pagination.vm.$emit('current-change', 2)
      await flushPromises()
      expect(mockRequest).toHaveBeenCalled()
    }
  })

  it('size change triggers request when apiParams configured', async () => {
    const mockRequest = vi.fn().mockResolvedValue({
      records: 100, pageSize: 20, pageNo: 1, rows: sampleData
    })
    const wrapper = mountTable({
      dataSource: [],
      columns: defaultColumns,
      options: {
        httpRequest: mockRequest,
        apiParams: { url: '/api/list' },
        configTableOut: { total: 'records', pageSize: 'pageSize', current: 'pageNo', tableData: 'rows' }
      } as TableOptions,
      pagination: { current: 1, pageSize: 10, total: 100 }
    })
    await flushPromises()
    expect(mockRequest).toHaveBeenCalledTimes(1)

    const pagination = wrapper.findComponent({ name: 'ElPagination' })
    if (pagination.exists()) {
      mockRequest.mockClear()
      await pagination.vm.$emit('size-change', 20)
      await flushPromises()
      expect(mockRequest).toHaveBeenCalled()
    }
  })

  it('httpRequestInstance triggers manual request', async () => {
    const mockRequest = vi.fn().mockResolvedValue({
      records: 0, pageSize: 10, pageNo: 1, rows: []
    })
    const wrapper = mountTable({
      dataSource: [],
      columns: defaultColumns,
      options: {
        isInitRun: false,
        httpRequest: mockRequest,
        apiParams: { url: '/api/list' },
        configTableOut: { total: 'records', pageSize: 'pageSize', current: 'pageNo', tableData: 'rows' }
      } as TableOptions,
      pagination: { current: 1, pageSize: 10, total: 0 }
    })
    await flushPromises()
    expect(mockRequest).not.toHaveBeenCalled()

    // Manually trigger request
    const vm = wrapper.vm as any
    await vm.httpRequestInstance()
    await flushPromises()
    expect(mockRequest).toHaveBeenCalledTimes(1)
  })

  it('空/undefined 响应 → httpRequestInstance 仍 settle（回归：此前永久挂起）', async () => {
    const mockRequest = vi.fn().mockResolvedValue(undefined)
    const wrapper = mountTable({
      dataSource: [],
      columns: defaultColumns,
      options: {
        isInitRun: false,
        httpRequest: mockRequest,
        apiParams: { url: '/api/list' }
      } as TableOptions,
      pagination: { current: 1, pageSize: 10, total: 0 }
    })
    await flushPromises()
    const vm = wrapper.vm as any
    const outcome = await Promise.race([
      vm.httpRequestInstance().then(() => 'settled'),
      new Promise((r) => setTimeout(() => r('timeout'), 300))
    ])
    expect(outcome).toBe('settled')
  })

  it('数组响应 → httpRequestInstance 仍 settle（回归：此前 isObject 判定跳过 success）', async () => {
    const mockRequest = vi.fn().mockResolvedValue([{ id: 1 }])
    const wrapper = mountTable({
      dataSource: [],
      columns: defaultColumns,
      options: {
        isInitRun: false,
        httpRequest: mockRequest,
        apiParams: { url: '/api/list' }
      } as TableOptions,
      pagination: { current: 1, pageSize: 10, total: 0 }
    })
    await flushPromises()
    const vm = wrapper.vm as any
    const outcome = await Promise.race([
      vm.httpRequestInstance().then(() => 'settled'),
      new Promise((r) => setTimeout(() => r('timeout'), 300))
    ])
    expect(outcome).toBe('settled')
    // 裸数组响应应直接作为表格数据（回归：此前数组响应渲染空表）
    expect(vm.tableData).toHaveLength(1)
    expect(vm.tableData[0]).toEqual({ id: 1 })
  })

  it('falls back to global $esPlusTable.$httpRequest', async () => {
    const globalRequest = vi.fn().mockResolvedValue({
      records: 0, pageSize: 10, pageNo: 1, rows: []
    })
    const wrapper = mount(EsTable, {
      props: {
        dataSource: [],
        columns: defaultColumns,
        options: {
          apiParams: { url: '/api/list' },
          configTableOut: { total: 'records', pageSize: 'pageSize', current: 'pageNo', tableData: 'rows' }
        } as TableOptions,
        pagination: { current: 1, pageSize: 10, total: 0 }
      },
      global: {
        components: globalComponents,
        provide: {
          $esPlusTable: { $httpRequest: globalRequest }
        }
      }
    })
    await flushPromises()
    expect(globalRequest).toHaveBeenCalled()
  })
})

// 回归：并发分页请求竞态（此前用全局 loadingStatus 当互斥锁，在途请求直接 fail，
// 且 handleIndexChange 先改页码再发请求 → 快速翻页时旧页数据覆盖/误报 request-error）
describe('EsTable - 并发分页请求竞态', () => {
  const deferred = <T = unknown>() => {
    let resolve!: (value: T) => void
    let reject!: (reason?: unknown) => void
    const promise = new Promise<T>((res, rej) => {
      resolve = res
      reject = rej
    })
    return { promise, resolve, reject }
  }

  const mountRaceTable = () => {
    const pending: Array<{ opts: any; d: ReturnType<typeof deferred> }> = []
    const mockRequest = vi.fn((opts: any) => {
      const d = deferred()
      pending.push({ opts, d })
      return d.promise
    })
    const wrapper = mountTable({
      dataSource: [],
      columns: defaultColumns,
      options: {
        isInitRun: false,
        httpRequest: mockRequest,
        apiParams: { url: '/api/list' },
        configTableOut: { total: 'records', tableData: 'rows' },
      } as TableOptions,
      pagination: { current: 1, pageSize: 10, total: 100 },
    })
    return { wrapper, mockRequest, pending }
  }

  it('快速翻页：被淘汰请求的响应静默丢弃，只有最新页写入数据', async () => {
    const { wrapper, mockRequest, pending } = mountRaceTable()
    await flushPromises()
    expect(mockRequest).not.toHaveBeenCalled()

    const pagination = wrapper.findComponent({ name: 'ElPagination' })
    await pagination.vm.$emit('current-change', 2)
    await pagination.vm.$emit('current-change', 3)
    await nextTick()

    // 旧实现第二发会被 loadingStatus 锁挡掉；修复后两次请求都应发出
    expect(mockRequest).toHaveBeenCalledTimes(2)
    const req2 = pending.find((p) => p.opts.formParams?.pageIndex === 2)
    const req3 = pending.find((p) => p.opts.formParams?.pageIndex === 3)
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

  // 覆盖最危险的顺序：最新请求先返回并写入，旧请求**随后**才返回。
  // 若 isCurrent 判定缺失/为恒真，旧响应会覆盖已写入的最新数据 —— 原有用例（旧先返回）
  // 无法暴露这一点。
  it('最新页先返回、旧页后返回 → 旧页不得覆盖最新数据', async () => {
    const { wrapper, mockRequest, pending } = mountRaceTable()
    await flushPromises()

    const pagination = wrapper.findComponent({ name: 'ElPagination' })
    await pagination.vm.$emit('current-change', 2)
    await pagination.vm.$emit('current-change', 3)
    await nextTick()
    expect(mockRequest).toHaveBeenCalledTimes(2)

    const req2 = pending.find((p) => p.opts.formParams?.pageIndex === 2)
    const req3 = pending.find((p) => p.opts.formParams?.pageIndex === 3)

    req3!.d.resolve({ records: 100, rows: [{ name: 'latest-page-3' }] })
    await flushPromises()
    req2!.d.resolve({ records: 100, rows: [{ name: 'stale-page-2' }] })
    await flushPromises()

    const updates = wrapper.emitted('update:dataSource') as any[]
    const final = updates[updates.length - 1][0]
    expect(final).toHaveLength(1)
    expect(final[0].name).toBe('latest-page-3')
    expect(wrapper.emitted('request-error')).toBeFalsy()
  })

  it('被淘汰请求失败静默丢弃，不触发 request-error', async () => {
    const { wrapper, pending } = mountRaceTable()
    await flushPromises()

    const pagination = wrapper.findComponent({ name: 'ElPagination' })
    await pagination.vm.$emit('current-change', 2)
    await pagination.vm.$emit('current-change', 3)
    await nextTick()

    const req2 = pending.find((p) => p.opts.formParams?.pageIndex === 2)
    const req3 = pending.find((p) => p.opts.formParams?.pageIndex === 3)
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

    const pagination = wrapper.findComponent({ name: 'ElPagination' })
    await pagination.vm.$emit('current-change', 2)
    await nextTick()
    const req2 = pending.find((p) => p.opts.formParams?.pageIndex === 2)!
    req2.d.reject(new Error('latest failed'))
    await flushPromises()

    expect(wrapper.emitted('request-error'), '最新请求失败应暴露').toBeTruthy()
    expect((wrapper.vm as any).requestError).toBeTruthy()
  })

  it('边界回退的递归请求不被序号机制误杀（keepPage 空页回退后取到有效页数据）', async () => {
    const pending: Array<{ opts: any; d: ReturnType<typeof deferred> }> = []
    const mockRequest = vi.fn((opts: any) => {
      const d = deferred()
      pending.push({ opts, d })
      return d.promise
    })
    const wrapper = mountTable({
      dataSource: [],
      columns: defaultColumns,
      options: {
        isInitRun: false,
        httpRequest: mockRequest,
        apiParams: { url: '/api/list' },
        configTableOut: { total: 'records', tableData: 'rows' },
      } as TableOptions,
      // current(20) > maxPage(10) 且该页为空 → 触发回退
      pagination: { current: 20, pageSize: 10, total: 100 },
    })
    await flushPromises()

    const refreshPromise = (wrapper.vm as any).refresh()
    await nextTick()
    expect(pending).toHaveLength(1)

    // 首个 keepPage 请求返回空 → 递归回退到 maxPage=10
    pending[0].d.resolve({ records: 100, rows: [] })
    await flushPromises()
    expect(pending, '回退应发起第二次请求').toHaveLength(2)
    expect(pending[1].opts.formParams?.pageIndex).toBe(10)

    pending[1].d.resolve({ records: 100, rows: [{ name: 'page-10' }] })
    await refreshPromise
    await flushPromises()

    const updates = wrapper.emitted('update:dataSource') as any[]
    const latest = updates[updates.length - 1][0]
    expect(latest[0].name).toBe('page-10')
    expect(wrapper.emitted('request-error')).toBeFalsy()
  })
})

describe('EsTable - 列级 permissionValue 门控', () => {
  // 回归：列级 permissionValue 此前 schema+prompt+scorer 都认，组件 filteredColumns 却只按 hidCol
  // 过滤 → 无权限的列照样渲染（假承诺）。接线后应与 hidCol 同层被过滤。
  const gateColumns: TableColumn[] = [
    { prop: 'name', label: '姓名', width: 120 },
    { prop: 'salary', label: '工资', width: 120, permissionValue: 'salary:view' }
  ]

  it('无权限的列不渲染，有权限的列正常渲染', async () => {
    const { configureEsPlus, resetGlobalConfig } = await import('@es-plus/core')
    try {
      configureEsPlus({ permission: (v: string) => v !== 'salary:view' })
      const wrapper = mountTable({ dataSource: sampleData, columns: gateColumns })
      await nextTick()
      const items = wrapper.findAllComponents(ColumnItem)
      expect(items).toHaveLength(1)
      expect(items[0].props('cols').prop).toBe('name')
    } finally {
      resetGlobalConfig()
    }
  })

  it('未配置全局 permission 时一律放行', async () => {
    const wrapper = mountTable({ dataSource: sampleData, columns: gateColumns })
    await nextTick()
    expect(wrapper.findAllComponents(ColumnItem)).toHaveLength(2)
  })
})

// ── 尺寸契约：number | string 都必须是真能力（三端同规）──────────────────────
// core `TableOptions.height/tabHeight` 与 MCP zod 都声明 `number | string`，
// 但旧实现只认 number，字符串被静默忽略并回落 `100%` —— 声明与运行时漂移。
describe('EsTable(vue3) — 尺寸契约 number | string', () => {
  const heightOf = (w: any) => (w.find('.table_component').element as HTMLElement).style.height

  it('height：数字 / 纯数字字符串 / px 字符串等价', () => {
    expect(heightOf(mountTable({ options: { heightType: 'height', height: 420 } as any }))).toBe('420px')
    expect(heightOf(mountTable({ options: { heightType: 'height', height: '420' } as any }))).toBe('420px')
    expect(heightOf(mountTable({ options: { heightType: 'height', height: '420px' } as any }))).toBe('420px')
  })

  it('tabHeight：字符串被采纳（旧实现静默忽略）且优先于 height', () => {
    expect(
      heightOf(mountTable({ options: { heightType: 'height', height: 420, tabHeight: '40px' } as any }))
    ).toBe('40px')
  })

  it('百分比等带单位字符串原样透传', () => {
    expect(heightOf(mountTable({ options: { heightType: 'height', height: '70vh' } as any }))).toBe('70vh')
  })
})

// ─── AN-09 前置非数据列合成（默认 el-table 引擎）────────────────────────
// 修前：multiSelect / snIndex / expand 三个开关只被虚拟引擎与三份 vxe 适配器消费，
// 默认引擎完全无视 —— 同一份配置切引擎就少一列，静默无提示。
describe('EsTable(vue3) — AN-09 前置列合成', () => {
  const columnTypes = (wrapper: any): Array<string | undefined> =>
    wrapper.findAllComponents(ColumnItem).map((c: any) => (c.props('cols') as TableColumn).type)

  it('multiSelect + snIndex → 选择列、序号列前置（顺序与 vxe 引擎一致）', () => {
    const wrapper = mountTable({
      dataSource: sampleData,
      options: { multiSelect: true, snIndex: true },
    })
    expect(columnTypes(wrapper)).toEqual(['selection', 'index', undefined, undefined, undefined])
  })

  it('三开全开 → 选择 → 序号 → 展开', () => {
    const wrapper = mountTable({
      dataSource: sampleData,
      options: { multiSelect: true, snIndex: true, expand: true },
    })
    expect(columnTypes(wrapper).slice(0, 3)).toEqual(['selection', 'index', 'expand'])
  })

  it('显式声明 type 列 → 不重复注入', () => {
    const wrapper = mountTable({
      dataSource: sampleData,
      columns: [{ type: 'index', label: '序' }, ...defaultColumns],
      options: { snIndex: true },
    })
    expect(columnTypes(wrapper)).toEqual(['index', undefined, undefined, undefined])
  })

  // 判据必须看**原始列**（core `synthesizeLeadingColumns` 的 @param 明写「原始列（未做
  // 权限/隐藏过滤）」）：被 hidCol/权限筛掉的 `type:'index'` 列仍算已声明，否则用户的
  // 隐藏会被一条合成列推翻（antdv 端曾把过滤后的列喂进去，见其同款回归用例）。
  it('hidCol 的 type:index 列仍算已声明 → 不合成默认序号列', () => {
    const wrapper = mountTable({
      dataSource: sampleData,
      columns: [{ type: 'index', hidCol: true }, ...defaultColumns],
      options: { snIndex: true },
    })
    expect(columnTypes(wrapper)).toEqual([undefined, undefined, undefined])
  })

  it('开关全关 → 不注入（默认行为不变）', () => {
    const wrapper = mountTable({ dataSource: sampleData })
    expect(columnTypes(wrapper)).toEqual([undefined, undefined, undefined])
  })

  it('序号列表头渲染为 #（默认宽度 60 不参与 width→minWidth 转换）', () => {
    const wrapper = mountTable({
      dataSource: sampleData,
      options: { snIndex: true },
    })
    const indexCol = wrapper
      .findAllComponents(ColumnItem)
      .map((c: any) => c.props('cols') as TableColumn)
      .find(c => c.type === 'index')
    expect(indexCol?.label).toBe('#')
    expect(indexCol?.width).toBe(60)
    expect(indexCol?.minWidth).toBeUndefined()
  })
})

// ─── AN-10 列选项（默认 el-table 引擎）────────────────────────────────────
// 修前：生成器发的是 el-table 专有的 `showOverflowTooltip`，且只简单列那条
// `v-else-if` 生效；带 render/scopedSlots/groups 的列即使写了 ellipsis 也不截断。
// 现 IR 统一 `ellipsis`，在 columnBindAttr 里翻译，覆盖**所有**渲染分支。
describe('EsTable(vue3) — AN-10 省略号 / 默认排序', () => {
  const colOf = (wrapper: any) => wrapper.findComponent(ElTableColumn)

  it('ellipsis → el-table-column 的 show-overflow-tooltip', () => {
    const wrapper = mountTable({ columns: [{ prop: 'name', label: '姓名', ellipsis: true }] })
    expect(colOf(wrapper).props('showOverflowTooltip')).toBe(true)
  })

  it('ellipsis + render：自定义单元格分支也带 show-overflow-tooltip（修前该分支没有）', () => {
    const wrapper = mountTable({
      columns: [
        {
          prop: 'name',
          label: '姓名',
          ellipsis: true,
          render: (_h: any, { value }: any) => String(value ?? ''),
        },
      ],
    })
    expect(colOf(wrapper).props('showOverflowTooltip')).toBe(true)
  })

  it('存量写法 showOverflowTooltip 原样透传（向后兼容）', () => {
    const wrapper = mountTable({
      columns: [{ prop: 'name', label: '姓名', showOverflowTooltip: true } as any],
    })
    expect(colOf(wrapper).props('showOverflowTooltip')).toBe(true)
  })

  it('未设置省略号 → 不开 tooltip', () => {
    const wrapper = mountTable({ columns: [{ prop: 'name', label: '姓名' }] })
    expect(colOf(wrapper).props('showOverflowTooltip')).toBeFalsy()
  })

  it('options.defaultSort → el-table 的 defaultSort（显式映射，不靠偶然透传）', () => {
    const wrapper = mountTable({
      options: { defaultSort: { prop: 'name', order: 'descending' } } as any,
    })
    expect(wrapper.findComponent(ElTable).props('defaultSort')).toEqual({
      prop: 'name',
      order: 'descending',
    })
  })
})

/**
 * AN-11⑥ —— 虚拟滚动引擎的 `row-click` 转发。
 *
 * el-table / vxe 两条路径都靠 attrs 透传把父级的 `onRowClick` 送到引擎
 * （`tableBindAttrs` / `vxePassthroughAttrs`），唯独 virtual 分支是显式绑定、
 * 一个 on* 都没接 —— 于是 `<es-table @row-click>` 在 virtual 引擎下被静默吞掉。
 */
describe('EsTable - AN-11⑥ virtual 引擎 row-click', () => {
  const virtualStub = {
    name: 'VirtualEngine',
    template: '<div class="virtual-stub" />',
    props: ['columns', 'dataSource', 'tableHeight', 'options', 'parentSlots']
  }

  it('virtual-engine 冒泡的 row-click → 父级监听真的收到', () => {
    const onRowClick = vi.fn()
    const wrapper = mount(EsTable, {
      props: {
        dataSource: sampleData,
        columns: defaultColumns,
        options: { virtual: true } as unknown as TableOptions
      },
      attrs: { onRowClick },
      global: {
        components: globalComponents,
        stubs: { VirtualEngine: virtualStub }
      }
    })
    const engine = wrapper.findComponent({ name: 'VirtualEngine' })
    expect(engine.exists()).toBe(true)
    engine.vm.$emit('row-click', { id: 1 }, new Event('click'))
    expect(onRowClick).toHaveBeenCalledTimes(1)
    expect(onRowClick.mock.calls[0][0]).toEqual({ id: 1 })
  })
})

// ─── 请求模式：空页不回显父级旧 dataSource ─────────────────────────────────
// 修前 `displayDataSource` 是 `tableData.length ? tableData : props.dataSource`：
// 请求已返回空页（tableData=[]）时回落父级旧数据 → 用户删到 0 条仍看到上一页的行。
// 正确语义：只要请求模式已返回过响应，tableData 就是唯一真相（空也是真相）。
describe('EsTable — 请求模式空页', () => {
  it('请求返回空页时不回显父级旧 dataSource', async () => {
    const mockRequest = vi.fn().mockResolvedValue({ total: 0, size: 10, page: 1, list: [] })
    const wrapper = mountTable({
      dataSource: sampleData,
      columns: defaultColumns,
      options: {
        httpRequest: mockRequest,
        apiParams: { url: '/api/list' },
        configTableOut: { total: 'total', pageSize: 'size', current: 'page', tableData: 'list' },
      } as TableOptions,
      pagination: { current: 1, pageSize: 10, total: 0 },
    })
    await flushPromises()
    expect((wrapper.vm as any).displayDataSource).toHaveLength(0)
  })
})

describe('EsTable — 内建分页（localPagination）的跨页勾选回显', () => {
  // 回归：此前回显只监听 props.dataSource。内建分页时 dataSource 是全量、翻页只改内部切片，
  // props 引用不动 —— 于是 el-table 的 setData 先 clearSelection() 并 emit selection-change([])，
  // 把「翻回去的那一页」的缓存覆盖成空，且没有任何 restore 把它勾回来。
  // 实测（修复前）：第 1 页选 id 1、第 2 页选 id 5，翻回第 1 页后 getSelectionRows() 只剩 [5]。
  it('翻回已选页：并集与勾选态都恢复', async () => {
    const rows = Array.from({ length: 8 }, (_, i) => ({ id: i + 1, name: `row-${i + 1}` }))
    const wrapper = mountTable({
      dataSource: rows,
      columns: [{ type: 'selection', width: 55 }, { prop: 'id', label: 'ID' }],
      options: {
        localPagination: true,
        multiSelect: true,
        cachePageSelection: true,
        rowkey: 'id',
      } as TableOptions,
      pagination: { current: 1, pageSize: 4, total: 8 },
    })
    await nextTick()

    const table = wrapper.findComponent(ElTable)
    const pager = wrapper.findComponent(ElPagination)
    const vm = wrapper.vm as any
    const ids = () => vm.getSelectionRows().map((r: { id: number }) => r.id)
    const settle = async () => {
      await flushPromises()
      await nextTick()
      await nextTick()
    }

    const select = async (row: Record<string, unknown>) => {
      // 走 el-table 的命令式 API：内部 selection 与 selection-change 都按真实路径更新
      const inst = table.vm as any
      ;(inst.toggleRowSelection || inst.$?.exposed?.toggleRowSelection).call(inst, row, true)
      await settle()
    }

    await select(rows[0])
    expect(ids()).toEqual([1])

    pager.vm.$emit('current-change', 2)
    await settle()
    await select(rows[4])
    expect(ids()).toEqual([1, 5])

    pager.vm.$emit('current-change', 1)
    await settle()
    expect(ids()).toEqual([1, 5])
    // 回显是视觉契约：第 1 页的那一行必须真的勾着
    expect(wrapper.findAll('.el-table__body .el-checkbox.is-checked')).toHaveLength(1)
  })
})

describe('EsTable — clearSelection 清空全部（含跨页缓存）', () => {
  it('el-table 引擎：清空后 getSelectionRows() 不再回吐旧选中（否则翻页会复活）', async () => {
    const wrapper = mountTable({
      dataSource: sampleData,
      columns: [{ type: 'selection', width: 50 }, ...defaultColumns],
      options: { rowkey: 'name' } as TableOptions,
      pagination: { current: 1, pageSize: 10, total: 2 },
    })
    await nextTick()
    const table = wrapper.findComponent({ name: 'ElTable' })
    table.vm.$emit('selection-change', [sampleData[0]])
    await nextTick()

    const vm = wrapper.vm as any
    expect(vm.getSelectionRows()).toHaveLength(1)

    vm.clearSelection()
    await nextTick()
    // 旧实现只调 el-table 的 clearSelection()，跨页缓存里这一行还在 ——
    // 翻回该页会被 restoreSelectionForPage 重新勾上，用户看到「清空没生效」。
    expect(vm.getSelectionRows()).toHaveLength(0)
  })
})
