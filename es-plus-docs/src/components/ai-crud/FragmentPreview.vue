<template>
  <div class="fragment-preview" :data-testid="`fragment-preview-${kind}`">
    <!-- 表格片段：给 `<es-table>` 一个 mock httpRequest，走真实的取数→映射→分页链路，
         而不是往 data-source 里塞一份预览专用数组（那会绕开产物里的接法）。 -->
    <template v-if="kind === 'table'">
      <es-table :columns="tableColumns" :options="tableOptions" />
    </template>

    <!-- 表单片段：表单字段、按钮区都由 buildFormItem / config.buttons 决定；
         formLayout 与产物同一条通道（es-form 的 layoutFormProps.formLayProps）。 -->
    <template v-else-if="kind === 'form'">
      <es-form
        :model="formModel"
        :form-item-list="formItems"
        :config-btn="formBtns"
        :layout-form-props="formLayoutProps"
      />
    </template>

    <!-- 弹窗片段：宿主用 `open(title, row)` 打开；预览里给一个触发按钮即可验证长相 -->
    <template v-else>
      <el-button type="primary" @click="dialogVisible = true">
        {{ dialogTitle }}
      </el-button>
      <es-dialog
        v-model:visible="dialogVisible"
        :title="dialogTitle"
        :width="dialogWidth"
        v-bind="dialogProps"
      >
        <es-form :model="dialogModel" :form-item-list="dialogFormItems" />
      </es-dialog>
    </template>

    <p class="fragment-note">{{ note }}</p>
  </div>
</template>

<script setup lang="ts">
/**
 * 单场景片段预览（`generate_table` / `generate_form` / `generate_dialog` 的产物）。
 *
 * 存在的理由：AI CRUD 页此前只有一种预览 —— 把一切塞进 `<es-crud-page>`。
 * 当用户要的**只是一张表格 / 一个表单 / 一个弹窗**时，整页预览给出的东西
 * （查询条件 + 工具栏 + 分页 + 弹窗）和诉求不符，用户会以为生成错了。
 *
 * 这里刻意**不**另写字段映射：`buildFormItem` / `buildTableColumn` 就是生成
 * SFC 与 pageSchema 时用的同一对函数，所以预览与代码里的字段长相一致。
 */
import { computed, reactive, ref } from 'vue'
import {
  buildFormItem,
  buildTableColumn,
  getDefaultValue,
} from '@es-plus/shared'

interface FragmentConfig {
  fields?: Record<string, any>[]
  apiUrl?: string
  tableOptions?: Record<string, any>
  pagination?: { pageSize?: number; pageSizes?: number[] }
  rowButtons?: { name: string; type?: string; key?: string }[]
  buttons?: 'none' | 'query' | 'submit'
  context?: 'query' | 'form'
  formLayout?: Record<string, unknown>
  defaultTitle?: string
  mode?: 'composable' | 'component'
  options?: Record<string, any>
  rowkey?: string
}

const props = defineProps<{
  kind: 'table' | 'form' | 'dialog'
  config: FragmentConfig
}>()

const fields = computed(() => props.config.fields ?? [])

// ── 示例数据 ──────────────────────────────────────────────────────────────
//
// 字段值按 formtype 生成：枚举字段取 dataOptions 的第一个值（否则表格里会显示
// 数字 0/1，看起来像没接码表）。预览不接真接口 —— 用户在这里验证的是「长相」，
// 取数由宿主接线（生成代码里已经写明）。
function sampleValue(field: Record<string, any>, i: number): unknown {
  const options = field.dataOptions
  if (Array.isArray(options) && options.length > 0) {
    return options[i % options.length].value
  }
  switch (field.formtype) {
    case 'Switch':
      return i % 2 === 0
    case 'InputNumber':
    case 'Slider':
      return (i + 1) * 10
    case 'Rate':
      return (i % 5) + 1
    case 'DatePicker':
      return `2026-11-0${i + 1}`
    case 'TimePicker':
      return `0${i + 8}:00:00`
    case 'Checkbox':
    case 'Transfer':
    case 'Cascader':
      return []
    case 'Upload':
      return ''
    case 'ColorPicker':
      return '#409eff'
    default:
      return `${field.label}${i + 1}`
  }
}

const ROW_COUNT = 5

const rows = computed(() =>
  Array.from({ length: ROW_COUNT }, (_, i) => {
    const row: Record<string, unknown> = {}
    for (const field of fields.value) row[field.prop] = sampleValue(field, i)
    row.id = i + 1
    return row
  }),
)

// ── 表格 ──────────────────────────────────────────────────────────────────
const rowkey = computed(() => (props.config.tableOptions?.rowkey as string) ?? 'id')

