/**
 * AN-15 — 生成物前置清单（preflight）。
 *
 * ## 为什么需要它
 *
 * es-plus 有一类失败**编译期完全看不见**：产物语法合法、类型也对，但宿主入口少配了一项，
 * 对应能力就静默失效 ——
 *
 *   - 没 `app.use(ESPlus, …)`：模板里的 `<es-table>` / `<es-form>` / `<es-crud-page>` 解析不到；
 *   - 没全局 `httpRequest`：表一挂载就抛「全局 httpRequest 未配置」，页面空白；
 *   - 没 `permission`：`permissionValue` 的**失败方向是放行**（core 默认 allow-all）——
 *     权限门看起来「配了」，实际谁都能看见；
 *   - 没 `t`：`labelKey` 回落到 `label`（不崩，但翻译不生效）；
 *   - 没 JSX 转换：`mode=sfc` 的弹窗 render 是 `<script setup lang="tsx">`，构建直接失败；
 *   - 没 UI 库：`el-*` / `a-*` 解析成未知元素，表格/表单空白。
 *
 * 这些前提**不在生成物里**，而在应用入口与构建配置里。所以生成器把它们作为一份可执行的
 * 清单随产物输出，而不是让宿主 LLM 去记住一段散文。`scaffold_page` 用的是**同一个**
 * `buildPreflight` —— 两处清单一分叉，其中一处就会开始说谎。
 *
 * ## 不是「一律要求」
 *
 * 每一项都按**本配置**判定 required：没有 `permissionValue` 就不需要 `permission`（默认放行
 * 正是想要的语义），没有 `labelKey` 就不需要 `t`。`formatPreflight` 会把不需要的项也列出来，
 * 并写明「不需要」的依据 —— 否则读者无法区分「忘了配」与「本来就不用配」。
 */
import { generateAppEntry } from './code-generator.js'
import { DEFAULT_TARGET, getEsPlusPackageName, type TargetFramework } from './target.js'

export type PreflightId =
  | 'ui-library'
  | 'es-plus-plugin'
  | 'http-request'
  | 'permission'
  | 'i18n'
  | 'jsx'

/** 配置里会**触发某项前置能力**的载体（字段/列/按钮/弹窗表单项）。 */
export interface PreflightCarrier {
  permissionValue?: string
  labelKey?: string
  /** 载体是完整 FieldConfig/ColumnConfig 的子集，允许其余键原样通过（本模块只读上面两个）。 */
  [key: string]: unknown
}

/**
 * `buildPreflight` 的输入 —— 是 `StructuredCrudConfig` 的结构子集，刻意不 import 那个类型：
 * 否则 `structured-generator → preflight → structured-generator` 成环。`scaffold_page`
 * 也复用本输入（它没有完整 config，只有 target/features）。
 */
export interface PreflightInput {
  target?: TargetFramework
  mode?: 'schema' | 'sfc'
  actions?: readonly string[]
  i18n?: boolean
  permissions?: Record<string, string>
  fields?: readonly PreflightCarrier[]
  columns?: readonly PreflightCarrier[]
  dialogs?: Record<string, { formItems?: readonly PreflightCarrier[] }>
  toolbarBtns?: readonly PreflightCarrier[]
  tableBtns?: readonly PreflightCarrier[]
  operationColumn?: false | { btns?: readonly PreflightCarrier[] }
  expandConfig?: { fields?: readonly PreflightCarrier[] }
  /**
   * 产物是否会经**全局** `httpRequest` 取远端数据。
   * CRUD 产物恒带 `apiParams.url`，故默认 `true`；`generateScaffold` 只有含 table 时才为 true。
   */
  usesRemoteData?: boolean
  /**
   * 产物里是否真的有 JSX 语法。默认按生成器的实际判据推导
   * （`mode=sfc` ∧ 有 add/edit/view 动作 ⟹ 弹窗 render 走 JSX）。
   * `generateScaffold` 的 dialog 只是 `useDialog()`，没有 JSX，故显式传 false。
   */
  jsxRender?: boolean
}

export interface PreflightItem {
  id: PreflightId
  title: string
  required: boolean
  /** 本配置为什么需要它；不需要时写明降级/默认语义。 */
  reason: string
  /** 宿主该做的一件事（一行命令 / 一行入口配置）。 */
  action: string
}

