<template>
  <el-form ref="formRef" v-bind="formProps" class="es-form">
    <div class="flex-center">
      <el-row v-bind="rowLayout">
        <template v-for="(item, index) in formItem">
          <el-col
            v-show="!item.isFold"
            :key="item.prop || index"
            :span="item.span"
          >
            <el-form-item
              :label="translateLabel(item)"
              v-bind="initFormItemOptions(item.formItemOptions || {})"
              :prop="item.prop"
              @click.native.stop="noop"
            >
              <template v-if="item.formtype">
                <render-dom-form
                  :row="item"
                  :render="formInputComponents(item)"
                  :index="index"
                  :model="model"
                />
              </template>
              <template v-else-if="item.render">
                <render-dom-form
                  :row="item"
                  :render="item.render"
                  :index="index"
                  :model="model"
                />
              </template>
            </el-form-item>
          </el-col>
        </template>

        <template v-if="!isBtnHidden">
          <render-btn
            v-if="isRenderBtn"
            :row="{ isFold, folded, getBtnColSpan, getRowColsAlgorithm, changeFolded, refsForm: formInstance }"
            :form-model="model"
            :form-item-list="formItem"
            :render="renderBtn"
          />
          <el-col v-else :span="btnColSpanRow ? 24 : getBtnColSpan">
            <!-- btnColSpanRow=true 时左右分布 -->
            <div
              v-if="btnColSpanRow && configBtn.length"
              class="buttonOperate leftRightBtn"
            >
              <div class="btn-left">
                <el-form-item label-width="0px" class="btn-formItem">
                  <template v-for="(it, inx) in colRightLeftList.colLeftBtn">
                    <el-button
                      v-if="checkPermission(it.permissionValue)"
                      :key="it.key || inx"
                      v-bind="filterOptions(it)"
                      :icon="getCompIcon(it.icon)"
                      :disabled="resolveDisabled(it)"
                      @click="handleBtnClick(it)"
                    >
                      {{ it.name }}
                    </el-button>
                  </template>
                </el-form-item>
              </div>
              <div class="btn-right">
                <el-form-item label-width="0px" class="btn-formItem">
                  <template v-for="(it, inx) in colRightLeftList.colRightBtn">
                    <el-button
                      v-if="checkPermission(it.permissionValue)"
                      :key="it.key || inx"
                      v-bind="filterOptions(it)"
                      :icon="getCompIcon(it.icon)"
                      :disabled="resolveDisabled(it)"
                      @click="clickBtn(it)"
                    >
                      {{ it.name }}
                    </el-button>
                  </template>
                  <el-button
                    v-if="isFold"
                    type="text"
                    :icon="folded ? 'el-icon-arrow-down' : 'el-icon-arrow-up'"
                    style="padding-left: 0; border: none"
                    @click="changeFolded"
                  >
                    {{ folded ? '展开' : '收起' }}
                  </el-button>
                </el-form-item>
              </div>
            </div>
            <!-- btnColSpanRow=false 时单行布局 -->
            <el-form-item
              v-if="!btnColSpanRow && configBtn.length"
              :label="' '"
              :label-width="formProps.labelBtnWidth ? formProps.labelBtnWidth : formProps.labelWidth"
              :class="{ formItemCols: btnColSpanRow ? true : getBtnColSpan === 24 }"
              class="btn-formItem"
            >
              <div
                class="buttonOperate"
                :style="{ 'text-align': getBtnColSpan === 24 ? 'right' : 'left' }"
              >
                <template v-for="(it, inx) in configBtn">
                  <el-button
                    v-if="checkPermission(it.permissionValue)"
                    :key="it.key || inx"
                    v-bind="filterOptions(it)"
                    :icon="getCompIcon(it.icon)"
                    :disabled="resolveDisabled(it)"
                    @click="handleBtnClick(it)"
                  >
                    {{ it.name }}
                  </el-button>
                </template>
                <el-button
                  v-if="isFold"
                  type="text"
                  :icon="folded ? 'el-icon-arrow-down' : 'el-icon-arrow-up'"
                  style="padding-left: 0; border: none"
                  @click="changeFolded"
                >
                  {{ folded ? '展开' : '收起' }}
                </el-button>
              </div>
            </el-form-item>
          </el-col>
        </template>
      </el-row>
    </div>
  </el-form>
