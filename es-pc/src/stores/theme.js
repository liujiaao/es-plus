/**
 * 深色主题（审计 P1-4 的 es-pc 腿）。
 *
 * 与主文档站同一套口径，不自造第二套：
 *   · 主题类名必须是 `dark` 挂在 <html> 上 —— Ant Design Vue 4 的暗色算法、
 *     vxe-table 的暗色变量、共享 docs-chrome.css 的 token 覆盖都以它为约定键；
 *   · localStorage 'theme' 优先，否则跟随系统（与 index.html 的首屏内联脚本逐字一致，
 *     check:dark-mode 会断言两处规则一致）；
 *   · 同时设 color-scheme 与 data-vxe-ui-theme，否则滚动条、原生控件、vxe 表格
 *     会留在亮色 —— 那正是审计说的「半黑半白」。
 *
 * 为什么不是 Pinia：本站没有引入 Pinia（依赖清单里没有），为一个布尔值加一个
 * 状态库不划算。模块级 ref 就是单例，组件 import 到的是同一个 ref。
 */
import { ref, watch } from 'vue'

// 键名写成字面量而不是常量：index.html 的首屏脚本读的是同一个字面量，
// check:dark-mode 用「两处都出现 localStorage.getItem('theme')」来断言规则一致 ——
// 抽成常量后这条锚点会静默失效（守卫变绿，但两处规则其实可以漂移）。
export const isDark = ref(false)

/**
 * 「主题已应用」的登记处 —— 给**惰性加载**的第三方主题用。
 *
 * vxe-table / vxe-pc-ui 在模块求值时就无条件 `setTheme('light')`
 * （vxe-pc-ui/packages/components.ts 底部），把首屏脚本与 initTheme 挂好的
 * data-vxe-ui-theme 覆盖回亮色。本站 vxe 是懒加载的，覆盖发生在主题落定之后，
 * 结果就是 /es-vxe-table 永远整块白。vxe-install 加载完在这里登记一次，
 * 之后每次切换主题都会重设它 —— 但 theme.js 不能反过来静态引 vxe（会把它拉回首屏）。
 */
const appliedListeners = new Set()

/** 登记回调并立刻用当前主题调一次 */
export const onThemeApplied = (fn) => {
  appliedListeners.add(fn)
  fn(isDark.value)
}

export const applyTheme = () => {
  const root = document.documentElement
  root.classList.toggle('dark', isDark.value)
  root.style.colorScheme = isDark.value ? 'dark' : 'light'
  // vxe-table 4.x 不认 `dark` 类：暗色变量整块挂在 [data-vxe-ui-theme="dark"] 上
  root.setAttribute('data-vxe-ui-theme', isDark.value ? 'dark' : 'light')
  appliedListeners.forEach((fn) => fn(isDark.value))
}

export const initTheme = () => {
  const saved = localStorage.getItem('theme')
  isDark.value = saved
    ? saved === 'dark'
    : window.matchMedia('(prefers-color-scheme: dark)').matches
  applyTheme()
}

export const toggleTheme = () => {
  isDark.value = !isDark.value
  localStorage.setItem('theme', isDark.value ? 'dark' : 'light')
}

watch(isDark, applyTheme)
