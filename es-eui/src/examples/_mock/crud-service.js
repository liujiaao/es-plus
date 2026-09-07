/**
 * 共享「假后端」CRUD 服务 —— 供所有远程 CRUD 案例复用
 *
 * 目的：现有案例要么读 dummyjson（只读），要么直接 mutate 本地数组，
 *   无法演示「请求延迟 / loading / 失败回滚 / 增删改后 refetch」等真实闭环。
 *   本模块提供一个内存版后端：支持分页、过滤、排序、增删改查、批量、批量导入，
 *   并可注入网络延迟与错误，用于健壮性案例（乐观更新回滚、422 字段错误等）。
 *
 * 用法：每个案例在 setup() 内 `const api = createEmployeeService()` 得到一份
 *   独立数据副本（互不干扰），响应结构统一为 { data, total, pageIndex, pageSize }，
 *   直接对接 EsTable 的 httpRequest + configTableOut。
 */

const DEPARTMENTS = ['技术部', '产品部', '市场部', '设计部', '运营部']
const POSITIONS = ['工程师', '高级工程师', '架构师', '经理', '总监']
const STATUSES = ['active', 'leave']

// 统一延迟，模拟网络往返
function delay(ms = 320) {
  return new Promise((resolve) => setTimeout(resolve, ms))
}

// 业务错误：携带可选的字段级错误（模拟服务端 422 校验）
export class ApiError extends Error {
  constructor(message, fields) {
    super(message)
    this.name = 'ApiError'
    this.fields = fields || null // { [prop]: message }
  }
}

function makeSeed(count) {
  return Array.from({ length: count }, (_, i) => {
    const id = i + 1
    return {
      id,
      name: `员工${id}`,
      department: DEPARTMENTS[i % DEPARTMENTS.length],
      position: POSITIONS[i % POSITIONS.length],
      salary: 8000 + (i % 20) * 700,
      status: i % 6 === 0 ? 'leave' : 'active',
      email: `user${id}@example.com`,
      phone: `138${String(10000000 + id).slice(0, 8)}`,
      joinDate: `20${18 + (i % 6)}-${String((i % 12) + 1).padStart(2, '0')}-15`
    }
  })
}

/**
 * 创建一份独立的员工 CRUD 服务。
 * @param {object} [opts]
 * @param {number} [opts.seedCount=48] 初始行数
 * @param {number} [opts.latency=320]  默认延迟(ms)
 */
