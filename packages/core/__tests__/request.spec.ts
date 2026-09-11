import { describe, it, expect, vi } from 'vitest'
import {
  checkQueryFields,
  configFormField,
  formatConfigOut,
  queryTableListMethod,
  httpRequestFormInstance,
  getEveryFormQueryField,
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

  it('非对象响应（undefined/null/原始值）→ 仍调用 success，归一为 {}', async () => {
    // 回归：此前 success 仅在 res 为非空对象/数组时被调用，导致
    // httpRequestFormInstance 的 Promise 永不 settle（远端下拉选项挂起）。
    for (const res of [undefined, null, '', 0, 'raw-text']) {
      const fn = vi.fn().mockResolvedValue(res)
      const success = vi.fn()
      queryTableListMethod({}, { apiParams: { url: '/x' }, success }, fn)
      await new Promise((r) => setTimeout(r, 0))
      expect(success, `res=${String(res)}`).toHaveBeenCalledWith({})
    }
  })

  it('无 success 回调 → 不抛错', async () => {
    const fn = vi.fn().mockResolvedValue(undefined)
    expect(() => queryTableListMethod({}, { apiParams: { url: '/x' } }, fn)).not.toThrow()
    await new Promise((r) => setTimeout(r, 0))
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

describe('request > httpRequestFormInstance', () => {
  it('data = res.data（剥一层）', async () => {
    const fn = vi.fn().mockResolvedValue({ data: ['item1', 'item2'], rows: [], records: 0 })
    const rows = { prop: 'f', apiParams: { url: '/x' } }
    const result = await httpRequestFormInstance({}, { apiParams: rows.apiParams }, rows as any, fn)
    expect(result.data).toEqual(['item1', 'item2'])
  })

  it('res 本身是数组 → data = res', async () => {
    const fn = vi.fn().mockResolvedValue([{ id: 1 }, { id: 2 }])
    const rows = { prop: 'f', apiParams: { url: '/x' } }
    const result = await httpRequestFormInstance({}, { apiParams: rows.apiParams }, rows as any, fn)
    expect(result.data).toEqual([{ id: 1 }, { id: 2 }])
    expect(result.configRows.listData).toEqual([{ id: 1 }, { id: 2 }])
  })

  it('configRows.listData 按默认映射（rows 字段）提取', async () => {
    const fn = vi.fn().mockResolvedValue({ rows: [{ id: 3 }], records: 1 })
    const rows = { prop: 'f', apiParams: { url: '/x' } }
    const result = await httpRequestFormInstance({}, { apiParams: rows.apiParams }, rows as any, fn)
    expect(result.configRows.listData).toEqual([{ id: 3 }])
  })

  it('formParams 注入 pageIndex=1, pageSize=1000 并合并 model 参数', async () => {
    const fn = vi.fn().mockResolvedValue({ rows: [] })
    const rows = { prop: 'f', apiParams: { url: '/x' } }
    await httpRequestFormInstance({ extra: 'v' }, { apiParams: rows.apiParams }, rows as any, fn)
    const payload = fn.mock.calls[0][0] as Record<string, unknown>
    const fp = payload.formParams as Record<string, unknown>
    expect(fp.pageIndex).toBe(1)
    expect(fp.pageSize).toBe(1000)
    expect(fp.extra).toBe('v')
  })

  it('请求失败 → reject', async () => {
    const fn = vi.fn().mockRejectedValue(new Error('boom'))
    const rows = { prop: 'f', apiParams: { url: '/x' } }
    await expect(
      httpRequestFormInstance({}, { apiParams: rows.apiParams }, rows as any, fn)
    ).rejects.toThrow('boom')
  })

  it('httpRequest resolve undefined → Promise 仍 settle（回归：此前永久挂起）', async () => {
    const fn = vi.fn().mockResolvedValue(undefined)
    const rows = { prop: 'f', apiParams: { url: '/x' } }
    const outcome = await Promise.race([
      httpRequestFormInstance({}, { apiParams: rows.apiParams }, rows as any, fn).then(() => 'resolved'),
      new Promise((r) => setTimeout(() => r('timeout'), 200))
    ])
    expect(outcome).toBe('resolved')
  })
})

describe('request > getEveryFormQueryField', () => {
  it('非数组输入 → []', async () => {
    const result = await getEveryFormQueryField(null as any)
    expect(result).toEqual([])
  })

  it('无 apiParams.url 的字段被过滤 → 不发请求，返回 []', async () => {
    const fn = vi.fn()
    const result = await getEveryFormQueryField([{ prop: 'f', label: '字段' }] as any, fn)
    expect(fn).not.toHaveBeenCalled()
    expect(result).toEqual([])
  })

  it('提取 prop + listData', async () => {
    const fn = vi.fn().mockResolvedValue({ rows: [{ id: 1 }], records: 1 })
    const result = await getEveryFormQueryField(
      [{ prop: 'myProp', apiParams: { url: '/api' } }] as any,
      fn
    )
    expect(result).toHaveLength(1)
    expect(result[0].prop).toBe('myProp')
    expect(result[0].listData).toEqual([{ id: 1 }])
  })

  it('远端 resolve undefined → 仍 resolve（回归：此前 Promise.all 永久挂起）', async () => {
    const fn = vi.fn().mockResolvedValue(undefined)
    const outcome = await Promise.race([
      getEveryFormQueryField(
        [{ prop: 'f', apiParams: { url: '/api' } }] as any,
        fn
      ).then((r) => (Array.isArray(r) ? 'resolved' : 'bad')),
      new Promise((r) => setTimeout(() => r('timeout'), 200))
    ])
    expect(outcome).toBe('resolved')
  })

  it('responseTransform 接收 preExtractedList（非原始 response）', async () => {
    const fn = vi.fn().mockResolvedValue({ rows: [{ id: 1 }] })
    const responseTransform = vi.fn().mockReturnValue([{ label: '变换后', value: 1 }])
    const result = await getEveryFormQueryField(
      [{ prop: 'f', apiParams: { url: '/api' }, listenToCallBack: { responseTransform } }] as any,
      fn
    )
    // core 传入 preExtractedList（已提取的 listData），而非原始响应对象
    expect(responseTransform).toHaveBeenCalledWith([{ id: 1 }])
    expect(result[0].listData).toEqual([{ label: '变换后', value: 1 }])
  })

  it('crtn 是 responseTransform 的旧写法别名，接收 preExtractedList', async () => {
    const fn = vi.fn().mockResolvedValue({ rows: [{ id: 2 }] })
    const crtn = vi.fn().mockReturnValue([{ label: 'crtn结果', value: 2 }])
    const result = await getEveryFormQueryField(
      [{ prop: 'f', apiParams: { url: '/api' }, listenToCallBack: { crtn } }] as any,
      fn
    )
    expect(crtn).toHaveBeenCalledWith([{ id: 2 }])
    expect(result[0].listData).toEqual([{ label: 'crtn结果', value: 2 }])
  })

  it('callOptionListFormat 作为兜底格式化', async () => {
    const fn = vi.fn().mockResolvedValue({ rows: [{ id: 3 }] })
    const callOptionListFormat = vi.fn().mockReturnValue([{ label: '格式化', value: 3 }])
    const result = await getEveryFormQueryField(
      [{ prop: 'f', apiParams: { url: '/api' }, callOptionListFormat }] as any,
      fn
    )
    expect(callOptionListFormat).toHaveBeenCalledWith([{ id: 3 }])
    expect(result[0].listData).toEqual([{ label: '格式化', value: 3 }])
  })

  it('单字段请求失败不影响其他字段', async () => {
    const fn = vi.fn()
      .mockRejectedValueOnce(new Error('网络错误'))
      .mockResolvedValueOnce({ rows: [{ id: 9 }] })
    const result = await getEveryFormQueryField(
      [
        { prop: 'failField', apiParams: { url: '/api/fail' } },
        { prop: 'okField', apiParams: { url: '/api/ok' } },
      ] as any,
      fn
    )
    expect(result).toHaveLength(1)
    expect(result[0].prop).toBe('okField')
  })
})
