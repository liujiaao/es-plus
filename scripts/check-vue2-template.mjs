#!/usr/bin/env node
/**
 * Vue 2 站点模板编译守卫（es-eui）。
 *
 * 为什么需要它：`vue-cli-service build` **不会**因为模板错误失败。模板里写坏了
 * （最典型的是在 `<pre>` 代码示例里写未转义的 `<es-table>` —— `v-pre` 只跳过指令
 * 与插值，**不**阻止 HTML 解析器把它当成真元素），vue-loader 会照常产出组件，
 * 只是 render 变成空函数、整页静默白屏，控制台一个字都不报。2026-10-29 的
 * 快速开始页就是这么坏了两个路由（/guide/quickstart、/component/quickstart），
 * 构建全绿、浏览器零报错，靠肉眼才发现。
 *
 * 判据：用 es-eui 自己的 vue-template-compiler 编译 `es-eui/src/**\/*.vue` 的
 * `<template>` 块，**任何 error 都算红**。Vue 3 站点（es-pc / es-plus-docs）不走
 * 这里：它们的 v-pre 分支按纯文本吞子树，根因不成立，且编译器语法不同 —— 混进来
 * 只会得到一堆假阳性。
 *
 * 用法：
 *   node scripts/check-vue2-template.mjs
 */
import { readFileSync, readdirSync } from 'node:fs'
import { fileURLToPath } from 'node:url'
import { createRequire } from 'node:module'
import { dirname, join, relative } from 'node:path'

const ROOT = join(dirname(fileURLToPath(import.meta.url)), '..')
const SITE = 'es-eui'
const require = createRequire(join(ROOT, SITE, 'package.json'))
const compilerUtils = require('@vue/component-compiler-utils')
const compiler = require('vue-template-compiler')

function walk(dir, out = []) {
  for (const entry of readdirSync(dir, { withFileTypes: true })) {
    if (entry.name === 'node_modules' || entry.name === 'dist' || entry.name.startsWith('.')) continue
    const p = join(dir, entry.name)
    if (entry.isDirectory()) walk(p, out)
    else if (entry.name.endsWith('.vue')) out.push(p)
  }
  return out
}

const files = walk(join(ROOT, SITE, 'src'))
const problems = []

for (const file of files) {
  const source = readFileSync(file, 'utf8')
  let descriptor
  try {
    descriptor = compilerUtils.parse({ source, compiler, filename: file, needMap: false })
  } catch (e) {
    problems.push({ file, line: 0, msg: `SFC 解析失败：${e.message}` })
    continue
  }
  if (!descriptor.template) continue
  const result = compiler.compile(descriptor.template.content, { outputSourceRange: true })
  for (const err of result.errors || []) {
    const msg = err.msg || String(err)
    const line =
      typeof err.start === 'number'
        ? descriptor.template.content.slice(0, err.start).split('\n').length
        : 0
    problems.push({ file, line, msg })
  }
}

if (problems.length) {
  console.error(`✖ ${SITE} 有 ${problems.length} 处模板编译错误（构建不会报，页面会静默白屏）：`)
  for (const p of problems) {
    console.error(`  ${relative(ROOT, p.file)}${p.line ? ':' + p.line : ''}  ${p.msg}`)
  }
  console.error('\n提示：代码示例里的标签要转义（&lt;es-table&gt;），`v-pre` 不会保护它。')
  process.exit(1)
}

console.log(`✔ ${SITE} 模板编译通过（${files.length} 个 .vue）`)
