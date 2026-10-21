/**
 * Vue 2 表格 — 请求 settle 回归测试
 *
 * 覆盖：空 / 非对象响应（204、拦截器 return undefined）时，`httpRequestInstance`
 * 的 Promise 仍必须 settle。此前 success 被 `isObject(res) && Object.keys(res).length`
 * 守卫跳过，Promise 永不 resolve → 表格加载永久挂起。
 *
 * 不加载真实 element-ui：它被 hoist 到仓库根、内部 CJS require('vue') 会解析到
 * 根部的 vue@3。未注册的 `el-*` 会作为未知元素渲染，但组件实例与实例方法不受影响。
 */
import { describe, it, expect, vi } from 'vitest'
import Vue from 'vue'
import { configureEsPlus, resetGlobalConfig } from '@es-plus/core'
import EsTable from '../src/components/es-table/component.vue'

function mountTable(props: Record<string, unknown> = {}): any {
  return new Vue({
    render: (h) =>
      h(EsTable as any, {
        props: {
          dataSource: [],
          columns: [{ prop: 'id', label: 'ID' }],
          options: {},
          pagination: { current: 1, pageSize: 10, total: 0 },
          ...props
        }
      })
  }).$mount()
}

/** 根 render 直接渲染 EsTable，其 $children[0] 即表格实例 */
const tableOf = (vm: any): any => vm.$children[0]

const settleWithin = (promise: Promise<unknown>, ms = 300) =>
  Promise.race([
    promise.then(() => 'settled'),
    new Promise((r) => setTimeout(() => r('timeout'), ms))
  ])

describe('EsTable(vue2) - 请求 settle', () => {
  it('空/undefined 响应 → httpRequestInstance 仍 settle（回归：此前永久挂起）', async () => {
    const httpRequest = vi.fn().mockResolvedValue(undefined)
    const vm = mountTable({
      options: { httpRequest, apiParams: { url: '/api/list' }, isInitRun: false }
    })
    await vm.$nextTick()
    const table = tableOf(vm)
    expect(table).toBeTruthy()
    expect(await settleWithin(table.httpRequestInstance())).toBe('settled')
  })

  it('数组响应 → httpRequestInstance 仍 settle（回归：此前 isObject 判定跳过 success）', async () => {
    const httpRequest = vi.fn().mockResolvedValue([{ id: 1 }])
    const vm = mountTable({
      options: { httpRequest, apiParams: { url: '/api/list' }, isInitRun: false }
    })
    await vm.$nextTick()
    const table = tableOf(vm)
    expect(await settleWithin(table.httpRequestInstance())).toBe('settled')
    // 裸数组响应应直接作为表格数据（回归：此前数组响应渲染空表）
    expect(table.tableData).toHaveLength(1)
    expect(table.tableData[0]).toEqual({ id: 1 })
  })

  it('只配顶层 httpRequest（app.use(EsPlus, { httpRequest })）→ 表格也发请求', async () => {
    // 三端对齐回归：EsTable 此前只认注入的 $esPlusTable.$httpRequest，
    // 完全看不见 core 的权威字段（顶层 httpRequest）。同一个配置下 EsForm 的
    // 远端下拉与自由的 httpRequest() 都能用，唯独独立 es-table 报
    // "no httpRequest configured"。修法：回落到 resolveHttpRequest(getGlobalConfig())。
    const httpRequest = vi.fn().mockResolvedValue({ records: 0, rows: [] })
    configureEsPlus({ httpRequest })
    try {
      const vm = mountTable({
        options: { apiParams: { url: '/api/list' }, isInitRun: false }
      })
      await vm.$nextTick()
      const table = tableOf(vm)
      expect(await settleWithin(table.httpRequestInstance())).toBe('settled')
      expect(httpRequest).toHaveBeenCalledTimes(1)
      expect(httpRequest.mock.calls[0][0].url).toBe('/api/list')
    } finally {
      resetGlobalConfig()
    }
  })
})

