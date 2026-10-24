/**
 * 旗舰案例「合同审批工作台」的 mock 后端 —— 三站共用**同一份字节**。
 *
 * 边界：`flagship-approval.json` 是页面定义（纯 JSON、0 个函数）；本文件是它背后的
 * 「服务端」：数据、请求、权限表。真实项目里这三样都来自后端，示例里用内存模拟，
 * 好让三站打开就有一个能点的业务闭环，而不是一张假表格。
 *
 * 由 `scripts/sync-cases.mjs` 分发到 es-plus-docs / es-pc / es-eui 的 `src/cases/`，
 * 禁止手改站点副本（`npm run cases:check` 会红）。
 */

/** 角色 → 权限码。schema 里出现的每个 permissionValue 都必须在这里登记。 */
export const ROLE_PERMISSIONS = {
  admin: ['contract:view', 'contract:approve', 'contract:reject', 'contract:amount', 'contract:export'],
  editor: ['contract:view', 'contract:approve', 'contract:export'],
  viewer: ['contract:view'],
}

/** 权限码 → 判定函数（写进 configureEsPlus({ permission })）。 */
export function createPermission(role) {
  const codes = ROLE_PERMISSIONS[role] || []
  return (code) => codes.includes(code)
}

/** 审批阈值：点行内金额 ≥ 100 万的合同会弹出审批详情（宿主页面的一行业务规则）。 */
export const DETAIL_THRESHOLD = 1000000

const DB = [
  { id: 1, contractNo: 'HT-2026-0001', title: '办公用品年度采购框架', customer: '杭州云启科技有限公司', contractType: '采购合同', clauseTemplate: '标准采购条款 v2', amount: 1280000, amountText: '1,280,000.00', status: '待审批', approver: '', createdAt: '2026-10-08', rejectReason: '' },
  { id: 2, contractNo: 'HT-2026-0002', title: '数据中心运维外包', customer: '江苏博远信息技术有限公司', contractType: '服务合同', clauseTemplate: '运维服务条款 v1', amount: 860000, amountText: '860,000.00', status: '待审批', approver: '', createdAt: '2026-10-09', rejectReason: '' },
  { id: 3, contractNo: 'HT-2026-0003', title: '深圳研发中心办公场地租赁', customer: '深圳前海置业有限公司', contractType: '租赁合同', clauseTemplate: '房屋租赁条款 v3', amount: 2400000, amountText: '2,400,000.00', status: '已通过', approver: '王敏', createdAt: '2026-10-01', rejectReason: '' },
  { id: 4, contractNo: 'HT-2026-0004', title: '市场物料设计服务', customer: '上海创想广告有限公司', contractType: '服务合同', clauseTemplate: '创意服务条款 v2', amount: 180000, amountText: '180,000.00', status: '待审批', approver: '', createdAt: '2026-10-10', rejectReason: '' },
  { id: 5, contractNo: 'HT-2026-0005', title: '服务器整机采购', customer: '北京华胜天成股份有限公司', contractType: '采购合同', clauseTemplate: '标准采购条款 v2', amount: 3600000, amountText: '3,600,000.00', status: '待审批', approver: '', createdAt: '2026-10-11', rejectReason: '' },
  { id: 6, contractNo: 'HT-2026-0006', title: '商标代理服务', customer: '北京知产律师事务所', contractType: '服务合同', clauseTemplate: '法律服务条款 v1', amount: 96000, amountText: '96,000.00', status: '已驳回', approver: '李强', createdAt: '2026-10-02', rejectReason: '报价超出年度预算，请重新询价' },
  { id: 7, contractNo: 'HT-2026-0007', title: '华东仓储租赁', customer: '苏州物流园发展有限公司', contractType: '租赁合同', clauseTemplate: '仓储租赁条款 v2', amount: 1150000, amountText: '1,150,000.00', status: '待审批', approver: '', createdAt: '2026-10-12', rejectReason: '' },
  { id: 8, contractNo: 'HT-2026-0008', title: '员工体检服务', customer: '美年大健康产业集团', contractType: '服务合同', clauseTemplate: '运维服务条款 v1', amount: 240000, amountText: '240,000.00', status: '待审批', approver: '', createdAt: '2026-10-12', rejectReason: '' },
  { id: 9, contractNo: 'HT-2026-0009', title: '快递物流年度服务', customer: '顺丰速运有限公司', contractType: '服务合同', clauseTemplate: '运维服务条款 v1', amount: 320000, amountText: '320,000.00', status: '已通过', approver: '王敏', createdAt: '2026-10-03', rejectReason: '' },
  { id: 10, contractNo: 'HT-2026-0010', title: '分子公司 ERP 实施', customer: '用友网络科技股份有限公司', contractType: '服务合同', clauseTemplate: '运维服务条款 v1', amount: 4800000, amountText: '4,800,000.00', status: '待审批', approver: '', createdAt: '2026-10-13', rejectReason: '' },
  { id: 11, contractNo: 'HT-2026-0011', title: '广州办事处办公家具采购', customer: '广州欧派家居集团', contractType: '采购合同', clauseTemplate: '框架采购条款 v4', amount: 260000, amountText: '260,000.00', status: '待审批', approver: '', createdAt: '2026-10-14', rejectReason: '' },
  { id: 12, contractNo: 'HT-2026-0012', title: '北京展厅场地租赁', customer: '北京国贸物业管理有限公司', contractType: '租赁合同', clauseTemplate: '仓储租赁条款 v2', amount: 1800000, amountText: '1,800,000.00', status: '待审批', approver: '', createdAt: '2026-10-15', rejectReason: '' },
]

