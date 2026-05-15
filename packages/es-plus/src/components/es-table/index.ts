import EsTable from './src/component.vue'

EsTable.install = function (app: any) {
  app.component(EsTable.name, EsTable)
}
EsTable.isPlugin = true
EsTable.Plugin = {
  install(app: any, options: any = {}) {
    app.provide('$esPlusTable', {
      ...(options.methods || {})
    })
    app.component(EsTable.name, { ...EsTable, methods: { ...EsTable.methods, ...(options.methods || {}) } })
  }
}
export default EsTable
