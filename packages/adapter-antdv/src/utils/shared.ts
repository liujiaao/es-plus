/**
 * 共享工具函数
 *
 * 直接复用 @es-plus/core/shared（与 @es-plus/vue3/utils/shared 字节级一致），
 * 避免维护偏离副本。仅附加 ADV 专属的 EP→ADV 映射工具。
 */
export {
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
} from '@es-plus/core/shared'

// ─── ADV 专属：EP → ADV 映射工具（非跨框架共享） ───────────────

/**
 * EP type → ADV button type 映射
 *   ''/default → default, primary → primary, danger → danger,
 *   dashed → dashed, text/link → link,
 *   success/warning/info — ADV 不支持，降级为 default
 */
export function mapButtonType(epType: string | undefined): string {
  if (!epType || epType === '' || epType === 'default') return 'default'
  if (epType === 'primary') return 'primary'
  if (epType === 'danger') return 'danger'
  if (epType === 'dashed') return 'dashed'
  if (epType === 'text') return 'link'
  if (epType === 'link') return 'link'
  // success / warning / info — ADV 不支持，降级为 default
  return 'default'
}

/**
 * EP size → ADV size 映射
 *   large → large, default → middle, small → small, medium → middle, mini → small
 */
export function mapSize(epSize: string | undefined, defaultValue = 'middle'): string {
  if (!epSize) return defaultValue
  const map: Record<string, string> = {
    large: 'large',
    default: 'middle',
    small: 'small',
    medium: 'middle',
    mini: 'small',
    '': 'middle',
  }
  return map[epSize] || defaultValue
}
