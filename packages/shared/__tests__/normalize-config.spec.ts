import { describe, it, expect } from 'vitest'
import { normalizeConfig } from '../src/normalize-config.js'

/**
 * AN-08 —— 宽松入口归一。
 *
 * 判定边界：这里只做**有据可查**的搬运（`tableBtns` 别名、顶层 `rowkey`），
 * 不猜拼写错误（`rowKey` 交给 `collectUnknownKeys` 报）。用例盯着「改了什么、
 * 留下什么、是否动过入参」三件事。
 */

describe('normalizeConfig — tableBtns 别名', () => {
  it('label→name、action→actionType，并删除别名键', () => {
    const { config, renames } = normalizeConfig({
      name: 'Demo',
      tableBtns: [{ label: '导出', action: 'export' }],
    })
    const btn = (config as any).tableBtns[0]
    expect(btn.name).toBe('导出')
    expect(btn.actionType).toBe('export')
    expect(btn).not.toHaveProperty('label')
    expect(btn).not.toHaveProperty('action')
    expect(renames.map((r) => `${r.from}>${r.to}`)).toEqual([
      '/tableBtns/0/label>/tableBtns/0/name',
      '/tableBtns/0/action>/tableBtns/0/actionType',
    ])
  })

  it('规范键与别名同时给出且不一致：规范键胜，别名被删并记录', () => {
    const { config, renames } = normalizeConfig({
      name: 'Demo',
      tableBtns: [{ name: '导出', label: '下载', actionType: 'export', action: 'download' }],
    })
    const btn = (config as any).tableBtns[0]
    expect(btn.name).toBe('导出')
    expect(btn.actionType).toBe('export')
    expect(btn).not.toHaveProperty('label')
    expect(btn).not.toHaveProperty('action')
    expect(renames).toHaveLength(2)
    expect(renames[0].note).toContain('规范键 name 优先')
    expect(renames[1].note).toContain('规范键 actionType 优先')
  })

  it('规范键与别名一致时不重复记录（无「改动」可言）', () => {
    const { renames } = normalizeConfig({
      name: 'Demo',
      tableBtns: [{ name: '导出', label: '导出', actionType: 'export', action: 'export' }],
    })
    expect(renames).toEqual([])
  })

  it('没有别名的按钮也过一遍归一：position 同步出 code（与 AN-07 同源）', () => {
    const { config, renames } = normalizeConfig({
      name: 'Demo',
      tableBtns: [{ name: '导出', position: 'right' }],
    })
    expect((config as any).tableBtns[0].code).toBe(2)
    expect(renames).toEqual([])
  })
})

describe('normalizeConfig — 顶层 rowkey 搬迁', () => {
  it('顶层 rowkey 并入 tableOptions，并从顶层删除', () => {
    const { config, renames } = normalizeConfig({
      name: 'Demo',
      rowkey: 'uid',
      tableOptions: { border: true },
    })
    expect(config).not.toHaveProperty('rowkey')
    expect((config as any).tableOptions).toEqual({ border: true, rowkey: 'uid' })
    expect(renames).toHaveLength(1)
    expect(renames[0]).toMatchObject({ from: '/rowkey', to: '/tableOptions/rowkey' })
  })

  it('与 generate_crud 前门同优先级：顶层覆盖 tableOptions 的同名键', () => {
    const { config, renames } = normalizeConfig({
      name: 'Demo',
      rowkey: 'uid',
      tableOptions: { rowkey: 'id' },
    })
    expect((config as any).tableOptions.rowkey).toBe('uid')
    expect(renames[0].note).toContain('覆盖')
  })

  it('没有 tableOptions 时新建一层', () => {
    const { config } = normalizeConfig({ name: 'Demo', rowkey: 'uid' })
    expect((config as any).tableOptions).toEqual({ rowkey: 'uid' })
  })

  it('空串 / 非字符串 rowkey 不搬（类型错误留给 schema 报）', () => {
    const { config, renames } = normalizeConfig({ name: 'Demo', rowkey: '' })
    expect((config as any).rowkey).toBe('')
    expect(renames).toEqual([])
  })
})

