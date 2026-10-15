#!/usr/bin/env node
/**
 * inQuery/inTable/inForm「默认 true」陷阱守卫（AI-33 · 上闸前必修③）。进 CI 的 check:consistency。
 *
 * ## 它防的是什么
 *
 * `FieldSchema` 里三个界面归属开关的 schema 默认值是 **true**
 * （`inQuery`/`inTable`/`inForm`，structured-config.schema.ts:222-224）：
 * 字段**不写**这个键 ⟹ 解析后为 `true` ⟹ 「该字段出现在这个界面上」。
 *
 * 于是产生一类**度量 bug（不是模型缺口）**：NL 明说「查询条件有 A、B、C」，
 * gold 的作者漏给 D 写 `inQuery:false`，zod 就把 D 解析成「是查询字段」——
 * **gold 与它自己的 NL 矛盾**。此时模型按 NL 正确地把 D 排除（写 `inQuery:false`，
 * 这正是 22 条 few-shot 全部演示过的写法，共 48 处显式排除），却被判错。
 *
 * 复核时的**铁证**不是推理而是自证：这些用例里作者往往**已经**给同一批被排除字段中
 * 的某一个写了 `inQuery:false`，却漏了其余几个。同一句话、同一批字段、同一份 gold，
 * 一半写了一半没写 —— 那是手滑，不是设计（如 107：sickProof 写了 false，
 * leaveType/startDate/days 没写，而 NL 是「查询有员工姓名」）。
 *
 * ## 它怎么做
 *
 * 「NL 是否排除了某字段」是自然语言判断，但**可以机械化到一个保守下界**：
 * 只在 NL 用了**穷举式**界面列举时才判定（「查询条件有…」「表格展示 A、B、C」）。
 * 「支持按商品名查询」「可以按状态筛选」这类**非穷举**表述一律不判 —— 它们没有声明
 * 「只有这些」，据此断言排除就会误伤。故本守卫只咬下界内的矛盾：
 *
 *   字段某开关省略（= 默认 true）∧ 该字段的 label 不在 NL 的穷举列表里 → 矛盾
 *
 * 下界**不全**（非穷举 NL 里的同类漏写抓不到），这是刻意的：宁可漏，不可误红 ——
 * 一条会误红的守卫会在几个 PR 内被加进 allowlist 然后永久失效。
 *
 * ## 覆盖面（为什么只查两个界面）
 *
 * · `inQuery`：NL 常穷举（「查询条件有…」）→ 查。实测抓出 50 处。
 * · `inTable`：NL 常穷举（「表格展示…」）→ 查。实测抓出 1 处。
 * · `inForm`：语料里的 NL **从不穷举表单字段集**（穷举的是「隐藏/必填/禁用」这类规则），
 *   而 gold 的 `inForm:false` 承载的是「createdAt 是系统字段」这类 NL 未言明的领域知识
 *   —— 那不是矛盾，是 few-shot #1/#6 教过的语义推断。故 `inForm` 不查（查了必误红）。
 *
 * ## 两类豁免
 *
 * · **refinements 非空的用例整例跳过**：gold 承载的是**精修后**的意图（如 27 的第 1 轮
 *   「创建时间也要能当查询条件」），其初版 NL 的列举已不再是目标；这类用例的 gold
 *   本来就已全量显式（27/28/29 实测：无一处省略）。
 * · `ADJUDICATED`：人工裁定为**有意省略**的用例（须写明理由）。默认空 —— 空即「无已知例外」，
 *   与 `knownGaps` 同理：例外必须留下痕迹，不能靠静默跳过。
 *
 * ## 自检
 *
 * 每次运行先用内联夹具验证抽取器本身（穷举 NL 必抓、非穷举 NL 必不抓、带括号列表必抓）。
 * 正则型守卫最大的风险是「悄悄失配后恒绿地通过」；夹具让它失配即红。
 */
import { readFileSync, readdirSync } from 'node:fs'
import { fileURLToPath } from 'node:url'
import { dirname, join } from 'node:path'
import { NL_TO_CONFIG_FEWSHOT } from '@es-plus/shared'
import { extractSurfaceList, findTrapFields } from './lib/membership-trap.mjs'

const __dirname = dirname(fileURLToPath(import.meta.url))
const CASES_DIR = join(__dirname, '..', '__tests__', 'golden', 'cases')

const FAIL_ONLY = process.argv.includes('--report') ? false : true

/** 人工裁定为「有意省略」的用例（键 = 文件名，值 = 理由）。空 = 无已知例外。 */
const ADJUDICATED = {}

// 抽取器与判定谓词在 scripts/lib/membership-trap.mjs（单源；迁移脚本共用同一套谓词）。

