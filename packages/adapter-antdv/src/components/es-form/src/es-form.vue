<!--
  ADV 适配器：EsForm 动态表单组件（对齐 @es-plus/vue3 API）

  Ant Design Vue 版，与 vue3 结构对齐：
  - a-form / a-form-item / a-row / a-col / a-button / a-space / a-dropdown
  - 表单字段用 name 做校验字段标识（EP 用 prop）
  - 标签宽度通过 labelCol 控制
  - btnColSpanRow 左右分栏 / 单行两种按钮布局
  - setOptions 下拉（自定义查询/自定义表格/重置刷新）
  - 查询/重置由 EsForm 内部 triggerEvent 联动表格（单次请求），不 emit confirm/reset
-->
<template>
  <a-form :ref="setFormRef" v-bind="formProps" class="es-form">
    <a-row v-bind="rowLayout">
      <template v-for="(item, index) in formItem" :key="item.prop || index">
        <a-col
          :span="item.span"
          :class="{ 'es-col--foldable': item?.isFold !== undefined, 'is-folded': item?.isFold && folded }"
        >
          <a-form-item
            :name="item.prop"
            :label="translateLabel(item)"
            :labelCol="labelColStyle"
            :wrapperCol="wrapperColStyle"
            v-bind="initFormItemOptions((item as any).formItemOptions || {})"
            @click.stop="() => {}"
          >
            <template v-if="item.formtype">
              <RenderDomForm :row="item" :render="formInputRenderer(item)" :index="index" :model="model" />
            </template>
            <template v-else>
              <RenderDomForm :row="item" :render="item.render" :index="index" :model="model" />
            </template>
          </a-form-item>
        </a-col>
      </template>

      <!-- 按钮区域 -->
      <template v-if="!isBtnHidden">
        <template v-if="isRenderBtn">
          <RenderBtn
            :row="{ isFold: isFold, folded, getBtnColSpan, getRowColsAlgorithm, changeFolded, refsForm: formRef }"
            :form-model="model"
            :form-item-list="formItem"
            :render="(renderBtn as Function)"
          />
        </template>
        <a-col v-else :span="btnColSpanRow ? 24 : getBtnColSpan">
          <!-- btnColSpanRow：左右分栏布局 -->
          <div v-if="btnColSpanRow && configBtn.length" class="buttonOperate leftRightBtn">
            <div class="btn-left">
              <a-form-item :labelCol="{ style: { width: '0px' } }" class="btn-formItem">
                <a-space :size="8" wrap>
                  <a-button
                    v-for="(it, inx) in colRightLeftList.colLeftBtn"
                    v-show="checkPermission(it.permissionValue)"
                    :key="it.key || inx"
                    v-bind="filterOptions(it)"
                    :type="mapBtnType(it.type)"
                    :size="mapBtnSize(it.size)"
                    :disabled="resolveBtnDisabled(it)"
                    :loading="it.loading"
                    @click="() => it.click?.(model, formRef, getTableInstant?.httpRequestInstance)"
                  >
                    <template #icon v-if="it.icon">
                      <component :is="getAdvIconComponent(it.icon)" />
                    </template>
                    {{ it.name }}
                  </a-button>
                </a-space>
              </a-form-item>
            </div>
            <div class="btn-right">
              <a-form-item :labelCol="{ style: { width: '0px' } }" class="btn-formItem">
                <a-space :size="8" wrap>
                  <a-button
                    v-for="(it, inx) in colRightLeftList.colRightBtn"
                    v-show="checkPermission(it.permissionValue)"
                    :key="it.key || inx"
                    v-bind="filterOptions(it)"
                    :type="mapBtnType(it.type)"
                    :size="mapBtnSize(it.size)"
                    :disabled="resolveBtnDisabled(it)"
                    :loading="it.loading"
                    @click="() => clickBtn(it)"
                  >
                    <template #icon v-if="it.icon">
                      <component :is="getAdvIconComponent(it.icon)" />
                    </template>
                    {{ it.name }}
                  </a-button>
                  <!-- 折叠按钮 -->
                  <a-button
                    v-if="isFold"
                    type="link"
                    @click="changeFolded"
                  >
                    {{ folded ? '展开' : '收起' }}
                    <DownOutlined v-if="folded" />
                    <UpOutlined v-else />
                  </a-button>
                  <!-- setOptions 下拉 -->
                  <a-dropdown v-if="getSetOptionsStatus" placement="bottomLeft">
                    <a-button type="link">
                      <template #icon><component :is="getAdvIconComponent('Tools')" /></template>
                    </a-button>
                    <template #overlay>
                      <a-menu @click="handleSetOptionsClick">
                        <a-menu-item key="customerForm">自定义查询</a-menu-item>
                        <a-menu-item key="tableItem">自定义表格</a-menu-item>
                        <a-menu-item key="refresh">重置(刷新)</a-menu-item>
                      </a-menu>
                    </template>
                  </a-dropdown>
                </a-space>
              </a-form-item>
            </div>
          </div>
          <!-- 非 btnColSpanRow：单行按钮布局 -->
          <a-form-item
            v-else-if="configBtn.length"
            :label="' '"
            :labelCol="{ style: { width: labelBtnWidth || 'auto' } }"
            :class="{ formItemCols: getBtnColSpan === 24 }"
            class="btn-formItem"
          >
            <div class="buttonOperate" :style="{ textAlign: getBtnColSpan === 24 ? 'right' : 'left' }">
              <a-space :size="8" wrap>
                <a-button
                  v-for="(it, inx) in configBtn"
                  v-show="checkPermission(it.permissionValue)"
                  :key="it.key || inx"
                  v-bind="filterOptions(it)"
                  :type="mapBtnType(it.type)"
                  :size="mapBtnSize(it.size)"
                  :disabled="resolveBtnDisabled(it)"
                  :loading="it.loading"
                  @click="() => it.click?.(model, formRef, getTableInstant?.httpRequestInstance)"
                >
                  <template #icon v-if="it.icon">
                    <component :is="getAdvIconComponent(it.icon)" />
                  </template>
                  {{ it.name }}
                </a-button>
                <a-button
                  v-if="isFold"
                  type="link"
                  @click="changeFolded"
                >
                  {{ folded ? '展开' : '收起' }}
                  <DownOutlined v-if="folded" />
                  <UpOutlined v-else />
                </a-button>
                <a-dropdown v-if="getSetOptionsStatus" placement="bottomLeft">
                  <a-button type="link">
                    <template #icon><component :is="getAdvIconComponent('Tools')" /></template>
                  </a-button>
                  <template #overlay>
                    <a-menu @click="handleSetOptionsClick">
                      <a-menu-item key="customerForm">自定义查询</a-menu-item>
                      <a-menu-item key="tableItem">自定义表格</a-menu-item>
                      <a-menu-item key="refresh">重置(刷新)</a-menu-item>
                    </a-menu>
                  </template>
                </a-dropdown>
              </a-space>
            </div>
          </a-form-item>
        </a-col>
      </template>
    </a-row>
  </a-form>
