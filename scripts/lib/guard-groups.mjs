/**
 * `check:consistency` 的分组清单（P0）。
 *
 * ## 为什么要有这份清单
 *
 * 旧链是一条 121 段 `&&`：任何一段红，后面的守卫**根本不运行**。于是 CI 上的
 * 「一处失败」会把其余 120 个结论全部遮住，修一轮只看到一条。分组 runner 让
 * 每个组、每一项都跑完再汇总，同时保留顺序 —— 有些守卫依赖前一步生成的产物。
 *
 * ## 单一真源
 *
 * 这里**不复制命令全文**，只写 `npm run ` 之后的脚本名（含参数）。真正的顺序与
 * 集合以 `package.json` 的 `check:consistency:legacy` 为权威：runner 启动时把两边
 * 逐项比对，要求「组的串接 == 旧链」且无重复。任何一边改动没同步，runner 直接
 * 以退出码 2 拒绝运行 —— 绝不静默跑一个自以为是的子集。
 *
 * 新增守卫的流程：先在 `check:consistency:legacy` 里插到正确位置，再在下面某个
 * 组里同位置插一行。两处都改完，runner 才会启动。
 */
export const GUARD_GROUPS = Object.freeze([
  {
    id: 'contract-foundation',
    title: '导出 / Schema / 片段 / 入口契约',
    steps: ['check:exports', 'check:schema', 'check:fragment', 'check:artifact-runtime', 'check:entry'],
  },
  {
    id: 'scoring-eval',
    title: '特征覆盖与 eval 评分链',
    steps: [
      'check:feature-coverage',
      'check:scorers',
      'check:gold-self',
      'check:align',
      'check:run-metrics',
      'check:dump',
      'check:replay',
      'check:ai-case-drift',
      'check:rescore',
      'check:ratchet',
      'check:artifact-self',
      'check:eval-freshness-leg',
      'check:eval-prompt',
    ],
  },
  {
    id: 'fragment-evidence',
    title: '片段评分 / 证据 / 修复回路',
    steps: [
      'check:fragment-scorers',
      'check:dialog-scorers',
      'check:composition',
      'check:composition-gallery',
      'check:ai-workflows',
      'check:fragment-dashboard',
      'check:compile-leg',
      'check:fragment-leg',
      'check:typecheck-leg',
      'check:fragment-prompts',
      'check:repair-loop',
      'check:fewshot-registration',
      'check:membership-trap',
      'check:crud-fairness',
    ],
  },
  {
    id: 'scene-front-door',
    title: '场景注册表 / 路由器 / 前门',
    steps: [
      'check:scene-registry',
      'check:capability-ledger',
      'check:vocabulary-parity',
      'check:scene-parity',
      'check:artifact-envelope',
      'check:composition-contract',
      'check:scene-coverage',
      'check:front-door',
      'check:front-door-leg',
      'check:scene-eval',
      'check:prd',
      'check:prd-leg',
      'fragment:smoke',
    ],
  },
  {
    id: 'generator',
    title: '生成器与 schema 校验',
    steps: [
      'check:generator',
      'check:generator-targets',
      'check:generator-escaping',
      'check:generator-fuzz',
      'check:schema-validator',
      'check:option-shape',
      'check:unknown-keys',
    ],
  },
  {
    id: 'cross-target',
    title: '三端能力 / 契约 / 工具面',
    steps: [
      'check:capability-parity',
      'check:capability-witnesses',
      'check:legacy-stub',
      'check:parity',
      'check:api',
      'check:contract',
      'check:tool-shapes',
      'check:tool-surface',
      'check:doc-drift',
      'check:render-plan',
      'check:threeway',
      'check:crud-actions',
      'check:button-surface',
    ],
  },
  {
    id: 'site-docs',
    title: '站点结构 / 文档声明 / 分发',
    steps: [
      'check:site-nav',
      'check:doc-nav',
      'check:dark-mode',
      'sites:check',
      'check:readme',
      'check:site-claims',
      'check:changelog',
      'check:page-meta',
      'check:subpage-title',
      'check:nav-coverage',
      'check:search-index',
      'check:sitemap',
      'check:llms',
      'check:site-seo',
      'check:bundle-sources',
      'check:distribution',
      'check:deps',
      'check:analytics',
      'check:data-schemas',
      'check:doc-schemas',
      'check:brand-assets',
      'check:theme-bridge',
      'check:scaffold',
    ],
  },
  {
    id: 'docs-tokens',
    title: '文档镜像 / 品牌 token',
    steps: ['schemas:check', 'docs:check', 'check:docs-layout', 'tokens:check', 'brand:check'],
  },
  {
    id: 'matrix-cases',
    title: '能力矩阵 / AI 用例',
    steps: [
      'tri-render:check',
      'tri-render:pairs:check',
      'cases:check',
      'ai:matrix -- --check',
      'check:ai-cases -- --strict-coverage',
      'cases:metrics:check',
      'check:cases-metrics',
      'check:cases-links',
    ],
  },
  {
    id: 'repo-hygiene',
    title: '站点 API 漂移 / 仓库卫生',
    steps: [
      'check:site-api-drift',
      'check:first-class-vxe-keys',
      'check:eol-hygiene',
      'check:case-titles',
      'ai:check',
      'check:artifact-freshness',
      'check:eval-freshness',
    ],
  },
  {
    id: 'theme-config-seo',
    title: '主题 / 配置 / 数据 / SEO',
    steps: ['theme:check', 'element-theme:check', 'one-config:check', 'data-schemas:check', 'og:check'],
  },
  {
    id: 'source-examples',
    title: '源码与示例卫生',
    steps: [
      'check:raw-sources',
      'check:demo-residue',
      'check:eui-column-prop',
      'check:vue2-template',
      'check:example-inline-style',
      'check:declarative-demo',
      'check:code-fence',
      'check:code-block',
    ],
  },
  {
    id: 'page-quality',
    title: '页面质量 / 可访问性 / 演示',
    steps: [
      'check:a11y',
      'check:not-found',
      'check:landing',
      'check:heading-emoji',
      'check:component-api',
      'check:motion',
      'check:mobile',
      'check:section-groups',
      'check:design-tokens',
      'check:header-parity',
      'check:flagship-case',
      'check:generated-case',
    ],
  },
  {
    id: 'product-preview',
    title: '产品事实 / 预览 / 中继',
    steps: [
      'product:check',
      'product:videos:check',
      'accent:check',
      'check:ai-presets',
      'check:preview-parity',
      'check:ai-relay',
    ],
  },
])

