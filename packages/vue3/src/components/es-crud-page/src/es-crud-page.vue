<template>
  <div class="es-crud-page">
    <es-error-boundary @error="onCrudError">
      <es-table
        ref="tableRef"
        :columns="mergedColumns"
        :options="mergedOptions"
        v-model:data-source="tableData"
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

<script setup lang="ts">
import { ref, reactive, computed, watch } from 'vue'
import { ElMessageBox } from 'element-plus'
import EsForm from '../../es-form/src/es-form.vue'
import EsTable from '../../es-table/src/component.vue'
import EsErrorBoundary from '../../es-error-boundary/src/es-error-boundary.vue'
import useDialog from '../../es-dialog/src/use-dialog'
import { getNestedValue, setNestedValue, resolveCrudActions } from '@es-plus/core'
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
  { immediate: true }
)

const paginationState = ref({
  current: 1,
  pageSize: 10,
  total: 0,
  ...(props.schema.pagination || {})
})

// ─── 向后兼容：归一化配置 ───

/**
 * 生效的 action 集（AN-06）。
 *
 * 三端此前各自硬编码 `props.schema.actions || ['add','edit','delete']`，于是在
 * **新对话框模式**（生成器只发 `dialogs`、不发 `actions`）里，页面会凭空多出
 * add/edit/delete —— `actions:['view']` 的只读页照样渲染「删除」并真的发 DELETE。
 * 推导规则见 core 的 `resolveCrudActions`（显式 → dialogs key → dialogFormItems → 只读）。
 */
const resolvedActions = computed(() => resolveCrudActions(props.schema))

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

  // 显式声明了 operationColumn：按钮面交给用户，不再派生工具栏按钮
  // （只声明 dialogs 不算 —— dialogs 定义的是弹窗、不是按钮面；AI-35：旧写法把它一并
  //  当作「显式模式」，导致 `dialogs: { add }` 的配置页面上没有任何「新增」入口，
  //  声明的弹窗点不开且零告警。按钮一律由 actions 派生，弹窗只负责被打开。）
  if (props.schema.operationColumn !== undefined) return []

  // 旧模式：从 actions 推导
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

  // 旧模式：从 actions 推导
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
    btns
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

// ─── 表格列合并 ───