</template>

<script lang="ts">
export default { name: 'EsForm' }
</script>

<script setup lang="ts">
import { ref, computed, watch, inject, getCurrentInstance, nextTick, h, defineComponent } from 'vue'
import type { VNode } from 'vue'
// 本地导入并按模板标签命名（AForm↔<a-form> 等），使模板解析为直接组件引用而非全局 resolveComponent。
// 对齐 @es-plus/vue3（其 EsForm 直接 import ElForm/ElFormItem…），确保在 useDialog 命令式渲染的
// 脱离子树（appContext 为 null，全局注册不可见）中仍能正常解析。Input 供脚本内 h(Input) 使用。
import {
  Form as AForm,
  FormItem as AFormItem,
  Row as ARow,
  Col as ACol,
  Button as AButton,
  Space as ASpace,
  Dropdown as ADropdown,
  Menu as AMenu,
  MenuItem as AMenuItem,
  Input,
} from 'ant-design-vue'
import { DownOutlined, UpOutlined } from '@ant-design/icons-vue'
import { getGlobalConfig } from '../../../config'
import { useFormInputs } from '../../../composables/use-form-inputs'
import { useFormLayout } from '../../../composables/use-form-layout'
import { useFormRequest } from '../../../composables/use-form-request'
import { resolveFormLayProps, TABLE_CONTEXT_INJECT_KEY } from '@es-plus/core'
import { mapButtonType, mapSize, getNestedValue } from '../../../utils/shared'
import { getAdvIconComponent } from '../../../utils/icon'
import useDialog from '../../es-dialog/src/use-dialog'
import EsTable from '../../es-table'
import type { FormItemOption, BtnConfig, LayoutFormProps } from '../../../types'

// ─── Props（对齐 vue3，无 formProps prop）─────────────
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
    rules: () => ({}),
  },
)

const emit = defineEmits<{
  confirm: [formRef: unknown, model: Record<string, unknown>]
  reset: [formRef: unknown, model: Record<string, unknown>]
}>()

