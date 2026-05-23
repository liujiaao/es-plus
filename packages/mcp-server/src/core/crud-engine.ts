export interface GeneratedConfig {
  formItems: any[]
  columns: any[]
  queryBtns: any[]
  tableOptions: any
  actions: string[]
  dialogFormItems?: any[]
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
  { keywords: ['状态', 'status', '类型', 'type', '分类', 'category', '性别', 'gender', '级别', 'level', '来源', 'source'], type: 'Select' },
  { keywords: ['日期', 'date', '时间', 'time', '创建时间', 'createTime', '更新时间', 'updateTime', '开始', '结束'], type: 'datePicker', attrs: { type: 'daterange', valueFormat: 'YYYY-MM-DD' } },
  { keywords: ['开关', 'switch', '是否', '启用', 'enable', 'disabled'], type: 'Switch' },
  { keywords: ['评分', 'rate', '星级', 'score'], type: 'Rate' },
  { keywords: ['颜色', 'color'], type: 'ColorPicker' },
  { keywords: ['图片', 'image', '头像', 'avatar', '文件', 'file', '附件', 'attachment'], type: 'Upload' },
  { keywords: ['备注', 'remark', '描述', 'description', '内容', 'content', '简介', 'intro'], type: 'Input', attrs: { type: 'textarea', rows: 3 } },
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
  const pinyin = fieldName.replace(/[一-鿿]/g, '')
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
    .replace(/^.*?[：:]/, '')
    .replace(/[，,]?\s*支持.*$/, '')
    .replace(/[，,]?\s*操作.*$/, '')
  return splitFields(cleaned)
}

function parseActions(input: string): string[] {
  const actions: string[] = []
  if (/新增|添加|创建|add|create/.test(input)) actions.push('add')
  if (/编辑|修改|更新|edit|update/.test(input)) actions.push('edit')
  if (/删除|移除|remove|delete/.test(input)) actions.push('delete')
  if (/查看|详情|detail|view/.test(input)) actions.push('view')
  if (/导出|export/.test(input)) actions.push('export')
  if (/导入|import/.test(input)) actions.push('import')
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
      }
      const typeInfo = inferType(f.name)
      if (typeInfo.attrs) item.attrs = typeInfo.attrs
      const options = getDataOptions(f.name)
      if (options) item.dataOptions = options
      if (f.type === 'datePicker') item.span = 8
      return item
    })

  const queryBtns: any[] = [
    { name: '查询', type: 'primary', key: 'query', triggerEvent: true },
    { name: '重置', key: 'reset', triggerEvent: true },
  ]

  if (actions.includes('add')) {
    queryBtns.push({ name: '新增', type: 'primary', key: 'add', icon: 'Plus' })
  }
  if (actions.includes('export')) {
    queryBtns.push({ name: '导出', key: 'export', icon: 'Download' })
  }

  const columns = fields
    .filter(f => f.isTable)
    .map(f => {
      const col: any = { prop: f.prop, label: f.name }
      if (f.name.includes('状态') || f.name.includes('status')) {
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
      prop: 'action',
      label: '操作',
      width: actionBtns.length * 70 + 20,
      btns: actionBtns
    })
  }

  const tableOptions: any = {
    border: true,
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
      }
      const options = getDataOptions(f.name)
      if (options) item.dataOptions = options
      const typeInfo = inferType(f.name)
      if (typeInfo.attrs) item.attrs = typeInfo.attrs
      return item
    })

  return { formItems, columns, queryBtns, tableOptions, actions, dialogFormItems }
}

export function generateCode(config: GeneratedConfig): string {
  const lines: string[] = []

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
  lines.push(`import { reactive, ref } from 'vue'`)
  if (config.actions.includes('add') || config.actions.includes('edit')) {
    lines.push(`import { useDialog } from 'es-plus-ui'`)
  }
  lines.push(``)

  const modelFields = config.formItems.map(f => `${f.prop}: ''`).join(', ')
  lines.push(`const queryForm = reactive({ ${modelFields} })`)
  lines.push(`const tableData = ref([])`)
  lines.push(`const tableRef = ref(null)`)
  lines.push(`const pagination = ref({ current: 1, pageSize: 10, total: 0 })`)

  if (config.actions.includes('add') || config.actions.includes('edit')) {
    lines.push(`const dialog = useDialog()`)
  }
  lines.push(``)

  lines.push(`const formItems = ${JSON.stringify(config.formItems, null, 2)}`)
  lines.push(``)

  lines.push(`const queryBtns = ${JSON.stringify(config.queryBtns, null, 2)}`)
  lines.push(``)

  const colStr = JSON.stringify(config.columns, null, 2)
    .replace(/"render": "(.*?)"/g, (_, code) => `render: ${code.replace(/\\"/g, '"')}`)
  lines.push(`const columns = ${colStr}`)
  lines.push(``)

  lines.push(`const options = {`)
  lines.push(`  border: true,`)
  lines.push(`  httpRequest: async (params) => {`)
  lines.push(`    // Replace with your API call`)
  lines.push(`    // const res = await axios.get('/api/list', { params: params.formParams })`)
  lines.push(`    // return res.data`)
  lines.push(`  },`)
  lines.push(`  configTableOut: { total: 'total', tableData: 'data', pageSize: 'pageSize', current: 'pageIndex' },`)
  lines.push(`  rowkey: 'id'`)
  lines.push(`}`)

  if (config.actions.includes('add') || config.actions.includes('edit')) {
    lines.push(``)
    lines.push(`function openForm(title, row = {}) {`)
    const dialogModelFields = (config.dialogFormItems || []).map(f => `${f.prop}: ''`).join(', ')
    lines.push(`  const formData = reactive({ ${dialogModelFields}, ...row })`)
    lines.push(`  dialog({`)
    lines.push(`    title,`)
    lines.push(`    width: '500px',`)
    lines.push(`    render: (h, { registerRef }) => (`)
    lines.push(`      <EsForm`)
    lines.push(`        ref={el => el && registerRef('form', el)}`)
    lines.push(`        model={formData}`)
    lines.push(`        formItemList={${JSON.stringify(config.dialogFormItems, null, 8)}}`)
    lines.push(`      />`)
    lines.push(`    ),`)
    lines.push(`    configBtn: [`)
    lines.push(`      { name: '取消', click: (_, { close }) => close() },`)
    lines.push(`      { name: '确定', type: 'primary', click: async (_, { close, getRefs }) => {`)
    lines.push(`        await getRefs('form')?.validate()`)
    lines.push(`        // await api.save(formData)`)
    lines.push(`        close()`)
    lines.push(`        tableRef.value?.httpRequestInstance()`)
    lines.push(`      }}`)
    lines.push(`    ]`)
    lines.push(`  })`)
    lines.push(`}`)
  }

  lines.push(`</script>`)

  return lines.join('\n')
}
