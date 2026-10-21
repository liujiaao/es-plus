/**
 * RenderPlan —— 「这份 config 的每个顶层键，在某个 mode / target 下到底是
 * **发射 / 派生 / 元数据 / 降级告警 / 缺席**」的单一账本（AN-22）。
 *
 * ## 为什么需要它
 *
 * 生成器有两个发射器（`generateSchema` / `generateSFC`），历史上每个键的
 * 「这个 mode 支不支持」散落在各自的 `if (config.x)` 里。AN-06 就是这么漏的：
 * 新模式只发射 `dialogs`，`actions` 只在 legacy 分支发射，组件端只能**猜**动作集。
 * 同类缺陷的共同形态是「配置里配了，某个 mode 静默不发射，也没有任何告警」。
 *
 * 把决策集中到一张表之后：
 *   1. `structured-generator` 的发射条件改为读 plan，而不是各自手写；
 *   2. `scripts/check-render-plan.mjs` 断言 **plan 的键集 == `StructuredCrudConfig` 的键集**
 *      —— 新增一个顶层键却没登记 plan，守卫直接红；
 *   3. 守卫还会对每个键构造一份最小配置，真跑两个 mode，断言
 *      `emit` 的键在产物里有证据、`downgrade` 的键在警告里被点名。
 *
 * ## 纪律
 *
 * - `absent` 不是静态契约的一部分：契约行描述「键**被声明时**的行为」；
 *   `buildRenderPlan` 再按 config 是否存在该键把行落成 `absent`。
 * - `meta` 键没有产物证据：它们影响生成（target/typescript/i18n）或只是路由（mode），
 *   本身不会以同名键出现在产物里。
 * - `downgrade` 必须带 `reason`，且生成器必须真的发出包含该键名的告警；
 *   「登记了降级但没人告警」同样是静默丢弃，守卫会抓。
 */
import type { StructuredCrudConfig } from './structured-config.schema.js'
import { DEFAULT_TARGET, type TargetFramework } from './target.js'

export type RenderMode = 'schema' | 'sfc'
export type RenderDisposition = 'emit' | 'derive' | 'meta' | 'downgrade' | 'absent'
export type RenderPlanKey = keyof StructuredCrudConfig

interface PlanRule {
  /** 键被声明时 schema 模式的行为。 */
  schema: Exclude<RenderDisposition, 'absent'>
  /** 键被声明时 sfc 模式的行为。 */
  sfc: Exclude<RenderDisposition, 'absent'>
  /** 产物里应出现的证据 token（null = 无同名/等价证据，如 meta）。 */
  evidence: { schema: string | null; sfc: string | null }
  /** `downgrade` 的宿主可见原因（生成器告警文本必须包含键名）。 */
  reason?: string
  /**
   * true = 该键在合法 config 里**总有值**（必填或生成器有默认），
   * 因此缺席时也按契约行落位，而不是 `absent`。
   */
  always?: boolean
}

/**
 * 顶层键账本。`satisfies Record<keyof StructuredCrudConfig, …>` 是**编译期**守卫：
 * shared 新增一个顶层键而这里没登记，`tsc` 直接报缺键。
 */
