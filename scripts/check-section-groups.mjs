#!/usr/bin/env node
/**
 * 分组页守卫：手写 section 的长页把正文切成若干组、同一时刻只挂当前组。
 * 「分组声明」（脚本里的数组）与「模板」（每个 `<section id>` 上的 v-if）必须严格对齐。
 *
 * 覆盖两种写法：
 *   · es-pc（Vue 3）：`SECTION_GROUPS` + `v-if="isActive('<key>')"`，每个 id 属于一个 key；
 *   · es-eui（Vue 2）：`chapters` + `v-if="isChapter('<id>')"`，id 自己就是篇 id，
 *     另有 `anchors`（篇内锚点 → 篇）供深链用。
 *
 * 为什么需要守卫：两边对不上时**不会报错**，只会静默消失或永远不出现 ——
 *   · 新写了一节，漏了 v-if：它不属于任何分组，但因为没有 v-if 会一直显示，
 *     标签条的计数与页面内容对不上；
 *   · 写了 v-if 但没在声明里登记：切到任何分组它都不渲染，
 *     正文凭空少一节（而页面看起来一切正常）；
 *   · key 写错（`isActive('tables')` vs 声明里的 `table`）：同上，静默空组；
 *   · 同一个 id 登记进两个分组：切到任一组都显示，另一组的计数虚高。
 * 这些都是「改一行模板就能引出、但只有人肉点开才知道」的缺陷，静态核对最便宜。
 *
 * 只解析源码，不跑浏览器：与 check-landing / check-mobile 同一条理由
 * （给 es-pc / es-eui 起 dev server 的代价见 __tests__/e2e-runtime/tests/mobile.spec.ts 头注）。
 *
 * 用法：node scripts/check-section-groups.mjs
 */
import { readFileSync } from 'node:fs'
import { dirname, join } from 'node:path'
import { fileURLToPath } from 'node:url'

const ROOT = join(dirname(fileURLToPath(import.meta.url)), '..')

/**
 * 被守卫的页面。加新页时在这里补一行 —— 分组是逐页声明的，不是全局配置。
 * kind 决定「声明」从哪读、模板上的判据长什么样。
 */
const PAGES = [
  { file: 'es-pc/src/views/EsForm.vue', kind: 'section-groups' },
  { file: 'es-pc/src/views/EsTable.vue', kind: 'section-groups' },
  { file: 'es-eui/src/views/docs/EsEuiDeveloperGuide.vue', kind: 'chapters' },
]

