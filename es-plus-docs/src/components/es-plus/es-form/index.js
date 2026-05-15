import EsForm from './src/es-form.vue'
import dialogInstantce from '../es-dialog/src/utils/useDialog'

EsForm.install = function (Vue) {
  Vue.component(EsForm.name, EsForm)
}

EsForm.isPlugin = true
EsForm.Plugin = {
  install(app, options) {
    /***
     * 
     * 编写插件函数，它接受 app 实例和 options 参数。

      使用 app.provide 或 app.config.globalProperties 来注入选项。

      使用 app.directive() 或 app.mount 等方法来添加全局功能。
     */
    // 依赖注入
    app.provide('$esPlusForm', {
      ...options.methods,
      dialogInstantce: () => dialogInstantce()
    })
    app.component(EsForm.name, { ...EsForm, methods: { ...EsForm.methods, ...(options.methods || {}), dialogInstantce: () => dialogInstantce() } })
  }
}
export default EsForm
