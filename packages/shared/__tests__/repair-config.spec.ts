import { describe, it, expect } from 'vitest'
import { repairConfig } from '../src/repair-config.js'
import { validateAndRepair } from '../src/validate-and-repair.js'
import { generateFromConfig } from '../src/structured-generator.js'

/**
 * AN-24 —— 确定性修复环。
 *
 * 每一条修复都盯三件事：**改对了**、**只在有据可查时改**、**不把配置改坏**。
 * 另外单独钉住与 `validate_config` 的分工：修复环不改变校验器「只判不改」的边界。
 */

const FIELD = { prop: 'name', label: '名称', formtype: 'Input' }

function base(extra: Record<string, unknown> = {}) {
  return {
    name: 'Demo',
    apiUrl: '/api/demo',
    actions: ['add', 'edit'],
    fields: [{ ...FIELD }],
    ...extra,
  }
}

describe('repairConfig — null 视为未声明', () => {
  it('删除可选键上的 null（顶层 / 字段 / tableOptions）', () => {
    const { config, repairs } = repairConfig(
      base({
        formLayout: null,
        fields: [{ ...FIELD, dataOptions: null }],
        tableOptions: { border: null, rowkey: null },
      }),
    )
    const c = config as any
    expect(c.formLayout).toBeUndefined()
    expect('dataOptions' in c.fields[0]).toBe(false)
    expect(c.tableOptions).toEqual({})
    expect(repairs.map((r) => r.path).sort()).toEqual([
      '/fields/0/dataOptions',
      '/formLayout',
      '/tableOptions/border',
      '/tableOptions/rowkey',
    ])
    expect(repairs.every((r) => r.kind === 'remove-null')).toBe(true)
  })

  it('必填键上的 null 不删除（删掉只是把「类型错」换成「缺失」，不算修复）', () => {
    const { config, repairs } = repairConfig(base({ name: null }))
    expect((config as any).name).toBeNull()
    expect(repairs.map((r) => r.path)).not.toContain('/name')
  })

  it('嵌套的弹窗可选键同样清理', () => {
    const { config } = repairConfig(
      base({
        dialogs: { add: { title: null, formItems: [{ ...FIELD, required: null }] } },
      }),
    )
    const dlg = (config as any).dialogs.add
    expect(dlg.title).toBeUndefined()
    expect('required' in dlg.formItems[0]).toBe(false)
  })
})

describe('repairConfig — 成员布尔', () => {
  it('"false" → false、"true" → true（无歧义字面量）', () => {
    const { config, repairs } = repairConfig(
      base({
        fields: [
          { ...FIELD, prop: 'a', inQuery: 'false' },
          { ...FIELD, prop: 'b', inTable: 'true' },
          { ...FIELD, prop: 'c', inForm: 0 },
          { ...FIELD, prop: 'd', inQuery: 1 },
        ],
      }),
    )
    const f = (config as any).fields
    expect(f[0].inQuery).toBe(false)
    expect(f[1].inTable).toBe(true)
    expect(f[2].inForm).toBe(false)
    expect(f[3].inQuery).toBe(true)
    expect(repairs.filter((r) => r.kind === 'coerce-boolean')).toHaveLength(4)
  })

  it('null 成员布尔按「未声明」删除（生成器按 !== false 解释为 true，语义不变）', () => {
    const { config, repairs } = repairConfig(
      base({ fields: [{ ...FIELD, inQuery: null }] }),
    )
    expect('inQuery' in (config as any).fields[0]).toBe(false)
    expect(repairs[0]).toMatchObject({ path: '/fields/0/inQuery', kind: 'remove-null' })
  })

  it('无法无歧义解释的值不猜（"no" 原样保留）', () => {
    const { config, repairs } = repairConfig(
      base({ fields: [{ ...FIELD, inQuery: 'no' }] }),
    )
    expect((config as any).fields[0].inQuery).toBe('no')
    expect(repairs).toEqual([])
  })

  it('弹窗 formItems 里的成员布尔同样修复', () => {
    const { config } = repairConfig(
      base({
        dialogs: { add: { formItems: [{ ...FIELD, inQuery: 'false' }] } },
      }),
    )
    expect((config as any).dialogs.add.formItems[0].inQuery).toBe(false)
  })
})

