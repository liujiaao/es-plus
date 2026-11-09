/**
 * P0-1：vxe-only 键的引擎路由告警。
 *
 * 修前 `capabilityWarnings` 只对 `none` 发声；`partial`（仅 vxe 生效）的 11 个键
 * 配在默认 / 虚拟引擎上时运行时静默忽略，零提示。修后：条目带 `requires.engine`，
 * 调用方传入已解析引擎，不匹配即告警；匹配则不告警（不刷屏）。
 *
 * `exportConfig` 刻意不在其中：默认引擎用它驱动 CSV 兜底，不是「被忽略」。
 */
import { describe, it, expect } from 'vitest'
import { CAPABILITIES, capabilityWarnings } from '../src/capability'
import { generateFromConfig } from '../src/structured-generator'

const VXE_ONLY = [
  'editConfig', 'showFooter', 'footerData', 'toolbarConfig', 'columnConfig',
  'keepSource', 'keyboardConfig', 'mouseConfig', 'validConfig', 'seqConfig', 'printConfig',
]

describe('capabilityWarnings — requires.engine', () => {
  it('11 个 vxe-only 键都登记了 requires.engine = vxe，且没有多登记', () => {
    for (const k of VXE_ONLY) {
      const entry = CAPABILITIES.find(e => e.key === `tableOptions.${k}`)
      expect(entry, k).toBeDefined()
      expect(entry!.requires?.engine, k).toBe('vxe')
    }
    const registered = CAPABILITIES.filter(e => e.requires?.engine === 'vxe').map(e => e.key).sort()
    expect(registered).toEqual(VXE_ONLY.map(k => `tableOptions.${k}`).sort())
  })

  it('exportConfig 在默认引擎上不告警（CSV 兜底在用它）', () => {
    const warnings = capabilityWarnings('vue3', { tableOptions: { exportConfig: { filename: 'x' } } }, 'default')
    expect(warnings.filter(w => w.includes('exportConfig'))).toEqual([])
  })

  it.each(VXE_ONLY)('默认引擎配了 %s → 告警点名该键', (k) => {
    const value = k === 'footerData' ? [['合计']] : k === 'showFooter' || k === 'keepSource' ? true : {}
    const warnings = capabilityWarnings('vue3', { tableOptions: { [k]: value } }, 'default')
    expect(warnings.some(w => w.includes(`tableOptions.${k}`) && w.includes("engine:'vxe'"))).toBe(true)
  })

  it('engine 为 vxe 时不告警', () => {
    const warnings = capabilityWarnings(
      'vue3',
      { tableOptions: { engine: 'vxe', editConfig: {}, toolbarConfig: true } },
      'vxe',
    )
    expect(warnings.filter(w => w.includes("engine:'vxe'"))).toEqual([])
  })

  it('未传 resolvedEngine 时保持旧行为（只报 none）', () => {
    const warnings = capabilityWarnings('vue3', { tableOptions: { editConfig: {} } })
    expect(warnings).toEqual([])
  })

  it('none 级告警不受影响（vue2 + virtual）', () => {
    const warnings = capabilityWarnings('vue2', { tableOptions: { virtual: true } }, 'virtual')
    expect(warnings.some(w => w.includes('tableOptions.virtual') && w.includes('not supported'))).toBe(true)
  })

  it('生成器端到端：默认引擎 + toolbarConfig 产出告警', () => {
    const result = generateFromConfig({
      name: 'Demo',
      apiUrl: '/api/demo',
      fields: [{ prop: 'name', label: '名称', formtype: 'Input' }],
      actions: ['view'],
      tableOptions: { toolbarConfig: { refresh: true } },
    } as never)
    expect(result.warnings.some(w => w.includes('tableOptions.toolbarConfig'))).toBe(true)
  })
})
