#!/usr/bin/env node
/**
 * 「一份配置」对比样例的**实测**数字生成。
 *
 * 背景：首页对比卡长期写「30 行 vs 200/250 行 = 减少 70%」，但卡里展示的两段代码
 * 实测只有 19 行 vs 31 行（−39%），三处数字（slogan 的 250、locales 的 200、卡内注释的
 * 150）互不相同、也都与展示的代码无关。更根本的问题在口径：**两侧从来不是同一个页面** ——
 * 左边是含完整联动的 CRUD，右边是 2 字段 2 列的玩具版。这样比出来的百分比没有意义。
 *
 * 本脚本的做法：
 *   1. 单源是两段**完整可运行**的源码（docs/brand/one-config/native.vue 与 esplus.vue），
 *      同一页面、同一功能范围（查询表单 + 表格 + 分页 + 行内动作），无省略号、无 stub；
 *   2. 从源码**实算**两个口径的行数，产出 docs/brand/one-config-diff.json 供三站展示；
 *   3. 站点的数字不再硬编码 —— 展示的就是这里算出来的值，改代码即改数字。
 *
 * 两个口径（都写进产出，页面上都要给，避免只挑好看的那个）：
 *   - markup+glue：模板区行数 + 脚本区「事件处理与取数函数」行数。
 *     这是 es-plus 真正消除的部分（查询/重置/翻页/取数/loading 全自动）；
 *     字段与列的**声明**两侧都得写，不该计入降幅，所以单列一个口径。
 *   - wholeFile：整页非空行数。降幅明显更小，一并披露。
 *
 * 用法：
 *   node scripts/gen-one-config-diff.mjs           # 生成
 *   node scripts/gen-one-config-diff.mjs --check   # 校验产出是否为最新（CI）
 *
 * 退出码：0 = 成功/一致；1 = 源文件缺失或产出过期。
 */
import { readFileSync, writeFileSync, existsSync, mkdirSync } from 'node:fs'
import { fileURLToPath } from 'node:url'
import { dirname, join } from 'node:path'
import { readText, sameText } from './lib/text-sync.mjs'

const __dirname = dirname(fileURLToPath(import.meta.url))
const ROOT = join(__dirname, '..')
const SRC_DIR = join(ROOT, 'docs', 'brand', 'one-config')
const TARGET = join(ROOT, 'docs', 'brand', 'one-config-diff.json')

const CHECK = process.argv.includes('--check')

/** 事件处理 / 取数函数的命名前缀（两个口径里「胶水」的定义，两侧同一规则） */
const GLUE_PREFIXES = ['handle', 'fetch', 'open', 'load', 'on']

const nonEmptyLines = (text) => text.replace(/\r\n/g, '\n').split('\n').filter((l) => l.trim() !== '')

/** 抽出 <template>…</template> 区 */
function templateBlock(text) {
  const start = text.indexOf('<template>')
  const end = text.lastIndexOf('</template>')
  if (start < 0 || end < 0 || end <= start) return ''
  return text.slice(start, end)
}

/** script 区里「事件处理 / 取数函数」的整段（含函数体），按名字前缀识别 */
function glueBlocks(text) {
  const start = text.indexOf('<script')
  const src = start >= 0 ? text.slice(start) : ''
  const blocks = []
  for (const m of src.matchAll(/const\s+([A-Za-z_$][\w$]*)\s*=\s*(?:async\s*)?\([^)]*\)\s*=>\s*\{/g)) {
    const name = m[1]
    if (!GLUE_PREFIXES.some((p) => name.startsWith(p))) continue
    // 花括号配对取出函数体
    let i = src.indexOf('{', m.index + m[0].length - 1)
    let depth = 0
    for (; i < src.length; i++) {
      if (src[i] === '{') depth++
      else if (src[i] === '}') {
        depth--
        if (depth === 0) {
          blocks.push(src.slice(m.index, i + 1))
          break
        }
      }
    }
  }
  return blocks
}

function measure(file) {
  const text = readText(file)
  const total = text.replace(/\r\n/g, '\n').replace(/\n$/, '').split('\n').length
  const nonEmpty = nonEmptyLines(text).length
  const tpl = nonEmptyLines(templateBlock(text)).length
  const glue = glueBlocks(text).reduce((n, b) => n + nonEmptyLines(b).length, 0)
  return {
    total,
    nonEmpty,
    templateLines: tpl,
    glueLines: glue,
    markupPlusGlue: tpl + glue,
  }
}

