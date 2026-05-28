/**
 * Element UI v2 与 Element Plus 尺寸语义映射
 *
 * 背景：用户在两套版本之间复用同一份配置（如 size: 'small'），但两个组件库的尺寸系统并不一致：
 *   Element Plus:   large(40px) / default(32px) / small(24px)
 *   Element UI v2:  medium(36px) / small(32px) / mini(28px)
 *
 * 直接透传会导致同样的字符串渲染出截然不同的物理高度（small 在 EP 是 24px，在 EUI 是 32px），
 * 视觉上 Vue 2 版本明显比 Vue 3 版本"大一圈"。
 *
 * 本工具按"接近视觉高度"做语义映射：
 *   large    → medium  (40 → 36)
 *   default  → small   (32 → 32) — 高度本身一致
 *   small    → mini    (24 → 28) — EUI 没有更小的，mini 已是最贴近
 *   mini     → mini    (透传 — EUI 原生支持)
 *   medium   → medium  (透传 — EUI 原生支持)
 *
 * 这样一来，在 Vue 3 版本里使用 size: 'small' 的紧凑表单，迁到 Vue 2 版本会自动落到 mini，
 * 整体视觉密度保持一致。用户若显式希望使用 EUI 原生尺寸（如 medium），原样透传即可。
 */

export type ElPlusSize = 'large' | 'default' | 'small' | ''
export type ElUiSize = 'medium' | 'small' | 'mini' | ''

const SIZE_MAP: Record<string, ElUiSize> = {
  large: 'medium',
  default: 'small',
  small: 'mini',
  // EUI 原生值透传
  medium: 'medium',
  mini: 'mini',
}

/**
 * 将任意尺寸字符串映射为 Element UI v2 支持的尺寸。
 * - 未识别的值返回 undefined，让组件回退到自身默认值
 * - 空字符串/空值同样返回 undefined
 */
export function mapSize(size: unknown): ElUiSize | undefined {
  if (size === undefined || size === null || size === '') return undefined
  const key = String(size).trim()
  if (!key) return undefined
  return SIZE_MAP[key]
}
