#!/usr/bin/env node
/**
 * 守卫：三端 es-table 的「内部键」必须与 core 单源对齐（P2-1）。
 *
 * ## 背景
 *
 * `tableOptions` 里有一批键是**组件自己消费**的（请求参数、分页联动、vxe 配置、被翻译成
 * spanMethod / customCell 的声明式配置）—— 它们不能作为 attrs 落到 el-table / a-table 的
 * 根节点上，否则 DOM 会多出一枚没人读的死属性（`keepsource="false"`）。
 *
 * 修前三端各写一份清单：43 / 44 / 50 个键。新增一个跨端键时，改了两端漏一端，构建全绿、
 * 单测全绿，只有漏掉的那一端 DOM 上多一枚死属性 —— 没有任何机器判据能发现。
 *
 * ## 三条断言
 *
 *   ① 单源 `BASE_TABLE_INTERNAL_KEYS` ⊆ 每一端的集合：少剥一个 → 红（写明缺哪个键）；
 *   ② 单源 === 三端集合的交集：三端都剥了、却没回填单源 → 红（否则单源会慢慢变成
 *      「历史遗留清单」，新键永远进不去）；
 *   ③ 每一端的集合字面量必须 `...BASE_TABLE_INTERNAL_KEYS`（而不是把公共键手抄一遍），
 *      且集合内无重复键。
 *
 * 端专有键（vue2 的 `lazyLoad`、antdv 的 a-table 映射键）不参与②：交集之外允许存在。
 *
 * ## 为什么必须带自证
 *
 * 这类守卫最常见的失灵是「解析不到就当通过」。下面的 `selfProof()` 用合成输入验证
 * 「缺键 / 重复 / 没展开单源」三种坏形状都真的会红，解析失败（空集）直接判红。
 *
 * 用法：node scripts/check-table-internal-keys.mjs
 * 退出码：0 = 三端与单源对齐；1 = 漂移或解析失效
 */
import { readFileSync, existsSync } from 'node:fs'
import { dirname, join, relative } from 'node:path'
import { fileURLToPath } from 'node:url'

const ROOT = join(dirname(fileURLToPath(import.meta.url)), '..')
const CORE_FILE = 'packages/core/src/table-internal-keys.ts'
const RENDERERS = [
  { name: 'vue3', file: 'packages/vue3/src/components/es-table/src/component.vue' },
  { name: 'vue2', file: 'packages/vue2/src/components/es-table/component.vue' },
  { name: 'antdv', file: 'packages/adapter-antdv/src/components/es-table/src/component.vue' },
]
/** 单源清单至少要有这么多键 —— 低于此值是解析失效，不是「刚好没键」 */
const MIN_BASE_KEYS = 20

const rel = (p) => relative(ROOT, p).split('\\').join('/')

