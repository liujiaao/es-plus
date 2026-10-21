import { describe, it, expect } from 'vitest'
import { readFileSync, readdirSync } from 'node:fs'
import { join } from 'node:path'
import { fileURLToPath } from 'node:url'
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

  it('allOf/oneOf/anyOf 组合 schema 不静默兜底（告警点名组合关键字）', () => {
    const r = ingestSchema(
      JSON.stringify({
        properties: {
          amount: { allOf: [{ type: 'number' }] },
          kind: { oneOf: [{ type: 'string' }, { type: 'null' }] },
          extra: { anyOf: [{ type: 'boolean' }] },
        },
      }),
      'jsonSchema',
    )
    const joined = r.warnings.join('\n')
    expect(joined).toContain('amount')
    expect(joined).toContain('allOf')
    expect(joined).toContain('kind')
    expect(joined).toContain('oneOf')
    expect(joined).toContain('extra')
    expect(joined).toContain('anyOf')
    // 未展开子 schema ⇒ 退回 Input，但使用者已被告知要人工核对
    expect(r.fields.find((f) => f.prop === 'amount')!.formtype).toBe('Input')
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

describe('ingestSchema — TypeScript interface', () => {
  const SRC = `
export interface User {
  /** 用户 ID */
  id: number
  /** 昵称 */
  nickname?: string
  status: 'active' | 'disabled'
  /** 生日 */
  birthday: Date
  tags: string[]
  roles: Array<'admin' | 'member'>
  /** 地址 */
  address: { city: string; street: string }
}
`

  it('interface 体逐成员摄取:label / required / 枚举 / 数组 / 日期', () => {
    const r = ingestSchema(SRC, 'ts-interface')
    expect(r.name).toBe('User')
    const byProp = Object.fromEntries(r.fields.map((f) => [f.prop, f]))
    expect(Object.keys(byProp)).toEqual([
      'id', 'nickname', 'status', 'birthday', 'tags', 'roles', 'address',
    ])
    expect(byProp.id).toMatchObject({ label: '用户 ID', formtype: 'InputNumber', required: true })
    // 可选成员不写 required(缺席 ≠ false,与 schema 语义一致)。
    expect(byProp.nickname?.required).toBeUndefined()
    expect(byProp.status).toMatchObject({ formtype: 'Select', required: true })
    expect(byProp.status.dataOptions).toEqual([
      { label: 'active', value: 'active' },
      { label: 'disabled', value: 'disabled' },
    ])
    expect(byProp.birthday).toMatchObject({ formtype: 'DatePicker', required: true })
    expect(byProp.tags).toMatchObject({ formtype: 'Input', required: true })
    expect(byProp.roles).toMatchObject({ formtype: 'Checkbox', required: true })
    expect(byProp.roles.dataOptions).toEqual([
      { label: 'admin', value: 'admin' },
      { label: 'member', value: 'member' },
    ])
    // 嵌套对象 → Input + 告警(不静默吞字段)。
    expect(byProp.address).toMatchObject({ formtype: 'Input', required: true })
    expect(r.warnings.join('\n')).toContain('嵌套对象')
    expect(r.warnings.join('\n')).toContain('无枚举数组')
  })

  it('type 字面量与多声明:取第一个并告警', () => {
    const r = ingestSchema(
      `
type Order = { orderNo: string; amount?: number }
interface Ignored { x: string }
`,
      'ts-interface',
    )
    expect(r.name).toBe('Order')
    expect(r.fields.map((f) => f.prop)).toEqual(['orderNo', 'amount'])
    expect(r.fields[0]).toMatchObject({ formtype: 'Input', required: true })
    expect(r.fields[1]?.required).toBeUndefined()
    expect(r.warnings.join('\n')).toContain('多个 interface/type 声明')
  })

  it('无法识别 / 非 prop:type 成员 → 告警兜底,不抛', () => {
    const r = ingestSchema(
      `
interface Weird {
  something: SomeUnknownType
  doWork(): void
  'quoted-key': string
}
`,
      'ts-interface',
    )
    expect(r.fields.map((f) => f.prop)).toEqual(['something', 'quoted-key'])
    expect(r.fields[0]).toMatchObject({ formtype: 'Input' })
    expect(r.warnings.join('\n')).toContain('未能识别')
    expect(r.warnings.join('\n')).toContain('不是 "prop: type" 形态')
  })

  it('无声明 / 花括号不完整 → 空 + 告警', () => {
    for (const text of ['whatever', 'interface Broken { id: number']) {
      const r = ingestSchema(text, 'ts-interface')
      expect(r.fields).toEqual([])
      expect(r.warnings.length).toBeGreaterThan(0)
    }
  })
})

describe('ingestSchema — SQL DDL', () => {
  const SRC = `
CREATE TABLE \`order_items\` (
  \`id\` BIGINT UNSIGNED NOT NULL AUTO_INCREMENT COMMENT '主键',
  \`order_no\` VARCHAR(64) NOT NULL COMMENT '订单号',
  \`amount\` DECIMAL(12,2) NOT NULL DEFAULT 0,
  \`status\` ENUM('open', 'paid', 'closed') NOT NULL DEFAULT 'open',
  \`paid_at\` DATETIME NULL,
  \`payload\` JSON,
  \`note\` TEXT,
  PRIMARY KEY (\`id\`),
  KEY \`idx_order_no\` (\`order_no\`),
  CONSTRAINT \`fk_order\` FOREIGN KEY (\`order_no\`) REFERENCES \`orders\` (\`order_no\`)
) ENGINE=InnoDB;
`

  it('CREATE TABLE 列定义:类型 → formtype / NOT NULL / COMMENT / ENUM', () => {
    const r = ingestSchema(SRC, 'sql-ddl')
    expect(r.name).toBe('OrderItems')
    const byProp = Object.fromEntries(r.fields.map((f) => [f.prop, f]))
    // 表级约束整条跳过,不当列。
    expect(Object.keys(byProp)).toEqual([
      'id', 'order_no', 'amount', 'status', 'paid_at', 'payload', 'note',
    ])
    expect(byProp.id).toMatchObject({ label: '主键', formtype: 'InputNumber', required: true })
    expect(byProp.order_no).toMatchObject({ label: '订单号', formtype: 'Input', required: true })
    expect(byProp.amount).toMatchObject({ formtype: 'InputNumber', required: true })
    expect(byProp.status).toMatchObject({ formtype: 'Select', required: true })
    expect(byProp.status.dataOptions).toEqual([
      { label: 'open', value: 'open' },
      { label: 'paid', value: 'paid' },
      { label: 'closed', value: 'closed' },
    ])
    expect(byProp.paid_at?.required).toBeUndefined()
    expect(byProp.paid_at).toMatchObject({ formtype: 'DatePicker' })
    expect(byProp.payload).toMatchObject({ formtype: 'Input' })
    expect(byProp.note).toMatchObject({ formtype: 'Input' })
    expect(r.warnings.join('\n')).toContain('JSON 对象')
  })

  it('PostgreSQL 风格 / 未知类型 → 告警兜底,不抛', () => {
    const r = ingestSchema(
      `
CREATE TABLE IF NOT EXISTS "public"."audit_log" (
  id SERIAL PRIMARY KEY,
  happened_at TIMESTAMPTZ NOT NULL,
  blob BYTEA,
  mystery GEOGRAPHY
);
`,
      'sql-ddl',
    )
    expect(r.name).toBe('AuditLog')
    expect(r.fields.map((f) => f.prop)).toEqual(['id', 'happened_at', 'blob', 'mystery'])
    expect(r.fields[0]?.required).toBe(true)
    expect(r.fields[1]).toMatchObject({ formtype: 'DatePicker', required: true })
    expect(r.fields[2]).toMatchObject({ formtype: 'Upload' })
    expect(r.fields[3]).toMatchObject({ formtype: 'Input' })
    expect(r.warnings.join('\n')).toContain('未能识别')
  })

  it('无 CREATE TABLE / 括号不完整 → 空 + 告警', () => {
    for (const text of ['SELECT 1', 'CREATE TABLE broken (id INT']) {
      const r = ingestSchema(text, 'sql-ddl')
      expect(r.fields).toEqual([])
      expect(r.warnings.length).toBeGreaterThan(0)
    }
  })
})

describe('ingestSchema — 非法输入', () => {
  it('非法 JSON → 告警,不抛', () => {
    const r = ingestSchema('{ not json', 'jsonSchema')
    expect(r.fields).toEqual([])
    expect(r.warnings.join('\n')).toContain('无法解析为 JSON')
  })
})

describe('golden 草稿 — 摄取层(ts-interface / sql-ddl)', () => {
  // 草稿独立于 eval 的 cases/(不改变 CRUD 语料分母),但必须真被消费——
  // 否则「加了草稿」只是摆设。
  const dir = fileURLToPath(new URL('../../../__tests__/golden/ingest/', import.meta.url))
  const files = readdirSync(dir)
    .filter((f) => f.endsWith('.json'))
    .sort()

  it('草稿目录至少两条,且覆盖 ts-interface / sql-ddl', () => {
    expect(files.length).toBeGreaterThanOrEqual(2)
    const kinds = files.map(
      (f) => (JSON.parse(readFileSync(join(dir, f), 'utf8')) as { kind: string }).kind,
    )
    expect(new Set(kinds)).toEqual(new Set(['ts-interface', 'sql-ddl']))
  })

  for (const file of files) {
    it(`${file} 与摄取结果一致`, () => {
      const draft = JSON.parse(readFileSync(join(dir, file), 'utf8')) as {
        kind: SchemaKind
        source: string
        expect: {
          name: string
          fields: Array<Record<string, unknown>>
          warningsContain: string[]
        }
      }
      const r = ingestSchema(draft.source, draft.kind)
      expect(r.name).toBe(draft.expect.name)
      expect(r.fields.map((f) => f.prop)).toEqual(draft.expect.fields.map((f) => f.prop))
      r.fields.forEach((f, i) => expect(f).toMatchObject(draft.expect.fields[i]!))
      for (const w of draft.expect.warningsContain) {
        expect(r.warnings.join('\n')).toContain(w)
      }
    })
  }
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

  it('ts-interface / sql-ddl 也落到可解析产物', () => {
    const sources: Record<string, string> = {
      'ts-interface': 'interface Product { id: number; title: string; onSale: boolean }',
      'sql-ddl': 'CREATE TABLE product (id INT NOT NULL, title VARCHAR(80), on_sale BOOLEAN)',
    }
    for (const [kind, text] of Object.entries(sources)) {
      const ingested = ingestSchema(text, kind as SchemaKind)
      expect(ingested.fields.length).toBe(3)
      // 输出恒 ∈ 契约集合——与 JSON 路径同一条不变量。
      for (const f of ingested.fields) {
        expect(VALID_FORM_TYPES).toContain(f.formtype)
      }

      const { config } = composeCrudConfig({
        name: ingested.name ?? 'IngestedPage',
        apiUrl: '/api/products',
        table: ingested.fields,
        form: ingested.fields,
      })
      const result = generateFromConfig(config)
      expect(() => transformSync(result.code, { loader: 'ts' })).not.toThrow()
    }
  })
})
