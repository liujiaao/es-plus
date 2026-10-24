#!/usr/bin/env node
/**
 * 声明式联动示例守卫（F2「零回调联动」）。
 *
 * 示例本身只是 20 行宿主代码，卖点全在**配置是纯数据**：能被存库、被服务端下发、
 * 被 AI 生成。这种性质靠人眼 review 守不住 —— 任何人往 config 里塞一个
 * `(model) => …`，页面照样能跑，只有「换引擎 / 存 JSON」时才炸。
 *
 * 本脚本断言四件事：
 *   1. 三份 `declarative-linkage.config.js` **字节相同**（三站是三个独立工程，
 *      没有共享运行时，靠这条守卫防止副本漂移）；
 *   2. 每份配置 `JSON.parse(JSON.stringify(x))` 与原对象**深等** ——
 *      函数被丢弃、undefined 被丢弃、NaN 变 null，任一都会让深等失败；
 *   3. 配置里的每个表达式节点只用 `EXPR_OPS` 白名单算子（算子清单从
 *      `packages/core/src/expr.ts` 现场解析，不手抄，避免与运行时漂移）；
 *   4. 三站宿主页都真的 import 了这份配置（防止配置变成没人用的死数据）。
 *
 * 用法：node scripts/check-declarative-demo.mjs
 * 退出码：0 = 通过；1 = 违反任一断言。
 */
import { readFileSync } from 'node:fs'
import { fileURLToPath } from 'node:url'
import { dirname, join } from 'node:path'
import assert from 'node:assert/strict'

const ROOT = join(dirname(fileURLToPath(import.meta.url)), '..')

const COPIES = [
  {
    site: 'docs (Vue3 + Element Plus)',
    config: 'es-plus-docs/src/components/examples/form/declarative-linkage.config.js',
    demo: 'es-plus-docs/src/components/examples/form/DeclarativeLinkage.vue',
  },
  {
    site: 'es-pc (Vue3 + Ant Design Vue)',
    config: 'es-pc/src/views/es-form/declarative-linkage.config.js',
    demo: 'es-pc/src/views/es-form/DeclarativeLinkage.vue',
  },
  {
    site: 'es-eui (Vue2 + Element UI)',
    config: 'es-eui/src/examples/form/declarative-linkage.config.js',
    demo: 'es-eui/src/examples/form/DeclarativeLinkage.vue',
  },
]

const read = (rel) => readFileSync(join(ROOT, rel), 'utf8')
// 行尾归一后再比：仓库开了 core.autocrlf，不同检出上同一文件可能是 CRLF；
// 三份副本同规则检出，因此归一后仍应逐字相同。
const toLf = (s) => s.replace(/\r\n/g, '\n')

let failed = 0
async function check(label, fn) {
  try {
    await fn()
    console.log(`  ✅ ${label}`)
  } catch (err) {
    failed++
    console.error(`  ❌ ${label}\n     ${err.message.split('\n')[0]}`)
  }
}

/** 从 core 源码现场解析算子白名单（单一权威源，不手抄）。 */
function readExprOps() {
  const src = read('packages/core/src/expr.ts')
  const m = src.match(/export const EXPR_OPS = Object\.freeze\(\[([\s\S]*?)\] as const\)/)
  assert.ok(m, 'packages/core/src/expr.ts 里找不到 EXPR_OPS 定义（结构变了？请同步本守卫）')
  const ops = [...m[1].matchAll(/'([^']+)'/g)].map((x) => x[1])
  assert.ok(ops.length > 0, 'EXPR_OPS 解析结果为空')
  return new Set(ops)
}

/** 深度遍历表达式节点：单键对象视为算子节点，必须命中白名单。 */
function assertExprOps(node, ops, path) {
  if (Array.isArray(node)) {
    node.forEach((n, i) => assertExprOps(n, ops, `${path}[${i}]`))
    return
  }
  if (!node || typeof node !== 'object') return
  const keys = Object.keys(node)
  if (keys.length === 1) {
    const op = keys[0]
    assert.ok(ops.has(op), `${path} 使用了白名单外的表达式算子 "${op}"`)
    assertExprOps(node[op], ops, `${path}.${op}`)
    return
  }
  throw new Error(`${path} 是表达式节点但含 ${keys.length} 个键（${keys.join(', ')}）；表达式节点必须恰好一个算子键`)
}

