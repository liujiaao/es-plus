#!/usr/bin/env node
/**
 * 三站「站点切换器」一致性 + 正确性检查。
 *
 * 背景：三站顶栏的跨站切换器各有一份手写的 `const SITES = [...]`，内容必须一致。
 * 最初的检查只做了「三处数组字面量逐字符相同」—— 这是个**不够**的门禁：三处一起写错
 * 依然是绿的。实际发生过两件事，它都没拦住：
 *   1. 三站共同声明了一套腾讯云 EdgeOne 地址，实测 401 / 不解析，而 CI 只部署
 *      GitHub Pages → UI 上挂着死链；
 *   2. `detectCurrentSite()` 按 hostname 反推当前站，凡不是 github.io 的环境
 *      （localhost、将来的自有域名）都会猜错 → 顶栏显示错误的当前站
 *      （在 es-eui 上显示「Vue 3 · Element Plus」），并把用户送去死链。
 *
 * 因此本脚本在校验「一致」之外，还校验「正确」——把 UI 里公布的地址与
 * CI 实际部署的路径、以及站点自报的规范域名对齐：
 *   1. 三站 SITES 数组逐字符一致（忽略空白）；
 *   2. 每个站点显式声明 SITE_KEY，且与 SITES 中的 key 对得上
 *      （当前站不再靠 hostname 反推）；
 *   3. 不存在第二套「备用部署」字段（tencent / edgeone …）与按 hostname 选地址的
 *      分支 —— 未被 CI 维护的部署不应出现在 UI 上；
 *   4. SITES 里每个 url 的路径 == deploy-docs.yml 合成 Pages 产物时该站被拷贝到的
 *      子路径（站点目录 → 子路径的映射以工作流为唯一真源）；
 *   5. SITES 的地址基准 == es-plus-docs/vite.config.ts 里的 SITE_HOSTNAME
 *      （站点自报的规范域名），避免换域名时只改一处。
 *
 * 用法：node scripts/check-site-nav.mjs
 * 退出码：0 = 全部通过；1 = 漂移或接线错误。
 */
import { readFileSync, existsSync } from 'node:fs'
import { fileURLToPath } from 'node:url'
import { dirname, join } from 'node:path'

const __dirname = dirname(fileURLToPath(import.meta.url))
const ROOT = join(__dirname, '..')

// 站点目录 → 该站在 SITES 里的身份 key。这是本脚本的输入，不是被校验对象：
// 它表达「哪个目录是哪个渲染端」，改这里意味着站点定位变了。
const SITE_TARGETS = [
  { dir: 'es-plus-docs', key: 'vue3', file: 'es-plus-docs/src/components/layout/AppHeader.vue' },
  { dir: 'es-pc', key: 'antdv', file: 'es-pc/src/layouts/DocLayout.vue' },
  { dir: 'es-eui', key: 'vue2', file: 'es-eui/src/App.vue' },
]

const DEPLOY_WORKFLOW = '.github/workflows/deploy-docs.yml'
const VITE_CONFIG = 'es-plus-docs/vite.config.ts'

let failed = false
const fail = (msg) => {
  failed = true
  console.error(`❌ ${msg}`)
}
const read = (p) => {
  const abs = join(ROOT, p)
  if (!existsSync(abs)) {
    fail(`文件缺失：${p}`)
    return null
  }
  return readFileSync(abs, 'utf-8')
}

/** 抽取 `const SITES = [ ... ]` 的数组字面量（方括号配对，避免正则截断） */
function extractSites(src, rel) {
  const m = src.match(/const\s+SITES\s*=\s*\[/)
  if (!m) {
    fail(`未在 ${rel} 找到 const SITES = [`)
    return null
  }
  const open = src.indexOf('[', m.index)
  let depth = 0
  for (let i = open; i < src.length; i++) {
    const ch = src[i]
    if (ch === '[') depth++
    else if (ch === ']') {
      depth--
      if (depth === 0) return src.slice(open + 1, i)
    }
  }
  fail(`${rel} 的 SITES 数组未闭合`)
  return null
}

/** 从 SITES 字面量里解析出 key → url */
function parseEntries(literal, rel) {
  const entries = []
  for (const m of literal.matchAll(/\{([^{}]*)\}/g)) {
    const body = m[1]
    const key = body.match(/key:\s*'([^']+)'/)?.[1]
    const url = body.match(/url:\s*'([^']+)'/)?.[1]
    const label = body.match(/label:\s*'([^']+)'/)?.[1]
    if (!key) fail(`${rel} 的 SITES 有一项缺少 key`)
    else if (!url) fail(`${rel} 的 SITES 项 ${key} 缺少 url（切换器只应公布一条规范地址）`)
    else entries.push({ key, url, label, raw: body })
  }
  return entries
}

/** 从 deploy-docs.yml 的合成步骤解析「站点目录 → Pages 子路径」 */
function parseDeployPaths() {
  const src = read(DEPLOY_WORKFLOW)
  if (!src) return null
  const map = new Map()
  // 形如：  cp -r es-pc/dist/. _site/es-pc/
  for (const m of src.matchAll(/cp\s+-r\s+([\w.-]+)\/dist\/\.\s+_site\/([\w./-]*)/g)) {
    const dir = m[1]
    const sub = m[2].replace(/\/$/, '') // '' 表示部署在根
    map.set(dir, sub)
  }
  if (!map.size) {
    fail(
      `未能从 ${DEPLOY_WORKFLOW} 解析出「站点目录 → Pages 子路径」映射` +
        '（本脚本依赖该工作流的 cp -r <dir>/dist/. _site/<sub>/ 形式；改了写法请同步本脚本）',
    )
    return null
  }
  return map
}

