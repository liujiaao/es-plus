#!/usr/bin/env node
/**
 * F7「一句话 → 页面」守卫。
 *
 * 这一页的主张都是可静态断言的：
 *   「AI 写的 JSON 直接能跑」  → schema 是纯 JSON（0 个函数、无函数式键），且真的用到了
 *                                reactions / permissionValue / operationColumn / dataOptions；
 *   「产物未经手工修改」        → meta 记录 NL / 命令 / 模型 / 时间，NL 里声明的权限码与
 *                                schema 实际使用的一致（对不上说明产物与说法脱节）；
 *   「条件必填是模型写出来的」  → reactions 只用 EXPR_OPS 白名单算子，且 rejectReason 同时有
 *                                isHidden + required（两者缺一，浏览器里就不成立）；
 *   「权限是宿主注入的」        → schema 的权限码都能被 mock 放行/拒绝，且开关能真的关掉；
 *   「三端跑同一份字节」        → 3 份产物 × 3 站副本与单源逐字节一致；
 *   「按钮名就是事件标识」      → 生成的行按钮没有 key，三端渲染器都实现了 key||name 兜底，
 *                                宿主按「通过」「驳回」分派；
 *   「这一页可复现」            → T5 证据模板（方法/产物/实测数据/边界/术语折叠）齐全，
 *                                产物体积、行数、函数数、计数全部对着文件重算，
 *                                复现命令与 meta.command 逐字一致，内部代号只出现在折叠块里。
 *
 * 用法：node scripts/check-generated-case.mjs
 * 退出码：0 = 通过；1 = 违反任一断言。
 */
import { readFileSync, existsSync } from 'node:fs'
import { fileURLToPath } from 'node:url'
import { dirname, join } from 'node:path'
import assert from 'node:assert/strict'

const ROOT = join(dirname(fileURLToPath(import.meta.url)), '..')
const read = (rel) => readFileSync(join(ROOT, rel), 'utf8')
const toLf = (s) => s.replace(/\r\n/g, '\n')

const SOURCES = {
  schema: 'docs/cases/generated/purchase-approval.json',
  meta: 'docs/cases/generated/purchase-approval.meta.json',
  mock: 'docs/cases/generated/purchase-approval.mock.js',
  story: 'docs/cases/generated/purchase-approval.story.json',
}

const SITES = ['es-plus-docs', 'es-pc', 'es-eui']

const HOSTS = [
  {
    site: 'es-plus-docs (Vue3 + Element Plus)',
    file: 'es-plus-docs/src/views/AiGenerated.vue',
    router: 'es-plus-docs/src/router/index.ts',
    routeRe: /path:\s*'\/ai-generated'/,
    cases: 'es-plus-docs/src/views/Cases.vue',
  },
  {
    site: 'es-pc (Vue3 + Ant Design Vue)',
    file: 'es-pc/src/views/AiGenerated.vue',
    router: 'es-pc/src/router/index.js',
    routeRe: /path:\s*'ai-generated'/,
    cases: 'es-pc/src/views/Cases.vue',
  },
  {
    site: 'es-eui (Vue2 + Element UI)',
    file: 'es-eui/src/views/ai-generated.vue',
    router: 'es-eui/src/router/index.js',
    routeRe: /path:\s*'\/ai-generated'/,
    cases: 'es-eui/src/views/cases.vue',
  },
]

