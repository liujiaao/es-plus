/**
 * 组合契约 —— `es-plus.composition@3`（P6b @1 → P7 @2 → P11 @3）。
 *
 * ## 为什么需要它
 *
 * P4 把四类接线写进了 `ARTIFACT_RUNTIME` 的注释：
 *
 *   1. table `row-action` → 宿主 `dialog.open(title, row)`
 *   2. form `submit`（校验通过才发）→ 宿主保存
 *   3. form `query` → 宿主 `table.reload(model)`（新搜索回第 1 页）
 *   4. dialog `onSuccess` → 宿主 `table.refresh()`
 *
 * 但「宿主」此前只有人。片段是自包含 SFC，一张同时要表格 + 查询表单 + 弹窗的页面
 * 必须自己写胶水代码；写错一处（漏了 `onSuccess` 回调、按名字而不是 key 分派行动作）
 * 产物仍然能编译、页面仍然能打开，只是行为悄悄不对。本文件把这层胶水变成
 * **确定性产物**：给定若干场景节点，输出每份片段 + 一个 `Page.vue`。
 *
 * ## 接线的来源不是猜测
 *
 * `planComposition` 只读 `ARTIFACT_RUNTIME` 声明的通道名，按固定规则派生；@3 起
 * 宿主还可以**显式声明接线**（`plan.wires`）—— 显式接线与派生接线同源校验（两端必须
 * 是该 artifact 的 emits / expose 通道），同一 `from`（含 `when.rowAction`）上显式
 * 覆盖派生，**不允许静默冲突**。
 *
 *   - 表格的每个行按钮 key：若存在 id 相同的 dialog 节点 → 接 `dialog.open` 并用
 *     `intent.defaultTitle ?? dialogTitleFor(key)` 作标题；否则升级为页面事件
 *     `row-action`（不是丢弃）；
 *   - form `query`：有默认表格 → `table.reload(model)`；否则页面事件 `query`；
 *   - form `reset`：片段点「重置」先 `resetFields()` 再发 `reset`；有默认表格 →
 *     `table.reload()`；否则页面事件 `reset`；
 *   - form `submit`：永远是页面事件 `save`（片段不负责请求，「保存到哪」只有宿主知道）；
 *   - dialog `onSuccess`：有默认表格 → `table.refresh()`；否则页面事件 `success`。
 *
 * **默认表格**的判定顺序：`role: 'master'` 的 table 节点 → 页面里唯一的 table 节点。
 * 多表页面（master-detail）里「哪张表是主表」是业务事实，不猜：没有 master 角色也没有
 * 唯一表时，数据类接线一律升级为页面事件，由宿主显式接线（或声明 role）决定。
 *
 * ## @3 新增的三件事
 *
 * 1. **显式接线**（`wires`）：宿主可以说「主表 key=view → 明细表 reload(row)」，实现
 *    master-detail；行的整行数据以 `reload(row)` 传给明细表（es-table 的 `reload(model?)`
 *    签名本身就吃 model）。
 * 2. **多弹窗**：一个页面可以有多个 dialog 节点；行按钮仍按 key === 节点 id 分派，
 *    页面 `open(id, …)` 逐个匹配。@2 的单弹窗限制是能力缺口，不是安全约束。
 * 3. **`behavior`**：`'crud-requests'`（默认）派生数据接线（query/reset → 表格取数、
 *    onSuccess → 表格刷新）；`'ui-only'` 只装配 UI 接线（row-action → open），数据类
 *    通道全部升级为页面事件（`query` / `reset` / `success`），由宿主自己发请求。
 *    显式接线在两档下都生效 —— 宿主写下的接线永远不因档位被忽略。
 *
 * 组合页因此有两个朝向外的面：**exposes**（表格 refresh/reload、按 id 开弹窗）与
 * **emits**（保存 / 未匹配的行动作 / 无默认表格时的查询、重置与成功）。任何通道要么被
 * 接上，要么升级为页面事件，**没有静默丢弃**（`check-composition-contract` 逐通道断言）。
 *
 * ## 对外 API（`es-plus.composition@3`）
 *
 * - `open(id, options?)`：`options = { title?, row?, onSuccess? }`，返回是否命中。
 *   片段自己的契约是 `open(title, row?, onSuccess?)`；组合页在**第一位**插入 id，
 *   因此第二个参数必须是与位置无关的对象 —— 否则 `open('edit', row)` 会把整行
 *   当成标题（@1 的真实缺陷）。未知 id 返回 `false`，不再静默吞掉。
 * - 标题真源是节点 intent 的 `defaultTitle`（与单独发射同一字段），缺省才回落
 *   `dialogTitleFor(id)`。@1 无视 `defaultTitle`，把声明式标题静默换成了 id。
 * - 有默认表格时 `onSuccess` 仍由页面刷新表格，但宿主回调会**在其后**执行（@1 没有
 *   宿主回调通道，宿主无法在保存成功后做自己的事）。
 * - 表格的模板 ref 名由节点 id 派生（`${camel(id)}Ref`）。@1 写死 `tableRef`，
 *   与 id 为 `table` 的弹窗节点生成的 `tableRef` 撞成重复声明。
 *
 * ## 边界
 *
 * - 节点只能是 `table` / `form` / `dialog`：`crud` 已经是整页，不能再被组合。
 * - **form 场景最多一个节点**：多张表单的 `submit`（保存到哪份）没有确定性语义，
 *   是产品决策而不是组合规则。table / dialog 可以多个（@3）。
 * - vue2 的弹窗只支持 `mode: 'component'`：composable 是 JSX 模块，Options API 页面
 *   里没有 setup 可以调用它。与其生成一份跑不起来的页面，不如明确拒绝。
 * - 不改任何片段字节：节点产物由 `emitSceneArtifact` 原样产出，组合只重命名文件
 *   （`${id}.${ext}`）并新增 `Page.vue`。
 */

import { DEFAULT_TARGET, type TargetFramework } from '../target.js'
import { fingerprintPayload, type ArtifactEnvelope, type ArtifactFile } from './artifact.js'
import { emitSceneArtifact, type ScenePlan } from './emit.js'
import { dialogTitleFor } from './registry.js'
import { ARTIFACT_RUNTIME } from './runtime.js'
import type { ArtifactKind } from './registry.js'

