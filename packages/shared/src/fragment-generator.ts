import { buildFormItem, buildTableColumnSFC, getDefaultValue, inferTsType } from './structured-generator.js'
import type { FieldConfig, StructuredCrudConfig } from './structured-config.schema.js'
import type { SurfaceField } from './compose-crud-config.js'
import { getEsPlusPackageName, type TargetFramework, DEFAULT_TARGET } from './target.js'
import { q, qBt, qKey, qMember, inlineJson } from './codegen-escape.js'
import { SPECIAL_BTN_KEYS, OPERATION_COLUMN_PROP_SFC } from './contract.js'

/**
 * 片段发射层(独立组件)——产出**自包含、可独立编译、可嵌入任意宿主**的单组件 SFC。
 *
 * 为什么单独一层而不是复用 `generateFromConfig`:后者只会产出 es-crud-page 或
 * `<es-table><es-form/></es-table>` 的「完整页」形态(fields/actions 均 min(1)),发射不出
 * 一个光秃秃的 `<es-form>` / `<es-table>` / useDialog 片段。含表格的子集走 `composeCrudConfig`
 * → `generateFromConfig`(编译保证现成);不含表格的子集(独立表单/表格/弹窗、与原生/第三方
 * 组件混排)走这里。
 *
 * 关键不变量:**字段级产物复用 `generateFromConfig` 同一套原子构造器**
 * (`buildFormItem`/`getDefaultValue`/`inferTsType` 等),所以 formItem/默认值/类型推断
 * 与完整页逐字节一致——不是另写一份、不会分叉。
 *
 * `emit:'component'`(本层产物)按组件边界隔离:它不碰宿主的 `<script setup>` 作用域,
 * 因此与 `<a-chart>`、`<el-tabs>`、任意第三方组件并排放都不冲突——"组合"退化成"摆组件"。
 */

export interface FragmentResult {
  code: string
  summary: string
  warnings: string[]
}

export interface FormBlockInput {
  /** 表单字段(复用 FieldConfig 词汇,无需 inQuery/inTable/inForm)。 */
  fields: SurfaceField[]
  target?: TargetFramework
  typescript?: boolean
  i18n?: boolean
  /** span 兜底口径:'query' 偏窄(6/8),'form' 整行(24)。默认 'form'。 */
  context?: 'query' | 'form'
  /** 底部按钮:'none'(默认,隐藏按钮区)/ 'query'(查询+重置)/ 'submit'(保存+重置)。 */
  buttons?: 'none' | 'query' | 'submit'
}

function resolveTarget(t?: TargetFramework): TargetFramework {
  return t === 'vue2' || t === 'antdv' ? t : DEFAULT_TARGET
}

/**
 * 独立 `<es-form>` 组件。自包含:自带 model(reactive)、formItemList、可选按钮。
 * es-plus 组件经插件全局注册,模板里用 `<es-form>` 全局标签,无需 import 组件本身
 * (与 `generateFromConfig` 的 SFC 模式一致)。
 */
