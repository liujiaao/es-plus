import { describe, it, expect, vi, afterEach } from 'vitest'
import { EXPR_OPS, ExprEvalError, evalExpr, isExprNode, isHiddenExpr } from '../src/expr'

/**
 * AI-16 底座：core 的 JSON 表达式求值器。
 *
 * 这是「三端等价求值」的**真见证**：三端渲染器都只经 core `normalizeFormItem` 水合，
 * 没有渲染侧求值器 —— 故一份 core 求值器测试即覆盖 vue3 / vue2 / antdv 的等价性。
 */

const M = (o: Record<string, unknown>) => o

describe('core > expr > 白名单与常量', () => {
  it('EXPR_OPS 冻结且含预期算子', () => {
    expect(Object.isFrozen(EXPR_OPS)).toBe(true)
    expect([...EXPR_OPS]).toEqual([
      'var', '==', '!=', '>', '>=', '<', '<=', 'in', 'nin', 'empty', 'notEmpty', 'truthy', 'falsy', 'and', 'or', 'not', 'if',
    ])
  })
})

describe('core > expr > evalExpr 路径与比较算子', () => {
  it('var：取路径值（含嵌套 / 缺失 / 不安全路径 → undefined）', () => {
    expect(evalExpr({ var: 'a' }, M({ a: 1 }))).toBe(1)
    expect(evalExpr({ var: 'user.type' }, M({ user: { type: 'vip' } }))).toBe('vip')
    expect(evalExpr({ var: 'list[0].name' }, M({ list: [{ name: 'x' }] }))).toBe('x')
    expect(evalExpr({ var: 'missing' }, M({}))).toBeUndefined()
    expect(evalExpr({ var: '__proto__' }, M({}))).toBeUndefined()
    expect(evalExpr({ var: 'constructor' }, M({}))).toBeUndefined()
  })

  it('== / !=：沿用 looseEqual（严格 + 仅放宽 number↔string）', () => {
    expect(evalExpr({ '==': [{ var: 'a' }, 1] }, M({ a: 1 }))).toBe(true)
    expect(evalExpr({ '==': [{ var: 'a' }, '1'] }, M({ a: 1 }))).toBe(true)
    expect(evalExpr({ '==': [{ var: 'a' }, 1] }, M({ a: '1' }))).toBe(true)
    expect(evalExpr({ '==': [{ var: 'a' }, 'x'] }, M({ a: 'y' }))).toBe(false)
    // 空值不由 == 代办：'' ≠ 0、null ≠ undefined
    expect(evalExpr({ '==': [{ var: 'a' }, 0] }, M({ a: '' }))).toBe(false)
    expect(evalExpr({ '==': [{ var: 'a' }, null] }, M({ a: undefined }))).toBe(false)
    expect(evalExpr({ '!=': [{ var: 'a' }, 1] }, M({ a: 2 }))).toBe(true)
  })

  it('序关系 > >= < <=：数值 / 字典序 / 数字串放宽 / 不可比 → false', () => {
    expect(evalExpr({ '>': [{ var: 'a' }, 1] }, M({ a: 2 }))).toBe(true)
    expect(evalExpr({ '>=': [{ var: 'a' }, 2] }, M({ a: 2 }))).toBe(true)
    expect(evalExpr({ '<': [{ var: 'a' }, 1] }, M({ a: 2 }))).toBe(false)
    expect(evalExpr({ '<=': [{ var: 'a' }, 2] }, M({ a: 2 }))).toBe(true)
    // number ↔ string 放宽（数值化）
    expect(evalExpr({ '>': [{ var: 'a' }, 3] }, M({ a: '5' }))).toBe(true)
    // 同为字符串 → 字典序
    expect(evalExpr({ '<': [{ var: 'a' }, 'b'] }, M({ a: 'a' }))).toBe(true)
    // 不可比：undefined / null / 非数值串
    expect(evalExpr({ '>': [{ var: 'missing' }, 0] }, M({}))).toBe(false)
    expect(evalExpr({ '>': [{ var: 'a' }, 0] }, M({ a: null }))).toBe(false)
    expect(evalExpr({ '>': [{ var: 'a' }, 1] }, M({ a: 'abc' }))).toBe(false)
  })

  it('in / nin：成员判定；右侧非数组时 in→false、nin→true（对齐旧 in/nIn）', () => {
    expect(evalExpr({ in: [{ var: 'a' }, ['x', 2]] }, M({ a: '2' }))).toBe(true)
    expect(evalExpr({ in: [{ var: 'a' }, ['x']] }, M({ a: 'y' }))).toBe(false)
    expect(evalExpr({ nin: [{ var: 'a' }, ['x']] }, M({ a: 'y' }))).toBe(true)
    expect(evalExpr({ in: [{ var: 'a' }, 'x'] }, M({ a: 'x' }))).toBe(false)
    expect(evalExpr({ nin: [{ var: 'a' }, 'x'] }, M({ a: 'x' }))).toBe(true)
  })

  it('empty / notEmpty / truthy / falsy：空值与真值判定', () => {
    for (const v of ['', null, undefined, []]) {
      expect(evalExpr({ empty: [{ var: 'a' }] }, M({ a: v }))).toBe(true)
    }
    expect(evalExpr({ empty: [{ var: 'a' }] }, M({ a: 0 }))).toBe(false)
    expect(evalExpr({ notEmpty: [{ var: 'a' }] }, M({ a: 0 }))).toBe(true)
    expect(evalExpr({ notEmpty: [{ var: 'a' }] }, M({ a: [] }))).toBe(false)
    expect(evalExpr({ truthy: [{ var: 'a' }] }, M({ a: 1 }))).toBe(true)
    expect(evalExpr({ truthy: [{ var: 'a' }] }, M({ a: 0 }))).toBe(false)
    expect(evalExpr({ falsy: [{ var: 'a' }] }, M({ a: 0 }))).toBe(true)
    expect(evalExpr({ falsy: [{ var: 'a' }] }, M({ a: 'x' }))).toBe(false)
  })

  it('字面量：原样返回；数组 → 逐元素求值', () => {
    expect(evalExpr('hello', M({}))).toBe('hello')
    expect(evalExpr(42, M({}))).toBe(42)
    expect(evalExpr(null, M({}))).toBe(null)
    expect(evalExpr([1, { var: 'a' }], M({ a: 2 }))).toEqual([1, 2])
  })
})

