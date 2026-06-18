<!--
  ADV 适配器：EsForm 动态表单组件（对齐 @es-plus/vue3 API）

  Ant Design Vue 版，核心变化：
  - a-form / a-form-item / a-row / a-col / a-button / a-space
  - 表单字段用 name 做校验字段标识（EP 用 prop）
  - 标签宽度通过 labelCol 控制
-->
<template>
  <a-form
    :ref="setFormRef"
    :model="model"
    :rules="formRules"
    v-bind="formProps"
    class="es-form"
  >
    <a-row v-bind="rowLayout">
      <a-col
        v-for="(item, idx) in formItem"
        :key="item.prop || idx"
        :span="item.span || 6"
        v-show="!item.isFold"
      >
        <a-form-item
          :name="item.prop"
          :label="translateLabel(item)"
          :labelCol="labelColStyle"
          v-bind="item.formItemOptions"
        >
          <!-- 自定义 render 渲染函数 -->
          <RenderDomForm
            v-if="item.render && typeof item.render === 'function'"
            :render="item.render"
            :model="model"
            :row="item"
            :index="idx"
          />
          <!-- 内置控件类型 -->
          <component
            v-else-if="formInputRenderer(item)"
            :is="formInputRenderer(item)(hFn, model, { row: item, index: idx })"
          />
          <!-- 无控件：显示纯文本 -->
          <span v-else>{{ getNestedValue(model, item.prop) ?? '-' }}</span>
        </a-form-item>
      </a-col>

      <!-- 按钮区域 -->
      <a-col
        v-if="!isBtnHidden && formItem.length"
        :span="effectiveBtnColSpan"
        class="btn-formItem"
      >
        <!-- 自定义按钮渲染 -->
        <RenderBtn
          v-if="isRenderBtn"
          :row="{ isFold: showFoldBtn, folded, getBtnColSpan, getRowColsAlgorithm, changeFolded, refsForm: formRef }"
          :form-model="model"
          :form-item-list="formItem"
          :render="(renderBtn as Function)"
        />
        <a-form-item v-else :labelCol="{ style: { width: labelBtnWidth || 'auto' } }">
          <a-space>
            <!-- 左侧按钮 -->
            <a-button
              v-for="(it, bIdx) in btnLeft"
              :key="it.key || bIdx"
              :type="mapBtnType(it.type)"
              :size="mapBtnSize(it.size)"
              :disabled="isDisabled(it)"
              :loading="it.loading"
              @click="clickBtn(it)"
              v-bind="filterExtraProps(it)"
            >
              <template #icon v-if="it.icon">
                <component :is="getAdvIconComponent(it.icon)" />
              </template>
              {{ it.name }}
            </a-button>
            <!-- 右侧按钮 -->
            <a-button
              v-for="(it, bIdx) in btnRight"
              :key="it.key || bIdx"
              :type="mapBtnType(it.type)"
              :size="mapBtnSize(it.size)"
              :disabled="isDisabled(it)"
              :loading="it.loading"
              @click="clickBtn(it)"
              v-bind="filterExtraProps(it)"
            >
              <template #icon v-if="it.icon">
                <component :is="getAdvIconComponent(it.icon)" />
              </template>
              {{ it.name }}
            </a-button>
            <!-- 折叠按钮 -->
            <a-button
              v-if="showFoldBtn"
              type="link"
              @click="changeFolded"
            >
              {{ folded ? '展开' : '收起' }}
              <DownOutlined v-if="folded" />
              <UpOutlined v-else />
            </a-button>
          </a-space>
        </a-form-item>
      </a-col>
    </a-row>
  </a-form>
</template>

<script lang="ts">
export default { name: 'EsForm' }
</script>

<script setup lang="ts">
import { ref, computed, watch, inject, h, defineComponent } from 'vue'
import type { VNode } from 'vue'
import { Form, FormItem, Row, Col, Button, Space } from 'ant-design-vue'
import { DownOutlined, UpOutlined } from '@ant-design/icons-vue'
import { getGlobalConfig } from '../../../config'
import { useFormInputs } from '../../../composables/use-form-inputs'
import { useFormLayout } from '../../../composables/use-form-layout'
import { useFormRequest } from '../../../composables/use-form-request'
import { resolveFormLayProps } from '@es-plus/core'
import { mapButtonType, mapSize, getNestedValue } from '../../../utils/shared'
import { getAdvIconComponent } from '../../../utils/icon'
import type { FormItemOption, BtnConfig, LayoutFormProps } from '../../../types'

