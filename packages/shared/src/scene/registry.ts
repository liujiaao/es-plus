/**
 * 场景注册表 —— AI 原生「全场景」的**单一真源**。
 *
 * ## 为什么住在这里
 *
 * 在此之前，场景分类只活在 `scripts/eval/scenes.mjs`；MCP / shared / 守卫各自再抄一份
 * 工具或生成器映射，形成五份平行清单。任何一份漏改，守卫之间就会互相矛盾。
 * 本文件把「场景 → 产物 → 入口 → 评测腿 → 运行时见证」变成一份**可 import 的数据**：
 *   - `scripts/eval/scenes.mjs` 从这里 re-export；
 *   - `scripts/lib/fragment-cases.mjs` 从 `artifactFamily` 派生生成器映射；
 *   - `scripts/check-scene-registry.mjs` 断言它与语料/工具/生成器/e2e 一致；
 *   - 后续 `generate_scene` / `ScenePlan` 直接消费同一张表。
 *
 * ## 边界
 *
 * 这里只放**元数据**，不放 Zod schema、不放生成函数。场景意图仍然复用
 * `StructuredCrudConfig` / `SurfaceField` / `FormBlockInput` / `TableBlockInput` /
 * `DialogBlockInput` 的既有词汇 —— 注册表是索引，不是第四套类型系统。
 */

import type { TargetFramework } from '../target.js'

/** 场景 id（顺序冻结：门禁矩阵输出按此序，便于人眼比对历史）。 */
export const SCENE_IDS = ['crud', 'table', 'form', 'dialog'] as const
export type SceneId = (typeof SCENE_IDS)[number]

/** 产物形态。`dialog` 的两种形态由 mode 决定，但都属于同一 artifact family。 */
export const ARTIFACT_KINDS = [
  'crud-page',
  'table',
  'form',
  'dialog-composable',
  'dialog-component',
] as const
export type ArtifactKind = (typeof ARTIFACT_KINDS)[number]

/**
 * 罐头弹窗 key → 默认标题。**唯一真源**（P5）：
 *
 * 标题不只是文案 —— 生成器把它当作提交方法 / 只读语义的判据
 * （`'新增'` → POST、其余 PUT；`'查看'` → 只出「关闭」按钮），评测的组合打分器
 * 与站点组合画廊也用它展开 `surfaces.dialog: ['add']`。此前 emit 与
 * `eval/composition-scorers.mjs` 各抄一份：改名时只要一侧没跟上，就会出现
 * 「评测按 A 判分、产物按 B 生成」的静默错位。
 */
export const DIALOG_TITLES: Readonly<Record<'add' | 'edit' | 'view', string>> = Object.freeze({
  add: '新增',
  edit: '编辑',
  view: '查看',
})

/** 罐头 key 取默认标题；未知 key 原样返回（与生成器的历史行为一致）。 */
export function dialogTitleFor(key: string): string {
  return (DIALOG_TITLES as Record<string, string>)[key] ?? key
}

/** 场景内的模式轴；`null` 表示该场景没有这条轴（区别于「这一格缺语料」）。 */
export type SceneMode = 'schema' | 'sfc' | 'composable' | 'component'

/** 场景意图的形态族：决定用哪个 schema / 哪个发射器。 */
export type SceneIntentKind =
  | 'surfaces'
  | 'table-block'
  | 'form-block'
  | 'dialog-block'

export interface SceneContract {
  id: SceneId
  version: 1
  /** 产物族：一个场景只对应一个发射器入口。 */
  artifactFamily: 'crud-page' | 'table' | 'form' | 'dialog'
  /** 该场景可能产出的全部 artifact 形态（dialog 有两种）。 */
  artifacts: readonly ArtifactKind[]
  /** 该场景支持的 target；当前四场景均为三端。 */
  targets: readonly TargetFramework[]
  /** 该场景的模式轴；table/form 为 `[null]`。 */
  modes: readonly (SceneMode | null)[]
  intent: {
    kind: SceneIntentKind
    /** 意图对象里必须存在的顶层键（由 `check-scene-registry` 做存在性断言）。 */
    required: readonly string[]
  }
  entry: {
    /** canonical 入口：场景语义的主承载工具（P2 起为 `generate_scene`）。 */
    tool: string
    /** 兼容/高级入口；它们仍可生成该场景，但不是场景语义的主入口。 */
    adapters: readonly string[]
  }
  eval: {
    /** 语料目录（相对仓库根）。 */
    corpus: string
    /** 片段场景的文件前缀；用于断言「这个场景的语料真的在这个文件族里」。 */
    casePrefix?: string
    scorer: 'crud' | 'fragment'
    /** 当前真实门禁口径；per-scene 95% 尚未可用时必须是 fragment-global。 */
    gate: 'definition95' | 'fragment-global'
    /** 单场景进入 95% 门禁所需的最小 heldout 样本数。 */
    minCasesFor95: number
  }
  runtime: {
    /** 运行时见证文件（相对仓库根）；只登记已存在的，避免「声明了但没人跑」。 */
    witnesses: readonly string[]
  }
}

const ALL_TARGETS = ['vue3', 'vue2', 'antdv'] as const

/**
 * 四场景。数字与 `scripts/eval/scenes.mjs` 的历史口径一致：
 * - crud：3 端 × 2 模式（schema / sfc）；
 * - dialog：3 端 × 2 形态（composable / component）；
 * - table / form：3 端 × 1（无模式轴）。
 *
 * `minCasesFor95 = 60` 是诚实性下限：21 条语料上 1 例 = 4.8pp，谈 95% 是噪声。
 * 在扩到 60 之前，片段场景的 `gate` 只能标 `fragment-global`。
 */
