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
 *   ''/default → default, primary → primary,
 *   danger → primary（配合 danger 布尔属性 = 实心红，对齐 EP/Element-UI 的实心 danger），
 *   dashed → dashed, text/link → link,
 *   success/warning/info — ADV 不支持，降级为 default
 *
 * 注意：ADV 4.x 的 `type` 合法枚举不含 'danger'（它是 LegacyButtonType）；
 * 红色 danger 样式仅由 `danger` 布尔属性驱动（button.js: `${pre}-dangerous`）。
 * 因此 danger 必须映射为合法 type='primary' 并单独绑定 :danger（见 mapButtonDanger）。
 */
export function mapButtonType(epType: string | undefined): string {
  if (!epType || epType === '' || epType === 'default') return 'default'
  if (epType === 'primary') return 'primary'
  // danger 走实心：type='primary' + danger 布尔（对齐 vue3/EP 实心红），
  // 单独由 mapButtonDanger 提供 danger 布尔值。
  if (epType === 'danger') return 'primary'
  if (epType === 'dashed') return 'dashed'
  if (epType === 'text') return 'link'
  if (epType === 'link') return 'link'
  // success / warning / info — ADV 不支持，降级为 default
  return 'default'
}

/**
 * EP type → ADV `danger` 布尔属性
 *   仅 'danger' 为 true；其余（含 primary/text/link/dashed/default）为 false。
 *   与 mapButtonType 配合：danger → type='primary' + danger=true = 实心红。
 */
export function mapButtonDanger(epType: string | undefined): boolean {
  return epType === 'danger'
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
