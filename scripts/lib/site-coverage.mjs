/**
 * AN-28 —— 三站案例台账的**派生规则**（es-eui / es-pc → 单源演示）。
 *
 * 为什么需要派生而不是手抄 198 行：站点案例会随目录增删而漂移，手抄台账的第二份清单
 * 必然与磁盘分叉。这里把「站点案例 ↔ 单源演示（96 例）↔ 能力令牌」做成**确定性规则**，
 * 由 `gen-site-coverage.mjs` 写进 `docs/ai/feature-coverage.json` 的 `sites`，
 * 再由 `check:feature-coverage` 现算一遍对比 —— 磁盘变了而台账没重生成就红。
 *
 * 映射规则（有意保守）：
 *   1. 目录类目先归一（`es-form`→`form`、`es-vxe`→`vxe-table`、`es-crud`→`crud-page`…）；
 *   2. 文件名转 kebab-case 得到 slug，与演示 id 的第二段（去掉 `NN-`）比较；
 *   3. slug 唯一 → 直接映射；slug 多义 → **只认同类目**的那一个；
 *   4. 仍映射不到 → 显式 `D`（`siteUncovered`），并写清 reason。
 *
 * 第 4 条是验收要求的「未覆盖案例显式列为 D 级」：不猜、不省略。
 */
import { readFileSync, readdirSync } from 'node:fs'
import { join, relative, sep } from 'node:path'
import { rowTier } from '../feature-coverage.data.mjs'

/** 站点扫描根 + 目录类目映射。`null` 类目不参与同名映射（整站骨架 / 组合页）。 */
export const SITE_ROOTS = [
  {
    site: 'es-eui',
    root: 'es-eui/src/examples',
    categoryByDir: {
      form: 'form',
      table: 'table',
      dialog: 'dialog',
      'vxe-table': 'vxe-table',
      combination: null,
      'vue2-compat': null,
      _mock: null,
    },
    uncoveredReason:
      '组合/兼容演示：Vue2 文档站的组合页与兼容性案例，无单源能力令牌（多人/多组件编排）',
  },
  {
    site: 'es-pc',
    root: 'es-pc/src/views',
    categoryByDir: {
      'es-form': 'form',
      'es-table': 'table',
      'es-crud': 'crud-page',
      'es-dialog': 'dialog',
      'es-vxe': 'vxe-table',
      'es-advanced': 'advanced',
    },
    uncoveredReason:
      '站点骨架 / 未收录视图：非单配置页（首页、指南、工具页）或尚无同名单源演示',
  },
]

function kebab(name) {
  return name.replace(/([a-z0-9])([A-Z])/g, '$1-$2').toLowerCase()
}

function walk(dir) {
  return readdirSync(dir, { withFileTypes: true }).flatMap((entry) => {
    const abs = join(dir, entry.name)
    return entry.isDirectory() ? walk(abs) : [abs]
  })
}

/**
 * 现算 `sites` 台账。
 *
 * @param {Array<{id:string,tokens:string[]}>} demos `feature-coverage.json` 的 demos
 * @param {string} root 仓库根（默认取本文件上两级；测试可注入临时目录）
 */
export function buildSiteCoverage(demos, root) {
  const bySlug = new Map()
  for (const demo of demos) {
    const [category, rest] = demo.id.split('/')
    const slug = rest.replace(/^\d+-/, '')
    if (!bySlug.has(slug)) bySlug.set(slug, [])
    bySlug.get(slug).push({ demo, category })
  }

  return SITE_ROOTS.map((spec) => {
    const absRoot = join(root, spec.root)
    const files = walk(absRoot)
      .filter((f) => f.endsWith('.vue'))
      .map((f) => relative(absRoot, f).split(sep).join('/'))
      .sort()

    const cases = files.map((rel) => {
      const id = rel.replace(/\.vue$/, '')
      const dir = id.includes('/') ? id.split('/')[0] : null
      const category = dir ? (spec.categoryByDir[dir] ?? null) : null
      const slug = kebab(id.split('/').pop())

      const candidates = bySlug.get(slug) ?? []
      let demo = null
      if (candidates.length === 1) demo = candidates[0].demo
      else if (candidates.length > 1 && category) {
        const sameCategory = candidates.find((c) => c.category === category)
        if (sameCategory) demo = sameCategory.demo
      }

      if (demo) {
        return { id, demo: demo.id, tokens: [...demo.tokens], tier: rowTier(demo.tokens) }
      }
      return { id, demo: null, tokens: ['siteUncovered'], tier: 'D', reason: spec.uncoveredReason }
    })

    // tier 由 tokens 派生（与 demos 行同一规矩：行内最弱档决定行档），派生集中在构建器里，
    // 保证 `--check` 与 `gen` 用同一份逻辑。
    return {
      site: spec.site,
      root: spec.root,
      refs: cases.filter((c) => c.demo).length,
      uncovered: cases.filter((c) => !c.demo).length,
      cases,
    }
  })
}

/** 读取演示清单（供 gen/check 共用，避免各自解析）。 */
export function readDemos(root) {
  const manifest = JSON.parse(readFileSync(join(root, 'docs/ai/feature-coverage.json'), 'utf-8'))
  return manifest.demos
}
