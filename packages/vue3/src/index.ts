import { version } from '../package.json'
import EsDialog from './components/es-dialog'
import useDialog from './components/es-dialog/src/use-dialog'
import EsForm from './components/es-form'
import EsTable from './components/es-table'
import EsCrudPage from './components/es-crud-page'
import SvgIcon from './components/svg-icon'
import { configureEsPlus } from './config'
// 全局 HTTP 请求自由函数：供 AI 生成的 CRUD 包装代码 import 后直接调用
import { httpRequest } from '@es-plus/core'

// 组件列表
const components = [EsDialog, EsForm, EsTable, EsCrudPage, SvgIcon]

// Vue 3 插件安装函数
const install = (app: any, options: Record<string, unknown> = {}) => {
  // 写入模块级单例，确保自动导入模式也能获取全局配置
  configureEsPlus(options as any)

  // globalProperties 模式下，带独立 Plugin 的组件（EsForm/EsTable）由下方 app.use(Plugin) 注册
  // （注入 methods / provide），此处若再普通注册会触发 "Component xxx has already been registered" 告警
  const willInstallPlugins = options.globalProperties !== false

  // 自动导入模式下跳过组件全局注册，避免重复注册
  if (!options.skipComponentRegistration) {
    components.forEach((component: any) => {
      if (!component.name) return
      if (willInstallPlugins && component.isPlugin && component.Plugin) return
      app.component(component.name, component)
    })
  }

  if (willInstallPlugins) {
    app.config.globalProperties.$useDialog = useDialog

    components.forEach((component: any) => {
      if (component.isPlugin && component.Plugin) {
        app.use(component.Plugin, options[component.name] || {})
      }
    })
  }

  app.provide('$EsPlus', {
    useDialog,
    ...options
  })
}

// 按需导出
export {
  EsDialog,
  EsForm,
  EsTable,
  EsCrudPage,
  SvgIcon,
  useDialog,
  configureEsPlus,
  httpRequest,
  install
}

// 类型导出（跨渲染器契约，须与 core/public-types PUBLIC_CONTRACT_TYPES 一致）
// CRUD 高级类型（渲染器特有，各包组件层定义）
export type {
  CrudPageSchema,
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
// 配置类类型在 vue3 做 Element Plus 特化，从本地 ./types 导出（形状兼容 core）
export type {
  FormItemOption,
  ApiParams,
  BtnConfig,
  LayoutFormProps,
  TableColumn,
  TableOptions,
  PaginationConfig,
  DialogOptions,
  EsFormInstance,
  EsTableInstance,
  EsPlusOptions
} from './types'
// 框架无关契约类型三端一致，直接透传 @es-plus/core
export type {
  ModelData,
  RenderFn,
  AnyVNode,
  EsButtonType,
  EsButtonSize,
  EsTableSize,
  FormType,
  ConfigTableOut,
  ListenToCallBack,
  VxeEditRender,
  VxeEditConfig,
  VxeExportConfig,
  VxeToolbarConfig,
  VxeColumnConfig,
  VxeKeyboardConfig,
  VxeMouseConfig,
  VxeClipboardConfig,
  VxeValidConfig,
  VxeFooterMethod,
  VxeTreeConfig,
  VxeProxyConfig,
  VxeExpandConfig,
  VxeSeqConfig,
  TableEngineExposed
} from '@es-plus/core'

// vxe-table 打印辅助（spanMethod + 动态合并场景）
export { patchHtmlRowSpans } from './utils/vxe-print-utils'

// 默认导出
export default {
  version,
  install
}