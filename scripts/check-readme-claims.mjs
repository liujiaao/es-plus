#!/usr/bin/env node
/**
 * README 数字声明 ↔ 源码事实 校验
 *
 * 背景：README 里的「N 个跨渲染器契约类型」长期写作 38，而 `PUBLIC_CONTRACT_TYPES`
 * 实际只有 35 项 —— 没有任何检查覆盖这层，数字一旦写错就永久漂移。
 * 同理「14 种表单控件」既有数字也有枚举，枚举还可能与 `VALID_FORM_TYPES` 分叉。
 *
 * 本脚本做的是**相等性**校验（不是「出现过某名字」式的启发式）：
 *   1. README 声明的契约类型数量 == PUBLIC_CONTRACT_TYPES.length
 *   2. README 声明的表单控件数量 == VALID_FORM_TYPES.length
 *   3. README 列出的控件枚举 == VALID_FORM_TYPES 的集合
 *
 * 用法：node scripts/check-readme-claims.mjs
 * 退出码：0 = 一致；1 = 发现漂移。
 */
import { readFileSync, existsSync, readdirSync } from 'node:fs'
import { fileURLToPath } from 'node:url'
import { dirname, join } from 'node:path'
import { FEWSHOT_DERIVED } from './eval/fewshot-derived.mjs'
import { isCrudCase } from './eval/scenes.mjs'

const __dirname = dirname(fileURLToPath(import.meta.url))
const ROOT = join(__dirname, '..')
const read = (p) => readFileSync(join(ROOT, p), 'utf-8')

let failed = false
const fail = (msg) => {
  failed = true
  console.error(`❌ ${msg}`)
}

