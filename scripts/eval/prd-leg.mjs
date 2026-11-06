/**
 * AN-19 — PRD / design extraction leg (observation only).
 *
 * ## What is measured
 *
 * A text PRD (or a host-transcribed wireframe) goes in; the model produces the
 * `generate_crud` intent table; this module compares the **surfaces** against
 * the case's gold config. It deliberately does NOT score prop names, formtypes,
 * validation rules or API details:
 *
 *   - `prop` is a naming choice; the spec gives Chinese labels, not camelCase;
 *   - `formtype` is scored by the CRUD/fragment legs already, on corpora that
 *     were designed for it;
 *   - the "first mile" question is exclusively **which surfaces exist and which
 *     labelled fields belong to each**.
 *
 * Membership decisions are micro-averaged over the union of gold and predicted
 * labels per surface: a missing field and an invented field both count as wrong,
 * and a field placed in the wrong surface is wrong in both surfaces it touches.
 * That makes "put everything everywhere" score no better than omitting it.
 *
 * ## Why it is a gate (P12)
 *
 * The user-ratified 95% definition is CRUD `scoped ∨ convergence`; the PRD corpus
 * measures a different input (spec text) and output (surfaces), so its number never
 * folds into that gate. It has its **own** gate, on its own denominator:
 *
 *   complete (every case answered) ∧ no product fails to compile ∧
 *   `membershipRate ≥ PRD_MEMBERSHIP_FLOOR`
 *
 * The floor is set from a real full run, not from aspiration: 2026-11-02 measured
 * 181/190 = 95.26% on 22/22 cases with 0 compile failures. A 0.90 floor leaves
 * ~5.3pp of headroom — enough for night-to-night model noise, far too little to hide
 * a structural regression (dropping `form` membership alone costs ≫ 5pp). Without a
 * floor the leg could regress to 50% and every gate would stay green while the
 * published "first mile" claim quietly became false.
 *
 * Still **not** part of the CRUD badge or the 95% definition: the CRUD gate keeps
 * its meaning. Its own gate enters `passed` / exit code, and failures are reported
 * as `prd.gateFailures` so a red run names which criterion fired instead of only
 * showing a number.
 *
 * ## Integrity
 *
 * `check:prd` drives every gold case through the real front door and compiles
 * the product; a corpus that is not expressible or not compilable cannot quietly
 * produce an observation number. It also asserts ≥20 cases and route coverage.
 */
import { readdirSync, readFileSync } from 'node:fs'
import { join } from 'node:path'
import { isNotMeasured } from './repair-loop.mjs'
import { summarizeCompile } from './compile-leg.mjs'

export const SURFACE_KEYS = Object.freeze(['query', 'table', 'form', 'dialog'])
export const PRD_MIN_CASES = 20
/**
 * Membership floor for the PRD leg's own gate. Origin: 2026-11-02 full run,
 * 181/190 = 0.9526 on a complete 22-case, 0-compile-failure measurement.
 * Never lower it to make a red night green — lower it only by a ratified decision
 * that also rewrites the published claim.
 */
export const PRD_MEMBERSHIP_FLOOR = 0.9

/** Labels are compared after whitespace removal + ASCII case folding. */
export function normalizeLabel(v) {
  return String(v ?? '')
    .replace(/\s+/g, '')
    .toLowerCase()
}

/** A surface field's identity in the extraction contract: its label (prop is a fallback). */
export function labelOf(field) {
  return normalizeLabel(field?.label ?? field?.prop)
}

/** Dialog entries are canned strings or `{ key }` objects. */
export function dialogKeyOf(entry) {
  return normalizeLabel(typeof entry === 'string' ? entry : entry?.key)
}

/**
 * Normalize a front-door `surfaces` object into label/key sets.
 * Empty lists are omitted — presence is "non-empty", not "key exists".
 */
export function surfaceSets(surfaces) {
  const src = surfaces ?? {}
  const out = {}
  for (const key of ['query', 'table', 'form']) {
    const list = Array.isArray(src[key]) ? src[key] : []
    const labels = list.map(labelOf).filter(Boolean)
    if (labels.length) out[key] = new Set(labels)
  }
  const dialogs = Array.isArray(src.dialog) ? src.dialog : []
  const keys = dialogs.map(dialogKeyOf).filter(Boolean)
  if (keys.length) out.dialog = new Set(keys)
  return out
}

/** The set of non-empty surfaces, for presence comparison. */
export function presentSurfaces(surfaces) {
  return SURFACE_KEYS.filter((k) => surfaceSets(surfaces)[k] !== undefined)
}

