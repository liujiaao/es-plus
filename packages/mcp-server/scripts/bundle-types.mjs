#!/usr/bin/env node
import { readFileSync, writeFileSync, mkdirSync } from 'node:fs'
import { join, dirname } from 'node:path'
import { fileURLToPath } from 'node:url'

const __dirname = dirname(fileURLToPath(import.meta.url))
const root = join(__dirname, '..')

const sources = [
  {
    src: join(root, '../vue3/src/types/index.ts'),
    dest: join(root, 'bundled/types.d.ts'),
  },
  {
    src: join(root, '../vue3/src/components/es-crud-page/src/types.ts'),
    dest: join(root, 'bundled/crud-page-types.d.ts'),
  },
  // Optional vue2 bundle — falls through silently if the file isn't there.
  {
    src: join(root, '../vue2/src/types/index.ts'),
    dest: join(root, 'bundled/types-vue2.d.ts'),
  },
]

mkdirSync(join(root, 'bundled'), { recursive: true })

for (const { src, dest } of sources) {
  try {
    const content = readFileSync(src, 'utf-8')
    // 路径先归一到 POSIX 分隔符再取相对段：Windows 下 join() 产出反斜杠，
    // `split('packages/')` 会落空，生成的 header 里就会写死本机的 E:\ 绝对路径
    // （提交物与机器绑定）并把日志打成 "✓ undefined"。
    const relSrc = src.replace(/\\/g, '/').split('packages/')[1] ?? src
    writeFileSync(dest, `// Auto-generated from ${relSrc}\n// Do not edit manually — run "npm run bundle-types" to update\n\n${content}`)
    const relative = dest.includes('mcp-server') ? dest.replace(/\\/g, '/').split('mcp-server/')[1] : dest
    console.log(`✓ ${relative}`)
  } catch (err) {
    console.warn(`⚠ Could not read ${src}: ${err.message}`)
  }
}
