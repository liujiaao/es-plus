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
  const src = read('es-plus-docs/src/components/layout/AppHeader.vue')
  if (!src) return null
  const m = src.match(/const\s+SITES\s*=\s*\[([\s\S]*?)\n\]/)
  if (!m) {
    fail('未能在 AppHeader.vue 定位 SITES 数组')
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
    for (const [i, m] of items.entries()) {
      const value = Number(m[1])
      const label = m[2].trim()
      const exp = expect[i]
      if (exp && label === exp.label && value !== exp.value) {
        fail(
          `es-eui 首页统计「${label}」写 ${value}${exp.unit}，实测应为 ${exp.value}${exp.unit}`,
        )
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
  }
  if (!failed) console.log('✅ 理念文档（zh/en）的数字与实测同源、旧口径已清除')
}

// ── 7. CLI 文档里的生成物规模 ────────────────────────────
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

checkOneConfigClaims()
checkRendererCount()
checkFormTypeClaims()
checkSiteHomeFigures()
checkPhilosophyDocClaims()
checkCliDocFigure()

if (failed) {
  console.error('\n站点数字声明与实测事实不符 —— 改文案或重新运行对应生成脚本。')
  process.exit(1)
}
console.log('\n站点数字声明 ↔ 实测事实 ✅')
