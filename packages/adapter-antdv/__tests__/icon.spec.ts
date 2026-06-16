/**
 * 图标适配测试
 */
import { describe, it, expect } from 'vitest'
import { getAdvIcon, resolveIcon } from '../src/utils/icon'

describe('图标解析', () => {
  it('resolveIcon — 已知 EP 图标映射到 ADV 名称', () => {
    expect(resolveIcon('ArrowDown')).toBe('DownOutlined')
    expect(resolveIcon('ArrowUp')).toBe('UpOutlined')
    expect(resolveIcon('Plus')).toBe('PlusOutlined')
    expect(resolveIcon('Close')).toBe('CloseOutlined')
    expect(resolveIcon('Search')).toBe('SearchOutlined')
    expect(resolveIcon('Edit')).toBe('EditOutlined')
    expect(resolveIcon('Delete')).toBe('DeleteOutlined')
    expect(resolveIcon('View')).toBe('EyeOutlined')
    expect(resolveIcon('CopyDocument')).toBe('CopyOutlined')
    expect(resolveIcon('FullScreen')).toBe('FullscreenOutlined')
    expect(resolveIcon('Warning')).toBe('WarningOutlined')
    expect(resolveIcon('Refresh')).toBe('ReloadOutlined')
    expect(resolveIcon('Download')).toBe('DownloadOutlined')
    expect(resolveIcon('Upload')).toBe('UploadOutlined')
  })

  it('resolveIcon — 未知图标返回原名', () => {
    expect(resolveIcon('CustomIcon')).toBe('CustomIcon')
    expect(resolveIcon('')).toBe('')
  })

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