export const RENDER_PLAN_CONTRACT = {
  name: {
    schema: 'meta',
    sfc: 'meta',
    evidence: { schema: null, sfc: null },
    always: true,
  },
  apiUrl: {
    schema: 'emit',
    sfc: 'emit',
    evidence: { schema: 'apiParams', sfc: 'apiParams' },
    always: true,
  },
  fields: {
    schema: 'derive',
    sfc: 'derive',
    evidence: { schema: 'formItems', sfc: 'formItems' },
    always: true,
  },
  actions: {
    // schema 模式逐字发射 `schema.actions`；SFC 模式由 queryBtns / 操作列派生按钮。
    schema: 'emit',
    sfc: 'derive',
    evidence: { schema: 'actions', sfc: 'queryBtns' },
    always: true,
  },
  tableOptions: {
    schema: 'emit',
    sfc: 'emit',
    evidence: { schema: 'border', sfc: 'border' },
    always: true,
  },
  pagination: {
    schema: 'emit',
    sfc: 'emit',
    evidence: { schema: 'pagination', sfc: 'pagination' },
    always: true,
  },
  mode: { schema: 'meta', sfc: 'meta', evidence: { schema: null, sfc: null }, always: true },
  target: { schema: 'meta', sfc: 'meta', evidence: { schema: null, sfc: null }, always: true },
  typescript: { schema: 'meta', sfc: 'meta', evidence: { schema: null, sfc: null }, always: true },
  permissions: {
    // schema 的 `CrudPageSchema` 没有「动作 → 权限码」通道（只有显式按钮的
    // permissionValue）；SFC 会把 permissions 落到派生按钮的 permissionValue。
    schema: 'downgrade',
    sfc: 'emit',
    evidence: { schema: null, sfc: 'permissionValue' },
    reason:
      'schema mode has no action→permission channel; use mode=sfc or declare operationColumn.btns[].permissionValue / toolbarBtns[].permissionValue explicitly',
  },
  i18n: { schema: 'meta', sfc: 'meta', evidence: { schema: null, sfc: null }, always: true },
  formLayout: {
    schema: 'emit',
    sfc: 'emit',
    evidence: { schema: 'formLayout', sfc: 'layoutFormProps' },
  },
  toolbarBtns: {
    schema: 'emit',
    sfc: 'downgrade',
    evidence: { schema: 'toolbarBtns', sfc: null },
    reason: 'toolbarBtns (form-area buttons + position/dialogKey)',
  },
  tableBtns: {
    schema: 'emit',
    sfc: 'downgrade',
    evidence: { schema: 'tableBtns', sfc: null },
    reason: 'tableBtns (toolbar buttons + code:1/2 positioning)',
  },
  operationColumn: {
    // sfc 模式只认 `false`（= 隐藏操作列，可以真实表达）；对象形态需要自定义
    // label/width/btns，SFC 的派生操作列做不到 → 降级告警。
    schema: 'emit',
    sfc: 'downgrade',
    evidence: { schema: 'operationColumn', sfc: null },
    reason: 'operationColumn (width/label/fixed; only `false` is honored in sfc mode)',
  },
  dialogs: {
    schema: 'emit',
    sfc: 'downgrade',
    evidence: { schema: 'dialogs', sfc: null },
    reason: 'dialogs (per-dialog titles/formItems/layout — a single generic dialog is derived from actions instead)',
  },
  columns: {
    schema: 'emit',
    sfc: 'emit',
    evidence: { schema: 'columns', sfc: 'columns' },
  },
  expandConfig: {
    schema: 'emit',
    sfc: 'emit',
    evidence: { schema: 'expandConfig', sfc: 'expandConfig' },
  },
  treeConfig: {
    schema: 'emit',
    sfc: 'emit',
    evidence: { schema: 'treeConfig', sfc: 'treeConfig' },
  },
  mergeConfig: {
    schema: 'emit',
    sfc: 'emit',
    evidence: { schema: 'mergeConfig', sfc: 'mergeConfig' },
  },
} satisfies Record<RenderPlanKey, PlanRule>

export interface RenderPlanEntry {
  key: RenderPlanKey
  disposition: RenderDisposition
  /** 产物证据 token；absent / meta 为 null。 */
  evidence: string | null
  /** downgrade 的宿主可见原因。 */
  reason?: string
}

export interface RenderPlan {
  mode: RenderMode
  target: TargetFramework
  entries: Record<RenderPlanKey, RenderPlanEntry>
  /** 该键在此 mode 下是否真的进入产物（emit；`false` 抑制操作列也算 emit）。 */
  emits(key: RenderPlanKey): boolean
  /** 该键是否至少以派生方式生效。 */
  renders(key: RenderPlanKey): boolean
  /** 该键是否被登记为降级（生成器必须同时发出告警）。 */
  downgrades(): RenderPlanEntry[]
  /** 任一给定键 emit / derive。 */
  anyRenders(keys: RenderPlanKey[]): boolean
}

function readTarget(config: StructuredCrudConfig): TargetFramework {
  const t = (config as unknown as { target?: TargetFramework }).target
  return t === 'vue2' || t === 'antdv' ? t : DEFAULT_TARGET
}

/**
 * 按 config 落位账本。`mode` / `target` 可显式覆盖（生成器内部已解析过时避免二次推断）。
 */
export function buildRenderPlan(
  config: StructuredCrudConfig,
  opts: { mode?: RenderMode; target?: TargetFramework } = {},
): RenderPlan {
  const mode: RenderMode =
    opts.mode ?? ((config as unknown as { mode?: string }).mode === 'sfc' ? 'sfc' : 'schema')
  const target = opts.target ?? readTarget(config)
  const entries = {} as Record<RenderPlanKey, RenderPlanEntry>

  for (const key of Object.keys(RENDER_PLAN_CONTRACT) as RenderPlanKey[]) {
    const rule = RENDER_PLAN_CONTRACT[key] as PlanRule
    const present = rule.always === true || (config as unknown as Record<string, unknown>)[key] !== undefined
    let disposition: RenderDisposition = present ? rule[mode] : 'absent'

    // 逐配置细化：sfc 的 operationColumn 只有 `false` 能真实表达（隐藏操作列）。
    if (key === 'operationColumn' && present && mode === 'sfc' && config.operationColumn === false) {
      disposition = 'emit'
    }

    const evidence =
      disposition === 'absent' || disposition === 'meta' ? null : rule.evidence[mode]
    entries[key] = {
      key,
      disposition,
      evidence,
      ...(disposition === 'downgrade' && rule.reason ? { reason: rule.reason } : {}),
    }
  }

  const emits = (key: RenderPlanKey) => entries[key].disposition === 'emit'
  const renders = (key: RenderPlanKey) => {
    const d = entries[key].disposition
    return d === 'emit' || d === 'derive'
  }

  return {
    mode,
    target,
    entries,
    emits,
    renders,
    downgrades: () =>
      (Object.values(entries) as RenderPlanEntry[]).filter((e) => e.disposition === 'downgrade'),
    anyRenders: (keys) => keys.some(renders),
  }
}
