import { describe, it, expect } from 'vitest'
import {
  filterVisibleFormItems,
  calculateAutoSpan,
  applyAutoSpan,
  splitButtonsByDirection,
  splitToolbarButtonsByCode,
  getButtonPosition,
  resolveButtonSide,
  filterButtonsByPermission,
  normalizeButtonsHideState,
  resolveButtonDisabled,
  applyConfigTableOut,
  resolveItemValidateProps,
  resolveFormRules,
} from '../src/field-resolver'
import type { BtnConfig, FormItemOption } from '../src/types'

const fi = (overrides: Partial<FormItemOption>): FormItemOption =>
  ({ prop: 'p', label: 'L', ...overrides } as FormItemOption)

const btn = (overrides: Partial<BtnConfig>): BtnConfig =>
  ({ name: 'btn', ...overrides } as BtnConfig)

describe('field-resolver > filterVisibleFormItems', () => {
  it('isHidden 返回 true → 过滤掉', () => {
    const list = [
      fi({ prop: 'a' }),
      fi({ prop: 'b', isHidden: () => true }),
      fi({ prop: 'c', isHidden: () => false }),
    ]
    const r = filterVisibleFormItems(list, {}, {})
    expect(r.map((x) => x.prop)).toEqual(['a', 'c'])
  })

  it('保留 dataOptions 默认值', () => {
    const list = [fi({ prop: 'a' })]
    const r = filterVisibleFormItems(list, {}, {})
    expect(r[0].dataOptions).toEqual([])
  })
})

describe('field-resolver > calculateAutoSpan / applyAutoSpan', () => {
  it('全部未配 span，1/2/3 个分别返回 24/12/8', () => {
    expect(calculateAutoSpan([fi({})])).toBe(24)
    expect(calculateAutoSpan([fi({}), fi({})])).toBe(12)
    expect(calculateAutoSpan([fi({}), fi({}), fi({})])).toBe(8)
    expect(calculateAutoSpan([fi({}), fi({}), fi({}), fi({})])).toBe(6)
  })

  it('部分配 span：剩余空间均分', () => {
    // 已配 span 总=12，剩余=12，未配=2 个 → 6
    const list = [fi({ span: 6 }), fi({ span: 6 }), fi({}), fi({})]
    expect(calculateAutoSpan(list)).toBe(6)
  })

  it('applyAutoSpan 给未配 span 的字段填上 autoSpan', () => {
    const list = [fi({ prop: 'a' }), fi({ prop: 'b', span: 12 })]
    const r = applyAutoSpan(list)
    expect(r[1].span).toBe(12)
    expect(r[0].span).toBeGreaterThan(0)
  })
})

