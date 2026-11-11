import { describe, it, expect } from 'vitest'
import { generateFromConfig, type StructuredCrudConfig } from '../src/structured-generator.js'
import {
  buildPageSource,
  configToSurfaces,
  readPageSource,
  stripPageSourceArtifact,
  PAGE_SOURCE_CONTRACT,
  PAGE_SOURCE_KEY,
} from '../src/page-source.js'

/**
 * W4 回读闭环 —— 往返。
 *
 * 出口标准不是「能解析」，而是**往返**：同一份产物读回配置后重新生成，必须逐字节相同。
 * 若只断言「读回成功」，配置里悄悄多一个键、少一个键都测不出来；只有把读回的配置再喂回
 * 生成器、比对全文，才证明「出处 = 生成器当时的输入」这句话真的成立。
 */

const base = { name: 'UserManage', apiUrl: '/api/users', target: 'vue3' as const }

function schemaConfig(extra: Record<string, unknown> = {}): StructuredCrudConfig {
  return {
    ...base,
    mode: 'schema',
    fields: [
      { prop: 'name', label: '姓名', formtype: 'Input' },
      { prop: 'status', label: '状态', formtype: 'Select', dataOptions: [{ label: '启用', value: 1 }] },
      { prop: 'createdAt', label: '创建时间', formtype: 'DatePicker', inForm: false },
    ],
    actions: ['add', 'edit', 'delete'],
    ...extra,
  } as StructuredCrudConfig
}

describe('readPageSource — schema 模式往返', () => {
  const config = schemaConfig()
  const result = generateFromConfig(config)
  const read = readPageSource(result.code, 'schema.ts')

  it('产物里带出处，且能被读回', () => {
    expect(result.code).toContain(`"${PAGE_SOURCE_KEY}"`)
    expect(read.ok).toBe(true)
  })

  it('读回的 config 就是生成器当时生效的输入（JSON 投影）', () => {
    if (!read.ok) throw new Error(read.error)
    expect(read.source.contract).toBe(PAGE_SOURCE_CONTRACT)
    expect(read.source.mode).toBe('schema')
    expect(read.source.target).toBe('vue3')
    expect(read.source.config).toEqual(JSON.parse(JSON.stringify(config)))
  })

  it('用读回的 config 重新生成 → 逐字节相同（生成器是出处的逆函数）', () => {
    if (!read.ok) throw new Error(read.error)
    const again = generateFromConfig(read.source.config as unknown as StructuredCrudConfig)
    expect(again.code).toBe(result.code)
  })

  it('没有可报的损失时 lossy 为空', () => {
    if (!read.ok) throw new Error(read.error)
    expect(read.source.lossy).toEqual([])
  })
})

describe('readPageSource — sfc 模式往返', () => {
  const config = {
    ...schemaConfig(),
    mode: 'sfc' as const,
    dialogs: {
      edit: { title: '编辑', formItems: [{ prop: 'name', label: '姓名', formtype: 'Input' }] },
    },
  } as StructuredCrudConfig
  const result = generateFromConfig(config)
  const read = readPageSource(result.code, 'Page.vue')

  it('出处以单行注释写在 <script> 内，且能被读回', () => {
    expect(result.code).toContain(`// ${PAGE_SOURCE_KEY}: `)
    expect(read.ok).toBe(true)
    if (!read.ok) return
    expect(read.source.mode).toBe('sfc')
  })

  it('sfc 模式不消费 dialogs / tableBtns → 逐条记入 ignored-in-mode', () => {
    if (!read.ok) throw new Error(read.error)
    const dialogLossy = read.source.lossy.find((l) => l.path === 'dialogs')
    expect(dialogLossy?.kind).toBe('ignored-in-mode')
  })

  it('用读回的 config 重新生成 → 逐字节相同', () => {
    if (!read.ok) throw new Error(read.error)
    const again = generateFromConfig(read.source.config as unknown as StructuredCrudConfig)
    expect(again.code).toBe(result.code)
  })
})

