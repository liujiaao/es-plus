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
 *  │ es-plus 包名             │ es-plus-ui                            │ @es-plus/vue2                     │
 *  │ JSX 渲染函数 h           │ 全局 h(...)                            │ createElement(comp, { props, on }) │
 *  │ 虚拟滚动 (virtual)       │ ElTableV2 支持                         │ 无对应能力 → 自动忽略 + warning    │
 *  │ TS 类型 import          │ from 'es-plus-ui'                     │ from '@es-plus/vue2'              │
 *  └─────────────────────────┴───────────────────────────────────────┴───────────────────────────────────┘
 *
 * 适用范围：
 *  - 此模块仅供 schema-generator / structured-generator / code-generator 调用
 *  - 不在运行时被引用，纯构建产物输出工具
 */
export const DEFAULT_TARGET = 'vue3';
/**
 * 根据 target 返回 es-plus 类型/函数的导入包名
 */
export function getEsPlusPackageName(target) {
    return target === 'vue2' ? '@es-plus/vue2' : 'es-plus-ui';
}
/**
 * 根据 target 返回 element-plus / element-ui 的导入包名
 */
export function getElementPackageName(target) {
    return target === 'vue2' ? 'element-ui' : 'element-plus';
}
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
export function buildElementImport(vue3Names, target) {
    if (vue3Names.length === 0)
        return '';
    const pkg = getElementPackageName(target);
    if (target === 'vue3') {
        return `import { ${vue3Names.join(', ')} } from '${pkg}'`;
    }
    // Vue 2 / Element UI 命名映射
    const v2Names = vue3Names.map((n) => mapElementNameToV2(n));
    return `import { ${v2Names.join(', ')} } from '${pkg}'`;
}
/**
 * Element Plus 命名 → Element UI 命名映射
 * 注意：仅覆盖代码生成器实际用到的符号，不做穷举。
 */
export function mapElementNameToV2(vue3Name) {
    const map = {
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
    };
    return map[vue3Name] || vue3Name;
}
/**
 * 在生成的代码体内替换 ElMessageBox / ElMessage 等使用引用为 Vue 2 命名
 * （针对 import 之后的具体调用语句）
 */
export function rewriteElementUsage(code, target) {
    if (target === 'vue3')
        return code;
    return code
        // 仅替换"作为标识符使用"的位置（前后不是字母数字下划线）
        .replace(/\bElMessageBox\b/g, 'MessageBox')
        .replace(/\bElMessage\b/g, 'Message')
        .replace(/\bElNotification\b/g, 'Notification');
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
export function rewriteVModelSync(template, target) {
    if (target === 'vue3')
        return template;
    return template.replace(/v-model:([\w-]+)="([^"]+)"/g, ':$1.sync="$2"');
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
export function transformScriptSetupToOptions(setupBody, options = {}) {
    const ts = options.typescript ? ' lang="ts"' : '';
    const imports = options.importLine ? options.importLine + '\n' : '';
    // 提取顶层声明的标识符（变量名、函数名）作为 return 的字段
    const declRegex = /^(?:\s*)(?:const|let|var|function\s+(?:async\s+)?|async\s+function\s+)\s*([\w$]+)/gm;
    const exposed = new Set();
    let m;
    while ((m = declRegex.exec(setupBody)) !== null) {
        exposed.add(m[1]);
    }
    const returnFields = Array.from(exposed).join(', ');
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
    ].join('\n');
}
//# sourceMappingURL=target.js.map