/**
 * 案例分发计划 —— 「单源 → 三站副本」的唯一算法。
 *
 * 两个消费者必须看到**同一份**计划，否则「同步脚本写的位置」与「守卫校验的位置」会各说各话：
 *   · `scripts/sync-cases.mjs` —— 实际拷贝 / 生成；
 *   · `scripts/check-ai-cases.mjs` —— 断言副本逐字节一致（断言 9）。
 *
 * 落点约定：`docs/cases/generated/` 下的产物进各站 `src/cases/generated/`，其余（手写旗舰
 * 案例）留在 `src/cases/` —— 现有宿主页的 import 路径依赖这条约定。
 */
import { basename, join } from 'node:path'
import { ROOT } from './front-door.mjs'

export const SITES = ['es-plus-docs', 'es-pc', 'es-eui'].map((name) => ({
  name,
  dir: join(ROOT, name, 'src', 'cases'),
}))

/** `employee-roster` → `employeeRoster`（registry 的局部变量名）。 */
export function camelCase(id) {
  return id.replace(/-([a-z0-9])/g, (_, c) => c.toUpperCase())
}

/**
 * 生成 registry.js 的文本。**逐字节确定**：同样的 manifest 必须产出同样的字节，
 * 否则 `cases:check` 会在没有漂移的情况下变红（三站各算一次也必须相同）。
 *
 * registry 收**全部**案例（画廊按它列清单、按簇分组），但只给 `host.kind === 'generic'`
 * 的案例静态 import 产物：
 *   · 定制宿主（旗舰页 / 采购审批 hero 页）有自己的叙事页，产物由它自己 import，
 *     再进 registry 只会让打包器多拉一遍；它们的条目只带展示元数据 + 路由；
 *   · 通用宿主靠 `schema / meta / mock` 三件套渲染，缺一样页面上就是空白。
 */
export function registryText(manifest) {
  const imports = []
  const entries = []
  for (const c of [...manifest.cases].sort((a, b) => a.id.localeCompare(b.id))) {
    const v = camelCase(c.id)
    const generic = c.host?.kind === 'generic'
    if (generic) {
      imports.push(`import ${v} from './${c.id}.json'`)
      imports.push(`import ${v}Meta from './${c.id}.meta.json'`)
      imports.push(`import * as ${v}Mock from './${c.id}.mock.js'`)
    }
    // 冻结配置（`--emit-config` 的产物）也走静态 import：画廊的「下载配置」与
    // 「可机械重放」徽章都靠它。放在 registry 而不是用 import.meta.glob —— 三个站的
    // 打包器不同（vite ×2 / webpack ×1），glob 的语义与键名各不相同（见文件头注）。
    if (c.artifacts?.config) imports.push(`import ${v}Config from './${c.id}.config.json'`)
    entries.push(
      [
        `  ${JSON.stringify(c.id)}: {`,
        `    id: ${JSON.stringify(c.id)},`,
        `    title: ${JSON.stringify(c.title)},`,
        `    claim: ${JSON.stringify(c.claim)},`,
        `    replay: ${JSON.stringify(c.replay.kind)},`,
        `    clusters: ${JSON.stringify(c.clusters)},`,
        `    tokens: ${JSON.stringify(c.tokens)},`,
        `    host: ${JSON.stringify({ kind: c.host.kind, route: c.host.route })},`,
        ...(generic ? [`    schema: ${v},`, `    meta: ${v}Meta,`, `    mock: ${v}Mock,`] : []),
        ...(c.artifacts?.config ? [`    config: ${v}Config,`] : []),
        '  },',
      ].join('\n')
    )
  }
  return [
    '/**',
    ' * 自动生成：scripts/sync-cases.mjs —— **禁止手改**（`npm run cases:check` 会红）。',
    ' *',
    ' * 单源：docs/cases/ai-cases.json（manifest）。画廊按它列清单；通用宿主 AiCaseHost 按 id',
    ' * 取 `{ schema, meta, mock }`。定制宿主（旗舰页 / 采购审批 hero 页）的条目只带展示',
    ' * 元数据与路由 —— 它们的产物由各自的叙事页 import。',
    ' */',
    ...imports,
    '',
    'export const AI_CASES = {',
    ...entries,
    '}',
    '',
    'export const AI_CASE_LIST = Object.values(AI_CASES)',
    '',
    '/** 能力簇编号 → 中文名（画廊分组标题；来自 manifest 的 clusters 表）。 */',
    `export const AI_CLUSTERS = ${JSON.stringify(manifest.clusters ?? {}, null, 2)}`,
    '',
  ].join('\n')
}

/**
 * 单源 → 站点副本的完整清单（共享文件 + 各案例产物 + registry）。
 * 每项 = `{ source, text?, targets[], kind }`；`text` 存在时表示「生成」而非「拷贝」。
 */
export function buildPlan(manifest) {
  const plan = []
  for (const name of manifest.shared) {
    plan.push({
      source: `docs/cases/${name}`,
      absSource: join(ROOT, 'docs', 'cases', name),
      targets: SITES.map((site) => join(site.dir, name)),
      kind: `shared:${name}`,
    })
  }
  for (const c of manifest.cases) {
    for (const key of ['schema', 'meta', 'mock', 'config']) {
      const rel = c.artifacts?.[key]
      if (!rel) continue
      const sub = rel.startsWith('docs/cases/generated/') ? 'generated' : ''
      plan.push({
        source: rel,
        absSource: join(ROOT, rel),
        targets: SITES.map((site) => join(site.dir, sub, basename(rel))),
        kind: `${c.id}:${key}`,
      })
    }
  }
  plan.push({
    // S2 组合画廊：数据由 `scripts/gen-composition-gallery.mjs` 算好（与评测同一函数），
    // 三站只 import 数据 —— es-eui 没有 TS loader，站点侧不能现算。
    source: 'docs/cases/generated/composition-gallery.js',
    absSource: join(ROOT, 'docs', 'cases', 'generated', 'composition-gallery.js'),
    targets: SITES.map((site) => join(site.dir, 'generated', 'composition-gallery.js')),
    kind: 'composition-gallery',
  })
  plan.push({
    source: 'docs/cases/ai-cases.json（生成）',
    text: registryText(manifest),
    targets: SITES.map((site) => join(site.dir, 'generated', 'registry.js')),
    kind: 'registry',
  })
  return plan
}