export function generateFormBlock(input: FormBlockInput): FragmentResult {
  const target = resolveTarget(input.target)
  const isVue2 = target === 'vue2'
  const ts = input.typescript ?? true
  const i18n = input.i18n ?? false
  const context = input.context ?? 'form'
  const buttons = input.buttons ?? 'none'
  const fields = input.fields
  const warnings: string[] = []

  const lines: string[] = []

  // Template
  lines.push('<template>')
  const btnAttr = buttons === 'none' ? '' : ' :config-btn="configBtn"'
  const hideBtn = buttons === 'none' ? ' :layout-form-props="{ formLayProps: { isBtnHidden: true } }"' : ''
  lines.push(`  <es-form :model="model" :form-item-list="formItems"${btnAttr}${hideBtn} />`)
  lines.push('</template>')
  lines.push('')

  // Script 头:vue3/antdv 用 <script setup>,vue2 用 defineComponent + setup()
  const scriptLang = ts ? 'ts' : ''
  if (isVue2) {
    lines.push(scriptLang ? `<script lang="${scriptLang}">` : '<script>')
  } else {
    lines.push(scriptLang ? `<script setup lang="${scriptLang}">` : '<script setup>')
  }

  const vueImports = isVue2 ? ['defineComponent', 'reactive'] : ['reactive']
  lines.push(`import { ${vueImports.join(', ')} } from 'vue'`)
  lines.push('')

  if (isVue2) {
    lines.push('export default defineComponent({')
    lines.push('  setup() {')
  }

  // TS 接口(复用 inferTsType,与完整页一致)
  if (ts && fields.length > 0) {
    lines.push('interface FormModel {')
    for (const f of fields) {
      lines.push(`  ${qKey(f.prop)}: ${inferTsType(f as unknown as FieldConfig)}`)
    }
    lines.push('}')
    lines.push('')
  }

  // 响应式 model(复用 getDefaultValue)
  const modelInit = fields.map((f) => `${qKey(f.prop)}: ${getDefaultValue(f as unknown as FieldConfig)}`).join(', ')
  lines.push(ts ? `const model = reactive<FormModel>({ ${modelInit} })` : `const model = reactive({ ${modelInit} })`)

  // formItems(复用 buildFormItem，内联 JSON)
  const formItemsJson = inlineJson(fields.map((f) => buildFormItem(f as unknown as FieldConfig, context, i18n)), 2)
  lines.push(`const formItems = ${formItemsJson}`)

  // 可选按钮
  if (buttons !== 'none') {
    lines.push('')
    lines.push('const configBtn = [')
    if (buttons === 'query') {
      lines.push(`  { name: '查询', type: 'primary', key: '${SPECIAL_BTN_KEYS.QUERY}', triggerEvent: true },`)
      lines.push(`  { name: '重置', key: '${SPECIAL_BTN_KEYS.RESET}', triggerEvent: true },`)
    } else {
      lines.push(`  { name: '保存', type: 'primary', key: 'save', triggerEvent: true },`)
      lines.push(`  { name: '重置', key: '${SPECIAL_BTN_KEYS.RESET}', triggerEvent: true },`)
    }
    lines.push(']')
  }

  // vue2:闭合 setup() 并 return
  if (isVue2) {
    const exposed = ['model', 'formItems']
    if (buttons !== 'none') exposed.push('configBtn')
    lines.push('')
    lines.push(`    return { ${exposed.join(', ')} }`)
    lines.push('  }')
    lines.push('})')
  }

  lines.push('</script>')

  const code = lines.join('\n')
  const summary = [
    `Generated standalone <es-form> block (target=${target}):`,
    `- ${fields.length} field(s), span context=${context}, buttons=${buttons}`,
    ts ? '- TypeScript enabled' : '',
    isVue2
      ? '- Target: Vue 2 + Element UI (@es-plus/vue2)'
      : target === 'antdv'
        ? '- Target: Vue 3 + Ant Design Vue (@es-plus/adapter-antdv)'
        : '- Target: Vue 3 + Element Plus (@es-plus/vue3)',
    '- Self-contained component — drop next to native/third-party components.',
  ].filter(Boolean).join('\n')

  return { code, summary, warnings }
}

export interface TableRowButton {
  name: string
  type?: string
  key?: string
}

export interface TableBlockInput {
  /** 列字段(复用 FieldConfig 词汇)。 */
  fields: SurfaceField[]
  /** 列表数据接口;给了则发 `apiParams.url`(es-table 经全局 httpRequest 自动取数),否则需手动接数据。 */
  apiUrl?: string
  target?: TargetFramework
  typescript?: boolean
  i18n?: boolean
  tableOptions?: {
    border?: boolean
    stripe?: boolean
    rowkey?: string
    highlightCurrentRow?: boolean
    multiSelect?: boolean
  }
  /**
   * 可选操作列按钮。刻意只发 `triggerEvent: true`(事件上抛)而不内联 click 处理体——
   * 独立表格没有 openForm/handleDelete 的上下文,内联会产生悬空引用导致编译失败。
   * 宿主监听 es-table 的事件自行处理。
   */
  rowButtons?: TableRowButton[]
}

