import type { App } from 'vue'
import {
  ElAlert,
  ElAvatar,
  ElButton,
  ElCheckbox,
  ElCheckboxGroup,
  ElCollapseTransition,
  ElDatePicker,
  ElDescriptions,
  ElDescriptionsItem,
  ElDialog,
  ElDropdown,
  ElDropdownItem,
  ElDropdownMenu,
  ElEmpty,
  ElForm,
  ElFormItem,
  ElIcon,
  ElInput,
  ElProgress,
  ElRadioButton,
  ElRadioGroup,
  ElSelect,
  ElStep,
  ElSteps,
  ElSwitch,
  ElTable,
  ElTableColumn,
  ElTabPane,
  ElTabs,
  ElTag,
} from 'element-plus'
import * as ElementPlusIconsVue from '@element-plus/icons-vue'

import ESPlus from 'es-plus'
import i18n from '@/locales'
import { demoHttpRequest } from '@/utils/demo-http'

/**
 * 站点自己模板里用到的 Element Plus 组件 —— **只有这些会被打进产物**。
 *
 * 这里曾经是 `app.use(ElementPlus)`（全量注册，356.2 KB gz）。站点自己的模板只用到
 * 这 29 个标签，剩下的几百个组件跟着每一页下载；而 `@es-plus/*` 的组件内部是直接
 * `import { ElTable } from 'element-plus'` 的，从不依赖全局注册。
 *
 * 失败模式是「页面看起来正常、某个组件突然不渲染」，所以维护它不能靠人：
 * `npm run check:bundle-sources` 会扫全部 `.vue` 模板里的 `<el-xxx>` 标签，
 * **有一个不在这张表里就红**。新增标签时把组件加进来，别改回 `app.use(ElementPlus)`。
 *
 * 注意 `el-radio-button` / `el-descriptions-item` / `el-dropdown-item` / `el-tab-pane` /
 * `el-table-column` / `el-form-item` / `el-step` 在 element-plus 里都是**独立组件**，
 * 不会因为注册了父组件就可用 —— 少一个就是整列/整项消失。
 */
export const ELEMENT_PLUS_COMPONENTS: Record<string, unknown> = {
  ElAlert,
  ElAvatar,
  ElButton,
  ElCheckbox,
  ElCheckboxGroup,
  ElCollapseTransition,
  ElDatePicker,
  ElDescriptions,
  ElDescriptionsItem,
  ElDialog,
  ElDropdown,
  ElDropdownItem,
  ElDropdownMenu,
  ElEmpty,
  ElForm,
  ElFormItem,
  ElIcon,
  ElInput,
  ElProgress,
  ElRadioButton,
  ElRadioGroup,
  ElSelect,
  ElStep,
  ElSteps,
  ElSwitch,
  ElTable,
  ElTableColumn,
  ElTabPane,
  ElTabs,
  ElTag,
}

// Install the same plugins as main.ts — Element Plus components, all icons, ES-Plus, i18n.
// Used by main.ts and by Doc.vue when mounting in-doc demo sub-apps so they
// share runtime context (component registration, default size, global config,
// translation strings used by shared components like CodePlayground).
//
// Pinia and router are intentionally NOT installed on demo sub-apps — examples
// don't need a store or routes, and reusing the parent ones would be a footgun.
//
// 默认尺寸（`size: 'small'`）以前由 `app.use(ElementPlus, { size })` 提供；全量注册去掉后
// 改由根组件的 `<el-config-provider size="small">` 提供 —— 示例子应用不在主应用的
// provide 链上，所以 Doc.vue 挂载时自己再包一层（见 views/Doc.vue 的 mountDemos）。
export function installAppPlugins(app: App) {
  for (const [name, component] of Object.entries(ELEMENT_PLUS_COMPONENTS)) {
    app.component(name, component as never)
  }
  // 图标仍然全量注册 —— 而且是**白给的**：`@es-plus/vue3` 自己 `import * as` 了整个图标包
  // （它的 Toolbar / 列设置等组件按名字取图标），所以这 293 个图标本来就在 chunk 里。
  // 实测把它删掉，产物一个字节不变（886.24 kB / 282.55 kB gz 两次构建完全相同），
  // 而站点确实有用**字符串**指定图标的地方（AppHeader 的主题/菜单切换、
  // advanced-doc.data 的 feature.icon）—— 删了只会让它们变空白。
  for (const [key, component] of Object.entries(ElementPlusIconsVue)) {
    app.component(key, component as never)
  }
  // 全局请求只在这一处配置：示例组件一律只声明 apiParams，不传 httpRequest。
  // 这正是「schema 可 JSON 序列化」的前提 —— 函数值进不了 JSON，只能来自入口。
  app.use(ESPlus, { globalProperties: true, httpRequest: demoHttpRequest })
  app.use(i18n)
}
