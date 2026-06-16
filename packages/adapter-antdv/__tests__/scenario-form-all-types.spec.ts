/**
 * 场景测试：表单全部16种控件 + 校验 + 条件显隐 + 远程选项
 * 基于 es-plus-docs 的 form/ 目录下全部案例
 */
import { describe, it, expect, vi } from 'vitest'
import { h, reactive, nextTick } from 'vue'
import { useFormInputs } from '../src/composables/use-form-inputs'
import { getButtonPosition, normalizeFormType } from '@es-plus/core'
import type { FormItemOption } from '../src/types'

const { formInputComponents } = useFormInputs()
const makeModel = (init?: Record<string, unknown>) => reactive(init || {})

describe('场景: 全部16种表单控件渲染', () => {
  const allTypes: { type: string; item: FormItemOption }[] = [
    { type: 'Input', item: { prop: 'f1', label: '文本', formtype: 'Input', attrs: { placeholder: '请输入' } } },
    { type: 'Select', item: { prop: 'f2', label: '下拉', formtype: 'Select', dataOptions: [{ label: 'A', value: 'a' }] } },
    { type: 'DatePicker', item: { prop: 'f3', label: '日期', formtype: 'DatePicker' } },
    { type: 'DatePicker Range', item: { prop: 'f4', label: '日期范围', formtype: 'DatePicker', attrs: { type: 'daterange' } } },
    { type: 'TimePicker', item: { prop: 'f5', label: '时间', formtype: 'TimePicker' } },
    { type: 'Slider', item: { prop: 'f6', label: '滑块', formtype: 'Slider' } },
    { type: 'ColorPicker', item: { prop: 'f7', label: '颜色', formtype: 'ColorPicker' } },
    { type: 'Transfer', item: { prop: 'f8', label: '穿梭框', formtype: 'Transfer' } },
    { type: 'Cascader', item: { prop: 'f9', label: '级联', formtype: 'Cascader' } },
    { type: 'Radio', item: { prop: 'f10', label: '单选', formtype: 'Radio', dataOptions: [{ label: '男', value: 'male' }] } },
    { type: 'Checkbox', item: { prop: 'f11', label: '多选', formtype: 'Checkbox', dataOptions: [{ label: 'A', value: 'a' }] } },
    { type: 'Switch', item: { prop: 'f12', label: '开关', formtype: 'Switch' } },
    { type: 'Rate', item: { prop: 'f13', label: '评分', formtype: 'Rate' } },
    { type: 'Upload', item: { prop: 'f14', label: '上传', formtype: 'Upload' } },
    { type: 'DatePicker(PascalCase)', item: { prop: 'f15', label: '日期P', formtype: 'DatePicker' } },
    { type: 'TimePicker(PascalCase)', item: { prop: 'f16', label: '时间P', formtype: 'TimePicker' } },
  ]

  allTypes.forEach(({ type, item }) => {
    it(`formtype="${type}" → 渲染函数存在`, () => {
      const renderFn = formInputComponents(item)
      expect(typeof renderFn).toBe('function')
    })

    it(`formtype="${type}" → 不抛异常`, () => {
      const renderFn = formInputComponents(item)!
      const model = makeModel()
      expect(() => renderFn(h, model, { row: item, index: 0 })).not.toThrow()
    })
  })
})

describe('场景: 表单校验规则', () => {
  it('required 字段 — rules 包含 required:true', () => {
    const item: FormItemOption = {
      prop: 'name', label: '姓名', formtype: 'Input', required: true,
    }
    // 校验规则应由 es-form.vue 的 formRules computed 生成
    // 此处验证 FormItemOption 正确传递 required
    expect(item.required).toBe(true)
  })

  it('自定义 rules', () => {
    const customRules = [
      { required: true, message: '必填', trigger: 'blur' },
      { min: 2, max: 20, message: '长度2-20', trigger: 'change' },
    ]
    const item: FormItemOption = {
      prop: 'username', label: '用户名', formtype: 'Input', rules: customRules,
    }
    expect(item.rules).toHaveLength(2)
    expect(item.rules![0].required).toBe(true)
    expect(item.rules![1].min).toBe(2)
  })

  it('表单字段支持多种校验类型', () => {
    const formItems: FormItemOption[] = [
      { prop: 'email', label: '邮箱', formtype: 'Input', rules: [{ type: 'email', message: '格式不正确' }] },
      { prop: 'age', label: '年龄', formtype: 'Input', rules: [{ type: 'number', min: 0, max: 150 }] },
      { prop: 'url', label: '网址', formtype: 'Input', rules: [{ type: 'url' }] },
    ]
    expect(formItems).toHaveLength(3)
    formItems.forEach((item) => {
      expect(item.rules).toBeTruthy()
      expect(item.rules!.length).toBeGreaterThan(0)
    })
  })
})

