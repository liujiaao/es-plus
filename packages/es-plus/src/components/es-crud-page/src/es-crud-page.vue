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
        :config-btn="mergedQueryBtns"
      />
      <template v-for="(_, name) in $slots" #[name]="slotData">
        <slot :name="name" v-bind="slotData || {}" />
      </template>
    </es-table>
  </div>
</template>

<script setup lang="ts">
import { ref, reactive, computed, watch } from 'vue'
import EsForm from '../../es-form/src/es-form.vue'
import EsTable from '../../es-table/src/component.vue'
import useDialog from '../../es-dialog/src/use-dialog'
import type { CrudPageSchema, CrudAction } from './types'
import type { BtnConfig, TableColumn } from '../../../types'

defineOptions({ name: 'EsCrudPage' })

const props = withDefaults(
  defineProps<{
    schema: CrudPageSchema
    httpRequest?: (params: Record<string, unknown>) => Promise<unknown>
    autoLoad?: boolean
  }>(),
  {
    autoLoad: true
  }
)

const emit = defineEmits<{
  'query': [model: Record<string, unknown>]
  'add': []
  'edit': [row: Record<string, unknown>]
  'delete': [row: Record<string, unknown>]
  'view': [row: Record<string, unknown>]
  'export': [model: Record<string, unknown>]
  'row-click': [row: Record<string, unknown>]
  'btn-click': [key: string, row?: Record<string, unknown>]
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

const actions = computed<CrudAction[]>(() => props.schema.actions || ['add', 'edit', 'delete'])

const mergedQueryBtns = computed<BtnConfig[]>(() => {
  if (props.schema.queryBtns) return props.schema.queryBtns

  const btns: BtnConfig[] = [
    { name: '查询', type: 'primary', key: 'query', triggerEvent: true },
    { name: '重置', key: 'rest', triggerEvent: true },
  ]
  if (actions.value.includes('add')) {
    btns.push({
      name: '新增',
      type: 'primary',
      key: 'add',
      icon: 'Plus',
      click: () => handleAdd()
    })
  }
  if (actions.value.includes('export')) {
    btns.push({
      name: '导出',
      key: 'export',
      icon: 'Download',
      click: () => emit('export', { ...queryModel })
    })
  }
  return btns
})

const mergedColumns = computed<TableColumn[]>(() => {
  const cols = [...(props.schema.columns || [])]

  const hasActionCol = cols.some((c) => c.prop === 'action' || c.btns)
  if (!hasActionCol && actions.value.some((a) => ['edit', 'delete', 'view'].includes(a))) {
    const actionBtns: any[] = []
    if (actions.value.includes('view')) {
      actionBtns.push({ name: '查看', type: 'primary', clickEvent: (row: any) => handleView(row) })
    }
    if (actions.value.includes('edit')) {
      actionBtns.push({ name: '编辑', type: 'primary', clickEvent: (row: any) => handleEdit(row) })
    }
    if (actions.value.includes('delete')) {
      actionBtns.push({ name: '删除', type: 'danger', clickEvent: (row: any) => handleDelete(row) })
    }
    cols.push({
      prop: 'action',
      label: '操作',
      width: actionBtns.length * 80 + 20,
      fixed: 'right',
      btns: actionBtns
    })
  }
  return cols
})

const mergedOptions = computed(() => {
  const base: Record<string, unknown> = {
    border: true,
    isInitRun: props.autoLoad,
    ...(props.schema.tableOptions || {})
  }
  if (props.httpRequest) {
    base.httpRequest = props.httpRequest
  }
  const hasHttp = base.httpRequest && typeof base.httpRequest === 'function'
  if (hasHttp && !base.apiParams && !base.actionUrl) {
    base.apiParams = { url: '/crud-page', method: 'GET' }
  }
  return base
})

function handleAdd() {
  if (props.schema.dialogFormItems?.length) {
    openFormDialog('新增', {})
  }
  emit('add')
}

function handleEdit(row: Record<string, unknown>) {
  if (props.schema.dialogFormItems?.length) {
    openFormDialog('编辑', { ...row })
  }
  emit('edit', row)
}

function handleDelete(row: Record<string, unknown>) {
  emit('delete', row)
}

function handleView(row: Record<string, unknown>) {
  emit('view', row)
}

function openFormDialog(title: string, row: Record<string, unknown>) {
  const dialog = useDialog()
  const formData = reactive<Record<string, unknown>>({})

  props.schema.dialogFormItems?.forEach((item) => {
    if (item.prop) {
      formData[item.prop] = row[item.prop] ?? ''
    }
  })

  const dialogWidth = props.schema.dialogOptions?.width || '600px'

  dialog({
    title,
    width: dialogWidth,
    ...(props.schema.dialogOptions || {}),
    render: (h: any, { registerRef }: any) => {
      return h(EsForm, {
        ref: (el: any) => el && registerRef('dialogForm', el),
        model: formData,
        formItemList: props.schema.dialogFormItems,
        layoutFormProps: {
          rowLayProps: { gutter: 16 },
          fromLayProps: { isBtnHidden: true }
        }
      })
    },
    configBtn: [
      {
        name: '取消',
        click: (_: any, { close }: any) => close()
      },
      {
        name: '确定',
        type: 'primary',
        click: async (_: any, { close, getRefs }: any) => {
          const dialogForm = getRefs('dialogForm')
          if (dialogForm?.validate) {
            await dialogForm.validate()
          }
          emit('btn-click', title === '新增' ? 'add-confirm' : 'edit-confirm', formData)
          close()
          refresh()
        }
      }
    ]
  })
}

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
  queryModel
})
</script>

<style scoped>
.es-crud-page {
  width: 100%;
}
</style>
