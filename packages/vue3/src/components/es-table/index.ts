import EsTable from './src/component.vue'
import { createComponentConfigView } from '@es-plus/core'

EsTable.install = function (app: any) {
  app.component(EsTable.name, EsTable)
}
EsTable.isPlugin = true
EsTable.Plugin = {
  install(app: any, options: any = {}) {
    // 读时透传单例里的 EsTable 档（install() 里已 configureEsPlus 写入并归一）。
    // 旧实现 `{ ...(options.methods || {}) }` 是**快照** —— install 之后再
    // configureEsPlus({ EsTable }) 一律无效，形成「先挂载再配置就没用」的顺序陷阱。
    app.provide('$esPlusTable', createComponentConfigView('EsTable'))
    // methods 仍合并进组件（保留「注入到组件 this」的旧能力）
    const methods = options.methods || {}
    app.component(EsTable.name, { ...EsTable, methods: { ...EsTable.methods, ...methods } })
  }
}
export default EsTable
