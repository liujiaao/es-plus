<template>
  <el-form :ref="setFormRef" v-bind="formProps" class="es-form">
    <div class="flex-center">
      <el-row v-bind="rowLayout">
        <template v-for="(item, index) in formItem" :key="item.prop">
          <el-col v-show="!item?.isFold" :span="item.span">
            <el-form-item
              :label="translateLabel(item)"
              v-bind="initFormItemOptions((item as any).formItemOptions || {})"
              :prop="item.prop"
              @click.stop="() => {}"
            >
              <template v-if="item.formtype">
                <RenderDomForm :row="item" :render="formInputComponents(item)" :index="index" :model="model" />
              </template>
              <template v-else>
                <RenderDomForm :row="item" :render="item.render" :index="index" :model="model" />
              </template>
            </el-form-item>
          </el-col>
        </template>

        <template v-if="!isBtnHidden">
          <template v-if="isRenderBtn">
            <RenderBtn
              :row="{ isFold: isFold, folded, getBtnColSpan, getRowColsAlgorithm, changeFolded, refsForm: formInstance }"
              :form-model="model"
              :form-item-list="formItem"
              :render="(renderBtn as Function)"
            />
          </template>
          <el-col v-else :span="btnColSpanRow ? 24 : getBtnColSpan">
            <div v-if="btnColSpanRow && configBtn.length" class="buttonOperate leftRightBtn">
              <div class="btn-left">
                <el-form-item label-width="0px" class="btn-formItem">
                  <template v-for="(it, inx) in colRightLeftList.colLeftBtn" :key="it.key || inx">
                    <el-button
                      v-if="checkPermission(it.permissionValue)"
                      v-bind="filterOptions(it)"
                      :icon="getCompIcon(it.icon)"
                      :disabled="typeof it.disabled === 'function' ? it.disabled() || false : it.disabled || false"
                      @click="() => it.click(model, refs, getTableInstant?.httpRequestInstance)"
                    >
                      {{ it.name }}
                    </el-button>
                  </template>
                </el-form-item>
              </div>
              <div class="btn-right">
                <el-form-item label-width="0px" class="btn-formItem">
                  <template v-for="(it, inx) in colRightLeftList.colRightBtn" :key="it.key || inx">
                    <el-button
                      v-if="checkPermission(it.permissionValue)"
                      v-bind="filterOptions(it)"
                      :icon="getCompIcon(it.icon)"
                      :disabled="typeof it.disabled === 'function' ? it.disabled() || false : it.disabled || false"
                      @click="() => clickBtn(it)"
                    >
                      {{ it.name }}
                    </el-button>
                  </template>
                  <el-button
                    v-if="isFold"
                    link
                    type="primary"
                    :icon="getCompIcon(folded ? 'ArrowDown' : 'ArrowUp')"
                    style="padding-left: 0; border: none"
                    @click="changeFolded"
                  >
                    {{ folded ? '展开' : '收起' }}
                  </el-button>
                  <el-dropdown placement="bottom-start" v-if="getSetOptionsStatus">
                    <el-button
                      link
                      type="primary"
                      style="margin-left: 2px; margin-right: 5px; outline: none"
                      :icon="getCompIcon('Tools')"
                    />
                    <template #dropdown>
                      <el-dropdown-menu>
                        <el-dropdown-item @click="handleCustomerForm">自定义查询</el-dropdown-item>
                        <el-dropdown-item @click="handleTableItemOption">自定义表格</el-dropdown-item>
                        <el-dropdown-item @click="handleRefresh">重置(刷新)</el-dropdown-item>
                      </el-dropdown-menu>
                    </template>
                  </el-dropdown>
                </el-form-item>
              </div>
            </div>
            <el-form-item
              v-if="!btnColSpanRow && configBtn.length"
              :label="' '"
              :label-width="(formProps as any).labelBtnWidth ? (formProps as any).labelBtnWidth : (formProps as any).labelWidth"
              :class="{ formItemCols: btnColSpanRow ? true : getBtnColSpan === 24 }"
              class="btn-formItem"
            >
              <div class="buttonOperate" :style="{ 'text-align': getBtnColSpan === 24 ? 'right' : 'left' }">
                <template v-if="configBtn.length">
                  <template v-for="(it, inx) in configBtn" :key="it.key || inx">
                    <el-button
                      v-if="checkPermission(it.permissionValue)"
                      v-bind="filterOptions(it)"
                      :icon="getCompIcon(it.icon)"
                      :disabled="typeof it.disabled === 'function' ? it.disabled() || false : it.disabled || false"
                      @click="() => it?.click(model, refs, getTableInstant?.httpRequestInstance)"
                    >
                      {{ it.name }}
                    </el-button>
                  </template>
                </template>
                <el-button
                  v-if="isFold"
                  type="primary"
                  link
                  :icon="getCompIcon(folded ? 'ArrowDown' : 'ArrowUp')"
                  style="padding-left: 0; border: none"
                  @click="changeFolded"
                >
                  {{ folded ? '展开' : '收起' }}
                </el-button>
                <el-dropdown placement="bottom-start" v-if="getSetOptionsStatus">
                  <el-button
                    link
                    type="primary"
                    style="margin-left: 2px; margin-right: 5px; outline: none"
                    :icon="getCompIcon('Tools')"
                  />
                  <template #dropdown>
                    <el-dropdown-menu>
                      <el-dropdown-item @click="handleCustomerForm">自定义查询</el-dropdown-item>
                      <el-dropdown-item @click="handleTableItemOption">自定义表格</el-dropdown-item>
                      <el-dropdown-item @click="handleRefresh">重置(刷新)</el-dropdown-item>
                    </el-dropdown-menu>
                  </template>
                </el-dropdown>
              </div>
            </el-form-item>
          </el-col>
        </template>
      </el-row>
    </div>
  </el-form>
