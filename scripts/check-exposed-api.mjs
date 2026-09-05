#!/usr/bin/env node
/**
 * 三端组件「暴露 API（expose）」一致性锁
 *
 * 背景：EsTable / EsForm / EsDialog 在 vue3 / vue2 / adapter-antdv 三端各自维护一份
 * 对外暴露方法集（`$refs.<comp>.xxx()` 的可用面）。历史上出现过「vue2 缺 8 个 vxe
 * 行内编辑方法」「vue3 未暴露 toggleRowSelection」「EsDialog 三端命名 close/closed 分叉」
 * 等问题——它们能通过各端 typecheck/单测，却让「同一 API 三端通用」的承诺出现空洞。
 *
 * 本脚本对三端 9 个组件源码做静态分析：
 *   1. 定位各端的 expose 块（defineExpose / instance.exposed / ctx.expose / const exposed）
 *   2. 深度感知地抽取顶层键集（跳过方法体内的嵌套对象键、类型注解、字符串、注释）
 *   3. 断言：
 *      a. 每个组件三端键集完全一致（无某端独有/缺失）
 *      b. 键集与本文件内的权威快照 EXPECTED 完全一致
 *         —— 三端同时增删某方法时，必须同步更新此快照，避免「静默集体漂移」
 *
 * 用法：
 *   node scripts/check-exposed-api.mjs        # 校验（CI 用）
 *
 * 退出码：0 = 一致；1 = 检测到分叉或与快照不符。
 */
import { readFileSync } from 'node:fs'
import { fileURLToPath } from 'node:url'
import { dirname, join } from 'node:path'

const __dirname = dirname(fileURLToPath(import.meta.url))
const ROOT = join(__dirname, '..')

/**
 * 各组件三端源码 + 其 expose 块锚点正则。
 * 锚点指向 expose 对象字面量的 `{` 之前的片段，脚本从匹配处向后找到首个 `{` 开始抽取。
 */
