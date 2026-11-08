import { nextTick, ref, watch } from 'vue'
import { notifyTocChanged } from '@/utils/doc-chrome.js'

/**
 * 手写 section 页的分组切换（es-pc 的 /es-form、/es-table）。
 *
 * 与主站 `useExampleGroups` 的区别：主站的示例是数据数组（`examples[].group`），
 * 分组只是排列方式；这一站的正文是**手写的模板块**（19 个 `<section id>` + 中间的
 * 分割线），没有可供分组的数据源。于是分组声明放在页面里，模板逐个 section 问
 * `isActive('basics')` —— 声明与模板必须同步，`scripts/check-section-groups.mjs`
 * 静态核对两边（漏一个 section、写错 key、id 撞车都会红）。
 *
 * ## 为什么只渲染当前组（v-if）而不是 v-show
 *
 * 这一页的问题是**长度**（/es-table 分组前 17,910px）。v-show 能让高度归零，
 * 但目录（collectHeadings）会扫到隐藏的 h2，点进去滚到一个 display:none 的元素，
 * 滚动落点直接失效；v-if 则让 DOM 与目录都只剩当前组，代价是切组时重建示例。
 *
 * ## 锚点
 *
 * 深链 `#dialog` 指向的可能是不在默认组里的 section：先把组切过去（DOM 才会出现），
 * 再由 `realignToHash` 二次对准（见 utils/doc-anchor.js）。顺序反过来就是滚一个
 * 还不存在的元素，落空且不会自己重试。
 *
 * @param {{ key: string, name: string, ids: string[] }[]} groups 分组声明，顺序即标签顺序
 * @param {() => string} hash 当前路由 hash 的取值函数
 */
export function useSectionGroups(groups, hash) {
  const declared = groups.map((g) => ({ ...g, ids: [...g.ids] }))

  // 一个 section 只能属于一个组：撞车时后者会静默覆盖前者，标签数也会对不上
  const groupOfId = new Map()
  for (const group of declared) {
    for (const id of group.ids) {
      if (groupOfId.has(id)) {
        console.warn(`[useSectionGroups] section "${id}" 同时出现在两个分组里，模板只能渲染其中一个`)
      }
      groupOfId.set(id, group.key)
    }
  }

  const tabs = declared.map(({ key, name, ids }) => ({ key, name, count: ids.length }))
  const activeGroup = ref(declared[0] ? declared[0].key : '')

  /** 模板用：这一组是不是当前显示的组 */
  const isActive = (key) => activeGroup.value === key

  /** section id → 组 key；不在任何组里时返回空串（守卫会拦，运行时按「不渲染」处理） */
  const groupOf = (id) => groupOfId.get(id) || ''

  /**
   * 深链优先：`#<section id>` 指向的 section 可能在别的组。先把组切过去，
   * 元素才会出现。返回是否命中（没命中时保持当前组）。
   */
  function activateFromHash(current) {
    const raw = String(current || '').replace(/^#/, '')
    let id = raw
    try {
      id = decodeURIComponent(raw)
    } catch {
      // 非法转义按原样查
    }
    const key = groupOfId.get(id)
    if (!key) return false
    if (activeGroup.value !== key) activeGroup.value = key
    return true
  }

  function selectGroup(key) {
    if (!declared.some((g) => g.key === key)) return
    activeGroup.value = key
  }

  // 首次进入就按深链定组（同步做，第一帧就渲染对的那一组，不会先闪一下默认组）
  activateFromHash(hash ? hash() : '')

  // 切组 = 正文换了一批标题：目录要跟着重建，否则点目录项会指向已经不存在的 id
  watch(activeGroup, async () => {
    await nextTick()
    notifyTocChanged()
  })

  return { groups: tabs, activeGroup, isActive, groupOf, activateFromHash, selectGroup }
}
