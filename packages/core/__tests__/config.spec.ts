import { describe, it, expect, beforeEach } from 'vitest'
import { configureEsPlus, getGlobalConfig, resetGlobalConfig } from '../src/config'

describe('config', () => {
  beforeEach(() => resetGlobalConfig())

  it('初始为空对象', () => {
    expect(getGlobalConfig()).toEqual({})
  })

  it('configureEsPlus 浅合并', () => {
    configureEsPlus({ permission: () => true })
    configureEsPlus({ EsTable: { size: 'small' } })
    const cfg = getGlobalConfig()
    expect(typeof cfg.permission).toBe('function')
    expect(cfg.EsTable).toEqual({ size: 'small' })
  })

  it('后写入覆盖同名 key', () => {
    configureEsPlus({ EsForm: { width: 100 } })
    configureEsPlus({ EsForm: { height: 50 } })
    expect(getGlobalConfig().EsForm).toEqual({ height: 50 })
  })

  it('resetGlobalConfig 清空', () => {
    configureEsPlus({ permission: () => true })
    resetGlobalConfig()
    expect(getGlobalConfig()).toEqual({})
  })
})
