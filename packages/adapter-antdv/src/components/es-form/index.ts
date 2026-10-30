import EsForm from './src/es-form.vue'
import useDialog from '../es-dialog/src/use-dialog'
import { createComponentConfigView } from '@es-plus/core'

EsForm.install = function (app: any) {
  app.component(EsForm.name || 'EsForm', EsForm)
}

EsForm.isPlugin = true
EsForm.Plugin = {
  install(app: any, options: any = {}) {
    // 读时透传单例里的 EsForm 档（install() 里已 configureEsPlus 写入并归一）；
    // 旧快照写法让 install 之后的 configureEsPlus({ EsForm }) 完全无效。
    app.provide('$esPlusForm', createComponentConfigView('EsForm', { useDialog: () => useDialog() }))
    app.component(EsForm.name || 'EsForm', {
      ...EsForm,
      methods: { ...EsForm.methods, ...(options.methods || {}), useDialog: () => useDialog() },
    })
  },
}

export { EsForm }
export default EsForm