const KINDS = {
  /** es-pc：SECTION_GROUPS = [{ key, name, ids: [...] }]，模板 isActive('<key>') */
  'section-groups': {
    declaration: /const SECTION_GROUPS/,
    /** 声明块 → [{ key, ids }] */
    readDeclaration(body, file, errors) {
      const groups = []
      // key 是 ASCII（模板里要写进 isActive('...')），name 是中文
      const re = /key:\s*'([A-Za-z0-9_-]+)'[\s\S]*?ids:\s*\[([^\]]*)\]/g
      let m
      while ((m = re.exec(body))) {
        groups.push({ key: m[1], ids: (m[2].match(/'[^']+'/g) || []).map((s) => s.slice(1, -1)) })
      }
      if (!groups.length) errors.push(`${file}：SECTION_GROUPS 里一个分组都没解析出来（格式变了？）`)
      return groups
    },
    /** 模板开标签 → { id, key }；key 是 isActive('...') 里的那个 */
    templateKey: (attrs) => {
      const m = /v-if="isActive\('([^']*)'\)"/.exec(attrs)
      return m ? m[1] : ''
    },
    vifExample: `v-if="isActive('<key>')"`,
    declarationName: 'SECTION_GROUPS',
  },
  /** es-eui：chapters = [{ id, label }] + anchors = { '#inner': 'ch-x' }，模板 isChapter('<id>') */
  chapters: {
    declaration: /chapters:\s*\[/,
    readDeclaration(body, file, errors) {
      const chapters = []
      for (const m of body.matchAll(/id:\s*'([A-Za-z0-9_-]+)'/g)) chapters.push({ key: m[1], ids: [m[1]] })
      if (!chapters.length) errors.push(`${file}：chapters 里一个章节都没解析出来（格式变了？）`)
      return chapters
    },
    templateKey: (attrs) => {
      const m = /v-if="isChapter\('([^']*)'\)"/.exec(attrs)
      return m ? m[1] : ''
    },
    vifExample: `v-if="isChapter('<id>')"`,
    declarationName: 'chapters',
  },
}

const errors = []

/** 从 SFC 里切出模板段与脚本段 */
function splitSFC(src) {
  const scriptAt = src.indexOf('<script')
  return {
    template: scriptAt === -1 ? src : src.slice(0, scriptAt),
    script: scriptAt === -1 ? '' : src.slice(scriptAt),
  }
}

/** 从声明行的位置截到配对的 `]`（按括号深度走，字符串里没有方括号） */
function readDeclarationBody(script, kind, file) {
  const at = script.search(kind.declaration)
  if (at === -1) {
    errors.push(`${file}：脚本里没有 ${kind.declarationName} —— 分组页必须声明分组`)
    return ''
  }
  const open = script.indexOf('[', at)
  if (open === -1) {
    errors.push(`${file}：${kind.declarationName} 不是数组（格式变了？）`)
    return ''
  }
  let depth = 0
  for (let i = open; i < script.length; i += 1) {
    if (script[i] === '[') depth += 1
    else if (script[i] === ']') {
      depth -= 1
      if (depth === 0) return script.slice(open, i + 1)
    }
  }
  errors.push(`${file}：${kind.declarationName} 没有闭合（括号深度回不到 0）`)
  return ''
}

/** 模板里的 `<section>` 开标签 → [{ id, key, ungrouped }] */
function readSections(template, kind, file) {
  const sections = []
  for (const m of template.matchAll(/<section\b([^>]*)>/g)) {
    const attrs = m[1]
    const id = /id="([^"]*)"/.exec(attrs)
    sections.push({
      id: id ? id[1] : '',
      key: kind.templateKey(attrs),
      ungrouped: /\bdata-ungrouped\b/.test(attrs),
    })
  }
  if (!sections.length) errors.push(`${file}：模板里没有 <section> —— 选择器或页面结构变了`)
  return sections
}

for (const { file, kind: kindName } of PAGES) {
  const kind = KINDS[kindName]
  if (!kind) {
    errors.push(`${file}：未知的 kind "${kindName}"（PAGES 清单写错了）`)
    continue
  }
  let src
  try {
    src = readFileSync(join(ROOT, file), 'utf8')
  } catch {
    errors.push(`${file}：文件不存在（PAGES 清单过期？）`)
    continue
  }

  const { template, script } = splitSFC(src)
  const body = readDeclarationBody(script, kind, file)
  const groups = body ? kind.readDeclaration(body, file, errors) : []
  const sections = readSections(template, kind, file)

  if (groups.length && groups.length < 2) {
    errors.push(`${file}：只有一个分组 —— 分组页至少要有两组，否则标签条没有意义`)
  }

  // 1) 模板侧：每个 section 都必须有 id，且用分组判据控制渲染
  //    （`data-ungrouped` 是显式豁免：hero 这类有意不参与分组的块）
  const seenIds = new Set()
  for (const section of sections) {
    if (section.ungrouped) {
      if (section.key) {
        errors.push(`${file}：<section id="${section.id}"> 同时写了 data-ungrouped 与分组判据 —— 语义冲突`)
      }
      continue
    }
    if (!section.id) {
      errors.push(
        `${file}：有一个 <section> 既没有 id 也没有 ${kind.vifExample} —— ` +
          '它属于哪一组看不出来（有意不分组请加 data-ungrouped）',
      )
      continue
    }
    if (seenIds.has(section.id)) errors.push(`${file}：<section id="${section.id}"> 重复`)
    seenIds.add(section.id)
    if (!section.key) {
      errors.push(
        `${file}：<section id="${section.id}"> 没有 ${kind.vifExample} —— 它会一直显示在所有分组里`,
      )
    }
  }

  // 2) 声明侧：id 不能重复登记，且必须真的存在
  const declared = new Map()
  for (const group of groups) {
    if (!group.ids.length) {
      errors.push(`${file}：分组 "${group.key}" 没有 id —— 空组会渲染出一个点了没反应的标签`)
    }
    for (const id of group.ids) {
      if (declared.has(id)) {
        errors.push(`${file}：section "${id}" 同时登记在 "${declared.get(id)}" 与 "${group.key}" 里`)
      } else {
        declared.set(id, group.key)
      }
      if (!seenIds.has(id)) {
        errors.push(`${file}：分组 "${group.key}" 里登记的 id "${id}" 在模板里不存在（改名了？）`)
      }
    }
  }

  // 3) 两边对齐：模板 section 的分组 key 必须等于声明它的分组 key
  for (const section of sections) {
    if (!section.id || section.ungrouped) continue
    const groupKey = declared.get(section.id)
    if (!groupKey) {
      errors.push(`${file}：<section id="${section.id}"> 不在任何分组里 —— 切组后它永远不会出现`)
      continue
    }
    if (section.key && section.key !== groupKey) {
      errors.push(
        `${file}：<section id="${section.id}"> 写的是 "${section.key}"，` +
          `但声明里它属于 "${groupKey}" —— 两边不一致时它会永远不渲染（或永远显示）`,
      )
    }
  }

  // 4) 篇内锚点（仅 chapters 写法）：anchors 的值必须是已声明的篇
  if (kindName === 'chapters') {
    const anchorsAt = script.indexOf('anchors:')
    if (anchorsAt !== -1) {
      const line = script.slice(anchorsAt, script.indexOf('\n', anchorsAt))
      for (const m of line.matchAll(/'([A-Za-z0-9_-]+)'\s*:\s*'([A-Za-z0-9_-]+)'/g)) {
        if (!declared.has(m[2])) {
          errors.push(`${file}：anchors 里 "${m[1]}" 指向的篇 "${m[2]}" 不存在（深链会切不到篇）`)
        }
      }
    }
  }
}

if (errors.length) {
  console.error(`✗ 分组声明与模板不一致（${errors.length} 处）：`)
  for (const e of errors) console.error(`   - ${e}`)
  console.error('\n分组声明与模板必须同批改：加一节 = 加 <section v-if="…"> + 把它写进分组声明。')
  process.exit(1)
}

console.log(`✅ 分组页模板与声明一致（${PAGES.length} 页）`)
