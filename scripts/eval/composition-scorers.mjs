#!/usr/bin/env node
/**
 * 三组件组合（AN-17）的**合约透镜** —— 与 `dialog-scorers.mjs` 同构。
 *
 * ## 为什么不新写一套记分卡
 *
 * 组合产物最终仍是一份 `StructuredCrudConfig`（或 no-table 分支的几个片段），
 * 它的通用维度（propSet / formtype / membership / actions / dialogs / operationColumn …）
 * 已经由 `scorers.mjs` 的 `scoreAll` 单一实现覆盖。再写一份打分只会让同一意图在两处
 * 判分：阈值一调就分叉，而分叉的那一份仍然会给出「通过」。
 *
 * 本模块只补 `scoreAll` **结构上看不到**的组合事实：
 *
 * 1. **形状**：`query+table+form+dialog`（full）/ `table+form` / `form+dialog`。
 *    形状不是配置字段，无法由 `scoreAll` 的维度表达；它由「哪些面有非空字段表」派生。
 * 2. **同名字段归并**：同一个 prop 同时出现在多个面时，`composeCrudConfig` 必须归并成
 *    **一条** `fields[]` 并写入三个成员布尔。`scoreAll` 的 membership 只比较布尔值 ——
 *    若预测把同名字段写成两条（一条 inTable、一条 inForm），membership 甚至会「看起来对」。
 *    这里单独判 `duplicates`。
 * 3. **动作/弹窗的派生**：`table+form` 形状没有显式 `dialogs`，动作由「表单面存在」推导为
 *    `['add','edit']`，产物走 legacy `dialogFormItems`；`full` 形状由 dialog key 推导动作。
 *    这是「组合」与「单面」的语义差，必须能单独失败。
 * 4. **operationColumn**：组合页的按钮面由 `actions` 在运行时派生；显式声明时原样保留。
 *    判等（`null` ≡ 未声明）。
 *
 * ## 与其它工件的边界
 *
 * - **语料**：`__tests__/golden/composition/`（18 例，6 例/target）。
 * - **确定性驱动**：`composition-scorers.test.mjs` 用真前门（`captureFrontDoor`）跑
 *   每条语料：table-bearing 走 `composeCrudConfig → generateFromConfig`，no-table 走片段
 *   分支；产物全部过 Tier A 编译（`compileBlocks`）。
 * - **运行时**：三端各至少 1 例 mount（vue3/antdv Tier 1，vue2 Tier 2）。
 *
 * 本模块是纯函数、零依赖（只 re-export `scoreAll`），可在无 API key 的 CI 里自测。
 */

import { scoreAll } from './scorers.mjs'

/** 组合形状全集。顺序即报告顺序。 */
export const COMPOSITION_SHAPES = Object.freeze(['full', 'table+form', 'form+dialog'])

/** 面的固定顺序 —— 形状字符串与成员布尔列表都用它。 */
export const SURFACE_ORDER = Object.freeze(['query', 'table', 'form', 'dialog'])

/** 形状 ← 有非空字段表的面集合。`full` 是四面的固定简写。 */
const SHAPE_BY_SURFACES = Object.freeze({
  'query+table+form+dialog': 'full',
  'table+form': 'table+form',
  'form+dialog': 'form+dialog',
})

const ACTION_FROM_DIALOG = Object.freeze(['add', 'edit', 'view'])

/** 面是否「在场」：非空数组。显式的空数组等价于未给（前门也只认 length > 0）。 */
export function hasSurface(v) {
  return Array.isArray(v) && v.length > 0
}

/** 由 surfaces 派生形状；不认识的集合原样返回（让标注检查能点名，而不是静默归一类）。 */
export function shapeOfSurfaces(surfaces = {}) {
  const present = SURFACE_ORDER.filter((k) => hasSurface(surfaces[k]))
  const key = present.join('+')
  return SHAPE_BY_SURFACES[key] ?? key
}

/**
 * 由 config 派生形状（与 `shapeOfSurfaces` 对偶）。
 *
 * 成员布尔省略 == 在场（Zod 默认 true，与 `compose-crud-config.ts` 的写入方向一致）；
 * `dialogs` 只在显式声明时算「弹窗面」—— `table+form` 形状的弹窗是**运行时从 actions
 * 派生**的 legacy 形态，配置里没有 `dialogs` 键，因此不能算进形状。
 */
export function shapeOfConfig(config = {}) {
  const fields = config.fields ?? []
  const surfaces = {
    query: fields.filter((f) => f.inQuery !== false),
    table: fields.filter((f) => f.inTable !== false),
    form: fields.filter((f) => f.inForm !== false),
    dialog: config.dialogs ? Object.keys(config.dialogs) : [],
  }
  return shapeOfSurfaces(surfaces)
}

