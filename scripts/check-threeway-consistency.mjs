#!/usr/bin/env node
/**
 * 三向一致性扫描（AI-34）
 *
 * ## 为什么是**行为**扫描而不是又一份源码正则
 *
 * 「AI 契约（Zod）→ 生成器发射 → 三端消费」这条链上，相邻两段已各有守卫
 * （`check-schema-contract` 的两份 Zod 全等 / `check-contract-consumption` 的逐端消费），
 * 缺的是**端到端那一跳**：给生成器一份「把每个 AI 键都设上」的配置，**真跑一遍**
 * `generateFromConfig`，然后**精确读出产物里到底有哪些键**。
 *
 * 为什么不用正则扫 `structured-generator.ts`：发射是命令式 + 条件式的 ——
 * `...(tOpts.height ? { height: … } : {})`、`if (tOpts.x) lines.push(\`  x: …\`)` ——
 * 正则要么漏（`lines.push` 里的字符串字面量不是对象键）要么过匹配（把 `background`/`url`
 * 也算成键）。实测：用正则扫源码得到「schema 模式 6 键 / SFC 模式 0 键」，而真跑生成器是
 * 29 键 / 24 键 —— 正则版的守卫会**恒绿且一无所知**，比没有守卫更糟。
 *
 * 产物侧则是**精确**的：schema 模式产物是 JSON（`JSON.parse` 取 `pageSchema.tableOptions`
 * 等对象的键，零假阳），SFC 模式产物是受控手搓块（`const options = {…}` 恒缩进 2 格，
 * `const formItems = […]` 本身是 `inlineJson` 产物，可直接 `JSON.parse`）。
 *
 * ## 四类漏算与判据
 *
 * | axis | 判据 | 归属 |
 * |---|---|---|
 * | ① 声明未发射 | `AI 键 ∉ (schema 产物 ∪ sfc 产物)` | 见 `DECLARED_NOT_EMITTED` |
 * | ② 发射未消费 | `产物键 ∉ core 契约类型` | 见 `EMITTED_NOT_CONSUMED` |
 * | ③ 消费未声明 | `键 ∈ 消费者源码` ∧ `键 ∉ AI 键集`（且**反向陈旧**：进了 AI 键集必须删行） | 见 `CONSUMED_NOT_DECLARED` |
 * | ④ 未建模 | 无机械判据，须显式登记 | 见 `UNMODELED` |
 *
 * ## 技术路线（复用 `check-front-door.mjs` 已验证的打包手法）
 *
 * esbuild 把 `@es-plus/shared` alias 到 `src/index.ts` 打到仓库内 `node_modules/` 下的
 * 临时入口（放系统临时目录会在 `import 'esbuild'` 处炸），再用 `metafile` **自证**本次
 * 拉的是 `shared/src`、`shared/build` 零命中 —— 陈旧构建会让守卫静默失明。
 *
 * 用法：`node scripts/check-threeway-consistency.mjs`（另有 `--report` 打印逐键产物）
 * 退出码：0 = 四类判据全过；1 = 任一条红。
 */
import { mkdtempSync, writeFileSync, rmSync, readdirSync, readFileSync } from 'node:fs'
import { join, dirname } from 'node:path'
import { fileURLToPath, pathToFileURL } from 'node:url'
import { build } from 'esbuild'
import {
  readReachability,
  readDialogContract,
  read,
  stripComments,
  GENERATOR_SRC,
  CRUD_DIALOG_PASSTHROUGH_SRC,
} from './lib/entry-keys.mjs'
import { isCrudCase } from './eval/scenes.mjs'
import {
  THREE_WAY_AXES,
  DECLARED_NOT_EMITTED,
  EMITTED_NOT_CONSUMED,
  CONSUMED_NOT_DECLARED,
  UNMODELED,
  SFC_DEGRADATIONS,
} from './lib/threeway-registry.mjs'

const ROOT = join(dirname(fileURLToPath(import.meta.url)), '..')
const REPORT = process.argv.includes('--report')

let failed = false
const fail = (msg) => {
  failed = true
  console.error(`❌ ${msg}`)
}
const ok = (msg) => console.log(`✅ ${msg}`)

// ── core 契约类型（类别②的「可消费上界」）─────────────────────────
// 三端把 `options` 展开到引擎 props、把 formItem 交给组件：键只要在 core 契约类型里就
// 有消费通道，不在则无端可接。故「产物键 ⊆ core 契约键」是「发射 ⊆ 可消费」的精确代理。
const CORE_TYPES = 'packages/core/src/types.ts'
const CRUD_PAGE_TYPES = {
  vue3: 'packages/vue3/src/components/es-crud-page/src/types.ts',
  vue2: 'packages/vue2/src/components/es-crud-page/types.ts',
  antdv: 'packages/adapter-antdv/src/components/es-crud-page/src/types.ts',
}
const CORE_CONTRACTS = [
  { name: 'TableOptions', file: CORE_TYPES },
  { name: 'FormItemOption', file: CORE_TYPES },
  { name: 'TableColumn', file: CORE_TYPES },
]

/**
 * 端内联子类型（`interface X { prop?: { a?: …; b?: … } }`）也是真消费面。
 *
 * 为什么单独列：`formLayout` 的形状住在三端 `CrudPageSchema` 的**匿名内联对象类型**里
 * （`formLayout?: { labelWidth?: string | number; minFoldRows?: number }`），core 只有
 * 另一套嵌套写法 `LayoutFormProps.formLayProps`，两者都不是具名 interface，`interfaceBody`
 * 切不到。运行时真读它：vue3 `es-crud-page.vue:274-284` 把 `formLayout.labelWidth` 映到
 * `formLayProps.labelBtnWidth`、`minFoldRows` 原样下传 —— 结论是「有消费通道」，不是幽灵键。
 * 用 `files` 列出三端（任一端缺失即报错，防止某端单方面删掉该类型而无人知晓）。
 */
const CORE_INLINE_CONTRACTS = [
  { name: 'CrudPageSchema', prop: 'formLayout', files: Object.values(CRUD_PAGE_TYPES) },
]

/** 花括号配对截取 `export interface <name> { … }` 的 body（同 check-contract-consumption）。 */
function interfaceBody(src, name) {
  const start = src.indexOf(`export interface ${name}`)
  if (start < 0) return null
  const open = src.indexOf('{', start)
  if (open < 0) return null
  let depth = 0
  for (let i = open; i < src.length; i++) {
    const ch = src[i]
    if (ch === '{') depth++
    else if (ch === '}') {
      depth--
      if (depth === 0) return src.slice(open + 1, i)
    }
  }
  return null
}

/** 接口顶层字段名（同时跟踪圆括号深度，避免把多行函数类型的参数名当成字段）。 */
function interfaceFields(body) {
  const fields = new Set()
  let depth = 0
  let paren = 0
  for (const line of stripComments(body).split('\n')) {
    if (depth === 0 && paren === 0) {
      const m = line.match(/^\s*([A-Za-z_$][\w$]*)\??\s*:/)
      if (m) fields.add(m[1])
    }
    for (const ch of line) {
      if (ch === '{') depth++
      else if (ch === '}') depth--
      else if (ch === '(') paren++
      else if (ch === ')') paren--
    }
  }
  return fields
}

