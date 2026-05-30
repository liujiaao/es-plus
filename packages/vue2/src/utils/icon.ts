/**
 * Element UI 图标适配工具
 *
 * Element Plus 使用图标组件（如 `<Plus />`），Element UI 使用 class 字符串（如 `el-icon-plus`）。
 * 用户配置可能传入：
 *   - 'Plus'           （Element Plus 风格 PascalCase）
 *   - 'el-icon-plus'   （Element UI 原生 class）
 *   - 'plus'           （短名）
 *
 * 本函数统一规范化为 Element UI 的 class 字符串。
 */
export const getCompIcon = (key?: string): string | undefined => {
  if (!key) return undefined
  // 已经是 el-icon-xxx 的直接返回
  if (key.startsWith('el-icon-')) return key
  // PascalCase / camelCase → kebab-case，并加 el-icon- 前缀
  const kebab = key
    .replace(/([a-z])([A-Z])/g, '$1-$2')
    .replace(/[\s_]+/g, '-')
    .toLowerCase()
  return `el-icon-${kebab}`
}
