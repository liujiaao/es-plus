import { describe, it, expect } from 'vitest'
import { resolveCrudActions, LEGACY_CRUD_ACTIONS } from '../src/crud-actions'

/**
 * AN-06 —— 三端共用的 action 面解析。
 *
 * 修前三端各自写 `props.schema.actions || ['add','edit','delete']`：缺 `actions` 时
 * **猜**一套 CRUD，方向是双向错的 —— 只读页多出删除、只导出页多出写操作。这里把
 * 「按 schema 结构推导」的四档判据逐条钉住。
 */
describe('resolveCrudActions', () => {
  it('空 schema → 只读（不猜 CRUD）', () => {
    expect(resolveCrudActions(null)).toEqual([])
    expect(resolveCrudActions(undefined)).toEqual([])
    expect(resolveCrudActions({})).toEqual([])
  })

  it('显式 actions 原样使用（含未知/自定义键，不做过滤）', () => {
    expect(resolveCrudActions({ actions: ['add', 'view'] })).toEqual(['add', 'view'])
    expect(resolveCrudActions({ actions: ['export', 'import'] })).toEqual(['export', 'import'])
    // 自定义动作不静默丢弃：组件只消费它认识的键，但不是本函数该管的事。
    expect(resolveCrudActions({ actions: ['add', 'approve'] as any })).toEqual(['add', 'approve'])
  })

  it('显式空数组 = 显式只读（`||` 会把它换成 add/edit/delete，正是要修的那类 bug）', () => {
    expect(resolveCrudActions({ actions: [], dialogs: { add: {} } })).toEqual([])
  })

  it('无 actions、有 dialogs → 按 dialog key 推导，只认 add/edit/view', () => {
    expect(resolveCrudActions({ dialogs: { add: {}, edit: {} } })).toEqual(['add', 'edit'])
    expect(resolveCrudActions({ dialogs: { view: {}, add: {} } })).toEqual(['add', 'view'])
    // 自定义弹窗 key 不产生按钮；也绝不补 delete（没有 delete 弹窗可推）。
    expect(resolveCrudActions({ dialogs: { detail: {}, approve: {} } })).toEqual([])
  })

  it('无 actions、dialogs 为空对象 → 只读（声明了新模式但没声明任何内建弹窗）', () => {
    expect(resolveCrudActions({ dialogs: {} })).toEqual([])
  })

  it('无 actions、无 dialogs、有 dialogFormItems → 旧 schema 兼容回退（与修前逐字一致）', () => {
    expect(resolveCrudActions({ dialogFormItems: [{ prop: 'a' }] })).toEqual(['add', 'edit', 'delete'])
    expect(resolveCrudActions({ dialogFormItems: [] })).toEqual([])
    expect(LEGACY_CRUD_ACTIONS).toEqual(['add', 'edit', 'delete'])
  })

  it('优先级：actions > dialogs > dialogFormItems', () => {
    const schema = {
      actions: ['view'],
      dialogs: { add: {}, edit: {} },
      dialogFormItems: [{ prop: 'a' }],
    }
    expect(resolveCrudActions(schema)).toEqual(['view'])
  })

  it('返回新数组：调用方 push 不得污染常量', () => {
    const got = resolveCrudActions({ dialogFormItems: [{ prop: 'a' }] })
    got.push('view')
    expect(resolveCrudActions({ dialogFormItems: [{ prop: 'a' }] })).toEqual(LEGACY_CRUD_ACTIONS)
  })
})
