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
export type TargetFramework = 'vue3' | 'vue2' | 'antdv';
export declare const DEFAULT_TARGET: TargetFramework;
export interface CodegenContext {
    target: TargetFramework;
    /** 是否使用 TypeScript */
    typescript?: boolean;
}
/**
 * 根据 target 返回 es-plus 类型/函数的导入包名
 */
export declare function getEsPlusPackageName(target: TargetFramework): string;
/**
 * 根据 target 返回 UI 组件库的导入包名
 *  - vue3  → element-plus
 *  - vue2  → element-ui
 *  - antdv → ant-design-vue
 */
export declare function getElementPackageName(target: TargetFramework): string;
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
export declare function buildElementImport(vue3Names: string[], target: TargetFramework): string;
/**
 * Element Plus 命名 → Element UI 命名映射
 * 注意：仅覆盖代码生成器实际用到的符号，不做穷举。
 */
export declare function mapElementNameToV2(vue3Name: string): string;
/**
 * Element Plus 命名 → Ant Design Vue 命名映射
 *  - ElMessage    → message（函数式，message.success('x') 调用形态一致）
 *  - ElMessageBox → Modal（Modal.confirm({ ... }) 对象式，见 buildDeleteConfirmBlock）
 *  - ElNotification → notification
 *  - ElTag        → Tag（模板中为 <a-tag>，color 属性；见 buildStatusTagTemplate）
 */
export declare function mapElementNameToAntdv(vue3Name: string): string;
/**
 * 在生成的代码体内替换 ElMessage / ElTag 等使用引用为目标 UI 库命名
 * （针对 import 之后的具体标识符调用；ElMessageBox 的结构差异由 buildDeleteConfirmBlock 处理）
 */
export declare function rewriteElementUsage(code: string, target: TargetFramework): string;
/**
 * 生成"删除确认"处理块（多行），按 target 适配确认弹窗 API 的结构差异。
 *
 *  - vue3 / vue2：Element 的 Promise 形态
 *      ElMessageBox.confirm(content, title, { type: 'warning' })
 *        .then(async () => { ...body })
 *        .catch(() => {})
 *  - antdv：Ant Design Vue 的对象形态（Modal.confirm 不返回 confirm-thenable）
 *      Modal.confirm({ title, content, async onOk() { ...body } })
 *
 * bodyLines 为确认后执行的语句（不含额外缩进，helper 负责缩进）；其中的 ElMessage 引用
 * 由调用方在最终阶段通过 rewriteElementUsage 统一改写为目标命名。
 */
export declare function buildDeleteConfirmBlock(opts: {
    target: TargetFramework;
    indent?: string;
    content?: string;
    title?: string;
    bodyLines: string[];
}): string[];
/**
 * 生成状态列自定义渲染的模板片段（scoped slot 内），按 target 适配标签组件。
 *  - vue3 / vue2：<el-tag :type="... 'success' : 'danger'">
 *  - antdv：<a-tag :color="... 'green' : 'red'">
 */
export declare function buildStatusTagTemplate(opts: {
    target: TargetFramework;
    prop: string;
    indent?: string;
    activeText?: string;
    inactiveText?: string;
}): string[];
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
export declare function rewriteVModelSync(template: string, target: TargetFramework): string;
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
export declare function transformScriptSetupToOptions(setupBody: string, options?: {
    typescript?: boolean;
    importLine?: string;
}): string;
//# sourceMappingURL=target.d.ts.map