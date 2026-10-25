#!/usr/bin/env node
/**
 * 守卫：ES-Plus 一等公民字段必须真的是 vxe 的配置项（名字对得上，才算直传）。
 *
 * 背景（真实事故）：`TableOptions.clipboardConfig` 曾经是三端都导出的「一等公民」字段，
 * 文档还写着「Ctrl+C 复制 / Ctrl+V 粘贴，需先开启 mouseConfig.selected」。实际上：
 *   · vxe 的表属性叫 `clipConfig`，没有 `clipboardConfig` —— vxe-grid 只透传它
 *     `tableProps` 里声明过的键，剩下的进 `$attrs`，**静默丢弃**；
 *   · 就算写对名字，`clipConfig` 也只在装了区域选择模块（`$xeTable.triggerCelllAreaMnEvent`
 *     存在）时才生效，免费栈里会打 `vxe.error.notProp` 警告。
 * 于是这个字段从 1.x 起一直是「文档教了、配了没反应」的死配置 —— 读者照抄，
 * 排查成本落在使用者身上。这类错误编译不出、测试不红，只能靠对上游 props 断言。
 *
 * 做法（确定性）：
 *   1. 从 `packages/core/src/vxe-engine/build-grid-config.ts` 抽出所有 `opts.<key>` ——
 *      这些就是被直传进 vxe-grid 的一等公民字段（去注释后再抓，避免注释里的字样干扰）；
 *   2. 从 vxe 源码解析合法键集：`table/src/props.js` 的四空格顶层键 ∪
 *      `grid/src/props.js|grid.js` 里 `Object.assign(..., tableProps)` 追加的键；
 *   3. 断言每个一等公民字段都在这两个集合里。
 *
 * 覆盖两个大版本：v4（根 `node_modules/vxe-table`，主仓 devDependency，必需）与
 * v3（`es-eui/node_modules/vxe-table`，站点独立安装，装了才校验 —— 没装时**明说跳过**，
 * 不做静默通过）。
 *
 * 为什么不做成「按名字前缀猜」：`mouseConfig` / `validConfig` 都是真 prop，
 * `clipboardConfig` 只差两个字母却是假的 —— 名字像不像没有意义，只能比对上游。
 *
 * 用法：node scripts/check-first-class-vxe-keys.mjs
 * 退出码：0 = 全部对得上；1 = 有幻影字段 / 解析不出键集（空集恒绿是这类守卫最常见的失灵方式）
 */
import { readFileSync, existsSync } from 'node:fs'
import { fileURLToPath } from 'node:url'
import { dirname, join } from 'node:path'

const ROOT = join(dirname(fileURLToPath(import.meta.url)), '..')
const SRC = join(ROOT, 'packages', 'core', 'src', 'vxe-engine', 'build-grid-config.ts')

const ENGINES = [
  { version: 'v4', dir: join(ROOT, 'node_modules', 'vxe-table'), required: true },
  { version: 'v3', dir: join(ROOT, 'es-eui', 'node_modules', 'vxe-table'), required: false },
]

/** 去掉 // 与 /* *\/ 注释（只做行级/块级粗剥，用于抓 `opts.xxx`） */
function stripComments(src) {
  return src.replace(/\/\*[\s\S]*?\*\//g, '').replace(/(^|[^:])\/\/.*$/gm, '$1')
}

/** 一等公民字段：build-grid-config.ts 里被读的 `opts.<key>` */
function firstClassKeys() {
  if (!existsSync(SRC)) {
    console.error(`❌ 找不到 ${SRC} —— 生成器改名了就同步本脚本，别让它空着跑`)
    process.exit(1)
  }
  const src = stripComments(readFileSync(SRC, 'utf8'))
  const keys = new Set()
  for (const m of src.matchAll(/\bopts\.([A-Za-z_$][\w$]*)/g)) keys.add(m[1])
  // 反空集：这份文件至少要有十个直传字段，否则是解析失效而不是「刚好没有」
  if (keys.size < 10) {
    console.error(`❌ 只从 build-grid-config.ts 解析出 ${keys.size} 个字段 —— 解析器失效，先修脚本`)
    process.exit(1)
  }
  return keys
}

/** vxe 表属性：`table/src/props.js` 里四空格缩进的顶层键 */
function tablePropsOf(engineDir) {
  const file = join(engineDir, 'es', 'table', 'src', 'props.js')
  if (!existsSync(file)) return null
  const src = readFileSync(file, 'utf8')
  const keys = new Set()
  for (const m of src.matchAll(/^ {4}([A-Za-z_$][\w$]*)\s*:/gm)) keys.add(m[1])
  return { file, keys }
}

/** vxe-grid 在 tableProps 之外追加的键（pagerConfig / proxyConfig / toolbarConfig …） */
function gridExtraPropsOf(engineDir) {
  for (const rel of ['es/grid/src/props.js', 'es/grid/src/grid.js']) {
    const file = join(engineDir, rel)
    if (!existsSync(file)) continue
    const src = readFileSync(file, 'utf8')
    const at = src.indexOf('tableProps),')
    if (at === -1) continue
    // `tableProps), { layouts: Array, … }` —— 取到这段对象结束的花括号
    const open = src.indexOf('{', at)
    const close = src.indexOf('}', open)
    if (open === -1 || close === -1) continue
    const keys = new Set()
    const seg = src.slice(open, close)
    for (const m of seg.matchAll(/([A-Za-z_$][\w$]*)\s*:\s*(?:Array|Object|String|Number|Boolean|\[)/g)) keys.add(m[1])
    if (keys.size) return { file, keys }
  }
  return null
}

function main() {
  const wanted = [...firstClassKeys()].sort()
  let failed = false
  let checked = 0

  for (const engine of ENGINES) {
    if (!existsSync(engine.dir)) {
      if (engine.required) {
        console.error(`❌ 未安装 ${engine.version} 的 vxe-table（${engine.dir}）—— 先 npm install，本守卫拒绝空跑`)
        failed = true
      } else {
        console.log(`ℹ️  跳过 ${engine.version}（${engine.dir} 不存在：该站未安装依赖）`)
      }
      continue
    }
    const table = tablePropsOf(engine.dir)
    if (!table || table.keys.size < 30) {
      console.error(`❌ ${engine.version}：解析不出表属性键集（${table ? table.keys.size + ' 个' : '文件缺失'}）`)
      failed = true
      continue
    }
    const grid = gridExtraPropsOf(engine.dir)
    const allowed = new Set([...table.keys, ...(grid ? grid.keys : [])])
    const version = JSON.parse(readFileSync(join(engine.dir, 'package.json'), 'utf8')).version

    const phantom = wanted.filter((k) => !allowed.has(k))
    if (phantom.length) {
      console.error(`❌ ${engine.version}（vxe-table ${version}）里没有这些一等公民字段：${phantom.join(', ')}`)
      console.error(`   一等公民字段必须是 vxe 真有的配置项 —— 写错名字的键会被 vxe-grid 静默丢弃。`)
      console.error(`   真名请查 ${table.file}`)
      failed = true
    } else {
      checked++
      console.log(
        `✅ ${engine.version}（vxe-table ${version}）：${wanted.length} 个一等公民字段全部是合法配置项` +
          `（表属性 ${table.keys.size} + grid 追加 ${grid ? grid.keys.size : 0}）`,
      )
    }
  }

  if (!checked) failed = true
  if (failed) process.exit(1)
}

main()
