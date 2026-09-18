#!/usr/bin/env node
/**
 * 主题桥接校验：单源 token 是否**真的被消费**（而不是只被拷贝过）。
 *
 * 背景：`tokens:check` 只逐字节比对三站副本是否等于 docs/tokens/design-tokens.css，
 * 它证明的是"文件被同步了"。而当时三站的真实状况是：文件都在、门禁全绿，但
 *   - es-plus-docs 的 Element Plus 组件读的是 --el-color-*，token 里没有这个名字，
 *     于是 el-* 用库默认蓝 #409EFF、自研组件用品牌蓝 #3b82f6 —— 同页两种蓝；
 *   - es-pc 的 Ant Design Vue 4.x 是 cssinjs 主题，根本不读 CSS 变量，且没有传
 *     ConfigProvider theme；
 *   - es-eui 的 Element UI 2.x 主题是编译期 SCSS 变量，运行期换不掉。
 * 也就是说「token 生效」这件事此前**没有任何门禁覆盖**，文件同步得再准也不代表
 * 品牌色到了组件上。本脚本补的就是这条边：对每个站点断言"消费点存在"。
 *
 * 校验项（每条都对应一个真实失败模式，不是形式检查）：
 *   1. token 单源里存在 Element Plus 运行时桥接（--el-color-primary 及色阶）——
 *      缺失即主站组件退回库默认蓝；
 *   2. 存在 :root.dark 桥接块 —— element-plus 的 html.dark 会把主色重置回 #409eff，
 *      只有 .dark（0,1,0）会输给它（0,1,1），必须用 :root.dark 提高特异性；
 *   3. es-plus-docs：main.ts 引入 EP 暗色变量、theme.ts 挂 `dark` 类（而非自造类名）；
 *   4. es-pc：App.vue 把 --es-brand-primary 的计算值传给 ConfigProvider 的 colorPrimary；
 *   5. es-eui：main.js 引的是生成的 SCSS 主题（而非 element-ui 预编译 CSS），
 *      且生成物把 $--color-primary 设为单源品牌色、且**没有**重复 import icon.scss。
 *
 * 用法：node scripts/check-theme-bridge.mjs
 * 退出码：0 = 全部接通；1 = 有站点未接通或有接线错误。
 */
import { readFileSync, existsSync } from 'node:fs'
import { fileURLToPath } from 'node:url'
import { dirname, join } from 'node:path'

const __dirname = dirname(fileURLToPath(import.meta.url))
const ROOT = join(__dirname, '..')

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