const instance = getCurrentInstance()
const $esPlusForm = inject<Record<string, unknown> | null>('$esPlusForm', null) ?? getGlobalConfig().EsForm ?? {}
const esPlus = inject<Record<string, unknown> | null>('$EsPlus', null) ?? getGlobalConfig() ?? {}

// ─── 权限 ───────────────────────────────────────────
const checkPermission = (pvalue?: string): boolean => {
  if (!pvalue) return true
  const fn = esPlus.permission
  return typeof fn === 'function' ? (fn as (v: string) => boolean)(pvalue) : true
}

// ─── 国际化 ─────────────────────────────────────────
const translateLabel = (item: FormItemOption): string => {
  if (item.labelKey && typeof esPlus.t === 'function') {
    return (esPlus.t as (k: string) => string)(item.labelKey)
  }
  return item.label
}

// ─── 与 Table 的耦合（inject + ctx 双路径，对齐 vue3）──
const injectedTableInstant = inject<(() => any) | null>(TABLE_CONTEXT_INJECT_KEY, null)
const getTableInstant = computed(() => {
  if (injectedTableInstant) {
    return typeof injectedTableInstant === 'function' ? injectedTableInstant() : injectedTableInstant
  }
  const ctx = (instance as any)?.ctx as Record<string, any>
  return typeof ctx?.getTableInstance === 'function' ? ctx?.getTableInstance() : ctx?.getTableInstance
})

const isParentTable = computed(() => {
  return !!(getTableInstant.value && Object.keys(getTableInstant.value).length)
})

// ─── 图标 / 按钮选项（对齐 vue3）─────────────────────
const filterOptions = (it: BtnConfig) => {
  const { icon, ...opt } = it as Record<string, unknown>
  if (!opt.size) opt.size = 'small'
  return opt
}

const resolveBtnDisabled = (it: BtnConfig): boolean => {
  return typeof it.disabled === 'function' ? it.disabled() || false : it.disabled || false
}

function mapBtnType(type?: string): string {
  return mapButtonType(type)
}

function mapBtnSize(size?: string): string {
  return mapSize(size || (formLayout.value.size as string) || 'small', 'small')
}

// ─── Refs ───────────────────────────────────────────
const formRef = ref<unknown>(null)
const formInstance = ref<Record<string, unknown>>({})
const formItemRowsList = ref<FormItemOption[]>(props.formItemList)

const setFormRef = (el: unknown) => {
  if (el) formRef.value = el
}

// ─── Composables ────────────────────────────────────
const { formInputComponents } = useFormInputs()

const httpRequestGlobal = ($esPlusForm?.$httpRequest as (params: Record<string, unknown>) => Promise<unknown>) || undefined
const fieldFieldOutputGlobal = (props.fieldFieldOutput || $esPlusForm?.fieldFieldOutput) as
  | ((defaults: Record<string, string>) => Record<string, string>)
  | undefined
const { getEveryFormQueryField } = useFormRequest(httpRequestGlobal)

function formInputRenderer(item: FormItemOption) {
  return formInputComponents(item)
}

// ─── 表单 Props（对齐 vue3：内联 model/rules）────────
const formLayoutRef = ref<Record<string, unknown>>(resolveFormLayProps(props.layoutFormProps) as Record<string, unknown>)

const formProps = computed(() => ({
  size: 'small' as const,
  ...formLayoutRef.value,
  model: props.model,
  rules: props.rules,
  validateOnRuleChange: false,
}))

const labelColStyle = computed(() => {
  // 未配置 labelWidth 时，标签宽度取内容自适应（flex: 0 0 auto），对齐 @es-plus/vue3。
  // vue3 用 Element Plus，el-form 无 label-width 即为标签内容宽度；此前 antdv 硬编码 100px 固定标签，
  // 在弹窗窄列（span=8 ≈ 1/3）下会挤占输入框，导致表单项无法自动分配宽度。
  const w = (formLayoutRef.value.labelWidth as string | number) || (formLayout.value.labelWidth as string | number)
  if (w === undefined || w === null || w === '') return { flex: '0 0 auto' }
  const width = typeof w === 'number' ? `${w}px` : String(w)
  return { flex: `0 0 ${width}` }
})

const wrapperColStyle = computed(() => {
  return { flex: 'auto' }
})

// ─── 远程选项加载（缓存已加载 prop，对齐 vue3）────────
const loadedApiProps = ref<Set<string>>(new Set())

