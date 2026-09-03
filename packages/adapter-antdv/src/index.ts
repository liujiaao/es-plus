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
import EsErrorBoundaryComp from './components/es-error-boundary'
import SvgIconComp from './components/svg-icon'
import { configureEsPlus as configureEsPlusCore } from './config'
// 全局 HTTP 请求自由函数：供 AI 生成的 CRUD 包装代码 import 后直接调用
import { httpRequest } from '@es-plus/core'
import type { EsPlusOptions } from './types'

// 与 vue3 一致：从 package.json 读取版本号
import { version } from '../package.json'

// isPlugin/Plugin 已下沉到各组件 index.ts（对齐 vue3 定义位置）

// EsDialog 没有 Plugin (同 vue3)

// ─── 组件列表 ───────────────────────────────────────
const components = [
  EsDialogComp,
  EsFormComp,
  EsTableComp,
  EsCrudPageComp,
  EsErrorBoundaryComp,
  SvgIconComp,
]

// ─── 插件安装 (完全对齐 vue3) ────────────────────────
const install = (app: App, options: EsPlusOptions = {}) => {
  // 写入模块级单例
  configureEsPlusCore(options)

  // 组件全局注册
  if (!(options as Record<string, unknown>).skipComponentRegistration) {
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
        app.use(component.Plugin, (options as Record<string, unknown>)[component.name] || {})
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
export { EsErrorBoundaryComp as EsErrorBoundary }
export { SvgIconComp as SvgIcon }
export { configureEsPlusCore as configureEsPlus }
export { httpRequest }
export { install }
// vxe 打印辅助（合并单元格打印），三端统一从 @es-plus/core 再导出
export { patchHtmlRowSpans } from '@es-plus/core'
export type { EsPlusGlobalConfig } from './config'
export type { CrudPageSchema, CrudPageProps, CrudPageEmits, CrudPageExpose } from './components/es-crud-page'
// ── 跨渲染器契约（须与 core/public-types PUBLIC_CONTRACT_TYPES 一致）──
// 配置类类型在 antdv 做 Ant Design Vue 特化，从本地 ./types 导出（形状兼容 core）
export type {
  FormItemOption, ApiParams, BtnConfig, LayoutFormProps,
  TableColumn, TableOptions, PaginationConfig, DialogOptions,
  EsFormInstance, EsTableInstance, EsPlusOptions,
} from './types'
// 框架无关契约类型三端一致，直接透传 @es-plus/core
export type {
  ModelData, RenderFn, AnyVNode, EsButtonType, EsButtonSize, EsTableSize,
  FormType, ConfigTableOut, ListenToCallBack, TableEngineExposed,
  VxeEditRender, VxeEditConfig, VxeExportConfig, VxeToolbarConfig, VxeColumnConfig,
  VxeKeyboardConfig, VxeMouseConfig, VxeClipboardConfig, VxeValidConfig, VxeFooterMethod,
  VxeTreeConfig, VxeProxyConfig, VxeExpandConfig, VxeSeqConfig,
} from '@es-plus/core'
// 对齐 vue3：导出 CRUD 高级类型
export type {
  CrudAction,
  CrudBtnConfig,
  OperationColumnConfig,
  RowBtnConfig,
  RowBtnContext,
  CrudDialogConfig,
  DialogRenderContext,
  DialogBtnConfig,
  DialogActionContext
} from './components/es-crud-page'

export default { version, install }
