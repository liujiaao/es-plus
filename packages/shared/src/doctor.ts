/**
 * AN-15③ — `doctor_page`：静态检查宿主入口是否把「静默失效」的前置项配齐了。
 *
 * ## 诚实边界（写在最前面）
 *
 * 这是一次**字面量静态扫描**，不是链接器：
 *   - 它只读你贴进来的 `entry` / `viteConfig` 文本，看不到被 import 进来的模块；
 *   - 选项对象必须是**字面量**（`app.use(ESPlus, { … })` / `configureEsPlus({ … })`）。
 *     若是 `app.use(ESPlus, options)`，该项判 **unverified**（可能配了，也可能没配）；
 *   - 注释先被剥掉再扫：入口样板的注释里就写着 `permission / t / httpRequest`，
 *     不剥注释会得到「配了」的**假绿**（这正是本工具最该避免的失败方向）。
 *
 * 所以三态而不是两态：`ok` / `missing` / `unverified`。`unverified` 不判失败，但它必须
 * 出现在报告里，让宿主知道「这里没验到」而不是「这里没问题」。
 */
import {
  buildPreflight,
  type PreflightId,
  type PreflightInput,
  type PreflightItem,
} from './preflight.js'
import { DEFAULT_TARGET, type TargetFramework } from './target.js'

export type DoctorStatus = 'ok' | 'missing' | 'unverified'

export interface DoctorInput {
  entry: string
  target?: TargetFramework
  /** 同一份前置清单的输入：用来判定哪些项**本页面真的需要**。
   *  省略 ⇒ permission / i18n / httpRequest 一律按「需要」检查（JSX 仍按 schema 默认，
   *  因为无从得知产物模式；要看 JSX 就传带 `mode:'sfc'` 的 config）。 */
  config?: PreflightInput
  /** 可选：vite.config.* 源码。UI 库自动导入与 JSX 插件只能从这里看出来。 */
  viteConfig?: string
}

export interface DoctorFinding {
  id: PreflightId
  title: string
  required: boolean
  status: DoctorStatus
  evidence: string
  hint: string
}

export interface DoctorReport {
  target: TargetFramework
  findings: DoctorFinding[]
  /** 全部 required 项都 `ok` 才为 true（`unverified` 不算失败，但要读报告）。 */
  ok: boolean
}

/**
 * 剥掉 JS 注释，**保留字符串**（否则 `'https://…'` 会被 `//` 截断）。
 * 模板字面量按普通字符串处理（不解析 `${}` 嵌套）—— 对入口样板足够，且失败方向是
 * 「少扫到」而不是「凭空扫到」。
 */
export function stripJsComments(src: string): string {
  let out = ''
  let i = 0
  while (i < src.length) {
    const c = src[i]
    const n = src[i + 1]
    if (c === '/' && n === '/') {
      while (i < src.length && src[i] !== '\n') i += 1
      continue
    }
    if (c === '/' && n === '*') {
      i += 2
      while (i < src.length && !(src[i] === '*' && src[i + 1] === '/')) i += 1
      i += 2
      continue
    }
    if (c === "'" || c === '"' || c === '`') {
      const quote = c
      out += c
      i += 1
      while (i < src.length) {
        const ch = src[i]
        out += ch
        i += 1
        if (ch === '\\') {
          if (i < src.length) {
            out += src[i]
            i += 1
          }
          continue
        }
        if (ch === quote) break
      }
      continue
    }
    out += c
    i += 1
  }
  return out
}

/** 从 `openIdx`（指向 `[`/`{`）起做引号/注释感知的配对扫描；未闭合返回 null。 */
function balanced(src: string, openIdx: number): string | null {
  const open = src[openIdx]
  const close = open === '{' ? '}' : open === '[' ? ']' : null
  if (!close) return null
  let depth = 0
  let i = openIdx
  while (i < src.length) {
    const c = src[i]
    if (c === "'" || c === '"' || c === '`') {
      const quote = c
      i += 1
      while (i < src.length) {
        if (src[i] === '\\') i += 2
        else if (src[i] === quote) {
          i += 1
          break
        } else i += 1
      }
      continue
    }
    if (c === '/' && src[i + 1] === '/') {
      while (i < src.length && src[i] !== '\n') i += 1
      continue
    }
    if (c === '/' && src[i + 1] === '*') {
      i += 2
      while (i < src.length && !(src[i] === '*' && src[i + 1] === '/')) i += 1
      i += 2
      continue
    }
    if (c === open) depth += 1
    else if (c === close) {
      depth -= 1
      if (depth === 0) return src.slice(openIdx + 1, i)
    }
    i += 1
  }
  return null
}

type OptionsProbe = { found: boolean; body: string | null; unknown: boolean }

