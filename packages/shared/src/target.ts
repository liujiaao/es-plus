/**
 * 目标框架定义 + Vue 2 / Vue 3 / Ant Design Vue 代码生成差异工具
 *
 * 设计目标：
 *  - schema JSON 在三个 target 间保持 100% 一致（框架无关）
 *  - 仅 wrapper SFC / 完整 SFC 在 target 之间需要语法 / UI 库差异化生成
 *
 * 关键差异概览：
 *  ┌────────────────────────┬───────────────────────────┬──────────────────────────────┬──────────────────────────────┐
 *  │ 维度                   │ vue3 (Element Plus)        │ vue2 (Element UI)            │ antdv (Ant Design Vue)       │
 *  ├────────────────────────┼───────────────────────────┼──────────────────────────────┼──────────────────────────────┤
 *  │ Vue 版本 / 语法        │ Vue 3 <script setup>       │ Vue 2.7 defineComponent+setup │ Vue 3 <script setup>         │
 *  │ v-model 多目标         │ v-model:data-source        │ :data-source.sync            │ v-model:data-source          │
 *  │ 消息提示               │ ElMessage (element-plus)   │ Message (element-ui)         │ message (ant-design-vue)     │
 *  │ 确认弹窗               │ ElMessageBox.confirm(..)   │ MessageBox.confirm(..)       │ Modal.confirm({..}) 对象式    │
 *  │ 状态标签               │ <el-tag :type>             │ <el-tag :type>               │ <a-tag :color> (green/red)   │
 *  │ es-plus 包名           │ @es-plus/vue3              │ @es-plus/vue2                │ @es-plus/adapter-antdv       │
 *  │ 虚拟滚动 (virtual)     │ 支持                        │ 无对应能力 → 忽略 + warning  │ 支持                          │
 *  └────────────────────────┴───────────────────────────┴──────────────────────────────┴──────────────────────────────┘
 *
 * 说明：antdv 与 vue3 共享 Vue 3 语法（script setup / v-model:xxx），仅 UI 库符号（消息/确认/标签）
 * 与 es-plus 包名不同。因此代码生成中 antdv 走 "非 vue2" 分支的模板/脚本结构，UI 库差异集中在本模块。
 *
 * 适用范围：
 *  - 此模块仅供 schema-generator / structured-generator / code-generator 调用
 *  - 不在运行时被引用，纯构建产物输出工具
 */

export type TargetFramework = 'vue3' | 'vue2' | 'antdv'

export const DEFAULT_TARGET: TargetFramework = 'vue3'

export interface CodegenContext {
  target: TargetFramework
  /** 是否使用 TypeScript */
  typescript?: boolean
}

/**
 * 根据 target 返回 es-plus 类型/函数的导入包名
 */
export function getEsPlusPackageName(target: TargetFramework): string {
  if (target === 'vue2') return '@es-plus/vue2'
  if (target === 'antdv') return '@es-plus/adapter-antdv'
  return '@es-plus/vue3'
}

/**
 * 根据 target 返回 UI 组件库的导入包名
 *  - vue3  → element-plus
 *  - vue2  → element-ui
 *  - antdv → ant-design-vue
 */
export function getElementPackageName(target: TargetFramework): string {
  if (target === 'vue2') return 'element-ui'
  if (target === 'antdv') return 'ant-design-vue'
  return 'element-plus'
}

/**
 * Element Plus 的 `ElMessageBox` / `ElMessage` 在其他 UI 库中命名不同。
 * 该函数把 Vue 3 风格的 named import 列表转换为对应 target 的 import 语句。
 *
 * 示例：
 *   buildElementImport(['ElMessageBox', 'ElMessage'], 'vue3')
 *     → "import { ElMessageBox, ElMessage } from 'element-plus'"
 *   buildElementImport(['ElMessageBox', 'ElMessage'], 'vue2')
 *     → "import { MessageBox, Message } from 'element-ui'"
 *   buildElementImport(['ElMessageBox', 'ElMessage'], 'antdv')
 *     → "import { Modal, message } from 'ant-design-vue'"
 */
export function buildElementImport(
  vue3Names: string[],
  target: TargetFramework
): string {
  if (vue3Names.length === 0) return ''
  const pkg = getElementPackageName(target)
  if (target === 'vue3') {
    return `import { ${vue3Names.join(', ')} } from '${pkg}'`
  }
  const mapName = target === 'antdv' ? mapElementNameToAntdv : mapElementNameToV2
  // 命名映射后去重（如 antdv 下 ElMessage/ElMessageBox 可能映射到不同符号，但需保持顺序去重）
  const mapped = [...new Set(vue3Names.map(mapName))]
  return `import { ${mapped.join(', ')} } from '${pkg}'`
}

