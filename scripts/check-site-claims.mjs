#!/usr/bin/env node
/**
 * 站点数字声明 ↔ 实测事实 校验
 *
 * 背景：README 的数字早就有 check-readme-claims.mjs 守着（「35 个跨渲染器契约类型」
 * 就是这个守卫修掉的），但**站点文案的数字一个门禁都没有**。实测到的漂移：
 *   - 首页对比卡自称「30 行替代 200 行 / 减少 70%」，而 slogal.json 写「30 行 vs 250 行」、
 *     locales 写「~200 行」、卡内注释写「约 150 行业务逻辑」—— 四处数字互不相同，
 *     且展示出来的两段代码实测只有 19 vs 31 行；
 *   - 英文首页 stat「2 Vue renderers」而中文写「3」（三端确实有三个渲染器）；
 *   - 英文 feature3Title 写「One schema, two renderers」，同一条的 desc 却列了三个；
 *   - Element UI 站首页写「18+ 控件类型」，实际 VALID_FORM_TYPES 是 14，且该站自己的
 *     介绍页写的是 14。
 * 这些数字全都在没有任何校验的地方自由漂移，而它们恰恰是「可验证」这个卖点本身。
 *
 * 本脚本做**相等性**校验（不是「出现过某词」式的启发式）：
 *   1. 「一份配置」的降幅/行数：slogan.json 的承诺文案、zh/en locales 的 stats 与副标题，
 *      必须等于 docs/brand/one-config-diff.json 实测出来的值（±0.5pp 舍入容差）；
 *   2. 渲染器数量：zh/en 的 stat1Value 必须等于三站 SITES 数组长度（3）；
 *   3. 英文 feature3Title 不得再出现「two renderers」这种与三端矛盾的说法；
 *   4. 表单控件数量：站点文档（es-plus-docs/src/docs/*.md，changelog 除外）里的
 *      「N 种 formtype / N 种控件」必须等于 VALID_FORM_TYPES.length；
 *   5. 三站首页不得出现各自为政的控件数量（如 18+）。
 *
 * 用法：node scripts/check-site-claims.mjs
 * 退出码：0 = 一致；1 = 发现漂移。
 */
import { readFileSync, existsSync, readdirSync } from 'node:fs'
import { fileURLToPath } from 'node:url'
import { dirname, join } from 'node:path'
import { createRequire } from 'node:module'
import { FEWSHOT_DERIVED } from './eval/fewshot-derived.mjs'
import { isCrudCase } from './eval/scenes.mjs'

const __dirname = dirname(fileURLToPath(import.meta.url))
const ROOT = join(__dirname, '..')
const require = createRequire(import.meta.url)

let failed = false
const fail = (msg) => {
  failed = true
  console.error(`❌ ${msg}`)
}
const read = (p) => {
  const abs = join(ROOT, p)
  if (!existsSync(abs)) {
    fail(`文件缺失：${p}`)
    return null
  }
  return readFileSync(abs, 'utf-8')
}
const readJson = (p) => {
  const src = read(p)
  return src ? JSON.parse(src) : null
}

const diff = readJson('docs/brand/one-config-diff.json')
const slogan = readJson('docs/brand/slogan.json')
const zh = readJson('es-plus-docs/src/locales/zh-CN.json')
const en = readJson('es-plus-docs/src/locales/en-US.json')

// ── 1. 「一份配置」降幅/行数 ─────────────────────────────
const NEAR = 0.6 // 百分比允许的舍入误差（产出是 1 位小数，文案可能取整）
const near = (a, b) => Math.abs(a - b) <= NEAR

function checkOneConfigClaims() {
  if (!diff || !slogan || !zh || !en) return
  const glue = diff.metrics.markupPlusGlue
  const whole = diff.metrics.wholeFile

  // 1a. 首页 hero 的降幅
  const stat = zh.home.stat2Value
  const m = String(stat).match(/(-?\d+(?:\.\d+)?)\s*%/)
  if (!m) {
    fail(`zh-CN.json home.stat2Value 不是百分比：${stat}`)
  } else if (!near(Number(m[1]), glue.reduction)) {
    fail(
      `zh-CN.json home.stat2Value 写 ${stat}，实测模板+胶水降幅是 ${glue.reduction}%` +
        `（${glue.native} → ${glue.esplus} 行）—— 请改文案或重新运行 npm run one-config:gen`,
    )
  } else {
    console.log(`✅ 首页 hero 降幅与实测一致（${stat}）`)
  }
  for (const [loc, obj] of [['en-US', en]]) {
    const s = obj.home.stat2Value
    const mm = String(s).match(/(-?\d+(?:\.\d+)?)\s*%/)
    if (!mm || !near(Number(mm[1]), glue.reduction)) {
      fail(`${loc}.json home.stat2Value（${s}）与实测 ${glue.reduction}% 不一致`)
    }
  }

  // 1b. 对比一节副标题里的降幅
  for (const [loc, obj] of [['zh-CN', zh], ['en-US', en]]) {
    const s = String(obj.home.comparisonSubtitle || '')
    const mm = s.match(/(\d+(?:\.\d+)?)\s*%/)
    if (!mm) {
      fail(`${loc}.json home.comparisonSubtitle 未给出降幅百分比：${s}`)
    } else if (!near(Number(mm[1]), glue.reduction)) {
      fail(
        `${loc}.json home.comparisonSubtitle 写 ${mm[1]}%，实测是 ${glue.reduction}%`,
      )
    }
  }

  // 1c. 品牌承诺：宣称的降幅必须就是实测降幅，描述里两个口径的行数都要给对
  const claim = slogan.promises?.find((p) => p.key === 'one-config')
  if (!claim) {
    fail('slogan.json 缺少 one-config 承诺')
  } else {
    for (const [field, localeTag] of [['claim', 'zh'], ['claimEn', 'en']]) {
      const text = String(claim[field] || '')
      const mm = text.match(/(\d+(?:\.\d+)?)\s*%/)
      if (!mm) {
        fail(`slogan.json 的 one-config.${field} 未给出降幅百分比：${text}`)
      } else if (!near(Number(mm[1]), glue.reduction)) {
        fail(
          `slogan.json 的 one-config.${field}（${localeTag}）写 ${mm[1]}%，` +
            `实测模板+胶水降幅是 ${glue.reduction}%`,
        )
      }
    }
    // 描述必须同时给出两个口径的行数 —— 只挑好看的那个口径是这次要杜绝的做法
    for (const [field, localeTag] of [['desc', 'zh'], ['descEn', 'en']]) {
      const text = String(claim[field] || '')
      for (const [metricName, metric] of [['模板+胶水', glue], ['整页', whole]]) {
        if (!text.includes(String(metric.native)) || !text.includes(String(metric.esplus))) {
          fail(
            `slogan.json 的 one-config.${field}（${localeTag}）未给出「${metricName}」口径的行数` +
              `（应为 ${metric.native} → ${metric.esplus}）—— 两个口径都要披露`,
          )
        }
      }
    }
    if (!failed) console.log(`✅ 品牌承诺的降幅与两个口径行数均与实测一致（${claim.claim}）`)
  }

  // 1d. 对比一节的说明里出现的整页口径数字也必须对得上
  for (const [loc, obj] of [['zh-CN', zh], ['en-US', en]]) {
    const note = String(obj.home.comparisonNote || '')
    if (!note.includes(String(whole.native)) || !note.includes(String(whole.esplus))) {
      fail(
        `${loc}.json home.comparisonNote 未披露整页口径的实测行数（应为 ${whole.native} → ${whole.esplus}）`,
      )
    }
  }
  if (!failed) console.log('✅ 两个口径的行数/降幅在 slogan 与 zh/en locales 中均与实测一致')
}

