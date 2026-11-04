/**
 * 组合契约 —— `es-plus.composition@2`（P6b 落地，P7 升版）。
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
 * `planComposition` 只读 `ARTIFACT_RUNTIME` 声明的通道名，按五条规则派生：
 *
 *   - 表格的每个行按钮 key：若存在 id 相同的 dialog 节点 → 接 `dialog.open` 并用
 *     `intent.defaultTitle ?? dialogTitleFor(key)` 作标题；否则升级为页面事件
 *     `row-action`（不是丢弃）；
 *   - form `query`：有表格 → `table.reload(model)`（与库内查询按钮同语义：新搜索
 *     回第 1 页，[`component.vue:1027`] `keepPage: false`）；无表格 → 页面事件 `query`；
 *   - form `reset`：片段点「重置」先 `resetFields()` 再发 `reset`；有表格 →
 *     `table.reload()`；无表格 → 页面事件 `reset`；
 *   - form `submit`：永远是页面事件 `save`（片段不负责请求，「保存到哪」只有宿主知道）；
 *   - dialog `onSuccess`：有表格 → `table.refresh()`；无表格 → 页面事件 `success`。
 *
 * 组合页因此有两个朝向外的面：**exposes**（表格 refresh/reload、按 id 开弹窗）与
 * **emits**（保存 / 未匹配的行动作 / 无表格时的查询、重置与成功）。任何通道要么被
 * 接上，要么升级为页面事件，**没有静默丢弃**（`check-composition-contract` 逐通道断言）。
 *
 * ## 对外 API（`es-plus.composition@2`）
 *
 * - `open(id, options?)`：`options = { title?, row?, onSuccess? }`，返回是否命中。
 *   片段自己的契约是 `open(title, row?, onSuccess?)`；组合页在**第一位**插入 id，
 *   因此第二个参数必须是与位置无关的对象 —— 否则 `open('edit', row)` 会把整行
 *   当成标题（@1 的真实缺陷）。未知 id 返回 `false`，不再静默吞掉。
 * - 标题真源是节点 intent 的 `defaultTitle`（与单独发射同一字段），缺省才回落
 *   `dialogTitleFor(id)`。@1 无视 `defaultTitle`，把声明式标题静默换成了 id。
 * - 有表格时 `onSuccess` 仍由页面刷新表格，但宿主回调会**在其后**执行（@1 没有
 *   宿主回调通道，宿主无法在保存成功后做自己的事）。
 * - 表格的模板 ref 名由节点 id 派生（`${camel(id)}Ref`）。@1 写死 `tableRef`，
 *   与 id 为 `table` 的弹窗节点生成的 `tableRef` 撞成重复声明。
 *
 * ## 边界
 *
 * - 节点只能是 `table` / `form` / `dialog`：`crud` 已经是整页，不能再被组合。
 * - 每个场景最多一个节点：两张表无法按 ref 区分，多弹窗没有分派依据。需要多弹窗
 *   时用 crud 场景的 `surfaces.dialog`。
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

/** 协议版本。任何破坏兼容的字段改动都必须换版本号（@2：open 选项对象 / reset 接线 / 派生 ref 名）。 */
export const COMPOSITION_CONTRACT_VERSION = 'es-plus.composition@2' as const

/** 可组合的场景。`crud` 不在其中：它已经是整页产物。 */
export type ComposableScene = 'table' | 'form' | 'dialog'

/** 组合计划里的一个节点。 */
export interface CompositionNode {
  /**
   * 节点 id：决定产物文件名（`${id}.${ext}`）、模板 ref 名与行动作绑定
   * （dialog 节点按 id 匹配 key）。
   */
  id: string
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
  nodes: readonly CompositionNode[]
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
  /** 每个节点的完整产物信封（自带版本与指纹），组合不重编它们的身份。 */
  nodes: readonly ArtifactEnvelope[]
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

  const declaredTarget = nodes
    .map((n) => (n.plan.intent as { target?: TargetFramework }).target)
    .find((t): t is TargetFramework => !!t)
  const target = plan.target ?? declaredTarget ?? DEFAULT_TARGET

