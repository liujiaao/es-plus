import { defineConfig } from 'vitest/config'
import vue from '@vitejs/plugin-vue'
import vueJsx from '@vitejs/plugin-vue-jsx'
import { resolve } from 'path'

export default defineConfig({
  plugins: [vue(), vueJsx()],
  test: {
    environment: 'happy-dom',
    globals: true,
    include: ['__tests__/**/*.spec.ts'],
  },
  resolve: {
    alias: {
      '@': resolve(__dirname, 'src')
    }
  }
})
