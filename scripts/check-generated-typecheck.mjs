#!/usr/bin/env node
/**
 * 零模型确定性探针：**生成器产出的代码能不能过 `vue-tsc`**。
 *
 * ## 为什么需要它
 *
 * 在它之前，唯一能抓到「语法正确但类型不正确」的产物的是**付费的全量 eval**
 * （`eval-llm.mjs` 的 Tier B 类型腿，且只观测）。也就是说，「生成器产出能编译」
 * 依赖一次模型跑批 —— 把编译正确性外包给了模型。本探针把它变成**生成器契约**：
 * 不调任何模型、不读任何语料，只对固定 fixture 走 `generateFromConfig` → `vue-tsc`。
 *
 * ## 覆盖什么
 *
 * 2 份 fixture × 2 个 mode（schema / sfc）× 3 个 target（vue3 / vue2 / antdv）：
 *
 *   - **wide-derived**：16 个 formtype 全部出现；字段级 `dataOptions`（含 Cascader
 *     `children`）、`rules`、`attrs`、`labelKey`、`permissionValue`、`isHidden`（旧条件
 *     与 JSONLogic 表达式两种形态）、`reactions`、一层 `children` 容器、`formLayout.layout`
 *     （tabs 分组）、`dialogs.*.formItems`、`i18n: true`；
 *   - **wide-columns**：显式 `columns` —— `groups`（多级表头）、`filters` /
 *     `filterMode` / `autoFilters`、`dataOptions`（列级 + `tagType`）、`permissionValue`、
 *     `editRender`（`$input` + `props.type/digits`）、`type:'expand'` 列 + 列级
 *     `expandConfig`；顶层 `expandConfig` / `mergeConfig` / `treeConfig`；
 *     `tableOptions.engine:'vxe'` + `editConfig` + `configTableOut`。
 *
 * 选择这组形状的理由：它们正是**类型面最宽**的地方 —— 联合类型（`formtype`、
 * `tagType`、`editRender.name`）、递归（`columns[].groups`）、可辨识联合
 * （`filters.value` 的 string|number|boolean）、以及三端组件 prop 的签名差异。
 *
 * ## 自证（防止「全绿」是尺子坏了）
 *
 * 每次运行会额外注入**一条已知错误**的产物（`const n: number = 'x'`），并与真实
 * fixture 放进同一次 `vue-tsc`。最终判定是**双向**的：
 *
 *   - 注入必须红 —— 否则说明类型检查根本没量到东西（dist 缺、shims 没生效、路径映射
 *     失效），此时真实 fixture 的「绿」没有信息量；
 *   - 真实 fixture 必须全绿 —— 任何一条诊断都退出码 1。
 *
 * `runTypecheck` 自身在「一条都没测到」与「诊断归不到 case 上」时抛错，这里不再重复。
 *
 * ## 退出码
 * 0 = 全部 target × mode 的真实产物类型正确，且注入反例咬住了；
 * 1 = 至少一条真实产物有类型诊断 / 注入反例没咬住 / 环境问题（缺 dist、vue-tsc 崩）。
 *
 * ## 运行前提
 * `npm run build:components`（临时工程按 `packages/<target>/dist/index.d.ts` 解析组件）。
 */
import { fileURLToPath } from 'node:url'
import { dirname, join } from 'node:path'
import { loadGenerator } from './lib/generator-loader.mjs'
import {
  TYPECHECK_TARGETS,
  productFiles,
  runTypecheck,
  missingComponentDists,
} from './lib/typecheck-project.mjs'

const __dirname = dirname(fileURLToPath(import.meta.url))
const ROOT = join(__dirname, '..')

const TARGETS = Object.keys(TYPECHECK_TARGETS)
const MODES = ['schema', 'sfc']

const STATUS_OPTIONS = [
  { label: '启用', value: 1, tagType: 'success' },
  { label: '停用', value: 0, tagType: 'danger' },
]