</template>

<script lang="ts">
export default { name: 'EsForm' }
</script>

<script setup lang="ts">
import { ref, computed, watch, inject, getCurrentInstance, nextTick, h, defineComponent } from 'vue'
import {
  ElRow,
  ElCol,
  ElFormItem,
  ElForm,
  ElButton,
  ElDropdownMenu,
  ElDropdownItem,
  ElDropdown,
  ElInput
} from 'element-plus'
import * as ElementPlusIconsVue from '@element-plus/icons-vue'
import { useFormInputs } from '../../../composables/use-form-inputs'
import { useFormLayout } from '../../../composables/use-form-layout'
import { useFormRequest } from '../../../composables/use-form-request'
import { isObject } from '../../../utils/shared'
import { getGlobalConfig } from '../../../config'
import useDialog from '../../es-dialog/src/use-dialog'
import EsTable from '../../es-table'
import type { FormItemOption, BtnConfig, LayoutFormProps } from '../../../types'

const props = withDefaults(
  defineProps<{
    model: Record<string, unknown>
    formItemList: FormItemOption[]
    layoutFormProps?: LayoutFormProps
    configBtn?: BtnConfig[]
    renderBtn?: Function | boolean
    btnColSpanRow?: boolean
    rules?: Record<string, unknown>
    fieldFieldOutput?: (defaults: Record<string, string>) => Record<string, string>
  }>(),
  {
    model: () => ({}),
    formItemList: () => [],
    layoutFormProps: () => ({}),
    configBtn: () => [],
    renderBtn: false,
    btnColSpanRow: true,
    rules: () => ({})
  }
)

const emit = defineEmits<{
  confirm: [formRef: unknown, model: Record<string, unknown>]
  reset: [formRef: unknown, model: Record<string, unknown>]
}>()

const instance = getCurrentInstance()
const $esPlusForm = inject<Record<string, unknown>>('$esPlusForm', null) ?? getGlobalConfig().EsForm ?? {}
const esPlus = inject<Record<string, unknown>>('$EsPlus', null) ?? getGlobalConfig() ?? {}

const checkPermission = (pvalue?: string): boolean => {
  if (!pvalue) return true
  const fn = esPlus.permission
  return typeof fn === 'function' ? (fn as (v: string) => boolean)(pvalue) : true
}

const translateLabel = (item: FormItemOption): string => {
  if (item.labelKey && typeof esPlus.t === 'function') {
    return (esPlus.t as (k: string) => string)(item.labelKey)
  }
  return item.label
}

// 保留与 Table 的耦合（同时支持 inject 和 instance.ctx 两种获取方式）
const injectedTableInstant = inject<(() => any) | null>('getTableInstantce', null)
const getTableInstant = computed(() => {
  if (injectedTableInstant) {
    return typeof injectedTableInstant === 'function' ? injectedTableInstant() : injectedTableInstant
  }
  const ctx = (instance as any)?.ctx as Record<string, any>
  return typeof ctx?.getTableInstantce === 'function' ? ctx?.getTableInstantce() : ctx?.getTableInstantce
})

