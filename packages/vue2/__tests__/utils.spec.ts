/**
 * vue2 工具函数测试
 *   - size.ts：mapSize（Element Plus → Element UI 尺寸映射）
 *   - icon.ts：getCompIcon（图标名规范化）
 */
import { describe, it, expect } from 'vitest'
import { mapSize } from '../src/utils/size'
import { getCompIcon } from '../src/utils/icon'

// ════════════════════════════════════════════════════════════════════════════
// mapSize
// ════════════════════════════════════════════════════════════════════════════

describe('mapSize — Element Plus → Element UI 尺寸映射', () => {
  it("'large' → 'medium'（40px → 36px）", () => {
    expect(mapSize('large')).toBe('medium')
  })

  it("'default' → 'small'（32px → 32px）", () => {
    expect(mapSize('default')).toBe('small')
  })

  it("'small' → 'mini'（24px → 28px）", () => {
    expect(mapSize('small')).toBe('mini')
  })

  it("'mini' → 'mini'（EUI 原生透传）", () => {
    expect(mapSize('mini')).toBe('mini')
  })

  it("'medium' → 'medium'（EUI 原生透传）", () => {
    expect(mapSize('medium')).toBe('medium')
  })

  it('undefined → undefined（让组件回退到自身默认值）', () => {
    expect(mapSize(undefined)).toBeUndefined()
  })

  it('null → undefined', () => {
    expect(mapSize(null)).toBeUndefined()
  })

  it("空字符串 '' → undefined", () => {
    expect(mapSize('')).toBeUndefined()
  })

  it('未知值（如 "huge"）→ undefined', () => {
    expect(mapSize('huge')).toBeUndefined()
  })

  it('数字类型（如 12）→ undefined（类型防御）', () => {
    expect(mapSize(12)).toBeUndefined()
  })

  it('首尾有空格时也正确映射', () => {
    expect(mapSize('  large  ')).toBe('medium')
  })
})

// ════════════════════════════════════════════════════════════════════════════
// getCompIcon
// ════════════════════════════════════════════════════════════════════════════

describe('getCompIcon — 图标名规范化', () => {
  it('已是 el-icon-xxx → 直接返回', () => {
    expect(getCompIcon('el-icon-plus')).toBe('el-icon-plus')
  })

  it('el-icon-search → 直接返回（已有前缀）', () => {
    expect(getCompIcon('el-icon-search')).toBe('el-icon-search')
  })

  it("PascalCase 'Plus' → 'el-icon-plus'", () => {
    expect(getCompIcon('Plus')).toBe('el-icon-plus')
  })

  it("PascalCase 'Search' → 'el-icon-search'", () => {
    expect(getCompIcon('Search')).toBe('el-icon-search')
  })

  it("复合 PascalCase 'ArrowDown' → 'el-icon-arrow-down'", () => {
    expect(getCompIcon('ArrowDown')).toBe('el-icon-arrow-down')
  })

  it("复合 PascalCase 'ZoomIn' → 'el-icon-zoom-in'", () => {
    expect(getCompIcon('ZoomIn')).toBe('el-icon-zoom-in')
  })

  it("小写 'plus' → 'el-icon-plus'", () => {
    expect(getCompIcon('plus')).toBe('el-icon-plus')
  })

  it("下划线分隔 'arrow_down' → 'el-icon-arrow-down'", () => {
    expect(getCompIcon('arrow_down')).toBe('el-icon-arrow-down')
  })

  it("空格分隔 'arrow down' → 'el-icon-arrow-down'", () => {
    expect(getCompIcon('arrow down')).toBe('el-icon-arrow-down')
  })

  it('undefined → undefined（无图标配置）', () => {
    expect(getCompIcon(undefined)).toBeUndefined()
  })

  it("空字符串 '' → undefined", () => {
    expect(getCompIcon('')).toBeUndefined()
  })

  it("camelCase 'editPen' → 'el-icon-edit-pen'", () => {
    expect(getCompIcon('editPen')).toBe('el-icon-edit-pen')
  })
})
