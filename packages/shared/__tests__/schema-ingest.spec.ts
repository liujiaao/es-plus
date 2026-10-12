import { describe, it, expect } from 'vitest'
import {
  ingestSchema,
  defaultFormtypeForType,
  type SchemaKind,
} from '../src/schema-ingest.js'
import { composeCrudConfig } from '../src/compose-crud-config.js'
import { generateFromConfig } from '../src/structured-generator.js'
import { VALID_FORM_TYPES } from '../src/contract.js'
import { transformSync } from 'esbuild'

describe('defaultFormtypeForType — 数据类型 → formtype 映射', () => {
  it('标量类型按表映射', () => {
    expect(defaultFormtypeForType({ type: 'integer' })).toBe('InputNumber')
    expect(defaultFormtypeForType({ type: 'number' })).toBe('InputNumber')
    expect(defaultFormtypeForType({ type: 'boolean' })).toBe('Switch')
    expect(defaultFormtypeForType({ type: 'string' })).toBe('Input')
  })

  it('string + format 走日期/时间/上传', () => {
    expect(defaultFormtypeForType({ type: 'string', format: 'date' })).toBe('DatePicker')
    expect(defaultFormtypeForType({ type: 'string', format: 'date-time' })).toBe('DatePicker')
    expect(defaultFormtypeForType({ type: 'string', format: 'time' })).toBe('TimePicker')
    expect(defaultFormtypeForType({ type: 'string', format: 'binary' })).toBe('Upload')
  })

  it('有限枚举:string→Select、array→Checkbox', () => {
    expect(defaultFormtypeForType({ type: 'string', hasEnum: true })).toBe('Select')
    expect(defaultFormtypeForType({ type: 'array', hasEnum: true })).toBe('Checkbox')
  })

  it('裸数组 / 对象 / 未知类型兜底 Input', () => {
    expect(defaultFormtypeForType({ type: 'array' })).toBe('Input')
    expect(defaultFormtypeForType({ type: 'object' })).toBe('Input')
    expect(defaultFormtypeForType({ type: 'weird-unknown' })).toBe('Input')
    expect(defaultFormtypeForType({ type: '' })).toBe('Input')
  })

  // 核心不变量:全覆盖 + 输出恒合法。这正面堵住 Wave-1「fall-through 教错」坑。
  it('对输入域全覆盖,且输出恒 ∈ VALID_FORM_TYPES', () => {
    const types = ['string', 'integer', 'number', 'boolean', 'array', 'object', 'null', '', 'nonsense']
    const formats = [undefined, 'date', 'date-time', 'time', 'binary', 'email', 'uri', 'uuid', 'weird']
    const enums = [true, false, undefined]
    for (const type of types) {
      for (const format of formats) {
        for (const hasEnum of enums) {
          const ft = defaultFormtypeForType({ type, format, hasEnum })
          expect(typeof ft).toBe('string')
          expect(VALID_FORM_TYPES).toContain(ft)
        }
      }
    }
  })
})

describe('ingestSchema — JSON Schema', () => {
  const schema = JSON.stringify({
    title: 'user account',
    type: 'object',
    required: ['userName', 'age'],
    properties: {
      userName: { type: 'string', title: '用户名' },
      age: { type: 'integer' },
      active: { type: 'boolean' },
      createdAt: { type: 'string', format: 'date-time' },
      role: { type: 'string', enum: ['admin', 'user'] },
      tags: { type: 'array', items: { enum: ['a', 'b', 'c'] } },
      avatar: { type: 'string', format: 'binary' },
      nickname: { type: ['string', 'null'] },
    },
  })

  it('属性逐个过类型映射', () => {
    const r = ingestSchema(schema, 'jsonSchema')
    const byProp = Object.fromEntries(r.fields.map((f) => [f.prop, f.formtype]))
    expect(byProp).toMatchObject({
      userName: 'Input',
      age: 'InputNumber',
      active: 'Switch',
      createdAt: 'DatePicker',
      role: 'Select',
      tags: 'Checkbox',
      avatar: 'Upload',
      nickname: 'Input',
    })
  })

  it('title → PascalCase 资源名;字段 title → label', () => {
    const r = ingestSchema(schema, 'jsonSchema')
    expect(r.name).toBe('UserAccount')
    expect(r.fields.find((f) => f.prop === 'userName')!.label).toBe('用户名')
    // 无 title 的字段回落到属性键
    expect(r.fields.find((f) => f.prop === 'age')!.label).toBe('age')
  })

  it('required 反映到字段;enum → dataOptions', () => {
    const r = ingestSchema(schema, 'jsonSchema')
    const userName = r.fields.find((f) => f.prop === 'userName')! as Record<string, unknown>
    const active = r.fields.find((f) => f.prop === 'active')! as Record<string, unknown>
    expect(userName.required).toBe(true)
    expect(active.required).toBeUndefined()
    const role = r.fields.find((f) => f.prop === 'role')! as Record<string, unknown>
    expect(role.dataOptions).toEqual([
      { label: 'admin', value: 'admin' },
      { label: 'user', value: 'user' },
    ])
    const tags = r.fields.find((f) => f.prop === 'tags')! as Record<string, unknown>
    expect(tags.dataOptions).toEqual([
      { label: 'a', value: 'a' },
      { label: 'b', value: 'b' },
      { label: 'c', value: 'c' },
    ])
  })

  it('没有 properties → 空字段 + 告警,不抛', () => {
    const r = ingestSchema(JSON.stringify({ type: 'object' }), 'jsonSchema')
    expect(r.fields).toEqual([])
    expect(r.warnings.join('\n')).toContain('没有 properties')
  })

  it('$ref 字段降级 Input + 告警', () => {
    const r = ingestSchema(
      JSON.stringify({ properties: { addr: { $ref: '#/components/schemas/Address' } } }),
      'jsonSchema',
    )
    expect(r.fields[0]).toMatchObject({ prop: 'addr', formtype: 'Input' })
    expect(r.warnings.join('\n')).toContain('$ref')
  })

  it('嵌套对象 / 裸数组各发一条兜底告警', () => {
    const r = ingestSchema(
      JSON.stringify({ properties: { meta: { type: 'object' }, list: { type: 'array' } } }),
      'jsonSchema',
    )
    expect(r.warnings.join('\n')).toContain('嵌套对象')
    expect(r.warnings.join('\n')).toContain('无枚举数组')
  })
})