describe('normalizeConfig — toolbar / 行按钮 / 弹窗按钮别名（AN-24）', () => {
  it('toolbarBtns：label→name、action→actionType，并删除别名键', () => {
    const { config, renames } = normalizeConfig({
      name: 'Demo',
      toolbarBtns: [{ label: '新增', action: 'add' }],
    })
    const btn = (config as any).toolbarBtns[0]
    expect(btn).toEqual({ name: '新增', actionType: 'add' })
    expect(renames.map((r) => `${r.from}>${r.to}`)).toEqual([
      '/toolbarBtns/0/label>/toolbarBtns/0/name',
      '/toolbarBtns/0/action>/toolbarBtns/0/actionType',
    ])
  })

  it('toolbarBtns：规范键胜出，别名被删且记录冲突', () => {
    const { config, renames } = normalizeConfig({
      name: 'Demo',
      toolbarBtns: [{ name: '新增', label: '新建', actionType: 'add', action: 'create' }],
    })
    expect((config as any).toolbarBtns[0]).toEqual({ name: '新增', actionType: 'add' })
    expect(renames).toHaveLength(2)
    expect(renames[0].note).toContain('规范键 name 优先')
    expect(renames[1].note).toContain('规范键 actionType 优先')
  })

  it('operationColumn.btns：只归一 label→name（行按钮没有 actionType）', () => {
    const { config, renames } = normalizeConfig({
      name: 'Demo',
      operationColumn: { btns: [{ label: '查看', action: 'view' }] },
    })
    expect((config as any).operationColumn.btns[0]).toEqual({ name: '查看', action: 'view' })
    expect(renames).toHaveLength(1)
    expect(renames[0].to).toBe('/operationColumn/btns/0/name')
  })

  it('dialogs[k].configBtn：label→name，且 action（confirm/cancel/custom）保持不变', () => {
    const { config, renames } = normalizeConfig({
      name: 'Demo',
      dialogs: { add: { configBtn: [{ label: '关闭', action: 'cancel' }] } },
    })
    expect((config as any).dialogs.add.configBtn[0]).toEqual({ name: '关闭', action: 'cancel' })
    expect(renames).toHaveLength(1)
    expect(renames[0].to).toBe('/dialogs/add/configBtn/0/name')
  })
})

describe('normalizeConfig — dialogs 罐头键展开（AN-24）', () => {
  it('罐头键数组 → record，并记录展开', () => {
    const { config, renames } = normalizeConfig({ name: 'Demo', dialogs: ['add', 'edit'] })
    expect((config as any).dialogs).toEqual({ add: {}, edit: {} })
    expect(renames).toHaveLength(1)
    expect(renames[0].note).toContain('罐头键数组')
  })

  it('重复罐头键只保留一项', () => {
    const { config } = normalizeConfig({ name: 'Demo', dialogs: ['add', 'add'] })
    expect((config as any).dialogs).toEqual({ add: {} })
  })

  it('数组里有非罐头项时整段不动（不静默丢项）', () => {
    const input = { name: 'Demo', dialogs: ['add', 'detail'] }
    const { config, renames } = normalizeConfig(input)
    expect((config as any).dialogs).toEqual(['add', 'detail'])
    expect(renames).toEqual([])
  })

  it('空数组不动（没有可展开的意图）', () => {
    const { config, renames } = normalizeConfig({ name: 'Demo', dialogs: [] })
    expect((config as any).dialogs).toEqual([])
    expect(renames).toEqual([])
  })

  it('{ add: true } → { add: {} }，其余项原样保留', () => {
    const { config, renames } = normalizeConfig({
      name: 'Demo',
      dialogs: { add: true, edit: { title: '编辑' } },
    })
    expect((config as any).dialogs).toEqual({ add: {}, edit: { title: '编辑' } })
    expect(renames).toHaveLength(1)
    expect(renames[0].from).toBe('/dialogs/add')
  })
})

