/**
 * 片段 fixture 的内存后端（AI-44）。
 *
 * 与 CRUD fixture 的 backend.ts 分开：片段场景里**每个片段自带自己的 apiUrl**
 * （`/api/users`、`/api/orders`），且 table-02 的 `configTableOut` 把
 * `{total, tableData}` 映射到 `{total, list}` —— 响应形状按 url 区分，
 * 不能沿用 CRUD 的「非增删改即列表」单出口。
 *
 * 计数与请求日志挂到 window.__backend，供 Playwright spec 断言
 * 「片段真的发了请求 / 真的提交了」。
 */
export interface FragmentRequest {
  url: string
  method: string
  data: Record<string, unknown>
}

export interface FragmentBackend {
  httpRequest: (req: Record<string, any>) => Promise<any>
  calls: {
    usersList: number
    ordersList: number
    submits: number
    requests: FragmentRequest[]
  }
  readonly users: Array<Record<string, unknown>>
  readonly orders: Array<Record<string, unknown>>
}

export function createFragmentBackend(): FragmentBackend {
  let users = [
    { id: 1, name: '张三', status: 1, amount: 12, createdAt: '2026-01-01' },
    { id: 2, name: '李四', status: 0, amount: 3.5, createdAt: '2026-01-02' },
  ]
  const orders = [
    { orderNo: 'SO-001', status: '待发货', amount: 100 },
    { orderNo: 'SO-002', status: '已发货', amount: 250 },
  ]
  const calls: FragmentBackend['calls'] = {
    usersList: 0,
    ordersList: 0,
    submits: 0,
    requests: [],
  }
  let nextId = 3

  const httpRequest = async (req: Record<string, any>) => {
    const url = String(req.url || '')
    const method = String(req.method || 'GET').toUpperCase()
    const data = (req.data ?? req.formParams ?? {}) as Record<string, unknown>
    calls.requests.push({ url, method, data })

    // 弹窗提交（composable / component 都发 POST 或 PUT）
    if (method === 'POST' || method === 'PUT') {
      calls.submits++
      if (method === 'POST') {
        users.push({ id: nextId++, ...data })
      } else {
        const id = Number(data.id)
        const i = users.findIndex((u) => Number(u.id) === id)
        if (i >= 0) users[i] = { ...users[i], ...data }
      }
      return { code: 0 }
    }

    if (url === '/api/users') {
      calls.usersList++
      // 默认 configTableOut：total→records、tableData→rows
      return { records: users.length, rows: users.slice() }
    }
    if (url === '/api/orders') {
      calls.ordersList++
      // frag-table-02 的 configTableOut: { total: 'total', tableData: 'list' }
      return { total: orders.length, list: orders.slice() }
    }

    // 静默兜底会让「片段发错 url」看起来像通过 —— 直接拒绝。
    throw new Error(`[fragments-backend] unknown url: ${method} ${url}`)
  }

  return {
    httpRequest,
    calls,
    get users() {
      return users
    },
    get orders() {
      return orders
    },
  }
}
