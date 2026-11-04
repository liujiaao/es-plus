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
    ['同一场景两个节点', () => planComposition(plan([form('a'), form('b')])), /form 场景出现了不止一个节点/],
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
    // 行动作 → 用注册表标题开窗，并带成功回调
    expect(page.code).toContain("if (payload.key === 'edit') {")
    expect(page.code).toContain("editRef.value?.open('编辑', payload.row, onTableSuccess)")
    // 未匹配的行动作升级为页面事件
    expect(page.code).toContain("emit('row-action', payload)")
    // 查询 → 表格重载（新搜索回第 1 页）；提交 → 页面 save；重置 → 表格重载
    expect(page.code).toContain('usersRef.value?.reload?.(model)')
    expect(page.code).toContain("emit('save', model)")
    expect(page.code).toContain('function onReset() {')
    expect(page.code).toContain('usersRef.value?.reload?.()')
    expect(page.code).toContain('@reset="onReset"')
    expect(page.code).toContain('defineExpose({ refresh, reload, open })')
    expect(page.code).toContain('onTableSuccess')
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
    expect(page.code).not.toContain('onTableSuccess')
  })

  it('vue2：Options API 页面与 $refs 调用，不生成 script setup', () => {
    const result = emitComposition(
      plan([table(), form(), dialog()], { target: 'vue2' }),
    )
    const page = result.page!
    expect(page.code).toContain('<script lang="ts">')
    expect(page.code).not.toContain('script setup')
    expect(page.code).toContain('export default {')
    expect(page.code).toContain("this.$refs.editRef.open('编辑', payload.row, this.onTableSuccess)")
    expect(page.code).toContain('onTableSuccess() { return this.$refs.usersRef.refresh() }')
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
