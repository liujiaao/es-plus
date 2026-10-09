#!/usr/bin/env node
/**
 * 片段发射器编译冒烟（确定性、零 LLM、无需 vite）。
 *
 * `composeCrudConfig → generateFromConfig` 这条「含表格」路径的编译保证由既有的
 * golden 评分（__tests__/golden/scripts/score-golden.mjs）+ 夜间 e2e vite build 兜底。
 * 但 generate_form / generate_table / generate_dialog 的**独立片段**是**新**的发射
 * 路径——它们不经过 generateFromConfig，所以必须有自己的「拼出来的东西能解析」证明。
 *
 * 本脚本按 子集 × 三端 × ts/js 的矩阵，确定性地跑一遍 generate*Block，再用和
 * score-golden 完全相同的那把尺子解析产物：
 *   - `<es-form>` / `<es-table>` SFC → 抽出每个 <script> 块，按声明 lang 选 loader 用
 *     esbuild.transformSync 解析（TS/JSX 语法错误会抛）；
 *   - dialog composable → 本身就是一个 .tsx/.jsx 模块（非 SFC），整体按 tsx/jsx 解析。
 *
 * 覆盖不到的是模板编译与依赖解析（那是 e2e 的职责），但「片段发射器拼出语法错误代码」
 * 这一类真实故障从此在 PR 上就会红——与 score-golden 对配置路径的保证同级。
 *
 * 用法：node scripts/compile-smoke.mjs
 * 退出码：0 = 全部可解析；1 = 至少一个产物解析失败。
 */
import { transformSync } from 'esbuild'
import { generateFormBlock, generateTableBlock, generateDialogBlock } from '@es-plus/shared'

const TARGETS = /** @type {const} */ (['vue3', 'vue2', 'antdv'])
const TS = [true, false]

/** 解析一段源码(只解析语法、不解析依赖)；失败则把标签+首行错误塞进 failures。 */
function parse(src, loader, label, failures) {
  try {
    transformSync(src, { loader })
  } catch (err) {
    failures.push(`${label} — ${String(err.message).split('\n').slice(0, 2).join(' ')}`)
  }
}

/** 一个 SFC 产物:抽出所有 <script> 块,按声明 lang 选 loader 逐块解析。 */
function parseSfc(sfc, label, failures) {
  const blocks = [...sfc.matchAll(/<script\b([^>]*)>([\s\S]*?)<\/script>/gi)]
  if (blocks.length === 0) {
    failures.push(`${label} — 产物里没有 <script> 块`)
    return
  }
  for (const [, attrs, body] of blocks) {
    const lang = (attrs.match(/lang\s*=\s*["']?([a-z]+)/i) || [])[1]?.toLowerCase()
    const loader = lang === 'tsx' ? 'tsx' : lang === 'jsx' ? 'jsx' : lang === 'ts' ? 'ts' : 'js'
    parse(body, loader, label, failures)
  }
}

const f = (prop, label, formtype, extra = {}) => ({ prop, label, formtype, ...extra })

// 字段词汇:覆盖几类有代表性的控件,确保 buildFormItem/buildTableColumnSFC 的各分支都被走到。
const FORM_FIELDS = [
  f('name', '姓名', 'Input', { required: true }),
  f('status', '状态', 'Select', { dataOptions: [{ label: '启用', value: 1 }, { label: '禁用', value: 0 }] }),
  f('birthday', '生日', 'DatePicker'),
  f('bio', '简介', 'Input', { attrs: { type: 'textarea', maxlength: 200 } }),
  f('enabled', '启用', 'Switch'),
]
const TABLE_FIELDS = [
  f('name', '姓名', 'Input'),
  f('status', '状态', 'Select'),
  f('amount', '金额', 'InputNumber', { align: 'right', formatter: '(row) => Number(row.amount).toFixed(2)' }),
  f('createdAt', '创建时间', 'DatePicker'),
]
const ROW_BUTTONS = [
  { name: '查看', key: 'view' },
  { name: '编辑', type: 'primary', key: 'edit' },
  { name: '删除', type: 'danger', key: 'delete' },
]

function run() {
  const failures = []
  let count = 0

  for (const target of TARGETS) {
    for (const typescript of TS) {
      const tag = `${target}/${typescript ? 'ts' : 'js'}`

      // ── generate_form:两种 span 语境 × 三种按钮形态 ──
      for (const context of /** @type {const} */ (['query', 'form'])) {
        for (const buttons of /** @type {const} */ (['none', 'query', 'submit'])) {
          count++
          const r = generateFormBlock({ fields: FORM_FIELDS, context, buttons, target, typescript })
          parseSfc(r.code, `form[${tag} ctx=${context} btn=${buttons}]`, failures)
        }
      }

      // ── generate_table:有/无 apiUrl × 有/无 行按钮 ──
      for (const withApi of [true, false]) {
        for (const withBtns of [true, false]) {
          count++
          const r = generateTableBlock({
            fields: TABLE_FIELDS,
            apiUrl: withApi ? '/api/items' : undefined,
            rowButtons: withBtns ? ROW_BUTTONS : undefined,
            target,
            typescript,
          })
          parseSfc(r.code, `table[${tag} api=${withApi} btns=${withBtns}]`, failures)
        }
      }

      // ── generate_dialog:有/无 apiUrl(整体是 .tsx/.jsx 模块) ──
      for (const withApi of [true, false]) {
        count++
        const r = generateDialogBlock({
          fields: FORM_FIELDS,
          apiUrl: withApi ? '/api/items' : undefined,
          target,
          typescript,
        })
        parse(r.code, typescript ? 'tsx' : 'jsx', `dialog[${tag} api=${withApi}]`, failures)
      }
    }
  }

  if (failures.length) {
    console.error(`❌ compile-smoke: ${failures.length}/${count} 个片段产物解析失败：`)
    for (const m of failures) console.error(`   - ${m}`)
    process.exit(1)
  }
  console.log(`✅ compile-smoke: ${count} 个片段产物全部可解析（generate_form/table/dialog × 三端 × ts/js）`)
}

run()
