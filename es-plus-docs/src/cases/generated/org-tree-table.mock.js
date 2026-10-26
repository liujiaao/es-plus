/**
 * 「组织架构表」案例的 mock 后端 —— 三站共用同一份字节。
 *
 * 演示两件声明式结构能力（簇 C8）：
 *   · `treeConfig: { childrenField: 'children' }` —— 每行的嵌套子数组即子节点，
 *     表格据此渲染层级（不需要宿主拼树、也不需要 vxe）；
 *   · `expandConfig` —— 每一行都能展开成一张只读字段表（备注 / 编制 / 预算），
 *     内容是纯 JSON，不是渲染函数。
 *
 * 数据是**嵌套**的：树表要求子节点挂在父行的 childrenField 上，而不是平铺后按
 * parentId 现场构树 —— 后者要写函数，就不是声明式了。
 *
 * 契约见 `employee-roster.mock.js` 文件头。
 */

const sleep = (ms) => new Promise((resolve) => setTimeout(resolve, ms))

const TREE = [
  {
    id: 1,
    deptName: '研发中心',
    leader: '张伟',
    headcount: 86,
    budget: 1200,
    note: '下设平台组、前端组、测试组；含两个外包席位。',
    children: [
      { id: 11, deptName: '平台组', leader: '王强', headcount: 32, budget: 480, note: '负责 core / generator / 三端适配。' },
      { id: 12, deptName: '前端组', leader: '陈静', headcount: 28, budget: 400, note: '负责站点与示例。' },
      { id: 13, deptName: '测试组', leader: '赵磊', headcount: 26, budget: 320, note: 'golden 语料与 e2e 运行时。' },
    ],
  },
  {
    id: 2,
    deptName: '产品中心',
    leader: '李娜',
    headcount: 34,
    budget: 520,
    note: '产品设计与文档站内容。',
    children: [
      { id: 21, deptName: '设计组', leader: '孙悦', headcount: 18, budget: 300, note: '三端视觉一致性。' },
      { id: 22, deptName: '内容组', leader: '周婷', headcount: 16, budget: 220, note: '示例叙事与 API 文档。' },
    ],
  },
  { id: 3, deptName: '职能中心', leader: '刘洋', headcount: 22, budget: 260, note: '人力 / 财务 / 行政。' },
]

let nextId = 100

/** 递归找节点（新增/编辑都按 id 定位，树里平铺一层也要能找到）。 */
function findNode(nodes, id) {
  for (const node of nodes) {
    if (node.id === id) return node
    if (Array.isArray(node.children)) {
      const hit = findNode(node.children, id)
      if (hit) return hit
    }
  }
  return null
}

export function createPermission() {
  return () => true
}

/** 树表一次给完整棵树（页大小 20 > 节点数），分页不会切断父子关系。 */
export function createHttpRequest({ delay = 120 } = {}) {
  return async (params = {}) => {
    if (delay) await sleep(delay)
    const { formParams = {} } = params
    const name = String(formParams.deptName || '').trim()
    const leader = String(formParams.leader || '').trim()
    const keep = (node) => {
      if (!name && !leader) return true
      const selfHit = (!name || node.deptName.includes(name)) && (!leader || String(node.leader || '').includes(leader))
      const childHit = Array.isArray(node.children) && node.children.some(keep)
      return selfHit || childHit
    }
    // 过滤保留祖先链：只命中子节点时父节点也要在，否则树就断了。
    const prune = (nodes) =>
      nodes.filter(keep).map((node) => ({
        ...node,
        ...(Array.isArray(node.children) ? { children: prune(node.children) } : {}),
      }))
    const rows = prune(TREE)
    return { rows, records: rows.length, pageNo: 1, pageSize: 20 }
  }
}

export function handleDialogConfirm(key, data = {}, row) {
  if (key === 'add') {
    const record = {
      id: nextId++,
      deptName: data.deptName,
      leader: data.leader || '',
      headcount: Number(data.headcount) || 0,
      budget: 0,
      note: '新增部门（示例数据）',
    }
    TREE.push(record)
    return `已新增：${record.deptName}`
  }
  if (key === 'edit') {
    const target = findNode(TREE, Number(row?.id ?? data.id))
    if (!target) return null
    Object.assign(target, {
      deptName: data.deptName ?? target.deptName,
      leader: data.leader ?? target.leader,
      headcount: data.headcount === undefined || data.headcount === null ? target.headcount : Number(data.headcount),
    })
    return `已保存：${target.deptName}`
  }
  return null
}

export function handleRowAction() {
  return null
}

/** 调试/测试用快照（深拷贝，避免测试改到内存表）。 */
export function listDepartments() {
  return JSON.parse(JSON.stringify(TREE))
}
