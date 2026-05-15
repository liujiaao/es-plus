import { defineStore } from 'pinia'
import { ref, watch } from 'vue'

export const useThemeStore = defineStore('theme', () => {
  const isDark = ref(false)
  const language = ref('zh-CN')
  
  // 初始化从 localStorage 读取主题设置
  const initTheme = () => {
    const savedTheme = localStorage.getItem('theme')
    if (savedTheme) {
      isDark.value = savedTheme === 'dark'
    } else {
      // 检查系统主题
      isDark.value = window.matchMedia('(prefers-color-scheme: dark)').matches
    }
    applyTheme()
  }
  
  // 应用主题到 html 标签
  const applyTheme = () => {
    if (isDark.value) {
      document.documentElement.classList.add('dark')
    } else {
      document.documentElement.classList.remove('dark')
    }
  }
  
  // 切换主题
  const toggleTheme = () => {
    isDark.value = !isDark.value
    localStorage.setItem('theme', isDark.value ? 'dark' : 'light')
    applyTheme()
  }
  
  // 设置语言
  const setLanguage = (lang: string) => {
    language.value = lang
    localStorage.setItem('language', lang)
  }
  
  // 初始化语言
  const initLanguage = () => {
    const savedLang = localStorage.getItem('language')
    if (savedLang) {
      language.value = savedLang
    }
  }
  
  // 监听主题变化
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
