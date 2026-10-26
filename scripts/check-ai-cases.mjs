#!/usr/bin/env node
/**
 * AI 展示案例矩阵守卫（`docs/internal/ai-showcase-matrix-plan.md` §4.7）。
 *
 * ## 它守的是什么
 *
 * 矩阵页面上每一句话都是**主张**：「AI 一步生成」「三端同一份字节」「产物未经手工修改」
 * 「演示了条件必填」。主张如果没有机械判据，就会随第一次发布变成宣传语。本脚本把每条主张
 * 钉到一个可重算的等式或集合关系上：
 *
 * | # | 断言 | 防止 |
 * |---|---|---|
 * | 1 | manifest 过 schema、id 唯一 | 手滑 / 半成品条目 |
 * | 2 | 产物存在；meta 与 manifest 的 id/title/model/date/attempts/mode/target 一致；origin 与证据形态自洽（ai→有模型名、config→可重放、handcrafted→写清为何不可重放） | 页面说的和产物不符 / 出处互相冒充 |
 * | 3 | schema / config 是纯 JSON（无函数式键、无函数体字样） | 把宿主代码藏进配置 |
 * | 4 | **可重放**：`frozen-config` → 产物 == JSON(generateFromConfig(冻结配置))；`surfaces` → 产物结构事实 == 前门(冻结入参)；`unavailable`/`handcrafted` → 必带原因且必带承担它的守卫 | 「AI 生成」无法追溯 |
 * | 5 | **能力证据**：`tokens[]` 在能力矩阵里是 declarative，且产物里该路径非空；`alwaysOn[]` 必须是 auto 令牌；`escapeHatch[]` 必须是逃生舱令牌 | 只写卖点、没真用 |
 * | 6 | 覆盖门（默认只报告，`--strict-coverage` 才红）：每个前门可达令牌至少被一例引用 | 令牌永远没人演示 |
 * | 7 | claim 不越界：`sites[site]` 不得超过 AN-09 `CAPABILITIES` 格子；顶层 claim == 各站最大值 | 跨端过度承诺 |
 * | 8 | 宿主接线：路由存在且能解析到真实组件文件、组件引用本案例产物；通用宿主案例必须进 registry 且站点画廊可达 | 「案例在库里但站点看不到」 |
 * | 9 | 站点副本与单源逐字节一致（复用 `case-plan.mjs` 的同一份计划） | 漂移 |
 * | 10 | e2e 登记：`e2e[]` 的 spec 必须落在运行器 `testDir` 下且被其 `testMatch` 模式接受 | 静默跳过（memory: e2e-runner-filter-silent-skip） |
 * | 11 | manifest 与产物不得出现 `accuracy` / `last-accuracy` 路径 | 评测产物被当宣传品发布 |
 *
 * ## 为什么断言 4 是「编译等式」而不是「模型可重现」
 *
 * 站点加载的 `<id>.json` 是**生成器产物**（CrudPageSchema），不是模型输出的
 * StructuredCrudConfig。能机械证明的只有「产物 = 编译(冻结输入)」；模型那一步（中继 / 温度 /
 * 版本）不受控，不作承诺（§6 B1）。所以 `--emit-config` 落盘的配置是唯一的「冻结输入」。
 *
 * ## 为什么断言 8 从路由反解组件
 *
 * 硬编码「哪个案例对应哪个宿主文件」会在换实现的那天变成第二真相。这里从路由表里读出
 * `path → component`，再检查该组件是否 import 了本案例产物 —— 换文件名不会让守卫误判，
 * 删掉接线才会。
 *
 * 用法：
 *   node scripts/check-ai-cases.mjs                    # 门禁（断言 1–5、7–11）
 *   node scripts/check-ai-cases.mjs --strict-coverage   # 另把断言 6 也变成门禁（Wave B）
 * 退出码：0 = 全过；1 = 任一红。
 */
import { readFileSync, existsSync } from 'node:fs'
import { join } from 'node:path'
import { createRequire } from 'node:module'
import assert from 'node:assert/strict'
import {
  MANIFEST_PATH,
  MANIFEST_SCHEMA_PATH,
  ROOT,
  extractPageSchema,
  extractSchemaFromFrontDoorText,
  pureJsonProblems,
  hasEvidence,
  evidenceHint,
  relFromRoot,
} from './lib/ai-cases.mjs'
import { buildPlan } from './lib/case-plan.mjs'
import { captureFrontDoor } from './lib/front-door.mjs'
import { readText, sameText } from './lib/text-sync.mjs'