// ── 抽取器自检（内联夹具；失配即红）────────────────────────────────────────
let failures = 0
const fail = (msg) => {
  failures++
  console.error(`  ✗ ${msg}`)
}
{
  const FIX = [
    // [NL, surface, 期望列表（null = 不作判定）]
    ['查询条件有用户名、手机号、状态（启用/禁用）；表格展示用户名、头像。', 'inQuery', ['用户名', '手机号', '状态']],
    ['查询有员工姓名；表格展示员工姓名、请假类型。', 'inQuery', ['员工姓名']],
    ['支持按商品名模糊查询，还可以按状态筛选。', 'inQuery', null], // 非穷举 → 不判
    ['查询有商品名、仓库；表格展示商品名、仓库、系统数量。', 'inTable', ['商品名', '仓库', '系统数量']],
    ['表格展示省份、城市、详细地址；支持新增。', 'inTable', ['省份', '城市', '详细地址']],
    ['表格首列勾选，随后按「物流」分组。', 'inTable', null], // 无「展示」引导 → 不判
  ]
  for (const [nl, surface, want] of FIX) {
    const got = extractSurfaceList(nl, surface)
    const ok = want === null ? got === null : Array.isArray(got) && got.join('|') === want.join('|')
    if (!ok) fail(`抽取器自检失败 [${surface}] 「${nl}」→ 得到 ${JSON.stringify(got)}，期望 ${JSON.stringify(want)}`)
  }
  // 端到端夹具：必须咬住「列表外的省略字段」，且不得牵连列表内字段
  const trap = findTrapFields({
    nl: '用户管理：查询条件有用户名、状态；表格展示用户名、状态、注册时间。',
    config: { fields: [{ prop: 'username', label: '用户名' }, { prop: 'status', label: '状态' }, { prop: 'createdAt', label: '注册时间' }] },
  })
  const got = trap.map((t) => `${t.surface}:${t.prop}`).sort().join(',')
  if (got !== 'inQuery:createdAt') fail(`端到端夹具失败：得到 ${got}，期望 inQuery:createdAt`)
}

// ── 扫语料 ────────────────────────────────────────────────────────────────
const files = readdirSync(CASES_DIR).filter((f) => f.endsWith('.json')).sort()
const hits = []
let scanned = 0
let exemptRefine = 0
let exemptAdjudicated = 0
for (const f of files) {
  const raw = JSON.parse(readFileSync(join(CASES_DIR, f), 'utf8'))
  if (raw.scene && raw.scene !== 'crud') continue
  if (raw.target && !raw.config) continue
  if (!raw.config || !Array.isArray(raw.config.fields)) continue
  scanned++
  if ((raw.refinements ?? []).length) {
    exemptRefine++
    continue
  }
  if (ADJUDICATED[f]) {
    exemptAdjudicated++
    continue
  }
  const found = findTrapFields(raw)
  if (found.length) hits.push({ f, fields: found })
}

// few-shot 是**教学材料**，同样受此陷阱约束：示例里的漏写会直接教坏模型。
// （实测 22 条全部显式，48 处排除 —— 正因如此才敢断言语料里的漏写是手滑。）
const fewHits = []
for (const [i, ex] of NL_TO_CONFIG_FEWSHOT.entries()) {
  const found = findTrapFields({ nl: ex.nl, config: ex.config })
  if (found.length) fewHits.push({ f: `few#${i + 1} ${ex.config.name}`, fields: found })
}
for (const { f, fields: fs } of fewHits) {
  fail(`few-shot ${f} 与自身 NL 矛盾：${fs.map((x) => `${x.surface}:${x.prop}(${x.label})`).join(', ')}`
    + ' —— few-shot 是教学材料，漏写会把「省略即排除」的错觉教给模型')
}

// 语料矛盾：先报告，再（FAIL_ONLY 时）判红
if (hits.length) {
  const n = hits.reduce((s, h) => s + h.fields.length, 0)
  const lines = hits.map(
    (h) => `    ${h.f} → ${h.fields.map((x) => `${x.prop}(${x.label}) 缺 ${x.surface}:false`).join('; ')}`
  )
  if (FAIL_ONLY) {
    fail(
      `${hits.length} 条用例（共 ${n} 处字段）与自身 NL 的穷举列举矛盾：\n${lines.join('\n')}\n`
      + '    zod 默认会把省略解析成 true ⟹ gold 声称这些字段**在**该界面上，与它自己的 NL 相反；\n'
      + '    模型按 NL 正确排除反而被判错。修法 = 给这些字段补显式 false（与 few-shot 同写法，\n'
      + '    是「让 gold 忠实于自己的 NL」，不是向模型 overfit）；确属有意省略者记入 ADJUDICATED 并写明理由。'
    )
  } else {
    console.log(`[membership-trap] REPORT：${hits.length} 条用例、${n} 处矛盾\n${lines.join('\n')}`)
  }
}

if (failures) {
  console.error(`\ncheck:membership-trap FAILED: ${failures} 处`)
  process.exit(1)
}
console.log(
  `[membership-trap] 扫描 ${scanned} 条 crud 用例 + ${NL_TO_CONFIG_FEWSHOT.length} 条 few-shot；`
  + `无「NL 穷举列举 vs gold 默认 true」矛盾 ✔`
  + `（豁免：refinements 非空 ${exemptRefine} 条，人工裁定 ${exemptAdjudicated} 条）`
)
