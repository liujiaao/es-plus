import { describe, it, expect, vi } from 'vitest'
import { buildFirstClassGridOptions } from '../src/engines/use-vxe-grid-config'

describe('buildFirstClassGridOptions — 合计行', () => {
  it('showFooter:true → result.showFooter = true', () => {
    const result = buildFirstClassGridOptions({ showFooter: true })
    expect(result.showFooter).toBe(true)
  })

  it('showFooter:true + footerMethod → 包装后的函数透传调用', () => {
    const fn = vi.fn(() => [[]])
    const result = buildFirstClassGridOptions({ showFooter: true, footerMethod: fn })
    expect(typeof result.footerMethod).toBe('function')
    const params = { columns: [], data: [] }
    ;(result.footerMethod as (p: unknown) => unknown)(params)
    expect(fn).toHaveBeenCalledWith(params)
  })

  it('showFooter:true + footerData → footerData 直传', () => {
    const data = [['合计', 100, 200]]
    const result = buildFirstClassGridOptions({ showFooter: true, footerData: data })
    expect(result.footerData).toBe(data)
  })

  it('showFooter 未设置 → 不输出 showFooter', () => {
    const result = buildFirstClassGridOptions({})
    expect(result).not.toHaveProperty('showFooter')
  })

  it('showFooter:true 且无 footerMethod/footerData → 只输出 showFooter', () => {
    const result = buildFirstClassGridOptions({ showFooter: true })
    expect(result).not.toHaveProperty('footerMethod')
    expect(result).not.toHaveProperty('footerData')
  })
})

describe('buildFirstClassGridOptions — 行内编辑', () => {
  it('editConfig → result.editConfig 直传', () => {
    const config = { trigger: 'click', mode: 'row', showStatus: true }
    const result = buildFirstClassGridOptions({ editConfig: config })
    expect(result.editConfig).toBe(config)
  })

  it('未设置 editConfig → 不输出 editConfig', () => {
    const result = buildFirstClassGridOptions({})
    expect(result).not.toHaveProperty('editConfig')
  })
})

describe('buildFirstClassGridOptions — Excel / CSV 导出', () => {
  it('exportConfig:true → result.exportConfig = {}', () => {
    const result = buildFirstClassGridOptions({ exportConfig: true })
    expect(result.exportConfig).toEqual({})
  })

  it('exportConfig 对象 → 直传', () => {
    const config = { filename: '财务报表', type: 'xlsx', useStyle: true }
    const result = buildFirstClassGridOptions({ exportConfig: config })
    expect(result.exportConfig).toBe(config)
  })

  it('未设置 exportConfig → 不输出 exportConfig', () => {
    const result = buildFirstClassGridOptions({})
    expect(result).not.toHaveProperty('exportConfig')
  })
})

describe('buildFirstClassGridOptions — 工具栏', () => {
  it('toolbarConfig:true → { export: true, refresh: true, custom: true }', () => {
    const result = buildFirstClassGridOptions({ toolbarConfig: true })
    expect(result.toolbarConfig).toEqual({ export: true, refresh: true, custom: true })
  })

  it('toolbarConfig 对象 → 直传', () => {
    const config = { export: true, zoom: true, custom: false }
    const result = buildFirstClassGridOptions({ toolbarConfig: config })
    expect(result.toolbarConfig).toBe(config)
  })

  it('未设置 toolbarConfig → 不输出 toolbarConfig', () => {
    const result = buildFirstClassGridOptions({})
    expect(result).not.toHaveProperty('toolbarConfig')
  })
})

describe('buildFirstClassGridOptions — 列宽 / 键盘 / 鼠标 / 剪贴板 / 校验', () => {
  it('columnConfig → 浅拷贝输出（不影响原对象）', () => {
    const config = { resizable: true, minResizableWidth: 60 }
    const result = buildFirstClassGridOptions({ columnConfig: config })
    expect(result.columnConfig).toEqual(config)
    expect(result.columnConfig).not.toBe(config)
  })

  it('keyboardConfig / mouseConfig / clipboardConfig / validConfig → 引用直传', () => {
    const kb = { isArrow: true, isTab: true }
    const mc = { selected: true }
    const cb = { isCopy: true, isPaste: true }
    const vc = { message: 'tooltip', autoPos: true }
    const result = buildFirstClassGridOptions({
      keyboardConfig: kb,
      mouseConfig: mc,
      clipboardConfig: cb,
      validConfig: vc,
    })
    expect(result.keyboardConfig).toBe(kb)
    expect(result.mouseConfig).toBe(mc)
    expect(result.clipboardConfig).toBe(cb)
    expect(result.validConfig).toBe(vc)
  })

  it('全部未设置 → 输出对象为空', () => {
    const result = buildFirstClassGridOptions({})
    expect(Object.keys(result)).toHaveLength(0)
  })
})
