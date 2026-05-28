import { generateCrudConfig, generateCode } from "./crud-engine.js";
import { DEFAULT_TARGET, getEsPlusPackageName, rewriteVModelSync, rewriteElementUsage, } from "./target.js";
/**
 * 从自然语言描述生成完整 SFC（直接基于 EsTable + EsForm，不使用 EsCrudPage）
 *
 * Vue 3 vs Vue 2 差异：
 *  - 模板中的 v-model:* 修饰符（仅在 generateCode 输出的代码包含时）
 *  - import 包名：es-plus-ui ↔ @es-plus/vue2
 *  - script setup 与 defineComponent 之间的差异（见 generateScaffold 处理；
 *    crud-engine.generateCode 当前固定输出 vue3 风格，vue2 模式下会做后置改写）
 */
export function generateCrudPage(description, target = DEFAULT_TARGET) {
    const config = generateCrudConfig(description);
    let code = generateCode(config);
    if (target === 'vue2') {
        code = adaptCodeToVue2(code);
    }
    const summary = [
        `Generated CRUD page (${target}) with:`,
        `- ${config.formItems.length} query form fields`,
        `- ${config.columns.length} table columns`,
        `- Actions: ${config.actions.join(", ")}`,
        config.dialogFormItems?.length
            ? `- ${config.dialogFormItems.length} dialog form fields (with validation rules)`
            : "",
        config.hasStatusRender ? `- Status column with ${target === 'vue2' ? 'el-tag' : 'ElTag'} render` : "",
        config.actions.includes("delete") ? `- Delete confirmation dialog` : "",
        target === 'vue2'
            ? `- Target: Vue 2 + Element UI (@es-plus/vue2)`
            : `- Target: Vue 3 + Element Plus (es-plus-ui)`,
        ``,
        target === 'vue2'
            ? `Note: 需要在 main.js 中执行 Vue.use(ElementUI) + Vue.use(EsPlus)，并通过 esPlus 配置全局 httpRequest`
            : `Note: 需要在 main.ts 中配置全局 app.use(ESPlus, { EsTable: { methods: { $httpRequest, configQueryFieldOutput } } })`,
        `详见: https://es-plus.liujiaao.top/docs/usage`,
    ]
        .filter(Boolean)
        .join("\n");
    return { code, config, summary, target };
}
/**
 * 把 Vue 3 风格生成的 SFC 代码改写为 Vue 2 风格
 *
 * 改写规则：
 *  1. v-model:xxx="..."             →  :xxx.sync="..."
 *  2. ElMessageBox / ElMessage       →  MessageBox / Message
 *  3. from 'element-plus'            →  from 'element-ui'
 *  4. from 'es-plus-ui'              →  from '@es-plus/vue2'
 *  5. <script setup>                 →  <script>defineComponent({ setup() {...} })
 *
 * 注意：第 5 项是非平凡转换，本函数采用模板字符串替换实现的"轻量改写"——
 * 仅适用于 generateCode 输出的固定结构，不是通用的 Vue 3 → Vue 2 转换器。
 */
