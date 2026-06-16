<!--
  ADV 适配器：EsForm 动态表单组件

  Ant Design Vue 版，核心变化：
  - a-form / a-form-item / a-row / a-col / a-button / a-space
  - form-item 用 name 做校验字段标识（EP 用 prop）
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
    <a-row v-bind="layoutRow">
      <a-col
        v-for="(item, idx) in displayItems"
        :key="item.prop || idx"
        :span="item.finalSpan || item.span || 6"
        v-show="!item.isFold"
      >
        <a-form-item
          :name="item.prop"
          :label="item.label"
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
        v-if="!isBtnHidden && displayItems.length"
        :span="effectiveBtnColSpan"
        class="btn-formItem"
      >
        <a-form-item :labelCol="{ style: { width: labelBtnWidth || 'auto' } }">
          <a-space>
            <!-- 自定义左侧按钮 -->
            <a-button
              v-for="(it, bIdx) in btnLeft"
              :key="it.key || bIdx"
              :type="mapBtnType(it.type)"
              :size="mapBtnSize(it.size)"
              :disabled="isDisabled(it)"
              @click="handleBtnClick(it)"
              v-bind="filterExtraProps(it)"
            >{{ it.name }}</a-button>
            <!-- 内置查询按钮 -->
            <a-button type="primary" :size="mapBtnSize(sizeConfig)" @click="handleQuery">
              <template #icon><SearchOutlined /></template>
              查询
            </a-button>
            <!-- 内置重置按钮 -->
            <a-button :size="mapBtnSize(sizeConfig)" @click="handleReset">重置</a-button>
            <!-- 自定义右侧按钮 -->
            <a-button
              v-for="(it, bIdx) in btnRight"
              :key="it.key || bIdx"
              :type="mapBtnType(it.type)"
              :size="mapBtnSize(it.size)"
              :disabled="isDisabled(it)"
              @click="handleBtnClick(it)"
              v-bind="filterExtraProps(it)"
            >{{ it.name }}</a-button>
          </a-space>
        </a-form-item>
      </a-col>
    </a-row>

    <!-- 折叠切换按钮 -->
    <a-row v-if="showFoldBtn" justify="center" style="margin-top: 4px">
      <a-button type="link" @click="toggleFold">
        {{ folded ? '展开' : '收起' }}
        <DownOutlined v-if="folded" />
        <UpOutlined v-else />
      </a-button>
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
import { SearchOutlined, DownOutlined, UpOutlined } from '@ant-design/icons-vue'
import { getGlobalConfig } from '../../../config'
import { useFormInputs } from '../../../composables/use-form-inputs'
import { useFormLayout } from '../../../composables/use-form-layout'
import { useFormRequest } from '../../../composables/use-form-request'
import { filterVisibleFormItems, applyAutoSpan } from '@es-plus/core'
import { mapButtonType, mapSize, getNestedValue } from '../../../utils/shared'
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

// ─── Props ───────────────────────────────────────────
const props = withDefaults(
  defineProps<{
    model: Record<string, unknown>
    formItemList: FormItemOption[]
    configBtn?: BtnConfig[]
    layoutFormProps?: LayoutFormProps
    formProps?: Record<string, unknown>
  }>(),
  {
    model: () => ({}),
    formItemList: () => [],
    configBtn: () => [],
    layoutFormProps: () => ({}),
    formProps: () => ({ size: 'middle' as const }),
  }
)

const emit = defineEmits<{
  confirm: [formRef: unknown, model: Record<string, unknown>]
  reset: [formRef: unknown, model: Record<string, unknown>]
}>()

// ─── 注入 ───────────────────────────────────────────
const esPlus = inject<Record<string, unknown>>('$EsPlus', null) ?? getGlobalConfig() ?? {}
const getTableInstantce = inject<() => any>('getTableInstantce', () => null)

// ─── h 函数引用 ─────────────────────────────────────
const hFn = h

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

// ─── 布局（对齐 vue3 签名：{ layoutFormProps, formItemList }） ──
const layoutComposable = useFormLayout({
  get layoutFormProps() { return layoutProps.value },
  get formItemList() { return formItemList.value },
})

const {
  folded, isBtnHidden, isBtnHiden, rowLayout: layoutRow,
  formLayout, changeFolded: toggleFold, getBtnColSpan, formItem: foldedFormItem,
  isFold: showFoldBtn, getRowColsAlgorithm,
} = layoutComposable