// 回归：并发分页请求竞态。此前 queryTableListMethod 用全局 loadingStatus 当互斥锁，
// 在途请求直接 fail；且 handleIndexChange 先改页码再发请求 → 快速翻页时旧页数据覆盖新页、
// 旧请求失败误报 request-error。修复后改为递增请求序号（requestTicket），只让最新请求生效。
describe('EsTable(vue2) - 并发分页请求竞态', () => {
  const deferred = <T = unknown>() => {
    let resolve!: (value: T) => void
    let reject!: (reason?: unknown) => void
    const promise = new Promise<T>((res, rej) => {
      resolve = res
      reject = rej
    })
    return { promise, resolve, reject }
  }

  const flushPromises = () => new Promise((r) => setTimeout(r, 0))

  const mountRaceTable = () => {
    const pending: Array<{ opts: any; d: ReturnType<typeof deferred> }> = []
    const httpRequest = vi.fn((opts: any) => {
      const d = deferred()
      pending.push({ opts, d })
      return d.promise
    })
    const vm = mountTable({
      options: {
        isInitRun: false,
        httpRequest,
        apiParams: { url: '/api/list' },
        configTableOut: { total: 'records', tableData: 'rows' }
      },
      pagination: { current: 1, pageSize: 10, total: 100 }
    })
    const table = tableOf(vm)
    const errors: unknown[] = []
    table.$on('request-error', (e: unknown) => errors.push(e))
    return { vm, table, httpRequest, pending, errors }
  }

  it('快速翻页：被淘汰请求的响应静默丢弃，只有最新页写入数据', async () => {
    const { vm, table, httpRequest, pending, errors } = mountRaceTable()
    await vm.$nextTick()
    expect(httpRequest).not.toHaveBeenCalled()

    // 同步连续翻页：旧实现第二发会被 loadingStatus 挡掉；修复后两次请求都应发出
    table.handleIndexChange(2)
    table.handleIndexChange(3)
    await vm.$nextTick()

    expect(httpRequest).toHaveBeenCalledTimes(2)
    const req2 = pending.find((p) => p.opts.formParams?.pageIndex === 2)
    const req3 = pending.find((p) => p.opts.formParams?.pageIndex === 3)
    expect(req2, '第 2 页请求应发出').toBeTruthy()
    expect(req3, '第 3 页请求应发出').toBeTruthy()

    // 旧页先返回 → 不得写入，也不得触发 request-error
    req2!.d.resolve({ records: 100, rows: [{ name: 'stale-page-2' }] })
    await flushPromises()
    expect(errors, '旧响应不应触发 request-error').toHaveLength(0)
    expect(table.requestError).toBeFalsy()
    expect(table.tableData.some((r: any) => r.name === 'stale-page-2')).toBe(false)

    // 最新页返回 → 写入
    req3!.d.resolve({ records: 100, rows: [{ name: 'latest-page-3' }] })
    await flushPromises()
    expect(table.tableData).toHaveLength(1)
    expect(table.tableData[0].name).toBe('latest-page-3')
  })

  it('被淘汰请求失败静默丢弃，不触发 request-error', async () => {
    const { vm, table, pending, errors } = mountRaceTable()
    await vm.$nextTick()

    table.handleIndexChange(2)
    table.handleIndexChange(3)
    await vm.$nextTick()

    const req2 = pending.find((p) => p.opts.formParams?.pageIndex === 2)
    const req3 = pending.find((p) => p.opts.formParams?.pageIndex === 3)
    req2!.d.reject(new Error('stale page failed'))
    await flushPromises()

    expect(errors, '旧请求失败不应暴露').toHaveLength(0)
    expect(table.requestError).toBeFalsy()

    // 最新请求仍能正常写入
    req3!.d.resolve({ records: 100, rows: [{ name: 'latest-page-3' }] })
    await flushPromises()
    expect(table.tableData[0].name).toBe('latest-page-3')
  })

  it('最新请求失败仍按原有行为触发 request-error', async () => {
    const { vm, table, pending, errors } = mountRaceTable()
    await vm.$nextTick()

    table.handleIndexChange(2)
    await vm.$nextTick()
    const req2 = pending.find((p) => p.opts.formParams?.pageIndex === 2)!
    req2.d.reject(new Error('latest failed'))
    await flushPromises()

    expect(errors, '最新请求失败应暴露').toHaveLength(1)
    expect(table.requestError).toBeTruthy()
  })

  it('边界回退的递归请求不被序号机制误杀（keepPage 空页回退后取到有效页数据）', async () => {
    const pending: Array<{ opts: any; d: ReturnType<typeof deferred> }> = []
    const httpRequest = vi.fn((opts: any) => {
      const d = deferred()
      pending.push({ opts, d })
      return d.promise
    })
    const vm = mountTable({
      options: {
        isInitRun: false,
        httpRequest,
        apiParams: { url: '/api/list' },
        configTableOut: { total: 'records', tableData: 'rows' }
      },
      // current(20) > maxPage(10) 且该页为空 → 触发回退
      pagination: { current: 20, pageSize: 10, total: 100 }
    })
    await vm.$nextTick()
    const table = tableOf(vm)
    const errors: unknown[] = []
    table.$on('request-error', (e: unknown) => errors.push(e))

    const refreshPromise = table.refresh()
    await vm.$nextTick()
    expect(pending).toHaveLength(1)

    // 首个 keepPage 请求返回空 → 递归回退到 maxPage=10
    pending[0].d.resolve({ records: 100, rows: [] })
    await flushPromises()
    expect(pending, '回退应发起第二次请求').toHaveLength(2)
    expect(pending[1].opts.formParams?.pageIndex).toBe(10)

    pending[1].d.resolve({ records: 100, rows: [{ name: 'page-10' }] })
    await refreshPromise
    await flushPromises()

    expect(table.tableData[0].name).toBe('page-10')
    expect(errors).toHaveLength(0)
  })
})

