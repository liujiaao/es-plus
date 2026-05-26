import EsCrudPage from './src/es-crud-page.vue'

EsCrudPage.install = function (app: any) {
  app.component(EsCrudPage.name, EsCrudPage)
}

export default EsCrudPage
export type {
  CrudPageSchema,
  CrudAction,
  CrudPageProps,
  CrudPageEmits,
  CrudPageExpose,
  CrudBtnConfig,
  TableBtnConfig,
  OperationColumnConfig,
  RowBtnConfig,
  RowBtnContext,
  CrudDialogConfig,
  DialogRenderContext,
  DialogBtnConfig,
  DialogActionContext
} from './src/types'