export function createEmployeeService(opts = {}) {
  const { seedCount = 48, latency = 320 } = opts
  let db = makeSeed(seedCount)
  let idSeq = seedCount

  // 服务端过滤逻辑（关键字/部门/状态/职位）
  const applyFilter = (rows, f = {}) => {
    let out = rows
    if (f.keyword) out = out.filter((r) => r.name.includes(f.keyword) || r.email.includes(f.keyword))
    if (f.department) out = out.filter((r) => r.department === f.department)
    if (f.status) out = out.filter((r) => r.status === f.status)
    if (f.position) out = out.filter((r) => r.position.includes(f.position))
    return out
  }

  // 简单字段校验，命中则抛 ApiError（模拟 422）
  const validate = (payload) => {
    const fields = {}
    if (!payload.name || !String(payload.name).trim()) fields.name = '姓名不能为空'
    else if (db.some((r) => r.name === payload.name && r.id !== payload.id)) fields.name = '姓名已存在'
    if (payload.salary != null && Number(payload.salary) < 0) fields.salary = '薪资不能为负'
    if (Object.keys(fields).length) throw new ApiError('数据校验失败', fields)
  }

  return {
    /** 当前内存快照（只读用途，如批量导入前查重） */
    snapshot: () => db.map((r) => ({ ...r })),

    /**
     * 列表查询：服务端过滤 + 排序 + 分页。
     * @param {{ formParams?: object, pageIndex?: number, pageSize?: number, sort?: {field:string, order:'asc'|'desc'} }} params
     */
    async list(params = {}) {
      await delay(latency)
      const { formParams = {}, pageIndex = 1, pageSize = 10, sort } = params
      let rows = applyFilter(db, formParams)
      if (sort && sort.field && sort.order) {
        const dir = sort.order === 'desc' ? -1 : 1
        rows = [...rows].sort((a, b) => (a[sort.field] > b[sort.field] ? dir : a[sort.field] < b[sort.field] ? -dir : 0))
      }
      const start = (pageIndex - 1) * pageSize
      return {
        data: rows.slice(start, start + pageSize).map((r) => ({ ...r })),
        total: rows.length,
        pageIndex,
        pageSize
      }
    },

    /** 按 id 拉取最新详情（编辑前刷新 / 详情抽屉） */
    async get(id) {
      await delay(latency)
      const found = db.find((r) => r.id === id)
      if (!found) throw new ApiError('记录不存在')
      return { ...found }
    },

    /**
     * 新增。opts.fail=true 强制失败（用于回滚演示）。
     */
    async create(payload, o = {}) {
      await delay(latency)
      if (o.fail) throw new ApiError('网络异常，新增失败')
      validate(payload)
      const record = { ...payload, id: ++idSeq }
      db.unshift(record)
      return { ...record }
    },

    /**
     * 更新。opts.fail=true 强制失败（用于乐观更新回滚演示）。
     */
    async update(id, patch, o = {}) {
      await delay(latency)
      if (o.fail) throw new ApiError('网络异常，更新失败')
      const target = db.find((r) => r.id === id)
      if (!target) throw new ApiError('记录不存在')
      validate({ ...target, ...patch, id })
      Object.assign(target, patch)
      return { ...target }
    },

    /** 删除单条 */
    async remove(id, o = {}) {
      await delay(latency)
      if (o.fail) throw new ApiError('网络异常，删除失败')
      const idx = db.findIndex((r) => r.id === id)
      if (idx > -1) db.splice(idx, 1)
      return { success: true }
    },

    /** 批量删除 */
    async batchRemove(ids) {
      await delay(latency)
      const set = new Set(ids)
      db = db.filter((r) => !set.has(r.id))
      return { success: true, count: set.size }
    },

    /** 批量更新字段（如批量改部门/状态） */
    async batchUpdate(ids, patch) {
      await delay(latency)
      const set = new Set(ids)
      let count = 0
      db.forEach((r) => {
        if (set.has(r.id)) {
          Object.assign(r, patch)
          count++
        }
      })
      return { success: true, count }
    },

    /**
     * 批量导入：逐行校验，返回成功数与错误行（行号 + 原因），
     * 用于导入案例的错误行标注。合法行全部落库。
     */
    async bulkCreate(rows) {
      await delay(latency)
      const errors = []
      const valid = []
      const seenNames = new Set(db.map((r) => r.name))
      rows.forEach((row, i) => {
        const rowNo = i + 1
        if (!row.name) { errors.push({ row: rowNo, message: '姓名为空' }); return }
        if (seenNames.has(row.name)) { errors.push({ row: rowNo, message: `姓名「${row.name}」重复` }); return }
        if (row.salary != null && Number(row.salary) < 0) { errors.push({ row: rowNo, message: '薪资非法' }); return }
        seenNames.add(row.name)
        valid.push(row)
      })
      valid.forEach((row) => db.unshift({ ...row, id: ++idSeq }))
      return { created: valid.length, failed: errors.length, errors }
    }
  }
}

export const DEPARTMENT_OPTIONS = DEPARTMENTS.map((d) => ({ label: d, value: d }))
export const POSITION_OPTIONS = POSITIONS.map((p) => ({ label: p, value: p }))
export const STATUS_OPTIONS = [
  { label: '在职', value: 'active' },
  { label: '离职', value: 'leave' }
]
export const STATUS_MAP = { active: ['在职', 'success'], leave: ['离职', 'danger'] }
export { DEPARTMENTS, POSITIONS, STATUSES }
