#!/usr/bin/env node
/**
 * 片段语料的**执行计划单源**（Wave 5 / AI-42）。
 *
 * ## 为什么需要它
 *
 * `AI-SCENE-COVERAGE-PLAN.md` §1.2 的两列（vite build / 运行时）在片段场景一直是 ❌：
 * `scripts/check-scene-coverage.mjs` 只把片段产物丢给 esbuild **语法解析**，
 * `__tests__/e2e/scripts/run-golden.mjs` 则把用例 `.filter(isCrudCase)` 掉 ——
 * 片段语料从未进过真 `vite build`。这条过滤是**静默**的：语料 +6 例，门禁依然全绿。
 *
 * 本模块把「一条 golden 用例 → 沙箱里要落哪些文件」变成可复用、可断言的纯函数，
 * 供三处共用：
 *   - `run-golden.mjs`：真跑 `vite build`；
 *   - `check-scene-coverage.mjs`：断言「每条片段语料都有可执行计划」+ 断言
 *     **e2e 的运行器真的收录了它**（防止 `.filter(isCrudCase)` 回来）；
 *   - 未来的运行时 tier：同一份用例 → 同一份文件。
 *
 * ## 产物形态
 *
 * 片段产物有两种围栏（`FragmentResult.fence`，AI-28）：
 *   - `'vue'`：自包含 SFC（form / table / dialog 的 component 形态）→ 直接写到 `src/App.vue`；
 *   - `'tsx'`：`useXxxDialog()` composable 模块（dialog 的 composable 形态）→ 模块写到
 *     `src/<name>.tsx|jsx`，另写一个最小宿主 SFC 去 import 它。**只 import、不调用**：
 *     Tier 0 证明的是「模块的命名导出存在 + JSX 能过打包器」，不是运行时行为。
 *     （vue2 的宿主用 options `setup()`，因为 `@vitejs/plugin-vue2` 不认 `<script setup>`。）
 */

import { readdirSync, readFileSync } from 'node:fs'
import { join } from 'node:path'
import {
  generateFormBlock,
  generateTableBlock,
  generateDialogBlock,
} from '@es-plus/shared'
import { DEFAULT_SCENE, sceneOf } from '../eval/scenes.mjs'

/** 场景 → 生成器（与 `check-scene-coverage` 共用，避免两处各写一份映射）。 */
export const FRAGMENT_GENERATORS = Object.freeze({
  table: (input) => generateTableBlock(input),
  form: (input) => generateFormBlock(input),
  dialog: (input) => generateDialogBlock(input),
})

/**
 * 读语料目录，返回 `{ crud, fragments, errors }`。
 *
 * **不抛错**：非法 JSON 收集到 `errors`，由调用方决定是「响亮退出」（e2e 运行器）
 * 还是「记一条可读失败」（check-scene-coverage）。
 */
export function loadGoldenCases(casesDir) {
  const crud = []
  const fragments = []
  const errors = []
  const files = readdirSync(casesDir)
    .filter((f) => f.endsWith('.json'))
    .sort()

  for (const file of files) {
    let raw
    try {
      raw = JSON.parse(readFileSync(join(casesDir, file), 'utf8'))
    } catch (err) {
      errors.push(`${file}: 不是合法 JSON — ${err.message}`)
      continue
    }
    const entry = { file, raw, scene: sceneOf(raw) }
    if (entry.scene === DEFAULT_SCENE) crud.push(entry)
    else fragments.push(entry)
  }
  return { crud, fragments, errors }
}

/** 片段工具的入参：config 原样 + 用例顶层的 target（片段输入本身不含 target）。 */
export function fragmentInput(fragmentCase) {
  return { ...(fragmentCase.raw.config || {}), target: fragmentCase.raw.target }
}

/** 跑该场景的生成器；未知场景响亮抛错（不静默跳过）。 */
export function generateFragment(fragmentCase) {
  const gen = FRAGMENT_GENERATORS[fragmentCase.scene]
  if (!gen) {
    throw new Error(
      `${fragmentCase.file}: scene=${fragmentCase.scene} 没有片段生成器（只有 ${Object.keys(FRAGMENT_GENERATORS).join('/')}）`
    )
  }
  return gen(fragmentInput(fragmentCase))
}

/** composable 名（缺省与 `generateDialogBlock` 的默认值一致）。 */
function composableNameOf(input) {
  return input.composableName || 'useFormDialog'
}

/**
 * composable 形态的宿主 SFC。**只 import + 取用**（不调用 `.open()`）：
 * Tier 0 的职责是打包器见证，运行时时序留给 runtime tier。
 */
function composableHostSfc(fragmentCase, modulePath) {
  const input = fragmentInput(fragmentCase)
  const name = composableNameOf(input)
  const rel = './' + modulePath.replace(/^src\//, '').replace(/\.(tsx|jsx)$/, '')
  // vue2 的插件不认 `<script setup>`；vue3/antdv 用 `<script setup>` 更贴近真实宿主。
  if (fragmentCase.raw.target === 'vue2') {
    return [
      '<template>',
      '  <div />',
      '</template>',
      '',
      '<script>',
      `import { ${name} } from '${rel}'`,
      '',
      'export default {',
      '  setup() {',
      `    ${name}()`,
      '    return {}',
      '  },',
      '}',
      '</script>',
      '',
    ].join('\n')
  }
  return [
    '<template>',
    '  <div />',
    '</template>',
    '',
    '<script setup>',
    `import { ${name} } from '${rel}'`,
    '',
    `${name}()`,
    '</script>',
    '',
  ].join('\n')
}

/**
 * 一条片段用例 → 沙箱文件清单。
 *
 * 返回值恒含 `src/App.vue`（fixture 的 `main.*` 只 import 它），故调用方无需理解形态。
 * 同时返回生成器结果，供调用方做围栏/告警断言。
 */
export function fragmentSandboxFiles(fragmentCase) {
  const input = fragmentInput(fragmentCase)
  const result = generateFragment(fragmentCase)
  const fence = result.fence ?? 'vue'
  const files = []

  if (fence === 'tsx') {
    if (fragmentCase.scene !== 'dialog') {
      throw new Error(
        `${fragmentCase.file}: 只有 dialog 的 composable 形态是 tsx，scene=${fragmentCase.scene} 的产物不应是 tsx`
      )
    }
    const ext = input.typescript === false ? '.jsx' : '.tsx'
    const modulePath = `src/${composableNameOf(input)}${ext}`
    files.push({ path: modulePath, content: result.code })
    files.push({ path: 'src/App.vue', content: composableHostSfc(fragmentCase, modulePath) })
  } else {
    files.push({ path: 'src/App.vue', content: result.code })
  }
  return { files, result, fence }
}