const pct = (from, to) => Math.round(((from - to) / from) * 1000) / 10

function build() {
  const files = {
    native: join(SRC_DIR, 'native.vue'),
    esplus: join(SRC_DIR, 'esplus.vue'),
  }
  for (const [k, f] of Object.entries(files)) {
    if (!existsSync(f)) {
      console.error(`❌ 对比样例缺失：${f.replace(ROOT + '\\', '').replace(ROOT + '/', '')}`)
      console.error('（两份样例是本对比的唯一证据来源，缺一不可）')
      process.exit(1)
    }
  }

  const native = measure(files.native)
  const esplus = measure(files.esplus)

  return {
    $comment:
      '由 scripts/gen-one-config-diff.mjs 从 docs/brand/one-config/{native,esplus}.vue 实测生成，禁止手改。' +
      '站点展示的行数与降幅就是这里算出来的，改源码即改数字。',
    title: '用户管理 · 同一页面的两种写法（查询 + 列表 + 分页 + 行内操作）',
    scope: '两侧实现同一页面、同一功能范围，均为完整可运行代码（无省略号、无 stub）',
    metric:
      'markupPlusGlue = 模板区行数 + 脚本区「事件处理与取数函数」（handle* / fetch* / open* / load* / on*）行数 —— ' +
      '即 es-plus 真正消除的那部分；字段与列的声明两侧都必写，故不计入，另给 wholeFile 口径（整页非空行）。',
    metrics: {
      markupPlusGlue: {
        label: '模板 + 事件胶水代码',
        native: native.markupPlusGlue,
        esplus: esplus.markupPlusGlue,
        reduction: pct(native.markupPlusGlue, esplus.markupPlusGlue),
      },
      wholeFile: {
        label: '整页非空行',
        native: native.nonEmpty,
        esplus: esplus.nonEmpty,
        reduction: pct(native.nonEmpty, esplus.nonEmpty),
      },
    },
    breakdown: {
      native: { templateLines: native.templateLines, glueLines: native.glueLines, totalLines: native.total },
      esplus: { templateLines: esplus.templateLines, glueLines: esplus.glueLines, totalLines: esplus.total },
    },
    code: {
      native: { label: '原生写法（Element Plus）', file: 'native.vue', text: readText(files.native) },
      esplus: { label: 'ES-Plus 配置写法', file: 'esplus.vue', text: readText(files.esplus) },
    },
  }
}

function main() {
  const data = build()
  const content = JSON.stringify(data, null, 2) + '\n'

  if (CHECK) {
    if (!existsSync(TARGET)) {
      console.error('❌ 产出缺失：docs/brand/one-config-diff.json（运行 npm run one-config:gen）')
      process.exit(1)
    }
    if (!sameText(readText(TARGET), content)) {
      console.error(
        '❌ docs/brand/one-config-diff.json 与样例源码不一致 —— 对比样例改过了，' +
          '请运行 `npm run one-config:gen` 重新实测（站点上的行数/降幅必须来自真实源码）。',
      )
      process.exit(1)
    }
    const m = data.metrics
    console.log(
      `✅ 「一份配置」实测与产出一致：模板+胶水 ${m.markupPlusGlue.native} → ${m.markupPlusGlue.esplus} 行` +
        `（−${m.markupPlusGlue.reduction}%）；整页 ${m.wholeFile.native} → ${m.wholeFile.esplus} 行（−${m.wholeFile.reduction}%）`,
    )
    return
  }

  const dir = dirname(TARGET)
  if (!existsSync(dir)) mkdirSync(dir, { recursive: true })
  writeFileSync(TARGET, content)
  const m = data.metrics
  console.log(
    `✅ 已生成 docs/brand/one-config-diff.json：` +
      `模板+胶水 ${m.markupPlusGlue.native} → ${m.markupPlusGlue.esplus} 行（−${m.markupPlusGlue.reduction}%）；` +
      `整页 ${m.wholeFile.native} → ${m.wholeFile.esplus} 行（−${m.wholeFile.reduction}%）`,
  )
}

main()