// ─── RenderDomForm：自定义渲染函数式组件 ──────────────
const RenderDomForm = defineComponent({
  name: 'RenderDomForm',
  props: {
    render: { type: Function, required: true },
    model: { type: Object, default: () => ({}) },
    row: { type: Object, default: () => ({}) },
    index: { type: Number, default: 0 },
  },
  setup(props) {
    return (): VNode | string => {
      try {
        const result = (props.render as Function)(h, props.model, {
          row: props.row,
          index: props.index,
        })
        if (typeof result === 'string') return h('span', result) as unknown as VNode
        return result as VNode
      } catch {
        return h('span', '-') as unknown as VNode
      }
    }
  },
})

// ─── RenderBtn：自定义按钮区渲染 ─────────────────────
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

// ─── Props ───────────────────────────────────────────
const props = withDefaults(
  defineProps<{
    model: Record<string, unknown>
    formItemList: FormItemOption[]
    configBtn?: BtnConfig[]
    layoutFormProps?: LayoutFormProps
    formProps?: Record<string, unknown>
    renderBtn?: Function | boolean
    btnColSpanRow?: boolean
    rules?: Record<string, unknown>
    fieldFieldOutput?: (defaults: Record<string, string>) => Record<string, string>
  }>(),
  {
    model: () => ({}),
    formItemList: () => [],
    configBtn: () => [],
    layoutFormProps: () => ({}),
    formProps: () => ({ size: 'middle' as const }),
    renderBtn: false,
    btnColSpanRow: true,
    rules: () => ({}),
  },
)

const emit = defineEmits<{
  confirm: [formRef: unknown, model: Record<string, unknown>]
  reset: [formRef: unknown, model: Record<string, unknown>]
}>()

// ─── 注入 ───────────────────────────────────────────
const esPlus = inject<Record<string, unknown>>('$EsPlus', {}) ?? getGlobalConfig() ?? {}
const getTableInstantce = inject<() => any>('getTableInstantce', () => null)

// ─── h 函数引用 ─────────────────────────────────────
const hFn = h

// ─── 国际化 ─────────────────────────────────────────
const translateLabel = (item: FormItemOption): string => {
  if (item.labelKey && typeof esPlus.t === 'function') {
    return (esPlus.t as (k: string) => string)(item.labelKey)
  }
  return item.label
}

// ─── 权限 ───────────────────────────────────────────
const checkPermission = (pvalue?: string): boolean => {
  if (!pvalue) return true
  const fn = esPlus.permission
  return typeof fn === 'function' ? (fn as (v: string) => boolean)(pvalue) : true
}

// ─── 表单控件映射 ───────────────────────────────────
const { formInputComponents } = useFormInputs()

function formInputRenderer(item: FormItemOption) {
  return formInputComponents(item)
}

// ─── 响应式 ─────────────────────────────────────────
const formItemList = ref<FormItemOption[]>([...props.formItemList])
const configBtn = ref<BtnConfig[]>([...props.configBtn])
const layoutProps = ref<LayoutFormProps>({ ...props.layoutFormProps })
const formRef = ref<any>(null)

watch(() => props.formItemList, (val) => { formItemList.value = [...val] }, { deep: true })
watch(() => props.configBtn, (val) => { configBtn.value = [...val] }, { deep: true })
watch(() => props.layoutFormProps, (val) => { layoutProps.value = { ...val } }, { deep: true })

