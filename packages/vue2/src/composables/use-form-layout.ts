/**
 * EsForm 布局 composable —— Vue 2 版本
 *
 * 与 Vue 3 版本的差异：
 *   - 仅 import 路径不同：从 'vue' 替换为 './vue-compat'，从本地 utils 替换为 '@es-plus/core'
 *   - 24 栅格行列分组算法 100% 复用 @es-plus/core 提供的 getRowColsAlgorithm
 *
 * 该 composable 不依赖任何 Element UI 组件，是纯逻辑层。
 */

import { computed, ref, watch } from '../vue-compat'
import {
  getRowColsAlgorithm as coreGetRowColsAlgorithm,
  type FormLayoutResult,
} from '@es-plus/core'
import type { FormItemOption, LayoutFormProps } from '@es-plus/core'

export interface UseFormLayoutProps {
  layoutFormProps?: LayoutFormProps
  /** 注意：调用方需保证此处是响应式来源（或用 getter 形式：`get formItemList() { ... }`） */
  formItemList: FormItemOption[]
}

export function useFormLayout(props: UseFormLayoutProps) {
  const folded = ref(false)

  /**
   * 隐藏按钮区字段名兼容：原 es-eui 使用 `isBtnHiden`（少一个 d，原始拼写错误），
   * 后续 schema/类型规范化为 `isBtnHidden`。两者都接受，原始拼写优先。
   */
  const isBtnHidden = computed(() => {
    const fromLay = props.layoutFormProps?.fromLayProps as Record<string, unknown> | undefined
    if (!fromLay) return false
    const legacy = fromLay.isBtnHiden
    const fixed = fromLay.isBtnHidden
    return Boolean(legacy ?? fixed ?? false)
  })
  /**
   * el-row 布局参数。
   *
   * 注意：Element UI v2 的 `el-row` 默认是 **浮动布局**（float-based），
   * 而 Element Plus 的 `el-row` 默认是 **flex 布局**。
   *
   * 浮动布局的问题：当不同 el-col 的高度不一致时（比如 Checkbox 组在窄屏下换成两行、
   * DatePicker 高度比 Switch 略高），后面的 el-col 会卡进高的列下方留白处，
   * 而不是干净地换行 —— 表现为「布局错乱」。
   *
   * 修复策略：默认使用 `type="flex"`，并通过 SFC 样式给 `.es-form .el-row--flex`
   * 加上 `flex-wrap: wrap`，让换行行为与 Element Plus 一致。用户若显式传入
   * `rowLayProps: { type: '' }` 仍可回退为浮动布局。
   */
  const rowLayout = computed(() => {
    const userProps = (props.layoutFormProps?.rowLayProps as Record<string, unknown>) || {}
    return {
      type: 'flex',
      gutter: 20,
      ...userProps,
    }
  })
  const formLayout = computed(() => props.layoutFormProps?.fromLayProps || {})
  const getSetOptionsStatus = computed(() => props.layoutFormProps?.setOptions)

  const getRowColsAlgorithm = computed<FormLayoutResult>(() =>
    coreGetRowColsAlgorithm(props.formItemList || [])
  )

  /**
   * 折叠行阈值字段名兼容：
   *   - 原 es-eui 使用小写 `minfoldRows`（fold 全小写）
   *   - 后续部分文档示例与 EsCrudPage schema 使用驼峰 `minFoldRows`
   * 这里两个都接受，原始小写优先（保持旧文档案例不改字面量即可工作）。
   */
  const getMinFoldRow = (): number => {
    const fromLay = props.layoutFormProps?.fromLayProps as Record<string, unknown> | undefined
    if (!fromLay) return 0
    const legacy = fromLay.minfoldRows
    const camel = fromLay.minFoldRows
    return Number(legacy ?? camel ?? 0) || 0
  }

  const isFold = computed(() => {
    const minFoldRow = getMinFoldRow()
    return minFoldRow > 0 && minFoldRow < getRowColsAlgorithm.value.rowNum
  })

  const getBtnColSpan = computed(() => {
    const { rowNum, columnRow } = getRowColsAlgorithm.value
    const lastColumn = columnRow[rowNum - 1] || []
    const btnColSpan = props.layoutFormProps?.fromLayProps?.btnColSpan || 0
    const totalSpan = lastColumn.reduce(
      (sum: number, idx: number) => sum + (props.formItemList[idx]?.span || 24),
      0
    )
    const hasSpan = 24 - totalSpan
    return !folded.value && btnColSpan <= hasSpan ? hasSpan : 24
  })

  const formItem = computed(() => {
    const minFoldRow = getMinFoldRow()
    const { columnNodeIndex } = getRowColsAlgorithm.value

    if (folded.value) {
      const lastFoldIndex =
        columnNodeIndex[minFoldRow - 1] ?? columnNodeIndex[columnNodeIndex.length - 1] ?? 9999
      return (props.formItemList || []).map((it: FormItemOption, index: number) => ({
        ...it,
        isFold: index > lastFoldIndex,
      }))
    }
    return (props.formItemList || []).map((it: FormItemOption) => ({ ...it, isFold: false }))
  })

  watch(
    isFold,
    (val: boolean) => {
      folded.value = val
    },
    { immediate: true }
  )

  const changeFolded = () => {
    folded.value = !folded.value
  }

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
