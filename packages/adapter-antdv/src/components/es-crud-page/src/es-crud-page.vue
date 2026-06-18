<!--
  ADV 适配器：EsCrudPage CRUD 编排组件（对齐 @es-plus/vue3）

  - 同时兼容 vue3 新命名（formItems/formLayout/tableBtns）与旧命名（formItemList/layoutFormProps）
  - 支持 httpRequest / autoLoad props
  - 弹窗确认前校验内部 EsForm
  - 支持 onOpen / onClose / onConfirm 与 dialog-open / dialog-cancel emits
-->
<template>
  <div class="es-crud-page">
    <es-table
      ref="tableRef"
      :columns="mergedColumns"
      :options="mergedOptions"
      :dataSource="tableData"
      :pagination="paginationState"
      :showHeaderBar="true"
      v-bind="$attrs"
      @update:dataSource="tableData = $event"
      @update:pagination="onPaginationUpdate"
      @pagination-current-change="handlePageChange"
      @size-change="handleSizeChange"
      @change-table-sort="handleSortChange"
    >
      <es-form
        v-if="effectiveFormItems && effectiveFormItems.length"
        ref="formRef"
        :model="queryModel"
        :formItemList="effectiveFormItems"
        :configBtn="mergedFormBtns"
        :layoutFormProps="effectiveFormLayout"
        @confirm="handleQuery"
        @reset="handleReset"
      />
      <template v-for="(_, name) in $slots" #[name]="slotData">
        <slot :name="name" v-bind="slotData || {}" />
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
import type {
  CrudPageSchema,
  CrudAction,
  CrudBtnConfig,
  TableBtnConfig,
  OperationColumnConfig,
  RowBtnConfig,
  CrudDialogConfig,
  DialogActionContext,
  LayoutFormProps,
} from './types'
import type { BtnConfig, TableColumn, TableOptions, PaginationConfig, FormItemOption } from '../../../types'

const props = withDefaults(
  defineProps<{
    schema: CrudPageSchema
    httpRequest?: (params: Record<string, unknown>) => Promise<unknown>
    autoLoad?: boolean
  }>(),
  { autoLoad: true }
)

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
  'size-change': [pagination: PaginationConfig, size: number]
  'sort-change': [column: Record<string, unknown>]
  'add-confirm': [model: Record<string, unknown>]
  'edit-confirm': [model: Record<string, unknown>]
  'dialog-confirm': [dialogKey: string, data: Record<string, unknown>]
  'dialog-cancel': [dialogKey: string]
  'dialog-open': [dialogKey: string, row?: Record<string, unknown>]
}>()

const tableRef = ref<any>(null)
const formRef = ref<any>(null)
const tableData = ref<Record<string, unknown>[]>([])

const queryModel = reactive<Record<string, unknown>>({})

// ─── Schema 字段兼容 ───
const effectiveFormItems = computed<FormItemOption[]>(() =>
  props.schema.formItems || props.schema.formItemList || []
)

const effectiveFormLayout = computed<LayoutFormProps>(() => {
  if (props.schema.formLayout) {
    return {
      formLayProps: {
        labelWidth: props.schema.formLayout.labelWidth,
        ...(props.schema.formLayout.minFoldRows ? { minFoldRows: props.schema.formLayout.minFoldRows } : {}),
      },
      ...(props.schema.formLayout.span ? { rowLayProps: { gutter: 16 } } : {}),
    }
  }
  return props.schema.layoutFormProps || {}
})

watch(
  effectiveFormItems,
  (items) => {
    if (items) {
      items.forEach((item) => {
        if (item.prop && !(item.prop in queryModel)) {
          queryModel[item.prop] = ''
        }
      })
    }
  },
  { immediate: true }
)

const paginationState = ref<PaginationConfig>({
  current: 1,
  pageSize: 10,
  total: 0,
  ...(props.schema.pagination || {}),
})

watch(
  () => props.schema.pagination,
  (p) => { paginationState.value = { ...paginationState.value, ...(p || {}) } },
  { deep: true }
)

// ─── 向后兼容：归一化配置 ───

