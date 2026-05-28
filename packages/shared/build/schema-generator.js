import { generateCrudConfig } from "./crud-engine.js";
import { CRUD_PAGE_BTN_CLICK_KEYS } from "./contract.js";
import { DEFAULT_TARGET, getEsPlusPackageName, buildElementImport, rewriteElementUsage, } from "./target.js";
/**
 * 从自然语言描述生成 CrudPageSchema + 包装 SFC
 *
 * @param description 中/英文页面描述
 * @param target      目标框架，'vue3' (Element Plus, 默认) | 'vue2' (Element UI)
 *
 * 注意：返回的 `schema` JSON 在两个 target 间完全一致 —— 这是 schema 模式的核心价值。
 * 仅 `wrapperCode` 会根据 target 输出不同语法（v-model:* vs :*.sync, script setup vs defineComponent...）。
 */
export function generateCrudSchema(description, target = DEFAULT_TARGET) {
    const config = generateCrudConfig(description);
    const schema = buildCrudPageSchema(config);
    const wrapperCode = buildWrapperSFC(config, target);
    const summary = buildSummary(config, target);
    return { schema, wrapperCode, summary, target };
}
function buildCrudPageSchema(config) {
    const schema = {};
    if (config.formItems.length > 0) {
        schema.formItems = config.formItems;
    }
    const columns = config.columns
        .filter(col => col.prop !== 'operate')
        .map(col => {
        const { render, ...rest } = col;
        return rest;
    });
    schema.columns = columns;
    schema.tableOptions = {
        border: true,
        stripe: true,
        highlightCurrentRow: true,
        headerCellStyle: { background: '#f5f7fa' },
        apiParams: { url: '/api/xxx' },
        rowkey: 'id',
    };
    if (config.dialogFormItems && config.dialogFormItems.length > 0) {
        schema.dialogFormItems = config.dialogFormItems;
    }
    schema.actions = config.actions;
    schema.pagination = { pageSize: 10 };
    return schema;
}
/**
 * 包装 SFC 生成（同时支持 vue3 和 vue2 target）
 *
 * Vue 3 风格：<script setup> + ElMessageBox + 'es-plus-ui'
 * Vue 2 风格：<script>defineComponent({ setup() {} })</script> + MessageBox + '@es-plus/vue2'
 */
