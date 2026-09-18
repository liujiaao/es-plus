#!/usr/bin/env node
/**
 * 三站 `utils/sites` 模块生成：以文档站的 `sites.ts` 为单源，生成另两站的 `.js`。
 *
 * 为什么要有生成器：
 *   这份「三站清单」需要在三个独立的应用里各存一份（三站是三个 Vite/webpack 工程，
 *   没有共享包）。此前是手工拷贝 + 逐处替换，结果是**两次踩坑**：
 *     · 一次把 TS 的类型注解（`(key: string)`）漏进了 .js → 构建报语法错；
 *     · 一次用正则批量替换时，可选注释组写成非贪婪 `[\s\S]*?` 从文件顶部的 `/**`
 *       开始匹配，把中间的 `SITE_KEY` 也一起换掉 → es-pc / es-eui 的 SITE_KEY 被
 *       重置成 'vue3'，两站顶栏显示成别站身份（幸好 check-site-nav 拦住了）。
 *   手工维护三份副本的代价已经大于写这个脚本，所以改为生成 + 门禁。
 *
 * 生成规则（只改这三处，其余逐字保留，包括注释）：
 *   1. `SITE_KEY` 的值 → 该站的 key；
 *   2. `(key: string, path: string): string` → `(key, path)`；
 *   3. `(key: string)` → `(key)`。
 * 生成后会**校验产物里不含任何 TS 注解残留**（`: string` 等），不通过就报错退出 ——
 * 这正是上一次让 es-eui 构建失败的原因。
 *
 * 用法：
 *   node scripts/gen-site-modules.mjs           # 生成
 *   node scripts/gen-site-modules.mjs --check   # 校验两份 .js 是否与单源一致（CI）
 */
import { readFileSync, writeFileSync, existsSync } from 'node:fs'
import { fileURLToPath } from 'node:url'
import { dirname, join } from 'node:path'

const __dirname = dirname(fileURLToPath(import.meta.url))
const ROOT = join(__dirname, '..')
const SOURCE = 'es-plus-docs/src/utils/sites.ts'
const TARGETS = [
  { site: 'es-pc', key: 'antdv', file: 'es-pc/src/utils/sites.js' },
  { site: 'es-eui', key: 'vue2', file: 'es-eui/src/utils/sites.js' },
]

const CHECK = process.argv.includes('--check')

function rel(p) {
  return p.replace(/\\/g, '/')
}

/** 由单源产出某站的 JS 版本 */
function buildFor(key) {
  const ts = readFileSync(join(ROOT, SOURCE), 'utf8').replace(/\r\n/g, '\n')
  let js = ts
    // 1) 站身份
    .replace(/export const SITE_KEY = '[^']*'/, `export const SITE_KEY = '${key}'`)
    // 2) / 3) 去掉 TS 注解（只这两处函数签名带注解）
    .replace(
      /export function crossSiteUrl\(key: string, path: string\): string \{/,
      'export function crossSiteUrl(key, path) {',
    )
    .replace(/export const siteOf = \(key: string\) =>/, 'export const siteOf = (key) =>')
  return js
}

/** 产物自检：不得残留 TS 注解（上一次就是这样让 es-eui 构建失败的） */
function assertNoTsSyntax(js, label) {
  const offenders = []
  for (const m of js.matchAll(/\(([^)]*:\s*[A-Za-z][^)]*)\)/g)) offenders.push(m[1])
  if (/:\s*string\b|:\s*number\b|:\s*boolean\b/.test(js)) {
    offenders.push('存在 : string / : number / : boolean 形式的类型注解')
  }
  if (offenders.length) {
    console.error(`❌ ${label} 生成物里残留 TS 语法：${offenders.slice(0, 3).join(' | ')}`)
    console.error('   （.js 里出现类型注解会直接导致构建语法错误，必须修生成规则而不是手改产物）')
    process.exit(1)
  }
}

function main() {
  if (!existsSync(join(ROOT, SOURCE))) {
    console.error(`❌ 单源缺失：${SOURCE}`)
    process.exit(1)
  }
  let drift = false
  for (const t of TARGETS) {
    const js = buildFor(t.key)
    assertNoTsSyntax(js, t.file)
    const target = join(ROOT, t.file)
    if (CHECK) {
      if (!existsSync(target)) {
        console.error(`❌ 目标缺失：${t.file}（运行 npm run sites:gen）`)
        drift = true
        continue
      }
      const cur = readFileSync(target, 'utf8').replace(/\r\n/g, '\n')
      if (cur !== js) {
        console.error(
          `❌ ${t.file} 与单源不一致 —— 它由 ${SOURCE} 生成，请运行 \`npm run sites:gen\`，不要手改`,
        )
        drift = true
      }
    } else {
      writeFileSync(target, js)
      console.log(`✅ 已生成 ${t.file}（SITE_KEY='${t.key}'）`)
    }
  }
  if (CHECK) {
    if (drift) process.exit(1)
    console.log(`✅ 两份站点模块与单源一致（${TARGETS.map((t) => t.file).join(' / ')}）`)
  } else {
    console.log(`   单源：${rel(SOURCE)}`)
  }
}

main()
