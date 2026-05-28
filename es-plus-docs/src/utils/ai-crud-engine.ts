/**
 * AI CRUD Engine - Rule-based natural language to @es-plus/vue3 config generator
 * Parses Chinese/English field descriptions and generates complete CRUD page configuration
 */

export interface GeneratedConfig {
  formItems: any[]
  columns: any[]
  queryBtns: any[]
  tableOptions: any
  actions: string[]
  dialogFormItems?: any[]
  hasStatusRender?: boolean
}

interface ParsedField {
  name: string
  prop: string
  type: string
  isQuery: boolean
  isTable: boolean
  isForm: boolean
}

const TYPE_RULES: Array<{ keywords: string[]; type: string; attrs?: Record<string, any> }> = [
  { keywords: ['状态', 'status', '类型', 'type', '分类', 'category', '级别', 'level', '来源', 'source'], type: 'Select' },
  { keywords: ['日期', 'date', '创建时间', 'createTime', '更新时间', 'updateTime', '开始日期', '结束日期'], type: 'datePicker', attrs: { type: 'daterange', valueFormat: 'YYYY-MM-DD' } },
  { keywords: ['时间', 'time', '时刻', 'timerange', 'timepicker'], type: 'timePicker', attrs: { type: 'timerange' } },
  { keywords: ['开关', 'switch', '是否', '启用', 'enable', 'disabled'], type: 'Switch' },
  { keywords: ['评分', 'rate', '星级', 'score'], type: 'Rate' },
  { keywords: ['颜色', 'color'], type: 'ColorPicker' },
  { keywords: ['图片', 'image', '头像', 'avatar', '文件', 'file', '附件', 'attachment'], type: 'Upload' },
  { keywords: ['备注', 'remark', '描述', 'description', '内容', 'content', '简介', 'intro'], type: 'Input', attrs: { type: 'textarea', rows: 3 } },
  { keywords: ['性别', 'gender', '单选', 'radio'], type: 'Radio' },
  { keywords: ['多选', 'checkbox', '兴趣', '爱好', '标签', 'tags'], type: 'Checkbox' },
  { keywords: ['省市', '城市', '地区', 'cascader', '层级', '区域'], type: 'Cascader' },
  { keywords: ['进度', 'slider', '区间', '范围'], type: 'Slider' },
  { keywords: ['穿梭', 'transfer', '分配'], type: 'Transfer' },
]

const FIELD_PROP_MAP: Record<string, string> = {
  '姓名': 'name', '名称': 'name', '用户名': 'username',
  '手机号': 'phone', '电话': 'phone', '手机': 'phone',
  '邮箱': 'email', '邮件': 'email',
  '状态': 'status', '地址': 'address',
  '订单号': 'orderNo', '编号': 'code',
  '金额': 'amount', '价格': 'price',
  '日期': 'date', '时间': 'time',
  '创建时间': 'createTime', '更新时间': 'updateTime',
  '开始时间': 'startTime', '结束时间': 'endTime',
  '分类': 'category', '类型': 'type',
  '标题': 'title', '关键词': 'keyword',
  '客户': 'customer', '客户名称': 'customerName',
  '年龄': 'age', '性别': 'gender',
  '部门': 'department', '职位': 'position',
  '角色': 'role', '权限': 'permission',
  '商品': 'product', '商品名称': 'productName',
  '数量': 'quantity', '库存': 'stock',
  '级别': 'level', '来源': 'source',
  '备注': 'remark', '描述': 'description',
  '公司': 'company', '项目': 'project', '品牌': 'brand',
  '账号': 'account', '昵称': 'nickname',
  '创建人': 'creator', '操作人': 'operator',
  '内容': 'content', '简介': 'intro',
  '头像': 'avatar', '图片': 'image',
  '排序': 'sort', '序号': 'sortNo',
  '标签': 'tags', '评分': 'score',
}

const STATUS_OPTIONS = [
  { label: '启用', value: 1 },
  { label: '禁用', value: 0 }
]

const TYPE_OPTIONS = [
  { label: '类型A', value: 'A' },
  { label: '类型B', value: 'B' },
  { label: '类型C', value: 'C' }
]