const tableColumns = computed(() => {
  const cols = fields.value.map((f) => buildTableColumn(f as never))
  const buttons = props.config.rowButtons
  if (buttons && buttons.length > 0) {
    cols.push({
      prop: 'operate',
      label: '操作',
      width: 120,
      fixed: 'right',
      btns: buttons.map((b) => ({ ...b, triggerEvent: true })),
    })
  }
  return cols
})

const tableOptions = computed(() => ({
  border: true,
  stripe: true,
  rowkey: rowkey.value,
  ...(props.config.tableOptions ?? {}),
  // 预览专用取数：调用方在真实页面里换成自己的 httpRequest / apiParams。
  // 响应形状必须匹配 es-table 的默认映射（listData→rows、total→records）。
  httpRequest: () => Promise.resolve({ rows: rows.value, records: rows.value.length }),
}))

// ── 表单 / 弹窗 ───────────────────────────────────────────────────────────
function seedModel(list: Record<string, any>[]): Record<string, unknown> {
  const model: Record<string, unknown> = {}
  for (const f of list) {
    // getDefaultValue 返回的是**源码字面量**（"''" / 'false' / 'null' / '0' / '[]'），
    // 预览要的是值本身；这里按字面量逐项映射，不 eval。
    const raw = getDefaultValue(f as never)
    model[f.prop] =
      raw === 'false' ? false
      : raw === 'null' ? null
      : raw === '0' ? 0
      : raw === '[]' ? []
      : ''
  }
  return model
}

const formContext = computed(() => (props.config.context === 'query' ? 'query' : 'form'))
const formItems = computed(() =>
  fields.value.map((f) => buildFormItem(f as never, formContext.value)),
)
const formModel = reactive<Record<string, unknown>>(seedModel(fields.value))

const BTN_SETS: Record<string, Record<string, unknown>[]> = {
  query: [
    { name: '查询', type: 'primary', key: 'query', triggerEvent: true },
    { name: '重置', key: 'rest', triggerEvent: true },
  ],
  submit: [
    { name: '保存', type: 'primary', key: 'submit', triggerEvent: true },
    { name: '重置', key: 'rest', triggerEvent: true },
  ],
  none: [],
}
const formBtns = computed(() => BTN_SETS[props.config.buttons ?? 'none'] ?? [])

/**
 * 表单布局 → `layoutFormProps.formLayProps`（es-form 的真实 prop，与产物同一形状）。
 * 不过这条通道，`formLayout.labelWidth` 在预览里就被静默丢掉 —— 而产物里有。
 */
const formLayoutProps = computed(() => {
  const layout = (props.config.formLayout ?? {}) as { labelWidth?: string | number; minFoldRows?: number }
  const formLayProps: Record<string, unknown> = {}
  if (layout.labelWidth !== undefined) {
    formLayProps.labelWidth =
      typeof layout.labelWidth === 'number' ? `${layout.labelWidth}px` : layout.labelWidth
  }
  if (layout.minFoldRows !== undefined) formLayProps.minFoldRows = layout.minFoldRows
  return Object.keys(formLayProps).length > 0 ? { formLayProps } : undefined
})

const dialogVisible = ref(false)
const dialogTitle = computed(() => props.config.defaultTitle ?? '编辑')
const dialogWidth = computed(() => String(props.config.options?.width ?? '560px'))
/** 弹窗底座选项里「看得见」的那几个，原样透传给 es-dialog（不改写成另一套名字）。 */
const DIALOG_PREVIEW_PROPS = [
  'maxHeight',
  'isDraggable',
  'fullscreen',
  'isHiddenFooter',
  'showClose',
  'destroyOnClose',
  'modal',
  'closeOnClickModal',
  'closeOnPressEscape',
] as const
const dialogProps = computed(() => {
  const options = props.config.options ?? {}
  const out: Record<string, unknown> = {}
  for (const key of DIALOG_PREVIEW_PROPS) {
    if (options[key] !== undefined) out[key] = options[key]
  }
  return out
})
const dialogFormItems = computed(() =>
  fields.value.map((f) => buildFormItem(f as never, 'form')),
)
const dialogModel = reactive<Record<string, unknown>>(seedModel(fields.value))

const note = computed(() => {
  if (props.kind === 'table') {
    return '表格片段预览：示例数据经 httpRequest 注入；真实页面请把 apiUrl / apiParams 换成你的接口。'
  }
  if (props.kind === 'form') {
    return '表单片段预览：查询 / 保存由宿主接管（片段只发 triggerEvent），生成代码里已留接线位。'
  }
  return `弹窗片段预览：宿主用 ref.open(title, row) 打开；当前形态为 ${props.config.mode ?? 'composable'}。`
})
</script>

<style scoped>
.fragment-preview {
  padding: 16px;
}
.fragment-note {
  margin: 12px 0 0;
  font-size: 12px;
  color: var(--el-text-color-secondary, #909399);
}
</style>