const require = createRequire(import.meta.url)
const Ajv = require('ajv')
const STRICT_COVERAGE = process.argv.includes('--strict-coverage')

const MATRIX_PATH = join(ROOT, 'docs', 'ai', 'ai-capability-matrix.json')

/**
 * 站点 → 它的渲染目标 / 路由表 / 案例梯度页。
 *
 * 三处路径是**站点自身的既有事实**（不是本守卫引进的约定）：claim 边界要用 target，
 * 入口检查要用 Cases 页。除此之外不做任何按案例的硬编码 —— 案例与宿主文件的对应关系
 * 一律从路由表反解（见文件头注）。
 */
const SITE_INFO = {
  'es-plus-docs': {
    target: 'vue3',
    router: 'es-plus-docs/src/router/index.ts',
    casesPage: 'es-plus-docs/src/views/Cases.vue',
  },
  'es-pc': {
    target: 'antdv',
    router: 'es-pc/src/router/index.js',
    casesPage: 'es-pc/src/views/Cases.vue',
  },
  'es-eui': {
    target: 'vue2',
    router: 'es-eui/src/router/index.js',
    casesPage: 'es-eui/src/views/cases.vue',
  },
}
const SITE_NAMES = Object.keys(SITE_INFO)

/** claim 的强弱序（顶层 claim 必须等于各站的最大值，见断言 7）。 */
const RANK = { measure: 0, compile: 1, execute: 2 }

let failed = 0
async function check(label, fn) {
  try {
    await fn()
    console.log(`  ✅ ${label}`)
  } catch (err) {
    failed++
    console.error(`  ❌ ${label}\n     ${String(err.message).split('\n').slice(0, 6).join('\n     ')}`)
  }
}

const read = (rel) => readText(join(ROOT, rel))
const readJson = (rel) => JSON.parse(read(rel))
const escapeRe = (s) => s.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')

/**
 * 从路由表里反解 `path → 组件模块说明符`。
 *
 * 三种写法都要认：懒加载 `component: () => import('…')`、静态引入标识符
 * `component: Cases` + 文件顶部 `import Cases from '…'`、以及 pc 站的无前导斜杠路径。
 */
