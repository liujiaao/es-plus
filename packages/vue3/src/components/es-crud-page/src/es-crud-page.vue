<template>
  <div class="es-crud-page">
    <es-table
      ref="tableRef"
      :columns="mergedColumns"
      :options="mergedOptions"
      v-model:data-source="tableData"
      v-model:pagination="paginationState"
      v-bind="$attrs"
    >
      <es-form
        v-if="schema.formItems && schema.formItems.length"
        ref="formRef"
        :model="queryModel"
        :form-item-list="schema.formItems"
        :config-btn="mergedFormBtns"
        :layout-form-props="formLayoutProps"
      />
      <template v-for="(_, name) in $slots" #[name]="slotData">
        <slot :name="name" v-bind="slotData || {}" />
      </template>
    </es-table>
  </div>
</template>

<script setup lang="ts">
import { ref, reactive, computed, watch } from 'vue'
import { ElMessageBox } from 'element-plus'
import EsForm from '../../es-form/src/es-form.vue'
import EsTable from '../../es-table/src/component.vue'
import useDialog from '../../es-dialog/src/use-dialog'
import type {
  CrudPageSchema,
  CrudAction,
  CrudBtnConfig,
  TableBtnConfig,
  OperationColumnConfig,
  RowBtnConfig,
  CrudDialogConfig,
  DialogActionContext
} from './types'
import type { BtnConfig, TableColumn } from '../../../types'

defineOptions({ name: 'EsCrudPage' })

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
  'dialog-confirm': [dialogKey: string, data: Record<string, unknown>]
  'dialog-cancel': [dialogKey: string]
  'dialog-open': [dialogKey: string, row?: Record<string, unknown>]
}>()

const tableRef = ref<any>(null)
const formRef = ref<any>(null)
const tableData = ref<Record<string, unknown>[]>([])

const queryModel = reactive<Record<string, unknown>>({})

watch(
  () => props.schema.formItems,
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

const paginationState = ref({
  current: 1,
  pageSize: 10,
  total: 0,
  ...(props.schema.pagination || {})
})

// ─── 向后兼容：归一化配置 ───

const normalizedDialogs = computed<Record<string, CrudDialogConfig>>(() => {
  if (props.schema.dialogs) return props.schema.dialogs

  // 旧模式：从 dialogFormItems + actions 推导
  if (!props.schema.dialogFormItems?.length) return {}

  const dialogBase = {
    width: props.schema.dialogOptions?.width || '600px',
    formItems: props.schema.dialogFormItems,
    ...(props.schema.dialogOptions || {})
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

  // 新模式（显式配置了 dialogs 或 operationColumn）：不自动生成工具栏按钮
  if (props.schema.dialogs || props.schema.operationColumn !== undefined) return []

  // 旧模式：从 actions 推导
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

  // 旧模式：从 actions 推导
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
    btns
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
    permissionValue: btn.permissionValue,
    clickEvent: (row: Record<string, unknown>) => handleRowBtnClick(btn, row)
  }))

  cols.push({
    prop: 'operate',
    label: opCol.label || '操作',
    width: opCol.width || actionBtns.length * 80 + 20,
    fixed: opCol.fixed || 'right',
    btns: actionBtns
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
    // Support both position (new) and code (legacy)
    position: btn.position || (btn.code === 2 ? 'right' : 'left') as 'left' | 'right',
    code: btn.code,
    permissionValue: btn.permissionValue,
    loading: btn.loading,
    disabled: btn.disabled,
    click: () => handleToolbarBtnClick(btn)
  }))
})

// ─── 表格选项 ───

const mergedOptions = computed(() => {
  const base: Record<string, unknown> = {
    border: true,
    isInitRun: props.autoLoad,
    ...(props.schema.tableOptions || {})
  }
  if (props.httpRequest) {
    base.httpRequest = props.httpRequest
  }
  const tBtns = normalizedTableBtns.value
  if (tBtns.length > 0) {
    const existing = (base.configBtn as any[]) || []
    base.configBtn = [...existing, ...tBtns]
  }
  return base
})

// ─── 表单布局 ───

const formLayoutProps = computed(() => {
  const layout = props.schema.formLayout
  if (!layout) return undefined
  return {
    rowLayProps: { gutter: 16 },
    formLayProps: {
      labelBtnWidth: layout.labelWidth,
      ...(layout.minFoldRows ? { minFoldRows: layout.minFoldRows } : {})
    }
  } as any
})

// ─── 工具栏按钮处理 ───