function inferType(fieldName: string): { type: string; attrs?: Record<string, any> } {
  for (const rule of TYPE_RULES) {
    if (rule.keywords.some(kw => fieldName.toLowerCase().includes(kw.toLowerCase()))) {
      return { type: rule.type, attrs: rule.attrs }
    }
  }
  return { type: 'Input' }
}

function toProp(fieldName: string): string {
  if (FIELD_PROP_MAP[fieldName]) return FIELD_PROP_MAP[fieldName]
  if (/^[a-zA-Z_$]/.test(fieldName)) return fieldName
  const pinyin = fieldName.replace(/[一-龥]/g, '')
  return pinyin || `field_${Math.random().toString(36).slice(2, 6)}`
}

function getDataOptions(fieldName: string): any[] | undefined {
  if (/状态|启用|禁用/.test(fieldName)) return STATUS_OPTIONS
  if (/类型|分类|级别|来源/.test(fieldName)) return TYPE_OPTIONS
  if (/性别/.test(fieldName)) return [{ label: '男', value: 'male' }, { label: '女', value: 'female' }]
  return undefined
}

function parseFields(input: string): ParsedField[] {
  const fields: ParsedField[] = []

  const queryMatch = input.match(/查询[：:条件字段有]*([一-龥a-zA-Z、，,\s]+?)(?=[，,。.；;表格支持操作]|$)/)
  const queryFieldsStr = queryMatch?.[1] || ''
  const queryFieldNames = splitFields(queryFieldsStr)

  const tableMatch = input.match(/表格[：:显示展示字段列有]*([一-龥a-zA-Z、，,\s]+?)(?=[，,。.；;支持操作查询]|$)/)
  const tableFieldsStr = tableMatch?.[1] || ''
  const tableFieldNames = splitFields(tableFieldsStr)

  if (!queryMatch && !tableMatch) {
    const allFields = extractAllFields(input)
    allFields.forEach(name => {
      fields.push({
        name,
        prop: toProp(name),
        type: inferType(name).type,
        isQuery: true,
        isTable: true,
        isForm: true,
      })
    })
    return fields
  }

  const seen = new Set<string>()

  queryFieldNames.forEach(name => {
    if (seen.has(name)) return
    seen.add(name)
    fields.push({ name, prop: toProp(name), type: inferType(name).type, isQuery: true, isTable: true, isForm: true })
  })

  tableFieldNames.forEach(name => {
    if (seen.has(name)) return
    seen.add(name)
    fields.push({ name, prop: toProp(name), type: inferType(name).type, isQuery: false, isTable: true, isForm: true })
  })

  return fields
}

function splitFields(str: string): string[] {
  return str
    .split(/[、，,\s]+/)
    .map(s => s.trim())
    .filter(s => s.length > 0 && s.length < 10)
}

function extractAllFields(input: string): string[] {
  const cleaned = input
    .replace(/^.*?[：:]/,'')
    .replace(/[，,]?\s*支持.*$/, '')
    .replace(/[，,]?\s*操作.*$/, '')
  return splitFields(cleaned)
}

function parseActions(input: string): string[] {
  const actionMatch = input.match(/(?:支持|操作[有：:]?)\s*(.+?)(?:[。.]|$)/)
  const onlyViewMatch = input.match(/只(?:查看|读|浏览)/)

  if (onlyViewMatch) {
    return ['view']
  }

  const actionSection = actionMatch?.[1] || ''

  if (!actionSection) {
    return ['add', 'edit', 'delete']
  }

  const actions: string[] = []
  const text = actionSection

  if (/新增|添加|创建|add|create/i.test(text)) actions.push('add')
  if (/编辑|修改|更新|edit|update/i.test(text)) actions.push('edit')
  if (/删除|移除|remove|delete/i.test(text)) actions.push('delete')
  if (/查看|详情|detail|view/i.test(text)) actions.push('view')
  if (/导出|export/i.test(text)) actions.push('export')
  if (/导入|import/i.test(text)) actions.push('import')

  return actions.length > 0 ? actions : ['add', 'edit', 'delete']
}

