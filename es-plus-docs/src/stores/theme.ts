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

  const applyTheme = () => {
    if (isDark.value) {
      document.documentElement.classList.add('is-dark')
    } else {
      document.documentElement.classList.remove('is-dark')
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