describe('ingestSchema — OpenAPI', () => {
  it('从 components.schemas 取首个 schema', () => {
    const doc = JSON.stringify({
      openapi: '3.0.0',
      components: {
        schemas: {
          Product: {
            type: 'object',
            properties: { sku: { type: 'string' }, price: { type: 'number' } },
          },
        },
      },
    })
    const r = ingestSchema(doc, 'openapi')
    expect(r.name).toBe('Product')
    expect(r.fields.map((f) => f.prop)).toEqual(['sku', 'price'])
  })

  it('多个 schema → 取第一个 + 告警', () => {
    const doc = JSON.stringify({
      components: { schemas: { A: { properties: { x: { type: 'string' } } }, B: { properties: {} } } },
    })
    const r = ingestSchema(doc, 'openapi')
    expect(r.name).toBe('A')
    expect(r.warnings.join('\n')).toContain('多个 schema')
  })

  it('缺 components.schemas → 空 + 告警', () => {
    const r = ingestSchema(JSON.stringify({ openapi: '3.0.0' }), 'openapi')
    expect(r.fields).toEqual([])
    expect(r.warnings.join('\n')).toContain('没有 components.schemas')
  })

  it('YAML(非 JSON)文本 → 告警指引转 JSON,不抛', () => {
    const r = ingestSchema('openapi: 3.0.0\ncomponents: {}', 'openapi')
    expect(r.fields).toEqual([])
    expect(r.warnings.join('\n')).toContain('YAML')
  })
})

describe('ingestSchema — 样例 JSON', () => {
  it('按 typeof + ISO 日期推断', () => {
    const sample = JSON.stringify({
      name: '张三',
      age: 30,
      score: 4.5,
      active: true,
      createdAt: '2026-01-02T03:04:05Z',
      tags: ['a', 'b'],
      profile: { bio: 'x' },
    })
    const r = ingestSchema(sample, 'sample-json')
    const byProp = Object.fromEntries(r.fields.map((f) => [f.prop, f.formtype]))
    expect(byProp).toMatchObject({
      name: 'Input',
      age: 'InputNumber',
      score: 'InputNumber',
      active: 'Switch',
      createdAt: 'DatePicker',
      tags: 'Input',
      profile: 'Input',
    })
  })

  it('数组样例取首元素', () => {
    const r = ingestSchema(JSON.stringify([{ id: 1, title: 'x' }]), 'sample-json')
    expect(r.fields.map((f) => f.prop)).toEqual(['id', 'title'])
  })

  it('空数组 / 非对象 → 空 + 告警', () => {
    expect(ingestSchema('[]', 'sample-json').warnings.join('\n')).toContain('空数组')
    expect(ingestSchema('42', 'sample-json').warnings.join('\n')).toContain('不是对象')
  })
})

describe('ingestSchema — 未支持 kind / 非法输入', () => {
  it('ts-interface / sql-ddl → stub 告警', () => {
    for (const kind of ['ts-interface', 'sql-ddl'] as SchemaKind[]) {
      const r = ingestSchema('whatever', kind)
      expect(r.fields).toEqual([])
      expect(r.warnings.join('\n')).toContain('暂未支持')
    }
  })

  it('非法 JSON → 告警,不抛', () => {
    const r = ingestSchema('{ not json', 'jsonSchema')
    expect(r.fields).toEqual([])
    expect(r.warnings.join('\n')).toContain('无法解析为 JSON')
  })
})

describe('ingestSchema → composeCrudConfig → generateFromConfig(端到端,产物可解析)', () => {
  it('OpenAPI 一路落到可解析的 schema 产物', () => {
    const doc = JSON.stringify({
      openapi: '3.0.0',
      components: {
        schemas: {
          Order: {
            type: 'object',
            title: 'order',
            required: ['orderNo'],
            properties: {
              orderNo: { type: 'string', title: '订单号' },
              amount: { type: 'number', title: '金额' },
              status: { type: 'string', enum: ['open', 'closed'], title: '状态' },
              paidAt: { type: 'string', format: 'date-time', title: '支付时间' },
            },
          },
        },
      },
    })
    const ingested = ingestSchema(doc, 'openapi')
    expect(ingested.fields.length).toBe(4)

    const { config } = composeCrudConfig({
      name: ingested.name ?? 'IngestedPage',
      apiUrl: '/api/orders',
      table: ingested.fields,
      form: ingested.fields,
    })
    const result = generateFromConfig(config)

    // schema 模式下 result.code 即 schema.ts(纯 TS)。用 esbuild 做一次语法解析,
    // 核验这条摄取链路的产物能编译——与 C1 的发射前 parse-gate 同一个解析器。
    expect(() => transformSync(result.code, { loader: 'ts' })).not.toThrow()
  })
})
