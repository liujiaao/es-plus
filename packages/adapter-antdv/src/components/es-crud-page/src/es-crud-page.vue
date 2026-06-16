<!--
  ADV 适配器：EsCrudPage CRUD 编排组件

  完整对齐 es-plus-docs 案例的功能：
  - Multi-dialog (add/edit/detail/import...) via dialogs config
  - OperationColumn with per-button hidden/permissionValue/confirm
  - Toolbar buttons with dialogKey/actionType/confirm
  - Programmatic open: ref.openDialog(key, row?)
  - Row-level confirm dialog via Modal.confirm
-->
<template>
  <div class="es-crud-page">
    <!-- 查询表单 -->
    <es-form
      v-if="schema.formItemList?.length"
      ref="queryFormRef"
      :model="queryModel"
      :formItemList="schema.formItemList"
      :configBtn="effectiveQueryBtns"
      :layoutFormProps="schema.layoutFormProps"
      @confirm="handleQuery"
      @reset="handleReset"
    >
      <template v-for="(_slot, name) in $slots" :key="name" #[name]="scope">
        <slot :name="name" v-bind="scope" />
      </template>
    </es-form>

    <!-- 数据表格 -->
    <es-table
      ref="tableRef"
      :columns="computedColumns"
      :dataSource="tableData"
      :options="computedTableOptions"
      :pagination="paginationConfig"
      :showHeaderBar="true"
      @update:dataSource="tableData = $event"
      @update:pagination="onPaginationUpdate"
      @pagination-current-change="handlePageChange"
      @change-table-sort="handleSortChange"
    >
      <template v-for="(_slot, name) in $slots" :key="name" #[name]="scope">
        <slot :name="name" v-bind="scope" />
      </template>
    </es-table>
  </div>
</template>

<script lang="ts">
export default { name: 'EsCrudPage' }
</script>

<script setup lang="ts">
import { ref, reactive, computed, watch, h } from 'vue'
import type { VNode } from 'vue'
import { Modal } from 'ant-design-vue'
import EsForm from '../../es-form/src/es-form.vue'
import EsTable from '../../es-table/src/component.vue'
import { useDialog } from '../../es-dialog/src/use-dialog'
import type { BtnConfig, TableColumn, TableOptions, PaginationConfig, FormItemOption, LayoutFormProps, DialogOptions } from '../../../types'

// ─── Schema 类型定义 ────────────────────────────────
export interface CrudPageSchema {
  formItemList?: FormItemOption[]
  columns?: TableColumn[]
  tableOptions?: TableOptions
  pagination?: PaginationConfig
  layoutFormProps?: LayoutFormProps
  toolbarBtns?: BtnConfig[]
  operationColumn?: {
    label?: string; width?: number; fixed?: string
    btns?: BtnConfig[]
  } | false
  dialogs?: Record<string, DialogOptions>
  // Legacy
  actions?: string[]
  dialogFormItems?: FormItemOption[]
}

// ─── Props ───────────────────────────────────────────
const props = withDefaults(
  defineProps<{ schema: CrudPageSchema }>(),
  { schema: () => ({}) },
)

// EsCrudPage 事件（对齐 vue3）
const emit = defineEmits<{
  'query': [model: Record<string, unknown>]
  'add': []
  'edit': [row: Record<string, unknown>]
  'delete': [row: Record<string, unknown>]
  'view': [row: Record<string, unknown>]
  'export': [model: Record<string, unknown>]
  'row-click': [row: Record<string, unknown>]
  'btn-click': [key: string, payload?: Record<string, unknown>]
  'page-change': [pagination: PaginationConfig]
  'sort-change': [column: Record<string, unknown>]
  'add-confirm': [model: Record<string, unknown>]
  'edit-confirm': [model: Record<string, unknown>]
  'dialog-confirm': [key: string, model: Record<string, unknown>]
}>()

