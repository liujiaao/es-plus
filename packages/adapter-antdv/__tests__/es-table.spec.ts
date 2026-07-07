/**
 * EsTable 组件测试 (ADV 版本)
 */
import { describe, it, expect, vi, beforeEach } from 'vitest'
import { mount } from '@vue/test-utils'
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
