import EsTable from './src/component.vue'

EsTable.install = function (Vue) {
  Vue.component(EsTable.name, EsTable)
}
EsTable.isPlugin = true
EsTable.Plugin = {
  install(app, options) {
    /***
     * 
     * 编写插件函数，它接受 app 实例和 options 参数。

      使用 app.provide 或 app.config.globalProperties 来注入选项。

      使用 app.directive() 或 app.mount 等方法来添加全局功能。
     */
    app.provide('$esPlusTable', {
      ...(options.methods || {})
    })
    app.component(EsTable.name, { ...EsTable, methods: { ...EsTable.methods, ...(options.methods || {}) } })
  }
}
export default EsTable
