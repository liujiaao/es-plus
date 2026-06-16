/**
 * 工具函数单元测试
 */
import { describe, it, expect } from 'vitest'
import {
  isObject, isArray, isFunction, isString, isNumber, isEmpty,
  findValueByKey, getNestedValue, setNestedValue,
  mapButtonType, mapSize, firstWordUpperCase,
} from '../src/utils/shared'

describe('类型判断函数', () => {
  it('isObject — 识别纯对象', () => {
    expect(isObject({})).toBe(true)
    expect(isObject({ a: 1 })).toBe(true)
    expect(isObject([])).toBe(false)
    expect(isObject(null)).toBe(false)
    expect(isObject(undefined)).toBe(false)
    expect(isObject('string')).toBe(false)
    expect(isObject(123)).toBe(false)
    expect(isObject(() => {})).toBe(false)
  })

  it('isArray', () => {
    expect(isArray([])).toBe(true)
    expect(isArray([1, 2, 3])).toBe(true)
    expect(isArray({})).toBe(false)
    expect(isArray('string')).toBe(false)
  })

  it('isFunction', () => {
    expect(isFunction(() => {})).toBe(true)
    expect(isFunction(function () {})).toBe(true)
    expect(isFunction({})).toBe(false)
    expect(isFunction('fn')).toBe(false)
  })

  it('isString', () => {
    expect(isString('')).toBe(true)
    expect(isString('hello')).toBe(true)
    expect(isString(123)).toBe(false)
    expect(isString(null)).toBe(false)
  })

  it('isNumber', () => {
    expect(isNumber(0)).toBe(true)
    expect(isNumber(123)).toBe(true)
    expect(isNumber(NaN)).toBe(false)
    expect(isNumber('123')).toBe(false)
    expect(isNumber(null)).toBe(false)
  })

  it('isEmpty — 空值检测', () => {
    expect(isEmpty(null)).toBe(true)
    expect(isEmpty(undefined)).toBe(true)
    expect(isEmpty('')).toBe(true)
    expect(isEmpty('  ')).toBe(true)
    expect(isEmpty([])).toBe(true)
    expect(isEmpty({})).toBe(true)
    expect(isEmpty('hello')).toBe(false)
    expect(isEmpty([1])).toBe(false)
    expect(isEmpty({ a: 1 })).toBe(false)
  })
})

describe('嵌套路径函数', () => {
  const obj = {
    user: { name: 'test', address: { city: '深圳', zip: '518000' } },
    list: [{ id: 1 }, { id: 2 }],
    deep: { a: { b: { c: 'value' } } },
  }

  it('getNestedValue — 点号路径', () => {
    expect(getNestedValue(obj, 'user.name')).toBe('test')
    expect(getNestedValue(obj, 'user.address.city')).toBe('深圳')
    expect(getNestedValue(obj, 'deep.a.b.c')).toBe('value')
  })

  it('getNestedValue — 不存在路径返回 undefined', () => {
    expect(getNestedValue(obj, 'user.notExist')).toBeUndefined()
    expect(getNestedValue(obj, 'a.b.c')).toBeUndefined()
  })

  it('getNestedValue — null/undefined 中间值安全返回 undefined', () => {
    expect(getNestedValue({ user: null } as any, 'user.name')).toBeUndefined()
  })

  it('setNestedValue — 创建嵌套属性', () => {
    const target: Record<string, unknown> = {}
    setNestedValue(target, 'user.name', '张三')
    expect(target).toEqual({ user: { name: '张三' } })

    setNestedValue(target, 'user.address.city', '上海')
    expect(target).toEqual({ user: { name: '张三', address: { city: '上海' } } })
  })

  it('setNestedValue — 覆盖已有值', () => {
    const target = { user: { name: 'old' } }
    setNestedValue(target, 'user.name', 'new')
    expect(target).toEqual({ user: { name: 'new' } })
  })

  it('setNestedValue — 方括号路径', () => {
    const target: Record<string, unknown> = {}
    setNestedValue(target, 'arr[0].name', 'first')
    expect(target).toEqual({ arr: [{ name: 'first' }] })
  })
})

describe('findValueByKey', () => {
  const data = { total: 100, data: [{ id: 1 }] }

  it('直接匹配', () => {
    expect(findValueByKey(data, 'total')).toBe(100)
  })

  it('嵌套搜索 (depth 3 内)', () => {
    const nested = { a: { b: { c: 'found' } } }
    expect(findValueByKey(nested, 'c')).toBe('found')
  })

  it('超过 depth 返回 undefined', () => {
    const deep = { a: { b: { c: { d: 'too deep' } } } }
    expect(findValueByKey(deep, 'd')).toBeUndefined()
  })
})

describe('映射函数', () => {
  it('mapButtonType — EP → ADV', () => {
    expect(mapButtonType('')).toBe('default')
    expect(mapButtonType('default')).toBe('default')
    expect(mapButtonType('primary')).toBe('primary')
    expect(mapButtonType('danger')).toBe('danger')
    expect(mapButtonType('dashed')).toBe('dashed')
    expect(mapButtonType('text')).toBe('link')
    expect(mapButtonType('link')).toBe('link')
    expect(mapButtonType('success')).toBe('default') // 降级
    expect(mapButtonType('warning')).toBe('default') // 降级
    expect(mapButtonType(undefined)).toBe('default')
  })

  it('mapSize — EP → ADV', () => {
    expect(mapSize('large')).toBe('large')
    expect(mapSize('default')).toBe('middle')
    expect(mapSize('small')).toBe('small')
    expect(mapSize('medium')).toBe('middle')
    expect(mapSize('mini')).toBe('small')
    expect(mapSize(undefined)).toBe('middle')
    expect(mapSize('', 'large')).toBe('large')
  })

  it('firstWordUpperCase', () => {
    expect(firstWordUpperCase('hello')).toBe('Hello')
    expect(firstWordUpperCase('WORLD')).toBe('World')
    expect(firstWordUpperCase('a')).toBe('A')
  })
})
