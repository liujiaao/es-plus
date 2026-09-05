/**
 * 表单请求测试 — queryTableListMethod / formatConfigOut / getEveryFormQueryField
 */
import { describe, it, expect, vi, beforeEach } from 'vitest'
import { useFormRequest } from '../src/composables/use-form-request'
import type { FormItemOption } from '../src/types'

describe('useFormRequest — checkQueryFields', () => {
  it('有效配置 — 返回 true', () => {
    const { configFormField } = useFormRequest()
    const cfg = { total: 'total', pageSize: 'pageSize', current: 'pageNo', listData: 'rows' }
    const result = configFormField({ configFormOut: cfg })
    expect(result).toEqual(cfg)
  })

  it('部分映射配置 — 未满 4 个 key 时校验失败回退默认', () => {
    const { configFormField } = useFormRequest()
    const result = configFormField({ configFormOut: { total: 't' } as any })
    expect(result).toEqual({
      total: 'records', pageSize: 'pageSize', current: 'pageNo', listData: 'rows',
    })
  })

  it('fieldFieldOutput 注入 — 优先使用', () => {
    const { configFormField } = useFormRequest()
    const custom: Record<string, string> = { total: 't', pageSize: 'ps', current: 'cp', listData: 'ld' }
    const injectFn = vi.fn().mockReturnValue(custom)
    const result = configFormField({}, injectFn)
    expect(injectFn).toHaveBeenCalled()
    expect(result).toEqual(custom)
  })

  it('fieldFieldOutput 返回部分映射 → 校验失败回退默认', () => {
    const { configFormField } = useFormRequest()
    const injectFn = vi.fn().mockReturnValue({ total: 't' })
    const result = configFormField({}, injectFn)
    expect(result).toEqual({
      total: 'records', pageSize: 'pageSize', current: 'pageNo', listData: 'rows',
    })
  })

  it('含非法键的配置 → 回退默认（子集校验：键必须属于 4 个允许键）', () => {
    const { configFormField } = useFormRequest()
    const result = configFormField({ configFormOut: { total: 't', foo: 'bar' } as any })
    expect(result).toEqual({
      total: 'records', pageSize: 'pageSize', current: 'pageNo', listData: 'rows',
    })
  })
})

describe('useFormRequest — formatConfigOut', () => {
  const { formatConfigOut } = useFormRequest()

  it('标准对象响应', () => {
    const result = formatConfigOut(
      { total: 100, rows: [{ id: 1 }, { id: 2 }] },
      ['total', 'listData'],
      { configFormOut: { total: 'total', pageSize: 'pageSize', current: 'pageNo', listData: 'rows' } },
    )
    expect(result.total).toBe(100)
    expect(result.listData).toEqual([{ id: 1 }, { id: 2 }])
  })

  it('数组响应 — listData 直接使用数组本身', () => {
    const result = formatConfigOut(
      [{ id: 1 }, { id: 2 }] as any,
      ['listData'],
    )
    expect(result.listData).toEqual([{ id: 1 }, { id: 2 }])
  })

  it('字段映射 — 嵌套路径回退 findValueByKey', () => {
    const result = formatConfigOut(
      { data: { result: { totalCount: 50, items: [{ id: 1 }] } } },
      ['total', 'listData'],
      {
        configFormOut: {
          total: 'totalCount',
          pageSize: 'pageSize',
          current: 'pageNo',
          listData: 'items',
        },
      },
    )
    expect(result.total).toBe(50)
    expect(result.listData).toEqual([{ id: 1 }])
  })

  it('total 字符串转换', () => {
    const result = formatConfigOut(
      { total: '200' },
      ['total'],
      { configFormOut: { total: 'total', pageSize: 'ps', current: 'cp', listData: 'ld' } },
    )
    expect(result.total).toBe(200)
  })

  it('不存在的字段 — 不包含在结果中', () => {
    const result = formatConfigOut({}, ['total'], { configFormOut: { total: 'total', pageSize: 'ps', current: 'cp', listData: 'ld' } })
    expect(result.total).toBe(0)
  })
})

