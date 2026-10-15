/**
 * JSON 表达式求值器（AI-16 底座）—— 框架无关、**零依赖**。
 *
 * 为什么手写、为什么不引库：`@es-plus/core` 必须保持零依赖（见 constants.ts 的说明），
 * 它会打进 vue2/vue3/antdv 三个渲染器的产物。因此这里既不能引 CEL/JSONLogic 之类
 * 的 npm 包，也不能用 `new Function`/`eval`。
 *
 * 为什么是 **JSON 数据** 而不是裸 JS / CEL 字符串：表达式要能被 (a) Zod 静态校验、
 * (b) 内联进 schema 模式的 JSON（字符串做不到，会退回 formatter/render 的降级+告警路径）、
 * (c) 三端由 core 单点等价求值。`isHidden` 的既有声明式条件（{field, op, value}）正是
 * 同一思路的先例，本求值器是它的**超集**。
 *
 * 沙箱是**结构性**的，不只是策略性的：
 *   - 算子收敛在冻结的 `EXPR_OPS` 白名单里，由 `switch` 分派；
 *   - 除 `var` 之外没有任何属性访问/函数调用入口；
 *   - 不使用 `new Function`/`eval`。
 *
 * 本模块同时是 `looseEqual` / `isEmptyValue` 的单一权威定义（原先私有于 field-resolver），
 * 供旧条件求值（matchHiddenCondition）与新表达式求值共用，避免两份漂移。
 */

import { getNestedValue } from './shared'

/** model 的最小结构化形态（与 types.ts 的 ModelData 兼容；此处不 import 类型以保持模块轻量）。 */
type ModelLike = Record<string, unknown>

/**
 * 表达式算子白名单（闭集）—— 运行时单一权威源。
 *
 * shared 的 Zod（HiddenExprSchema）与此对齐，由 `check-schema-contract.mjs` 断言逐项相等。
 * 增删算子必须两处同步：
 *   var          取 model 路径值，操作数是字符串路径
 *   == !=        等 / 不等（沿用 looseEqual：严格 + 仅放宽 number↔string）
 *   > >= < <=    序关系（操作数不可比 → 不成立）
 *   in nin       值 ∈ / ∉ 右侧数组（右侧非数组时 in→false、nin→true，对齐旧 in/nIn）
 *   empty notEmpty  空判定（''/null/undefined/[]，对齐旧 empty/notEmpty）
 *   truthy falsy    真值判定（!!v / !v）
 *   and or not   逻辑（空 and→true、空 or→false）
 *   if           三元（[条件, 真值] 或 [条件, 真值, 假值]；假值缺省 null）
 */
export const EXPR_OPS = Object.freeze([
  'var',
  '==',
  '!=',
  '>',
  '>=',
  '<',
  '<=',
  'in',
  'nin',
  'empty',
  'notEmpty',
  'truthy',
  'falsy',
  'and',
  'or',
  'not',
  'if',
] as const)

export type ExprOp = (typeof EXPR_OPS)[number]

/** 表达式结构错误（未知算子 / 错 arity / 畸形节点）。由 `isHiddenExpr` 在**顶层**兜住。 */
export class ExprEvalError extends Error {
  constructor(message: string) {
    super(message)
    this.name = 'ExprEvalError'
  }
}

/**
 * 宽松相等：先严格比较，再**仅**放宽 number ↔ string（`1` ≈ `'1'`）。
 *
 * 为什么需要：声明式条件通常由 AI 生成 / 手写 JSON，而 `value` 的类型可能与
 * model 实际值漂移（dataOptions 里 value 是数字 `1`，条件却写成字符串 `'1'`，
 * 或反之）。此时若用严格相等，字段会**永不隐藏**且**毫无提示**——正是本库
 * 反复强调的「静默不生效」。
 *
 * 为什么只放宽 number ↔ string 而不用裸 `==`：`==` 会把 `'' == 0`、`null == undefined`、
 * `false == 0` 一并判真，语义难以预期；而空值判定有专门的 `empty`/`falsy` 算子，
 * 不该由 `==` 代办。此处的放宽范围是**刻意收窄**的。
 */