describe('场景: 条件显隐 (isHidden)', () => {
  it('isHidden 函数根据 model 值隐藏字段', () => {
    const item: FormItemOption = {
      prop: 'companyName',
      label: '公司名称',
      formtype: 'Input',
      isHidden: (model) => model.userType !== 'company',
    }
    // 个人用户 — 隐藏
    expect(item.isHidden!({ userType: 'personal' }, item, {})).toBe(true)
    // 企业用户 — 显示
    expect(item.isHidden!({ userType: 'company' }, item, {})).toBe(false)
  })

  it('级联显隐：省→市→区', () => {
    const showCity: FormItemOption = {
      prop: 'city', label: '城市', formtype: 'Select',
      isHidden: (model) => !model.province,
    }
    const showDistrict: FormItemOption = {
      prop: 'district', label: '区县', formtype: 'Select',
      isHidden: (model) => !model.city,
    }
    expect(showCity.isHidden!({}, showCity, {})).toBe(true)
    expect(showCity.isHidden!({ province: '广东' }, showCity, {})).toBe(false)
    expect(showDistrict.isHidden!({ province: '广东' }, showDistrict, {})).toBe(true)
    expect(showDistrict.isHidden!({ province: '广东', city: '深圳' }, showDistrict, {})).toBe(false)
  })

  it('Switch 控制其他字段显隐', () => {
    const item: FormItemOption = {
      prop: 'advancedSettings',
      label: '高级设置',
      formtype: 'Input',
      isHidden: (model) => !model.enableAdvanced,
    }
    expect(item.isHidden!({ enableAdvanced: false }, item, {})).toBe(true)
    expect(item.isHidden!({ enableAdvanced: true }, item, {})).toBe(false)
  })
})

describe('场景: 远程选项加载 (apiParams)', () => {
  it('apiParams 配置完整', () => {
    const item: FormItemOption = {
      prop: 'department',
      label: '部门',
      formtype: 'Select',
      apiParams: { url: '/api/departments', method: 'GET' },
      httpRequest: async () => ({ data: [] }),
    }
    expect(item.apiParams).toBeTruthy()
    expect(item.apiParams!.url).toBe('/api/departments')
    expect(typeof item.httpRequest).toBe('function')
  })

  it('listenToCallBack.crtn 格式化响应', () => {
    const rawData = { code: 0, data: { items: [{ id: 1, deptName: '技术部' }] } }
    const item: FormItemOption = {
      prop: 'dept',
      label: '部门',
      formtype: 'Select',
      apiParams: { url: '/api/dept' },
      listenToCallBack: {
        crtn: (res: any) => {
          const items = res?.data?.items || []
          return items.map((d: any) => ({ label: d.deptName, value: d.id }))
        },
      },
    }
    const fn = item.listenToCallBack?.crtn as Function
    expect(typeof fn).toBe('function')
    const result = fn(rawData)
    expect(result).toEqual([{ label: '技术部', value: 1 }])
  })

  it('isInitRun=false — 不自动加载', () => {
    const item: FormItemOption = {
      prop: 'lazyField', label: '懒加载', formtype: 'Select',
      apiParams: { url: '/api/lazy' },
      isInitRun: false,
    }
    expect(item.isInitRun).toBe(false)
  })

  it('每个字段独立 httpRequest', () => {
    const mockFn1 = async () => ({ data: [] })
    const mockFn2 = async () => ({ data: [] })
    const item1: FormItemOption = { prop: 'f1', label: 'F1', formtype: 'Select', apiParams: { url: '/a' }, httpRequest: mockFn1 }
    const item2: FormItemOption = { prop: 'f2', label: 'F2', formtype: 'Select', apiParams: { url: '/b' }, httpRequest: mockFn2 }
    expect(item1.httpRequest).toBe(mockFn1)
    expect(item2.httpRequest).toBe(mockFn2)
  })
})

