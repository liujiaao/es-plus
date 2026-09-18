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
    if (isDark.value) {
      document.documentElement.classList.add('dark')
    } else {
      document.documentElement.classList.remove('dark')
    }
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