/**
 * 找出插件安装点的**选项对象字面量**正文。
 *   - `app.use(ESPlus, { … })` / `Vue.use(ESPlus, { … })` / `configureEsPlus({ … })` → body
 *   - `app.use(ESPlus)`（无第二参）→ `{ found: true, body: '' }`（肯定没有选项）
 *   - `app.use(ESPlus, options)`（标识符）→ `{ found: true, body: null, unknown: true }`
 */
export function probePluginOptions(code: string): OptionsProbe {
  const m = /(?:app|Vue)\s*\.\s*use\s*\(\s*ESPlus\b|configureEsPlus\s*\(/.exec(code)
  if (!m) return { found: false, body: null, unknown: false }
  let i = m.index + m[0].length
  while (i < code.length && /\s/.test(code[i])) i += 1
  // app.use(ESPlus) / configureEsPlus()
  if (code[i] === ')') return { found: true, body: '', unknown: false }
  if (code[i] === ',') {
    i += 1
    while (i < code.length && /\s/.test(code[i])) i += 1
  }
  if (code[i] === '{') {
    const body = balanced(code, i)
    return body == null
      ? { found: true, body: null, unknown: true }
      : { found: true, body, unknown: false }
  }
  return { found: true, body: null, unknown: true }
}

/** 选项对象里是否以**键**（含 shorthand）出现该名字。正文不含外层花括号，故末键后是串尾。 */
export function hasOptionKey(body: string, key: string): boolean {
  const re = new RegExp(`(?:^|[{,])\\s*(?:['"]?${key}['"]?)\\s*(?:[:,}]|$)`)
  return re.test(body)
}

function hasSpread(body: string): boolean {
  return /(?:^|[{,])\s*\.\.\./.test(body)
}

function optionFinding(
  probe: OptionsProbe,
  key: string,
  opts: { required: boolean; title: string; hint: string; notNeeded: string },
): DoctorFinding {
  if (!opts.required) {
    return {
      id: key === 'permission' ? 'permission' : 'i18n',
      title: opts.title,
      required: false,
      status: 'ok',
      evidence: opts.notNeeded,
      hint: '',
    }
  }
  if (!probe.found) {
    return {
      id: key === 'permission' ? 'permission' : 'i18n',
      title: opts.title,
      required: true,
      status: 'missing',
      evidence: 'ESPlus is never installed in this entry (no app.use(ESPlus) / Vue.use(ESPlus) / configureEsPlus).',
      hint: opts.hint,
    }
  }
  if (probe.body == null) {
    return {
      id: key === 'permission' ? 'permission' : 'i18n',
      title: opts.title,
      required: true,
      status: 'unverified',
      evidence: 'The plugin options are not an object literal here — a static scan cannot see inside them.',
      hint: opts.hint,
    }
  }
  if (hasOptionKey(probe.body, key)) {
    return {
      id: key === 'permission' ? 'permission' : 'i18n',
      title: opts.title,
      required: true,
      status: 'ok',
      evidence: `Found \`${key}\` in the plugin options.`,
      hint: '',
    }
  }
  if (hasSpread(probe.body)) {
    return {
      id: key === 'permission' ? 'permission' : 'i18n',
      title: opts.title,
      required: true,
      status: 'unverified',
      evidence: `\`${key}\` is not a literal key, but the options object spreads another object — it may come from there.`,
      hint: opts.hint,
    }
  }
  return {
    id: key === 'permission' ? 'permission' : 'i18n',
    title: opts.title,
    required: true,
    status: 'missing',
    evidence: `\`${key}\` is absent from the plugin options literal.`,
    hint: opts.hint,
  }
}

/** 跑完整清单；`config` 省略时把 permission / i18n / httpRequest 都按「需要」检查。 */
export function doctorPage(input: DoctorInput): DoctorReport {
  const target = input.target ?? input.config?.target ?? DEFAULT_TARGET
  const config: PreflightInput = input.config ?? {
    target,
    mode: 'schema',
    // 未知页面：保守假设「有权限门、有 i18n、有远端取数」——少报一个 required 就是
    // 把「没验到」伪装成「不需要」，那正是本工具要消灭的假绿。
    actions: ['add'],
    i18n: true,
    fields: [{ permissionValue: '__doctor_unknown__' }],
    usesRemoteData: true,
  }
  const report = buildPreflight(config, { target })
  const item = (id: PreflightId): PreflightItem => {
    const found = report.items.find((x) => x.id === id)
    if (!found) throw new Error(`preflight report is missing "${id}" — buildPreflight and Doctor drifted apart`)
    return found
  }
  const entry = stripJsComments(input.entry)
  const vite = input.viteConfig ? stripJsComments(input.viteConfig) : ''
  const probe = probePluginOptions(entry)
  const findings: DoctorFinding[] = []

  // UI 库：import 或 vite 的 Resolver 二选一，注册按 target 判。
  const ui = item('ui-library')
  const uiByVite =
    target === 'vue2'
      ? /ElementUiResolver|element-ui/.test(vite)
      : target === 'antdv'
        ? /AntDesignVueResolver|ant-design-vue/.test(vite)
        : /ElementPlusResolver|element-plus/.test(vite)
  const uiImport =
    target === 'vue2'
      ? /from\s+['"]element-ui['"]/.test(entry)
      : target === 'antdv'
        ? /from\s+['"]ant-design-vue['"]/.test(entry)
        : /from\s+['"]element-plus['"]/.test(entry)
  const uiRegister =
    target === 'vue2'
      ? /Vue\s*\.\s*use\s*\(\s*ElementUI\b/.test(entry)
      : target === 'antdv'
        ? /app\s*\.\s*use\s*\(\s*Antd\b/.test(entry)
        : /app\s*\.\s*use\s*\(\s*ElementPlus\b/.test(entry)
  findings.push({
    id: 'ui-library',
    title: ui.title,
    required: true,
    status: uiImport || uiByVite ? (uiRegister || uiByVite ? 'ok' : 'missing') : 'missing',
    evidence:
      uiImport || uiByVite
        ? uiRegister || uiByVite
          ? `Found the UI library import/resolver and its registration (${ui.action.split(' (')[0]}).`
          : 'The UI library is imported but never registered (no app.use / Vue.use).'
        : 'No UI-library import in the entry and no resolver in vite.config.',
    hint: ui.action,
  })

  // 插件注册。
  findings.push({
    id: 'es-plus-plugin',
    title: 'es-plus plugin registration',
    required: true,
    status: probe.found ? 'ok' : 'missing',
    evidence: probe.found
      ? 'Found the ESPlus install call.'
      : 'No app.use(ESPlus) / Vue.use(ESPlus) / configureEsPlus() in the entry.',
    hint: target === 'vue2' ? 'Vue.use(ESPlus, { … })' : 'app.use(ESPlus, { … })',
  })

  // httpRequest。
  const httpItem = item('http-request')
  if (!httpItem.required) {
    findings.push({
      id: 'http-request',
      title: httpItem.title,
      required: false,
      status: 'ok',
      evidence: httpItem.reason,
      hint: '',
    })
  } else {
    const f = optionFinding(probe, 'httpRequest', {
      required: true,
      title: httpItem.title,
      hint: httpItem.action,
      notNeeded: httpItem.reason,
    })
    findings.push({ ...f, id: 'http-request' })
  }

  // permission / t。
  findings.push(
    optionFinding(probe, 'permission', {
      required: item('permission').required,
      title: item('permission').title,
      hint: item('permission').action,
      notNeeded: item('permission').reason,
    }),
  )
  findings.push(
    optionFinding(probe, 't', {
      required: item('i18n').required,
      title: item('i18n').title,
      hint: item('i18n').action,
      notNeeded: item('i18n').reason,
    }),
  )

  // JSX：只能从 vite 配置看。
  const jsxItem = item('jsx')
  if (!jsxItem.required) {
    findings.push({
      id: 'jsx',
      title: jsxItem.title,
      required: false,
      status: 'ok',
      evidence: jsxItem.reason,
      hint: '',
    })
  } else if (!vite) {
    findings.push({
      id: 'jsx',
      title: jsxItem.title,
      required: true,
      status: 'unverified',
      evidence: 'No viteConfig snippet provided — the JSX transform can only be checked in the build config.',
      hint: jsxItem.action,
    })
  } else {
    const hasJsx =
      target === 'vue2'
        ? /@vue\/babel-preset-jsx|plugin-vue2-jsx/.test(vite)
        : /@vitejs\/plugin-vue-jsx|vueJsx\b/.test(vite)
    findings.push({
      id: 'jsx',
      title: jsxItem.title,
      required: true,
      status: hasJsx ? 'ok' : 'missing',
      evidence: hasJsx ? 'Found the JSX plugin in vite.config.' : 'No JSX plugin in vite.config.',
      hint: jsxItem.action,
    })
  }

  return { target, findings, ok: findings.every((f) => !f.required || f.status !== 'missing') }
}

export function formatDoctor(report: DoctorReport): string {
  const icon = (s: DoctorStatus) => (s === 'ok' ? '✅' : s === 'missing' ? '❌' : '⚠️')
  const lines: string[] = [
    '## Doctor — host entry check (static scan)',
    '',
    'Literal scan only: it cannot follow variables or imported modules. `unverified` means "not visible here",',
    'not "fine" — confirm those by hand.',
    '',
  ]
  for (const f of report.findings) {
    lines.push(`- ${icon(f.status)} **${f.title}** — ${f.status}`)
    lines.push(`  - ${f.evidence}`)
    if (f.status !== 'ok') lines.push(`  - Do: ${f.hint}`)
  }
  lines.push('')
  lines.push(
    report.ok
      ? 'All required prerequisites are present or explicitly unverified.'
      : 'At least one required prerequisite is MISSING — the matching capability will be silently inert.',
  )
  return lines.join('\n')
}