/**
 * 取接口里某个属性的**匿名内联对象类型**的键：
 * `interface X { formLayout?: { labelWidth?: …; minFoldRows?: … } }` → `{labelWidth, minFoldRows}`。
 * 找不到该属性或形状不是内联对象 → `null`（调用方报「选择器失效」，不静默放行）。
 */
function nestedObjectTypeKeys(body, prop) {
  const m = new RegExp(`(?:^|[{;,\\s])${prop}\\??\\s*:\\s*\\{`, 'm').exec(stripComments(body))
  if (!m) return null
  const open = m.index + m[0].length - 1
  const inner = balanced(stripComments(body), open, '{', '}')
  if (inner === null) return null
  // 内联对象类型多半写成**单行** `{ labelWidth?: …; minFoldRows?: … }`，而 `interfaceFields`
  // 是按行首匹配的 —— 只断行不改别的：把「花括号/圆括号/方括号深度 0」的 `;` 换成换行，
  // 深度内的 `;`（函数签名里的参数分隔）原样保留。
  let flat = ''
  let d = 0
  for (const ch of inner) {
    if (ch === '{' || ch === '(' || ch === '[') d++
    else if (ch === '}' || ch === ')' || ch === ']') d--
    flat += d === 0 && ch === ';' ? '\n' : ch
  }
  return interfaceFields(flat)
}

/** 从配对括号处切片（`[`/`{` 起始，返回 body 不含首尾括号）。 */
function balanced(src, from, open = '[', close = ']') {
  let depth = 0
  for (let i = from; i < src.length; i++) {
    const ch = src[i]
    if (ch === open) depth++
    else if (ch === close) {
      depth--
      if (depth === 0) return src.slice(from + 1, i)
    }
  }
  return null
}

/** 取 `const <name> = ` 之后的配对块（`[` 或 `{`）。 */
function constBlock(code, name) {
  const i = code.indexOf(`const ${name} = `)
  if (i === -1) return { found: false, open: null, body: null }
  const at = code.indexOf('=', i) + 1
  let j = at
  while (j < code.length && /\s/.test(code[j])) j++
  const ch = code[j]
  if (ch === '[') return { found: true, open: '[', body: balanced(code, j, '[', ']') }
  if (ch === '{') return { found: true, open: '{', body: balanced(code, j, '{', '}') }
  return { found: true, open: ch, body: null }
}

/**
 * 「把每个 AI 键都设上」的探针配置。
 *
 * 为什么一份配置就够：本扫描比的是**键的存在性**，不是值的语义。一份全键配置同时
 * 覆盖 26 个 tableOptions 键、24 个 FieldConfig 键、formLayout 的 2 个键与 dialog 的
 * 11 个键；它必须能过**真的** AI Zod（这本身就是第 0 条断言：AI 契约自洽）。
 *
 * 值取「各键的最通用合法值」，不与任何 AI 键同名词冲突；`inQuery/inTable/inForm` 全 true
 * 让字段同时进三面，从而**同一个字段**就能把「表单面键」与「表格面键」两条发射路径都点亮。
 */
const PROBE_FIELD = {
  prop: 'probe',
  label: 'PROBE',
  labelKey: 'probe.selfKey',
  formtype: 'Select',
  inQuery: true,
  inTable: true,
  inForm: true,
  querySpan: 12,
  formSpan: 12,
  required: true,
  rules: [{ message: 'probe rule', required: true }],
  attrs: { placeholder: 'probe-ph' },
  dataOptions: [{ label: 'A', value: 'a' }],
  apiParams: { url: '/api/probe-options', labelField: 'name', valueField: 'id' },
  width: 120,
  minWidth: 80,
  align: 'center',
  fixed: 'right',
  ellipsis: true,
  formatter: '(row) => String(row.probe)',
  render: '(_, { row }) => h(ElTag, () => row.probeLabel)',
  permissionValue: 'probe:read',
  isHidden: { field: 'probe', op: 'eq', value: 'a' },
  // reactions 是 AI-16 表达式 DSL（JSONLogic 形态）：`when`/`required`/`disabled`/`value`
  // 只收表达式节点（`{var}` 或单键算子对象），**刻意不收对象字面量** —— 探针里必须写成
  // 这种形状，否则探针自己就过不了 AI Zod（这不是「AI 契约不自洽」，是我写错了。）
  reactions: [
    {
      dependencies: ['probe'],
      when: { '==': [{ var: 'probe' }, 'a'] },
      fulfill: {
        dataOptions: [{ label: 'B', value: 'b' }],
        required: { var: 'probe' },
        disabled: { not: [{ var: 'probe' }] },
        value: { var: 'probe' },
      },
    },
  ],
}

const PROBE = {
  name: 'ThreeWayProbe',
  apiUrl: '/api/probe',
  fields: [PROBE_FIELD],
  actions: ['add', 'edit', 'delete', 'export'],
  permissions: { add: 'probe:add', edit: 'probe:edit', delete: 'probe:delete', export: 'probe:export' },
  i18n: true,
  typescript: true,
  formLayout: { labelWidth: '100px', minFoldRows: 2 },
  toolbarBtns: [{ name: '新建', position: 'left', dialogKey: 'add' }],
  tableBtns: [{ name: '批量', position: 'left', code: 1 }],
  operationColumn: { label: '操作', btns: [{ name: '编辑', dialogKey: 'edit' }] },
  dialogs: {
    add: {
      title: '新增',
      width: 600,
      formItems: [PROBE_FIELD],
      formLayout: { labelWidth: '90px' },
      isDraggable: true,
      maxHeight: 500,
      // 布尔键一律取**真值**：生成器的 dialog 发射点是 `if (dlg.X) dialogSchema.X = …`
      // 真值门，取 false 会让「已实现」与「未实现」在产物里长得一模一样（假阴性）。
      fullscreen: true,
      isHiddenFooter: true,
      // AI-27 的底座数据键。**这 5 个刻意取 false**：生成器对它们用的是
      // `if (dlg.X !== undefined)` 门（而非 AI-30 咬出的那种真值门），取 false 才能证明
      // 「false 也发射」—— 若哪天有人把它改回真值门，探针会当场红（`false` 从产物里消失）。
      // 这正是 AI-30 `height` 被门进 `if (tOpts.virtual)` 的教训：仅取真值的探针看不见门。
      showClose: false,
      destroyOnClose: false,
      modal: false,
      closeOnClickModal: false,
      closeOnPressEscape: false,
      // 这三键生成器用的是真值门（`if (dlg.X)`），故取真值。
      hiddenFullBtn: true,
      appendTo: '#probe-dialog-host',
      cacheKey: 'probe-dialog',
      configBtn: [{ name: '保存', type: 'primary', action: 'confirm' }],
      // `hasCustomRender` 刻意取 false：取 true 会让生成器走「自定义主体」分支（formItems
      // 不进 wrapper、另发 TODO 槽）。它对产物**有条件发射**（true 才发 `hasCustomRender: true`），
      // 故 false 时它不在产物里 —— 这一条正是 DECLARED_NOT_EMITTED 的登记对象。
      hasCustomRender: false,
    },
  },
  pagination: { pageSize: 20, pageSizes: [10, 20] },
  tableOptions: {
    border: true,
    stripe: true,
    rowkey: 'id',
    heightType: 'height',
    tabHeight: 400,
    height: 400,
    multiSelect: true,
    highlightCurrentRow: true,
    headerCellStyle: { background: '#ffffff' },
    virtual: true,
    engine: 'vxe',
    rowHeight: 40,
    estimatedRowHeight: 44,
    overscanCount: 3,
    rowClassName: 'probe-row',
    size: 'small',
    showHeader: true,
    emptyText: '空',
    snIndex: true,
    leftText: '左',
    cachePageSelection: true,
    refetchKeepPage: true,
    localPagination: true,
    defaultSort: { prop: 'probe', order: 'ascending' },
    editConfig: { trigger: 'click', mode: 'cell' },
    configTableOut: { total: 't', tableData: 'd', pageSize: 'p', current: 'c' },
  },
}