export function generateCrudConfig(input: string): GeneratedConfig {
  const fields = parseFields(input)
  const actions = parseActions(input)

  const formItems = fields
    .filter(f => f.isQuery)
    .map(f => {
      const item: any = {
        prop: f.prop,
        label: f.name,
        formtype: f.type,
        span: 6,
        attrs: { clearable: true },
      }
      const typeInfo = inferType(f.name)
      if (typeInfo.attrs) item.attrs = { ...item.attrs, ...typeInfo.attrs }
      const options = getDataOptions(f.name)
      if (options) item.dataOptions = options
      if (f.type === 'datePicker' || f.type === 'timePicker') item.span = 8
      return item
    })

  const queryBtns: any[] = [
    { name: '查询', type: 'primary', key: 'query', triggerEvent: true },
    { name: '重置', key: 'rest', triggerEvent: true },
  ]

  if (actions.includes('add')) {
    queryBtns.push({ name: '新增', type: 'primary', key: 'add', icon: 'Plus' })
  }
  if (actions.includes('export')) {
    queryBtns.push({ name: '导出', key: 'export', icon: 'Download' })
  }
  if (actions.includes('import')) {
    queryBtns.push({ name: '导入', key: 'import', icon: 'Upload' })
  }

  let hasStatusRender = false
  const columns = fields
    .filter(f => f.isTable)
    .map(f => {
      const col: any = { prop: f.prop, label: f.name }
      if (f.name.includes('状态') || f.name.includes('status')) {
        hasStatusRender = true
        col.render = `(_, { row }) => h(ElTag, { type: row.${f.prop} === 1 ? 'success' : 'danger' }, () => row.${f.prop} === 1 ? '启用' : '禁用')`
      }
      return col
    })

  const actionBtns: any[] = []
  if (actions.includes('view')) actionBtns.push({ name: '查看', type: 'primary' })
  if (actions.includes('edit')) actionBtns.push({ name: '编辑', type: 'primary' })
  if (actions.includes('delete')) actionBtns.push({ name: '删除', type: 'danger' })

  if (actionBtns.length > 0) {
    columns.push({
      prop: 'operate',
      label: '操作',
      width: actionBtns.length * 80 + 20,
      btns: actionBtns
    })
  }

  const tableOptions: any = {
    border: true,
    stripe: true,
    highlightCurrentRow: true,
    headerCellStyle: { background: '#f5f7fa' },
    configTableOut: { total: 'total', tableData: 'data', pageSize: 'pageSize', current: 'pageIndex' },
    rowkey: 'id',
  }

  const dialogFormItems = fields
    .filter(f => f.isForm)
    .map(f => {
      const item: any = {
        prop: f.prop,
        label: f.name,
        formtype: f.type,
        span: 24,
        attrs: { clearable: true },
        formItemOptions: {
          rules: [{ required: true, message: `请输入${f.name}`, trigger: 'blur' }]
        },
      }
      const options = getDataOptions(f.name)
      if (options) {
        item.dataOptions = options
        item.formItemOptions.rules = [{ required: true, message: `请选择${f.name}`, trigger: 'change' }]
      }
      const typeInfo = inferType(f.name)
      if (typeInfo.attrs) item.attrs = { ...item.attrs, ...typeInfo.attrs }
      return item
    })

  return { formItems, columns, queryBtns, tableOptions, actions, dialogFormItems, hasStatusRender }
}