describe('useFormRequest — queryTableListMethod', () => {
  it('无 url — 不请求', () => {
    const { queryTableListMethod } = useFormRequest()
    const result = queryTableListMethod({}, {})
    expect(result).toBeUndefined()
  })

  it('有 url + httpRequest → 调用 success', async () => {
    const mockRequest = vi.fn().mockResolvedValue({ data: [1, 2, 3] })
    const { queryTableListMethod } = useFormRequest(mockRequest)
    const successSpy = vi.fn()

    queryTableListMethod(
      {},
      {
        apiParams: { url: '/api/list', method: 'POST', model: { status: 'active' } },
        httpRequest: mockRequest,
        success: successSpy,
      },
    )

    // 等待异步
    await new Promise((r) => setTimeout(r, 20))
    expect(mockRequest).toHaveBeenCalled()
    expect(successSpy).toHaveBeenCalled()
  })

  it('httpRequest reject → 调用 fail', async () => {
    const mockRequest = vi.fn().mockRejectedValue(new Error('Network Error'))
    const { queryTableListMethod } = useFormRequest(mockRequest)
    const failSpy = vi.fn()

    queryTableListMethod(
      {},
      {
        apiParams: { url: '/api/list' },
        httpRequest: mockRequest,
        fail: failSpy,
      },
    )

    await new Promise((r) => setTimeout(r, 20))
    expect(failSpy).toHaveBeenCalled()
  })

  it('使用全局 httpRequest', async () => {
    const globalMock = vi.fn().mockResolvedValue({ data: [] })
    const { queryTableListMethod } = useFormRequest(globalMock)
    const successSpy = vi.fn()

    queryTableListMethod(
      {},
      {
        apiParams: { url: '/api/list' },
        success: successSpy,
      },
    )

    await new Promise((r) => setTimeout(r, 20))
    expect(globalMock).toHaveBeenCalled()
  })
})

describe('useFormRequest — getEveryFormQueryField', () => {
  it('空数组 → 返回空', async () => {
    const { getEveryFormQueryField } = useFormRequest()
    const result = await getEveryFormQueryField([])
    expect(result).toEqual([])
  })

  it('单个 API 字段', async () => {
    const mockRequest = vi.fn().mockResolvedValue({ rows: [{ id: 1, name: '选项1' }] })
    const { getEveryFormQueryField } = useFormRequest()

    const items: FormItemOption[] = [
      {
        prop: 'status',
        label: '状态',
        formtype: 'Select',
        apiParams: { url: '/api/status' },
        httpRequest: mockRequest,
      },
    ]

    const result = await getEveryFormQueryField(items)
    expect(result).toHaveLength(1)
    expect(result[0].prop).toBe('status')
  })

  it('多个 API 字段 — 容错：一个失败不影响其他', async () => {
    const successMock = vi.fn().mockResolvedValue({ rows: [{ id: 1 }] })
    const failMock = vi.fn().mockRejectedValue(new Error('Fail'))
    const { getEveryFormQueryField } = useFormRequest()

    const items: FormItemOption[] = [
      {
        prop: 'good', label: 'Good', formtype: 'Select',
        apiParams: { url: '/api/good' },
        httpRequest: successMock,
      },
      {
        prop: 'bad', label: 'Bad', formtype: 'Select',
        apiParams: { url: '/api/bad' },
        httpRequest: failMock,
      },
    ]

    const result = await getEveryFormQueryField(items)
    // bad 字段失败，good 字段应成功
    expect(result).toHaveLength(1)
    expect(result[0].prop).toBe('good')
  })

  it('使用 callOptionListFormat 格式化选项', async () => {
    const mockRequest = vi.fn().mockResolvedValue({ rows: [{ code: '1', name: '选项' }] })
    const { getEveryFormQueryField } = useFormRequest()

    const items: FormItemOption[] = [{
      prop: 'type', label: '类型', formtype: 'Select',
      apiParams: { url: '/api/type' },
      httpRequest: mockRequest,
      callOptionListFormat: (data: unknown[]) =>
        (data as any[]).map((d: any) => ({ label: d.name, value: d.code })),
    }]

    const result = await getEveryFormQueryField(items)
    expect(result).toHaveLength(1)
    expect(result[0].listData).toEqual([{ label: '选项', value: '1' }])
  })
})
