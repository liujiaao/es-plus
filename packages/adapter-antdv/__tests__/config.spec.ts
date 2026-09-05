/**
 * adapter-antdv config.ts 单元测试
 *
 * config.ts 是从 @es-plus/core 的透传 re-export：
 *   export { getGlobalConfig, configureEsPlus, resetGlobalConfig } from '@es-plus/core'
 *
 * 测试目标：
 *   1. 导出的函数引用与 core 一致（不是包装层）
 *   2. configureEsPlus + getGlobalConfig 的读写语义正确
 *   3. resetGlobalConfig 清除配置
 *   4. $httpRequest / permission / t 等全局属性正常传递
 */
import { describe, it, expect, vi, beforeEach } from 'vitest'
import { getGlobalConfig, configureEsPlus, resetGlobalConfig } from '../src/config'
import {
  getGlobalConfig as coreGetGlobalConfig,
  configureEsPlus as coreConfigure,
} from '@es-plus/core'

beforeEach(() => {
  resetGlobalConfig()
})

// ─── 1. 导出一致性 ───────────────────────────────────────────────────────

describe('config.ts — 导出引用一致性', () => {
  it('getGlobalConfig 与 core 导出的是同一引用', () => {
    expect(getGlobalConfig).toBe(coreGetGlobalConfig)
  })

  it('configureEsPlus 与 core 导出的是同一引用', () => {
    expect(configureEsPlus).toBe(coreConfigure)
  })
})

// ─── 2. configureEsPlus + getGlobalConfig 读写 ───────────────────────────

describe('config.ts — configureEsPlus / getGlobalConfig', () => {
  it('初始 getGlobalConfig() 返回对象', () => {
    const config = getGlobalConfig()
    expect(config).toBeDefined()
    expect(typeof config).toBe('object')
  })

  it('configureEsPlus 注入 $httpRequest → getGlobalConfig 能读到', () => {
    const httpFn = vi.fn()
    configureEsPlus({ $httpRequest: httpFn } as any)
    const config = getGlobalConfig()
    expect((config as any).$httpRequest).toBe(httpFn)
  })

  it('configureEsPlus 注入 permission → getGlobalConfig 能读到', () => {
    const permFn = vi.fn(() => true)
    configureEsPlus({ permission: permFn } as any)
    const config = getGlobalConfig()
    expect((config as any).permission).toBe(permFn)
  })

  it('configureEsPlus 注入 t (i18n) → getGlobalConfig 能读到', () => {
    const tFn = (key: string) => `[${key}]`
    configureEsPlus({ t: tFn } as any)
    const config = getGlobalConfig()
    expect((config as any).t).toBe(tFn)
  })

  it('多次 configureEsPlus → 后者覆盖同名属性', () => {
    const fn1 = vi.fn()
    const fn2 = vi.fn()
    configureEsPlus({ $httpRequest: fn1 } as any)
    configureEsPlus({ $httpRequest: fn2 } as any)
    const config = getGlobalConfig()
    expect((config as any).$httpRequest).toBe(fn2)
  })

  it('不同属性多次 configureEsPlus → 合并保留（深合并语义）', () => {
    const httpFn = vi.fn()
    const permFn = vi.fn(() => true)
    configureEsPlus({ $httpRequest: httpFn } as any)
    configureEsPlus({ permission: permFn } as any)
    const config = getGlobalConfig()
    expect((config as any).$httpRequest).toBe(httpFn)
    expect((config as any).permission).toBe(permFn)
  })
})

// ─── 3. resetGlobalConfig ────────────────────────────────────────────────

describe('config.ts — resetGlobalConfig', () => {
  it('resetGlobalConfig 后 getGlobalConfig() 返回初始状态', () => {
    const httpFn = vi.fn()
    configureEsPlus({ $httpRequest: httpFn } as any)
    resetGlobalConfig()
    const config = getGlobalConfig()
    expect((config as any).$httpRequest).toBeUndefined()
  })

  it('resetGlobalConfig 后 permission 被清除', () => {
    configureEsPlus({ permission: () => true } as any)
    resetGlobalConfig()
    const config = getGlobalConfig()
    expect((config as any).permission).toBeUndefined()
  })
})