export interface PreflightReport {
  target: TargetFramework
  mode: 'schema' | 'sfc'
  entryFile: string
  /** 可直接粘贴的入口样板（与 `generateAppEntry` 同源）。 */
  entry: string
  items: PreflightItem[]
}

const DIALOG_ACTIONS = ['add', 'edit', 'view']

function actionsOf(input: PreflightInput): readonly string[] {
  return input.actions ?? []
}

function carriersOf(input: PreflightInput): PreflightCarrier[] {
  const out: PreflightCarrier[] = []
  const push = (list: readonly PreflightCarrier[] | undefined) => {
    if (!Array.isArray(list)) return
    for (const x of list) if (x && typeof x === 'object') out.push(x)
  }
  push(input.fields)
  push(input.columns)
  for (const d of Object.values(input.dialogs ?? {})) push(d?.formItems)
  push(input.toolbarBtns)
  push(input.tableBtns)
  if (input.operationColumn) push(input.operationColumn.btns)
  push(input.expandConfig?.fields)
  return out
}

function uiLibrary(target: TargetFramework): {
  title: string
  install: string
  register: string
  importLine: string
} {
  if (target === 'vue2') {
    return {
      title: 'UI library — Element UI (element-ui)',
      install: 'npm i element-ui',
      register: 'Vue.use(ElementUI)',
      importLine: "import ElementUI from 'element-ui' + import 'element-ui/lib/theme-chalk/index.css'",
    }
  }
  if (target === 'antdv') {
    return {
      title: 'UI library — Ant Design Vue (ant-design-vue)',
      install: 'npm i ant-design-vue',
      register: 'app.use(Antd)',
      importLine: "import Antd from 'ant-design-vue' + import 'ant-design-vue/dist/reset.css'",
    }
  }
  return {
    title: 'UI library — Element Plus (element-plus)',
    install: 'npm i element-plus',
    register: 'app.use(ElementPlus)',
    importLine: "import ElementPlus from 'element-plus' + import 'element-plus/dist/index.css'",
  }
}

/**
 * 按本配置生成前置清单。`opts` 可覆盖 input 里的 target/mode（生成器两种入口传参方式不同，
 * 调用方不必把 target 塞进配置对象）。
 */
