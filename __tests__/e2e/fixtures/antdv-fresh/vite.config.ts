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
      // vxe-table is an OPTIONAL peer of @es-plus/adapter-antdv (only used when
      // options.engine === 'vxe'). The generated CRUD pages never opt into vxe,
      // and the fixture doesn't install it, so treat it as external to avoid a
      // spurious UNRESOLVED_IMPORT from adapter-antdv's lazy vxe code path.
      external: [/^vxe-table/, /^@vxe-ui/],
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
