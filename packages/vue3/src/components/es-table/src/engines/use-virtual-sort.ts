import { ref } from 'vue'
import type { TableColumn } from '../../../../types'

export interface SortState {
  key: string
  order: 'asc' | 'desc'
}

/**
 * 虚拟表格排序状态机（**引擎自有**，不依赖 EL TableV2 回传的 order）。
 *
 * 为什么必须自己持状态：EL TableV2 的表头点击处理器（
 * `element-plus/es/components/table-v2/src/composables/use-columns.mjs:58-70`）这样算 order：
 *
 *     const { sortState, sortBy } = props
 *     let order = 'asc'
 *     if (isObject(sortState)) order = oppositeOrderMap[sortState[key]]
 *     else order = oppositeOrderMap[sortBy.order]
 *
 * es-plus 只透传 `sortBy`（`virtual-engine.vue` 的 `:sort-by="sortState"`），从未传
 * `sortState`，于是永远走 else 分支；而 `sortBy` 的默认值是 `{}`，首点与后续点击
 * `sortBy.order` 都是 `undefined` → `oppositeOrderMap[undefined]` 恒为 `undefined`。
 * 结果：`column-sort` 事件里 `order` **永远是 undefined**，引擎据此算出的 payload
 * 永远是 `order: null`（对外表现为排序事件不携带方向）；顺带 EL 的表头渲染也拿
 * `sortBy.order === undefined` 去算 `aria-sort`，于是 `aria-sort` 永久缺失。
 *
 * 状态机自己推进后，`sortBy` 里带上了真实的 'asc'/'desc'，这两个后果一并消失。
 *
 * 循环与 EL / Element UI 的表头点击语义一致：**同列 asc → desc → 取消；换列从 asc 起**。
 */
export function useVirtualSort() {
  const sortState = ref<SortState | undefined>(undefined)

  /**
   * 表头点击回调。
   *
   * 入参里的 `order` 被**刻意忽略**（保留在类型里只为兼容调用方与既有签名）：
   * 如上所述它在 es-plus 的用法下恒为 undefined，信它就会把状态机钉死在
   * `order: undefined`。方向完全由本状态机推进。
   */
  function onColumnSort({ key }: { key: string | number; order?: 'asc' | 'desc' }) {
    const k = String(key)
    const cur = sortState.value
    if (!cur || cur.key !== k) {
      // 换列（或首次点击）：一律从升序开始
      sortState.value = { key: k, order: 'asc' }
      return
    }
    // 同列：asc → desc → 取消
    sortState.value = cur.order === 'asc' ? { key: k, order: 'desc' } : undefined
  }

  function toSortChangePayload(columns: TableColumn[]) {
    const key = sortState.value?.key || ''
    const order = sortState.value?.order || ''
    const col = columns.find(c => (c.prop || c.key) === key)
    return {
      column: col || null,
      prop: key,
      order: order === 'asc'
        ? 'ascending'
        : order === 'desc'
          ? 'descending'
          : null,
    }
  }

  return { sortState, onColumnSort, toSortChangePayload }
}
