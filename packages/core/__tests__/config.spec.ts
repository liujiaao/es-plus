import { describe, it, expect, beforeEach } from 'vitest'
import {
  configureEsPlus,
  getGlobalConfig,
  resetGlobalConfig,
  resolveComponentConfig,
  normalizeSectionConfig,
  resolveConfigProvider,
  resolveFieldOutputProvider,
  createComponentConfigView,
  resolveComponentDefaults,
  mergeComponentDefaults,
  mergeLayoutFormProps,
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
    const nested = (d: Record<string, string>) => ({ ...d, list: 'rows' })
    const flatFn = (d: Record<string, string>) => ({ ...d, list: 'data' })
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

/**
 * 写入时归一：单例里**永远只有一种形状**。
 *
 * 此前同一件事在三处各写一遍 —— vue2 的 normalizeLegacyOptions、core 的
 * `resolveHttpRequest` 三路键位、`resolveComponentConfig` 再展平一次。任一处漏改，
 * 就是「某种写法配了等于没配」。归一到 configureEsPlus 的写入点后，读点只面对一个形状。
 */
describe('normalizeSectionConfig / configureEsPlus 写入归一', () => {
  beforeEach(() => resetGlobalConfig())

  it('展平 methods，且 methods 内的键优先', () => {
    const nested = () => ({})
    const flat = () => ({})
    const out = normalizeSectionConfig({ size: 'small', httpRequest: flat, methods: { httpRequest: nested } })
    expect(out?.httpRequest).toBe(nested)
    expect(out?.size).toBe('small')
    // 原 methods 保留：读 `cfg.methods.x` 的旧代码不受影响
    expect((out?.methods as Record<string, unknown>).httpRequest).toBe(nested)
  })

  it('剥掉 $ 前缀补出规范名，原键保留，显式规范名优先', () => {
    const legacy = () => ({})
    const canonical = () => ({})
    const out = normalizeSectionConfig({ $httpRequest: legacy })
    expect(out?.httpRequest).toBe(legacy)
    expect(out?.$httpRequest).toBe(legacy)

    const preferred = normalizeSectionConfig({ $httpRequest: legacy, httpRequest: canonical })
    expect(preferred?.httpRequest).toBe(canonical)
  })

  it('configQueryfieldOutput（小写 f）改名为 configQueryFieldOutput', () => {
    const fn = () => ({})
    expect(normalizeSectionConfig({ configQueryfieldOutput: fn })?.configQueryFieldOutput).toBe(fn)
  })

  it('configureEsPlus 写入后就已是扁平形状（不必等读点再展平）', () => {
    const fn = () => ({})
    configureEsPlus({ EsTable: { methods: { $httpRequest: fn, configQueryfieldOutput: fn } } })
    const section = getGlobalConfig().EsTable as Record<string, unknown>
    expect(section.httpRequest).toBe(fn)
    expect(section.configQueryFieldOutput).toBe(fn)
  })
})

describe('resolveConfigProvider（字面量 / 工厂 / 未配置）', () => {
  it('字面量原样返回，工厂取时求值，undefined 原样返回', () => {
    expect(resolveConfigProvider({ layout: 'x' })).toEqual({ layout: 'x' })
    expect(resolveConfigProvider(() => ({ layout: 'y' }))).toEqual({ layout: 'y' })
    expect(resolveConfigProvider(undefined)).toBeUndefined()
  })
})

describe('resolveFieldOutputProvider（字段映射的两种写法等价）', () => {
  const defaults = { total: 'total', pageSize: 'pageSize', current: 'current', listData: 'list' }

  it('函数形态原样返回', () => {
    const fn = (d: Record<string, string>) => ({ ...d, listData: 'rows' })
    expect(resolveFieldOutputProvider(fn)).toBe(fn)
  })

  it('字面量形态叠加在默认映射之上（只换写到的键）', () => {
    const fn = resolveFieldOutputProvider({ listData: 'items' })
    expect(fn?.(defaults)).toEqual({ ...defaults, listData: 'items' })
  })

  it('未配置 → undefined（调用方不必再判空）', () => {
    expect(resolveFieldOutputProvider(undefined)).toBeUndefined()
  })
})

/**
 * 组件档的 provide 视图必须**读时透传单例**。
 *
 * 旧实现是 install 时的一次性快照 `{ ...options.methods }`，于是 install 之后再
 * `configureEsPlus({ EsTable })` 对组件完全无效 —— 只有「先配置再挂载」才生效，
 * 而且文档从未说过这个顺序约束。
 */
describe('createComponentConfigView（读时透传，不是快照）', () => {
  beforeEach(() => resetGlobalConfig())

  it('视图建好之后再 configureEsPlus，读得到新值', () => {
    const view = createComponentConfigView('EsTable', { useDialog: 'x' })
    expect(view.httpRequest).toBeUndefined()

    const fn = () => Promise.resolve()
    configureEsPlus({ EsTable: { httpRequest: fn } })
    expect(view.httpRequest).toBe(fn)
    // extras 优先，且不被单例覆盖
    expect(view.useDialog).toBe('x')
  })

  it('不串档：EsTable 的视图读不到 EsForm 的键', () => {
    const view = createComponentConfigView('EsTable')
    configureEsPlus({ EsForm: { rules: { a: [] } } })
    expect(view.rules).toBeUndefined()
  })
})

describe('defaults 合并', () => {
  beforeEach(() => resetGlobalConfig())

  it('resolveComponentDefaults 只在配置了 defaults 时返回值', () => {
    expect(resolveComponentDefaults(getGlobalConfig(), 'EsTable')).toBeUndefined()
    configureEsPlus({ EsTable: { defaults: { size: 'small' } } })
    expect(resolveComponentDefaults(getGlobalConfig(), 'EsTable')).toEqual({ size: 'small' })
  })

  it('mergeComponentDefaults：实例键优先；无 defaults 时返回同一引用', () => {
    const instance = { border: false }
    expect(mergeComponentDefaults(undefined, instance)).toBe(instance)
    expect(mergeComponentDefaults({ size: 'small', border: true }, instance)).toEqual({
      size: 'small',
      border: false,
    })
  })

  it('mergeLayoutFormProps：formLayProps 里的键逐键合并（实例只给一个键也不挤掉默认）', () => {
    const merged = mergeLayoutFormProps(
      { formLayProps: { labelWidth: '96px', minFoldRows: 2 } },
      { formLayProps: { labelPosition: 'top' } }
    )
    expect(merged.formLayProps).toEqual({
      labelWidth: '96px',
      minFoldRows: 2,
      labelPosition: 'top',
    })
  })

  it('mergeLayoutFormProps：兼容旧拼写 fromLayProps 作为默认来源', () => {
    const merged = mergeLayoutFormProps({ fromLayProps: { labelWidth: '80px' } }, {})
    expect(merged.formLayProps).toEqual({ labelWidth: '80px' })
  })
})
