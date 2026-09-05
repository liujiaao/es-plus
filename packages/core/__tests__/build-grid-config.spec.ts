/**
 * buildFirstClassGridOptions — 来自 @es-plus/core（src/vxe-engine/build-grid-config.ts）
 *
 * 本文件测试的是 core 包的实际源文件，不是 vue3 包的副本。
 * 补充了 vue3 版本测试未覆盖的 treeConfig / proxyConfig / expandConfig / seqConfig 字段。
 */
import { describe, it, expect, vi } from 'vitest'
import { buildFirstClassGridOptions } from '../src/vxe-engine/build-grid-config'

// ─── 合计行 ─────────────────────────────────────────────────────────────────

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

  it('showFooter:true + footerData → footerData 直传（引用相同）', () => {
    const data = [['合计', 100, 200]]
    const result = buildFirstClassGridOptions({ showFooter: true, footerData: data })
    expect(result.footerData).toBe(data)
  })

  it('showFooter 未设置 → 不输出 showFooter', () => {
    const result = buildFirstClassGridOptions({})
    expect(result).not.toHaveProperty('showFooter')
  })

  it('showFooter:true 但无 footerMethod/footerData → 只输出 showFooter', () => {
    const result = buildFirstClassGridOptions({ showFooter: true })
    expect(result).not.toHaveProperty('footerMethod')
    expect(result).not.toHaveProperty('footerData')
  })
})

// ─── 行内编辑 ────────────────────────────────────────────────────────────────

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

// ─── Excel / CSV 导出 ────────────────────────────────────────────────────────

describe('buildFirstClassGridOptions — Excel/CSV 导出', () => {
  it('exportConfig:true → result.exportConfig = {}', () => {
    const result = buildFirstClassGridOptions({ exportConfig: true })
    expect(result.exportConfig).toEqual({})
  })

  it('exportConfig 对象 → 直传（引用相同）', () => {
    const config = { filename: '财务报表', type: 'xlsx' }
    const result = buildFirstClassGridOptions({ exportConfig: config })
    expect(result.exportConfig).toBe(config)
  })

  it('未设置 exportConfig → 不输出 exportConfig', () => {
    const result = buildFirstClassGridOptions({})
    expect(result).not.toHaveProperty('exportConfig')
  })
})

// ─── 工具栏 ──────────────────────────────────────────────────────────────────

describe('buildFirstClassGridOptions — 工具栏', () => {
  it('toolbarConfig:true → { export:true, refresh:true, custom:true }', () => {
    const result = buildFirstClassGridOptions({ toolbarConfig: true })
    expect(result.toolbarConfig).toEqual({ export: true, refresh: true, custom: true })
  })

  it('toolbarConfig 对象 → 直传', () => {
    const config = { export: true, zoom: true }
    const result = buildFirstClassGridOptions({ toolbarConfig: config })
    expect(result.toolbarConfig).toBe(config)
  })

  it('未设置 toolbarConfig → 不输出 toolbarConfig', () => {
    const result = buildFirstClassGridOptions({})
    expect(result).not.toHaveProperty('toolbarConfig')
  })
})

// ─── 列宽 / 键盘 / 鼠标 / 剪贴板 / 校验 ──────────────────────────────────

describe('buildFirstClassGridOptions — 列宽/键盘/鼠标/剪贴板/校验', () => {
  it('columnConfig → 浅拷贝输出（不是原始引用，但内容相同）', () => {
    const config = { resizable: true, minResizableWidth: 60 }
    const result = buildFirstClassGridOptions({ columnConfig: config })
    expect(result.columnConfig).toEqual(config)
    expect(result.columnConfig).not.toBe(config)
  })

  it('columnConfig 为 null → 不输出（null 不是 object）', () => {
    const result = buildFirstClassGridOptions({ columnConfig: null })
    expect(result).not.toHaveProperty('columnConfig')
  })

  it('keyboardConfig → 引用直传', () => {
    const kb = { isArrow: true, isTab: true }
    const result = buildFirstClassGridOptions({ keyboardConfig: kb })
    expect(result.keyboardConfig).toBe(kb)
  })

  it('mouseConfig → 引用直传', () => {
    const mc = { selected: true }
    const result = buildFirstClassGridOptions({ mouseConfig: mc })
    expect(result.mouseConfig).toBe(mc)
  })

  it('clipboardConfig → 引用直传', () => {
    const cb = { isCopy: true, isPaste: true }
    const result = buildFirstClassGridOptions({ clipboardConfig: cb })
    expect(result.clipboardConfig).toBe(cb)
  })

  it('validConfig → 引用直传', () => {
    const vc = { message: 'tooltip', autoPos: true }
    const result = buildFirstClassGridOptions({ validConfig: vc })
    expect(result.validConfig).toBe(vc)
  })

  it('全部未设置 → 输出对象为空', () => {
    const result = buildFirstClassGridOptions({})
    expect(Object.keys(result)).toHaveLength(0)
  })
})

