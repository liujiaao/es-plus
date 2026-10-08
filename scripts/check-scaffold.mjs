#!/usr/bin/env node
/**
 * create-es-plus 脚手架模板 ↔ 契约 一致性校验
 *
 * 背景：`packages/create-es-plus/templates/{vue3,vue2,antdv}` 是三份会被原样拷进用户项目的
 * starter。它们不在任何 workspace 的构建/lint 图里（引用的依赖要 scaffold 之后才装），所以
 * 既有的那套守卫一个都盯不到它们 —— 一处模板悄悄分叉（build 脚本漏了、换错渲染器包、demo
 * 配置三端不再一致、formtype 写了个库根本不认的值）本地全绿，直到用户 `npm create` 才炸。
 * 本脚本把这些模板该守的不变量显式钉死，和其它 check:* 一样纳入 check:consistency。
 *
 * 校验项（都是相等性/集合判定，不是「出现过某字段」式检查）：
 *   1. 结构：每份模板都含约定的必备文件（vue2 另需 _npmrc）；
 *   2. package.json：合法 JSON，type=module、private=true，dev/build/preview 脚本逐字匹配，
 *      渲染器依赖存在且固定为 "latest"（发包后能解析到刚发布的版本），vue2 另需 composition-api；
 *   3. main.ts：import 了对应渲染器包与其 dist 样式（防止换错包 / 漏样式）；
 *   4. demo.config.json：三端逐字节一致（「一份配置，三端一致」的字面保证）；
 *   5. demo.config.json 里每个 formItems[].formtype ∈ core 的 VALID_FORM_TYPES（单一真源）。
 *
 * 用法：node scripts/check-scaffold.mjs
 * 退出码：0 = 全部一致；1 = 任一不变量被破坏。
 */
import { readFileSync, existsSync } from 'node:fs'
import { fileURLToPath } from 'node:url'
import { dirname, join } from 'node:path'

const __dirname = dirname(fileURLToPath(import.meta.url))
const ROOT = join(__dirname, '..')
const TPL = join(ROOT, 'packages', 'create-es-plus', 'templates')

let failed = false
const fail = (msg) => {
  failed = true
  console.error(`❌ ${msg}`)
}
const read = (p) => readFileSync(p, 'utf-8')
const readJson = (p) => JSON.parse(read(p))

// 三端共有的必备文件（相对各模板根）
const COMMON_FILES = [
  'README.md',
  '_gitignore',
  'env.d.ts',
  'index.html',
  'package.json',
  'src/App.vue',
  'src/main.ts',
  'src/views/DemoCrud.vue',
  'src/views/demo.config.json',
  'tsconfig.json',
  'vite.config.ts',
]

// 每端的契约。`build` 为 undefined 时表示 `vue-tsc --noEmit && vite build`（vue3/antdv），
// vue2 刻意只有 `vite build`（plugin-vue2 + vue-tsc 组合坑多，见模板 README）。
const VUE_TSC_BUILD = 'vue-tsc --noEmit && vite build'
const TEMPLATES = [
  { dir: 'vue3', dep: '@es-plus/vue3', build: VUE_TSC_BUILD, extraFiles: [], extraDeps: [] },
  {
    dir: 'vue2',
    dep: '@es-plus/vue2',
    build: 'vite build',
    extraFiles: ['_npmrc'],
    extraDeps: ['@vue/composition-api'],
  },
  { dir: 'antdv', dep: '@es-plus/adapter-antdv', build: VUE_TSC_BUILD, extraFiles: [], extraDeps: [] },
]

