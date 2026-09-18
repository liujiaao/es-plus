#!/usr/bin/env node
/**
 * 数据文件 schema 发布：docs/{brand,cases,ai}/*.schema.json → es-plus-docs/public/ 同名子目录。
 *
 * 为什么需要发布而不是只放在 docs/ 里：
 *   这三份数据文件都在头部声明了 `$schema`，指向
 *   `https://liujiaao.github.io/es-plus/<dir>/<name>.schema.json` —— 也就是**文档站部署后
 *   的路径**。声明存在的前提是被指向的文件真的能在那个 URL 上取到；否则编辑器/校验器拿到的
 *   是 404，声明就成了装饰（此前正是如此：三份 schema 文件一个都不存在）。
 *
 * 只发到主文档站：`$schema` 里写的是主文档站的域名，另两站不需要（也不需要重复托管）。
 *
 * 用法：
 *   node scripts/sync-data-schemas.mjs           # 发布
 *   node scripts/sync-data-schemas.mjs --check   # 校验发布副本是否为最新（CI）
 *
 * 退出码：0 = 成功/一致；1 = 源缺失或副本过期。
 */
import { writeFileSync, existsSync, mkdirSync } from 'node:fs'
import { fileURLToPath } from 'node:url'
import { dirname, join } from 'node:path'
import { readText, sameText } from './lib/text-sync.mjs'

const __dirname = dirname(fileURLToPath(import.meta.url))
const ROOT = join(__dirname, '..')
const PUBLIC = join(ROOT, 'es-plus-docs', 'public')

/** 显式清单：源（相对 docs/）→ 发布子路径。缺失即报错，不做目录扫描。 */
const SCHEMAS = [
  ['brand/slogan.schema.json', 'brand'],
  ['cases/cases.schema.json', 'cases'],
  ['ai/ai-tools.schema.json', 'ai'],
]

const CHECK = process.argv.includes('--check')

function main() {
  let drift = false
  let synced = 0

  for (const [rel, sub] of SCHEMAS) {
    const src = join(ROOT, 'docs', rel)
    const dst = join(PUBLIC, sub, rel.split('/').pop())
    if (!existsSync(src)) {
      console.error(`❌ 单源缺失：docs/${rel}`)
      drift = true
      continue
    }
    const content = readText(src)
    if (CHECK) {
      if (!existsSync(dst)) {
        console.error(`❌ 未发布：es-plus-docs/public/${sub}/${rel.split('/').pop()}`)
        drift = true
      } else if (!sameText(readText(dst), content)) {
        console.error(`❌ 发布副本过期：es-plus-docs/public/${sub}/${rel.split('/').pop()}`)
        drift = true
      }
    } else {
      const dir = dirname(dst)
      if (!existsSync(dir)) mkdirSync(dir, { recursive: true })
      writeFileSync(dst, content)
      synced++
    }
  }

  if (CHECK) {
    if (drift) {
      console.error('\n数据 schema 未发布或已过期。运行 `npm run data-schemas:sync` 重新发布。')
      process.exit(1)
    }
    console.log(`✅ ${SCHEMAS.length} 份数据 schema 已发布且与单源一致`)
  } else {
    console.log(`✅ 已发布 ${synced} 份数据 schema 到 es-plus-docs/public/`)
  }
}

main()
