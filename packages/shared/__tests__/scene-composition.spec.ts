import { describe, it, expect } from 'vitest'
import {
  COMPOSITION_CONTRACT_VERSION,
  emitComposition,
  planComposition,
  type CompositionPlan,
} from '../src/scene/composition.js'

const FIELDS = [{ prop: 'name', label: '姓名' }, { prop: 'status', label: '状态' }]

function table(id = 'users', extra: Record<string, unknown> = {}) {
  return {
    id,
    plan: {
      scene: 'table' as const,
      intent: {
        fields: FIELDS,
        rowButtons: [{ key: 'edit', name: '编辑' }, { key: 'remove', name: '删除' }],
        ...extra,
      },
    },
  }
}

function form(id = 'filter', extra: Record<string, unknown> = {}) {
  return {
    id,
    plan: { scene: 'form' as const, intent: { fields: FIELDS, context: 'query' as const, buttons: 'query' as const, ...extra } },
  }
}

function dialog(id = 'edit', extra: Record<string, unknown> = {}) {
  return {
    id,
    plan: {
      scene: 'dialog' as const,
      intent: { fields: FIELDS, mode: 'component' as const, ...extra },
    },
  }
}

function plan(nodes: any[], extra: Partial<CompositionPlan> = {}): CompositionPlan {
  return { nodes, ...extra } as CompositionPlan
}

describe('composition — 接线派生', () => {
  it('table + form + dialog：四类接线全部按契约派生', () => {
    const a = planComposition(plan([table(), form(), dialog()]))
    expect(a.target).toBe('vue3')
    expect(a.wires).toEqual([
      { from: { node: 'users', channel: 'row-action' }, to: { node: 'edit', channel: 'open' }, when: { rowAction: 'edit' } },
      { from: { node: 'users', channel: 'row-action' }, to: { page: 'emit', event: 'row-action' }, when: { rowAction: 'remove' } },
      { from: { node: 'filter', channel: 'query' }, to: { node: 'users', channel: 'reload' } },
      { from: { node: 'filter', channel: 'submit' }, to: { page: 'emit', event: 'save' } },
      { from: { node: 'filter', channel: 'reset' }, to: { node: 'users', channel: 'reload' } },
      { from: { node: 'edit', channel: 'onSuccess' }, to: { node: 'users', channel: 'refresh' } },
    ])
    expect(a.faces.expose).toEqual(['refresh', 'reload', 'open'])
    expect(a.faces.emit).toEqual(['row-action', 'save'])
  })

  it('没有表格：查询 / 重置 / 成功都升级为页面事件，不静默丢弃', () => {
    const a = planComposition(plan([form(), dialog()]))
    expect(a.wires).toEqual([
      { from: { node: 'filter', channel: 'query' }, to: { page: 'emit', event: 'query' } },
      { from: { node: 'filter', channel: 'submit' }, to: { page: 'emit', event: 'save' } },
      { from: { node: 'filter', channel: 'reset' }, to: { page: 'emit', event: 'reset' } },
      { from: { node: 'edit', channel: 'onSuccess' }, to: { page: 'emit', event: 'success' } },
    ])
    expect(a.faces.emit).toEqual(['query', 'save', 'reset', 'success'])
    expect(a.faces.expose).toEqual(['open'])
  })

  it('只有表格：没有 form / dialog 时不派生任何接线', () => {
    const a = planComposition(plan([table('users', { rowButtons: [] })]))
    expect(a.wires).toEqual([])
    expect(a.faces).toEqual({ expose: ['refresh', 'reload'], emit: [] })
  })

  it('行动作重复 key 只接线一次', () => {
    const a = planComposition(
      plan([table('users', { rowButtons: [{ key: 'edit', name: '编辑' }, { key: 'edit', name: '编辑2' }] }), dialog()]),
    )
    expect(a.wires.filter((w) => w.from.channel === 'row-action')).toHaveLength(1)
  })
})