/** 16 个 formtype 全覆盖 + 字段级扩展点（形状见文件头注）。 */
function wideDerived() {
  return {
    name: 'ProbeWideDerived',
    apiUrl: '/api/probe/derived',
    actions: ['add', 'edit', 'delete', 'export'],
    i18n: true,
    fields: [
      { prop: 'name', label: '姓名', formtype: 'Input', group: 'basic', required: true,
        rules: [{ required: true, message: '请输入姓名' }], attrs: { maxlength: 20 } },
      { prop: 'age', label: '年龄', formtype: 'InputNumber', group: 'basic',
        attrs: { min: 0, max: 120 } },
      { prop: 'status', label: '状态', formtype: 'Select', group: 'basic',
        dataOptions: STATUS_OPTIONS, permissionValue: 'probe:status' },
      { prop: 'birthday', label: '生日', formtype: 'DatePicker',
        attrs: { type: 'date', valueFormat: 'YYYY-MM-DD' } },
      { prop: 'startTime', label: '开始时间', formtype: 'TimePicker' },
      { prop: 'progress', label: '进度', formtype: 'Slider', attrs: { min: 0, max: 100 } },
      { prop: 'themeColor', label: '主题色', formtype: 'ColorPicker' },
      { prop: 'roles', label: '角色', formtype: 'Transfer',
        dataOptions: [{ label: '管理员', value: 'admin' }, { label: '运营', value: 'ops' }] },
      { prop: 'region', label: '地区', formtype: 'Cascader',
        dataOptions: [
          { label: '浙江', value: 'zj', children: [{ label: '杭州', value: 'hz' }] },
        ] },
      { prop: 'dept', label: '部门', formtype: 'TreeSelect',
        dataOptions: [
          { label: '技术部', value: 'tech', children: [{ label: '前端', value: 'fe' }] },
        ] },
      { prop: 'customer', label: '客户', formtype: 'Autocomplete',
        dataOptions: [{ label: '招商银行', value: 'cmb' }] },
      { prop: 'gender', label: '性别', formtype: 'Radio',
        dataOptions: [{ label: '男', value: 1 }, { label: '女', value: 2 }] },
      { prop: 'hobbies', label: '爱好', formtype: 'Checkbox',
        dataOptions: [{ label: '阅读', value: 'read' }, { label: '运动', value: 'sport' }] },
      { prop: 'enabled', label: '启用', formtype: 'Switch' },
      { prop: 'score', label: '评分', formtype: 'Rate', inQuery: false },
      { prop: 'avatar', label: '头像', formtype: 'Upload', inQuery: false },
      // ── 字段级扩展点：i18n 键 / 显隐（条件 + 表达式）/ 联动 / 嵌套容器 ──
      { prop: 'remark', label: '备注', formtype: 'Input', group: 'extra',
        labelKey: 'field.remark', attrs: { type: 'textarea' },
        isHidden: { field: 'status', op: 'eq', value: 0 } },
      { prop: 'amount', label: '金额', formtype: 'InputNumber', group: 'extra',
        isHidden: { or: [{ '==': [{ var: 'status' }, 0] }, { '>': [{ var: 'amount' }, 100] }] } },
      { prop: 'city', label: '城市', formtype: 'Select', group: 'extra',
        dataOptions: [{ label: '杭州', value: 'hz' }],
        reactions: [
          {
            dependencies: ['status'],
            when: { '==': [{ var: 'status' }, 1] },
            fulfill: {
              required: { '==': [{ var: 'status' }, 1] },
              dataOptions: [{ label: '上海', value: 'sh' }],
            },
          },
        ] },
      { prop: 'address', label: '地址', children: [
        { prop: 'street', label: '街道', formtype: 'Input' },
        { prop: 'zip', label: '邮编', formtype: 'Input' },
      ] },
    ],
    formLayout: {
      labelWidth: '80px',
      minFoldRows: 1,
      layout: {
        type: 'tabs',
        groups: [{ key: 'basic', label: '基础' }, { key: 'extra', label: '扩展' }],
        ungrouped: 'first',
      },
    },
    toolbarBtns: [{ name: '导入', type: 'primary', icon: 'Upload' }],
    tableBtns: [{ name: '导出', position: 'right', actionType: 'export' }],
    operationColumn: {
      label: '操作',
      width: 160,
      fixed: 'right',
      btns: [
        { name: '编辑', type: 'primary', dialogKey: 'edit' },
        { name: '删除', type: 'danger', key: 'delete', confirm: '确定删除？' },
      ],
    },
    dialogs: {
      add: {
        title: '新增',
        width: '560px',
        configBtn: [{ name: '确定', action: 'confirm' }, { name: '取消', action: 'cancel' }],
        formItems: [
          { prop: 'name', label: '姓名', formtype: 'Input', group: 'basic',
            rules: [{ required: true, message: '请输入姓名' }] },
          { prop: 'status', label: '状态', formtype: 'Select', dataOptions: STATUS_OPTIONS },
          { prop: 'remark', label: '备注', formtype: 'Input', attrs: { type: 'textarea' } },
        ],
        formLayout: {
          layout: { type: 'collapse', groups: [{ key: 'basic', label: '基础' }], ungrouped: 'first' },
        },
      },
      edit: {
        title: '编辑',
        formItems: [{ prop: 'name', label: '姓名', formtype: 'Input' }],
      },
    },
    pagination: { pageSize: 20, pageSizes: [10, 20, 50] },
    tableOptions: { border: true, stripe: true, rowkey: 'id' },
  }
}

