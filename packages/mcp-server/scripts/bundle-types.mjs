#!/usr/bin/env node
import { readFileSync, writeFileSync, mkdirSync } from 'node:fs'
import { join, dirname } from 'node:path'
import { fileURLToPath } from 'node:url'

const __dirname = dirname(fileURLToPath(import.meta.url))
const root = join(__dirname, '..')

const sources = [
  {
    src: join(root, '../es-plus/src/types/index.ts'),
    dest: join(root, 'bundled/types.d.ts'),
  },
  {
    src: join(root, '../es-plus/src/components/es-crud-page/src/types.ts'),
    dest: join(root, 'bundled/crud-page-types.d.ts'),
  },
]

mkdirSync(join(root, 'bundled'), { recursive: true })

for (const { src, dest } of sources) {
  try {
    const content = readFileSync(src, 'utf-8')
    writeFileSync(dest, `// Auto-generated from ${src.split('es-plus/')[1]}\n// Do not edit manually — run "npm run bundle-types" to update\n\n${content}`)
    const relative = dest.includes('mcp-server') ? dest.split('mcp-server/')[1] : dest
    console.log(`✓ ${relative}`)
  } catch (err) {
    console.warn(`⚠ Could not read ${src}: ${err.message}`)
  }
}
