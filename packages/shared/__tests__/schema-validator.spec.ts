// schema-validator.ts 此前零覆盖：它是 MCP `validate_config` 工具与文档站
// AiCrud 页共用的校验入口，但没有任何测试碰过它 —— 也就是说「文档承诺的
// 生成 → 校验 → 编译」里那一步，改坏了不会有人发现。
//
// 这里锁两件事：
//   1. 自带 schemas/ 目录下的真实行为（可用 schema 清单、合法/非法配置、错误措辞）
//   2. `generateSuggestions` 的四条分支 —— 它们只有在 additionalProperties:false
//      的 schema 上才会触发，而自带 schema 全是 additionalProperties:true，
//      所以必须走 createSchemaValidator(自定义目录) 才能验到。

import { describe, it, expect, beforeAll, afterAll } from 'vitest'
import { mkdtempSync, writeFileSync, rmSync, existsSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { createSchemaValidator, validateConfig, listAvailableSchemas } from '../src/schema-validator.js'

const VALID_ITEM = { prop: 'name', label: '姓名', formtype: 'Input' }

describe('schema-validator — 自带 schemas/ 目录', () => {
  it('列出 schemas/ 下的全部 schema，但不含 index.schema.json', () => {
    const names = listAvailableSchemas()
    expect(names).toContain('form-item')
    expect(names).toContain('table-column')
    expect(names).toContain('dialog-options')
    expect(names).not.toContain('index')
  })

  it('合法配置 → valid:true 且不带任何 errors/suggestions', () => {
    expect(validateConfig(VALID_ITEM, 'form-item')).toEqual({
      valid: true,
      errors: [],
      suggestions: [],
    })
  })

  it('不传 schemaType 时按 form-item 校验（而不是 table-column）', () => {
    // 用「缺 prop」这个输入来区分两个 schema：form-item 要求 prop + label，
    // table-column 什么都不要求。
    // 第一版断言用的是合法输入 { prop, label }并对照两次调用 —— 实测把默认值
    // 注入改成 'table-column' 后测试仍然全绿：两种 schema 都放行合法 form-item，
    // 分不出来，等于没断言。所以必须挑一个能区分两者的输入。
    const missingProp = { label: '姓名' }
    expect(validateConfig(missingProp).valid).toBe(false)
    expect(validateConfig(missingProp).errors.join('\n')).toContain(
      "must have required property 'prop'"
    )
    // 阳性对照：同一输入在 table-column 下确实合法 —— 证明这个输入真能区分两者
    expect(validateConfig(missingProp, 'table-column').valid).toBe(true)
  })

  it('缺必填字段 → 报错并给出 Add missing property 建议', () => {
    const res = validateConfig({ prop: 'name' }, 'form-item')
    expect(res.valid).toBe(false)
    expect(res.errors.join('\n')).toContain("must have required property 'label'")
    expect(res.suggestions).toContain('Add missing property "label"')
  })

  it('字段类型错 → 报错并指出期望类型', () => {
    const res = validateConfig({ prop: 123, label: '姓名' }, 'form-item')
    expect(res.valid).toBe(false)
    expect(res.suggestions.join('\n')).toContain('should be type "string"')
  })

  it('未知 schema 名 → 失败且在错误里列出可用名（便于排查拼写）', () => {
    const res = validateConfig({}, 'no-such-schema')
    expect(res.valid).toBe(false)
    expect(res.errors[0]).toContain('Schema "no-such-schema" not found')
    expect(res.errors[0]).toContain('form-item')
    expect(res.suggestions).toEqual(['Check schema name spelling'])
  })
})

describe('schema-validator — generateSuggestions 四条分支', () => {
  // 自带 schema 都是 additionalProperties:true，这四条分支只能靠自定义目录触发。
  let dir: string

  beforeAll(() => {
    dir = mkdtempSync(join(tmpdir(), 'es-plus-schema-'))
    writeFileSync(
      join(dir, 'strict.schema.json'),
      JSON.stringify({
        type: 'object',
        required: ['prop', 'mode'],
        additionalProperties: false,
        properties: {
          prop: { type: 'string' },
          mode: { type: 'string', enum: ['draft', 'published'] },
        },
      })
    )
    // 同时放一个 index.schema.json —— listAvailableSchemas 必须把它排除
    writeFileSync(join(dir, 'index.schema.json'), JSON.stringify({ type: 'object' }))
  })

  afterAll(() => rmSync(dir, { recursive: true, force: true }))

  it('required → Add missing property（多个缺失字段各自一条）', () => {
    const res = createSchemaValidator(dir).validateConfig({}, 'strict')
    expect(res.valid).toBe(false)
    expect(res.suggestions).toContain('Add missing property "prop"')
    expect(res.suggestions).toContain('Add missing property "mode"')
  })

  it('enum → 列出全部合法值', () => {
    const res = createSchemaValidator(dir).validateConfig({ prop: 'a', mode: 'nope' }, 'strict')
    expect(res.suggestions.join('\n')).toContain('Valid values for /mode: draft, published')
  })

  it('type → 指出出错路径与期望类型', () => {
    const res = createSchemaValidator(dir).validateConfig({ prop: 1, mode: 'draft' }, 'strict')
    expect(res.suggestions.join('\n')).toContain('/prop should be type "string"')
  })

  it('additionalProperties → 指出该删哪个键', () => {
    const res = createSchemaValidator(dir).validateConfig(
      { prop: 'a', mode: 'draft', extra: true },
      'strict'
    )
    expect(res.suggestions.join('\n')).toContain('Remove unknown property "extra"')
  })

  it('自定义目录里也排除 index.schema.json', () => {
    expect(createSchemaValidator(dir).listAvailableSchemas()).toEqual(['strict'])
  })

  it('两个实例互不共享 schema 缓存（关掉 A 的目录不影响 B）', () => {
    const other = mkdtempSync(join(tmpdir(), 'es-plus-schema-b-'))
    try {
      writeFileSync(join(other, 'b-only.schema.json'), JSON.stringify({ type: 'object' }))
      const a = createSchemaValidator(dir)
      const b = createSchemaValidator(other)
      expect(a.listAvailableSchemas()).toEqual(['strict'])
      expect(b.listAvailableSchemas()).toEqual(['b-only'])
    } finally {
      rmSync(other, { recursive: true, force: true })
    }
  })
})

describe('schema-validator — 坏输入下的降级', () => {
  let dir: string

  beforeAll(() => {
    dir = mkdtempSync(join(tmpdir(), 'es-plus-schema-bad-'))
    // 1) JSON 损坏的文件
    writeFileSync(join(dir, 'broken.schema.json'), '{ "type": "object",')
    // 2) 同一 $id 出现两次 —— 第二次 ajv.addSchema 会抛，必须被吞掉
    const dupId = { $id: 'https://example.test/dup.json', type: 'object' }
    writeFileSync(join(dir, 'dup-a.schema.json'), JSON.stringify(dupId))
    writeFileSync(join(dir, 'dup-b.schema.json'), JSON.stringify(dupId))
    // 3) 正常文件 —— 必须不受上面两个影响
    writeFileSync(
      join(dir, 'ok.schema.json'),
      JSON.stringify({ $id: 'https://example.test/ok.json', type: 'object', required: ['x'] })
    )
  })

  afterAll(() => rmSync(dir, { recursive: true, force: true }))

  it('目录不存在 → 清单为空、校验报 not found，且不抛', () => {
    const missing = createSchemaValidator(join(tmpdir(), 'es-plus-schema-definitely-absent'))
    expect(missing.listAvailableSchemas()).toEqual([])
    const res = missing.validateConfig({}, 'form-item')
    expect(res.valid).toBe(false)
    expect(res.errors[0]).toContain('not found')
  })

  it('损坏的 JSON / 重复 $id 都不拖垮同目录的正常 schema', () => {
    const v = createSchemaValidator(dir)
    expect(existsSync(join(dir, 'broken.schema.json'))).toBe(true)
    const res = v.validateConfig({ x: 1 }, 'ok')
    expect(res).toEqual({ valid: true, errors: [], suggestions: [] })
  })

  it('校验损坏的 schema 名 → 返回失败结果而不是抛异常', () => {
    const res = createSchemaValidator(dir).validateConfig({}, 'broken')
    expect(res.valid).toBe(false)
    expect(res.errors[0]).toContain('not found')
  })
})