const isParentTable = computed(() => {
  return !!(getTableInstant.value && Object.keys(getTableInstant.value).length)
})

// 图标扩展
const extendedIcon = Object.fromEntries(Object.entries(ElementPlusIconsVue))
const getCompIcon = (key?: string) => (key ? extendedIcon[key] || key : undefined)
const filterOptions = (it: BtnConfig) => {
  const { icon, ...opt } = it as Record<string, unknown>
  if (!opt.size) opt.size = 'small'
  return opt
}

// Refs
const refs = ref<unknown>(null)
const formInstance = ref<Record<string, unknown>>({})
const formItemRowsList = ref<FormItemOption[]>(props.formItemList)

const setFormRef = (el: unknown) => {
  if (el) refs.value = el
}

// Composables
const { formInputComponents } = useFormInputs()
const httpRequestGlobal = ($esPlusForm?.$httpRequest as (params: Record<string, unknown>) => Promise<unknown>) || undefined
const fieldFieldOutputGlobal = (props.fieldFieldOutput || $esPlusForm?.fieldFieldOutput) as ((defaults: Record<string, string>) => Record<string, string>) | undefined
const { getEveryFormQueryField } = useFormRequest(httpRequestGlobal)

// Break circular dependency: formLayoutRef is populated after useFormLayout
const formLayoutRef = ref<Record<string, unknown>>(props.layoutFormProps?.fromLayProps || {})
const formProps = computed(() => ({
  size: 'small' as const,
  ...formLayoutRef.value,
  model: props.model,
  rules: props.rules,
  validateOnRuleChange: false
}))

// 缓存已加载数据的表单项 prop，避免 computed 重新计算时重复调用接口
const loadedApiProps = ref<Set<string>>(new Set())

watch(
  () => props.formItemList,
  async (val) => {
    const list = Array.isArray(val) ? val : []
    // 只加载 isInitRun !== false 且尚未加载过数据的表单项
    const needLoadList = list.filter((it) => it && it.isInitRun !== false && !loadedApiProps.value.has(it.prop))
    if (!needLoadList.length) {
      // 无新表单项需要加载，保留已有的 dataOptions
      formItemRowsList.value = list.map((it) => {
        if (!it) return null
        const existing = formItemRowsList.value.find((old) => old && old.prop === it.prop)
        return existing?.dataOptions?.length ? { ...it, dataOptions: existing.dataOptions } : it
      }).filter((it): it is FormItemOption => !!it)
      return
    }
    const rows = await getEveryFormQueryField(needLoadList, fieldFieldOutputGlobal)
    // 标记已加载的 prop
    needLoadList.forEach((it) => loadedApiProps.value.add(it.prop))
    formItemRowsList.value = list
      .map((it) => {
        if (!it) return null
        const resultApiOption = rows.find((item) => item && item.prop === it.prop)
        const existing = formItemRowsList.value.find((old) => old && old.prop === it.prop)
        // 优先使用新加载的数据，其次保留已有数据
        if (resultApiOption) return { ...it, dataOptions: resultApiOption.listData }
        if (existing?.dataOptions?.length) return { ...it, dataOptions: existing.dataOptions }
        return it
      })
      .filter((it): it is FormItemOption => !!it)
  },
  { immediate: true, deep: true }
)

const formItemListFilter = computed(() => {
  const list = formItemRowsList.value || []
  const visible = list
    .map((it) => (it ? { ...it, dataOptions: it.dataOptions || [] } : null))
    .filter((it): it is (FormItemOption & { dataOptions: Array<{ label: string; value: unknown }> }) => {
      if (!it) return false
      if (it.isHidden && typeof it.isHidden === 'function') {
        return !it.isHidden(props.model, it, formProps.value)
      }
      return true
    })

  const itemsWithoutSpan = visible.filter((it) => !it.span)
  const autoCount = itemsWithoutSpan.length
  let autoSpan = 6
  if (autoCount > 0) {
    const fixedTotal = visible.reduce((sum, it) => sum + (it.span || 0), 0)
    const remaining = 24 - (fixedTotal % 24 || (fixedTotal ? 24 : 0))
    if (fixedTotal === 0) {
      if (autoCount === 1) autoSpan = 24
      else if (autoCount === 2) autoSpan = 12
      else if (autoCount === 3) autoSpan = 8
      else autoSpan = 6
    } else {
      autoSpan = remaining >= autoCount ? Math.floor(remaining / autoCount) : 6
      if (autoSpan > 12) autoSpan = 12
      if (autoSpan < 4) autoSpan = 6
    }
  }

  return visible.map((it) => ({ ...it, span: it.span || autoSpan })) as (FormItemOption & { span: number; dataOptions: Array<{ label: string; value: unknown }> })[]
})