/**
 * Score one prediction against one gold `surfaces` object.
 *
 * @returns {{
 *   exact: boolean,
 *   presence: { ok: boolean, want: string[], got: string[] },
 *   membership: { ok: boolean, correct: number, total: number, rate: number|null, misses: string[] },
 *   dialogs: { ok: boolean, want: string[], got: string[] },
 * }}
 */
export function scorePrdSurfaces(pred, gold) {
  const want = surfaceSets(gold)
  const got = surfaceSets(pred)
  const wantPresence = SURFACE_KEYS.filter((k) => want[k] !== undefined)
  const gotPresence = SURFACE_KEYS.filter((k) => got[k] !== undefined)
  const presenceOk =
    wantPresence.length === gotPresence.length && wantPresence.every((k) => gotPresence.includes(k))

  let correct = 0
  let total = 0
  const misses = []
  for (const key of ['query', 'table', 'form']) {
    const w = want[key] ?? new Set()
    const g = got[key] ?? new Set()
    const union = new Set([...w, ...g])
    for (const label of union) {
      total++
      const inWant = w.has(label)
      const inGot = g.has(label)
      if (inWant === inGot) correct++
      else misses.push(`${key}:${label}:${inWant ? 'want-in' : 'want-out'}:${inGot ? 'got-in' : 'got-out'}`)
    }
  }
  const membershipOk = correct === total

  const wantDialogs = [...(want.dialog ?? [])].sort()
  const gotDialogs = [...(got.dialog ?? [])].sort()
  const dialogsOk =
    wantDialogs.length === gotDialogs.length && wantDialogs.every((k) => gotDialogs.includes(k))

  return {
    exact: presenceOk && membershipOk && dialogsOk,
    presence: { ok: presenceOk, want: wantPresence, got: gotPresence },
    membership: {
      ok: membershipOk,
      correct,
      total,
      rate: total ? Number((correct / total).toFixed(4)) : null,
      misses: misses.slice(0, 12),
    },
    dialogs: { ok: dialogsOk, want: wantDialogs, got: gotDialogs },
  }
}

/**
 * Read `__tests__/golden/prd/*.json`. Never throws: malformed files are
 * collected so `check:prd` can name them and the eval can keep the rest.
 */
export function loadPrdCases(dir) {
  const cases = []
  const errors = []
  const files = readdirSync(dir)
    .filter((f) => f.endsWith('.json'))
    .sort()
  for (const file of files) {
    let raw
    try {
      raw = JSON.parse(readFileSync(join(dir, file), 'utf8'))
    } catch (err) {
      errors.push(`${file}: 不是合法 JSON — ${err.message}`)
      continue
    }
    const problems = []
    if (typeof raw.id !== 'string' || !raw.id.trim()) problems.push('缺 id')
    if (typeof raw.spec !== 'string' || raw.spec.trim().length < 20) problems.push('spec 缺失或过短')
    if (!raw.config || typeof raw.config !== 'object') problems.push('缺 config')
    else {
      if (typeof raw.config.name !== 'string' || !raw.config.name.trim()) problems.push('config.name 缺失')
      if (typeof raw.config.apiUrl !== 'string' || !raw.config.apiUrl.trim()) problems.push('config.apiUrl 缺失')
      if (!Array.isArray(raw.config.fields) || raw.config.fields.length === 0) problems.push('config.fields 为空')
    }
    if (problems.length) {
      errors.push(`${file}: ${problems.join('；')}`)
      continue
    }
    cases.push({ file, id: raw.id, spec: raw.spec, target: raw.target ?? raw.config.target ?? 'vue3', raw })
  }
  return { cases, errors }
}

/**
 * Aggregate PRD rows. Same measurement discipline as the fragment leg:
 *   - `model-failure` rows are **in the result** (score 0) — the model really
 *     answered and got it wrong;
 *   - `no-answer` / `truncated` rows are **not measured** and are excluded, with
 *     the count published;
 *   - compile denominators contain only rows that produced a product.
 */