const COMPONENTS = {
  EsTable: [
    ['vue3', 'packages/vue3/src/components/es-table/src/component.vue', /defineExpose\(\s*\{/],
    ['antdv', 'packages/adapter-antdv/src/components/es-table/src/component.vue', /defineExpose\(\s*\{/],
    ['vue2', 'packages/vue2/src/components/es-table/component.vue', /const\s+exposed\s*=\s*\{/],
  ],
  EsForm: [
    ['vue3', 'packages/vue3/src/components/es-form/src/es-form.vue', /defineExpose\(\s*\{/],
    ['antdv', 'packages/adapter-antdv/src/components/es-form/src/es-form.vue', /defineExpose\(\s*\{/],
    ['vue2', 'packages/vue2/src/components/es-form/es-form.vue', /\.expose\(\s*\{/],
  ],
  EsDialog: [
    ['vue3', 'packages/vue3/src/components/es-dialog/src/component.vue', /instance\.exposed\s*=\s*\{/],
    ['antdv', 'packages/adapter-antdv/src/components/es-dialog/src/component.vue', /defineExpose\(\s*\{/],
    ['vue2', 'packages/vue2/src/components/es-dialog/component.vue', /const\s+exposed\s*=\s*\{/],
  ],
}

/**
 * 权威快照：三端约定必须对外暴露的键集（顺序无关）。
 * 三端同时新增/删除某方法时，请同步更新此处——这是有意为之的「刹车」。
 */
const EXPECTED = {
  EsTable: [
    'httpRequestInstance', 'requestError', 'getSelectionRows', 'clearSelection',
    'clearAllSelection', 'toggleRowSelection', 'refresh', 'reload', 'doLayout',
    'scrollToRow', 'getUpdateRecords', 'getInsertRecords', 'getRemoveRecords',
    'revertData', 'clearActived', 'clearValidate', 'validate', 'vxeInstance',
  ],
  EsForm: [
    'formItmeRequestInstance', 'getFormRef', 'validate', 'resetFields',
    'clearValidate', 'validateField', 'scrollToField',
  ],
  EsDialog: ['close', 'closed', 'toggleFullscreen', 'doClose'],
}

/**
 * 从 src[openBraceIndex]（必须是 `{`）开始，深度感知地抽取该对象字面量的顶层键。
 * 跳过：字符串 / 模板串 / 行注释 / 块注释；只在「curly===1 且 paren===0 且 square===0」
 * 的属性起始位（紧跟 `{` 或顶层 `,` 之后）记录标识符，故方法体内的嵌套对象键、
 * 参数类型注解里的逗号等都不会被误收。
 */
function extractObjectKeys(src, openBraceIndex) {
  const n = src.length
  let i = openBraceIndex
  let curly = 0
  let paren = 0
  let square = 0
  let expectKey = false
  const keys = []

  while (i < n) {
    const c = src[i]
    const c2 = src[i + 1]

    // 注释
    if (c === '/' && c2 === '/') {
      while (i < n && src[i] !== '\n') i++
      continue
    }
    if (c === '/' && c2 === '*') {
      i += 2
      while (i < n && !(src[i] === '*' && src[i + 1] === '/')) i++
      i += 2
      continue
    }
    // 字符串 / 模板串（naive：跳到未转义的同类引号）
    if (c === '"' || c === "'" || c === '`') {
      const q = c
      i++
      while (i < n) {
        if (src[i] === '\\') { i += 2; continue }
        if (src[i] === q) { i++; break }
        i++
      }
      continue
    }

    if (c === '{') { curly++; if (curly === 1) expectKey = true; i++; continue }
    if (c === '}') { curly--; if (curly === 0) break; i++; continue }
    if (c === '(') { paren++; i++; continue }
    if (c === ')') { paren--; i++; continue }
    if (c === '[') { square++; i++; continue }
    if (c === ']') { square--; i++; continue }

    const atTop = curly === 1 && paren === 0 && square === 0
    if (c === ',' && atTop) { expectKey = true; i++; continue }

    if (/\s/.test(c)) { i++; continue }

    if (expectKey && atTop) {
      const m = /^[A-Za-z_$][\w$]*/.exec(src.slice(i))
      if (m) {
        keys.push(m[0])
        i += m[0].length
        expectKey = false
        continue
      }
    }
    expectKey = false
    i++
  }
  return keys
}

function exposedKeysFor(path, anchor) {
  const src = readFileSync(join(ROOT, path), 'utf-8')
  const m = anchor.exec(src)
  if (!m) throw new Error(`未能在 ${path} 中定位 expose 块（锚点 ${anchor}）——请检查脚本锚点`)
  const braceIndex = src.indexOf('{', m.index)
  return extractObjectKeys(src, braceIndex)
}

function diff(a, b) {
  const sa = new Set(a)
  const sb = new Set(b)
  return {
    onlyA: [...sa].filter((k) => !sb.has(k)),
    onlyB: [...sb].filter((k) => !sa.has(k)),
  }
}

function main() {
  let fail = false

  for (const [comp, renderers] of Object.entries(COMPONENTS)) {
    const sets = {}
    for (const [name, path, anchor] of renderers) {
      try {
        sets[name] = extractUnique(exposedKeysFor(path, anchor))
      } catch (e) {
        fail = true
        console.error(`❌ ${comp}/${name}: ${e.message}`)
      }
    }

    // a. 三端两两一致
    const names = Object.keys(sets)
    for (let x = 0; x < names.length; x++) {
      for (let y = x + 1; y < names.length; y++) {
        const { onlyA, onlyB } = diff(sets[names[x]], sets[names[y]])
        if (onlyA.length || onlyB.length) {
          fail = true
          console.error(
            `❌ ${comp}: ${names[x]} 与 ${names[y]} 暴露 API 不一致：` +
              `${names[x]}独有 [${onlyA.join(', ')}] / ${names[y]}独有 [${onlyB.join(', ')}]`,
          )
        }
      }
    }

    // b. 与权威快照一致
    const expected = EXPECTED[comp] || []
    for (const name of names) {
      const { onlyA: missing, onlyB: extra } = diff(expected, sets[name])
      if (missing.length || extra.length) {
        fail = true
        console.error(`❌ ${comp}/${name} 与权威快照 EXPECTED 不符：`)
        if (missing.length) console.error(`   缺失（快照有而该端无）：${missing.join(', ')}`)
        if (extra.length) console.error(`   多余（该端有而快照无）：${extra.join(', ')}`)
      }
    }

    if (!fail) console.log(`✅ ${comp} 三端暴露 API 一致（${expected.length} 项）`)
  }

  if (fail) {
    console.error(
      '\n三端暴露 API 存在分叉或与权威快照不符。' +
        '若为有意的三端同步增删，请更新本脚本 EXPECTED 快照；' +
        '否则请补齐缺失端，保证「同一 API 三端通用」。',
    )
    process.exit(1)
  }

  console.log('三端组件暴露 API 一致性 ✅')
}

/** 去重并保序（同名键仅记一次，例如 shorthand 与注解写法混用时） */
function extractUnique(keys) {
  return [...new Set(keys)]
}

main()
