/// <reference types="vite/client" />

declare module '*.vue' {
  import type { DefineComponent } from 'vue'
  const component: DefineComponent<{}, {}, any>
  export default component
}

declare module '@es-plus/style.css'

/**
 * 构建期注入的「最后更新」映射（scripts/doc-meta.mjs → vite define）。
 * 找不到 git 时也可能是空表；运行时统一用 `typeof __ES_DOC_META__ === 'undefined'`
 * 判断后再取值，别假定它一定存在（测试环境没有 vite define）。
 */
declare const __ES_DOC_META__: Record<string, string> | undefined

interface ImportMetaEnv {
  readonly VITE_APP_TITLE: string
  readonly VITE_APP_DEFAULT_LANG: string
  readonly VITE_USE_DIST: string
}

interface ImportMeta {
  readonly env: ImportMetaEnv
}
