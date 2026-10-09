import { describe, it, expect } from 'vitest'
import { generateFormBlock, generateTableBlock, generateDialogBlock } from '../src/fragment-generator.js'

const fields = [
  { prop: 'username', label: '用户名', formtype: 'Input' },
  { prop: 'status', label: '状态', formtype: 'Select', dataOptions: [{ label: '启用', value: 1 }] },
]

describe('generateFormBlock — vue3 默认', () => {
  const { code } = generateFormBlock({ fields })

  it('产出自包含 <script setup> SFC', () => {
    expect(code).toContain('<template>')
    expect(code).toContain('<es-form :model="model" :form-item-list="formItems"')
    expect(code).toContain('<script setup lang="ts">')
    expect(code).toContain("import { reactive } from 'vue'")
  })

  it('model 与 formItems 来自原子构造器', () => {
    expect(code).toContain('const model = reactive<FormModel>({')
    expect(code).toContain('const formItems =')
    // buildFormItem 产物:每项带 formtype 与 clearable 兜底
    expect(code).toContain('"formtype": "Select"')
    expect(code).toContain('"clearable": true')
  })

  it('buttons=none 时隐藏按钮区、不发 config-btn', () => {
    expect(code).toContain(':layout-form-props="{ formLayProps: { isBtnHidden: true } }"')
    expect(code).not.toContain(':config-btn')
  })
})

describe('generateFormBlock — 按钮变体', () => {
  it('buttons=query 发查询/重置(triggerEvent)', () => {
    const { code } = generateFormBlock({ fields, buttons: 'query' })
    expect(code).toContain(':config-btn="configBtn"')
    expect(code).toContain("key: 'query'")
    expect(code).toContain("key: 'rest'")
    expect(code).toContain('triggerEvent: true')
  })

  it('buttons=submit 发保存/重置', () => {
    const { code } = generateFormBlock({ fields, buttons: 'submit' })
    expect(code).toContain("name: '保存'")
    expect(code).toContain("key: 'rest'")
  })
})

describe('generateFormBlock — vue2', () => {
  const { code } = generateFormBlock({ fields, target: 'vue2' })

  it('用 defineComponent + setup() 包装并 return', () => {
    expect(code).toContain('<script lang="ts">')
    expect(code).toContain("import { defineComponent, reactive } from 'vue'")
    expect(code).toContain('export default defineComponent({')
    expect(code).toContain('  setup() {')
    expect(code).toContain('return { model, formItems }')
  })
})

describe('generateFormBlock — 非 ts', () => {
  it('关闭 TS 时不发接口、用无 lang 的 <script setup>', () => {
    const { code } = generateFormBlock({ fields, typescript: false })
    expect(code).toContain('<script setup>')
    expect(code).not.toContain('interface FormModel')
    expect(code).toContain('const model = reactive({')
  })
})

describe('generateFormBlock — antdv', () => {
  it('antdv 用 <script setup>(与 vue3 同构,仅目标标注不同)', () => {
    const { code, summary } = generateFormBlock({ fields, target: 'antdv' })
    expect(code).toContain('<script setup lang="ts">')
    expect(summary).toContain('Ant Design Vue')
  })
})

const columns = [
  { prop: 'name', label: '名称', formtype: 'Input', width: 120 },
  { prop: 'amount', label: '金额', formtype: 'Input', align: 'right', formatter: '(row) => Number(row.amount).toFixed(2)' },
]

describe('generateTableBlock — vue3 默认', () => {
  const { code, warnings } = generateTableBlock({ fields: columns, apiUrl: '/api/orders' })

  it('产出自包含 es-table SFC(v-model 双向)', () => {
    expect(code).toContain('<es-table')
    expect(code).toContain('v-model:data-source="tableData"')
    expect(code).toContain('v-model:pagination="pagination"')
    expect(code).toContain('const tableRef = ref(null)')
  })

  it('列复用 buildTableColumnSFC —— formatter 作为源码扩展点原样内联', () => {
    expect(code).toContain('formatter: (row) => Number(row.amount).toFixed(2)')
    expect(code).toContain("align: 'right'")
    expect(code).toContain('width: 120')
  })

  it('给了 apiUrl → 发 apiParams,无告警', () => {
    expect(code).toContain("apiParams: { url: '/api/orders' }")
    expect(warnings).toEqual([])
  })
})