/**
 * 分页尺寸：Element UI 的分页没有 `size` prop，只有布尔 `small`。
 *
 * 此前模板是从 vue3 逐字抄来的 `:size="paginationIsSmall ? 'small' : paginationConfig.size"` ——
 * 两个分支在 vue2 里都是空转：`size` 不是 el-pagination 声明的 prop，只会作为 HTML 属性
 * 落到分页根元素上，既不报错也无任何样式效果。于是本组件**自己声明的默认值**
 * （`paginationConfig` 初值 `size: 'small'` / `isSmall: true`）在渲染层从未生效 ——
 * 而 vue3（Element Plus 有 `size`）与 adapter-antdv（AntDV 分页只认 default/small）
 * 两端都按同一份默认值渲染成 small。这里用渲染出的 `small` 属性把三端拉齐。
 *
 * 沿用文件既有做法：不加载真实 element-ui（`el-pagination` 作为未知元素渲染，
 * 属性照常落到 DOM 上，足以断言）。
 */
describe('EsTable(vue2) - 分页尺寸映射到 Element UI 的 small', () => {
  /**
   * 带连字符的未知元素走 Vue 2 的 baseSetAttr：真值 `setAttribute`、假值
   * `removeAttribute`。所以「不 small」= 属性**不存在**，「small」= `small="true"`。
   */
  const smallAttr = (vm: any): string | null =>
    vm.$el.querySelector('el-pagination')?.getAttribute('small') ?? null
  const isSmall = (vm: any): boolean => smallAttr(vm) === 'true'

  /** `pagination.total !== undefined` 才会点亮 showPagination */
  const paginated = { current: 1, pageSize: 10, total: 30 }

  /** paginationLayout 不是 prop，而是父级（EsCrudPage）注入的 `$esPlusTable` */
  const mountWithLayout = (layout: Record<string, unknown>, pagination: Record<string, unknown>) =>
    (new Vue({
      provide: { $esPlusTable: { paginationLayout: () => layout } },
      render: (h) =>
        h(EsTable as any, {
          props: { dataSource: [], columns: [{ prop: 'id', label: 'ID' }], options: {}, pagination }
        })
    }) as any).$mount()

  it('默认配置 → small（回归：此前本端渲染成默认尺寸，与 vue3/antdv 不一致）', async () => {
    const vm = mountTable({ pagination: paginated })
    await vm.$nextTick()
    expect(smallAttr(vm), '分页应已渲染').not.toBeNull()
    expect(isSmall(vm)).toBe(true)
  })

  it('pagination.isSmall: false 且 size 非 small → 不渲染 small', async () => {
    const vm = mountTable({ pagination: { ...paginated, isSmall: false, size: 'default' } })
    await vm.$nextTick()
    expect(smallAttr(vm)).toBeNull()
  })

  it("pagination.size: 'small' → small（Element UI 唯一能表达的取值）", async () => {
    const vm = mountTable({ pagination: { ...paginated, isSmall: false, size: 'small' } })
    await vm.$nextTick()
    expect(isSmall(vm)).toBe(true)
  })

  it("pagination.size: 'large' 且 isSmall: false → 不渲染 small（Element UI 无 large）", async () => {
    const vm = mountTable({ pagination: { ...paginated, isSmall: false, size: 'large' } })
    await vm.$nextTick()
    expect(smallAttr(vm)).toBeNull()
  })

  it('paginationLayout.isSmall 优先于 pagination.isSmall（两个方向都验）', async () => {
    const on = mountWithLayout({ isSmall: true }, { ...paginated, isSmall: false, size: 'default' })
    await on.$nextTick()
    expect(isSmall(on)).toBe(true)

    // isSmall 为假时退回 size 判定（与 vue3 的 `isSmall ? 'small' : size` 同构），
    // 所以这里 size 也要给非 small，才能验出「layout 的 false 压过了 pagination 的 true」
    const off = mountWithLayout({ isSmall: false }, { ...paginated, isSmall: true, size: 'default' })
    await off.$nextTick()
    expect(smallAttr(off)).toBeNull()
  })

  it('`size` 不再作为裸属性落到分页元素上（回归：此前渲染出 size="small"）', async () => {
    const vm = mountTable({ pagination: { ...paginated, size: 'large' } })
    await vm.$nextTick()
    expect(vm.$el.querySelector('el-pagination')?.getAttribute('size')).toBeNull()
  })
})

