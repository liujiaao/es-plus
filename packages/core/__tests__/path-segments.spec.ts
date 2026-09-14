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
})
