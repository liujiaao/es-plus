<template>
  <div class="es-crud-page">
    <!--
      Vue 3 → Vue 2 关键差异：
        - v-model:data-source → :data-source.sync
        - v-model:pagination → :pagination.sync
      Vue 2.3+ 支持 .sync 修饰符自动展开为 :data-source + @update:data-source
    -->
    <es-error-boundary @error="onCrudError">
      <es-table
        ref="tableRef"
        :columns="mergedColumns"
        :options="mergedOptions"
        :data-source.sync="tableData"
        :pagination.sync="paginationState"
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
/**
 * EsCrudPage —— Vue 2 版本
 *
 * 与 Vue 3 版本的关键差异：
 *   1. <script setup> + defineProps/defineEmits/defineExpose → defineComponent + setup()
 *   2. v-model:* → .sync 修饰符
 *   3. ElMessageBox 替换为：
 *      a) Element UI 的 MessageBox.confirm（兼容 Vue.use(ElementUI) 全局注册）
 *      b) 或通过 Vue.prototype.$confirm（同样由 Element UI 全局注册）
 *      此处直接 import 'element-ui' 的 MessageBox 以避免依赖原型方法
 *   4. useDialog 来自 Vue 2 版本（Vue.extend + $mount）
 *
 * 业务逻辑（schema 归一化、按钮处理、弹窗管理）100% 与 Vue 3 版本一致。
 */
import { defineComponent, ref, reactive, computed, watch, set } from '../../vue-compat'
import { MessageBox } from 'element-ui'
import EsForm from '../es-form/es-form.vue'
import EsTable from '../es-table/component.vue'
import EsErrorBoundary from '../es-error-boundary/es-error-boundary.vue'
import useDialog from '../es-dialog/use-dialog'
import type {
  CrudPageSchema,
  CrudBtnConfig,
  TableBtnConfig,
  OperationColumnConfig,
  RowBtnConfig,
  CrudDialogConfig,
  DialogActionContext,
} from './types'
import type { BtnConfig, TableColumn } from '@es-plus/core'

