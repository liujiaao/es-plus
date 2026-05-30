/**
 * 目标框架定义 + Vue 2 / Vue 3 代码生成差异工具
 *
 * 设计目标：
 *  - schema JSON 在 Vue 2 / Vue 3 间保持 100% 一致（框架无关）
 *  - 仅 wrapper SFC / 完整 SFC 在两个 target 之间需要语法差异化生成
 *
 * 关键差异概览：
 *  ┌─────────────────────────┬───────────────────────────────────────┬───────────────────────────────────┐
 *  │ 维度                    │ Vue 3 + Element Plus                  │ Vue 2 + Element UI                │
 *  ├─────────────────────────┼───────────────────────────────────────┼───────────────────────────────────┤
 *  │ <script setup>          │ 支持                                   │ 不支持 → defineComponent + setup() │
 *  │ v-model 多目标           │ v-model:data-source                   │ :data-source.sync                 │
 *  │ ElMessage / ElMessageBox│ from 'element-plus'                   │ from 'element-ui' (Message/MessageBox) │
 *  │ es-plus 包名             │ @es-plus/vue3                            │ @es-plus/vue2                     │
 *  │ JSX 渲染函数 h           │ 全局 h(...)                            │ createElement(comp, { props, on }) │
 *  │ 虚拟滚动 (virtual)       │ ElTableV2 支持                         │ 无对应能力 → 自动忽略 + warning    │
 *  │ TS 类型 import          │ from '@es-plus/vue3'                     │ from '@es-plus/vue2'              │
 *  └─────────────────────────┴───────────────────────────────────────┴───────────────────────────────────┘
 *
 * 适用范围：
 *  - 此模块仅供 schema-generator / structured-generator / code-generator 调用
 *  - 不在运行时被引用，纯构建产物输出工具
 */
export type TargetFramework = 'vue3' | 'vue2';
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
 * 根据 target 返回 element-plus / element-ui 的导入包名
 */
export declare function getElementPackageName(target: TargetFramework): string;
/**
 * Element Plus 的 `ElMessageBox` / `ElMessage` 在 Element UI 中分别叫 `MessageBox` / `Message`。
 * 该函数把 Vue 3 风格的 named import 列表转换为对应 target 的 import 语句。
 *
 * 示例：
 *   buildElementImport(['ElMessageBox', 'ElMessage'], 'vue3')
 *     → "import { ElMessageBox, ElMessage } from 'element-plus'"
 *   buildElementImport(['ElMessageBox', 'ElMessage'], 'vue2')
 *     → "import { MessageBox, Message } from 'element-ui'"
 */
export declare function buildElementImport(vue3Names: string[], target: TargetFramework): string;
/**
 * Element Plus 命名 → Element UI 命名映射
 * 注意：仅覆盖代码生成器实际用到的符号，不做穷举。
 */
export declare function mapElementNameToV2(vue3Name: string): string;
/**
 * 在生成的代码体内替换 ElMessageBox / ElMessage 等使用引用为 Vue 2 命名
 * （针对 import 之后的具体调用语句）
 */
export declare function rewriteElementUsage(code: string, target: TargetFramework): string;
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