/** 显式列 + vxe 引擎 + 展开/合并/树（形状见文件头注）。 */
function wideColumns() {
  return {
    name: 'ProbeWideColumns',
    apiUrl: '/api/probe/columns',
    actions: ['add', 'edit', 'delete'],
    fields: [
      { prop: 'group', label: '分组', formtype: 'Input' },
      { prop: 'name', label: '姓名', formtype: 'Input' },
      { prop: 'age', label: '年龄', formtype: 'InputNumber' },
      { prop: 'amount', label: '金额', formtype: 'InputNumber' },
      { prop: 'status', label: '状态', formtype: 'Select', dataOptions: STATUS_OPTIONS },
      { prop: 'parentId', label: '上级', formtype: 'Input', inQuery: false, inTable: false },
    ],
    columns: [
      { type: 'selection', width: 48 },
      { type: 'index', label: '#', width: 60 },
      {
        prop: 'group',
        label: '分组',
        width: 120,
        dataOptions: [{ label: 'A 组', value: 'a', tagType: 'primary' }],
        filters: [{ text: 'A 组', value: 'a' }, { text: 'B 组', value: 'b' }],
        filterMode: 'includes',
        permissionValue: 'probe:group',
      },
      {
        label: '基础信息',
        groups: [
          { prop: 'name', label: '姓名', minWidth: 120 },
          { prop: 'age', label: '年龄', align: 'right' },
        ],
      },
      {
        prop: 'amount',
        label: '金额',
        editRender: { name: '$input', props: { type: 'float', digits: 2 }, defaultValue: 0 },
      },
      { prop: 'status', label: '状态', dataOptions: STATUS_OPTIONS, autoFilters: true },
      {
        type: 'expand',
        expandConfig: {
          title: '明细',
          fields: [{ prop: 'name', label: '姓名' }, { prop: 'remark', label: '备注', labelKey: 'field.remark' }],
        },
      },
    ],
    tableOptions: {
      engine: 'vxe',
      rowkey: 'id',
      editConfig: { trigger: 'click', mode: 'cell' },
      configTableOut: { tableData: 'rows', total: 'total', current: 'pageNo', pageSize: 'pageSize' },
      expandConfig: { accordion: true },
    },
    expandConfig: { title: '行详情', fields: [{ prop: 'name', label: '姓名' }] },
    mergeConfig: { rowsBy: ['group'] },
    treeConfig: { childrenField: 'children', expandAll: false },
    // sfc 模式会把这些按钮真正接线；schema 模式发射为数据。
    tableBtns: [{ name: '导出', position: 'right', actionType: 'export' }],
    operationColumn: {
      label: '操作',
      btns: [{ name: '编辑', type: 'primary', dialogKey: 'edit' }],
    },
    dialogs: {
      edit: { title: '编辑', formItems: [{ prop: 'name', label: '姓名', formtype: 'Input' }] },
    },
    pagination: { pageSize: 10 },
  }
}

const FIXTURES = [
  { id: 'wide-derived', build: wideDerived },
  { id: 'wide-columns', build: wideColumns },
]

export { FIXTURES }