/** 协议版本。任何破坏兼容的字段改动都必须换版本号（@2：open 选项对象 / reset 接线 / 派生 ref 名；@3：显式接线 / 多表 / 多弹窗 / behavior）。 */
export const COMPOSITION_CONTRACT_VERSION = 'es-plus.composition@3' as const

/** 可组合的场景。`crud` 不在其中：它已经是整页产物。 */
export type ComposableScene = 'table' | 'form' | 'dialog'

/**
 * 页面行为档位。
 *
 * - `crud-requests`（缺省）：派生数据接线 —— 查询/重置让默认表格回第 1 页取数，
 *   弹窗成功刷新默认表格。与 @2 的派生结果一致。
 * - `ui-only`：只装配 UI 接线（行按钮 → 打开弹窗）；查询/重置/成功全部升级为页面
 *   事件，由宿主自己发请求。显式接线在两档下都生效。
 */
export const COMPOSITION_BEHAVIORS = ['crud-requests', 'ui-only'] as const
export type CompositionBehavior = (typeof COMPOSITION_BEHAVIORS)[number]

/** 组合计划里的一个节点。 */
export interface CompositionNode {
  /**
   * 节点 id：决定产物文件名（`${id}.${ext}`）、模板 ref 名与行动作绑定
   * （dialog 节点按 id 匹配 key）。
   */
  id: string
  /**
   * 角色标签（`master` / `detail` / `filter` / `editor` …）。同一场景内唯一。
   *
   * 目前只有一个角色参与派生：table 的 `master` —— 多表页面里数据接线（form 查询/
   * 重置、dialog onSuccess）的默认目标。更细的语义（哪一行按钮加载明细）用显式
   * `wires` 表达，因为那是业务决策，不是能从意图推导的事实。
   */
  role?: string
  /**
   * 节点的场景计划。弹窗标题真源是 `intent.defaultTitle`（缺省回落
   * `dialogTitleFor(id)`）—— 与单独发射同一个字段，不另开覆盖通道。
   */
  plan: Extract<ScenePlan, { scene: ComposableScene }>
}

export interface CompositionPlan {
  /** 页面显示名（摘要用）。组件名固定 `ComposedPage`，避免非法标识符。 */
  name?: string
  /** 页面目标端。缺省取第一个节点显式声明的 target，再缺省 `vue3`。 */
  target?: TargetFramework
  /** 页面行为档位，缺省 `crud-requests`。 */
  behavior?: CompositionBehavior
  nodes: readonly CompositionNode[]
  /**
   * 显式接线。与派生接线同源校验（两端必须是 `ARTIFACT_RUNTIME` 通道）；同一
   * `from`（含 `when.rowAction`）上显式覆盖派生。行的整行数据以参数传给目标通道
   * （`table.reload(row)`）—— master-detail 的接线方式。
   */
  wires?: readonly CompositionWire[]
}

/** 一条接线。`to.page` 表示升级为页面事件（向上交给宿主）。 */
export interface CompositionWire {
  from: { node: string; channel: string }
  to: { node: string; channel: string } | { page: 'emit'; event: string }
  /** 仅行动作：只有该 key 走这条线。 */
  when?: { rowAction: string }
}

/** 组合页对外的两个面（与片段的 `ARTIFACT_RUNTIME` 同构）。 */
export interface CompositionFaces {
  expose: readonly string[]
  emit: readonly string[]
}

export interface CompositionEnvelope {
  contract: typeof COMPOSITION_CONTRACT_VERSION
  name: string
  target: TargetFramework
  behavior: CompositionBehavior
  /** 每个节点的完整产物信封（自带版本与指纹），组合不重编它们的身份。 */
  nodes: readonly ArtifactEnvelope[]
  /** id → role（只含显式声明了 role 的节点）。 */
  roles: Readonly<Record<string, string>>
  wires: readonly CompositionWire[]
  faces: CompositionFaces
  page: ArtifactFile
  warnings: readonly string[]
  fingerprint: string
}

/** 组合结果：失败分支没有文件 / 信封（同 `emitSceneArtifact` 的纪律）。 */
export interface CompositionResult {
  text: string
  isError?: true
  files?: readonly ArtifactFile[]
  page?: ArtifactFile
  wires?: readonly CompositionWire[]
  faces?: CompositionFaces
  warnings?: readonly string[]
  envelope?: CompositionEnvelope
}

/** 静态分析结果（不生成代码；守卫 / 测试与发射器共用同一把尺子）。 */
export interface CompositionAnalysis {
  target: TargetFramework
  typescript: boolean
  behavior: CompositionBehavior
  /** id → role（只含显式声明了 role 的节点）。 */
  roles: Readonly<Record<string, string>>
  wires: readonly CompositionWire[]
  faces: CompositionFaces
  nodes: readonly {
    id: string
    scene: ComposableScene
    artifact: ArtifactKind
    componentName: string
    /** 页面里调用 `open(id, …)` 的 id（即节点 id）。 */
    openId: string
  }[]
}

const ID_RE = /^[a-z][a-z0-9]*(?:-[a-z0-9]+)*$/
/** 节点角色标签：与 id 同一套字符集，避免生成产物里出现需要转义的名字。 */
const ROLE_RE = /^[a-z][a-z0-9]*(?:-[a-z0-9]+)*$/

function pascalOf(id: string): string {
  return id
    .split('-')
    .filter(Boolean)
    .map((p) => p.charAt(0).toUpperCase() + p.slice(1))
    .join('')
}

function kebabOf(pascal: string): string {
  return pascal.replace(/([a-z0-9])([A-Z])/g, '$1-$2').toLowerCase()
}

function extOf(language: ArtifactFile['language']): string {
  if (language === 'vue') return 'vue'
  if (language === 'typescript') return 'ts'
  if (language === 'javascript') return 'js'
  return language
}