async function handleToolbarBtnClick(btn: CrudBtnConfig) {
  const key = btn.key || btn.actionType || ''

  // 确认逻辑
  if (btn.confirm) {
    const msg = typeof btn.confirm === 'string' ? btn.confirm : '确定执行此操作吗？'
    try {
      await ElMessageBox.confirm(msg, '提示', { type: 'warning' })
    } catch {
      return
    }
  }

  // 打开弹窗
  if (btn.dialogKey) {
    // 向后兼容：仍然 emit 对应的语义事件
    if (key === 'add') emit('add')
    openDialog(btn.dialogKey)
    return
  }

  // 非弹窗按钮的事件
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

  // 确认逻辑
  if (btn.confirm) {
    const msg = typeof btn.confirm === 'string' ? btn.confirm : '确定执行此操作吗？'
    try {
      await ElMessageBox.confirm(msg, '提示', { type: 'warning' })
    } catch {
      return
    }
  }

  // 自定义 click
  if (btn.click) {
    btn.click(row, {
      refresh,
      getSelectedRows,
      openDialog
    })
    return
  }

  // 打开弹窗
  if (btn.dialogKey) {
    openDialog(btn.dialogKey, row)
    return
  }

  // 向后兼容事件
  if (key === 'edit') emit('edit', row)
  else if (key === 'delete') emit('delete', row)
  else if (key === 'view') emit('view', row)

  emit('btn-click', key, row)
}

// ─── 弹窗管理 ───

const dialogInstances = new Map<string, any>()

function openDialog(key: string, row?: Record<string, unknown>) {
  const dialogConfig = normalizedDialogs.value[key]
  if (!dialogConfig) return

  emit('dialog-open', key, row)

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

  dialogConfig.onOpen?.(row)

  const configBtn = resolveDialogBtns(key, dialogConfig, formData, row || {})

  dialog({
    title,
    width: dialogConfig.width || '600px',
    isDraggable: dialogConfig.isDraggable,
    maxHeight: dialogConfig.maxHeight,
    fullscreen: dialogConfig.fullscreen,
    isHiddenFooter: dialogConfig.isHiddenFooter,
    render: dialogConfig.render
      ? (h: any, inst: any) => {
          return dialogConfig.render!(h, {
            row: row || {},
            model: formData,
            registerRef: inst.registerRef,
            close: () => closeDialog(key),
            refresh
          })
        }
      : dialogConfig.formItems
        ? (h: any, { registerRef }: any) => {
            return h(EsForm, {
              ref: (el: any) => el && registerRef('dialogForm', el),
              model: formData,
              formItemList: dialogConfig.formItems,
              layoutFormProps: {
                rowLayProps: { gutter: 16 },
                formLayProps: {
                  isBtnHidden: true,
                  ...(dialogConfig.formLayout || {})
                }
              }
            })
          }
        : undefined,
    configBtn,
    onClosed: () => {
      dialogInstances.delete(key)
      dialogConfig.onClose?.()
    }
  })
}

function closeDialog(key: string) {
  const dialog = dialogInstances.get(key)
  if (dialog) {
    dialog.close()
    dialogInstances.delete(key)
  }
}

function resolveDialogBtns(
  key: string,
  config: CrudDialogConfig,
  formData: Record<string, unknown>,
  row: Record<string, unknown>
): any[] | undefined {
  if (config.isHiddenFooter) return undefined

  // 用户显式指定了 configBtn
  if (config.configBtn) {
    return config.configBtn.map((btn) => {
      if (btn.action === 'cancel') {
        return {
          ...btn,
          click: (_: any, { close }: any) => {
            emit('dialog-cancel', key)
            close()
          }
        }
      }
      if (btn.action === 'confirm') {
        return {
          ...btn,
          click: async (_: any, { close, getRefs }: any) => {
            await validateAndConfirm(key, config, formData, row, close, getRefs)
          }
        }
      }
      return btn
    })
  }

  // 自动生成取消 + 确定
  return [
    {
      name: '取消',
      click: (_: any, { close }: any) => {
        emit('dialog-cancel', key)
        close()
      }
    },
    {
      name: '确定',
      type: 'primary',
      click: async (_: any, { close, getRefs }: any) => {
        await validateAndConfirm(key, config, formData, row, close, getRefs)
      }
    }
  ]
}

async function validateAndConfirm(
  key: string,
  config: CrudDialogConfig,
  formData: Record<string, unknown>,
  row: Record<string, unknown>,
  close: () => void,
  getRefs: (name?: string) => any
) {
  // 如果有表单，先校验
  if (config.formItems?.length) {
    const dialogForm = getRefs('dialogForm')
    if (dialogForm?.validate) {
      await dialogForm.validate()
    }
  }

  const context: DialogActionContext = { close, refresh, getRefs, row }

  // 用户自定义 onConfirm
  if (config.onConfirm) {
    await config.onConfirm(formData, context)
  } else {
    // 向后兼容：emit btn-click 事件
    const legacyKey = key === 'add' ? 'add-confirm' : key === 'edit' ? 'edit-confirm' : `${key}-confirm`
    emit('btn-click', legacyKey, formData)
    close()
    refresh()
  }

  // 新事件
  emit('dialog-confirm', key, formData)
}

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
  closeDialog
})
</script>

<style scoped>
.es-crud-page {
  width: 100%;
}
</style>
