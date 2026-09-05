/**
 * ADV 表单布局 — 完全对齐 @es-plus/vue3 的 use-form-layout.ts
 *
 * 24 栅格行列算法、折叠逻辑、按钮位置计算全部复用 @es-plus/core 纯函数，
 * 本文件仅保留 Vue 响应式（computed/ref/watch）包装层。
 */
import { computed, ref, watch } from 'vue'
import type { FormItemOption, LayoutFormProps } from '../types'
import {
  resolveFormLayProps,
  getRowColsAlgorithm as coreGetRowColsAlgorithm,
  shouldShowFoldButton,
  getBtnColSpan as coreGetBtnColSpan,
  applyFoldFlags,
  type FormItemOption as CoreFormItemOption,
} from '@es-plus/core'

export function useFormLayout(props: {
  layoutFormProps?: LayoutFormProps
  formItemList: FormItemOption[]
}) {
  const folded = ref(false)

  const isBtnHidden = computed(() =>
    resolveFormLayProps(props.layoutFormProps).isBtnHidden ?? false
  )

  const rowLayout = computed(() =>
    props.layoutFormProps?.rowLayProps || { gutter: 20 }
  )

  const formLayout = computed(() =>
    resolveFormLayProps(props.layoutFormProps)
  )

  const getSetOptionsStatus = computed(() =>
    props.layoutFormProps?.setOptions
  )

  const getRowColsAlgorithm = computed(() =>
    coreGetRowColsAlgorithm(props.formItemList as unknown as CoreFormItemOption[])
  )

  const isFold = computed(() => {
    const minFoldRow = (resolveFormLayProps(props.layoutFormProps).minFoldRows as number) || 0
    return shouldShowFoldButton(getRowColsAlgorithm.value, minFoldRow)
  })

  const getBtnColSpan = computed(() => {
    const btnColSpan = (resolveFormLayProps(props.layoutFormProps).btnColSpan as number) || 0
    return coreGetBtnColSpan(getRowColsAlgorithm.value, props.formItemList as unknown as CoreFormItemOption[], folded.value, btnColSpan)
  })

  const formItem = computed(() => {
    const minFoldRow = (resolveFormLayProps(props.layoutFormProps).minFoldRows as number) || 0
    return applyFoldFlags(props.formItemList as unknown as CoreFormItemOption[], getRowColsAlgorithm.value, folded.value, minFoldRow) as unknown as (FormItemOption & { isFold: boolean })[]
  })

  watch(isFold, (val) => { folded.value = val }, { immediate: true })

  const changeFolded = () => { folded.value = !folded.value }

  return {
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
  }
}