function q(text: string): string {
  return "'" + text.replace(/\\/g, '\\\\').replace(/'/g, "\\'") + "'"
}

/**
 * 静态分析：派生接线与页面面。
 *
 * 纯函数、不生成代码。生成器只能消费这里的结论，不能自己再判一遍「哪些通道接哪」。
 */
export function planComposition(plan: CompositionPlan): CompositionAnalysis {
  const nodes = plan.nodes ?? []
  if (!Array.isArray(nodes) || nodes.length === 0) {
    throw new Error('组合计划至少需要一个节点（table / form / dialog）。')
  }

  const behavior = plan.behavior ?? 'crud-requests'
  if (!(COMPOSITION_BEHAVIORS as readonly string[]).includes(behavior)) {
    throw new Error(
      `组合 behavior=${JSON.stringify(behavior)} 非法：只支持 ${COMPOSITION_BEHAVIORS.join(' / ')}（crud-requests = 派生数据接线；ui-only = 数据通道全部升级为页面事件）。`,
    )
  }

  const declaredTarget = nodes
    .map((n) => (n.plan.intent as { target?: TargetFramework }).target)
    .find((t): t is TargetFramework => !!t)
  const target = plan.target ?? declaredTarget ?? DEFAULT_TARGET

  const seenIds = new Set<string>()
  const seenComponents = new Set<string>()
  const infos: CompositionAnalysis['nodes'][number][] = []
  const roles: Record<string, string> = {}
  const roleByScene = new Map<string, string>()
  let typescript = true

  for (const node of nodes) {
    const id = String(node?.id ?? '')
    if (!ID_RE.test(id)) {
      throw new Error(
        `组合节点 id "${id}" 非法：只允许 kebab-case（小写字母开头，如 add / edit / users-table）—— 它同时是文件名与弹窗动作绑定键。`,
      )
    }
    if (id === 'page') throw new Error(`组合节点 id "page" 与组合页文件 Page.vue 冲突，请换一个 id。`)
    if (seenIds.has(id)) throw new Error(`组合节点 id "${id}" 重复。`)
    seenIds.add(id)

    const scene = node.plan?.scene
    if ((scene as string) === 'crud') {
      throw new Error(
        'crud 节点不能参与组合：它是整页产物（含自己的表格/表单/弹窗与运行时），不能当片段二次装配。',
      )
    }
    if (scene !== 'table' && scene !== 'form' && scene !== 'dialog') {
      throw new Error(`组合节点 "${id}" 的场景非法：${String(scene)}`)
    }

    const intent = node.plan.intent as { target?: TargetFramework; typescript?: boolean; mode?: string }
    if (intent.target && intent.target !== target) {
      throw new Error(
        `组合节点 "${id}" 的 target=${intent.target} 与页面 target=${target} 不一致 —— 一张页面不能混装两个框架的组件。`,
      )
    }
    if (scene === 'dialog' && target === 'vue2' && (intent.mode ?? 'composable') !== 'component') {
      throw new Error(
        `组合节点 "${id}"：vue2 页面只支持 mode: 'component' 的弹窗（composable 是 JSX 模块，Options API 页面里没有 setup 可调用）。请改成 mode: 'component' 或改用 vue3 / antdv。`,
      )
    }
    if (intent.typescript === false) typescript = false

    const componentName = pascalOf(id)
    if (seenComponents.has(componentName)) {
      throw new Error(`组合节点 "${id}" 与另一个节点推导出同一个组件名 ${componentName}，请换一个 id。`)
    }
    seenComponents.add(componentName)

    const rawRole = (node as { role?: unknown }).role
    if (rawRole !== undefined) {
      if (typeof rawRole !== 'string' || !ROLE_RE.test(rawRole)) {
        throw new Error(
          `组合节点 "${id}" 的 role=${JSON.stringify(rawRole)} 非法：只允许小写 kebab-case（如 master / detail / filter）。`,
        )
      }
      const sceneRoleKey = `${scene}:${rawRole}`
      if (roleByScene.has(sceneRoleKey)) {
        throw new Error(
          `组合里 ${scene} 场景的两个节点都声明了 role="${rawRole}"（${roleByScene.get(sceneRoleKey)} 与 ${id}）—— 同一场景内 role 必须唯一，否则默认接线没有确定性目标。`,
        )
      }
      roleByScene.set(sceneRoleKey, id)
      roles[id] = rawRole
    }

    const artifact: ArtifactKind =
      scene === 'dialog' ? (intent.mode === 'component' ? 'dialog-component' : 'dialog-composable') : scene
    infos.push({ id, scene, artifact, componentName, openId: id })
  }

  const infoById = new Map(infos.map((i) => [i.id, i]))
  const tables = infos.filter((n) => n.scene === 'table')
  const forms = infos.filter((n) => n.scene === 'form')
  const dialogs = infos.filter((n) => n.scene === 'dialog')
  const dialogById = new Map(dialogs.map((d) => [d.id, d]))

  // 多张表单的 submit（保存到哪一份）没有确定性语义 —— 这是产品决策，不是组合规则。
  if (forms.length > 1) {
    throw new Error(
      `组合里 form 场景出现了 ${forms.length} 个节点（${forms.map((f) => f.id).join(', ')}）：一个页面只能有一个 form 片段（多表单的 submit/save 语义无法确定性区分）。`,
    )
  }
  const form = forms[0]

  // 默认数据目标：master 角色 → 唯一表。都没有就不猜（数据接线升级为页面事件）。
  const defaultTable = tables.find((t) => roles[t.id] === 'master') ?? (tables.length === 1 ? tables[0] : undefined)
  const dataWiring = behavior === 'crud-requests' && !!defaultTable

  const wires: CompositionWire[] = []
  const pageEmits: string[] = []
  const pushEmit = (event: string): void => {
    if (!pageEmits.includes(event)) pageEmits.push(event)
  }

  // ── 显式接线：先校验，再作为派生接线的覆盖层 ────────────────────────────
  const explicit = plan.wires ?? []
  if (!Array.isArray(explicit)) throw new Error('组合 wires 必须是数组。')
  const explicitKeys = new Set<string>()
  const channelOf = (artifact: ArtifactKind): string[] => {
    const runtime = ARTIFACT_RUNTIME[artifact]
    return [...runtime.emits, ...(runtime.success.name ? [runtime.success.name] : [])]
  }
  for (const wire of explicit) {
    if (!wire || !wire.from || !wire.to) {
      throw new Error('组合 wires 的每一条都必须有 from / to。')
    }
    const from = infoById.get(wire.from.node)
    if (!from) throw new Error(`组合接线引用未知节点 "${wire.from.node}"。`)
    const fromChannels = channelOf(from.artifact)
    if (!fromChannels.includes(wire.from.channel)) {
      throw new Error(
        `组合接线引用了不存在的通道 ${from.artifact}.${wire.from.channel}（契约声明：${fromChannels.join('/') || '(空)'}）。`,
      )
    }
    if (wire.when !== undefined) {
      if (wire.from.channel !== 'row-action') {
        throw new Error(`组合接线 ${wire.from.node}.${wire.from.channel} 带了 when —— when 只用于 row-action 的按键分派。`)
      }
      if (typeof wire.when.rowAction !== 'string' || !wire.when.rowAction) {
        throw new Error('组合接线 when.rowAction 必须是非空字符串。')
      }
    }
    if (wire.from.channel === 'row-action' && !wire.when?.rowAction) {
      throw new Error(
        `组合接线 ${wire.from.node}.row-action 必须声明 when.rowAction（按 key 分派；通配会把所有行按钮接向同一目标）。`,
      )
    }
    if ('node' in wire.to) {
      const to = infoById.get(wire.to.node)
      if (!to) throw new Error(`组合接线引用未知节点 "${wire.to.node}"。`)
      if (!ARTIFACT_RUNTIME[to.artifact].expose.includes(wire.to.channel)) {
        throw new Error(
          `组合接线引用了不存在的暴露面 ${to.artifact}.${wire.to.channel}（契约声明：${ARTIFACT_RUNTIME[to.artifact].expose.join('/') || '(空)'}）。`,
        )
      }
    } else {
      const event = (wire.to as { event?: unknown }).event
      if (typeof event !== 'string' || !event) {
        throw new Error('组合接线的 to.page.event 必须是非空字符串。')
      }
    }
    const key = wireKey(wire)
    if (explicitKeys.has(key)) {
      throw new Error(`组合接线 ${key} 重复声明 —— 同一触达点只能有一条显式接线。`)
    }
    explicitKeys.add(key)
  }

  // 派生接线：同一 from（含 when.rowAction）上显式接线优先，不被重复派生。
  const addDerived = (wire: CompositionWire): void => {
    if (explicitKeys.has(wireKey(wire))) return
    wires.push(wire)
  }

  // ① 行动作：key 命中 dialog 节点 id → 开窗；否则升级为页面事件。
  for (const table of tables) {
    const source = nodes.find((n) => n.id === table.id)!
    const buttons = (source.plan.intent as { rowButtons?: { key?: string; name?: string }[] }).rowButtons ?? []
    const seenKeys = new Set<string>()
    for (const button of buttons) {
      const key = String(button.key ?? button.name)
      if (seenKeys.has(key)) continue
      seenKeys.add(key)
      if (dialogById.has(key)) {
        addDerived({
          from: { node: table.id, channel: 'row-action' },
          to: { node: key, channel: 'open' },
          when: { rowAction: key },
        })
      } else {
        addDerived({
          from: { node: table.id, channel: 'row-action' },
          to: { page: 'emit', event: 'row-action' },
          when: { rowAction: key },
        })
        pushEmit('row-action')
      }
    }
  }

  // ②③ 查询 / 提交 / 重置。
  if (form) {
    if (dataWiring) {
      // 新搜索必须回第 1 页：`refresh` 会保留当前页码（keepPage: true），在第 2 页
      // 上缩小过滤条件会得到空列表。库内查询按钮同样用 keepPage: false。
      addDerived({ from: { node: form.id, channel: 'query' }, to: { node: defaultTable!.id, channel: 'reload' } })
    } else {
      addDerived({ from: { node: form.id, channel: 'query' }, to: { page: 'emit', event: 'query' } })
      pushEmit('query')
    }
    addDerived({ from: { node: form.id, channel: 'submit' }, to: { page: 'emit', event: 'save' } })
    pushEmit('save')
    // 片段点「重置」时先 `formRef.resetFields()`（es-form 的 'rest' 分支）再发
    // `reset`；组合页接上它，表格才会用清空后的条件重新取数。
    if (dataWiring) {
      addDerived({ from: { node: form.id, channel: 'reset' }, to: { node: defaultTable!.id, channel: 'reload' } })
    } else {
      addDerived({ from: { node: form.id, channel: 'reset' }, to: { page: 'emit', event: 'reset' } })
      pushEmit('reset')
    }
  }

  // ④ 成功回调。
  for (const dialog of dialogs) {
    if (dataWiring) {
      addDerived({ from: { node: dialog.id, channel: 'onSuccess' }, to: { node: defaultTable!.id, channel: 'refresh' } })
    } else {
      addDerived({ from: { node: dialog.id, channel: 'onSuccess' }, to: { page: 'emit', event: 'success' } })
      pushEmit('success')
    }
  }

  // 显式接线里的页面事件也要进 faces.emit（声明了就必须能派发）。
  for (const wire of explicit) {
    if ('page' in wire.to) pushEmit(wire.to.event)
  }
  wires.unshift(...explicit)

  const expose: string[] = []
  if (tables.length === 1) {
    expose.push('refresh', 'reload')
  } else if (tables.length > 1) {
    // 多表：每张表一对 <id>Refresh / <id>Reload；有 master 时再给一对缺省别名指向它。
    if (defaultTable) expose.push('refresh', 'reload')
    for (const table of tables) {
      const camel = camelOf(table.componentName)
      expose.push(`${camel}Refresh`, `${camel}Reload`)
    }
  }
  if (dialogs.length > 0) expose.push('open')

  // 自检：派生接线的两端也必须真的在契约表里（接上一根不存在的管子比不接更糟）。
  for (const wire of wires) {
    const from = infoById.get(wire.from.node)
    if (!from) throw new Error(`组合接线引用未知节点 "${wire.from.node}"。`)
    const fromChannels = channelOf(from.artifact)
    if (!fromChannels.includes(wire.from.channel)) {
      throw new Error(
        `组合接线引用了不存在的通道 ${from.artifact}.${wire.from.channel}（契约声明：${fromChannels.join('/') || '(空)'}）。`,
      )
    }
    if ('node' in wire.to) {
      const to = infoById.get(wire.to.node)
      if (!to) throw new Error(`组合接线引用未知节点 "${wire.to.node}"。`)
      const toRuntime = ARTIFACT_RUNTIME[to.artifact]
      if (!toRuntime.expose.includes(wire.to.channel)) {
        throw new Error(
          `组合接线引用了不存在的暴露面 ${to.artifact}.${wire.to.channel}（契约声明：${toRuntime.expose.join('/') || '(空)'}）。`,
        )
      }
    }
  }

  return { target, typescript, behavior, roles, wires, faces: { expose, emit: pageEmits }, nodes: infos }
}

/** 显式接线与派生接线的同一性键：同一节点的同一通道（行动作再按 key 细分）。 */
function wireKey(wire: CompositionWire): string {
  return `${wire.from.node}.${wire.from.channel}${wire.when?.rowAction ? `#${wire.when.rowAction}` : ''}`
}

function camelOf(pascal: string): string {
  return `${pascal.charAt(0).toLowerCase()}${pascal.slice(1)}`
}

interface EmittedNode {
  id: string
  scene: ComposableScene
  artifact: ArtifactKind
  componentName: string
  file: ArtifactFile
  /** 按组合规则重命名后的文件。 */
  renamed: ArtifactFile
  envelope: ArtifactEnvelope
  /** dialog composable 形态才有。 */
  composableName?: string
  /**
   * 弹窗的声明式标题（`intent.defaultTitle`）。页面 `open()` 的缺省值取它，
   * 与片段自己 `open()` 的默认参数同一个真源；未声明时才回落 `dialogTitleFor(id)`。
   */
  titleDefault?: string
}

function emitNodes(analysis: CompositionAnalysis, plan: CompositionPlan): EmittedNode[] {
  const out: EmittedNode[] = []
  for (const info of analysis.nodes) {
    const source = plan.nodes.find((n) => n.id === info.id)!
    const intent = {
      ...(source.plan.intent as unknown as Record<string, unknown>),
      // 目标端以组合页为准：节点没显式写 target 时补上，避免生成器落到 vue3 缺省。
      target: analysis.target,
    }
    const result = emitSceneArtifact({ scene: info.scene, intent } as ScenePlan)
    if (result.isError || !result.envelope) {
      throw new Error(`节点 "${info.id}" 的片段生成失败：${result.text}`)
    }
    if (result.envelope.files.length !== 1) {
      throw new Error(
        `节点 "${info.id}" 产出 ${result.envelope.files.length} 份文件 —— 组合只接受单文件片段（table / form / dialog）。`,
      )
    }
    const file = result.envelope.files[0]
    const defaultTitle = (intent as { defaultTitle?: unknown }).defaultTitle
    out.push({
      id: info.id,
      scene: info.scene,
      artifact: info.artifact,
      componentName: info.componentName,
      file,
      renamed: { path: `${info.id}.${extOf(file.language)}`, code: file.code, language: file.language },
      envelope: result.envelope,
      composableName:
        info.artifact === 'dialog-composable'
          ? String((intent as { composableName?: string }).composableName || 'useFormDialog')
          : undefined,
      titleDefault: info.scene === 'dialog' && typeof defaultTitle === 'string' ? defaultTitle : undefined,
    })
  }
  return out
}

/**
 * 页面模板 ref 的变量名。
 *
 * 由**节点 id 派生**（不是写死 `tableRef` / `editRef`）：表格与弹窗共用分配规则，
 * 由 `planComposition` 的「组件名唯一」检查保证不会撞名（camel∘pascal 冲突必然是
 * pascal 冲突）。@1 写死表格 ref 为 `tableRef`，弹窗节点 id 叫 `table` 时会生成
 * 两条 `const tableRef`，产物直接编不过。
 */
function refVar(node: EmittedNode): string {
  return `${node.componentName.charAt(0).toLowerCase()}${node.componentName.slice(1)}Ref`
}

/** composable dialog 解构出来的 open 变量名。 */
function composableOpenVar(node: EmittedNode): string {
  return `open${node.componentName}`
}

/** 弹窗成功后页面要做什么：刷新某张表（@3 可区分多表）/ 派发页面事件 / 无。 */
type SuccessPlan =
  | { kind: 'invoke'; refName: string; channel: string }
  | { kind: 'emit'; id: string; event: string }
  | { kind: 'none' }

/**
 * 成功回调的代码形态。`hostCallback` 只用于页面 `open()`：在页面动作之后**再**调用
 * 宿主传入的 `options.onSuccess`（没有表格时宿主唯一能观察成功的地方）。
 */
function successClosure(plan: SuccessPlan, opts: { vue2: boolean; hostCallback?: boolean }): string | undefined {
  if (plan.kind === 'invoke') {
    const call = opts.vue2
      ? `this.$refs.${plan.refName}.${plan.channel}()`
      : `${plan.refName}.value?.${plan.channel}?.()`
    if (!opts.hostCallback) return `(data) => { ${call} }`
    return opts.vue2
      ? `(data) => { ${call}; if (options.onSuccess) options.onSuccess(data) }`
      : `(data) => { ${call}; options.onSuccess?.(data) }`
  }
  if (plan.kind === 'emit') {
    const emitCall = opts.vue2
      ? `this.$emit(${q(plan.event)}, { id: ${q(plan.id)}, data })`
      : `emit(${q(plan.event)}, { id: ${q(plan.id)}, data })`
    if (!opts.hostCallback) return `(data) => { ${emitCall} }`
    return opts.vue2
      ? `(data) => { ${emitCall}; if (options.onSuccess) options.onSuccess(data) }`
      : `(data) => { ${emitCall}; options.onSuccess?.(data) }`
  }
  return undefined
}

/**
 * 打开一句弹窗调用。三处调用点（行动作 / open 派发 / 页面暴露）共用，
 * 避免三份模板各写一遍标题回落与成功回调的接法。
 *
 * 标题：`intent.defaultTitle` 优先（与片段自身 `open()` 的默认参数同源），
 * 缺省回落 `dialogTitleFor(id)`；调用方（页面 `open()`）传了 `titleExpr` 时
 * 以调用方为准，再回落同一个默认值。
 */
function openCall(
  node: EmittedNode,
  opts: {
    vue2: boolean
    rowExpr: string
    titleExpr?: string
    success: SuccessPlan
    hostCallback?: boolean
  },
): string {
  let callee: string
  if (opts.vue2) {
    // vue2 只允许 component 形态的弹窗（planComposition 已拒绝 composable），
    // 组件方法经 setup 的 return 暴露在实例上。
    callee = node.composableName
      ? `this.${composableOpenVar(node)}`
      : `this.$refs.${refVar(node)}.open`
  } else if (node.composableName) {
    callee = composableOpenVar(node)
  } else {
    callee = `${refVar(node)}.value?.open`
  }
  const fallback = q(node.titleDefault ?? dialogTitleFor(node.id))
  const titleArg = opts.titleExpr ? `${opts.titleExpr} || ${fallback}` : fallback
  const success = successClosure(opts.success, { vue2: opts.vue2, hostCallback: opts.hostCallback })
  return `${callee}(${titleArg}, ${opts.rowExpr}${success ? `, ${success}` : ''})`
}

function pageCode(
  analysis: CompositionAnalysis,
  nodes: EmittedNode[],
  wires: readonly CompositionWire[],
): string {
  const vue2 = analysis.target === 'vue2'
  const ts = analysis.typescript
  const tables = nodes.filter((n) => n.scene === 'table')
  const form = nodes.find((n) => n.scene === 'form')
  const dialogs = nodes.filter((n) => n.scene === 'dialog')
  const componentNodes = nodes.filter((n) => !n.composableName)
  const nodeById = new Map(nodes.map((n) => [n.id, n]))
  const multiTable = tables.length > 1

  const wireFrom = (nodeId: string, channel: string): CompositionWire | undefined =>
    wires.find((w) => w.from.node === nodeId && w.from.channel === channel)
  const rowsOf = (nodeId: string): CompositionWire[] =>
    wires.filter((w) => w.from.node === nodeId && w.from.channel === 'row-action')

  const successOf = (dialogId: string): SuccessPlan => {
    const wire = wireFrom(dialogId, 'onSuccess')
    if (!wire) return { kind: 'none' }
    if ('page' in wire.to) return { kind: 'emit', id: dialogId, event: wire.to.event }
    return { kind: 'invoke', refName: refVar(nodeById.get(wire.to.node)!), channel: wire.to.channel }
  }

  /** 行按钮处理器名字：单表沿用 `onRowAction`，多表按节点派生避免串台。 */
  const rowHandler = (table: EmittedNode): string => (multiTable ? `onRowAction${table.componentName}` : 'onRowAction')
  const hasRowAction = tables.some((t) => rowsOf(t.id).length > 0)

  /** 页面事件调用表达式（vue2 / vue3 两套语法）。 */
  const emitExpr = (event: string, arg?: string): string =>
    vue2
      ? `this.$emit(${q(event)}${arg ? `, ${arg}` : ''})`
      : `emit(${q(event)}${arg ? `, ${arg}` : ''})`

  /** 行动作转发给页面时带上来源表 id（多表页面不带上就分不清谁发的）。 */
  const forwardedPayload = (table: EmittedNode): string =>
    multiTable ? `{ table: ${q(table.id)}, ...payload }` : 'payload'

  /**
   * 行动作处理器体。每条 wire 是一个 `payload.key` 分支；未匹配的 key 落到
   * 兜底转发（只有该表真的把 `row-action` 升级为页面事件时才发）。
   */
  function rowActionBody(table: EmittedNode, indent: string): string[] {
    const out: string[] = []
    for (const wire of rowsOf(table.id)) {
      if (!wire.when?.rowAction) continue
      out.push(`${indent}if (payload.key === ${q(wire.when.rowAction)}) {`)
      if ('page' in wire.to) {
        out.push(`${indent}  ${emitExpr(wire.to.event, forwardedPayload(table))}`)
      } else {
        const target = nodeById.get(wire.to.node)!
        if (target.scene === 'dialog') {
          out.push(
            `${indent}  ${openCall(target, { vue2, rowExpr: 'payload.row', success: successOf(target.id) })}`,
          )
        } else {
          out.push(
            vue2
              ? `${indent}  this.$refs.${refVar(target)}.${wire.to.channel}(payload.row)`
              : `${indent}  ${refVar(target)}.value?.${wire.to.channel}?.(payload.row)`,
          )
        }
      }
      out.push(`${indent}  return`)
      out.push(`${indent}}`)
    }
    if (rowsOf(table.id).some((w) => 'page' in w.to && w.to.event === 'row-action')) {
      out.push(`${indent}${emitExpr('row-action', forwardedPayload(table))}`)
    }
    return out
  }

  /** 表单通道 → 目标调用（`arg` 为空时不传参）。 */
  function formCall(wire: CompositionWire | undefined, arg: string): string | undefined {
    if (!wire) return undefined
    if ('page' in wire.to) return emitExpr(wire.to.event, arg || undefined)
    const target = nodeById.get(wire.to.node)!
    return vue2
      ? `return this.$refs.${refVar(target)}.${wire.to.channel}(${arg})`
      : `return ${refVar(target)}.value?.${wire.to.channel}?.(${arg})`
  }

  if (vue2) {
    const lines: string[] = []
    lines.push('<template>')
    lines.push('  <div class="es-composed-page">')
    for (const n of componentNodes) {
      const attrs =
        n.scene === 'table'
          ? ` ref="${refVar(n)}" @row-action="${rowHandler(n)}"`
          : n.scene === 'form'
            ? ' @query="onQuery" @submit="onSubmit" @reset="onReset"'
            : ` ref="${refVar(n)}"`
      lines.push(`    <${kebabOf(n.componentName)}${attrs} />`)
    }
    lines.push('  </div>')
    lines.push('</template>')
    lines.push('')
    lines.push(ts ? '<script lang="ts">' : '<script>')
    for (const n of componentNodes) {
      lines.push(`import ${n.componentName} from './${n.renamed.path}'`)
    }
    lines.push('')
    lines.push('export default {')
    lines.push("  name: 'ComposedPage',")
    lines.push(`  components: { ${componentNodes.map((n) => n.componentName).join(', ')} },`)
    lines.push('  methods: {')
    const exposeSet = new Set(analysis.faces.expose)
    const defaultTable =
      tables.find((t) => analysis.roles[t.id] === 'master') ?? (tables.length === 1 ? tables[0] : undefined)
    if (tables.length === 1 || (multiTable && defaultTable && exposeSet.has('refresh'))) {
      lines.push(`    refresh(model) { return this.$refs.${refVar(defaultTable!)}.refresh(model) },`)
      lines.push(`    reload(model) { return this.$refs.${refVar(defaultTable!)}.reload(model) },`)
    }
    if (multiTable) {
      for (const table of tables) {
        const camel = camelOf(table.componentName)
        if (exposeSet.has(`${camel}Refresh`)) {
          lines.push(`    ${camel}Refresh(model) { return this.$refs.${refVar(table)}.refresh(model) },`)
        }
        if (exposeSet.has(`${camel}Reload`)) {
          lines.push(`    ${camel}Reload(model) { return this.$refs.${refVar(table)}.reload(model) },`)
        }
      }
    }
    for (const table of tables) {
      if (rowsOf(table.id).length === 0) continue
      lines.push(`    ${rowHandler(table)}(payload) {`)
      for (const line of rowActionBody(table, '      ')) lines.push(line)
      lines.push('    },')
    }
    if (form) {
      lines.push('    onQuery(model) {')
      // 新搜索回第 1 页（与库内查询按钮同语义）。
      const queryCall = formCall(wireFrom(form.id, 'query'), 'model')
      if (queryCall) lines.push(`      ${queryCall}`)
      lines.push('    },')
      lines.push('    onSubmit(model) {')
      const submitCall = formCall(wireFrom(form.id, 'submit'), 'model')
      if (submitCall) lines.push(`      ${submitCall}`)
      lines.push('    },')
      lines.push('    onReset() {')
      // 片段已在按钮里 resetFields()；这里让表格用空条件重新取数。
      const resetCall = formCall(wireFrom(form.id, 'reset'), '')
      if (resetCall) lines.push(`      ${resetCall}`)
      lines.push('    },')
    }
    if (dialogs.length > 0) {
      lines.push('    open(id, options = {}) {')
      for (const dialog of dialogs) {
        lines.push(`      if (id === ${q(dialog.id)}) {`)
        lines.push(
          `        ${openCall(dialog, {
            vue2,
            rowExpr: 'options.row || {}',
            titleExpr: 'options.title',
            success: successOf(dialog.id),
            hostCallback: true,
          })}`,
        )
        lines.push('        return true')
        lines.push('      }')
      }
      lines.push('      return false')
      lines.push('    },')
    }
    lines.push('  },')
    lines.push('}')
    lines.push('</script>')
    return lines.join('\n')
  }

  const lines: string[] = []
  lines.push(ts ? '<script setup lang="ts">' : '<script setup>')
  const needRef = tables.length > 0 || componentNodes.some((n) => n.scene === 'dialog')
  if (needRef) lines.push("import { ref } from 'vue'")
  for (const n of nodes) {
    if (n.composableName) lines.push(`import { ${n.composableName} } from './${n.renamed.path}'`)
    else lines.push(`import ${n.componentName} from './${n.renamed.path}'`)
  }
  lines.push('')
  if (analysis.faces.emit.length > 0) {
    lines.push(`const emit = defineEmits([${analysis.faces.emit.map((e) => q(e)).join(', ')}])`)
    lines.push('')
  }
  for (const table of tables) lines.push(`const ${refVar(table)} = ref(null)`)
  for (const dialog of dialogs) {
    if (dialog.composableName) lines.push(`const { open: ${composableOpenVar(dialog)} } = ${dialog.composableName}()`)
    else lines.push(`const ${refVar(dialog)} = ref(null)`)
  }
  for (const table of tables) {
    if (rowsOf(table.id).length === 0) continue
    lines.push('')
    lines.push(
      ts
        ? `function ${rowHandler(table)}(payload: { key: string; row: any }) {`
        : `function ${rowHandler(table)}(payload) {`,
    )
    for (const line of rowActionBody(table, '  ')) lines.push(line)
    lines.push('}')
  }
  if (form) {
    lines.push('')
    lines.push(ts ? 'function onQuery(model: Record<string, unknown>) {' : 'function onQuery(model) {')
    // 新搜索回第 1 页（与库内查询按钮同语义：keepPage: false）。
    const queryCall = formCall(wireFrom(form.id, 'query'), 'model')
    if (queryCall) lines.push(`  ${queryCall}`)
    lines.push('}')
    lines.push('')
    lines.push(ts ? 'function onSubmit(model: Record<string, unknown>) {' : 'function onSubmit(model) {')
    const submitCall = formCall(wireFrom(form.id, 'submit'), 'model')
    if (submitCall) lines.push(`  ${submitCall}`)
    lines.push('}')
    lines.push('')
    // 片段点「重置」时已 resetFields()；表格用空条件重新取数，否则列表还是旧过滤结果。
    lines.push('function onReset() {')
    const resetCall = formCall(wireFrom(form.id, 'reset'), '')
    if (resetCall) lines.push(`  ${resetCall}`)
    lines.push('}')
  }
  const exposeSet = new Set(analysis.faces.expose)
  const defaultTable =
    tables.find((t) => analysis.roles[t.id] === 'master') ?? (tables.length === 1 ? tables[0] : undefined)
  if (defaultTable && exposeSet.has('refresh')) {
    lines.push('')
    lines.push(ts ? 'function refresh(model?: Record<string, unknown>) {' : 'function refresh(model) {')
    lines.push(`  return ${refVar(defaultTable)}.value?.refresh?.(model)`)
    lines.push('}')
    lines.push('')
    lines.push(ts ? 'function reload(model?: Record<string, unknown>) {' : 'function reload(model) {')
    lines.push(`  return ${refVar(defaultTable)}.value?.reload?.(model)`)
    lines.push('}')
  }
  if (multiTable) {
    for (const table of tables) {
      const camel = camelOf(table.componentName)
      if (exposeSet.has(`${camel}Refresh`)) {
        lines.push('')
        lines.push(ts ? `function ${camel}Refresh(model?: Record<string, unknown>) {` : `function ${camel}Refresh(model) {`)
        lines.push(`  return ${refVar(table)}.value?.refresh?.(model)`)
        lines.push('}')
      }
      if (exposeSet.has(`${camel}Reload`)) {
        lines.push('')
        lines.push(ts ? `function ${camel}Reload(model?: Record<string, unknown>) {` : `function ${camel}Reload(model) {`)
        lines.push(`  return ${refVar(table)}.value?.reload?.(model)`)
        lines.push('}')
      }
    }
  }
  if (dialogs.length > 0) {
    lines.push('')
    lines.push(
      ts
        ? 'function open(id: string, options: { title?: string; row?: any; onSuccess?: (data: any) => void } = {}): boolean {'
        : 'function open(id, options = {}) {',
    )
    for (const dialog of dialogs) {
      lines.push(`  if (id === ${q(dialog.id)}) {`)
      lines.push(
        `    ${openCall(dialog, {
          vue2,
          rowExpr: 'options.row ?? {}',
          titleExpr: 'options.title',
          success: successOf(dialog.id),
          hostCallback: true,
        })}`,
      )
      lines.push('    return true')
      lines.push('  }')
    }
    lines.push('  return false')
    lines.push('}')
  }
  if (analysis.faces.expose.length > 0) {
    lines.push('')
    lines.push(`defineExpose({ ${analysis.faces.expose.join(', ')} })`)
  }
  lines.push('</script>')
  lines.push('')
  lines.push('<template>')
  lines.push('  <div class="es-composed-page">')
  for (const n of componentNodes) {
    if (n.scene === 'table') lines.push(`    <${n.componentName} ref="${refVar(n)}" @row-action="${rowHandler(n)}" />`)
    else if (n.scene === 'form') lines.push(`    <${n.componentName} @query="onQuery" @submit="onSubmit" @reset="onReset" />`)
    else lines.push(`    <${n.componentName} ref="${refVar(n)}" />`)
  }
  lines.push('  </div>')
  lines.push('</template>')
  return lines.join('\n')
}

function composeText(
  plan: CompositionPlan,
  analysis: CompositionAnalysis,
  nodes: EmittedNode[],
  page: ArtifactFile,
  wires: readonly CompositionWire[],
  warnings: readonly string[],
): string {
  const name = plan.name && plan.name.trim() ? plan.name.trim() : 'ComposedPage'
  const out: string[] = []
  out.push(`Composed page "${name}" (target=${analysis.target}, ${nodes.length} node(s)):`)
  for (const n of nodes) {
    const kind = n.composableName ? 'dialog (composable)' : n.scene
    const role = analysis.roles[n.id] ? ` [role=${analysis.roles[n.id]}]` : ''
    out.push(`- ${kind} "${n.id}"${role} → ${n.renamed.path}`)
  }
  out.push('', `Behavior: ${analysis.behavior}（${analysis.behavior === 'ui-only' ? '数据通道升级为页面事件' : '派生 CRUD 数据接线'}）`)
  out.push('', 'Wiring (derived from ARTIFACT_RUNTIME — not guessed; explicit wires included):')
  for (const w of wires) {
    const when = w.when ? ` (key=${w.when.rowAction})` : ''
    const to = 'page' in w.to ? `page emit "${w.to.event}"` : `${w.to.node}.${w.to.channel}`
    out.push(`- ${w.from.node}.${w.from.channel}${when} → ${to}`)
  }
  out.push(
    '',
    `Page: exposes ${analysis.faces.expose.join('/') || '(none)'} · emits ${
      analysis.faces.emit.map((e) => `"${e}"`).join('/') || '(none)'
    }`,
  )
  if (warnings.length > 0) {
    out.push('', '⚠️ Warnings:')
    for (const w of warnings) out.push(`  - ${w}`)
  }
  out.push('', '---', '')
  for (const n of nodes) {
    out.push(`## ${n.renamed.path}`, '', '```' + n.renamed.language, n.renamed.code, '```', '', '---', '')
  }
  out.push(`## ${page.path}`, '', '```vue', page.code, '```')
  return out.join('\n')
}

/**
 * 组合发射：节点片段原样产出 + 一张按契约接好线的 `Page.vue`。
 *
 * 失败分支只返回错误正文（与 `emitScene` 同口径）：没有文件、没有信封 ——
 * 半份页面比没有页面更危险。
 */
export function emitComposition(plan: CompositionPlan): CompositionResult {
  try {
    const analysis = planComposition(plan)
    const nodes = emitNodes(analysis, plan)
    const warnings: string[] = []
    for (const n of nodes) {
      for (const w of n.envelope.warnings) warnings.push(`[${n.id}] ${w}`)
    }
    const page: ArtifactFile = {
      path: 'Page.vue',
      code: pageCode(analysis, nodes, analysis.wires),
      language: 'vue',
    }
    if (nodes.some((n) => n.renamed.path === page.path)) {
      throw new Error(`组合产物里 ${page.path} 与节点文件重名。`)
    }
    const name = plan.name && plan.name.trim() ? plan.name.trim() : 'ComposedPage'
    const files: ArtifactFile[] = [...nodes.map((n) => n.renamed), page]
    const envelope: CompositionEnvelope = Object.freeze({
      contract: COMPOSITION_CONTRACT_VERSION,
      name,
      target: analysis.target,
      behavior: analysis.behavior,
      nodes: Object.freeze(nodes.map((n) => n.envelope)),
      roles: Object.freeze({ ...analysis.roles }),
      wires: Object.freeze(analysis.wires.map((w) => Object.freeze({ ...w }))),
      faces: Object.freeze({
        expose: Object.freeze([...analysis.faces.expose]),
        emit: Object.freeze([...analysis.faces.emit]),
      }),
      page: Object.freeze({ ...page }),
      warnings: Object.freeze([...warnings]),
      fingerprint: fingerprintPayload(COMPOSITION_CONTRACT_VERSION, {
        name,
        target: analysis.target,
        behavior: analysis.behavior,
        roles: analysis.roles,
        nodeFingerprints: nodes.map((n) => n.envelope.fingerprint),
        wires: analysis.wires,
        faces: analysis.faces,
        page: { path: page.path, code: page.code, language: page.language },
        warnings,
      }),
    })

    return {
      text: composeText(plan, analysis, nodes, page, analysis.wires, warnings),
      files,
      page,
      wires: envelope.wires,
      faces: envelope.faces,
      warnings: envelope.warnings,
      envelope,
    }
  } catch (error: any) {
    return { text: `Error composing page: ${error?.message ?? String(error)}`, isError: true }
  }
}
