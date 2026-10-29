import { describe, it, expect, vi, afterEach } from 'vitest'
import { mkdtempSync, rmSync, readFileSync, writeFileSync, existsSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { detectIngestKind, isIngestKind, createIngestCommand } from '../src/commands/ingest'
import { buildIngestDraft } from '@es-plus/shared'

/**
 * `es-plus ingest` 的守卫。
 *
 * 三件事必须钉住：
 *  ① **形态推断**：--kind 缺省时按扩展名/内容判定；判错要能被单测看见（含 .yaml → openapi
 *    这条「明知本版不解析 YAML 也照样判 openapi」的有意选择）。
 *  ② **stdout 纯度**：草稿 JSON 之外的任何话都不得进 stdout，否则
 *    `es-plus ingest x.json > config.json` 会产出一份带装饰的坏文件。
 *  ③ **失败即非零**：文件不存在 / kind 拼错 / 抽取不到字段 —— 三种都必须 exitCode=1，
 *    而不是「打印了一段红字但退出码 0」（脚本里等于静默成功）。
 */

const OPENAPI = JSON.stringify({
  openapi: '3.0.0',
  info: { title: 'TicketApi' },
  paths: {},
  components: {
    schemas: {
      Ticket: {
        type: 'object',
        properties: {
          id: { type: 'integer', description: '主键' },
          title: { type: 'string', description: '标题' },
          done: { type: 'boolean', description: '已完成' },
        },
        required: ['id'],
      },
    },
  },
})

const TMP = () => mkdtempSync(join(tmpdir(), 'es-plus-ingest-'))

function silence() {
  return {
    log: vi.spyOn(console, 'log').mockImplementation(() => {}),
    error: vi.spyOn(console, 'error').mockImplementation(() => {}),
  }
}

describe('ingest.detectIngestKind — 形态推断', () => {
  it('.sql → sql-ddl', () => {
    expect(detectIngestKind('t.sql', 'CREATE TABLE t (id INT);').kind).toBe('sql-ddl')
  })
  it('.ts → ts-interface', () => {
    expect(detectIngestKind('model.ts', 'interface T { id: number }').kind).toBe('ts-interface')
  })
  it('.yaml → openapi（本版不解析 YAML，仍按 openapi 判，让摄取层给出可执行的告警）', () => {
    const r = detectIngestKind('api.yaml', 'openapi: 3.0.0')
    expect(r.kind).toBe('openapi')
    expect(r.reason).toContain('YAML')
  })
  it('JSON 顶层 openapi → openapi', () => {
    expect(detectIngestKind('a.json', OPENAPI).kind).toBe('openapi')
  })
  it('JSON 顶层 swagger → openapi', () => {
    expect(detectIngestKind('a.json', '{"swagger":"2.0"}').kind).toBe('openapi')
  })
  it('JSON 顶层 $schema → jsonSchema', () => {
    expect(detectIngestKind('a.json', '{"$schema":"x","type":"object"}').kind).toBe('jsonSchema')
  })
  it('type:"object" + properties → jsonSchema', () => {
    expect(
      detectIngestKind('a.json', '{"type":"object","properties":{"id":{"type":"integer"}}}').kind
    ).toBe('jsonSchema')
  })
  it('普通业务对象（哪怕有 properties 字段）→ sample-json', () => {
    // 单看 `properties` 键会误判：业务数据里就可能有叫 properties 的字段。
    expect(detectIngestKind('a.json', '{"properties":{"a":1},"id":2}').kind).toBe('sample-json')
  })
  it('顶层数组 → sample-json', () => {
    expect(detectIngestKind('a.json', '[{"id":1}]').kind).toBe('sample-json')
  })
  it('未知扩展名 + 内容含 CREATE TABLE → sql-ddl', () => {
    expect(detectIngestKind('schema.txt', 'create table t (id int);').kind).toBe('sql-ddl')
  })
  it('未知扩展名 + 非 JSON 非 DDL → sample-json（交给摄取层报解析告警）', () => {
    expect(detectIngestKind('mystery.dat', 'hello').kind).toBe('sample-json')
  })
})

describe('ingest.isIngestKind — --kind 参数校验', () => {
  it('接受全部受支持值', () => {
    for (const k of ['openapi', 'jsonSchema', 'sample-json', 'ts-interface', 'sql-ddl']) {
      expect(isIngestKind(k)).toBe(true)
    }
  })
  it('拒绝拼错/未知值（不静默回落）', () => {
    expect(isIngestKind('OpenAPI')).toBe(false)
    expect(isIngestKind('json-schema')).toBe(false)
    expect(isIngestKind('')).toBe(false)
  })
})

describe('ingest 命令 — 端到端（parseAsync）', () => {
  afterEach(() => {
    vi.restoreAllMocks()
  })

  it('OpenAPI JSON → stdout 只有可解析的草稿 JSON', async () => {
    const dir = TMP()
    const prevExit = process.exitCode
    const file = join(dir, 'api.json')
    writeFileSync(file, OPENAPI)
    const s = silence()
    try {
      await createIngestCommand().parseAsync(['node', 'ingest', file, '--name', 'TicketList', '-a', '/api/tickets'])
      expect(process.exitCode ?? 0).toBe(0)

      expect(s.log).toHaveBeenCalledTimes(1)
      // stdout 纯度：整段必须能 JSON.parse，且字段来自 schema
      const config = JSON.parse(s.log.mock.calls[0][0] as string)
      expect(config.name).toBe('TicketList')
      expect(config.apiUrl).toBe('/api/tickets')
      expect(config.fields.map((f: { prop: string }) => f.prop)).toEqual(['id', 'title', 'done'])

      // 人话（推断说明/下一步）走 stderr，不污染 stdout
      const errText = s.error.mock.calls.map((c: unknown[]) => c.join(' ')).join('\n')
      expect(errText).toContain('下一步')
    } finally {
      process.exitCode = prevExit
      rmSync(dir, { recursive: true, force: true })
    }
  })

  it('--output 写盘，且与 stdout 用法产出相同 JSON', async () => {
    const dir = TMP()
    const prevExit = process.exitCode
    const file = join(dir, 'api.json')
    const out = join(dir, 'out', 'config.json')
    writeFileSync(file, OPENAPI)
    const s = silence()
    try {
      await createIngestCommand().parseAsync([
        'node', 'ingest', file, '--name', 'TicketList', '-a', '/api/tickets', '-o', out,
      ])
      expect(process.exitCode ?? 0).toBe(0)
      expect(existsSync(out)).toBe(true)

      const toStdout = TMP()
      try {
        s.log.mockClear()
        const f2 = join(toStdout, 'api.json')
        writeFileSync(f2, OPENAPI)
        await createIngestCommand().parseAsync([
          'node', 'ingest', f2, '--name', 'TicketList', '-a', '/api/tickets',
        ])
        expect(readFileSync(out, 'utf-8')).toBe((s.log.mock.calls[0][0] as string) + '\n')
      } finally {
        rmSync(toStdout, { recursive: true, force: true })
      }
    } finally {
      process.exitCode = prevExit
      rmSync(dir, { recursive: true, force: true })
    }
  })

  it('文件不存在 → exitCode 1，且不写任何输出', async () => {
    const dir = TMP()
    const prevExit = process.exitCode
    const s = silence()
    try {
      await createIngestCommand().parseAsync(['node', 'ingest', join(dir, 'nope.json')])
      expect(process.exitCode).toBe(1)
      expect(s.log).not.toHaveBeenCalled()
    } finally {
      process.exitCode = prevExit
      rmSync(dir, { recursive: true, force: true })
    }
  })

  it('--kind 拼错 → exitCode 1（不静默回落成推断值）', async () => {
    const dir = TMP()
    const prevExit = process.exitCode
    const file = join(dir, 'api.json')
    writeFileSync(file, OPENAPI)
    const s = silence()
    try {
      await createIngestCommand().parseAsync(['node', 'ingest', file, '--kind', 'OpenAPI'])
      expect(process.exitCode).toBe(1)
      expect(s.log).not.toHaveBeenCalled()
      expect(s.error.mock.calls.map((c: unknown[]) => c.join(' ')).join('\n')).toContain('未知 kind')
    } finally {
      process.exitCode = prevExit
      rmSync(dir, { recursive: true, force: true })
    }
  })

  it('抽取不到字段（YAML）→ exitCode 1 且点名 kind 选项', async () => {
    const dir = TMP()
    const prevExit = process.exitCode
    const file = join(dir, 'api.yaml')
    writeFileSync(file, 'openapi: 3.0.0')
    const s = silence()
    try {
      await createIngestCommand().parseAsync(['node', 'ingest', file])
      expect(process.exitCode).toBe(1)
      expect(s.log).not.toHaveBeenCalled()
      const errText = s.error.mock.calls.map((c: unknown[]) => c.join(' ')).join('\n')
      expect(errText).toContain('无法从该 schema 草拟配置')
      expect(errText).toContain('可用 kind')
    } finally {
      process.exitCode = prevExit
      rmSync(dir, { recursive: true, force: true })
    }
  })

  it('SQL DDL 按扩展名摄取（.sql 无需 --kind）', async () => {
    const dir = TMP()
    const prevExit = process.exitCode
    const file = join(dir, 'user.sql')
    writeFileSync(
      file,
      `CREATE TABLE user (
        id INT PRIMARY KEY COMMENT '主键',
        email VARCHAR(128) NOT NULL COMMENT '邮箱'
      );`
    )
    const s = silence()
    try {
      await createIngestCommand().parseAsync(['node', 'ingest', file, '--name', 'UserList'])
      expect(process.exitCode ?? 0).toBe(0)
      const config = JSON.parse(s.log.mock.calls[0][0] as string)
      expect(config.fields.map((f: { prop: string }) => f.prop)).toEqual(['id', 'email'])
    } finally {
      process.exitCode = prevExit
      rmSync(dir, { recursive: true, force: true })
    }
  })
})

describe('buildIngestDraft — CLI 与 MCP 共用的草稿契约', () => {
  it('未给 name/apiUrl 时产出占位值并各发一条告警（CLI 与 MCP 同源，不得分叉）', () => {
    const { config, warnings } = buildIngestDraft({
      kind: 'sample-json',
      text: '{"id":1,"title":"a"}',
    })
    expect(config).toBeDefined()
    expect(config!.apiUrl).toBe('/api/REPLACE_ME')
    expect(warnings.some((w) => w.includes('/api/REPLACE_ME'))).toBe(true)
    expect(warnings.some((w) => w.includes('IngestedPage'))).toBe(true)
  })
})