const {
  folded,
  isBtnHidden,
  rowLayout,
  formLayout,
  getSetOptionsStatus,
  getRowColsAlgorithm,
  isFold,
  getBtnColSpan,
  formItem,
  changeFolded
} = useFormLayout({
  layoutFormProps: props.layoutFormProps,
  get formItemList() { return formItemListFilter.value }
})

watch(
  formLayout,
  (val) => {
    formLayoutRef.value = val
  },
  { immediate: true }
)

const colRightLeftList = computed(() => ({
  colRightBtn: props.configBtn.filter((it) => it.direction === 'right' || !it.direction),
  colLeftBtn: props.configBtn.filter((it) => it.direction === 'left')
}))

const isRenderBtn = computed(() => typeof props.renderBtn === 'function')

const clickBtn = async (it: BtnConfig) => {
  if (it.triggerEvent && ['query', 'rest'].includes(it.key || '')) {
    queryTableRequest(props.model, refs.value as any, it.key)
  } else {

     // await refs.value.validate()
     if (it.key === 'rest' && refs.value) {
         ;(refs.value as any).resetFields()
      }
    it.click?.(props.model, refs.value, getTableInstant.value?.httpRequestInstance)
  }
}

const queryTableRequest = async (model: Record<string, unknown>, formRef: { resetFields: () => void; validate: () => Promise<boolean> } | null, key?: string) => {
  if (key === 'query') {
    if (isParentTable.value) {
      getTableInstant.value?.httpRequestInstance?.(model)
    }
    //  else if (formRef) {
    //   await formRef.validate()
    // }
  } else if (key === 'rest' && formRef) {
        if (isParentTable.value) {
      getTableInstant.value?.httpRequestInstance?.(model)
    }
    formRef.resetFields()
  }
}

const initFormItemOptions = (opts: Record<string, unknown>) => {
  if (isParentTable.value) {
    const { style, ...rest } = opts
    return { style: { marginBottom: '10px', ...(style as Record<string, unknown>) }, ...rest }
  }
  return opts
}

const confirm = () => emit('confirm', refs.value, props.model)
const reset = () => emit('reset', refs.value, props.model)

// 自定义弹窗
const createDialogInstance = (() =>
  (instance as any)?.ctx?.dialogInstance ? (instance as any).ctx.dialogInstance() : useDialog)()
const customerForm = createDialogInstance()
const customerTable = createDialogInstance()

const handleRefresh = () => {
  // 保留原有逻辑
}

const getFormRowsFun = () => {
  return {
    data: formItemRowsList.value.map((it) => ({
      ...it,
      label: it.label,
      prop: it.prop,
      isHidden: !!it.isHidden,
      width: it.width
    })),
    columns: [
      { type: 'selection', width: 50 },
      { label: '名称(列)', key: 'label' },
      { label: '属性(Key)', key: 'prop' },
      {
        label: '列宽',
        width: 180,
        render: (_text: unknown, row: Record<string, unknown>) => {
          return h('div', [
            h(ElInput, {
              size: 'small',
              maxlength: 3,
              formatter: (value: string) => value.replace(/^0|[^0-9]/g, ''),
              modelValue: row.width as any,
              'onUpdate:modelValue': (val: unknown) => {
                row.width = val
              }
            }, {
              prepend: () => '宽度',
              append: () => 'px'
            })
          ])
        }
      }
    ]
  }
}

const getCustomerTableInfo = () => {
  return {
    dataSource: [],
    columns: [
      { type: 'selection', width: 50 },
      { label: '名称(列)', key: 'label' },
      { label: '属性(Key)', key: 'tableProp' },
      {
        label: '列宽',
        width: 180,
        render: (_text: unknown, row: Record<string, unknown>) => {
          return h('div', [
            h(ElInput, {
              size: 'small',
              maxlength: 3,
              formatter: (value: string) => value.replace(/^0|[^0-9]/g, ''),
              modelValue: row.width as any,
              'onUpdate:modelValue': (val: unknown) => {
                row.width = val
              }
            }, {
              prepend: () => '宽度',
              append: () => 'px'
            })
          ])
        }
      }
    ]
  }
}

