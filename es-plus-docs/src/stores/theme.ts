import { defineStore } from 'pinia'
import { ref, watch } from 'vue'

/**
 * 「主题已应用」的登记处 —— 给**惰性加载**的第三方主题用。
 *
 * vxe-table / vxe-pc-ui 在模块求值时就无条件 `setTheme('light')`
 * （vxe-pc-ui/packages/components.ts 底部），把首屏脚本与 initTheme 挂好的
 * data-vxe-ui-theme 覆盖回亮色。本站 vxe 走懒加载（utils/vxe-loader.ts），覆盖发生在
 * 主题落定之后 —— 不重设的话 /advanced/vxe-table 在深色下仍是整块白（实测）。
 * 但 theme 这个 store 不能反过来静态 import vxe（会把它拉回到首屏）。
 */
const appliedListeners = new Set<(dark: boolean) => void>()

/**
 * 登记回调并**立刻**用当前主题调一次 —— 第一次调用就发生在 vxe 模块求值之后，
 * 拖到下一次 toggle 才纠正的话，这一页已经白着渲染完了。
 *
 * 立即调用读 DOM 上的 `dark` 类而不是 store 的 isDark：首屏内联脚本已经落定 DOM，
 * 而此处可能在 initTheme 之前被调用（模块求值顺序不由我们控制）。
 */
export const onThemeApplied = (fn: (dark: boolean) => void) => {
  appliedListeners.add(fn)
  fn(document.documentElement.classList.contains('dark'))
}

export const useThemeStore = defineStore('theme', () => {
  const isDark = ref(false)
  const language = ref('zh-CN')

  const initTheme = () => {
    const savedTheme = localStorage.getItem('theme')
    if (savedTheme) {
      isDark.value = savedTheme === 'dark'
    } else {
      isDark.value = window.matchMedia('(prefers-color-scheme: dark)').matches
    }
    applyTheme()
  }

  /**
   * 暗色类名必须是 `dark`：Element Plus（theme-chalk/dark/css-vars.css）、
   * vxe-table、ant-design-vue 的暗色主题都以 `dark` 挂在根元素为约定键。
   * 此前用自造的 `is-dark`，导致只有站点外壳吃到了 .is-dark 的 token 覆盖，
   * 而所有 el-* 组件（本页正文就是组件 demo）仍是亮色 —— 半残暗色。
   */
  const applyTheme = () => {
    const root = document.documentElement
    root.classList.toggle('dark', isDark.value)
    // 与 index.html 的首屏内联脚本同一件事：让浏览器自带控件跟随主题，
    // 否则深色页面里的滚动条/时间选择器仍是亮色
    root.style.colorScheme = isDark.value ? 'dark' : 'light'
    // vxe-table 的暗色变量挂在 [data-vxe-ui-theme="dark"] 上，不认 `dark` 类
    root.setAttribute('data-vxe-ui-theme', isDark.value ? 'dark' : 'light')
    // 惰性加载的 vxe 在模块求值时会把上面这行覆盖回 light，加载完与每次切换都要重设
    appliedListeners.forEach((fn) => fn(isDark.value))
  }

  const toggleTheme = () => {
    isDark.value = !isDark.value
    localStorage.setItem('theme', isDark.value ? 'dark' : 'light')
    applyTheme()
  }

  const setLanguage = (lang: string) => {
    language.value = lang
    localStorage.setItem('language', lang)
  }

  const initLanguage = () => {
    const savedLang = localStorage.getItem('language')
    if (savedLang) {
      language.value = savedLang
    }
  }

  watch(isDark, () => {
    applyTheme()
  })

  return {
    isDark,
    language,
    initTheme,
    initLanguage,
    toggleTheme,
    setLanguage
  }
})
