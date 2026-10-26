/**
 * 「引擎实验室」案例的 mock 后端 —— 三站共用同一份字节。
 *
 * 一页同时验证三颗引擎相关的令牌（簇 C8）：
 *   · `tableOptions.engine: 'vxe'` —— 换引擎只是配置里的一个枚举值（`vxeFirstClass`）；
 *   · `virtualScroll` —— vxe 引擎自带虚拟滚动，所以敢给 5000 行（默认引擎会卡）；
 *   · `inlineEdit` —— `tableOptions.editConfig` + 列级 `editRender`，双击金额/数量原地改。
 *
 * 5000 行是**生成**的，不写字面量：案例要证明的是「大数据量下仍然可点」，
 * 而不是让人读 5000 行 JSON。
 *
 * 契约见 `employee-roster.mock.js` 文件头。行内编辑产生的新值由 vxe 自己维持
 * （keepSource），本 mock 不做写回 —— 真实项目在这里接一个保存接口。
 */

const sleep = (ms) => new Promise((resolve) => setTimeout(resolve, ms))

const TOTAL = 5000

const CUSTOMERS = ['星海科技', '云和数科', '远洋物流', '启明零售', '恒达制造', '中科智造']
const STATUS = ['待发货', '已发货', '已取消']

/** 惰性构一次，之后按页切片（每行都返回**新对象**：真实后端每次响应都是新 JSON）。 */
let DB = null
function db() {
  if (!DB) {
    DB = Array.from({ length: TOTAL }, (_, i) => ({
      id: i + 1,
      orderNo: `SO-${String(100000 + i)}`,
      customer: CUSTOMERS[i % CUSTOMERS.length],
      amount: ((1000 + i * 7) % 9900) + 0.5,
      qty: (i % 40) + 1,
      status: STATUS[i % 3],
    }))
  }
  return DB
}

export function createPermission() {
  return () => true
}

export function createHttpRequest({ delay = 80 } = {}) {
  return async (params = {}) => {
    if (delay) await sleep(delay)
    const { formParams = {} } = params
    const pageNo = params.pageNo || params.pageIndex || 1
    const pageSize = params.pageSize || 50
    const orderNo = String(formParams.orderNo || '').trim()
    const customer = String(formParams.customer || '').trim()
    const all = db()
    const rows = orderNo || customer
      ? all.filter((row) => (!orderNo || row.orderNo.includes(orderNo)) && (!customer || row.customer.includes(customer)))
      : all
    const start = (pageNo - 1) * pageSize
    return { rows: rows.slice(start, start + pageSize).map((row) => ({ ...row })), records: rows.length, pageNo, pageSize }
  }
}

/** 查看弹窗只读。 */
export function handleDialogConfirm() {
  return null
}

/** 本案例没有工具栏按钮。 */
export function handleRowAction() {
  return null
}

export const totalOrders = TOTAL
