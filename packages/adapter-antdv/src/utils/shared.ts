/**
 * 共享工具函数
 *
 * 从 @es-plus/vue3/src/utils/shared.ts 移植，保持 API 一致。
 */

export const isObject = (value: unknown): value is Record<string, unknown> =>
  Object.prototype.toString.call(value) === '[object Object]'

export const isArray = Array.isArray

export const isFunction = (value: unknown): value is (...args: unknown[]) => unknown =>
  typeof value === 'function'

export const isString = (value: unknown): value is string =>
  typeof value === 'string'

export const isNumber = (value: unknown): value is number =>
  typeof value === 'number' && !Number.isNaN(value)

export const isEmpty = (value: unknown): boolean => {
  if (value == null) return true
  if (isArray(value)) return value.length === 0
  if (isObject(value)) return Object.keys(value).length === 0
  if (isString(value)) return value.trim() === ''
  return false
}

export function findValueByKey(obj: Record<string, unknown>, key: string, depth = 3): unknown {
  if (depth <= 0 || !isObject(obj)) return undefined
  if (key in obj) return obj[key]
  for (const [, v] of Object.entries(obj)) {
    if (isObject(v)) {
      const found = findValueByKey(v, key, depth - 1)
      if (found !== undefined) return found
    }
  }
  return undefined
}

/**
 * 支持嵌套路径的取值 (如 'user.address.city')
 */
export const getNestedValue = (obj: Record<string, unknown>, path: string): unknown => {
  const keys = path.split(/\.|\[|\]/).filter(Boolean)
  let result: unknown = obj
  for (const key of keys) {
    if (result == null) return undefined
    result = (result as Record<string, unknown>)[key]
  }
  return result
}

/**
 * 支持嵌套路径的赋值 (如 'user.address.city')
 */
export const setNestedValue = (obj: Record<string, unknown>, path: string, value: unknown): void => {
  const keys = path.split(/\.|\[|\]/).filter(Boolean)
  const lastKey = keys.pop()
  let current: Record<string, unknown> = obj
  for (let i = 0; i < keys.length; i++) {
    const key = keys[i]
    const nextKey = keys[i + 1]
    if (current[key] == null) {
      // 如果下一个 key 是数字，则当前应创建数组，否则创建对象
      const shouldBeArray = nextKey !== undefined && /^\d+$/.test(nextKey)
      current[key] = shouldBeArray ? [] : {}
    }
    current = current[key] as Record<string, unknown>
  }
  if (lastKey) {
    current[lastKey] = value
  }
}

export const firstWordUpperCase = (str: string): string => {
  return str.charAt(0).toUpperCase() + str.slice(1).toLowerCase()
}

/**
 * EP type → ADV button type 映射
 */
export function mapButtonType(epType: string | undefined): string {
  if (!epType || epType === '' || epType === 'default') return 'default'
  if (epType === 'primary') return 'primary'
  if (epType === 'danger') return 'danger'
  if (epType === 'dashed') return 'dashed'
  if (epType === 'text') return 'link'
  if (epType === 'link') return 'link'
  return 'default'
}

/**
 * EP size → ADV size 映射
 */
export function mapSize(epSize: string | undefined, defaultValue = 'middle'): string {
  if (!epSize) return defaultValue
  const map: Record<string, string> = { large: 'large', default: 'middle', small: 'small', medium: 'middle', mini: 'small' }
  return map[epSize] || defaultValue
}
