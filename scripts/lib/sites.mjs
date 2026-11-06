/**
 * 三站规范地址的读取器。
 *
 * 单源是 `es-plus-docs/src/utils/sites.ts` 的 `SITES` 数组（另两站由
 * `scripts/gen-site-modules.mjs` 从它生成）。这里只做**文本解析**，不执行 TS：
 * 守卫脚本关心的是字面量是否漂移，而不是运行时的模块行为。
 *
 * 为什么抽成公共库：canonical（check-brand-assets）、外部分发链接
 * （check-distribution）与 sitemap/404（check-sitemap）都要用同一份地址表。
 * 各自写一遍正则，换域名时就会漏掉其中一处。
 */
import { readFileSync } from 'node:fs'
import { fileURLToPath } from 'node:url'
import { dirname, join } from 'node:path'

const ROOT = join(dirname(fileURLToPath(import.meta.url)), '..', '..')
export const SITES_SOURCE = 'es-plus-docs/src/utils/sites.ts'

/**
 * 解析 SITES 数组里的 `{ key, label, short, url }`。
 * 只认单引号字符串 —— 源码里就是这个写法，换引号会让这里显式报错而不是静默返回空表。
 */
export function readSites() {
  const src = readFileSync(join(ROOT, SITES_SOURCE), 'utf8')
  const block = src.match(/export\s+const\s+SITES\s*=\s*\[([\s\S]*?)\n\]/)?.[1]
  if (!block) throw new Error(`未能从 ${SITES_SOURCE} 解析出 SITES 数组`)
  const sites = []
  for (const match of block.matchAll(/\{([^{}]*)\}/g)) {
    const body = match[1]
    const key = body.match(/key:\s*'([^']+)'/)?.[1]
    const url = body.match(/url:\s*'([^']+)'/)?.[1]
    const label = body.match(/label:\s*'([^']+)'/)?.[1]
    if (!key || !url) throw new Error(`${SITES_SOURCE} 的 SITES 项缺少 key 或 url：${body.trim()}`)
    sites.push({ key, label, url })
  }
  if (!sites.length) throw new Error(`${SITES_SOURCE} 的 SITES 数组是空的`)
  return sites
}

/** 按 key 取站点；缺失时抛错而不是返回 undefined（调用方不该静默跳过） */
export function siteByKey(sites, key) {
  const site = sites.find((item) => item.key === key)
  if (!site) throw new Error(`SITES 里没有 key='${key}' 的站点`)
  return site
}
