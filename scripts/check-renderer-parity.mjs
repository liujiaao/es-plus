#!/usr/bin/env node
/**
 * 三端 formtype 渲染键集一致性校验
 *
 * 背景：vue3 / vue2 / adapter-antdv 三个渲染器各自维护一份 `formPutList` Map，
 * 历史上曾出现「vue2 独有 InputNumber」「vue3/antdv 存在 datePicker/timePicker 死键」等分叉。
 * 本脚本对三份 use-form-inputs.ts 做静态分析，抽取 Map 键集并断言：
 *   1. 三端键集完全一致（无某端独有/缺失）
 *   2. 键集与 VALID_FORM_TYPES（@es-plus/shared 单源）完全一致
 *   3. 各处 TS 联合类型（FormType / antdv 内联 formtype）成员与 VALID_FORM_TYPES 一致
 *      —— 仅校验运行时 Map 会漏掉「联合类型缺成员」的分叉（如 antdv 内联联合曾漏 InputNumber，
 *      运行时正常但 TS 报错），故一并纳入静态校验闭环。
 *   4. 每个 formtype 在每个渲染器里绑到契约声明的组件（FORM_RENDER_CONTRACT，防「键在、组件被换」）。
 *   5. 每个 formtype 的关键行为真的接通（FORM_BEHAVIOR_CONTRACT，防「键在、组件对、配置静默失效」）。
 *   6. 表格列语义三端一致（COLUMN_CONTRACT：内置列类型 index/selection/expand、groups 深度、
 *      expandConfig、列级 permissionValue/hidCol、声明式合并单元格 mergeConfig）—— 正向 token +
 *      反向 forbid + deviation/knownGaps 原因非空。
 *
 * 用法：
 *   node scripts/check-renderer-parity.mjs            # 校验（CI 用）
 *
 * 退出码：0 = 一致；1 = 检测到分叉。
 */
import { readFileSync } from 'node:fs'
import { fileURLToPath } from 'node:url'
import { dirname, join } from 'node:path'
import { FORM_RENDER_CONTRACT, FORM_BEHAVIOR_CONTRACT, COLUMN_CONTRACT, EMIT_CONTRACT } from './renderer-contract.mjs'

const __dirname = dirname(fileURLToPath(import.meta.url))
const ROOT = join(__dirname, '..')

/**
 * 去掉注释后再做静态匹配 —— 否则「把无用组件名写进注释」就能骗过 token 校验：
 * 例如把 Input 分支的实现换成 ElTimePicker、只在旁边留一行 `// ElInput`，旧实现会放行。
 */
