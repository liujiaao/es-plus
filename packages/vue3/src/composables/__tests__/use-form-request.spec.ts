import { describe, it, expect, vi, beforeEach } from 'vitest'
import { nextTick } from 'vue'
import { useFormRequest } from '../use-form-request'
import type { FormItemOption, ApiParams } from '../../types'

/** httpRequest 函数签名类型 */
type HttpRequestFn = (params: Record<string, unknown>) => Promise<unknown>

function createFormItem(overrides: Partial<FormItemOption> = {}): FormItemOption {
  return {
    prop: 'testField',
    label: 'Test Field',
    ...overrides
  }
}

function createApiParams(overrides: Partial<ApiParams> = {}): ApiParams {
  return {
    url: '/api/test',
    ...overrides
  }
}

describe('useFormRequest', () => {
  let mockHttpRequest: ReturnType<typeof vi.fn> & HttpRequestFn

  beforeEach(() => {
    mockHttpRequest = vi.fn().mockResolvedValue({ rows: [], records: 0 }) as ReturnType<typeof vi.fn> & HttpRequestFn
  })

  describe('return value', () => {
    it('returns getEveryFormQueryField, queryTableListMethod, formatConfigOut, and configFormField', () => {
      const result = useFormRequest(mockHttpRequest)

      expect(result).toHaveProperty('getEveryFormQueryField')
      expect(result).toHaveProperty('queryTableListMethod')
      expect(result).toHaveProperty('formatConfigOut')
      expect(result).toHaveProperty('configFormField')
      expect(typeof result.getEveryFormQueryField).toBe('function')
      expect(typeof result.queryTableListMethod).toBe('function')
      expect(typeof result.formatConfigOut).toBe('function')
      expect(typeof result.configFormField).toBe('function')
    })

    it('works without providing httpRequest', () => {
      const result = useFormRequest()

      expect(result).toHaveProperty('getEveryFormQueryField')
      expect(result).toHaveProperty('queryTableListMethod')
    })
  })

  describe('getEveryFormQueryField', () => {
    it('skips items without apiParams', async () => {
      const { getEveryFormQueryField } = useFormRequest(mockHttpRequest)
      const items: FormItemOption[] = [
        createFormItem({ prop: 'name' }),
        createFormItem({ prop: 'age' })
      ]

      const result = await getEveryFormQueryField(items)

      expect(mockHttpRequest).not.toHaveBeenCalled()
      expect(result).toEqual([])
    })

    it('skips items with empty apiParams object', async () => {
      const { getEveryFormQueryField } = useFormRequest(mockHttpRequest)
      const items: FormItemOption[] = [
        createFormItem({ prop: 'name', apiParams: {} as ApiParams })
      ]

      const result = await getEveryFormQueryField(items)

      expect(mockHttpRequest).not.toHaveBeenCalled()
      expect(result).toEqual([])
    })

    it('skips items with apiParams lacking url', async () => {
      const { getEveryFormQueryField } = useFormRequest(mockHttpRequest)
      const items: FormItemOption[] = [
        createFormItem({ prop: 'name', apiParams: { url: '' } })
      ]

      const result = await getEveryFormQueryField(items)

      expect(mockHttpRequest).not.toHaveBeenCalled()
      expect(result).toEqual([])
    })

    it('calls httpRequest for items with valid apiParams', async () => {
      mockHttpRequest.mockResolvedValue({ rows: [{ label: 'A', value: 1 }], records: 1 })
      const { getEveryFormQueryField } = useFormRequest(mockHttpRequest)
      const items: FormItemOption[] = [
        createFormItem({ prop: 'status', apiParams: createApiParams({ url: '/api/status' }) })
      ]

      await getEveryFormQueryField(items)
      await nextTick()

      expect(mockHttpRequest).toHaveBeenCalledTimes(1)
      expect(mockHttpRequest).toHaveBeenCalledWith(
        expect.objectContaining({ url: '/api/status' })
      )
    })

    it('returns result with prop and listData for each successful request', async () => {
      const responseData = { rows: [{ label: 'Active', value: 1 }, { label: 'Inactive', value: 0 }], records: 2 }
      mockHttpRequest.mockResolvedValue(responseData)
      const { getEveryFormQueryField } = useFormRequest(mockHttpRequest)
      const items: FormItemOption[] = [
        createFormItem({ prop: 'status', apiParams: createApiParams() })
      ]

      const result = await getEveryFormQueryField(items)

      expect(result).toHaveLength(1)
      expect(result[0].prop).toBe('status')
      expect(result[0].listData).toEqual([{ label: 'Active', value: 1 }, { label: 'Inactive', value: 0 }])
    })

    it('processes multiple items in parallel', async () => {
      mockHttpRequest
        .mockResolvedValueOnce({ rows: [{ label: 'A', value: 1 }], records: 1 })
        .mockResolvedValueOnce({ rows: [{ label: 'B', value: 2 }], records: 1 })

      const { getEveryFormQueryField } = useFormRequest(mockHttpRequest)
      const items: FormItemOption[] = [
        createFormItem({ prop: 'field1', apiParams: createApiParams({ url: '/api/field1' }) }),
        createFormItem({ prop: 'field2', apiParams: createApiParams({ url: '/api/field2' }) })
      ]

      const result = await getEveryFormQueryField(items)

      expect(mockHttpRequest).toHaveBeenCalledTimes(2)
      expect(result).toHaveLength(2)
      expect(result[0].prop).toBe('field1')
      expect(result[1].prop).toBe('field2')
    })

    it('transforms response via callOptionListFormat', async () => {
      mockHttpRequest.mockResolvedValue({ rows: [{ id: 1, name: 'Opt1' }], records: 1 })
      const callOptionListFormat = vi.fn((data: unknown[]) => {
        return (data as Array<{ id: number; name: string }>).map(item => ({
          label: item.name,
          value: item.id
        }))
      })
      const { getEveryFormQueryField } = useFormRequest(mockHttpRequest)
      const items: FormItemOption[] = [
        createFormItem({
          prop: 'category',
          apiParams: createApiParams(),
          callOptionListFormat
        })
      ]

      const result = await getEveryFormQueryField(items)

      expect(callOptionListFormat).toHaveBeenCalled()
      expect(result[0].listData).toEqual([{ label: 'Opt1', value: 1 }])
    })

    it('transforms response via listenToCallBack.crtn with priority over callOptionListFormat', async () => {
      const rawResponse = { data: [{ code: 'X', text: 'Option X' }], records: 1, rows: [] }
      mockHttpRequest.mockResolvedValue(rawResponse)

      const crtn = vi.fn((data: unknown) => {
        const res = data as { data: Array<{ code: string; text: string }> }
        return res.data.map(item => ({ label: item.text, value: item.code }))
      })
      const callOptionListFormat = vi.fn((data: unknown[]) => data)

      const { getEveryFormQueryField } = useFormRequest(mockHttpRequest)
      const items: FormItemOption[] = [
        createFormItem({
          prop: 'type',
          apiParams: createApiParams(),
          callOptionListFormat,
          listenToCallBack: { crtn }
        })
      ]

      const result = await getEveryFormQueryField(items)

      expect(crtn).toHaveBeenCalledWith(rawResponse)
      expect(result[0].listData).toEqual([{ label: 'Option X', value: 'X' }])
      // callOptionListFormat should NOT be called when crtn returns non-empty
      expect(callOptionListFormat).not.toHaveBeenCalled()
    })

    it('falls back to callOptionListFormat when crtn returns empty array', async () => {
      mockHttpRequest.mockResolvedValue({ rows: [{ id: 1, name: 'Test' }], records: 1 })
      const crtn = vi.fn(() => [])
      const callOptionListFormat = vi.fn((data: unknown[]) => {
        return (data as Array<{ id: number; name: string }>).map(d => ({ label: d.name, value: d.id }))
      })

      const { getEveryFormQueryField } = useFormRequest(mockHttpRequest)
      const items: FormItemOption[] = [
        createFormItem({
          prop: 'field',
          apiParams: createApiParams(),
          callOptionListFormat,
          listenToCallBack: { crtn }
        })
      ]

      const result = await getEveryFormQueryField(items)

      expect(crtn).toHaveBeenCalled()
      expect(callOptionListFormat).toHaveBeenCalled()
      expect(result[0].listData).toEqual([{ label: 'Test', value: 1 }])
    })

    it('uses fieldFieldOutput function to transform field mapping', async () => {
      mockHttpRequest.mockResolvedValue({ list: [{ label: 'Item', value: 1 }], count: 5 })
      const fieldFieldOutput = (defaults: Record<string, string>) => ({
        ...defaults,
        total: 'count',
        listData: 'list'
      })

      const { getEveryFormQueryField } = useFormRequest(mockHttpRequest)
      const items: FormItemOption[] = [
        createFormItem({ prop: 'items', apiParams: createApiParams() })
      ]

      const result = await getEveryFormQueryField(items, fieldFieldOutput)

      expect(result[0].listData).toEqual([{ label: 'Item', value: 1 }])
    })

    it('handles httpRequest rejection gracefully', async () => {
      mockHttpRequest.mockRejectedValue(new Error('Network error'))
      const { getEveryFormQueryField } = useFormRequest(mockHttpRequest)
      const items: FormItemOption[] = [
        createFormItem({ prop: 'field', apiParams: createApiParams() })
      ]

      const result = await getEveryFormQueryField(items)

      // Rejected promises are filtered out (status !== 'fulfilled')
      expect(result).toEqual([])
    })

    it('item-level httpRequest overrides global httpRequest', async () => {
      const itemHttpRequest = vi.fn().mockResolvedValue({ rows: [{ label: 'Local', value: 99 }], records: 1 }) as unknown as HttpRequestFn
      const { getEveryFormQueryField } = useFormRequest(mockHttpRequest)
      const items: FormItemOption[] = [
        createFormItem({
          prop: 'custom',
          apiParams: createApiParams({ url: '/api/custom' }),
          httpRequest: itemHttpRequest
        })
      ]

      await getEveryFormQueryField(items)

      expect(itemHttpRequest).toHaveBeenCalledTimes(1)
      expect(mockHttpRequest).not.toHaveBeenCalled()
    })

    it('returns empty array when rowsList is not an array', async () => {
      const { getEveryFormQueryField } = useFormRequest(mockHttpRequest)

      const result = await getEveryFormQueryField(null as unknown as FormItemOption[])

      expect(result).toEqual([])
    })

    it('passes apiParams.model as form params', async () => {
      mockHttpRequest.mockResolvedValue({ rows: [], records: 0 })
      const { getEveryFormQueryField } = useFormRequest(mockHttpRequest)
      const items: FormItemOption[] = [
        createFormItem({
          prop: 'field',
          apiParams: createApiParams({
            url: '/api/data',
            model: { type: 'active', status: 1 }
          })
        })
      ]

      await getEveryFormQueryField(items)

      expect(mockHttpRequest).toHaveBeenCalledWith(
        expect.objectContaining({
          formParams: expect.objectContaining({ type: 'active', status: 1 })
        })
      )
    })

    it('passes apiParams.method in the request payload', async () => {
      mockHttpRequest.mockResolvedValue({ rows: [], records: 0 })
      const { getEveryFormQueryField } = useFormRequest(mockHttpRequest)
      const items: FormItemOption[] = [
        createFormItem({
          prop: 'field',
          apiParams: createApiParams({ url: '/api/data', method: 'POST' })
        })
      ]

      await getEveryFormQueryField(items)

      expect(mockHttpRequest).toHaveBeenCalledWith(
        expect.objectContaining({ method: 'POST' })
      )
    })

    it('passes apiParams.headers in the request payload', async () => {
      mockHttpRequest.mockResolvedValue({ rows: [], records: 0 })
      const { getEveryFormQueryField } = useFormRequest(mockHttpRequest)
      const items: FormItemOption[] = [
        createFormItem({
          prop: 'field',
          apiParams: createApiParams({ url: '/api/data', headers: { Authorization: 'Bearer token' } })
        })
      ]

      await getEveryFormQueryField(items)

      expect(mockHttpRequest).toHaveBeenCalledWith(
        expect.objectContaining({
          headers: expect.objectContaining({ Authorization: 'Bearer token' })
        })
      )
    })
  })

  describe('queryTableListMethod', () => {
    it('does nothing when apiParams is missing', () => {
      const { queryTableListMethod } = useFormRequest(mockHttpRequest)

      queryTableListMethod({}, {})

      expect(mockHttpRequest).not.toHaveBeenCalled()
    })

    it('does nothing when apiParams has no url', () => {
      const { queryTableListMethod } = useFormRequest(mockHttpRequest)

      queryTableListMethod({}, { apiParams: { url: '' } })

      expect(mockHttpRequest).not.toHaveBeenCalled()
    })

    it('does nothing when no httpRequest function is available', () => {
      const { queryTableListMethod } = useFormRequest()

      // Should not throw
      expect(() => {
        queryTableListMethod({}, { apiParams: createApiParams() })
      }).not.toThrow()
    })

    it('calls httpRequest with correct payload', () => {
      const { queryTableListMethod } = useFormRequest(mockHttpRequest)

      queryTableListMethod(
        { page: 1 },
        { apiParams: createApiParams({ url: '/api/list', method: 'GET', headers: { 'X-Custom': 'test' } }) }
      )

      expect(mockHttpRequest).toHaveBeenCalledWith({
        url: '/api/list',
        headers: { 'X-Custom': 'test' },
        formParams: { page: 1 },
        method: 'GET'
      })
    })

    it('calls success callback on resolved response', async () => {
      const responseData = { rows: [{ id: 1 }], records: 1 }
      mockHttpRequest.mockResolvedValue(responseData)
      const success = vi.fn()
      const { queryTableListMethod } = useFormRequest(mockHttpRequest)

      queryTableListMethod({}, { apiParams: createApiParams(), success })

      await vi.waitFor(() => {
        expect(success).toHaveBeenCalledWith(responseData)
      })
    })

    it('calls fail callback on rejected response', async () => {
      const error = new Error('Request failed')
      mockHttpRequest.mockRejectedValue(error)
      const fail = vi.fn()
      const { queryTableListMethod } = useFormRequest(mockHttpRequest)

      queryTableListMethod({}, { apiParams: createApiParams(), fail })

      await vi.waitFor(() => {
        expect(fail).toHaveBeenCalledWith(error)
      })
    })

    it('uses options.httpRequest over global httpRequest', () => {
      const localRequest = vi.fn().mockResolvedValue({}) as unknown as HttpRequestFn
      const { queryTableListMethod } = useFormRequest(mockHttpRequest)

      queryTableListMethod({}, { apiParams: createApiParams(), httpRequest: localRequest })

      expect(localRequest).toHaveBeenCalled()
      expect(mockHttpRequest).not.toHaveBeenCalled()
    })

    it('merges apiParams.model into formParams', () => {
      const { queryTableListMethod } = useFormRequest(mockHttpRequest)

      queryTableListMethod(
        { page: 1 },
        { apiParams: createApiParams({ url: '/api/data', model: { category: 'A' } }) }
      )

      expect(mockHttpRequest).toHaveBeenCalledWith(
        expect.objectContaining({
          formParams: { page: 1, category: 'A' }
        })
      )
    })
  })

  describe('formatConfigOut', () => {
    it('extracts listData from response using default field mapping', () => {
      const { formatConfigOut } = useFormRequest(mockHttpRequest)
      const row = { rows: [{ id: 1 }, { id: 2 }], records: 10 }

      const result = formatConfigOut(row, ['listData', 'total'], {})

      expect(result.listData).toEqual([{ id: 1 }, { id: 2 }])
      expect(result.total).toBe(10)
    })

    it('uses fieldFieldOutput to customize field mapping', () => {
      const { formatConfigOut } = useFormRequest(mockHttpRequest)
      const row = { data: [{ id: 1 }], totalCount: 5 }
      const fieldFieldOutput = () => ({
        total: 'totalCount',
        pageSize: 'pageSize',
        current: 'pageNo',
        listData: 'data'
      })

      const result = formatConfigOut(row, ['listData', 'total'], {}, fieldFieldOutput)

      expect(result.listData).toEqual([{ id: 1 }])
      expect(result.total).toBe(5)
    })

    it('handles array response directly as listData', () => {
      const { formatConfigOut } = useFormRequest(mockHttpRequest)
      const row = [{ label: 'A', value: 1 }, { label: 'B', value: 2 }]

      const result = formatConfigOut(row as unknown as Record<string, unknown>, ['listData'], {})

      expect(result.listData).toEqual([{ label: 'A', value: 1 }, { label: 'B', value: 2 }])
    })

    it('returns empty array for listData when the mapped field is not an array', () => {
      const { formatConfigOut } = useFormRequest(mockHttpRequest)
      const row = { rows: 'not-an-array', records: 0 }

      const result = formatConfigOut(row as unknown as Record<string, unknown>, ['listData'], {})

      expect(result.listData).toEqual([])
    })

    it('parses numeric string values for non-listData fields', () => {
      const { formatConfigOut } = useFormRequest(mockHttpRequest)
      const row = { rows: [], records: '25' }

      const result = formatConfigOut(row as unknown as Record<string, unknown>, ['total'], {})

      expect(result.total).toBe(25)
    })

    it('uses configFormOut from options when provided and valid', () => {
      const { formatConfigOut } = useFormRequest(mockHttpRequest)
      const row = { items: [{ id: 1 }], count: 3 }
      const options = {
        configFormOut: { total: 'count', pageSize: 'size', current: 'page', listData: 'items' }
      }

      const result = formatConfigOut(row, ['listData', 'total'], options)

      expect(result.listData).toEqual([{ id: 1 }])
      expect(result.total).toBe(3)
    })

    it('only extracts keys specified in keyList', () => {
      const { formatConfigOut } = useFormRequest(mockHttpRequest)
      const row = { rows: [{ id: 1 }], records: 10, pageSize: 20, pageNo: 1 }

      const result = formatConfigOut(row, ['listData'], {})

      expect(result.listData).toEqual([{ id: 1 }])
      expect(result).not.toHaveProperty('total')
      expect(result).not.toHaveProperty('pageSize')
    })

    it('uses findValueByKey for deeply nested values', () => {
      const { formatConfigOut } = useFormRequest(mockHttpRequest)
      const row = { data: { inner: { rows: [{ id: 5 }] } } }

      const result = formatConfigOut(row as unknown as Record<string, unknown>, ['listData'], {})

      expect(result.listData).toEqual([{ id: 5 }])
    })
  })

  describe('configFormField', () => {
    it('returns default field mapping when no options provided', () => {
      const { configFormField } = useFormRequest(mockHttpRequest)

      const result = configFormField()

      expect(result).toEqual({
        total: 'records',
        pageSize: 'pageSize',
        current: 'pageNo',
        listData: 'rows'
      })
    })

    it('uses fieldFieldOutput to customize defaults', () => {
      const { configFormField } = useFormRequest(mockHttpRequest)
      const fieldFieldOutput = (defaults: Record<string, string>) => ({
        ...defaults,
        total: 'totalCount',
        listData: 'data'
      })

      const result = configFormField({}, fieldFieldOutput)

      expect(result).toEqual({
        total: 'totalCount',
        pageSize: 'pageSize',
        current: 'pageNo',
        listData: 'data'
      })
    })

    it('uses options.configFormOut when valid', () => {
      const { configFormField } = useFormRequest(mockHttpRequest)
      const options = {
        configFormOut: { total: 'cnt', pageSize: 'ps', current: 'pg', listData: 'list' }
      }

      const result = configFormField(options)

      expect(result).toEqual({ total: 'cnt', pageSize: 'ps', current: 'pg', listData: 'list' })
    })

    it('ignores invalid configFormOut and falls back to defaults', () => {
      const { configFormField } = useFormRequest(mockHttpRequest)
      const options = {
        configFormOut: { total: 123, pageSize: null } // non-string values are invalid
      }

      const result = configFormField(options)

      expect(result).toEqual({
        total: 'records',
        pageSize: 'pageSize',
        current: 'pageNo',
        listData: 'rows'
      })
    })
  })
})
