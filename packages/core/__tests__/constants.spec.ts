import { describe, it, expect } from 'vitest'
import {
  VALID_FORM_TYPES,
  FORM_TYPE_ALIASES,
  normalizeFormType,
  SPECIAL_BTN_KEYS,
  BUILT_IN_BTN_KEYS,
  DEFAULT_CONFIG_TABLE_OUT,
  CRUD_PAGE_BTN_CLICK_KEYS,
  CRUD_PAGE_DIALOG_KEYS,
  DEFAULT_TOOLBAR_BTNS,
  DEFAULT_ROW_BTNS,
  OPERATION_COLUMN_PROP_SFC,
  OPERATION_COLUMN_PROP_CRUD_PAGE,
  VALID_CRUD_ACTIONS,
} from '../src/constants'

// ─── SPECIAL_BTN_KEYS ─────────────────────────────────────────────────────────
describe('SPECIAL_BTN_KEYS', () => {
  it('QUERY 为 "query"', () => {
    expect(SPECIAL_BTN_KEYS.QUERY).toBe('query')
  })

  // 历史遗留拼写 'rest' 不可改名（破坏向后兼容），必须受到测试保护
  it('RESET 为 "rest"（历史拼写，不可改为 "reset"）', () => {
    expect(SPECIAL_BTN_KEYS.RESET).toBe('rest')
  })

  it('仅包含 QUERY 和 RESET 两个键', () => {
    expect(Object.keys(SPECIAL_BTN_KEYS)).toHaveLength(2)
  })
})

// ─── BUILT_IN_BTN_KEYS ────────────────────────────────────────────────────────
describe('BUILT_IN_BTN_KEYS', () => {
  it('包含 5 个内置按钮 key', () => {
    expect(BUILT_IN_BTN_KEYS).toHaveLength(5)
  })

  it('包含 query / rest / add / export / import', () => {
    expect(BUILT_IN_BTN_KEYS).toContain('query')
    expect(BUILT_IN_BTN_KEYS).toContain('rest')
    expect(BUILT_IN_BTN_KEYS).toContain('add')
    expect(BUILT_IN_BTN_KEYS).toContain('export')
    expect(BUILT_IN_BTN_KEYS).toContain('import')
  })

  it('RESET key ("rest") 与 SPECIAL_BTN_KEYS.RESET 一致', () => {
    expect(BUILT_IN_BTN_KEYS).toContain(SPECIAL_BTN_KEYS.RESET)
  })
})

// ─── VALID_FORM_TYPES ─────────────────────────────────────────────────────────
describe('VALID_FORM_TYPES', () => {
  it('包含 14 种表单类型', () => {
    expect(VALID_FORM_TYPES).toHaveLength(14)
  })

  it.each([
    'Input', 'InputNumber', 'Select', 'DatePicker', 'TimePicker', 'Slider',
    'ColorPicker', 'Transfer', 'Cascader', 'Radio', 'Checkbox',
    'Switch', 'Rate', 'Upload',
  ])('包含 "%s"', (type) => {
    expect(VALID_FORM_TYPES).toContain(type as any)
  })

  it('不包含 datePicker（旧写法不在此列表中）', () => {
    expect(VALID_FORM_TYPES).not.toContain('datePicker' as any)
  })

  it('不包含 timePicker（旧写法不在此列表中）', () => {
    expect(VALID_FORM_TYPES).not.toContain('timePicker' as any)
  })
})

// ─── FORM_TYPE_ALIASES ────────────────────────────────────────────────────────
describe('FORM_TYPE_ALIASES', () => {
  it('datePicker → DatePicker', () => {
    expect(FORM_TYPE_ALIASES.datePicker).toBe('DatePicker')
  })

  it('timePicker → TimePicker', () => {
    expect(FORM_TYPE_ALIASES.timePicker).toBe('TimePicker')
  })

  it('仅包含两个别名', () => {
    expect(Object.keys(FORM_TYPE_ALIASES)).toHaveLength(2)
  })
})

// ─── normalizeFormType ────────────────────────────────────────────────────────
describe('normalizeFormType', () => {
  it('datePicker → DatePicker', () => {
    expect(normalizeFormType('datePicker')).toBe('DatePicker')
  })

  it('timePicker → TimePicker', () => {
    expect(normalizeFormType('timePicker')).toBe('TimePicker')
  })

  it('已归一化的 DatePicker → 原样返回', () => {
    expect(normalizeFormType('DatePicker')).toBe('DatePicker')
  })

  it('未知类型原样返回', () => {
    expect(normalizeFormType('Input')).toBe('Input')
    expect(normalizeFormType('UnknownType')).toBe('UnknownType')
    expect(normalizeFormType('')).toBe('')
  })
})

