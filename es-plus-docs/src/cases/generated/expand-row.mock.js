/**
 * 「展开行明细」案例的 mock 后端 —— 三站共用同一份字节。
 *
 * 演示一件纯声明式结构能力（簇 C8）：`expandConfig` —— 每行点开是一条只读字段表
 * （负责人 / 风险等级 / 条款摘要 / 最近复核），内容是纯 JSON，不是渲染函数；
 * 生成器把它变成一列表头为空的 `type: 'expand'` 列，排在数据列之前。
 *
 * 为什么单独一个案例：Element Plus 的 `wrappedRowRender` 是**二选一**分支 ——
 * 一旦存在 expand 列（`hasExpandColumn`），树表分支（treeData）就永远走不到，
 * 也就是说「树表 + 展开行」在同一张表上不成立（el-table 源码 render-helper.mjs）。
 * 故树表留在 org-tree-table，展开行独立成本案例，两个令牌都各自可验证。
 *
 * 契约见 `employee-roster.mock.js` 文件头。
 */

const sleep = (ms) => new Promise((resolve) => setTimeout(resolve, ms))

const CUSTOMERS = ['星海科技', '云和数科', '远洋物流', '启明零售', '恒达制造', '明德咨询']
const OWNERS = ['张伟', '陈静', '孙悦', '周婷']
const RISKS = ['低', '中', '高']
const CLAUSES = [
  '按季度结算，逾期 30 日可单方解约。',
  '含保密条款；违约方按合同额 20% 赔付。',
  '验收通过后 15 个工作日内付清尾款。',
  '服务期 12 个月，到期自动续约一年。',
]

/** 18 条：页大小 8，翻页后仍能随手演示展开行。 */
const DB = Array.from({ length: 18 }, (_, i) => ({
  id: i + 1,
  contractNo: `HT-2026${String(1001 + i)}`,
  customer: CUSTOMERS[i % CUSTOMERS.length],
  amount: 40 + ((i * 37) % 260),
  signDate: `2026-${String(1 + (i % 9)).padStart(2, '0')}-${String(1 + (i % 27)).padStart(2, '0')}`,
  phase: i % 3,
  owner: OWNERS[i % OWNERS.length],
  risk: RISKS[i % RISKS.length],
  clause: CLAUSES[i % CLAUSES.length],
  lastReview: `2026-${String(9 + (i % 2)).padStart(2, '0')}-${String(1 + (i % 20)).padStart(2, '0')}`,
}))

export function createPermission() {
  return () => true
}

export function createHttpRequest({ delay = 120 } = {}) {
  return async (params = {}) => {
    if (delay) await sleep(delay)
    const { formParams = {} } = params
    const pageNo = params.pageNo || params.pageIndex || 1
    const pageSize = params.pageSize || 8
    const no = String(formParams.contractNo || '').trim()
    const customer = String(formParams.customer || '').trim()
    const rows = DB.filter((row) => {
      if (no && !row.contractNo.includes(no)) return false
      if (customer && !row.customer.includes(customer)) return false
      return true
    })
    const start = (pageNo - 1) * pageSize
    return { rows: rows.slice(start, start + pageSize).map((row) => ({ ...row })), records: rows.length, pageNo, pageSize }
  }
}

/** 详情弹窗只读（字段全 disabled），确认后不改数据。 */
export function handleDialogConfirm() {
  return null
}

export function handleRowAction() {
  return null
}

/** 调试/测试用快照。 */
export function listRows() {
  return DB.map((row) => ({ ...row }))
}