export function looseEqual(a: unknown, b: unknown): boolean {
  if (a === b) return true
  if (typeof a === 'number' && typeof b === 'string') return String(a) === b
  if (typeof a === 'string' && typeof b === 'number') return a === String(b)
  return false
}

/** 「空」判定：空串 / null / undefined / 空数组（与表单「未填」的直觉一致）。 */
export function isEmptyValue(v: unknown): boolean {
  return v === '' || v === null || v === undefined || (Array.isArray(v) && v.length === 0)
}

/**
 * 序关系比较：返回 -1 / 0 / 1，不可比时返回 null。
 *
 * 可比规则（刻意收窄，与 looseEqual 的「只放宽 number↔string」同调）：
 *   - 任一侧为 null / undefined → 不可比；
 *   - 同为 number → 数值比较；同为 string → 字典序；
 *   - number 与 string 混合 → 尝试数值化（无法数值化 → 不可比）。
 * 不可比时上层算子一律判**不成立**（fail-safe，不抛）。
 */
function orderCompare(a: unknown, b: unknown): number | null {
  if (a === null || a === undefined || b === null || b === undefined) return null
  if (typeof a === 'number' && typeof b === 'number') return a < b ? -1 : a > b ? 1 : 0
  if (typeof a === 'string' && typeof b === 'string') return a < b ? -1 : a > b ? 1 : 0
  const na = typeof a === 'number' ? a : typeof a === 'string' ? Number(a) : NaN
  const nb = typeof b === 'number' ? b : typeof b === 'string' ? Number(b) : NaN
  if (!Number.isNaN(na) && !Number.isNaN(nb)) return na < nb ? -1 : na > nb ? 1 : 0
  return null
}

/** 未知算子 / 结构错误只告警一次（避免每次渲染刷屏）。 */
const warnedExprFaults = new Set<string>()

function warnExprOnce(key: string, message: string): void {
  if (warnedExprFaults.has(key)) return
  warnedExprFaults.add(key)
  console.warn(message)
}

/**
 * 求值单个表达式节点。
 *
 * - 字面量（string/number/boolean/null）原样返回；
 * - 数组 → 逐元素求值（数组是操作数列表的载体，如 `{"in":[x, [1,2,3]]}` 的右侧）；
 * - 对象 → 必须是**恰好一个**算子键的单键对象，否则抛 `ExprEvalError`。
 *
 * 结构错误一律**抛**（由顶层兜住）；语义不成立返回 false（如右侧非数组的 `in`）。
 */
export function evalExpr(node: unknown, model: ModelLike): unknown {
  if (node === null || typeof node !== 'object') return node
  if (Array.isArray(node)) return node.map((n) => evalExpr(n, model))

  const obj = node as Record<string, unknown>
  const keys = Object.keys(obj)
  if (keys.length !== 1) {
    throw new ExprEvalError(`expression node must have exactly one operator key, got [${keys.join(', ')}]`)
  }
  const op = keys[0]
  if (!(EXPR_OPS as readonly string[]).includes(op)) {
    throw new ExprEvalError(`unknown expression operator "${op}"`)
  }
  return applyOp(op as ExprOp, obj[op], model)
}

