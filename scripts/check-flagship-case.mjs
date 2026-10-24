#!/usr/bin/env node
/**
 * 旗舰案例「合同审批工作台」守卫（F1）。
 *
 * 这一页的全部主张都能被静态断言：
 *   「一份纯 JSON 定义整页」 → schema 文件里不能出现任何函数值/函数式键；
 *   「三端跑同一份字节」     → 三站副本与单源逐字节相同；
 *   「跨页勾选 + 批量审批」   → multiSelect / cachePageSelection / rowkey 必须声明；
 *   「权限是配置」           → schema 里出现的每个 permissionValue 都在 mock 的
 *                              ROLE_PERMISSIONS 里登记，且 viewer 确实无权审批；
 *   「请求/权限不进 schema」   → 宿主页通过 http-request prop 注入，schema 只留 url。
 *
 * 为什么值得一条守卫：页面能跑 ≠ 卖点成立。往 schema 里塞一个 `(row) => …`，
 * 浏览器里一切正常 —— 只有「存库 / 下发 / 换端」时才炸；把 permissionValue 拼错、
 * 或某个角色漏登记，也只会静默少一个按钮。这些都无法靠肉眼 review 守住。
 *
 * 用法：node scripts/check-flagship-case.mjs
 * 退出码：0 = 通过；1 = 违反任一断言。
 */
import { readFileSync, existsSync } from 'node:fs'
import { fileURLToPath } from 'node:url'
import { dirname, join } from 'node:path'
import assert from 'node:assert/strict'

const ROOT = join(dirname(fileURLToPath(import.meta.url)), '..')
const read = (rel) => readFileSync(join(ROOT, rel), 'utf8')
const toLf = (s) => s.replace(/\r\n/g, '\n')

const SOURCE_SCHEMA = 'docs/cases/flagship-approval.json'
const SOURCE_MOCK = 'docs/cases/flagship-approval.mock.js'

const SITE_COPIES = [
  { site: 'es-plus-docs', schema: 'es-plus-docs/src/cases/flagship-approval.json', mock: 'es-plus-docs/src/cases/flagship-approval.mock.js' },
  { site: 'es-pc', schema: 'es-pc/src/cases/flagship-approval.json', mock: 'es-pc/src/cases/flagship-approval.mock.js' },
  { site: 'es-eui', schema: 'es-eui/src/cases/flagship-approval.json', mock: 'es-eui/src/cases/flagship-approval.mock.js' },
]

const HOSTS = [
  {
    site: 'es-plus-docs (Vue3 + Element Plus)',
    file: 'es-plus-docs/src/views/FlagshipApproval.vue',
    router: 'es-plus-docs/src/router/index.ts',
    routeRe: /path:\s*'\/flagship-approval'/,
    cases: 'es-plus-docs/src/views/Cases.vue',
  },
  {
    site: 'es-pc (Vue3 + Ant Design Vue)',
    file: 'es-pc/src/views/FlagshipApproval.vue',
    router: 'es-pc/src/router/index.js',
    routeRe: /path:\s*'flagship-approval'/,
    cases: 'es-pc/src/views/Cases.vue',
  },
  {
    site: 'es-eui (Vue2 + Element UI)',
    file: 'es-eui/src/views/flagship-approval.vue',
    router: 'es-eui/src/router/index.js',
    routeRe: /path:\s*'\/flagship-approval'/,
    cases: 'es-eui/src/views/cases.vue',
  },
]

let failed = 0
async function check(label, fn) {
  try {
    await fn()
    console.log(`  ✅ ${label}`)
  } catch (err) {
    failed++
    console.error(`  ❌ ${label}\n     ${err.message.split('\n')[0]}`)
  }
}

/** 从 core 源码现场解析算子白名单（不手抄，避免与运行时漂移）。 */
function readExprOps() {
  const src = read('packages/core/src/expr.ts')
  const m = src.match(/export const EXPR_OPS = Object\.freeze\(\[([\s\S]*?)\] as const\)/)
  assert.ok(m, 'packages/core/src/expr.ts 里找不到 EXPR_OPS 定义（结构变了？请同步本守卫）')
  const ops = [...m[1].matchAll(/'([^']+)'/g)].map((x) => x[1])
  assert.ok(ops.length > 0, 'EXPR_OPS 解析结果为空')
  return new Set(ops)
}

/** 若节点是表达式，断言其算子在白名单内。 */
function assertExprOps(node, ops, path) {
  if (Array.isArray(node)) {
    node.forEach((n, i) => assertExprOps(n, ops, `${path}[${i}]`))
    return
  }
  if (!node || typeof node !== 'object') return
  const keys = Object.keys(node)
  if (keys.length === 1) {
    const op = keys[0]
    assert.ok(ops.has(op), `${path} 使用了白名单外的表达式算子 "${op}"`)
    assertExprOps(node[op], ops, `${path}.${op}`)
    return
  }
  throw new Error(`${path} 是表达式节点但含 ${keys.length} 个键（${keys.join(', ')}）；表达式节点必须恰好一个算子键`)
}

