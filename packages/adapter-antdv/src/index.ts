/**
 * @es-plus/adapter-antdv 入口文件
 *
 * Ant Design Vue 4.x 适配器 — 配置驱动企业级组件
 * 与 @es-plus/vue3 共享相同的 JSON schema (@es-plus/core)
 *
 * Plugin 安装模式完全对齐 vue3：
 * - per-component Plugin 展开 options.methods 至 provide
 * - install() 内部自动调用 configureEsPlus 写入模块单例
 */
import type { App } from 'vue'

// ─── Components ─────────────────────────────────────
import EsTableComp from './components/es-table'
import EsFormComp from './components/es-form'
import EsDialogComp from './components/es-dialog'
import useDialogOrig from './components/es-dialog/src/use-dialog'
import EsCrudPageComp from './components/es-crud-page'
import SvgIconComp from './components/svg-icon'
import { configureEsPlus as configureEsPlusCore } from './config'
import type { EsPlusOptions } from './types'

const version = '1.0.0'

// ─── Per-component Plugin (完全对齐 vue3 的 methods 展开模式) ──

;(EsTableComp as any).isPlugin = true
;(EsTableComp as any).Plugin = {
  install(app: App, options: Record<string, unknown> = {}) {
    // 展开 methods 层：用户配置 { methods: { $httpRequest, ... } } → provide 为 { $httpRequest, ... }
    app.provide('$esPlusTable', { ...(options.methods || {}) })
  },
}

;(EsFormComp as any).isPlugin = true
;(EsFormComp as any).Plugin = {
  install(app: App, options: Record<string, unknown> = {}) {
    app.provide('$esPlusForm', {
      ...(options.methods || {}),
      useDialog: () => useDialogOrig(),
    })
  },
}

// EsDialog 没有 Plugin (同 vue3)

// ─── 组件列表 ───────────────────────────────────────
const components = [
  EsDialogComp,
  EsFormComp,
  EsTableComp,
  EsCrudPageComp,
  SvgIconComp,
]

// ─── 插件安装 (完全对齐 vue3) ────────────────────────
const install = (app: App, options: EsPlusOptions = {}) => {
  // 写入模块级单例
  configureEsPlusCore(options)

  // 组件全局注册
  if (!options.skipComponentRegistration) {
    components.forEach((component: any) => {
      if (component.name) {
        app.component(component.name, component)
      }
    })
  }

  // 全局属性 + per-component Plugin 注册
  if (options.globalProperties !== false) {
    app.config.globalProperties.$useDialog = useDialogOrig

    components.forEach((component: any) => {
      if (component.isPlugin && component.Plugin) {
        app.use(component.Plugin, options[component.name] || {})
      }
    })
  }

  // provide 全局注入
  app.provide('$EsPlus', {
    useDialog: useDialogOrig,
    ...options,
  })
}

// ─── 命名导出 ───────────────────────────────────────
export { EsTableComp as EsTable }
export { EsFormComp as EsForm }
export { EsDialogComp as EsDialog }
export { useDialogOrig as useDialog }
export { EsCrudPageComp as EsCrudPage }
export { SvgIconComp as SvgIcon }
export { configureEsPlusCore as configureEsPlus }
export type { CrudPageSchema } from './components/es-crud-page'
export type {
  FormItemOption, ApiParams, BtnConfig, LayoutFormProps,
  TableColumn, TableOptions, PaginationConfig, DialogOptions,
  EsFormInstance, EsTableInstance, EsPlusOptions, ListenToCallBack,
} from './types'

export default { version, install }