function routeComponent(routerText, routePath) {
  for (const variant of [routePath, routePath.replace(/^\//, '')]) {
    const idx = routerText.search(new RegExp(`path:\\s*'${escapeRe(variant)}'`))
    if (idx < 0) continue
    const window = routerText.slice(idx, idx + 800)
    const lazy = window.match(/import\(\s*'([^']+)'\s*\)/)
    if (lazy) return lazy[1]
    const ident = window.match(/component:\s*([A-Za-z_$][\w$]*)/)
    if (ident) {
      const im = routerText.match(new RegExp(`import\\s+${escapeRe(ident[1])}\\s+from\\s+'([^']+)'`))
      if (im) return im[1]
    }
    return null
  }
  return null
}

/** 路由里的模块说明符 → 仓库相对路径（`@/` 指站点 src）。 */
function resolveSpecifier(site, routerRel, spec) {
  if (spec.startsWith('@/')) return `${site}/src/${spec.slice(2)}`
  // 相对说明符按路由表所在目录解析（`../views/x.vue`）
  const routerDir = routerRel.slice(0, routerRel.lastIndexOf('/'))
  const parts = routerDir.split('/')
  for (const seg of spec.split('/')) {
    if (seg === '..') parts.pop()
    else if (seg !== '.') parts.push(seg)
  }
  return parts.join('/')
}

/**
 * 运行器的加载规则：`testDir` + `testMatch`。
 *
 * 不重扫目录（重扫只能证明「文件存在」，证明不了「执行器会跑它」—— memory
 * `e2e-runner-filter-silent-skip`）。这里从 Playwright 配置里读出 testDir；testMatch 未显式
 * 声明时用 Playwright 的默认模式（`**\/*.@(spec|test).?(c|m)[jt]s?(x)`），因为那正是运行器
 * 在没配置时会用的模式。
 */
function runnerRules() {
  const rel = '__tests__/e2e-runtime/playwright.config.ts'
  const text = read(rel)
  const dirMatch = text.match(/testDir:\s*'([^']+)'/)
  assert.ok(dirMatch, `${rel} 里读不到 testDir —— 运行器加载规则变了，请同步本守卫`)
  const match = text.match(/testMatch:\s*(\[[^\]]*\]|'[^']*')/)
  const patterns = match
    ? [...match[1].matchAll(/'([^']+)'/g)].map((m) => m[1])
    : ['**/*.@(spec|test).?(c|m)[jt]s?(x)']
  const baseDir = `${rel.slice(0, rel.lastIndexOf('/'))}/${dirMatch[1].replace(/^\.\//, '')}`
  return { baseDir, patterns }
}

/** 极简 glob：只实现 `**` / `*` / `?`（含 `?(…)` 可选组）/ `@(a|b)` / 字符类，够用于 Playwright 的默认模式。 */
function globToRe(glob) {
  let re = ''
  for (let i = 0; i < glob.length; i++) {
    const c = glob[i]
    const groupAt = (start) => {
      const end = glob.indexOf(')', start)
      return { body: glob.slice(start + 2, end), end }
    }
    if (c === '*') {
      if (glob[i + 1] === '*') {
        re += '.*'
        i++
        if (glob[i + 1] === '/') i++
      } else re += '[^/]*'
    } else if (c === '?' && glob[i + 1] === '(') {
      const { body, end } = groupAt(i)
      re += `(?:${body})?`
      i = end
    } else if (c === '?') re += '[^/]'
    else if (c === '@' && glob[i + 1] === '(') {
      const { body, end } = groupAt(i)
      re += `(?:${body})`
      i = end
    } else if (c === '[') {
      const end = glob.indexOf(']', i)
      re += glob.slice(i, end + 1)
      i = end
    } else re += escapeRe(c)
  }
  return new RegExp(`^${re}$`)
}

// ── 主体 ────────────────────────────────────────────────────────────────────

const manifest = JSON.parse(readFileSync(MANIFEST_PATH, 'utf-8'))
const matrix = readJson('docs/ai/ai-capability-matrix.json')
const plan = buildPlan(manifest)

console.log('[check:ai-cases] AI 展示案例矩阵')

await check('1. manifest 过 schema，id 唯一', () => {
  const ajv = new Ajv({ allErrors: true, strict: false })
  const validate = ajv.compile(JSON.parse(readFileSync(MANIFEST_SCHEMA_PATH, 'utf-8')))
  assert.ok(validate(manifest), `docs/cases/ai-cases.json 不符合 schema：\n${ajv.errorsText(validate.errors, { separator: '\n' })}`)
  const ids = manifest.cases.map((c) => c.id)
  assert.equal(new Set(ids).size, ids.length, `manifest id 重复：${ids.join(', ')}`)
  // 画廊用 manifest.clusters 当分组标题：案例引用了表里没有的簇，页面上会出现无名分组。
  for (const c of manifest.cases) {
    for (const key of c.clusters) {
      assert.ok(manifest.clusters?.[key], `${c.id} 引用了簇 ${key}，但 manifest.clusters 里没有它的名称`)
    }
  }
  // 通用宿主依赖 registry 的静态 import，缺 meta/mock 会在打包期炸 —— 提前在结构层拦住。
  for (const c of manifest.cases) {
    if (c.host.kind !== 'generic') continue
    assert.ok(c.artifacts.meta, `${c.id} 是通用宿主案例，必须声明 artifacts.meta（registry 会 import 它）`)
    assert.ok(c.artifacts.mock, `${c.id} 是通用宿主案例，必须声明 artifacts.mock（registry 会 import 它）`)
  }
})

/** 产物清单：只收真实存在的，缺失在断言 2 里点名。 */
function artifactPaths(c) {
  return Object.entries(c.artifacts ?? {})
}

await check('2. 产物存在，meta 与 manifest 出处一致', () => {
  for (const c of manifest.cases) {
    for (const [kind, rel] of artifactPaths(c)) {
      assert.ok(existsSync(join(ROOT, rel)), `${c.id} 的 ${kind} 不存在：${rel}`)
    }
    if (!c.artifacts.meta) continue
    const meta = readJson(c.artifacts.meta)
    assert.equal(meta.id, c.id, `${c.artifacts.meta} 的 id（${meta.id}）与 manifest 不符`)
    assert.equal(meta.title, c.title, `${c.artifacts.meta} 的 title 与 manifest 不符`)
    assert.equal(meta.mode, c.mode, `${c.artifacts.meta} 的 mode（${meta.mode}）与 manifest 的 ${c.mode} 不符`)
    assert.ok(c.targets.includes(meta.target), `${c.artifacts.meta} 的 target（${meta.target}）不在 manifest targets 里`)
    const p = c.provenance ?? {}
    if (p.model !== undefined && p.model !== null) {
      assert.equal(meta.model, p.model, `${c.artifacts.meta} 的 model 与 manifest provenance.model 不符`)
    }
    if (p.generatedAt) {
      assert.equal(meta.generatedAt, p.generatedAt, `${c.artifacts.meta} 的 generatedAt 与 manifest 不符`)
    }
    if (p.attempts !== undefined) {
      assert.equal(meta.attempts, p.attempts, `${c.artifacts.meta} 的 attempts 与 manifest 不符`)
    }
  }

  // origin 是**出处声明**，不是标签：三种出处各有它必须成立的证据形态，否则可以互相冒充。
  //   · ai —— 必须留下模型名（「模型写的」这句话的唯一凭据）；
  //   · config —— 配置是手写的，那就必须能被重放（手写配置没有理由不可重放）；
  //   · handcrafted —— 无生成输入，必须显式写清为什么不能重放。
  // 这一条故意不写在 schema 里：JSON Schema 表达不了「origin 与另一个字段的联合约束」，
  // 写在这里才能连同错误信息一起给出改法。
  for (const c of manifest.cases) {
    if (c.origin === 'ai') {
      assert.ok(
        (c.provenance ?? {}).model,
        `${c.id} 声明 origin=ai，但 provenance.model 为空 —— 「模型生成」必须留下模型名`
      )
    } else if (c.origin === 'config') {
      assert.equal(
        c.replay.kind,
        'frozen-config',
        `${c.id} 声明 origin=config（手写配置 + 确定性生成），replay 必须是 frozen-config —— 手写配置没有理由不可重放`
      )
      assert.ok(c.artifacts.config, `${c.id} 声明 origin=config，必须登记 artifacts.config（否则无从重放）`)
    } else {
      assert.ok(
        ['handcrafted', 'unavailable'].includes(c.replay.kind),
        `${c.id} 声明 origin=handcrafted，replay.kind 却是 ${c.replay.kind} —— 手工页没有生成输入，不该声称可重放`
      )
    }
  }
})

await check('3. schema / config 是纯 JSON（无函数式键、无函数体字样）', () => {
  for (const c of manifest.cases) {
    for (const kind of ['schema', 'config']) {
      const rel = c.artifacts[kind]
      if (!rel) continue
      const problems = pureJsonProblems(readJson(rel), rel)
      assert.deepEqual(problems, [], `${c.id} 的 ${kind} 不是纯 JSON：\n${problems.join('\n')}`)
    }
  }
})

// 断言 4 / 5 / 7 需要真前门（CAPABILITIES 与 surfaces 重放都从这里取）——
// 与能力矩阵生成器、eval 前门腿共用同一份打包实现，避免「守卫看见的」≠「eval 测到的」。
console.log('  … 打包并捕获真前门（CAPABILITIES / generate_crud）')
const { mod, cleanup, fromBuild, fromSrc } = await captureFrontDoor()
try {
  await check('4. 可重放：产物 == 编译(冻结输入)', async () => {
    assert.equal(fromBuild.length, 0, `打包拉到了 shared/build（${fromBuild.slice(0, 2).join(', ')}）—— 陈旧构建会让重放失真`)
    assert.ok(fromSrc.length > 0, '打包没有拉到任何 shared/src 输入 —— alias 没接上')

    for (const c of manifest.cases) {
      const { kind } = c.replay
      const artifact = readJson(c.artifacts.schema)

      if (kind === 'frozen-config') {
        assert.ok(c.artifacts.config, `${c.id} 声明 replay.kind=frozen-config 但没有冻结配置（artifacts.config）`)
        const config = readJson(c.artifacts.config)
        const validation = mod.validateAndRepair(config)
        assert.ok(validation.valid, `${c.id} 的冻结配置没过权威校验：\n${(validation.errors ?? []).join('\n')}`)
        const replayed = extractPageSchema(mod.generateFromConfig(config).code, c.id)
        assert.deepEqual(
          replayed,
          artifact,
          `${c.id}：产物 ≠ 由 ${c.artifacts.config} 确定性重放的结果 —— ` +
            '说明产物被手改过，或生成器与提交的产物不同步（改动请走重放，不要手改 JSON）'
        )
        continue
      }

      if (kind === 'surfaces') {
        const args = c.replay.args
        assert.ok(args, `${c.id} 声明 replay.kind=surfaces 但没有冻结入参（replay.args）`)
        const res = await mod.callFrontDoor(args)
        const text = res.content?.[0]?.text ?? ''
        assert.ok(!res.isError, `${c.id}：前门重放返回 isError：${text.split('\n')[0]}`)
        const replayed = extractSchemaFromFrontDoorText(text, c.id)
        // 前门不表达 columns 等 B 级细节，故只断言**结构事实**（§4.7 断言 4 的口径）：
        // 三面成员关系、动作集、弹窗键集 —— 这三样错任何一个，页面就变成另一张页面。
        const facts = (schema) => ({
          formProps: (schema.formItems ?? []).map((f) => f.prop).sort(),
          tableProps: (schema.columns ?? []).map((col) => col.prop ?? col.type ?? '').sort(),
          actions: (schema.actions ?? []).slice().sort(),
          dialogKeys: Object.keys(schema.dialogs ?? {}).sort(),
        })
        assert.deepEqual(facts(replayed), facts(artifact), `${c.id}：前门重放的结构事实与产物不符`)
        continue
      }

      // unavailable / handcrafted：不认识就等于没证明。必须写清原因，且必须点名
      // 真正承担这条主张的守卫（只靠本脚本的案例最多 compile，见 §6 B2）。
      assert.ok((c.replay.reason ?? '').length >= 10, `${c.id} 的 replay.kind=${kind} 必须写明原因`)
      assert.ok(
        (c.guards ?? []).some((g) => g !== 'check:ai-cases'),
        `${c.id} 不可重放（${kind}），却没有把主张交给别的守卫承担（guards 只有 check:ai-cases）`
      )
    }
  })

  await check('5. 能力证据：tokens 有路径且产物里非空；alwaysOn/escapeHatch 分类正确', () => {
    const tokens = matrix.tokens
    for (const c of manifest.cases) {
      const artifact = readJson(c.artifacts.schema)
      for (const name of c.tokens) {
        const entry = tokens[name]
        assert.ok(entry, `${c.id} 的令牌 "${name}" 不在能力矩阵里（docs/ai/ai-capability-matrix.json）`)
        assert.equal(entry.kind, 'declarative', `${c.id} 的令牌 "${name}" 是 ${entry.kind}，不能当覆盖证据`)
        assert.ok(
          (entry.artifactPaths ?? []).some((p) => hasEvidence(artifact, p)),
          `${c.id} 声明了 "${name}"，但产物里所有路径（${(entry.artifactPaths ?? []).join(' / ')}）都取不到内容：` +
            `${(entry.artifactPaths ?? []).map((p) => `${p} → ${evidenceHint(artifact, p)}`).join('；')}`
        )
      }
      for (const name of c.alwaysOn ?? []) {
        const entry = tokens[name]
        assert.ok(entry, `${c.id} 的 alwaysOn 令牌 "${name}" 不在能力矩阵里`)
        assert.equal(entry.kind, 'auto', `${c.id} 把 "${name}" 写进 alwaysOn，但它是 ${entry.kind} —— alwaysOn 只收无条件发射的令牌`)
        assert.ok(!c.tokens.includes(name), `${c.id} 的 "${name}" 同时出现在 tokens 与 alwaysOn（拿白送分当证据）`)
      }
      for (const name of c.escapeHatch ?? []) {
        const entry = tokens[name]
        assert.ok(entry, `${c.id} 的 escapeHatch 令牌 "${name}" 不在能力矩阵里`)
        assert.ok(['string-source', 'host', 'component'].includes(entry.kind), `${c.id} 把 "${name}"（${entry.kind}）写进 escapeHatch，它不是逃生舱令牌`)
      }
    }
  })

  await check('7. claim 不越界（AN-09 格子 × 逃生舱上限 × 顶层 claim = 各站最大）', () => {
    const caps = new Map(mod.CAPABILITIES.map((e) => [e.key, e]))
    for (const c of manifest.cases) {
      for (const site of SITE_NAMES) {
        const claim = c.sites[site]
        const target = SITE_INFO[site].target
        if (claim !== 'measure') {
          assert.ok(c.targets.includes(target), `${c.id} 在 ${site} 声明 ${claim}，但 targets 里没有 ${target}`)
        }
        assert.ok(claim !== 'execute' || (c.e2e ?? []).length > 0 || (c.guards ?? []).some((g) => g !== 'check:ai-cases'),
          `${c.id} 在 ${site} 声明 execute，但既无 e2e、也没有本守卫之外的主张承担者（§6 B2）`)
        for (const name of c.tokens) {
          const key = matrix.tokens[name]?.capabilityKey
          if (!key) continue // 无 AN-09 行 = 未发现 target 级差异，不构成边界
          const cell = caps.get(key)?.targets?.[target]
          assert.ok(cell, `AN-09 里没有 ${key} × ${target} 的格子，但 ${c.id} 的令牌 "${name}" 映射到了它`)
          if (cell.level !== 'full') {
            assert.ok(
              RANK[claim] <= RANK.compile,
              `${c.id} 在 ${site}（${target}）声明 ${claim}，但 "${name}" 在该端只是 ${cell.level}：${cell.note}`
            )
          }
        }
        if ((c.escapeHatch ?? []).length > 0) {
          assert.ok(RANK[claim] <= RANK.compile, `${c.id} 用了逃生舱（${c.escapeHatch.join(', ')}），${site} 的 claim 最多 compile`)
        }
      }
      const maxSite = Math.max(...SITE_NAMES.map((s) => RANK[c.sites[s]]))
      assert.equal(RANK[c.claim], maxSite, `${c.id} 的顶层 claim（${c.claim}）与各站最大值不一致 —— 顶层不能比任何站都强，也不该比最强的站更弱`)
    }
  })
} finally {
  cleanup()
}

await check('8. 宿主接线：路由 → 组件 → 案例产物；通用宿主进 registry', () => {
  for (const c of manifest.cases) {
    for (const site of SITE_NAMES) {
      const routerRel = SITE_INFO[site].router
      const routerText = read(routerRel)
      const spec = routeComponent(routerText, c.host.route)
      assert.ok(
        spec,
        `${routerRel} 里没有可解析的路由 ${c.host.route}（${c.id}）—— 案例在库里但站点看不到`
      )
      const hostRel = resolveSpecifier(site, routerRel, spec)
      assert.ok(existsSync(join(ROOT, hostRel)), `${c.id} 在 ${site} 的路由指向不存在的文件：${hostRel}`)
      const hostText = read(hostRel)
      const basename = c.artifacts.schema.split('/').pop()
      if (c.host.kind === 'custom') {
        // 定制宿主自己写叙事，但必须真的加载本案例的产物（否则它只是长得像）
        assert.ok(hostText.includes(basename), `${hostRel} 没有引用本案例产物 ${basename}`)
      } else {
        // 通用宿主：registry 静态 import + 画廊组件按 id 取用
        assert.ok(hostText.includes('AI_CASES') || hostText.includes('AI_CASE_LIST'),
          `${hostRel} 没有从 registry 取案例（通用宿主必须由 manifest 驱动）`)
      }
      assert.ok(
        read(SITE_INFO[site].casesPage).includes(c.host.route),
        `${SITE_INFO[site].casesPage} 没有指向 ${c.host.route} 的入口（${c.id} 在站点上没有发现路径）`
      )
    }
  }

  // registry 本身就是生成物：内容必须等于 buildPlan 里那一份（含 id/claim/tokens 字段）。
  for (const entry of plan) {
    if (entry.kind !== 'registry') continue
    for (const target of entry.targets) {
      const rel = relFromRoot(target)
      assert.ok(existsSync(target), `${rel} 不存在（运行 npm run cases:sync）`)
      assert.ok(sameText(readText(target), entry.text), `${rel} 与 manifest 生成的内容不一致（运行 npm run cases:sync，不要手改）`)
    }
  }
})

await check('9. 站点副本与单源逐字节一致', () => {
  for (const entry of plan) {
    if (entry.kind === 'registry') continue // 已在断言 8 里逐字节比对
    const srcText = entry.text !== undefined ? entry.text : read(entry.source)
    for (const target of entry.targets) {
      const rel = relFromRoot(target)
      assert.ok(existsSync(target), `${rel} 不存在（运行 npm run cases:sync）`)
      assert.ok(sameText(readText(target), srcText), `${rel} 与单源 ${entry.source} 不一致（运行 npm run cases:sync，不要手改站点副本）`)
    }
  }
})

await check('10. e2e 登记：spec 会被运行器真的加载', () => {
  const { baseDir, patterns } = runnerRules()
  const res = patterns.map(globToRe)
  for (const c of manifest.cases) {
    for (const spec of c.e2e ?? []) {
      const rel = `${baseDir}/${spec}`
      assert.ok(existsSync(join(ROOT, rel)), `${c.id} 的 e2e spec 不存在：${rel}`)
      const inner = rel.slice(baseDir.length + 1)
      assert.ok(
        res.some((re) => re.test(inner)),
        `${c.id} 的 e2e spec 落在 testDir 下，但不匹配运行器的 testMatch（${patterns.join(' / ')}）—— 写进 e2e[] 也不会被执行`
      )
    }
  }
})

await check('11. 不引用评测产物（accuracy / last-accuracy）', () => {
  const BANNED = /(last-)?accuracy/i
  const files = new Set(['docs/cases/ai-cases.json', 'docs/ai/ai-capability-matrix.json'])
  for (const c of manifest.cases) for (const rel of Object.values(c.artifacts ?? {})) files.add(rel)
  for (const rel of files) {
    const hit = read(rel).split('\n').findIndex((line) => BANNED.test(line))
    assert.equal(hit, -1, `${rel} 第 ${hit + 1} 行引用了评测产物（accuracy）—— 展示案例不得把评测数字当宣传品`)
  }
})

// ── 断言 6：覆盖门（默认报告，--strict-coverage 才红）────────────────────────
const referenced = new Set()
for (const c of manifest.cases) {
  if (c.claim === 'measure') continue
  for (const name of c.tokens) referenced.add(name)
}
const reachable = Object.entries(matrix.tokens)
  .filter(([, v]) => v.kind === 'declarative' && v.reach.startsWith('front-door'))
  .map(([k]) => k)
const uncovered = reachable.filter((t) => !referenced.has(t))

if (STRICT_COVERAGE) {
  await check('6. 覆盖门：每个前门可达令牌至少被一例引用', () => {
    assert.deepEqual(uncovered, [], `以下前门可达令牌没有任何案例引用：${uncovered.join(', ')}`)
  })
} else {
  console.log(
    `  ℹ️  6. 覆盖（报告，非门禁）：前门可达 ${reachable.length} 个令牌，已被引用 ` +
      `${reachable.length - uncovered.length} 个；未引用：${uncovered.length ? uncovered.join(', ') : '（无）'}`
  )
  if (uncovered.length > 0) {
    console.log('     打开门禁用 `npm run check:ai-cases -- --strict-coverage`（Wave B 的准入条件）。')
  }
}

if (failed > 0) {
  console.error(`\n[check:ai-cases] 失败 ${failed} 项`)
  process.exit(1)
}
console.log(
  `\n[check:ai-cases] 通过：${manifest.cases.length} 个案例（${manifest.cases.filter((c) => c.replay.kind === 'frozen-config').length} 个可机械重放）、` +
    `三站副本一致、claim 未越 AN-09 边界`
)
