import { describe, it, expect, vi } from 'vitest'
import {
  checkQueryFields,
  configFormField,
  formatConfigOut,
  queryTableListMethod,
  DEFAULT_CONFIG_FORM_FIELD_OUT,
} from '../src/request'

describe('request > checkQueryFields', () => {
  it('字段齐全且非空字符串 → true', () => {
    expect(
      checkQueryFields({
        total: 'records',
        pageSize: 'pageSize',
        current: 'pageNo',
        listData: 'rows',
      })
    ).toBe(true)
  })

  it('缺少字段 → false', () => {
    expect(checkQueryFields({ total: 'records' })).toBe(false)
  })

  it('值为空字符串 → false', () => {
    expect(
      checkQueryFields({ total: '', pageSize: 'a', current: 'b', listData: 'c' })
    ).toBe(false)
  })

  it('非对象 → false', () => {
    expect(checkQueryFields(null)).toBe(false)
    expect(checkQueryFields([])).toBe(false)
  })
})

describe('request > configFormField', () => {
  it('默认值', () => {
    expect(configFormField()).toEqual(DEFAULT_CONFIG_FORM_FIELD_OUT)
  })

  it('用户配置 configFormOut 优先', () => {
    const r = configFormField({
      configFormOut: {
        total: 'count',
        pageSize: 'size',
        current: 'page',
        listData: 'items',
      },
    })
    expect(r.total).toBe('count')
    expect(r.listData).toBe('items')
  })

  it('注入函数 fieldFieldOutput 次优先', () => {
    const r = configFormField({}, (defaults) => ({
      ...defaults,
      total: 'overridden',
    }))
    expect(r.total).toBe('overridden')
  })

  it('校验失败的注入函数 → 降级默认', () => {
    const r = configFormField({}, () => ({ total: '' } as never))
    expect(r).toEqual(DEFAULT_CONFIG_FORM_FIELD_OUT)
  })
})

describe('request > formatConfigOut', () => {
  it('普通响应映射', () => {
    const r = formatConfigOut(
      { records: 10, rows: [{ id: 1 }] },
      ['total', 'listData']
    )
    expect(r.total).toBe(10)
    expect(r.listData).toEqual([{ id: 1 }])
  })

  it('数组响应直接作 listData', () => {
    const r = formatConfigOut([1, 2], ['listData'])
    expect(r.listData).toEqual([1, 2])
  })

  it('total 是字符串 → 解析为数字', () => {
    const r = formatConfigOut({ records: '42', rows: [] }, ['total', 'listData'])
    expect(r.total).toBe(42)
  })

  it('深嵌套 → 通过 findValueByKey 找到', () => {
    const r = formatConfigOut(
      { data: { records: 5, rows: [1] } },
      ['total', 'listData']
    )
    expect(r.total).toBe(5)
    expect(r.listData).toEqual([1])
  })

  it('listData 字段不是数组 → []', () => {
    const r = formatConfigOut({ rows: 'not-array' }, ['listData'])
    expect(r.listData).toEqual([])
  })
})

describe('request > queryTableListMethod', () => {
  it('apiParams.url 缺失 → 不发请求', () => {
    const fn = vi.fn().mockResolvedValue({})
    queryTableListMethod({}, { apiParams: { url: '' } }, fn)
    expect(fn).not.toHaveBeenCalled()
  })

  it('调用 success 回调（对象响应）', async () => {
    const fn = vi.fn().mockResolvedValue({ data: [1] })
    const success = vi.fn()
    queryTableListMethod(
      { keyword: 'q' },
      { apiParams: { url: '/api/list', method: 'POST' }, success },
      fn
    )
    await new Promise((r) => setTimeout(r, 0))
    expect(fn).toHaveBeenCalledTimes(1)
    const payload = fn.mock.calls[0][0] as Record<string, unknown>
    expect(payload.url).toBe('/api/list')
    expect(payload.method).toBe('POST')
    expect((payload.formParams as Record<string, unknown>).keyword).toBe('q')
    expect(success).toHaveBeenCalledWith({ data: [1] })
  })

  it('合并 apiParams.model 到 formParams', async () => {
    const fn = vi.fn().mockResolvedValue({})
    queryTableListMethod(
      { a: 1 },
      { apiParams: { url: '/x', model: { b: 2 } } },
      fn
    )
    await new Promise((r) => setTimeout(r, 0))
    const payload = fn.mock.calls[0][0] as Record<string, unknown>
    expect(payload.formParams).toEqual({ a: 1, b: 2 })
  })

  it('失败 → 调 fail 回调', async () => {
    const fn = vi.fn().mockRejectedValue(new Error('boom'))
    const fail = vi.fn()
    queryTableListMethod({}, { apiParams: { url: '/x' }, fail }, fn)
    await new Promise((r) => setTimeout(r, 0))
    expect(fail).toHaveBeenCalled()
  })

  it('字段级 httpRequest 优先于全局', async () => {
    const local = vi.fn().mockResolvedValue({})
    const global = vi.fn().mockResolvedValue({})
    queryTableListMethod(
      {},
      { apiParams: { url: '/x' }, httpRequest: local },
      global
    )
    await new Promise((r) => setTimeout(r, 0))
    expect(local).toHaveBeenCalled()
    expect(global).not.toHaveBeenCalled()
  })
})
