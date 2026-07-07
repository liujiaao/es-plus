/**
 * 图标适配测试
 */
import { describe, it, expect } from 'vitest'
import { getAdvIcon } from '../src/utils/icon'

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
