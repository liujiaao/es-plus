<template>
  <div class="es-crud-page">
    <!--
      Vue 3 → Vue 2 关键差异：
        - v-model:data-source → :data-source.sync
        - v-model:pagination → :pagination.sync
      Vue 2.3+ 支持 .sync 修饰符自动展开为 :data-source + @update:data-source
    -->
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
import { defineComponent, ref, reactive, computed, watch } from '../../vue-compat'
import { MessageBox } from 'element-ui'
import EsForm from '../es-form/es-form.vue'
import EsTable from '../es-table/component.vue'
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
  components: { EsForm, EsTable },
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
  setup(props, { emit, expose }) {
    const tableRef = ref<any>(null)
    const formRef = ref<any>(null)
    const tableData = ref<Record<string, unknown>[]>([])
    const queryModel = reactive<Record<string, unknown>>({})

    // 同步 schema.formItems → queryModel 默认字段
    watch(
      () => props.schema.formItems,
      (items) => {
        if (items) {
          items.forEach((item) => {
            if (item.prop && !(item.prop in queryModel)) {
              ;(queryModel as Record<string, unknown>)[item.prop as string] = ''
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
        code: btn.code || 1,
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
            ;(formData as Record<string, unknown>)[item.prop] =
              row?.[item.prop] ?? ''
          }
        })
      }

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
          dialogInstances.delete(key)
          dialogConfig.onClose?.()
        },
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
          click: (_: unknown, { close }: any) => {
            emit('dialog-cancel', key)
            close()
          },
        },
        {
          name: '确定',
          type: 'primary',
          click: async (_: unknown, { close, getRefs }: any) => {
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
      getRefs: (name?: string) => any
    ) {
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
    }

    // ─── 公共方法 ─────
    function refresh() {
      ;(tableRef.value as any)?.httpRequestInstance?.()
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
      // refs
      tableRef,
      formRef,
      tableData,
      queryModel,
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