export function generateCode(config: GeneratedConfig): string {
  const lines: string[] = []
  const hasDialog = config.actions.includes('add') || config.actions.includes('edit') || config.actions.includes('view')
  const hasDelete = config.actions.includes('delete')

  lines.push(`<template>`)
  lines.push(`  <es-table`)
  lines.push(`    ref="tableRef"`)
  lines.push(`    :columns="columns"`)
  lines.push(`    :options="options"`)
  lines.push(`    v-model:data-source="tableData"`)
  lines.push(`    v-model:pagination="pagination"`)
  lines.push(`  >`)
  lines.push(`    <es-form :model="queryForm" :form-item-list="formItems" :config-btn="queryBtns" />`)
  lines.push(`  </es-table>`)
  lines.push(`</template>`)
  lines.push(``)
  lines.push(`<script setup>`)

  const vueImports = ['reactive', 'ref']
  if (config.hasStatusRender) vueImports.push('h')
  lines.push(`import { ${vueImports.join(', ')} } from 'vue'`)

  if (hasDialog) {
    lines.push(`import { useDialog } from '@es-plus/vue3'`)
  }

  const epImports: string[] = []
  if (config.hasStatusRender) epImports.push('ElTag')
  if (hasDelete) epImports.push('ElMessageBox', 'ElMessage')
  if (epImports.length > 0) {
    lines.push(`import { ${epImports.join(', ')} } from 'element-plus'`)
  }

  lines.push(``)

  const modelFields = config.formItems.map(f => `${f.prop}: ''`).join(', ')
  lines.push(`const queryForm = reactive({ ${modelFields} })`)
  lines.push(`const tableData = ref([])`)
  lines.push(`const tableRef = ref(null)`)
  lines.push(`const pagination = ref({ current: 1, pageSize: 10, total: 0 })`)

  if (hasDialog) {
    lines.push(`const dialog = useDialog()`)
  }
  lines.push(``)

  lines.push(`const formItems = ${JSON.stringify(config.formItems, null, 2)}`)
  lines.push(``)

  lines.push(`const queryBtns = [`)
  for (const btn of config.queryBtns) {
    if (btn.key === 'add') {
      lines.push(`  { name: '${btn.name}', type: '${btn.type}', key: '${btn.key}', icon: '${btn.icon}', click: () => openForm('新增') },`)
    } else if (btn.key === 'export') {
      lines.push(`  { name: '${btn.name}', key: '${btn.key}', icon: '${btn.icon}', click: () => { /* TODO: 调用导出接口 */ } },`)
    } else if (btn.key === 'import') {
      lines.push(`  { name: '${btn.name}', key: '${btn.key}', icon: '${btn.icon}', click: () => { /* TODO: 调用导入接口 */ } },`)
    } else {
      const parts = [`name: '${btn.name}'`]
      if (btn.type) parts.push(`type: '${btn.type}'`)
      parts.push(`key: '${btn.key}'`)
      if (btn.triggerEvent) parts.push(`triggerEvent: true`)
      lines.push(`  { ${parts.join(', ')} },`)
    }
  }
  lines.push(`]`)
  lines.push(``)

  const colStr = JSON.stringify(config.columns, null, 2)
    .replace(/"render": "(.*?)"/g, (_, code) => `render: ${code.replace(/\\"/g, '"')}`)
  lines.push(`const columns = ${colStr}`)
  lines.push(``)

  lines.push(`const options = {`)
  lines.push(`  border: true,`)
  lines.push(`  stripe: true,`)
  lines.push(`  highlightCurrentRow: true,`)
  lines.push(`  headerCellStyle: { background: '#f5f7fa' },`)
  lines.push(`  httpRequest: async (params) => {`)
  lines.push(`    // TODO: 替换为实际接口调用`)
  lines.push(`    // const res = await axios.get('/api/list', { params: params.formParams })`)
  lines.push(`    // return res.data`)
  lines.push(`  },`)
  lines.push(`  configTableOut: { total: 'total', tableData: 'data', pageSize: 'pageSize', current: 'pageIndex' },`)
  lines.push(`  rowkey: 'id'`)
  lines.push(`}`)

  if (hasDelete) {
    lines.push(``)
    lines.push(`function handleDelete(row) {`)
    lines.push(`  ElMessageBox.confirm('确定删除该条数据吗？', '提示', { type: 'warning' })`)
    lines.push(`    .then(async () => {`)
    lines.push(`      // TODO: 调用删除接口`)
    lines.push(`      // await axios.delete(\`/api/item/\${row.id}\`)`)
    lines.push(`      ElMessage.success('删除成功')`)
    lines.push(`      tableRef.value?.httpRequestInstance()`)
    lines.push(`    })`)
    lines.push(`    .catch(() => {})`)
    lines.push(`}`)
  }

  if (hasDialog) {
    lines.push(``)
    lines.push(`function openForm(title, row = {}) {`)
    const dialogModelFields = (config.dialogFormItems || []).map(f => `${f.prop}: ''`).join(', ')
    lines.push(`  const formData = reactive({ ${dialogModelFields}, ...row })`)
    lines.push(`  const isView = title === '查看'`)
    lines.push(`  dialog({`)
    lines.push(`    title,`)
    lines.push(`    width: '500px',`)
    lines.push(`    render: (h, { registerRef }) => (`)
    lines.push(`      <EsForm`)
    lines.push(`        ref={el => el && registerRef('form', el)}`)
    lines.push(`        model={formData}`)
    const dialogItemsStr = JSON.stringify(config.dialogFormItems, null, 8)
    lines.push(`        formItemList={${dialogItemsStr}}`)
    lines.push(`      />`)
    lines.push(`    ),`)
    if (config.actions.includes('view') && !config.actions.includes('add') && !config.actions.includes('edit')) {
      lines.push(`    configBtn: isView ? [] : [`)
    } else {
      lines.push(`    configBtn: isView ? [`)
      lines.push(`      { name: '关闭', click: (_, { close }) => close() }`)
      lines.push(`    ] : [`)
    }
    lines.push(`      { name: '取消', click: (_, { close }) => close() },`)
    lines.push(`      { name: '确定', type: 'primary', click: async (_, { close, getRefs }) => {`)
    lines.push(`        try {`)
    lines.push(`          await getRefs('form')?.validate()`)
    lines.push(`          // TODO: 调用保存接口`)
    lines.push(`          // await axios.post('/api/save', formData)`)
    lines.push(`          close()`)
    lines.push(`          tableRef.value?.httpRequestInstance()`)
    lines.push(`        } catch {`)
    lines.push(`          // 表单验证失败`)
    lines.push(`        }`)
    lines.push(`      }}`)
    lines.push(`    ]`)
    lines.push(`  })`)
    lines.push(`}`)
  }

  lines.push(`</script>`)

  let code = lines.join('\n')
  code = code.replace(/"name": "编辑",\s*"type": "primary"/g,
    '"name": "编辑", "type": "primary", "clickEvent": (row) => openForm(\'编辑\', row)')
  code = code.replace(/"name": "查看",\s*"type": "primary"/g,
    '"name": "查看", "type": "primary", "clickEvent": (row) => openForm(\'查看\', row)')
  code = code.replace(/"name": "删除",\s*"type": "danger"/g,
    '"name": "删除", "type": "danger", "clickEvent": (row) => handleDelete(row)')

  return code
}

