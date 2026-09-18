#!/usr/bin/env node
/**
 * es-eui（Vue 2 + Element UI）主题桥接单源生成。
 *
 * 从 docs/tokens/design-tokens.css 的 --es-brand-primary 生成
 * es-eui/src/styles/element-theme.generated.scss。
 *
 * 为什么必须「生成」而不是在 SCSS 里手写一份常量：
 *   Element UI 2.x 的主题是**编译期 SCSS 变量** —— $--color-primary 在
 *   packages/theme-chalk/src/common/var.scss 里声明为 `!default`，浅色阶
 *   --color-primary-light-1..9 由 mix() 从它派生；运行期无法用 CSS 自定义属性覆盖
 *   （编译产物里是写死的十六进制）。也就是说这个值必须以字面量进入构建，于是只有
 *   两个选择：手写第二份（必然漂移）或从单源生成。这里选后者，使「改 token 文件」
 *   仍然是三站唯一需要做的事。
 *
 * 为什么只需要覆盖 $--color-primary 一个变量：
 *   浅色阶 --color-primary-light-1..9 由 common/var.scss 用 mix() 从主色派生，
 *   编译期自动跟着变，无需手工列色阶。实测覆盖后产物中 #3b82f6 出现 391 次、
 *   库默认蓝 #409eff 出现 0 次，且与官方编译版的 1549 个 .el-* 类名完全一致。
 *
 * 为什么还要设 $--font-path：
 *   icon.scss 里写的是 url('#{$--font-path}/element-icons.woff')，而 var.scss 的默认值是
 *   相对的 'fonts'。官方编译版 CSS 与 lib/theme-chalk/fonts/ 同目录，所以相对路径能解析；
 *   而本生成物位于 es-eui/src/styles/，其下没有 fonts/，webpack 会以
 *   「Cannot find module 'fonts/element-icons.woff'」直接构建失败。
 *   因此这里把 $--font-path 指到包内的字体目录（模块路径），由 webpack 解析并产出资源。
 *   注意：单用 sass CLI 编译**不会**暴露这个问题（sass 不解析 url()），必须走真实构建。
 *
 * 反直觉的一点（实测踩过，别再"修"回去）：
 *   看上去 index.scss 没有 import icon.scss，于是容易想在这里补一句
 *   `@import '.../src/icon'` "以防图标丢失"。但那是多余的 ——
 *   index.scss 的第一行是 base.scss，而 base.scss:2 就是 `@import "icon.scss"`。
 *   补这一句只会把 @font-face 与 284 个 icon 规则各写两遍（实测 +17KB、icon 规则
 *   出现次数 651 vs 368），图标一个都不会多。判断"有没有被引入"必须跟到传递依赖，
 *   只看 index.scss 自身的行会被误导。
 *
 * 用法：
 *   node scripts/gen-element-theme.mjs           # 生成
 *   node scripts/gen-element-theme.mjs --check   # 校验生成物是否为最新（CI）
 *
 * 退出码：0 = 成功/一致；1 = 单源缺失或生成物过期。
 */
import { readFileSync, writeFileSync, existsSync, mkdirSync } from 'node:fs'
import { fileURLToPath } from 'node:url'
import { dirname, join } from 'node:path'
import { readText, sameText } from './lib/text-sync.mjs'

const __dirname = dirname(fileURLToPath(import.meta.url))
const ROOT = join(__dirname, '..')
const TOKENS = join(ROOT, 'docs', 'tokens', 'design-tokens.css')
const TARGET = join(ROOT, 'es-eui', 'src', 'styles', 'element-theme.generated.scss')

const CHECK = process.argv.includes('--check')

function rel(p) {
  return p.replace(ROOT + '\\', '').replace(ROOT + '/', '').replace(/\\/g, '/')
}

/** 从 token 单源取品牌主色；取不到即失败（不能静默用 Element UI 默认蓝） */
function readBrandPrimary() {
  if (!existsSync(TOKENS)) {
    console.error(`❌ 单源缺失：${rel(TOKENS)}`)
    process.exit(1)
  }
  const src = readText(TOKENS)
  const m = src.match(/--es-brand-primary:\s*(#[0-9a-fA-F]{3,8})\s*;/)
  if (!m) {
    console.error(
      `❌ 未能在 ${rel(TOKENS)} 定位 --es-brand-primary（格式应为 \`--es-brand-primary: #rrggbb;\`）`,
    )
    process.exit(1)
  }
  return m[1]
}

function buildContent(brandPrimary) {
  return `// 本文件由 scripts/gen-element-theme.mjs 生成，禁止手改。
// 单一真源：docs/tokens/design-tokens.css 的 --es-brand-primary
// 改品牌色请改单源，然后运行 \`npm run element-theme:sync\`。
//
// 只覆盖 $--color-primary：Element UI 的浅色阶（--color-primary-light-1..9）
// 由 common/var.scss 的 mix() 从主色派生，编译期自动跟着变，无需手工列色阶。
//
// 不要再手动 @import icon.scss：图标已由 base.scss 传递引入
// （index.scss → base.scss → icon.scss），重复引入只会把 @font-face 与
// 284 个 icon 规则各写两遍（实测 +17KB），并不会多保住任何一个图标。
//
// $--font-path 必须显式设置：icon.scss 用的是相对路径 'fonts'，
// 而本文件不在 lib/theme-chalk/ 下，不指到包内字体目录会构建失败。
$--font-path: '~element-ui/packages/theme-chalk/src/fonts';

$--color-primary: ${brandPrimary};

@import '~element-ui/packages/theme-chalk/src/index';
`
}

function main() {
  const brandPrimary = readBrandPrimary()
  const content = buildContent(brandPrimary)

  if (CHECK) {
    if (!existsSync(TARGET)) {
      console.error(`❌ 生成物缺失：${rel(TARGET)}（运行 \`npm run element-theme:sync\` 生成）`)
      process.exit(1)
    }
    if (!sameText(readText(TARGET), content)) {
      console.error(
        `❌ ${rel(TARGET)} 与单源不一致（品牌色 ${brandPrimary}）——` +
          '运行 `npm run element-theme:sync` 重新生成，不要手改生成物。',
      )
      process.exit(1)
    }
    console.log(`✅ es-eui Element UI 主题桥接与单源一致（$--color-primary: ${brandPrimary}）`)
    return
  }

  const dir = dirname(TARGET)
  if (!existsSync(dir)) mkdirSync(dir, { recursive: true })
  writeFileSync(TARGET, content)
  console.log(`✅ 已生成 ${rel(TARGET)}（$--color-primary: ${brandPrimary}）`)
}

main()