describe('generateTableBlock — 边界', () => {
  it('无 apiUrl → 告警且不发 apiParams', () => {
    const { code, warnings } = generateTableBlock({ fields: columns })
    expect(code).not.toContain('apiParams')
    expect(warnings.some((w) => w.includes('apiUrl'))).toBe(true)
  })

  it('rowButtons 只发 triggerEvent(不内联悬空处理体)', () => {
    const { code } = generateTableBlock({
      fields: columns,
      apiUrl: '/api/orders',
      rowButtons: [{ name: '查看', type: 'primary', key: 'view' }],
    })
    expect(code).toContain("prop: 'operate'")
    expect(code).toContain("name: '查看'")
    expect(code).toContain('triggerEvent: true')
    expect(code).not.toContain('openForm')
    expect(code).not.toContain('handleDelete')
  })

  it('vue2 用 .sync + defineComponent', () => {
    const { code } = generateTableBlock({ fields: columns, apiUrl: '/api/orders', target: 'vue2' })
    expect(code).toContain(':data-source.sync="tableData"')
    expect(code).toContain('export default defineComponent({')
    expect(code).toContain('return { columns, options, tableData, tableRef, pagination }')
  })
})

const dialogFields = [
  { prop: 'username', label: '用户名', formtype: 'Input', required: true },
  { prop: 'status', label: '状态', formtype: 'Select', dataOptions: [{ label: '启用', value: 1 }] },
]

describe('generateDialogBlock — vue3', () => {
  const { code, summary, warnings } = generateDialogBlock({ fields: dialogFields, apiUrl: '/api/users', composableName: 'useUserDialog' })

  it('产出 useXxxDialog composable + 集成契约 open(title,row,onSuccess)', () => {
    expect(code).toContain("import { reactive } from 'vue'")
    expect(code).toContain("import { useDialog, EsForm, httpRequest } from '@es-plus/vue3'")
    expect(code).toContain('export function useUserDialog() {')
    expect(code).toContain('function open(title: string, row: any = {}, onSuccess?: (data: any) => void) {')
    expect(code).toContain('onSuccess?.(formData)')
  })

  it('给了 apiUrl → 确定按钮按标题 POST/PUT 提交', () => {
    expect(code).toContain("const method = title === '新增' ? 'POST' : 'PUT'")
    expect(code).toContain('await httpRequest({ url, method, data: formData })')
    expect(code).toContain('${formData.id}')
  })

  it('弹窗体复用 buildFormItem(必填校验落入 formItemOptions.rules)', () => {
    expect(code).toContain('<EsForm')
    expect(code).toContain('"formItemOptions"')
    expect(summary).toContain('useUserDialog()')
    expect(warnings.some((w) => w.includes('plugin-vue-jsx'))).toBe(true)
  })
})

describe('generateDialogBlock — 边界', () => {
  it('无 apiUrl → 仅校验 + onSuccess(formData),不发 httpRequest', () => {
    const { code } = generateDialogBlock({ fields: dialogFields })
    expect(code).not.toContain('httpRequest')
    expect(code).toContain('onSuccess?.(formData)')
  })

  it('默认 composable 名 useFormDialog;rowkey 可配', () => {
    const { code } = generateDialogBlock({ fields: dialogFields, apiUrl: '/api/x', rowkey: 'uid' })
    expect(code).toContain('export function useFormDialog() {')
    expect(code).toContain('${formData.uid}')
  })

  it('vue2 从 @es-plus/vue2 导入并告警 JSX 预设', () => {
    const { code, warnings } = generateDialogBlock({ fields: dialogFields, target: 'vue2' })
    expect(code).toContain("from '@es-plus/vue2'")
    expect(warnings.some((w) => w.includes('babel-preset-jsx') || w.includes('vue2-jsx'))).toBe(true)
  })
})