function stripComments(src) {
  return src
    .replace(/\/\*[\s\S]*?\*\//g, '')
    .replace(/(^|[^:])\/\/[^\n]*/g, '$1')
}

const readStripped = (p) => stripComments(readFileSync(join(ROOT, p), 'utf-8'))

const RENDERER_INPUTS = [
  ['vue3', 'packages/vue3/src/composables/use-form-inputs.ts'],
  ['vue2', 'packages/vue2/src/composables/use-form-inputs.ts'],
  ['antdv', 'packages/adapter-antdv/src/composables/use-form-inputs.ts'],
]

const RENDERER_NAMES = RENDERER_INPUTS.map(([name]) => name)

// 权威键集：@es-plus/shared 的 contract.ts 单源（直接读源码，避免依赖 build 产物）
function readValidFormTypes() {
  const src = readStripped('packages/shared/src/contract.ts')
  const m = src.match(/VALID_FORM_TYPES\s*=\s*\[([\s\S]*?)\]/)
  if (!m) throw new Error('无法从 shared/contract.ts 解析 VALID_FORM_TYPES')
  const keys = [...m[1].matchAll(/'([^']+)'/g)].map((x) => x[1])
  return { keys, set: new Set(keys) }
}

/**
 * 抽取 use-form-inputs.ts 中 formPutList Map 的键。
 * 三端键均为 PascalCase，形如独立一行 `        'Input',`。
 * 只取 PascalCase 词（避免误收事件名/图标名等），再与 VALID_FORM_TYPES 比对过滤。
 */
function extractMapKeys(path) {
  const src = readStripped(path)
  const keys = [...src.matchAll(/^\s*'([A-Z][a-zA-Z0-9]*)',\s*$/gm)].map((m) => m[1])
  return { keys, set: new Set(keys) }
}

/**
 * 抽取一个组件文件声明的事件名（已 stripComments）。
 *
 * 支持两种声明形态：
 *   - Vue 3 `<script setup>`：`defineEmits<{ 'update:visible': [v: boolean]; open: [] }>()`
 *   - Vue 2 Options API：`emits: ['update:visible', 'closed', 'open'],`
 *
 * defineEmits 的泛型体用**花括号配平**截取（不能用非贪婪正则 —— 事件参数本身可能含
 * `}`）；块内逐行只认「行首且不在类型元组内部」的 `key:`，避免把 `[formRef: unknown]`
 * 这种参数名当成事件名。
 */
function extractDeclaredEmits(src) {
  const open = src.indexOf('defineEmits<')
  if (open !== -1) {
    const brace = src.indexOf('{', open)
    if (brace !== -1) {
      let depth = 0
      for (let i = brace; i < src.length; i++) {
        if (src[i] === '{') depth++
        else if (src[i] === '}') {
          depth--
          if (depth === 0) return new Set(parseEmitBlock(src.slice(brace + 1, i)))
        }
      }
    }
  }
  const m = src.match(/emits\s*:\s*\[([\s\S]*?)\]/)
  if (m) return new Set([...m[1].matchAll(/'([^']+)'|"([^"]+)"/g)].map((x) => x[1] ?? x[2]))
  return new Set()
}

/** 逐行解析 defineEmits 的类型块：只收顶层（深度 0）的 `key:`。 */
function parseEmitBlock(body) {
  const keys = []
  let depth = 0
  let collecting = false
  let current = ''
  const flush = () => {
    if (collecting) {
      // 逐字符收集会把行首缩进一起收进来，匹配前先去掉空白。
      const m = current.trim().match(/^(?:'([^']+)'|"([^"]+)"|([A-Za-z_$][\w$]*))\s*:/)
      if (m) keys.push(m[1] ?? m[2] ?? m[3])
    }
    current = ''
    collecting = false
  }
  for (const ch of body) {
    if (ch === '\n') {
      flush()
      collecting = depth === 0
      continue
    }
    if (!collecting && depth === 0 && ch !== ' ' && ch !== '\t') collecting = true
    if (collecting) current += ch
    if (ch === '(' || ch === '[' || ch === '{') depth++
    else if (ch === ')' || ch === ']' || ch === '}') depth--
  }
  flush()
  return keys
}

/** 同一文件里是否存在该事件的 emit 调用点（已 stripComments）。 */
function hasEmitCallSite(src, key) {
  const esc = key.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')
  return new RegExp(`\\bemit\\s*\\(\\s*['"]${esc}['"]`).test(src)
}

/**
 * TS 联合类型静态校验源：从指定文件中用正则截出一段联合声明，抽取其 '成员' 字面量。
 * - core FormType：`export type FormType =\n  | 'Input'\n  | ...`
 * - antdv 内联：`formtype?: 'Input' | 'Select' | ...`（单行）
 * 抽取后与 VALID_FORM_TYPES 双向比对（缺成员 / 多成员均报错）。
 */
const UNION_SOURCES = [
  {
    name: 'core FormType 联合 (packages/core/src/types.ts)',
    path: 'packages/core/src/types.ts',
    // 截取 `export type FormType =` 到下一个非联合行（首个不以 | 开头的分号/声明）之间
    slice: /export\s+type\s+FormType\s*=\s*([\s\S]*?)(?:\n\s*\n|\nexport |\/\*\*)/,
  },
  {
    name: 'antdv 内联 formtype 联合 (packages/adapter-antdv/src/types/index.ts)',
    path: 'packages/adapter-antdv/src/types/index.ts',
    slice: /formtype\?:\s*([^\n]+)/,
  },
]

/**
 * 抽取每个 formtype 键**到下一个键之间**的源码窗口。
 * 行为层校验用：只要该 key 的窗口里出现契约声明的组件 token，就认为实现未被换掉。
 *
 * 窗口上界必须止于 Map 字面量的收尾（`])`），不能一路切到文件尾：最后一个分支的
 * 「窗口」原本会吞掉文件后半段（模块级的 renderXxx 辅助函数、类型声明…），那些
 * 与分支无关的代码会污染窗口内的 token 统计。实测就是 antdv 的 Upload 分支窗口
 * 因为一路到 EOF 而「含有」renderDatePicker / renderTimePicker 两个它根本没用的 token。
 */
function mapEndIndex(src) {
  const open = src.indexOf('new Map')
  if (open < 0) return src.length
  const rel = src.slice(open).search(/\n\s*\]\s*\)/)
  return rel < 0 ? src.length : open + rel
}

