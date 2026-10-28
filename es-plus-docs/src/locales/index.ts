import { watch } from 'vue'
import { createI18n } from 'vue-i18n'
import zhCN from './zh-CN.json'
import enUS from './en-US.json'

const i18n = createI18n({
  legacy: false,
  locale: localStorage.getItem('language') || 'zh-CN',
  fallbackLocale: 'zh-CN',
  messages: {
    'zh-CN': zhCN,
    'en-US': enUS
  }
})

/**
 * `<html lang>` 必须跟着语言走。
 *
 * index.html 里静态写着 `lang="zh-CN"`，而这一站是双语的：切到 EN（或直接带着
 * `localStorage.language=en-US` 进来）时它是英文正文、声明却是中文 —— 屏幕阅读器会用
 * 中文音库念整页英文，这也是「声明与内容不符」那条检查判红的地方。两个子站是中文单站，
 * 静态 zh-CN 就是正确的，不需要这一步。
 */
const applyHtmlLang = (lang: string) => {
  // 构建期预渲染在 Node 里跑，没有 document
  if (typeof document !== 'undefined') document.documentElement.lang = lang
}
applyHtmlLang(i18n.global.locale.value)
watch(i18n.global.locale, applyHtmlLang)

export default i18n
