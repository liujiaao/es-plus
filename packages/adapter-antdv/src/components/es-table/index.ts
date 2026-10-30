import EsTable from './src/component.vue'
import { createComponentConfigView } from '@es-plus/core'

EsTable.install = function (app: any) {
  app.component(EsTable.name || 'EsTable', EsTable)
}

EsTable.isPlugin = true
EsTable.Plugin = {
  install(app: any, options: any = {}) {
    // 读时透传单例里的 EsTable 档（install() 里已 configureEsPlus 写入并归一）；
    // 旧快照 `{ ...(options.methods || {}) }` 让 install 之后的 configureEsPlus 无效。
    app.provide('$esPlusTable', createComponentConfigView('EsTable'))
    app.component(EsTable.name || 'EsTable', {
      ...EsTable,
      methods: { ...EsTable.methods, ...(options.methods || {}) },
    })
  },
}

export { EsTable }
export default EsTable
