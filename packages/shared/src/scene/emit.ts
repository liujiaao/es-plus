import type { ComposeCrudInput, SurfaceField } from '../compose-crud-config.js'
import { composeCrudConfig } from '../compose-crud-config.js'
import type { StructuredGenerateResult } from '../structured-generator.js'
import { generateFromConfig } from '../structured-generator.js'
import { buildPreflight, formatPreflight } from '../preflight.js'
import { validateAndRepair } from '../validate-and-repair.js'
import { buildSemanticWarnings, formatValidationError } from '../config-feedback.js'
import {
  generateDialogBlock,
  generateFormBlock,
  generateTableBlock,
  type DialogBlockInput,
  type FormBlockInput,
  type FragmentResult,
  type TableBlockInput,
} from '../fragment-generator.js'
import type { ArtifactKind, SceneId } from './registry.js'
import { DEFAULT_TARGET } from '../target.js'
import {
  buildArtifactEnvelope,
  type ArtifactEnvelope,
  type ArtifactFile,
} from './artifact.js'

/**
 * 场景发射层 —— **唯一**把意图表落到既有发射器的确定性代码。
 *
 * ## 为什么把前门 handler 整体搬到这里
 *
 * P2 的验收是「279 条语料与旧工具**字节相等**」。若新工具自己再写一遍路由
 * （surface 判定 → compose → 生成器 → 文案），两份代码的差异会在第一次改文案/
 * 告警顺序时显现，而字节等价的守卫只能事后发现。这里把**全部**逻辑下沉成一个
 * 纯函数，旧工具（`generate_crud` / `generate_table` / `generate_form` /
 * `generate_dialog`）与新场景路由器（`generate_scene`）都只做「参数形状 → 调这里」，
 * 等价性由调用图保证，而不是靠两份实现碰巧一致。
 *
 * ## 边界
 *
 * - 不新增发射器：`crud` 仍走 `composeCrudConfig` → `generateFromConfig`；
 *   `table` / `form` / `dialog` 仍走三个 fragment generator。
 * - 不调用任何 MCP 工具 handler（服务器无模型、无传输层依赖）。
 * - 输出是**文本**而非 MCP `content` 结构；MCP 适配留在 `packages/mcp-server`，
 *   CLI / eval 也能直接消费同一份文本。
 */

const DIALOG_TITLES: Record<string, string> = { add: '新增', edit: '编辑', view: '查看' }

/** 场景意图表里的一条弹窗：罐头键（add/edit/view）或全参对象。 */
export type CrudDialogEntry =
  | string
  | {
      key: string
      title?: string
      width?: string | number
      fullscreen?: boolean
      formItems?: SurfaceField[]
    }

/**
 * `scene: 'crud'` 的意图表。
 *
 * 与 `ComposeCrudInput` 的区别只有一处：三面字段表收进 `surfaces`（宿主 LLM 填的是
 * 「请求暗示了哪些面」，而不是一套平铺的 query/table/form/dialogs 键）。
 */
export interface CrudIntent extends Omit<ComposeCrudInput, 'query' | 'table' | 'form' | 'dialogs'> {
  surfaces: {
    query?: SurfaceField[]
    table?: SurfaceField[]
    form?: SurfaceField[]
    dialog?: CrudDialogEntry[]
  }
  /** 主键：同时进入组合配置与独立弹窗块（AN-06③）。 */
  rowkey?: string
}

/** 场景计划：单节点落地。多节点 composition 在 P4 之后才开放。 */
export type ScenePlan =
  | { scene: 'crud'; intent: CrudIntent }
  | { scene: 'table'; intent: TableBlockInput }
  | { scene: 'form'; intent: FormBlockInput }
  | { scene: 'dialog'; intent: DialogBlockInput }

/** 发射结果：`isError` 为真时正文说明「什么都没生成」。 */
export interface SceneEmitResult {
  text: string
  isError?: true
}

/**
 * 发射结果 + 产物信封（P5）。
 *
 * `text` 与 `emitScene` **逐字节相同**；`envelope` 是同一份产物的结构化视图。
 * 失败分支没有信封（`isError` 时什么都没生成，不该有一份自称产物的东西）。
 */
export interface SceneArtifactResult extends SceneEmitResult {
  envelope?: ArtifactEnvelope
}

function titleFor(key: string): string {
  return DIALOG_TITLES[key] ?? key
}

