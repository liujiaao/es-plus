/**
 * 图标适配测试
 */
import { describe, it, expect } from 'vitest'
import { getAdvIcon, getAdvIconComponent } from '../src/utils/icon'

describe('图标解析', () => {
  it('getAdvIcon — 有效名称返回 VNode', () => {
    const vnode = getAdvIcon('Plus', 16)
    expect(vnode).not.toBeNull()
  })

  it('getAdvIcon — 空名称返回 null', () => {
    expect(getAdvIcon('')).toBeNull()
  })

  it('getAdvIcon — 尝试 Outlined 后缀回退', () => {
    // Home 在 @ant-design/icons-vue 中是 HomeOutlined
    const vnode = getAdvIcon('Home')
    expect(vnode).not.toBeNull()
  })

  it('getAdvIcon — 未知名称返回 null', () => {
    const vnode = getAdvIcon('NonExistentIconXYZ')
    expect(vnode).toBeNull()
  })
})

describe('getAdvIconComponent', () => {
  it('EP 图标名（映射表）→ 返回组件（函数或对象）', () => {
    const component = getAdvIconComponent('Plus')
    expect(component).toBeDefined()
    // @ant-design/icons-vue 导出的是函数式组件（typeof === 'function'）
    expect(['function', 'object']).toContain(typeof component)
  })

  it('直接 ADV 图标名（PlusOutlined）→ 返回组件', () => {
    const component = getAdvIconComponent('PlusOutlined')
    expect(component).toBeDefined()
  })

  it('Home → 通过 ICON_NAME_MAP 映射到 HomeOutlined', () => {
    const component = getAdvIconComponent('Home')
    expect(component).toBeDefined()
  })

  it('Outlined 后缀回退：iconName + "Outlined" 存在时返回组件', () => {
    // 'Smile' 不在 ICON_NAME_MAP，Icons.Smile 不存在，但 Icons.SmileOutlined 存在
    const component = getAdvIconComponent('Smile')
    expect(component).toBeDefined()
  })

  it('空字符串 → undefined', () => {
    expect(getAdvIconComponent('')).toBeUndefined()
  })

  it('未知图标名 → undefined', () => {
    expect(getAdvIconComponent('NonExistentIconXYZ123')).toBeUndefined()
  })

  it('与 getAdvIcon 返回同一组件类型', () => {
    // getAdvIcon 用 h(component) 创建 VNode，getAdvIconComponent 返回 component 本身
    const component = getAdvIconComponent('Delete')
    const vnode = getAdvIcon('Delete')
    expect(component).toBeDefined()
    expect(vnode).not.toBeNull()
    // VNode 的 type 应该就是 getAdvIconComponent 返回的组件
    expect(vnode!.type).toBe(component)
  })
})
