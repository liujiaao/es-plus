/**
 * 「从 TS 源码直接装载生成器」的**单源实现**。
 *
 * 两处守卫需要在**不依赖 dist** 的前提下调用真生成器：
 *   - `check-generator-escaping.mjs`（反向探针：载荷必须被转义）
 *   - `check-generator-fuzz.mjs`（属性式探针：任何通过校验的配置都必须产出可编译的产物）
 *
 * 两边各写一份 esbuild 打包逻辑迟早漂移（banner、入口、plugin 三处都是隐性契约），
 * 而漂移的表现是「一条腿通过、另一条腿其实跑的是旧产物」——本仓反复栽过的双真源坑。
 * 故抽到这里。**不要在本文件之外再写第二份**。
 *
 * 为什么必须从源码打包而不是 `import '@es-plus/shared'`：包入口指向 `dist/`，而
 * `check:consistency` 在干净克隆上跑（不先 `build:libs`）。守卫一旦依赖构建产物，
 * 「没构建」就会被读成「守卫失败」或更糟——被读成「通过」。
 */
import { mkdtempSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join, dirname } from 'node:path'
import { fileURLToPath, pathToFileURL } from 'node:url'
import { build } from 'esbuild'

const __dirname = dirname(fileURLToPath(import.meta.url))
export const ROOT = join(__dirname, '..', '..')
export const SHARED_SRC = join(ROOT, 'packages/shared/src')
export const ESCAPE_MODULE = join(SHARED_SRC, 'codegen-escape.ts')

/**
 * 打包 `structured-generator.ts` 并 import 回来。
 *
 * @param {false | ((source: string|null, path: string) => string | null)} cripple
 *   传函数时，该函数返回的字符串会**替换** `codegen-escape.ts` 的内容
 *   （用于非空证明：把转义器打成恒等）。
 * @returns {Promise<{generateFromConfig: Function}>}
 */
export async function loadGenerator(cripple = false) {
  const tmp = mkdtempSync(join(tmpdir(), 'es-esc-'))
  const outfile = join(tmp, 'gen.mjs')
  const plugin = {
    name: 'cripple-escaper',
    setup(b) {
      if (!cripple) return
      b.onLoad({ filter: /codegen-escape\.ts$/ }, (args) => {
        const src = cripple(null, args.path)
        return src == null ? null : { contents: src, loader: 'ts' }
      })
    },
  }
  await build({
    entryPoints: [join(SHARED_SRC, 'structured-generator.ts')],
    bundle: true,
    format: 'esm',
    outfile,
    platform: 'node',
    logLevel: 'silent',
    plugins: plugin ? [plugin] : [],
    // 同 check-generator-targets：shared/src 传递性引入 CJS 的 esbuild，其 require('fs')
    // 被改写成 __require shim，而 shim 在 ESM 下没有 ambient require 可用 → 抛
    // 「Dynamic require of "fs" is not supported」。造一个真 require 让它走首选分支。
    banner: {
      js: "import { createRequire as __createRequire } from 'node:module';const require = __createRequire(import.meta.url);",
    },
  })
  return import(pathToFileURL(outfile).href)
}

/**
 * 把 `codegen-escape.ts` 的转义器整体替换成恒等实现（只用于非空证明）。
 * 保留 `BARE_IDENTIFIER` 与 `qMember` 的类型形状，否则生成器自身会先崩掉、掩盖真问题。
 *
 * `assertEmittableExpr` **刻意保留真实现**：它不是转义器，而是「发射前语法闸」。
 * 若连它一起恒等（恒返回 true），非空证明后的「守卫变红」就可能只源于它放行了垃圾串，
 * 而转义器该有的约束力一点没被证明 —— 证明会变得空洞。故这里原样复刻真实现
 * （见 codegen-escape.ts），只换转义器。
 */
export function crippleEscaperSource(path) {
  return `// ⚠️ 由守卫的非空证明临时注入：全部转义器 = 恒等函数
import { transformSync } from 'esbuild'
export const BARE_IDENTIFIER = /^[A-Za-z_$][\\w$]*$/
const id = (v) => String(v)
export function q(value) { return "'" + id(value) + "'" }
export function qBt(value) { return "\`" + id(value) + "\`" }
export function qAttr(value) { return '"' + id(value) + '"' }
// 双引号属性里的表达式只实体化双引号字符（其余保持原样给 Volar/TS 解析，见真实现头注）；
// 恒等化即「不挡双引号」—— 非空证明要证明的正是这一类失效。
export function qExprAttr(value) { return id(value) }
// 插槽名可表达性判定 = emission 安全层的一部分：恒等化为「永远可表达」，让引号/空白 prop
// 重新走进静态插槽名 —— 非空证明要证明的正是这一层不在了守卫就会红。
export function isStaticSlotNameSafe() { return true }
export function qKey(prop) { return BARE_IDENTIFIER.test(prop) ? prop : "'" + prop + "'" }
export function qMember(prop) { return BARE_IDENTIFIER.test(prop) ? "." + prop : "['" + prop + "']" }
export function qMustache(value) { return "'" + id(value) + "'" }
export function numOrStr(v) { return typeof v === 'number' ? String(v) : "'" + v + "'" }
export function sanitizeForComment(src) { return String(src) }
export function inlineJson(value, space) { return JSON.stringify(value, null, space) }
export function findNonJsonValues(value, path = '') {
  // 与 assertEmittableExpr 同理：它**不是**转义器，而是「无法 JSON 化的成员」探测器，
  // 必须保留真实现 —— 换掉它会让 btns/expandConfig/editRender 的告警路径在非空证明里失真。
  const at = (key) => /^[A-Za-z_$][\\w$]*$/.test(key) ? (path ? path + '.' + key : key) : path + '[' + JSON.stringify(key) + ']'
  if (typeof value === 'function' || typeof value === 'symbol' || typeof value === 'bigint') return [path || '(root)']
  if (value === null || typeof value !== 'object') return []
  if (Array.isArray(value)) {
    const out = []
    value.forEach((v, i) => {
      if (!(i in value) || v === undefined) out.push(path + '[' + i + ']')
      else out.push(...findNonJsonValues(v, path + '[' + i + ']'))
    })
    return out
  }
  const out = []
  for (const [k, v] of Object.entries(value)) {
    if (v === undefined) continue
    out.push(...findNonJsonValues(v, at(k)))
  }
  return out
}
export function assertEmittableExpr(src) {
  for (const loader of ['tsx', 'ts']) {
    try {
      transformSync('const __esplus_probe = (' + src + ');', { loader: loader })
      return true
    } catch (e) {
      // 换下一个 loader 再试
    }
  }
  return false
}
`
}

export { ESCAPE_MODULE as _ESCAPE_MODULE }
