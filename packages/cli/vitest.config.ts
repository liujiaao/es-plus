import { defineConfig } from 'vitest/config'

export default defineConfig({
  test: {
    include: ['__tests__/**/*.spec.ts'],
    // 测试直接从 src/ 导入（非 build/），无需先构建——与 @es-plus/mcp-server 一致。
    environment: 'node',
  },
})
