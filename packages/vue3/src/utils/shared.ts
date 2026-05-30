export const isObject = (value: unknown): value is Record<string, unknown> => {
  return typeof value === 'object' && value !== null && Object.prototype.toString.call(value) === '[object Object]'
}

export const isArray = (value: unknown): value is unknown[] => {
  return Array.isArray(value)
}

export const isFunction = (value: unknown): value is Function => {
  return typeof value === 'function'
}

export const isString = (value: unknown): value is string => {
  return typeof value === 'string'
}

export const isNumber = (value: unknown): value is number => {
  return typeof value === 'number' && !isNaN(value)
}

export const isEmpty = (value: unknown): boolean => {
  if (value == null) return true
  if (isArray(value)) return value.length === 0
  if (isObject(value)) return Object.keys(value).length === 0
  return false
}

export const firstWordUpperCase = (str: string): string => {
  return str.charAt(0).toUpperCase() + str.slice(1).toLowerCase()
}

export const kebabToCamel = (str: string): string => {
  return str.replace(/-([a-z])/g, (_, letter) => letter.toUpperCase())
}

export const toPascalCase = (str: string): string => {
  return str.replace(/(^|-)([a-z])/g, (_, __, letter) => letter.toUpperCase())
}

export const findValueByKey = (obj: Record<string, unknown>, key: string, depth = 0): unknown => {
  if (depth > 3) return undefined
  if (!isObject(obj)) return undefined

  const currentValue = Object.prototype.hasOwnProperty.call(obj, key) ? obj[key] : undefined

  for (const prop in obj) {
    if (Object.prototype.hasOwnProperty.call(obj, prop) && isObject(obj[prop])) {
      const deepValue = findValueByKey(obj[prop] as Record<string, unknown>, key, depth + 1)
      if (deepValue !== undefined) return deepValue
    }
  }
  return currentValue
}

export const wrapPromise = <T>(promise: Promise<T>): Promise<{ status: 'fulfilled'; value: T } | { status: 'rejected'; reason: unknown }> => {
  return promise
    .then((value) => ({ status: 'fulfilled' as const, value }))
    .catch((reason) => ({ status: 'rejected' as const, reason }))
}