describe('field-resolver > 按钮分组', () => {
  it('splitButtonsByDirection: 默认右侧', () => {
    const r = splitButtonsByDirection([
      btn({ name: 'a' }),
      btn({ name: 'b', direction: 'left' }),
      btn({ name: 'c', direction: 'right' }),
    ])
    expect(r.colLeftBtn.map((x) => x.name)).toEqual(['b'])
    expect(r.colRightBtn.map((x) => x.name)).toEqual(['a', 'c'])
  })

  it('splitToolbarButtonsByCode: 默认左侧', () => {
    const r = splitToolbarButtonsByCode([
      btn({ name: 'a' }),
      btn({ name: 'b', code: 1 }),
      btn({ name: 'c', code: 2 }),
    ])
    expect(r.leftBtns.map((x) => x.name)).toEqual(['a', 'b'])
    expect(r.rightBtns.map((x) => x.name)).toEqual(['c'])
  })

  it('splitToolbarButtonsByCode: 支持 position 字段', () => {
    const r = splitToolbarButtonsByCode([
      btn({ name: 'a', position: 'left' }),
      btn({ name: 'b', position: 'right' }),
      btn({ name: 'c' }), // default left
    ])
    expect(r.leftBtns.map((x) => x.name)).toEqual(['a', 'c'])
    expect(r.rightBtns.map((x) => x.name)).toEqual(['b'])
  })

  it('splitToolbarButtonsByCode: position 优先于 code', () => {
    const r = splitToolbarButtonsByCode([
      btn({ name: 'a', position: 'right', code: 1 }), // position wins
    ])
    expect(r.leftBtns.map((x) => x.name)).toEqual([])
    expect(r.rightBtns.map((x) => x.name)).toEqual(['a'])
  })

  it('getButtonPosition: 返回按钮位置', () => {
    expect(getButtonPosition(btn({ name: 'a' }))).toBe('left')
    expect(getButtonPosition(btn({ name: 'a', code: 1 }))).toBe('left')
    expect(getButtonPosition(btn({ name: 'a', code: 2 }))).toBe('right')
    expect(getButtonPosition(btn({ name: 'a', position: 'left' }))).toBe('left')
    expect(getButtonPosition(btn({ name: 'a', position: 'right' }))).toBe('right')
    expect(getButtonPosition(btn({ name: 'a', position: 'right', code: 1 }))).toBe('right')
  })

  // resolveButtonSide 是**唯一**的位置解析入口：表单按钮与表格按钮共用它，
  // 两端的字段优先级与兜底方向**刻意不同**（见 field-resolver.ts 的注释）。
  // 这组用例钉住的是 group A 修的缺陷：三端 EsForm 此前各自内联过滤、只读 direction，
  // 生成出来的表单工具栏按钮（结构化配置只写 position）位置被静默丢弃、永远渲染到右侧。
  describe('resolveButtonSide', () => {
    it("kind='table'：position → code → 左（与 getButtonPosition 逐字一致，且不看 direction）", () => {
      expect(resolveButtonSide(btn({ name: 'a' }), 'table')).toBe('left')
      expect(resolveButtonSide(btn({ name: 'a', code: 2 }), 'table')).toBe('right')
      expect(resolveButtonSide(btn({ name: 'a', position: 'right' }), 'table')).toBe('right')
      expect(resolveButtonSide(btn({ name: 'a', position: 'right', code: 1 }), 'table')).toBe('right')
      // direction 不参与表格链：把 direction 并进来会让「表格按钮写了 direction:'right'」
      // 从左侧变到右侧，那是不必要的行为变更。
      expect(resolveButtonSide(btn({ name: 'a', direction: 'right' }), 'table')).toBe('left')
    })

    it("kind='form'：direction → position → code → 右（表单文档化默认是右侧）", () => {
      expect(resolveButtonSide(btn({ name: 'a' }), 'form')).toBe('right')
      expect(resolveButtonSide(btn({ name: 'a', direction: 'left' }), 'form')).toBe('left')
      expect(resolveButtonSide(btn({ name: 'a', position: 'left' }), 'form')).toBe('left')
      expect(resolveButtonSide(btn({ name: 'a', code: 1 }), 'form')).toBe('left')
      expect(resolveButtonSide(btn({ name: 'a', code: 2 }), 'form')).toBe('right')
    })

    it("kind='form'：direction 优先于 position（既有配置写了 direction 的不能被翻转）", () => {
      expect(resolveButtonSide(btn({ name: 'a', direction: 'left', position: 'right' }), 'form')).toBe('left')
      expect(resolveButtonSide(btn({ name: 'a', direction: 'right', position: 'left' }), 'form')).toBe('right')
    })

    it("kind='form'：只写表格那套字段（position/code）也能落到正确一侧", () => {
      // 这正是 AI 按 MCP 指令生成的形态：只有 position（或旧别名 code），没有 direction。
      // 修复前这类按钮一律被丢到右侧。
      const r = splitButtonsByDirection([
        btn({ name: 'a', position: 'left' }),
        btn({ name: 'b', code: 1 }),
        btn({ name: 'c', position: 'right' }),
        btn({ name: 'd' }), // 不配 → 右侧（表单默认）
      ])
      expect(r.colLeftBtn.map((x) => x.name)).toEqual(['a', 'b'])
      expect(r.colRightBtn.map((x) => x.name)).toEqual(['c', 'd'])
    })

    it('非法值视为未配置并继续 fallback，不再静默丢弃', () => {
      // 注意作用域：**三端 EsForm 的内联过滤**（`it.direction === 'left'` / `=== 'right'`）
      // 会把 direction:'center' 的按钮两栏都不放——静默丢弃，与本函数注释里「避免非法
      // direction 的按钮被静默丢弃」的意图相反。core 这个函数此前写的是 `!== 'left'`，
      // 本就不丢。本用例钉住的是「委托给 resolveButtonSide 之后这条性质没有被改坏」。
      const r = splitButtonsByDirection([btn({ name: 'a', direction: 'center' as 'left' })])
      expect(r.colRightBtn.map((x) => x.name)).toEqual(['a'])
    })
  })
})

describe('field-resolver > 权限与隐藏', () => {
  it('filterButtonsByPermission 不传 permission 全放行', () => {
    const list = [btn({ permissionValue: 'x' })]
    expect(filterButtonsByPermission(list)).toHaveLength(1)
  })

  it('filterButtonsByPermission permission 返回 false 时过滤', () => {
    const list = [
      btn({ name: 'a', permissionValue: 'x' }),
      btn({ name: 'b' }), // 无 permissionValue
    ]
    const r = filterButtonsByPermission(list, () => false)
    expect(r.map((x) => x.name)).toEqual(['b'])
  })

  it('normalizeButtonsHideState: 无权限则 isHide=true', () => {
    const r = normalizeButtonsHideState(
      [btn({ name: 'a', permissionValue: 'x' })],
      () => false
    )
    expect(r[0].isHide).toBe(true)
  })

  it('normalizeButtonsHideState: 函数式 isHide', () => {
    const r = normalizeButtonsHideState([btn({ name: 'a', isHide: (() => true) as never })])
    expect(r[0].isHide).toBe(true)
  })
})