export function summarizePrd(rows) {
  const notMeasuredRows = rows.filter((r) => r.error && isNotMeasured(r.errorKind))
  const measured = rows.filter((r) => !(r.error && isNotMeasured(r.errorKind)))
  const hit = (r, sel) => (r.score && sel(r.score) ? 1 : 0)
  const mean = (sel) =>
    measured.length
      ? Number((measured.reduce((a, r) => a + hit(r, sel), 0) / measured.length).toFixed(4))
      : null

  let correct = 0
  let total = 0
  for (const r of measured) {
    if (!r.score?.membership) continue
    correct += r.score.membership.correct
    total += r.score.membership.total
  }
  // Compile denominator = rows that actually produced a product. A model failure
  // has `error` (already excluded by summarizeCompile); a front-door rejection
  // has no error but also no product — give it a synthetic one so a model-side
  // "empty surfaces" is not reported as an emitter compile defect.
  const compile = summarizeCompile(
    rows.map((r) => (r.error || r.produced !== false ? r : { ...r, error: r.compileError?.message ?? '没有产物' }))
  )
  const membershipRate = total ? Number((correct / total).toFixed(4)) : null
  // P12 gate. Keep every criterion visible in `gateFailures`: a red run must name
  // which one fired, otherwise the number alone reads like model drift.
  const gateFailures = []
  if (rows.length === 0) gateFailures.push('PRD 腿没有任何行（没有可测语料）')
  else if (rows.length < PRD_MIN_CASES) gateFailures.push(`语料 ${rows.length} 条 < 地板 ${PRD_MIN_CASES}`)
  if (notMeasuredRows.length) gateFailures.push(`${notMeasuredRows.length} 条未测到（no-answer / truncated）`)
  if (compile.failure > 0) gateFailures.push(`产物编译失败 ${compile.failure} 条`)
  if (membershipRate === null) gateFailures.push('membership 没有可测决策（分母为 0）')
  else if (membershipRate < PRD_MEMBERSHIP_FLOOR) {
    gateFailures.push(`membership ${membershipRate} < 地板 ${PRD_MEMBERSHIP_FLOOR}`)
  }
  return {
    cases: rows.length,
    measured: measured.length,
    notMeasured: notMeasuredRows.length,
    presenceRate: mean((s) => s.presence.ok),
    membershipRate,
    membershipCorrect: correct,
    membershipTotal: total,
    dialogRate: mean((s) => s.dialogs.ok),
    exactRate: mean((s) => s.exact),
    compileRate: compile.rate,
    compileMeasured: compile.measured,
    compileCompiled: compile.compiled,
    compileFailure: compile.failure,
    membershipFloor: PRD_MEMBERSHIP_FLOOR,
    gateOk: gateFailures.length === 0,
    gateFailures,
  }
}

/**
 * Feed a model-produced intent object through the REAL **scene router**
 * (`generate_scene`, scene='crud') and compile every fenced block. Host-given
 * fields (`name`, `apiUrl`, `target`, `mode`) are injected from the case when
 * absent — they are not part of what this leg measures.
 *
 * The model's answer is the *intent table*; P7 routes it the way the published
 * front door does (`{ scene: 'crud', intent }`). Driving the old adapter here
 * would measure an entry point users are no longer told to call, i.e. the very
 * split this leg exists to prevent (see `check:scene-eval`).
 *
 * `fd` is the object returned by `setupFrontDoor()` (`shape` for early
 * rejection + `sceneCap.handler`). The function never throws: a bad row is
 * recorded, not allowed to abort the run.
 */
export async function drivePrdSurfaces(fd, pred, goldConfig, compileBlocks, fencedBlocks) {
  const out = { branch: null, rejected: null, compileFailures: [], produced: false }
  try {
    const surfaces = pred?.surfaces ?? {}
    const args = {
      ...pred,
      name: pred?.name || goldConfig.name,
      apiUrl: pred?.apiUrl || goldConfig.apiUrl,
      target: goldConfig.target ?? 'vue3',
      mode: goldConfig.mode ?? 'schema',
      surfaces,
    }
    const parsed = fd.shape.safeParse(args)
    if (!parsed.success) {
      out.rejected = `crudShape: ${parsed.error.issues
        .slice(0, 2)
        .map((i) => `${i.path.join('.') || '(root)'}: ${i.message}`)
        .join('; ')}`
      return out
    }
    const r = await fd.sceneCap.handler({ scene: 'crud', intent: parsed.data })
    const text = r.content?.[0]?.text ?? ''
    if (r.isError) {
      out.rejected = text.split('\n')[0]
      return out
    }
    out.branch = (parsed.data.surfaces?.table?.length ?? 0) > 0 ? 'table' : 'fragment'
    if (fencedBlocks(text).length === 0) {
      out.rejected = '产物里没有任何围栏代码块'
      return out
    }
    out.produced = true
    out.compileFailures.push(...compileBlocks(text, 'prd'))
  } catch (err) {
    out.rejected = `threw: ${String(err?.message ?? err).split('\n')[0]}`
  }
  return out
}
