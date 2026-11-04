/**
 * 场景能力台账 —— `es-plus.capabilities@1`（P9）。
 *
 * ## 为什么需要它
 *
 * `render-plan.ts` 回答的是「**配置键**在某个 mode 下发射/降级/缺席」，粒度是
 * `StructuredCrudConfig` 的顶层键。宿主拿到的却是**意图**：`generate_scene` 的
 * `intent` 里写的是 `surfaces` / `rowkey` / `permissions`…… 意图键与配置键不是一一
 * 对应（`surfaces.dialog` → `dialogs`、`rowkey` → `tableOptions.rowkey`、无表时整页
 * 生成器根本不参与），所以「我给的这堆键到底哪些真的落进产物」在生成之前没有答案。
 *
 * 第二个缺口在**直接消费者**上：片段场景的 MCP 前门（`generate_scene` /
 * `generate_composition`）已经用 `collectUnknownKeys` 结构化拒绝未知键，但
 * `emitScene` / `emitSceneArtifact` 是 shared 的公开入口 —— CLI、eval、宿主自有接线
 * 可以绕过前门，此时多写的键仍会在运行时被静默忽略。本台账把「这个场景认识哪些键」
 * 变成可查询事实，并让产物信封带上逐键判定（前门路径下 `unsupported` 恒为空，
 * 因为 zod 已经先把它们挡掉了）。
 *
 * ## 三层判据（全部来自源码，不另写一套）
 *
 * - **场景词汇**：四场景的意图键集，编译期与 `CrudIntent` / `TableBlockInput` /
 *   `FormBlockInput` / `DialogBlockInput` 对账（多一个/少一个都过不了 tsc）；
 * - **CRUD 降级**：直接读 `RENDER_PLAN_CONTRACT` 的 `downgrade` 行，不复制 reasons；
 * - **无表 CRUD 支**：`emitCrudScene` 的片段分支只消费 surfaces / target / typescript /
 *   i18n / formLayout / rowkey / apiUrl —— 其余键在该分支没有载体，判 `degraded`。
 *
 * ## 边界
 *
 * 判定是**附加视图**：不改文本、不阻断生成（`unsupported` 也不抛错 —— MCP 前门
 * 在调用发射器之前就用同一份 Zod 形状 + `collectUnknownKeys` 拒绝了它们；shared 的
 * 直接调用者绕过前门，此时台账把「声明了却不会生效」显式化）。`degraded` 仍能产出
 * 可用产物（例如 sfc 模式的 `dialogs` 会退化成由 actions 派生的通用弹窗），只是
 * 保真度低于 schema 模式；能靠换模式保真的那些键带 `alternatives`
 * （见 `CapabilityAlternative`），没有的就必须宿主接线。
 */
import type { TargetFramework } from '../target.js'
import { DEFAULT_TARGET } from '../target.js'
import {
  RENDER_PLAN_CONTRACT,
  type RenderDisposition,
  type RenderPlanKey,
} from '../render-plan.js'
import type { CapabilityEntry } from '../capability.js'
import { CAPABILITIES } from '../capability.js'
import type {
  DialogBlockInput,
  FormBlockInput,
  TableBlockInput,
} from '../fragment-generator.js'
import type { CrudIntent } from './emit.js'
import {
  SCENE_REGISTRY,
  sceneContract,
  type ArtifactKind,
  type SceneId,
  type SceneMode,
} from './registry.js'

/** 协议版本。字段破坏兼容时换版本号。 */
export const CAPABILITY_CONTRACT_VERSION = 'es-plus.capabilities@1' as const

/** `accepted` = 进入产物；`degraded` = 能生成但该键不保真；`unsupported` = 本场景不认识。 */
export const CAPABILITY_VERDICTS = ['accepted', 'degraded', 'unsupported'] as const
export type CapabilityVerdict = (typeof CAPABILITY_VERDICTS)[number]

/**
 * CRUD 意图的顶层键（= `CrudIntent` 的键集）。
 *
 * `satisfies` 抓「写了不存在的键」，下面的 `Assert…` 抓「接口加了键而台账没跟上」。
 */