</template>

<script lang="ts">
/**
 * EsForm —— Vue 2 + Element UI 配置化表单
 *
 * 与 Vue 3 + Element Plus 版本（packages/vue3/.../es-form.vue）的功能等价点：
 *  - 24 栅格自动布局 / 折叠展开
 *  - 13 种内置 formtype
 *  - 远端 dataOptions 加载（apiParams + httpRequest）
 *  - 工具栏按钮（左右分布、权限过滤、内置 query/rest 行为）
 *  - 与 EsTable 联动（通过 inject getTableInstantce）
 *  - exposed 方法：validate / resetFields / clearValidate / scrollToField
 *
 * Vue 2 关键差异点：
 *  - 使用 defineComponent + setup() 替代 <script setup>
 *  - 取 formRef 用 templateRefs().formRef（而非 Vue 3 的 ref()）
 *  - 图标改为字符串 class（el-icon-xxx）替代 Element Plus 图标组件
 *  - 工具栏 dropdown 暂未实现自定义查询/自定义表格 → 后续 phase 5 验证后再补
 */

import { defineComponent, ref, computed, watch, inject, getCurrentInstance, nextTick, h, type PropType } from '../../vue-compat'
import { useFormInputs } from '../../composables/use-form-inputs'
import { useFormLayout } from '../../composables/use-form-layout'
import { useFormRequest } from '../../composables/use-form-request'
import { mapSize } from '../../utils/size'
import { getGlobalConfig } from '@es-plus/core'
import type { FormItemOption, BtnConfig, LayoutFormProps, ModelData } from '@es-plus/core'

/**
 * 内联子组件：渲染 form-input 函数返回的 VNode
 *
 * 与 Vue 3 版本不同，Vue 2 中 render 函数签名为 (createElement, ctx)，
 * 因此这里把传入的 render（已是 useFormInputs 暴露的 (h, model, ctx) 风格）
 * 桥接为 functional 组件。
 */
const RenderDomForm = defineComponent({
  name: 'RenderDomForm',
  functional: true,
  props: {
    row: { type: Object as PropType<FormItemOption>, default: () => ({}) },
    index: { type: Number, default: 0 },
    render: { type: Function, default: undefined },
    model: { type: Object as PropType<ModelData>, default: () => ({}) },
  },
  render(createElement, ctx) {
    const { row, index, model, render } = ctx.props
    if (typeof render !== 'function') return null
    const safeRow = row || {}
    const renderContent = render(createElement, model || {}, { row: safeRow, index })
    return typeof renderContent === 'string' ? createElement('span', renderContent) : renderContent
  },
})

/**
 * 自定义按钮区渲染（用户传 renderBtn 时使用）
 */
const RenderBtn = defineComponent({
  name: 'RenderBtn',
  functional: true,
  props: {
    row: { type: Object, default: () => ({}) },
    formItemList: { type: Array, default: () => [] },
    formModel: { type: Object, default: () => ({}) },
    render: { type: Function, default: undefined },
  },
  render(createElement, ctx) {
    const { formItemList, formModel, row, render } = ctx.props
    if (typeof render !== 'function') return null
    const renderContent = render(row, formModel, formItemList, createElement) || ''
    return typeof renderContent === 'string' ? createElement('span', renderContent) : renderContent
  },
})

