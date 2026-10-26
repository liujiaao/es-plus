/**
 * 「分组报表」案例的 mock 后端 —— 三站共用同一份字节。
 *
 * 演示两件纯声明式结构能力（簇 C8）：
 *   · `mergeConfig: { rowsBy: ['dept','team'] }` —— 相邻同值的这两列合并成一个单元格
 *     （跨端同一语义；不需要写 spanMethod 函数）；
 *   · `tableOptions.defaultSort` —— 首屏按金额降序，生成器同时给该列补 `sortable`，
 *     否则 el-table 不会显示排序状态（这是 AN-10 的已知坑）。
 *
 * 数据按「部门 → 小组」成组排列：合并只对**相邻**同值生效，所以 mock 里保持分组顺序，
 * 不重新洗牌 —— 这正是报表该有的样子。
 *
 * 契约见 `employee-roster.mock.js` 文件头。
 */

const sleep = (ms) => new Promise((resolve) => setTimeout(resolve, ms))

/**
 * 分组顺序表：[部门, 小组, 两名负责人]。
 * 数据必须**按组连续排列** —— 合并只认相邻同值：部门跨两个小组（4 行）合并、
 * 小组跨两名负责人（2 行）合并，报表才是那个样子。
 */
const GROUPS = [
  ['研发中心', '平台组', ['张伟', '王强']],
  ['研发中心', '前端组', ['陈静', '赵磊']],
  ['产品中心', '设计组', ['孙悦', '林岚']],
  ['产品中心', '内容组', ['周婷', '许敏']],
  ['运营中心', '增长组', ['许诺', '何川']],
]

/** 5 组 × 2 名负责人 = 10 行；页大小 8 正好两页，且分页边界落在整组之间。 */
const DB = GROUPS.flatMap(([dept, team, owners], g) =>
  owners.map((owner, j) => {
    const seq = g * owners.length + j
    return {
      id: seq + 1,
      dept,
      team,
      owner,
      amount: 120 + ((seq * 53) % 400),
      target: 300 + ((seq * 31) % 200),
      period: '2026-10',
    }
  })
)

export function createPermission() {
  return () => true
}

export function createHttpRequest({ delay = 120 } = {}) {
  return async (params = {}) => {
    if (delay) await sleep(delay)
    const { formParams = {} } = params
    const pageNo = params.pageNo || params.pageIndex || 1
    const pageSize = params.pageSize || 8
    const dept = String(formParams.dept || '').trim()
    const team = String(formParams.team || '').trim()
    const rows = DB.filter((row) => {
      if (dept && !row.dept.includes(dept)) return false
      if (team && !row.team.includes(team)) return false
      return true
    })
    const start = (pageNo - 1) * pageSize
    return { rows: rows.slice(start, start + pageSize).map((row) => ({ ...row })), records: rows.length, pageNo, pageSize }
  }
}

/** 明细弹窗只读。 */
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
