import EsDialog from './src/component.vue'

EsDialog.install = (app: any) => {
  app.component(EsDialog.name || 'EsDialog', EsDialog)
}

export { EsDialog }
export { useDialog } from './src/use-dialog'
export default EsDialog