const normalizedDialogs = computed<Record<string, CrudDialogConfig>>(() => {
  if (props.schema.dialogs) return props.schema.dialogs

  if (!props.schema.dialogFormItems?.length) return {}

  const dialogBase = {
    width: props.schema.dialogOptions?.width || '600px',
    formItems: props.schema.dialogFormItems,
    ...(props.schema.dialogOptions || {}),
  } as CrudDialogConfig

  const result: Record<string, CrudDialogConfig> = {}
  const actions = props.schema.actions || ['add', 'edit', 'delete']

  if (actions.includes('add')) {
    result.add = { ...dialogBase, title: '新增' }
  }
  if (actions.includes('edit')) {
    result.edit = { ...dialogBase, title: '编辑' }
  }
  if (actions.includes('view')) {
    result.view = { ...dialogBase, title: '查看', isHiddenFooter: true }
  }

  return result
})

const normalizedToolbarBtns = computed<CrudBtnConfig[]>(() => {
  if (props.schema.toolbarBtns) return props.schema.toolbarBtns

  if (props.schema.dialogs || props.schema.operationColumn !== undefined) return []

  const actions = props.schema.actions || ['add', 'edit', 'delete']
  const btns: CrudBtnConfig[] = []

  if (actions.includes('add')) {
    btns.push({ name: '新增', type: 'primary', key: 'add', icon: 'Plus', dialogKey: 'add' })
  }
  if (actions.includes('export')) {
    btns.push({ name: '导出', key: 'export', icon: 'Download', actionType: 'export' })
  }
  if (actions.includes('import')) {
    btns.push({ name: '导入', key: 'import', icon: 'Upload', actionType: 'import' })
  }

  return btns
})

const normalizedOperationColumn = computed<OperationColumnConfig | false | undefined>(() => {
  if (props.schema.operationColumn !== undefined) return props.schema.operationColumn

  const actions = props.schema.actions || ['add', 'edit', 'delete']
  const hasActionCol = props.schema.columns?.some((c) => c.prop === 'action' || c.prop === 'operate' || c.btns)
  if (hasActionCol) return undefined

  const rowActions = actions.filter((a) => ['edit', 'delete', 'view'].includes(a))
  if (rowActions.length === 0) return false

  const btns: RowBtnConfig[] = []
  if (actions.includes('view')) {
    btns.push({ name: '查看', type: 'primary', key: 'view', dialogKey: 'view' })
  }
  if (actions.includes('edit')) {
    btns.push({ name: '编辑', type: 'primary', key: 'edit', dialogKey: 'edit' })
  }
  if (actions.includes('delete')) {
    btns.push({ name: '删除', type: 'danger', key: 'delete', confirm: '确定删除该条数据吗？' })
  }

  return {
    label: '操作',
    width: btns.length * 80 + 20,
    fixed: 'right',
    btns,
  }
})

// ─── 表单按钮合并 ───

const mergedFormBtns = computed<BtnConfig[]>(() => {
  if (props.schema.queryBtns) return props.schema.queryBtns

  const baseBtns: BtnConfig[] = [
    { name: '查询', type: 'primary', key: 'query', triggerEvent: true },
    { name: '重置', key: 'rest', triggerEvent: true },
  ]

  const toolbarBtns = normalizedToolbarBtns.value.map((btn) => {
    const resolvedBtn: BtnConfig = { ...btn }
    if (!resolvedBtn.click) {
      resolvedBtn.click = () => handleToolbarBtnClick(btn)
    }
    return resolvedBtn
  })

  return [...baseBtns, ...toolbarBtns]
})

// ─── 表格列合并 ───

const mergedColumns = computed<TableColumn[]>(() => {
  const cols = [...(props.schema.columns || [])]
  const opCol = normalizedOperationColumn.value

  if (opCol === false || opCol === undefined) return cols

  const actionBtns = opCol.btns.map((btn) => ({
    name: btn.name,
    type: btn.type,
    icon: btn.icon,
    permissionValue: btn.permissionValue,
    hidden: btn.hidden,
    clickEvent: (row: Record<string, unknown>) => handleRowBtnClick(btn, row),
  }))

  cols.push({
    prop: 'operate',
    label: opCol.label || '操作',
    width: opCol.width || actionBtns.length * 80 + 20,
    fixed: opCol.fixed || 'right',
    btns: actionBtns,
  })

  return cols
})

// ─── 表格工具栏按钮 ───

