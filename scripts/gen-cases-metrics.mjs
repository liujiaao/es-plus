#!/usr/bin/env node
/**
 * F6「原生 vs es-plus」成本对照的**实测**数字生成。
 *
 * 背景：`cases.json` 里每条案例的 `pain` / `win` 是手写文案，「少写 70% 代码」这类说法
 * 无法复查。本脚本把口径落成可复算的东西：
 *
 *   1. 单源是成对的**完整示例**：`docs/examples/native/<场景>.vue` 与
 *      `docs/examples/es/<场景>.vue` 实现同一页面、同一功能范围（无省略号、无 stub）；
 *   2. 从两侧源码实算四个口径，产出 `docs/cases/cases-metrics.json` 供三站 Cases 页展示；
 *   3. 站点不写死任何数字 —— 展示的就是这里算出来的值，改示例即改数字。
 *
 * 四个口径（同一规则量两侧，都写进产出）：
 *   - lines     非空行数（整文件，含数据与 schema —— 不藏配置成本）；
 *   - events    模板里的事件绑定数（`@click` / `@btn-click` …，含修饰符写法）；
 *   - functions script 里自己写的函数数（`function f()` 与 `const f = (...) =>`）；
 *   - vIf       模板里的 `v-if` / `v-else-if` 分支数。
 *
 * 示例本身不进任何站点构建，所以这里用 `@vue/compiler-sfc` 把每个文件真编译一遍：
 * 语法坏了的示例会让 `--check` 变红，而不是悄悄让数字失真。
 *
 * 用法：
 *   node scripts/gen-cases-metrics.mjs           # 生成
 *   node scripts/gen-cases-metrics.mjs --check   # 校验产出是否为最新（CI）
 *
 * 退出码：0 = 成功/一致；1 = 示例缺失/编译失败/产出过期。
 */
import { readFileSync, writeFileSync, readdirSync, existsSync } from 'node:fs'
import { fileURLToPath } from 'node:url'
import { dirname, join, resolve } from 'node:path'
import { parse, compileScript, compileTemplate } from '@vue/compiler-sfc'
import { readText, sameText } from './lib/text-sync.mjs'

const ROOT = join(dirname(fileURLToPath(import.meta.url)), '..')
const SRC_DIR = join(ROOT, 'docs', 'examples')
const TARGET = join(ROOT, 'docs', 'cases', 'cases-metrics.json')
const CHECK = process.argv.includes('--check')

/** 场景标题（Cases 页直接展示）。新增场景必须在这里登记，否则脚本报错。 */
const TITLES = {
  'filter-table': '查询 + 表格 + 分页 + 行内查看',
  'status-column': '码值列：中文标签 + 空值占位',
}

const toLF = (text) => text.replace(/\r\n?/g, '\n')
const nonEmptyLines = (text) => toLF(text).split('\n').filter((l) => l.trim() !== '').length

/** 抽出 <template>…</template> 与 <script …>…</script> 区（示例都是单块）。 */
function blocks(text) {
  const src = toLF(text)
  const tStart = src.indexOf('<template>')
  const tEnd = src.lastIndexOf('</template>')
  const sStart = src.search(/<script\b/)
  const sEnd = src.indexOf('</script>')
  return {
    template: tStart >= 0 && tEnd > tStart ? src.slice(tStart, tEnd) : '',
    script: sStart >= 0 && sEnd > sStart ? src.slice(sStart, sEnd) : '',
  }
}

/** 去掉模板里的 HTML 注释：注释里的「v-if」「@click」不是代码，计数必须看不见它们。 */
const stripComments = (template) => template.replace(/<!--[\s\S]*?-->/g, '')

/** 模板事件绑定：@click / @keyup.enter / @btn-click / @submit.prevent */
function countEvents(template) {
  return (stripComments(template).match(/@[A-Za-z][\w:.-]*/g) || []).length
}

/** 自己写的函数：function f() / async function f() / const f = (...) => / const f = async (...) => */
function countFunctions(script) {
  const names = new Set()
  for (const m of script.matchAll(/\bfunction\s+([A-Za-z_$][\w$]*)\s*\(/g)) names.add(m[1])
  for (const m of script.matchAll(/\bconst\s+([A-Za-z_$][\w$]*)\s*=\s*(?:async\s*)?(?:\([^)]*\)|[A-Za-z_$][\w$]*)\s*=>/g)) {
    names.add(m[1])
  }
  return names.size
}

/** v-if / v-else-if 分支数（v-else 只是兜底，不计） */
function countVIf(template) {
  return (stripComments(template).match(/\bv-(?:else-)?if\b/g) || []).length
}

/** 真编译一遍，语法坏了就停 —— 示例不进构建，这里是唯一的语法门。 */
function compileOrThrow(file, text) {
  const { descriptor, errors } = parse(text, { filename: file })
  if (errors.length) throw new Error(`${file} 解析失败：${errors[0].message}`)
  if (!descriptor.template) throw new Error(`${file} 缺少 <template>`)
  const compiled = compileTemplate({
    source: descriptor.template.content,
    filename: file,
    id: 'cases-metrics',
  })
  if (compiled.errors.length) throw new Error(`${file} 模板编译失败：${compiled.errors[0]}`)
  if (descriptor.scriptSetup) compileScript(descriptor, { id: 'cases-metrics' })
}