const ops = readExprOps()
const loaded = []

console.log('[check:declarative-demo] 声明式联动示例')

for (const copy of COPIES) {
  await check(`${copy.site} 配置为纯 JSON`, async () => {
    const text = toLf(read(copy.config))
    // 用 data: URL 载入：配置是 ESM 的 .js，但三站各自的 package 类型不同，
    // data: 导入与磁盘上的 package.json 无关，能稳定拿到导出对象。
    const url = 'data:text/javascript;base64,' + Buffer.from(text, 'utf8').toString('base64')
    const mod = await import(url)
    const model = mod.declarativeLinkageModel
    const items = mod.declarativeLinkageItems
    assert.ok(model && typeof model === 'object' && !Array.isArray(model), '缺少导出 declarativeLinkageModel')
    assert.ok(Array.isArray(items) && items.length > 0, '缺少导出 declarativeLinkageItems（或为空数组）')

    // —— 断言 2：JSON 往返深等（函数 / undefined / NaN 都会失败） ——
    assert.deepStrictEqual(JSON.parse(JSON.stringify(model)), model, 'declarativeLinkageModel 不是纯 JSON')
    assert.deepStrictEqual(JSON.parse(JSON.stringify(items)), items, 'declarativeLinkageItems 不是纯 JSON')

    // —— 结构自洽：每个字段都在初始 model 里，value 写回必须声明 dependencies ——
    for (const item of items) {
      assert.equal(typeof item.prop, 'string', '存在没有 prop 的字段')
      assert.ok(item.prop in model, `字段「${item.prop}」不在 declarativeLinkageModel 里（初始值缺失）`)
      for (const rule of item.reactions || []) {
        if (!rule.fulfill || !('value' in rule.fulfill)) continue
        assert.ok(
          Array.isArray(rule.dependencies) && rule.dependencies.length > 0,
          `字段「${item.prop}」的 fulfill.value 缺少 dependencies（运行时会被跳过并告警）`
        )
      }
    }

    // —— 断言 3：表达式算子白名单（与 packages/core/src/expr.ts 对齐） ——
    for (const item of items) {
      if (item.isHidden !== undefined && typeof item.isHidden === 'object') {
        assertExprOps(item.isHidden, ops, `${item.prop}.isHidden`)
      }
      for (const [i, rule] of (item.reactions || []).entries()) {
        const base = `${item.prop}.reactions[${i}]`
        if (rule.when !== undefined) assertExprOps(rule.when, ops, `${base}.when`)
        const f = rule.fulfill || {}
        for (const key of ['required', 'disabled', 'value']) {
          if (f[key] !== undefined) assertExprOps(f[key], ops, `${base}.fulfill.${key}`)
        }
      }
    }

    loaded.push({ site: copy.site, text, itemCount: items.length })
  })
}

await check('三站配置字节一致（单源三副本，不得漂移）', () => {
  assert.equal(loaded.length, COPIES.length, '有站点的配置没通过纯 JSON 校验，无法比对')
  const [first, ...rest] = loaded
  for (const other of rest) {
    if (other.text !== first.text) {
      throw new Error(`${other.site} 的配置与 ${first.site} 不一致 —— 三份必须逐字相同`)
    }
  }
})

await check('三站示例都 import 了这份配置（不是死数据）', () => {
  for (const copy of COPIES) {
    const demo = toLf(read(copy.demo))
    assert.match(demo, /from ['"]\.\/declarative-linkage\.config['"]/, `${copy.demo} 没有从 ./declarative-linkage.config 导入`)
  }
})

if (failed > 0) {
  console.error(`\n[check:declarative-demo] 失败 ${failed} 项`)
  process.exit(1)
}

const { itemCount, site } = loaded[0]
const opCount = [...ops].length
console.log(
  `\n[check:declarative-demo] 通过：3 站 × 纯 JSON 配置（${itemCount} 个字段、${opCount} 个白名单算子），宿主页均已接线`
)