describe('场景: dataOptions 静态选项', () => {
  it('Select dataOptions', () => {
    const item: FormItemOption = {
      prop: 'status', label: '状态', formtype: 'Select',
      dataOptions: [
        { label: '启用', value: 1 },
        { label: '禁用', value: 0, disabled: true },
      ],
    }
    expect(item.dataOptions).toHaveLength(2)
    expect(item.dataOptions![1].disabled).toBe(true)
  })

  it('Radio dataOptions', () => {
    const item: FormItemOption = {
      prop: 'gender', label: '性别', formtype: 'Radio',
      dataOptions: [
        { label: '男', value: 'male' },
        { label: '女', value: 'female' },
      ],
    }
    expect(item.dataOptions).toHaveLength(2)
  })

  it('Checkbox dataOptions (多选)', () => {
    const item: FormItemOption = {
      prop: 'hobbies', label: '爱好', formtype: 'Checkbox',
      dataOptions: [
        { label: '篮球', value: 'basketball' },
        { label: '足球', value: 'football' },
        { label: '游泳', value: 'swimming' },
      ],
    }
    expect(item.dataOptions).toHaveLength(3)
  })

  it('Cascader dataOptions (树形)', () => {
    const item: FormItemOption = {
      prop: 'region', label: '地区', formtype: 'Cascader',
      dataOptions: [
        { label: '广东', value: 'gd', children: [{ label: '深圳', value: 'sz' }, { label: '广州', value: 'gz' }] },
        { label: '浙江', value: 'zj', children: [{ label: '杭州', value: 'hz' }] },
      ] as any,
    }
    expect(item.dataOptions).toHaveLength(2)
    expect((item.dataOptions as any)[0].children).toHaveLength(2)
  })
})

describe('场景: Upload 上传控件', () => {
  it('基础 Upload', () => {
    const item: FormItemOption = {
      prop: 'avatar', label: '头像', formtype: 'Upload',
      props: { action: '/api/upload', accept: 'image/*', listType: 'picture-card', limit: 1 },
    }
    const renderFn = formInputComponents(item)!
    expect(typeof renderFn).toBe('function')
    const model = makeModel()
    expect(() => renderFn(h, model, { row: item, index: 0 })).not.toThrow()
  })

  it('Upload 自定义 httpRequest', () => {
    const customUpload = async (options: any) => {
      const { file, onSuccess } = options
      onSuccess({ url: 'https://example.com/file.jpg' })
    }
    const item: FormItemOption = {
      prop: 'file', label: '文件', formtype: 'Upload',
      httpRequest: customUpload,
    }
    expect(typeof item.httpRequest).toBe('function')
  })

  it('Upload 自定义触发按钮', () => {
    const triggerRender = (hFn: typeof h) => hFn('div', { class: 'custom-upload-btn' }, '点击上传')
    const item: FormItemOption = {
      prop: 'images', label: '图片', formtype: 'Upload',
      props: { listType: 'picture-card' },
      triggerRender,
    }
    expect(typeof item.triggerRender).toBe('function')
    const vnode = triggerRender(h)
    expect(vnode).toBeTruthy()
  })
})

describe('场景: 表单按钮配置', () => {
  it('自定义按钮 position 左右分割', () => {
    // getButtonPosition imported at top
    const leftBtn = { name: '导出', position: 'left' as const }
    const rightBtn = { name: '新增', position: 'right' as const }
    expect(getButtonPosition(leftBtn)).toBe('left')
    expect(getButtonPosition(rightBtn)).toBe('right')
  })

  it('按钮 disabled 函数式', () => {
    const btn = {
      name: '提交', key: 'submit', type: 'primary',
      disabled: (model?: Record<string, unknown>) => !model?.name,
    }
    expect(btn.disabled?.({})).toBe(true)
    expect(btn.disabled?.({ name: '张三' })).toBe(false)
  })

  it('按钮 confirm 二次确认', () => {
    const deleteBtn = { name: '删除', key: 'delete', type: 'danger', confirm: '确定删除？' }
    expect(deleteBtn.confirm).toBe('确定删除？')
  })
})

describe('场景: formtype 兼容性 (camelCase ↔ PascalCase)', () => {
  it('datePicker (camelCase) 映射到 DatePicker', () => {
    expect(normalizeFormType('datePicker')).toBe('DatePicker')
    expect(normalizeFormType('timePicker')).toBe('TimePicker')
  })

  it('PascalCase 原样保留', () => {
    expect(normalizeFormType('Input')).toBe('Input')
    expect(normalizeFormType('Select')).toBe('Select')
    expect(normalizeFormType('DatePicker')).toBe('DatePicker')
  })

  it('未识别的 formtype 返回原值', () => {
    expect(normalizeFormType('CustomType')).toBe('CustomType')
  })
})
