import { describe, it, expect } from 'vitest'
import {
  isObject,
  isArray,
  isFunction,
  isString,
  isNumber,
  isEmpty,
  firstWordUpperCase,
  kebabToCamel,
  toPascalCase,
  findValueByKey,
  wrapPromise,
  getNestedValue,
  setNestedValue,
} from '../src/shared'

describe('shared > 类型守卫', () => {
  it('isObject 仅对纯对象返回 true', () => {
    expect(isObject({})).toBe(true)
    expect(isObject({ a: 1 })).toBe(true)
    expect(isObject([])).toBe(false)
    expect(isObject(null)).toBe(false)
    expect(isObject(undefined)).toBe(false)
    expect(isObject(new Date())).toBe(false)
    expect(isObject('str')).toBe(false)
  })

  it('isArray', () => {
    expect(isArray([])).toBe(true)
    expect(isArray([1, 2])).toBe(true)
    expect(isArray({})).toBe(false)
  })

  it('isFunction', () => {
    expect(isFunction(() => 0)).toBe(true)
    expect(isFunction(function () {})).toBe(true)
    expect(isFunction({})).toBe(false)
  })

  it('isString', () => {
    expect(isString('a')).toBe(true)
    expect(isString('')).toBe(true)
    expect(isString(1)).toBe(false)
  })

  it('isNumber 排除 NaN', () => {
    expect(isNumber(0)).toBe(true)
    expect(isNumber(1.5)).toBe(true)
    expect(isNumber(NaN)).toBe(false)
    expect(isNumber('1')).toBe(false)
  })

  it('isEmpty', () => {
    expect(isEmpty(null)).toBe(true)
    expect(isEmpty(undefined)).toBe(true)
    expect(isEmpty([])).toBe(true)
    expect(isEmpty({})).toBe(true)
    expect(isEmpty([1])).toBe(false)
    expect(isEmpty({ a: 1 })).toBe(false)
    expect(isEmpty('')).toBe(false) // 空字符串不算 empty
  })
})

describe('shared > 字符串工具', () => {
  it('firstWordUpperCase', () => {
    expect(firstWordUpperCase('hello')).toBe('Hello')
    expect(firstWordUpperCase('HELLO')).toBe('Hello')
  })

  it('kebabToCamel', () => {
    expect(kebabToCamel('min-width')).toBe('minWidth')
    expect(kebabToCamel('background-color')).toBe('backgroundColor')
    expect(kebabToCamel('plain')).toBe('plain')
  })

  it('toPascalCase', () => {
    expect(toPascalCase('es-table')).toBe('EsTable')
    expect(toPascalCase('hello-world-foo')).toBe('HelloWorldFoo')
    expect(toPascalCase('plain')).toBe('Plain')
  })
})

describe('shared > findValueByKey', () => {
  it('当前层直接命中', () => {
    expect(findValueByKey({ total: 5 }, 'total')).toBe(5)
  })

  it('深层嵌套命中', () => {
    expect(findValueByKey({ data: { rows: [1, 2] } }, 'rows')).toEqual([1, 2])
  })

  it('深层优先于浅层', () => {
    const obj = { rows: 'shallow', data: { rows: 'deep' } }
    expect(findValueByKey(obj, 'rows')).toBe('deep')
  })

  it('找不到返回 undefined', () => {
    expect(findValueByKey({ a: 1 }, 'b')).toBeUndefined()
  })

  it('深度限制（3 层后停止）', () => {
    const deep = { a: { b: { c: { d: { target: 1 } } } } }
    // 4 层深应该找不到（depth 0 → a, 1 → b, 2 → c, 3 → d 时 depth>3 终止）
    expect(findValueByKey(deep, 'target')).toBeUndefined()
  })
})

describe('shared > wrapPromise', () => {
  it('成功 Promise → fulfilled', async () => {
    const r = await wrapPromise(Promise.resolve(42))
    expect(r).toEqual({ status: 'fulfilled', value: 42 })
  })

  it('失败 Promise → rejected', async () => {
    const r = await wrapPromise(Promise.reject(new Error('boom')))
    expect(r.status).toBe('rejected')
    if (r.status === 'rejected') {
      expect((r.reason as Error).message).toBe('boom')
    }
  })
})

describe('shared > getNestedValue / setNestedValue', () => {
  it('点号路径取值', () => {
    expect(getNestedValue({ a: { b: { c: 1 } } }, 'a.b.c')).toBe(1)
  })

  it('方括号路径取值', () => {
    expect(getNestedValue({ list: [{ name: 'x' }] }, 'list[0].name')).toBe('x')
  })

  it('找不到返回 undefined', () => {
    expect(getNestedValue({ a: 1 }, 'a.b.c')).toBeUndefined()
  })

  it('空 path 或 obj 返回 undefined', () => {
    expect(getNestedValue({}, '')).toBeUndefined()
    expect(getNestedValue(null as unknown as Record<string, unknown>, 'a')).toBeUndefined()
  })

  it('setNestedValue 设置深层值', () => {
    const obj: Record<string, unknown> = {}
    setNestedValue(obj, 'a.b.c', 42)
    expect(obj).toEqual({ a: { b: { c: 42 } } })
  })

  it('setNestedValue 覆盖已有值', () => {
    const obj: Record<string, unknown> = { a: { b: 1 } }
    setNestedValue(obj, 'a.b', 2)
    expect(obj.a).toEqual({ b: 2 })
  })

  it('setNestedValue 自动创建中间层', () => {
    const obj: Record<string, unknown> = { user: null }
    setNestedValue(obj, 'user.name', 'tom')
    expect(obj).toEqual({ user: { name: 'tom' } })
  })
})
