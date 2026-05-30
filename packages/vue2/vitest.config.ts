import { defineConfig } from 'vitest/config'

export default defineConfig({
  test: {
    // happy-dom is needed just to import @es-plus/vue2 — element-ui touches
    // `document` at module top level (its util.js does feature detection).
    // We're NOT mounting components here (real mount coverage is in the e2e
    // harness with vite build + browser semantics) — happy-dom is purely a
    // module-load environment.
    environment: 'happy-dom',
    include: ['__tests__/**/*.spec.ts'],
  },
})