describe('composition — 结构化拒绝', () => {
  const cases: Array<[string, () => unknown, RegExp]> = [
    ['空节点', () => planComposition(plan([])), /至少需要一个节点/],
    [
      'crud 节点',
      () =>
        planComposition(
          plan([{ id: 'root', plan: { scene: 'crud', intent: { name: 'x', apiUrl: '/x', surfaces: {} } } }]),
        ),
      /crud 节点不能参与组合/,
    ],
    ['重复 id', () => planComposition(plan([table('x'), dialog('x')])), /id "x" 重复/],
    ['非法 id', () => planComposition(plan([table('Users')])), /只允许 kebab-case/],
    ['同一场景两个节点', () => planComposition(plan([form('a'), form('b')])), /form 场景出现了 2 个节点/],
    [
      '混装 target',
      () => planComposition(plan([table('users', { target: 'vue3' }), form('f', { target: 'antdv' })])),
      /target=vue3 与页面 target=antdv|target=antdv 与页面 target=vue3/,
    ],
    [
      'vue2 + composable 弹窗',
      () =>
        planComposition(
          plan([dialog('edit', { mode: 'composable', composableName: 'useEditDialog' })], { target: 'vue2' }),
        ),
      /vue2 页面只支持 mode: 'component'/,
    ],
    [
      '组件名冲突（a1 / a-1 都推导出 A1）',
      () => planComposition(plan([table('a1'), dialog('a-1')])),
      /同一个组件名/,
    ],
  ]

  for (const [name, run, re] of cases) {
    it(name, () => {
      expect(run).toThrow(re)
    })
  }
})

