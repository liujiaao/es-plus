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
  dialogs?: Record<string, { formItems?: readonly PreflightCarrier[]; configBtn?: readonly PreflightCarrier[] }>
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
   * `http-request` 一项在 usesRemoteData=true 时的原因文案覆盖。
   *
   * 默认文案按 **CRUD 整页**（schema/sfc）解释「表会取 apiUrl」；前门的**无表**片段
   * （查询表单的远程下拉、弹窗 composable 的提交）是另一种产物，套用整页说法会指错
   * 对象。这类调用方自报一句更准确的原因，避免清单说一句与会看到的东西对不上的话。
   */
  remoteReason?: string
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
  /**
   * 表格列是**递归**结构（`groups` 多级表头）：每一层列自身可带 `permissionValue`，
   * 且 `btns`（行内操作按钮）同样按权限码过滤。只扫顶层会把「分组子列按权限隐藏」
   * 与「列内按钮按权限隐藏」这两类门漏掉 —— preflight 于是宣称「本配置没有权限门」，
   * 而产物里明明有 permissionValue，缺 `permission()` 时**失败方向是放行**。
   */
  const pushColumns = (list: readonly PreflightCarrier[] | undefined) => {
    if (!Array.isArray(list)) return
    for (const col of list) {
      if (!col || typeof col !== 'object') continue
      out.push(col)
      push((col as { btns?: readonly PreflightCarrier[] }).btns)
      pushColumns((col as { groups?: readonly PreflightCarrier[] }).groups)
    }
  }
  push(input.fields)
  pushColumns(input.columns)
  for (const d of Object.values(input.dialogs ?? {})) {
    push(d?.formItems)
    // 弹窗底部按钮（AI-27 configBtn）是独立于表单字段的权限载体：只收 formItems
    // 会漏掉「确定按钮按权限显示」这类门。
    push(d?.configBtn)
  }
  push(input.toolbarBtns)
  push(input.tableBtns)
  if (input.operationColumn) push(input.operationColumn.btns)
  push(input.expandConfig?.fields)
  return out
}

/**
 * 校验「送进 preflight 的那份配置」的**形状**。
 *
 * 为什么需要：`buildPreflight` 靠载体（字段/列/按钮）上的 `permissionValue` / `labelKey`
 * 判定「本页面是否需要 `permission()` / `t()`」。形状错的时候（`fields: "a,b"`、
 * `formFields: […]`、按钮写成字符串）载体被静默跳过，于是清单说「不需要权限」——
 * 而 `permission` 缺失时**失败方向是放行**（core 默认 allow-all）。也就是说，
 * 一份畸形配置换来的不是报错，而是「全 ok」的假绿。
 *
 * 这里刻意只校验 `PreflightInput` 真正读到的键，且**放行未知键**：调用方交给
 * `doctor_page` 的往往是整份 `StructuredCrudConfig`（`name`/`apiUrl`/`tableOptions`…），
 * 那部分不归本函数判定（完整配置由 `validateAndRepair` 负责）。两者职责不重叠：
 * 本函数只回答「这份对象能不能被当作 preflight 的输入来读」。
 *
 * 返回空数组 = 可以读。返回的 `path` 用 `/` 开头，与 zod 的 issue 路径同形。
 */
export interface PreflightShapeIssue {
  path: string
  message: string
}

