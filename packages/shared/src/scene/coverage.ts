/**
 * 宿主规格的**逐页覆盖分级**（P13）—— L1 直出 / L2 直出+扩展点 / L3 需宿主代码。
 *
 * ## 为什么要分级，而不是承诺「任意复杂」
 *
 * 「es-plus 能否覆盖这套中后台」这个问题只有在**每页都能给出判定**时才可回答。
 * 分级不引入新的能力声明：它直接读 P9 能力台账（`assessIntent`）——
 *   - 意图全部 `accepted` 且形状合法 → **L1**：`generate_scene` 一次直出，零编辑；
 *   - 有 `degraded` 键 / 一页要装多个片段 / 宿主显式声明扩展点 → **L2**：
 *     仍由确定性生成器产出，但某一部分需要宿主接线或补偿；
 *   - 有 `unsupported` / 缺必填键 / 宿主声明要写代码 → **L3**：声明式路径到不了，
 *     必须由宿主自己写。
 *
 * ## 宿主提供的是「结构化清单」，不是散文
 *
 * 本模块刻意不接受自然语言：分类必须是**确定性的**，所以宿主先把规格整理成
 * `pages[]`，每页给出它打算交给生成器的 `scene` + `intent`（以及可选的扩展点/自有代码）。
 * 同一份清单重跑必得同一结果；这也是「人工抽检一致」验收的前提。
 *
 * ## 边界
 *
 * 分类只回答「按这份意图，生成器能不能直出」。**结构是否合法**由调用方决定：
 * 传入 `validatePart` 时，不合法部分直接判 L3（例如 `surfaces.table` 不是数组，
 * `assessIntent` 只会当成「没有表」而误判成可直出）；不传则保持纯台账分类，
 * 由 `validate_intent` 另行负责形状。本模块不做字段级校验，也不生成代码。
 */
import { assessIntent } from './capability.js'
import { isScene, type SceneId } from './registry.js'

export const COVERAGE_CONTRACT_VERSION = 'es-plus.coverage@1' as const

export const COVERAGE_LEVELS = ['L1', 'L2', 'L3'] as const
export type CoverageLevel = (typeof COVERAGE_LEVELS)[number]

export const COVERAGE_LEVEL_MEANING: Readonly<Record<CoverageLevel, string>> = Object.freeze({
  L1: 'direct emit — every key that affects the rendered page lands; metadata-only keys (name / apiUrl / mode) may be absent when the fragment has no carrier, and need no host edit',
  L2: 'direct emit + extension points — the page still generates, but a behavior-bearing key is degraded, the page composes several fragments, or the host declares an extension point',
  L3: 'host code required — an intent key is unsupported / a required key is missing / the intent shape is invalid / the host declares code of its own',
})

export interface CoveragePartResult {
  scene: SceneId | null
  /** 该部分是否按意图直出（与页面等级分开：L2 页面的各部分仍可能全部可直出）。 */
  ok: boolean
  degraded: readonly string[]
  unsupported: readonly string[]
  missing: readonly string[]
  reasons: readonly string[]
}

export interface CoveragePageResult {
  name: string
  level: CoverageLevel
  reasons: readonly string[]
  parts: readonly CoveragePartResult[]
}

export interface CoverageReport {
  contract: typeof COVERAGE_CONTRACT_VERSION
  levels: readonly CoverageLevel[]
  levelsMeaning: Readonly<Record<CoverageLevel, string>>
  pages: readonly CoveragePageResult[]
  summary: Readonly<Record<CoverageLevel, number>>
  /** 清单本身不合法（不是对象 / pages 不是数组…）时的错误；不影响已分类页面。 */
  inventoryErrors: readonly string[]
}

export interface CoverageOptions {
  /**
   * 可选的场景形状校验器。返回非空问题列表时，该部分判 **L3**（生成器会拒绝它，
   * 而不是「降级直出」）。MCP 侧传入 `SCENE_INTENT_SCHEMAS[scene].safeParse` 的投影。
   */
  validatePart?: (scene: SceneId, intent: unknown) => readonly string[]
}

/**
 * 「元数据键」：它们缺失不改变页面渲染/交互，只是没有载体（片段没有页面名、
 * 查询表单不发请求、片段总是 sfc）。因此它们的 degraded 不等于宿主需要接线。
 *
 * 其余 degraded 键（tableOptions / columns / dialogs …）会改变页面行为，仍判 L2。
 */
const METADATA_DEGRADED_KEYS: ReadonlySet<string> = new Set(['name', 'apiUrl', 'mode'])

const isRecord = (v: unknown): v is Record<string, unknown> =>
  !!v && typeof v === 'object' && !Array.isArray(v)

const asArray = (v: unknown): readonly unknown[] => (Array.isArray(v) ? v : [])

/**
 * 一页的 `parts`：优先读 `parts[]`；否则把 `{ scene, intent }` 简写当成单部分。
 * 两者都没有 → 空数组（调用方会判 L3：没有可发射的部分）。
 */
function partsOf(page: Record<string, unknown>): readonly unknown[] {
  if (page.parts !== undefined) return asArray(page.parts)
  if (page.scene !== undefined || page.intent !== undefined) {
    return [{ scene: page.scene, intent: page.intent }]
  }
  return []
}

/**
 * 分类一份宿主清单。纯函数、不抛错；清单畸形变成 `inventoryErrors` + 该页 L3。
 */