describe('field-resolver > resolveButtonDisabled', () => {
  it('布尔值', () => {
    expect(resolveButtonDisabled(btn({ disabled: true }))).toBe(true)
    expect(resolveButtonDisabled(btn({ disabled: false }))).toBe(false)
  })

  it('函数式', () => {
    const fn = (model?: { v: boolean }) => !!model?.v
    expect(resolveButtonDisabled(btn({ disabled: fn as never }), { v: true })).toBe(true)
    expect(resolveButtonDisabled(btn({ disabled: fn as never }), { v: false })).toBe(false)
  })
})

describe('field-resolver > applyConfigTableOut', () => {
  it('普通响应映射', () => {
    const r = applyConfigTableOut(
      { rows: [{ id: 1 }], records: 5 },
      { tableData: 'rows', total: 'records' }
    )
    expect(r.tableData).toEqual([{ id: 1 }])
    expect(r.total).toBe(5)
  })

  it('数组响应直接作 tableData', () => {
    const r = applyConfigTableOut([1, 2, 3], { tableData: 'data', total: 'total' })
    expect(r.tableData).toEqual([1, 2, 3])
    expect(r.total).toBe(3)
  })

  it('total 字符串 → 转数字', () => {
    const r = applyConfigTableOut(
      { data: [], total: '42' },
      { tableData: 'data', total: 'total' }
    )
    expect(r.total).toBe(42)
  })

  it('找不到字段 → tableData=[], total=0', () => {
    const r = applyConfigTableOut({}, { tableData: 'data', total: 'total' })
    expect(r.tableData).toEqual([])
    expect(r.total).toBe(0)
  })
})

describe('field-resolver > resolveItemValidateProps', () => {
  it('只有快捷字段 → 原样注入', () => {
    const rules = [{ required: true, message: '必填' }]
    expect(resolveItemValidateProps({ required: true, rules })).toEqual({ required: true, rules })
  })

  it('formItemOptions 有同名键 → formItemOptions 优先，快捷字段被忽略', () => {
    const shortcutRules = [{ min: 3 }]
    const optsRules = [{ max: 10 }]
    const out = resolveItemValidateProps({
      required: false,
      rules: shortcutRules,
      formItemOptions: { required: true, rules: optsRules },
    })
    expect(out).toEqual({})
  })

  it('formItemOptions 只给了 required → rules 仍然从快捷字段注入', () => {
    const rules = [{ min: 3 }]
    const out = resolveItemValidateProps({ required: false, rules, formItemOptions: { required: true } })
    expect(out).toEqual({ rules })
  })

  it('formItemOptions 的 required 为 false 也算「已提供」，不被 true 覆盖', () => {
    const out = resolveItemValidateProps({ required: true, formItemOptions: { required: false } })
    expect(out).toEqual({})
  })

  it('两者都没有 → 返回空对象（调用方展开后不产生多余键）', () => {
    expect(resolveItemValidateProps({})).toEqual({})
  })

  it('formItemOptions 为非法值（数组/null）时按空处理', () => {
    expect(resolveItemValidateProps({ required: true, formItemOptions: [] as never })).toEqual({
      required: true,
    })
  })
})

describe('field-resolver > resolveFormRules', () => {
  it('全局与组件分别提供不同字段 → 两者都在', () => {
    const out = resolveFormRules({ name: [{ required: true }] }, { age: [{ min: 18 }] })
    expect(out).toEqual({ name: [{ required: true }], age: [{ min: 18 }] })
  })

  it('同名字段 → 组件 props 覆盖全局', () => {
    const local = [{ min: 18 }]
    const out = resolveFormRules({ age: [{ required: true }] }, { age: local })
    expect(out.age).toBe(local)
  })

  it('全局为空/未配置 → 等同于组件 props', () => {
    const local = { name: [{ required: true }] }
    expect(resolveFormRules(undefined, local)).toEqual(local)
  })

  it('组件未配置 → 回落到全局', () => {
    const globalRules = { name: [{ required: true }] }
    expect(resolveFormRules(globalRules, {})).toEqual(globalRules)
  })

  it('非法值（数组/null/字符串）按空处理，不抛错', () => {
    expect(resolveFormRules(null, null)).toEqual({})
    expect(resolveFormRules([1, 2], 'nope')).toEqual({})
  })
})
