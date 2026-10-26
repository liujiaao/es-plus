/**
 * 「订单批量处理」案例的 mock 后端 —— 三站共用同一份字节。
 *
 * 这一页演示三件平台能力（簇 C5 / C7 / C10）：
 *   · `tableBtns` —— 表格上方声明式工具栏按钮（批量通过 / 导出已选），带 confirm 确认语；
 *   · `tableOptions.multiSelect + cachePageSelection` —— 跨页勾选（换页后勾选不丢）；
 *   · `tableOptions.configTableOut` —— 后端信封与本库默认口径不同，**由配置声明映射**：
 *     本 mock 返回 `{ list, count }`，schema 里写的是 `{ tableData:'list', total:'count' }`。
 *
 * 因此这里刻意**不**按 `{ rows, records }` 作答：那一层差异正是案例要展示的东西。
 * 站点宿主（es-eui）只在案例没有声明 configTableOut 时才套用站点全局口径。
 *
 * 契约见 `employee-roster.mock.js` 文件头；本文件多用了 `handleRowAction` 的第三个参数
 * `ctx.selection`（宿主从 `<es-crud-page>` 的 getSelectedRows() 取当前勾选）。
 */

const sleep = (ms) => new Promise((resolve) => setTimeout(resolve, ms))

const CUSTOMERS = ['星海科技', '云和数科', '远洋物流', '启明零售', '恒达制造']
const CHANNELS = ['online', 'store', 'reseller']

/** 26 条：页大小 8，正好四页 —— 跨页勾选要有第二页才演示得出来。 */
const DB = Array.from({ length: 26 }, (_, i) => ({
  id: i + 1,
  orderNo: `SO-2026${String(1001 + i)}`,
  customer: CUSTOMERS[i % CUSTOMERS.length],
  channel: CHANNELS[i % CHANNELS.length],
  amount: ((1280 + i * 371) % 9000) + 100,
  status: i % 3 === 0 ? 0 : i % 3 === 1 ? 1 : 2,
  createTime: `2026-${String(1 + (i % 9)).padStart(2, '0')}-${String(1 + (i % 27)).padStart(2, '0')} 10:${String(i % 60).padStart(2, '0')}`,
}))

export function createPermission() {
  return () => true
}

export function createHttpRequest({ delay = 120 } = {}) {
  return async (params = {}) => {
    const { formParams = {} } = params
    const pageNo = params.pageNo || params.pageIndex || 1
    const pageSize = params.pageSize || 8
    if (delay) await sleep(delay)
    const no = String(formParams.orderNo || '').trim()
    const customer = String(formParams.customer || '').trim()
    const channel = String(formParams.channel || '').trim()
    const status = formParams.status
    const rows = DB.filter((row) => {
      if (no && !row.orderNo.includes(no)) return false
      if (customer && !row.customer.includes(customer)) return false
      if (channel && row.channel !== channel) return false
      if (status !== undefined && status !== '' && status !== null && Number(row.status) !== Number(status)) return false
      return true
    })
    const start = (pageNo - 1) * pageSize
    // 后端信封：list / count（不是本库默认的 rows / records）
    // 顺带按金额降序返回，与 schema 的 `defaultSort` 对齐：el-table 在本地排（同样的顺序），
    // a-table 的 `sorter: true` 是**服务端语义**（只切指示器、不排本地数据）—— 后端排好，
    // 三端首屏才是同一张表。
    const sorted = [...rows].sort((a, b) => b.amount - a.amount)
    return { list: sorted.slice(start, start + pageSize).map((row) => ({ ...row })), count: rows.length }
  }
}

/**
 * 表格工具栏按钮的副作用。`ctx.selection` 是宿主传进来的当前勾选行（跨页保留）。
 *
 * 返回字符串 = 宿主提示这句话并刷新表格；返回 null = 什么也不做。
 */
export function handleRowAction(key, _row, ctx = {}) {
  const selection = Array.isArray(ctx.selection) ? ctx.selection : []
  if (key === 'batch-approve') {
    if (!selection.length) return '请先勾选要处理的订单'
    for (const picked of selection) {
      const target = DB.find((row) => row.id === picked.id)
      if (target) target.status = 1
    }
    return `已通过 ${selection.length} 个订单`
  }
  if (key === 'export-selected') {
    if (!selection.length) return '请先勾选要导出的订单'
    return `已导出 ${selection.length} 行（示例不落盘）`
  }
  return null
}

/** 查看弹窗只读，确认后不改数据。 */
export function handleDialogConfirm() {
  return null
}

/** 调试/测试用快照。 */
export function listOrders() {
  return DB.map((row) => ({ ...row }))
}