/**
 * 独立 `<es-table>` 组件。自包含:columns(复用 buildTableColumnSFC)、options、
 * data-source / pagination 的 ref。给 `apiUrl` 时经 es-table 的 `apiParams` 自动取数。
 */
export function generateTableBlock(input: TableBlockInput): FragmentResult {
  const target = resolveTarget(input.target)
  const isVue2 = target === 'vue2'
  const ts = input.typescript ?? true
  const i18n = input.i18n ?? false
  const fields = input.fields
  const t = input.tableOptions ?? {}
  const warnings: string[] = []

  if (!input.apiUrl) {
    warnings.push('未提供 apiUrl —— 生成的表格不会自动取数,请为 tableData 手动接入数据源(或改用 compose/CRUD 页)。')
  }

  const lines: string[] = []

  lines.push('<template>')
  lines.push('  <es-table')
  lines.push('    ref="tableRef"')
  lines.push('    :columns="columns"')
  lines.push('    :options="options"')
  if (isVue2) {
    lines.push('    :data-source.sync="tableData"')
    lines.push('    :pagination.sync="pagination"')
  } else {
    lines.push('    v-model:data-source="tableData"')
    lines.push('    v-model:pagination="pagination"')
  }
  lines.push('  />')
  lines.push('</template>')
  lines.push('')

  const scriptLang = ts ? 'ts' : ''
  if (isVue2) {
    lines.push(scriptLang ? `<script lang="${scriptLang}">` : '<script>')
  } else {
    lines.push(scriptLang ? `<script setup lang="${scriptLang}">` : '<script setup>')
  }
  lines.push(`import { ${isVue2 ? 'defineComponent, ref' : 'ref'} } from 'vue'`)
  lines.push('')

  if (isVue2) {
    lines.push('export default defineComponent({')
    lines.push('  setup() {')
  }

  // columns —— 复用 buildTableColumnSFC(只读 config.i18n)
  const cfgLike = { i18n } as unknown as StructuredCrudConfig
  lines.push('const columns = [')
  for (const f of fields) {
    lines.push(`  ${buildTableColumnSFC(f as unknown as FieldConfig, cfgLike)},`)
  }
  if (input.rowButtons && input.rowButtons.length) {
    const w = input.rowButtons.length * 80 + 20
    lines.push('  {')
    lines.push(`    prop: '${OPERATION_COLUMN_PROP_SFC}',`)
    lines.push(`    label: '操作',`)
    lines.push(`    width: ${w},`)
    lines.push(`    fixed: 'right',`)
    lines.push('    btns: [')
    for (const b of input.rowButtons) {
      const parts = [`name: ${q(b.name)}`]
      if (b.type) parts.push(`type: ${q(b.type)}`)
      if (b.key) parts.push(`key: ${q(b.key)}`)
      parts.push('triggerEvent: true')
      lines.push(`      { ${parts.join(', ')} },`)
    }
    lines.push('    ]')
    lines.push('  },')
  }
  lines.push(']')
  lines.push('')

  // options
  lines.push('const options = {')
  lines.push(`  border: ${t.border !== false},`)
  lines.push(`  stripe: ${t.stripe !== false},`)
  lines.push(`  highlightCurrentRow: ${t.highlightCurrentRow !== false},`)
  lines.push(`  headerCellStyle: { background: '#f5f7fa' },`)
  if (input.apiUrl) lines.push(`  apiParams: { url: ${q(input.apiUrl)} },`)
  lines.push(`  rowkey: ${q(t.rowkey || 'id')},`)
  if (t.multiSelect) lines.push('  multiSelect: true,')
  lines.push('}')
  lines.push('')

  lines.push('const tableData = ref([])')
  lines.push('const tableRef = ref(null)')
  lines.push('const pagination = ref({ current: 1, pageSize: 10, total: 0 })')

  if (isVue2) {
    lines.push('')
    lines.push('    return { columns, options, tableData, tableRef, pagination }')
    lines.push('  }')
    lines.push('})')
  }

  lines.push('</script>')

  const code = lines.join('\n')
  const summary = [
    `Generated standalone <es-table> block (target=${target}):`,
    `- ${fields.length} column(s)${input.rowButtons?.length ? `, ${input.rowButtons.length} row button(s)` : ''}`,
    input.apiUrl ? `- Auto-fetch via apiParams: ${input.apiUrl}` : '- No apiUrl — wire tableData manually',
    ts ? '- TypeScript enabled' : '',
    isVue2
      ? '- Target: Vue 2 + Element UI (@es-plus/vue2)'
      : target === 'antdv'
        ? '- Target: Vue 3 + Ant Design Vue (@es-plus/adapter-antdv)'
        : '- Target: Vue 3 + Element Plus (@es-plus/vue3)',
    '- Self-contained component — drop next to native/third-party components.',
  ].filter(Boolean).join('\n')

  return { code, summary, warnings }
}