/** 递归遍历 schema，收集 permissionValue 并揪出任何函数式键。 */
const FUNCTION_KEYS = new Set(['click', 'onConfirm', 'onOpen', 'onClose', 'render', 'formatter', 'httpRequest'])
function walk(node, path, visit) {
  if (Array.isArray(node)) {
    node.forEach((n, i) => walk(n, `${path}[${i}]`, visit))
    return
  }
  if (!node || typeof node !== 'object') return
  for (const [key, value] of Object.entries(node)) {
    const here = `${path}.${key}`
    visit(key, value, here)
    walk(value, here, visit)
  }
}

const schemaText = toLf(read(SOURCE_SCHEMA))
const schema = JSON.parse(schemaText)
const mockText = toLf(read(SOURCE_MOCK))
const ops = readExprOps()

console.log('[check:flagship-case] 合同审批工作台（F1）')

// ── 1. 纯 JSON：无函数式键、无函数体字符串 ──
await check('schema 是纯 JSON（无函数式键 / 无函数体字样）', () => {
  walk(schema, 'schema', (key, value, here) => {
    assert.ok(!FUNCTION_KEYS.has(key), `${here} 是函数式键（${key}）—— schema 必须是纯数据，函数由宿主注入`)
    if (typeof value === 'string') {
      assert.ok(!/=>|\bfunction\b/.test(value), `${here} 含函数体字样：${value.slice(0, 40)}`)
    }
  })
  assert.deepStrictEqual(JSON.parse(schemaText), schema, 'schema 经 JSON 往返后不相等（存在不可序列化的值）')
})

// ── 2. 卖点结构：跨页勾选 + 服务端分页 + 请求地址（函数不进来） ──
await check('tableOptions 声明了跨页勾选与分页契约', () => {
  const t = schema.tableOptions || {}
  assert.equal(t.multiSelect, true, 'tableOptions.multiSelect 必须为 true（批量审批依赖勾选）')
  assert.equal(t.cachePageSelection, true, 'tableOptions.cachePageSelection 必须为 true（否则翻页丢勾选）')
  assert.equal(t.rowkey, 'id', 'tableOptions.rowkey 必须是 id（勾选去重依赖稳定主键）')
  assert.ok(t.apiParams && typeof t.apiParams.url === 'string', 'tableOptions.apiParams.url 缺失')
  assert.ok(schema.pagination && schema.pagination.pageSize, 'pagination.pageSize 缺失')
})

// ── 3. 弹窗闭合：每个 dialogKey 都真有对应弹窗 ──
await check('每个 dialogKey 都指向 schema.dialogs 中的弹窗', () => {
  const dialogs = schema.dialogs || {}
  const keys = []
  for (const group of [schema.toolbarBtns || [], schema.tableBtns || []]) {
    group.forEach((b) => b.dialogKey && keys.push(b.dialogKey))
  }
  ;(schema.operationColumn?.btns || []).forEach((b) => b.dialogKey && keys.push(b.dialogKey))
  assert.ok(keys.length > 0, '没有任何按钮通过 dialogKey 打开弹窗')
  for (const key of keys) {
    assert.ok(dialogs[key], `dialogKey "${key}" 在 schema.dialogs 里不存在 —— 点了没反应`)
  }
})

// ── 4. 业务语义：详情只读、驳回必须填原因 ──
await check('详情弹窗只读、驳回弹窗原因必填', () => {
  const detail = schema.dialogs?.detail
  assert.ok(detail, '缺少 detail 弹窗')
  assert.equal(detail.isHiddenFooter, true, 'detail 必须 isHiddenFooter（只读详情不应出现确定按钮）')
  assert.ok(detail.formItems?.length > 0 && detail.formItems.every((f) => f.attrs?.disabled === true), 'detail 的所有字段都必须 disabled')

  const reject = schema.dialogs?.reject
  assert.ok(reject, '缺少 reject 弹窗')
  const field = reject.formItems?.find((f) => f.prop === 'rejectReason')
  assert.ok(field, 'reject 弹窗缺少 rejectReason 字段')
  const rules = field.formItemOptions?.rules || []
  assert.ok(
    rules.some((r) => r.required === true),
    'rejectReason 必须声明 required 规则（空原因不应能驳回）',
  )
})

