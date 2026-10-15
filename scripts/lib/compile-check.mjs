/**
 * 「产物能不能被解析」这把尺子（共享单源）。
 *
 * 从 `scripts/compile-smoke.mjs` 抽出，理由与 `scripts/lib/text-sync.mjs` 相同：
 * 同一把尺子现在有**两个**消费者，各写一份必然漂移，而漂移的尺度会让
 * 「A 绿 B 红」变成无意义的信号。
 *   1. `compile-smoke.mjs` —— 合成字段矩阵（宽扫：3 端 × ts/js × 各分支）；
 *   2. `check-scene-coverage.mjs` —— 场景语料（点扫：每条片段用例真跑一遍）。
 *
 * 尺子的定义：**只解析语法，不解析依赖**（模板编译与依赖解析是 e2e 的职责）。
 * 与 `score-golden.mjs` / `codegen-escape.ts` 的 `assertEmittableExpr` 用同一个解析器
 * （esbuild 的 TS/JSX loader），故「发射前校验」与「发射后校验」零漂移。
 *
 * 为什么用 esbuild 而不是 TS 编译器：它同时吃 TS **与** JSX（列 render 可能是
 * `(row) => <Tag/>`），且只解析、不执行、不改写内容。
 */
import { transformSync } from 'esbuild'

/** 按 `<script lang="...">` 声明挑 loader；未知/缺省回落到 js。 */
export function loaderForLang(lang) {
  const l = String(lang || '').toLowerCase()
  return l === 'tsx' ? 'tsx' : l === 'jsx' ? 'jsx' : l === 'ts' ? 'ts' : 'js'
}

/**
 * 解析一段源码；失败则把 `label — 首两行错误` 塞进 `failures`（不抛）。
 * @param {string} src
 * @param {string} loader esbuild loader（'ts' | 'tsx' | 'js' | 'jsx'）
 * @param {string} label 报错前缀，通常形如 `table × vue2 — <用例名>`
 * @param {string[]} failures 收集器（调用方负责最终判红）
 */
export function parseSource(src, loader, label, failures) {
  try {
    transformSync(src, { loader })
  } catch (err) {
    failures.push(`${label} — ${String(err.message).split('\n').slice(0, 2).join(' ')}`)
  }
}

/**
 * 一个 SFC 产物：抽出所有 `<script>` 块，按各自声明的 lang 逐块解析。
 * 一个 `<script>` 都没有视为失败（不是「无需解析」）。
 */
export function parseSfc(sfc, label, failures) {
  const blocks = [...sfc.matchAll(/<script\b([^>]*)>([\s\S]*?)<\/script>/gi)]
  if (blocks.length === 0) {
    failures.push(`${label} — 产物里没有 <script> 块`)
    return
  }
  for (const [, attrs, body] of blocks) {
    const lang = (attrs.match(/lang\s*=\s*["']?([a-z]+)/i) || [])[1]
    parseSource(body, loaderForLang(lang), label, failures)
  }
}

/**
 * dialog 产物是 composable 模块（非 SFC），整体按 tsx/jsx 解析。
 * @param {string} code
 * @param {boolean} typescript 决定 tsx 还是 jsx
 */
export function parseComposable(code, typescript, label, failures) {
  parseSource(code, typescript ? 'tsx' : 'jsx', label, failures)
}
