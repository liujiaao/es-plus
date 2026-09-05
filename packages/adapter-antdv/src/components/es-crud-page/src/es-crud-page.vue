<!--
  ADV 适配器：EsCrudPage CRUD 编排组件（对齐 @es-plus/vue3 es-crud-page.vue）

  - 查询/重置由 EsForm 内部 triggerEvent 联动表格（单次请求），EsCrudPage 不监听 @confirm/@reset
  - 弹窗 render 接收 inst 参数，用 inst.registerRef 注册表单到 dialog refs 存储
  - validateAndConfirm 用 dialog 的 getRefs('dialogForm') 取表单 + 透传原生 validate Promise
  - emits 对齐 vue3（无 page-change/sort-change/add-confirm/edit-confirm）
  - formLayoutProps 对齐 vue3（labelBtnWidth 键 + 始终 gutter:16）；onOpen 时序对齐
  - 操作列行按钮不透传 icon/hidden（对齐 vue3）
-->
<template>
  <div class="es-crud-page">
    <es-error-boundary @error="onCrudError">
      <es-table
        ref="tableRef"
        :columns="mergedColumns"
        :options="mergedOptions"
        v-model:dataSource="tableData"
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
    </es-error-boundary>
  </div>
</template>

<script lang="ts">
export default { name: 'EsCrudPage' }
</script>

<script setup lang="ts">
import { ref, reactive, computed, watch, h } from 'vue'
import { Modal } from 'ant-design-vue'
import { ExclamationCircleOutlined } from '@ant-design/icons-vue'
import EsForm from '../../es-form/src/es-form.vue'
import EsTable from '../../es-table/src/component.vue'
import EsErrorBoundary from '../../es-error-boundary/src/es-error-boundary.vue'
import { useDialog } from '../../es-dialog/src/use-dialog'
import type {
  CrudPageSchema,
  CrudBtnConfig,
  TableBtnConfig,
  OperationColumnConfig,
  RowBtnConfig,
  CrudDialogConfig,
  DialogActionContext,
} from './types'
import type { BtnConfig, TableColumn } from '../../../types'

const props = withDefaults(
  defineProps<{
    schema: CrudPageSchema
    httpRequest?: (params: Record<string, unknown>) => Promise<unknown>
    autoLoad?: boolean
  }>(),
  { autoLoad: true },
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
  { immediate: true },
)

const paginationState = ref({
  current: 1,
  pageSize: 10,
  total: 0,
  ...(props.schema.pagination || {}),
})

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

// ─── 表格列合并（操作列行按钮不透传 icon/hidden，对齐 vue3）──

