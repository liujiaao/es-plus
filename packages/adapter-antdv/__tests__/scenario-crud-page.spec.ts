/**
 * 场景测试：CRUD 页面 Schema 配置
 * 基于 es-plus-docs 的 crud-page/FullBusiness.vue 和 Basic.vue 案例
 *
 * 验证 CrudPageSchema 的构建逻辑（不依赖完整的 ADV 组件链挂载）
 */
import { describe, it, expect } from 'vitest'
import type { CrudPageSchema } from '../src/components/es-crud-page/src/es-crud-page.vue'
import type { TableColumn, BtnConfig, FormItemOption } from '../src/types'
import { getButtonPosition } from '@es-plus/core'
import { adaptColumn } from '../src/components/es-table/src/column-adapter'

// ─── 文档案例数据 ──────────────────────────────────

function makeUserMgmtSchema(): CrudPageSchema {
  return {
    formItemList: [
      { prop: 'name', label: '姓名', formtype: 'Input', span: 6, attrs: { placeholder: '请输入姓名', clearable: true } },
      { prop: 'phone', label: '手机号', formtype: 'Input', span: 6, attrs: { placeholder: '请输入手机号', clearable: true } },
      { prop: 'status', label: '状态', formtype: 'Select', span: 6, dataOptions: [
        { label: '全部', value: '' }, { label: '启用', value: 1 }, { label: '禁用', value: 0 },
      ]},
      { prop: 'dateRange', label: '创建时间', formtype: 'DatePicker', span: 6, attrs: { type: 'daterange', valueFormat: 'YYYY-MM-DD' } },
    ],
    columns: [
      { prop: 'name', label: '姓名', width: 120 },
      { prop: 'phone', label: '手机号', width: 130 },
      { prop: 'email', label: '邮箱', minWidth: 160 },
      { prop: 'status', label: '状态', width: 100, align: 'center' },
      { prop: 'createTime', label: '创建时间', width: 180, sortable: true },
    ],
    tableOptions: { border: true, rowkey: 'id', apiParams: { url: '/api/users' } as any },
    pagination: { pageSize: 10 },
    toolbarBtns: [
      { name: '新增', key: 'add', type: 'primary' as any },
      { name: '导出', key: 'export' },
    ],
    actions: ['add', 'edit', 'delete'],
    dialogFormItems: [
      { prop: 'name', label: '姓名', formtype: 'Input', required: true, span: 12 },
      { prop: 'phone', label: '手机号', formtype: 'Input', span: 12 },
      { prop: 'email', label: '邮箱', formtype: 'Input', span: 12 },
      { prop: 'status', label: '状态', formtype: 'Select', span: 12, dataOptions: [
        { label: '启用', value: 1 }, { label: '禁用', value: 0 },
      ]},
      { prop: 'createTime', label: '创建时间', formtype: 'DatePicker', span: 12 },
    ],
  }
}

function makeOrderSchema(): CrudPageSchema {
  return {
    formItemList: [
      { prop: 'orderNo', label: '订单号', formtype: 'Input', span: 6 },
      { prop: 'customerName', label: '客户名称', formtype: 'Input', span: 6 },
      { prop: 'status', label: '订单状态', formtype: 'Select', span: 6, dataOptions: [
        { label: '待付款', value: 'pending' }, { label: '已付款', value: 'paid' },
        { label: '已发货', value: 'shipped' }, { label: '已完成', value: 'done' },
      ]},
      { prop: 'amountRange', label: '金额区间', formtype: 'Slider', span: 6, attrs: { range: true, min: 0, max: 100000 } },
    ],
    columns: [
      { prop: 'orderNo', label: '订单号', width: 160 },
      { prop: 'customerName', label: '客户', width: 100 },
      { prop: 'amount', label: '金额', width: 120, align: 'right', sortable: true },
      { prop: 'status', label: '状态', width: 100, align: 'center' },
      { prop: 'orderTime', label: '下单时间', width: 180, sortable: true },
    ],
    tableOptions: {
      border: true, stripe: true, rowkey: 'id',
      multiSelect: true, cachePageSelection: true,
      apiParams: { url: '/api/orders', method: 'POST' } as any,
      configTableOut: { total: 'total', tableData: 'data', pageSize: 'pageSize', current: 'pageIndex' },
    },
    pagination: { pageSize: 15, pageSizes: [15, 30, 50] },
    toolbarBtns: [
      { name: '新增订单', key: 'add', type: 'primary' as any },
      { name: '批量发货', key: 'batchShip', type: 'success' as any },
      { name: '批量删除', key: 'batchDelete', type: 'danger' as any, confirm: '确定批量删除？' },
      { name: '导出', key: 'export' },
    ],
    actions: ['add', 'edit', 'delete', 'view'],
    dialogFormItems: [
      { prop: 'orderNo', label: '订单号', formtype: 'Input', span: 12 },
      { prop: 'customerName', label: '客户名称', formtype: 'Input', span: 12 },
      { prop: 'amount', label: '金额', formtype: 'Input', span: 12, attrs: { type: 'number' } },
      { prop: 'status', label: '状态', formtype: 'Select', span: 12, dataOptions: [
        { label: '待付款', value: 'pending' }, { label: '已付款', value: 'paid' },
      ]},
      { prop: 'orderTime', label: '下单时间', formtype: 'DatePicker', span: 12 },
    ],
  }
}