function measure(file) {
  const text = readText(join(ROOT, file))
  compileOrThrow(file, text)
  const parts = blocks(text)
  return {
    file,
    lines: nonEmptyLines(text),
    events: countEvents(parts.template),
    functions: countFunctions(parts.script),
    vIf: countVIf(parts.template),
  }
}

const reduce = (native, es) => (native === 0 ? 0 : Math.round(((native - es) / native) * 1000) / 10)

/** 三站 Cases 页必须展示这份实测值，而不是手写百分比。 */
const SITE_CASES = [
  'es-plus-docs/src/views/Cases.vue',
  'es-pc/src/views/Cases.vue',
  'es-eui/src/views/cases.vue',
]

function checkSites() {
  for (const file of SITE_CASES) {
    const text = readText(join(ROOT, file))
    if (!text.includes("from '@/cases/cases-metrics.json'")) {
      throw new Error(`${file} 没有读取实测数字（应 import '@/cases/cases-metrics.json'）`)
    }
    if (!/metrics\.scenarios/.test(text)) {
      throw new Error(`${file} 没有渲染 metrics.scenarios —— 数字必须是实测值，不能手写`)
    }
  }
}

function main() {
  const nativeDir = join(SRC_DIR, 'native')
  if (!existsSync(nativeDir)) throw new Error('docs/examples/native 不存在')
  const names = readdirSync(nativeDir)
    .filter((f) => f.endsWith('.vue'))
    .map((f) => f.slice(0, -4))
    .sort()

  const scenarios = names.map((name) => {
    const title = TITLES[name]
    if (!title) throw new Error(`场景 ${name} 没有登记标题（scripts/gen-cases-metrics.mjs 的 TITLES）`)
    const esFile = `docs/examples/es/${name}.vue`
    if (!existsSync(join(ROOT, esFile))) throw new Error(`缺少对照实现 ${esFile}`)
    const native = measure(`docs/examples/native/${name}.vue`)
    const es = measure(esFile)
    return {
      id: name,
      title,
      native,
      es,
      reduction: {
        lines: reduce(native.lines, es.lines),
        events: reduce(native.events, es.events),
        functions: reduce(native.functions, es.functions),
        vIf: reduce(native.vIf, es.vIf),
      },
    }
  })

  // 汇总按「侧」分开累计：把两侧相加得到的是一个没有含义的数（原生 123 + es 77 = 200
  // 说明不了任何事）。keys 与 scenarios[].native / .es 完全一致，读的人不用再猜。
  const sumSide = (side, key) => scenarios.reduce((acc, s) => acc + s[side][key], 0)
  const sideTotals = (side) => ({
    lines: sumSide(side, 'lines'),
    events: sumSide(side, 'events'),
    functions: sumSide(side, 'functions'),
    vIf: sumSide(side, 'vIf'),
  })

  const out = {
    $comment:
      '由 scripts/gen-cases-metrics.mjs 从 docs/examples/{native,es}/*.vue 实测生成，禁止手改。Cases 页展示的行数/事件/函数/v-if 就是这里算出来的，改示例即改数字。',
    method:
      '同一场景两侧实现同一功能范围（无省略号、无 stub）；lines = 整文件非空行（含数据与 schema，不藏配置成本）；events = 模板事件绑定数；functions = script 自写函数数；vIf = v-if/v-else-if 分支数；reduction = (native - es) / native。',
    scenarios,
    totals: { native: sideTotals('native'), es: sideTotals('es') },
  }

  const text = `${JSON.stringify(out, null, 2)}\n`
  checkSites()
  if (CHECK) {
    if (!existsSync(TARGET)) {
      console.error('[cases-metrics] 缺少 docs/cases/cases-metrics.json，先运行 node scripts/gen-cases-metrics.mjs')
      process.exit(1)
    }
    if (!sameText(readFileSync(TARGET, 'utf8'), text)) {
      console.error('[cases-metrics] 产出过期：示例改了而 cases-metrics.json 没更新（或反之）。运行 node scripts/gen-cases-metrics.mjs')
      process.exit(1)
    }
    console.log(`[cases-metrics] 一致：${scenarios.length} 个场景`)
    return
  }

  writeFileSync(TARGET, text)
  console.log(`[cases-metrics] 已生成 ${scenarios.length} 个场景 → docs/cases/cases-metrics.json`)
  for (const s of scenarios) {
    // 降幅可能为负（声明式配置在很小的场景里不一定更短）—— 负数如实显示成 +x%
    const pct = (v) => (v >= 0 ? `−${v}%` : `+${Math.abs(v)}%`)
    console.log(
      `  · ${s.id}：行 ${s.native.lines}→${s.es.lines}（${pct(s.reduction.lines)}）` +
        ` · 事件 ${s.native.events}→${s.es.events}（${pct(s.reduction.events)}）` +
        ` · 函数 ${s.native.functions}→${s.es.functions}（${pct(s.reduction.functions)}）` +
        ` · v-if ${s.native.vIf}→${s.es.vIf}（${pct(s.reduction.vIf)}）`,
    )
  }
}

// 只在直接运行时生成：被 import（测试、别的脚本）时不得覆写产物。
// 与本仓 `gen-one-config-diff.mjs` 的教训一致 —— 那个脚本没有 main-guard，import 它会写文件。
const invokedDirectly =
  process.argv[1] && resolve(process.argv[1]) === fileURLToPath(import.meta.url)
if (invokedDirectly) main()
