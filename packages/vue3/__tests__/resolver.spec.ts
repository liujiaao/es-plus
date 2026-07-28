import { describe, it, expect } from 'vitest'
import { EsPlusResolver } from '../src/resolver'

describe('EsPlusResolver', () => {
  it('返回含 type:"component" 的对象', () => {
    const resolver = EsPlusResolver()
    expect(resolver.type).toBe('component')
  })

  // ─── resolve —— 已知组件 ───────────────────────────────────────────────
  it.each(['EsTable', 'EsForm', 'EsDialog', 'EsCrudPage', 'SvgIcon'])(
    'resolve("%s") 返回正确的 from 路径',
    (name) => {
      const resolver = EsPlusResolver()
      const result = resolver.resolve(name)
      expect(result).toBeDefined()
      expect(result!.name).toBe(name)
      expect(result!.from).toBe('@es-plus/vue3')
    }
  )

  it('resolve 未知组件名 → 返回 undefined', () => {
    const resolver = EsPlusResolver()
    expect(resolver.resolve('UnknownComp')).toBeUndefined()
  })

  // ─── sideEffects —— 默认选项 ─────────────────────────────────────────
  it('默认选项：sideEffects 包含 es-plus 自身样式', () => {
    const resolver = EsPlusResolver()
    const result = resolver.resolve('EsTable')!
    expect(result.sideEffects).toContain('@es-plus/vue3/dist/style.css')
  })

  it('默认选项（importElementStyles 默认 true）：sideEffects 包含 element-plus 组件样式', () => {
    const resolver = EsPlusResolver()
    const result = resolver.resolve('EsForm')!
    const effects = result.sideEffects as string[]
    expect(effects.some(e => e.startsWith('element-plus/es/components/'))).toBe(true)
  })

  it('importElementStyles:false → sideEffects 只含 es-plus 样式（无 element-plus）', () => {
    const resolver = EsPlusResolver({ importElementStyles: false })
    const result = resolver.resolve('EsTable')!
    const effects = result.sideEffects as string[]
    expect(effects).toHaveLength(1)
    expect(effects[0]).toBe('@es-plus/vue3/dist/style.css')
  })

  it('importStyle:"sass" → sideEffects 使用 style/index 路径', () => {
    const resolver = EsPlusResolver({ importStyle: 'sass' })
    const result = resolver.resolve('EsTable')!
    const effects = result.sideEffects as string[]
    expect(effects.some(e => e.includes('/style/index'))).toBe(true)
    expect(effects.every(e => !e.includes('/style/css'))).toBe(true)
  })

  it('importStyle:"css"（默认）→ sideEffects 使用 style/css 路径', () => {
    const resolver = EsPlusResolver({ importStyle: 'css' })
    const result = resolver.resolve('EsForm')!
    const effects = result.sideEffects as string[]
    expect(effects.some(e => e.includes('/style/css'))).toBe(true)
  })

  // ─── sideEffects 惰性初始化（首次 resolve 时生成，之后复用） ──────────
  it('多次调用 resolve → 返回相同 sideEffects 引用（惰性初始化仅执行一次）', () => {
    const resolver = EsPlusResolver()
    const r1 = resolver.resolve('EsTable')!
    const r2 = resolver.resolve('EsForm')!
    expect(r1.sideEffects).toBe(r2.sideEffects)
  })
})