export const CRUD_INTENT_KEYS = [
  'name',
  'apiUrl',
  'surfaces',
  'target',
  'mode',
  'typescript',
  'i18n',
  'actions',
  'tableOptions',
  'pagination',
  'permissions',
  'formLayout',
  'operationColumn',
  'tableBtns',
  'toolbarBtns',
  'expandConfig',
  'treeConfig',
  'mergeConfig',
  'rowkey',
] as const satisfies readonly (keyof CrudIntent)[]

/** table 场景的意图键（= `generate_table` 的入参形状）。 */
export const TABLE_INTENT_KEYS = [
  'fields',
  'apiUrl',
  'target',
  'typescript',
  'i18n',
  'tableOptions',
  'pagination',
  'rowButtons',
  // P10：与 CRUD 同一套表格词汇（片段表格此前只能换入口才能用）。
  'columns',
  'treeConfig',
  'expandConfig',
  'mergeConfig',
  'rowkey',
] as const satisfies readonly (keyof TableBlockInput)[]

/** form 场景的意图键（= `generate_form` 的入参形状）。 */
export const FORM_INTENT_KEYS = [
  'fields',
  'target',
  'typescript',
  'i18n',
  'context',
  'buttons',
  'formLayout',
] as const satisfies readonly (keyof FormBlockInput)[]

/** dialog 场景的意图键（= `generate_dialog` 的入参形状）。 */
export const DIALOG_INTENT_KEYS = [
  'fields',
  'apiUrl',
  'rowkey',
  'target',
  'typescript',
  'i18n',
  'composableName',
  'mode',
  'defaultTitle',
  'options',
] as const satisfies readonly (keyof DialogBlockInput)[]

/**
 * 编译期完整性断言：接口新增一个键而上面的清单没登记时，这个类型别名会解析成非
 * `never`，`AssertNever` 的约束失败 —— `tsc` 直接报错（与 `render-plan.ts` 的
 * `satisfies Record<keyof …>` 同一纪律）。
 */
type AssertNever<T extends never> = T
export type AssertCrudIntentKeysCovered = AssertNever<
  Exclude<keyof CrudIntent, (typeof CRUD_INTENT_KEYS)[number]>
>
export type AssertTableIntentKeysCovered = AssertNever<
  Exclude<keyof TableBlockInput, (typeof TABLE_INTENT_KEYS)[number]>
>
export type AssertFormIntentKeysCovered = AssertNever<
  Exclude<keyof FormBlockInput, (typeof FORM_INTENT_KEYS)[number]>
>
export type AssertDialogIntentKeysCovered = AssertNever<
  Exclude<keyof DialogBlockInput, (typeof DIALOG_INTENT_KEYS)[number]>
>

/** 场景 → 意图键集（单一真源；`capabilityLedger` 与 `assessIntent` 共用）。 */
export const SCENE_INTENT_KEYS: Readonly<Record<SceneId, readonly string[]>> = Object.freeze({
  crud: CRUD_INTENT_KEYS,
  table: TABLE_INTENT_KEYS,
  form: FORM_INTENT_KEYS,
  dialog: DIALOG_INTENT_KEYS,
})

/**
 * 意图键 → `RENDER_PLAN_CONTRACT` 的配置键。只登记**名字不同/需要静态换算**的那些；
 * 同名的（permissions / toolbarBtns / …）也显式列出，便于读者一眼看全映射面。
 */
const INTENT_TO_RENDER_KEY = {
  permissions: 'permissions',
  toolbarBtns: 'toolbarBtns',
  tableBtns: 'tableBtns',
  operationColumn: 'operationColumn',
  formLayout: 'formLayout',
  pagination: 'pagination',
  tableOptions: 'tableOptions',
  actions: 'actions',
  expandConfig: 'expandConfig',
  treeConfig: 'treeConfig',
  mergeConfig: 'mergeConfig',
  'surfaces.dialog': 'dialogs',
} as const satisfies Record<string, RenderPlanKey>

