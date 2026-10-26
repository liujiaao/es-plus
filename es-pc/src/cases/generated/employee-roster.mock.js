/**
 * 「员工花名册」案例的 mock 后端 —— 三站共用**同一份字节**。
 *
 * 边界与旗舰案例一致：`employee-roster.json` 是确定性生成器的产物（输入是
 * `employee-roster.config.json`，模型一次生成、未经手工修改的纯 JSON、0 个函数）；
 * 本文件是它背后的「服务端」：数据、请求、以及弹窗/按钮的副作用。真实项目里这三样
 * 来自后端，示例用内存模拟，好让三站打开就有一个能点的闭环。
 *
 * 由 `scripts/sync-cases.mjs` 从 manifest 分发到三站的 `src/cases/generated/`，
 * 禁止手改站点副本（`npm run cases:check` 会红）。
 *
 * ## 统一的案例 mock 契约（通用宿主 `AiCaseHost` 依赖它）
 *
 *   export function createPermission(controls) → (code) => boolean   // 可选
 *   export function createHttpRequest({ delay }) → (params) => rows/records/pageNo
 *   export function handleDialogConfirm(key, data, row) → string | null  // 可选
 *   export function handleRowAction(key, row) → string | null       // 可选
 *
 * 返回字符串 = 宿主提示这句话并刷新表格；返回 null/undefined = 什么也不做。
 * 第三个参数 `row` 是**打开弹窗时那一行**（宿主从 `dialog-open` 事件里记下的）：
 * 编辑弹窗的 formItems 里通常没有 `id`，不传 row 就没法定位要更新哪一条。
 * 三个站点（Element Plus / Element UI / Ant Design Vue）吃的都是这份契约，宿主页
 * 因此可以只有几十行，且与框架无关。
 */

let nextId = 15

const sleep = (ms) => new Promise((resolve) => setTimeout(resolve, ms))

/** 内存表：14 条，够翻两页（schema 的 pagination.pageSize 是 10）。 */
const DB = [
  { id: 1, employeeNo: 'E-1001', name: '张伟', dept: '研发中心', status: 1, hireDate: '2021-03-15' },
  { id: 2, employeeNo: 'E-1002', name: '李娜', dept: '产品部', status: 1, hireDate: '2020-07-01' },
  { id: 3, employeeNo: 'E-1003', name: '王强', dept: '研发中心', status: 1, hireDate: '2022-11-08' },
  { id: 4, employeeNo: 'E-1004', name: '刘洋', dept: '市场部', status: 0, hireDate: '2019-05-20' },
  { id: 5, employeeNo: 'E-1005', name: '陈静', dept: '财务部', status: 1, hireDate: '2023-02-13' },
  { id: 6, employeeNo: 'E-1006', name: '赵磊', dept: '研发中心', status: 1, hireDate: '2018-09-03' },
  { id: 7, employeeNo: 'E-1007', name: '孙悦', dept: '产品部', status: 0, hireDate: '2021-12-27' },
  { id: 8, employeeNo: 'E-1008', name: '周婷', dept: '市场部', status: 1, hireDate: '2022-04-18' },
  { id: 9, employeeNo: 'E-1009', name: '吴昊', dept: '财务部', status: 1, hireDate: '2020-01-06' },
  { id: 10, employeeNo: 'E-1010', name: '郑爽', dept: '研发中心', status: 0, hireDate: '2023-08-21' },
  { id: 11, employeeNo: 'E-1011', name: '冯磊', dept: '运营部', status: 1, hireDate: '2021-06-09' },
  { id: 12, employeeNo: 'E-1012', name: '许诺', dept: '运营部', status: 1, hireDate: '2024-01-15' },
  { id: 13, employeeNo: 'E-1013', name: '何静', dept: '产品部', status: 1, hireDate: '2022-09-30' },
  { id: 14, employeeNo: 'E-1014', name: '马超', dept: '市场部', status: 0, hireDate: '2019-11-11' },
]

/** 本案例没有权限码（schema 里没有 permissionValue）—— 一律放行。 */
export function createPermission() {
  return () => true
}

/**
 * es-table 请求契约：`{ pageNo, pageSize, formParams }` → 分页结果。
 *
 * 生成的 schema 只声明了 `apiParams.url`，没有 `configTableOut` —— 所以这里必须按
 * es-plus 的默认响应字段作答（`rows` / `records` / `pageNo`）。这正是「宿主适配后端」
 * 而不是「让模型去猜后端字段」的边界。
 */
export function createHttpRequest({ delay = 150 } = {}) {
  return async (params = {}) => {
    const { formParams = {} } = params
    const pageNo = params.pageNo || params.pageIndex || 1
    const pageSize = params.pageSize || 5
    if (delay) await sleep(delay)
    const name = String(formParams.name || '').trim()
    const dept = String(formParams.dept || '').trim()
    const status = formParams.status
    const rows = DB.filter((row) => {
      if (name && !row.name.includes(name)) return false
      if (dept && !row.dept.includes(dept)) return false
      if (status !== undefined && status !== '' && status !== null && Number(row.status) !== Number(status)) return false
      return true
    })
    const start = (pageNo - 1) * pageSize
    // 每行给**新对象**：真实后端每次响应都是新 JSON（同 purchase-approval.mock.js 的教训）
    const pageRows = rows.slice(start, start + pageSize).map((row) => ({ ...row }))
    return { rows: pageRows, records: rows.length, pageNo, pageSize }
  }
}

/** 弹窗确认：add 新建、edit 原地更新（用打开弹窗时的 row 定位）；其余（view）不改数据。 */
export function handleDialogConfirm(key, data = {}, row) {
  if (key === 'add') {
    const record = {
      id: nextId++,
      employeeNo: data.employeeNo,
      name: data.name,
      dept: data.dept,
      // 没选状态时按「在职」入库：新增的同事默认在职，比默认成「离职」更符合业务语义
      // （0 是合法取值，所以不能用 `Number(x) || 0` 之类把空值当 0）。
      status: data.status === undefined || data.status === null || data.status === '' ? 1 : Number(data.status),
      hireDate: data.hireDate || '',
    }
    DB.unshift(record)
    return `已新增：${record.name}（${record.employeeNo}）`
  }
  if (key === 'edit') {
    const id = Number(row?.id ?? data.id)
    const target = DB.find((item) => item.id === id)
    if (!target) return null
    Object.assign(target, {
      employeeNo: data.employeeNo ?? target.employeeNo,
      name: data.name ?? target.name,
      dept: data.dept ?? target.dept,
      status: data.status === undefined || data.status === null ? target.status : Number(data.status),
      hireDate: data.hireDate ?? target.hireDate,
    })
    return `已保存：${target.name}（${target.employeeNo}）`
  }
  return null
}

/** 行/工具按钮：本案例的按钮都由 dialogs 驱动（openDialog），故没有额外副作用。 */
export function handleRowAction() {
  return null
}

/** 全集快照（测试与宿主调试用）。 */
export function listEmployees() {
  return DB.map((row) => ({ ...row }))
}