/**
 * AN-06③：顶层 `rowkey` 必须并入 `tableOptions`。
 *
 * 生成器读的是 `tableOptions.rowkey`；只把它交给独立 dialog 块会让页面删除/编辑按
 * 默认 `id` 拼 URL。冲突时取**顶层**（它是本工具的显式参数）并告警，不静默二选一。
 */
function withRowkey(
  tableOptions: Record<string, unknown> | undefined,
  rowkey: string | undefined,
): { tableOptions: Record<string, unknown> | undefined; warning?: string } {
  if (!rowkey) return { tableOptions }
  const prev = tableOptions?.rowkey
  return {
    tableOptions: { ...(tableOptions ?? {}), rowkey },
    warning:
      prev !== undefined && prev !== rowkey
        ? `rowkey 冲突：tableOptions.rowkey="${String(prev)}" vs 顶层 rowkey="${rowkey}" —— 取顶层（弹窗 PUT / 删除 URL 与独立 dialog 块必须用同一个键）。`
        : undefined,
  }
}

/**
 * 从弹窗 key 派生 composable 名（AI-36）。
 *
 * 前门可能一次给多个弹窗 —— 全部叫 `useFormDialog` 会产出重复导出（后一个覆盖前一个），
 * 故按 key 派生：`add` → `useAddDialog`、`order-detail` → `useOrderDetailDialog`。
 * 重名时追加序号并**告警**（绝不静默覆盖）。
 */
function composableNameFor(key: string, used: Set<string>, warnings: string[]): string {
  const pascal = key
    .split(/[^A-Za-z0-9]+/)
    .filter(Boolean)
    .map((p) => p.charAt(0).toUpperCase() + p.slice(1))
    .join('')
  const base = `use${pascal || 'Form'}Dialog`
  let name = base
  let n = 1
  while (used.has(name)) name = `${base}${++n}`
  if (name !== base) {
    warnings.push(
      `surfaces.dialog 有多个弹窗 key 推导出同一个 composable 名 ${base} —— 本个改用 ${name}（同名导出会互相覆盖）；建议给这些弹窗取不同的 key。`,
    )
  }
  used.add(name)
  return name
}

/** 片段产物的文本形态（与旧 `renderFragmentOutput` 逐字节相同）。 */
export function formatFragmentText(result: FragmentResult, fallbackFence: 'vue' | 'tsx'): string {
  const effective = result.fence ?? fallbackFence
  const out: string[] = [result.summary]
  if (result.warnings.length > 0) {
    out.push('')
    out.push('⚠️ Warnings (non-blocking — review and re-generate if any indicate a mapping mistake):')
    for (const w of result.warnings) out.push(`  - ${w}`)
  }
  out.push('', '---', '')
  out.push('```' + effective)
  out.push(result.code)
  out.push('```')
  return out.join('\n')
}

function formatGeneratedCrud(result: StructuredGenerateResult, allWarnings: string[]): string {
  const out: string[] = [result.summary]
  if (allWarnings.length > 0) {
    out.push('', '⚠️ Warnings (non-blocking — review and re-generate if any indicate a mapping mistake):')
    for (const w of allWarnings) out.push(`  - ${w}`)
  }
  // AN-15：与 generate_crud_from_config 同一份前置清单（同一个 formatPreflight）。
  if (result.preflight) {
    out.push('', formatPreflight(result.preflight))
  }
  out.push('', '---', '')
  if (result.wrapperCode) {
    out.push('## Schema (schema.ts)', '', '```typescript', result.code, '```', '', '---', '')
    out.push('## Wrapper SFC (Page.vue)', '', '```vue', result.wrapperCode, '```')
  } else {
    out.push('## Generated SFC', '', '```vue', result.code, '```')
  }
  return out.join('\n')
}