/** 字段 → 它出现的面列表（固定顺序）。省略的成员布尔按 true 处理。 */
export function membershipOfConfig(config = {}) {
  const out = {}
  for (const f of config.fields ?? []) {
    const faces = []
    if (f.inQuery !== false) faces.push('query')
    if (f.inTable !== false) faces.push('table')
    if (f.inForm !== false) faces.push('form')
    out[f.prop] = faces
  }
  return out
}

/** 同一个 prop 在 fields[] 里出现多次 —— 组合归并失效的直接证据。 */
export function duplicateProps(config = {}) {
  const seen = new Set()
  const dup = []
  for (const f of config.fields ?? []) {
    if (seen.has(f.prop)) {
      if (!dup.includes(f.prop)) dup.push(f.prop)
    } else seen.add(f.prop)
  }
  return dup
}

/**
 * 一份 config 的组合事实（gold 与 pred 用同一函数，保证同一把尺子）。
 *
 * `legacyDialogFormItems`：没有显式 `dialogs`、但有表单面且动作含 add/edit/view ——
 * 这正是 `structured-generator.ts` 的 legacy 分支（`schema.dialogFormItems`）。
 */
export function compositionFacts(config = {}) {
  const actions = Array.isArray(config.actions) ? [...config.actions] : []
  const hasForm = (config.fields ?? []).some((f) => f.inForm !== false)
  return {
    shape: shapeOfConfig(config),
    membership: membershipOfConfig(config),
    duplicates: duplicateProps(config),
    actions: actions.slice().sort(),
    dialogKeys: config.dialogs ? Object.keys(config.dialogs).sort() : [],
    legacyDialogFormItems:
      !config.dialogs && hasForm && actions.some((a) => ACTION_FROM_DIALOG.includes(a)),
    operationColumn: config.operationColumn ?? null,
  }
}

/** 稳定序列化（键排序）—— 与 `scorers.mjs` / `fragment-scorers.mjs` 同实现。 */
function canon(v) {
  if (Array.isArray(v)) return v.map(canon)
  if (v && typeof v === 'object') {
    const out = {}
    for (const k of Object.keys(v).sort()) out[k] = canon(v[k])
    return out
  }
  return v
}
function eq(a, b) {
  return JSON.stringify(canon(a)) === JSON.stringify(canon(b))
}

/**
 * 语料标注健康检查。返回问题数组（空 = 健康）。
 *
 * 钉住的都是「写错了不会让生成器报错、只会让度量静默失真」的标注：
 *  - 形状与 surfaces 不符（例如 `full` 却漏了 query 面）；
 *  - 同一个面里重复 prop（跨面重名是**合法**的归并输入，同一面里重复不是）；
 *  - `expect.membership` 与 surfaces 不一致 / 漏字段 / 多字段；
 *  - table-bearing 缺 actions / dialogKeys / legacyDialogFormItems；
 *  - form+dialog 的 `expect.dialogBlocks` 与 surfaces.dialog / 表单体不一致。
 */
