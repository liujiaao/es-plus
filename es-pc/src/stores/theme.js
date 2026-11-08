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

export const applyTheme = () => {
  const root = document.documentElement
  root.classList.toggle('dark', isDark.value)
  root.style.colorScheme = isDark.value ? 'dark' : 'light'
  // vxe-table 4.x 不认 `dark` 类：暗色变量整块挂在 [data-vxe-ui-theme="dark"] 上
  root.setAttribute('data-vxe-ui-theme', isDark.value ? 'dark' : 'light')
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