// ── 2. 渲染器数量 ────────────────────────────────────────
function rendererCount() {
  // SITES 已从布局组件抽到各站的 utils/sites 模块（案例卡互链也要用同一份）
  const src = read('es-plus-docs/src/utils/sites.ts')
  if (!src) return null
  const m = src.match(/const\s+SITES\s*=\s*\[([\s\S]*?)\n\]/)
  if (!m) {
    fail('未能在 es-plus-docs/src/utils/sites.ts 定位 SITES 数组')
    return null
  }
  return (m[1].match(/\{\s*key:/g) || []).length
}

function checkRendererCount() {
  if (!zh || !en) return
  const n = rendererCount()
  if (n === null) return
  for (const [loc, obj] of [['zh-CN', zh], ['en-US', en]]) {
    const v = String(obj.home.stat1Value).trim()
    if (v !== String(n)) {
      fail(
        `${loc}.json home.stat1Value 写「${v}」，但三站切换器里的渲染器是 ${n} 个` +
          `（Vue 3 + Element Plus / Vue 2 + Element UI / Vue 3 + Ant Design Vue）`,
      )
    }
  }
  if (!failed) console.log(`✅ 首页渲染器数量与 SITES 一致（${n} 个）`)

  // 3. 英文 feature3Title 不得与三端矛盾
  const title = String(en.home.feature3Title || '')
  if (/\btwo\b/i.test(title)) {
    fail(`en-US.json home.feature3Title 写「${title}」—— 三端是三个渲染器，不是 two`)
  } else {
    console.log('✅ 英文 feature3Title 未出现与三端矛盾的「two」')
  }
}

// ── 4. 站点文档里的控件数量 ──────────────────────────────
function validFormTypes() {
  const src = read('packages/core/src/constants.ts')
  if (!src) return null
  const m = src.match(/VALID_FORM_TYPES\s*=\s*\[([\s\S]*?)\]\s*as const/)
  if (!m) {
    fail('未能在 core/constants.ts 定位 VALID_FORM_TYPES')
    return null
  }
  return (m[1].match(/'[^']+'/g) || []).length
}

function checkFormTypeClaims() {
  const n = validFormTypes()
  if (n === null) return
  const dir = join(ROOT, 'es-plus-docs/src/docs')
  if (!existsSync(dir)) return
  let checked = 0
  for (const file of readdirSync(dir)) {
    if (!file.endsWith('.md')) continue
    // changelog 是历史记录：「1.x 时支持 13 种 formtype」在当时是真的，不能改
    if (file.startsWith('changelog')) continue
    const text = readFileSync(join(dir, file), 'utf-8')
    for (const m of text.matchAll(/(\d+)\s*种\s*(?:formtype|控件)/g)) {
      checked++
      if (Number(m[1]) !== n) {
        fail(
          `es-plus-docs/src/docs/${file} 声明 ${m[1]} 种控件，实际 VALID_FORM_TYPES 有 ${n} 种` +
            `（原文：「${m[0]}」）`,
        )
      }
    }
  }
  if (!failed) console.log(`✅ 站点文档的控件数量声明与源码一致（${checked} 处，已跳过 changelog 历史条目）`)
}

// ── 5. 三站首页的数字声明 ────────────────────────────────
// 这一段是**逐项**校验而不是「出现某词就通过」：上一版用正则匹配
// `(\d+)\s*\+?\s*(?:控件类型|控件)`，而 es-eui 首页的数字与标签分处两个 span
// （`data-count="20"` 与 `<span>控件类型</span>`），正则根本匹配不到 ——
// 于是「18+/20+ 控件」这种与源码不符的数字被判成了绿。现在按各自的真实结构解析。
function checkSiteHomeFigures() {
  const formTypes = validFormTypes()
  const renderers = rendererCount()
  const glueReduction = diff ? Math.round(diff.metrics.markupPlusGlue.reduction) : null

  // ── es-eui 首页：计数动画的三个 data-count ──
  const euiHome = read('es-eui/src/views/home/index.vue')
  if (euiHome) {
    const items = [...euiHome.matchAll(/data-count="(\d+)"[\s\S]{0,120}?<span class="stat-label">([^<]+)<\/span>/g)]
    if (!items.length) {
      fail('未能从 es-eui 首页解析出 hero 统计项（结构变了请同步本脚本，否则这里会静默失效）')
    }
    const expect = [
      { label: '共用同一份配置', value: renderers, unit: '端' },
      { label: '表单控件', value: formTypes, unit: '种' },
      { label: '模板与事件胶水代码减少', value: glueReduction, unit: '%' },
    ]
    // 按 **label 查表**，不按位置索引。
    //
    // 此前是 `expect[i]` + `label === exp.label` 才断言：把首页三个 stat-item 块**重排**一下，
    // 每一项的 label 都对不上它位置上的期望值 → 三处断言全部静默跳过，仍然打印绿色
    // （而姊妹检查——advantages 数组——一直是按 label 查表的，两边不对称）。
    // 现在：label 找不到期望值就失败，值不符也失败；重排不再能让断言空转。
    const byLabel = new Map(expect.map((e) => [e.label, e]))
    for (const m of items) {
      const value = Number(m[1])
      const label = m[2].trim()
      const exp = byLabel.get(label)
      if (!exp) {
        fail(
          `es-eui 首页出现未登记的统计项「${label}」——新增统计项必须登记到本脚本并给出可核对的口径`,
        )
        continue
      }
      if (value !== exp.value) {
        fail(
          `es-eui 首页统计「${label}」写 ${value}${exp.unit}，实测应为 ${exp.value}${exp.unit}`,
        )
      }
    }
    // 期望的每一项都必须真的出现在页面上（防止把统计项删掉就当通过）
    const seen = new Set(items.map((m) => m[2].trim()))
    for (const e of expect) {
      if (!seen.has(e.label)) {
        fail(`es-eui 首页缺少统计项「${e.label}」（本脚本登记了它，且它的值是可核对的实测事实）`)
      }
    }
    // 校验项数也要对上：统计项被删/新增时提醒同步本脚本
    if (items.length !== expect.length) {
      fail(`es-eui 首页统计项有 ${items.length} 个，本脚本登记了 ${expect.length} 个 —— 请同步`)
    }
    // ── es-eui 的 advantages 数组：每一项数字都必须可核对 ──
    const advBlock = euiHome.match(/advantages:\s*\[([\s\S]*?)\n\s*\],/)
    if (!advBlock) {
      fail('未能从 es-eui 首页定位 advantages 数组')
    } else {
      const allowed = {
        '模板与事件胶水代码减少': `${glueReduction}%`,
        '表单控件': String(formTypes),
        '渲染端共用一份配置': String(renderers),
        '联动链路事件代码': '0',
      }
      const advs = [...advBlock[1].matchAll(/number:\s*'([^']+)'\s*,\s*label:\s*'([^']+)'/g)]
      if (advs.length !== Object.keys(allowed).length) {
        fail(
          `es-eui 首页 advantages 有 ${advs.length} 项，本脚本登记了 ${Object.keys(allowed).length} 项 —— ` +
            '新增的数字声明必须登记到本脚本并给出可核对的口径',
        )
      }
      for (const [, number, label] of advs) {
        if (!(label in allowed)) {
          fail(
            `es-eui 首页 advantages 的「${label} = ${number}」未在本脚本登记 —— ` +
              '站点上不允许出现无法核对来源的数字（历史上这里写过 60%/80%/3x）',
          )
        } else if (number !== allowed[label]) {
          fail(`es-eui 首页 advantages 的「${label}」写 ${number}，实测应为 ${allowed[label]}`)
        }
      }
    }
  }

  // ── 「联动链路 0 行事件代码」也要坐实：es-plus 侧样例里不得出现查询/重置/翻页/取数的胶水函数 ──
  const esplusSample = read('docs/brand/one-config/esplus.vue')
  if (esplusSample) {
    const banned = ['handleQuery', 'handleReset', 'handlePageChange', 'handleSizeChange', 'fetchData']
    const found = banned.filter((n) => new RegExp(`\\b${n}\\b`).test(esplusSample))
    if (found.length) {
      fail(
        `docs/brand/one-config/esplus.vue 里出现了 ${found.join(', ')} —— ` +
          '这些正是配置应当接管的联动胶水；它们若存在，「联动链路 0 行事件代码」的说法就不成立',
      )
    }
  }

  // ── 三站首页/文档正文里的控件数量声明 ──
  const targets = ['es-eui/src/views/home/index.vue', 'es-eui/src/views/guide/introduction.vue']
  for (const file of targets) {
    const src = read(file)
    if (!src) continue
    for (const m of src.matchAll(/(\d+)\s*\+?\s*种\s*控件/g)) {
      if (formTypes !== null && Number(m[1]) !== formTypes) {
        fail(`${file} 写「${m[0]}」，实际 VALID_FORM_TYPES 有 ${formTypes} 种`)
      }
    }
  }

  if (!failed) console.log('✅ 三站首页的数字声明均与实测事实一致（含「0 行联动胶水」的坐实）')
}

// ── 5b. es-eui 正文里「降幅类百分比」必须等于实测 ───────────────
// 上一段只覆盖 es-eui 首页的 hero 统计与 advantages 两个**结构**。散落在同一站点
// 正文里的同类声明完全不受约束，于是同一个降幅在站内出现三个互相矛盾的数字：
//   · home 的 solutions 写「代码量减少 60% 以上」；
//   · EsTableDocs 的 hero 写「开发效率提升 80%」；
//   · README 写「提升 60%+」「代码量减少 50%+」。
// 三个数字彼此不等，也都不等于品牌单源实测的模板+胶水降幅（77%）。它们恰好是
// 「可验证」这个卖点本身 —— 所以按同一条口径扫全站，而不是逐个结构补丁。
const CLAIM_PCT_PATTERNS = [
  /(?:减少|提升|降低|节省|加速)(?:了)?[^。\n]{0,10}?(\d+(?:\.\d+)?)\s*%/g,
  /(\d+(?:\.\d+)?)\s*%\s*(?:以上|左右)?[^。\n]{0,6}?(?:减少|提升|降低|节省|加速)/g,
]

function checkEuiPercentClaims() {
  if (!diff) return
  const expected = diff.metrics.markupPlusGlue.reduction
  const files = []
  const walk = (rel) => {
    const abs = join(ROOT, rel)
    if (!existsSync(abs)) return
    for (const entry of readdirSync(abs, { withFileTypes: true })) {
      const child = `${rel}/${entry.name}`
      if (entry.isDirectory()) walk(child)
      else if (/\.(vue|md)$/.test(entry.name)) files.push(child)
    }
  }
  // 三站一并扫：同一条降幅声明在任一站点漂移都属于同一类问题。
  // （2026-10-23 扩展：es-plus-docs 的 getting-started.md 当时写的是「减少 70%」。）
  walk('es-eui/src')
  walk('es-pc/src')
  walk('es-plus-docs/src/docs')
  walk('es-plus-docs/src/views')
  files.push('es-eui/README.md')

  let checked = 0
  for (const file of files) {
    const src = read(file)
    if (!src) continue
    for (const re of CLAIM_PCT_PATTERNS) {
      for (const m of src.matchAll(re)) {
        checked++
        if (!near(Number(m[1]), expected)) {
          fail(
            `${file} 的降幅声明「${m[0].trim()}」与实测不符 —— ` +
              `模板+胶水实测降幅是 ${expected}%（口径见 docs/brand/one-config-diff.json）`,
          )
        }
      }
    }
  }
  if (!failed) console.log(`✅ 三站正文降幅声明与实测一致（${checked} 处，均为 ${expected}%）`)
}

// ── 5d. 「三个渲染器」不得被写成「四个框架」 ──────────────────
// antdv 站首页曾把两个 UI 库与两个 Vue 版本并列成四件事（「跨 Element Plus /
// Ant Design Vue / Vue 2 / Vue 3 复用」），读者会理解成支持四个框架。
// 实际情况是**三个渲染端**：Vue 2 + Element UI、Vue 3 + Element Plus、Vue 3 + ADVD。
// 注释里解释这段历史是允许的，所以先剥掉 HTML / JS 注释再扫。
function stripComments(src) {
  return src
    .replace(/<!--[\s\S]*?-->/g, '')
    .replace(/\/\*[\s\S]*?\*\//g, '')
    .split('\n')
    .filter((l) => !/^\s*\/\//.test(l))
    .join('\n')
}

// ── 5e. Ant Design Vue 示例不得使用它不认识的 type ───────────
// Antdv 的 Button 只认 default / primary / dashed / text / link（危险走 danger 布尔），
// Tag 只认 color（预设色名或 success/warning 这类状态值）。示例里写
// `<a-button type="success">` / `<Tag type="danger">` 不会报错，但**样式静默失效** ——
// 而这类代码正是会被读者复制走的。Element Plus 的语义色写法此处全部非法。
// Modal.confirm 的 okType 同理：只认 primary/default/dashed/text/link，危险操作用
// `okButtonProps: { danger: true }`。写成 `okType: 'warning'` 不会报错，按钮只是静默退回默认色。
const ANTDV_INVALID = [
  [/<a-button[^>]*\btype="(success|warning|info|danger)"/g, 'a-button 的 type 只能是 default/primary/dashed/text/link，危险走 danger 布尔'],
  // 4.x 的 Button 没有 text 布尔属性（只有 type="text"），裸写 `text` 会当成无效 attr 透传到 DOM。
  [/<a-button[^>]*\stext(?=[\s>/])/g, 'a-button 用 type="text"，没有 text 布尔属性'],
  [/\bokType\s*:\s*['"](success|warning|info)['"]/g, "Modal 的 okType 只认 primary/default/dashed/text/link，危险操作用 okButtonProps: { danger: true }"],
  [/\bcancelType\s*:\s*['"](success|warning|info)['"]/g, 'Modal 的 cancelType 只认 primary/default/dashed/text/link'],
  [/<a-tag[^>]*\btype=/g, 'a-tag 用 color，没有 type'],
  [/<Tag\b[^>]*\btype=/g, 'JSX <Tag> 用 color，没有 type'],
]

function checkAntdvInvalidTypes() {
  const files = []
  const walk = (rel) => {
    const abs = join(ROOT, rel)
    if (!existsSync(abs)) return
    for (const entry of readdirSync(abs, { withFileTypes: true })) {
      const child = `${rel}/${entry.name}`
      if (entry.isDirectory()) walk(child)
      else if (/\.(vue|jsx|tsx)$/.test(entry.name)) files.push(child)
    }
  }
  walk('es-pc/src')
  for (const file of files) {
    const src = read(file)
    if (!src) continue
    for (const [re, why] of ANTDV_INVALID) {
      for (const m of src.matchAll(re)) {
        fail(`${file} 用了 Antdv 不认的写法「${m[0].trim()}」—— ${why}`)
      }
    }
  }
  if (!failed) console.log(`✅ antdv 示例未使用 Element Plus 的语义色 type（扫 ${files.length} 个文件）`)
}



const FOUR_THINGS = [/四个框架/, /四框架/, /four\s+frameworks/i, /\b4\s+renderers?\b/i]

function checkRendererWording() {
  const files = [
    'es-pc/src/views/Home.vue',
    'es-eui/src/views/home/index.vue',
    'es-plus-docs/src/views/Home.vue',
  ]
  let checked = 0
  for (const file of files) {
    const src = read(file)
    if (!src) continue
    const text = stripComments(src)
    checked++
    for (const re of FOUR_THINGS) {
      const m = text.match(re)
      if (m) {
        fail(
          `${file} 出现「${m[0]}」—— 三端是三个渲染器` +
            '（Vue 2 + Element UI / Vue 3 + Element Plus / Vue 3 + Ant Design Vue），' +
            '不是四个框架',
        )
      }
    }
  }
  if (!failed) console.log(`✅ 三站首页未把三端写成「四个框架」（扫 ${checked} 个文件）`)
}

// ── 5c. 已弃用的错拼 API 不得作为教学口径出现在站点 ───────────────
// `isHiden`（少一个 d）是 vue2 端的历史拼写错误，仅作兼容别名保留；
// vue3 / adapter-antdv 会静默忽略它。三端文档却把它当成字段属性来教：
//   · es-eui 的 EsForm 示例 5 个字段全用 isHiden（开发期每条都打弃用告警）；
//   · es-eui 的 API 表 / 开发手册把它写成属性名；
//   · 主站 component-doc 的案例描述也写着「isHiden + on.change」。
// 读者照抄后换到 vue3 端就不生效 —— 这与「一份配置三端通用」直接冲突。
const DEPRECATED_PROP = 'isHiden'
const DEPRECATION_NOTE = /(isHidden|弃用|兼容别名|拼写错误|错拼)/

function checkDeprecatedPropNames() {
  const files = []
  const walk = (rel) => {
    const abs = join(ROOT, rel)
    if (!existsSync(abs)) return
    for (const entry of readdirSync(abs, { withFileTypes: true })) {
      const child = `${rel}/${entry.name}`
      if (entry.isDirectory()) walk(child)
      else if (/\.(vue|md|ts|js)$/.test(entry.name)) files.push(child)
    }
  }
  walk('es-plus-docs/src/docs')
  walk('es-plus-docs/src/views')
  walk('es-eui/src')
  walk('es-pc/src')
  files.push('es-eui/README.md')

  let hits = 0
  for (const file of files) {
    const src = read(file)
    if (!src) continue
    const lines = src.split('\n')
    for (let i = 0; i < lines.length; i++) {
      if (!lines[i].includes(DEPRECATED_PROP)) continue
      // 明确标注「错拼 / 兼容别名 / 请用 isHidden」的说明行允许保留
      if (DEPRECATION_NOTE.test(lines[i])) continue
      hits++
      fail(
        `${file}:${i + 1} 把已弃用的错拼 \`${DEPRECATED_PROP}\` 当作正常 API 使用/讲解 —— ` +
          '三端统一为 `isHidden`（vue3 / antdv 端会忽略错拼版本）',
      )
    }
  }
  if (!failed) console.log(`✅ 站点未把已弃用的错拼 \`${DEPRECATED_PROP}\` 当教学口径（扫描 ${files.length} 个文件）`)
}

// ── 6. 镜像到站点的理念文档（why-es-plus.md/.en.md）──
// 它是「为什么用 ES-Plus」的立论文档，成本论证全部建立在那对行数上。
// 此前写的是「~250 行 → ~30 行、节省 ~210 行、3,600 行死代码」，描述的还是
// 另一个更大的页面（8 字段 + 6 列 + 弹窗）—— 与站点展示的样例、与 README 又不是同一个口径。
function checkPhilosophyDocClaims() {
  if (!diff) return
  const g = diff.metrics.markupPlusGlue
  const nb = diff.breakdown.native
  const eb = diff.breakdown.esplus
  const per20 = 20 * (g.native - g.esplus)

  const targets = [
    {
      file: 'docs/why-es-plus.md',
      pair: [`${g.native}`, `${g.esplus}`],
      anchor: new RegExp(`${g.native} 行模板与事件胶水代码`),
      anchorDesc: `${g.native} 行模板与事件胶水代码`,
    },
    {
      file: 'docs/why-es-plus.en.md',
      pair: [`${g.native}`, `${g.esplus}`],
      anchor: new RegExp(`${g.native} lines of markup and event glue`),
      anchorDesc: `${g.native} lines of markup and event glue`,
    },
  ]
  for (const { file, pair, anchor, anchorDesc } of targets) {
    const src = read(file)
    if (!src) continue
    // 必须给出实测行数
    if (!src.includes(pair[0]) || !src.includes(pair[1])) {
      fail(
        `${file} 未给出实测行数（模板与事件胶水 ${pair[0]} → ${pair[1]}）—— ` +
          '理念文档的成本论证必须与站点展示的样例同源',
      )
    }
    // 必须给出实测降幅
    if (!src.includes(`−${g.reduction}%`) && !src.includes(`-${g.reduction}%`)) {
      fail(`${file} 未给出实测降幅（−${g.reduction}%）`)
    }
    // 必须把行数与「模板与事件胶水代码」写在同一处因果里。
    // 只断言「文件里出现过 115」是不够的：只改一处、留下另一处矛盾数字时，存在性检查依然会绿。
    if (!anchor.test(src)) {
      fail(`${file} 未把实测行数与「模板与事件胶水代码」写在同一处（应为「${anchorDesc}」）`)
    }
    // 不得残留旧口径的数字声明（旧文档用的是另一个更大页面的估算：
    // 250 行合计 / 210 行节省 / 180 行死代码 / 3,600 行可蒸发 / 30 页 7500→900 / 286 小时）
    const STALE = [
      [/\b250\s*行/, '250 行（旧合计）'],
      [/\b210\s*行/, '210 行（旧节省）'],
      [/\b180\s*行/, '180 行（旧死代码估算）'],
      [/3,?600\s*行|3,?600 lines/, '3,600 行（旧外推）'],
      [/\b7500\s*行/, '7500 行（旧 30 页外推）'],
      [/\b900\s*行/, '900 行（旧 30 页外推）'],
      [/\b286\s*小时/, '286 小时（旧工时节省）'],
    ]
    for (const [re, label] of STALE) {
      if (re.test(src)) {
        fail(
          `${file} 残留旧口径数字「${label}」—— 那是按另一个更大的页面估算的，` +
            '已统一为 docs/brand/one-config/ 两个样例的实测口径',
        )
      }
    }
    // 20 页外推数字必须按实测重算
    if (!src.includes(String(per20))) {
      fail(`${file} 未给出按实测重算的「20 个页面可蒸发行数」（应为 ${per20}）`)
    }
    // 逐项拆解必须加起来等于整页行数（防止只改一处留下不自洽的表）
    if (!src.includes(`${nb.templateLines}`) || !src.includes(`${nb.totalLines}`)) {
      fail(`${file} 的逐项拆解未使用实测值（模板 ${nb.templateLines} / 合计 ${nb.totalLines}）`)
    }

    // ES-Plus 侧的整页行数同样必须同源。
    // 2026-10-23 实测到的一次漂移：操作列从 `tableBtns`（es-table 不消费，按钮根本不渲染）
    // 改成 `columns[].render` 后，右侧从 85 行涨到 90 行，而文档/镜像仍写 85 —— 上面那些
    // 断言只盯 native 侧的 61/151 和胶水的 115/27，右侧整页行数一路无人管。
    const wholePageRe = file.endsWith('.en.md')
      ? new RegExp(`same page is\\s*${eb.totalLines}\\s*lines`)
      : new RegExp(`同样的页面是\\s*${eb.totalLines}\\s*行`)
    if (!wholePageRe.test(src)) {
      fail(`${file} 未写出 ES-Plus 侧整页实测行数（应为「${eb.totalLines} 行」）`)
    }
    // 30 页外推必须按实测重算，否则一处改动会让整张 ROI 表静默失真
    // （英文排版用千分位逗号，比对时先剥掉逗号）
    const total30 = 30 * eb.totalLines
    const saved30 = 30 * nb.totalLines - total30
    const flat = src.replace(/,/g, '')
    if (!flat.includes(String(total30)) || !flat.includes(String(saved30))) {
      fail(`${file} 的 30 页外推未按实测重算（应出现 ${total30} 与节省 ${saved30}）`)
    }
    const STALE_ESPLUS = [
      [/\b85\s*行/, '85 行（旧的 ES-Plus 侧整页行数）'],
      [/\b85\s+lines/, '85 lines（旧的 ES-Plus 侧整页行数）'],
      [/\b2550\b/, '2550（旧的 30 页外推）'],
      [/\b1980\b/, '1980（旧的 30 页节省行数）'],
      [/\b66\s*小时/, '66 小时（旧的工时节省）'],
      [/\b66\s+hr/, '66 hr（旧的工时节省）'],
    ]
    for (const [re, label] of STALE_ESPLUS) {
      if (re.test(src)) {
        fail(`${file} 残留旧口径数字「${label}」—— 右侧整页行数已实测为 ${eb.totalLines}`)
      }
    }
  }
  if (!failed) console.log('✅ 理念文档（zh/en）的数字与实测同源、旧口径已清除')
}

// ── 7. AI 准确率声明 ↔ 夜间 eval artifact ─────────────────
// AN-27：README / 理念文档曾写死「~95%（AI 写的代码可用率）」「语料目前 25 例」，
// 而 artifact 实测是 48.8% / 188 例（heldout 166）。数字必须绑定**权威来源**：
//   · 门禁目标 = artifact.target（README 改成 99% 必须红）；
//   · 徽章读数 = artifact.definition95.rate（徽章本身由 eval 从 artifact 生成）；
//   · 语料规模 = **当前语料**（不是 artifact 的 cases）；
//   · 正文**不得**写死当前准确率 —— 当前值只有一个权威来源（徽章/artifact），
//     否则每夜 artifact 变动都会让文案变成另一份真相。
//
// 为什么语料规模不绑 artifact：artifact 描述的是**上一次付费跑批**的语料快照。
// 语料随时会长（AI-47.. 一轮就 +60 条），而付费跑批受中继额度限制 —— 把「语料目前 N 例」
// 绑到 artifact 上，等于要求文案在两次跑批之间**持续低报**真实语料，且让门禁在无额度时
// 无法满足。语料规模与 scorer 无关，直接从 `__tests__/golden/cases` 现算即可
// （与 `check-readme-claims.mjs` 的 `checkCorpusSizeClaim` 同一口径）。
function liveCorpusSize() {
  const dir = join(ROOT, '__tests__', 'golden', 'cases')
  let crud = 0
  let heldout = 0
  for (const f of readdirSync(dir)) {
    if (!f.endsWith('.json')) continue
    const raw = JSON.parse(readFileSync(join(dir, f), 'utf-8'))
    if (!isCrudCase(raw)) continue
    crud++
    if (!FEWSHOT_DERIVED.has(f)) heldout++
  }
  return { crud, heldout }
}

function checkAccuracyClaims() {
  const art = readJson('__tests__/golden/last-accuracy.json')
  const badge = readJson('__tests__/golden/last-accuracy-badge.json')
  if (!art || !badge) return
  if (typeof art.target !== 'number') {
    fail('last-accuracy.json 缺少 target（门禁目标），无法校验公开声明')
    return
  }

  const measurement = art.measurement
  const failedRun = measurement === 'failed'

  // ── 完整性判据必须按**腿**看，而不是一刀切 `notMeasuredRows` ────────────
  //   · complete                → 所有腿都测到（notMeasuredRows = 0）
  //   · complete-gated-leg-only → 只有**门禁腿**（zh）必须测到；观测腿（en）允许
  //                               有「未测到」行，其读数在产物里被抑制（byLanguage.en）
  //   · failed                  → 这次根本不构成测量：不绑定任何读数，但公开面也
  //                               不得出现读数（见下方徽章校验）
  //   · 无 measurement（旧格式）→ 沿用旧口径 notMeasuredRows = 0
  // 此前一律要求 notMeasuredRows === 0，把合法的 complete-gated-leg-only 判死，
  // 也与 `measurement` 字段自身的语义矛盾。
  if (!failedRun) {
    if (measurement === 'complete-gated-leg-only') {
      const gatedErrored = art.gatedRows?.errored
      if (!Number.isInteger(gatedErrored)) {
        fail(
          'last-accuracy.json 标了 complete-gated-leg-only，但缺少 gatedRows.errored —— ' +
            '无法证明门禁腿（zh）是完整测量',
        )
        return
      }
      if (gatedErrored !== 0) {
        fail(`门禁腿（zh）有 ${gatedErrored} 行未测到 —— 这次跑批不能支撑公开读数`)
        return
      }
    } else if (art.notMeasuredRows !== 0) {
      fail(
        `last-accuracy.json 的 notMeasuredRows=${art.notMeasuredRows}（应为 0）—— ` +
          '这次跑批不构成完整测量，不能用它绑定公开声明',
      )
      return
    }
  }

  const targetPct = Number((art.target * 100).toFixed(1))
  const { crud: cases, heldout } = liveCorpusSize()
  // artifact 的语料快照可以比当前语料小（跑批之后又加了语料）——这不是错误；
  // 但**大于**当前语料意味着用例被删了，那会让上次测量的分母失去参照，必须点名。
  if (typeof art.cases === 'number' && art.cases > cases) {
    fail(
      `artifact 记录了 ${art.cases} 条语料，当前语料只有 ${cases} 条 —— 疑似删除了用例（删例会稀释测量口径）`,
    )
  }

  // README 两语：语料规模 / 留出集 / 门禁目标都必须等于 artifact，且指向 artifact。
  // 这三项是与**当前语料**的对账，与本次跑批是否成功无关 —— 失败产物也要查。
  const readmeCases = [
    {
      file: 'README.md',
      casesRe: /语料目前\s*(\d+)\s*例/,
      heldoutRe: /留出\s*(\d+)\s*例/,
      targetRe: /门禁目标\s*≥\s*([\d.]+)\s*%/,
    },
    {
      file: 'README.en.md',
      casesRe: /corpus is\s*(\d+)\s*cases/i,
      heldoutRe: /(\d+)\s*heldout/i,
      targetRe: /gate target is\s*≥\s*([\d.]+)\s*%/i,
    },
  ]
  for (const spec of readmeCases) {
    const src = read(spec.file)
    if (!src) continue
    const mc = src.match(spec.casesRe)
    const mh = src.match(spec.heldoutRe)
    const mt = src.match(spec.targetRe)
    if (!mc) fail(`${spec.file} 未给出语料规模（应写「${cases} 例/cases」）`)
    else if (Number(mc[1]) !== cases) {
      fail(`${spec.file} 写语料 ${mc[1]} 例，artifact 是 ${cases} 例——请改文案（不得手改计数口径）`)
    }
    if (!mh) fail(`${spec.file} 未给出留出集规模（应写「${heldout} 例/heldout」）`)
    else if (Number(mh[1]) !== heldout) {
      fail(`${spec.file} 写留出 ${mh[1]} 例，artifact 是 ${heldout} 例`)
    }
    if (!mt) fail(`${spec.file} 未给出门禁目标（应写「≥${targetPct}%」）`)
    else if (Number(mt[1]) !== targetPct) {
      fail(
        `${spec.file} 写门禁目标 ${mt[1]}%，artifact.target 是 ${targetPct}%——` +
          '宣称必须与门禁同源',
      )
    }
    if (!src.includes('last-accuracy.json')) {
      fail(`${spec.file} 未指向 __tests__/golden/last-accuracy.json（当前读数的唯一权威来源）`)
    }
  }

  // 理念文档：提到 definition95 的行必须给目标 + 指向徽章，且不得写死当前读数。
  for (const file of ['docs/why-es-plus.md', 'docs/why-es-plus.en.md']) {
    const src = read(file)
    if (!src) continue
    const lines = src.split(/\r?\n/).filter((line) => line.includes('definition95'))
    if (lines.length === 0) {
      fail(`${file} 的 AI 协作收益行未用 definition95 口径（易与徽章读数脱节）`)
      continue
    }
    for (const line of lines) {
      const mt = line.match(/≥\s*([\d.]+)\s*%/)
      if (!mt) {
        fail(`${file} 提到 definition95 但未给门禁目标 ≥${targetPct}%：${line.trim()}`)
      } else if (Number(mt[1]) !== targetPct) {
        fail(`${file} 写目标 ${mt[1]}%，artifact.target 是 ${targetPct}%：${line.trim()}`)
      }
      if (!/徽章|badge/i.test(line)) {
        fail(`${file} 提到 definition95 但未指向徽章（当前读数不得写死在正文）：${line.trim()}`)
      }
      if (/definition95\s*=\s*[\d.]+\s*%/.test(line)) {
        fail(
          `${file} 写死了当前 definition95 读数：${line.trim()} —— ` +
            '夜间 eval 会改这个数字，正文只写目标并指向徽章',
        )
      }
    }
  }

  if (failedRun) {
    // 失败产物的唯一合法公开状态是「measurement failed」。徽章若还挂着旧读数，
    // 访客会把一次**没测成**的跑批当成最新成绩 —— 这正是产物 state 要防的假绿。
    for (const file of [
      '__tests__/golden/last-accuracy-badge.json',
      '__tests__/golden/last-accuracy-badge-scoped.json',
    ]) {
      const b = readJson(file)
      if (b && b.message !== 'measurement failed') {
        fail(`${file} 在失败产物上声称「${b.message}」—— 失败测量不支撑任何准确率读数`)
      }
    }
    if (!failed) {
      console.log(
        'ℹ️ last-accuracy.json 是失败产物（measurement=failed）：只校验语料/目标声明与徽章状态，不绑定读数',
      )
    }
    return
  }

  // 徽章必须由 artifact 生成（label 带目标，message 是当前读数）。
  const rate = art.definition95?.rate
  const total = art.definition95?.total
  if (typeof rate !== 'number' || typeof total !== 'number') {
    fail('last-accuracy.json 缺少 definition95.rate / total，无法绑定公开声明')
    return
  }
  const currentPct = Number((rate * 100).toFixed(1))
  const badgeMsg = String(badge.message ?? '')
  // 比数值而非比字符串：徽章生成器用 `toFixed(1)`（`75.0%`），这里若按
  // `${currentPct}%`（`75%`）比字符串，任何恰好落在整十/整尾数的读数都会假红
  // —— 与 `scripts/eval/artifact.mjs` 的徽章校验同一口径。
  const badgePct = /^(-?\d+(?:\.\d+)?)%$/.exec(badgeMsg)
  if (!badgePct) {
    fail(
      `last-accuracy-badge.json 的 message 不是百分比读数：${badgeMsg} —— ` +
        `artifact 的 definition95 是 ${currentPct}%（${rate} × ${total} 例）`,
    )
  } else if (Math.abs(Number(badgePct[1]) - currentPct) > 0.05) {
    fail(
      `last-accuracy-badge.json 的 message 是 ${badgeMsg}，artifact 的 definition95 是 ` +
        `${currentPct}%（${rate} × ${total} 例）—— 徽章必须由 artifact 生成`,
    )
  }
  if (!String(badge.label ?? '').includes(`${targetPct}%-definition`)) {
    fail(
      `last-accuracy-badge.json 的 label（${badge.label}）应包含 ${targetPct}%-definition ` +
        '（门禁目标来自 artifact.target）',
    )
  }

  if (!failed) {
    console.log(
      `✅ AI 准确率声明与权威来源同源（门禁目标/徽章来自 artifact：${targetPct}% / ${currentPct}%；` +
        `语料规模来自当前语料：${cases} 例、留出 ${heldout} 例）`,
    )
  }
}

// ── 8. CLI 文档里的生成物规模 ────────────────────────────
// cli.md 曾写「包装 SFC（~30 行）」。实测 generateCrudSchema 的三端包装 SFC 分别是
// 43 / 49 / 45 非空行（三字段页面），旧数字既不准也无来源。这里登记旧值防止回退；
// 新的区间数字是测量快照，生成器改动后应重测（重测方式：用 esbuild 打包
// packages/shared/src/index.ts 后调用 generateCrudSchema(desc, target) 数非空行）。
function checkCliDocFigure() {
  const src = read('es-plus-docs/src/docs/cli.md')
  if (!src) return
  if (/包装 SFC（~\s*30\s*行/.test(src)) {
    fail(
      'es-plus-docs/src/docs/cli.md 仍写「包装 SFC（~30 行）」—— 实测为 43–49 非空行（三字段页面），' +
        '旧数字既不准也无来源',
    )
  } else {
    console.log('✅ CLI 文档的生成物规模未使用旧的未经验证数字')
  }
}

// ── 8. 文档版本脚注 ↔ packages/*/package.json ─────────────
// why-es-plus 末尾的脚注长期写「Vue3 1.4.1 / Vue2 1.0.0 / Shared 1.1.0 / CLI 1.2.0 /
// MCP-Server 1.2.0」，实际已是 1.7.0 / 1.4.0 / 1.4.1 / 1.4.0 / 1.4.1 —— 脚注是读者判断
// 「这份文档有多新」的唯一依据，写错就等于谎报时效，而它没有任何守卫。
// 判据：每个标签的版本必须**等于**对应 package.json 的 version（不做范围/前缀比较）。
const VERSION_FOOTNOTE_LABELS = {
  Vue3: 'vue3',
  Vue2: 'vue2',
  AntDV: 'adapter-antdv',
  Core: 'core',
  Shared: 'shared',
  CLI: 'cli',
  'MCP-Server': 'mcp-server',
}

function checkVersionFootnotes() {
  for (const file of ['docs/why-es-plus.md', 'docs/why-es-plus.en.md']) {
    const src = read(file)
    if (!src) continue
    const line = src.split('\n').find((l) => l.startsWith('<small>'))
    if (!line) {
      fail(`${file} 未找到版本脚注（<small> 行）—— 若删除了该表述，请同步本守卫`)
      continue
    }
    const found = new Map()
    for (const m of line.matchAll(/([A-Za-z][A-Za-z0-9-]*)\s+(\d+\.\d+\.\d+)/g)) {
      if (m[1] in VERSION_FOOTNOTE_LABELS) found.set(m[1], m[2])
    }
    for (const [label, pkg] of Object.entries(VERSION_FOOTNOTE_LABELS)) {
      const actual = readJson(`packages/${pkg}/package.json`)?.version
      if (!actual) {
        fail(`无法读取 packages/${pkg}/package.json 的 version（脚注里的 ${label} 无从核对）`)
        continue
      }
      if (!found.has(label)) {
        fail(`${file} 的版本脚注缺少 ${label} 版本（当前应为 ${actual}）`)
      } else if (found.get(label) !== actual) {
        fail(`${file} 的版本脚注写 ${label} ${found.get(label)}，packages/${pkg} 实际是 ${actual}`)
      }
    }
  }
  if (!failed) console.log('✅ 文档版本脚注与各包 package.json 一致')
}

checkOneConfigClaims()
checkRendererCount()
checkFormTypeClaims()
checkSiteHomeFigures()
checkEuiPercentClaims()
checkRendererWording()
checkAntdvInvalidTypes()
checkDeprecatedPropNames()
checkPhilosophyDocClaims()
checkAccuracyClaims()
checkCliDocFigure()
checkVersionFootnotes()

if (failed) {
  console.error('\n站点数字声明与实测事实不符 —— 改文案或重新运行对应生成脚本。')
  process.exit(1)
}
console.log('\n站点数字声明 ↔ 实测事实 ✅')
