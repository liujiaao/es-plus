import EsCrudPage from './src/es-crud-page.vue'

EsCrudPage.install = (app: any) => {
  app.component(EsCrudPage.name || 'EsCrudPage', EsCrudPage)
}

export { EsCrudPage }
export type { CrudPageSchema } from './src/es-crud-page.vue'
export default EsCrudPage
