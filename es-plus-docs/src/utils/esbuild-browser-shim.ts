/**
 * 浏览器侧的 `esbuild` 替身（仅 es-plus-docs 使用，见 vite.config.ts 的别名）。
 *
 * 起因：`packages/shared/src/codegen-escape.ts` 在模块顶层
 * `import { transformSync } from 'esbuild'`，用它给 formatter / render 两个扩展点做
 * 「发射前语法闸」（assertEmittableExpr）。esbuild 是 Node 原生包，其 JS 入口会引用
 * `process` —— 被文档站打进浏览器包后，首页路由一加载就抛
 * `ReferenceError: process is not defined`（router 的懒加载 chunk 失败）。
 *
 * 文档站里 @es-plus/shared 是源码直连（shared-browser.ts facade），无法只摘掉
 * codegen-escape 这一个模块，所以在 Vite 别名层把裸依赖 `esbuild` 换成本文件：
 *
 *   - Node 侧（CLI / MCP / eval / vitest）仍用真 esbuild，闸的语义完全不变；
 *   - 浏览器侧用近似闸：①括号 / 引号 / 模板串 / 注释必须配平（能毙掉注释里点名的
 *     「未闭合模板、括号不配平」这类垃圾）；②纯 JS 表达式用 `new Function` 只解析不执行；
 *     ③`new Function` 必然失败的 TS/JSX 表达式，在配平通过且具备 TS/JSX 形态时放行。
 *     浏览器里没有 TS/JSX 解析器，这里只能近似 —— 严格闸仍在 Node 侧。
 *
 * 返回值形状对齐 esbuild.transformSync 的最小子集：调用方只关心「抛异常 = 不合法」。
 */

export interface TransformSyncShimResult {
  code: string
  map: string
  warnings: never[]
}

/**
 * 与 esbuild.transformSync 同名同形。`source` 是调用方包好的整段语句
 * （`const __esplus_probe = (<expr>);`），不是单独的表达式。
 */
export function transformSync(
  source: string,
  _options?: { loader?: 'ts' | 'tsx' | 'js' | 'jsx' },
): TransformSyncShimResult {
  if (!isBalanced(source)) {
    throw new SyntaxError('[es-plus] browser parse gate: unbalanced brackets/strings/comments')
  }

  const expr = unwrapProbe(source)
  if (!isPlausibleExpression(expr)) {
    throw new SyntaxError('[es-plus] browser parse gate: not a parseable expression')
  }

  return { code: source, map: '', warnings: [] }
}

/** 取出 `const __esplus_probe = (<expr>);` 里的 `<expr>`；形状不符时原样返回。 */
function unwrapProbe(source: string): string {
  const m = /^const __esplus_probe = \(([\s\S]*)\);\s*$/.exec(source)
  return m ? m[1] : source
}

function isPlausibleExpression(expr: string): boolean {
  const src = expr.trim()
  if (src === '') return false

  // 纯 JS 表达式：让引擎做真正的语法解析（new Function 只解析函数体，不执行）。
  try {
    // eslint-disable-next-line no-new-func
    new Function(`const __esplus_probe = (${src});`)
    return true
  } catch (err) {
    // 非 SyntaxError 说明解析器本身不可用（例如 CSP 禁 eval）：已过配平，别误杀。
    if (!(err instanceof SyntaxError)) return true
  }

  // new Function 解析不了 TS 注解 / JSX —— 只在源码确实带有这类形态时放行。
  return LOOKS_LIKE_TS_OR_JSX.test(src) && !END_WITH_DANGLING_OPERATOR.test(src)
}

/** `(row: Row) => …`、`x as string`、`<Tag/>`、`<T>(x) => …` 等 TS/JSX 形态。 */
const LOOKS_LIKE_TS_OR_JSX =
  /(?::\s*[A-Za-z_$<{[])|(?:\bas\s+[A-Za-z_$])|(?:<\s*\/?\s*[A-Za-z][\w.$-]*(?:\s|\/?>))|(?:=>\s*<)/

/** 以悬空运算符收尾（`1 +`、`foo.`）在两种 loader 下都不是合法表达式。`>` 除外：JSX 闭合标签。 */
const END_WITH_DANGLING_OPERATOR = /[+\-*/%=&|^!?:,.]\s*$/

/**
 * 配平扫描：字符串（含转义）、模板串（含 `${…}` 嵌套）、行/块注释、三种括号。
 * 只判断「结构是否闭合」，不判断语义。
 */
function isBalanced(src: string): boolean {
  /** '(' | '[' | '{' | '`' | '${' */
  const stack: string[] = []
  let mode: 'code' | 'sq' | 'dq' | 'tpl' | 'line' | 'block' = 'code'
  let i = 0

  while (i < src.length) {
    const c = src[i]

    if (mode === 'line') {
      if (c === '\n') mode = 'code'
      i += 1
      continue
    }

    if (mode === 'block') {
      if (c === '*' && src[i + 1] === '/') {
        mode = 'code'
        i += 2
      } else {
        i += 1
      }
      continue
    }

    if (mode === 'sq' || mode === 'dq') {
      if (c === '\\') {
        i += 2
        continue
      }
      if (c === (mode === 'sq' ? "'" : '"')) {
        mode = 'code'
      } else if (c === '\n') {
        return false // 普通字符串不能跨行（未闭合）
      }
      i += 1
      continue
    }

    if (mode === 'tpl') {
      if (c === '\\') {
        i += 2
        continue
      }
      if (c === '`') {
        if (stack[stack.length - 1] !== '`') return false
        stack.pop()
        mode = 'code'
        i += 1
        continue
      }
      if (c === '$' && src[i + 1] === '{') {
        stack.push('${')
        mode = 'code'
        i += 2
        continue
      }
      i += 1
      continue
    }

    // mode === 'code'
    if (c === '/' && src[i + 1] === '/') {
      mode = 'line'
      i += 2
      continue
    }
    if (c === '/' && src[i + 1] === '*') {
      mode = 'block'
      i += 2
      continue
    }
    if (c === "'") {
      mode = 'sq'
      i += 1
      continue
    }
    if (c === '"') {
      mode = 'dq'
      i += 1
      continue
    }
    if (c === '`') {
      stack.push('`')
      mode = 'tpl'
      i += 1
      continue
    }
    if (c === '(' || c === '[' || c === '{') {
      stack.push(c)
      i += 1
      continue
    }
    if (c === ')' || c === ']' || c === '}') {
      const top = stack[stack.length - 1]
      if (c === '}' && top === '${') {
        stack.pop()
        mode = 'tpl'
        i += 1
        continue
      }
      const expected = c === ')' ? '(' : c === ']' ? '[' : '{'
      if (top !== expected) return false
      stack.pop()
      i += 1
      continue
    }
    i += 1
  }

  return (mode === 'code' || mode === 'line' || mode === 'block') && stack.length === 0
}