const normalizedTableBtns = computed(() => {
  if (!props.schema.tableBtns?.length) return []
  return props.schema.tableBtns.map((btn: TableBtnConfig) => ({
    name: btn.name,
    type: btn.type,
    size: btn.size || 'small',
    icon: btn.icon,
    position: btn.position || (btn.code === 2 ? 'right' : 'left') as 'left' | 'right',
    code: btn.code,
    permissionValue: btn.permissionValue,
    loading: btn.loading,
    disabled: btn.disabled,
    click: () => handleToolbarBtnClick(btn),
  }))
})

// ─── 表格选项 ───

const mergedOptions = computed(() => {
  const base: Record<string, unknown> = {
    border: true,
    isInitRun: props.autoLoad,
    ...(props.schema.tableOptions || {}),
  }
  if (props.httpRequest) {
    base.httpRequest = props.httpRequest
  }
  const tBtns = normalizedTableBtns.value
  if (tBtns.length > 0) {
    const existing = (base.configBtn as any[]) || []
    base.configBtn = [...existing, ...tBtns]
  }
  return base as TableOptions
})

// ─── 工具栏按钮处理 ───

async function handleToolbarBtnClick(btn: CrudBtnConfig) {
  const key = btn.key || btn.actionType || ''

  if (btn.confirm) {
    const msg = typeof btn.confirm === 'string' ? btn.confirm : '确定执行此操作吗？'
    try {
      await new Promise((resolve, reject) => {
        Modal.confirm({
          title: '提示',
          content: msg,
          okText: '确定',
          cancelText: '取消',
          okType: btn.type === 'danger' ? 'danger' : 'primary',
          onOk: () => resolve(true),
          onCancel: () => reject(new Error('cancel')),
        } as any)
      })
    } catch {
      return
    }
  }

  if (btn.dialogKey) {
    if (key === 'add') emit('add')
    openDialog(btn.dialogKey)
    return
  }

  if (key === 'export' || btn.actionType === 'export') {
    emit('export', { ...queryModel })
  } else if (key === 'add') {
    emit('add')
  }

  emit('btn-click', key, { ...queryModel })
}

// ─── 行按钮处理 ───

async function handleRowBtnClick(btn: RowBtnConfig, row: Record<string, unknown>) {
  const key = btn.key || ''

  if (btn.confirm) {
    const msg = typeof btn.confirm === 'string' ? btn.confirm : '确定执行此操作吗？'
    try {
      await new Promise((resolve, reject) => {
        Modal.confirm({
          title: '提示',
          content: msg,
          okText: '确定',
          cancelText: '取消',
          okType: btn.type === 'danger' ? 'danger' : 'primary',
          onOk: () => resolve(true),
          onCancel: () => reject(new Error('cancel')),
        } as any)
      })
    } catch {
      return
    }
  }

  if (btn.click) {
    btn.click(row, {
      refresh,
      getSelectedRows,
      openDialog,
    })
    return
  }

  if (btn.dialogKey) {
    openDialog(btn.dialogKey, row)
    return
  }

  if (key === 'edit') emit('edit', row)
  else if (key === 'delete') emit('delete', row)
  else if (key === 'view') emit('view', row)

  emit('btn-click', key, row)
}

// ─── 弹窗管理 ───

const dialogInstances = new Map<string, any>()
const dialogRefs = new Map<string, Record<string, any>>()

