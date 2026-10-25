#!/usr/bin/env node
/**
 * 示例内联样式守卫：**只准减，不准增**。
 *
 * 背景（docs/internal/example-audit-and-flagship-plan.md §2 D10 / §11.2）：
 * D10 把三处密度最高的内联 style（71 处）抽成了 scoped 样式块，但当时只清那三个文件，
 * 全仓示例里还散着上百处 `style="margin-bottom: 10px"` 之类。要不要全清是取舍：
 * 一行的提示条上写死边距，比多一个 class 更好读；可这个判断**没有守卫**，
 * 半年后谁都可以再加，D10 就成了历史遗迹。
 *
 * 所以口径定为棘轮（ratchet）：
 *   · 每个文件的内联 style 数量不得超过 BASELINE 里记的数（没有记录 = 只准 0）；
 *   · 想新增？先把它写成 scoped class，或者把这段理由写进本文档再抬高基线 ——
 *     抬高基线应当是一次**显式**决定，而不是顺手加一行。
 *
 * 只数**模板段里的静态 `style="…"`**（`<script` 之前）：
 *   · `:style="…"` 是绑定，值来自数据，不算；
 *   · script 里的字符串（比如生成 HTML 的模板串）不算，那不是模板。
 *
 * 用法：
 *   node scripts/check-example-inline-style.mjs                  → 退出码 0 = 没有增长
 *   node scripts/check-example-inline-style.mjs --print-baseline → 打印当前计数（给下调基线用）
 */
import { readFileSync, readdirSync, existsSync } from 'node:fs'
import { fileURLToPath } from 'node:url'
import { dirname, join, relative } from 'node:path'

const ROOT = join(dirname(fileURLToPath(import.meta.url)), '..')

const SCAN_ROOTS = [
  'es-plus-docs/src/components/examples',
  'es-pc/src/views',
  'es-eui/src/examples',
]

/**
 * 存量基线：文件 → 允许的内联 style 个数（2026-10-25 复核时点）。
 * 下调随时欢迎（改小、删行都行）；上调请先说明为什么这笔内联比 class 更值得。
 */