function adaptCodeToVue2(code) {
    let out = code;
    // 1. v-model:xxx → :xxx.sync
    out = rewriteVModelSync(out, 'vue2');
    // 2. Element Plus → Element UI 命名
    out = rewriteElementUsage(out, 'vue2');
    // 3. element-plus → element-ui
    out = out.replace(/from\s+['"]element-plus['"]/g, "from 'element-ui'");
    // 4. es-plus-ui → @es-plus/vue2
    out = out.replace(/from\s+['"]es-plus-ui['"]/g, "from '@es-plus/vue2'");
    // 5. <script setup> → defineComponent + setup()
    // 仅当源码确实包含 <script setup> 时执行
    out = transformScriptSetupBlock(out);
    return out;
}
/**
 * 把单一 <script setup [lang="ts"]>...</script> 块改写为
 * <script [lang="ts"]>import { defineComponent } from 'vue'; export default defineComponent({ setup() { ... return { exposed... } } })</script>
 *
 * 提取 return 字段策略：
 *  - 顶层 const/let/var 变量名
 *  - 顶层 function / async function 名
 *  - 不导出 import 进来的符号、不导出已经在原始声明里被命名为 _xxx 私有的标识符
 */
function transformScriptSetupBlock(source) {
    const re = /<script setup(\s+lang="ts")?>([\s\S]*?)<\/script>/m;
    const match = source.match(re);
    if (!match)
        return source;
    const lang = match[1] || '';
    const body = match[2];
    // 收集顶层声明标识符
    const declRegex = /^[ \t]*(?:const|let|var)\s+([\w$]+)\s*=|^[ \t]*(?:async\s+)?function\s+([\w$]+)/gm;
    const exposed = new Set();
    let m;
    while ((m = declRegex.exec(body)) !== null) {
        const name = m[1] || m[2];
        if (name && !name.startsWith('_'))
            exposed.add(name);
    }
    // 缩进 setup 体（每行前面加 4 空格，空行保持）
    const indented = body
        .split('\n')
        .map((l) => (l.length === 0 ? l : '    ' + l))
        .join('\n');
    const returnFields = Array.from(exposed).join(', ');
    const replacement = [
        `<script${lang}>`,
        `import { defineComponent } from 'vue'`,
        ``,
        `export default defineComponent({`,
        `  setup() {`,
        indented,
        `    return { ${returnFields} }`,
        `  }`,
        `})`,
        `</script>`,
    ].join('\n');
    return source.replace(re, replacement);
}
/**
 * 生成最小化空白脚手架（query/table/dialog 任意组合）
 *
 * @param name      kebab-case 页面名称
 * @param features  启用功能数组，可选 'query' | 'table' | 'dialog'
 * @param target    目标框架，'vue3' (默认) | 'vue2'
 */
export function generateScaffold(name, features, target = DEFAULT_TARGET) {
    const componentName = name.charAt(0).toUpperCase() + name.slice(1).replace(/-(\w)/g, (_, c) => c.toUpperCase());
    const hasQuery = !features || features.includes("query");
    const hasTable = !features || features.includes("table");
    const hasDialog = features?.includes("dialog");
    const isVue2 = target === 'vue2';
    const esPlusPkg = getEsPlusPackageName(target);
    const lines = [];
    lines.push(`<template>`);
    lines.push(`  <div class="${name}-page">`);
    if (hasTable) {
        lines.push(`    <es-table`);
        lines.push(`      ref="tableRef"`);
        lines.push(`      :columns="columns"`);
        lines.push(`      :options="options"`);
        if (isVue2) {
            lines.push(`      :data-source.sync="tableData"`);
            lines.push(`      :pagination.sync="pagination"`);
        }
        else {
            lines.push(`      v-model:data-source="tableData"`);
            lines.push(`      v-model:pagination="pagination"`);
        }
        lines.push(`    >`);
        if (hasQuery) {
            lines.push(`      <es-form :model="queryForm" :form-item-list="formItems" :config-btn="queryBtns" />`);
        }
        lines.push(`    </es-table>`);
    }
    else if (hasQuery) {
        lines.push(`    <es-form :model="queryForm" :form-item-list="formItems" :config-btn="queryBtns" />`);
    }
    lines.push(`  </div>`);
    lines.push(`</template>`);
    lines.push(``);
    if (isVue2) {
        // ─── Vue 2 / defineComponent + setup() ───
        lines.push(`<script>`);
        const vueImports = ['defineComponent', 'reactive', 'ref'];
        lines.push(`import { ${vueImports.join(', ')} } from 'vue'`);
        if (hasDialog) {
            lines.push(`import { useDialog } from '${esPlusPkg}'`);
        }
        lines.push(``);
        lines.push(`export default defineComponent({`);
        lines.push(`  name: '${componentName}',`);
        lines.push(`  setup() {`);
        const exposeFields = [];
        if (hasQuery) {
            lines.push(`    const queryForm = reactive({})`);
            lines.push(`    const formItems = []`);
            lines.push(`    const queryBtns = [`);
            lines.push(`      { name: '查询', type: 'primary', key: 'query', triggerEvent: true },`);
            lines.push(`      { name: '重置', key: 'rest', triggerEvent: true },`);
            lines.push(`    ]`);
            lines.push(``);
            exposeFields.push('queryForm', 'formItems', 'queryBtns');
        }
        if (hasTable) {
            lines.push(`    const tableRef = ref(null)`);
            lines.push(`    const tableData = ref([])`);
            lines.push(`    const pagination = ref({ current: 1, pageSize: 10, total: 0 })`);
            lines.push(`    const columns = []`);
            lines.push(`    // httpRequest 和 configTableOut 由全局配置注入，无需在此声明`);
            lines.push(`    // 全局配置: Vue.use(EsPlus, { EsTable: { methods: { $httpRequest, configQueryFieldOutput } } })`);
            lines.push(`    const options = {`);
            lines.push(`      border: true,`);
            lines.push(`      stripe: true,`);
            lines.push(`      highlightCurrentRow: true,`);
            lines.push(`      headerCellStyle: { background: '#f5f7fa' },`);
            lines.push(`      apiParams: { url: '/api/xxx' },  // TODO: 替换为实际接口地址`);
            lines.push(`      rowkey: 'id'`);
            lines.push(`    }`);
            lines.push(``);
            exposeFields.push('tableRef', 'tableData', 'pagination', 'columns', 'options');
        }
        if (hasDialog) {
            lines.push(`    const dialog = useDialog()`);
            lines.push(``);
            exposeFields.push('dialog');
        }
        lines.push(`    return { ${exposeFields.join(', ')} }`);
        lines.push(`  }`);
        lines.push(`})`);
        lines.push(`</script>`);
        return lines.join("\n");
    }
    // ─── Vue 3 / <script setup> ───
    lines.push(`<script setup>`);
    lines.push(`import { reactive, ref } from 'vue'`);
    if (hasDialog) {
        lines.push(`import { useDialog } from '${esPlusPkg}'`);
    }
    lines.push(``);
    if (hasQuery) {
        lines.push(`const queryForm = reactive({})`);
        lines.push(`const formItems = []`);
        lines.push(`const queryBtns = [`);
        lines.push(`  { name: '查询', type: 'primary', key: 'query', triggerEvent: true },`);
        lines.push(`  { name: '重置', key: 'rest', triggerEvent: true },`);
        lines.push(`]`);
        lines.push(``);
    }
    if (hasTable) {
        lines.push(`const tableRef = ref(null)`);
        lines.push(`const tableData = ref([])`);
        lines.push(`const pagination = ref({ current: 1, pageSize: 10, total: 0 })`);
        lines.push(`const columns = []`);
        lines.push(`// httpRequest 和 configTableOut 由全局配置注入，无需在此声明`);
        lines.push(`// 全局配置: app.use(ESPlus, { EsTable: { methods: { $httpRequest, configQueryFieldOutput } } })`);
        lines.push(`const options = {`);
        lines.push(`  border: true,`);
        lines.push(`  stripe: true,`);
        lines.push(`  highlightCurrentRow: true,`);
        lines.push(`  headerCellStyle: { background: '#f5f7fa' },`);
        lines.push(`  apiParams: { url: '/api/xxx' },  // TODO: 替换为实际接口地址`);
        lines.push(`  rowkey: 'id'`);
        lines.push(`}`);
        lines.push(``);
    }
    if (hasDialog) {
        lines.push(`const dialog = useDialog()`);
        lines.push(``);
    }
    lines.push(`</script>`);
    return lines.join("\n");
}
//# sourceMappingURL=code-generator.js.map