/**
 * Element Plus 命名 → Element UI 命名映射
 * 注意：仅覆盖代码生成器实际用到的符号，不做穷举。
 */
export function mapElementNameToV2(vue3Name: string): string {
  const map: Record<string, string> = {
    ElMessage: 'Message',
    ElMessageBox: 'MessageBox',
    ElNotification: 'Notification',
    ElLoading: 'Loading',
    // 组件类（在模板中以 kebab-case 出现，无需转换）
    ElTag: 'Tag',
    ElButton: 'Button',
    ElInput: 'Input',
    ElSelect: 'Select',
    ElIcon: 'Icon',
  }
  return map[vue3Name] || vue3Name
}

/**
 * Element Plus 命名 → Ant Design Vue 命名映射
 *  - ElMessage    → message（函数式，message.success('x') 调用形态一致）
 *  - ElMessageBox → Modal（Modal.confirm({ ... }) 对象式，见 buildDeleteConfirmBlock）
 *  - ElNotification → notification
 *  - ElTag        → Tag（模板中为 <a-tag>，color 属性；见 buildStatusTagTemplate）
 */
export function mapElementNameToAntdv(vue3Name: string): string {
  const map: Record<string, string> = {
    ElMessage: 'message',
    ElMessageBox: 'Modal',
    ElNotification: 'notification',
    ElLoading: 'Spin',
    ElTag: 'Tag',
    ElButton: 'Button',
    ElInput: 'Input',
    ElSelect: 'Select',
    ElIcon: 'Icon',
  }
  return map[vue3Name] || vue3Name
}

/**
 * 在生成的代码体内替换 ElMessage / ElTag 等使用引用为目标 UI 库命名
 * （针对 import 之后的具体标识符调用；ElMessageBox 的结构差异由 buildDeleteConfirmBlock 处理）
 */
export function rewriteElementUsage(code: string, target: TargetFramework): string {
  if (target === 'vue3') return code
  if (target === 'antdv') {
    return code
      .replace(/\bElMessageBox\b/g, 'Modal')
      .replace(/\bElMessage\b/g, 'message')
      .replace(/\bElNotification\b/g, 'notification')
      .replace(/\bElTag\b/g, 'Tag')
  }
  // vue2
  return code
    // 仅替换"作为标识符使用"的位置（前后不是字母数字下划线）
    .replace(/\bElMessageBox\b/g, 'MessageBox')
    .replace(/\bElMessage\b/g, 'Message')
    .replace(/\bElNotification\b/g, 'Notification')
    .replace(/\bElTag\b/g, 'Tag')
}

/**
 * 生成"删除确认"处理块（多行），按 target 适配确认弹窗 API 的结构差异。
 *
 *  - vue3 / vue2：Element 的 Promise 形态
 *      ElMessageBox.confirm(content, title, { type: 'warning' })
 *        .then(async () => { try { ...body } catch { ElMessage.error('删除失败') } })
 *        .catch(() => {})   // 仅吞用户取消，请求失败由内层 try/catch 上报
 *  - antdv：Ant Design Vue 的对象形态（Modal.confirm 不返回 confirm-thenable）
 *      Modal.confirm({ title, content, async onOk() { try { ...body } catch { ... } } })
 *
 * bodyLines 为确认后执行的语句（不含额外缩进，helper 负责缩进）；其中的 ElMessage 引用
 * 由调用方在最终阶段通过 rewriteElementUsage 统一改写为目标命名。内层 try/catch 确保
 * 删除请求失败会弹错误提示，而不是被外层用于吞取消的 .catch 静默丢弃。
 */
export function buildDeleteConfirmBlock(opts: {
  target: TargetFramework
  indent?: string
  content?: string
  title?: string
  bodyLines: string[]
}): string[] {
  const indent = opts.indent ?? ''
  const content = opts.content ?? '确定删除该条数据吗？'
  const title = opts.title ?? '提示'
  const body = opts.bodyLines
  if (opts.target === 'antdv') {
    return [
      `${indent}Modal.confirm({`,
      `${indent}  title: '${title}',`,
      `${indent}  content: '${content}',`,
      `${indent}  async onOk() {`,
      `${indent}    try {`,
      ...body.map(l => (l ? `${indent}      ${l}` : l)),
      `${indent}    } catch (err) {`,
      `${indent}      ElMessage.error('删除失败')`,
      `${indent}    }`,
      `${indent}  },`,
      `${indent}})`,
    ]
  }
  // vue3 / vue2（vue2 的 ElMessageBox→MessageBox 由 rewriteElementUsage 处理）
  return [
    `${indent}ElMessageBox.confirm('${content}', '${title}', { type: 'warning' })`,
    `${indent}  .then(async () => {`,
    `${indent}    try {`,
    ...body.map(l => (l ? `${indent}      ${l}` : l)),
    `${indent}    } catch (err) {`,
    `${indent}      ElMessage.error('删除失败')`,
    `${indent}    }`,
    `${indent}  })`,
    `${indent}  .catch(() => {})`,
  ]
}

