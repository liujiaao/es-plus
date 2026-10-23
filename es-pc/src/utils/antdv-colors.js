/**
 * Element Plus 语义色 → Ant Design Vue `<Tag color>` 的取值。
 *
 * Antdv 的 Tag 没有 `type` 属性；`color` 只认预设色名（blue/green/orange/red…）
 * 或状态值（success / processing / error / warning / default）。
 * 示例里到处是 EP 写法（type: 'success' | 'warning' | 'danger' | 'info'），
 * 直接翻译到 antdv 的颜色，既不丢语义，也不用逐个改 map。
 */
const MAP = {
  primary: 'blue',
  success: 'success',
  warning: 'warning',
  danger: 'error',
  error: 'error',
  info: 'default',
}

export function tagColor(type) {
  if (!type) return 'default'
  return MAP[type] || type
}