/** PUBLIC_CONTRACT_TYPES 的运行时清单（运行时 as const 数组，单一权威源） */
function readContractTypes() {
  const src = read('packages/core/src/public-types.ts')
  const m = src.match(/PUBLIC_CONTRACT_TYPES\s*=\s*\[([\s\S]*?)\]\s*as const/)
  if (!m) {
    fail('未能在 core/public-types.ts 定位 PUBLIC_CONTRACT_TYPES')
    return null
  }
  return (m[1].match(/'[^']+'/g) || []).map((s) => s.slice(1, -1))
}

/** VALID_FORM_TYPES（core/constants.ts） */
function readFormTypes() {
  const src = read('packages/core/src/constants.ts')
  const m = src.match(/VALID_FORM_TYPES\s*=\s*\[([\s\S]*?)\]\s*as const/)
  if (!m) {
    fail('未能在 core/constants.ts 定位 VALID_FORM_TYPES')
    return null
  }
  return (m[1].match(/'[^']+'/g) || []).map((s) => s.slice(1, -1))
}

// ── 1. 契约类型数量 ─────────────────────────────────────
function checkContractTypeCount(contractTypes) {
  const targets = [
    { file: 'README.md', re: /(\d+)\s*个跨渲染器契约类型/ },
    { file: 'README.en.md', re: /(\d+)\s*cross-renderer contract types/ },
  ]
  for (const { file, re } of targets) {
    const src = read(file)
    const m = src.match(re)
    if (!m) {
      fail(`${file} 未找到「跨渲染器契约类型」的数量声明（若删除了该表述，请同步本脚本）`)
      continue
    }
    const claimed = Number(m[1])
    if (claimed !== contractTypes.length) {
      fail(
        `${file} 声明 ${claimed} 个跨渲染器契约类型，实际 PUBLIC_CONTRACT_TYPES 有 ${contractTypes.length} 个`
      )
    } else {
      console.log(`✅ ${file} 契约类型数量一致（${claimed} 个）`)
    }
  }
}

// ── 2/3. 表单控件数量与枚举 ─────────────────────────────
function checkFormTypes(formTypes) {
  const readme = read('README.md')

  // 2. 数量（README 中出现两处：「N 种表单控件」与表格里的「控件类型（N 种）」）
  const counts = [...readme.matchAll(/(\d+)\s*种表单控件|控件类型（(\d+)\s*种）/g)].map((m) =>
    Number(m[1] ?? m[2])
  )
  if (!counts.length) {
    // 找不到声明就失败，不静默跳过 —— 否则「把这段文案删掉」就成了让断言失效的开关，
    // 与上面契约类型数量那项的处理保持一致（同类断言应同规）。
    fail('README.md 未找到表单控件数量声明（若删除了该表述，请同步本脚本）')
  } else {
    for (const c of counts) {
      if (c !== formTypes.length) {
        fail(`README.md 声明 ${c} 种表单控件，实际 VALID_FORM_TYPES 有 ${formTypes.length} 种`)
      }
    }
    if (counts.every((c) => c === formTypes.length)) {
      console.log(`✅ README.md 表单控件数量一致（${formTypes.length} 种，共 ${counts.length} 处声明）`)
    }
  }

  // 3. README 中「14 种表单控件 — A、B、C…」那一行的枚举必须与源码集合完全一致
  const listLine = readme.match(/\*\*\d+\s*种表单控件\*\*\s*—\s*([^\n]+)/)
  if (!listLine) {
    fail('README.md 未列出控件枚举明细（若删除了该表述，请同步本脚本）')
    return
  }
  const listed = listLine[1]
    .split(/[、,]/)
    .map((s) => s.trim())
    .filter(Boolean)
  const missing = formTypes.filter((t) => !listed.includes(t))
  const extra = listed.filter((t) => !formTypes.includes(t))
  if (missing.length || extra.length) {
    fail(
      'README.md 的控件枚举与 VALID_FORM_TYPES 不一致：' +
        (missing.length ? `缺少 [${missing.join(', ')}]；` : '') +
        (extra.length ? `多出 [${extra.join(', ')}]` : '')
    )
  } else {
    console.log(`✅ README.md 控件枚举与源码集合一致（${listed.length} 项）`)
  }
}

// ── 4. 「减少 N% 代码量」必须等于实测降幅 ────────────────
// README 长期写「减少 70% 代码量」，与站点上那张对比卡是同一个数字 ——
// 而站点那边的口径（模板 + 事件胶水代码）实测是 76.5%。两处必须同源，
// 否则又是「同一事实两个数字」。实测值来自 docs/brand/one-config-diff.json。
function checkReductionClaim() {
  const p = join(ROOT, 'docs/brand/one-config-diff.json')
  if (!existsSync(p)) {
    fail('缺少 docs/brand/one-config-diff.json（运行 `npm run one-config:gen` 生成）')
    return
  }
  const measured = JSON.parse(readFileSync(p, 'utf-8')).metrics.markupPlusGlue.reduction
  const targets = [
    { file: 'README.md', re: /模板与事件胶水代码减少\s*(\d+(?:\.\d+)?)\s*%/ },
    { file: 'README.en.md', re: /(\d+(?:\.\d+)?)%\s*less markup and event glue code/ },
  ]
  for (const { file, re } of targets) {
    const src = read(file)
    const m = src.match(re)
    if (!m) {
      fail(
        `${file} 未找到「减少 N% 模板与事件胶水代码」的声明（若改了表述，请同步本断言）`,
      )
      continue
    }
    if (Math.abs(Number(m[1]) - measured) > 0.05) {
      fail(`${file} 声明减少 ${m[1]}%，实测（模板+事件胶水代码）是 ${measured}%`)
    } else {
      console.log(`✅ ${file} 的降幅声明与实测一致（${m[1]}%）`)
    }
  }
}

// ── 5. vue3 README 的 EsDialog API 表 ↔ 源码事实 ────────
// 背景：README 曾列出 `confirmText`/`cancelText`（vue3/vue2 只声明、模板零读取）
// 与 `submit` 事件（源码从未 emit）。幻影能力写进文档会被宿主与 AI 直接采信，
// 比代码缺陷更难发现 —— 故这里做相等性校验：
//   Props 表 ⊆ 且 ⊇ defineProps 键；Events 表 ⊆ 且 ⊇ defineEmits 键。
function checkEsDialogApiClaims() {
  const readme = read('packages/vue3/README.md')
  const at = readme.indexOf('## EsDialog 弹窗组件')
  if (at === -1) {
    fail('packages/vue3/README.md 未找到「## EsDialog 弹窗组件」小节（若改了标题，请同步本脚本）')
    return
  }
  const rest = readme.slice(at)
  const nextH2 = rest.search(/\n## /)
  const section = nextH2 === -1 ? rest : rest.slice(0, nextH2)

  const tableRows = (heading) => {
    const i = section.indexOf(heading)
    if (i === -1) return null
    const body = section.slice(i + heading.length)
    const stop = body.search(/\n#{2,3} /)
    const block = stop === -1 ? body : body.slice(0, stop)
    // 首列即 API 名；跳过分隔行（---）与表头（属性/事件）
    return [...block.matchAll(/^\|\s*([A-Za-z_$][\w:$]*)\s*\|/gm)]
      .map((m) => m[1])
      .filter((k) => !['属性', '事件', '参数'].includes(k))
  }

  const docProps = tableRows('### Props')
  const docEvents = tableRows('### Events')
  if (!docProps || !docProps.length) {
    fail('EsDialog 小节未找到 Props 表（若改了结构，请同步本脚本）')
    return
  }
  if (!docEvents) {
    fail('EsDialog 小节未找到 Events 表（若改了结构，请同步本脚本）')
    return
  }

  const src = read('packages/vue3/src/components/es-dialog/src/component.vue')
  const propsBlock = src.match(/defineProps<\{([\s\S]*?)\}>\(\)/)
  const emitsBlock = src.match(/defineEmits<\{([\s\S]*?)\}>\(\)/)
  if (!propsBlock || !emitsBlock) {
    fail('未能从 vue3 es-dialog 源码定位 defineProps / defineEmits（若改了写法，请同步本脚本）')
    return
  }
  const codeProps = [...propsBlock[1].matchAll(/^\s*([A-Za-z_$][\w$]*)\??\s*:/gm)].map((m) => m[1])
  const codeEvents = [...emitsBlock[1].matchAll(/^\s*'?([\w:]+)'?\s*:/gm)].map((m) => m[1])

  const diff = (doc, code, label) => {
    const missing = code.filter((k) => !doc.includes(k)) // 源码有、文档没有
    const extra = doc.filter((k) => !code.includes(k)) // 文档有、源码没有（幻影）
    if (missing.length || extra.length) {
      fail(
        `EsDialog ${label} 表与源码不一致：` +
          (extra.length ? `文档多出 [${extra.join(', ')}]（源码未声明）；` : '') +
          (missing.length ? `文档缺少 [${missing.join(', ')}]` : '')
      )
    } else {
      console.log(`✅ es-dialog ${label} 表与源码声明一致（${doc.length} 项）`)
    }
  }
  diff(docProps, codeProps, 'Props')
  diff(docEvents, codeEvents, 'Events')
}

// ── 5b. 「声明了却零读取」的幻影 prop（三端）────────────
// confirmText/cancelText 正是这一类：props 里有、模板与脚本从不读，却被文档宣传。
// 判据：标识符在组件文件中的出现次数必须 > 1（至少 1 处声明 + 1 处真实读取）。
// 这比「文档↔声明」更严：能咬住三端各自悄悄多出来的死 prop。
function checkPhantomDialogProps() {
  const ends = [
    { file: 'packages/vue3/src/components/es-dialog/src/component.vue', kind: 'generic', label: 'vue3' },
    { file: 'packages/vue2/src/components/es-dialog/component.vue', kind: 'options', label: 'vue2' },
    { file: 'packages/adapter-antdv/src/components/es-dialog/src/component.vue', kind: 'generic', label: 'antdv' },
  ]
  for (const { file, kind, label } of ends) {
    // 先归一化行尾：仓内 .vue 在 Windows 检出为 CRLF，`\n  },` 这类锚点会失配。
    const src = read(file).replace(/\r\n/g, '\n')
    const block =
      kind === 'generic'
        ? src.match(/defineProps<\{([\s\S]*?)\}>\(\)/)?.[1]
        : src.match(/props:\s*\{([\s\S]*?)\n\s{2}\},\n\s{2}emits/)?.[1]
    if (!block) {
      fail(`未能从 ${label} es-dialog 源码定位 props 声明（若改了写法，请同步本脚本）`)
      continue
    }
    const names = [
      ...new Set([...block.matchAll(/^\s{2,4}([A-Za-z_$][\w$]*)\s*[?:]?\s*[:(]/gm)].map((m) => m[1])),
    ]
    const phantoms = names.filter((n) => {
      const occurrences = src.match(new RegExp(`\\b${n}\\b`, 'g')) || []
      return occurrences.length < 2
    })
    if (phantoms.length) {
      fail(`${label} es-dialog 的 prop [${phantoms.join(', ')}] 只声明、从不读取（幻影能力）`)
    } else {
      console.log(`✅ ${label} es-dialog 无只声明不读取的 prop（${names.length} 个）`)
    }
  }
}

// ── 5c. vue3 README 的 useDialog DialogOptions 表 ↔ core 类型 ────
// 背景：该表长期照抄 legacy `dialog-options.schema.json`（含 `height`/`key`/`center`/
// `showDefaultButtons`/`lockScroll`/`customClass`/`appendToBody`/`onlyInstance`/`onOpen`
// 九个 core 未命名的键），同时漏掉 core 真实命名、运行时真消费的
// `visible`/`beforeClose`/`cacheKey`/`alignCenter`/`top`/`modalClass`。
// `[key: string]: unknown` 索引签名让「漏命名」不报类型错 —— 只能靠本断言盯住。
// 判据：文档表集合 === core `DialogOptions` 的命名键集合（索引签名不计）。
function checkDialogOptionsClaims() {
  const readme = read('packages/vue3/README.md')
  const i = readme.indexOf('### DialogOptions 配置')
  if (i === -1) {
    fail('packages/vue3/README.md 未找到「### DialogOptions 配置」小节（若改了标题，请同步本脚本）')
    return
  }
  const body = readme.slice(i + '### DialogOptions 配置'.length)
  const stop = body.search(/\n#{2,3} /)
  const block = stop === -1 ? body : body.slice(0, stop)
  const docKeys = [...block.matchAll(/^\|\s*([A-Za-z_$][\w$]*)\s*\|/gm)]
    .map((m) => m[1])
    .filter((k) => !['参数', '属性', '事件'].includes(k))

  const src = read('packages/core/src/types.ts').replace(/\r\n/g, '\n')
  const iface = src.match(/export interface DialogOptions\s*\{([\s\S]*?)\n\}/)?.[1]
  if (!iface) {
    fail('未能从 core/src/types.ts 定位 `export interface DialogOptions`（若改了写法，请同步本脚本）')
    return
  }
  const codeKeys = [...iface.matchAll(/^\s{2}([A-Za-z_$][\w$]*)\??\s*:/gm)]
    .map((m) => m[1])
    .filter((k) => k !== 'key') // 排除索引签名 [key: string]: unknown 前先看它不匹配本正则

  const missing = codeKeys.filter((k) => !docKeys.includes(k))
  const extra = docKeys.filter((k) => !codeKeys.includes(k))
  if (missing.length || extra.length) {
    fail(
      'useDialog DialogOptions 表与 core 类型不一致：' +
        (extra.length ? `文档多出 [${extra.join(', ')}]（core 未命名）；` : '') +
        (missing.length ? `文档缺少 [${missing.join(', ')}]` : '')
    )
  } else {
    console.log(`✅ useDialog DialogOptions 表与 core 类型一致（${docKeys.length} 项）`)
  }
}

// ── 6. 语料规模声明（crud 例数 / heldout 例数）必须从语料本身派生 ──────
// README 曾写「语料目前 188 例（留出 166 例）」，而语料已长到 216/194 —— 数字是手写的，
// 就一定会漂。这里按与 eval 同一口径现算：crud = isCrudCase 的用例，heldout = crud 去掉
// few-shot 派生登记（scripts/eval/fewshot-derived.mjs）。README 两语种各一处声明。
function checkCorpusSizeClaim() {
  const dir = join(ROOT, '__tests__', 'golden', 'cases')
  const files = readdirSync(dir).filter((f) => f.endsWith('.json'))
  let crud = 0
  let heldout = 0
  for (const f of files) {
    const raw = JSON.parse(readFileSync(join(dir, f), 'utf-8'))
    if (!isCrudCase(raw)) continue
    crud++
    if (!FEWSHOT_DERIVED.has(f)) heldout++
  }

  const targets = [
    { file: 'README.md', re: /语料目前\s*(\d+)\s*例（留出\s*(\d+)\s*例）/ },
    { file: 'README.en.md', re: /The corpus is\s*(\d+)\s*cases today\s*\((\d+)\s*heldout\)/ },
  ]
  for (const { file, re } of targets) {
    const m = read(file).match(re)
    if (!m) {
      fail(`${file} 未找到语料规模声明（若改了表述，请同步本脚本）`)
      continue
    }
    const [, claimedCrud, claimedHeldout] = m.map(Number)
    if (claimedCrud !== crud || claimedHeldout !== heldout) {
      fail(
        `${file} 声明语料 ${claimedCrud} 例（留出 ${claimedHeldout}），实际 crud ${crud} 例（heldout ${heldout}）`
      )
    } else {
      console.log(`✅ ${file} 语料规模一致（crud ${crud} / heldout ${heldout}）`)
    }
  }
}

const contractTypes = readContractTypes()
const formTypes = readFormTypes()
if (contractTypes) checkContractTypeCount(contractTypes)
if (formTypes) checkFormTypes(formTypes)
checkReductionClaim()
checkEsDialogApiClaims()
checkPhantomDialogProps()
checkDialogOptionsClaims()
checkCorpusSizeClaim()

if (failed) {
  console.error('\nREADME 声明与源码事实不符 —— 请修正 README 或本脚本的匹配规则。')
  process.exit(1)
}
console.log('\nREADME 数字声明 ↔ 源码事实 ✅')
