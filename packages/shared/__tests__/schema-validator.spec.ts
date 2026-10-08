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
import { mkdtempSync, writeFileSync, rmSync, existsSync, readdirSync, mkdirSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join, dirname } from 'node:path'
import { fileURLToPath } from 'node:url'
import { createSchemaValidator, validateConfig, listAvailableSchemas } from '../src/schema-validator.js'

// 本文件是 ESM（package.json type:module），没有 __dirname
const here = dirname(fileURLToPath(import.meta.url))

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

  // formtype 的 camelCase 旧别名必须在枚举里：三端运行时都先过 normalizeFormType
  // （core 单源）把 datePicker/timePicker 归一化成 DatePicker/TimePicker，
  // form-item.schema.json 的 describe 也写着 "deprecated but still accepted"。
  // 枚举若只列 14 个 PascalCase，就会出现「文档承认、运行时生效、校验判非法」——
  // 而校验器正是 MCP validate_config 与文档站 AiCrud 页的唯一判定入口。
  it('接受 formtype 的 camelCase 旧别名（运行时由 normalizeFormType 归一化）', () => {
    for (const formtype of ['datePicker', 'timePicker']) {
      expect(validateConfig({ ...VALID_ITEM, formtype }, 'form-item')).toEqual({
        valid: true,
        errors: [],
        suggestions: [],
      })
    }
  })

  // 反面：放行别名不等于放行任意字符串（防止"把枚举删空"这种假修复）。
  it('仍然拒绝真正未知的 formtype', () => {
    const res = validateConfig({ ...VALID_ITEM, formtype: 'NotAFormType' }, 'form-item')
    expect(res.valid).toBe(false)
  })

  it('不传 schemaType 时按 form-item 校验（而不是 table-column）', () => {
    // 判别输入必须**只在 table-column 下合法**：form-item 要求 prop + label，
    // table-column 只要求「可寻址」（prop / key / type / groups 任一）。
    // 所以 { prop: 'name' } 正好落在两者之间 —— 若默认值被改成 'table-column'，
    // 下面第一条断言立刻会拿到 valid:true 而失败。
    //
    // 第一版断言用的是合法输入 { prop, label } 并对照两次调用 —— 实测把默认值
    // 注入改成 'table-column' 后测试仍然全绿：两种 schema 都放行合法 form-item，
    // 分不出来，等于没断言。所以必须挑一个能区分两者的输入。
    //
    // 更早的一版用的是 { label: '姓名' }（当时 table-column 什么都放行）；table-column
    // 补上 anyOf 后该输入在两种 schema 下都非法，同样分不出来，故一并换掉。
    const onlyTableColumn = { prop: 'name' }
    expect(validateConfig(onlyTableColumn).valid).toBe(false)
    expect(validateConfig(onlyTableColumn).errors.join('\n')).toContain(
      "must have required property 'label'"
    )
    // 阳性对照：同一输入在 table-column 下确实合法 —— 证明这个输入真能区分两者
    expect(validateConfig(onlyTableColumn, 'table-column').valid).toBe(true)
  })

  it('table-column 只要求「可寻址」：prop / key / type / groups 任一即可', () => {
    // 这四种形态都在真实配置里出现过，必须全部放行 —— 漏掉任何一种，IDE 与
    // Playground 的 monaco 都会给合法配置标红：
    //   prop    ← 普通数据列
    //   key     ← 文档化的 prop 替代字段（es-table 内部按 `cols.prop || cols.key` 取值）
    //   type    ← selection / expand / index 内置列，本就没有数据字段
    //   groups  ← 多级表头分组列（如 es-pc/src/views/es-vxe/MergeCells.vue）
    for (const col of [
      { prop: 'name' },
      { key: 'operate' },
      { type: 'selection', width: 50 },
      { label: '组织架构', groups: [{ prop: 'dept', label: '事业部' }] },
    ]) {
      expect(validateConfig(col, 'table-column').valid, JSON.stringify(col)).toBe(true)
    }

    // 反面：四种都没有的列什么也渲染不出来，必须判红（此前 {} 是通过的）
    for (const col of [{}, { label: '姓名' }, { width: 120 }]) {
      expect(validateConfig(col, 'table-column').valid, JSON.stringify(col)).toBe(false)
    }
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

  it('可用名清单与实际 schemas/*.schema.json 文件集一致（只排除 index）', () => {
    // 清单不能是手写常量：漏一个名字 = 那个 schema 拿不到；多一个名字 = 报错时教错人。
    const files = readdirSync(join(here, '../schemas'))
      .filter((f) => f.endsWith('.schema.json') && f !== 'index.schema.json')
      .map((f) => f.replace('.schema.json', ''))
      .sort()
    expect([...listAvailableSchemas()].sort()).toEqual(files)
  })

  it('anyOf 失败 → 建议里列出「至少要满足哪几种形态」', () => {
    // table-column 已收紧为 anyOf[prop, key, type, groups]；默认措辞
    // "must match a schema in anyOf" 对使用者等于什么都没说。
    const res = validateConfig({ label: '姓名' }, 'table-column')
    expect(res.valid).toBe(false)
    expect(res.suggestions.join('\n')).toContain(
      '(root) must satisfy at least one of: prop | key | type | groups'
    )
  })
})