/** 旧链（`check:consistency:legacy`）的一步 → runner 的一步。 */
export function stepCommand(step) {
  return `npm run --silent ${step}`
}

/**
 * 校验分组与旧链是同一集合、同一顺序。
 *
 * @param {string} legacy 旧链原文（`npm run a && npm run b ...`）
 * @param {ReadonlyArray<{id:string,title:string,steps:readonly string[]}>} groups
 * @returns {{ errors: string[], steps: number, groupCount: number }}
 */
export function validateGroups(legacy, groups = GUARD_GROUPS) {
  const errors = []
  const legacySteps = legacy
    .split(' && ')
    .map((s) => s.trim())
    .filter(Boolean)
    .map((s) => {
      const m = /^npm run (.+)$/.exec(s)
      return m ? m[1] : null
    })

  const bad = legacy
    .split(' && ')
    .map((s) => s.trim())
    .filter(Boolean)
    .filter((s) => !/^npm run (.+)$/.test(s))
  for (const s of bad) errors.push(`旧链里有无法识别的步骤：${s}`)

  const grouped = groups.flatMap((g) => g.steps)
  const seen = new Map()
  for (const g of groups) {
    if (!g.id) errors.push(`有一个组缺少 id（title=${g.title}）`)
    if (!g.steps.length) errors.push(`组 ${g.id} 没有任何步骤`)
    for (const s of g.steps) {
      if (seen.has(s)) errors.push(`步骤 ${s} 同时出现在组 ${seen.get(s)} 与 ${g.id}`)
      else seen.set(s, g.id)
    }
  }
  const ids = groups.map((g) => g.id)
  const dupIds = ids.filter((id, i) => ids.indexOf(id) !== i)
  for (const id of new Set(dupIds)) errors.push(`组 id 重复：${id}`)

  const legacyList = legacySteps.filter(Boolean)
  if (legacyList.length !== grouped.length) {
    errors.push(`旧链 ${legacyList.length} 步 ≠ 分组 ${grouped.length} 步`)
  }
  const n = Math.min(legacyList.length, grouped.length)
  for (let i = 0; i < n; i++) {
    if (legacyList[i] !== grouped[i]) {
      errors.push(`第 ${i + 1} 步顺序不一致：旧链 ${legacyList[i]}，分组 ${grouped[i]}`)
      break
    }
  }

  return { errors, steps: grouped.length, groupCount: groups.length }
}
