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
        @row-click="onRowClick"
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
import { getNestedValue, setNestedValue } from '../../../utils/shared'
import { resolveCrudActions } from '@es-plus/core'
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

/**
 * AI-27：弹窗底座键的**显式白名单**（逐键转发给 `dialog()`）。
 *
 * 此前是硬编码 9 键、不 spread `dialogConfig` —— AI 契约放行的 `showClose`/`modal`/… 即便
 * 被宿主 LLM 写进 `pageSchema.dialogs[k]`，到这里仍被静默丢弃（第二道闸门）。
 *
 * 必须与「AI 契约键 − 特殊装配键」逐字相等（特殊装配：title 支持函数式、formItems/formLayout
 * 参与构造 render、configBtn 由 resolveDialogBtns 装配 click、hasCustomRender 是 AI-only 注解键、
 * render/onOpen/onConfirm/onClose 是函数值）。三端各存一份，`check-schema-contract.mjs` 断言
 * 三份 + AI 契约等价 —— 加键却忘转发，立刻红。
 *
 * 注意：`cacheKey` 与 vue3/vue2 同义 —— antdv 的 use-dialog 已实现实例缓存（关闭后
 * TTL 10 分钟回收），本键在三端均真生效。它不在组件模板里消费，而是由 `dialog()` 读取。
 */
const DIALOG_PASSTHROUGH_KEYS = [
  'width',
  'isDraggable',
  'maxHeight',
  'fullscreen',
  'isHiddenFooter',
  'showClose',
  'destroyOnClose',
  'modal',
  'closeOnClickModal',
  'closeOnPressEscape',
  'hiddenFullBtn',
  'appendTo',
  'cacheKey',
] as const

/** 按白名单抽底座数据键；未声明的不下发（避免用 undefined 覆盖弹窗自身的默认值）。 */
function pickDialogBaseProps(config: CrudDialogConfig): Record<string, unknown> {
  const out: Record<string, unknown> = {}
  for (const k of DIALOG_PASSTHROUGH_KEYS) {
    const v = (config as Record<string, unknown>)[k]
    if (v !== undefined) out[k] = v
  }
  return out
}

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
        // prop 支持 'a.b' / 'a[0].b' 嵌套路径（见 core parsePathSegments）。
        // 必须经 setNestedValue 建出嵌套结构、经 getNestedValue 判存在：
        // 扁平键 queryModel['a.b']='' 在 getNestedValue(model,'a.b') 下取不到，
        // 且 {...queryModel} 会把悬空的 'a.b' 键一并带进查询/导出负载。
        if (item.prop && getNestedValue(queryModel, item.prop) === undefined) {
          setNestedValue(queryModel, item.prop, '')
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

/**
 * 生效的 action 集（AN-06）。推导规则见 core 的 `resolveCrudActions`：显式 `actions`
 * （含 `[]` = 只读）→ `dialogs` key 推导 → `dialogFormItems` 旧兼容 → `[]`。
 * 不再用 `props.schema.actions || ['add','edit','delete']` —— 那会让只读的新模式
 * 页面凭空多出「删除」并真的发 DELETE。
 */
const resolvedActions = computed(() => resolveCrudActions(props.schema))

const normalizedDialogs = computed<Record<string, CrudDialogConfig>>(() => {
  if (props.schema.dialogs) return props.schema.dialogs

  if (!props.schema.dialogFormItems?.length) return {}

  const dialogBase = {
    width: props.schema.dialogOptions?.width || '600px',
    formItems: props.schema.dialogFormItems,
    ...(props.schema.dialogOptions || {}),
  } as CrudDialogConfig

  const result: Record<string, CrudDialogConfig> = {}
  const actions = resolvedActions.value

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

  // 只有显式声明 operationColumn 才是「按钮面交给用户」；dialogs 不参与按钮派生
  // （AI-35：旧写法把 dialogs 也算作显式模式 → `dialogs: { add }` 无「新增」入口）
  if (props.schema.operationColumn !== undefined) return []

  const actions = resolvedActions.value
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

  const actions = resolvedActions.value
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
    // AN-11⑥：`query` 事件此前只声明、从未 emit。它不能挂在 `triggerEvent` 上 ——
    // 那条分支由 EsForm 独占（只用注入的表格实例发起请求，不回调这里的 click）。
    // 故查询键自己发起一次「新搜索」（回到第 1 页，与 EsForm 的 queryTableRequest 同口径），
    // 再带着当前查询模型派发事件；重置键仍交给 EsForm 的 triggerEvent（重置表单 + 刷新）。
    {
      name: '查询', type: 'primary', key: 'query',
      click: () => {
        ;(tableRef.value as any)?.httpRequestInstance?.(queryModel, { keepPage: false })?.catch?.(() => {})
        emit('query', { ...queryModel })
      },
    },
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

/**
 * 行点击转发（AN-11⑥）。
 *
 * `row-click` 此前只写在 `defineEmits` 里、三个端**从未 emit** —— 而 Vue 3 会把
 * 已声明的事件从 `$attrs` 摘掉，宿主的 `@row-click` 既收不到事件、也不会经
 * `v-bind="$attrs"` 落到内层 es-table 上，是彻底的静默失效。这里显式接线：
 * es-table 的 row-click（a-table 经 customRow 翻译 / vxe 引擎原生）→ 本组件 emit。
 */
function onRowClick(row: Record<string, unknown>) {
  emit('row-click', row)
}

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
        // 按路径回填：prop 支持 'a.b' / 'a[0].b'。必须经 setNestedValue 建出嵌套结构、
        // 经 getNestedValue 从 row 读同名路径 —— 否则编辑态下表单经 getNestedValue(model,'a.b')
        // 取到 undefined（此处只落了扁平键 'a.b'），嵌套字段永远不回填。
        setNestedValue(formData, item.prop, getNestedValue(row ?? {}, item.prop) ?? '')
      }
    })
  }

  const title = typeof dialogConfig.title === 'function'
    ? dialogConfig.title(row)
    : dialogConfig.title || ''

  // onOpen 在 formData 构建后调用（对齐 vue3 时序）
  dialogConfig.onOpen?.(row)

  const configBtn = resolveDialogBtns(key, dialogConfig, formData, row || {})

  const dialogBaseProps = pickDialogBaseProps(dialogConfig)
  if (dialogBaseProps.width === undefined) dialogBaseProps.width = '600px'

  dialog({
    ...dialogBaseProps,
    title,
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
            // 校验失败会 reject（表单已高亮错误）、onConfirm 抛错各自路径已处理；
            // 吞掉以防 EsDialog 未捕获 click() 返回的 promise → unhandled rejection（对齐 F2）
            try {
              await validateAndConfirm(key, config, formData, row, close, getRefs)
            } catch { /* 已在 validate/onConfirm 内暴露，忽略 */ }
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
        // 校验失败会 reject（表单已高亮错误）、onConfirm 抛错各自路径已处理；
        // 吞掉以防 EsDialog 未捕获 click() 返回的 promise → unhandled rejection（对齐 F2）
        try {
          await validateAndConfirm(key, config, formData, row, close, getRefs)
        } catch { /* 已在 validate/onConfirm 内暴露，忽略 */ }
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
