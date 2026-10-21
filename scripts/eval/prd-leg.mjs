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
 * ## Why it is not a gate
 *
 * The user-ratified 95% definition is CRUD `scoped ∨ convergence`. This corpus
 * measures a different input shape (spec text, not a request) and a different
 * output (surfaces, not a config). It is reported and recorded, never folded
 * into the gate — the same separation as the fragment leg, but without a floor
 * until a real full run establishes one.
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
  return {
    cases: rows.length,
    measured: measured.length,
    notMeasured: notMeasuredRows.length,
    presenceRate: mean((s) => s.presence.ok),
    membershipRate: total ? Number((correct / total).toFixed(4)) : null,
    membershipCorrect: correct,
    membershipTotal: total,
    dialogRate: mean((s) => s.dialogs.ok),
    exactRate: mean((s) => s.exact),
    compileRate: compile.rate,
    compileMeasured: compile.measured,
    compileCompiled: compile.compiled,
    compileFailure: compile.failure,
  }
}

/**
 * Feed a model-produced `generate_crud` argument object through the REAL front
 * door handler and compile every fenced block. Host-given fields (`name`,
 * `apiUrl`, `target`, `mode`) are injected from the case when absent — they are
 * not part of what this leg measures.
 *
 * `fd` is the object returned by `setupFrontDoor()` (shape + cap.handler). The
 * function never throws: a bad row is recorded, not allowed to abort the run.
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
    const r = await fd.cap.handler(parsed.data)
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
