import { describe, it, expect } from 'vitest'
import { buildIngestDraft, INGEST_KINDS } from '../src/ingest-draft.js'
import { validateAndRepair } from '../src/validate-and-repair.js'

/**
 * `buildIngestDraft` 的守卫。
 *
 * 这个函数被两个宿主消费（MCP `ingest_schema` / CLI `es-plus ingest`），本包的单测是
 * 「两边共用同一份实现」这件事的自证：占位符、告警文案、以及「草稿必须是合法配置」
 * 这三条契约，改任何一条都必须在这里红。宿主侧的端到端测试另有覆盖，不代替这里。
 */

const OPENAPI = JSON.stringify({
  openapi: '3.0.0',
  info: { title: 'TicketApi' },
  components: {
    schemas: {
      Ticket: {
        type: 'object',
        required: ['id'],
        properties: {
          id: { type: 'integer', description: '主键' },
          title: { type: 'string', description: '标题' },
          done: { type: 'boolean', description: '已完成' },
        },
      },
    },
  },
})

describe('INGEST_KINDS', () => {
  it('与 ingestSchema 支持的形态一一对应（新增 kind 必须同步暴露）', () => {
    expect([...INGEST_KINDS]).toEqual([
      'openapi',
      'jsonSchema',
      'sample-json',
      'ts-interface',
      'sql-ddl',
    ])
  })
})

describe('buildIngestDraft — 摄取 → 草稿', () => {
  it('OpenAPI → 字段表 + 类型映射；显式 name/apiUrl 不打占位告警', () => {
    const { config, warnings } = buildIngestDraft({
      kind: 'openapi',
      text: OPENAPI,
      name: 'TicketList',
      apiUrl: '/api/tickets',
    })
    expect(config).toBeDefined()
    expect(config!.name).toBe('TicketList')
    expect(config!.apiUrl).toBe('/api/tickets')
    expect(config!.fields.map((f) => f.prop)).toEqual(['id', 'title', 'done'])
    expect(config!.fields.map((f) => f.formtype)).toEqual(['InputNumber', 'Input', 'Switch'])
    // required 来自 OpenAPI 的 required 数组
    expect(config!.fields.find((f) => f.prop === 'id')!.required).toBe(true)
    expect(warnings).toEqual([])
  })

  it('草稿必须能过 structured-crud-config 校验（否则「草拟」等于给用户一份坏配置）', () => {
    const { config } = buildIngestDraft({ kind: 'openapi', text: OPENAPI })
    const result = validateAndRepair(config)
    expect(result.valid).toBe(true)
  })

  it('name/apiUrl 缺省 → 占位值 + 各一条告警（文案含占位值，用户才能照抄替换）', () => {
    const { config, warnings } = buildIngestDraft({ kind: 'sample-json', text: '{"id":1,"name":"a"}' })
    expect(config).toBeDefined()
    expect(config!.apiUrl).toBe('/api/REPLACE_ME')
    expect(warnings.some((w) => w.includes('/api/REPLACE_ME'))).toBe(true)
    // 样例 JSON 推不出页面名 → 占位 IngestedPage 并告警
    expect(config!.name).toBe('IngestedPage')
    expect(warnings.some((w) => w.includes('IngestedPage'))).toBe(true)
  })

  it('抽取不到字段 → 不产出 config，只回告警（含手工兜底指引）', () => {
    const { config, warnings } = buildIngestDraft({ kind: 'jsonSchema', text: '{ not json' })
    expect(config).toBeUndefined()
    expect(warnings.length).toBeGreaterThan(0)
    expect(warnings.some((w) => w.includes('未能从该 schema 抽取任何字段'))).toBe(true)
  })

  it('ts-interface：JSDoc → label，非可选成员 → 必填', () => {
    const { config } = buildIngestDraft({
      kind: 'ts-interface',
      text: `interface User {
        /** 用户名 */
        name: string;
        /** 年龄 */
        age?: number;
      }`,
      name: 'UserList',
      apiUrl: '/api/users',
    })
    const byProp = new Map(config!.fields.map((f) => [f.prop, f]))
    expect(byProp.get('name')!.label).toBe('用户名')
    expect(byProp.get('name')!.required).toBe(true)
    expect(byProp.get('age')!.required).toBeFalsy()
  })
})