// ─── treeConfig（P0 补充：core 版特有字段，vue3 副本测试未覆盖）────────────

describe('buildFirstClassGridOptions — treeConfig', () => {
  it('treeConfig → 引用直传', () => {
    const cfg = { transform: true, rowField: 'id', parentField: 'parentId' }
    const result = buildFirstClassGridOptions({ treeConfig: cfg })
    expect(result.treeConfig).toBe(cfg)
  })

  it('treeConfig 不存在时不输出', () => {
    const result = buildFirstClassGridOptions({})
    expect(result).not.toHaveProperty('treeConfig')
  })

  it('treeConfig 存在于输出中（与其他字段同时存在不互相干扰）', () => {
    const cfg = { transform: true }
    const result = buildFirstClassGridOptions({ treeConfig: cfg, showFooter: true })
    expect(result.treeConfig).toBe(cfg)
    expect(result.showFooter).toBe(true)
  })
})

// ─── proxyConfig（P0 补充）────────────────────────────────────────────────

describe('buildFirstClassGridOptions — proxyConfig', () => {
  it('proxyConfig → 引用直传', () => {
    const cfg = {
      seq: true,
      ajax: {
        query: ({ page }: any) => fetch(`/api?page=${page.currentPage}`),
      },
    }
    const result = buildFirstClassGridOptions({ proxyConfig: cfg })
    expect(result.proxyConfig).toBe(cfg)
  })

  it('proxyConfig 不存在时不输出', () => {
    const result = buildFirstClassGridOptions({})
    expect(result).not.toHaveProperty('proxyConfig')
  })

  it('proxyConfig 和 showFooter 同时存在互不干扰', () => {
    const cfg = { seq: true, ajax: { query: vi.fn() } }
    const result = buildFirstClassGridOptions({ proxyConfig: cfg, showFooter: true })
    expect(result.proxyConfig).toBe(cfg)
    expect(result.showFooter).toBe(true)
  })
})

// ─── expandConfig（P0 补充）──────────────────────────────────────────────

describe('buildFirstClassGridOptions — expandConfig', () => {
  it('expandConfig → 引用直传', () => {
    const cfg = { trigger: 'row', lazy: true }
    const result = buildFirstClassGridOptions({ expandConfig: cfg })
    expect(result.expandConfig).toBe(cfg)
  })

  it('expandConfig 不存在时不输出', () => {
    const result = buildFirstClassGridOptions({})
    expect(result).not.toHaveProperty('expandConfig')
  })
})

// ─── seqConfig（P0 补充）──────────────────────────────────────────────────

describe('buildFirstClassGridOptions — seqConfig', () => {
  it('seqConfig → 引用直传', () => {
    const cfg = { startIndex: 10 }
    const result = buildFirstClassGridOptions({ seqConfig: cfg })
    expect(result.seqConfig).toBe(cfg)
  })

  it('seqConfig 不存在时不输出', () => {
    const result = buildFirstClassGridOptions({})
    expect(result).not.toHaveProperty('seqConfig')
  })

  it('seqConfig + snIndex:true 同时传入：seqConfig 直传', () => {
    const cfg = { startIndex: 5, seqMethod: vi.fn() }
    const result = buildFirstClassGridOptions({ seqConfig: cfg, snIndex: true })
    expect(result.seqConfig).toBe(cfg)
  })
})

// ─── 综合：所有一等公民字段同时传入 ──────────────────────────────────────

describe('buildFirstClassGridOptions — 全量字段综合', () => {
  it('treeConfig + proxyConfig + expandConfig + seqConfig 同时传入互不干扰', () => {
    const tree = { transform: true }
    const proxy = { seq: true, ajax: { query: vi.fn() } }
    const expand = { trigger: 'row' }
    const seq = { startIndex: 1 }

    const result = buildFirstClassGridOptions({
      treeConfig: tree,
      proxyConfig: proxy,
      expandConfig: expand,
      seqConfig: seq,
    })

    expect(result.treeConfig).toBe(tree)
    expect(result.proxyConfig).toBe(proxy)
    expect(result.expandConfig).toBe(expand)
    expect(result.seqConfig).toBe(seq)
  })

  it('vxeConfig 逃生舱字段不在输出中（buildFirstClassGridOptions 不处理 vxeConfig）', () => {
    const result = buildFirstClassGridOptions({ vxeConfig: { customField: 'abc' } })
    expect(result).not.toHaveProperty('vxeConfig')
  })
})