/** VALID_FORM_TYPES（core/constants.ts）—— 与其它守卫一致，用正则读单一真源。 */
function parseValidFormTypes() {
  const src = read(join(ROOT, 'packages/core/src/constants.ts'))
  const m = src.match(/VALID_FORM_TYPES\s*=\s*\[([\s\S]*?)\]\s*as const/)
  if (!m) {
    fail('未能在 core/constants.ts 定位 VALID_FORM_TYPES')
    return null
  }
  return m[1]
    .split(',')
    .map((s) => s.trim().replace(/^['"]|['"]$/g, ''))
    .filter(Boolean)
}

function checkTemplate(t) {
  const base = join(TPL, t.dir)
  if (!existsSync(base)) {
    fail(`模板目录不存在：templates/${t.dir}`)
    return
  }

  // 1. 结构
  for (const f of [...COMMON_FILES, ...t.extraFiles]) {
    if (!existsSync(join(base, f))) fail(`templates/${t.dir} 缺少文件：${f}`)
  }

  // 2. package.json
  let pkg
  try {
    pkg = readJson(join(base, 'package.json'))
  } catch (e) {
    fail(`templates/${t.dir}/package.json 不是合法 JSON：${e.message}`)
    return
  }
  if (pkg.type !== 'module') fail(`templates/${t.dir}/package.json 的 type 应为 "module"`)
  if (pkg.private !== true) fail(`templates/${t.dir}/package.json 的 private 应为 true`)
  const scripts = pkg.scripts || {}
  if (scripts.dev !== 'vite') fail(`templates/${t.dir} 的 dev 脚本应为 "vite"，实际 "${scripts.dev}"`)
  if (scripts.build !== t.build)
    fail(`templates/${t.dir} 的 build 脚本应为 "${t.build}"，实际 "${scripts.build}"`)
  if (scripts.preview !== 'vite preview')
    fail(`templates/${t.dir} 的 preview 脚本应为 "vite preview"，实际 "${scripts.preview}"`)

  const deps = pkg.dependencies || {}
  if (!(t.dep in deps)) {
    fail(`templates/${t.dir} 未依赖渲染器包 ${t.dep}`)
  } else if (deps[t.dep] !== 'latest') {
    fail(`templates/${t.dir} 的 ${t.dep} 应固定为 "latest"，实际 "${deps[t.dep]}"（发包后才能解析到新版本）`)
  }
  for (const d of t.extraDeps) {
    if (!(d in deps)) fail(`templates/${t.dir} 缺少必备依赖 ${d}`)
  }

  // 3. main.ts 必须 import 对应渲染器包与其 dist 样式
  const main = read(join(base, 'src/main.ts'))
  if (!main.includes(`from '${t.dep}'`)) fail(`templates/${t.dir}/main.ts 未从 ${t.dep} 导入渲染器`)
  if (!main.includes(`'${t.dep}/dist/style.css'`))
    fail(`templates/${t.dir}/main.ts 未导入 ${t.dep}/dist/style.css`)

  if (!failed) console.log(`✅ templates/${t.dir} 结构 / package.json / main.ts 一致`)
}

function main() {
  const validFormTypes = parseValidFormTypes()

  for (const t of TEMPLATES) checkTemplate(t)

  // 4. demo.config.json 三端逐字节一致
  const configs = TEMPLATES.map((t) => ({
    dir: t.dir,
    path: join(TPL, t.dir, 'src/views/demo.config.json'),
  })).filter((c) => existsSync(c.path))
  if (configs.length === TEMPLATES.length) {
    const bytes = configs.map((c) => readFileSync(c.path))
    const base = bytes[0]
    const diverged = configs.slice(1).filter((_, i) => !base.equals(bytes[i + 1]))
    if (diverged.length) {
      fail(`demo.config.json 三端未逐字节一致（分叉：${diverged.map((c) => c.dir).join(', ')}）`)
    } else {
      console.log('✅ demo.config.json 三端逐字节一致')
    }

    // 5. formtype ∈ VALID_FORM_TYPES
    if (validFormTypes) {
      let cfg
      try {
        cfg = JSON.parse(base.toString('utf-8'))
      } catch (e) {
        fail(`demo.config.json 不是合法 JSON：${e.message}`)
        cfg = null
      }
      if (cfg) {
        const items = Array.isArray(cfg.formItems) ? cfg.formItems : []
        const bad = items
          .map((it) => it && it.formtype)
          .filter((ft) => ft && !validFormTypes.includes(ft))
        if (bad.length) {
          fail(
            `demo.config.json 用了 VALID_FORM_TYPES 之外的 formtype：${[...new Set(bad)].join(', ')}` +
              `（合法集：${validFormTypes.join(', ')}）`,
          )
        } else {
          console.log(`✅ demo.config.json 的 formtype 均在 VALID_FORM_TYPES 内`)
        }
      }
    }
  }

  if (failed) {
    console.error('\ncreate-es-plus 模板与契约不一致 —— 修到上面每条都过为止。')
    process.exit(1)
  }
  console.log('\ncreate-es-plus 脚手架模板 ↔ 契约 一致 ✅')
}

main()