function main() {
  const parsed = []
  for (const t of SITE_TARGETS) {
    const src = read(t.file)
    if (!src) continue
    const literal = extractSites(src, t.file)
    if (literal === null) continue

    // ── 2. 站点自报身份（不再由 hostname 反推）──
    const keyMatch = src.match(/const\s+SITE_KEY\s*=\s*'([^']+)'/)
    if (!keyMatch) {
      fail(
        `${t.file} 未声明 const SITE_KEY —— 当前站必须由站点自己声明。` +
          '按 hostname/pathname 反推覆盖不了 localhost 与自有域名，猜错会显示错误的当前站。',
      )
    } else if (keyMatch[1] !== t.key) {
      fail(`${t.file} 的 SITE_KEY 是 '${keyMatch[1]}'，但该站点应是 '${t.key}'`)
    }
    if (/detectCurrentSite|isGithubDeploy/.test(src)) {
      fail(
        `${t.file} 仍存在按 hostname 判断部署的分支（detectCurrentSite / isGithubDeploy）—— ` +
          '这正是「本地/自有域名下当前站识别错误 + 跳向备用地址」的来源。',
      )
    }

    // ── 3. 不得再有第二套「备用部署」地址 ──
    if (/tencent:|edgeone|\.github:/.test(literal)) {
      fail(
        `${t.file} 的 SITES 仍含备用部署字段（tencent / edgeone / github 双地址）—— ` +
          '未被 CI 维护的部署不应出现在 UI 上；确需恢复时请同时补上可验证的部署工作流。',
      )
    }
    for (const e of parseEntries(literal, t.file)) {
      // 先剥掉字符串字面量，否则 url 值里的 `https:` 会被当成一个属性名
      const stripped = e.raw.replace(/'[^']*'/g, "''")
      const extra = stripped.match(/\b(?!key\b|label\b|url\b)[A-Za-z_$][\w$]*\s*:/g)
      if (extra) {
        fail(`${t.file} 的 SITES 项 ${e.key} 含预期外字段：${extra.join(', ')}`)
      }
    }

    parsed.push({ ...t, literal: literal.replace(/\s+/g, ' ').trim(), entries: parseEntries(literal, t.file) })
  }

  // ── 1. 三处数组内容一致 ──
  if (parsed.length > 1) {
    const ref = parsed[0]
    for (const p of parsed.slice(1)) {
      if (p.literal !== ref.literal) {
        fail(
          `${p.dir} 的 SITES 数组与 ${ref.dir} 不一致：\n` +
            `   ${ref.dir}: ${ref.literal}\n   ${p.dir}: ${p.literal}`,
        )
      }
    }
    if (!failed) console.log(`✅ 三站 SITES 数组逐字一致（${parsed.length} 处）`)
  }

  // ── 4. UI 公布的地址 == CI 实际部署的子路径 ──
  const deployPaths = parseDeployPaths()
  if (deployPaths) {
    const perSite = new Map(parsed.map((p) => [p.key, p]))
    const base = perSite.get('vue3')?.entries.find((e) => e.key === 'vue3')?.url
    if (!base) {
      fail('未能确定 SITES 中 vue3（根站点）的 url，无法推导地址基准')
    } else {
      for (const t of SITE_TARGETS) {
        const sub = deployPaths.get(t.dir)
        if (sub === undefined) {
          fail(`${DEPLOY_WORKFLOW} 未把 ${t.dir} 拷进 Pages 产物（应有一行 cp -r ${t.dir}/dist/. _site/…）`)
          continue
        }
        const site = perSite.get(t.key)
        const url = site?.entries.find((e) => e.key === t.key)?.url
        if (!url) continue
        const expected = sub ? `${base}${sub}/` : base
        if (url !== expected) {
          fail(
            `切换器里 ${t.key} 的 url 是 ${url}，但按 ${DEPLOY_WORKFLOW}，${t.dir} 被部署到 ` +
              `${expected}（子路径 "${sub}"）—— UI 上公布的地址与 CI 实际部署不一致`,
          )
        }
      }
      if (!failed) console.log('✅ 切换器地址与部署工作流的子路径一致（3 站）')

      // ── 5. 地址基准 == 站点自报的规范域名 ──
      const vite = read(VITE_CONFIG)
      if (vite) {
        const host = vite.match(/SITE_HOSTNAME\s*=\s*'([^']+)'/)
        if (!host) {
          fail(`未能在 ${VITE_CONFIG} 定位 SITE_HOSTNAME`)
        } else {
          const expectedBase = `${host[1].replace(/\/$/, '')}/`
          if (base !== expectedBase) {
            fail(
              `切换器的地址基准是 ${base}，而 ${VITE_CONFIG} 的 SITE_HOSTNAME 推出应为 ` +
                `${expectedBase} —— 两处都在声明「本站的规范地址」，换域名时必须同步`,
            )
          } else {
            console.log(`✅ 切换器地址基准与站点规范域名一致（${base}）`)
          }
        }
      }
    }
  }

  if (failed) {
    console.error('\n三站站点切换器存在漂移或接线错误。')
    process.exit(1)
  }
  console.log('\n三站站点切换器 ✅')
}

main()
