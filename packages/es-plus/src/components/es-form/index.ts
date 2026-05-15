import EsForm from './src/es-form.vue'
import useDialog from '../es-dialog/src/use-dialog'

EsForm.install = function (app: any) {
  app.component(EsForm.name, EsForm)
}

EsForm.isPlugin = true
EsForm.Plugin = {
  install(app: any, options: any = {}) {
    app.provide('$esPlusForm', {
      ...options.methods,
      useDialog: () => useDialog()
    })
    app.component(EsForm.name, { ...EsForm, methods: { ...EsForm.methods, ...(options.methods || {}), useDialog: () => useDialog() } })
  }
}

export default EsForm