describe('composition — 产物', () => {
  it('三个节点 + Page.vue：文件路径、导入、按契约接线、暴露面', () => {
    const result = emitComposition(plan([table(), form(), dialog()], { name: '订单页' }))
    expect(result.isError).toBeUndefined()
    expect(result.files!.map((f) => f.path)).toEqual(['users.vue', 'filter.vue', 'edit.vue', 'Page.vue'])
    expect(result.files!.every((f) => f.language === 'vue')).toBe(true)

    const page = result.page!
    expect(page.code).toContain("import Users from './users.vue'")
    expect(page.code).toContain("import Filter from './filter.vue'")
    expect(page.code).toContain("import Edit from './edit.vue'")
    // 行动作 → 用注册表标题开窗，并带成功回调（@3：成功回调内联到目标表，多表也分得清）
    expect(page.code).toContain("if (payload.key === 'edit') {")
    expect(page.code).toContain(
      "editRef.value?.open('编辑', payload.row, (data) => { usersRef.value?.refresh?.() })",
    )
    // 未匹配的行动作升级为页面事件
    expect(page.code).toContain("emit('row-action', payload)")
    // 查询 → 表格重载（新搜索回第 1 页）；提交 → 页面 save；重置 → 表格重载
    expect(page.code).toContain('usersRef.value?.reload?.(model)')
    expect(page.code).toContain("emit('save', model)")
    expect(page.code).toContain('function onReset() {')
    expect(page.code).toContain('usersRef.value?.reload?.()')
    expect(page.code).toContain('@reset="onReset"')
    expect(page.code).toContain('defineExpose({ refresh, reload, open })')
  })

  it('弹窗节点 id 与表格撞名时不会产生重复声明（id=table 回归）', () => {
    const result = emitComposition(plan([table('users'), dialog('table')]))
    expect(result.isError).toBeUndefined()
    const page = result.page!
    const decls = [...page.code.matchAll(/const\s+([A-Za-z_$][\w$]*)\s*=/g)].map((m) => m[1])
    expect(decls.filter((x, i) => decls.indexOf(x) !== i)).toEqual([])
    // 表格 ref 由节点 id 派生，弹窗用表格的旧名字也不会撞。
    expect(page.code).toContain('const usersRef = ref(null)')
    expect(page.code).toContain('const tableRef = ref(null)')
    expect(page.code).toContain("tableRef.value?.open(options.title || 'table', options.row ?? {}")
  })

  it('弹窗标题优先取节点 intent.defaultTitle（与单独发射同一真源）', () => {
    const result = emitComposition(
      plan([table('users', { rowButtons: [{ key: 'edit', name: '编辑' }] }), dialog('edit', { defaultTitle: '编辑用户' })]),
    )
    const page = result.page!
    expect(page.code).toContain("'编辑用户'")
    expect(page.code).not.toContain("'编辑'")
  })

  it('页面 open() 吃选项对象、返回是否命中，并在表格刷新后调用宿主 onSuccess', () => {
    const page = emitComposition(plan([table(), dialog()])).page!
    expect(page.code).toContain(
      'function open(id: string, options: { title?: string; row?: any; onSuccess?: (data: any) => void } = {}): boolean {',
    )
    expect(page.code).toContain("options.row ?? {}")
    expect(page.code).toContain('options.onSuccess?.(data)')
    expect(page.code).toContain('return true')
    expect(page.code).toContain('return false')
  })

  it('composable 弹窗：按返回值解构 open，带标题回落，无表格时成功升级为页面事件', () => {
    const result = emitComposition(
      plan([dialog('add', { mode: 'composable', composableName: 'useAddDialog' })]),
    )
    const page = result.page!
    expect(page.code).toContain("import { useAddDialog } from './add.tsx'")
    expect(page.code).toContain('const { open: openAdd } = useAddDialog()')
    expect(page.code).toContain(
      "openAdd(options.title || '新增', options.row ?? {}, (data) => { emit('success', { id: 'add', data }); options.onSuccess?.(data) })",
    )
    expect(page.code).toContain("defineEmits(['success'])")
    expect(page.code).toContain('defineExpose({ open })')
  })

  it('vue2：Options API 页面与 $refs 调用，不生成 script setup', () => {
    const result = emitComposition(
      plan([table(), form(), dialog()], { target: 'vue2' }),
    )
    const page = result.page!
    expect(page.code).toContain('<script lang="ts">')
    expect(page.code).not.toContain('script setup')
    expect(page.code).toContain('export default {')
    expect(page.code).toContain("this.$refs.editRef.open('编辑', payload.row, (data) => { this.$refs.usersRef.refresh() })")
    expect(page.code).toContain('<users ref="usersRef" @row-action="onRowAction" />')
    expect(page.code).toContain('open(id, options = {}) {')
    expect(page.code).toContain('return false')
    expect(page.code).toContain('return this.$refs.usersRef.reload(model)')
    expect(page.code).toContain('return this.$refs.usersRef.reload()')
  })

  it('文本与信封同源：每份代码都出现在文本里，信封身份自洽', () => {
    const result = emitComposition(plan([table(), form(), dialog()]))
    for (const file of result.files!) {
      expect(result.text).toContain(`## ${file.path}`)
      expect(result.text).toContain(file.code)
    }
    const env = result.envelope!
    expect(env.contract).toBe(COMPOSITION_CONTRACT_VERSION)
    expect(env.target).toBe('vue3')
    expect(env.nodes.map((n) => n.artifact)).toEqual(['table', 'form', 'dialog-component'])
    expect(env.wires).toEqual(result.wires)
    expect(env.faces).toEqual(result.faces)
    expect(env.fingerprint).toMatch(/^[0-9a-f]{16}$/)
    expect(Object.isFrozen(env)).toBe(true)
    // 同一份输入 → 同一指纹；改一个节点字段 → 指纹变
    const again = emitComposition(plan([table(), form(), dialog()]))
    expect(again.envelope!.fingerprint).toBe(env.fingerprint)
    const changed = emitComposition(
      plan([table('users', { rowButtons: [{ key: 'edit', name: '编辑' }] }), form(), dialog()]),
    )
    expect(changed.envelope!.fingerprint).not.toBe(env.fingerprint)
  })

  it('失败分支只有错误正文：没有文件、没有信封', () => {
    const result = emitComposition(plan([form('a'), form('b')]))
    expect(result.isError).toBe(true)
    expect(result.text).toMatch(/^Error composing page: /)
    expect(result.files).toBeUndefined()
    expect(result.envelope).toBeUndefined()
  })

  it('节点产物与单独发射逐字节一致（组合只重命名，不改片段）', () => {
    const result = emitComposition(plan([table(), dialog()]))
    const tableFile = result.files!.find((f) => f.path === 'users.vue')!
    const solo = emitComposition(plan([table()]))
    expect(tableFile.code).toBe(solo.files!.find((f) => f.path === 'users.vue')!.code)
  })
})

