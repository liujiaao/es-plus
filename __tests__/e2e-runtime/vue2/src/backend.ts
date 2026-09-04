/**
 * 内存后端 —— 唯一的 httpRequest 缝，路由靠 url，替代真实服务端。
 * 与 Tier 1（vue3 / adapter-antdv 的 crud-runtime.spec.ts）的 createInMemoryBackend 同构，
 * 唯一区别是去掉 vitest 断言、并把实例挂到 window.__backend 供 Playwright spec 读取计数。
 *
 * 列表返回 { records, rows }，对齐 EsTable default configTableField 映射
 * （total→records, tableData→rows）。
 */
export interface Backend {
  httpRequest: (req: Record<string, any>) => Promise<any>
  calls: { list: number; create: number; update: number; remove: number }
  readonly store: Array<Record<string, unknown>>
}

export function createInMemoryBackend(seed: Array<Record<string, unknown>>): Backend {
  let store = seed.map((r) => ({ ...r }))
  let nextId = Math.max(0, ...store.map((r) => Number(r.id) || 0)) + 1
  const calls = { list: 0, create: 0, update: 0, remove: 0 }

  const httpRequest = async (req: Record<string, any>) => {
    const { url = '', formParams = {}, pageIndex = 1, pageSize = 10 } = req
    if (url === '/api/create') {
      calls.create++
      store.push({ id: nextId++, ...formParams })
      return { code: 0 }
    }
    if (url === '/api/update') {
      calls.update++
      const i = store.findIndex((r) => r.id === formParams.id)
      if (i >= 0) store[i] = { ...store[i], ...formParams }
      return { code: 0 }
    }
    if (url === '/api/delete') {
      calls.remove++
      store = store.filter((r) => r.id !== formParams.id)
      return { code: 0 }
    }
    calls.list++
    const start = (Number(pageIndex) - 1) * Number(pageSize)
    return { records: store.length, rows: store.slice(start, start + Number(pageSize)) }
  }

  return {
    httpRequest,
    calls,
    get store() {
      return store
    },
  }
}