export default defineComponent({
  name: 'EsCrudPage',
  components: { EsForm, EsTable, EsErrorBoundary },
  inheritAttrs: false,
  props: {
    schema: { type: Object as () => CrudPageSchema, required: true },
    httpRequest: {
      type: Function as unknown as () => (params: Record<string, unknown>) => Promise<unknown>,
      default: undefined,
    },
    autoLoad: { type: Boolean, default: true },
  },
  emits: [
    'query',
    'add',
    'edit',
    'delete',
    'view',
    'export',
    'row-click',
    'btn-click',
    'dialog-confirm',
    'dialog-cancel',
    'dialog-open',
  ],
  methods: {
    // 错误边界回调：子树（表格/表单/单元格 render）抛错被 EsErrorBoundary 拦截后在此记录，
    // 故障被隔离在边界内、不再冒泡为整页崩溃。
    onCrudError(err: unknown, info: string) {
      // eslint-disable-next-line no-console
      console.error('[EsCrudPage] 子树渲染错误已被错误边界拦截：', info, err)
    },
  },
  setup(props, { emit, expose }) {
    const tableRef = ref<any>(null)
    const formRef = ref<any>(null)
    const tableData = ref<Record<string, unknown>[]>([])
    const queryModel = reactive<Record<string, unknown>>({})

    // 同步 schema.formItems → queryModel 默认字段
    // 用 set() 而非直接赋值：Vue 2.7 reactive({}) 后新增的键需经 set 才响应式，
    // 否则带校验规则的查询字段会复现「校验重渲染回补陈旧空值清空输入」的问题（同弹窗 formData 修复）。
    watch(
      () => props.schema.formItems,
      (items) => {
        if (items) {
          items.forEach((item) => {
            if (item.prop && !(item.prop in queryModel)) {
              set(queryModel as Record<string, unknown>, item.prop as string, '')
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
      ...(props.schema.pagination || {}),
    })

    // ─── 弹窗归一化（向后兼容旧 dialogFormItems / actions 模式） ─────
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

      if (actions.includes('add')) result.add = { ...dialogBase, title: '新增' }
      if (actions.includes('edit')) result.edit = { ...dialogBase, title: '编辑' }
      if (actions.includes('view'))
        result.view = { ...dialogBase, title: '查看', isHiddenFooter: true }

      return result
    })

    const normalizedToolbarBtns = computed<CrudBtnConfig[]>(() => {
      if (props.schema.toolbarBtns) return props.schema.toolbarBtns
      if (props.schema.dialogs || props.schema.operationColumn !== undefined) return []

      const actions = props.schema.actions || ['add', 'edit', 'delete']
      const btns: CrudBtnConfig[] = []

      if (actions.includes('add')) {
        btns.push({
          name: '新增',
          type: 'primary',
          key: 'add',
          icon: 'Plus',
          dialogKey: 'add',
        } as CrudBtnConfig)
      }
      if (actions.includes('export')) {
        btns.push({
          name: '导出',
          key: 'export',
          icon: 'Download',
          actionType: 'export',
        } as CrudBtnConfig)
      }
      if (actions.includes('import')) {
        btns.push({
          name: '导入',
          key: 'import',
          icon: 'Upload',
          actionType: 'import',
        } as CrudBtnConfig)
      }

      return btns
    })

    const normalizedOperationColumn = computed<OperationColumnConfig | false | undefined>(
      () => {
        if (props.schema.operationColumn !== undefined) return props.schema.operationColumn

        const actions = props.schema.actions || ['add', 'edit', 'delete']
        const hasActionCol = props.schema.columns?.some(
          (c) => c.prop === 'action' || c.prop === 'operate' || c.btns
        )
        if (hasActionCol) return undefined

        const rowActions = actions.filter((a) => ['edit', 'delete', 'view'].includes(a))
        if (rowActions.length === 0) return false

        const btns: RowBtnConfig[] = []
        if (actions.includes('view'))
          btns.push({ name: '查看', type: 'primary', key: 'view', dialogKey: 'view' })
        if (actions.includes('edit'))
          btns.push({ name: '编辑', type: 'primary', key: 'edit', dialogKey: 'edit' })
        if (actions.includes('delete'))
          btns.push({
            name: '删除',
            type: 'danger',
            key: 'delete',
            confirm: '确定删除该条数据吗？',
          })

        return {
          label: '操作',
          width: btns.length * 80 + 20,
          fixed: 'right',
          btns,
        }
      }
    )

    // ─── 表单按钮合并 ─────
    const mergedFormBtns = computed<BtnConfig[]>(() => {
      if (props.schema.queryBtns) return props.schema.queryBtns

      const baseBtns: BtnConfig[] = [
        { name: '查询', type: 'primary', key: 'query', triggerEvent: true } as BtnConfig,
        { name: '重置', key: 'rest', triggerEvent: true } as BtnConfig,
      ]

      const toolbarBtns = normalizedToolbarBtns.value.map((btn) => {
        const resolvedBtn: BtnConfig = { ...btn }
        if (!(resolvedBtn as Record<string, unknown>).click) {
          ;(resolvedBtn as Record<string, unknown>).click = () => handleToolbarBtnClick(btn)
        }
        return resolvedBtn
      })

      return [...baseBtns, ...toolbarBtns]
    })

    // ─── 表格列合并（追加操作列） ─────
    const mergedColumns = computed<TableColumn[]>(() => {
      const cols = [...(props.schema.columns || [])]
      const opCol = normalizedOperationColumn.value

      if (opCol === false || opCol === undefined) return cols

      const actionBtns = (opCol as OperationColumnConfig).btns.map((btn) => ({
        name: btn.name,
        type: btn.type,
        permissionValue: btn.permissionValue,
        clickEvent: (row: Record<string, unknown>) => handleRowBtnClick(btn, row),
      }))

      cols.push({
        prop: 'operate',
        label: (opCol as OperationColumnConfig).label || '操作',
        width:
          (opCol as OperationColumnConfig).width || actionBtns.length * 80 + 20,
        fixed: ((opCol as OperationColumnConfig).fixed as string) || 'right',
        btns: actionBtns,
      } as unknown as TableColumn)

      return cols
    })

    // ─── 表格工具栏按钮 ─────
    const normalizedTableBtns = computed(() => {
      if (!props.schema.tableBtns?.length) return []
      return props.schema.tableBtns.map((btn: TableBtnConfig) => ({
        name: btn.name,
        type: btn.type,
        size: (btn as Record<string, unknown>).size || 'small',
        icon: btn.icon,
        // 同时支持 position（新，语义自解释）与 code（旧兼容）——与 vue3/antdv 单源对齐
        position: btn.position || (btn.code === 2 ? 'right' : 'left') as 'left' | 'right',
        code: btn.code,
        permissionValue: btn.permissionValue,
        loading: (btn as Record<string, unknown>).loading,
        disabled: (btn as Record<string, unknown>).disabled,
        click: () => handleToolbarBtnClick(btn),
      }))
    })

    // ─── 表格选项 ─────
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
        const existing = (base.configBtn as unknown[]) || []
        base.configBtn = [...existing, ...tBtns]
      }
      return base
    })

    // ─── 表单布局 ─────
    const formLayoutProps = computed(() => {
      const layout = props.schema.formLayout
      if (!layout) return undefined
      return {
        rowLayProps: { gutter: 16 },
        formLayProps: {
          labelBtnWidth: layout.labelWidth,
          ...(layout.minFoldRows ? { minFoldRows: layout.minFoldRows } : {}),
        },
      } as Record<string, unknown>
    })

    // ─── 工具栏按钮处理 ─────
    async function handleToolbarBtnClick(btn: CrudBtnConfig) {
      const key = btn.key || btn.actionType || ''

      if (btn.confirm) {
        const msg = typeof btn.confirm === 'string' ? btn.confirm : '确定执行此操作吗？'
        try {
          await MessageBox.confirm(msg, '提示', { type: 'warning' })
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

    // ─── 行按钮处理 ─────
    async function handleRowBtnClick(btn: RowBtnConfig, row: Record<string, unknown>) {
      const key = btn.key || ''

      if (btn.confirm) {
        const msg = typeof btn.confirm === 'string' ? btn.confirm : '确定执行此操作吗？'
        try {
          await MessageBox.confirm(msg, '提示', { type: 'warning' })
        } catch {
          return
        }
      }

      if (btn.click) {
        btn.click(row, { refresh, getSelectedRows, openDialog })
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

    // ─── 弹窗管理 ─────
    const dialogInstances = new Map<string, ReturnType<typeof useDialog>>()

    // useDialog() 在 setup 顶层调用（而非 openDialog 事件回调内）：与 vue3/antdv 三端保持一致的
    // 组合式调用位置。vue2 版 useDialog 基于 Vue.extend、不依赖 appContext（全局插件经原型链继承），
    // 故此改动对 vue2 为纯一致性/规范性对齐；单例回调跨 key 复用，语义不变。
    const dialog = useDialog()

    function openDialog(key: string, row?: Record<string, unknown>) {
      const dialogConfig = normalizedDialogs.value[key]
      if (!dialogConfig) return

      emit('dialog-open', key, row)

      dialogInstances.set(key, dialog)

      // Vue 2.7 的 reactive() 沿用 Vue 2 Observer：向已响应式对象「后加」的键不是响应式的
      // （经典限制，需 $set）。若先 reactive({}) 再逐字段赋值，model[prop] 读取时不建立依赖，
      // EsForm 便不会随输入重渲染——无校验规则时 el-input 的本地 currentValue 恰好兜住输入而不暴露，
      // 一旦字段带校验规则，el-form-item 因校验重渲染会用「陈旧的空 value」回补 el-input 而清空输入
      // （create 表单必填字段无法录入）。故这里先把所有字段建好再交给 reactive，键从创建即响应式。
      // vue3 用 Proxy 无此问题，此修复仅对齐 vue2 语义。
      const initialFormData: Record<string, unknown> = {}
      if (dialogConfig.formItems) {
        dialogConfig.formItems.forEach((item) => {
          if (item.prop) {
            initialFormData[item.prop] = row?.[item.prop] ?? ''
          }
        })
      }
      const formData = reactive<Record<string, unknown>>(initialFormData)

      const title =
        typeof dialogConfig.title === 'function'
          ? (dialogConfig.title as Function)(row)
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
        // 用户自定义 render
        render: dialogConfig.render
          ? (h: any, inst: any) => {
              return dialogConfig.render!(h, {
                row: row || {},
                model: formData,
                registerRef: inst.registerRef,
                close: () => closeDialog(key),
                refresh,
              })
            }
          : dialogConfig.formItems
            ? (h: any, { registerRef }: any) => {
                /**
                 * Vue 2 createElement 签名：
                 *   h(Component, { props, attrs, on, ref }, children)
                 * 通过 ref 字符串拿到子组件，再通过 registerRef 传递回 EsDialog
                 *
                 * 但因为 useDialog 创建的是独立 vm，无法直接用字符串 ref 跨实例。
                 * 改为：在 mounted 钩子里通过 vnode.componentInstance 取到 EsForm 实例。
                 */
                const vnode = h(EsForm, {
                  props: {
                    model: formData,
                    formItemList: dialogConfig.formItems,
                    layoutFormProps: {
                      rowLayProps: { gutter: 16 },
                      formLayProps: {
                        isBtnHidden: true,
                        ...(dialogConfig.formLayout || {}),
                      },
                    },
                  },
                  // Vue 2 函数式 ref：通过 RenderJsx 暴露的 registerRef 注册
                  ref: 'dialogForm',
                })

                // 等组件挂载后，通过 vnode 取到实例并 register
                // 由 RenderJsx 的 onMounted/onUpdated 钩子负责把 componentInstance 写入 currentRef
                if (vnode && (vnode as any).data) {
                  ;(vnode as any).data.hook = (vnode as any).data.hook || {}
                  ;(vnode as any).data.hook.insert = (insertedVnode: any) => {
                    if (insertedVnode.componentInstance) {
                      registerRef('dialogForm', insertedVnode.componentInstance)
                    }
                  }
                }
                return vnode
              }
            : undefined,
        configBtn,
        // useDialog 的 onClosed 通过 extractEventHandlers 转为 'closed' 事件
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
      row: Record<string, unknown>
    ): BtnConfig[] | undefined {
      if (config.isHiddenFooter) return undefined

      if (config.configBtn) {
        return config.configBtn.map((btn) => {
          if (btn.action === 'cancel') {
            return {
              ...btn,
              click: (_: unknown, { close }: any) => {
                emit('dialog-cancel', key)
                close()
              },
            }
          }
          if (btn.action === 'confirm') {
            return {
              ...btn,
              click: async (_: unknown, { close, getRefs }: any) => {
                // 校验失败会 reject（表单已高亮错误）、onConfirm 抛错各自路径已处理；
                // 吞掉以防 EsDialog handleBtnClick 未捕获 click() 返回的 promise → unhandled rejection（对齐 F2）
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
          click: (_: unknown, { close }: any) => {
            emit('dialog-cancel', key)
            close()
          },
        },
        {
          name: '确定',
          type: 'primary',
          click: async (_: unknown, { close, getRefs }: any) => {
            // 校验失败会 reject（表单已高亮错误）、onConfirm 抛错各自路径已处理；
            // 吞掉以防 EsDialog handleBtnClick 未捕获 click() 返回的 promise → unhandled rejection（对齐 F2）
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
      getRefs: (name?: string) => any
    ) {
      if (confirmingKeys.has(key)) return
      confirmingKeys.add(key)
      try {
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
          const legacyKey =
            key === 'add' ? 'add-confirm' : key === 'edit' ? 'edit-confirm' : `${key}-confirm`
          emit('btn-click', legacyKey, formData)
          close()
          refresh()
        }

        emit('dialog-confirm', key, formData)
      } finally {
        confirmingKeys.delete(key)
      }
    }

    // ─── 公共方法 ─────
    function refresh() {
      // 失败已由 es-table 内部 surfaceRequestError + emit('request-error') 暴露，
      // 这里吞掉 rejection 避免 unhandled promise rejection（对齐 vue3）。
      return (tableRef.value as any)?.httpRequestInstance?.()?.catch(() => {})
    }

    function getSelectedRows(): Record<string, unknown>[] {
      return (tableRef.value as any)?.getSelectionRows?.() || []
    }

    const exposed = {
      refresh,
      getSelectedRows,
      tableRef,
      formRef,
      queryModel,
      openDialog,
      closeDialog,
    }

    if (typeof expose === 'function') {
      expose(exposed)
    }

    return {
      // refs（tableRef/formRef/queryModel 由 ...exposed 提供，此处不重复以免键覆盖告警 TS2783）
      tableData,
      paginationState,
      // computeds
      mergedColumns,
      mergedOptions,
      mergedFormBtns,
      formLayoutProps,
      // exposed
      ...exposed,
    }
  },
})
</script>

<style scoped>
.es-crud-page {
  width: 100%;
}
</style>