const mergedColumns = computed<TableColumn[]>(() => {
  const cols = [...(props.schema.columns || [])]
  const opCol = normalizedOperationColumn.value

  if (opCol === false || opCol === undefined) return cols

  const actionBtns = opCol.btns.map((btn) => ({
    name: btn.name,
    type: btn.type,
    permissionValue: btn.permissionValue,
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
  return base
})

// ─── 表单布局（对齐 vue3：labelBtnWidth 键 + 始终 gutter:16）──

const formLayoutProps = computed(() => {
  const layout = props.schema.formLayout
  if (!layout) return undefined
  return {
    rowLayProps: { gutter: 16 },
    formLayProps: {
      labelBtnWidth: layout.labelWidth,
      ...(layout.minFoldRows ? { minFoldRows: layout.minFoldRows } : {}),
    },
  } as any
})

// ─── 工具栏按钮处理 ───

async function handleToolbarBtnClick(btn: CrudBtnConfig) {
  const key = btn.key || btn.actionType || ''

  // 确认逻辑（对齐 vue3 ElMessageBox.confirm，ADV 用 Modal.confirm 近似 warning）
  if (btn.confirm) {
    const msg = typeof btn.confirm === 'string' ? btn.confirm : '确定执行此操作吗？'
    try {
      await new Promise((resolve, reject) => {
        Modal.confirm({
          title: '提示',
          icon: h(ExclamationCircleOutlined),
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

  // 打开弹窗
  if (btn.dialogKey) {
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
      await new Promise((resolve, reject) => {
        Modal.confirm({
          title: '提示',
          icon: h(ExclamationCircleOutlined),
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

  // 自定义 click
  if (btn.click) {
    btn.click(row, {
      refresh,
      getSelectedRows,
      openDialog,
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

// 错误边界回调：子树（表格/表单/单元格 render）抛错被 EsErrorBoundary 拦截后在此记录，
// 故障被隔离在边界内、不再冒泡为整页崩溃。
function onCrudError(err: unknown, info: string) {
  console.error('[EsCrudPage] 子树渲染错误已被错误边界拦截：', info, err)
}

const dialogInstances = new Map<string, any>()

// useDialog() 必须在 setup 顶层调用：它在【调用时刻】通过 getCurrentInstance() 捕获 appContext。
// 若放在 openDialog（DOM 事件回调）内调用，此刻无活动组件实例 → getCurrentInstance() 为 null →
// appContext 为 null，命令式弹窗将丢失 app 级 provide/inject、globalProperties、i18n，以及用户
// render 中按全局名解析的组件。提到 setup 顶层后 appContext 被正确捕获，单例回调跨 key 复用。
const dialog = useDialog()

function openDialog(key: string, row?: Record<string, unknown>) {
  const dialogConfig = normalizedDialogs.value[key]
  if (!dialogConfig) return

  emit('dialog-open', key, row)

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

  // onOpen 在 formData 构建后调用（对齐 vue3 时序）
  dialogConfig.onOpen?.(row)

  const configBtn = resolveDialogBtns(key, dialogConfig, formData, row || {})

  dialog({
    title,
    width: dialogConfig.width || '600px',
    isDraggable: dialogConfig.isDraggable,
    maxHeight: dialogConfig.maxHeight,
    fullscreen: dialogConfig.fullscreen,
    isHiddenFooter: dialogConfig.isHiddenFooter,
    // render 接收 inst 参数，用 inst.registerRef 注册表单到 dialog 的 refs 存储（对齐 vue3）
    render: (dialogConfig.render
      ? (hFn: typeof h, inst: any) => {
          return dialogConfig.render!(hFn, {
            row: row || {},
            model: formData,
            registerRef: inst.registerRef,
            close: () => closeDialog(key),
            refresh,
          } as any)
        }
      : dialogConfig.formItems
        ? (hFn: typeof h, inst: any) => {
            return hFn(EsForm, {
              ref: (el: any) => el && inst.registerRef('dialogForm', el),
              model: formData,
              formItemList: dialogConfig.formItems,
              layoutFormProps: {
                rowLayProps: { gutter: 16 },
                formLayProps: {
                  isBtnHidden: true,
                  ...(dialogConfig.formLayout || {}),
                },
              },
            } as any)
          }
        : undefined) as any,
    configBtn,
    onClosed: () => {
      const d = dialogInstances.get(key)
      dialogInstances.delete(key)
      d?.destroy?.()
      dialogConfig.onClose?.()
    },
  })
}

function closeDialog(key: string) {
  const dialog = dialogInstances.get(key)
  if (dialog) {
    dialogInstances.delete(key)
    dialog.destroy()
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

// 防重复提交：记录确认在途的弹窗 key（同一弹窗确认未结束前忽略再次点击），
// 避免异步 onConfirm 未返回时二次点击「确定」导致新增/编辑被提交两次。（对齐 vue3）
const confirmingKeys = new Set<string>()

async function validateAndConfirm(
  key: string,
  config: CrudDialogConfig,
  formData: Record<string, unknown>,
  row: Record<string, unknown>,
  close: () => void,
  getRefs: (name?: string) => any,
) {
  if (confirmingKeys.has(key)) return
  confirmingKeys.add(key)
  try {
    // 有表单时先校验（透传原生 Promise，让校验失败抛错，对齐 vue3）
    if (config.formItems?.length) {
      const dialogForm = getRefs('dialogForm')
      if (dialogForm?.validate) {
        await dialogForm.validate()
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
  } finally {
    confirmingKeys.delete(key)
  }
}

// ─── 公共方法 ───

function refresh() {
  // 失败已由 es-table 内部 surfaceRequestError + emit('request-error') 暴露，
  // 这里吞掉 rejection 避免 unhandled promise rejection（对齐 vue3）。
  return tableRef.value?.httpRequestInstance?.()?.catch(() => {})
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
}
</style>
