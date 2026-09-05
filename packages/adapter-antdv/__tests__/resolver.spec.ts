import { describe, it, expect } from 'vitest'
import { EsPlusResolver } from '../src/resolver'

describe('EsPlusResolver (adapter-antdv)', () => {
  it('返回含 type:"component" 的对象', () => {
    const resolver = EsPlusResolver()
    expect(resolver.type).toBe('component')
  })

  // ─── resolve —— 已知组件 ───────────────────────────────────────────────
  it.each(['EsTable', 'EsForm', 'EsDialog', 'EsCrudPage', 'SvgIcon'])(
    'resolve("%s") 返回正确 from 路径',
    (name) => {
      const resolver = EsPlusResolver()
      const result = resolver.resolve(name)
      expect(result).toBeDefined()
      expect(result!.name).toBe(name)
      expect(result!.from).toBe('@es-plus/adapter-antdv')
    }
  )

  it('resolve 未知组件名 → 返回 undefined', () => {
    const resolver = EsPlusResolver()
    expect(resolver.resolve('ElButton')).toBeUndefined()
    expect(resolver.resolve('ATable')).toBeUndefined()
  })

  // ─── sideEffects —— 默认选项（不注入 antd 样式）─────────────────────
  it('默认选项：sideEffects 只含 es-plus 样式（无 antd reset）', () => {
    const resolver = EsPlusResolver()
    const result = resolver.resolve('EsTable')!
    const effects = result.sideEffects as string[]
    expect(effects).toHaveLength(1)
    expect(effects[0]).toBe('@es-plus/adapter-antdv/dist/style.css')
  })

  it('importAntdStyles:false（默认）→ sideEffects 只含一项', () => {
    const resolver = EsPlusResolver({ importAntdStyles: false })
    const result = resolver.resolve('EsForm')!
    const effects = result.sideEffects as string[]
    expect(effects).toHaveLength(1)
  })

  it('importAntdStyles:true → sideEffects 包含 ant-design-vue/dist/reset.css', () => {
    const resolver = EsPlusResolver({ importAntdStyles: true })
    const result = resolver.resolve('EsTable')!
    const effects = result.sideEffects as string[]
    expect(effects).toHaveLength(2)
    expect(effects).toContain('@es-plus/adapter-antdv/dist/style.css')
    expect(effects).toContain('ant-design-vue/dist/reset.css')
  })

  // ─── sideEffects 惰性初始化 ────────────────────────────────────────────
  it('多次 resolve → 返回相同 sideEffects 引用（惰性初始化只执行一次）', () => {
    const resolver = EsPlusResolver()
    const r1 = resolver.resolve('EsTable')!
    const r2 = resolver.resolve('EsForm')!
    expect(r1.sideEffects).toBe(r2.sideEffects)
  })

  it('两个不同配置的 resolver 实例拥有独立的 sideEffects', () => {
    const r1 = EsPlusResolver({ importAntdStyles: false })
    const r2 = EsPlusResolver({ importAntdStyles: true })
    const effects1 = r1.resolve('EsTable')!.sideEffects as string[]
    const effects2 = r2.resolve('EsTable')!.sideEffects as string[]
    expect(effects1).toHaveLength(1)
    expect(effects2).toHaveLength(2)
  })
})
