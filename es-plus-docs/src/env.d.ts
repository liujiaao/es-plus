/// <reference types="vite/client" />

declare module '*.vue' {
  import type { DefineComponent } from 'vue'
  const component: DefineComponent<{}, {}, any>
  export default component
}

declare module 'es-plus-ui/dist/style.css'

interface ImportMetaEnv {
  readonly VITE_APP_TITLE: string
  readonly VITE_APP_DEFAULT_LANG: string
  readonly VITE_USE_DIST: string
}

interface ImportMeta {
  readonly env: ImportMetaEnv
}