describe('readPageSource — lossy[] 是机器可读的真话', () => {
  it('未知键：产物里没有，lossy 里点名（dropped）', () => {
    const config = schemaConfig({
      fields: [
        { prop: 'name', label: '姓名', formtype: 'Input', widht: 120 },
        { prop: 'status', label: '状态', formtype: 'Select' },
      ],
    })
    const read = readPageSource(generateFromConfig(config).code)
    expect(read.ok).toBe(true)
    if (!read.ok) return
    const entry = read.source.lossy.find((l) => l.path === 'fields[0].widht')
    expect(entry?.kind).toBe('dropped')
    // 真的被剔掉了 —— 不是「只在告警里提一句」
    expect(read.source.config.fields).toEqual([
      { prop: 'name', label: '姓名', formtype: 'Input' },
      { prop: 'status', label: '状态', formtype: 'Select' },
    ])
  })

  it('schema 模式不消费 permissions → ignored-in-mode（产物有效，只是不生效）', () => {
    const config = schemaConfig({ permissions: { add: 'user:add', delete: 'user:delete' } })
    const read = readPageSource(generateFromConfig(config).code)
    expect(read.ok).toBe(true)
    if (!read.ok) return
    const entry = read.source.lossy.find((l) => l.path === 'permissions')
    expect(entry?.kind).toBe('ignored-in-mode')
  })

  it('行内 formatter（schema 模式）→ not-expressible，但配置值随出处保留', () => {
    const config = schemaConfig({
      fields: [
        { prop: 'name', label: '姓名', formtype: 'Input', formatter: '(row) => row.name.toUpperCase()' },
      ],
    })
    const read = readPageSource(generateFromConfig(config).code)
    expect(read.ok).toBe(true)
    if (!read.ok) return
    const entry = read.source.lossy.find((l) => l.path === 'fields[0].formatter')
    expect(entry?.kind).toBe('not-expressible')
    // 出处是配置不是产物：函数串还在，宿主改完能重新生成
    expect((read.source.config.fields as any)[0].formatter).toContain('toUpperCase')
  })

  it('归一/修复 → normalized（读回的是生效后的值）', () => {
    // `rowkey` 是 AN-07 的顶层别名，归一进 tableOptions.rowkey（rename 的路径带前导斜杠）。
    const config = schemaConfig({ rowkey: 'userId' })
    const read = readPageSource(generateFromConfig(config).code)
    expect(read.ok).toBe(true)
    if (!read.ok) return
    const entry = read.source.lossy.find((l) => l.kind === 'normalized' && l.path.includes('rowkey'))
    expect(entry).toBeDefined()
    expect((read.source.config.tableOptions as any)?.rowkey).toBe('userId')
  })
})

describe('readPageSource — 转义与错误路径', () => {
  it('label 里带 } / </script> 不破坏切分（字符串感知的括号配平 + inlineJson 转义）', () => {
    const config = schemaConfig({
      fields: [{ prop: 'name', label: '名称 } </script> "quoted"', formtype: 'Input' }],
    })
    for (const mode of ['schema', 'sfc'] as const) {
      const result = generateFromConfig({ ...config, mode } as StructuredCrudConfig)
      // sfc 的注释行必须仍是一行（JSON 里的换行已转义）
      if (mode === 'sfc') {
        const line = result.code.split('\n').find((l) => l.includes(`// ${PAGE_SOURCE_KEY}:`))!
        expect(line).toBeDefined()
        expect(JSON.parse(line.slice(line.indexOf(':') + 1))).toBeTruthy()
      }
      const read = readPageSource(result.code)
      expect(read.ok, `${mode}: ${read.ok ? '' : read.error}`).toBe(true)
      if (!read.ok) continue
      expect((read.source.config.fields as any)[0].label).toBe('名称 } </script> "quoted"')
    }
  })

  it('没有出处的页面（W4 之前 / 手写）→ 明确报错 + 提示，不反推', () => {
    const handwritten = `import { createApp } from 'vue'\nexport const pageSchema = { columns: [{ prop: 'name' }] }\n`
    const read = readPageSource(handwritten, 'Page.vue')
    expect(read.ok).toBe(false)
    if (read.ok) return
    expect(read.error).toContain('找不到页面出处标记')
    expect(read.hint).toContain('ingest_schema')
  })

  it('出处协议版本不认 → 报错而不是猜字段', () => {
    const bogus = `export const pageSchema = ${JSON.stringify({
      columns: [],
      __esPlusSource: { contract: 'es-plus.page-source@0', config: {}, lossy: [] },
    })}`
    const read = readPageSource(bogus)
    expect(read.ok).toBe(false)
    if (read.ok) return
    expect(read.error).toContain('es-plus.page-source@0')
  })

  it('空输入 → 报错', () => {
    expect(readPageSource('').ok).toBe(false)
    expect(readPageSource('   ').ok).toBe(false)
  })
})

