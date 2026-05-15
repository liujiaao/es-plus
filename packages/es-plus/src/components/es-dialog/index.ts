import EsDialog from './src/component.vue'

EsDialog.install = function (app: any) {
  app.component(EsDialog.name, EsDialog)
}

export default EsDialog
