/**
 * ES-Plus 文档 chrome 行为（三站共用，无框架依赖）
 *
 * 单一权威源：docs/theme/doc-chrome.js → scripts/sync-theme.mjs 分发到
 * es-plus-docs / es-pc / es-eui 的 src/utils/doc-chrome.js，禁止手改各站点副本。
 *
 * 为什么做成共享的纯函数而不是各站一份：三站此前各写一遍 TOC 扫描与高亮，
 * 结果是有 TOC 的那一站只认 markdown 生成的 id、另两站根本没有 TOC。行为只有一份，
 * 才不会在「哪一页有目录、高亮到哪一节」这种问题上又分叉。
 *
 * 约定：目录只收 H2/H3（与 docs-chrome.css 的 .es-doc-toc 一致）。
 */

const HEADING_SELECTOR = 'h2, h3'

/** 标题文本 → 锚点 id：保留中英文与数字，其余折叠成单个连字符。 */
export function slugifyHeading(text) {
  return String(text || '')
    .trim()
    .toLowerCase()
    .replace(/[\s　]+/g, '-')
    .replace(/[^\w一-龥-]+/g, '')
    .replace(/-{2,}/g, '-')
    .replace(/^-+|-+$/g, '')
}

/**
 * 收集正文里的 H2/H3，给没有 id 的标题补上（幂等：已有 id 一律保留）。
 *
 * 组件站的页面是手写 SFC，标题没有 markdown 渲染器来发号；在布局层统一补 id，
 * 目录与「复制这一节的链接」才能工作，而且不用改二十几个页面文件。
 *
 * @returns {{ id: string, text: string, level: number, el: HTMLElement }[]}
 */
export function collectHeadings(root, selector = HEADING_SELECTOR) {
  if (!root || typeof root.querySelectorAll !== 'function') return []

  const used = new Set(
    Array.from(root.querySelectorAll('[id]'))
      .map((el) => el.id)
      .filter(Boolean)
  )

  const headings = []
  root.querySelectorAll(selector).forEach((el) => {
    const text = (el.textContent || '').replace(/\s+/g, ' ').trim()
    if (!text) return

    if (!el.id) {
      const base = slugifyHeading(text) || 'section'
      let id = base
      let n = 2
      // 同一页里可能有同名小节（「示例」「配置」），后缀递增直到不撞
      while (used.has(id)) id = `${base}-${n++}`
      el.id = id
    }
    used.add(el.id)

    headings.push({
      id: el.id,
      text,
      level: Number(el.tagName.replace(/\D/g, '')) || 2,
      el,
    })
  })

  return headings
}

/**
 * 滚动高亮：算出当前阅读到哪一节，变化时回调 id。
 *
 * 用滚动位置 + rAF 节流，而不是 IntersectionObserver：三站同一份实现、同一套
 * 边界行为（阈值就是一条 88px 线），且「滚到页底时高亮最后一节」这类兜底
 * 在 IO 里需要额外拼一个哨兵元素才能做到。
 *
 * @param {{ id: string, el: HTMLElement }[]} headings
 * @param {{ onChange?: (id: string) => void, offset?: number }} options
 * @returns {{ stop: () => void, focus: (id: string) => void }}
 */
