import EsCrudPage from './src/es-crud-page.vue'

EsCrudPage.install = (app: any) => {
  app.component(EsCrudPage.name || 'EsCrudPage', EsCrudPage)
}

export { EsCrudPage }
export type {
  CrudPageSchema,
  CrudAction,
  CrudBtnConfig,
  TableBtnConfig,
  OperationColumnConfig,
  RowBtnConfig,
  RowBtnContext,
  CrudDialogConfig,
  DialogRenderContext,
  DialogBtnConfig,
  DialogActionContext,
} from './src/types'
export default EsCrudPage
