import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'
import type { MockInstance } from 'vitest'
import {
  VXE_ONLY_TABLE_KEYS,
  findVxeOnlyKeysOutsideVxe,
  warnVxeOnlyKeysOutsideVxe,
  __resetVxeOnlyWarnings,
} from '../src/table-engine-keys'

describe('table-engine-keys（P0-1 运行时告警）', () => {
  // 显式参数/返回类型：`ReturnType<typeof vi.spyOn>` 会落到默认泛型 `MockInstance<unknown[], unknown>`，
  // 与 console.warn 的实参签名不兼容（TS2322）。
  let warn: MockInstance<[message?: any, ...optionalParams: any[]], void>
  beforeEach(() => {
    __resetVxeOnlyWarnings()
    warn = vi.spyOn(console, 'warn').mockImplementation(() => {})
  })
  afterEach(() => warn.mockRestore())

  it('清单不含 exportConfig（默认引擎用它做 CSV 兜底，不是被忽略）', () => {
    expect(VXE_ONLY_TABLE_KEYS).not.toContain('exportConfig' as never)
    expect(VXE_ONLY_TABLE_KEYS).toContain('editConfig')
  })

  it('默认引擎设了 vxe-only 键 → 命中', () => {
    expect(findVxeOnlyKeysOutsideVxe({ editConfig: {}, toolbarConfig: true })).toEqual(['editConfig', 'toolbarConfig'])
  })

  it('engine 为 vxe → 不命中', () => {
    expect(findVxeOnlyKeysOutsideVxe({ engine: 'vxe', editConfig: {} })).toEqual([])
  })

  it('false / null / undefined 不算设置', () => {
    expect(findVxeOnlyKeysOutsideVxe({ showFooter: false, keepSource: null, editConfig: undefined })).toEqual([])
    expect(findVxeOnlyKeysOutsideVxe(undefined)).toEqual([])
  })

  it('告警点名键、渲染端与当前引擎，并给出修法', () => {
    warnVxeOnlyKeysOutsideVxe({ engine: 'virtual', keyboardConfig: {} }, 'vue3')
    expect(warn).toHaveBeenCalledTimes(1)
    const msg = String(warn.mock.calls[0][0])
    expect(msg).toContain('[es-plus/vue3]')
    expect(msg).toContain('options.keyboardConfig')
    expect(msg).toContain("'virtual'")
    expect(msg).toContain("engine: 'vxe'")
  })

  it('同一组合只告警一次（多张表 / 反复挂载不刷屏），不同组合各告一次', () => {
    warnVxeOnlyKeysOutsideVxe({ editConfig: {} }, 'antdv')
    warnVxeOnlyKeysOutsideVxe({ editConfig: {} }, 'antdv')
    expect(warn).toHaveBeenCalledTimes(1)
    warnVxeOnlyKeysOutsideVxe({ editConfig: {}, showFooter: true }, 'antdv')
    expect(warn).toHaveBeenCalledTimes(2)
  })

  it('没命中时不告警', () => {
    warnVxeOnlyKeysOutsideVxe({ border: true }, 'vue2')
    expect(warn).not.toHaveBeenCalled()
  })
})