describe('composition@3 — 多弹窗 / 多表 / 显式接线 / behavior', () => {
  function plainTable(id: string, extra: Record<string, unknown> = {}, rowButtons: any[] = []) {
    return { id, plan: { scene: 'table' as const, intent: { fields: FIELDS, rowButtons, ...extra } } }
  }

  it('多弹窗：每个 dialog 一个 open 分派，行按钮各接各的', () => {
    const a = planComposition(
      plan([
        table('users', { rowButtons: [{ key: 'edit', name: '编辑' }, { key: 'view', name: '查看' }] }),
        dialog('edit'),
        dialog('view', { defaultTitle: '查看用户' }),
      ]),
    )
    expect(a.wires.filter((w) => w.from.channel === 'row-action')).toEqual([
      { from: { node: 'users', channel: 'row-action' }, to: { node: 'edit', channel: 'open' }, when: { rowAction: 'edit' } },
      { from: { node: 'users', channel: 'row-action' }, to: { node: 'view', channel: 'open' }, when: { rowAction: 'view' } },
    ])
    const page = emitComposition(
      plan([
        table('users', { rowButtons: [{ key: 'edit', name: '编辑' }, { key: 'view', name: '查看' }] }),
        dialog('edit'),
        dialog('view', { defaultTitle: '查看用户' }),
      ]),
    ).page!
    expect(page.code).toContain("if (id === 'edit') {")
    expect(page.code).toContain("if (id === 'view') {")
    expect(page.code).toContain("'查看用户'")
  })

  it('master-detail：显式接线把主表行数据传给明细表 reload(row)', () => {
    const master = { ...table('orders', { rowButtons: [{ key: 'view', name: '查看' }] }), role: 'master' }
    const detail = { ...plainTable('items'), role: 'detail' }
    const p = plan([master, detail], {
      wires: [
        {
          from: { node: 'orders', channel: 'row-action' },
          to: { node: 'items', channel: 'reload' },
          when: { rowAction: 'view' },
        },
      ],
    })
    const a = planComposition(p)
    expect(a.wires).toEqual([
      {
        from: { node: 'orders', channel: 'row-action' },
        to: { node: 'items', channel: 'reload' },
        when: { rowAction: 'view' },
      },
    ])
    expect(a.faces.expose).toEqual([
      'refresh',
      'reload',
      'ordersRefresh',
      'ordersReload',
      'itemsRefresh',
      'itemsReload',
    ])
    const page = emitComposition(p).page!
    // 多表：行按钮处理器按表派生，模板不再共用 onRowAction
    expect(page.code).toContain('function onRowActionOrders(payload: { key: string; row: any }) {')
    expect(page.code).toContain('itemsRef.value?.reload?.(payload.row)')
    expect(page.code).toContain('@row-action="onRowActionOrders"')
    // master 别名 refresh/reload 指向 master 表
    expect(page.code).toContain('return ordersRef.value?.refresh?.(model)')
    expect(page.code).toContain('function itemsReload(model?: Record<string, unknown>) {')
  })

  it('角色：多表页面里 form 查询/重置默认落到 role=master 的表', () => {
    const master = { ...table('orders', { rowButtons: [] }), role: 'master' }
    const detail = { ...plainTable('items'), role: 'detail' }
    const a = planComposition(plan([master, detail, form()]))
    expect(a.wires).toEqual([
      { from: { node: 'filter', channel: 'query' }, to: { node: 'orders', channel: 'reload' } },
      { from: { node: 'filter', channel: 'submit' }, to: { page: 'emit', event: 'save' } },
      { from: { node: 'filter', channel: 'reset' }, to: { node: 'orders', channel: 'reload' } },
    ])
  })

  it('多表且没有 master：不猜目标，查询/重置升级为页面事件', () => {
    const a = planComposition(plan([plainTable('orders'), plainTable('items'), form()]))
    expect(a.wires).toContainEqual({ from: { node: 'filter', channel: 'query' }, to: { page: 'emit', event: 'query' } })
    expect(a.wires).toContainEqual({ from: { node: 'filter', channel: 'reset' }, to: { page: 'emit', event: 'reset' } })
    expect(a.faces.expose).toEqual([
      'ordersRefresh',
      'ordersReload',
      'itemsRefresh',
      'itemsReload',
    ])
  })

  it('显式接线覆盖同 from 的派生接线（不重复、不静默）', () => {
    const a = planComposition(
      plan([table('users', { rowButtons: [] }), form(), plainTable('archive')], {
        wires: [{ from: { node: 'filter', channel: 'query' }, to: { node: 'archive', channel: 'reload' } }],
      }),
    )
    const queries = a.wires.filter((w) => w.from.channel === 'query')
    expect(queries).toEqual([{ from: { node: 'filter', channel: 'query' }, to: { node: 'archive', channel: 'reload' } }])
    const page = emitComposition(
      plan([table('users', { rowButtons: [] }), form(), plainTable('archive')], {
        wires: [{ from: { node: 'filter', channel: 'query' }, to: { node: 'archive', channel: 'reload' } }],
      }),
    ).page!
    expect(page.code).toContain('archiveRef.value?.reload?.(model)')
  })

  it('behavior=ui-only：只装配 UI 接线，数据通道全部升级为页面事件', () => {
    const p = plan([table(), form(), dialog()], { behavior: 'ui-only' })
    const a = planComposition(p)
    expect(a.behavior).toBe('ui-only')
    expect(a.wires).toEqual([
      { from: { node: 'users', channel: 'row-action' }, to: { node: 'edit', channel: 'open' }, when: { rowAction: 'edit' } },
      { from: { node: 'users', channel: 'row-action' }, to: { page: 'emit', event: 'row-action' }, when: { rowAction: 'remove' } },
      { from: { node: 'filter', channel: 'query' }, to: { page: 'emit', event: 'query' } },
      { from: { node: 'filter', channel: 'submit' }, to: { page: 'emit', event: 'save' } },
      { from: { node: 'filter', channel: 'reset' }, to: { page: 'emit', event: 'reset' } },
      { from: { node: 'edit', channel: 'onSuccess' }, to: { page: 'emit', event: 'success' } },
    ])
    expect(a.faces.emit).toEqual(['row-action', 'query', 'save', 'reset', 'success'])
    const page = emitComposition(p).page!
    // 行按钮 → 弹窗仍是 UI 接线
    expect(page.code).toContain("editRef.value?.open('编辑', payload.row")
    // 数据通道不再调用表格（页面暴露的 refresh/reload 仍在，但事件处理器不派生数据接线）
    expect(page.code).toContain(
      "function onQuery(model: Record<string, unknown>) {\n  emit('query', model)",
    )
    expect(page.code).toContain("function onReset() {\n  emit('reset')")
  })

  it('信封带 behavior / roles，且指纹对它们敏感', () => {
    const p = plan([{ ...table(), role: 'master' }, form()], { behavior: 'crud-requests' })
    const env = emitComposition(p).envelope!
    expect(env.contract).toBe('es-plus.composition@3')
    expect(env.behavior).toBe('crud-requests')
    expect(env.roles).toEqual({ users: 'master' })
    const changed = emitComposition(plan([{ ...table(), role: 'master' }, form()], { behavior: 'ui-only' })).envelope!
    expect(changed.fingerprint).not.toBe(env.fingerprint)
  })
})