/**
 * 生成状态列自定义渲染的模板片段（scoped slot 内），按 target 适配标签组件。
 *  - vue3 / vue2：<el-tag :type="... 'success' : 'danger'">
 *  - antdv：<a-tag :color="... 'green' : 'red'">
 */
export function buildStatusTagTemplate(opts: {
  target: TargetFramework
  prop: string
  indent?: string
  activeText?: string
  inactiveText?: string
}): string[] {
  const indent = opts.indent ?? ''
  const prop = opts.prop
  const activeText = opts.activeText ?? '启用'
  const inactiveText = opts.inactiveText ?? '禁用'
  const text = `{{ row.${prop} === 1 ? '${activeText}' : '${inactiveText}' }}`
  if (opts.target === 'antdv') {
    return [
      `${indent}<a-tag :color="row.${prop} === 1 ? 'green' : 'red'">`,
      `${indent}  ${text}`,
      `${indent}</a-tag>`,
    ]
  }
  return [
    `${indent}<el-tag :type="row.${prop} === 1 ? 'success' : 'danger'">`,
    `${indent}  ${text}`,
    `${indent}</el-tag>`,
  ]
}

/**
 * 把 Vue 3 模板中的 v-model:xxx 修饰符转换为 Vue 2 的 :xxx.sync
 * Vue 2.3+ 支持 .sync 修饰符，效果等价。
 *
 * 例：
 *   v-model:data-source="tableData"  →  :data-source.sync="tableData"
 *   v-model:pagination="pagination"  →  :pagination.sync="pagination"
 *
 * 注意：纯 v-model="xxx"（无冒号目标）在 Vue 2 中也合法，无需转换。
 */
export function rewriteVModelSync(template: string, target: TargetFramework): string {
  // 仅 vue2 需要 .sync；vue3 / antdv 均为 Vue 3 语法，保持 v-model:xxx
  if (target !== 'vue2') return template
  return template.replace(
    /v-model:([\w-]+)="([^"]+)"/g,
    ':$1.sync="$2"'
  )
}

/**
 * 把 `<script setup [lang="ts"]>...</script>` 段转换为 Vue 2 兼容的
 * `<script [lang="ts"]>defineComponent({ setup() { ...; return { ... } } })</script>` 形式。
 *
 * 实现策略：
 *   1. 解析 setup 体内的所有顶层声明（const/let/function）
 *   2. 把它们收集到 return { ... } 对象中（让模板能够访问）
 *   3. 包裹 defineComponent({ setup() { /* body *\/ return { exposed } } })
 *
 * 由于该函数无法实现完整的 JS parser，为保证生成代码的可靠性，
 * 推荐从源头按 target 直接生成对应风格的代码（见 generators 中的 ctx.target 分支）。
 *
 * 此处提供一个简化的转换器，仅处理 generators 实际产出的固定结构。
 */
export function transformScriptSetupToOptions(
  setupBody: string,
  options: { typescript?: boolean; importLine?: string } = {}
): string {
  const ts = options.typescript ? ' lang="ts"' : ''
  const imports = options.importLine ? options.importLine + '\n' : ''
  // 提取顶层声明的标识符（变量名、函数名）作为 return 的字段
  const declRegex =
    /^(?:\s*)(?:const|let|var|function\s+(?:async\s+)?|async\s+function\s+)\s*([\w$]+)/gm
  const exposed = new Set<string>()
  let m: RegExpExecArray | null
  while ((m = declRegex.exec(setupBody)) !== null) {
    exposed.add(m[1])
  }
  const returnFields = Array.from(exposed).join(', ')

  return [
    `<script${ts}>`,
    imports + `import { defineComponent } from 'vue'`,
    ``,
    `export default defineComponent({`,
    `  setup() {`,
    setupBody.split('\n').map((l) => (l ? '    ' + l : l)).join('\n'),
    `    return { ${returnFields} }`,
    `  }`,
    `})`,
    `</script>`,
  ].join('\n')
}