const sleep = (ms) => new Promise((resolve) => setTimeout(resolve, ms))

/**
 * 造一个符合 es-table 契约的 httpRequest（`{ pageIndex, pageSize, formParams }` → 分页结果）。
 * schema 里只写 `apiParams.url`，函数通过 `configureEsPlus({ httpRequest })` 注入 ——
 * 于是同一份 JSON 在三站都能跑，而页面定义里不出现任何函数。
 */
export function createHttpRequest({ delay = 220 } = {}) {
  return async ({ pageIndex = 1, pageSize = 5, formParams = {} } = {}) => {
    if (delay) await sleep(delay)
    const keyword = String(formParams.keyword || '').trim()
    const rows = DB.filter((row) => {
      if (keyword) {
        const hit = [row.contractNo, row.title, row.customer].some((field) => field.includes(keyword))
        if (!hit) return false
      }
      if (formParams.contractType && row.contractType !== formParams.contractType) return false
      if (formParams.clauseTemplate && row.clauseTemplate !== formParams.clauseTemplate) return false
      if (formParams.status && row.status !== formParams.status) return false
      return true
    })
    const start = (pageIndex - 1) * pageSize
    return { data: rows.slice(start, start + pageSize), total: rows.length, pageIndex, pageSize }
  }
}

/** 批量通过：只处理「待审批」的合同，其余计入 skipped（重复点击不会篡改已审批记录）。 */
export function approveContracts(ids, approver = '王敏') {
  const targets = new Set(ids)
  let approved = 0
  let skipped = 0
  DB.forEach((row) => {
    if (!targets.has(row.id)) return
    if (row.status !== '待审批') {
      skipped += 1
      return
    }
    row.status = '已通过'
    row.approver = approver
    approved += 1
  })
  return { approved, skipped }
}

/** 驳回：写入原因与审批人。 */
export function rejectContract(id, reason, approver = '王敏') {
  const row = DB.find((item) => item.id === id)
  if (!row || row.status !== '待审批') return false
  row.status = '已驳回'
  row.rejectReason = reason
  row.approver = approver
  return true
}

/** 全集快照（导出兜底用；选中行优先）。 */
export function listContracts() {
  return DB.map((row) => ({ ...row }))
}

/** 把若干行转成 CSV 文本（带 BOM，Excel 直接打开不乱码）。 */
export function toCsv(rows) {
  const header = ['合同编号', '合同名称', '客户', '类型', '条款模板', '金额', '状态', '审批人', '提交时间']
  const cells = (row) => [row.contractNo, row.title, row.customer, row.contractType, row.clauseTemplate, row.amountText, row.status, row.approver, row.createdAt]
  const escape = (value) => {
    const text = String(value ?? '')
    return /[",\n]/.test(text) ? `"${text.replace(/"/g, '""')}"` : text
  }
  const lines = [header.map(escape).join(','), ...rows.map((row) => cells(row).map(escape).join(','))]
  return '\uFEFF' + lines.join('\n')
}
