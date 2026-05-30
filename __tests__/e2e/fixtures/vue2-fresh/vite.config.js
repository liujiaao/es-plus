import { defineConfig } from 'vite'
import vue from '@vitejs/plugin-vue2'

export default defineConfig({
  plugins: [vue()],
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