function stripComments(src) {
  return src
    .replace(/\/\*[\s\S]*?\*\//g, '')
    .replace(/(^|[^:])\/\/.*$/gm, '$1')
}

const BASE_RE = /export const BASE_TABLE_INTERNAL_KEYS\s*=\s*\[([\s\S]*?)\]\s*as const/
const SET_RE = /const TABLE_INTERNAL_KEYS\s*=\s*new Set(?:<[^>]*>)?\(\[([\s\S]*?)\]\)/

/** 抓字面量里的引号键（跳过展开项本身）。 */
function quotedKeys(body) {
  return [...body.matchAll(/'([A-Za-z_$][\w$]*)'/g)].map((m) => m[1])
}

function parseBase(src) {
  const m = BASE_RE.exec(src)
  return m ? quotedKeys(m[1]) : null
}

function parseSet(src) {
  const m = SET_RE.exec(src)
  if (!m) return null
  return { keys: quotedKeys(m[1]), spreadsBase: m[1].includes('...BASE_TABLE_INTERNAL_KEYS') }
}

function duplicates(keys) {
  const seen = new Set()
  const dup = new Set()
  for (const k of keys) (seen.has(k) ? dup : seen).add(k)
  return [...dup]
}

/**
 * 纯函数：给定单源与各端解析结果，返回错误文案数组。
 * 自证与实跑共用它 —— 否则自证只是复述实现。
 */
function checkPlans(baseKeys, rendererPlans) {
  const errors = []

  if (!Array.isArray(baseKeys) || baseKeys.length < MIN_BASE_KEYS) {
    errors.push(`单源清单解析失败（${baseKeys ? baseKeys.length : 0} 个键）—— 先修解析器，别让它空转`)
    return errors
  }
  const dupBase = duplicates(baseKeys)
  if (dupBase.length) errors.push(`单源清单存在重复键：${dupBase.join(', ')}`)

  const setOf = new Map()
  for (const r of rendererPlans) {
    if (!r.plan) {
      errors.push(`${r.name}: 找不到 \`const TABLE_INTERNAL_KEYS = new Set(...)\` —— 组件改名了就同步本脚本`)
      continue
    }
    const keySet = new Set(r.plan.keys)
    // 运行时集合 = 字面量 ∪（展开单源 ? 单源 : ∅）
    const runtime = r.plan.spreadsBase ? new Set([...keySet, ...baseKeys]) : keySet
    setOf.set(r.name, runtime)
    if (!r.plan.spreadsBase) {
      errors.push(`${r.name}: 集合字面量没有 \`...BASE_TABLE_INTERNAL_KEYS\`（公共键不允许手抄第二份）`)
      // 手抄时逐个核对：少一个就说明它会被透传到底座表格
      const missing = baseKeys.filter((k) => !keySet.has(k))
      if (missing.length) errors.push(`${r.name}: 少剥 ${missing.length} 个公共键 → ${missing.join(', ')}`)
    }
    const dup = duplicates(r.plan.keys)
    if (dup.length) errors.push(`${r.name}: 集合内重复键：${dup.join(', ')}`)
  }

  // ② 单源 === 三端交集（全都解析到才判，避免一半失败时误报）
  if (setOf.size === rendererPlans.length) {
    const [first, ...rest] = [...setOf.values()]
    const common = [...first].filter((k) => rest.every((s) => s.has(k)))
    const missingFromBase = common.filter((k) => !baseKeys.includes(k))
    if (missingFromBase.length) {
      errors.push(
        `三端共同剥掉、但单源漏登的键 → ${missingFromBase.join(', ')}（请加进 ${CORE_FILE}）`
      )
    }
  }

  return errors
}

function selfProof() {
  const base = Array.from({ length: MIN_BASE_KEYS }, (_, i) => `k${i}`)
  const good = (extra = []) => ({ keys: [...base, ...extra], spreadsBase: true })
  const cases = [
    ['缺一个公共键（手抄且漏抄）', base, [{ name: 'x', plan: { keys: base.slice(1), spreadsBase: false } }], /少剥 1 个/],
    ['没展开单源', base, [{ name: 'x', plan: { keys: base, spreadsBase: false } }], /BASE_TABLE_INTERNAL_KEYS/],
    ['三端共同新增未回填', base, [
      { name: 'a', plan: good(['newKey']) },
      { name: 'b', plan: good(['newKey']) },
      { name: 'c', plan: good(['newKey']) },
    ], /单源漏登/],
    ['集合内重复', base, [{ name: 'x', plan: { keys: [...base, 'k0'], spreadsBase: true } }], /重复键/],
    ['解析为空', [], [{ name: 'x', plan: good() }], /解析失败/],
  ]
  let ok = true
  for (const [label, b, plans, re] of cases) {
    const errs = checkPlans(b, plans)
    if (!errs.some((e) => re.test(e))) {
      console.error(`❌ 自证失败：${label} 没有被判红（期望匹配 ${re}）`)
      ok = false
    }
  }
  return ok
}

function main() {
  const corePath = join(ROOT, CORE_FILE)
  if (!existsSync(corePath)) {
    console.error(`❌ 找不到 ${CORE_FILE}`)
    process.exit(1)
  }

  if (!selfProof()) {
    console.error('❌ 守卫自证未通过 —— 判据本身失效，先修脚本')
    process.exit(1)
  }

  const baseKeys = parseBase(stripComments(readFileSync(corePath, 'utf8')))
  const plans = RENDERERS.map((r) => {
    const abs = join(ROOT, r.file)
    if (!existsSync(abs)) return { name: r.name, plan: null }
    return { name: r.name, plan: parseSet(stripComments(readFileSync(abs, 'utf8'))) }
  })

  const errors = checkPlans(baseKeys, plans)
  if (errors.length) {
    console.error('❌ 三端表格内部键与单源不一致：')
    for (const e of errors) console.error(`   - ${e}`)
    console.error(`\n单源：${CORE_FILE}（${rel(corePath)}）`)
    process.exit(1)
  }

  const extra = plans
    .filter((p) => p.plan)
    .map((p) => {
      const own = p.plan.keys.filter((k) => !baseKeys.includes(k))
      return `${p.name} 专有 ${own.length}${own.length ? `（${own.join(', ')}）` : ''}`
    })
    .join(' · ')
  console.log(`✅ 表格内部键与单源对齐（单源 ${baseKeys.length} 键；${extra}）`)
}

main()
