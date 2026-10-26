#!/usr/bin/env node
/**
 * AI 可达性台账守卫（AI-25）
 *
 * 背景：用户问「支持功能案例达到了多少程度？全场景适配？」——此前只能人工盘点。
 * 本守卫把「**新特性落文档 → 它是否 AI 可达、属哪一档**」变成**可自动咬住**的轴。
 *
 * 单一真源：`docs/ai/feature-coverage.json`（103 行 = 文档站 103 例特性演示）。
 * 三集必须 1:1（守卫不可空转的根基——对照物是另两套**非本文件产生**的集合）：
 *   1. 磁盘：`es-plus-docs/src/components/examples/<cat>/<Pascal>.vue` × 103
 *   2. 引用：`component-doc.data.ts` + `advanced-doc.data.ts` 的 `getComponent('<cat>/<NN>-<slug>')`
 *   3. 清单：本 JSON 的 `demos[].id`
 *
 * 断言：
 *   ① 引用集 ↔ 磁盘集 1:1（每个 id 映射到磁盘 .vue 存在；磁盘每个 .vue 恰被引用一次 → 孤儿红）
 *   ② 清单 id 集 === 引用集（双向）；且 group 与 id 前缀一致
 *   ③ 每行 tokens ⊆ 注册表；注册表无孤儿令牌；C/D 令牌 reason 非空
 *   ④ 每个 A 档令牌的 keys ⊆ 实时可达集（crudShape ∪ schema 顶层 ∪ FieldConfig ∪ AI tableOptions）
 *      —— 咬「声称了源码里不存在的开关」
 *   ⑤ B 档令牌**双支**验证：(a) `via:'FRONT_DOOR_UNREACHABLE:<k>'` 要求该键仍在册 / 前门
 *      仍够不到；(b) **第二腿（AI-29）**`keys ⊆（AI Zod 声明 ∩ 生成器实际发射）`—— 咬
 *      「声称 from_config 可达，实则两处 AI Zod 零声明 + 生成器零发射」（vxeFirstClass 的虚标）。
 *      `'AI-Zod-absent'` 档已退役（与第二腿语义互斥）。
 *   ⑥ `aiCase` 引用存在（§4.9 接缝）：每个 id 必须在 `docs/cases/ai-cases.json` 的案例集中
 *   ⑦ 摘要：按档 / 按组计数 + 逐行 id → tier
 *
 * 用法：node scripts/check-feature-coverage.mjs
 * 退出码：0 = 一致；1 = 发现漂移。
 */
import { readFileSync, readdirSync, existsSync } from 'node:fs'
import { fileURLToPath } from 'node:url'
import { dirname, join } from 'node:path'
import { readReachability, readGeneratorEmission, FRONT_DOOR_UNREACHABLE, fail } from './lib/entry-keys.mjs'
import { CAPABILITY_TOKENS, TIER_MEANING, rowTier } from './feature-coverage.data.mjs'
import { buildSiteCoverage } from './lib/site-coverage.mjs'

const __dirname = dirname(fileURLToPath(import.meta.url))
const ROOT = join(__dirname, '..')
const read = (p) => readFileSync(join(ROOT, p), 'utf-8')

const MANIFEST = 'docs/ai/feature-coverage.json'
const DOCS_DATA = {
  component: 'es-plus-docs/src/views/component-doc.data.ts',
  advanced: 'es-plus-docs/src/views/advanced-doc.data.ts',
}
const EXAMPLES_DIR = 'es-plus-docs/src/components/examples'

/** id 前缀 → 文档组名（与两个 .data.ts 的顶层键一致）。 */
const GROUP_BY_PREFIX = {
  form: 'es-form',
  table: 'es-table',
  'crud-page': 'es-crud-page',
  dialog: 'use-dialog',
  advanced: 'linkage',
  'vxe-table': 'vxe-table',
  'error-boundary': 'es-error-boundary',
  'svg-icon': 'svg-icon',
}

/** 复刻 docs 的 resolveComponentPath：'<cat>/<NN>-<slug>' → '/src/components/examples/<cat>/<Pascal>.vue'。 */
function toPascalCase(str) {
  return str.replace(/(^|-)([a-z])/g, (_, __, l) => l.toUpperCase())
}
function resolveComponentPath(id) {
  const [category, fileName] = id.split('/')
  const nameWithoutPrefix = fileName.replace(/^\d+-/, '')
  return `/src/components/examples/${category}/${toPascalCase(nameWithoutPrefix)}.vue`
}