describe('composition@3 — 显式接线与角色校验', () => {
  const cases: Array<[string, () => unknown, RegExp]> = [
    [
      '未知通道',
      () =>
        planComposition(
          plan([table('users', { rowButtons: [] })], {
            wires: [{ from: { node: 'users', channel: 'nope' }, to: { page: 'emit', event: 'x' } }],
          }),
        ),
      /不存在的通道/,
    ],
    [
      '行动作接线缺 when',
      () =>
        planComposition(
          plan([table('users'), dialog('edit')], {
            wires: [{ from: { node: 'users', channel: 'row-action' }, to: { node: 'edit', channel: 'open' } }],
          }),
        ),
      /必须声明 when\.rowAction/,
    ],
    [
      '未知目标节点',
      () =>
        planComposition(
          plan([table('users', { rowButtons: [] })], {
            wires: [{ from: { node: 'users', channel: 'row-action' }, to: { node: 'ghost', channel: 'refresh' }, when: { rowAction: 'x' } }],
          }),
        ),
      /未知节点 "ghost"/,
    ],
    [
      '重复显式接线',
      () =>
        planComposition(
          plan([table('users', { rowButtons: [{ key: 'x', name: 'X' }] })], {
            wires: [
              { from: { node: 'users', channel: 'row-action' }, to: { page: 'emit', event: 'a' }, when: { rowAction: 'x' } },
              { from: { node: 'users', channel: 'row-action' }, to: { page: 'emit', event: 'b' }, when: { rowAction: 'x' } },
            ],
          }),
        ),
      /重复声明/,
    ],
    [
      '同场景重复角色',
      () =>
        planComposition(
          plan([
            { ...table('a', { rowButtons: [] }), role: 'master' },
            { ...table('b', { rowButtons: [] }), role: 'master' },
          ]),
        ),
      /都声明了 role="master"/,
    ],
    ['非法 behavior', () => planComposition(plan([table()], { behavior: 'auto' as any })), /behavior="auto" 非法/],
  ]
  for (const [name, run, re] of cases) {
    it(name, () => {
      expect(run).toThrow(re)
    })
  }
})