export function buildPreflight(
  input: PreflightInput,
  opts: { target?: TargetFramework; mode?: 'schema' | 'sfc' } = {},
): PreflightReport {
  const target = opts.target ?? input.target ?? DEFAULT_TARGET
  const mode = opts.mode ?? input.mode ?? 'schema'
  const esPlusPkg = getEsPlusPackageName(target)
  const carriers = carriersOf(input)
  const permissionGates = carriers.filter((c) => typeof c.permissionValue === 'string' && c.permissionValue).length
  const actionPermissions = input.permissions ? Object.keys(input.permissions).length : 0
  const gateCount = permissionGates + actionPermissions
  const labelKeys = carriers.filter((c) => typeof c.labelKey === 'string' && c.labelKey).length
  const needsI18n = input.i18n === true || labelKeys > 0
  const needsPermission = gateCount > 0
  const usesRemoteData = input.usesRemoteData !== false
  const hasDialogActions = actionsOf(input).some((a) => DIALOG_ACTIONS.includes(a))
  const needsJsx = input.jsxRender ?? (mode === 'sfc' && hasDialogActions)
  const entryFile = target === 'vue2' ? 'src/main.js' : 'src/main.ts'
  const plugin = target === 'vue2' ? 'Vue.use(ESPlus, { … })' : 'app.use(ESPlus, { … })'
  const ui = uiLibrary(target)

  const items: PreflightItem[] = [
    {
      id: 'ui-library',
      title: ui.title,
      required: true,
      reason:
        'es-plus renders `el-*` / `a-*` elements; without the UI library installed and registered they resolve to unknown elements — tables and forms render blank, with no compile error.',
      action: `${ui.install}; ${ui.importLine}; ${ui.register} (entry below).`,
    },
    {
      id: 'es-plus-plugin',
      title: 'es-plus plugin registration',
      required: true,
      reason:
        `Registers <es-table> / <es-form> / <es-crud-page> and writes the global config singleton (httpRequest / permission / t). ` +
        `Without ${plugin} the generated template's components are unresolved.`,
      action: `${plugin} — import ESPlus from '${esPlusPkg}' (entry below).`,
    },
    {
      id: 'http-request',
      title: 'Global httpRequest',
      required: usesRemoteData,
      reason: usesRemoteData
        ? mode === 'schema'
          ? `The wrapper SFC calls the free function httpRequest() on mount and after delete/add/edit; this config's table fetches "apiUrl" through it. Unconfigured, it throws an explicit "全局 httpRequest 未配置" error — the page stays empty.`
          : `The table's apiParams.url is fetched through the global httpRequest; unconfigured, the table throws an explicit "全局 httpRequest 未配置" error on mount.`
        : 'This artifact declares no apiParams / remote fetch, so httpRequest is never called.',
      action: "httpRequest: (params) => axios(params) — inside the plugin options (entry below).",
    },
    {
      id: 'permission',
      title: 'Global permission()',
      required: needsPermission,
      reason: needsPermission
        ? `${gateCount} permission gate(s) are declared (${permissionGates} permissionValue + ${actionPermissions} action permission code(s)). ` +
          `Without permission() the runtime FAILS OPEN: core treats a missing permission function as allow-all, so every gated field/column/button is visible to everyone — the gate looks configured but is inert.`
        : 'No permissionValue / permissions in this config — the runtime default (allow-all) is exactly the intended semantics.',
      action: 'permission: (code) => userStore.permissions.includes(code) — inside the plugin options (entry below).',
    },
    {
      id: 'i18n',
      title: 'Global t() (i18n)',
      required: needsI18n,
      reason: needsI18n
        ? `${labelKeys} labelKey(s)${input.i18n === true ? ' (config.i18n=true derives labelKey from each prop)' : ''} are emitted. ` +
          `Without t() the runtime falls back to label — visible but untranslated (no crash).`
        : 'No labelKey / i18n in this config — labels come from `label`; t() is only consulted for labelKey.',
      action: 't: (key) => i18n.global.t(key) — inside the plugin options (entry below).',
    },
    {
      id: 'jsx',
      title: 'JSX transform (dialog render)',
      required: needsJsx,
      reason: needsJsx
        ? `mode=sfc with add/edit/view actions emits the dialog body as a JSX render, so the SFC is <script setup lang="tsx"> (lang="jsx" when typescript=false). ` +
          `Without a JSX transform the build fails on the first <EsForm …/>.`
        : mode === 'schema'
          ? 'mode=schema wraps a JSON schema in a template-only SFC and dialogs are rendered at runtime by <es-crud-page> — no JSX syntax is emitted.'
          : 'mode=sfc without add/edit/view actions emits no dialog render, so the SFC contains no JSX syntax.',
      action:
        target === 'vue2'
          ? 'npm i -D @vue/babel-preset-jsx (vue2 JSX preset).'
          : 'npm i -D @vitejs/plugin-vue-jsx; plugins: [vue(), vueJsx()] in vite.config.',
    },
  ]

  return { target, mode, entryFile, entry: generateAppEntry(target), items }
}

/**
 * `generateScaffold` 的前置清单 —— 与生成物**共用** `buildPreflight`，只是把 features
 * 翻译成同样的输入事实：table ⇒ 有 apiParams；dialog ⇒ useDialog（无 JSX render）。
 */
export function buildScaffoldPreflight(opts: {
  target: TargetFramework
  features?: readonly string[]
}): PreflightReport {
  const features = opts.features ?? ['query', 'table']
  const hasTable = features.includes('table')
  const hasDialog = features.includes('dialog')
  return buildPreflight(
    {
      target: opts.target,
      mode: 'sfc',
      actions: hasDialog ? ['add', 'edit'] : [],
      usesRemoteData: hasTable,
      jsxRender: false,
    },
    { target: opts.target, mode: 'sfc' },
  )
}

/** 渲染成随产物输出的一段 markdown。主机入口样板只在这一处出现。 */
export function formatPreflight(report: PreflightReport): string {
  const lines: string[] = [
    '## Preflight — host prerequisites (not generated code)',
    '',
    'These live in the host app entry / build config. A missing item does **not** break compilation;',
    'the matching capability silently turns inert (permission even fails *open*). Check every line marked required.',
    '',
  ]
  for (const item of report.items) {
    lines.push(`- ${item.required ? '**[required]**' : '[not needed]'} **${item.title}**`)
    lines.push(`  - Why: ${item.reason}`)
    if (item.required) lines.push(`  - Do: ${item.action}`)
  }
  lines.push('')
  lines.push(`### App entry — ${report.entryFile} (copy once)`)
  lines.push('')
  lines.push('```ts')
  lines.push(report.entry)
  lines.push('```')
  return lines.join('\n')
}