// ─── 状态 ───────────────────────────────────────────
const queryModel = reactive<Record<string, unknown>>({})
const tableData = ref<Record<string, unknown>[]>([])
const paginationConfig = ref<PaginationConfig>({ pageSize: 10, current: 1, total: 0 })
const queryFormRef = ref<any>(null)
const tableRef = ref<any>(null)

// ─── 工具栏按钮 (合并 toolbarBtns + actions) ──────
const effectiveQueryBtns = computed(() => props.schema.toolbarBtns || [])

// ─── 操作列构建 ────────────────────────────────────
function buildOperationBtns(): BtnConfig[] {
  const btns: BtnConfig[] = []

  // 1. schema.operationColumn.btns 优先
  if (props.schema.operationColumn && props.schema.operationColumn !== false) {
    return (props.schema.operationColumn.btns || []).map(b => ({ ...b }))
  }

  // 2. legacy actions fallback
  const actions = props.schema.actions || []
  if (actions.includes('add')) btns.push({ name: '新增', key: 'add', type: 'primary' as any })
  if (actions.includes('edit')) btns.push({ name: '编辑', key: 'edit' })
  if (actions.includes('view')) btns.push({ name: '查看', key: 'view' })
  if (actions.includes('delete')) btns.push({ name: '删除', key: 'delete', type: 'danger' as any })

  return btns
}

// ─── 计算列 (含操作列) ─────────────────────────────
const computedColumns = computed<TableColumn[]>(() => {
  const cols = [...(props.schema.columns || [])]

  // 构建操作列
  const opBtns = buildOperationBtns()
  if (opBtns.length && (props.schema.operationColumn as any) !== false) {
    const opColConfig = (props.schema.operationColumn as any) || {}
    cols.push({
      prop: 'operate', key: 'operate',
      label: opColConfig.label || '操作',
      width: opColConfig.width || (opBtns.length * 70 + 20),
      fixed: opColConfig.fixed || 'right',
      btns: opBtns.map(b => ({
        ...b,
        clickEvent: (row: Record<string, unknown>) => handleRowBtn(b, row),
      })),
    })
  }

  return cols
})

// ─── 计算 tableOptions (合并 schema) ───────────────
const computedTableOptions = computed<TableOptions>(() => ({
  border: true,
  rowkey: 'id',
  ...(props.schema.tableOptions || {}),
}))

// ─── 行按钮处理 ────────────────────────────────────
function handleRowBtn(btn: BtnConfig, row: Record<string, unknown>) {
  // confirm 二次确认
  if (btn.confirm) {
    const msg = typeof btn.confirm === 'string' ? btn.confirm : '确定执行此操作？'
    Modal.confirm({
      title: '提示',
      content: msg,
      okText: '确定',
      cancelText: '取消',
      okType: btn.type === 'danger' ? 'danger' : 'primary',
      onOk: () => executeRowAction(btn, row),
    } as any)
  } else {
    executeRowAction(btn, row)
  }
}

function executeRowAction(btn: BtnConfig, row: Record<string, unknown>) {
  const key = btn.key || btn.dialogKey

  // delete 操作
  if (key === 'delete') {
    emit('delete', row)
    return
  }

  // 弹窗操作
  if (btn.dialogKey || key === 'add' || key === 'edit' || key === 'view') {
    openDialog(btn.dialogKey || key!, key === 'edit' || key === 'view' ? row : undefined)
    return
  }

  // 自定义 click 回调
  btn.click?.({ ...row }, tableRef.value)
}

// ─── 多弹窗管理 ─────────────────────────────────────
const activeDialogs = new Map<string, { close: () => void }>()

