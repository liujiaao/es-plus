import EsCrudPage from './src/es-crud-page.vue'

EsCrudPage.install = function (app: any) {
  app.component(EsCrudPage.name, EsCrudPage)
}

export default EsCrudPage
export type { CrudPageSchema, CrudAction, CrudPageProps, CrudPageEmits, CrudPageExpose } from './src/types'
