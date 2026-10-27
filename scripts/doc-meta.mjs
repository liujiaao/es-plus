/**
 * 文档「最后更新」数据源：每个文档页的源文件 → 该文件最后一次提交的日期。
 *
 * 为什么不用手写日期表：手写的那份一定过期（审计 §文案：更新日志停在 1.1.x、
 * Vue2 站版本停在 v1.0.2）。为什么不在源码里 import 一份生成的 JSON：那样每提交
 * 一次文档就会产生一次「产物比提交早一天」的漂移，仓库里长期挂着一个脏文件。
 * 这里改成**构建期注入**：三站的 vite/vue-cli 配置调用 docMeta()，把结果作为
 * 编译常量 `__ES_DOC_META__` 注进去，磁盘上不落任何文件。
 *
 * 取数方式：一次 `git log --name-only` 扫全历史（倒序，某路径首次出现即最新提交），
 * 而不是对每个文件各起一个 git 进程 —— 后者在 Windows 上要几十次进程启动。
 * 没有 git（源码包分发、无历史的浅克隆）时退回文件 mtime，保证构建不失败。
 *
 * 用法：
 *   node scripts/doc-meta.mjs            # 打印三站映射，人工核对键名
 */

import { execFileSync } from 'node:child_process'
import { statSync } from 'node:fs'
import { fileURLToPath } from 'node:url'
import { dirname, join } from 'node:path'

const __dirname = dirname(fileURLToPath(import.meta.url))
export const ROOT = join(__dirname, '..')

/**
 * 每站「文档页键 → 源文件」清单。
 *
 * 键 = 页面在站内代码里查找用的 key（与路由/注册表同名），值 = 仓库相对路径。
 * 只有**真正的文档页**才登记：首页、案例、画廊、404 这类页面不显示「最后更新」
 * （它们不是文档，日期没有读者价值）。
 *
 * 组件/高级文档页的正文写在 component-doc.data.ts / advanced-doc.data.ts 里
 * （示例代码另有来源），所以日期取这两个数据文件 —— 页面上读到的字最后改于哪天。
 */
export const DOC_SOURCES = {
  'es-plus-docs': {
    'guide/why-es-plus': 'es-plus-docs/src/docs/why-es-plus.md',
    'guide/getting-started': 'es-plus-docs/src/docs/getting-started.md',
    'guide/installation': 'es-plus-docs/src/docs/installation.md',
    'guide/usage': 'es-plus-docs/src/docs/usage.md',
    'guide/vue2': 'es-plus-docs/src/docs/vue2.md',
    'guide/adapter-antdv': 'es-plus-docs/src/docs/adapter-antdv.md',
    'guide/mcp-server': 'es-plus-docs/src/docs/mcp-server.md',
    'guide/cli': 'es-plus-docs/src/docs/cli.md',
    'guide/permission-i18n': 'es-plus-docs/src/docs/permission-i18n.md',
    'guide/schema-setup': 'es-plus-docs/src/docs/schema-setup.md',
    'guide/migration': 'es-plus-docs/src/docs/migration.md',
    'guide/changelog': 'es-plus-docs/src/docs/changelog.md',
    'components': 'es-plus-docs/src/views/component-doc.data.ts',
    'advanced': 'es-plus-docs/src/views/advanced-doc.data.ts',
  },
  'es-pc': {
    guide: 'es-pc/src/views/Guide.vue',
    'es-form': 'es-pc/src/views/EsForm.vue',
    'es-table': 'es-pc/src/views/EsTable.vue',
    'es-dialog': 'es-pc/src/views/EsDialog.vue',
    'es-crud-page': 'es-pc/src/views/EsCrudPage.vue',
    'es-error-boundary': 'es-pc/src/views/EsErrorBoundary.vue',
    'svg-icon': 'es-pc/src/views/SvgIcon.vue',
    advanced: 'es-pc/src/views/Advanced.vue',
    'es-vxe-table': 'es-pc/src/views/EsVxeTable.vue',
    'ai-tools': 'es-pc/src/views/AiTools.vue',
  },
  'es-eui': {
    '/guide': 'es-eui/src/views/guide/introduction.vue',
    '/guide/installation': 'es-eui/src/views/guide/installation.vue',
    '/guide/quickstart': 'es-eui/src/views/guide/quickstart.vue',
    '/guide/configuration': 'es-eui/src/views/guide/configuration.vue',
    '/guide/theme': 'es-eui/src/views/guide/theme.vue',
    '/guide/i18n': 'es-eui/src/views/guide/i18n.vue',
    '/guide/developer-guide': 'es-eui/src/views/docs/EsEuiDeveloperGuide.vue',
    '/component/installation': 'es-eui/src/views/component/installation.vue',
    '/component/estable': 'es-eui/src/views/docs/EsTableDocs.vue',
    '/component/vxetable': 'es-eui/src/views/docs/VxeTableDocs.vue',
    '/component/esform': 'es-eui/src/views/docs/EsFormDocs.vue',
    '/component/esdialog': 'es-eui/src/views/docs/EsDialogDocs.vue',
    '/component/escrudpage': 'es-eui/src/views/docs/EsCrudPageDocs.vue',
    '/component/eserrorboundary': 'es-eui/src/views/docs/EsErrorBoundaryDocs.vue',
    '/component/svgicon': 'es-eui/src/views/docs/SvgIconDocs.vue',
    '/component/combination': 'es-eui/src/views/docs/CombinationDocs.vue',
  },
}

let dateCache = null

/** 仓库内每个路径的最新提交日期（一次 git log，倒序扫描）。 */
function gitDateMap() {
  if (dateCache) return dateCache
  const map = new Map()
  try {
    const raw = execFileSync(
      'git',
      ['log', '--format=%x01%cs', '--name-only', '--no-renames', '--no-color'],
      { cwd: ROOT, encoding: 'utf8', maxBuffer: 128 * 1024 * 1024 }
    )
    for (const record of raw.split('\u0001')) {
      const lines = record.split('\n')
      const date = (lines.shift() || '').trim()
      if (!/^\d{4}-\d{2}-\d{2}$/.test(date)) continue
      for (const line of lines) {
        const path = line.trim()
        if (path && !map.has(path)) map.set(path, date)
      }
    }
  } catch {
    // 没有 git / 没有历史：保持空表，由调用方退回 mtime
  }
  dateCache = map
  return map
}

function mtimeDate(relPath) {
  try {
    return statSync(join(ROOT, relPath)).mtime.toISOString().slice(0, 10)
  } catch {
    return ''
  }
}

/**
 * @param {keyof typeof DOC_SOURCES} site
 * @returns {Record<string, string>} 页面键 → YYYY-MM-DD
 */
export function docMeta(site) {
  const sources = DOC_SOURCES[site]
  if (!sources) throw new Error(`doc-meta: 未知站点 ${site}`)
  const dates = gitDateMap()
  const meta = {}
  for (const [key, rel] of Object.entries(sources)) {
    const date = dates.get(rel) || mtimeDate(rel)
    if (date) meta[key] = date
    else console.warn(`doc-meta: 找不到 ${rel} 的日期（${site}/${key}）`)
  }
  return meta
}

// `node scripts/doc-meta.mjs` 打印三站映射，便于核对键名是否与路由一致
if (process.argv[1] && process.argv[1].replace(/\\/g, '/').endsWith('scripts/doc-meta.mjs')) {
  for (const site of Object.keys(DOC_SOURCES)) {
    console.log(`\n== ${site}`)
    const meta = docMeta(site)
    for (const [key, date] of Object.entries(meta)) console.log(`  ${date}  ${key}`)
  }
}