// ─── 字段过滤与自动 span（对齐 vue3） ────────────────
const formItemListFilter = computed(() => {
  const list = formItemList.value || []
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

// ─── 布局（对齐 vue3 签名：{ layoutFormProps, formItemList }） ──
const layoutComposable = useFormLayout({
  layoutFormProps: props.layoutFormProps,
  get formItemList() { return formItemListFilter.value },
})

const {
  folded, isBtnHidden, rowLayout,
  formLayout, changeFolded, getBtnColSpan, formItem,
  isFold: showFoldBtn, getRowColsAlgorithm,
} = layoutComposable

const effectiveBtnColSpan = computed(() => props.btnColSpanRow ? 24 : (getBtnColSpan.value || 24))
const labelWidth = computed(() => formLayout.value.labelWidth as string | number | undefined)
const sizeConfig = computed(() => formLayout.value.size as string | undefined)
const labelBtnWidth = computed(() => (formLayout.value.labelBtnWidth as string) || 'auto')

const resolvedLayout = computed(() => formLayout.value)

// ─── 表单 Props ─────────────────────────────────────
const formLayoutRef = ref<Record<string, unknown>>(resolveFormLayProps(props.layoutFormProps) as Record<string, unknown>)

watch(
  formLayout,
  (val) => { formLayoutRef.value = val },
  { immediate: true }
)

const formProps = computed(() => ({
  size: 'middle' as const,
  ...formLayoutRef.value,
  ...props.formProps,
  validateOnRuleChange: false,
}))

const labelColStyle = computed(() => {
  const w = labelWidth.value || (formLayout.value.labelWidth as string | number)
  return w ? { style: { width: typeof w === 'number' ? `${w}px` : String(w) } } : { span: 4 }
})

// ─── 表单请求 ───────────────────────────────────────
const esPlusForm = inject<Record<string, unknown>>('$esPlusForm', {}) ?? {}
const esPlusGlobal = inject<Record<string, unknown>>('$EsPlus', {}) ?? getGlobalConfig() ?? {}
const httpRequestGlobalFn = (esPlusForm.httpRequest || esPlusGlobal.httpRequest || esPlus.httpRequest) as
  | ((params: Record<string, unknown>) => Promise<unknown>)
  | undefined
const { getEveryFormQueryField } = useFormRequest(httpRequestGlobalFn)

// 缓存已加载数据的表单项 prop，避免 computed 重新计算时重复调用接口
const loadedApiProps = ref<Set<string>>(new Set())

watch(
  () => props.formItemList,
  async (val) => {
    const list = Array.isArray(val) ? val : []
    const needLoadList = list.filter((it) => it && it.isInitRun !== false && !loadedApiProps.value.has(it.prop))
    if (!needLoadList.length) {
      formItemList.value = list.map((it) => {
        if (!it) return null
        const existing = formItemList.value.find((old) => old && old.prop === it.prop)
        return existing?.dataOptions?.length ? { ...it, dataOptions: existing.dataOptions } : it
      }).filter((it): it is FormItemOption => !!it)
      return
    }
    const rows = await getEveryFormQueryField(needLoadList, props.fieldFieldOutput)
    needLoadList.forEach((it) => loadedApiProps.value.add(it.prop))
    formItemList.value = list
      .map((it) => {
        if (!it) return null
        const resultApiOption = rows.find((item) => item && item.prop === it.prop)
        const existing = formItemList.value.find((old) => old && old.prop === it.prop)
        if (resultApiOption) return { ...it, dataOptions: resultApiOption.listData }
        if (existing?.dataOptions?.length) return { ...it, dataOptions: existing.dataOptions }
        return it
      })
      .filter((it): it is FormItemOption => !!it)
  },
  { immediate: true, deep: true }
)

// ─── 按钮处理 ───────────────────────────────────────
const effectiveConfigBtn = computed<BtnConfig[]>(() => {
  const existing = configBtn.value || []
  const hasQuery = existing.some((it) => it.key === 'query')
  const hasRest = existing.some((it) => it.key === 'rest')
  const defaults: BtnConfig[] = []
  if (!hasQuery) {
    defaults.push({ name: '查询', type: 'primary', key: 'query', triggerEvent: true })
  }
  if (!hasRest) {
    defaults.push({ name: '重置', key: 'rest', triggerEvent: true })
  }
  return [...defaults, ...existing]
})

const btnLeft = computed(() =>
  effectiveConfigBtn.value.filter((btn) => getButtonPosition(btn) === 'left')
)
const btnRight = computed(() =>
  effectiveConfigBtn.value.filter((btn) => getButtonPosition(btn) !== 'left')
)

function getButtonPosition(btn: BtnConfig): 'left' | 'right' {
  if (btn.position) return btn.position
  if (btn.direction) return btn.direction
  if (btn.code === 2) return 'right'
  return 'right'
}

function mapBtnType(type?: string): string {
  return mapButtonType(type)
}

function mapBtnSize(size?: string): string {
  return mapSize(size || (sizeConfig.value as string) || 'middle', 'middle')
}

function isDisabled(item: BtnConfig): boolean {
  if (typeof item.disabled === 'function') return item.disabled(props.model)
  return !!item.disabled
}

function filterExtraProps(item: BtnConfig): Record<string, unknown> {
  const knownKeys = new Set([
    'name', 'nameKey', 'key', 'type', 'size', 'icon', 'position', 'code', 'direction',
    'loading', 'disabled', 'permissionValue', 'triggerEvent', 'click', 'confirm',
    'dialogKey', 'actionType', 'render', 'isHide',
  ])
  const extra: Record<string, unknown> = {}
  for (const [k, v] of Object.entries(item)) {
    if (!knownKeys.has(k)) extra[k] = v
  }
  return extra
}

const isRenderBtn = computed(() => typeof props.renderBtn === 'function')

const clickBtn = async (it: BtnConfig) => {
  if (!checkPermission(it.permissionValue)) return
  if (it.triggerEvent && it.key === 'query') {
    handleQuery()
    return
  }
  if (it.triggerEvent && it.key === 'rest') {
    handleReset()
    return
  }
  it.click?.(props.model, formRef.value, getTableInstantce()?.httpRequestInstance)
}

// ─── 查询 / 重置 (emit 对齐 vue3: confirm(formRef, model) + reset(formRef, model)) ──
async function handleQuery() {
  await formItmeRequestInstance(formItemListFilter.value.map((it) => it.prop))
  const tableInst = getTableInstantce()
  if (tableInst?.httpRequestInstance) {
    tableInst.httpRequestInstance(props.model)
  }
  emit('confirm', formRef.value, { ...props.model })
}

function handleReset() {
  formRef.value?.resetFields?.()
  const tableInst = getTableInstantce()
  if (tableInst?.httpRequestInstance) {
    tableInst.httpRequestInstance({})
  }
  emit('reset', formRef.value, { ...props.model })
}

// ─── Form ref ───────────────────────────────────────
const setFormRef = (el: any) => {
  formRef.value = el
}

// ─── 表单校验规则 ───────────────────────────────────
const formRules = computed(() => {
  const rules: Record<string, Array<Record<string, unknown>>> = {}
  for (const item of formItemList.value) {
    if (item.rules?.length) {
      rules[item.prop] = item.rules
    } else if (item.required) {
      rules[item.prop] = [{ required: true, message: `${item.label || item.prop} 不能为空` }]
    }
  }
  return { ...props.rules, ...rules }
})

function validate(): Promise<boolean> {
  return new Promise((resolve) => {
    if (formRef.value?.validate) {
      formRef.value
        .validate()
        .then(() => resolve(true))
        .catch(() => resolve(false))
    } else {
      resolve(true)
    }
  })
}

function resetFields() {
  formRef.value?.resetFields?.()
}

function clearValidate(props?: string | string[]) {
  formRef.value?.clearValidate?.(props)
}

function validateField(props: string | string[]): Promise<boolean> {
  return new Promise((resolve) => {
    if (formRef.value?.validateField) {
      formRef.value
        .validateField(props)
        .then(() => resolve(true))
        .catch(() => resolve(false))
    } else {
      resolve(true)
    }
  })
}

function scrollToField(prop: string) {
  formRef.value?.scrollToField?.(prop)
}

// 暴露给外部的方法，用于手动触发指定表单项的请求
const formItmeRequestInstance = async (propsList: string[]) => {
  const list = formItemListFilter.value
  const targetItems = list.filter((it) => it && propsList.includes(it.prop))
  if (!targetItems.length) return

  const rows = await getEveryFormQueryField(targetItems, props.fieldFieldOutput)
  rows.forEach((resultApiOption) => {
    if (!resultApiOption) return
    const itemIndex = formItemList.value.findIndex((it) => it && it.prop === resultApiOption.prop)
    if (itemIndex !== -1) {
      formItemList.value[itemIndex] = {
        ...formItemList.value[itemIndex],
        dataOptions: resultApiOption.listData as Array<{ label: string; value: unknown }>,
      }
    }
  })
}

const getFormRef = () => formRef.value

defineExpose({
  formItmeRequestInstance,
  getFormRef,
  validate,
  resetFields,
  clearValidate,
  validateField,
  scrollToField,
})
</script>

<style lang="scss" scoped>
.es-form {
  width: 100%;
}

.btn-formItem {
  :deep(.ant-form-item-control-input) {
    min-height: auto;
  }
}
</style>