function openDialog(key: string, row?: Record<string, unknown>) {
  const dialogConfig = normalizedDialogs.value[key]
  if (!dialogConfig) return

  emit('dialog-open', key, row)
  dialogConfig.onOpen?.(row)

  const dialog = useDialog()
  dialogInstances.set(key, dialog)

  const formData = reactive<Record<string, unknown>>({})
  if (dialogConfig.formItems) {
    dialogConfig.formItems.forEach((item) => {
      if (item.prop) {
        formData[item.prop] = row?.[item.prop] ?? ''
      }
    })
  }

  const title = typeof dialogConfig.title === 'function'
    ? dialogConfig.title(row)
    : dialogConfig.title || ''

  const refsMap: Record<string, any> = {}
  dialogRefs.set(key, refsMap)

  const registerRef = (name: string, el: any) => {
    if (el) refsMap[name] = el
  }

  const configBtn = resolveDialogBtns(key, dialogConfig, formData, row || {})

  dialog({
    title,
    width: dialogConfig.width || '600px',
    isDraggable: dialogConfig.isDraggable,
    maxHeight: dialogConfig.maxHeight,
    fullscreen: dialogConfig.fullscreen,
    isHiddenFooter: dialogConfig.isHiddenFooter,
    render: (dialogConfig.render
      ? (hFn: typeof h, inst: any) => {
          return dialogConfig.render!(hFn, {
            row: row || {},
            model: formData,
            registerRef,
            close: () => closeDialog(key),
            refresh,
          } as any)
        }
      : dialogConfig.formItems
        ? (hFn: typeof h) => {
            return hFn(EsForm, {
              ref: (el: any) => el && registerRef('dialogForm', el),
              model: formData,
              formItemList: dialogConfig.formItems as FormItemOption[],
              layoutFormProps: {
                rowLayProps: { gutter: 16 },
                formLayProps: {
                  isBtnHidden: true,
                  ...(dialogConfig.formLayout || {}),
                },
              },
            })
          }
        : undefined) as any,
    configBtn,
    onClosed: () => {
      dialogInstances.delete(key)
      dialogRefs.delete(key)
      dialogConfig.onClose?.()
    },
  })
}

function closeDialog(key: string) {
  const dialog = dialogInstances.get(key)
  if (dialog) {
    dialog.close()
    dialogInstances.delete(key)
    dialogRefs.delete(key)
  }
}

function resolveDialogBtns(
  key: string,
  config: CrudDialogConfig,
  formData: Record<string, unknown>,
  row: Record<string, unknown>,
): any[] | undefined {
  if (config.isHiddenFooter) return undefined

  if (config.configBtn) {
    return config.configBtn.map((btn) => {
      if ((btn as any).action === 'cancel') {
        return {
          ...btn,
          click: (_: any, { close }: any) => {
            emit('dialog-cancel', key)
            close()
          },
        }
      }
      if ((btn as any).action === 'confirm') {
        return {
          ...btn,
          click: async (_: any, { close, getRefs }: any) => {
            await validateAndConfirm(key, config, formData, row, close, getRefs)
          },
        }
      }
      return btn
    })
  }

  return [
    {
      name: '取消',
      click: (_: any, { close }: any) => {
        emit('dialog-cancel', key)
        close()
      },
    },
    {
      name: '确定',
      type: 'primary',
      click: async (_: any, { close, getRefs }: any) => {
        await validateAndConfirm(key, config, formData, row, close, getRefs)
      },
    },
  ]
}

async function validateAndConfirm(
  key: string,
  config: CrudDialogConfig,
  formData: Record<string, unknown>,
  row: Record<string, unknown>,
  close: () => void,
  getRefs: (name?: string) => any,
) {
  if (config.formItems?.length) {
    const dialogForm = getRefs('dialogForm')
    if (dialogForm?.validate) {
      const valid = await dialogForm.validate()
      if (!valid) return
    }
  }

  const context: DialogActionContext = { close, refresh, getRefs, row }

  if (config.onConfirm) {
    await config.onConfirm(formData, context)
  } else {
    const legacyKey = key === 'add' ? 'add-confirm' : key === 'edit' ? 'edit-confirm' : `${key}-confirm`
    emit('btn-click', legacyKey, formData)
    close()
    refresh()
  }

  emit('dialog-confirm', key, formData)
}

// ─── 查询/重置 ───

function handleQuery(_formRef: unknown, model: Record<string, unknown>) {
  tableRef.value?.httpRequestInstance?.(model)
  emit('query', model)
}

function handleReset(_formRef: unknown, _model: Record<string, unknown>) {
  tableRef.value?.httpRequestInstance?.({})
}

function onPaginationUpdate(p: PaginationConfig) { paginationState.value = { ...p } }
function handlePageChange(p: PaginationConfig) { emit('page-change', p) }
function handleSizeChange(p: PaginationConfig, size: number) { emit('size-change', p, size) }
function handleSortChange(col: Record<string, unknown>) { emit('sort-change', col) }

// ─── 公共方法 ───

function refresh() {
  tableRef.value?.httpRequestInstance?.()
}

function getSelectedRows(): Record<string, unknown>[] {
  return tableRef.value?.getSelectionRows?.() || []
}

defineExpose({
  refresh,
  getSelectedRows,
  tableRef,
  formRef,
  queryModel,
  openDialog,
  closeDialog,
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
