import { defineStore } from 'pinia'
import { ref, watch } from 'vue'

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