export const PRESET_EXAMPLES = [
  {
    label: '用户管理',
    prompt: '用户管理页面，查询条件有姓名、手机号、状态，表格显示姓名、手机号、邮箱、状态、创建时间，支持新增编辑删除'
  },
  {
    label: '订单列表',
    prompt: '订单列表，查询订单号、客户名称、日期范围、状态，表格显示订单号、客户、金额、状态、创建时间，支持查看详情和删除'
  },
  {
    label: '商品管理',
    prompt: '商品管理，查询商品名称、分类、状态，表格显示名称、分类、价格、库存、状态，支持新增编辑删除'
  },
  {
    label: '日志查询',
    prompt: '操作日志查询，查询关键词、级别、日期范围，表格显示时间、级别、操作人、内容，只查看不编辑'
  },
  {
    label: '角色权限',
    prompt: '角色管理页面，查询角色名称、状态，表格显示角色名称、描述、状态、创建时间，支持新增编辑删除'
  },
  {
    label: '员工花名册',
    prompt: '员工管理，查询姓名、部门、职位，表格显示姓名、性别、年龄、部门、职位、手机号、状态，支持新增编辑'
  },
  {
    label: '文章管理',
    prompt: '文章管理，查询标题、分类、状态，表格显示标题、分类、创建人、创建时间、状态，支持新增编辑删除'
  },
  {
    label: '系统配置',
    prompt: '系统配置管理，查询名称、类型，表格显示名称、编号、类型、描述、状态，支持新增编辑删除导出'
  },
]