/**
 * `degraded` 键的**声明式补偿路径**。
 *
 * 只登记源码能证明的替代：换一个发射模式后该键的 disposition 不再是 `downgrade`。
 * 不写散文式的「你可以……」建议 —— 那会变成第二份指南，和 `RENDER_PLAN_CONTRACT`
 * 的 reason 分叉（约束 4：不做 guidance fork）。
 */
export interface CapabilityAlternative {
  /** 目前只有一种：换发射模式。 */
  kind: 'mode'
  value: SceneMode
}

export interface CapabilityKeyVerdict {
  key: string
  verdict: CapabilityVerdict
  /** `degraded` / `unsupported` 的宿主可见原因。 */
  reason?: string
  /**
   * `degraded` 键的补偿路径。缺省 = 没有声明式替代（该键在当前场景/模式下没有
   * 载体，只能宿主接线或改页面结构）；`unsupported` 的替代由前门的 did-you-mean
   * 负责（能力台账拿不到 Zod 形状，不复制一份）。
   */
  alternatives?: readonly CapabilityAlternative[]
}

/** 单次意图评估（信封里挂的就是这份）。 */
export interface IntentCapability {
  contract: typeof CAPABILITY_CONTRACT_VERSION
  scene: SceneId
  target: TargetFramework
  mode: SceneMode | null
  /** 声明了的键，逐条判定（顺序 = 输入对象键序）。 */
  declared: readonly CapabilityKeyVerdict[]
  /** 场景必需但意图里缺失的键。 */
  missing: readonly string[]
  /** `degraded` 的键名（机器过滤用，等价于 declared 的子集）。 */
  degraded: readonly string[]
  /** `unsupported` 的键名。 */
  unsupported: readonly string[]
  /** 没有 missing 且没有 unsupported（degraded 不阻断生成，单独看 `degraded`）。 */
  ok: boolean
}

/** `assessIntent` 的入参：`ScenePlan` 结构上可赋值（intent 是对象或 undefined）。 */
export interface CapabilityAssessmentInput {
  scene: SceneId
  intent: unknown
}

/** 台账文档（MCP 资源 `esplus://capabilities` 与守卫共用的形状）。 */
export interface CapabilityLedger {
  contract: typeof CAPABILITY_CONTRACT_VERSION
  scenes: ReadonlyArray<{
    scene: SceneId
    artifacts: readonly ArtifactKind[]
    targets: readonly TargetFramework[]
    modes: readonly (SceneMode | null)[]
    required: readonly string[]
    accepted: readonly string[]
  }>
  /** CRUD 顶层配置键在 schema / sfc 下的落位（直接投影 `RENDER_PLAN_CONTRACT`）。 */
  crudKeys: ReadonlyArray<{
    key: RenderPlanKey
    schema: RenderDisposition
    sfc: RenderDisposition
    reason?: string
  }>
  /** 无表格面时的 CRUD 片段分支：有载体的键 / 没有载体的键。 */
  crudWithoutTable: {
    accepted: readonly string[]
    degraded: readonly string[]
  }
  /** 目标端 × 键能力矩阵（AN-09 的 `CAPABILITIES`，同一份数据）。 */
  targetMatrix: readonly CapabilityEntry[]
}

function normalizeTarget(value: unknown): TargetFramework {
  return value === 'vue2' || value === 'antdv' ? value : DEFAULT_TARGET
}

/**
 * `RENDER_PLAN_CONTRACT` 的行是**字面量联合**（为了 `satisfies` 的对账能力），
 * 按变量键索引时 TS 不收敛到同一形状。这里只在 CRUD（mode 必为 schema/sfc）内
 * 读它，用这个窄化视图即可。
 */
function renderRule(key: RenderPlanKey): {
  schema: RenderDisposition
  sfc: RenderDisposition
  reason?: string
} {
  return RENDER_PLAN_CONTRACT[key] as {
    schema: RenderDisposition
    sfc: RenderDisposition
    reason?: string
  }
}

function resolveMode(scene: SceneId, intent: Record<string, unknown>): SceneMode | null {
  if (scene === 'crud') return intent.mode === 'sfc' ? 'sfc' : 'schema'
  if (scene === 'dialog') return intent.mode === 'component' ? 'component' : 'composable'
  return null
}

