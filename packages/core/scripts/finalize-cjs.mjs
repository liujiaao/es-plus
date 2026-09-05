// 在 build/cjs 下写入 { "type": "commonjs" }，使 Node 将该目录内 .js 按 CommonJS 解析。
// 这样 @es-plus/core 的 exports `require` 条件（指向 build/cjs/*.js）在
// type:module 的包里也能被正确 require —— 三端渲染器的 .umd.cjs 依赖它。
import { writeFileSync } from 'node:fs'
import { fileURLToPath } from 'node:url'
import { dirname, join } from 'node:path'

const here = dirname(fileURLToPath(import.meta.url))
const target = join(here, '..', 'build', 'cjs', 'package.json')
writeFileSync(target, JSON.stringify({ type: 'commonjs' }, null, 2) + '\n')
console.log('[core] wrote', target)