/** `scene: 'crud'` —— 有表走组合+整页生成器；无表发独立片段。 */
export function emitCrudScene(intent: CrudIntent): SceneArtifactResult {
  const s = intent.surfaces ?? {}
  const query: any[] = Array.isArray(s.query) ? s.query : []
  const table: any[] = Array.isArray(s.table) ? s.table : []
  const form: any[] = Array.isArray(s.form) ? s.form : []
  const dialogEntries: any[] = Array.isArray(s.dialog) ? s.dialog : []
  const hasTable = table.length > 0
  const hasQuery = query.length > 0
  const hasForm = form.length > 0
  const hasDialog = dialogEntries.length > 0

  if (!hasTable && !hasQuery && !hasForm && !hasDialog) {
    return {
      text: 'Error: `surfaces` is empty — set at least one of query / table / form / dialog.',
      isError: true,
    }
  }

  // ── Table-bearing: compose → generateFromConfig (golden-covered path) ──
  if (hasTable) {
    const dialogBody = hasForm ? form : table
    // 重复 key 会被 Object.fromEntries 静默覆盖 —— 显式告警（与无表支 AI-36 同一条原则）。
    const duplicateDialogKeys: string[] = []
    const dialogs = hasDialog
      ? (() => {
          const seen = new Set<string>()
          const entries: Array<[string, any]> = []
          for (const d of dialogEntries) {
            const key = typeof d === 'string' ? d : String(d.key)
            if (seen.has(key)) duplicateDialogKeys.push(key)
            seen.add(key)
            // 罐头键：字符串 → 默认标题 + 共用弹窗体。
            if (typeof d === 'string') {
              entries.push([key, { title: titleFor(key), formItems: dialogBody }])
              continue
            }
            // 全参对象：自定义 id/标题/宽度/全屏/逐弹窗字段表（AI-21④）。
            entries.push([
              key,
              {
                title: d.title !== undefined ? d.title : titleFor(key),
                ...(d.width !== undefined ? { width: d.width } : {}),
                ...(d.fullscreen !== undefined ? { fullscreen: d.fullscreen } : {}),
                formItems: d.formItems !== undefined ? d.formItems : dialogBody,
              },
            ])
          }
          return Object.fromEntries(entries)
        })()
      : undefined

    const rowkeyOpt = withRowkey(intent.tableOptions as Record<string, unknown> | undefined, intent.rowkey)
    const { config, warnings: composeWarnings } = composeCrudConfig({
      name: intent.name,
      apiUrl: intent.apiUrl,
      target: intent.target,
      mode: intent.mode,
      typescript: intent.typescript,
      i18n: intent.i18n,
      query,
      table,
      form,
      actions: intent.actions,
      permissions: intent.permissions,
      pagination: intent.pagination,
      tableOptions: rowkeyOpt.tableOptions,
      formLayout: intent.formLayout,
      operationColumn: intent.operationColumn,
      tableBtns: intent.tableBtns,
      toolbarBtns: intent.toolbarBtns,
      dialogs: dialogs as any,
      expandConfig: intent.expandConfig,
      treeConfig: intent.treeConfig,
      mergeConfig: intent.mergeConfig,
    })
    if (rowkeyOpt.warning) composeWarnings.unshift(rowkeyOpt.warning)

    // 前门确定性校验(C2·A3):组合出的 config 先过权威 Zod 判定,非法则回结构化错误、不生成。
    const check = validateAndRepair(config)
    if (!check.valid) {
      return { text: formatValidationError(check), isError: true }
    }

    const result = generateFromConfig(config as any)
    const allWarnings = [...composeWarnings, ...result.warnings, ...buildSemanticWarnings(config)]
    for (const key of new Set(duplicateDialogKeys)) {
      allWarnings.push(
        `surfaces.dialog 里 '${key}' 出现了多次 —— 同一 key 只能有一个弹窗，后面的定义覆盖了前面的（仅最后一个生效）；请合并字段或改用不同的 key。`,
      )
    }
    if (intent.mode === 'sfc') {
      allWarnings.push(
        'mode=sfc 是单文件输出，保真度低于默认的 schema 模式：dialogs / tableBtns / toolbarBtns / operationColumn 不会全量发射（schema 模式才全支持）。除非确需单 SFC，建议用 mode=schema。',
      )
    }

    return {
      text: formatGeneratedCrud(result, allWarnings),
      envelope: buildArtifactEnvelope({
        scene: 'crud',
        artifact: 'crud-page',
        target: intent.target ?? DEFAULT_TARGET,
        mode: intent.mode ?? 'schema',
        // schema 模式是「schema 文件 + 包装 SFC」两件套；sfc 模式只有一份 SFC。
        files: result.wrapperCode
          ? [
              {
                path: `schema.${config.typescript === false ? 'js' : 'ts'}`,
                code: result.code,
                language: config.typescript === false ? 'javascript' : 'typescript',
              },
              { path: 'Page.vue', code: result.wrapperCode, language: 'vue' },
            ]
          : [{ path: 'Page.vue', code: result.code, language: 'vue' }],
        config,
        warnings: allWarnings,
      }),
    }
  }

  // ── No table: emit standalone fragment(s) for the present surfaces ──
  const sections: string[] = []
  const allWarnings: string[] = []
  // 信封用的逐文件视图（与下面拼接的文本同源：同一份 r.code）。
  const files: ArtifactFile[] = []

  if (hasQuery) {
    const r = generateFormBlock({
      fields: query,
      context: 'query',
      buttons: 'query',
      target: intent.target,
      typescript: intent.typescript,
      i18n: intent.i18n,
      // Wave 4：表外分支此前把顶层 formLayout 静默丢掉（crudShape 收了、片段不接）。
      // 查询表单正是 formLayout 的原生消费面（labelWidth / minFoldRows 折叠）。
      ...(intent.formLayout ? { formLayout: intent.formLayout } : {}),
    })
    allWarnings.push(...r.warnings)
    sections.push(['## Query form (QueryForm.vue)', '', r.summary, '', '```vue', r.code, '```'].join('\n'))
    files.push({ path: 'QueryForm.vue', code: r.code, language: 'vue' })
  }

  if (hasDialog) {
    // ── 每个 dialog entry 各发射一段（AI-36）────────────────────────────
    // 旧实现只发一段、且忽略 entry 的 formItems/title/width/fullscreen ——
    // 多弹窗、逐弹窗字段表、自定义标题/宽度全部被静默丢弃。这里逐条落地：
    //   fields   = entry.formItems ?? (form 面 ?? query 面)   ← 与有表支同优先级
    //   title    = entry.title ?? 新增/编辑/查看（按 key）
    //   width/fullscreen → generate_dialog 的 AI-28 `options` 通道
    //   name     = 由 key 派生（多弹窗不得共用 useFormDialog）
    const dialogBody = hasForm ? form : query
    const usedNames = new Set<string>()
    const dialogSections: string[] = []

    for (const d of dialogEntries) {
      const canned = typeof d === 'string'
      const key = String(canned ? d : d.key)
      const title = canned ? titleFor(key) : d.title !== undefined ? String(d.title) : titleFor(key)
      const fields = canned ? dialogBody : d.formItems !== undefined ? d.formItems : dialogBody

      const options: Record<string, unknown> = {}
      if (!canned && d.width !== undefined) options.width = d.width
      if (!canned && d.fullscreen !== undefined) options.fullscreen = d.fullscreen

      const composableName = composableNameFor(key, usedNames, allWarnings)

      if (fields.length === 0) {
        allWarnings.push(
          `surfaces.dialog['${key}'] 没有任何可发射的字段（未给该弹窗的 formItems，也没有 form / query 面）—— ` +
            `产物里的 formItems 为空，弹窗打开后只会是一个空壳；请补 form 面或该弹窗的 formItems。`,
        )
      }
      // 提交方法 / 只读语义按**标题字面量**判别（生成器既有契约：'新增'→POST，其余 PUT；
      // '查看'→只出关闭按钮）。自定义标题会让这两条启发式失准 —— 显式告警，不静默。
      if (intent.apiUrl && key === 'add' && title !== DIALOG_TITLES.add) {
        allWarnings.push(
          `surfaces.dialog['add'].title='${title}'：composable 按标题判别提交方法（'新增'→POST，其余→PUT），` +
            `该弹窗将以 PUT 提交。不想要这个语义就省略 title，或在 open() 时显式传 '新增'。`,
        )
      }
      if (key === 'view' && title !== DIALOG_TITLES.view) {
        allWarnings.push(
          `surfaces.dialog['view'].title='${title}'：只读形态按标题 '查看' 判别（只出「关闭」按钮），` +
            `该弹窗会按可编辑形态发射。不想要这个语义就省略 title，或在 open() 时显式传 '查看'。`,
        )
      }

      const r = generateDialogBlock({
        fields,
        apiUrl: intent.apiUrl,
        rowkey: intent.rowkey,
        target: intent.target,
        typescript: intent.typescript,
        i18n: intent.i18n,
        composableName,
        defaultTitle: title,
        ...(Object.keys(options).length > 0 ? { options: options as any } : {}),
      })
      allWarnings.push(...r.warnings)
      // 围栏由产物自己声明（AI-28：dialog 有 composable(.tsx) / component(.vue) 两种形态）。
      dialogSections.push(
        [
          `## Dialog composable (${composableName})`,
          '',
          r.summary,
          '',
          '```' + (r.fence ?? 'tsx'),
          r.code,
          '```',
        ].join('\n'),
      )
      const dialogLang: ArtifactFile['language'] =
        (r.fence ?? 'tsx') === 'vue' ? 'vue' : intent.typescript === false ? 'jsx' : 'tsx'
      files.push({ path: `${composableName}.${dialogLang}`, code: r.code, language: dialogLang })
    }

    // AI-28：这条支恒发 composable（弹窗体是 JSX render ⇒ 需 JSX 插件）。另一种形态
    // 不在前门的形状里（前门的 dialog 是 `surfaces.dialog`，不是 generate_dialog 的参），
    // 故此处**显式指路**而不是让它成为静默的能力缺口。只挂一次（多弹窗时挂在末段）。
    dialogSections[dialogSections.length - 1] +=
      "\n\n> 需要**不依赖 JSX 插件**的自包含 `<es-dialog>` SFC？调用 `generate_dialog` 并传 `mode: 'component'` —— 同一 `open(title, row?, onSuccess?)` 契约。"
    sections.push(...dialogSections)
  } else if (hasForm) {
    // form without a dialog → a standalone submit form
    const r = generateFormBlock({
      fields: form,
      context: 'form',
      buttons: 'submit',
      target: intent.target,
      typescript: intent.typescript,
      i18n: intent.i18n,
      // 顶层 formLayout 的原生消费面就是表单：查询分支早已转发（见上），
      // 纯表单分支此前漏了 —— 工具描述承诺旋钮「forwarded verbatim」，
      // 实际 labelWidth / minFoldRows 在无表、无弹窗的请求里静默消失。
      ...(intent.formLayout ? { formLayout: intent.formLayout } : {}),
    })
    allWarnings.push(...r.warnings)
    sections.push(['## Form (FormBlock.vue)', '', r.summary, '', '```vue', r.code, '```'].join('\n'))
    files.push({ path: 'FormBlock.vue', code: r.code, language: 'vue' })
  }

  // 多弹窗时同一条提示（如 JSX 插件前提）会按弹窗重复 —— 去重保持告警可读。
  const uniqueWarnings = Array.from(new Set(allWarnings))
  const header: string[] = [
    `Generated ${sections.length} standalone fragment(s) (no table surface — not routed through the CRUD generator).`,
  ]
  if (uniqueWarnings.length > 0) {
    header.push('', '⚠️ Warnings:')
    for (const w of uniqueWarnings) header.push(`  - ${w}`)
  }
  // AN-15：无表片段同样**不**自成一体 —— 查询表单的远程下拉、弹窗 composable 的
  // 提交都要经全局 httpRequest；labelKey 要 t()；permissionValue 缺 permission()
  // 时失败方向是放行。此前这条支完全不输出前置清单，宿主只拿到代码，那些前提
  // 只能靠猜。判据与整页共用 `buildPreflight`，不另写一份启发式。
  const fragmentCarriers: any[] = [
    ...query,
    ...form,
    ...dialogEntries.flatMap((d: any) =>
      d && typeof d === 'object' && Array.isArray(d.formItems) ? d.formItems : [],
    ),
  ]
  const hasRemoteOptions = fragmentCarriers.some((f) => f && typeof f === 'object' && f.apiParams)
  const dialogSubmits = hasDialog && !!intent.apiUrl
  const fragmentPreflight = buildPreflight(
    {
      target: intent.target,
      mode: 'sfc',
      i18n: intent.i18n,
      fields: fragmentCarriers,
      usesRemoteData: hasRemoteOptions || dialogSubmits,
      // 默认文案讲的是「表取 apiUrl」，片段里没有表 —— 自报一句对得上产物的原因。
      remoteReason: [
        hasRemoteOptions
          ? 'Remote option sources (apiParams.url) are fetched through the global httpRequest; unconfigured, those controls throw an explicit "全局 httpRequest 未配置" error.'
          : '',
        dialogSubmits
          ? `The dialog composable submits to "${String(intent.apiUrl)}" through the global httpRequest (onSuccess only fires after a successful call); unconfigured, submitting throws an explicit "全局 httpRequest 未配置" error.`
          : '',
      ]
        .filter(Boolean)
        .join(' '),
      // 前门无表支的弹窗体是 JSX render（src/tools/generate-dialog 的 composable 形态）。
      jsxRender: hasDialog,
    },
    { target: intent.target, mode: 'sfc' },
  )
  header.push('', formatPreflight(fragmentPreflight))
  header.push('', '---', '')
  // 无表支是**片段包**（查询表单 / 提交表单 / 每个弹窗各一份文件），不同于整页
  // `crud-page`。信封的 `artifact` 取主产物：有弹窗取 dialog-composable，否则取 form
  // （查询表单与提交表单都是 form 族片段）；全部文件在 `files[]` 里逐条列出。
  const bundleArtifact: ArtifactKind = hasDialog ? 'dialog-composable' : 'form'
  return {
    text: header.join('\n') + '\n' + sections.join('\n\n---\n\n'),
    envelope: buildArtifactEnvelope({
      scene: 'crud',
      artifact: bundleArtifact,
      target: intent.target ?? DEFAULT_TARGET,
      mode: 'sfc',
      files,
      config: intent,
      warnings: uniqueWarnings,
    }),
  }
}