watch(
  () => props.formItemList,
  async (val) => {
    const list = Array.isArray(val) ? val : []
    const needLoadList = list.filter((it) => it && it.isInitRun !== false && !loadedApiProps.value.has(it.prop))
    if (!needLoadList.length) {
      formItemRowsList.value = list
        .map((it) => {
          if (!it) return null
          const existing = formItemRowsList.value.find((old) => old && old.prop === it.prop)
          return existing?.dataOptions?.length ? { ...it, dataOptions: existing.dataOptions } : it
        })
        .filter((it): it is FormItemOption => !!it)
      return
    }
    const rows = await getEveryFormQueryField(needLoadList, fieldFieldOutputGlobal)
    needLoadList.forEach((it) => loadedApiProps.value.add(it.prop))
    formItemRowsList.value = list
      .map((it) => {
        if (!it) return null
        const resultApiOption = rows.find((item) => item && item.prop === it.prop)
        const existing = formItemRowsList.value.find((old) => old && old.prop === it.prop)
        if (resultApiOption) return { ...it, dataOptions: resultApiOption.listData }
        if (existing?.dataOptions?.length) return { ...it, dataOptions: existing.dataOptions }
        return it
      })
      .filter((it): it is FormItemOption => !!it)
  },
  { immediate: true, deep: true },
)

// ─── 字段过滤与自动 span（对齐 vue3）─────────────────
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

// ─── 布局（对齐 vue3 签名）──────────────────────────
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
  changeFolded,
} = useFormLayout({
  layoutFormProps: props.layoutFormProps,
  get formItemList() {
    return formItemListFilter.value
  },
})

watch(
  formLayout,
  (val) => {
    formLayoutRef.value = val
  },
  { immediate: true },
)

const labelBtnWidth = computed(() => (formLayout.value.labelBtnWidth as string) || 'auto')

// ─── 按钮分流（对齐 vue3：仅看 direction）────────────
const colRightLeftList = computed(() => ({
  colRightBtn: props.configBtn.filter((it) => it.direction === 'right' || !it.direction),
  colLeftBtn: props.configBtn.filter((it) => it.direction === 'left'),
}))

const isRenderBtn = computed(() => typeof props.renderBtn === 'function')

// ─── 按钮点击（对齐 vue3 clickBtn / queryTableRequest）──
const clickBtn = async (it: BtnConfig) => {
  if (it.triggerEvent && ['query', 'rest'].includes(it.key || '')) {
    queryTableRequest(props.model, formRef.value as any, it.key)
  } else {
    if (it.key === 'rest' && formRef.value) {
      ;(formRef.value as any).resetFields()
    }
    it.click?.(props.model, formRef.value, getTableInstant.value?.httpRequestInstance)
  }
}

const queryTableRequest = async (
  model: Record<string, unknown>,
  formRef: { resetFields: () => void; validate: () => Promise<boolean> } | null,
  key?: string,
) => {
  if (key === 'query') {
    if (isParentTable.value) {
      getTableInstant.value?.httpRequestInstance?.(model)
    }
  } else if (key === 'rest' && formRef) {
    formRef.resetFields()
    if (isParentTable.value) {
      getTableInstant.value?.httpRequestInstance?.(model)
    }
  }
}

// ─── isParentTable 时注入 marginBottom（对齐 vue3）────
const initFormItemOptions = (opts: Record<string, unknown>) => {
  if (isParentTable.value) {
    const { style, ...rest } = opts
    return { style: { marginBottom: '10px', ...(style as Record<string, unknown>) }, ...rest }
  }
  return opts
}

// ─── setOptions 下拉（自定义查询/自定义表格/重置刷新）──
const createDialogInstance = (() =>
  (instance as any)?.ctx?.dialogInstance ? (instance as any).ctx.dialogInstance() : useDialog)()
const customerForm = createDialogInstance()
const customerTable = createDialogInstance()

const handleRefresh = () => {
  // 「重置(刷新)」= 重置表单字段 + 刷新表格，复用 queryTableRequest 的 'rest' 分支
  queryTableRequest(props.model, formRef.value as any, 'rest')
}