export default defineComponent({
  name: 'EsForm',
  components: { RenderDomForm, RenderBtn },
  props: {
    /** 表单 model 数据 */
    model: { type: Object as PropType<ModelData>, default: () => ({}) },
    /** 表单字段配置 */
    formItemList: { type: Array as PropType<FormItemOption[]>, default: () => [] },
    /** 布局配置 */
    layoutFormProps: { type: Object as PropType<LayoutFormProps>, default: () => ({}) },
    /** 工具栏按钮 */
    configBtn: { type: Array as PropType<BtnConfig[]>, default: () => [] },
    /** 自定义按钮区渲染函数 */
    renderBtn: { type: [Function, Boolean] as PropType<((row: object, model: ModelData, list: FormItemOption[], h: Function) => unknown) | boolean>, default: false },
    /** 是否一行内左右分布按钮 */
    btnColSpanRow: { type: Boolean, default: true },
    /** 校验规则 */
    rules: { type: Object as PropType<Record<string, unknown>>, default: () => ({}) },
    /** 字段映射注入函数 */
    fieldFieldOutput: { type: Function as PropType<(defaults: Record<string, string>) => Record<string, string>>, default: undefined },
  },
  setup(props, ctx) {
    const instance = getCurrentInstance()
    /**
     * Vue 2.7 的 setup(props, ctx) 中 ctx 仅有 attrs/listeners/slots/emit/expose，
     * 并不存在 ctx.refs。模板里 ref="formRef" 拿到的实例只能从组件代理 vm.$refs 上读取。
     * 这里包一层 proxy 访问器，所有需要拿 formRef 的地方统一走 templateRefs.formRef。
     */
    const templateRefs = (): Record<string, unknown> => {
      const proxy = (instance as unknown as { proxy?: Record<string, unknown> } | null)?.proxy
      return ((proxy?.$refs as Record<string, unknown>) || {})
    }

    /**
     * 解析真实的 form data model —— 统一从两个来源回退：
     *
     * 1. `$vnode.data.model` —— 兼容 JSX `<es-form model={data} />`。
     *    背景：@vue/babel-preset-jsx@1.4.0 把 `model` 列为 rootAttribute，所以 JSX
     *    `<es-form model={x} />` 编译产物是 `h(EsForm, { attrs: {...}, model: x })`，
     *    `model` 落在 data 根级而非 attrs。Vue 2 运行时随后调用 transformModel，
     *    期待 v-model 形状 `{ value, callback }`，把 data.attrs.value = data.model.value
     *    写回；但用户传入的是普通数据对象，既无 .value 也无 .callback，结果
     *    props.model 收到默认 `{}`。判定：若值为非空对象且 .callback 不是函数，则视为
     *    用户数据对象。
     *
     * 2. `props.model`（兜底）—— template `:model="x"` 或真正的 v-model 走这里。
     */
    const resolvedModel = computed<ModelData>(() => {
      const proxy = (instance as unknown as { proxy?: { $vnode?: { data?: { model?: unknown } } } } | null)?.proxy
      const rawJsxModel = proxy?.$vnode?.data?.model
      if (
        rawJsxModel &&
        typeof rawJsxModel === 'object' &&
        typeof (rawJsxModel as { callback?: unknown }).callback !== 'function'
      ) {
        return rawJsxModel as ModelData
      }
      return props.model
    })
    const $esPlusForm = (inject('$esPlusForm', null) as Record<string, unknown> | null) ?? getGlobalConfig().EsForm ?? {}
    const esPlus = (inject('$EsPlus', null) as Record<string, unknown> | null) ?? getGlobalConfig() ?? {}

    // ─── 权限 / i18n ──
    const checkPermission = (pvalue?: string): boolean => {
      if (!pvalue) return true
      const fn = esPlus.permission as ((v: string) => boolean) | undefined
      return typeof fn === 'function' ? fn(pvalue) : true
    }
    const translateLabel = (item: FormItemOption): string => {
      if (item.labelKey && typeof esPlus.t === 'function') {
        return (esPlus.t as (k: string) => string)(item.labelKey)
      }
      return item.label
    }

    // ─── 与 EsTable 联动 ──
    const injectedTableInstant = inject<(() => unknown) | null>('getTableInstantce', null)
    const getTableInstant = computed(() => {
      if (injectedTableInstant) {
        return typeof injectedTableInstant === 'function'
          ? injectedTableInstant()
          : injectedTableInstant
      }
      const proxy = (instance as unknown as { proxy?: Record<string, unknown> })?.proxy
      const fn = proxy?.getTableInstantce
      if (typeof fn === 'function') return (fn as () => unknown)()
      return fn
    })
    const isParentTable = computed(() => {
      const t = getTableInstant.value as Record<string, unknown> | null | undefined
      return !!(t && Object.keys(t).length)
    })

    // ─── 图标处理（Element UI 用 class 字符串） ──
    const getCompIcon = (key?: string): string | undefined => {
      if (!key) return undefined
      // 兼容 Element Plus 图标名（如 'Plus'）→ 'el-icon-plus'
      // 已经是 el-icon-xxx 的直接返回
      if (key.startsWith('el-icon-')) return key
      // PascalCase → kebab-case
      const kebab = key.replace(/([a-z])([A-Z])/g, '$1-$2').replace(/[\s_]+/g, '-').toLowerCase()
      return `el-icon-${kebab}`
    }
    const filterOptions = (it: BtnConfig) => {
      const { icon: _icon, ...opt } = it as unknown as Record<string, unknown>
      // 把用户传入的 size 经 mapSize 翻译到 Element UI v2 语义；缺省时与表单默认尺寸
      // (mini) 对齐，避免按钮比表单输入大一截。详见 packages/vue2/src/utils/size.ts。
      if (opt.size !== undefined) {
        const mapped = mapSize(opt.size)
        if (mapped !== undefined) opt.size = mapped
      } else {
        opt.size = 'mini'
      }
      return opt
    }
    const resolveDisabled = (it: BtnConfig): boolean => {
      const d = it.disabled
      if (typeof d === 'function') return Boolean((d as () => boolean | undefined)())
      return Boolean(d)
    }

    // ─── refs ──
    const formInstance = ref<Record<string, unknown>>({})
    const formItemRowsList = ref<FormItemOption[]>(props.formItemList || [])

    // ─── composables ──
    const { formInputComponents } = useFormInputs()
    const httpRequestGlobal = ($esPlusForm?.$httpRequest as ((p: Record<string, unknown>) => Promise<unknown>) | undefined) || undefined
    const fieldFieldOutputGlobal = (props.fieldFieldOutput || $esPlusForm?.fieldFieldOutput) as
      | ((defaults: Record<string, string>) => Record<string, string>)
      | undefined
    const { getEveryFormQueryField } = useFormRequest(httpRequestGlobal)

    // ─── formProps （供 el-form 使用） ──
    const formLayoutRef = ref<Record<string, unknown>>(props.layoutFormProps?.fromLayProps || {})
    /**
     * Element UI v2 的 el-form 在 `labelWidth` 缺省时会让 label 浮动在自然位置，
     * 当外层是 flex/wrap 布局且 label 较长时会被挤到 input 上方（label 与 content 分行），
     * 严重破坏栅格视觉。原 es-eui 的 esForm 对此做了缺省 `labelWidth: 'auto'` 的兜底
     * （详见 es-eui/src/components/es-eui/esForm/src/esForm.vue 的 fromProps 计算属性）。
     *
     * 这里保持同样的兜底策略，确保未显式传 labelWidth 时 label 与 content 同行展示。
     *
     * 默认 size 与原 es-eui 对齐为 `mini`（el-form size=mini 时表单控件高度 ≈ 28px），
     * 同时通过 mapSize 把用户从 Vue 3 / Element Plus 习惯传来的 `large/default/small`
     * 自动转译为 Element UI v2 语义，避免两个版本"同一份配置渲染出明显不同尺寸"。
     */
    const formProps = computed<Record<string, unknown>>(() => {
      const userLayout = formLayoutRef.value || {}
      const merged: Record<string, unknown> = {
        size: 'mini',
        ...userLayout,
        model: resolvedModel.value,
        rules: props.rules,
        validateOnRuleChange: false,
      }
      const mapped = mapSize(merged.size)
      if (mapped !== undefined) merged.size = mapped
      if (merged.labelWidth === undefined || merged.labelWidth === '' || merged.labelWidth === null) {
        merged.labelWidth = 'auto'
      }
      return merged
    })

    // ─── 远端选项加载（仅对未加载过的字段执行） ──
    const loadedApiProps = ref<Set<string>>(new Set<string>())

    watch(
      () => props.formItemList,
      async (val) => {
        const list = Array.isArray(val) ? val : []
        const needLoadList = list.filter(
          (it) => it && it.isInitRun !== false && !loadedApiProps.value.has(it.prop)
        )
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
            const fromApi = rows.find((r) => r && r.prop === it.prop)
            const existing = formItemRowsList.value.find((old) => old && old.prop === it.prop)
            if (fromApi) {
              return {
                ...it,
                dataOptions: fromApi.listData as Array<{ label: string; value: unknown }>,
              }
            }
            if (existing?.dataOptions?.length) return { ...it, dataOptions: existing.dataOptions }
            return it
          })
          .filter((it): it is FormItemOption => !!it)
      },
      { immediate: true, deep: true }
    )

    // ─── 可见 + auto-span 计算 ──
    const formItemListFilter = computed(() => {
      const list = formItemRowsList.value || []
      const visible = list
        .map((it) => (it ? { ...it, dataOptions: it.dataOptions || [] } : null))
        .filter((it): it is FormItemOption & { dataOptions: Array<{ label: string; value: unknown }> } => {
          if (!it) return false
          // 字段名兼容：原 es-eui 用 `isHiden`（少一个 d，原始拼写错误），
          // 后续规范化为 `isHidden`。两者都接受，原始拼写优先（保持旧文档案例可直接运行）。
          const legacyHide = (it as unknown as { isHiden?: unknown }).isHiden
          const fixedHide = it.isHidden
          const hideFn = typeof legacyHide === 'function'
            ? (legacyHide as (m: ModelData, item: FormItemOption, props: Record<string, unknown>) => boolean)
            : typeof fixedHide === 'function'
              ? fixedHide
              : null
          if (hideFn) {
            return !hideFn(resolvedModel.value, it, formProps.value)
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
      return visible.map((it) => ({ ...it, span: it.span || autoSpan }))
    })

    const layoutResult = useFormLayout({
      layoutFormProps: props.layoutFormProps,
      get formItemList() {
        return formItemListFilter.value
      },
    } as never)

    const {
      folded,
      isBtnHidden,
      rowLayout,
      formLayout,
      getRowColsAlgorithm,
      isFold,
      getBtnColSpan,
      formItem,
      changeFolded,
    } = layoutResult

    watch(
      formLayout,
      (val: Record<string, unknown>) => {
        formLayoutRef.value = val
      },
      { immediate: true }
    )

    // ─── 按钮分组（左右） ──
    const colRightLeftList = computed(() => ({
      colRightBtn: props.configBtn.filter((it) => it.direction === 'right' || !it.direction),
      colLeftBtn: props.configBtn.filter((it) => it.direction === 'left'),
    }))

    const isRenderBtn = computed(() => typeof props.renderBtn === 'function')

    // ─── 按钮点击逻辑 ──
    const handleBtnClick = (it: BtnConfig) => {
      const formRef = (templateRefs().formRef as unknown) as Record<string, unknown> | null
      const httpFn = (getTableInstant.value as { httpRequestInstance?: (p: unknown) => void } | null)?.httpRequestInstance
      it.click?.(resolvedModel.value, formRef as unknown, httpFn)
    }

    const queryTableRequest = (model: ModelData, formRef: { resetFields?: () => void } | null, key?: string) => {
      const t = getTableInstant.value as { httpRequestInstance?: (p: unknown) => void } | null
      if (key === 'query') {
        if (isParentTable.value) {
          t?.httpRequestInstance?.(model)
        }
      } else if (key === 'rest' && formRef) {
        if (isParentTable.value) {
          t?.httpRequestInstance?.(model)
        }
        formRef.resetFields?.()
      }
    }

    const clickBtn = (it: BtnConfig) => {
      const formRef = (templateRefs().formRef as unknown) as { resetFields?: () => void } | null
      if (it.triggerEvent && ['query', 'rest'].includes(it.key || '')) {
        queryTableRequest(resolvedModel.value, formRef, it.key)
      } else {
        if (it.key === 'rest' && formRef) {
          formRef.resetFields?.()
        }
        const httpFn = (getTableInstant.value as { httpRequestInstance?: (p: unknown) => void } | null)?.httpRequestInstance
        it.click?.(resolvedModel.value, formRef as unknown, httpFn)
      }
    }

    const initFormItemOptions = (opts: Record<string, unknown>) => {
      if (isParentTable.value) {
        const { style, ...rest } = opts
        return { style: { marginBottom: '10px', ...((style as Record<string, unknown>) || {}) }, ...rest }
      }
      return opts
    }

    // ─── 暴露给外部的方法 ──
    const getFormRef = () => templateRefs().formRef as unknown as {
      validate: (cb?: (valid: boolean) => void) => Promise<boolean>
      resetFields: () => void
      clearValidate: (props?: string | string[]) => void
      validateField: (props: string | string[], cb?: (msg: string) => void) => void
    }

    const validate = (): Promise<boolean> => {
      const ref = getFormRef()
      if (!ref) return Promise.resolve(false)
      // Element UI el-form.validate 接受 callback；若返回 Promise 我们以 callback 形式包装
      return new Promise<boolean>((resolve) => {
        try {
          const maybePromise = (ref as unknown as { validate: (cb: (valid: boolean) => void) => void | Promise<boolean> }).validate((valid: boolean) => {
            resolve(!!valid)
          })
          if (maybePromise && typeof (maybePromise as Promise<boolean>).then === 'function') {
            ;(maybePromise as Promise<boolean>).then(resolve).catch(() => resolve(false))
          }
        } catch (e) {
          resolve(false)
        }
      })
    }
    const resetFields = () => getFormRef()?.resetFields()
    const clearValidate = (p?: string | string[]) => getFormRef()?.clearValidate(p)
    const validateField = (p: string | string[]) => getFormRef()?.validateField(p)

    const formItmeRequestInstance = async (propsList: string[]) => {
      const list = formItemListFilter.value
      const targetItems = list.filter((it) => it && propsList.includes(it.prop))
      if (!targetItems.length) return
      const rows = await getEveryFormQueryField(targetItems, fieldFieldOutputGlobal)
      rows.forEach((apiOption) => {
        if (!apiOption) return
        const itemIndex = formItemRowsList.value.findIndex((it) => it && it.prop === apiOption.prop)
        if (itemIndex !== -1) {
          formItemRowsList.value[itemIndex] = {
            ...formItemRowsList.value[itemIndex],
            dataOptions: apiOption.listData as Array<{ label: string; value: unknown }>,
          }
        }
      })
    }

    nextTick(() => {
      formInstance.value = templateRefs().formRef as unknown as Record<string, unknown>
      const proxy = (instance as unknown as { proxy?: Record<string, unknown> })?.proxy
      const bodyFormFn = proxy?.bodyFormInstance as ((inst: Record<string, unknown>) => void) | undefined
      bodyFormFn?.(formInstance.value)
    })

    // 暴露给 ref 拿到的 expose（Vue 2 + composition-api 用 expose；Vue 2.7 setupContext 也支持）
    if (typeof (ctx as unknown as { expose?: (e: Record<string, unknown>) => void }).expose === 'function') {
      ;(ctx as unknown as { expose: (e: Record<string, unknown>) => void }).expose({
        formItmeRequestInstance,
        getFormRef,
        validate,
        resetFields,
        clearValidate,
        validateField,
      })
    }

    return {
      // 模板使用
      formProps,
      rowLayout,
      formItem,
      isBtnHidden,
      isFold,
      folded,
      getBtnColSpan,
      isRenderBtn,
      colRightLeftList,
      configBtn: computed(() => props.configBtn),
      formInputComponents,
      formInstance,
      model: resolvedModel,
      btnColSpanRow: computed(() => props.btnColSpanRow),
      renderBtn: computed(() => props.renderBtn),
      getRowColsAlgorithm,
      changeFolded,
      // 方法
      checkPermission,
      translateLabel,
      getCompIcon,
      filterOptions,
      resolveDisabled,
      handleBtnClick,
      clickBtn,
      initFormItemOptions,
      noop: () => {},
      // expose 公开方法（供 $refs.<esForm>.validate() 直接调用，不经过 ctx.expose）
      formItmeRequestInstance,
      getFormRef,
      validate,
      resetFields,
      clearValidate,
      validateField,
    }
  },
})
</script>

<style lang="scss" scoped>
.es-form {
  /**
   * 修复 Element UI v2 的栅格布局错乱问题。
   *
   * 默认的 el-row 是 float 布局，子 el-col 高度不一致时会出现「卡进上一列尾部留白」
   * 的换行错乱。我们在 use-form-layout 中默认给 el-row 加了 type="flex"，
   * 但 Element UI 的 .el-row--flex 没有自带 flex-wrap，需要这里补上。
   *
   * 这个写法只影响 .es-form 内部的 el-row，不污染外部的栅格布局。
   */
  ::v-deep(.el-row--flex) {
    flex-wrap: wrap;
  }
  ::v-deep(.el-form-item) {
    margin-bottom: 18px;
  }
  ::v-deep(.el-form-item__label) {
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