/** 抓两个 .data.ts 里全部 `getComponent('<id>')`（剔除函数定义行）。 */
function citedIds() {
  const ids = []
  for (const rel of Object.values(DOCS_DATA)) {
    for (const line of read(rel).split(/\r?\n/)) {
      if (!line.includes('getComponent(') || line.includes('function getComponent')) continue
      const m = line.match(/getComponent\('([^']+)'\)/)
      if (m) ids.push(m[1])
    }
  }
  return ids
}

/** 递归列 examples/ 下全部 .vue（相对仓库根）。 */
function diskVueFiles() {
  const base = join(ROOT, EXAMPLES_DIR)
  const out = []
  for (const cat of readdirSync(base)) {
    const dir = join(base, cat)
    for (const f of readdirSync(dir)) {
      if (f.endsWith('.vue')) out.push(`es-plus-docs/src/components/examples/${cat}/${f}`)
    }
  }
  return out
}

function main() {
  let ok = true
  const manifest = JSON.parse(read(MANIFEST))
  const demos = manifest.demos

  // ── ① 引用集 ↔ 磁盘集 1:1 ──
  const cites = citedIds()
  const citeSet = new Set(cites)
  if (citeSet.size !== cites.length) {
    const dup = cites.filter((x, i) => cites.indexOf(x) !== i)
    ok = fail(`文档引用存在重复 getComponent：${[...new Set(dup)].join(', ')}`)
  }
  // 每个 id 映射到磁盘 .vue 存在
  const resolvedFromCites = new Set()
  for (const id of citeSet) {
    const rel = `es-plus-docs${resolveComponentPath(id)}`
    resolvedFromCites.add(rel)
    if (!existsSync(join(ROOT, rel))) {
      ok = fail(`引用 ${id} 映射到不存在的文件 ${rel}（resolveComponentPath 规则错位？）`)
    }
  }
  // 反查孤儿：磁盘每个 .vue 恰被引用一次
  const diskFiles = diskVueFiles()
  const orphans = diskFiles.filter((f) => !resolvedFromCites.has(f))
  if (orphans.length) {
    ok = fail(`磁盘存在无人引用的示例（新增 .vue 但未落文档）：${orphans.join(', ')}`)
  }
  // 磁盘多出的引用（引用存在但文件已删）已在上面 existsSync 分支覆盖

  // ── ② 清单 id 集 === 引用集（双向）+ group ↔ 前缀 ──
  const manifestIds = demos.map((d) => d.id)
  const manifestSet = new Set(manifestIds)
  if (manifestSet.size !== manifestIds.length) {
    const dup = manifestIds.filter((x, i) => manifestIds.indexOf(x) !== i)
    ok = fail(`清单存在重复 id：${[...new Set(dup)].join(', ')}`)
  }
  const missing = [...citeSet].filter((id) => !manifestSet.has(id))
  const extra = manifestIds.filter((id) => !citeSet.has(id))
  if (missing.length) ok = fail(`文档演示未纳入台账（新增示例未分类）：${missing.join(', ')}`)
  if (extra.length) ok = fail(`台账残留已删/不存在于文档的演示：${extra.join(', ')}`)
  for (const d of demos) {
    const want = GROUP_BY_PREFIX[d.id.split('/')[0]]
    if (d.group !== want) ok = fail(`${d.id} 的 group='${d.group}' 与 id 前缀不符（应为 '${want}'）`)
  }

  // ── ③ 令牌合法 + 无孤儿 + C/D reason 非空 ──
  const usedTokens = new Set()
  for (const d of demos) {
    for (const t of d.tokens) {
      usedTokens.add(t)
      if (!(t in CAPABILITY_TOKENS)) ok = fail(`${d.id} 引用了未注册令牌 '${t}'`)
    }
  }
  // AN-28：站点台账的令牌同样算「被引用」，否则 `siteUncovered` 会被误判成孤儿。
  for (const site of manifest.sites ?? []) {
    for (const c of site.cases ?? []) {
      for (const t of c.tokens ?? []) usedTokens.add(t)
    }
  }
  const orphanTokens = Object.keys(CAPABILITY_TOKENS).filter((t) => !usedTokens.has(t))
  if (orphanTokens.length) ok = fail(`注册表存在无人引用的孤儿令牌：${orphanTokens.join(', ')}`)
  for (const [t, def] of Object.entries(CAPABILITY_TOKENS)) {
    if ((def.tier === 'C' || def.tier === 'D') && !(def.reason && def.reason.trim())) {
      ok = fail(`令牌 '${t}'（${def.tier} 档）未写明 reason`)
    }
  }

  // ── ④ A 档令牌 keys ⊆ 实时可达集 ──
  const reach = readReachability()
  if (reach === null) process.exit(1)
  const liveSet = new Set([...reach.frontKeys, ...reach.schemaKeys, ...reach.fcKeys, ...reach.tableOptionsKeys])
  for (const [t, def] of Object.entries(CAPABILITY_TOKENS)) {
    if (def.tier !== 'A') continue
    if (!Array.isArray(def.keys) || def.keys.length === 0) {
      ok = fail(`A 档令牌 '${t}' 未声明 keys —— 声明式能力必须指出所依据的实时开关，否则无从咬合`)
      continue
    }
    for (const k of def.keys) {
      if (!liveSet.has(k)) {
        ok = fail(`A 档令牌 '${t}' 的依据键 '${k}' 不在实时可达集（源码里不存在该开关）`)
      }
    }
  }

  // ── ⑤ B 档令牌双支验证 ──
  // (a) 对照物是**实时**集合（schema 顶层 \ 前门 crudShape），不是注册表本身——故前门一旦
  //     扩宽到某键，本守卫**立即**红（不依赖 check-entry 先跑），强制重新分类。
  // (b) **第二腿（AI-29 新增）**：「声称 from_config 可达」必须**同时**证明两件事——
  //     Zod 声明了该键（否则被静默 strip）+ 生成器真发射了该键（否则产物里没有它）。
  //     这正是 vxeFirstClass 虚标 B 时缺的那条腿：它只被验「键缺席」，从没人验「键可发射」。
  // AI-29 已**退役** `'AI-Zod-absent'` 档（与第二腿语义互斥），故此处不再有该分支。
  const liveFrontUnreachable = new Set(reach.schemaKeys.filter((k) => !reach.frontKeys.includes(k)))
  const emitted = new Set(readGeneratorEmission().schemaEmittedKeys)
  const emittable = new Set(reach.configShapeKeys.filter((k) => emitted.has(k)))
  for (const [t, def] of Object.entries(CAPABILITY_TOKENS)) {
    if (def.tier !== 'B') continue
    if (!def.via || !def.via.startsWith('FRONT_DOOR_UNREACHABLE:')) {
      ok = fail(
        `B 档令牌 '${t}' 的 via 非法：'${def.via}'（唯一合法形态是 'FRONT_DOOR_UNREACHABLE:<键>'；` +
          `'AI-Zod-absent' 已在 AI-29 退役，不可再用于 B 档）`
      )
      continue
    }
    const k = def.via.slice('FRONT_DOOR_UNREACHABLE:'.length)
    if (!liveFrontUnreachable.has(k)) {
      ok = fail(
        `B 档令牌 '${t}' 的 via 陈旧：'${k}' 已不再是前门够不到的 schema 顶层键（前门已扩宽到它）—— 请重新分类该能力`
      )
    }
    if (!(k in FRONT_DOOR_UNREACHABLE)) {
      ok = fail(`B 档令牌 '${t}' 的 via 指向 '${k}'，但该键未登记在 FRONT_DOOR_UNREACHABLE`)
    }
    // (b) 第二腿
    if (!Array.isArray(def.keys) || def.keys.length === 0) {
      ok = fail(`B 档令牌 '${t}' 未声明 keys —— 第二腿需要有「被断的对象」（声称 from_config 可达，就必须指名道姓说可达的是哪个键）`)
      continue
    }
    for (const kk of def.keys) {
      if (!emittable.has(kk)) {
        const why = !reach.configShapeKeys.includes(kk)
          ? 'AI Zod（from_config 的 configShape）未声明它 → 经该入口会被静默 strip'
          : !emitted.has(kk)
            ? '生成器从不发射它 → 产物里根本没有这个键'
            : '未知'
        ok = fail(
          `B 档令牌 '${t}' 声称 '${kk}' 经 generate_crud_from_config 可达，但第二腿未过：${why}。` +
            `若它实际只能靠逃生舱（源码串/闭包）到手，请改判 C 档`
        )
      }
    }
  }

  // ── ⑤b 三站案例台账：es-eui / es-pc 目录 ↔ sites 段 ──
  // 验收：两站各自的「映射数」> 0；未映射案例必须显式 D + reason；台账必须与磁盘现算一致。
  const sites = manifest.sites
  if (!Array.isArray(sites) || sites.length !== 2) {
    ok = fail('feature-coverage.json 缺少 sites 段（应为 es-eui / es-pc 两条）—— 运行 npm run sites:coverage:gen')
  } else {
    const built = buildSiteCoverage(demos, ROOT)
    if (JSON.stringify(sites) !== JSON.stringify(built)) {
      ok = fail('sites 台账与磁盘不同步（站点目录增删/改名，或映射规则变了）—— 运行 npm run sites:coverage:gen')
    }
    for (const site of sites) {
      if (!(site.refs > 0)) {
        ok = fail(`${site.site} 未映射任何单源演示（refs=${site.refs}，验收要求 > 0）`)
      }
      if (site.cases.length !== site.refs + site.uncovered) {
        ok = fail(
          `${site.site} 的计数不自洽：cases ${site.cases.length} ≠ refs ${site.refs} + uncovered ${site.uncovered}`,
        )
      }
      for (const c of site.cases) {
        if (!c.demo && c.tier !== 'D') {
          ok = fail(`${site.site}/${c.id} 未匹配单源演示却不是 D 档（tier=${c.tier}）`)
        }
        if (!c.demo && !(c.reason && c.reason.trim())) {
          ok = fail(`${site.site}/${c.id} 未匹配单源演示且未写 D 档 reason`)
        }
        for (const t of c.tokens) {
          if (!(t in CAPABILITY_TOKENS)) ok = fail(`${site.site}/${c.id} 引用了未注册令牌 '${t}'`)
        }
        if (c.tier !== rowTier(c.tokens)) {
          ok = fail(`${site.site}/${c.id} 的 tier=${c.tier} 与令牌派生档 ${rowTier(c.tokens)} 不符`)
        }
      }
    }
  }

  // ── ⑥ aiCase 接缝（§4.9）：文档演示 ↔ AI 案例的唯一机械连接 ──
  // 悬空引用会让「这个能力有案例演示」变成一句无对照的断言：页面点过去 404，台账却是绿的。
  // 只判**引用存在**，不判「该案例是否真演示了它」—— 后者要人读冻结配置，且两份令牌词表
  // 不同源（order-batch 的 multiSelect 多选就不在它的 `tokens[]` 里），交集为空不能当反证。
  const caseManifestPath = 'docs/cases/ai-cases.json'
  const caseManifest = JSON.parse(read(caseManifestPath))
  const caseIds = new Set((caseManifest.cases ?? []).map((c) => c.id))
  let linkedDemos = 0
  for (const d of demos) {
    if (d.aiCase === undefined) continue
    linkedDemos++
    if (!Array.isArray(d.aiCase) || d.aiCase.length === 0) {
      ok = fail(`${d.id} 的 aiCase 必须是非空数组（一页能力可由多个案例分别演示）`)
      continue
    }
    for (const id of d.aiCase) {
      if (!caseIds.has(id)) {
        ok = fail(`${d.id} 的 aiCase 指向 '${id}'，但 ${caseManifestPath} 里没有该案例（引用悬空）`)
      }
    }
  }

  // ── ⑦ 摘要 ──
  const tierCount = {}
  const groupCount = {}
  for (const d of demos) {
    const t = rowTier(d.tokens)
    tierCount[t] = (tierCount[t] || 0) + 1
    groupCount[d.group] = (groupCount[d.group] || 0) + 1
  }

  if (!ok) process.exit(1)

  const tierLine = ['A', 'B', 'C', 'D'].map((t) => `${t} ${tierCount[t] || 0}`).join(' / ')
  const groupLine = Object.entries(groupCount)
    .map(([g, n]) => `${g} ${n}`)
    .join('；')
  console.log(
    `✅ AI 可达性台账一致（${demos.length} 例；分档 ${tierLine}；` +
      `分组 ${groupLine}；引用↔磁盘↔台账三方 1:1；aiCase 关联 ${linkedDemos} 例）`
  )
  console.log(
    '   —— 三站案例台账（AN-28）—— ' +
      (Array.isArray(sites)
        ? sites
            .map((s) => `${s.site} ${s.cases.length} 例（映射 ${s.refs} / D ${s.uncovered}）`)
            .join('；')
        : '缺失'),
  )
  console.log('   —— 逐行分档（A 前门声明式 / B from_config / C 逃生舱·函数值 / D 非 AI 目标）——')
  for (const d of demos) {
    console.log(`   ${rowTier(d.tokens)}  ${d.id.padEnd(28)} ${d.title}`)
  }
  console.log('   tiers:', JSON.stringify(TIER_MEANING))
  process.exit(0)
}

main()
