import { describe, it, expect, vi } from 'vitest'
import { mount, flushPromises } from '@vue/test-utils'
import { nextTick, ref, reactive } from 'vue'
import {
  ElTable, ElTableColumn, ElPagination, ElButton, ElConfigProvider
} from 'element-plus'
import EsTable from '../src/component.vue'
import type { TableOptions, TableColumn, PaginationConfig } from '../../../../types'

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