/** 打包并取回真生成器（alias 到 shared/src + metafile 自证，同 check-front-door.mjs）。 */
async function captureGenerator() {
  const tmp = mkdtempSync(join(ROOT, 'node_modules', 'es-threeway-'))
  const entry = join(tmp, 'entry.ts')
  try {
    writeFileSync(
      entry,
      [
        "export { generateFromConfig } from '@es-plus/shared'",
        "export { StructuredCrudConfigSchema } from '@es-plus/shared'",
      ].join('\n'),
      'utf8'
    )
    const outfile = join(tmp, 'threeway.mjs')
    const result = await build({
      entryPoints: [entry],
      bundle: true,
      format: 'esm',
      outfile,
      platform: 'node',
      logLevel: 'silent',
      metafile: true,
      // `esbuild` 必须 external：生成器的扩展点语法闸（`assertEmittableExpr` →
      // `esbuild.transformSync`）在**运行时**要找到原生二进制。把它打进 bundle 后
      // 二进制解析会失败、`catch` 吞掉异常 → 闸恒判 false → 每条 `formatter`/`render`
      // 都被静默省略 —— 本守卫会把「真发射」误报成「未发射」，且咬不到真缺陷。
      // external 后由 bundle 所在目录（仓库内 node_modules/）逐级上溯解析，与真实运行一致。
      external: ['esbuild'],
      alias: { '@es-plus/shared': join(ROOT, 'packages', 'shared', 'src', 'index.ts') },
      banner: {
        js: "import { createRequire as __createRequire } from 'node:module';const require = __createRequire(import.meta.url);",
      },
    })
    const inputs = Object.keys(result.metafile.inputs)
    const fromBuild = inputs.filter((p) => /shared[\\/]build[\\/]/.test(p))
    const fromSrc = inputs.filter((p) => /shared[\\/]src[\\/]/.test(p))
    return { mod: await import(pathToFileURL(outfile).href), tmp, fromBuild, fromSrc }
  } catch (err) {
    rmSync(tmp, { recursive: true, force: true })
    throw err
  }
}

/**
 * 收集「恰好缩进 `depth` 层括号内」的**对象字面量键**（字符串/注释感知）。
 *
 * 为什么不能用「按行首缩进匹配」：SFC 产物里的列是**单行对象**——
 * `{ prop: 'a', width: 1, formatter: (row) => f(row) }` —— 行首正则会漏掉首键之外的一切。
 * 也不能按引号串扫：`render`/`formatter` 的值是**源码**，里面本来就有 `:`、`(`、`{`、`,`。
 *
 * 空键判定用「前一显著字符是 `{` 或 `,`」而不是「冒号左侧无空格」：前者能天然排除三目
 * `a ? b : c`、对象值里的嵌套对象（深度更深，已跳过）、以及箭头函数体。
 * **体首键**（`constBlock` 返回的是**内层**文本，故第一个键前面什么都没有）也算 —— 否则
 * `const options = { border: … }` 的第一个键永远读不到，轴①b 会凭空报一个「sfc 无」的假红。
 */
function keysAtDepth(src, depth) {
  const keys = new Set()
  let d = 0
  let i = 0
  const prevSignificant = (j) => {
    for (let k = j - 1; k >= 0; k--) {
      if (!/\s/.test(src[k])) return src[k]
    }
    return '' // 体首：前面全是空白
  }
  while (i < src.length) {
    const ch = src[i]
    if (ch === '"' || ch === "'" || ch === '`') {
      const quote = ch
      i++
      while (i < src.length) {
        if (src[i] === '\\') i += 2
        else if (src[i] === quote) {
          i++
          break
        } else i++
      }
      continue
    }
    if (ch === '/' && src[i + 1] === '/') {
      const nl = src.indexOf('\n', i)
      if (nl === -1) break
      i = nl + 1
      continue
    }
    if (ch === '/' && src[i + 1] === '*') {
      const end = src.indexOf('*/', i + 2)
      i = end === -1 ? src.length : end + 2
      continue
    }
    if (ch === '{') {
      d++
      i++
      continue
    }
    if (ch === '}') {
      d--
      i++
      continue
    }
    if (ch === '[' || ch === ']' || ch === '(' || ch === ')') {
      i++
      continue
    }
    if (d === depth) {
      const m = /^([A-Za-z_$][\w$]*)\s*:/.exec(src.slice(i, i + 120))
      const p = prevSignificant(i)
      if (m && (p === '{' || p === ',' || p === '')) {
        keys.add(m[1])
        i += m[0].length
        continue
      }
    }
    i++
  }
  return keys
}

/** 产物里出现的顶层 `const <name> = ` 名字（仅 `--report` 用，帮人定位产物形状）。 */
function topConstNames(code) {
  return [...new Set([...code.matchAll(/^const ([A-Za-z_$][\w$]*)\s*=/gm)].map((m) => m[1]))]
}