  const seenIds = new Set<string>()
  const seenScenes = new Set<string>()
  const seenComponents = new Set<string>()
  const infos: CompositionAnalysis['nodes'][number][] = []
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
    if (seenScenes.has(scene)) {
      throw new Error(
        `组合里 ${scene} 场景出现了不止一个节点：一个页面只能有一个 ${scene} 片段（多弹窗请改用 crud 场景的 surfaces.dialog）。`,
      )
    }
    seenScenes.add(scene)

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

    const artifact: ArtifactKind =
      scene === 'dialog' ? (intent.mode === 'component' ? 'dialog-component' : 'dialog-composable') : scene
    infos.push({ id, scene, artifact, componentName, openId: id })
  }

  const table = infos.find((n) => n.scene === 'table')
  const form = infos.find((n) => n.scene === 'form')
  const dialogs = infos.filter((n) => n.scene === 'dialog')
  const dialogById = new Map(dialogs.map((d) => [d.id, d]))

  const wires: CompositionWire[] = []
  const pageEmits: string[] = []
  const pushEmit = (event: string): void => {
    if (!pageEmits.includes(event)) pageEmits.push(event)
  }

  // ① 行动作：key 命中 dialog 节点 id → 开窗；否则升级为页面事件。
  if (table) {
    const source = nodes.find((n) => n.id === table.id)!
    const buttons = (source.plan.intent as { rowButtons?: { key?: string; name?: string }[] }).rowButtons ?? []
    const seenKeys = new Set<string>()
    for (const button of buttons) {
      const key = String(button.key ?? button.name)
      if (seenKeys.has(key)) continue
      seenKeys.add(key)
      if (dialogById.has(key)) {
        wires.push({
          from: { node: table.id, channel: 'row-action' },
          to: { node: key, channel: 'open' },
          when: { rowAction: key },
        })
      } else {
        wires.push({
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
    if (table) {
      // 新搜索必须回第 1 页：`refresh` 会保留当前页码（keepPage: true），在第 2 页
      // 上缩小过滤条件会得到空列表。库内查询按钮同样用 keepPage: false。
      wires.push({ from: { node: form.id, channel: 'query' }, to: { node: table.id, channel: 'reload' } })
    } else {
      wires.push({ from: { node: form.id, channel: 'query' }, to: { page: 'emit', event: 'query' } })
      pushEmit('query')
    }
    wires.push({ from: { node: form.id, channel: 'submit' }, to: { page: 'emit', event: 'save' } })
    pushEmit('save')
    // 片段点「重置」时先 `formRef.resetFields()`（es-form 的 'rest' 分支）再发
    // `reset`；组合页接上它，表格才会用清空后的条件重新取数。
    if (table) {
      wires.push({ from: { node: form.id, channel: 'reset' }, to: { node: table.id, channel: 'reload' } })
    } else {
      wires.push({ from: { node: form.id, channel: 'reset' }, to: { page: 'emit', event: 'reset' } })
      pushEmit('reset')
    }
  }

  // ④ 成功回调。
  for (const dialog of dialogs) {
    if (table) {
      wires.push({ from: { node: dialog.id, channel: 'onSuccess' }, to: { node: table.id, channel: 'refresh' } })
    } else {
      wires.push({ from: { node: dialog.id, channel: 'onSuccess' }, to: { page: 'emit', event: 'success' } })
      pushEmit('success')
    }
  }

  const expose: string[] = []
  if (table) expose.push('refresh', 'reload')
  if (dialogs.length > 0) expose.push('open')

  // 自检：接线两端的通道名必须真的在契约表里（接上一根不存在的管子比不接更糟）。
  const infoById = new Map(infos.map((i) => [i.id, i]))
  for (const wire of wires) {
    const from = infoById.get(wire.from.node)
    if (!from) throw new Error(`组合接线引用未知节点 "${wire.from.node}"。`)
    const fromRuntime = ARTIFACT_RUNTIME[from.artifact]
    const fromChannels = [...fromRuntime.emits, ...(fromRuntime.success.name ? [fromRuntime.success.name] : [])]
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

  return { target, typescript, wires, faces: { expose, emit: pageEmits }, nodes: infos }
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

/**
 * 打开一句弹窗调用。三处调用点（行动作 / open 派发 / 页面暴露）共用，
 * 避免三份模板各写一遍标题回落与成功回调的接法。
 *
 * 标题：`intent.defaultTitle` 优先（与片段自身 `open()` 的默认参数同源），
 * 缺省回落 `dialogTitleFor(id)`；调用方（页面 `open()`）传了 `titleExpr` 时
 * 以调用方为准，再回落同一个默认值。
 *
 * 成功回调：有表格 → `onTableSuccess`（刷新表格）；无表格 → 升级为页面事件
 * `success`（携带 `{ id, data }`）；两者都不成立时省略。
 * `hostCallback` 只用于页面 `open()`：在页面自己的动作之后**再**调用宿主传入的
 * `options.onSuccess`（没有表格时宿主唯一能观察成功的地方）。
 */
function openCall(
  node: EmittedNode,
  opts: {
    vue2: boolean
    rowExpr: string
    titleExpr?: string
    table: boolean
    emitSuccess: boolean
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
  let success = ''
  if (opts.table) {
    if (opts.hostCallback) {
      success = opts.vue2
        ? '(data) => { this.onTableSuccess(); if (options.onSuccess) options.onSuccess(data) }'
        : '(data) => { onTableSuccess(); options.onSuccess?.(data) }'
    } else {
      success = opts.vue2 ? 'this.onTableSuccess' : 'onTableSuccess'
    }
  } else if (opts.emitSuccess) {
    const emitCall = opts.vue2
      ? `this.$emit('success', { id: ${q(node.id)}, data })`
      : `emit('success', { id: ${q(node.id)}, data })`
    if (opts.hostCallback) {
      success = opts.vue2
        ? `(data) => { ${emitCall}; if (options.onSuccess) options.onSuccess(data) }`
        : `(data) => { ${emitCall}; options.onSuccess?.(data) }`
    } else {
      success = `(data) => ${emitCall}`
    }
  }
  return `${callee}(${titleArg}, ${opts.rowExpr}${success ? `, ${success}` : ''})`
}

function pageCode(
  analysis: CompositionAnalysis,
  nodes: EmittedNode[],
  wires: readonly CompositionWire[],
): string {
  const vue2 = analysis.target === 'vue2'
  const ts = analysis.typescript
  const table = nodes.find((n) => n.scene === 'table')
  const form = nodes.find((n) => n.scene === 'form')
  const dialogs = nodes.filter((n) => n.scene === 'dialog')
  const componentNodes = nodes.filter((n) => !n.composableName)
  const hasRowAction = wires.some((w) => w.from.channel === 'row-action')
  const forwardRowAction = analysis.faces.emit.includes('row-action')
  // 成功回调只有在「有弹窗且要刷新表格」时才有消费方；无表格时升级为页面事件。
  const needsSuccess = !!table && dialogs.length > 0
  const emitSuccess = !table && analysis.faces.emit.includes('success')

  if (vue2) {
    const lines: string[] = []
    const tableRef = table ? `this.$refs.${refVar(table)}` : ''
    lines.push('<template>')
    lines.push('  <div class="es-composed-page">')
    for (const n of componentNodes) {
      const attrs =
        n.scene === 'table'
          ? ` ref="${refVar(n)}" @row-action="onRowAction"`
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
    if (table) {
      lines.push(`    refresh(model) { return ${tableRef}.refresh(model) },`)
      lines.push(`    reload(model) { return ${tableRef}.reload(model) },`)
    }
    if (needsSuccess) {
      lines.push(`    onTableSuccess() { return ${tableRef}.refresh() },`)
    }
    if (hasRowAction) {
      lines.push('    onRowAction(payload) {')
      for (const wire of wires) {
        if (wire.from.channel !== 'row-action') continue
        const target = wire.to
        if (!('node' in target)) continue
        const dialog = nodes.find((n) => n.id === target.node)!
        lines.push(`      if (payload.key === ${q(wire.when?.rowAction ?? '')}) {`)
        lines.push(
          `        ${openCall(dialog, { vue2, rowExpr: 'payload.row', table: !!table, emitSuccess })}`,
        )
        lines.push('        return')
        lines.push('      }')
      }
      if (forwardRowAction) lines.push("      this.$emit('row-action', payload)")
      lines.push('    },')
    }
    if (form) {
      lines.push('    onQuery(model) {')
      // 新搜索回第 1 页（与库内查询按钮同语义）。
      lines.push(table ? `      return ${tableRef}.reload(model)` : "      this.$emit('query', model)")
      lines.push('    },')
      lines.push('    onSubmit(model) {')
      lines.push("      this.$emit('save', model)")
      lines.push('    },')
      lines.push('    onReset() {')
      // 片段已在按钮里 resetFields()；这里让表格用空条件重新取数。
      lines.push(table ? `      return ${tableRef}.reload()` : "      this.$emit('reset')")
      lines.push('    },')
    }
    if (dialogs.length > 0) {
      lines.push('    open(id, options = {}) {')
      for (const dialog of dialogs) {
        lines.push(`      if (id === ${q(dialog.id)}) {`)
        lines.push(
          `        ${openCall(dialog, { vue2, rowExpr: 'options.row || {}', titleExpr: 'options.title', table: !!table, emitSuccess, hostCallback: true })}`,
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
  const needRef = !!table || componentNodes.some((n) => n.scene === 'dialog')
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
  const tableRef = table ? refVar(table) : ''
  if (table) lines.push(`const ${tableRef} = ref(null)`)
  for (const dialog of dialogs) {
    if (dialog.composableName) lines.push(`const { open: ${composableOpenVar(dialog)} } = ${dialog.composableName}()`)
    else lines.push(`const ${refVar(dialog)} = ref(null)`)
  }
  if (needsSuccess) {
    lines.push('')
    lines.push('function onTableSuccess() {')
    lines.push(`  ${tableRef}.value?.refresh?.()`)
    lines.push('}')
  }
  if (hasRowAction) {
    lines.push('')
    lines.push(ts ? 'function onRowAction(payload: { key: string; row: any }) {' : 'function onRowAction(payload) {')
    for (const wire of wires) {
      if (wire.from.channel !== 'row-action') continue
      const target = wire.to
      if (!('node' in target)) continue
      const dialog = nodes.find((n) => n.id === target.node)!
      lines.push(`  if (payload.key === ${q(wire.when?.rowAction ?? '')}) {`)
      lines.push(`    ${openCall(dialog, { vue2, rowExpr: 'payload.row', table: !!table, emitSuccess })}`)
      lines.push('    return')
      lines.push('  }')
    }
    if (forwardRowAction) lines.push("  emit('row-action', payload)")
    lines.push('}')
  }
  if (form) {
    lines.push('')
    lines.push(
      ts ? 'function onQuery(model: Record<string, unknown>) {' : 'function onQuery(model) {',
    )
    // 新搜索回第 1 页（与库内查询按钮同语义：keepPage: false）。
    lines.push(table ? `  ${tableRef}.value?.reload?.(model)` : "  emit('query', model)")
    lines.push('}')
    lines.push('')
    lines.push(ts ? 'function onSubmit(model: Record<string, unknown>) {' : 'function onSubmit(model) {')
    lines.push("  emit('save', model)")
    lines.push('}')
    lines.push('')
    // 片段点「重置」时已 resetFields()；表格用空条件重新取数，否则列表还是旧过滤结果。
    lines.push('function onReset() {')
    lines.push(table ? `  ${tableRef}.value?.reload?.()` : "  emit('reset')")
    lines.push('}')
  }
  if (table) {
    lines.push('')
    lines.push(ts ? 'function refresh(model?: Record<string, unknown>) {' : 'function refresh(model) {')
    lines.push(`  return ${tableRef}.value?.refresh?.(model)`)
    lines.push('}')
    lines.push('')
    lines.push(ts ? 'function reload(model?: Record<string, unknown>) {' : 'function reload(model) {')
    lines.push(`  return ${tableRef}.value?.reload?.(model)`)
    lines.push('}')
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
        `    ${openCall(dialog, { vue2, rowExpr: 'options.row ?? {}', titleExpr: 'options.title', table: !!table, emitSuccess, hostCallback: true })}`,
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
    if (n.scene === 'table') lines.push(`    <${n.componentName} ref="${refVar(n)}" @row-action="onRowAction" />`)
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
    out.push(`- ${kind} "${n.id}" → ${n.renamed.path}`)
  }
  out.push('', 'Wiring (derived from ARTIFACT_RUNTIME — not guessed):')
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
      nodes: Object.freeze(nodes.map((n) => n.envelope)),
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