function buildWrapperSFC(config, target) {
    const hasDelete = config.actions.includes('delete');
    const hasStatusRender = config.hasStatusRender;
    const isVue2 = target === 'vue2';
    const esPlusPkg = getEsPlusPackageName(target);
    const lines = [];
    lines.push(`<template>`);
    lines.push(`  <es-crud-page`);
    lines.push(`    ref="crudRef"`);
    lines.push(`    :schema="pageSchema"`);
    lines.push(`    :http-request="fetchData"`);
    if (hasDelete)
        lines.push(`    @delete="handleDelete"`);
    lines.push(`    @btn-click="handleBtnClick"`);
    lines.push(`  />`);
    lines.push(`</template>`);
    lines.push(``);
    if (isVue2) {
        // Vue 2 / defineComponent + setup()
        lines.push(`<script>`);
        lines.push(`import { defineComponent, ref } from 'vue'`);
        const epImports = [];
        if (hasDelete)
            epImports.push('ElMessageBox', 'ElMessage');
        if (hasStatusRender)
            epImports.push('ElTag');
        if (epImports.length > 0) {
            lines.push(buildElementImport(epImports, target));
        }
        lines.push(`import { pageSchema } from './schema'`);
        lines.push(``);
        lines.push(`export default defineComponent({`);
        lines.push(`  name: 'CrudPageWrapper',`);
        lines.push(`  setup() {`);
        lines.push(`    const crudRef = ref(null)`);
        lines.push(``);
        lines.push(`    async function fetchData(params) {`);
        lines.push(`      // TODO: 替换为实际接口调用`);
        lines.push(`      // const { data } = await axios.get('/api/list', { params: params.formParams })`);
        lines.push(`      // return data`);
        lines.push(`    }`);
        if (hasDelete) {
            lines.push(``);
            lines.push(`    function handleDelete(row) {`);
            lines.push(`      MessageBox.confirm('确定删除该条数据吗？', '提示', { type: 'warning' })`);
            lines.push(`        .then(async () => {`);
            lines.push(`          // TODO: 调用删除接口`);
            lines.push(`          Message.success('删除成功')`);
            lines.push(`          crudRef.value && crudRef.value.refresh && crudRef.value.refresh()`);
            lines.push(`        })`);
            lines.push(`        .catch(() => {})`);
            lines.push(`    }`);
        }
        lines.push(``);
        lines.push(`    function handleBtnClick(key, data) {`);
        lines.push(`      if (key === '${CRUD_PAGE_BTN_CLICK_KEYS.ADD_CONFIRM}') {`);
        lines.push(`        // TODO: 调用新增接口`);
        lines.push(`        crudRef.value && crudRef.value.refresh && crudRef.value.refresh()`);
        lines.push(`      }`);
        lines.push(`      if (key === '${CRUD_PAGE_BTN_CLICK_KEYS.EDIT_CONFIRM}') {`);
        lines.push(`        // TODO: 调用编辑接口`);
        lines.push(`        crudRef.value && crudRef.value.refresh && crudRef.value.refresh()`);
        lines.push(`      }`);
        lines.push(`    }`);
        lines.push(``);
        lines.push(`    return { crudRef, fetchData, ${hasDelete ? 'handleDelete, ' : ''}handleBtnClick }`);
        lines.push(`  }`);
        lines.push(`})`);
        lines.push(`</script>`);
        return rewriteElementUsage(lines.join('\n'), target);
    }
    // Vue 3 / <script setup>
    lines.push(`<script setup>`);
    lines.push(`import { ref } from 'vue'`);
    const epImports = [];
    if (hasDelete)
        epImports.push('ElMessageBox', 'ElMessage');
    if (hasStatusRender)
        epImports.push('ElTag');
    if (epImports.length > 0) {
        lines.push(buildElementImport(epImports, target));
    }
    lines.push(`import { pageSchema } from './schema'`);
    lines.push(``);
    lines.push(`const crudRef = ref(null)`);
    lines.push(``);
    lines.push(`async function fetchData(params) {`);
    lines.push(`  // TODO: 替换为实际接口调用`);
    lines.push(`  // const { data } = await axios.get('/api/list', { params: params.formParams })`);
    lines.push(`  // return data`);
    lines.push(`}`);
    if (hasDelete) {
        lines.push(``);
        lines.push(`function handleDelete(row) {`);
        lines.push(`  ElMessageBox.confirm('确定删除该条数据吗？', '提示', { type: 'warning' })`);
        lines.push(`    .then(async () => {`);
        lines.push(`      // TODO: 调用删除接口`);
        lines.push(`      ElMessage.success('删除成功')`);
        lines.push(`      crudRef.value?.refresh()`);
        lines.push(`    })`);
        lines.push(`    .catch(() => {})`);
        lines.push(`}`);
    }
    lines.push(``);
    lines.push(`function handleBtnClick(key, data) {`);
    lines.push(`  if (key === '${CRUD_PAGE_BTN_CLICK_KEYS.ADD_CONFIRM}') {`);
    lines.push(`    // TODO: 调用新增接口`);
    lines.push(`    crudRef.value?.refresh()`);
    lines.push(`  }`);
    lines.push(`  if (key === '${CRUD_PAGE_BTN_CLICK_KEYS.EDIT_CONFIRM}') {`);
    lines.push(`    // TODO: 调用编辑接口`);
    lines.push(`    crudRef.value?.refresh()`);
    lines.push(`  }`);
    lines.push(`}`);
    lines.push(`</script>`);
    return lines.join('\n');
}
function buildSummary(config, target) {
    return [
        `Generated CrudPageSchema (${target}) with:`,
        `- ${config.formItems.length} query form fields`,
        `- ${config.columns.filter(c => c.prop !== 'operate').length} table columns`,
        `- Actions: ${config.actions.join(', ')}`,
        config.dialogFormItems?.length
            ? `- ${config.dialogFormItems.length} dialog form fields (with validation rules)`
            : '',
        `- Output: CrudPageSchema JSON + EsCrudPage wrapper SFC`,
        target === 'vue2'
            ? `- Target: Vue 2 + Element UI (use @es-plus/vue2)`
            : `- Target: Vue 3 + Element Plus (use es-plus-ui)`,
        ``,
        `Note: 需要在 main.${target === 'vue2' ? 'js' : 'ts'} 中配置 ${target === 'vue2' ? 'Vue.use(EsPlus)' : 'app.use(ESPlus)'} 全局插件`,
    ].filter(Boolean).join('\n');
}
//# sourceMappingURL=schema-generator.js.map