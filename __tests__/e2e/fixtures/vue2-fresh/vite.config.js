import { defineConfig } from 'vite'
import vue from '@vitejs/plugin-vue2'
import vueJsx from '@vitejs/plugin-vue2-jsx'

export default defineConfig({
  // JSX plugin is required because structured sfc mode emits the dialog body as
  // `render: (h, { registerRef }) => <EsForm .../>` inside a `<script lang="tsx">`
  // block — without the Vue 2 JSX transform esbuild's ts loader chokes on the JSX
  // syntax (Expected ">" but found "ref"). Mirrors vue3-fresh's plugin-vue-jsx.
  plugins: [vue(), vueJsx()],
  build: {
    rollupOptions: {
      onwarn(warning, warn) {
        if (
          warning.code === 'UNRESOLVED_IMPORT' ||
          warning.code === 'MISSING_EXPORT'
        ) {
          throw new Error(`${warning.code}: ${warning.message}`)
        }
        warn(warning)
      },
    },
  },
})