export function compositionProblems(caseData) {
  const problems = []
  const c = caseData ?? {}
  const id = c.id ?? '(no id)'
  const say = (m) => problems.push(`${id}: ${m}`)
  const surfaces = c.surfaces ?? {}

  if (!COMPOSITION_SHAPES.includes(c.shape)) {
    say(`shape="${String(c.shape)}" 不在 ${COMPOSITION_SHAPES.join(' / ')} 中`)
  }
  const derived = shapeOfSurfaces(surfaces)
  if (c.shape !== derived) say(`shape="${String(c.shape)}" 与 surfaces 派生的 "${derived}" 不一致`)

  for (const k of SURFACE_ORDER) {
    const v = surfaces[k]
    if (v !== undefined && !Array.isArray(v)) {
      say(`surfaces.${k} 不是数组`)
      continue
    }
    const props = (v ?? []).map((f) => (typeof f === 'string' ? f : f?.prop))
    if (new Set(props).size !== props.length) say(`surfaces.${k} 里有重复 prop`)
  }

  if (!['vue3', 'vue2', 'antdv'].includes(c.target)) say(`target="${String(c.target)}" 非法`)
  if (!['schema', 'sfc'].includes(c.mode)) say(`mode="${String(c.mode)}" 非法`)

  const expect = c.expect ?? {}

  if (derived === 'form+dialog') {
    const blocks = expect.dialogBlocks
    if (!Array.isArray(blocks)) {
      say('form+dialog 形状必须给 expect.dialogBlocks')
    } else {
      const keys = (surfaces.dialog ?? []).map(String)
      const got = blocks.map((b) => String(b.key))
      if (!eq(keys.slice().sort(), got.slice().sort())) {
        say(`expect.dialogBlocks 的 key（${got.join(',')}）与 surfaces.dialog（${keys.join(',')}）不一致`)
      }
      const bodyProps = (surfaces.form ?? []).map((f) => f.prop)
      for (const b of blocks) {
        if (!eq(b.fields, bodyProps)) {
          say(`dialogBlocks['${b.key}'].fields 必须等于 form 面字段（${bodyProps.join(',')}）`)
        }
      }
    }
    return problems
  }

  // table-bearing：expect.membership 必须与 surfaces 的成员关系逐字段一致。
  const expectedMembership = {}
  for (const face of ['query', 'table', 'form']) {
    for (const f of surfaces[face] ?? []) {
      ;(expectedMembership[f.prop] ??= []).push(face)
    }
  }
  const declared = expect.membership ?? {}
  for (const prop of Object.keys(expectedMembership)) {
    if (!(prop in declared)) say(`expect.membership 漏了字段 "${prop}"`)
    else if (!eq(declared[prop], expectedMembership[prop])) {
      say(
        `expect.membership["${prop}"] = ${JSON.stringify(declared[prop])}，` +
          `但 surfaces 里它在 ${JSON.stringify(expectedMembership[prop])}`
      )
    }
  }
  for (const prop of Object.keys(declared)) {
    if (!(prop in expectedMembership)) say(`expect.membership 多了字段 "${prop}"（surfaces 里没有）`)
  }

  if (!Array.isArray(expect.actions)) say('缺 expect.actions（table-bearing 形状的派生动作）')
  if (!Array.isArray(expect.dialogKeys)) say('缺 expect.dialogKeys（显式 dialogs 的键集；无则空数组）')
  if (typeof expect.legacyDialogFormItems !== 'boolean') {
    say('缺 expect.legacyDialogFormItems（无显式 dialogs 时产物走 legacy dialogFormItems）')
  }
  if (!('operationColumn' in expect)) say('缺 expect.operationColumn（未声明写 null）')

  return problems
}

/**
 * 组合打分：`scoreAll` 的完整结果 + 一枚 `composition` 块。
 *
 * `composition.applicable` 只对 table-bearing 的 gold 为真 —— `form+dialog` 的产物是
 * 片段（composable），`scoreAll` 那套 config 维度在它身上没有意义（与片段记分卡
 * 「表格场景不启用表单专属维度」同一条纪律：不适用的维度不参与分母）。
 *
 * 每个 fact 都独立给出 `pass`，报告能回答「是归并坏了，还是动作派生坏了」。
 */
export function scoreComposition(gold, pred, mask) {
  const s = scoreAll(gold, pred, mask)
  const shape = shapeOfConfig(gold)
  const applicable = shape !== 'form+dialog'

  if (!applicable) {
    return { ...s, composition: { shape, applicable: false, passed: null } }
  }

  const g = compositionFacts(gold)
  const p = compositionFacts(pred)
  const detail = {
    membership: eq(g.membership, p.membership),
    sameNameMerged: p.duplicates.length === 0,
    actions: eq(g.actions, p.actions),
    dialogKeys: eq(g.dialogKeys, p.dialogKeys),
    legacyDialogFormItems: g.legacyDialogFormItems === p.legacyDialogFormItems,
    operationColumn: eq(g.operationColumn, p.operationColumn),
  }
  return {
    ...s,
    composition: {
      shape,
      applicable: true,
      passed: Object.values(detail).every(Boolean),
      ...detail,
      // 精确定位：归并失效时点名重复的 prop；成员不符时点名字段。
      ...(detail.sameNameMerged ? {} : { duplicateProps: p.duplicates }),
      ...(detail.membership
        ? {}
        : {
            membershipMisses: Object.keys(g.membership)
              .filter((k) => !eq(g.membership[k], p.membership[k]))
              .map((k) => `${k}: want ${JSON.stringify(g.membership[k])} got ${JSON.stringify(p.membership[k] ?? null)}`),
          }),
    },
  }
}

/**
 * 组合口径的 scoped 判定：通用 scoped 命中 **且** 全部组合事实命中。
 *
 * 与 `dialog-scorers` 只做「合约视图」一致：这里不发明新的分母，只在通用判定上
 * AND 一组组合事实。`form+dialog` 不启用组合事实（见上）。
 */
export function compositionScoped(result) {
  if (!result?.composition?.applicable) return result?.exactIntentScoped === true
  return result.exactIntentScoped === true && result.composition.passed === true
}