const BASELINE = new Map([
  ['es-eui/src/examples/combination/BatchEdit.vue', 1],
  ['es-eui/src/examples/combination/BatchOperation.vue', 1],
  ['es-eui/src/examples/combination/DataFlowManagement.vue', 1],
  ['es-eui/src/examples/combination/EditableGridSubmit.vue', 6],
  ['es-eui/src/examples/combination/PermissionButtons.vue', 3],
  ['es-eui/src/examples/combination/RowApproval.vue', 1],
  ['es-eui/src/examples/combination/StepForm.vue', 4],
  ['es-eui/src/examples/dialog/AsyncContent.vue', 1],
  ['es-eui/src/examples/dialog/DynamicBtn.vue', 1],
  ['es-eui/src/examples/dialog/MultiInstance.vue', 1],
  ['es-eui/src/examples/form/ComputedFields.vue', 2],
  ['es-eui/src/examples/form/DetailMode.vue', 3],
  ['es-eui/src/examples/svg-icon/Basic.vue', 10],
  ['es-eui/src/examples/table/ConfigBtn.vue', 2],
  ['es-eui/src/examples/table/CurrentRow.vue', 2],
  ['es-eui/src/examples/table/CustomHttp.vue', 1],
  ['es-eui/src/examples/table/DetailDrawer.vue', 2],
  ['es-eui/src/examples/table/EditTable.vue', 2],
  ['es-eui/src/examples/table/FullHeight.vue', 1],
  ['es-eui/src/examples/table/MultiSelect.vue', 2],
  ['es-eui/src/examples/table/OptimisticToggle.vue', 3],
  ['es-eui/src/examples/table/RemoteCrud.vue', 1],
  ['es-eui/src/examples/table/Sort.vue', 1],
  ['es-eui/src/examples/vxe-table/CellEdit.vue', 3],
  ['es-eui/src/examples/vxe-table/ColumnResize.vue', 1],
  ['es-eui/src/examples/vxe-table/CrudWithDialog.vue', 2],
  ['es-eui/src/examples/vxe-table/CustomRender.vue', 1],
  ['es-eui/src/examples/vxe-table/EscapeHatch.vue', 3],
  ['es-eui/src/examples/vxe-table/ExpandRow.vue', 1],
  ['es-eui/src/examples/vxe-table/FooterSummary.vue', 5],
  ['es-eui/src/examples/vxe-table/MergeCells.vue', 4],
  ['es-eui/src/examples/vxe-table/ProxyConfig.vue', 2],
  ['es-eui/src/examples/vxe-table/RowEdit.vue', 2],
  ['es-eui/src/examples/vxe-table/SelectionIndex.vue', 4],
  ['es-eui/src/examples/vxe-table/SortFormatter.vue', 1],
  ['es-eui/src/examples/vxe-table/ToolbarExport.vue', 1],
  ['es-eui/src/examples/vxe-table/TreeData.vue', 2],
  ['es-pc/src/views/Advanced.vue', 7],
  ['es-pc/src/views/es-advanced/CrudPage.vue', 2],
  ['es-pc/src/views/es-advanced/VirtualTable.vue', 1],
  ['es-pc/src/views/es-advanced/VirtualTableCrud.vue', 1],
  ['es-pc/src/views/es-advanced/VirtualTableCustomRender.vue', 2],
  ['es-pc/src/views/es-advanced/VirtualTableRowStyle.vue', 3],
  ['es-pc/src/views/es-advanced/VirtualTableSelect.vue', 3],
  ['es-pc/src/views/es-advanced/VirtualTableSort.vue', 2],
  ['es-pc/src/views/es-crud/Permission.vue', 3],
  ['es-pc/src/views/es-crud/ProgramOpen.vue', 1],
  ['es-pc/src/views/es-table/QueryTable.vue', 2],
  ['es-pc/src/views/es-vxe/ColumnResize.vue', 1],
  ['es-pc/src/views/es-vxe/CustomRender.vue', 1],
  ['es-pc/src/views/es-vxe/EscapeHatch.vue', 3],
  ['es-pc/src/views/es-vxe/ExpandRow.vue', 1],
  ['es-pc/src/views/es-vxe/FooterSummary.vue', 5],
  ['es-pc/src/views/es-vxe/InlineEdit.vue', 2],
  ['es-pc/src/views/es-vxe/MergeCells.vue', 4],
  ['es-pc/src/views/es-vxe/ProxyConfig.vue', 2],
  ['es-pc/src/views/es-vxe/RowEdit.vue', 3],
  ['es-pc/src/views/es-vxe/Selection.vue', 2],
  ['es-pc/src/views/es-vxe/SortFormatter.vue', 1],
  ['es-pc/src/views/es-vxe/ToolbarExport.vue', 1],
  ['es-pc/src/views/es-vxe/TreeData.vue', 2],
  ['es-pc/src/views/es-vxe/VirtualScroll.vue', 1],
  ['es-pc/src/views/EsErrorBoundary.vue', 1],
  ['es-pc/src/views/svg-icon/Basic.vue', 10],
  ['es-pc/src/views/SvgIcon.vue', 1],
  ['es-plus-docs/src/components/examples/advanced/CrudPage.vue', 2],
  ['es-plus-docs/src/components/examples/advanced/VirtualTable.vue', 1],
  ['es-plus-docs/src/components/examples/advanced/VirtualTableCrud.vue', 1],
  ['es-plus-docs/src/components/examples/advanced/VirtualTableCustomRender.vue', 2],
  ['es-plus-docs/src/components/examples/advanced/VirtualTableRowStyle.vue', 3],
  ['es-plus-docs/src/components/examples/advanced/VirtualTableSelect.vue', 3],
  ['es-plus-docs/src/components/examples/advanced/VirtualTableSort.vue', 2],
  ['es-plus-docs/src/components/examples/crud-page/Permission.vue', 3],
  ['es-plus-docs/src/components/examples/crud-page/ProgramOpen.vue', 1],
  ['es-plus-docs/src/components/examples/dialog/TableDialog.vue', 1],
  ['es-plus-docs/src/components/examples/svg-icon/Basic.vue', 10],
  ['es-plus-docs/src/components/examples/vxe-table/CellEdit.vue', 3],
  ['es-plus-docs/src/components/examples/vxe-table/ColumnResize.vue', 1],
  ['es-plus-docs/src/components/examples/vxe-table/CrudWithDialog.vue', 1],
  ['es-plus-docs/src/components/examples/vxe-table/CustomRender.vue', 1],
  ['es-plus-docs/src/components/examples/vxe-table/EscapeHatch.vue', 3],
  ['es-plus-docs/src/components/examples/vxe-table/FooterSummary.vue', 5],
  ['es-plus-docs/src/components/examples/vxe-table/MergeCells.vue', 4],
  ['es-plus-docs/src/components/examples/vxe-table/ProxyConfig.vue', 2],
  ['es-plus-docs/src/components/examples/vxe-table/RowEdit.vue', 2],
  ['es-plus-docs/src/components/examples/vxe-table/SelectionIndex.vue', 3],
  ['es-plus-docs/src/components/examples/vxe-table/SortFormatter.vue', 1],
  ['es-plus-docs/src/components/examples/vxe-table/ToolbarExport.vue', 1],
  ['es-plus-docs/src/components/examples/vxe-table/TreeData.vue', 2],
])