export function checkPreflightShape(input: unknown): PreflightShapeIssue[] {
  const issues: PreflightShapeIssue[] = []
  const isPlainObject = (v: unknown): v is Record<string, unknown> =>
    !!v && typeof v === 'object' && !Array.isArray(v)
  const path = (base: string, key: string | number): string =>
    `${base}/${typeof key === 'number' ? key : key.replace(/~/g, '~0').replace(/\//g, '~1')}`

  if (!isPlainObject(input)) {
    return [{ path: '/', message: 'config 必须是对象（{ … }），否则无法判定有哪些权限/翻译门' }]
  }

  /** 载体数组：必须是对象数组（字符串会被 `carriersOf` 静默跳过 ⟹ 假绿）。 */
  const checkCarrierList = (value: unknown, base: string, label: string) => {
    if (value === undefined) return
    if (!Array.isArray(value)) {
      issues.push({ path: base, message: `${label} 必须是数组` })
      return
    }
    value.forEach((item, i) => {
      if (!isPlainObject(item)) {
        issues.push({
          path: path(base, i),
          message: `${label} 的每一项必须是对象（含 prop / label / permissionValue 等键），当前是 ${describeType(item)}`,
        })
      }
    })
  }

  const checkColumns = (value: unknown, base: string) => {
    if (value === undefined) return
    if (!Array.isArray(value)) {
      issues.push({ path: base, message: 'columns 必须是数组' })
      return
    }
    value.forEach((col, i) => {
      const colPath = path(base, i)
      if (!isPlainObject(col)) {
        issues.push({ path: colPath, message: `columns 的每一项必须是对象，当前是 ${describeType(col)}` })
        return
      }
      checkCarrierList(col.btns, `${colPath}/btns`, 'columns[].btns')
      checkColumns(col.groups, `${colPath}/groups`)
    })
  }

  checkCarrierList(input.fields, '/fields', 'fields')
  checkColumns(input.columns, '/columns')
  checkCarrierList(input.toolbarBtns, '/toolbarBtns', 'toolbarBtns')
  checkCarrierList(input.tableBtns, '/tableBtns', 'tableBtns')

  if (input.operationColumn !== undefined && input.operationColumn !== false) {
    if (!isPlainObject(input.operationColumn)) {
      issues.push({
        path: '/operationColumn',
        message: `operationColumn 必须是对象或 false，当前是 ${describeType(input.operationColumn)}`,
      })
    } else {
      checkCarrierList(input.operationColumn.btns, '/operationColumn/btns', 'operationColumn.btns')
    }
  }

  if (input.expandConfig !== undefined) {
    if (!isPlainObject(input.expandConfig)) {
      issues.push({
        path: '/expandConfig',
        message: `expandConfig 必须是对象，当前是 ${describeType(input.expandConfig)}`,
      })
    } else {
      checkCarrierList(input.expandConfig.fields, '/expandConfig/fields', 'expandConfig.fields')
    }
  }

  if (input.dialogs !== undefined) {
    if (!isPlainObject(input.dialogs)) {
      issues.push({
        path: '/dialogs',
        message: `dialogs 必须是以弹窗 id 为键的对象，当前是 ${describeType(input.dialogs)}`,
      })
    } else {
      for (const [id, dialog] of Object.entries(input.dialogs)) {
        // `dialogs.add: null` 是前门可修复的输入形态（repairConfig 会补成 `{}`），
        // doctor 拿到未修复的配置时不该因此判红。
        if (dialog === null || dialog === undefined) continue
        const dialogPath = path('/dialogs', id)
        if (!isPlainObject(dialog)) {
          issues.push({
            path: dialogPath,
            message: `dialogs.${id} 必须是对象或 null，当前是 ${describeType(dialog)}`,
          })
          continue
        }
        checkCarrierList(dialog.formItems, `${dialogPath}/formItems`, `dialogs.${id}.formItems`)
        checkCarrierList(dialog.configBtn, `${dialogPath}/configBtn`, `dialogs.${id}.configBtn`)
      }
    }
  }

  if (input.actions !== undefined) {
    if (!Array.isArray(input.actions) || input.actions.some((a) => typeof a !== 'string')) {
      issues.push({ path: '/actions', message: 'actions 必须是字符串数组（如 ["add","edit","query"]）' })
    }
  }
  if (input.permissions !== undefined && !isPlainObject(input.permissions)) {
    issues.push({
      path: '/permissions',
      message: `permissions 必须是「动作 → 权限码」的对象，当前是 ${describeType(input.permissions)}`,
    })
  }
  if (input.mode !== undefined && input.mode !== 'schema' && input.mode !== 'sfc') {
    issues.push({ path: '/mode', message: `mode 只能是 "schema" 或 "sfc"，当前是 ${JSON.stringify(input.mode)}` })
  }
  if (input.target !== undefined && !['vue3', 'vue2', 'antdv'].includes(input.target as string)) {
    issues.push({
      path: '/target',
      message: `target 只能是 "vue3" / "vue2" / "antdv"，当前是 ${JSON.stringify(input.target)}`,
    })
  }

  return issues
}

function describeType(v: unknown): string {
  if (v === null) return 'null'
  if (Array.isArray(v)) return 'array'
  return typeof v
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
        ? (input.remoteReason ?? (mode === 'schema'
          ? `The wrapper SFC calls the free function httpRequest() on mount and after delete/add/edit; this config's table fetches "apiUrl" through it. Unconfigured, it throws an explicit "全局 httpRequest 未配置" error — the page stays empty.`
          : `The table's apiParams.url is fetched through the global httpRequest; unconfigured, the table throws an explicit "全局 httpRequest 未配置" error on mount.`))
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