const mergedColumns = computed<TableColumn[]>(() => {
  const cols = [...(props.schema.columns || [])]
  const opCol = normalizedOperationColumn.value

  if (opCol === false || opCol === undefined) return cols

  // 保留用户声明的其余键（hidden / icon / disabled …），只覆盖四个运行时键。
  // `hidden` 由 es-table 的 operate 列渲染器读取（三端同构：`typeof btn.hidden === 'function'
  // ? !btn.hidden(row) : !btn.hidden`），是**文档化契约**（docs/crud-page.md「行内动态隐藏」
  // 示例）。此前这里按三键重建按钮对象，`hidden` 被静默丢掉 —— 「审批仅待审行可见」这类
  // 配置永远不生效，且零报错。clickEvent 覆盖用户的 click（点击语义由 CRUD 页接管）。
  const actionBtns = opCol.btns.map((btn) => ({
    ...btn,
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

/**
 * 行点击转发（AN-11⑥）。
 *
 * `row-click` 此前只写在 `defineEmits` 里、三个端**从未 emit** —— 而 Vue 3 会把
 * 已声明的事件从 `$attrs` 摘掉，宿主的 `@row-click` 既收不到事件、也不会经
 * `v-bind="$attrs"` 落到内层 es-table 上，是彻底的静默失效。这里显式接线：
 * es-table 的 row-click（el-table/vxe/virtual 三引擎）→ 本组件 emit。
 */
function onRowClick(row: Record<string, unknown>) {
  emit('row-click', row)
}

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

// 错误边界回调：子树（表格/表单/单元格 render）抛错被 EsErrorBoundary 拦截后在此记录，
// 故障被隔离在边界内、不再冒泡为整页崩溃。
function onCrudError(err: unknown, info: string) {
  console.error('[EsCrudPage] 子树渲染错误已被错误边界拦截：', info, err)
}

interface DialogInstanceEntry {
  /** useDialog 返回的可调用对象（带 destroy / destroyCurrent） */
  hook: any
  /** 该弹窗配置的 cacheKey（无则 undefined）——决定关闭时的回收策略 */
  cacheKey?: string
}

const dialogInstances = new Map<string, DialogInstanceEntry>()

// useDialog() 必须在 setup 顶层调用：它在【调用时刻】通过 getCurrentInstance() 捕获 appContext。
// 若放在 openDialog（DOM 事件回调）内调用，此刻无活动组件实例 → getCurrentInstance() 为 null →
// appContext 为 null，命令式弹窗将丢失 app 级 provide/inject、globalProperties、i18n，以及用户
// render 中按全局名解析的组件。提到 setup 顶层后 appContext 被正确捕获，单例回调跨 key 复用。
const dialog = useDialog()

/**
 * AI-27：弹窗底座键的**显式白名单**（逐键转发给 `dialog()`）。
 *
 * 此前这里是硬编码的 9 键转发、且不 spread `dialogConfig` —— 于是即便 AI 契约放行了
 * `showClose`/`modal`/`closeOnClickModal`/… 宿主 LLM 也写进了 `pageSchema.dialogs[k]`，
 * 运行到这一步照样被**静默丢弃**（这是第二道闸门：第一道是 AI Zod 的 strip）。
 *
 * 白名单必须与 AI 契约里「逐键转发」的子集**逐字相等**：即 `DialogConfigSchema` 的键
 * 减去需要特殊装配的那些 —— `title`（支持函数式）、`formItems`/`formLayout`（参与构造
 * render）、`configBtn`（由 `resolveDialogBtns` 按 action 装配 click）、`hasCustomRender`
 * （AI-only 注解键，不是弹窗 prop）、`render`/`onOpen`/`onConfirm`/`onClose`（函数值，不在
 * AI 契约里）。`scripts/check-schema-contract.mjs` 读取本数组并断言这条等式：
 * 往 AI 契约加一个数据键却忘了在这里转发 → 立刻红（三端各存一份，等价性同样被断言）。
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

/** 按白名单抽底座数据键；未声明的键不下发（避免用 undefined 覆盖弹窗自身的默认值）。 */
function pickDialogBaseProps(config: CrudDialogConfig): Record<string, unknown> {
  const out: Record<string, unknown> = {}
  for (const k of DIALOG_PASSTHROUGH_KEYS) {
    const v = (config as Record<string, unknown>)[k]
    if (v !== undefined) out[k] = v
  }
  return out
}

function openDialog(key: string, row?: Record<string, unknown>) {
  const dialogConfig = normalizedDialogs.value[key]
  if (!dialogConfig) return

  emit('dialog-open', key, row)

  // 只有显式配置了非空 cacheKey 才走缓存通道；否则关闭即销毁本次实例
  const cacheKey =
    typeof dialogConfig.cacheKey === 'string' && dialogConfig.cacheKey ? dialogConfig.cacheKey : undefined
  dialogInstances.set(key, { hook: dialog, cacheKey })

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

  dialogConfig.onOpen?.(row)

  const configBtn = resolveDialogBtns(key, dialogConfig, formData, row || {})

  const dialogBaseProps = pickDialogBaseProps(dialogConfig)
  if (dialogBaseProps.width === undefined) dialogBaseProps.width = '600px'

  dialog({
    ...dialogBaseProps,
    title,
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
      const entry = dialogInstances.get(key)
      dialogInstances.delete(key)
      // cacheKey 弹窗关闭时**不**销毁：保留缓存实例正是 cacheKey 的语义，
      // 由 useDialog 的 TTL（10 分钟）回收。
      // 无 cacheKey 时只销毁当前单例 vNode —— 不能调 destroy() 无参：
      // 那会连带清空**其它**弹窗的 cacheKey 缓存（`dialogs.add` 关闭即抹掉 `edit` 缓存）。
      if (entry && !entry.cacheKey) entry.hook?.destroyCurrent?.()
      dialogConfig.onClose?.()
    }
  })
}

function closeDialog(key: string) {
  const entry = dialogInstances.get(key)
  if (entry) {
    dialogInstances.delete(key)
    // 显式关闭 = 丢弃该弹窗：有 cacheKey 只清自己那条缓存，无 cacheKey 只销毁当前实例。
    // 不能用 destroy() 无参（会清空全部缓存）。
    if (entry.cacheKey) entry.hook?.destroy?.(entry.cacheKey)
    else entry.hook?.destroyCurrent?.()
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
            // 校验失败会 reject（表单已高亮错误）、onConfirm 抛错各自路径已处理；
            // 吞掉以防 EsDialog 未捕获 click() 返回的 promise → unhandled rejection（对齐 F2）
            try {
              await validateAndConfirm(key, config, formData, row, close, getRefs)
            } catch { /* 已在 validate/onConfirm 内暴露，忽略 */ }
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
        // 校验失败会 reject（表单已高亮错误）、onConfirm 抛错各自路径已处理；
        // 吞掉以防 EsDialog 未捕获 click() 返回的 promise → unhandled rejection（对齐 F2）
        try {
          await validateAndConfirm(key, config, formData, row, close, getRefs)
        } catch { /* 已在 validate/onConfirm 内暴露，忽略 */ }
      }
    }
  ]
}

// 防重复提交：记录确认在途的弹窗 key（同一弹窗确认未结束前忽略再次点击），
// 避免用户在异步 onConfirm 未返回时二次点击「确定」导致新增/编辑被提交两次。
const confirmingKeys = new Set<string>()

async function validateAndConfirm(
  key: string,
  config: CrudDialogConfig,
  formData: Record<string, unknown>,
  row: Record<string, unknown>,
  close: () => void,
  getRefs: (name?: string) => any
) {
  if (confirmingKeys.has(key)) return
  confirmingKeys.add(key)
  try {
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
  } finally {
    confirmingKeys.delete(key)
  }
}

// ─── 公共方法 ───

function refresh() {
  // 刷新**当前页**：走表格的 refresh()（内部 keepPage:true），而不是 httpRequestInstance()。
  // httpRequestInstance 默认 keepPage=false，会把用户从第 N 页踢回第 1 页——编辑/删除确认后
  // 刷新即触发，属于明显的交互倒退。保留 httpRequestInstance 兜底以兼容不暴露 refresh 的
  // 旧版表格实现。
  // 失败已由 es-table 内部 surfaceRequestError 暴露（emit request-error），这里吞掉 rejection 避免 unhandled
  const t = tableRef.value
  const req = typeof t?.refresh === 'function' ? t.refresh() : t?.httpRequestInstance?.()
  return req && typeof req.catch === 'function' ? req.catch(() => {}) : Promise.resolve()
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