/** 三个渲染器的 crud-page：按钮事件标识兜底必须都在（生成产物依赖它）。 */
const RENDERERS = [
  'packages/vue3/src/components/es-crud-page/src/es-crud-page.vue',
  'packages/vue2/src/components/es-crud-page/es-crud-page.vue',
  'packages/adapter-antdv/src/components/es-crud-page/src/es-crud-page.vue',
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

const schemaText = toLf(read(SOURCES.schema))
const schema = JSON.parse(schemaText)
const meta = JSON.parse(toLf(read(SOURCES.meta)))
const mockText = toLf(read(SOURCES.mock))
const ops = readExprOps()

console.log('[check:generated-case] 一句话 → 页面（F7）')

// ── 1. 纯 JSON ──
await check('schema 是纯 JSON（无函数式键 / 无函数体字样）', () => {
  walk(schema, 'schema', (key, value, here) => {
    assert.ok(!FUNCTION_KEYS.has(key), `${here} 是函数式键（${key}）—— 生成产物必须是纯数据`)
    if (typeof value === 'string') {
      assert.ok(!/=>|\bfunction\b/.test(value), `${here} 含函数体字样：${value.slice(0, 40)}`)
    }
  })
  assert.deepStrictEqual(JSON.parse(schemaText), schema, 'schema 经 JSON 往返后不相等（存在不可序列化的值）')
})

// ── 2. 出处：meta 完整，且 NL 里声明的权限码与 schema 实际使用的一致 ──
await check('meta 记录了 NL / 命令 / 模型 / 时间，且与 schema 对得上', () => {
  for (const key of ['id', 'title', 'nl', 'generator', 'command', 'model', 'generatedAt', 'attempts', 'target', 'mode']) {
    assert.ok(meta[key] !== undefined && meta[key] !== '', `meta 缺少 ${key}`)
  }
  assert.match(meta.generator, /--ai/, 'meta.generator 必须记录 AI 生成入口（es-plus create --ai）')
  assert.equal(meta.mode, 'schema', 'F7 展示的是 schema 模式产物（纯 JSON，不是包装 SFC）')
  assert.ok(Number.isInteger(meta.attempts) && meta.attempts >= 1, 'meta.attempts 必须是正整数')
  assert.match(meta.generatedAt, /^\d{4}-\d{2}-\d{2}/, 'meta.generatedAt 必须是 ISO 日期')

  const used = new Set()
  walk(schema, 'schema', (key, value) => {
    if (key === 'permissionValue') used.add(value)
  })
  assert.ok(used.size > 0, 'schema 里没有任何 permissionValue —— F7 主打之一就是它')
  for (const code of used) {
    assert.ok(meta.nl.includes(code), `schema 用了权限码 "${code}"，但 meta.nl 里没有声明它 —— 产物与需求已脱节`)
  }
})

// ── 3. 卖点结构：reactions / permissionValue / operationColumn / dataOptions ──
await check('schema 覆盖四条卖点结构（reactions / permissionValue / operationColumn / dataOptions）', () => {
  const hasReactions = []
  walk(schema, 'schema', (key, value, here) => {
    if (key === 'reactions') hasReactions.push(here)
  })
  assert.ok(hasReactions.length > 0, 'schema 里没有 reactions（条件必填的卖点缺失）')

  const rowBtns = schema.operationColumn?.btns || []
  assert.ok(rowBtns.length >= 2, 'operationColumn.btns 至少要有 2 个按钮')
  assert.ok(
    rowBtns.some((b) => typeof b.permissionValue === 'string' && b.permissionValue),
    'operationColumn 的按钮里没有 permissionValue（行级权限卖点缺失）',
  )

  const columns = schema.columns || []
  const coded = columns.find((c) => Array.isArray(c.dataOptions) && c.dataOptions.length > 0)
  assert.ok(coded, '没有任何列声明 dataOptions（码值列卖点缺失）')
  assert.ok(
    coded.dataOptions.some((o) => o.tagType),
    'dataOptions 没有 tagType —— 状态列应显示为彩色标签',
  )
})

// ── 4. 条件必填真的闭合：reactions 算子合法 + rejectReason 隐藏与必填并存 ──
await check('reactions 只用 EXPR_OPS 白名单算子', () => {
  walk(schema, 'schema', (key, value, here) => {
    if (key !== 'reactions') return
    assert.ok(Array.isArray(value) && value.length > 0, `${here} 必须是数组`)
    value.forEach((rule, i) => {
      assert.ok(Array.isArray(rule.dependencies) && rule.dependencies.length > 0, `${here}[${i}] 缺少 dependencies`)
      if (rule.when !== undefined) assertExprOps(rule.when, ops, `${here}[${i}].when`)
      const fulfill = rule.fulfill || {}
      for (const k of ['value', 'required', 'disabled']) {
        if (fulfill[k] !== undefined) assertExprOps(fulfill[k], ops, `${here}[${i}].fulfill.${k}`)
      }
    })
  })
})

await check('驳回原因：默认隐藏 + 选「已驳回」后必填（isHidden 与 required 成对）', () => {
  const items = []
  walk(schema, 'schema', (key, value, here) => {
    if (key === 'formItems' && Array.isArray(value)) {
      value.forEach((f, i) => items.push({ field: f, path: `${here}[${i}]` }))
    }
  })
  const target = items.find(({ field }) => field.prop === 'rejectReason' && field.isHidden)
  assert.ok(target, '找不到同时带 isHidden 的 rejectReason 字段')

  const { field } = target
  assert.equal(field.isHidden.field, 'status', 'rejectReason 的 isHidden 应依赖 status')
  const requiredExpr = (field.reactions || []).map((r) => r.fulfill?.required).find(Boolean)
  assert.ok(requiredExpr, 'rejectReason 没有 reactions.fulfill.required —— 显示出来也不会必填')
  assertExprOps(requiredExpr, ops, 'rejectReason.reactions.fulfill.required')

  // 必填必须**只**由 reactions 派生：静态 required（或静态 required 规则）会让字段在隐藏时
  // 也参与校验 —— 明明没显示却报「请填写驳回原因」，这正是要避免的。
  const staticRequired =
    field.required === true || (field.formItemOptions?.rules || []).some((r) => r.required === true)
  assert.ok(!staticRequired, 'rejectReason 声明了静态 required —— 隐藏状态下也会被校验，必须改由 reactions 派生')
})

// ── 5. 权限确实由宿主注入，且能真的关掉 ──
const mockUrl = 'data:text/javascript;base64,' + Buffer.from(mockText, 'utf8').toString('base64')
const mock = await import(mockUrl)

await check('mock 后端导出完整契约，权限开关真的生效', () => {
  for (const name of ['AUDIT_PERMISSION', 'createPermission', 'createHttpRequest', 'createRequest', 'approveRequest', 'rejectRequest', 'listRequests']) {
    assert.ok(mock[name] !== undefined, `mock 未导出 ${name}`)
  }
  assert.equal(mock.createPermission(true)(mock.AUDIT_PERMISSION), true, 'WithAudit 时审批码应放行')
  assert.equal(mock.createPermission(false)(mock.AUDIT_PERMISSION), false, '关掉开关后审批码必须被拒绝')
  assert.equal(mock.createPermission(true)('other:code'), false, '不认识的权限码不应放行')

  const used = new Set()
  walk(schema, 'schema', (key, value) => {
    if (key === 'permissionValue') used.add(value)
  })
  for (const code of used) {
    assert.equal(code, mock.AUDIT_PERMISSION, `schema 用了 "${code}"，但 mock 只处理 ${mock.AUDIT_PERMISSION} —— 该按钮会永远隐藏`)
  }
})

// ── 6. mock 请求与审批语义 ──
await check('createHttpRequest 按默认响应契约作答（rows / records / pageNo），且过滤生效', async () => {
  const before = mock.listRequests().length
  const request = mock.createHttpRequest({ delay: 0 })
  // 生成的 schema 没有 configTableOut ⇒ es-table 走默认契约（见 core/constants.ts
  // DEFAULT_CONFIG_TABLE_OUT）；mock 必须按默认字段回答，否则页面「暂无数据」。
  const page = await request({ pageNo: 1, pageSize: 3, formParams: {} })
  assert.ok(Array.isArray(page.rows), '响应缺少 rows（默认 tableData 字段）')
  assert.equal(page.rows.length, Math.min(3, before), '第 1 页行数不对')
  assert.equal(page.records, before, '响应 records 应等于全集行数（默认 total 字段）')
  assert.equal(page.pageNo, 1, '响应应回显 pageNo')

  const filtered = await request({ pageNo: 1, pageSize: 100, formParams: { status: 'pending' } })
  assert.ok(filtered.records > 0 && filtered.rows.every((r) => r.status === 'pending'), '按状态过滤未生效')
})

await check('通过/驳回只能作用于待审批单，且写入驳回原因', () => {
  const pending = mock.listRequests().find((r) => r.status === 'pending')
  assert.ok(pending, 'mock 数据里没有待审批行 —— 演示脚本无从点起')

  assert.equal(mock.approveRequest(pending.id), true, '待审批单应能通过')
  assert.equal(mock.approveRequest(pending.id), false, '已审批单不应被重复通过')
  assert.equal(mock.rejectRequest(pending.id, 'x'), false, '已通过的单不应还能驳回')

  const another = mock.listRequests().find((r) => r.status === 'pending')
  assert.ok(another, 'mock 数据只剩不到两份待审批单')
  assert.equal(mock.rejectRequest(another.id, '预算不足'), true, '待审批单应能驳回')
  assert.equal(mock.listRequests().find((r) => r.id === another.id).rejectReason, '预算不足', '驳回原因未落库')

  const created = mock.createRequest({ applyNo: 'CG-TEST', applicant: '测试', amount: '100' })
  assert.equal(created.status, 'pending', '新增默认状态应为待审批')
  assert.equal(typeof created.amount, 'number', '金额应转成数字')
})

// ── 7. 三站副本逐字节一致 ──
await check('三站副本与单源逐字节一致（4 份产物 × 3 站）', () => {
  for (const site of SITES) {
    for (const [kind, name] of Object.entries({
      schema: 'purchase-approval.json',
      meta: 'purchase-approval.meta.json',
      mock: 'purchase-approval.mock.js',
      story: 'purchase-approval.story.json',
    })) {
      const copy = `${site}/src/cases/generated/${name}`
      assert.ok(existsSync(join(ROOT, copy)), `${copy} 不存在（先跑 npm run cases:sync）`)
      const source = toLf(read(SOURCES[kind]))
      assert.equal(toLf(read(copy)), source, `${copy} 与单源不一致 —— 运行 npm run cases:sync，不要手改站点副本`)
    }
  }
})

// ── 8. 运行契约：行按钮没有 key，三端渲染器都以按钮名兜底 ──
await check('生成的行按钮不带 key，三端渲染器实现了 key||name 兜底', () => {
  const rowBtns = schema.operationColumn?.btns || []
  assert.ok(rowBtns.length > 0, 'operationColumn.btns 为空')
  const named = rowBtns.filter((b) => !b.key && b.name)
  assert.ok(named.length >= 2, '本案例依赖「未声明 key 的命名按钮」，产物里已不是这个形态')
  for (const file of RENDERERS) {
    const src = toLf(read(file))
    assert.match(src, /btn\.key \|\| btn\.name/, `${file} 缺少「未声明 key 时以按钮名兜底」的实现`)
  }
})

// ── 9. 宿主接线 ──
await check('三站宿主页加载单源产物、注入请求与权限、按按钮名分派', () => {
  for (const host of HOSTS) {
    const src = toLf(read(host.file))
    assert.match(src, /@\/cases\/generated\/purchase-approval\.json/, `${host.file} 没有加载生成的 schema`)
    assert.match(src, /@\/cases\/generated\/purchase-approval\.meta\.json/, `${host.file} 没有加载 meta（出处要可追溯）`)
    assert.match(src, /@\/cases\/generated\/purchase-approval\.mock\.js/, `${host.file} 没有加载 mock 后端`)
    assert.match(src, /:http-request="mockHttp"/, `${host.file} 没有通过 http-request 注入请求函数`)
    assert.match(src, /:key="String\(withAudit\)"/, `${host.file} 没有在权限开关切换时重挂载`)
    assert.match(src, /configureEsPlus\(\{ permission/, `${host.file} 没有把权限写进全局配置`)
    assert.match(src, /@btn-click="handleBtnClick"/, `${host.file} 没有接住 btn-click`)
    assert.match(src, /'通过'/, `${host.file} 没有按「通过」分派（生成的按钮没有 key，只能按名）`)
    assert.match(src, /'驳回'/, `${host.file} 没有按「驳回」分派`)
  }
})

await check('权限开关先换权限、后重挂载（Vue3 用 sync watcher，Vue2 用 watch 选项）', () => {
  for (const host of HOSTS) {
    const src = toLf(read(host.file))
    const ok = /watch\(withAudit[\s\S]*?flush:\s*'sync'/.test(src) || /withAudit\(next\)\s*\{/.test(src)
    assert.ok(ok, `${host.file} 没有在 withAudit 变化时同步更新权限（否则重挂载时读到的还是旧权限）`)
  }
})

await check('离开页面恢复全局权限（权限是全局配置，不能泄漏到别的页面）', () => {
  for (const host of HOSTS) {
    const src = toLf(read(host.file))
    // Vue3 宿主用 onUnmounted，Vue2 宿主用 beforeDestroy —— 两者都必须把 permission
    // 恢复成「全放行」，否则关着审批开关离开本页时，approval:audit 的拒绝会跟着用户
    // 走进之后访问的每一个页面（示例站是单页应用，全局配置活得比路由久）。
    const restore =
      /onUnmounted\(\(\) => configureEsPlus\(\{ permission: \(\) => true \}\)\)/.test(src) ||
      /beforeDestroy\(\)\s*\{[\s\S]*?configureEsPlus\(\{ permission: \(\) => true \}\)/.test(src)
    assert.ok(restore, `${host.file} 没有在卸载时恢复全局权限（离开页面后其他页面的按钮会被误拦）`)
  }
})

await check(
  '响应字段契约：三站按各自后端口径取数（es-eui 有全局历史映射，宿主负责适配）',
  () => {
    // 产物没声明 configTableOut —— 它不知道后端长什么样。所以 mock 按 es-plus 的默认契约
    // 作答（rows / records / pageNo），另两站直接可用。
    const mock = toLf(read(SOURCES.mock))
    assert.match(mock, /return \{ rows: pageRows, records: rows\.length, pageNo, pageSize \}/)

    for (const host of HOSTS) {
      const src = toLf(read(host.file))
      if (host.site.startsWith('es-eui')) {
        // 本站 main.js 注册了历史项目沿用的全局映射（data / total / pageIndex），优先级
        // 高于默认契约。宿主必须把标准响应转成本站口径，否则表格静默为空（只有 total 0，
        // 没有报错 —— 这个坑真的踩过）。
        const main = toLf(read('es-eui/src/main.js'))
        assert.match(
          main,
          /configQueryFieldOutput[\s\S]*?tableData:\s*'data'/,
          'es-eui/src/main.js 的全局响应映射变了，宿主适配层的前提不成立',
        )
        assert.match(src, /data:\s*res\.rows/, `${host.file} 没有把 rows 适配成本站的 data`)
        assert.match(src, /total:\s*res\.records/, `${host.file} 没有把 records 适配成本站的 total`)
        assert.match(src, /pageIndex:\s*res\.pageNo/, `${host.file} 没有把 pageNo 适配成本站的 pageIndex`)
      } else {
        assert.doesNotMatch(
          src,
          /data:\s*res\.rows/,
          `${host.file} 不该有响应字段适配层（这些站点走默认契约）`,
        )
      }
    }
  },
)

// ── 10. 路由与案例页入口 ──
await check('三站路由与案例页入口已接线', () => {
  for (const host of HOSTS) {
    assert.match(toLf(read(host.router)), host.routeRe, `${host.router} 缺少 ai-generated 路由`)
    assert.match(toLf(read(host.cases)), /ai-generated/, `${host.cases} 没有指向生成产物页的入口`)
  }
})

/* ------------------------------------------------------------------ *
 * T5 AI 证据模板（路线图 2.6）：用户任务标题 → 一句话结论 → 30 秒演示
 * → 方法 / 产物 / 实测数据 / 边界 → 术语折叠。文案单源 story.json，
 * 三站渲染同一份；能在产物里重算的数字一律重算比对。
 * ------------------------------------------------------------------ */
const storyText = toLf(read(SOURCES.story))
const story = JSON.parse(storyText)
const nonEmptyLines = (rel) => read(rel).split('\n').filter((l) => l.trim()).length
const countFunctions = (node) => {
  if (typeof node === 'function') return 1
  if (!node || typeof node !== 'object') return 0
  return Object.values(node).reduce((n, v) => n + countFunctions(v), 0)
}
/** 查询区与各弹窗的 formItems 全收进来 —— 本页的条件必填在两个弹窗里，只看顶层会数成 0。 */
function allFormItems(node, acc = []) {
  walk(node, 'schema', (key, value) => {
    if (key === 'formItems' && Array.isArray(value)) acc.push(...value)
  })
  return acc
}
/** 内部代号清单：出现在 H1/H2 就等于把实现细节卖给了读者。 */
const JARGON = [/\bclaim\b/i, /\bexecute\b/i, /\bcompile\b/i, /\bS2\b/, /\bS3\b/, /\bA8\b/, /\bA9\b/, /StructuredCrudConfig/, /CrudPageSchema/]

await check('T5 证据结构齐全（结论 / 方法 / 产物 / 实测数据 / 边界 / 术语）', () => {
  assert.equal(story.id, 'purchase-approval', `story.id 应为 purchase-approval，实际 ${story.id}`)
  assert.ok(story.conclusion && story.conclusion.length >= 40, 'story.conclusion 太短（一句话结论要能独立看懂）')
  assert.ok(
    Array.isArray(story.method) && story.method.length >= 2 && story.method.length <= 3,
    `method 应为 2~3 步（T5 要求三步内讲清），当前 ${story.method?.length}`,
  )
  for (const [i, step] of story.method.entries()) {
    assert.ok(step.title && step.title.trim(), `method[${i}].title 为空`)
    assert.ok(step.text && step.text.length >= 40, `method[${i}].text 太短`)
  }

  for (const key of ['label', 'file', 'note']) {
    assert.ok(story.product?.[key] && String(story.product[key]).trim(), `product.${key} 为空`)
  }
  assert.ok(story.product.counts && Object.keys(story.product.counts).length >= 3, 'product.counts 至少要三项')

  assert.ok(story.repro?.command?.trim(), 'repro.command 为空 —— 没有复现命令，数据就只是自述')
  assert.ok(story.repro.note && story.repro.note.trim(), 'repro.note 为空（命令从哪来、参数怎么填都要说清）')

  assert.match(story.evidence?.measuredAt || '', /^\d{4}-\d{2}-\d{2}$/, 'evidence.measuredAt 必须是 ISO 日期（数据要有测量日）')
  assert.ok(story.evidence.metrics.length >= 3, '实测数据至少 3 条')
  for (const [i, m] of story.evidence.metrics.entries()) {
    assert.ok(m.label && m.label.trim(), `evidence.metrics[${i}].label 为空`)
    assert.ok(m.value && m.value.trim(), `evidence.metrics[${i}].value 为空`)
    assert.ok(
      m.basis && m.basis.length >= 20,
      `evidence.metrics[${i}].basis 太短 —— 没有口径的数字等于没有数字`,
    )
  }

  assert.ok(story.boundaries.length >= 3, `边界至少 3 条（当前 ${story.boundaries.length}）`)
  for (const [i, b] of story.boundaries.entries()) {
    assert.ok(b.title && b.title.trim(), `boundaries[${i}].title 为空`)
    assert.ok(b.text && b.text.length >= 40, `boundaries[${i}].text 太短 —— 「不承诺什么」要具体到能被反驳`)
  }

  assert.ok(story.terms.length >= 3, '术语表至少 3 条（内部代号要在这里解释，而不是塞进标题）')
  for (const [i, t] of story.terms.entries()) {
    assert.ok(t.term && t.term.trim(), `terms[${i}].term 为空`)
    assert.ok(t.meaning && t.meaning.length >= 20, `terms[${i}].meaning 太短`)
  }
})

await check('T5 产物数字都能从文件重算出来，复现命令与 meta 逐字一致', () => {
  const file = story.product.file
  assert.ok(existsSync(join(ROOT, file)), `product.file 不存在：${file}`)
  const actualBytes = Buffer.byteLength(read(file), 'utf8')
  assert.equal(story.product.bytes, actualBytes, `product.bytes 写成 ${story.product.bytes}，实际 ${actualBytes}（改产物后要同步改 story）`)
  assert.equal(story.product.lines, nonEmptyLines(file), `product.lines 写成 ${story.product.lines}，实际 ${nonEmptyLines(file)}`)
  assert.equal(
    story.product.functions,
    countFunctions(JSON.parse(read(file))),
    'product.functions 与产物里的函数数不符 —— 「零函数」是本页最大的主张，不能只写在文案里',
  )

  // 计数口径写在这里：查询区 2 项、列 5、弹窗 2、按钮 = 工具栏 + 表格级 + 操作列、联动 = 所有弹窗与查询区之和
  const actualCounts = {
    formItems: (schema.formItems || []).length,
    columns: (schema.columns || []).length,
    dialogs: Object.keys(schema.dialogs || {}).length,
    buttons:
      (schema.toolbarBtns || []).length + (schema.tableBtns || []).length + (schema.operationColumn?.btns || []).length,
    reactions: allFormItems(schema).reduce((n, f) => n + (f.reactions || []).length, 0),
  }
  for (const [key, value] of Object.entries(story.product.counts)) {
    assert.equal(value, actualCounts[key], `product.counts.${key} 写成 ${value}，产物里实际 ${actualCounts[key]}`)
  }

  // 复现命令只能有一份：meta 里记录的那条。另写一条就等于允许两边各说各话。
  assert.equal(
    story.repro.command,
    meta.command,
    'repro.command 与 meta.command 不一致 —— 复现命令必须来自产物自带的出处记录',
  )
  assert.match(story.repro.command, /create\s+purchase-approval/, 'repro.command 没有指向本案例的 create 调用')
  assert.match(story.repro.command, /--ai/, 'repro.command 缺少 --ai（否则不是这一页的生成方式）')
  assert.match(story.repro.command, /-m\s+schema/, 'repro.command 缺少 -m schema（另两站渲染的是纯 JSON 产物）')
})

await check('T5 内部代号不出现在标题里（结论 / 方法标题 / 指标标题 / 边界标题）', () => {
  const headings = [
    ...story.method.map((s) => s.title),
    ...story.evidence.metrics.map((m) => m.label),
    ...story.boundaries.map((b) => b.title),
    story.conclusion,
  ]
  for (const text of headings) {
    for (const re of JARGON) {
      // 术语表里可以解释这些词，但标题与结论是给「想做这个页面的人」看的
      assert.doesNotMatch(text, re, `「${text.slice(0, 24)}」里出现了内部代号（${re.source}）—— 它只该活在折叠的术语块里`)
    }
  }
})

await check('三站宿主都渲染 T5 各段，并接上复制命令 / 下载 JSON / 术语折叠', () => {
  const SECTIONS = ['方法', '产物', '实测数据', '边界与不承诺']
  for (const host of HOSTS) {
    const src = toLf(read(host.file))
    assert.match(src, /@\/cases\/generated\/purchase-approval\.story\.json/, `${host.file} 没有加载 purchase-approval.story.json`)
    assert.match(src, /<h2 class="ai-section-title">30 秒演示<\/h2>/, `${host.file} 缺少「30 秒演示」标题`)
    for (const heading of SECTIONS) {
      assert.ok(
        new RegExp(`<h2>${heading}</h2>`).test(src),
        `${host.file} 缺少「${heading}」段（T5 模板五段缺一段，这一页就退回成了「AI 很好用」）`,
      )
    }
    // 标题只能讲用户任务：hero 的 h1 / h2 里出现内部代号即失败
    const headings = [...src.matchAll(/<h([12])[^>]*>([\s\S]*?)<\/h\1>/g)].map((m) => m[2].replace(/\{\{[\s\S]*?\}\}/g, ''))
    for (const heading of headings) {
      for (const re of JARGON) {
        assert.doesNotMatch(heading, re, `${host.file} 的标题「${heading.trim().slice(0, 24)}」出现了内部代号（${re.source}）`)
      }
    }
    assert.match(src, /copyCommand/, `${host.file} 没有「复制复现命令」`)
    assert.match(src, /downloadSchema/, `${host.file} 没有「下载 JSON」`)
    // 术语必须在折叠块里：<details class="evidence-terms"> 内部才是 dl
    const termsBlock = src.match(/<details class="evidence-terms">([\s\S]*?)<\/details>/)
    assert.ok(termsBlock, `${host.file} 没有折叠的术语块（内部代号要有地方解释）`)
    assert.match(termsBlock[1], /story\.terms/, `${host.file} 的术语块没有渲染 story.terms`)
    for (const field of ['story', 'productKb', 'countLabel', 'commandCopied']) {
      const declared =
        new RegExp(`import\\s+${field}\\s+from`).test(src) || // story：单源数据是 import 进来的
        new RegExp(`const\\s+${field}\\s*=`).test(src) || // Vue3 <script setup>
        new RegExp(`\\b${field}\\s*:`).test(src) // Vue2 data()
      assert.ok(declared, `${host.file} 模板用了 ${field}，脚本里却没声明`)
    }
  }
})

if (failed > 0) {
  console.error(`\n[check:generated-case] 失败 ${failed} 项`)
  process.exit(1)
}

console.log(
  `\n[check:generated-case] 通过：纯 JSON 生成产物（${(schemaText.length / 1024).toFixed(1)} KB、0 个函数、` +
    `model ${meta.model}）、3 站副本一致、宿主/路由/入口与按钮名兜底均已接线`,
)