const handleCustomerForm = () => {
  const formRows = getFormRowsFun()
  customerForm({
    title: '自定义查询',
    width: '800px',
    isDraggable: true,
    render: () =>
      h(EsTable, {
        dataSource: formRows.data,
        columns: formRows.columns,
        options: {
          multiSelect: true,
          expand: false,
          snIndex: false,
          loading: false,
          border: true,
          size: 'small'
        },
        pagination: {
          pageSize: 10,
          current: 1,
          total: formRows.data?.length || 0
        }
      }),
    configBtn: [
      {
        name: '取消',
        icon: 'Close',
        click: (_instance: unknown, { close }: { close: () => void }) => close()
      },
      {
        name: '确认',
        type: 'primary',
        icon: 'Check',
        click: (_instance: unknown, { close }: { close: () => void }) => close()
      }
    ]
  })
}

const handleTableItemOption = () => {
  const formRows = getCustomerTableInfo()
  customerTable({
    title: '自定义表格',
    width: '800px',
    render: () =>
      h(EsTable, {
        dataSource: formRows.dataSource,
        columns: formRows.columns
      })
  })
}

// 生命周期
nextTick(() => {
  formInstance.value = refs.value as Record<string, unknown>
  ;((instance as any)?.ctx as Record<string, any>)?.bodyFormInstance?.(formInstance.value)
})

// 子组件定义
const RenderBtn = defineComponent({
  props: {
    row: Object,
    formItemList: Array,
    formModel: Object,
    render: Function,
    ellipsis: Boolean
  },
  setup(props) {
    return () => {
      const { formItemList, formModel, row } = props
      const renderContent = props.render?.(row, formModel, formItemList, h) || ''
      return typeof renderContent === 'string' ? h('span', renderContent) : renderContent
    }
  }
})

const RenderDomForm = defineComponent({
  props: {
    row: Object,
    index: Number,
    datakey: String,
    render: Function,
    model: Object,
    ellipsis: Boolean
  },
  setup(props) {
    return () => {
      const { row, index, model } = props
      const renderContent = props.render?.(h, model, { row, index }) || ''
      return typeof renderContent === 'string' ? h('span', renderContent) : renderContent
    }
  }
})

// 暴露给外部的方法，用于手动触发指定表单项的请求
const formItmeRequestInstance = async (propsList: string[]) => {
  const list = formItemListFilter.value
  const targetItems = list.filter((it) => it && propsList.includes(it.prop))
  if (!targetItems.length) return

  const rows = await getEveryFormQueryField(targetItems, fieldFieldOutputGlobal)
  rows.forEach((resultApiOption) => {
    if (!resultApiOption) return
    const itemIndex = formItemRowsList.value.findIndex((it) => it && it.prop === resultApiOption.prop)
    if (itemIndex !== -1) {
      formItemRowsList.value[itemIndex] = {
        ...formItemRowsList.value[itemIndex],
        dataOptions: resultApiOption.listData as Array<{ label: string; value: unknown }>
      }
    }
  })
}

// 暴露组件实例方法
const getFormRef = () => refs.value as { validate: () => Promise<boolean>; resetFields: () => void; clearValidate: (props?: string | string[]) => void; validateField: (props: string | string[]) => Promise<boolean>; scrollToField: (prop: string) => void }

defineExpose({
  formItmeRequestInstance,
  getFormRef,
  validate: () => getFormRef()?.validate(),
  resetFields: () => getFormRef()?.resetFields(),
  clearValidate: (props?: string | string[]) => getFormRef()?.clearValidate(props),
  validateField: (props: string | string[]) => getFormRef()?.validateField(props),
  scrollToField: (prop: string) => getFormRef()?.scrollToField(prop)
})
</script>

<style lang="scss" scoped>
.es-form {
  :deep(.el-form-item) {
    margin-bottom: 18px;
  }

  :deep(.el-form-item__label) {
    font-weight: 500;
  }

  .buttonOperate {
    display: flex;
    align-items: center;
    flex-wrap: wrap;
    gap: 8px;
  }

  .leftRightBtn {
    display: flex;
    justify-content: space-between;
    align-items: center;
    width: 100%;

    .btn-left,
    .btn-right {
      display: flex;
      align-items: center;
    }
  }

  .btn-formItem {
    margin-bottom: 0;
  }

  .formItemCols {
    width: 100%;
  }
}
</style>
