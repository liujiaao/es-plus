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

describe('generateFormBlock — formLayout（Wave 4）', () => {
  it('labelWidth/minFoldRows 落 layoutFormProps.formLayProps，模板统一绑定该常量', () => {
    const { code, summary } = generateFormBlock({
      fields,
      buttons: 'query',
      formLayout: { labelWidth: '96px', minFoldRows: 3 },
    })
    expect(code).toContain('const layoutFormProps = { formLayProps: {"labelWidth":"96px","minFoldRows":3} }')
    expect(code).toContain(':layout-form-props="layoutFormProps"')
    expect(code).not.toContain('{ formLayProps: { isBtnHidden: true } }')
    expect(summary).toContain('labelWidth=96px')
    expect(summary).toContain('minFoldRows=3')
  })

  it('不给 formLayout → 产物与 Wave 4 之前逐字节一致（none 支仍内联 isBtnHidden）', () => {
    const { code } = generateFormBlock({ fields, buttons: 'none' })
    expect(code).toContain(':layout-form-props="{ formLayProps: { isBtnHidden: true } }"')
    expect(code).not.toContain('layoutFormProps')
  })

  it('buttons=none + formLayout → isBtnHidden 合并进 formLayProps（隐藏语义不丢）', () => {
    const { code } = generateFormBlock({ fields, formLayout: { labelWidth: 120 } })
    expect(code).toContain('const layoutFormProps = { formLayProps: {"isBtnHidden":true,"labelWidth":120} }')
    expect(code).toContain(':layout-form-props="layoutFormProps"')
  })

  it('buttons=none 时 minFoldRows 不可见 → 显式告警（不静默）', () => {
    const { warnings } = generateFormBlock({ fields, formLayout: { minFoldRows: 2 } })
    expect(warnings.some((w) => w.includes('minFoldRows') && w.includes("buttons:'none'"))).toBe(true)
  })

  it('vue2：layoutFormProps 必须进 setup() 的 return（否则模板拿不到）', () => {
    const { code } = generateFormBlock({
      fields,
      target: 'vue2',
      buttons: 'query',
      formLayout: { minFoldRows: 2 },
    })
    expect(code).toContain('return { model, formItems, configBtn, layoutFormProps }')
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

  it('tableOptions.headerCellStyle 透传到 options（F3 补证：不再写死默认背景）', () => {
    const { code } = generateTableBlock({
      fields: columns,
      apiUrl: '/api/orders',
      tableOptions: { headerCellStyle: { background: '#ffffff' } },
    })
    expect(code).toContain('headerCellStyle: {"background":"#ffffff"}')
    expect(code).not.toContain('#f5f7fa')
  })

  it('未提供 headerCellStyle → 回落到默认背景（保持既有产物）', () => {
    const { code } = generateTableBlock({ fields: columns, apiUrl: '/api/orders' })
    expect(code).toContain('headerCellStyle: {"background":"#f5f7fa"}')
  })

  it('vue2 数据源发单向 :data-source（F7：组件从不 emit update:dataSource）+ 分页仍用 .sync', () => {
    const { code } = generateTableBlock({ fields: columns, apiUrl: '/api/orders', target: 'vue2' })
    // F7：vue2 es-table 自述已移除 update:dataSource 回传 —— `.sync` 会承诺一个
    // 永不触发的子→父方向（声明了却不存在的能力），故只发单向输入。
    expect(code).toContain(':data-source="tableData"')
    expect(code).not.toContain(':data-source.sync')
    // pagination 是例外：vue2 仍 emit update:pagination，`.sync` 成立。
    expect(code).toContain(':pagination.sync="pagination"')
    expect(code).toContain('export default defineComponent({')
    expect(code).toContain('return { columns, options, tableData, tableRef, pagination }')
  })
})

describe('generateTableBlock — 容器级词汇（Wave 4）', () => {
  it('数据键按冻结顺序注入 options（JSON 值内联、字符串加引号）', () => {
    const { code } = generateTableBlock({
      fields: columns,
      apiUrl: '/api/orders',
      tableOptions: {
        size: 'small',
        showHeader: false,
        emptyText: '暂无数据',
        height: 400,
        rowClassName: 'row-cls',
        defaultSort: { prop: 'name', order: 'descending' },
      },
    })
    expect(code).toContain("  size: 'small',")
    // false 是有效取值 —— 判据必须是 !== undefined（真值判断会吞掉 false）
    expect(code).toContain('  showHeader: false,')
    expect(code).toContain("  emptyText: '暂无数据',")
    expect(code).toContain('  height: 400,')
    expect(code).toContain("  rowClassName: 'row-cls',")
    expect(code).toContain('  defaultSort: {"prop":"name","order":"descending"},')
    // 冻结顺序：height(4) < rowClassName(8) < size(13) < showHeader(14) < emptyText(15) < defaultSort(19)
    const at = (k: string) => code.indexOf(`\n  ${k}:`)
    expect(at('height')).toBeLessThan(at('rowClassName'))
    expect(at('rowClassName')).toBeLessThan(at('size'))
    expect(at('size')).toBeLessThan(at('showHeader'))
    expect(at('showHeader')).toBeLessThan(at('emptyText'))
    expect(at('emptyText')).toBeLessThan(at('defaultSort'))
  })

  it('未给的键一律不发射（缺省不污染产物）', () => {
    const { code } = generateTableBlock({ fields: columns, apiUrl: '/api/orders' })
    for (const k of ['size', 'showHeader', 'emptyText', 'height', 'rowClassName', 'defaultSort', 'engine']) {
      expect(code).not.toContain(`\n  ${k}:`)
    }
    // 有默认值的键仍然无条件发射（保持既有产物）
    expect(code).toContain('  border: true,')
    expect(code).toContain('  stripe: true,')
    expect(code).toContain('  highlightCurrentRow: true,')
    expect(code).toContain("  rowkey: 'id',")
  })

  it('pagination 播种 pageSize/pageSizes；current/total 仍由组件托管', () => {
    const { code } = generateTableBlock({
      fields: columns,
      apiUrl: '/api/orders',
      pagination: { pageSize: 20, pageSizes: [10, 20, 50] },
    })
    expect(code).toContain('const pagination = ref({ current: 1, pageSize: 20, pageSizes: [10,20,50], total: 0 })')
  })

  it('未给 pagination → 保持历史默认 { current:1, pageSize:10, total:0 }', () => {
    const { code } = generateTableBlock({ fields: columns, apiUrl: '/api/orders' })
    expect(code).toContain('const pagination = ref({ current: 1, pageSize: 10, total: 0 })')
  })

  it('editConfig 在非 vxe 引擎下显式告警（运行时会被静默忽略）', () => {
    const { warnings } = generateTableBlock({
      fields: columns,
      apiUrl: '/api/orders',
      tableOptions: { editConfig: { trigger: 'click' } },
    })
    expect(warnings.some((w) => w.includes('editConfig') && w.includes('vxe'))).toBe(true)
    const ok = generateTableBlock({
      fields: columns,
      apiUrl: '/api/orders',
      tableOptions: { engine: 'vxe', editConfig: { trigger: 'click' } },
    })
    expect(ok.warnings.some((w) => w.includes('editConfig'))).toBe(false)
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

// ── AI-28：mode='component'（自包含 <es-dialog> SFC）+ 声明式 options ──
describe('generateDialogBlock — mode=component', () => {
  const base = { fields: dialogFields, apiUrl: '/api/users', mode: 'component' as const }

  it('产出 SFC（有 <template>/<script setup>），且 fence 自报 vue', () => {
    const { code, fence } = generateDialogBlock(base)
    expect(fence).toBe('vue')
    expect(code.startsWith('<template>')).toBe(true)
    expect(code).toContain('<es-dialog')
    expect(code).toContain('<script setup lang="ts">')
    expect(code).toContain('</script>')
    // 不依赖 JSX 插件 —— 没有 JSX render,也不导入 useDialog/EsForm
    expect(code).not.toContain('<EsForm')
    expect(code).not.toContain('useDialog')
  })

  it('composable 模式的 fence 仍是 tsx（两形态判据不得互串）', () => {
    const { fence } = generateDialogBlock({ fields: dialogFields, apiUrl: '/api/users' })
    expect(fence).toBe('tsx')
  })

  it('vue3 用 v-model:visible + defineExpose；vue2 用 :visible.sync + setup 返回', () => {
    const v3 = generateDialogBlock(base).code
    expect(v3).toContain('v-model:visible="visible"')
    expect(v3).toContain('defineExpose({ open })')

    const v2 = generateDialogBlock({ ...base, target: 'vue2' }).code
    expect(v2).toContain(':visible.sync="visible"')
    expect(v2).toContain('export default defineComponent({')
    expect(v2).toContain('return { visible, title, formData, formRef, formItems, configBtn, open, close }')
  })

  it('集成契约与 composable 支同形：open(title,row,onSuccess) + 每次 open 重置默认值', () => {
    const { code, summary } = generateDialogBlock({ ...base, target: 'vue2' })
    expect(code).toContain('Object.assign(formData, DEFAULTS, row)')
    expect(code).toContain('onSuccess?.(formData)')
    expect(summary).toContain('open(title, row?, onSuccess?)')
  })

  it('无 apiUrl 时不发 httpRequest（与 composable 支同口径）', () => {
    const { code } = generateDialogBlock({ fields: dialogFields, mode: 'component' })
    expect(code).not.toContain('httpRequest')
    expect(code).not.toContain("from '@es-plus/vue3'")
  })

  it('options 注入模板属性：字符串→静态 attr、数字→绑定、布尔假值必须发出', () => {
    const { code } = generateDialogBlock({
      ...base,
      options: { width: 720, maxHeight: '70vh', isDraggable: true, showClose: false, modal: false, appendTo: '#app' },
    })
    expect(code).toContain(':width="720"')
    expect(code).toContain('max-height="70vh"')
    expect(code).toContain(':is-draggable="true"')
    expect(code).toContain(':show-close="false"')
    expect(code).toContain(':modal="false"')
    expect(code).toContain('append-to="#app"')
    // 键名走 kebab-case（模板属性约定），不得发驼峰
    expect(code).not.toContain('maxHeight="')
    expect(code).not.toContain('isDraggable=')
  })

  it('未给 options.width 时保留历史默认 560px', () => {
    const { code } = generateDialogBlock(base)
    expect(code).toContain('width="560px"')
  })

  it('cacheKey 在 component 模式下显式告警 + 忽略（不发脏属性）', () => {
    const { code, warnings } = generateDialogBlock({ ...base, options: { cacheKey: 'k1' } })
    expect(code).not.toContain('cache-key')
    expect(code).not.toContain('cacheKey')
    expect(warnings.some((w) => w.includes('cacheKey'))).toBe(true)
    expect(warnings.some((w) => w.includes("mode='composable'"))).toBe(true)
  })

  it('appendTo 在 component 模式下正常发射（vue3/antdv 组件真消费）', () => {
    const { code, warnings } = generateDialogBlock({ ...base, options: { appendTo: '#app' } })
    expect(code).toContain('append-to="#app"')
    expect(warnings.some((w) => w.includes('appendTo'))).toBe(false)
  })

  it('appendTo 在 vue2 的 component 模式下显式告警（Element UI 无选择器级挂载点）', () => {
    const { code, warnings } = generateDialogBlock({
      ...base,
      target: 'vue2',
      options: { appendTo: '#app' },
    })
    // 仍发射（组件端退化为 append-to-body），但生成时就把能力缺口点名
    expect(code).toContain('append-to="#app"')
    expect(warnings.some((w) => w.includes('appendTo') && w.includes('#app'))).toBe(true)
    expect(warnings.some((w) => w.includes("mode='composable'"))).toBe(true)
  })

  it("appendTo='body' 在 vue2 的 component 模式下不告警（语义完全等价）", () => {
    const { warnings } = generateDialogBlock({
      ...base,
      target: 'vue2',
      options: { appendTo: 'body' },
    })
    expect(warnings.some((w) => w.includes('appendTo'))).toBe(false)
  })

  it('component 模式不产生 JSX 插件告警，但要提醒全局装配前提', () => {
    const { warnings } = generateDialogBlock(base)
    expect(warnings.some((w) => w.includes('plugin-vue-jsx') || w.includes('babel-preset-jsx'))).toBe(false)
    expect(warnings.some((w) => w.includes('app.use(EsPlus)'))).toBe(true)
  })
})

describe('generateDialogBlock — options（composable 模式）', () => {
  it('选项按冻结顺序注入 dialog({...})，width 仍走历史默认位', () => {
    const { code } = generateDialogBlock({
      fields: dialogFields,
      apiUrl: '/api/x',
      options: { maxHeight: '70vh', destroyOnClose: true, cacheKey: 'k1', modal: false },
    })
    const iWidth = code.indexOf("      width: '560px',")
    const iMax = code.indexOf("      maxHeight: '70vh',")
    const iDestroy = code.indexOf('      destroyOnClose: true,')
    const iCache = code.indexOf("      cacheKey: 'k1',")
    const iModal = code.indexOf('      modal: false,')
    expect(iWidth).toBeGreaterThan(-1)
    // 顺序：width → maxHeight → destroyOnClose → modal → cacheKey（DIALOG_OPTION_ORDER）
    expect(iMax).toBeGreaterThan(iWidth)
    expect(iDestroy).toBeGreaterThan(iMax)
    expect(iModal).toBeGreaterThan(iDestroy)
    expect(iCache).toBeGreaterThan(iModal)
  })

  it('cacheKey 在 composable 模式下正常发射（不告警）', () => {
    const { code, warnings } = generateDialogBlock({ fields: dialogFields, options: { cacheKey: 'k1' } })
    expect(code).toContain("cacheKey: 'k1',")
    expect(warnings.some((w) => w.includes('cacheKey'))).toBe(false)
  })

  it('appendTo 在 composable 模式下正常发射（三端 useDialog 都支持选择器）', () => {
    const { code, warnings } = generateDialogBlock({
      fields: dialogFields,
      options: { appendTo: '#app' },
      target: 'vue2',
    })
    expect(code).toContain("appendTo: '#app',")
    expect(warnings.some((w) => w.includes('appendTo'))).toBe(false)
  })

  it('同选项不同传参插入顺序 → 产物逐字节相同（确定性）', () => {
    const a = generateDialogBlock({ fields: dialogFields, options: { modal: false, maxHeight: '70vh' } }).code
    const b = generateDialogBlock({ fields: dialogFields, options: { maxHeight: '70vh', modal: false } }).code
    expect(a).toBe(b)
  })
})

describe('generateDialogBlock — defaultTitle（AI-36）', () => {
  it('composable：标题成为 open() 首参的缺省值，签名形状不变', () => {
    const { code, summary } = generateDialogBlock({
      fields: dialogFields,
      defaultTitle: '新增用户',
      apiUrl: '/api/users',
    })
    expect(code).toContain("function open(title: string = '新增用户', row: any = {}, onSuccess?")
    expect(summary).toContain('- Default title: 新增用户')
    // 首参仍是唯一真源：POST/PUT 判别继续读 title。
    expect(code).toContain("const method = title === '新增' ? 'POST' : 'PUT'")
  })

  it('component：SFC 的 open() 同样带缺省标题', () => {
    const { code } = generateDialogBlock({
      fields: dialogFields,
      mode: 'component',
      defaultTitle: '订单编辑',
    })
    expect(code).toContain("function open(t: string = '订单编辑', row: Partial<DialogModel> = {}")
  })

  it('不给 defaultTitle → 产物与 AI-36 之前逐字节一致（无参数缺省）', () => {
    const { code } = generateDialogBlock({ fields: dialogFields })
    expect(code).toContain('function open(title: string, row: any = {}, onSuccess?')
    expect(code).not.toContain('title: string =')
  })

  it('JS 模式不带类型标注，缺省值仍发射', () => {
    const { code } = generateDialogBlock({ fields: dialogFields, typescript: false, defaultTitle: '编辑' })
    expect(code).toContain("function open(title = '编辑', row = {}, onSuccess)")
  })
})

describe('generateTableBlock — AN-10 列选项（省略号 / 默认排序）', () => {
  const cols = [
    { prop: 'name', label: '名称', formtype: 'Input', ellipsis: true },
    { prop: 'publishTime', label: '发布时间', formtype: 'DatePicker' },
    { prop: 'amount', label: '金额', formtype: 'InputNumber' },
  ]

  it('ellipsis 发契约键 `ellipsis`（不发 el-table 专有的 showOverflowTooltip）', () => {
    const { code } = generateTableBlock({ fields: cols, apiUrl: '/api/o' })
    expect(code).toContain('ellipsis: true')
    expect(code).not.toContain('showOverflowTooltip')
  })

  it('tableOptions.defaultSort 的目标列补 sortable: true —— 只有它，别的一列都不补', () => {
    const { code } = generateTableBlock({
      fields: cols,
      apiUrl: '/api/o',
      tableOptions: { defaultSort: { prop: 'publishTime', order: 'descending' } },
    })
    // 片段里 sortable 只该出现一次（目标列）
    expect((code.match(/sortable: true/g) || []).length).toBe(1)
    // 它必须落在 publishTime 的列块里
    const colBlock = code.slice(code.indexOf("prop: 'publishTime'"))
    const nextCol = colBlock.indexOf('},\n  {')
    expect(colBlock.slice(0, nextCol === -1 ? 400 : nextCol)).toContain('sortable: true')
    expect(code).toContain('defaultSort: {"prop":"publishTime","order":"descending"}')
  })

  it('无 defaultSort → 片段里没有任何 sortable', () => {
    const { code } = generateTableBlock({ fields: cols, apiUrl: '/api/o' })
    expect(code).not.toContain('sortable: true')
  })
})

describe('AN-11⑤ — 片段表单的 render / formatter 不再静默丢', () => {
  it('字段带 render → 告警点名 prop，控件仍按 formtype 发射', () => {
    const { code, warnings } = generateFormBlock({
      fields: [{ prop: 'status', label: '状态', formtype: 'Input', render: '(h) => h("b")' }],
    } as any)
    expect(warnings.join('\n')).toContain('片段表单不消费字段级 render')
    expect(warnings.join('\n')).toContain('"status"')
    // 标记而非假装支持：formtype 照常发射（es-form 只在无 formtype 时才读 item.render）
    expect(code).toContain('"formtype": "Input"')
  })

  it('字段带 formatter → 告警说明它是表格单元格扩展点', () => {
    const { warnings } = generateFormBlock({
      fields: [{ prop: 'amount', label: '金额', formtype: 'Input', formatter: '(row) => row.amount' }],
    } as any)
    expect(warnings.join('\n')).toContain('片段表单不消费字段级 formatter')
    expect(warnings.join('\n')).toContain('"amount"')
  })

  it('两个都没有 → 不发这两条告警（不制造噪音）', () => {
    const { warnings } = generateFormBlock({ fields })
    expect(warnings.join('\n')).not.toContain('片段表单不消费字段级')
  })
})