describe('repairConfig — dialogs 简写（normalizeConfig 的修复面对外可见）', () => {
  it('罐头键数组 → record', () => {
    const { config } = repairConfig(base({ dialogs: ['add', 'edit'] }))
    expect((config as any).dialogs).toEqual({ add: {}, edit: {} })
  })

  it('{ add: true } → { add: {} }', () => {
    const { config } = repairConfig(base({ dialogs: { add: true } }))
    expect((config as any).dialogs).toEqual({ add: {} })
  })

  it('formItems 字符串/简写引用顶层字段', () => {
    const { config } = repairConfig(
      base({
        fields: [{ ...FIELD }, { prop: 'age', label: '年龄', formtype: 'Input' }],
        dialogs: { add: { formItems: ['name', { prop: 'age' }] } },
      }),
    )
    expect((config as any).dialogs.add.formItems).toEqual([
      { ...FIELD },
      { prop: 'age', label: '年龄', formtype: 'Input' },
    ])
  })
})

describe('repairConfig — 边界与安全阀', () => {
  it('不修改入参', () => {
    const input = base({ formLayout: null, fields: [{ ...FIELD, dataOptions: null }] })
    const snapshot = JSON.parse(JSON.stringify(input))
    repairConfig(input)
    expect(input).toEqual(snapshot)
  })

  it('幂等：修复后的配置再跑一次零 repairs', () => {
    const first = repairConfig(
      base({
        formLayout: null,
        fields: [{ ...FIELD, inQuery: 'false', dataOptions: null }],
        dialogs: ['add'],
      }),
    )
    const second = repairConfig(first.config)
    expect(second.repairs).toEqual([])
  })

  it('修不好时原样保留（不猜），配置仍然非法', () => {
    const { config, repairs } = repairConfig(
      base({ fields: [{ ...FIELD, inQuery: 'no' }] }),
    )
    expect(repairs).toEqual([])
    expect(validateAndRepair(config).valid).toBe(false)
  })

  it('与 validate_config 分离：修复环能修的配置，校验器仍判红（只判不改）', () => {
    const input = base({ formLayout: null })
    expect(validateAndRepair(input).valid).toBe(false)
    const { config } = repairConfig(input)
    expect(validateAndRepair(config).valid).toBe(true)
  })

  it('非对象输入不崩、零 repairs', () => {
    for (const input of [null, 'x', 42, []]) {
      const out = repairConfig(input)
      expect(out.config).toEqual(input)
      expect(out.repairs).toEqual([])
    }
  })
})

describe('repairConfig — 生成器入口自动 repair', () => {
  it('null / 成员布尔错误在生成前被修掉，并写进 warnings', () => {
    const res = generateFromConfig(
      base({
        formLayout: null,
        fields: [{ ...FIELD, inQuery: 'false', dataOptions: null }],
      }) as any,
    )
    const warnings = res.warnings.join('\n')
    expect(warnings).toContain('自动修复：/formLayout')
    expect(warnings).toContain('自动修复：/fields/0/inQuery')
    expect(warnings).toContain('自动修复：/fields/0/dataOptions')
    expect(res.code.length).toBeGreaterThan(0)
  })

  it('按钮别名在生成前归一，并写进 warnings', () => {
    const res = generateFromConfig(
      base({ toolbarBtns: [{ label: '导出', action: 'export' }] }) as any,
    )
    const warnings = res.warnings.join('\n')
    expect(warnings).toContain('自动归一：/toolbarBtns/0/label')
    expect(warnings).toContain('自动归一：/toolbarBtns/0/action')
    expect(res.code).toContain('"name": "导出"')
    expect(res.code).toContain('"actionType": "export"')
  })
})