export function createScrollSpy(headings, { onChange, offset = 88 } = {}) {
  if (typeof window === 'undefined') return { stop() {}, focus() {} }

  const items = (headings || []).filter((h) => h && h.el)
  if (!items.length) return { stop() {}, focus() {} }

  let active = ''
  let frame = 0
  let settle = 0
  // 目录点击后「钉住」的那一节（见 focus）：平滑滚动途中经过的标题都不算数
  let pinned = ''
  let pinnedUntil = 0
  // 观察窗口：正文长高会让落点整体位移，而且**不一定有 scroll 事件**
  // （异步示例挂载完，Chrome 的滚动锚定直接改 scrollY）—— 这段时间内逐帧复核。
  let pollUntil = 0
  let lastHeight = 0
  // 钉住时标题位置的稳定帧数（用来判断「页面已经不动了，别再等」）
  let pinnedTop = null
  let pinnedSteady = 0

  const emit = (id) => {
    if (!id || id === active) return
    active = id
    if (onChange) onChange(id)
  }

  // 落点到位没有？标题顶边与 88px 线差 4px 以内就算到了。
  const pinnedState = () => {
    const el = document.getElementById(pinned)
    if (!el) return { settled: true, top: 0 }
    const top = Math.round(el.getBoundingClientRect().top)
    return { settled: Math.abs(top - offset) <= 4, top }
  }

  const compute = () => {
    frame = 0
    const now = Date.now()

    if (pinned) {
      const { settled, top } = pinnedState()
      if (top === pinnedTop) pinnedSteady += 1
      else {
        pinnedTop = top
        pinnedSteady = 0
      }
      // 三种收手时机：到落点了；标题压不到线但页面已经不动了（正文底部的小节）；
      // 以及硬超时（异步示例可能一直在长高，不能无限钉住）。
      if (settled || pinnedSteady >= 45 || now > pinnedUntil) {
        pinned = ''
        pinnedTop = null
        pinnedSteady = 0
      }
    }

    if (pinned) {
      // 还没到落点：一是平滑滚动还在路上，二是组件/进阶页的示例是异步组件，
      // 内容会边滚边长 —— 最后一个 scroll 事件完全可能发生在标题挪到位之前。
      // 光等事件不够，逐帧再看到位为止（超时兜底在 focus 里，不会空转）。
      frame = requestAnimationFrame(compute)
      return
    }

    let current = items[0].id
    for (const h of items) {
      // 取整再比：锚点落点会有亚像素残差（88.4px），而落点校正本身允许 ±4px，
      // 直接拿小数比较会把「已经到位」的标题判成还没到，高亮卡在上一节。
      if (Math.round(h.el.getBoundingClientRect().top) - offset <= 0) current = h.id
      else break
    }
    // 滚到底：最后一节往往没有机会滚到 88px 线以上，不兜底就永远高亮倒数第二节
    const doc = document.documentElement
    if (window.innerHeight + window.scrollY >= doc.scrollHeight - 2) {
      current = items[items.length - 1].id
    }
    emit(current)

    // 观察窗口内继续逐帧复核：落点到位了，正文却还在长高（异步示例陆续挂载），
    // 高亮会又滑走；而这时已经没有 scroll 事件可等了。每长高一次再续一小段，
    // 总时长封顶（见 poke），不会为了一直在动的页面无限空转。
    const height = doc.scrollHeight
    if (height !== lastHeight) {
      lastHeight = height
      poke(2000)
    }
    if (now < pollUntil) frame = requestAnimationFrame(compute)
  }

  /** 续一段观察窗口（最多续到「现在 + 8s」，防止一直在长高的页面把 rAF 占死）。 */
  const poke = (ms) => {
    const cap = Date.now() + 8000
    pollUntil = Math.min(Math.max(pollUntil, Date.now() + ms), cap)
  }

  const schedule = () => {
    if (!frame) frame = requestAnimationFrame(compute)
    // 最后一次 scroll 事件之后页面还可能继续长高 / 被滚动锚定位移，
    // 那一次没有事件可等 —— 用观察窗口兜住。
    poke(1200)
    // 平滑滚动（路由 scrollBehavior / 目录点击）的最后一帧之后，rAF 回调可能已经
    // 跑在落点之前 —— 高亮会停在上一节，直到用户再动一下滚轮。补一次「停稳后再算」。
    if (settle) clearTimeout(settle)
    settle = setTimeout(compute, 120)
  }

  // 用户自己动手（滚轮 / 触摸）就立刻交还控制权，不跟人抢高亮
  const unpin = () => {
    pinned = ''
    pinnedTop = null
    pinnedSteady = 0
    pollUntil = 0
  }

  window.addEventListener('scroll', schedule, { passive: true })
  window.addEventListener('resize', schedule)
  window.addEventListener('wheel', unpin, { passive: true })
  window.addEventListener('touchstart', unpin, { passive: true })
  compute()

  return {
    /**
     * 点击目录项：立刻把高亮交给用户点的那一节并钉住它，直到它真的滚到 88px 线
     * （或 2.5s 超时）。
     *
     * 不钉会怎样：6000px 的平滑滚动会依次点亮途中经过的四五节，看起来像高亮
     * 「追不上」鼠标；反过来，组件/进阶页的示例是异步组件，正文会边滚边长，
     * 最后一个 scroll 事件可能早于标题就位 —— 钉住 + 逐帧复核才能保证高亮
     * 落在用户点的那一节上。
     */
    focus(id) {
      if (!id) return
      pinned = id
      pinnedTop = null
      pinnedSteady = 0
      // 组件/进阶页的示例是异步组件，实测落点到位要 1.5s 起步、慢的时候 4s 以上；
      // 窗口给足，靠 pinnedSteady 提前收手，不靠时间猜。
      pinnedUntil = Date.now() + 8000
      poke(8000)
      emit(id)
      if (!frame) frame = requestAnimationFrame(compute)
    },
    stop() {
      window.removeEventListener('scroll', schedule)
      window.removeEventListener('resize', schedule)
      window.removeEventListener('wheel', unpin)
      window.removeEventListener('touchstart', unpin)
      if (frame) cancelAnimationFrame(frame)
      if (settle) clearTimeout(settle)
      frame = 0
      settle = 0
      pinned = ''
      pollUntil = 0
    },
  }
}

/**
 * 平滑滚到某个标题（不带 hash 的站点 —— 三站都是 hash 路由，正常应走
 * `<router-link :to="{ hash }">`，由路由的 scrollBehavior 负责；这里留给
 * 「已在当前 hash、再点一次目录项」这类不会触发路由跳转的场景）。
 */
export function scrollToHeading(id, { offset = 88 } = {}) {
  if (typeof document === 'undefined') return
  const el = typeof id === 'string' ? document.getElementById(id) : id
  if (!el) return
  window.scrollTo({ top: el.getBoundingClientRect().top + window.scrollY - offset, behavior: 'smooth' })
}
