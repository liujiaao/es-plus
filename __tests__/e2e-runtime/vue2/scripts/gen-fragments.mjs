#!/usr/bin/env node
// Tier 2 fixture 的片段生成步骤（AI-44）。
//
// 为什么在起 dev server **之前**生成：Tier 0（__tests__/e2e/scripts/run-golden.mjs）
// 只证明片段能被 `vite build` 编译；本 fixture 要证的是「挂载后真的跑」。片段产物
// 必须在 fixture 首次被请求前落盘，否则 Vite 会按空目录报模块解析失败。
//
// 输入是 **golden 语料本身**（与 Tier 1 vue3/antdv 的 fragment-runtime.spec.ts 同源），
// 不是手写样张 —— 语料变了，Tier 2 跟着变。
//
// 用法（由 playwright.config.ts 的 webServer command 前缀调用）：
//   node ./scripts/gen-fragments.mjs
//
// 前置：`packages/shared` 已构建（`npm run build:libs`；`npm run test:e2e:runtime`
// 的 pretest 会经 vue2 prebuild 一并构建）。缺构建产物时**立即报错**，不静默跳过。

import { existsSync, mkdirSync, readFileSync, writeFileSync } from 'node:fs'
import { dirname, join, resolve } from 'node:path'
import { fileURLToPath, pathToFileURL } from 'node:url'

const __dirname = dirname(fileURLToPath(import.meta.url))
const REPO_ROOT = resolve(__dirname, '../../../..')
const CASES_DIR = join(REPO_ROOT, '__tests__', 'golden', 'cases')
const OUT_DIR = resolve(__dirname, '../src/fragments')
const SHARED_BUILD = join(REPO_ROOT, 'packages', 'shared', 'build', 'index.js')

if (!existsSync(SHARED_BUILD)) {
  console.error(
    `[gen-fragments] 缺少 ${SHARED_BUILD}\n` +
      `  片段生成器来自 @es-plus/shared 的构建产物。先跑 npm run build:libs（或 npm run test:e2e:runtime 的 pretest）。`
  )
  process.exit(1)
}

const shared = await import(pathToFileURL(SHARED_BUILD).href)
for (const name of ['generateTableBlock', 'generateFormBlock', 'generateDialogBlock']) {
  if (typeof shared[name] !== 'function') {
    console.error(`[gen-fragments] ${SHARED_BUILD} 未导出 ${name}() —— 构建产物与源码不同步，先重新 build。`)
    process.exit(1)
  }
}

/** 用例文件 / 生成器 / 期望产物。任何一个缺失都让整个 fixture 启动失败。 */
const FRAGMENTS = [
  { file: 'frag-table-01-vue2.json', out: 'table-01.vue', gen: 'generateTableBlock', fence: undefined },
  { file: 'frag-table-02-vue2.json', out: 'table-02.vue', gen: 'generateTableBlock', fence: undefined },
  { file: 'frag-form-01-vue2.json', out: 'form-01.vue', gen: 'generateFormBlock', fence: undefined },
  { file: 'frag-form-02-vue2.json', out: 'form-02.vue', gen: 'generateFormBlock', fence: undefined },
  { file: 'frag-dialog-02-component-vue2.json', out: 'dialog-component.vue', gen: 'generateDialogBlock', fence: 'vue' },
  { file: 'frag-dialog-01-vue2.json', out: 'dialog-composable.tsx', gen: 'generateDialogBlock', fence: 'tsx' },
]

mkdirSync(OUT_DIR, { recursive: true })

const problems = []
for (const { file, out, gen, fence } of FRAGMENTS) {
  const casePath = join(CASES_DIR, file)
  if (!existsSync(casePath)) {
    problems.push(`缺少语料 ${casePath}`)
    continue
  }
  const { config } = JSON.parse(readFileSync(casePath, 'utf-8'))
  if (!config || typeof config !== 'object') {
    problems.push(`${file} 没有 config 对象`)
    continue
  }
  const result = shared[gen]({ ...config, target: 'vue2' })
  if (!result || typeof result.code !== 'string' || result.code.trim() === '') {
    problems.push(`${file} → ${out}：生成器返回空 code`)
    continue
  }
  if (fence !== undefined && result.fence !== fence) {
    problems.push(`${file} → ${out}：围栏应为 ${fence}，实际 ${String(result.fence)}`)
    continue
  }
  writeFileSync(join(OUT_DIR, out), result.code)
  console.log(`[gen-fragments] ✓ ${file} → ${out} (${result.code.split('\n').length} 行)`)
}

if (problems.length) {
  console.error(`[gen-fragments] ${problems.length} 项失败：\n  - ${problems.join('\n  - ')}`)
  process.exit(1)
}
console.log(`[gen-fragments] 6/6 片段已写入 ${OUT_DIR}`)

// ── AN-17：三组件组合的 **no-table** 形状（form+dialog）────────────────────────
//
// 组合语料（`__tests__/golden/composition/`）里 form+dialog 的产物**不是** CRUD 页面：
// 前门（`generate-crud.ts` 的 no-table 分支）为每个 dialog entry 发一段 composable，
// 弹窗体 = form 面。这里按**同一条装配规则**生成两份产物（add / edit），证明
// 「一份 form 面 + 多个 dialog key」真的能各自成为独立 composable，而不是只发一个。
const COMPOSITION_CASES = join(REPO_ROOT, '__tests__', 'golden', 'composition')
const COMPOSITION_FILE = 'comp-form-dialog-01-vue2.json'
const COMPOSITION_DIALOGS = [
  { key: 'add', title: '新增', out: 'composition-dialog-add.tsx', composableName: 'useCustomerAddDialog' },
  { key: 'edit', title: '编辑', out: 'composition-dialog-edit.tsx', composableName: 'useCustomerEditDialog' },
]

const compPath = join(COMPOSITION_CASES, COMPOSITION_FILE)
if (!existsSync(compPath)) {
  console.error(`[gen-fragments] 缺少组合语料 ${compPath}`)
  process.exit(1)
}
const compCase = JSON.parse(readFileSync(compPath, 'utf-8'))
const compFields = compCase?.surfaces?.form
if (!Array.isArray(compFields) || compFields.length === 0) {
  console.error(`[gen-fragments] ${COMPOSITION_FILE} 没有 surfaces.form —— 组合语料的 form+dialog 形状必须带表单面`)
  process.exit(1)
}

const compProblems = []
for (const d of COMPOSITION_DIALOGS) {
  const result = shared.generateDialogBlock({
    fields: compFields,
    apiUrl: compCase.apiUrl,
    target: 'vue2',
    typescript: true,
    composableName: d.composableName,
    defaultTitle: d.title,
  })
  if (!result || typeof result.code !== 'string' || result.code.trim() === '') {
    compProblems.push(`${d.out}：生成器返回空 code`)
    continue
  }
  if (result.fence !== 'tsx') {
    compProblems.push(`${d.out}：围栏应为 tsx，实际 ${String(result.fence)}`)
    continue
  }
  writeFileSync(join(OUT_DIR, d.out), result.code)
  console.log(`[gen-fragments] ✓ ${COMPOSITION_FILE} → ${d.out} (${result.code.split('\n').length} 行)`)
}
if (compProblems.length) {
  console.error(`[gen-fragments] 组合片段 ${compProblems.length} 项失败：\n  - ${compProblems.join('\n  - ')}`)
  process.exit(1)
}
console.log(`[gen-fragments] 组合 form+dialog：${COMPOSITION_DIALOGS.length}/${COMPOSITION_DIALOGS.length} 已写入 ${OUT_DIR}`)