const getFormRowsFun = () => {
  return {
    data: formItemRowsList.value.map((it) => ({
      ...it,
      label: it.label,
      prop: it.prop,
      isHidden: !!it.isHidden,
      width: it.width,
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
            h(Input, {
              size: 'small',
              maxlength: 3,
              value: row.width as any,
              'onUpdate:value': (val: unknown) => {
                row.width = val
              },
            }, {
              addonBefore: () => '宽度',
              addonAfter: () => 'px',
            }),
          ])
        },
      },
    ],
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
            h(Input, {
              size: 'small',
              maxlength: 3,
              value: row.width as any,
              'onUpdate:value': (val: unknown) => {
                row.width = val
              },
            }, {
              addonBefore: () => '宽度',
              addonAfter: () => 'px',
            }),
          ])
        },
      },
    ],
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
        columns: formRows.columns as any,
        options: {
          multiSelect: true,
          expand: false,
          snIndex: false,
          loading: false,
          border: true,
          size: 'small',
        },
        pagination: {
          pageSize: 10,
          current: 1,
          total: formRows.data?.length || 0,
        },
      }),
    configBtn: [
      {
        name: '取消',
        icon: 'Close',
        click: (_instance: unknown, { close }: { close: () => void }) => close(),
      },
      {
        name: '确认',
        type: 'primary',
        icon: 'Check',
        click: (_instance: unknown, { close }: { close: () => void }) => close(),
      },
    ],
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
        columns: formRows.columns as any,
      }),
  })
}

const handleSetOptionsClick = ({ key }: { key: string }) => {
  if (key === 'customerForm') handleCustomerForm()
  else if (key === 'tableItem') handleTableItemOption()
  else if (key === 'refresh') handleRefresh()
}

// ─── 生命周期：上报 bodyFormInstance 给父 table（对齐 vue3）──
nextTick(() => {
  formInstance.value = formRef.value as Record<string, unknown>
  ;((instance as any)?.ctx as Record<string, any>)?.bodyFormInstance?.(formInstance.value)
})

// ─── 子组件定义 ─────────────────────────────────────
const RenderBtn = defineComponent({
  name: 'RenderBtn',
  props: {
    row: Object,
    formItemList: Array,
    formModel: Object,
    render: Function,
  },
  setup(props) {
    return () => {
      const { formItemList, formModel, row } = props
      const renderContent = props.render?.(row, formModel, formItemList, h) || ''
      return typeof renderContent === 'string' ? h('span', renderContent) : renderContent
    }
  },
})

const RenderDomForm = defineComponent({
  name: 'RenderDomForm',
  props: {
    row: Object,
    index: Number,
    datakey: String,
    render: Function,
    model: Object,
  },
  setup(props) {
    return (): VNode | string => {
      const { row, index, model } = props
      const renderContent = props.render?.(h, model, { row, index }) || ''
      return typeof renderContent === 'string' ? (h('span', renderContent) as unknown as VNode) : (renderContent as VNode)
    }
  },
})

// ─── 暴露给外部的方法（对齐 vue3 defineExpose 全集）──
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
        dataOptions: resultApiOption.listData as Array<{ label: string; value: unknown }>,
      }
    }
  })
}

const getFormRef = () =>
  formRef.value as {
    validate: () => Promise<boolean>
    resetFields: () => void
    clearValidate: (props?: string | string[]) => void
    validateField: (props: string | string[]) => Promise<boolean>
    scrollToField: (prop: string) => void
  }

defineExpose({
  formItmeRequestInstance,
  getFormRef,
  validate: () => getFormRef()?.validate(),
  resetFields: () => getFormRef()?.resetFields(),
  clearValidate: (props?: string | string[]) => getFormRef()?.clearValidate(props),
  validateField: (props: string | string[]) => getFormRef()?.validateField(props),
  scrollToField: (prop: string) => getFormRef()?.scrollToField(prop),
})
</script>

<style lang="scss" scoped>
.es-form {
  width: 100%;
  :deep(.ant-form-item) {
    margin-bottom: 10px
  }
  :deep(.ant-form-item-row) {
    flex-wrap: nowrap;
  }

  :deep(.ant-form-item-label) {
    white-space: nowrap;
    flex-shrink: 0;
  }

  :deep(.ant-form-item-control) {
    min-width: 0;
  }

  // 表单控件铺满控制区，对齐 @es-plus/vue3（Element Plus 中 el-select/el-date-picker 等默认 100%）。
  // ant-design-vue 里仅 a-input 默认满宽，a-select/a-picker/a-input-number 默认按内容宽度，
  // 在弹窗窄列下会显得过窄，故统一强制满宽。
  :deep(.ant-select),
  :deep(.ant-picker),
  :deep(.ant-input-number),
  :deep(.ant-cascader-picker) {
    width: 100%;
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
    :deep(.ant-form-item-control-input) {
      min-height: auto;
    }
  }

  .formItemCols {
    width: 100%;
  }

  // 折叠展开平滑过渡
  .es-col--foldable {
    overflow: hidden;
    max-height: 200px;
    transition: max-height 0.3s ease, opacity 0.3s ease;

    &.is-folded {
      max-height: 0;
      opacity: 0;
      :deep(.ant-form-item) {
        margin-bottom: 0;
      }
    }
  }
}
</style>
