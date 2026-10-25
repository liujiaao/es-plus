/**
 * 页内锚点「二次对准」。
 *
 * 组件 / 进阶文档页的示例是 `defineAsyncComponent`（惰性编译重型 vxe/JSX 示例，
 * 否则首次进页面要一口气编译全部示例）。于是带 `#demo-xxx` 进来时，
 * 路由的 `scrollBehavior` 在示例还是一片空占位符时就滚完了；等真实内容撑开，
 * 目标元素已经被推到下面 —— 实测落点偏 500–3000px，看起来像「链接没落到内容上」。
 *
 * 这里在页面挂载后盯一小段时间（最多 3s）：落点没对上就重新对准，
 * 一旦用户自己滚动 / 按键就立刻收手，不跟用户抢滚动条。
 *
 * 为什么不用 ResizeObserver：要盯的是「目标元素的文档坐标」，而它会被
 * **任意一个**上方示例的加载改变 —— 观察整个列表比逐帧读一次 rect 更绕。
 */

/** 顶部固定栏高度：与 router 里 scrollBehavior 的 top 偏移保持一致 */
export const ANCHOR_OFFSET = 88

const STOP_EVENTS = ['wheel', 'touchstart', 'keydown', 'pointerdown'] as const

export function realignToHash(hash: string): () => void {
  const id = decodeURIComponent(hash.replace(/^#/, ''))
  if (!id) return () => {}

  const deadline = Date.now() + 6000
  let stopped = false
  let lastTop: number | null = null
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
      if (Math.abs(top - ANCHOR_OFFSET) > 4 && steadyFrames >= 2) {
        window.scrollTo({ top: window.scrollY + top - ANCHOR_OFFSET })
      }
      // 内容长完了（连续 60 帧 ≈ 1s 没动）：没必要再盯
      if (steadyFrames >= 60) return stop()
    }
    requestAnimationFrame(tick)
  }
  requestAnimationFrame(tick)

  return stop
}