export function classifyCoverage(inventory: unknown, options: CoverageOptions = {}): CoverageReport {
  const inventoryErrors: string[] = []
  const pages: CoveragePageResult[] = []
  const summary: Record<CoverageLevel, number> = { L1: 0, L2: 0, L3: 0 }

  if (!isRecord(inventory)) {
    inventoryErrors.push('inventory must be an object with a `pages` array.')
  } else if (!Array.isArray(inventory.pages)) {
    inventoryErrors.push('inventory.pages must be an array of page entries.')
  } else {
    inventory.pages.forEach((raw, index) => {
      const page = classifyPage(raw, index, inventoryErrors, options)
      pages.push(page)
      summary[page.level]++
    })
  }

  return Object.freeze({
    contract: COVERAGE_CONTRACT_VERSION,
    levels: COVERAGE_LEVELS,
    levelsMeaning: COVERAGE_LEVEL_MEANING,
    pages: Object.freeze(pages),
    summary: Object.freeze(summary),
    inventoryErrors: Object.freeze(inventoryErrors),
  })
}

function classifyPage(
  raw: unknown,
  index: number,
  inventoryErrors: string[],
  options: CoverageOptions,
): CoveragePageResult {
  const fallbackName = `page-${index + 1}`
  if (!isRecord(raw)) {
    inventoryErrors.push(`pages[${index}] is not an object.`)
    return Object.freeze({
      name: fallbackName,
      level: 'L3' as const,
      reasons: Object.freeze(['page entry is not an object — nothing can be emitted.']),
      parts: Object.freeze([]),
    })
  }

  const name = typeof raw.name === 'string' && raw.name.trim() !== '' ? raw.name : fallbackName
  const l3: string[] = []
  const l2: string[] = []
  const parts: CoveragePartResult[] = []

  const rawParts = partsOf(raw)
  if (rawParts.length === 0) {
    l3.push('no parts declared — a page needs at least one { scene, intent } part to be emittable.')
  }

  rawParts.forEach((partRaw, partIndex) => {
    if (!isRecord(partRaw)) {
      l3.push(`part ${partIndex} is not an object.`)
      parts.push(frozenPart(null, false, [], [], [], ['part is not an object.']))
      return
    }
    const scene = partRaw.scene
    if (!isScene(scene)) {
      const reason = `unknown scene ${JSON.stringify(scene)} — legal scenes: crud / table / form / dialog.`
      l3.push(`part ${partIndex}: ${reason}`)
      parts.push(frozenPart(null, false, [], [], [], [reason]))
      return
    }

    const capability = assessIntent({ scene, intent: partRaw.intent })
    const reasons: string[] = []

    // 形状不合法 = 生成器会拒绝，不能算「降级直出」。分类器不复制 Zod schema，
    // 由调用方（MCP coverage_report）注入同一份前门形状的 safeParse 投影。
    const shapeProblems = options.validatePart?.(scene, partRaw.intent) ?? []
    if (shapeProblems.length) {
      const detail = `invalid intent shape: ${shapeProblems.join('; ')}`
      l3.push(`part ${partIndex} (${scene}): ${detail} — generate_scene would reject it.`)
      reasons.push(detail)
      parts.push(frozenPart(scene, false, capability.degraded, capability.unsupported, capability.missing, reasons))
      return
    }

    if (capability.unsupported.length) {
      const detail = `unsupported key(s): ${capability.unsupported.join(', ')}`
      l3.push(`part ${partIndex} (${scene}): ${detail} — the generator would silently ignore them.`)
      reasons.push(detail)
    }
    if (capability.missing.length) {
      const detail = `missing required key(s): ${capability.missing.join(', ')}`
      l3.push(`part ${partIndex} (${scene}): ${detail} — the intent cannot be emitted as declared.`)
      reasons.push(detail)
    }
    const behaviorDegraded = capability.degraded.filter((k) => !METADATA_DEGRADED_KEYS.has(k))
    if (behaviorDegraded.length) {
      const detail = `degraded key(s): ${behaviorDegraded.join(', ')}`
      l2.push(`part ${partIndex} (${scene}): ${detail} — emitted, but not faithfully; the host must wire the gap.`)
      reasons.push(detail)
    }
    // 元数据键没有载体不算「需要接线」，但仍记进 `degraded`，让宿主看得见。
    const metadataDegraded = capability.degraded.filter((k) => METADATA_DEGRADED_KEYS.has(k))
    if (metadataDegraded.length) {
      reasons.push(`metadata key(s) without a carrier: ${metadataDegraded.join(', ')} — no host edit needed.`)
    }
    parts.push(
      frozenPart(
        scene,
        capability.ok && behaviorDegraded.length === 0,
        capability.degraded,
        capability.unsupported,
        capability.missing,
        reasons,
      ),
    )
  })

  if (rawParts.length > 1) {
    l2.push(
      `${rawParts.length} parts — assemble them with generate_composition and wire them explicitly (roles / wires).`,
    )
  }

  const extensions = asArray(raw.extensionPoints)
  if (extensions.length) {
    l2.push(`${extensions.length} host extension point(s) declared — the generated page leaves those slots to the host.`)
  }

  const hostCode = asArray(raw.hostCode)
  if (hostCode.length) {
    l3.push(`${hostCode.length} host-code item(s) declared — the declarative path cannot emit this page.`)
  }

  const level: CoverageLevel = l3.length ? 'L3' : l2.length ? 'L2' : 'L1'
  const reasons = l3.length ? l3 : l2
  return Object.freeze({
    name,
    level,
    reasons: Object.freeze(reasons),
    parts: Object.freeze(parts),
  })
}

function frozenPart(
  scene: SceneId | null,
  ok: boolean,
  degraded: readonly string[],
  unsupported: readonly string[],
  missing: readonly string[],
  reasons: readonly string[],
): CoveragePartResult {
  return Object.freeze({
    scene,
    ok,
    degraded: Object.freeze([...degraded]),
    unsupported: Object.freeze([...unsupported]),
    missing: Object.freeze([...missing]),
    reasons: Object.freeze([...reasons]),
  })
}
