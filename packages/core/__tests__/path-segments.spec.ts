import { describe, it, expect } from 'vitest'
import { parsePathSegments, getNestedValue, setNestedValue } from '../src/shared'

// 字段路径单源分词器：读取 / 写入 / 各渲染器转 name path 都必须支持
// 点号与方括号两种写法（schema 明确支持 'a[0].b'）。
describe('shared > parsePathSegments', () => {
  it('点号路径', () => {
    expect(parsePathSegments('user.name')).toEqual(['user', 'name'])
  })

  it('方括号路径', () => {
    expect(parsePathSegments('a[0].b')).toEqual(['a', '0', 'b'])
    expect(parsePathSegments('list[2].items[1].id')).toEqual(['list', '2', 'items', '1', 'id'])
  })

  it('单层路径', () => {
    expect(parsePathSegments('name')).toEqual(['name'])
  })

  it('空串 → []', () => {
    expect(parsePathSegments('')).toEqual([])
  })

  it('与 getNestedValue 的分词一致（方括号可取到数组元素）', () => {
    expect(getNestedValue({ a: [{ b: 'x' }] }, 'a[0].b')).toBe('x')
  })

  it('与 setNestedValue 的分词一致（方括号可写入数组外层的对象层）', () => {
    const obj: Record<string, unknown> = {}
    setNestedValue(obj, 'a[0].b', 'v')
    expect((obj as { a: Record<string, unknown>[] }).a[0].b).toBe('v')
  })

  it('缺失中间层按下一段是否为数字索引建数组/对象（数字段 → 真数组）', () => {
    // 回归：setNestedValue 曾一律建普通对象 → tags 变成 { '0': {...} } 伪数组，
    // 读回侥幸可用但 Array.isArray / .map / JSON 提交全部错位。
    const obj: Record<string, unknown> = {}
    setNestedValue(obj, 'tags[0].name', 'x')
    expect(Array.isArray((obj as { tags: unknown }).tags)).toBe(true)
    expect(obj).toEqual({ tags: [{ name: 'x' }] })
    expect(JSON.stringify(obj)).toBe('{"tags":[{"name":"x"}]}')
  })

  it('多层数组索引（a[0].b[1].c）各层容器类型正确', () => {
    const obj: Record<string, unknown> = {}
    setNestedValue(obj, 'a[0].b[1].c', 'v')
    const a = (obj as { a: Array<{ b: unknown[] }> }).a
    expect(Array.isArray(a)).toBe(true)
    expect(Array.isArray(a[0].b)).toBe(true)
    expect(a[0].b[1]).toEqual({ c: 'v' })
  })

  it('非数字中间段仍建普通对象（不误判为数组）', () => {
    const obj: Record<string, unknown> = {}
    setNestedValue(obj, 'user.profile.name', 'n')
    expect(Array.isArray((obj as { user: unknown }).user)).toBe(false)
    expect(obj).toEqual({ user: { profile: { name: 'n' } } })
  })

  it('已存在的容器不被覆盖（预置数组保持数组）', () => {
    const obj: Record<string, unknown> = { list: [{ id: 1 }] }
    setNestedValue(obj, 'list[1].id', 2)
    expect(Array.isArray((obj as { list: unknown }).list)).toBe(true)
    expect((obj as { list: Array<{ id: number }> }).list[1]).toEqual({ id: 2 })
  })
})