// ─── DEFAULT_CONFIG_TABLE_OUT ─────────────────────────────────────────────────
describe('DEFAULT_CONFIG_TABLE_OUT', () => {
  it('total 映射到 "records"', () => {
    expect(DEFAULT_CONFIG_TABLE_OUT.total).toBe('records')
  })

  it('tableData 映射到 "rows"', () => {
    expect(DEFAULT_CONFIG_TABLE_OUT.tableData).toBe('rows')
  })

  it('pageSize 映射到 "pageSize"', () => {
    expect(DEFAULT_CONFIG_TABLE_OUT.pageSize).toBe('pageSize')
  })

  it('current 映射到 "pageNo"', () => {
    expect(DEFAULT_CONFIG_TABLE_OUT.current).toBe('pageNo')
  })
})

// ─── CRUD_PAGE_BTN_CLICK_KEYS ─────────────────────────────────────────────────
describe('CRUD_PAGE_BTN_CLICK_KEYS', () => {
  it('ADD_CONFIRM = "add-confirm"', () => {
    expect(CRUD_PAGE_BTN_CLICK_KEYS.ADD_CONFIRM).toBe('add-confirm')
  })

  it('EDIT_CONFIRM = "edit-confirm"', () => {
    expect(CRUD_PAGE_BTN_CLICK_KEYS.EDIT_CONFIRM).toBe('edit-confirm')
  })
})

// ─── CRUD_PAGE_DIALOG_KEYS ────────────────────────────────────────────────────
describe('CRUD_PAGE_DIALOG_KEYS', () => {
  it('ADD = "add"', () => {
    expect(CRUD_PAGE_DIALOG_KEYS.ADD).toBe('add')
  })

  it('EDIT = "edit"', () => {
    expect(CRUD_PAGE_DIALOG_KEYS.EDIT).toBe('edit')
  })

  it('VIEW = "view"', () => {
    expect(CRUD_PAGE_DIALOG_KEYS.VIEW).toBe('view')
  })
})

// ─── OPERATION_COLUMN_PROP ────────────────────────────────────────────────────
describe('OPERATION_COLUMN_PROP_SFC / CRUD_PAGE', () => {
  it('SFC 操作列 prop 为 "operate"', () => {
    expect(OPERATION_COLUMN_PROP_SFC).toBe('operate')
  })

  it('CrudPage 操作列 prop 为 "action"', () => {
    expect(OPERATION_COLUMN_PROP_CRUD_PAGE).toBe('action')
  })
})

// ─── VALID_CRUD_ACTIONS ───────────────────────────────────────────────────────
describe('VALID_CRUD_ACTIONS', () => {
  it('包含 6 种动作', () => {
    expect(VALID_CRUD_ACTIONS).toHaveLength(6)
  })

  it.each(['add', 'edit', 'delete', 'view', 'export', 'import'])(
    '包含 "%s"',
    (action) => {
      expect(VALID_CRUD_ACTIONS).toContain(action as any)
    }
  )
})

// ─── DEFAULT_TOOLBAR_BTNS ─────────────────────────────────────────────────────
describe('DEFAULT_TOOLBAR_BTNS', () => {
  it('ADD 按钮 key="add", type="primary", dialogKey="add"', () => {
    expect(DEFAULT_TOOLBAR_BTNS.ADD.key).toBe('add')
    expect(DEFAULT_TOOLBAR_BTNS.ADD.type).toBe('primary')
    expect(DEFAULT_TOOLBAR_BTNS.ADD.dialogKey).toBe('add')
  })

  it('EXPORT 按钮 actionType="export"', () => {
    expect(DEFAULT_TOOLBAR_BTNS.EXPORT.actionType).toBe('export')
  })

  it('IMPORT 按钮 actionType="import"', () => {
    expect(DEFAULT_TOOLBAR_BTNS.IMPORT.actionType).toBe('import')
  })
})

// ─── DEFAULT_ROW_BTNS ─────────────────────────────────────────────────────────
describe('DEFAULT_ROW_BTNS', () => {
  it('VIEW 按钮 dialogKey="view"', () => {
    expect(DEFAULT_ROW_BTNS.VIEW.dialogKey).toBe('view')
  })

  it('EDIT 按钮 dialogKey="edit"', () => {
    expect(DEFAULT_ROW_BTNS.EDIT.dialogKey).toBe('edit')
  })

  it('DELETE 按钮 type="danger" 且带有 confirm 文本', () => {
    expect(DEFAULT_ROW_BTNS.DELETE.type).toBe('danger')
    expect(typeof DEFAULT_ROW_BTNS.DELETE.confirm).toBe('string')
    expect((DEFAULT_ROW_BTNS.DELETE.confirm as string).length).toBeGreaterThan(0)
  })
})
