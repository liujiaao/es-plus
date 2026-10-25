/**
 * 演示后端 —— 全局 httpRequest 的落点。
 *
 * 站点入口（main.js）把它一次性交给 ES-Plus：
 *
 *   app.use(ESPlus, { httpRequest: demoHttpRequest })
 *
 * 于是任何声明了 `apiParams` 的表格 / 表单都不再需要自己传请求函数 —— 这正是
 * 「配置即数据」的前提：schema 里不能出现函数，请求函数只能来自入口。
 *
 * 边界：只实现 `/api/demo/*` 的只读接口；别的地址直接 reject，避免演示站点
 * 悄悄吃掉真实请求（也避免「配错了也看不出来」）。
 */
import { reactive } from 'vue'

export interface DemoRequestLog {
  /** 全局函数被调用的次数（含分页、查询） */
  count: number
  /** 最近一次请求的可观察快照 —— 示例把它摊在页面上，证明请求真的走了全局函数 */
  last: { method: string; url: string; query: string; rows: number; total: number } | null
}

export const demoRequestLog = reactive<DemoRequestLog>({ count: 0, last: null })

const CUSTOMERS = ['杭州云启科技', '上海沐石贸易', '深圳恒佳电子', '成都风行文化', '北京启明医疗', '广州南野食品']
const CHANNELS = ['官网', '小程序', '门店']

/** 37 条订单：三个状态都出现，翻页与筛选都能看到变化 */
const ORDERS = Array.from({ length: 37 }, (_, i) => {
  const n = i + 1
  return {
    id: n,
    orderNo: `SO-2026-${1000 + n}`,
    customer: CUSTOMERS[i % CUSTOMERS.length],
    channel: CHANNELS[i % CHANNELS.length],
    amount: 1280 + ((i * 617) % 8600),
    status: i % 7 === 4 ? 2 : i % 4 === 0 ? 1 : 0,
    createTime:
      `2026-${String((i % 9) + 1).padStart(2, '0')}-${String((i % 27) + 1).padStart(2, '0')} ` +
      `${String(9 + (i % 9)).padStart(2, '0')}:${String((i * 13) % 60).padStart(2, '0')}`,
  }
})

/** 后端该做的事：筛选 → 分页。参数名与表格发出的 formParams 一致 */
function filterOrders(formParams: Record<string, any>) {
  const keyword = String(formParams.keyword ?? '').trim().toLowerCase()
  const status = formParams.status
  return ORDERS.filter((o) => {
    if (keyword && !`${o.orderNo}${o.customer}`.toLowerCase().includes(keyword)) return false
    // 0 是合法状态（待发货），不能用 truthy 判断
    if (status !== '' && status !== undefined && status !== null && o.status !== Number(status)) return false
    return true
  })
}

function queryText(parts: Record<string, unknown>) {
  return Object.entries(parts)
    .filter(([, v]) => v !== '' && v !== undefined && v !== null)
    .map(([k, v]) => `${k}=${v}`)
    .join('&')
}

/** 签名与 TableOptions.httpRequest 一致：{ url, method, formParams, headers } */
export function demoHttpRequest(params: Record<string, any> = {}): Promise<unknown> {
  const url = String(params.url || '')
  const method = String(params.method || 'GET').toUpperCase()
  const formParams = (params.formParams || {}) as Record<string, any>

  if (!url.startsWith('/api/demo/')) {
    return Promise.reject(new Error(`[演示后端] 只实现 /api/demo/*，收到 ${method} ${url}`))
  }

  const pageIndex = Math.max(1, Number(formParams.pageIndex) || 1)
  const pageSize = Math.max(1, Number(formParams.pageSize) || 10)
  const rows = filterOrders(formParams)
  const data = rows.slice((pageIndex - 1) * pageSize, pageIndex * pageSize)

  demoRequestLog.count += 1
  demoRequestLog.last = {
    method,
    url,
    query: queryText({
      keyword: formParams.keyword,
      status: formParams.status,
      pageIndex,
      pageSize,
    }),
    rows: data.length,
    total: rows.length,
  }

  // 留 160ms 网络延迟：加载态、并发序号这些真实行为才看得见
  return new Promise((resolve) => {
    setTimeout(() => resolve({ data, total: rows.length, pageIndex, pageSize }), 160)
  })
}