/**
 * 注入反例：一段**确定过不了类型检查**的 TS。放在同一次 `vue-tsc` 里，
 * 用来证明这次运行真的在看类型（而不是因为 dist 缺失/路径没映射而「零诊断」）。
 */
const INJECTED_BAD_FILE = `// 本文件由 check-generated-typecheck.mjs 注入 —— 故意写错，用来证明类型检查真的在跑。
export const injectedTypeError: number = 'this is not a number'
`

async function main() {
  const missing = missingComponentDists(ROOT)
  if (missing.length) {
    console.error(
      `❌ 组件构建产物缺失：${missing.join('；')}\n` +
        `   本探针按 packages/<target>/dist/index.d.ts 解析组件类型，先跑 \`npm run build:components\`。`
    )
    process.exit(1)
  }

  const generator = await loadGenerator()
  const cases = []
  for (const target of TARGETS) {
    for (const mode of MODES) {
      for (const fixture of FIXTURES) {
        const id = `${fixture.id}-${mode}-${target}`
        try {
          const product = generator.generateFromConfig({
            ...fixture.build(),
            target,
            mode,
            typescript: true,
          })
          const files = productFiles(product)
          if (files.length === 0) {
            cases.push({ id, target, error: '生成器没有返回产物' })
            continue
          }
          cases.push({ id, target, files })
        } catch (e) {
          cases.push({ id, target, error: e instanceof Error ? e.message : String(e) })
        }
      }
      // 每个 target 一条注入反例（同一次 vue-tsc，零额外进程）。
      cases.push({
        id: `injected-${mode}-${target}`,
        target,
        files: [{ name: 'schema.ts', content: INJECTED_BAD_FILE }],
      })
    }
  }

  const rows = runTypecheck({ cwd: ROOT, cases, timeoutMs: 300000 })
  const byId = new Map(rows.map((r) => [r.id, r]))

  let failures = 0

  // ① 注入反例必须红 —— 否则「真实 fixture 全绿」没有信息量。
  for (const target of TARGETS) {
    for (const mode of MODES) {
      const id = `injected-${mode}-${target}`
      const row = byId.get(id)
      if (!row) {
        failures++
        console.error(`  ✗ ${id}: 没有回报行（类型腿没跑这条 case）`)
        continue
      }
      if (row.typechecks !== false) {
        failures++
        console.error(
          `  ✗ ${id}: 注入的确定类型错误竟然没被诊断 —— 类型检查没量到东西（shims/路径/dist 检查失效），` +
            `本次所有「绿」都不算数`
        )
      }
    }
  }

  // ② 真实 fixture 必须全绿。
  let checked = 0
  for (const c of cases) {
    if (c.id.startsWith('injected-')) continue
    const row = byId.get(c.id)
    if (!row) {
      failures++
      console.error(`  ✗ ${c.id}: 没有回报行（类型腿没跑这条 case）`)
      continue
    }
    if (row.error || row.typechecks === null) {
      failures++
      console.error(`  ✗ ${c.id}: 没测到 —— ${row.error ?? '没有产物'}`)
      continue
    }
    checked++
    if (row.typechecks === false) {
      failures++
      console.error(`  ✗ ${c.id}: ${row.diagnostics.length} 条类型诊断`)
      for (const d of row.diagnostics.slice(0, 5)) {
        console.error(`      ${d.file}:${d.line}:${d.column} — ${d.code}: ${d.message}`)
      }
    }
  }

  if (failures) {
    console.error(`\n❌ 生成物类型探针失败（${failures} 项）`)
    process.exit(1)
  }
  console.log(
    `✅ 生成物类型探针通过：${checked} 份产物（${FIXTURES.length} fixtures × ${MODES.length} modes × ${TARGETS.length} targets）` +
      `类型全绿；${TARGETS.length * MODES.length} 条注入反例全部被诊断（证明尺子在量）`
  )
}

// main-guard：被 import（排障脚本 / 自测）时不得自己跑一遍 vue-tsc ——
// `gen-one-config-diff.mjs` 少了这一行，import 它会直接覆写产物，是同一个坑。
if (process.argv[1] && fileURLToPath(import.meta.url) === process.argv[1]) {
  main().catch((e) => {
    console.error(`❌ 生成物类型探针异常：${e instanceof Error ? e.stack : e}`)
    process.exit(1)
  })
}
