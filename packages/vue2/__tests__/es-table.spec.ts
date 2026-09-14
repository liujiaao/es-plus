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