function surfacesOf(intent: Record<string, unknown>): Record<string, unknown> {
  const s = intent.surfaces
  return s && typeof s === 'object' && !Array.isArray(s) ? (s as Record<string, unknown>) : {}
}

function surfaceHas(intent: Record<string, unknown>, name: 'query' | 'table' | 'form' | 'dialog'): boolean {
  const value = surfacesOf(intent)[name]
  return Array.isArray(value) && value.length > 0
}

const NO_TABLE_REASON =
  'no table surface: the CRUD page generator is bypassed; standalone fragments consume only surfaces / target / typescript / i18n / formLayout / rowkey / apiUrl, so this key has no carrier in the emitted fragments.'

function noTableAccepted(intent: Record<string, unknown>): Set<string> {
  const accepted = new Set(['surfaces', 'target', 'typescript', 'i18n'])
  if (surfaceHas(intent, 'query') || surfaceHas(intent, 'form')) accepted.add('formLayout')
  if (surfaceHas(intent, 'dialog')) {
    accepted.add('apiUrl')
    if (typeof intent.apiUrl === 'string' && intent.apiUrl.length > 0) accepted.add('rowkey')
  }
  return accepted
}

interface DegradeVerdict {
  reason: string
  alternatives?: readonly CapabilityAlternative[]
}

/**
 * 单键的降级判定；`undefined` = 该键在所选模式下保真。
 *
 * `alternatives` 只从 `RENDER_PLAN_CONTRACT` 推导：本次降级如果是**模式相关**的
 * （另一模式下 disposition 不是 `downgrade`），换模式就是一条可验证的补偿路径。
 * 无表分支与元数据键没有这种替代 —— 它们缺的是载体，不是模式。
 */
function degradeReason(
  scene: SceneId,
  key: string,
  intent: Record<string, unknown>,
  mode: SceneMode | null,
): DegradeVerdict | undefined {
  if (scene !== 'crud') return undefined

  const hasTable = surfaceHas(intent, 'table')

  if (!hasTable) {
    if (noTableAccepted(intent).has(key)) return undefined
    if (key === 'mode') {
      return {
        reason:
          'no table surface: fragments are always emitted as sfc; `mode` is ignored (and a declared schema mode does not produce a schema.ts + wrapper pair).',
      }
    }
    if (key === 'name') {
      return {
        reason:
          'no table surface: the page name has no carrier in standalone fragments (component/file names come from the surface and dialog keys).',
      }
    }
    return { reason: NO_TABLE_REASON }
  }

  // 有表：直接读 render-plan 的降级行（reason 也来自同一处，不复制文案）。
  // `surfaces` 是容器键：有表时它的 dialog 面会并进配置的 `dialogs`（该键在 sfc
  // 下降级）；无表时弹窗按片段逐个发射，容器本身总有载体。
  let renderKey: RenderPlanKey | undefined
  if (key === 'surfaces') {
    if (!surfaceHas(intent, 'dialog')) return undefined
    renderKey = INTENT_TO_RENDER_KEY['surfaces.dialog']
  } else {
    renderKey = (INTENT_TO_RENDER_KEY as Record<string, RenderPlanKey | undefined>)[key]
  }
  if (!renderKey) return undefined

  const rule = renderRule(renderKey)
  const effective: 'schema' | 'sfc' = mode === 'sfc' ? 'sfc' : 'schema'
  // sfc 的 operationColumn 只有 `false` 能真实表达（与 buildRenderPlan 的细化一致）。
  if (renderKey === 'operationColumn' && effective === 'sfc' && intent.operationColumn === false) {
    return undefined
  }
  if (rule[effective] !== 'downgrade') return undefined

  const other: 'schema' | 'sfc' = effective === 'schema' ? 'sfc' : 'schema'
  return {
    reason: rule.reason ?? `${renderKey} is not fully emitted in ${effective} mode.`,
    ...(rule[other] !== 'downgrade'
      ? { alternatives: Object.freeze([{ kind: 'mode' as const, value: other }]) }
      : {}),
  }
}

