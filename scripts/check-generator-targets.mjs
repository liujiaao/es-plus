#!/usr/bin/env node
/**
 * 「同一份配置 → 三端」生成能力校验
 *
 * 背景：这是 es-plus 的头号卖点，而站点的 AI CRUD 演示此前**完全没体现它** ——
 * 离线路径用的是旧生成器 generateCrudConfig + generateCode（写死 Vue 3 + Element Plus），
 * 而 MCP Server / CLI 用的是 generateCrudSchema(desc, target)。
 * 于是页面顶部那句「IDE 里 Claude Code 调 MCP server 跑的就是这套逻辑」对离线路径并不成立。
 *
 * 换成同一个函数之后，三端支持随之而来。本脚本把「三端产出确实不同且各自正确」钉成断言：
 * 任何一次让某个 target 退化成另一个（或退化成不区分 target 的输出）的改动都会在这里失败。
 *
 * 校验方式：用同一段自然语言描述分别生成三个 target，比对**每个 target 应有的特征**：
 *   - summary 里点名的 es-plus 包名（use @es-plus/vue3 / @es-plus/vue2 / @es-plus/adapter-antdv）
 *   - 第三方 UI 库的 import（element-plus / element-ui / ant-design-vue）
 *   - 脚本形态（vue2 必须是 defineComponent；vue3 与 antdv 是 script setup）
 *   - 三者的 wrapper 代码两两不同（防止「换了 target 但代码没变」）
 *
 * 用法：node scripts/check-generator-targets.mjs
 * 退出码：0 = 三端均可区分且特征正确；1 = 有 target 退化。
 */
import { mkdtempSync, mkdirSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join, dirname } from 'node:path'
import { fileURLToPath } from 'node:url'
import { pathToFileURL } from 'node:url'
import { build } from 'esbuild'

const __dirname = dirname(fileURLToPath(import.meta.url))
const ROOT = join(__dirname, '..')

let failed = false
const fail = (msg) => {
  failed = true
  console.error(`❌ ${msg}`)
}

/** 三端各自应有的特征（改生成器时同步这里） */
const EXPECT = {
  vue3: {
    pkgMention: '@es-plus/vue3',
    uiImport: 'element-plus',
    script: 'script setup',
  },
  vue2: {
    pkgMention: '@es-plus/vue2',
    uiImport: 'element-ui',
    script: 'defineComponent',
  },
  antdv: {
    pkgMention: '@es-plus/adapter-antdv',
    uiImport: 'ant-design-vue',
    script: 'script setup',
  },
}

const DESC =
  '用户管理页面，查询条件有姓名、手机号、状态，表格显示姓名、手机号、邮箱、状态、创建时间，支持新增编辑删除'

async function main() {
  // 直接从 TS 源码打包调用，避免依赖 dist 是否已构建
  const tmpDir = mkdtempSync(join(tmpdir(), 'es-targets-'))
  const bundle = join(tmpDir, 'shared.mjs')
  await build({
    entryPoints: [join(ROOT, 'packages/shared/src/index.ts')],
    bundle: true,
    format: 'esm',
    outfile: bundle,
    platform: 'node',
    logLevel: 'silent',
  })
  const shared = await import(pathToFileURL(bundle).href)

  const outputs = {}
  for (const [target, exp] of Object.entries(EXPECT)) {
    let r
    try {
      r = shared.generateCrudSchema(DESC, target)
    } catch (e) {
      fail(`generateCrudSchema(desc, '${target}') 抛错：${e.message}`)
      continue
    }
    outputs[target] = r.wrapperCode

    if (!r.summary.includes(exp.pkgMention)) {
      fail(`target=${target} 的 summary 未点名 ${exp.pkgMention}（实际：${r.summary.split('\n')[0]}…）`)
    }
    if (!r.wrapperCode.includes(exp.uiImport)) {
      fail(`target=${target} 的 wrapper 未引用 ${exp.uiImport} —— 三端产出没有区分开`)
    }
    if (!r.wrapperCode.includes(exp.script)) {
      fail(`target=${target} 的 wrapper 未使用 ${exp.script}（脚本形态与 target 不符）`)
    }
    if (r.target !== target) {
      fail(`target=${target} 的返回里 target 字段是 ${r.target}`)
    }
    if (!r.wrapperCode || r.wrapperCode.length < 200) {
      fail(`target=${target} 的 wrapper 过短（${r.wrapperCode.length} 字符），疑似未生成`)
    }
  }

  // 两两不同：换了 target 代码必须真的变
  const keys = Object.keys(outputs)
  for (let i = 0; i < keys.length; i++) {
    for (let j = i + 1; j < keys.length; j++) {
      if (outputs[keys[i]] === outputs[keys[j]]) {
        fail(`target=${keys[i]} 与 target=${keys[j]} 的产出完全相同 —— target 没有生效`)
      }
    }
  }

  if (failed) {
    console.error('\n三端生成能力存在退化。')
    process.exit(1)
  }
  const sizes = Object.entries(outputs).map(([k, v]) => `${k}=${v.split('\n').length}行`).join(' / ')
  console.log(`✅ 三端产出可区分且特征正确（${sizes}）`)
  console.log('   vue3 → script setup + element-plus')
  console.log('   vue2 → defineComponent + element-ui')
  console.log('   antdv → script setup + ant-design-vue')
}

main()
