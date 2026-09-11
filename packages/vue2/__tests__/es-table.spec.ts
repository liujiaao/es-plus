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
  })
})