describe('normalizeConfig — dialogs.formItems 简写展开（AN-24）', () => {
  const fields = [
    { prop: 'name', label: '名称', formtype: 'Input', inQuery: true },
    { prop: 'age', label: '年龄', formtype: 'Input' },
  ]

  it('字符串引用顶层字段的 prop（只投影表单面）', () => {
    const { config, renames } = normalizeConfig({
      name: 'Demo',
      fields,
      dialogs: { add: { formItems: ['name'] } },
    })
    // 顶层字段的 inQuery 是**归属**键，弹窗表单项没有它的消费者 —— 不抄进来
    expect((config as any).dialogs.add.formItems).toEqual([
      { prop: 'name', label: '名称', formtype: 'Input' },
    ])
    expect(renames).toHaveLength(1)
    expect(renames[0].note).toContain('字符串 "name"')
  })

  it('顶层字段只带表格/查询面键时零改写、零告警（不再制造「自动归一」噪音）', () => {
    const { config, renames } = normalizeConfig({
      name: 'Demo',
      fields: [
        {
          prop: 'amount',
          label: '金额',
          formtype: 'Input',
          inQuery: false,
          inTable: true,
          inForm: false,
          querySpan: 8,
          align: 'right',
        },
      ],
      dialogs: { view: { formItems: [{ prop: 'amount', label: '金额', formtype: 'Input' }] } },
    })
    expect((config as any).dialogs.view.formItems).toEqual([
      { prop: 'amount', label: '金额', formtype: 'Input' },
    ])
    expect(renames).toEqual([])
  })

  it('不继承顶层字段的 inForm:false —— 弹窗条目本身就是表单面', () => {
    const { config } = normalizeConfig({
      name: 'Demo',
      fields: [{ prop: 'id', label: 'ID', formtype: 'Input', inTable: false, inForm: false }],
      dialogs: { view: { formItems: ['id'] } },
    })
    const item = (config as any).dialogs.view.formItems[0]
    expect(item).toEqual({ prop: 'id', label: 'ID', formtype: 'Input' })
    expect('inForm' in item).toBe(false)
  })

  it('表单面键照样补全（attrs / dataOptions / required / rules / formSpan）', () => {
    const { config } = normalizeConfig({
      name: 'Demo',
      fields: [
        {
          prop: 'status',
          label: '状态',
          formtype: 'Select',
          dataOptions: [{ label: '启用', value: 1 }],
          required: true,
          rules: [{ required: true, message: '必选' }],
          formSpan: 12,
          attrs: { clearable: false },
          querySpan: 8,
        },
      ],
      dialogs: { edit: { formItems: ['status'] } },
    })
    expect((config as any).dialogs.edit.formItems[0]).toEqual({
      prop: 'status',
      label: '状态',
      formtype: 'Select',
      required: true,
      rules: [{ required: true, message: '必选' }],
      attrs: { clearable: false },
      dataOptions: [{ label: '启用', value: 1 }],
      formSpan: 12,
    })
  })

  it('{ prop } 简写补全缺失键，条目自身给的键优先', () => {
    const { config, renames } = normalizeConfig({
      name: 'Demo',
      fields,
      dialogs: { add: { formItems: [{ prop: 'age', label: '年龄（自定义）' }] } },
    })
    expect((config as any).dialogs.add.formItems[0]).toEqual({
      prop: 'age',
      label: '年龄（自定义）',
      formtype: 'Input',
    })
    expect(renames).toHaveLength(1)
    expect(renames[0].note).toContain('条目自身给的键优先')
  })

  it('顶层找不到同 prop 时原样保留（不猜）', () => {
    const { config, renames } = normalizeConfig({
      name: 'Demo',
      fields,
      dialogs: { add: { formItems: ['missing', { prop: 'missing' }] } },
    })
    expect((config as any).dialogs.add.formItems).toEqual(['missing', { prop: 'missing' }])
    expect(renames).toEqual([])
  })

  it('弹窗 formItems 里的字段是独立副本（改它不影响顶层 fields）', () => {
    const { config } = normalizeConfig({
      name: 'Demo',
      fields,
      dialogs: { add: { formItems: ['name'] } },
    })
    ;(config as any).dialogs.add.formItems[0].label = '改了'
    expect((config as any).fields[0].label).toBe('名称')
  })
})

describe('normalizeConfig — 边界', () => {
  it('不修改入参（深浅都被克隆）', () => {
    const input = {
      name: 'Demo',
      rowkey: 'uid',
      tableOptions: { border: true },
      tableBtns: [{ label: '导出', action: 'export' }],
    }
    const snapshot = JSON.parse(JSON.stringify(input))
    normalizeConfig(input)
    expect(input).toEqual(snapshot)
    expect(input).not.toHaveProperty('tableOptions.rowkey')
  })

  it('非对象输入原样返回、零 renames', () => {
    expect(normalizeConfig(null)).toEqual({ config: null, renames: [] })
    expect(normalizeConfig('x')).toEqual({ config: 'x', renames: [] })
    expect(normalizeConfig([])).toEqual({ config: [], renames: [] })
  })

  it('合规配置零 renames（不制造噪音）', () => {
    const { renames } = normalizeConfig({
      name: 'Demo',
      fields: [{ prop: 'name', label: '名称', formtype: 'Input' }],
      actions: ['add'],
    })
    expect(renames).toEqual([])
  })

  it('tableBtns 里的非对象元素原样保留（不崩）', () => {
    const { config } = normalizeConfig({ name: 'Demo', tableBtns: ['bad', null, 1] })
    expect((config as any).tableBtns).toEqual(['bad', null, 1])
  })
})
