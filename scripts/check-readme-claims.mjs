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
import { readFileSync, existsSync } from 'node:fs'
import { fileURLToPath } from 'node:url'
import { dirname, join } from 'node:path'

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
    console.log('ℹ️  README.md 未声明表单控件数量，跳过该项')
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
    console.log('ℹ️  README.md 未列出控件枚举明细，跳过枚举比对')
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

const contractTypes = readContractTypes()
const formTypes = readFormTypes()
if (contractTypes) checkContractTypeCount(contractTypes)
if (formTypes) checkFormTypes(formTypes)
checkReductionClaim()

if (failed) {
  console.error('\nREADME 声明与源码事实不符 —— 请修正 README 或本脚本的匹配规则。')
  process.exit(1)
}
console.log('\nREADME 数字声明 ↔ 源码事实 ✅')
