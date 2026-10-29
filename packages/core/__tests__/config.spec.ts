import { describe, it, expect, beforeEach } from 'vitest'
import {
  configureEsPlus,
  getGlobalConfig,
  resetGlobalConfig,
  resolveComponentConfig,
} from '../src/config'

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

/**
 * resolveComponentConfig —— 两条安装路径的**形状差**必须在这里被抹平。
 *
 * `app.use(EsPlus, { EsTable: { methods } })` 走 Plugin，`provide` 出去的是平的
 * `{ ...methods }`；`configureEsPlus` 只写单例，原样是 `{ methods: {...} }`。
 * 组件读取点是平键，不展平就是「配了等于没配」，且只有 configureEsPlus 这条路坏。
 */
describe('resolveComponentConfig', () => {
  beforeEach(() => resetGlobalConfig())

  it('展平 methods：`{ methods: { x } }` 与 `{ x }` 读到同一个键', () => {
    const fn = () => ({ total: 'total' })
    configureEsPlus({ EsTable: { methods: { configQueryFieldOutput: fn } } })
    const flat = resolveComponentConfig(getGlobalConfig(), 'EsTable')
    expect(flat.configQueryFieldOutput).toBe(fn)
    // methods 本身保留，读 `cfg.methods.x` 的旧代码不受影响
    expect((flat.methods as Record<string, unknown>).configQueryFieldOutput).toBe(fn)
  })

  it('同级平键与 methods 混写时都拿得到（methods 优先）', () => {
    const nested = () => 'nested'
    const flatFn = () => 'flat'
    configureEsPlus({
      EsForm: { size: 'small', fieldFieldOutput: flatFn, methods: { fieldFieldOutput: nested } },
    })
    const flat = resolveComponentConfig(getGlobalConfig(), 'EsForm')
    expect(flat.fieldFieldOutput).toBe(nested)
    expect(flat.size).toBe('small')
  })

  it('未配置 / 配置成非对象 → 空对象（组件侧不必再判空）', () => {
    expect(resolveComponentConfig(getGlobalConfig(), 'EsTable')).toEqual({})
    configureEsPlus({ EsTable: undefined })
    expect(resolveComponentConfig(getGlobalConfig(), 'EsTable')).toEqual({})
  })
})
