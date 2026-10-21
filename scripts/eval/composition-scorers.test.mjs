#!/usr/bin/env node
/**
 * 三组件组合定义级自测（AN-17，无需 API key，进 CI 的 `check:composition`）。
 *
 * 与 `dialog-scorers.test.mjs` 的分工：那份钉弹窗合约（POST/PUT/view 只读是运行时派生，
 * 配置里没有）；本文件钉**组合**——形状、同名字段归并、动作/弹窗派生、operationColumn。
 *
 * 钉七件事：
 *   1) **语料规模**：18 例、6 例/target、三种形状各 6 例；三端同源（除 id/target 外
 *      逐字节相同）—— 否则端间差异会被误当成模型能力差异。
 *   2) **标注健康**：`compositionProblems()` 为空（形状/成员/期望三处自洽）。
 *   3) **真前门驱动**：每条语料经**真的** `generate_crud` handler 跑一遍：
 *      table-bearing → CRUD 分支；form+dialog → no-table 片段分支（这是组合里唯一
 *      **没有** CRUD 产物的形状，必须单独证明它真的被路由到）。
 *   4) **Tier A 编译**：前门产物里所有围栏块过 `compileBlocks`（SFC 走
 *      compileScript+compileTemplate，tsx 走 esbuild）—— 组合不是「拼字符串」，
 *      它必须仍然编译得动。
 *   5) **组合事实 round-trip**：`composeCrudConfig(语料 surfaces)` 的成员布尔 / 同名归并 /
 *      actions / dialogKeys / legacy 形态 / operationColumn 与语料声明逐项一致；
 *      再经 `generateFromConfig` 落到 pageSchema，断言成员关系真的进了 `columns` /
 *      `formItems` / `dialogFormItems` / `dialogs`。
 *   6) **打分器咬得住**：gold-vs-gold 组合事实全绿；对六个事实逐个做外科手术式扰动，
 *      断言对应 fact 与 `composition.passed` 同时翻红（只扰适用的事实）。
 *   7) **no-table 产物形状**：每个 dialog entry 一段 composable，名字由 key 派生，
 *      弹窗体字段 = form 面（前门「省略 formItems 时取 form 面」的既有契约）。
 */

import { readFileSync, readdirSync } from 'node:fs'
import { fileURLToPath } from 'node:url'
import { dirname, join } from 'node:path'
import {
  COMPOSITION_SHAPES,
  compositionFacts,
  compositionProblems,
  compositionScoped,
  shapeOfConfig,
  shapeOfSurfaces,
  scoreComposition,
} from './composition-scorers.mjs'
import { captureFrontDoor, compileBlocks, fencedBlocks, frontDoorArgs } from '../lib/front-door.mjs'

const __dirname = dirname(fileURLToPath(import.meta.url))
const ROOT = join(__dirname, '..', '..')
const CASES_DIR = join(ROOT, '__tests__', 'golden', 'composition')
const TARGETS = ['vue3', 'vue2', 'antdv']

let failures = 0
function check(cond, msg) {
  if (cond) return
  failures++
  console.error(`  ✗ ${msg}`)
}
const clone = (x) => JSON.parse(JSON.stringify(x))
const sorted = (a) => [...a].sort()

/** 键序无关的稳定序列化 —— 成员映射的插入顺序不应影响判等。 */
function canon(v) {
  if (Array.isArray(v)) return v.map(canon)
  if (v && typeof v === 'object') {
    const out = {}
    for (const k of Object.keys(v).sort()) out[k] = canon(v[k])
    return out
  }
  return v
}
const jsonEq = (a, b) => JSON.stringify(canon(a)) === JSON.stringify(canon(b))

function loadCases() {
  return readdirSync(CASES_DIR)
    .filter((f) => f.endsWith('.json'))
    .sort()
    .map((f) => ({ file: f, ...JSON.parse(readFileSync(join(CASES_DIR, f), 'utf8')) }))
}

/** 前门把「罐头 dialog key」展开成 `{ title, formItems }` 的规则（generate-crud.ts）。 */
const DIALOG_TITLES = { add: '新增', edit: '编辑', view: '查看' }
function titleFor(key) {
  return DIALOG_TITLES[key] ?? key
}