function sceneErrorNoun(scene: SceneId): string {
  return scene === 'crud' ? 'CRUD' : scene
}

/**
 * 场景计划 → 产物文本 + 信封（P5）。
 *
 * 文本由 `emitScene` 同一条路径产生：本函数只**附加** `envelope`，不改任何字节。
 * `check-artifact-envelope` 对全部语料断言两者 `text` 相等；`check:scene-parity`
 * 继续守 `generate_scene` 与旧工具的字节等价。
 */
export function emitSceneArtifact(plan: ScenePlan): SceneArtifactResult {
  try {
    switch (plan.scene) {
      case 'crud':
        return emitCrudScene(plan.intent)
      case 'table': {
        const r = generateTableBlock(plan.intent)
        return {
          text: formatFragmentText(r, 'vue'),
          envelope: buildArtifactEnvelope({
            scene: 'table',
            artifact: 'table',
            target: plan.intent.target ?? DEFAULT_TARGET,
            mode: null,
            files: [{ path: 'TableBlock.vue', code: r.code, language: 'vue' }],
            config: plan.intent,
            warnings: r.warnings,
          }),
        }
      }
      case 'form': {
        const r = generateFormBlock(plan.intent)
        return {
          text: formatFragmentText(r, 'vue'),
          envelope: buildArtifactEnvelope({
            scene: 'form',
            artifact: 'form',
            target: plan.intent.target ?? DEFAULT_TARGET,
            mode: null,
            files: [{ path: 'FormBlock.vue', code: r.code, language: 'vue' }],
            config: plan.intent,
            warnings: r.warnings,
          }),
        }
      }
      case 'dialog': {
        const r = generateDialogBlock(plan.intent)
        const component = plan.intent.mode === 'component'
        const language: ArtifactFile['language'] = component
          ? 'vue'
          : plan.intent.typescript === false
            ? 'jsx'
            : 'tsx'
        const name = plan.intent.composableName || 'useFormDialog'
        return {
          text: formatFragmentText(r, 'tsx'),
          envelope: buildArtifactEnvelope({
            scene: 'dialog',
            artifact: component ? 'dialog-component' : 'dialog-composable',
            target: plan.intent.target ?? DEFAULT_TARGET,
            mode: plan.intent.mode ?? 'composable',
            files: [{ path: `${name}.${language}`, code: r.code, language }],
            config: plan.intent,
            warnings: r.warnings,
          }),
        }
      }
    }
  } catch (error: any) {
    return { text: `Error generating ${sceneErrorNoun(plan.scene)}: ${error.message}`, isError: true }
  }
}

/**
 * 场景计划 → 产物文本。唯一的开关：四个场景各落到既有发射器。
 *
 * 异常统一收敛成 `isError` 正文（与旧工具逐字节一致：`Error generating <noun>: …`），
 * 调用方不需要各自再包一层 try/catch。
 */
export function emitScene(plan: ScenePlan): SceneEmitResult {
  const { text, isError } = emitSceneArtifact(plan)
  return isError ? { text, isError } : { text }
}
