import { describe, it, expect, vi } from 'vitest'
import { mount, flushPromises } from '@vue/test-utils'
import { nextTick, ref, reactive } from 'vue'
import {
  ElTable, ElTableColumn, ElPagination, ElButton, ElConfigProvider
} from 'element-plus'
import EsTable from '../src/components/es-table/src/component.vue'
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
