/**
 * 页内锚点「二次对准」（es-pc）。
 *
 * 主站 es-plus-docs/src/utils/hash-anchor.ts 解决的是「异步示例撑开把落点推走」；
 * 这一站解决的是**另一个**时序问题：分组页（/es-form、/es-table）默认只渲染
 * 当前分组，`#dialog` 这种指向别的分组的深链进来时，路由的 scrollBehavior 跑完
 * 那一刻目标 section 还不在 DOM 里 —— 于是「链接指对了页面，但停在页首」。
 *
 * 顺序必须是「先切组 → 等 DOM → 再对准」：切组是 Vue 的响应式更新，要等
 * nextTick；对准需要连续几帧观察，因为组里的示例（表格 / 下拉请求）会继续撑高。
 *
 * 与主站同一套收手规则：落点到 88px 线 ±4px 就停；用户一动手（滚轮 / 触摸 /
 * 按键 / 点击）立刻让位；最长 6s。
 */

/** 顶部固定栏高度：与 router 里 scrollBehavior 的 top 偏移保持一致 */
export const ANCHOR_OFFSET = 88

const STOP_EVENTS = ['wheel', 'touchstart', 'keydown', 'pointerdown']

/**
 * @param {string} hash 形如 `#dialog`；空串 / 不存在的 id 是空操作
 * @param {{ offset?: number }} [options] 落点距视口顶部的高度（默认 88 = 顶栏 + 留白；
 *   分组页的标签条是 sticky 的，要把标签条的高度也算进去）
 * @returns {() => void} 提前收手
 */
export function realignToHash(hash, { offset = ANCHOR_OFFSET } = {}) {
  const raw = String(hash || '').replace(/^#/, '')
  if (!raw) return () => {}
  let id = raw
  try {
    id = decodeURIComponent(raw)
  } catch {
    // 非法转义：按原样找，找不到就算了
  }
  if (!id) return () => {}

  const deadline = Date.now() + 6000
  let stopped = false
  let lastTop = null
  let steadyFrames = 0

  const stop = () => {
    if (stopped) return
    stopped = true
    for (const ev of STOP_EVENTS) window.removeEventListener(ev, stop)
  }
  for (const ev of STOP_EVENTS) window.addEventListener(ev, stop, { passive: true })

  const tick = () => {
    if (stopped) return
    if (Date.now() > deadline) return stop()
    const el = document.getElementById(id)
    if (el) {
      const top = Math.round(el.getBoundingClientRect().top)
      steadyFrames = top === lastTop ? steadyFrames + 1 : 0
      lastTop = top
      if (Math.abs(top - offset) > 4 && steadyFrames >= 2) {
        window.scrollTo({ top: window.scrollY + top - offset })
      }
      // 内容长完了（连续 60 帧 ≈ 1s 没动）：没必要再盯
      if (steadyFrames >= 60) return stop()
    }
    requestAnimationFrame(tick)
  }
  requestAnimationFrame(tick)

  return stop
}
