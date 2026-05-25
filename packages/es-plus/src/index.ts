import { version } from '../package.json'
import EsDialog from './components/es-dialog'
import useDialog from './components/es-dialog/src/use-dialog'
import EsForm from './components/es-form'
import EsTable from './components/es-table'
import EsCrudPage from './components/es-crud-page'
import SvgIcon from './components/svg-icon'

// 组件列表
const components = [EsDialog, EsForm, EsTable, EsCrudPage, SvgIcon]

// Vue 3 插件安装函数
const install = (app: any, options: Record<string, unknown> = {}) => {
  // 自动导入模式下跳过组件全局注册，避免重复注册
  if (!options.skipComponentRegistration) {
    components.forEach((component) => {
      if (component.name) {
        app.component(component.name, component)
      }
    })
  }

  if (options.globalProperties !== false) {
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
  install
}

// 类型导出
export type { CrudPageSchema, CrudAction } from './components/es-crud-page'
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

// 默认导出
export default {
  version,
  install
}