describe('core > expr > 逻辑与嵌套', () => {
  it('and / or：短路真值；空和 → true，空或 → false', () => {
    expect(evalExpr({ and: [{ var: 'a' }, { var: 'b' }] }, M({ a: 1, b: 1 }))).toBe(true)
    expect(evalExpr({ and: [{ var: 'a' }, { var: 'b' }] }, M({ a: 1, b: 0 }))).toBe(false)
    expect(evalExpr({ or: [{ var: 'a' }, { var: 'b' }] }, M({ a: 0, b: 1 }))).toBe(true)
    expect(evalExpr({ or: [] }, M({}))).toBe(false)
    expect(evalExpr({ and: [] }, M({}))).toBe(true)
  })

  it('not / if：取反与三元', () => {
    expect(evalExpr({ not: [{ var: 'a' }] }, M({ a: 0 }))).toBe(true)
    expect(evalExpr({ not: [{ var: 'a' }] }, M({ a: 1 }))).toBe(false)
    expect(evalExpr({ if: [{ var: 'a' }, 'yes', 'no'] }, M({ a: 1 }))).toBe('yes')
    expect(evalExpr({ if: [{ var: 'a' }, 'yes', 'no'] }, M({ a: 0 }))).toBe('no')
    expect(evalExpr({ if: [{ var: 'a' }, 'yes'] }, M({ a: 0 }))).toBe(null)
  })

  it('深嵌套：or(and(...), ...) 可达', () => {
    const expr = {
      or: [
        { and: [{ '==': [{ var: 'a' }, 1] }, { '>': [{ var: 'b' }, 10] }] },
        { '==': [{ var: 'a' }, 'none' ] },
      ],
    }
    expect(evalExpr(expr, M({ a: 1, b: 20 }))).toBe(true)
    expect(evalExpr(expr, M({ a: 1, b: 5 }))).toBe(false)
    expect(evalExpr(expr, M({ a: 'none' }))).toBe(true)
  })
})

describe('core > expr > 结构错误 fail-open（返回 false 且告警一次）', () => {
  afterEach(() => {
    vi.restoreAllMocks()
  })

  it('evalExpr 对未知算子 / 错 arity / 畸形节点抛 ExprEvalError', () => {
    expect(() => evalExpr({ zzz: [] }, M({}))).toThrow(ExprEvalError)
    expect(() => evalExpr({ '>': [1] }, M({}))).toThrow(ExprEvalError)
    expect(() => evalExpr({ '==': [1] }, M({}))).toThrow(ExprEvalError)
    expect(() => evalExpr({ and: 1 }, M({}))).toThrow(ExprEvalError)
    expect(() => evalExpr({ var: 5 }, M({}))).toThrow(ExprEvalError)
    expect(() => evalExpr({ '==': [1], '!=': [1] }, M({}))).toThrow(ExprEvalError)
  })

  it('isHiddenExpr 顶层兜住：结构问题 → 不隐藏，且同一 fault 只告警一次', () => {
    const spy = vi.spyOn(console, 'warn').mockImplementation(() => {})
    expect(isHiddenExpr({ zzzUniqueFault: [] }, M({}))).toBe(false)
    expect(isHiddenExpr({ zzzUniqueFault: [] }, M({}))).toBe(false)
    const hits = spy.mock.calls.filter((c) => String(c[0]).includes('zzzUniqueFault'))
    expect(hits).toHaveLength(1)
  })

  it('顶层 catch（而非内层 fail-open）保证 not 下不会误隐藏', () => {
    // 若内层 fail-open 返回 false，not 会翻成 true → 错误地隐藏；顶层 catch 保证整体 false。
    expect(isHiddenExpr({ not: [{ zzz: [] }] }, M({}))).toBe(false)
  })
})

describe('core > expr > isExprNode 判别', () => {
  it('旧条件（含字符串 field）→ false；表达式 → true；其他 → false', () => {
    expect(isExprNode({ field: 'a', op: 'eq', value: 1 })).toBe(false)
    expect(isExprNode({ var: 'a' })).toBe(true)
    expect(isExprNode({ '==': [{ var: 'a' }, 1] })).toBe(true)
    expect(isExprNode({ and: [] })).toBe(true)
    expect(isExprNode({})).toBe(false)
    expect(isExprNode({ op: 'truthy' })).toBe(false)
    expect(isExprNode([1, 2])).toBe(false)
    expect(isExprNode('x')).toBe(false)
    expect(isExprNode(null)).toBe(false)
  })
})