describe('buildPageSource — 构造侧', () => {
  it('JSON 投影不碰调用方的 config（pruneUnknown 曾误删原对象）', () => {
    const config: any = {
      name: 'X',
      apiUrl: '/api/x',
      fields: [{ prop: 'a', label: 'A', formtype: 'Input', widht: 1 }],
    }
    const source = buildPageSource({
      target: 'vue3',
      mode: 'schema',
      config,
      unknownKeys: [{ path: ['fields', 0], key: 'widht' }],
    })
    expect((source.config.fields as any)[0].widht).toBeUndefined()
    expect(config.fields[0].widht).toBe(1)
  })
})

describe('configToSurfaces — 回读 → 前门意图表', () => {
  const config: any = {
    name: 'UserManage',
    apiUrl: '/api/users',
    target: 'vue3',
    fields: [
      { prop: 'name', label: '姓名', formtype: 'Input', inQuery: true, inTable: true, inForm: true },
      { prop: 'status', label: '状态', formtype: 'Select', inQuery: false, inTable: true, inForm: true },
      { prop: 'createdAt', label: '创建时间', formtype: 'DatePicker', inQuery: false, inTable: true, inForm: false },
    ],
    dialogs: {
      edit: { title: '编辑', width: 600, formItems: [{ prop: 'name', label: '姓名', formtype: 'Input' }] },
    },
    tableOptions: { rowKey: 'id' },
    mode: 'schema',
    typescript: true,
  }

  it('成员关系由 inQuery/inTable/inForm 决定，成员布尔不进 surfaces 词表', () => {
    const { intent } = configToSurfaces(config)
    const surfaces = intent.surfaces as any
    expect(surfaces.query.map((f: any) => f.prop)).toEqual(['name'])
    expect(surfaces.table.map((f: any) => f.prop)).toEqual(['name', 'status', 'createdAt'])
    expect(surfaces.form.map((f: any) => f.prop)).toEqual(['name', 'status'])
    expect(surfaces.dialog).toEqual([
      { key: 'edit', title: '编辑', width: 600, formItems: [{ prop: 'name', label: '姓名', formtype: 'Input' }] },
    ])
    for (const f of surfaces.table) {
      expect(f).not.toHaveProperty('inTable')
      expect(f).not.toHaveProperty('inQuery')
      expect(f).not.toHaveProperty('inForm')
    }
    // 显式旋钮原样透传
    expect(intent.tableOptions).toEqual({ rowKey: 'id' })
    expect(intent.mode).toBe('schema')
    expect(intent.typescript).toBe(true)
  })

  it('显式 columns 没有 surfaces 通道 → not-expressible（不静默丢）', () => {
    const { intent, lossy } = configToSurfaces({ ...config, columns: [{ prop: 'name', label: '姓名' }] })
    expect(lossy).toHaveLength(1)
    expect(lossy[0]).toMatchObject({ path: 'columns', kind: 'not-expressible' })
    // 丢了列，但字段仍在 —— 宿主至少能拿回 fields 派生的那部分
    expect((intent.surfaces as any).table).toHaveLength(3)
  })

  it('弹窗底座键与 DialogBlockOptionsSchema 同源（不再只留 width/fullscreen）', () => {
    const { intent, lossy } = configToSurfaces({
      ...config,
      dialogs: {
        edit: {
          title: '编辑',
          maxHeight: '80vh',
          destroyOnClose: true,
          closeOnClickModal: false,
          formItems: [{ prop: 'name', label: '姓名', formtype: 'Input' }],
          formLayout: { labelWidth: '100px' }, // 底座 pick 之外 → 必须点名
        },
      },
    })
    const dialog = (intent.surfaces as any).dialog[0]
    expect(dialog).toMatchObject({ key: 'edit', title: '编辑', maxHeight: '80vh', destroyOnClose: true, closeOnClickModal: false })
    expect(lossy).toContainEqual(expect.objectContaining({ path: 'dialogs.edit.formLayout', kind: 'not-expressible' }))
  })
})