function applyOp(op: ExprOp, args: unknown, model: ModelLike): unknown {
  /** 断言 args 是数组，并按需断言其长度（-1 表示不限定长度）。 */
  const operandList = (len: number): unknown[] => {
    if (!Array.isArray(args)) throw new ExprEvalError(`"${op}" expects an array operand`)
    if (len >= 0 && args.length !== len) {
      throw new ExprEvalError(`"${op}" expects ${len} operand(s), got ${args.length}`)
    }
    return args
  }

  switch (op) {
    case 'var': {
      if (typeof args !== 'string' || args === '') throw new ExprEvalError('"var" expects a non-empty string path')
      return getNestedValue(model, args)
    }
    case '==': {
      const [a, b] = operandList(2)
      return looseEqual(evalExpr(a, model), evalExpr(b, model))
    }
    case '!=': {
      const [a, b] = operandList(2)
      return !looseEqual(evalExpr(a, model), evalExpr(b, model))
    }
    case '>':
    case '>=':
    case '<':
    case '<=': {
      const [a, b] = operandList(2)
      const c = orderCompare(evalExpr(a, model), evalExpr(b, model))
      if (c === null) return false
      if (op === '>') return c > 0
      if (op === '>=') return c >= 0
      if (op === '<') return c < 0
      return c <= 0
    }
    case 'in': {
      const [a, b] = operandList(2)
      const arr = evalExpr(b, model)
      const v = evalExpr(a, model)
      return Array.isArray(arr) && arr.some((x) => looseEqual(v, x))
    }
    case 'nin': {
      const [a, b] = operandList(2)
      const arr = evalExpr(b, model)
      const v = evalExpr(a, model)
      // 对齐旧 nIn：右侧非数组 → 视为「不在其中」→ 成立
      return !(Array.isArray(arr) && arr.some((x) => looseEqual(v, x)))
    }
    case 'empty': {
      const [a] = operandList(1)
      return isEmptyValue(evalExpr(a, model))
    }
    case 'notEmpty': {
      const [a] = operandList(1)
      return !isEmptyValue(evalExpr(a, model))
    }
    case 'truthy': {
      const [a] = operandList(1)
      return !!evalExpr(a, model)
    }
    case 'falsy': {
      const [a] = operandList(1)
      return !evalExpr(a, model)
    }
    case 'and': {
      const list = operandList(-1)
      return list.every((n) => !!evalExpr(n, model))
    }
    case 'or': {
      const list = operandList(-1)
      return list.some((n) => !!evalExpr(n, model))
    }
    case 'not': {
      const [a] = operandList(1)
      return !evalExpr(a, model)
    }
    case 'if': {
      if (!Array.isArray(args) || args.length < 2 || args.length > 3) {
        throw new ExprEvalError('"if" expects 2 or 3 operands')
      }
      const [cond, thenExpr, elseExpr] = args as unknown[]
      if (evalExpr(cond, model)) return evalExpr(thenExpr, model)
      return args.length === 3 ? evalExpr(elseExpr, model) : null
    }
    default:
      throw new ExprEvalError(`unhandled expression operator "${String(op)}"`)
  }
}

/**
 * 判定一个值是否为**表达式节点**（用于与旧的 {field, op, value} 条件区分）。
 *
 * 判据：非空（非数组）对象、**不含字符串 `field` 键**（旧条件必有）、且至少含一个
 * `var` 或 ∈ EXPR_OPS 的键。旧条件永远命中第一条排除；畸形对象（既无 field 也非算子）
 * 会落到旧分支，由 matchHiddenCondition 的「缺 field」fail-open 处理。
 */
export function isExprNode(x: unknown): boolean {
  if (!x || typeof x !== 'object' || Array.isArray(x)) return false
  const obj = x as Record<string, unknown>
  if (typeof obj.field === 'string') return false
  return Object.keys(obj).some((k) => (EXPR_OPS as readonly string[]).includes(k))
}

/**
 * 把表达式当「隐藏谓词」求值：**成立 ⇒ 隐藏**（与 isHidden 语义一致）。
 *
 * 任何结构错误都在**顶层**兜住并返回 false（即不隐藏）：
 * 内层 fail-open 返回 false 若落在 `not` 下会翻转成 true → 反而隐藏，这是危险方向；
 * 顶层兜住保证「任何结构问题 ⇒ 绝不隐藏」。同一个 fault 只告警一次。
 */
export function isHiddenExpr(expr: unknown, model: ModelLike): boolean {
  try {
    return !!evalExpr(expr, model)
  } catch (err) {
    warnExprOnce(
      err instanceof Error ? err.message : '__expr__',
      `[es-plus] isHidden 表达式非法，已按「不隐藏」处理：${err instanceof Error ? err.message : String(err)}`
    )
    return false
  }
}
