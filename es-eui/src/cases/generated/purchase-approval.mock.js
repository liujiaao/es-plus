/**
 * 「一句话生成的采购申请页」的 mock 后端 —— 三站共用**同一份字节**。
 *
 * 边界与旗舰案例一致：`purchase-approval.json` 是 AI 生成、未经手工修改的页面定义
 * （纯 JSON、0 个函数）；本文件是它背后的「服务端」：数据、请求、权限。真实项目里
 * 这三样来自后端，示例用内存模拟，好让三站打开就有一个能点的闭环。
 *
 * 由 `scripts/sync-cases.mjs` 分发到三站的 `src/cases/generated/`，禁止手改站点副本
 * （`npm run cases:check` 会红）。
 */

/** 生成产物里唯一的权限码（operationColumn 的「通过」「驳回」）。 */
export const AUDIT_PERMISSION = 'approval:audit'

/**
 * 权限判定：`withAudit` 为 true 时放行审批码，否则一律拒绝。
 * 直接写成 `configureEsPlus({ permission })` 的入参。
 */
export function createPermission(withAudit) {
  return (code) => Boolean(withAudit) && code === AUDIT_PERMISSION
}

const DB = [
  { id: 1, applyNo: 'CG-2026-0001', applicant: '张伟', amount: 12800, status: 'pending', applyTime: '2026-10-20 09:12', rejectReason: '' },
  { id: 2, applyNo: 'CG-2026-0002', applicant: '李娜', amount: 3560, status: 'approved', applyTime: '2026-10-20 10:40', rejectReason: '' },
  { id: 3, applyNo: 'CG-2026-0003', applicant: '王强', amount: 86000, status: 'pending', applyTime: '2026-10-21 14:05', rejectReason: '' },
  { id: 4, applyNo: 'CG-2026-0004', applicant: '刘洋', amount: 1200, status: 'rejected', applyTime: '2026-10-21 16:30', rejectReason: '预算不足，请合并到下一批次' },
  { id: 5, applyNo: 'CG-2026-0005', applicant: '陈静', amount: 24500, status: 'approved', applyTime: '2026-10-22 08:55', rejectReason: '' },
  { id: 6, applyNo: 'CG-2026-0006', applicant: '赵磊', amount: 9800, status: 'pending', applyTime: '2026-10-22 11:20', rejectReason: '' },
  { id: 7, applyNo: 'CG-2026-0007', applicant: '孙悦', amount: 1520, status: 'rejected', applyTime: '2026-10-23 09:48', rejectReason: '缺少三家比价单' },
]

let nextId = DB.length + 1

const sleep = (ms) => new Promise((resolve) => setTimeout(resolve, ms))

/**
 * es-table 请求契约：`{ pageNo, pageSize, formParams }` → 分页结果。
 *
 * 注意返回的是 **默认响应字段**（`rows` / `records` / `pageNo`）：生成的 schema 并没有
 * 声明 `configTableOut`，所以这里必须按 es-plus 的默认契约作答 —— 这正是「宿主适配
 * 后端」而不是「让模型去猜后端字段」的边界。真实项目里这一层就是 `configTableOut`
 * 或一个包装函数。
 */
export function createHttpRequest({ delay = 180 } = {}) {
  return async (params = {}) => {
    const { formParams = {} } = params
    const pageNo = params.pageNo || params.pageIndex || 1
    const pageSize = params.pageSize || 10
    if (delay) await sleep(delay)
    const applyNo = String(formParams.applyNo || '').trim()
    const rows = DB.filter((row) => {
      if (applyNo && !row.applyNo.includes(applyNo)) return false
      if (formParams.status && row.status !== formParams.status) return false
      return true
    })
    const start = (pageNo - 1) * pageSize
    // 每行给**新对象**：真实后端每次响应都是新 JSON。直接返回 DB 里的对象引用，
    // 审批（原地改 status）后刷新时表格拿到的仍是同一批引用 —— Vue 检测不到变化，
    // 单元格会停留在旧状态（本例「通过」后行状态不刷新就是这么来的）。
    const pageRows = rows.slice(start, start + pageSize).map((row) => ({ ...row }))
    return { rows: pageRows, records: rows.length, pageNo, pageSize }
  }
}

/** 新增弹窗确认 → 落库（申请时间与状态由「服务端」补，模型没要求这两个字段必填）。 */
export function createRequest(data = {}) {
  const row = {
    id: nextId++,
    applyNo: data.applyNo,
    applicant: data.applicant,
    amount: Number(data.amount) || 0,
    status: data.status || 'pending',
    applyTime: new Date().toISOString().slice(0, 16).replace('T', ' '),
    rejectReason: data.rejectReason || '',
  }
  DB.unshift(row)
  return row
}

/** 「通过」：只有待审批的单子能过（重复点击不改写已审批记录）。 */
export function approveRequest(id) {
  const row = DB.find((item) => item.id === id)
  if (!row || row.status !== 'pending') return false
  row.status = 'approved'
  return true
}

/** 「驳回」：写入原因。 */
export function rejectRequest(id, reason) {
  const row = DB.find((item) => item.id === id)
  if (!row || row.status !== 'pending') return false
  row.status = 'rejected'
  row.rejectReason = reason
  return true
}

/** 全集快照。 */
export function listRequests() {
  return DB.map((row) => ({ ...row }))
}
