import EsDialog from './es-dialog'
import useDialogInstantce from './es-dialog/src/utils/useDialog'
import EsForm from './es-form'
import EsTable from './es-table'
import svgIcons from './svgIcon'
import './style.js' // 导入样式

// 工具函数
const useDialog = (params, options) => {
  return useDialogInstantce(params, options)
}

// 组件列表
const components = [EsDialog, EsForm, EsTable, svgIcons]

// Vue 3 插件安装函数
const install = (app, options = {}) => {
  // 注册所有组件
  components.forEach(component => {
    if (component.name) {
      app.component(component.name, component)
    }
  })

  // 全局属性注入
  if (options.globalProperties !== false) {
    // 注入工具函数
    app.config.globalProperties.$useDialog = useDialog

    // 注入组件实例方法
    components.forEach(component => {
      if (component.isPlugin && component.Plugin) {
        app.use(component.Plugin, options[component.name] || {})
      }
    })
  }

  // 依赖注入
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
  svgIcons,
  useDialog,
  install
}

// 默认导出
export default {
  version: '1.0.0',
  install,
  // 保留兼容性
  importFnComponents: install
}
