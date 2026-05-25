import { describe, it, expect } from 'vitest'
import { generateCrudConfig } from '../src/crud-engine.js'
import { VALID_FORM_TYPES, VALID_CRUD_ACTIONS, SPECIAL_BTN_KEYS } from '../src/contract.js'

describe('generateCrudConfig — field parsing', () => {
  it('parses query and table fields from Chinese description', () => {
    const config = generateCrudConfig('查询条件有姓名、手机号，表格显示姓名、手机号、邮箱')
    expect(config.formItems.length).toBe(2)
    expect(config.formItems[0].prop).toBe('name')
    expect(config.formItems[1].prop).toBe('phone')
    expect(config.columns.length).toBeGreaterThanOrEqual(3)
  })

  it('handles combined query+table fields without explicit sections', () => {
    const config = generateCrudConfig('姓名、手机号、邮箱、状态')
    expect(config.formItems.length).toBeGreaterThan(0)
    expect(config.columns.length).toBeGreaterThan(0)
  })

  it('infers Select type for status-like fields', () => {
    const config = generateCrudConfig('查询条件有状态，表格显示状态')
    const statusItem = config.formItems.find(f => f.prop === 'status')
    expect(statusItem?.formtype).toBe('Select')
    expect(statusItem?.dataOptions).toBeDefined()
  })

  it('infers datePicker type for date fields', () => {
    const config = generateCrudConfig('查询条件有创建时间，表格显示创建时间')
    const dateItem = config.formItems.find(f => f.prop === 'createTime')
    expect(dateItem?.formtype).toBe('datePicker')
  })
})

describe('generateCrudConfig — actions parsing', () => {
  it('parses explicit actions', () => {
    const config = generateCrudConfig('支持新增编辑删除导出')
    expect(config.actions).toContain('add')
    expect(config.actions).toContain('edit')
    expect(config.actions).toContain('delete')
    expect(config.actions).toContain('export')
  })

  it('defaults to add/edit/delete when no actions specified', () => {
    const config = generateCrudConfig('用户管理，查询姓名，表格显示姓名')
    expect(config.actions).toEqual(['add', 'edit', 'delete'])
  })

  it('handles view-only mode', () => {
    const config = generateCrudConfig('只查看，查询姓名，表格显示姓名')
    expect(config.actions).toEqual(['view'])
  })

  it('all actions are from valid set', () => {
    const config = generateCrudConfig('支持新增编辑删除查看导出')
    for (const action of config.actions) {
      expect(VALID_CRUD_ACTIONS as readonly string[]).toContain(action)
    }
  })
})

describe('generateCrudConfig — buttons', () => {
  it('always includes query and reset buttons', () => {
    const config = generateCrudConfig('查询姓名，表格显示姓名')
    const queryBtn = config.queryBtns.find(b => b.key === SPECIAL_BTN_KEYS.QUERY)
    const resetBtn = config.queryBtns.find(b => b.key === SPECIAL_BTN_KEYS.RESET)
    expect(queryBtn).toBeDefined()
    expect(resetBtn).toBeDefined()
    expect(queryBtn!.triggerEvent).toBe(true)
    expect(resetBtn!.triggerEvent).toBe(true)
  })

  it('reset button key is "rest" not "reset"', () => {
    const config = generateCrudConfig('用户管理')
    const resetBtn = config.queryBtns.find(b => b.name === '重置')
    expect(resetBtn!.key).toBe('rest')
    expect(resetBtn!.key).not.toBe('reset')
  })

  it('includes add button when add action present', () => {
    const config = generateCrudConfig('支持新增')
    expect(config.queryBtns.some(b => b.key === 'add')).toBe(true)
  })
})

describe('generateCrudConfig — formItems validation', () => {
  it('all formItems have valid formtype', () => {
    const config = generateCrudConfig('查询姓名、状态、日期范围、性别，表格显示全部')
    for (const item of config.formItems) {
      expect(VALID_FORM_TYPES as readonly string[]).toContain(item.formtype)
    }
  })

  it('formItems have clearable attr by default', () => {
    const config = generateCrudConfig('查询姓名，表格显示姓名')
    for (const item of config.formItems) {
      expect(item.attrs?.clearable).toBe(true)
    }
  })
})

describe('generateCrudConfig — dialogFormItems', () => {
  it('generates dialog form items with validation rules', () => {
    const config = generateCrudConfig('查询姓名、邮箱，表格显示姓名、邮箱，支持新增')
    expect(config.dialogFormItems).toBeDefined()
    expect(config.dialogFormItems!.length).toBeGreaterThan(0)
    for (const item of config.dialogFormItems!) {
      expect(item.formItemOptions?.rules).toBeDefined()
      expect(item.formItemOptions.rules[0].required).toBe(true)
    }
  })
})

describe('generateCrudConfig — operation column', () => {
  it('uses "operate" as operation column prop', () => {
    const config = generateCrudConfig('支持编辑删除')
    const opCol = config.columns.find(c => c.prop === 'operate')
    expect(opCol).toBeDefined()
    expect(opCol!.btns).toBeDefined()
    expect(opCol!.btns.length).toBeGreaterThan(0)
  })
})