describe('schema-validator — schema 名不得越出 schemasDir', () => {
  // schemaName 来自外部输入（CLI 的 --schema、MCP validate_config 的 type）。
  // 修之前是直接 `join(dir, name + '.schema.json')`：`../outside` 会把沙箱外的文件
  // 当 schema 读进来。这里把「沙箱外」造出来，断言它既读不到、也走 not-found 路径。
  let parent: string

  beforeAll(() => {
    parent = mkdtempSync(join(tmpdir(), 'es-plus-schema-escape-'))
    mkdirSync(join(parent, 'inner'), { recursive: true })
    // 目录之外（inner 的上一级）放一份合法 schema + 一份合法数据
    writeFileSync(
      join(parent, 'outside.schema.json'),
      JSON.stringify({ type: 'object', required: ['secret'] })
    )
    writeFileSync(join(parent, 'inner', 'inside.schema.json'), JSON.stringify({ type: 'object' }))
  })

  afterAll(() => rmSync(parent, { recursive: true, force: true }))

  it('目录外的 ../outside 读取不到，按 not found 处理', () => {
    const v = createSchemaValidator(join(parent, 'inner'))
    const res = v.validateConfig({}, '../outside')
    expect(res.valid).toBe(false)
    expect(res.errors[0]).toContain('not found')
    // 阳性对照：同目录内的名字读得到 —— 证明拦截的是「越界」而不是「文件不存在」
    expect(v.validateConfig({}, 'inside').valid).toBe(true)
  })
})

describe('schema-validator — schema 自身有病时不把异常抛给调用方', () => {
  let dir: string

  beforeAll(() => {
    dir = mkdtempSync(join(tmpdir(), 'es-plus-schema-badref-'))
    // 合法的 JSON、非法的 schema：$ref 指向不存在的定义 → ajv.compile 会抛
    writeFileSync(
      join(dir, 'badref.schema.json'),
      JSON.stringify({ type: 'object', properties: { a: { $ref: '#/definitions/nope' } } })
    )
    // 递归 schema —— 用来触发应用阶段的栈溢出（RangeError）
    writeFileSync(
      join(dir, 'recursive.schema.json'),
      JSON.stringify({
        type: 'object',
        properties: { next: { $ref: '#' } },
        additionalProperties: true,
      })
    )
  })

  afterAll(() => rmSync(dir, { recursive: true, force: true }))

  it('无法解析的 $ref → 返回失败结果而不是抛', () => {
    const res = createSchemaValidator(dir).validateConfig({ a: 1 }, 'badref')
    expect(res.valid).toBe(false)
    expect(res.errors[0]).toContain('could not be applied')
  })

  it('嵌套过深撞上递归上限 → 返回失败结果而不是抛 RangeError', () => {
    // 造一条几万层的链，确保真的越过调用栈上限
    let deep: any = { next: null }
    for (let i = 0; i < 60000; i++) deep = { next: deep }
    expect(() => createSchemaValidator(dir).validateConfig(deep, 'recursive')).not.toThrow()
    const res = createSchemaValidator(dir).validateConfig(deep, 'recursive')
    expect(res.valid).toBe(false)
    expect(res.errors[0]).toContain('could not be applied')
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