function extractBranchWindows(path) {
  const src = readStripped(path)
  const keys = [...src.matchAll(/^\s*'([A-Z][a-zA-Z0-9]*)',\s*$/gm)].map((m) => ({
    key: m[1],
    i: m.index,
  }))
  const end = mapEndIndex(src)
  const map = new Map()
  for (let k = 0; k < keys.length; k++) {
    const stop = k + 1 < keys.length ? Math.min(keys[k + 1].i, end) : end
    map.set(keys[k].key, src.slice(keys[k].i, stop))
  }
  return map
}

/** 把契约 token 转成匹配正则：含 `-` 或全小写视为标签/字符串（带引号匹配），否则按标识符单词边界 */
function tokenRe(token) {
  const esc = token.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')
  return /-/.test(token) || token === token.toLowerCase()
    ? new RegExp(`['"\`]${esc}['"\`]`)
    : new RegExp(`\\b${esc}\\b`)
}

function extractUnionMembers({ path, slice }) {
  const src = readStripped(path)
  const m = src.match(slice)
  if (!m) return null
  const keys = [...m[1].matchAll(/'([A-Za-z][a-zA-Z0-9]*)'/g)].map((x) => x[1])
  return { keys, set: new Set(keys) }
}

function main() {
  const valid = readValidFormTypes()
  let fail = false

  const rendererSets = {}
  for (const [name, path] of RENDERER_INPUTS) {
    const { keys, set } = extractMapKeys(path)
    rendererSets[name] = set

    // 1. 该端键集与权威键集一致（双向：无缺失、无多余）
    const missing = valid.keys.filter((k) => !set.has(k))
    const extra = keys.filter((k) => !valid.set.has(k))
    if (missing.length || extra.length) {
      fail = true
      console.error(`❌ ${name} formPutList 键集漂移：`)
      if (missing.length) console.error(`   缺失（VALID_FORM_TYPES 有而该端无）：${missing.join(', ')}`)
      if (extra.length) console.error(`   多余（该端有而 VALID_FORM_TYPES 无）：${extra.join(', ')}`)
    }
  }

  // 2. 三端彼此一致
  const [a, b, c] = RENDERER_INPUTS.map(([n]) => n)
  for (const [x, y] of [[a, b], [a, c], [b, c]]) {
    const sx = rendererSets[x]
    const sy = rendererSets[y]
    const onlyX = [...sx].filter((k) => !sy.has(k))
    const onlyY = [...sy].filter((k) => !sx.has(k))
    if (onlyX.length || onlyY.length) {
      fail = true
      console.error(`❌ ${x} 与 ${y} 键集不一致：${x}独有 [${onlyX}] / ${y}独有 [${onlyY}]`)
    }
  }

  // 3. TS 联合类型成员与 VALID_FORM_TYPES 一致（弥补「只校验运行时 Map」的盲区）
  for (const source of UNION_SOURCES) {
    const parsed = extractUnionMembers(source)
    if (!parsed) {
      fail = true
      console.error(`❌ 无法从 ${source.name} 解析联合类型成员（选择器失效，请检查脚本）`)
      continue
    }
    const missing = valid.keys.filter((k) => !parsed.set.has(k))
    const extra = parsed.keys.filter((k) => !valid.set.has(k))
    if (missing.length || extra.length) {
      fail = true
      console.error(`❌ ${source.name} 与 VALID_FORM_TYPES 不一致：`)
      if (missing.length) console.error(`   缺成员（VALID_FORM_TYPES 有而联合无）：${missing.join(', ')}`)
      if (extra.length) console.error(`   多成员（联合有而 VALID_FORM_TYPES 无）：${extra.join(', ')}`)
    }
  }

  // 4. 行为层：每个 formtype 在每个渲染器里必须绑到契约声明的组件（不只是键存在）
  const contractKeys = Object.keys(FORM_RENDER_CONTRACT)
  const contractMissing = valid.keys.filter((k) => !(k in FORM_RENDER_CONTRACT))
  const contractExtra = contractKeys.filter((k) => !valid.set.has(k))
  if (contractMissing.length || contractExtra.length) {
    fail = true
    console.error('❌ renderer-contract 与 VALID_FORM_TYPES 不一致：')
    if (contractMissing.length) console.error(`   contract 缺：${contractMissing.join(', ')}`)
    if (contractExtra.length) console.error(`   contract 多：${contractExtra.join(', ')}`)
  }
  for (const [name, path] of RENDERER_INPUTS) {
    const windows = extractBranchWindows(path)
    for (const key of valid.keys) {
      const entry = FORM_RENDER_CONTRACT[key]
      if (!entry) continue
      const tokens = entry[name] || []
      const win = windows.get(key)
      if (win === undefined) {
        fail = true
        console.error(`❌ ${name}: 未定位到 formtype '${key}' 的渲染分支`)
        continue
      }
      if (!tokens.some((t) => tokenRe(t).test(win))) {
        fail = true
        console.error(
          `❌ ${name}: formtype '${key}' 的分支未绑定契约组件（期望其一：${tokens.join(' / ')}）—— 实现可能被换成了别的控件`
        )
        continue
      }

      // 4b. 反向断言：窗口里不得出现**其它** formtype 的契约组件 token。
      // 只做正向匹配时，「把实现换成别的控件、顺手在窗口里留一个非注释的期望 token」
      // 就能通过 —— 实测：DatePicker 分支换成 ElInput、旁边留一个死掉的 ElDatePicker
      // 引用即可（正向匹配只看「有没有」，不看「是不是真的在用」）。
      // 成对断言把「换了控件」这件事变成两个信号：期望 token 还在 + 别的控件 token 不该在。
      //
      // 该端若对该 formtype 已登记 deviation（有意的差异/降级实现），豁免此项 ——
      // 差异实现天然可能引用别的控件，这是既有且已文档化的机制，不再另立登记表。
      if (entry.deviation && entry.deviation[name]) continue
      const foreign = []
      for (const other of contractKeys) {
        if (other === key) continue
        for (const t of FORM_RENDER_CONTRACT[other][name] || []) {
          if (tokenRe(t).test(win)) foreign.push(`${other}(${t})`)
        }
      }
      if (foreign.length) {
        fail = true
        console.error(
          `❌ ${name}: formtype '${key}' 的分支出现了别的 formtype 的契约组件：${foreign.join(', ')}` +
            ` —— 实现可能已被换掉（若为有意的交叉引用，请在该 formtype 登记 deviation 说明原因）`
        )
      }
    }
  }
  // 5. 行为层：组件绑对了还不够 —— 必须真的接通行为（Upload 写回 model、Transfer 吃 dataOptions）。
  //    这一层专门挡 C 系列那种「键在、组件对、编译过、全绿，但配置静默失效」的缺陷：
  //    vue3 的 Upload 曾连 fileList 都没绑、Transfer 从不读 dataOptions，而上面 1~4 全绿。
  const behaviorKeys = Object.keys(FORM_BEHAVIOR_CONTRACT)
  const behaviorOrphans = behaviorKeys.filter((k) => !valid.set.has(k) || !(k in FORM_RENDER_CONTRACT))
  if (behaviorOrphans.length) {
    fail = true
    console.error(
      `❌ renderer-contract 的 FORM_BEHAVIOR_CONTRACT 含未知 formtype（不在 VALID_FORM_TYPES / FORM_RENDER_CONTRACT 中）：${behaviorOrphans.join(', ')}`
    )
  }
  for (const [name, path] of RENDERER_INPUTS) {
    const windows = extractBranchWindows(path)
    for (const [key, behaviors] of Object.entries(FORM_BEHAVIOR_CONTRACT)) {
      const win = windows.get(key)
      if (win === undefined) continue // 4 已经报过「未定位到分支」
      for (const [behaviorId, spec] of Object.entries(behaviors)) {
        if (spec.deviation && spec.deviation[name]) continue // 有意的差异实现，由下面的原因检查兜底
        const tokens = spec.tokens[name] || []
        const missed = tokens.filter((t) => !tokenRe(t).test(win))
        if (missed.length) {
          fail = true
          console.error(
            `❌ ${name}: formtype '${key}' 的渲染分支未接通行为 ${behaviorId}（缺 token：${missed.join(' / ')}）` +
              `\n   ${spec.why}` +
              `\n   要么接线，要么在该行为上登记 deviation 并写明原因。`
          )
        }
      }
    }
  }

  // 6. 列语义层：三端对表格列的处理（默认引擎 + vxe/虚拟引擎）必须与 COLUMN_CONTRACT 一致。
  //    前 1~5 只覆盖 formtype；表格列是另一条独立渲染路径，本块把它纳入同一套 token 机制。
  //    每端把 sources 逐文件 stripComments 后拼接再匹配 —— 注释里的 token 不算数
  //    （例如 antdv 的 rowSelection 只在注释里出现，真实接线在 component.vue）。
  for (const [rowId, row] of Object.entries(COLUMN_CONTRACT)) {
    for (const name of RENDERER_NAMES) {
      const sources = row.sources?.[name] || []
      const tokens = row.tokens?.[name] || []
      const forbid = row.forbid?.[name] || []
      // 6c. 结构完整：声明了断言却漏声明 sources 会**静默不检**，必须报错而非放过。
      if ((tokens.length || forbid.length) && sources.length === 0) {
        fail = true
        console.error(
          `❌ COLUMN_CONTRACT ${rowId}/${name}: 声明了 tokens/forbid 却未声明 sources —— 会静默漏检`
        )
        continue
      }
      if (sources.length === 0) continue
      const text = sources.map(readStripped).join('\n')
      // 6a. 正向：契约 token 必须全部出现（组内 AND）。
      const missed = tokens.filter((t) => !tokenRe(t).test(text))
      if (missed.length) {
        fail = true
        console.error(
          `❌ ${rowId}/${name}: 列语义漂移 —— 缺 token [${missed.join(' / ')}]` +
            `\n   ${row.why}` +
            `\n   sources: ${sources.join(', ')}`
        )
      }
      // 6b. 反向：契约 forbid token 一个都不许出现（钉住「原生透传 / 只展 1 层」这类否定事实）。
      const hit = forbid.filter((t) => tokenRe(t).test(text))
      if (hit.length) {
        fail = true
        console.error(
          `❌ ${rowId}/${name}: 列语义漂移 —— 出现禁止的 token [${hit.join(' / ')}]` +
            `\n   ${row.why}` +
            `\n   sources: ${sources.join(', ')}`
        )
      }
    }
  }

  // deviation 必须写明原因（文档化强制）
  for (const [key, entry] of Object.entries(FORM_RENDER_CONTRACT)) {
    if (!entry.deviation) continue
    for (const [renderer, reason] of Object.entries(entry.deviation)) {
      if (!reason || !reason.trim()) {
        fail = true
        console.error(`❌ ${key}/${renderer}: deviation 未说明原因`)
      }
    }
  }
  // 行为层的 deviation 同样必须写明原因，且不得是空串占位
  for (const [key, behaviors] of Object.entries(FORM_BEHAVIOR_CONTRACT)) {
    for (const [behaviorId, spec] of Object.entries(behaviors)) {
      if (!spec.deviation) continue
      for (const [renderer, reason] of Object.entries(spec.deviation)) {
        if (!reason || !reason.trim()) {
          fail = true
          console.error(`❌ ${key}/${behaviorId}/${renderer}: deviation 未说明原因`)
        }
      }
    }
  }
  // 列契约的 deviation / knownGaps 原因同样非空强制（空串占位会红）。
  // deviation = 跨端有意差异；knownGaps = 三端一致的已知限制 —— 两者都要求写明原因。
  for (const [rowId, row] of Object.entries(COLUMN_CONTRACT)) {
    for (const [renderer, reason] of Object.entries(row.deviation || {})) {
      if (!reason || !reason.trim()) {
        fail = true
        console.error(`❌ COLUMN_CONTRACT ${rowId}/${renderer}: deviation 未说明原因`)
      }
    }
    for (const [renderer, reason] of Object.entries(row.knownGaps || {})) {
      if (!reason || !reason.trim()) {
        fail = true
        console.error(`❌ COLUMN_CONTRACT ${rowId}/${renderer}: knownGaps 未说明原因`)
      }
    }
  }

  // 7. 事件契约层：三端组件「声明了的事件」必须①三端一致（或登记有意缺席）②真有 emit 调用点。
  //    只查 formtype/列语义时，两个真实缺陷都看不见：
  //      - vue3/antdv 的 es-form 声明 confirm/reset，却零调用点（宿主 @confirm 得到静默）；
  //      - antdv 的 es-dialog 漏声明 open（同端宿主代码在 vue3/vue2 触发、在这里静默）。
  for (const [component, spec] of Object.entries(EMIT_CONTRACT)) {
    const expected = new Set(spec.expected || [])
    for (const name of RENDERER_NAMES) {
      const file = spec.sources?.[name]
      if (!file) {
        fail = true
        console.error(`❌ EMIT_CONTRACT ${component}/${name}: 未声明 sources —— 会静默漏检`)
        continue
      }
      const text = readStripped(file)
      const declared = extractDeclaredEmits(text)
      const dev = spec.deviation?.[name]
      if (dev && (!dev.reason || !dev.reason.trim())) {
        fail = true
        console.error(`❌ EMIT_CONTRACT ${component}/${name}: deviation 未说明原因`)
      }
      const exempt = new Set(dev?.keys || [])
      for (const k of exempt) {
        if (!expected.has(k)) {
          fail = true
          console.error(
            `❌ EMIT_CONTRACT ${component}/${name}: deviation.keys 里的 '${k}' 不在 expected —— 登记错位（豁免不了任何东西）`
          )
        }
      }
      // 7a. 该端缺事件：expected − exempt 内的必须全部声明。
      const missing = [...expected].filter((k) => !declared.has(k) && !exempt.has(k))
      if (missing.length) {
        fail = true
        console.error(
          `❌ EMIT_CONTRACT ${component}/${name}: 缺事件 [${missing.join(' / ')}]` +
            `\n   ${spec.why || ''}` +
            `\n   ${file}`
        )
      }
      // 7b. 该端多事件：声明了契约之外的事件 —— 要么进 expected，要么显式登记。
      const extra = [...declared].filter((k) => !expected.has(k))
      if (extra.length) {
        fail = true
        console.error(
          `❌ EMIT_CONTRACT ${component}/${name}: 契约未收录的事件 [${extra.join(' / ')}] —— ` +
            `跨端口径无法核对；请进 expected 或登记 deviation`
        )
      }
      // 7c. 登记只减不增：该端已经声明了登记为「缺席」的事件 ⟹ 删掉登记行。
      const stale = [...exempt].filter((k) => declared.has(k))
      if (stale.length) {
        fail = true
        console.error(
          `❌ EMIT_CONTRACT ${component}/${name}: 陈旧登记 [${stale.join(' / ')}] —— ` +
            `该端已声明它，必须从 deviation.keys 删除（只减不增）`
        )
      }
      // 7d. 声明 ⇄ 存在：每个声明的事件都必须至少有一个 emit 调用点。
      for (const k of declared) {
        if (!hasEmitCallSite(text, k)) {
          fail = true
          console.error(
            `❌ EMIT_CONTRACT ${component}/${name}: 声明了 '${k}' 却没有任何 emit 调用点 —— ` +
              `宿主写 @${k.replace(/^update:/, '')} 只会得到静默（声明了却不存在的能力）\n   ${file}`
          )
        }
      }
    }
  }

  if (fail) {
    console.error('\n三端 formtype 键集/联合类型/组件绑定、或表格列语义存在分叉，请统一到 VALID_FORM_TYPES + renderer-contract 单源。')
    process.exit(1)
  }

  const behaviorCount = Object.values(FORM_BEHAVIOR_CONTRACT).reduce(
    (n, b) => n + Object.keys(b).length,
    0
  )
  const columnCount = Object.keys(COLUMN_CONTRACT).length
  console.log(
    `✅ 三端 formPutList 键集 + TS 联合类型 + 组件绑定 + ${behaviorCount} 条行为契约 + ${columnCount} 条列契约一致（${valid.keys.length} 项 formtype），与 VALID_FORM_TYPES / renderer-contract 单源同步`
  )
}

main()