// 回归：列级 permissionValue 此前 schema+prompt+scorer 都认，组件 filteredColumns 却只按 hidCol
// 过滤 → 无权限的列照样渲染（假承诺）。接线后应与 hidCol 同层被过滤。
describe('EsTable(vue2) - 列级 permissionValue 门控', () => {
  const gateColumns = () => [
    { prop: 'id', label: 'ID' },
    { prop: 'salary', label: '工资', permissionValue: 'salary:view' },
  ]

  it('无权限的列不渲染，有权限的列正常渲染', async () => {
    const { configureEsPlus, resetGlobalConfig } = await import('@es-plus/core')
    try {
      configureEsPlus({ permission: (v: string) => v !== 'salary:view' })
      const vm = mountTable({ columns: gateColumns() })
      await vm.$nextTick()
      const table = tableOf(vm)
      expect(table.filteredColumns.map((c: any) => c.prop)).toEqual(['id'])
    } finally {
      resetGlobalConfig()
    }
  })

  it('未配置全局 permission 时一律放行', async () => {
    const vm = mountTable({ columns: gateColumns() })
    await vm.$nextTick()
    expect(tableOf(vm).filteredColumns).toHaveLength(2)
  })
})

// ── 尺寸契约：number | string 都必须是真能力（三端同规）──────────────────────
describe('EsTable(vue2) — 尺寸契约 number | string', () => {
  const heightOf = (props: Record<string, unknown>) => (tableOf(mountTable(props)).$el as HTMLElement).style.height

  it('height：数字 / 纯数字字符串 / px 字符串等价', async () => {
    expect(heightOf({ options: { heightType: 'height', height: 420 } })).toBe('420px')
    expect(heightOf({ options: { heightType: 'height', height: '420' } })).toBe('420px')
    expect(heightOf({ options: { heightType: 'height', height: '420px' } })).toBe('420px')
  })

  it('tabHeight：字符串被采纳（旧实现静默忽略）且优先于 height', () => {
    expect(heightOf({ options: { heightType: 'height', height: 420, tabHeight: '40px' } })).toBe('40px')
  })

  it('百分比等带单位字符串原样透传', () => {
    expect(heightOf({ options: { heightType: 'height', height: '70vh' } })).toBe('70vh')
  })
})

// ─── AN-09 前置非数据列合成（默认 el-table 引擎，对齐 vue3）──────────────
// 修前：multiSelect / snIndex / expand 只被 vxe 适配器消费，默认引擎完全无视。
describe('EsTable(vue2) — AN-09 前置列合成', () => {
  const types = (vm: any): Array<string | undefined> =>
    tableOf(vm).filteredColumns.map((c: any) => c.type)

  it('multiSelect + snIndex → 选择列、序号列前置', async () => {
    const vm = mountTable({ options: { multiSelect: true, snIndex: true } })
    await vm.$nextTick()
    expect(types(vm)).toEqual(['selection', 'index', undefined])
  })

  it('三开全开 → 选择 → 序号 → 展开', async () => {
    const vm = mountTable({ options: { multiSelect: true, snIndex: true, expand: true } })
    await vm.$nextTick()
    expect(types(vm)).toEqual(['selection', 'index', 'expand', undefined])
  })

  it('显式声明 type 列 → 不重复注入', async () => {
    const vm = mountTable({
      columns: [{ type: 'index', label: '序' }, { prop: 'id', label: 'ID' }],
      options: { snIndex: true },
    })
    await vm.$nextTick()
    expect(types(vm)).toEqual(['index', undefined])
  })

  // 同 vue3/antdv：判据看原始列。hidCol 的 type:'index' 仍算已声明，不得被合成列推翻。
  it('hidCol 的 type:index 列仍算已声明 → 不合成默认序号列', async () => {
    const vm = mountTable({
      columns: [{ type: 'index', hidCol: true }, { prop: 'id', label: 'ID' }],
      options: { snIndex: true },
    })
    await vm.$nextTick()
    expect(types(vm)).toEqual([undefined])
  })

  it('开关全关 → 不注入（默认行为不变）', async () => {
    const vm = mountTable({})
    await vm.$nextTick()
    expect(types(vm)).toEqual([undefined])
  })

  it('序号列取 core 默认值（宽 60 / 表头 #），不参与 width→minWidth 转换', async () => {
    const vm = mountTable({ options: { snIndex: true } })
    await vm.$nextTick()
    const col = tableOf(vm).filteredColumns.find((c: any) => c.type === 'index')
    expect(col).toMatchObject({ type: 'index', label: '#', width: 60 })
    expect(col.minWidth).toBeUndefined()
  })
})