export const SCENE_REGISTRY: readonly SceneContract[] = [
  {
    id: 'crud',
    version: 1,
    artifactFamily: 'crud-page',
    artifacts: ['crud-page'],
    targets: ALL_TARGETS,
    modes: ['schema', 'sfc'],
    intent: {
      kind: 'surfaces',
      required: ['name', 'apiUrl', 'surfaces'],
    },
    entry: {
      tool: 'generate_scene',
      adapters: ['generate_crud', 'generate_crud_from_config'],
    },
    eval: {
      corpus: '__tests__/golden/cases',
      scorer: 'crud',
      gate: 'definition95',
      minCasesFor95: 60,
    },
    runtime: {
      witnesses: [
        'packages/vue3/__tests__/crud-runtime.spec.ts',
        'packages/adapter-antdv/__tests__/crud-runtime.spec.ts',
        '__tests__/e2e/vue2-crud',
      ],
    },
  },
  {
    id: 'table',
    version: 1,
    artifactFamily: 'table',
    artifacts: ['table'],
    targets: ALL_TARGETS,
    modes: [null],
    intent: {
      kind: 'table-block',
      required: ['fields'],
    },
    entry: {
      tool: 'generate_scene',
      adapters: ['generate_table'],
    },
    eval: {
      corpus: '__tests__/golden/cases',
      casePrefix: 'frag-table-',
      scorer: 'fragment',
      gate: 'fragment-global',
      minCasesFor95: 60,
    },
    runtime: {
      witnesses: [
        'packages/vue3/__tests__/fragment-runtime.spec.ts',
        'packages/adapter-antdv/__tests__/fragment-runtime.spec.ts',
        '__tests__/e2e/vue2-fragments',
      ],
    },
  },
  {
    id: 'form',
    version: 1,
    artifactFamily: 'form',
    artifacts: ['form'],
    targets: ALL_TARGETS,
    modes: [null],
    intent: {
      kind: 'form-block',
      required: ['fields'],
    },
    entry: {
      tool: 'generate_scene',
      adapters: ['generate_form'],
    },
    eval: {
      corpus: '__tests__/golden/cases',
      casePrefix: 'frag-form-',
      scorer: 'fragment',
      gate: 'fragment-global',
      minCasesFor95: 60,
    },
    runtime: {
      witnesses: [
        'packages/vue3/__tests__/fragment-runtime.spec.ts',
        'packages/adapter-antdv/__tests__/fragment-runtime.spec.ts',
        '__tests__/e2e/vue2-fragments',
      ],
    },
  },
  {
    id: 'dialog',
    version: 1,
    artifactFamily: 'dialog',
    artifacts: ['dialog-composable', 'dialog-component'],
    targets: ALL_TARGETS,
    modes: ['composable', 'component'],
    intent: {
      kind: 'dialog-block',
      required: ['fields'],
    },
    entry: {
      tool: 'generate_scene',
      adapters: ['generate_dialog'],
    },
    eval: {
      corpus: '__tests__/golden/cases',
      casePrefix: 'frag-dialog-',
      scorer: 'fragment',
      gate: 'fragment-global',
      minCasesFor95: 60,
    },
    runtime: {
      witnesses: [
        'packages/vue3/__tests__/fragment-runtime.spec.ts',
        'packages/adapter-antdv/__tests__/fragment-runtime.spec.ts',
        '__tests__/e2e/vue2-fragments',
      ],
    },
  },
]

/** 未标 `scene` 时的默认场景（历史 216 条 CRUD 语料一个字节都不用改）。 */
export const DEFAULT_SCENE: SceneId = 'crud'

/** 场景 id 列表（从注册表派生，顺序稳定）。 */
export const SCENES: readonly SceneId[] = SCENE_REGISTRY.map((s) => s.id)

/** 场景 → canonical 入口工具（P2 起统一为 `generate_scene`；旧工具见 `entry.adapters`）。 */
export const SCENE_TOOL: Readonly<Record<SceneId, string>> = Object.freeze(
  Object.fromEntries(SCENE_REGISTRY.map((s) => [s.id, s.entry.tool])) as Record<SceneId, string>
)

/** CRUD 的发射模式轴（`generateFromConfig` 的 schema / sfc 两条路径）。 */
export const MODES: readonly SceneMode[] = ['schema', 'sfc']

/** dialog 的产物形态轴（composable 模块 / 自包含 SFC）。 */
export const DIALOG_MODES: readonly SceneMode[] = ['composable', 'component']

/** 「该场景没有这条模式轴」的显式占位。 */
export const MODELESS = null

export function sceneContract(scene: SceneId): SceneContract {
  const found = SCENE_REGISTRY.find((s) => s.id === scene)
  if (!found) throw new Error(`未知场景：${scene}（合法值：${SCENES.join('/')}）`)
  return found
}

/** 该场景的语料应覆盖哪些 mode/形态。 */
export function modesOf(scene: SceneId): readonly (SceneMode | null)[] {
  return sceneContract(scene).modes
}

/** 该场景的产物族（table/form/dialog/crud-page）。 */
export function artifactFamilyOf(scene: SceneId): SceneContract['artifactFamily'] {
  return sceneContract(scene).artifactFamily
}

export function isScene(value: unknown): value is SceneId {
  return typeof value === 'string' && (SCENE_IDS as readonly string[]).includes(value)
}

/**
 * 取一条用例的场景；未标或标了非法值都落到 `DEFAULT_SCENE`。
 *
 * 非法值不在此抛错：语料形状校验由 `score-golden` / `check-scene-coverage` 负责给可读报错；
 * 运行时消费者只需要一个可用的过滤谓词，不该在遍历语料时炸。
 */
export function sceneOf(value: { scene?: unknown } | null | undefined): SceneId {
  const v = value?.scene
  return isScene(v) ? v : DEFAULT_SCENE
}