/**
 * P11 复核 —— 显式接线只承诺页面真的调得动的东西。
 *
 * 这组用例挡的是三类「编译得过、行为悄悄错」：幽灵页面事件、指向无 ref 节点的
 * 接线（form / composable 弹窗）、以及指向未声明行按钮的死分支。每一条都源自
 * 对 `emitComposition` 产物逐行核对的结果，不是假设。
 */
describe('composition@3 复核 — 可调用性 / 幽灵事件 / 死分支', () => {
  it('显式接线覆盖派生页面事件后，faces.emit 不再留下幽灵事件', () => {
    const p = plan([table('users', { rowButtons: [] }), form()], {
      wires: [{ from: { node: 'filter', channel: 'submit' }, to: { page: 'emit', event: 'saved' } }],
    })
    const a = planComposition(p)
    expect(a.faces.emit).toEqual(['saved'])
    const page = emitComposition(p).page!
    expect(page.code).toContain("defineEmits(['saved'])")
    expect(page.code).toContain("emit('saved', model)")
    expect(page.code).not.toContain("emit('save',")
  })

  it('表单节点生成模板 ref：onSuccess → resetFields 真的可调用', () => {
    const p = plan([form(), dialog('edit')], {
      wires: [{ from: { node: 'edit', channel: 'onSuccess' }, to: { node: 'filter', channel: 'resetFields' } }],
    })
    const page = emitComposition(p).page!
    expect(page.code).toContain('const filterRef = ref(null)')
    expect(page.code).toContain('ref="filterRef"')
    expect(page.code).toContain('filterRef.value?.resetFields?.()')

    const vue2 = emitComposition(
      plan([form(), dialog('edit')], {
        target: 'vue2',
        wires: [{ from: { node: 'edit', channel: 'onSuccess' }, to: { node: 'filter', channel: 'resetFields' } }],
      }),
    ).page!
    expect(vue2.code).toContain('ref="filterRef"')
    expect(vue2.code).toContain('this.$refs.filterRef.resetFields()')
  })

  it('行按钮接线按目标通道发射：close 不再是 open 的复制品', () => {
    const p = plan([table('users', { rowButtons: [{ key: 'dismiss', name: '关闭' }] }), dialog('edit')], {
      wires: [
        {
          from: { node: 'users', channel: 'row-action' },
          to: { node: 'edit', channel: 'close' },
          when: { rowAction: 'dismiss' },
        },
      ],
    })
    const page = emitComposition(p).page!
    expect(page.code).toContain("if (payload.key === 'dismiss') {")
    expect(page.code).toContain('editRef.value?.close?.()')
    expect(page.code).not.toContain("editRef.value?.open('编辑', payload.row")
  })

  const rejects: Array<[string, () => unknown, RegExp]> = [
    [
      '行按钮接线指向未声明的 key（死分支）',
      () =>
        planComposition(
          plan([table('users')], {
            wires: [
              {
                from: { node: 'users', channel: 'row-action' },
                to: { page: 'emit', event: 'x' },
                when: { rowAction: 'ghost' },
              },
            ],
          }),
        ),
      /rowButtons 只有 \[edit\/remove\]/,
    ],
    [
      '接线目标不是可调用通道（form.model 是数据）',
      () =>
        planComposition(
          plan([table('users'), form()], {
            wires: [
              {
                from: { node: 'users', channel: 'row-action' },
                to: { node: 'filter', channel: 'model' },
                when: { rowAction: 'edit' },
              },
            ],
          }),
        ),
      /不是可调用通道/,
    ],
    [
      'composable 弹窗没有模板 ref，不能被接线调用',
      () =>
        planComposition(
          plan(
            [
              dialog('edit', { mode: 'composable', composableName: 'useEdit' }),
              dialog('view', { mode: 'composable', composableName: 'useView' }),
            ],
            {
              wires: [{ from: { node: 'edit', channel: 'onSuccess' }, to: { node: 'view', channel: 'open' } }],
            },
          ),
        ),
      /composable 弹窗/,
    ],
    [
      'open 只接受 row-action 源（需要标题与行数据）',
      () =>
        planComposition(
          plan([form(), dialog('edit')], {
            wires: [{ from: { node: 'filter', channel: 'submit' }, to: { node: 'edit', channel: 'open' } }],
          }),
        ),
      /open 需要标题与行数据/,
    ],
    [
      'to 不能同时给 node 与 page',
      () =>
        planComposition(
          plan([dialog('edit')], {
            wires: [
              {
                from: { node: 'edit', channel: 'onSuccess' },
                to: { node: 'edit', channel: 'close', page: 'emit', event: 'x' } as any,
              },
            ],
          }),
        ),
      /不能同时给 node 与 page/,
    ],
    [
      'to.page 必须是字面量 emit',
      () =>
        planComposition(
          plan([dialog('edit')], {
            wires: [{ from: { node: 'edit', channel: 'onSuccess' }, to: { page: 'send', event: 'x' } as any }],
          }),
        ),
      /必须是字面量 'emit'/,
    ],
    [
      'wire 的未知键不静默忽略',
      () =>
        planComposition(
          plan([dialog('edit')], {
            wires: [
              { from: { node: 'edit', channel: 'onSuccess' }, to: { page: 'emit', event: 'x' }, label: '保存后' } as any,
            ],
          }),
        ),
      /含未知键 "label"/,
    ],
  ]
  for (const [name, run, re] of rejects) {
    it(name, () => {
      expect(run).toThrow(re)
    })
  }
})