// ── 5. 表达式算子白名单 + sanitizer 结构 ──
await check('reactions 只使用 EXPR_OPS 白名单算子', () => {
  const items = schema.formItems || []
  const clause = items.find((f) => f.prop === 'clauseTemplate')
  assert.ok(clause, '缺少 clauseTemplate 字段')
  assert.ok(Array.isArray(clause.reactions) && clause.reactions.length >= 3, 'clauseTemplate 至少需要 3 条联动规则')

  for (const [i, rule] of clause.reactions.entries()) {
    assert.ok(Array.isArray(rule.dependencies) && rule.dependencies.length > 0, `reactions[${i}] 缺少 dependencies`)
    if (rule.when !== undefined) assertExprOps(rule.when, ops, `clauseTemplate.reactions[${i}].when`)
    const f = rule.fulfill || {}
    for (const key of ['value', 'required', 'disabled']) {
      if (f[key] !== undefined) assertExprOps(f[key], ops, `clauseTemplate.reactions[${i}].fulfill.${key}`)
    }
  }
  // 「切换合同类型后清空不适用的条款模板」必须由一条 if 表达式完成（脏值清理是本案例的看点之一）
  const sanitizer = clause.reactions.find((r) => r.fulfill && r.fulfill.value && r.fulfill.value.if)
  assert.ok(sanitizer, '缺少用 if 表达式清理不相容 clauseTemplate 的 sanitizer 规则')
})

// ── 6. 权限：schema 用到的每个码都在 ROLE_PERMISSIONS 里，且 viewer 不能审批 ──
const mockUrl = 'data:text/javascript;base64,' + Buffer.from(mockText, 'utf8').toString('base64')
const mock = await import(mockUrl)

await check('mock 后端导出完整契约', () => {
  for (const name of ['ROLE_PERMISSIONS', 'createPermission', 'DETAIL_THRESHOLD', 'createHttpRequest', 'approveContracts', 'rejectContract', 'listContracts', 'toCsv']) {
    assert.ok(mock[name] !== undefined, `mock 未导出 ${name}`)
  }
  assert.equal(typeof mock.createPermission('admin'), 'function', 'createPermission 应返回判定函数')
  assert.equal(mock.createPermission('admin')('contract:approve'), true, 'admin 应拥有 contract:approve')
  assert.equal(mock.createPermission('viewer')('contract:approve'), false, 'viewer 不应拥有 contract:approve')
  assert.equal(mock.createPermission('nobody')('contract:view'), false, '未知角色应一律无权限')
})

await check('schema 的 permissionValue 全部登记在 ROLE_PERMISSIONS，且按角色有可见差异', () => {
  const used = new Set()
  walk(schema, 'schema', (key, value) => {
    if (key === 'permissionValue') used.add(value)
  })
  assert.ok(used.size >= 4, `permissionValue 覆盖面过窄（${[...used].join(', ')}）—— 案例应展示行级/列级/按钮级三种权限`)

  const declared = new Set(Object.values(mock.ROLE_PERMISSIONS).flat())
  for (const code of used) {
    assert.ok(declared.has(code), `permissionValue "${code}" 没有在任何角色里登记 —— 该按钮/列会永远隐藏`)
  }

  const perms = mock.ROLE_PERMISSIONS
  const viewer = new Set(perms.viewer || [])
  for (const code of ['contract:approve', 'contract:reject', 'contract:amount', 'contract:export']) {
    assert.ok(!viewer.has(code), `viewer 不应拥有 ${code} —— 切换角色后按钮/金额列必须真的消失`)
    assert.ok(perms.admin.includes(code), `admin 应拥有 ${code}（否则演示不完整）`)
  }
  assert.ok(perms.editor.includes('contract:approve') && !perms.editor.includes('contract:reject'), 'editor 应能通过但不能驳回（展示权限粒度）')
})

// ── 7. mock 请求契约（不依赖浏览器） ──
await check('createHttpRequest 遵守 es-table 的分页契约', async () => {
  const request = mock.createHttpRequest({ delay: 0 })
  const page1 = await request({ pageIndex: 1, pageSize: 5, formParams: {} })
  assert.ok(Array.isArray(page1.data) && page1.data.length === 5, '第 1 页应返回 5 行')
  assert.equal(typeof page1.total, 'number', '响应必须带 total')
  assert.equal(page1.pageIndex, 1, '响应应回显 pageIndex')
  assert.equal(page1.pageSize, 5, '响应应回显 pageSize')

  const page2 = await request({ pageIndex: 2, pageSize: 5, formParams: {} })
  assert.equal(page2.data.length, 5, '第 2 页应返回 5 行')
  const ids = new Set(page1.data.map((r) => r.id))
  assert.ok(page2.data.every((r) => !ids.has(r.id)), '第 2 页与第 1 页出现重复行（分页切片错误）')

  const filtered = await request({ pageIndex: 1, pageSize: 100, formParams: { contractType: '租赁合同' } })
  assert.ok(filtered.total > 0 && filtered.data.every((r) => r.contractType === '租赁合同'), '按合同类型过滤未生效')
})

