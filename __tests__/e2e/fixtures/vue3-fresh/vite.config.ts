import { defineConfig } from 'vite'
import vue from '@vitejs/plugin-vue'
import vueJsx from '@vitejs/plugin-vue-jsx'

export default defineConfig({
  // JSX plugin is required because cli's sfc mode emits `render: (h) => <X/>`
  // inside <script setup> — without the plugin esbuild's JS loader chokes on
  // the JSX syntax.
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