const effectiveBtnColSpan = computed(() => getBtnColSpan.value || 24)
const labelWidth = computed(() => formLayout.value.labelWidth as string | number | undefined)
const sizeConfig = computed(() => formLayout.value.size as string | undefined)
const resolvedLayout = computed(() => formLayout.value)

// ─── 表单请求 ───────────────────────────────────────
const esPlusForm = inject<Record<string, unknown>>('$esPlusForm', null) ?? {}
const esPlusGlobal = inject<Record<string, unknown>>('$EsPlus', null) ?? getGlobalConfig() ?? {}
const httpRequestGlobalFn = (esPlusForm.httpRequest || esPlusGlobal.httpRequest || esPlus.httpRequest) as
  | ((params: Record<string, unknown>) => Promise<unknown>)
  | undefined
const { getEveryFormQueryField } = useFormRequest(httpRequestGlobalFn)

async function httpRequestForm() {
  return getEveryFormQueryField(formItemList.value)
}

// ─── 显示项 → 使用 foldedFormItem ───
const displayItems = computed(() => {
  let items = foldedFormItem.value || formItemList.value || []

  // 过滤隐藏项
  items = filterVisibleFormItems(items, props.model)

  // 自动 span
  const hasExplicitSpan = items.some((item: FormItemOption) => item.span !== undefined)
  if (!hasExplicitSpan) {
    let autoSpan = 6
    const count = items.length
    if (count === 1) autoSpan = 24
    else if (count === 2) autoSpan = 12
    else if (count === 3) autoSpan = 8
    items = applyAutoSpan(items, autoSpan)
  }

  return items
})

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
  return rules
})

// ─── 按钮左右分割 ───────────────────────────────────
const btnLeft = computed(() =>
  configBtn.value.filter((btn) => getButtonPosition(btn) === 'left')
)
const btnRight = computed(() =>
  configBtn.value.filter((btn) => getButtonPosition(btn) !== 'left')
)

// ─── 标签宽度 ───────────────────────────────────────
const labelColStyle = computed(() => {
  const w = labelWidth.value || (formLayout.value.labelWidth as string | number)
  return w ? { style: { width: typeof w === 'number' ? `${w}px` : String(w) } } : { span: 4 }
})

const labelBtnWidth = computed(() =>
  (formLayout.value.labelBtnWidth as string) || 'auto'
)

// ─── 按钮 ──────────────────────────────────────────
function mapBtnType(type?: string): string {
  return mapButtonType(type)
}

function mapBtnSize(size?: string): string {
  return mapSize(size || (sizeConfig.value as string) || 'middle', 'middle')
}

function isDisabled(item: BtnConfig): boolean {
  if (typeof item.disabled === 'function') return item.disabled()
  return !!item.disabled
}

function filterExtraProps(item: BtnConfig): Record<string, unknown> {
  const knownKeys = new Set([
    'name', 'key', 'type', 'size', 'icon', 'position', 'code', 'direction',
    'loading', 'disabled', 'permissionValue', 'triggerEvent', 'click', 'confirm',
    'dialogKey', 'actionType',
  ])
  const extra: Record<string, unknown> = {}
  for (const [k, v] of Object.entries(item)) {
    if (!knownKeys.has(k)) extra[k] = v
  }
  return extra
}

function handleBtnClick(item: BtnConfig) {
  item.click?.(props.model, formRef.value)
}

// ─── 查询 / 重置 (emit 对齐 vue3: confirm(formRef, model) + reset(formRef, model)) ──
async function handleQuery() {
  // 触发表单远程选项加载
  await httpRequestForm()
  // 联动表格刷新
  const tableInst = getTableInstantce()
  if (tableInst?.httpRequestInstance) {
    tableInst.httpRequestInstance(props.model)
  }
  emit('confirm', formRef.value, { ...props.model })
}

function handleReset() {
  formRef.value?.resetFields?.()
  emit('reset', formRef.value, { ...props.model })
}

// ─── Form ref ───────────────────────────────────────
const setFormRef = (el: any) => {
  formRef.value = el
}

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

function clearValidate() {
  formRef.value?.clearValidate?.()
}

defineExpose({ validate, resetFields, clearValidate })
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