describe('场景: 用户管理 CRUD Schema', () => {
  const schema = makeUserMgmtSchema()

  it('formItemList — 4个查询字段', () => {
    expect(schema.formItemList).toHaveLength(4)
  })

  it('formItemList — 字段类型正确', () => {
    const types = schema.formItemList?.map((f) => f.formtype)
    expect(types).toEqual(['Input', 'Input', 'Select', 'DatePicker'])
  })

  it('columns — 5个表格列', () => {
    expect(schema.columns).toHaveLength(5)
  })

  it('columns — 所有列可适配为 ADV 格式', () => {
    const adapted = schema.columns!.map(adaptColumn)
    expect(adapted).toHaveLength(5)
    adapted.forEach((c) => {
      expect(c).toHaveProperty('dataIndex')
    })
  })

  it('columns — sortable 列正确', () => {
    const sortCol = schema.columns?.find((c) => c.sortable)
    expect(sortCol).toBeTruthy()
    expect(sortCol!.prop).toBe('createTime')
    const adv = adaptColumn(sortCol!)
    expect(adv.sorter).toBe(true)
  })

  it('dialogFormItems — 5个弹窗表单字段', () => {
    expect(schema.dialogFormItems).toHaveLength(5)
  })

  it('dialogFormItems — required 字段', () => {
    const requiredFields = schema.dialogFormItems?.filter((f) => f.required)
    expect(requiredFields).toHaveLength(1)
    expect(requiredFields![0].prop).toBe('name')
  })

  it('actions → 3个操作按钮', () => {
    expect(schema.actions).toHaveLength(3)
    expect(schema.actions).toContain('add')
    expect(schema.actions).toContain('edit')
    expect(schema.actions).toContain('delete')
  })

  it('toolbarBtns — 2个工具栏按钮', () => {
    expect(schema.toolbarBtns).toHaveLength(2)
  })

  it('pagination — pageSize=10', () => {
    expect(schema.pagination?.pageSize).toBe(10)
  })

  it('tableOptions — rowkey="id"', () => {
    expect(schema.tableOptions?.rowkey).toBe('id')
  })

  it('tableOptions — border=true', () => {
    expect(schema.tableOptions?.border).toBe(true)
  })
})

describe('场景: 订单管理高级 Schema', () => {
  const schema = makeOrderSchema()

  it('formItemList — 含 Slider 控件', () => {
    const slider = schema.formItemList?.find((f) => f.formtype === 'Slider')
    expect(slider).toBeTruthy()
    expect(slider!.attrs?.range).toBe(true)
    expect(slider!.attrs?.min).toBe(0)
    expect(slider!.attrs?.max).toBe(100000)
  })

  it('多选+跨页选择配置', () => {
    expect(schema.tableOptions?.multiSelect).toBe(true)
    expect(schema.tableOptions?.cachePageSelection).toBe(true)
  })

  it('configTableOut 字段映射', () => {
    expect(schema.tableOptions?.configTableOut).toEqual({
      total: 'total', tableData: 'data', pageSize: 'pageSize', current: 'pageIndex',
    })
  })

  it('pagination — pageSize=15, pageSizes options', () => {
    expect(schema.pagination?.pageSize).toBe(15)
    expect(schema.pagination?.pageSizes).toEqual([15, 30, 50])
  })

  it('toolbarBtns — 4个按钮（含批量操作）', () => {
    expect(schema.toolbarBtns).toHaveLength(4)
    const batchDelete = schema.toolbarBtns?.find((b) => b.key === 'batchDelete')
    expect(batchDelete).toBeTruthy()
    expect(batchDelete!.confirm).toBe('确定批量删除？')
  })

  it('toolbarBtns — 按钮类型正确', () => {
    const types = schema.toolbarBtns?.map((b) => b.type)
    expect(types).toEqual(['primary', 'success', 'danger', undefined])
  })

  it('actions → 4个操作', () => {
    expect(schema.actions).toEqual(['add', 'edit', 'delete', 'view'])
  })

  it('所有列可适配为 ADV 格式（含 right-align + sortable）', () => {
    const adapted = schema.columns!.map(adaptColumn)
    const amountCol = adapted.find((c) => c.dataIndex === 'amount')
    expect(amountCol).toBeTruthy()
    expect(amountCol!.align).toBe('right')
    expect(amountCol!.sorter).toBe(true)
  })

  it('表格 button 配置 — position=left 判定为左侧', () => {
    const btn = { name: '新增', key: 'add', position: 'left' as const }
    expect(getButtonPosition(btn as any)).toBe('left')
  })

  it('表格 button 配置 — position=right 判定为右侧', () => {
    const btn = { name: '批量删除', key: 'batchDelete', position: 'right' as const }
    expect(getButtonPosition(btn as any)).toBe('right')
  })

  it('dialogFormItems — amount 字段为 number 类型', () => {
    const amountField = schema.dialogFormItems?.find((f) => f.prop === 'amount')
    expect(amountField).toBeTruthy()
    expect(amountField!.attrs?.type).toBe('number')
  })
})

