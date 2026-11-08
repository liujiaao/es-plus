import { computed, ref, watch } from 'vue'

export interface ExampleItem {
  /** 分组名（数据里可选）。不填时整页不分组 —— 老页面表现完全不变 */
  group?: string
  key: string
  [field: string]: any
}

export interface ExampleGroup {
  name: string
  items: ExampleItem[]
}

/**
 * 示例分组：数据里给 `examples[].group` 填了名字才启用，按**首次出现顺序**排列。
 *
 * 为什么分组是数据字段而不是模板里的筛选：同一份 examples 同时供给案例卡
 * （cases.json）、搜索索引与锚点，分组只是排列方式，不该产生第二套 key。
 *
 * 只有两个以上分组才返回非空数组 —— 单组（或没填 group）时调用方照旧全量渲染，
 * 单示例组件（svg-icon / error-boundary）不会多出一排只有一个按钮的标签条。
 *
 * @param examples 当前文档的 examples 数组（响应式来源）
 * @param hash     当前路由 hash 的取值函数（`#demo-<key>` 深链用）
 */
export function useExampleGroups(examples: () => ExampleItem[] | undefined, hash: () => string) {
  const groups = computed<ExampleGroup[]>(() => {
    const list = examples() || []
    if (!list.some((ex) => ex.group)) return []
    const order: string[] = []
    const byGroup = new Map<string, ExampleItem[]>()
    for (const ex of list) {
      const name = ex.group || '其他'
      if (!byGroup.has(name)) {
        byGroup.set(name, [])
        order.push(name)
      }
      byGroup.get(name)!.push(ex)
    }
    return order.length > 1 ? order.map((name) => ({ name, items: byGroup.get(name)! })) : []
  })

  const activeGroup = ref('')

  const visible = computed(() => {
    const list = examples() || []
    if (!groups.value.length) return list
    return groups.value.find((g) => g.name === activeGroup.value)?.items || []
  })

  /**
   * 深链优先：`#demo-<key>` 指向的示例可能不在默认分组里。先把分组切过去，
   * 元素才会在 DOM 里出现，`realignToHash` 随后才找得到落点 ——
   * 顺序反过来就是「滚动到一个还不存在的元素」，落空且不会自己重试。
   * 返回是否命中（没命中时调用方保持当前分组）。
   */
  function activateFromHash(current = hash()): boolean {
    const matched = /^#demo-(.+)$/.exec(String(current || ''))
    if (!matched) return false
    const group = groups.value.find((g) => g.items.some((ex) => ex.key === matched[1]))
    if (!group) return false
    if (activeGroup.value !== group.name) activeGroup.value = group.name
    return true
  }

  // 换组件 / 首次进入：默认第一组；带 #demo-<key> 时优先跟随深链
  watch(
    groups,
    (list) => {
      if (!list.length) {
        activeGroup.value = ''
        return
      }
      if (!activateFromHash()) activeGroup.value = list[0].name
    },
    { immediate: true },
  )

  const selectGroup = (name: string) => {
    activeGroup.value = name
  }

  return { groups, activeGroup, visible, activateFromHash, selectGroup }
}
