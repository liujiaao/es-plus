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
 *   - wholeFile：整页行数（含空行）。降幅明显更小，一并披露。
 *
 * 口径收敛（2026-10-27）：此前 wholeFile 统计的是**非空行**（136 → 81），
 * 而同页的整页徽章展示的是 breakdown.totalLines（151 → 90，含空行）——
 * 同一张对比卡上出现两组「整页行数」，读者只能读成自相矛盾。
 * 现在 wholeFile 就是整页行数（含空行），与徽章、理念文档的拆解表同源；
 * 非空行口径不再对外展示（两个百分比恰好都是 −40.4%，披露含空行没有损失）。
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

/**
 * 行尾归一。嵌入产出（`code.text`）的源码必须按 LF 入库：否则 Windows 检出
 * （core.autocrlf=true）会生成含 `\r\n` 的 JSON，与仓库里的 LF 版内容不等，
 * `--check` 在本机恒红、CI 恒绿 —— 门禁失去意义。归一后产出与平台无关，
 * `--check` 在本机与 CI 上判的是同一件事。
 */
const toLF = (text) => text.replace(/\r\n?/g, '\n')

const nonEmptyLines = (text) => toLF(text).split('\n').filter((l) => l.trim() !== '')

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
  const total = toLF(text).replace(/\n$/, '').split('\n').length
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

/**
 * 功能等价性守卫。
 *
 * 比例只有在「两侧干的是同一件事」时才有意义。此前 esplus.vue 把 `tableBtns` 写进了
 * `<es-table>` 的 options —— 而 es-table **不消费** tableBtns（只有 EsCrudPage 消费），
 * 于是操作列根本不渲染：右边少一列，左边有，算出来的降幅建立在一个不可运行的页面上。
 *
 * 这类错误不会被类型检查发现（options 是宽类型），也不会被行数统计发现，
 * 只能从「两侧都该有的东西是否都在」来卡。
 */
function assertEquivalent(nativeText, esplusText) {
  const errors = []
  const hasNativeOps = /label="操作"/.test(nativeText) && /编辑/.test(nativeText) && /删除/.test(nativeText)
  const hasEsplusOps = /label:\s*'操作'/.test(esplusText) && /编辑/.test(esplusText) && /删除/.test(esplusText)
  if (!hasNativeOps) errors.push('native.vue 缺少「操作」列（编辑/删除按钮）')
  if (!hasEsplusOps) errors.push('esplus.vue 缺少「操作」列（编辑/删除按钮）—— 两侧功能不等价，降幅没有意义')
  if (/tableBtns/.test(esplusText)) {
    errors.push(
      'esplus.vue 出现 tableBtns：该字段只由 EsCrudPage 消费，写在 <es-table> 的 options 里操作列不会渲染',
    )
  }
  if (errors.length) {
    console.error('❌ 「一份配置」对比样例不等价：')
    for (const e of errors) console.error('   - ' + e)
    process.exit(1)
  }
}

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
  assertEquivalent(readText(files.native), readText(files.esplus))

  return {
    $comment:
      '由 scripts/gen-one-config-diff.mjs 从 docs/brand/one-config/{native,esplus}.vue 实测生成，禁止手改。' +
      '站点展示的行数与降幅就是这里算出来的，改源码即改数字。',
    title: '用户管理 · 同一页面的两种写法（查询 + 列表 + 分页 + 行内操作）',
    scope:
      '两侧实现同一页面、同一功能范围（查询 + 列表 + 分页 + 行内操作），均为完整可运行代码（无省略号）；' +
      '「编辑」动作两侧一致为演示级（弹消息，不接真实接口），删除动作两侧都会真实发起请求',
    metric:
      'markupPlusGlue = 模板区行数 + 脚本区「事件处理与取数函数」（handle* / fetch* / open* / load* / on*）行数 —— ' +
      '即 es-plus 真正消除的那部分；字段与列的声明两侧都必写，故不计入，另给 wholeFile 口径（整页行数，含空行）。',
    metrics: {
      markupPlusGlue: {
        label: '模板 + 事件胶水代码',
        native: native.markupPlusGlue,
        esplus: esplus.markupPlusGlue,
        reduction: pct(native.markupPlusGlue, esplus.markupPlusGlue),
      },
      wholeFile: {
        label: '整页行数（含空行）',
        native: native.total,
        esplus: esplus.total,
        reduction: pct(native.total, esplus.total),
      },
    },
    breakdown: {
      native: { templateLines: native.templateLines, glueLines: native.glueLines, totalLines: native.total },
      esplus: { templateLines: esplus.templateLines, glueLines: esplus.glueLines, totalLines: esplus.total },
    },
    code: {
      native: { label: '原生写法（Element Plus）', file: 'native.vue', text: toLF(readText(files.native)) },
      esplus: { label: 'ES-Plus 配置写法', file: 'esplus.vue', text: toLF(readText(files.esplus)) },
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
        `（−${m.markupPlusGlue.reduction}%）；整页（含空行） ${m.wholeFile.native} → ${m.wholeFile.esplus} 行（−${m.wholeFile.reduction}%）`,
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
      `整页（含空行） ${m.wholeFile.native} → ${m.wholeFile.esplus} 行（−${m.wholeFile.reduction}%）`,
  )
}

main()