function openDialog(key: string, row?: Record<string, unknown>) {
  const dialogCfg = props.schema.dialogs?.[key]

  // 如果配置了 dialogs[key]，使用该配置
  if (dialogCfg) {
    const formModel = reactive<Record<string, unknown>>(row ? { ...row } : {})
    const title = typeof dialogCfg.title === 'function'
      ? (dialogCfg.title as Function)(row)
      : (dialogCfg.title || key)

    const { open } = useDialog({
      title,
      width: dialogCfg.width || '600px',
      ...dialogCfg,
      render: dialogCfg.render || ((hFn: typeof h, _inst: unknown, _comps: Record<string, unknown>): VNode => {
        return hFn(EsForm as any, {
          model: formModel,
          formItemList: dialogCfg.formItems || props.schema.dialogFormItems || [],
          layoutFormProps: { formLayProps: { isBtnHidden: true, labelWidth: dialogCfg.formLayout?.labelWidth || '80px' } },
        })
      }),
      configBtn: dialogCfg.configBtn || [
        { name: '取消', key: 'cancel', click: (_m: any, _f: any, close?: () => void) => close?.() },
        {
          name: '确定', key: 'confirm', type: 'primary' as any,
          click: (_m: any, _f: any, close?: () => void) => {
            emit('dialog-confirm', key, { ...formModel })
            emit(key === 'add' ? 'add-confirm' : 'edit-confirm' as any, { ...formModel })
            close?.()
          },
        },
      ],
    } as DialogOptions)

    const instance = open()
    if (instance?.close) activeDialogs.set(key, instance)
    return
  }

  // Legacy: 没有 dialogs 配置，使用 dialogFormItems
  if (['add', 'edit'].includes(key) && props.schema.dialogFormItems?.length) {
    const formModel = reactive<Record<string, unknown>>(row ? { ...row } : {})

    const { open } = useDialog({
      title: key === 'add' ? '新增' : '编辑',
      width: '600px',
      render: (hFn: typeof h, _inst: unknown, _comps: Record<string, unknown>): VNode => {
        return hFn(EsForm as any, {
          model: formModel,
          formItemList: props.schema.dialogFormItems || [],
          layoutFormProps: { formLayProps: { isBtnHidden: true } },
        })
      },
      configBtn: [
        { name: '取消', key: 'cancel', click: (_m: any, _f: any, close?: () => void) => close?.() },
        {
          name: '确定', key: 'confirm', type: 'primary' as any,
          click: (_m: any, _f: any, close?: () => void) => {
            emit(key === 'add' ? 'add-confirm' : 'edit-confirm' as any, { ...formModel })
            close?.()
          },
        },
      ],
    } as DialogOptions)

    const instance = open()
    if (instance?.close) activeDialogs.set(key, instance)
  }
}

function closeDialog(key: string) {
  activeDialogs.get(key)?.close?.()
  activeDialogs.delete(key)
}

// ─── 工具栏按钮处理 ────────────────────────────────
function handleBtnClick(btn: BtnConfig) {
  // dialogKey → open dialog
  if (btn.dialogKey) {
    openDialog(btn.dialogKey)
    return
  }
  // confirm → 二次确认
  if (btn.confirm) {
    const msg = typeof btn.confirm === 'string' ? btn.confirm : '确定？'
    Modal.confirm({
      title: '提示', content: msg,
      okType: btn.type === 'danger' ? 'danger' : 'primary',
      onOk: () => emit('btn-click', btn.key || btn.dialogKey || '', queryModel),
    } as any)
    return
  }
  emit('btn-click', btn.key || btn.dialogKey || '', queryModel)
}

// ─── 查询/重置(对齐 vue3 form @confirm/@reset 签名) ──
function handleQuery(_formRef: unknown, model: Record<string, unknown>) {
  tableRef.value?.httpRequestInstance?.(model)
  emit('query', model)
}

function handleReset(_formRef: unknown, _model: Record<string, unknown>) {
  tableRef.value?.httpRequestInstance?.({})
}

function onPaginationUpdate(p: PaginationConfig) { paginationConfig.value = { ...p } }

function handlePageChange(p: PaginationConfig) { emit('page-change', p) }

function handleSortChange(col: Record<string, unknown>) { emit('sort-change', col) }

// ─── Expose ─────────────────────────────────────────
defineExpose({
  queryFormRef, tableRef, queryModel,
  openDialog, closeDialog,
})
</script>

<style scoped>
.es-crud-page {
  width: 100%;
  display: flex;
  flex-direction: column;
  gap: 16px;
}
</style>