// ─── AN-10 列选项（默认 el-table 引擎）────────────────────────────────────
// 与 vue3 同口径：契约键 `ellipsis` 在 columnBindAttr 里翻译成 Element UI 的
// `show-overflow-tooltip`（覆盖 render / scopedSlots / groups 分支），
// options.defaultSort 显式送到 el-table 的 default-sort。
// 本文件不加载真实 element-ui（见文件头），故 `el-table-column` 以未注册元素渲染，
// v-bind 的键会变成该元素的属性 —— 正好可直接断言翻译结果。
describe('EsTable(vue2) — AN-10 省略号 / 默认排序', () => {
  const firstColEl = (vm: any): HTMLElement =>
    vm.$el.querySelector('el-table-column') as HTMLElement
  // 两条来源属性名不同：模板里的字面量 `show-overflow-tooltip`（简单列分支）
  // 与 columnBindAttr 里的驼峰键（render/scopedSlots/groups 分支）—— DOM 属性名不区分大小写。
  const hasTooltip = (vm: any): boolean =>
    firstColEl(vm).hasAttribute('show-overflow-tooltip') ||
    firstColEl(vm).hasAttribute('showoverflowtooltip')

  it('ellipsis → el-table-column 上带 show-overflow-tooltip', async () => {
    const vm = mountTable({ columns: [{ prop: 'id', label: 'ID', ellipsis: true }] })
    await vm.$nextTick()
    expect(hasTooltip(vm)).toBe(true)
  })

  it('ellipsis + render：自定义单元格分支也带 show-overflow-tooltip（修前没有）', async () => {
    const vm = mountTable({
      columns: [
        {
          prop: 'id',
          label: 'ID',
          ellipsis: true,
          render: (h: any, { value }: any) => h('span', String(value ?? '')),
        },
      ],
    })
    await vm.$nextTick()
    expect(hasTooltip(vm)).toBe(true)
  })

  it('存量写法 showOverflowTooltip 原样透传（向后兼容）', async () => {
    const vm = mountTable({ columns: [{ prop: 'id', label: 'ID', showOverflowTooltip: true }] })
    await vm.$nextTick()
    expect(hasTooltip(vm)).toBe(true)
  })

  it('未设置省略号 → 不开 tooltip', async () => {
    const vm = mountTable({})
    await vm.$nextTick()
    expect(hasTooltip(vm)).toBe(false)
  })

  it('options.defaultSort → el-table 的 defaultSort 绑定', async () => {
    const vm = mountTable({ options: { defaultSort: { prop: 'id', order: 'descending' } } })
    await vm.$nextTick()
    const bind = tableOf(vm).tableBindAttrs
    // Vue 2.7 setup 返回值在实例上自动解包（computed → 普通对象）
    expect(bind.defaultSort).toEqual({ prop: 'id', order: 'descending' })
  })
})

// ─── 请求模式：空页不回显父级旧 dataSource ─────────────────────────────────
describe('EsTable(vue2) — 请求模式空页', () => {
  it('请求返回空页时不回显父级旧 dataSource', async () => {
    const httpRequest = vi.fn().mockResolvedValue({ total: 0, size: 10, page: 1, list: [] })
    const vm = mountTable({
      dataSource: [{ id: 1, name: '旧数据' }],
      options: {
        httpRequest,
        apiParams: { url: '/api/list' },
        configTableOut: { total: 'total', pageSize: 'size', current: 'page', tableData: 'list' },
        isInitRun: false,
      },
    })
    await vm.$nextTick()
    const table = tableOf(vm)
    await table.httpRequestInstance()
    await vm.$nextTick()
    expect(table.effectiveDataSource).toHaveLength(0)
  })
})