describe('readPageSource — TypeScript 产物（回归：首个 `{` 是 import 解构）', () => {
  it('默认 schema 产物（typescript:true）能读回', () => {
    const code = generateFromConfig(schemaConfig({ typescript: true })).code
    expect(code.startsWith('import type { CrudPageSchema }')).toBe(true)
    const read = readPageSource(code, 'schema.ts')
    expect(read.ok, read.ok ? '' : read.error).toBe(true)
    if (!read.ok) return
    expect((read.source.config.fields as any)[0].prop).toBe('name')
  })

  it('JS 产物与 SFC 产物仍能读回', () => {
    expect(readPageSource(generateFromConfig(schemaConfig({ typescript: false })).code).ok).toBe(true)
    expect(readPageSource(generateFromConfig(schemaConfig({ mode: 'sfc' })).code).ok).toBe(true)
  })
})

describe('stripPageSourceArtifact — 度量/哨兵前先剔除出处', () => {
  it('schema（JS 与 TS）都删掉出处属性，且仍是合法 pageSchema', () => {
    for (const typescript of [false, true]) {
      const code = generateFromConfig(schemaConfig({ typescript })).code
      const stripped = stripPageSourceArtifact(code)
      expect(stripped).not.toContain(PAGE_SOURCE_KEY)
      // 剩下的对象仍可 JSON.parse（TS 模式的第一个 `{` 是 import 解构，要从 `pageSchema` 后切）
      const objText = stripped.slice(stripped.indexOf('pageSchema'))
      expect(() => JSON.parse(objText.slice(objText.indexOf('{')))).not.toThrow()
    }
  })

  it('sfc 删掉整行注释', () => {
    const code = generateFromConfig(schemaConfig({ mode: 'sfc' })).code
    expect(stripPageSourceArtifact(code)).not.toContain(`// ${PAGE_SOURCE_KEY}:`)
  })

  it('没有出处时原样返回（不猜）', () => {
    expect(stripPageSourceArtifact('export const pageSchema = { a: 1 }')).toBe('export const pageSchema = { a: 1 }')
  })
})

describe('modeLossy — 弹窗表单项里的行内函数', () => {
  it('dialogs.*.formItems[].render 必须点名（不能只查顶层 fields）', () => {
    const config = schemaConfig({
      dialogs: {
        add: {
          title: '新增',
          formItems: [
            { prop: 'name', label: '姓名', formtype: 'Input', render: '(h, item) => h("b", item.label)' },
          ],
        },
      },
    })
    const read = readPageSource(generateFromConfig(config).code)
    expect(read.ok).toBe(true)
    if (!read.ok) return
    const entry = read.source.lossy.find((l) => l.path === 'dialogs.add.formItems[0].render')
    expect(entry?.kind).toBe('not-expressible')
  })
})