export interface DialogBlockInput {
  /** 弹窗内表单字段。 */
  fields: SurfaceField[]
  /** 提交接口;给了则「确定」按钮按标题 POST(新增)/ PUT(其它)提交,否则仅校验+回调。 */
  apiUrl?: string
  /** 编辑态 PUT 的主键(拼 `${apiUrl}/${formData[rowkey]}`),默认 'id'。 */
  rowkey?: string
  target?: TargetFramework
  typescript?: boolean
  i18n?: boolean
  /** 导出的 composable 名,默认 'useFormDialog'。 */
  composableName?: string
}

/**
 * 独立弹窗 —— 产出一个 `useXxxDialog()` composable(**.tsx/.jsx 模块**,非 SFC)。
 * 弹窗体是一个 EsForm(JSX render),复用 buildFormItem/getDefaultValue。
 *
 * `open(title, row?, onSuccess?)` 是与宿主的集成契约:提交成功后回调 `onSuccess`,
 * 独立弹窗没有自己的表格可刷新 —— 由宿主在 onSuccess 里刷新它自己的 es-table。
 * 这正是"弹窗 + 独立表格/原生组件"混排时的确定性接法,不靠 LLM 临场发挥。
 */
export function generateDialogBlock(input: DialogBlockInput): FragmentResult {
  const target = resolveTarget(input.target)
  const isVue2 = target === 'vue2'
  const ts = input.typescript ?? true
  const i18n = input.i18n ?? false
  const fields = input.fields
  const rowkey = input.rowkey || 'id'
  const name = input.composableName || 'useFormDialog'
  const esPlusPkg = getEsPlusPackageName(target)
  const warnings: string[] = []

  // JSX render 的编译前提(与 generateFromConfig 的 SFC 弹窗同口径)
  if (isVue2) {
    warnings.push('target=vue2: 弹窗用 JSX render —— 需项目启用 @vue/babel-preset-jsx(或 @vitejs/plugin-vue2-jsx)。')
  } else {
    warnings.push(`target=${target}: 弹窗用 JSX render —— 模块以 ${ts ? '.tsx' : '.jsx'} 产出,需安装并注册 @vitejs/plugin-vue-jsx。`)
  }
  if (target === 'antdv' && fields.some((f) => f.render)) {
    warnings.push('target=antdv: 内联 render() 按 Element 语义(Tag type=)产出,Ant Design Vue 的 Tag 用 color —— 请核对。')
  }

  const lines: string[] = []

  // Imports
  lines.push(`import { reactive } from 'vue'`)
  const esPlusNamed = ['useDialog', 'EsForm']
  if (input.apiUrl) esPlusNamed.push('httpRequest')
  lines.push(`import { ${esPlusNamed.join(', ')} } from '${esPlusPkg}'`)
  lines.push('')

  // Composable
  lines.push(`export function ${name}() {`)
  lines.push('  const dialog = useDialog()')
  lines.push('')
  const openSig = ts
    ? `  function open(title: string, row: any = {}, onSuccess?: (data: any) => void) {`
    : `  function open(title, row = {}, onSuccess) {`
  lines.push(openSig)

  const defaults = fields.map((f) => `${qKey(f.prop)}: ${getDefaultValue(f as unknown as FieldConfig)}`).join(', ')
  const formInit = [defaults, '...row'].filter(Boolean).join(', ')
  lines.push(`    const formData = reactive({ ${formInit} })`)
  lines.push(`    const isView = title === '查看'`)
  lines.push('')

  const formItemsJson = inlineJson(fields.map((f) => buildFormItem(f as unknown as FieldConfig, 'form', i18n)), 4)
  lines.push(`    const formItems = ${formItemsJson}`)
  lines.push('')

  lines.push('    dialog({')
  lines.push('      title,')
  lines.push(`      width: '560px',`)
  lines.push('      render: (h, { registerRef }) => (')
  lines.push('        <EsForm')
  lines.push(`          ref={el => el && registerRef('form', el)}`)
  lines.push('          model={formData}')
  lines.push('          formItemList={formItems}')
  lines.push(`          layoutFormProps={{ formLayProps: { labelWidth: '100px', isBtnHidden: true } }}`)
  lines.push('        />')
  lines.push('      ),')
  lines.push('      configBtn: isView ? [')
  lines.push(`        { name: '关闭', click: (_, { close }) => close() }`)
  lines.push('      ] : [')
  lines.push(`        { name: '取消', click: (_, { close }) => close() },`)
  lines.push(`        { name: '确定', type: 'primary', click: async (_, { close, getRefs }) => {`)
  lines.push(`          try {`)
  lines.push(`            await getRefs('form')?.validate()`)
  lines.push(`          } catch {`)
  lines.push(`            return // 校验未通过:静默中止,等用户修正`)
  lines.push(`          }`)
  if (input.apiUrl) {
    lines.push(`          const method = title === '新增' ? 'POST' : 'PUT'`)
    lines.push(`          const url = title === '新增' ? ${q(input.apiUrl)} : \`${qBt(input.apiUrl)}/\${formData${qMember(rowkey)}}\``)
    lines.push(`          await httpRequest({ url, method, data: formData })`)
  }
  lines.push(`          close()`)
  lines.push(`          onSuccess?.(formData)`)
  lines.push(`        } }`)
  lines.push('      ]')
  lines.push('    })')
  lines.push('  }')
  lines.push('')
  lines.push('  return { open }')
  lines.push('}')

  const code = lines.join('\n')
  const summary = [
    `Generated standalone dialog composable ${name}() (target=${target}):`,
    `- ${fields.length} form field(s)`,
    input.apiUrl ? `- Submit via httpRequest: ${input.apiUrl} (POST on 新增, PUT otherwise)` : '- No apiUrl — validate + onSuccess(formData) only',
    `- Integration: open(title, row?, onSuccess?) — host refreshes its own table in onSuccess`,
    ts ? `- Emit as .tsx (JSX render)` : '- Emit as .jsx (JSX render)',
    isVue2
      ? '- Target: Vue 2 + Element UI (@es-plus/vue2)'
      : target === 'antdv'
        ? '- Target: Vue 3 + Ant Design Vue (@es-plus/adapter-antdv)'
        : '- Target: Vue 3 + Element Plus (@es-plus/vue3)',
  ].filter(Boolean).join('\n')

  return { code, summary, warnings }
}