// ── 0. 单源品牌色 ────────────────────────────────────────
const TOKENS = 'docs/tokens/design-tokens.css'
const tokensSrc = read(TOKENS)
const brandMatch = tokensSrc && tokensSrc.match(/--es-brand-primary:\s*(#[0-9a-fA-F]{3,8})\s*;/)
const brandPrimary = brandMatch ? brandMatch[1] : null
if (!brandPrimary) fail(`未能在 ${TOKENS} 定位 --es-brand-primary`)

// ── 1/2. Element Plus 运行时桥接（浅色 + 暗色）────────────
function checkEpBridge() {
  if (!tokensSrc) return
  const required = [
    '--el-color-primary',
    '--el-color-primary-light-3',
    '--el-color-primary-light-5',
    '--el-color-primary-light-7',
    '--el-color-primary-light-8',
    '--el-color-primary-light-9',
    '--el-color-primary-dark-2',
  ]
  const missing = required.filter((v) => !new RegExp(`${v}\\s*:`).test(tokensSrc))
  if (missing.length) {
    fail(
      `${TOKENS} 缺少 Element Plus 运行时桥接变量：${missing.join(', ')}` +
        '（只覆盖 --el-color-primary 不够，hover/disabled 读的是 light-3/5/7/8/9）',
    )
  } else {
    console.log('✅ Element Plus 运行时桥接完整（主色 + light-3/5/7/8/9 + dark-2）')
  }

  if (!/:root\.dark\s*\{[\s\S]*?--el-color-primary\s*:/.test(tokensSrc)) {
    fail(
      `${TOKENS} 缺少 :root.dark 下的 --el-color-primary 覆盖。` +
        'element-plus/theme-chalk/dark/css-vars.css 的选择器是 html.dark（特异性 0,1,1），' +
        '并会把主色重置回 #409eff；用 .dark（0,1,0）会被它压过，暗色下主色被打回库默认蓝。',
    )
  } else {
    console.log('✅ 暗色下的 Element Plus 主色桥接存在（:root.dark）')
  }
}

// ── 3. es-plus-docs ─────────────────────────────────────
function checkDocsWiring() {
  const main = read('es-plus-docs/src/main.ts')
  if (main && !/element-plus\/theme-chalk\/dark\/css-vars\.css/.test(main)) {
    fail(
      'es-plus-docs/src/main.ts 未引入 element-plus/theme-chalk/dark/css-vars.css —— ' +
        '切到暗色时只有站点外壳变暗，正文里的 el-* 组件仍是亮色（半残暗色）。',
    )
  } else if (main) {
    console.log('✅ es-plus-docs 引入了 Element Plus 暗色变量')
  }

  const theme = read('es-plus-docs/src/stores/theme.ts')
  if (theme) {
    if (!/classList\.add\('dark'\)/.test(theme)) {
      fail(
        "es-plus-docs/src/stores/theme.ts 未挂 `dark` 类 —— Element Plus / vxe-table / antdv " +
          '的暗色主题都以根元素 `dark` 为约定键，自造类名（如 is-dark）不会被任何库识别。',
      )
    } else if (/classList\.add\('is-dark'\)/.test(theme)) {
      fail("es-plus-docs/src/stores/theme.ts 仍在挂自造类名 is-dark（应统一为 dark）")
    } else {
      console.log('✅ es-plus-docs 暗色类名为约定的 `dark`')
    }
  }
}

// ── 4. es-pc ────────────────────────────────────────────
function checkPcWiring() {
  const app = read('es-pc/src/App.vue')
  if (!app) return
  if (!/colorPrimary/.test(app)) {
    fail(
      'es-pc/src/App.vue 未向 ConfigProvider 传 theme.token.colorPrimary —— ' +
        'Ant Design Vue 4.x 是 cssinjs 主题，不读任何 CSS 变量；不传就是 a-* 组件用库默认蓝 ' +
        '#1677ff、自研组件用品牌蓝 #3b82f6（同页两种蓝）。',
    )
    return
  }
  if (!/getPropertyValue\(\s*'--es-brand-primary'\s*\)/.test(app)) {
    fail(
      'es-pc/src/App.vue 的 colorPrimary 未从 --es-brand-primary 读取 —— ' +
        '写死字面量会与 docs/tokens/design-tokens.css 形成第二份品牌色副本，必然漂移。',
    )
    return
  }
  console.log('✅ es-pc 的 AntDV 主色从单源 token 读取')
}

// ── 5. es-eui ───────────────────────────────────────────
function checkEuiWiring() {
  const main = read('es-eui/src/main.js')
  if (main) {
    if (/element-ui\/lib\/theme-chalk\/index\.css/.test(main)) {
      fail(
        'es-eui/src/main.js 仍在引 element-ui 的预编译 CSS —— 其中主色是写死的 #409EFF，' +
          '运行期无法覆盖；应改为引入生成的 SCSS 主题（element-theme.generated.scss）。',
      )
    } else if (!/element-theme\.generated\.scss/.test(main)) {
      fail('es-eui/src/main.js 未引入 styles/element-theme.generated.scss')
    } else {
      console.log('✅ es-eui 引入的是由单源生成的 Element UI 主题')
    }
  }

  const gen = 'es-eui/src/styles/element-theme.generated.scss'
  const src = read(gen)
  if (!src) return
  if (brandPrimary && !new RegExp(`\\$--color-primary:\\s*${brandPrimary}\\s*;`).test(src)) {
    fail(`${gen} 的 $--color-primary 不等于单源品牌色 ${brandPrimary}（运行 npm run element-theme:sync）`)
  } else {
    console.log(`✅ es-eui 的 $--color-primary 来自单源（${brandPrimary}）`)
  }
  // 重复 import icon.scss 会把 @font-face 与 284 个 icon 规则各写两遍（实测 +17KB），
  // 且图标本已由 base.scss 传递引入 —— 这条断言防止它被"好心"加回来。
  if (/@import\s+['"][^'"]*icon(\.scss)?['"]/.test(src)) {
    fail(
      `${gen} 手动 import 了 icon.scss —— 多余且有害：index.scss → base.scss → icon.scss ` +
        '已传递引入，重复引入只让 @font-face 与 284 个 icon 规则各写两遍（实测 +17KB）。',
    )
  } else {
    console.log('✅ es-eui 未重复引入 icon.scss（图标由 base.scss 传递引入）')
  }
}

checkEpBridge()
checkDocsWiring()
checkPcWiring()
checkEuiWiring()

if (failed) {
  console.error('\n主题桥接未接通 —— token 单源已同步但组件未消费，改 token 不会生效。')
  process.exit(1)
}
console.log('\n主题桥接（token → 各渲染器主题入口）✅')
