import { describe, it, expect } from 'vitest'
import { isObject, isArray, isFunction, isString, isNumber, isEmpty, firstWordUpperCase, kebabToCamel, toPascalCase, findValueByKey, wrapPromise } from './shared'

describe('shared utils', () => {
  describe('isObject', () => {
    it('should return true for plain objects', () => {
      expect(isObject({})).toBe(true)
      expect(isObject({ a: 1 })).toBe(true)
    })

    it('should return false for non-objects', () => {
      expect(isObject(null)).toBe(false)
      expect(isObject([])).toBe(false)
      expect(isObject('string')).toBe(false)
      expect(isObject(123)).toBe(false)
    })
  })

  describe('isArray', () => {
    it('should return true for arrays', () => {
      expect(isArray([])).toBe(true)
      expect(isArray([1, 2, 3])).toBe(true)
    })

    it('should return false for non-arrays', () => {
      expect(isArray({})).toBe(false)
      expect(isArray(null)).toBe(false)
    })
  })

  describe('isFunction', () => {
    it('should return true for functions', () => {
      expect(isFunction(() => {})).toBe(true)
      expect(isFunction(function () {})).toBe(true)
    })

    it('should return false for non-functions', () => {
      expect(isFunction('fn')).toBe(false)
      expect(isFunction(123)).toBe(false)
    })
  })

  describe('isString', () => {
    it('should return true for strings', () => {
      expect(isString('')).toBe(true)
      expect(isString('hello')).toBe(true)
      expect(isString(String(123))).toBe(true)
    })

    it('should return false for non-strings', () => {
      expect(isString(123)).toBe(false)
      expect(isString(null)).toBe(false)
      expect(isString(undefined)).toBe(false)
      expect(isString({})).toBe(false)
    })
  })

  describe('isNumber', () => {
    it('should return true for valid numbers', () => {
      expect(isNumber(0)).toBe(true)
      expect(isNumber(42)).toBe(true)
      expect(isNumber(-3.14)).toBe(true)
      expect(isNumber(Infinity)).toBe(true)
    })

    it('should return false for NaN and non-numbers', () => {
      expect(isNumber(NaN)).toBe(false)
      expect(isNumber('123')).toBe(false)
      expect(isNumber(null)).toBe(false)
      expect(isNumber(undefined)).toBe(false)
    })
  })

  describe('isEmpty', () => {
    it('should return true for null/undefined', () => {
      expect(isEmpty(null)).toBe(true)
      expect(isEmpty(undefined)).toBe(true)
    })

    it('should return true for empty arrays and objects', () => {
      expect(isEmpty([])).toBe(true)
      expect(isEmpty({})).toBe(true)
    })

    it('should return false for non-empty arrays and objects', () => {
      expect(isEmpty([1])).toBe(false)
      expect(isEmpty({ a: 1 })).toBe(false)
    })

    it('should return false for primitives', () => {
      expect(isEmpty(0)).toBe(false)
      expect(isEmpty('')).toBe(false)
      expect(isEmpty(false)).toBe(false)
    })
  })

  describe('firstWordUpperCase', () => {
    it('should capitalize first letter and lowercase rest', () => {
      expect(firstWordUpperCase('hello')).toBe('Hello')
      expect(firstWordUpperCase('WORLD')).toBe('World')
    })
  })

  describe('kebabToCamel', () => {
    it('should convert kebab-case to camelCase', () => {
      expect(kebabToCamel('my-variable')).toBe('myVariable')
      expect(kebabToCamel('a-b-c')).toBe('aBC')
    })
  })

  describe('toPascalCase', () => {
    it('should convert kebab-case to PascalCase', () => {
      expect(toPascalCase('my-component')).toBe('MyComponent')
      expect(toPascalCase('es-form')).toBe('EsForm')
    })
  })

  describe('findValueByKey', () => {
    it('should find value at top level', () => {
      expect(findValueByKey({ a: 1 }, 'a')).toBe(1)
    })

    it('should find value nested up to 3 levels', () => {
      expect(findValueByKey({ a: { b: { c: 42 } } }, 'c')).toBe(42)
    })

    it('should return undefined when depth exceeds 3', () => {
      expect(findValueByKey({ a: { b: { c: { d: { e: 99 } } } } }, 'e')).toBeUndefined()
    })

    it('should return undefined for missing key', () => {
      expect(findValueByKey({ a: 1 }, 'b')).toBeUndefined()
    })
  })

  describe('wrapPromise', () => {
    it('should wrap resolved promise', async () => {
      const result = await wrapPromise(Promise.resolve(42))
      expect(result).toEqual({ status: 'fulfilled', value: 42 })
    })

    it('should wrap rejected promise', async () => {
      const result = await wrapPromise(Promise.reject('error'))
      expect(result).toEqual({ status: 'rejected', reason: 'error' })
    })
  })
})
