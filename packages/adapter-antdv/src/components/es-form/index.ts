import EsForm from './src/es-form.vue'

EsForm.install = (app: any) => {
  app.component(EsForm.name || 'EsForm', EsForm)
}

export { EsForm }
export default EsForm
