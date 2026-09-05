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
  // success / warning / info — ADV 不支持，降级为 default（附一次性开发告警，
  // 让用户知道跨端视觉差异，而非静默吞掉语义）。
  warnButtonDegradation(epType)
  return 'default'
}

/** 已告警过的 EP button type，避免同一类型在渲染循环里刷屏 */
const warnedButtonTypes = new Set<string>()

/**
 * 开发期一次性告警：EP 的 success/warning/info 语义按钮在 ant-design-vue 中无对应
 * 内建色板，会被降级为 default（灰底）。生产构建（NODE_ENV==='production'）静默。
 */
function warnButtonDegradation(epType: string): void {
  if (epType !== 'success' && epType !== 'warning' && epType !== 'info') return
  if (typeof process !== 'undefined' && process.env?.NODE_ENV === 'production') return
  if (warnedButtonTypes.has(epType)) return
  warnedButtonTypes.add(epType)
  // eslint-disable-next-line no-console
  console.warn(
    `[@es-plus/adapter-antdv] 按钮 type="${epType}" 在 ant-design-vue 中无内建色板，已降级为 default。` +
      `如需该语义色，请改用 primary/danger 或自定义 class（vue3/vue2 保留原生 ${epType} 样式）。`,
  )
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