function unsupportedReason(scene: SceneId, key: string, accepted: readonly string[]): string {
  return `unknown key "${key}" for scene '${scene}' — accepted keys: ${accepted.join(', ')}. This key would be silently ignored by the generator.`
}

/**
 * 评估一份意图：哪些键会被消费、哪些会降级、哪些本场景不认识、必需键是否齐全。
 *
 * 纯函数、不抛错（未知场景除外 —— 那是调用方的编程错误，不是数据问题）。
 */
export function assessIntent(input: CapabilityAssessmentInput): IntentCapability {
  const scene = input.scene
  const contract = sceneContract(scene)
  const raw =
    input.intent && typeof input.intent === 'object' && !Array.isArray(input.intent)
      ? (input.intent as Record<string, unknown>)
      : {}
  const accepted = SCENE_INTENT_KEYS[scene]
  const acceptedSet = new Set(accepted)
  const mode = resolveMode(scene, raw)
  const target = normalizeTarget(raw.target)

  const declared: CapabilityKeyVerdict[] = []
  for (const key of Object.keys(raw)) {
    if (raw[key] === undefined) continue
    if (!acceptedSet.has(key)) {
      declared.push({ key, verdict: 'unsupported', reason: unsupportedReason(scene, key, accepted) })
      continue
    }
    const downgrade = degradeReason(scene, key, raw, mode)
    declared.push(
      downgrade
        ? {
            key,
            verdict: 'degraded',
            reason: downgrade.reason,
            ...(downgrade.alternatives
              ? { alternatives: Object.freeze(downgrade.alternatives.map((a) => Object.freeze({ ...a }))) }
              : {}),
          }
        : { key, verdict: 'accepted' },
    )
  }

  const missing = contract.intent.required.filter((k) => raw[k] === undefined)
  const degraded = declared.filter((d) => d.verdict === 'degraded').map((d) => d.key)
  const unsupported = declared.filter((d) => d.verdict === 'unsupported').map((d) => d.key)

  return Object.freeze({
    contract: CAPABILITY_CONTRACT_VERSION,
    scene,
    target,
    mode,
    declared: Object.freeze(declared.map((d) => Object.freeze(d))),
    missing: Object.freeze(missing),
    degraded: Object.freeze(degraded),
    unsupported: Object.freeze(unsupported),
    ok: missing.length === 0 && unsupported.length === 0,
  })
}

/** 台账文档 —— 宿主可一次性读到「四场景各自认什么、CRUD 哪些键会降级」。 */
export function capabilityLedger(): CapabilityLedger {
  const noTableAcceptedKeys = [
    'surfaces',
    'target',
    'typescript',
    'i18n',
    'formLayout',
    'rowkey',
    'apiUrl',
  ]
  return Object.freeze({
    contract: CAPABILITY_CONTRACT_VERSION,
    scenes: Object.freeze(
      SCENE_REGISTRY.map((s) =>
        Object.freeze({
          scene: s.id,
          artifacts: Object.freeze([...s.artifacts]),
          targets: Object.freeze([...s.targets]),
          modes: Object.freeze([...s.modes]),
          required: Object.freeze([...s.intent.required]),
          accepted: Object.freeze([...SCENE_INTENT_KEYS[s.id]]),
        }),
      ),
    ),
    crudKeys: Object.freeze(
      (Object.keys(RENDER_PLAN_CONTRACT) as RenderPlanKey[]).map((key) => {
        const rule = renderRule(key)
        return Object.freeze({
          key,
          schema: rule.schema,
          sfc: rule.sfc,
          ...(rule.reason ? { reason: rule.reason } : {}),
        })
      }),
    ),
    crudWithoutTable: Object.freeze({
      accepted: Object.freeze([...noTableAcceptedKeys]),
      degraded: Object.freeze(
        CRUD_INTENT_KEYS.filter((k) => !noTableAcceptedKeys.includes(k)),
      ),
    }),
    targetMatrix: CAPABILITIES,
  })
}