/** 静态 `style="…"`；前面的 `(?<!:)` 放过 `:style="…"` 这类绑定。 */
const PATTERN = /(?<!:)\bstyle="[^"]*"/g

function walk(dir, out = []) {
  if (!existsSync(dir)) return out
  for (const entry of readdirSync(dir, { withFileTypes: true })) {
    const abs = join(dir, entry.name)
    if (entry.isDirectory()) {
      if (entry.name === 'node_modules') continue
      walk(abs, out)
    } else if (/\.(vue|jsx)$/.test(entry.name)) {
      out.push(abs)
    }
  }
  return out
}

function scan() {
  const counts = new Map()
  let files = 0
  for (const rel of SCAN_ROOTS) {
    for (const abs of walk(join(ROOT, rel))) {
      files++
      const src = readFileSync(abs, 'utf8')
      const template = src.split(/<script/)[0]
      const n = (template.match(PATTERN) || []).length
      if (n) counts.set(relative(ROOT, abs).replace(/\\/g, '/'), n)
    }
  }
  return { counts, files }
}

function main() {
  const { counts, files } = scan()
  const printOnly = process.argv.includes('--print-baseline')

  const total = [...counts.values()].reduce((a, b) => a + b, 0)

  if (printOnly) {
    for (const [file, n] of [...counts].sort((a, b) => a[0].localeCompare(b[0]))) {
      console.log(`  ['${file}', ${n}],`)
    }
    console.log(`# 合计 ${total} 处 / ${counts.size} 个文件（扫描 ${files} 个文件）`)
    return
  }

  const regressions = []
  for (const [file, n] of counts) {
    const allowed = BASELINE.get(file) ?? 0
    if (n > allowed) regressions.push({ file, n, allowed })
  }

  if (regressions.length) {
    console.error(`❌ 示例的内联 style 增长（${regressions.length} 个文件）：`)
    for (const r of regressions) {
      console.error(
        `   ${r.file}  ${r.n} 处（基线 ${r.allowed === 0 ? '无记录 → 0' : r.allowed}）`,
      )
    }
    console.error(
      '\n改法：把样式写进示例组件自己的 `<style scoped>` 并给元素加 class。\n' +
        '如果确实该保留内联（例如值来自循环变量），把理由写进脚本顶部注释再抬基线。',
    )
    process.exit(1)
  }

  const shrinkable = [...BASELINE].filter(([file, allowed]) => (counts.get(file) ?? 0) < allowed)
  console.log(
    `✅ 示例内联 style 没有增长（当前 ${total} 处 / ${counts.size} 个文件，` +
      `基线 ${[...BASELINE.values()].reduce((a, b) => a + b, 0)} 处 / ${BASELINE.size} 个文件，` +
      `扫描 ${files} 个文件）`,
  )
  if (shrinkable.length) {
    console.log(
      `   其中有 ${shrinkable.length} 个文件已低于基线（${shrinkable
        .map(([f]) => f)
        .slice(0, 3)
        .join('、')}${shrinkable.length > 3 ? ' 等' : ''}）—— 顺手把基线改小，棘轮才继续收紧。`,
    )
  }
}

if (process.argv[1] && fileURLToPath(import.meta.url) === join(process.argv[1])) main()