await check('导出 CSV 带 BOM（Excel 打开不乱码）', () => {
  const csv = mock.toCsv(mock.listContracts())
  assert.ok(csv.startsWith('\uFEFF'), 'toCsv 输出必须以 BOM 开头')
  assert.ok(csv.split('\n').length >= 2, 'toCsv 至少应含表头 + 数据行')
})

// ── 8. 三站副本逐字节一致（单源三副本） ──
await check('三站副本与单源逐字节一致', () => {
  for (const copy of SITE_COPIES) {
    assert.ok(existsSync(join(ROOT, copy.schema)), `${copy.schema} 不存在（先跑 npm run cases:sync）`)
    assert.ok(existsSync(join(ROOT, copy.mock)), `${copy.mock} 不存在（先跑 npm run cases:sync）`)
    assert.equal(toLf(read(copy.schema)), schemaText, `${copy.schema} 与单源不一致 —— 运行 npm run cases:sync，不要手改站点副本`)
    assert.equal(toLf(read(copy.mock)), mockText, `${copy.mock} 与单源不一致 —— 运行 npm run cases:sync，不要手改站点副本`)
  }
})

// ── 9. 宿主接线：三站都加载单源、注入请求、接住行点击 ──
await check('三站宿主页接线完整（load 单源 / http-request / row-click）', () => {
  for (const host of HOSTS) {
    const src = toLf(read(host.file))
    assert.match(src, /@\/cases\/flagship-approval\.json/, `${host.file} 没有加载 @/cases/flagship-approval.json`)
    assert.match(src, /@\/cases\/flagship-approval\.mock\.js/, `${host.file} 没有加载 mock 后端`)
    assert.match(src, /:http-request="mockHttp"/, `${host.file} 没有通过 http-request 注入请求函数（schema 里不能有函数）`)
    assert.match(src, /@row-click="handleRowClick"/, `${host.file} 没有接住 row-click（金额 ≥ 阈值时打卡详情）`)
    assert.match(src, /DETAIL_THRESHOLD/, `${host.file} 没有引用 DETAIL_THRESHOLD（行点击阈值规则）`)
    assert.match(src, /:key="role"/, `${host.file} 没有在角色切换时重挂载（权限变化需重新过滤列/按钮）`)
    assert.match(src, /configureEsPlus\(\{ permission/, `${host.file} 没有把角色权限写进全局配置`)
  }
})

await check('角色切换先换权限、后重挂载（不依赖 UI 库 change 事件的时机）', () => {
  for (const host of HOSTS) {
    const src = toLf(read(host.file))
    // Element Plus 的 el-radio-group 在 nextTick 才 emit change —— 那时 :key 已用旧权限
    // 重建过一遍子树（表现为「慢一个角色」）。必须由 watcher 在同一 tick 内改配置。
    assert.ok(
      !/@change="(applyRole|handleRoleChange)"/.test(src),
      `${host.file} 仍用 @change 改权限：Element Plus 的 change 在 nextTick 才发，会「慢一个角色」`,
    )
    assert.match(
      src,
      /watch\(role|role\(next\)\s*\{/,
      `${host.file} 没有在角色 watcher 里更新权限（Vue3 用 watch(role, …)，Vue2 用 watch.role）`,
    )
  }
})

await check('宿主页模板引用的交互状态都已声明（Vue2 不会为未声明属性建响应）', () => {
  for (const host of HOSTS) {
    const src = toLf(read(host.file))
    for (const key of ['schemaVisible']) {
      if (!src.includes(key)) continue
      const declared =
        new RegExp(`const\\s+${key}\\s*=\\s*ref\\(`).test(src) || // Vue3 <script setup>
        new RegExp(`\\b${key}\\s*:`).test(src) // Vue2 data()
      assert.ok(declared, `${host.file} 模板用了 ${key}，脚本里却没声明 —— 点击不会触发重渲染`)
    }
  }
})

await check('三站路由与案例页入口已接线', () => {
  for (const host of HOSTS) {
    assert.match(toLf(read(host.router)), host.routeRe, `${host.router} 缺少 flagship-approval 路由`)
    assert.match(toLf(read(host.cases)), /flagship-approval/, `${host.cases} 没有指向旗舰案例的入口`)
  }
})

if (failed > 0) {
  console.error(`\n[check:flagship-case] 失败 ${failed} 项`)
  process.exit(1)
}

const permCount = new Set(
  (() => {
    const used = []
    walk(schema, 'schema', (k, v) => k === 'permissionValue' && used.push(v))
    return used
  })(),
).size
console.log(
  `\n[check:flagship-case] 通过：纯 JSON schema（${(schemaText.length / 1024).toFixed(1)} KB、0 个函数）、` +
    `${permCount} 个权限码、3 站副本一致、宿主/路由/入口均已接线`,
)