/** 与 `generate-crud.ts` 有表支完全同构的 compose 入参（含 dialog 装配）。 */
function composeInput(c) {
  const s = c.surfaces
  const query = s.query ?? []
  const table = s.table ?? []
  const form = s.form ?? []
  const dialogBody = form.length ? form : table
  const dialogs = s.dialog
    ? Object.fromEntries(s.dialog.map((d) => [String(d), { title: titleFor(String(d)), formItems: dialogBody }]))
    : undefined
  return {
    name: c.name,
    apiUrl: c.apiUrl,
    target: c.target,
    mode: c.mode,
    query,
    table,
    form,
    ...(dialogs ? { dialogs } : {}),
  }
}

/** 与 `runtime-harness.ts` 同一条正则：从 schema 产物里取回 pageSchema 对象。 */
function pageSchemaOf(code) {
  const m = code.match(/export\s+const\s+pageSchema\b[^=]*=\s*(\{[\s\S]*\})\s*$/)
  if (!m) throw new Error(`生成物里找不到 pageSchema 对象字面量：\n${code.slice(0, 200)}`)
  return JSON.parse(m[1])
}

async function main() {
  const cases = loadCases()

  // ── 1) 规模与三端同源 ────────────────────────────────────────────────────
  check(cases.length === 18, `组合语料应为 18 例，实得 ${cases.length}`)
  for (const target of TARGETS) {
    const n = cases.filter((c) => c.target === target).length
    check(n === 6, `${target} 应为 6 例，实得 ${n}`)
  }
  for (const shape of COMPOSITION_SHAPES) {
    const n = cases.filter((c) => c.shape === shape).length
    check(n === 6, `形状 ${shape} 应为 6 例，实得 ${n}`)
  }
  const bases = [...new Set(cases.map((c) => c.id.replace(/-(vue3|vue2|antdv)$/, '')))]
  for (const base of bases) {
    const trio = TARGETS.map((t) => cases.find((c) => c.id === `${base}-${t}`))
    check(trio.every(Boolean), `${base} 缺某个 target 的语料`)
    if (!trio.every(Boolean)) continue
    const strip = (c) => {
      const { id, target, file, ...rest } = c
      return JSON.stringify(canon(rest))
    }
    check(new Set(trio.map(strip)).size === 1, `${base} 的三端语料除 id/target 外必须逐字节同源`)
  }

  // ── 2) 标注健康 ──────────────────────────────────────────────────────────
  for (const c of cases) {
    const problems = compositionProblems(c)
    for (const p of problems) check(false, `标注问题 — ${p}`)
    check(shapeOfSurfaces(c.surfaces) === c.shape, `${c.id}: shape 与 surfaces 不符`)
  }

  // ── 3/4/5) 真前门 + Tier A 编译 + 组合事实 round-trip ────────────────────
  console.log('[composition] 打包并捕获真前门…')
  const { mod, cleanup, fromBuild, fromSrc } = await captureFrontDoor()
  try {
    check(fromBuild.length === 0, `前门打包拉到了 shared/build（${fromBuild.slice(0, 3).join(',')}）—— 陈旧构建会测旧代码`)
    check(fromSrc.length > 0, '前门打包没有拉到任何 shared/src 输入')

    const { cap } = mod.capture()
    check(cap?.name === 'generate_crud', `没捕获到 generate_crud（拿到 ${cap?.name ?? 'null'}）`)
    if (!cap) return

    const { z } = await import('zod')
    const crudShapeObj = z.object(cap.shape)
    const composeCrudConfig = mod.composeCrudConfig
    const generateFromConfig = mod.generateFromConfig
    check(typeof composeCrudConfig === 'function', '没拿到 composeCrudConfig')
    check(typeof generateFromConfig === 'function', '没拿到 generateFromConfig')
    if (typeof composeCrudConfig !== 'function' || typeof generateFromConfig !== 'function') return

    for (const c of cases) {
      // 真前门
      const args = frontDoorArgs(c, c.surfaces)
      const parsed = crudShapeObj.safeParse(args)
      check(
        parsed.success,
        `${c.id} — surfaces 过不了真 crudShape：${parsed.success ? '' : parsed.error.issues.slice(0, 3).map((i) => `${i.path.join('.')}: ${i.message}`).join('; ')}`
      )
      if (!parsed.success) continue

      const r = await cap.handler(parsed.data)
      const text = r.content?.[0]?.text ?? ''
      check(!r.isError, `${c.id} — 前门返回 isError：${text.split('\n')[0]}`)
      if (r.isError) continue
      check(fencedBlocks(text).length > 0, `${c.id} — 前门产物没有任何围栏代码块`)
      const compileErrors = compileBlocks(text, `${c.id} × ${c.target} composition`)
      for (const e of compileErrors) check(false, `Tier A 编译失败 — ${c.id}: ${e}`)

      if (c.shape === 'form+dialog') {
        // no-table 分支：必须被真的走到，且每个 dialog entry 一段 composable。
        check(/no table surface/.test(text), `${c.id} — form+dialog 应走 no-table 片段分支`)
        const declared = c.surfaces.dialog.map(String)
        const names = [...text.matchAll(/^## Dialog composable \((\w+)\)/gm)].map((m) => m[1])
        check(names.length === declared.length, `${c.id} — 应发射 ${declared.length} 段 dialog composable，实得 ${names.length}`)
        for (const key of declared) {
          const expectedName = `use${key.charAt(0).toUpperCase()}${key.slice(1)}Dialog`
          check(names.includes(expectedName), `${c.id} — 缺少 composable ${expectedName}（实得 ${names.join(',')}）`)
        }
        // 弹窗体 = form 面：每个产物里都应出现全部表单字段 prop。
        for (const prop of c.surfaces.form.map((f) => f.prop)) {
          check(text.includes(prop), `${c.id} — 片段产物里缺少 form 面字段 "${prop}"`)
        }
        // 没有表格块（no-table 分支的判据是产物类型，不只是提示语）。
        check(!/## Schema \(schema\.ts\)|## Generated SFC/.test(text), `${c.id} — no-table 分支不应生成 CRUD 页面`)
        continue
      }

      // table-bearing：走 compose → generateFromConfig 的落地路径。
      check(!/no table surface/.test(text), `${c.id} — 有 table 面却走了 no-table 分支`)
      const { config, warnings } = composeCrudConfig(composeInput(c))
      check(
        warningListOk(warnings),
        `${c.id} — 组合产生非预期告警：${warnings.join(' | ')}`
      )
      const facts = compositionFacts(config)
      check(facts.shape === c.shape, `${c.id} — 组合后形状 ${facts.shape} ≠ ${c.shape}`)
      check(jsonEq(facts.membership, c.expect.membership), `${c.id} — 成员布尔与语料声明不符：${JSON.stringify(facts.membership)}`)
      check(facts.duplicates.length === 0, `${c.id} — 同名字段归并失效，重复 prop：${facts.duplicates.join(',')}`)
      check(JSON.stringify(facts.actions) === JSON.stringify(sorted(c.expect.actions)), `${c.id} — actions ${JSON.stringify(facts.actions)} ≠ ${JSON.stringify(sorted(c.expect.actions))}`)
      check(JSON.stringify(facts.dialogKeys) === JSON.stringify(sorted(c.expect.dialogKeys)), `${c.id} — dialogKeys ${JSON.stringify(facts.dialogKeys)} ≠ ${JSON.stringify(sorted(c.expect.dialogKeys))}`)
      check(facts.legacyDialogFormItems === c.expect.legacyDialogFormItems, `${c.id} — legacy dialogFormItems 期望 ${c.expect.legacyDialogFormItems}，实得 ${facts.legacyDialogFormItems}`)
      check(JSON.stringify(facts.operationColumn) === JSON.stringify(c.expect.operationColumn), `${c.id} — operationColumn 与语料声明不符`)

      // 落到 pageSchema：成员关系必须真的进 columns / formItems / dialog 面。
      const product = generateFromConfig(config)
      const schema = pageSchemaOf(product.code)
      const inTable = config.fields.filter((f) => f.inTable !== false).map((f) => f.prop)
      const inQuery = config.fields.filter((f) => f.inQuery !== false).map((f) => f.prop)
      const inForm = config.fields.filter((f) => f.inForm !== false).map((f) => f.prop)
      check(JSON.stringify(sorted(schema.columns.map((col) => col.prop))) === JSON.stringify(sorted(inTable)), `${c.id} — pageSchema.columns 与 inTable 字段不一致`)
      const queryProps = (schema.formItems ?? []).map((it) => it.prop)
      check(JSON.stringify(sorted(queryProps)) === JSON.stringify(sorted(inQuery)), `${c.id} — pageSchema.formItems 与 inQuery 字段不一致`)
      check(JSON.stringify(sorted(schema.actions)) === JSON.stringify(sorted(c.expect.actions)), `${c.id} — pageSchema.actions 与期望动作不一致`)
      if (c.shape === 'full') {
        check(JSON.stringify(sorted(Object.keys(schema.dialogs ?? {}))) === JSON.stringify(sorted(c.expect.dialogKeys)), `${c.id} — pageSchema.dialogs 键集不一致`)
        check(schema.dialogFormItems === undefined, `${c.id} — 显式 dialogs 不应同时发射 legacy dialogFormItems`)
      } else {
        check(schema.dialogs === undefined, `${c.id} — table+form 不应发射显式 dialogs`)
        const legacyProps = (schema.dialogFormItems ?? []).map((it) => it.prop)
        check(JSON.stringify(sorted(legacyProps)) === JSON.stringify(sorted(inForm)), `${c.id} — legacy dialogFormItems 应覆盖 inForm 字段`)
      }
    }

    // ── 6) 打分器：gold-vs-gold 全绿 + 逐事实扰动 ─────────────────────────
    const tableCases = cases.filter((c) => c.shape !== 'form+dialog')
    for (const c of tableCases) {
      const { config } = composeCrudConfig(composeInput(c))
      const g = scoreComposition(config, config, { pinnedDims: [] })
      check(g.composition.applicable === true, `${c.id} — table-bearing 组合事实应适用`)
      check(g.composition.passed === true, `${c.id} — gold-vs-gold 组合事实应全绿`)
      check(compositionScoped(g) === true, `${c.id} — gold-vs-gold 组合 scoped 应命中`)

      const pert = (mutate, fact) => {
        const p = clone(config)
        mutate(p)
        const r = scoreComposition(config, p, { pinnedDims: [] })
        check(r.composition[fact] === false, `${c.id} — 扰动应让组合事实 "${fact}" 翻红（当前仍为 ${r.composition[fact]}）`)
        check(r.composition.passed === false, `${c.id} — 扰动 "${fact}" 后组合总分应翻红`)
        check(compositionScoped(r) === false, `${c.id} — 扰动 "${fact}" 后组合 scoped 应翻红`)
      }

      // 成员布尔：把第一个字段从它所在的某个面移出（inQuery 优先，否则 inTable）。
      pert((p) => {
        const f = p.fields[0]
        if (f.inQuery !== false) f.inQuery = false
        else f.inTable = false
      }, 'membership')

      // 同名归并：追加一条同 prop 的字段（归并失效的典型坏产物）。
      pert((p) => {
        p.fields.push({ ...p.fields[0] })
      }, 'sameNameMerged')

      // 动作：删掉一个动作（或换成不存在的）。
      pert((p) => {
        p.actions = ['delete']
      }, 'actions')

      // 弹窗键：full 删一个；table+form 凭空加一个。
      pert((p) => {
        if (p.dialogs && Object.keys(p.dialogs).length) {
          delete p.dialogs[Object.keys(p.dialogs)[0]]
        } else {
          p.dialogs = { add: { title: '新增', formItems: [] } }
        }
      }, 'dialogKeys')

      // legacy 形态：翻转「有没有显式 dialogs」。
      pert((p) => {
        if (p.dialogs) delete p.dialogs
        else p.dialogs = { add: { title: '新增', formItems: [] } }
      }, 'legacyDialogFormItems')

      // operationColumn：凭空声明一个（gold 均为未声明）。
      pert((p) => {
        p.operationColumn = { label: '操作' }
      }, 'operationColumn')
    }

    // form+dialog：config 维度不适用，scoped 必须退回通用口径（不能凭空判红）。
    const noTable = { fields: [{ prop: 'a', inQuery: false, inTable: false, inForm: true }], actions: ['add'], dialogs: { add: {} } }
    const nt = scoreComposition(noTable, noTable, { pinnedDims: [] })
    check(shapeOfConfig(noTable) === 'form+dialog', `no-table 配置应派生 form+dialog，实得 ${shapeOfConfig(noTable)}`)
    check(nt.composition.applicable === false, 'form+dialog 的组合事实应标为不适用')
    check(nt.composition.passed === null, 'form+dialog 的组合事实 passed 应为 null（不参与分母）')
    check(compositionScoped(nt) === nt.exactIntentScoped, 'form+dialog 的 scoped 应退回通用口径')
  } finally {
    cleanup()
  }

  if (failures) {
    console.error(`\n❌ check:composition FAILED（${failures} 处）`)
    process.exit(1)
  }
  const byShape = COMPOSITION_SHAPES.map((s) => `${s}=${cases.filter((c) => c.shape === s).length}`).join(' / ')
  console.log(`✅ check:composition：${cases.length} 例（${byShape}；3 端 × 6），前门路由 + Tier A 编译 + 组合事实全部咬得住。`)
}

/** 组合告警白名单：语料刻意不触发任何告警；出现即说明语料或组合规则发生了漂移。 */
function warningListOk(warnings) {
  return warnings.length === 0
}

main().catch((err) => {
  console.error(err)
  process.exit(1)
})