/** schema 模式产物里的 JSON 根对象（产物形状：`<import 头> … = { <JSON> }`）。 */
function parseSchemaJson(code) {
  // 头部是 `import type …` + `export const xxx: CrudPageConfig = {`，故按「赋值号后的首个 `{`」
  // 定位，再做花括号配对 —— 不能按行首正则切（import 语句里也有 `= `）。
  const m = code.match(/=\s*\{/)
  if (!m) throw new Error('schema 产物里找不到 `= {` —— 生成器输出形状变了？')
  const open = code.indexOf('{', m.index)
  const body = balanced(code, open, '{', '}')
  if (body === null) throw new Error('schema 产物的花括号不配对 —— 产物被截断？')
  return JSON.parse(`{${body}}`)
}

const objKeys = (o) => new Set(Object.keys(o || {}))
/** 逐条对象取键的并集；`prop` 给定时只保留该 `prop` 的条目（AI-34 的字段面投影）。 */
const itemKeys = (arr, prop) => {
  const list = (arr || []).filter((it) => it && typeof it === 'object')
  const picked = prop === undefined ? list : list.filter((it) => it.prop === prop)
  return new Set(picked.flatMap((it) => Object.keys(it)))
}
const PROBE_PROP = PROBE_FIELD.prop

/**
 * 把「对象数组的 body」按顶层条目切开（字符串/注释感知），返回每个条目 `{…}` 的原文。
 * 用途：SFC 的 `const columns` 是**手搓 JS 字面量**（含函数源码），不能 `JSON.parse`，
 * 必须按花括号配对切成一条一条，才能做「只看探针字段那一列」的投影。
 */
function splitTopLevelEntries(body) {
  const entries = []
  let depth = 0
  let start = -1
  let i = 0
  while (i < body.length) {
    const ch = body[i]
    if (ch === '"' || ch === "'" || ch === '`') {
      const quote = ch
      i++
      while (i < body.length) {
        if (body[i] === '\\') i += 2
        else if (body[i] === quote) {
          i++
          break
        } else i++
      }
      continue
    }
    if (ch === '/' && body[i + 1] === '/') {
      const nl = body.indexOf('\n', i)
      if (nl === -1) break
      i = nl + 1
      continue
    }
    if (ch === '{') {
      if (depth === 0) start = i
      depth++
    } else if (ch === '}') {
      depth--
      if (depth === 0 && start >= 0) {
        entries.push(body.slice(start, i + 1))
        start = -1
      }
    }
    i++
  }
  return entries
}

/** 条目原文里的 `prop` 字面量（顶层第一个，够用：条目里没有嵌套同名字面量）。 */
function entryProp(entry) {
  const m = /(?:^|[,{\s])prop\s*:\s*(['"])([^'"]*)\1/.exec(entry)
  return m ? m[2] : undefined
}

/**
 * 读 schema 模式产物（本模式产物是**真 JSON**，取键零假阳）。
 *
 * `dialogs` 域含弹窗配置自身键；弹窗内的 `formItems` 并入 `formItem` 域（同样是表单面）。
 * 注意 SFC 模式**不消费** `dialogs`（`generateSFC` 有 ignoredInSfc 显式告警），故 dialog 域
 * 天然只有 schema 一侧 —— 这不是不等价，是登记在案的降级。
 *
 * 字段面域（`formItem`/`column`）返回 `{ all, probe }` 两套：
 *   - `probe` 只含**探针字段**（`prop === PROBE_PROP`）发射的键 —— 轴①（声明未发射）用它，
 *     因为「AI 给这个字段声明的每个键，是否真落到了这个字段上」才是要问的问题。
 *     若用 `all`，推导出来的**操作列**（`prop:'operate'`，带 `label`/`btns`）会污染答案：
 *     例如 `fields.label` 在 i18n 模式下被 `labelKey` 取代、探针字段上确实没有 `label`，
 *     但操作列有 —— 用 `all` 就会把这条登记行误判成「陈旧」。
 *   - `all` 含全部条目 —— 轴②（发射未消费）用它，覆盖面不能因为投影而缩小。
 */
function readSchemaProduct(code) {
  const json = parseSchemaJson(code)
  const dialogItems = Object.values(json.dialogs || {}).flatMap((d) => d.formItems || [])
  const allFormItems = [...(json.formItems || []), ...dialogItems]
  const allColumns = json.columns || []
  return {
    tableOptions: objKeys(json.tableOptions),
    formItem: { all: itemKeys(allFormItems), probe: itemKeys(allFormItems, PROBE_PROP) },
    column: { all: itemKeys(allColumns), probe: itemKeys(allColumns, PROBE_PROP) },
    dialog: new Set(Object.values(json.dialogs || {}).flatMap((d) => Object.keys(d))),
    formLayout: objKeys(json.formLayout),
  }
}

/**
 * 读 SFC 模式产物。
 *
 * `options` / `columns` 都是受控手搓块，用 `keysAtDepth` 取键：
 *   - `const options = { a: 1, nested: { x } }` → body 是**内层文本**，故深度 0 才是
 *     `a`/`nested`（`x` 在深度 1）；
 *   - `const columns = [ { prop }, … ]` → body 是**数组元素文本**，每条列对象自带一层花括号，
 *     故深度 1 才是每条列的键。
 * `formItems` / `dialogFormItems` 是 `inlineJson` 产物（真 JSON），可直接 `JSON.parse`。
 *
 * SFC **不发射** `dialogs` 配置（ignoredInSfc 告警）；`formLayout` 也不发射（列宽走
 * formItem 的 `span`，与 schema 模式的实际生效路径一致）。
 */
function readSfcProduct(code, failures) {
  const empty = () => ({ all: new Set(), probe: new Set() })
  const out = {
    tableOptions: new Set(),
    formItem: empty(),
    column: empty(),
    dialog: new Set(),
    formLayout: new Set(),
  }
  const opts = constBlock(code, 'options')
  const items = constBlock(code, 'formItems')
  const cols = constBlock(code, 'columns')
  if (!opts.found || opts.body === null) failures.push('SFC 产物里定位不到 `const options = {…}`')
  if (!items.found || items.body === null) failures.push('SFC 产物里定位不到 `const formItems = […]`')
  if (!cols.found || cols.body === null) failures.push('SFC 产物里定位不到 `const columns = […]`')
  if (failures.length) return out
  out.tableOptions = keysAtDepth(opts.body, 0)
  const entries = splitTopLevelEntries(cols.body)
  if (!entries.length) failures.push('SFC 产物的 `const columns` 里切不出任何列条目')
  for (const e of entries) {
    for (const k of keysAtDepth(e, 1)) {
      out.column.all.add(k)
      if (entryProp(e) === PROBE_PROP) out.column.probe.add(k)
    }
  }
  const addJsonItems = (body, label) => {
    let parsed
    try {
      parsed = JSON.parse(`[${body}]`)
    } catch (e) {
      failures.push(`SFC 产物的 ${label} 不是合法 JSON：${String(e.message).split('\n')[0]}`)
      return
    }
    for (const k of itemKeys(parsed)) out.formItem.all.add(k)
    for (const k of itemKeys(parsed, PROBE_PROP)) out.formItem.probe.add(k)
  }
  addJsonItems(items.body, 'formItems')
  const dlgItems = constBlock(code, 'dialogFormItems')
  if (dlgItems.found && dlgItems.body !== null) addJsonItems(dlgItems.body, 'dialogFormItems')
  return out
}

async function main() {
  const reach = readReachability()
  const dialog = readDialogContract()
  if (reach === null || dialog === null) return 1

  console.log('[threeway] 打包并取回真生成器…')
  const { mod, tmp, fromBuild, fromSrc } = await captureGenerator()
  try {
    if (fromBuild.length > 0) {
      fail(`打包拉到了 build/ 产物（${fromBuild.slice(0, 3).join(', ')}…）—— 陈旧构建会让本守卫测旧代码。alias 未生效？`)
    }
    if (fromSrc.length === 0) fail('打包没有拉到任何 shared/src 输入 —— 想当然的 alias 没接上。')
    if (failed) return 1
    console.log(`[threeway] 自证：打包输入 shared/src ${fromSrc.length} 个，shared/build 0 个 ✔`)

    // ── 第 0 条：探针必须过**真的** AI Zod（AI 契约自洽 + 全键可同时表达）──
    const parsed = mod.StructuredCrudConfigSchema.safeParse(PROBE)
    if (!parsed.success) {
      fail(`全键探针未过 AI Zod —— 说明 AI 契约自身不自洽：${JSON.stringify(parsed.error?.issues?.slice(0, 4))}`)
      return 1
    }
    ok('全键探针过 AI Zod（26 tableOptions + 24 FieldConfig + formLayout + dialog 全键可同时表达）')

    // ── 真跑两模式 ──
    const schemaRes = mod.generateFromConfig({ ...parsed.data, mode: 'schema' })
    const sfcRes = mod.generateFromConfig({ ...parsed.data, mode: 'sfc' })
    const s = readSchemaProduct(schemaRes.code)
    const sfcFailures = []
    const f = readSfcProduct(sfcRes.code, sfcFailures)
    if (sfcFailures.length) {
      for (const m of sfcFailures) fail(m)
      return 1
    }

    // 两模式产物的**键并集**，按产物域归口。AI-34 的轴①判的是「任一模式发射」
    // （两模式**不等价**由轴①b 单列断言，只在 tableOptions 上有契约级要求）。
    //
    // 字段面（formItem/column）有**两套集合**：
    //   - `all`：全部条目（含派生的 `operate` 操作列）—— 轴② 用它，覆盖面不缩水；
    //   - `probe`：只看探针字段那一列/那一项 —— 轴① 用它，问的才是「AI 给这个字段声明的键，
    //     有没有真落到**这个字段**上」。用 `all` 会被派生条目污染：`fields.label` 在 i18n
    //     模式下被 `labelKey` 取代（探针字段上真没有 `label`），但操作列有 `label:'操作'`，
    //     于是那行登记会被误判成「陈旧」。投影后 `fields.label` 重新落回登记行。
    const emittedTableOptions = new Set([...s.tableOptions, ...f.tableOptions])
    const emittedFormItemAll = new Set([...s.formItem.all, ...f.formItem.all])
    const emittedColumnAll = new Set([...s.column.all, ...f.column.all])
    const emittedDialogKeys = new Set([...s.dialog, ...f.dialog])
    const emittedFormLayout = new Set([...s.formLayout, ...f.formLayout])
    const domainSets = {
      tableOptions: emittedTableOptions,
      formItem: emittedFormItemAll,
      column: emittedColumnAll,
      dialog: emittedDialogKeys,
      formLayout: emittedFormLayout,
    }
    // AI 的 field 级键分布在两张产物面（表格列 / 表单控件），故 fields 组的判据是**探针投影**的并集。
    const emittedFieldKeys = new Set([
      ...s.formItem.probe,
      ...f.formItem.probe,
      ...s.column.probe,
      ...f.column.probe,
    ])

    if (REPORT) {
      console.log('\n=== 产物逐域键集（并集）===')
      for (const [name, set] of Object.entries(domainSets)) {
        console.log(`  ${name}(${set.size}): ${[...set].sort().join(', ')}`)
      }
      console.log(`  schema-only dialog(${s.dialog.size}): ${[...s.dialog].sort().join(', ')}`)
      console.log(`  sfc 顶层 const：${topConstNames(sfcRes.code).join(', ')}`)
      if (process.argv.includes('--dump')) {
        console.log('\n=== SFC `const columns` 块 ===\n' + (constBlock(sfcRes.code, 'columns').body || '(未找到)'))
        console.log('\n=== schema 产物顶层键 ===\n' + topConstNames(schemaRes.code).join(', '))
        const sj = parseSchemaJson(schemaRes.code)
        console.log('schema 顶层键：' + Object.keys(sj).join(', '))
        console.log('schema.formLayout：' + JSON.stringify(sj.formLayout))
        console.log('schema.dialogs：' + JSON.stringify(sj.dialogs))
        console.log('schema.columns：' + JSON.stringify(sj.columns))
      }
    }

    // ── 轴①：声明未发射（+ 反向陈旧 + emittedAs 证据核对）─────────
    // 三态：
    //   a. 键不在产物 ∧ 无登记行 → 真缺口（宿主设了它、解析成功、零告警、凭空消失）→ 红；
    //   b. 键在产物 ∧ 有登记行 → 陈旧行（该键已能发射，登记理由失效）→ 红，强制删行；
    //   c. 键不在产物 ∧ 有登记行 → 登记行承重：若它声明了 `emittedAs`（改名/条件发射），
    //      则当场核对那个产物键**真的存在** —— 改名不是免责声明，是可验证的事实。
    const declaredNotEmitted = []
    const staleRows = []
    const badEvidence = []
    const checkDeclared = (group, key, present) => {
      const reg = `${group}.${key}`
      const row = DECLARED_NOT_EMITTED[reg]
      if (present) {
        if (row) staleRows.push(reg)
        if (row?.emittedAs && !domainSets[row.emittedAs.domain]?.has(row.emittedAs.key)) {
          // 同一个键既被说成「已发射」又真的出现在 AI 名下 —— 两个信号矛盾，也算证据不符
          badEvidence.push(`${reg}（声明改名发射为 ${row.emittedAs.domain}.${row.emittedAs.key}，但产物里该键不存在）`)
        }
        return
      }
      if (!row) {
        declaredNotEmitted.push(reg)
        return
      }
      if (row.emittedAs) {
        const dom = domainSets[row.emittedAs.domain]
        if (dom === undefined) badEvidence.push(`${reg}（emittedAs.domain '${row.emittedAs.domain}' 不是产物域）`)
        else if (!dom.has(row.emittedAs.key))
          badEvidence.push(`${reg}（声明改名发射为 ${row.emittedAs.domain}.${row.emittedAs.key}，但产物里该键不存在）`)
      }
    }
    for (const k of reach.tableOptionsKeys) checkDeclared('tableOptions', k, emittedTableOptions.has(k))
    for (const k of reach.fcKeys) checkDeclared('fields', k, emittedFieldKeys.has(k))
    for (const fk of ['labelWidth', 'minFoldRows']) checkDeclared('formLayout', fk, emittedFormLayout.has(fk))
    for (const dk of dialog.sharedDialogKeys) checkDeclared('dialogs', dk, emittedDialogKeys.has(dk))

    if (declaredNotEmitted.length) {
      fail(
        `AI 契约声明了、两个模式的产物都没有的键（宿主 LLM 设了它 → 解析成功、零告警、凭空消失）：\n` +
          declaredNotEmitted.map((k) => `   - ${k}`).join('\n') +
          `\n   要么让生成器发射它，要么登记进 DECLARED_NOT_EMITTED 并写明「它到底怎么生效」`
      )
    }
    if (staleRows.length) {
      fail(
        `DECLARED_NOT_EMITTED 里的陈旧行（该键已出现在产物里，登记理由失效）：\n` +
          staleRows.map((k) => `   - ${k}`).join('\n') +
          `\n   能发射了就必须删行 —— 本表是缺口清单，只减不增`
      )
    }
    if (badEvidence.length) {
      fail(
        `DECLARED_NOT_EMITTED 的 emittedAs 证据不符：\n` +
          badEvidence.map((k) => `   - ${k}`).join('\n') +
          `\n   「改名发射」必须能在产物里找到那个键，否则它只是一句免责声明`
      )
    }
    if (!declaredNotEmitted.length && !staleRows.length && !badEvidence.length) {
      ok(
        `轴① 声明未发射：${reach.tableOptionsKeys.length} tableOptions + ${reach.fcKeys.length} FieldConfig + ` +
          `2 formLayout + ${dialog.sharedDialogKeys.length} dialog 键全部有归宿（发射 ∪ ${Object.keys(DECLARED_NOT_EMITTED).length} 行登记，含 ${Object.values(DECLARED_NOT_EMITTED).filter((r) => r.emittedAs).length} 行改名/条件发射证据核对通过）`
      )
    }

    // ── 轴①b：两模式**不等价**（同 config、同键，只有一模式发射）──
    // 这是 AI-30 的形状：`estimatedRowHeight`/`overscanCount`/`rowClassName` 在 schema 模式
    // 发射、SFC 模式不发射；`height` 更隐蔽 —— 它在 SFC 里被 `if (tOpts.virtual)` 门住，
    // 于是「配了 height 但没开 virtual」的配置在 SFC 模式下**静默**丢高度。
    // 只对「AI 声明过、且至少一个模式发射了」的键报不等价 —— 两模式都不发射的已被轴① 收口。
    //
    // 边界（刻意）：只查 tableOptions。表格列/表单项的源码扩展点（`render`/`formatter`）在
    // 两模式里**本就**是不同的产物形态（schema → `scopedSlots` 槽名，sfc → 内联函数源码），
    // 那是分别登记、各自带降级告警的设计差异，不是「不等价」缺陷；把它们一并报进来只会
    // 稀释真正要咬的那三个键。dialog 域 SFC 整体不消费（ignoredInSfc 告警），同理不适用。
    const oneSided = []
    for (const k of reach.tableOptionsKeys) {
      const inSchema = s.tableOptions.has(k)
      const inSfc = f.tableOptions.has(k)
      if (inSchema !== inSfc && (inSchema || inSfc))
        oneSided.push(`${k}（${inSchema ? 'schema 有 / sfc 无' : 'sfc 有 / schema 无'}）`)
    }
    if (oneSided.length) {
      fail(`同 config 两模式产物不等价（AI-30 的形状）：\n` + oneSided.map((x) => `   - ${x}`).join('\n'))
    } else {
      ok(`轴①b 双模式等价：${reach.tableOptionsKeys.length} 个 tableOptions 键在 schema / sfc 两产物中一致出现`)
    }

    // ── 轴①c：`height` 不得寄生于 `virtual`（AI-30① 的回归锁）──────────
    // 轴①b 用的探针 `virtual: true`，恰好让 `if (tOpts.virtual)` 门开着 —— 那正是这个缺陷
    // 藏身之处：「配了 height 没开 virtual」在 SFC 下静默丢高度，而全键探针**看不见**它。
    // 故补一次 `virtual: false` 的定向复跑：只要 height 还被门住，这条就红。
    const noVirtual = {
      ...parsed.data,
      tableOptions: { ...parsed.data.tableOptions, virtual: false },
    }
    const sfcNoVirtual = readSfcProduct(mod.generateFromConfig({ ...noVirtual, mode: 'sfc' }).code, [])
    if (!sfcNoVirtual.tableOptions.has('height')) {
      fail(
        '表格 `height` 在 `virtual: false` 时被 SFC 静默丢弃 —— 它被 `if (tOpts.virtual)` 门住了（AI-30①）。\n' +
          '   产物里没有 height 但宿主明明配了 → 页面高度凭空消失，且零告警。'
      )
    } else {
      ok('轴①c height 与 virtual 解绑：`virtual: false` 时 SFC 仍发射 height')
    }

    // ── 轴①d：值级等价（键在 ≠ 值对）──────────────────────────────
    // 键级断言对这两处是瞎的：
    //   - headerCellStyle 一度在 SFC 里**写死** `#f5f7fa`（键在、值被默认值顶掉）；
    //   - 顶层 formLayout 一度只有 schema 模式消费（SFC 连键都不发）。
    // 探针分别取 #ffffff 与 {labelWidth:'100px', minFoldRows:2}，故「键在、值错」与
    // 「键在、根本没接到配置」都会当场红。
    const sfcOptsBody = constBlock(sfcRes.code, 'options').body || ''
    if (!sfcOptsBody.includes('#ffffff')) {
      fail(
        'SFC 产物的 options.headerCellStyle 未使用配置值（#ffffff）—— 可能又被写死成默认背景色（F3）。\n' +
          '   宿主配了表头样式却播不出来 = 配置静默失效。'
      )
    } else {
      ok('轴①d headerCellStyle 值级等价：SFC options 使用配置的 #ffffff')
    }
    const schemaFormLayout = parseSchemaJson(schemaRes.code).formLayout || {}
    if (schemaFormLayout.labelWidth !== '100px' || schemaFormLayout.minFoldRows !== 2) {
      fail(
        `schema 产物顶层 formLayout 与配置不一致：期望 {labelWidth:'100px', minFoldRows:2}，` +
          `实得 ${JSON.stringify(schemaFormLayout)}`
      )
    }
    if (!sfcRes.code.includes(':layout-form-props="formLayoutProps"')) {
      fail(
        'SFC 模板未绑定 :layout-form-props="formLayoutProps" —— 顶层 formLayout 在 SFC 模式静默丢弃（F3）。\n' +
          '   同一份 config 在 schema 模式生效、在 SFC 模式消失 = 两模式不等价。'
      )
    }
    const formLayoutPropsBody = constBlock(sfcRes.code, 'formLayoutProps').body || ''
    if (
      !formLayoutPropsBody.includes('labelBtnWidth') ||
      !formLayoutPropsBody.includes('100px') ||
      !formLayoutPropsBody.includes('minFoldRows')
    ) {
      fail(
        `SFC 的 formLayoutProps 未携带配置的 labelWidth/minFoldRows：${formLayoutPropsBody || '(未找到)'}\n` +
          '   schema 模式的 formLayout.labelWidth 对应 SFC 的 formLayProps.labelBtnWidth（es-form 的按钮区 label 宽度）。'
      )
    } else {
      ok('轴①d 顶层 formLayout 值级等价：schema 保留原键、SFC 映射为 labelBtnWidth/minFoldRows 并绑定')
    }

    // ── 轴②：发射未消费 ───────────────────────────────────────────
    // core 契约类型是「三端消费面」的上界；dialog 域另加三端 `CrudDialogConfig` 的**交集**
    //（它在三端 types.ts 里，不在 core，故由 readDialogContract 提供）。
    const coreKeys = new Set(dialog.runtimeDialogKeys)
    for (const c of CORE_CONTRACTS) {
      const body = interfaceBody(stripComments(read(c.file)), c.name)
      if (body === null) {
        fail(`未能在 ${c.file} 解析 ${c.name}（选择器失效）`)
        return 1
      }
      for (const k of interfaceFields(body)) coreKeys.add(k)
    }
    // 端内联子类型（如三端 `CrudPageConfig.formLayout?: { labelWidth?, minFoldRows? }`）：
    // 没有具名 interface 可切，逐端切属性上的匿名对象类型，并要求**三端都在**。
    const inlineExtra = new Set()
    for (const c of CORE_INLINE_CONTRACTS) {
      for (const file of c.files) {
        const body = interfaceBody(stripComments(read(file)), c.name)
        if (body === null) {
          fail(`未能在 ${file} 解析 ${c.name}（选择器失效）`)
          return 1
        }
        const keys = nestedObjectTypeKeys(body, c.prop)
        if (keys === null) {
          fail(`${file} 的 ${c.name} 里找不到内联对象属性 \`${c.prop}?: {…}\` —— 形状变了？`)
          return 1
        }
        for (const k of keys) {
          coreKeys.add(k)
          inlineExtra.add(`${c.prop}.${k}`)
        }
      }
    }
    const emittedNotConsumed = []
    let emittedKeyTotal = 0
    for (const [domain, set] of Object.entries(domainSets)) {
      emittedKeyTotal += set.size
      for (const k of set) {
        const reg = `${domain}.${k}`
        if (!coreKeys.has(k) && !(reg in EMITTED_NOT_CONSUMED)) emittedNotConsumed.push(reg)
      }
    }
    if (emittedNotConsumed.length) {
      fail(
        `生成器发射了 core/三端契约里没有的键（三端绑不上、无消费通道）：\n` +
          emittedNotConsumed.map((k) => `   - ${k}`).join('\n') +
          `\n   要么删掉该发射点，要么登记进 EMITTED_NOT_CONSUMED 并说明谁消费它`
      )
    } else {
      ok(
        `轴② 发射未消费：产物 ${emittedKeyTotal} 键（去重前逐域计数）全部落在 core/三端契约类型内（${coreKeys.size} 键，含 ${inlineExtra.size} 个端内联子类型键）+ ` +
          `${Object.keys(EMITTED_NOT_CONSUMED).length} 行登记`
      )
      if (REPORT && inlineExtra.size) {
        console.log(`   （端内联子类型键：${[...inlineExtra].sort().join(', ')}）`)
      }
    }

    // ── 轴③：消费未声明 + 反向陈旧 + 证据存活 ─────────────────────
    const aiTableOptions = new Set(reach.tableOptionsKeys)
    const aiFields = new Set(reach.fcKeys)
    let axis3ok = true
    for (const [rowKey, def] of Object.entries(CONSUMED_NOT_DECLARED)) {
      const [group, ...rest] = rowKey.split('.')
      const key = rest.join('.')
      const aiSet = group === 'tableOptions' ? aiTableOptions : group === 'fields' ? aiFields : null
      if (aiSet === null) {
        fail(`CONSUMED_NOT_DECLARED 的 '${rowKey}' 分组未知（只支持 tableOptions.* / fields.*）`)
        axis3ok = false
        continue
      }
      if (aiSet.has(key)) {
        fail(
          `CONSUMED_NOT_DECLARED 的 '${rowKey}' 已在 AI 契约里 —— 陈旧登记行：收编后必须删除（本表只减不增）`
        )
        axis3ok = false
      }
      if (!def.tier || !(def.reason || '').trim()) {
        fail(`CONSUMED_NOT_DECLARED 的 '${rowKey}' 缺 tier 或 reason（本表的价值就是这两样）`)
        axis3ok = false
      }
    }
    if (axis3ok) {
      ok(`轴③ 消费未声明：${Object.keys(CONSUMED_NOT_DECLARED).length} 行登记，全部「未被 AI 契约声明」且带证据`)
    }

    // ── 轴④：未建模 ───────────────────────────────────────────────
    for (const [k, def] of Object.entries(UNMODELED)) {
      if (!(def.reason || '').trim()) fail(`UNMODELED 的 '${k}' 未写明 reason（本表不是垃圾桶）`)
    }

    // ── SFC 能力表（AI-30②）：与生成器**双向绑定** ───────────────────
    // 「SFC 不支持什么」是宿主选 mode 时就要知道的事实，但它同时必须是**被断言绑死的**
    // 事实：生成器多降级一个 surface → 本表缺行则红；本表有行而生成器不再 push → 也红。
    // 判据取自生成器真实的 `ignoredInSfc.push('<key> …')` 调用点，不取自本表的自我声明。
    const genSrc = stripComments(read(GENERATOR_SRC))
    const genDegraded = new Set(
      [...genSrc.matchAll(/ignoredInSfc\.push\('([A-Za-z][\w.]*)/g)].map((m) => m[1])
    )
    const regDegraded = new Set(Object.keys(SFC_DEGRADATIONS))
    const unregisteredSfc = [...genDegraded].filter((k) => !regDegraded.has(k))
    const staleSfc = [...regDegraded].filter((k) => !genDegraded.has(k))
    if (genDegraded.size === 0) {
      fail('在生成器里找不到任何 `ignoredInSfc.push(...)` —— 选择器失效或该降级机制被删，请检查脚本')
    }
    if (unregisteredSfc.length) {
      fail(
        `生成器在 SFC 模式下降级了未登记的 surface：\n` +
          unregisteredSfc.map((k) => `   - ${k}`).join('\n') +
          `\n   宿主选 mode 前必须能读到「SFC 到底不支持什么」→ 补进 SFC_DEGRADATIONS（含 reason/escape）`
      )
    }
    if (staleSfc.length) {
      fail(
        `SFC_DEGRADATIONS 里的陈旧行（生成器已不再降级该 surface）：\n` +
          staleSfc.map((k) => `   - ${k}`).join('\n') +
          `\n   补齐消费了就必须删行 —— 本表是缺口清单，只减不增`
      )
    }
    for (const [k, def] of Object.entries(SFC_DEGRADATIONS)) {
      if (!(def.escape || '').trim()) fail(`SFC_DEGRADATIONS 的 '${k}' 未写 escape（想要全量怎么办）`)
    }
    if (!unregisteredSfc.length && !staleSfc.length && genDegraded.size > 0) {
      ok(
        `SFC 能力表：${genDegraded.size} 个降级 surface（${[...genDegraded].sort().join(', ')}）与生成器双向一致，每行带 escape 与证据`
      )
    }

    // ── 轴⑤：弹窗可达性（AI-35）────────────────────────────────────
    // 缺陷形状：配置里声明了 `dialogs[k]`，但生成的页面上**没有任何按钮能打开它** ——
    // 弹窗点不开，且**零告警**（比丢掉一个键更糟：键的丢失有轴① 守望，可达性的丢失没有）。
    //
    // 成因是两个归一化器对「什么是显式模式」判断不一致：`normalizedToolbarBtns` 见到
    // `schema.dialogs` 就整块返回 `[]`，而 `normalizedOperationColumn` 不认 `dialogs`、
    // 照旧从 `actions` 派生 —— 于是只有「新增」全灭。修法：`dialogs` 定义弹窗、**不定义
    // 按钮面**，只有显式 `toolbarBtns`/`operationColumn` 才是「按钮面交给用户」。
    //
    // 本轴两半各自咬住一半，缺一不可：
    //   ① **静态锁**：三端工具栏门的判据必须恰好是 `operationColumn !== undefined`、且
    //      **不得**再出现 `schema.dialogs`（有人把等价物写回去 → 立刻红）；
    //   ② **语料重放**：拿生成器自己的 `findDialogsWithoutOpener`（经 `generateFromConfig`
    //      的警告暴露，**同一个函数**、不重写一遍规则）跑全部 golden 用例，断言零个无入口弹窗。
    // 为什么两半都要：静态锁只证明「门写对了」，语料重放才证明「在这批配置上真的没人被关在门外」；
    // 而 `crud-runtime.spec.ts` 的真渲染见证再把「守卫的模型 == 运行时的行为」这一环闭上。
    const TOOLBAR_GATE_WINDOW = 1200
    let axis5ok = true
    for (const [end, file] of Object.entries(CRUD_DIALOG_PASSTHROUGH_SRC)) {
      const src = stripComments(read(file))
      const from = src.indexOf('normalizedToolbarBtns')
      const to = src.indexOf('normalizedOperationColumn')
      if (from < 0 || to <= from) {
        fail(
          `轴⑤ 静态锁：${end} 的 ${file} 里定位不到 normalizedToolbarBtns → normalizedOperationColumn 这一段 —— ` +
            `改名了？本断言失效（不是通过），请同步本守卫`
        )
        axis5ok = false
        continue
      }
      const gate = src.slice(from, Math.min(to, from + TOOLBAR_GATE_WINDOW))
      if (!/schema\.operationColumn\s*!==\s*undefined/.test(gate)) {
        fail(
          `轴⑤ 静态锁：${end} 的工具栏门里找不到 'schema.operationColumn !== undefined' —— ` +
            `「显式按钮面才抑制派生」这条判据不见了（AI-35 修的就是它）`
        )
        axis5ok = false
      }
      if (/schema\.dialogs/.test(gate)) {
        fail(
          `轴⑤ 静态锁：${end} 的工具栏门又认 schema.dialogs 了 —— ` +
            `dialogs 定义弹窗、不定义按钮面；认它就会让 \`dialogs: { add }\` 的页面没有「新增」入口（AI-35 回归）`
        )
        axis5ok = false
      }
      if (/props\.schema\.dialogs\s*\|\|\s*props\.schema\.operationColumn\s*!==\s*undefined/.test(src)) {
        fail(`轴⑤ 静态锁：${end} 里仍留着 AI-35 之前的合取式门（dialogs || operationColumn）`)
        axis5ok = false
      }
    }

    const casesDir = join(ROOT, '__tests__', 'golden', 'cases')
    // 只重放 CRUD 用例：`frag-*` 是**片段场景**的输入（`DialogBlockInput` 之类），根本不是
    // StructuredCrudConfig，喂给 generateFromConfig 必然校验失败 —— 那不是缺陷，是拿错尺子。
    // 判据复用 score-golden 的同一枚 `isCrudCase`（单一真源，别在这里重写一遍场景判定）。
    const caseFiles = readdirSync(casesDir).filter((x) => x.endsWith('.json'))
    const crudCases = caseFiles
      .map((f) => ({ f, raw: JSON.parse(readFileSync(join(casesDir, f), 'utf8')) }))
      .filter(({ raw }) => raw.config && isCrudCase(raw))
    if (crudCases.length === 0) {
      fail('轴⑤ 语料重放：CRUD 用例目录为空 —— 本轴失去语料基础（不是通过）')
      axis5ok = false
    }
    const orphanDialogs = []
    for (const { f: cf, raw } of crudCases) {
      const cfg = raw.config
      if ((cfg.mode || 'schema') === 'sfc') continue // sfc 整体不消费 dialogs（另有专门降级告警）
      let res
      try {
        res = mod.generateFromConfig(cfg)
      } catch (err) {
        orphanDialogs.push(`${cf}: 生成失败 — ${err.message.split('\n')[0]}`)
        continue
      }
      const hit = (res.warnings || []).find((w) => /has no opener/.test(w))
      if (hit) orphanDialogs.push(`${cf}: ${hit}`)
    }
    if (orphanDialogs.length) {
      fail(
        `轴⑤ 语料重放：${orphanDialogs.length} 例「声明了却打不开」的弹窗 ——\n` +
          orphanDialogs.map((l) => `   - ${l}`).join('\n') +
          `\n   修法：给该弹窗一个入口（把对应动作留在 actions 里，或显式按钮面里补 dialogKey），` +
          `或从 dialogs 里拿掉 —— 别让页面交付一个点不开的弹窗`
      )
      axis5ok = false
    }
    if (axis5ok) {
      ok(
        `轴⑤ 弹窗可达性：三端工具栏门只认 operationColumn（不认 dialogs），` +
          `${crudCases.length} 例 CRUD 语料零个「声明了却打不开」的弹窗`
      )
    }

    // ── 登记表卫生：四类都必须有名有实，且「消费/改名」类断言必须有**存活证据**──
    // 证据纪律：任何声称「运行时真消费」「改名后确实发射」的行，都必须给出 `{file, pattern}`
    // 并在本次运行里命中。否则它退化成一句无人可验的注释 —— 而「不静默」的全部价值就在于
    // 断言可验：消费者被删/改名、产物换了词形，这一行**立刻变红**，而不是烂在文件里。
    const TIER_REQUIRED = new Set(['DECLARED_NOT_EMITTED', 'EMITTED_NOT_CONSUMED', 'CONSUMED_NOT_DECLARED'])
    const EVIDENCE_REQUIRED = new Set(['EMITTED_NOT_CONSUMED', 'CONSUMED_NOT_DECLARED', 'SFC_DEGRADATIONS'])
    for (const [registryName, reg] of Object.entries({
      DECLARED_NOT_EMITTED,
      EMITTED_NOT_CONSUMED,
      CONSUMED_NOT_DECLARED,
      UNMODELED,
      SFC_DEGRADATIONS,
    })) {
      for (const [k, def] of Object.entries(reg)) {
        const where = `${registryName} 的 '${k}'`
        if (!(def.reason || '').trim()) fail(`${where} 未写明 reason`)
        if (TIER_REQUIRED.has(registryName) && !def.tier) fail(`${where} 缺 tier（档位是这张表的第二半信息）`)
        if (def.axis !== undefined && !THREE_WAY_AXES[def.axis]) {
          fail(`${where} 的 axis '${def.axis}' 不是四类漏算之一`)
        }
        // 证据两种写法：`consumedAt: [{file, pattern}]`（消费/发射类，可多条）与
        // `evidence: {file, pattern}`（降级类，单一命中点）。语义不同，纪律相同 ——
        // 都必须能在本次运行里命中真源码。
        const evid = def.consumedAt || (def.evidence ? [def.evidence] : [])
        if (EVIDENCE_REQUIRED.has(registryName) && !evid.length) {
          fail(`${where} 没有证据（consumedAt / evidence）—— 「真消费 / 真发射 / 真降级」不得是无凭据的断言`)
        }
        for (const { file, pattern } of evid) {
          let src
          try {
            src = read(file)
          } catch {
            fail(`${where} 的证据文件不存在：${file}`)
            continue
          }
          const m = pattern.exec(src)
          if (!m) {
            fail(
              `${where} 的证据失效：${file} 里再也匹配不到 ${pattern} —— ` +
                `消费者被删/改名了？那这一行的结论必须重审（这正是「不静默」的机制：证据一没，行就红）`
            )
            continue
          }
          // 边界检查：证据必须钉住**整个标识符**，不能是别人的前缀/后缀。
          // 实测踩过：`/function toOnKey/` 在把消费者改名成 `toOnKeyRenamed` 之后**照样命中** ——
          // 行不会红，证据退化成一句永远成立的注释。而「改名后仍然红」正是这张表存在的理由。
          // 只在**模式自己以标识符字符收尾/开头**时才要求边界：模式若已用 `(`/`'`/空格 之类的
          // 非标识符字符划定了断点（如 `…push('dialogs \(`），后接字母并不构成「前缀命中」。
          const isIdent = (c) => /[A-Za-z0-9_$]/.test(c)
          const before = m.index > 0 ? src[m.index - 1] : ''
          const after = src[m.index + m[0].length] ?? ''
          const loose =
            (isIdent(m[0][0]) && isIdent(before)) ||
            (isIdent(m[0][m[0].length - 1]) && isIdent(after))
          if (loose) {
            fail(
              `${where} 的证据模式太松：${file} 里 ${pattern} 的命中被标识符字符包围` +
                `（'…${src.slice(Math.max(0, m.index - 8), m.index)}⟨${m[0]}⟩${src.slice(m.index + m[0].length, m.index + m[0].length + 8)}…'）—— ` +
                `改为能钉住完整词形的写法（加 \\b 或把上下文写全），否则消费者改个名这行照样绿。`
            )
          }
        }
      }
    }
  } finally {
    rmSync(tmp, { recursive: true, force: true })
  }

  if (failed) {
    console.error('\n三向一致性扫描：存在未登记的漏算（见上）。')
    return 1
  }
  console.log('\n三向一致性扫描 ✅ AI 契约 ↔ 生成器（双模式）↔ 三端消费 无未登记漏算。')
  return 0
}

main().then(
  (code) => process.exit(code),
  (err) => {
    console.error(err)
    process.exit(1)
  }
)
