import type { App } from 'vue'
import ElementPlus from 'element-plus'
import * as ElementPlusIconsVue from '@element-plus/icons-vue'
import ESPlus from 'es-plus'
import i18n from '@/locales'
import { demoHttpRequest } from '@/utils/demo-http'

// Install the same plugins as main.ts — Element Plus, all icons, ES-Plus, i18n.
// Used by main.ts and by Doc.vue when mounting in-doc demo sub-apps so they
// share runtime context (component registration, default size, global config,
// translation strings used by shared components like CodePlayground).
//
// Pinia and router are intentionally NOT installed on demo sub-apps — examples
// don't need a store or routes, and reusing the parent ones would be a footgun.
export function installAppPlugins(app: App) {
  for (const [key, component] of Object.entries(ElementPlusIconsVue)) {
    app.component(key, component as any)
  }
  app.use(ElementPlus, { size: 'small' })
  // 全局请求只在这一处配置：示例组件一律只声明 apiParams，不传 httpRequest。
  // 这正是「schema 可 JSON 序列化」的前提 —— 函数值进不了 JSON，只能来自入口。
  app.use(ESPlus, { globalProperties: true, httpRequest: demoHttpRequest })
  app.use(i18n)
}

