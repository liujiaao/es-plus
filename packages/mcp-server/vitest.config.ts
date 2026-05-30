import { defineConfig } from 'vitest/config'

export default defineConfig({
  test: {
    include: ['__tests__/**/*.spec.ts'],
    // The test files import from src/ directly (not build/), so we don't need
    // a build step before running tests — matches the pattern used by @es-plus/shared.
    environment: 'node',
  },
})