describe('场景: 商品管理（虚拟滚动）', () => {
  function makeProductSchema(): CrudPageSchema {
    return {
      formItemList: [
        { prop: 'keyword', label: '关键词', formtype: 'Input', span: 6, attrs: { placeholder: '商品名/描述' } },
        { prop: 'category', label: '分类', formtype: 'Select', span: 6, dataOptions: [
          { label: '电子', value: 'electronics' }, { label: '服装', value: 'clothing' },
        ]},
        { prop: 'priceRange', label: '价格范围', formtype: 'Slider', span: 8, attrs: { range: true, min: 0, max: 10000 } },
        { prop: 'inStock', label: '仅看有货', formtype: 'Switch', span: 4 },
      ],
      columns: [
        { prop: 'title', label: '商品名称', minWidth: 200, ellipsis: true },
        { prop: 'category', label: '分类', width: 100 },
        { prop: 'price', label: '价格', width: 100, align: 'right', sortable: true },
        { prop: 'rating', label: '评分', width: 120, align: 'center' },
      ],
      tableOptions: {
        border: true, rowkey: 'id',
        virtual: true, rowHeight: 60, estimatedRowHeight: 60,
        apiParams: { url: '/api/products', method: 'GET' } as any,
      },
      pagination: { pageSize: 20 },
      actions: ['view', 'edit'],
      dialogFormItems: [
        { prop: 'title', label: '商品名称', formtype: 'Input', span: 24, required: true },
        { prop: 'price', label: '价格', formtype: 'Input', span: 12, attrs: { type: 'number' } },
        { prop: 'description', label: '描述', formtype: 'Input', span: 24, attrs: { type: 'textarea', rows: 4 } },
      ],
    }
  }

  const schema = makeProductSchema()

  it('虚拟滚动配置', () => {
    expect(schema.tableOptions?.virtual).toBe(true)
    expect(schema.tableOptions?.rowHeight).toBe(60)
    expect(schema.tableOptions?.estimatedRowHeight).toBe(60)
  })

  it('Switch 控件渲染', () => {
    const switchField = schema.formItemList?.find((f) => f.formtype === 'Switch')
    expect(switchField).toBeTruthy()
    expect(switchField!.span).toBe(4)
  })

  it('ellipsis 列', () => {
    const ellipsisCol = schema.columns?.find((c) => c.ellipsis)
    expect(ellipsisCol).toBeTruthy()
    expect(ellipsisCol!.prop).toBe('title')
    const adv = adaptColumn(ellipsisCol!)
    expect(adv.ellipsis).toBe(true)
  })

  it('dialogFormItems — textarea 描述字段', () => {
    const descField = schema.dialogFormItems?.find((f) => f.prop === 'description')
    expect(descField).toBeTruthy()
    expect(descField!.attrs?.type).toBe('textarea')
    expect(descField!.attrs?.rows).toBe(4)
  })
})

describe('场景: actions → 操作列 btns 转换逻辑', () => {
  it('actions: [add, edit, delete] → 3个操作列按钮', () => {
    const actions = ['add', 'edit', 'delete']
    const btns: BtnConfig[] = []
    if (actions.includes('add')) btns.push({ name: '新增', key: 'add', type: 'primary' })
    if (actions.includes('edit')) btns.push({ name: '编辑', key: 'edit' })
    if (actions.includes('delete')) btns.push({ name: '删除', key: 'delete', type: 'danger' })
    expect(btns).toHaveLength(3)
    expect(btns[0].key).toBe('add')
    expect(btns[2].type).toBe('danger')
  })

  it('actions: [view] → 1个查看按钮', () => {
    const actions = ['view']
    const btns: BtnConfig[] = []
    if (actions.includes('view')) btns.push({ name: '查看', key: 'view' })
    expect(btns).toHaveLength(1)
  })

  it('actions: [] → 0个按钮', () => {
    const actions: string[] = []
    const btns: BtnConfig[] = []
    if (actions.includes('add')) btns.push({ name: '新增', key: 'add', type: 'primary' })
    if (actions.includes('edit')) btns.push({ name: '编辑', key: 'edit' })
    if (actions.includes('delete')) btns.push({ name: '删除', key: 'delete', type: 'danger' })
    expect(btns).toHaveLength(0)
  })

  it('操作列 column 构建', () => {
    const btns: BtnConfig[] = [
      { name: '编辑', key: 'edit', type: 'primary' },
      { name: '删除', key: 'delete', type: 'danger' },
    ]
    const operateColumn: TableColumn = {
      prop: 'operate', key: 'operate', label: '操作',
      width: btns.length * 70 + 20,
      fixed: 'right',
      btns: btns.map((b) => ({
        ...b,
        clickEvent: (row: Record<string, unknown>) => {},
      })),
    }
    expect(operateColumn.prop).toBe('operate')
    expect(operateColumn.btns).toHaveLength(2)
    expect(operateColumn.width).toBe(2 * 70 + 20) // 160
  })
})
