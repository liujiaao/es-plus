/**
 * 脚手架与入口样板 —— `scaffold_page`（MCP）与 `esplus scaffold`（CLI）的确定性产物。
 *
 * ## 为什么从 `code-generator.ts` 拆出来（W6）
 *
 * 同文件里原本还有 `generateCrudPage`：把**自然语言**经 legacy 正则引擎
 * （`crud-engine.generateCrudConfig → generateCode`）直接拼成一整页 SFC。
 * 那条路径已被结构化生成器（surfaces → config → `generateFromConfig`）取代，
 * 于 2026-11-10 整体退役；而 `generateScaffold` / `generateAppEntry` 仍被
 * `scaffold_page` 与 CLI `scaffold` 使用，两者与 crud-engine **没有任何共享代码**，
 * 所以按用途拆开，让 legacy 引擎的最后一个消费者一起消失。
 *
 * 本文件只依赖 `codegen-escape`（HTML 属性转义）与 `target`（包名/框架）。
 */
import { q, qAttr } from "./codegen-escape.js";
import { type TargetFramework, DEFAULT_TARGET, getEsPlusPackageName } from "./target.js";

/**
 * 生成「应用入口全局装配」样板（AI-19）。
 *
 * `permissionValue`（RBAC）/ `labelKey`（i18n）/ 远端 `apiParams` 都是**跨文件依赖**：
 * 只有入口一次性 `app.use(ESPlus, { permission, t, httpRequest })`（vue2：`Vue.use`）
 * 后才生效，否则静默失效。生成器看得见 config、看不见入口，故由 `scaffold_page`
 * 把本样板随附在 SFC 之后（CLI 单文件写入不用它，故 `generateScaffold` 只加注释指向）。
 *
 * 选项形状为 **core 权威字段**（`packages/core/src/config.ts` 的 `EsPlusGlobalConfig`）：
 * 顶层 `permission` / `t` / `httpRequest`，组件档用扁平键（`EsTable.httpRequest`）——
 * 兼容键位 `EsTable.methods.$httpRequest` 在写入时被归一，无需生成兼容写法。
 */
export function generateAppEntry(target: TargetFramework = DEFAULT_TARGET): string {
  const pkg = getEsPlusPackageName(target);
  const optionBlock = [
    `  permission: (code) => userStore.permissions.includes(code), // 字段/列/按钮 permissionValue 的前提`,
    `  t: (key) => i18n.global.t(key),                             // i18n labelKey 的前提（否则回落 label）`,
    `  httpRequest: (params) => axios(params),                     // 远端 apiParams 取数的前提`,
  ];

  if (target === 'vue2') {
    return [
      `// src/main.js — 应用入口：全局装配 es-plus（缺一则对应能力静默失效）`,
      `import Vue from 'vue'`,
      `import ElementUI from 'element-ui'`,
      `import 'element-ui/lib/theme-chalk/index.css'`,
      `import axios from 'axios'`,
      `import ESPlus from '${pkg}'`,
      `import '${pkg}/dist/style.css'`,
      ``,
      `Vue.use(ElementUI)`,
      `Vue.use(ESPlus, {`,
      ...optionBlock,
      `})`,
    ].join("\n");
  }

  const lines = [
    `// src/main.ts — 应用入口：全局装配 es-plus（缺一则对应能力静默失效）`,
    `import { createApp } from 'vue'`,
    `import axios from 'axios'`,
  ];
  if (target === 'antdv') {
    lines.push(`import Antd from 'ant-design-vue'`);
    lines.push(`import 'ant-design-vue/dist/reset.css'`);
  } else {
    // vue3 默认 UI 库。此前后缺这一支：antdv/vue2 都装配了自己的 UI 库，唯独默认 target
    // 的样板让人「照抄入口」却没有 ElementPlus —— 产物模板里的 el-* 全是未知元素。
    lines.push(`import ElementPlus from 'element-plus'`);
    lines.push(`import 'element-plus/dist/index.css'`);
  }
  lines.push(`import ESPlus from '${pkg}'`);
  lines.push(`import '${pkg}/dist/style.css'`);
  lines.push(``);
  lines.push(`const app = createApp(App)`);
  lines.push(``);
  if (target === 'antdv') {
    lines.push(`app.use(Antd)`);
  } else {
    lines.push(`app.use(ElementPlus)`);
  }
  lines.push(`app.use(ESPlus, {`);
  lines.push(...optionBlock);
  lines.push(`})`);
  lines.push(``);
  lines.push(`app.mount('#app')`);
  return lines.join("\n");
}

/**
 * 生成最小化空白脚手架（query/table/dialog 任意组合）
 *
 * @param name      kebab-case 页面名称
 * @param features  启用功能数组，可选 'query' | 'table' | 'dialog'
 * @param target    目标框架，'vue3' (默认) | 'vue2'
 */
export function generateScaffold(
  name: string,
  features?: string[],
  target: TargetFramework = DEFAULT_TARGET
): string {
  const componentName =
    name.charAt(0).toUpperCase() + name.slice(1).replace(/-(\w)/g, (_, c) => c.toUpperCase());

  const hasQuery = !features || features.includes("query");
  const hasTable = !features || features.includes("table");
  const hasDialog = features?.includes("dialog");
  const isVue2 = target === 'vue2';
  const esPlusPkg = getEsPlusPackageName(target);

  const lines: string[] = [];
  lines.push(`<template>`);
  lines.push(`  <div class="${qAttr(name)}-page">`);

  if (hasTable) {
    lines.push(`    <es-table`);
    lines.push(`      ref="tableRef"`);
    lines.push(`      :columns="columns"`);
    lines.push(`      :options="options"`);
    if (isVue2) {
      // F7：vue2 es-table 从不 emit `update:dataSource` —— `.sync` 会承诺一个永不触发的方向。
      // 表格数据仍作为受控输入传入；`pagination` 会 emit，`.sync` 成立。
      lines.push(`      :data-source="tableData"`);
      lines.push(`      :pagination.sync="pagination"`);
    } else {
      lines.push(`      v-model:data-source="tableData"`);
      lines.push(`      v-model:pagination="pagination"`);
    }
    lines.push(`    >`);
    if (hasQuery) {
      lines.push(`      <es-form :model="queryForm" :form-item-list="formItems" :config-btn="queryBtns" />`);
    }
    lines.push(`    </es-table>`);
  } else if (hasQuery) {
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
    lines.push(`  name: ${q(componentName)},`);
    lines.push(`  setup() {`);

    const exposeFields: string[] = [];

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
      lines.push(`    // 全局配置: Vue.use(EsPlus, { EsTable: { httpRequest, configQueryFieldOutput } })`);
      lines.push(`    const options = {`);
      lines.push(`      border: true,`);
      lines.push(`      stripe: true,`);
      lines.push(`      highlightCurrentRow: true,`);
      // 不生成 headerCellStyle 默认值：内联样式会压过宿主主题（暗色表头成唯一亮块），
      // 表头底色交给主题 CSS / 组件库默认。
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
    lines.push(`// ── 全局装配（permissionValue / i18n labelKey / 远端 apiParams 的前提）──`);
    lines.push(`// 入口 main.js 须一次性 Vue.use(ESPlus, { permission, t, httpRequest })，否则对应能力静默失效`);
    lines.push(`// （scaffold_page 输出会随附可直接复制的 main.js 样板）`);
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
    lines.push(`// 全局配置: app.use(ESPlus, { EsTable: { httpRequest, configQueryFieldOutput } })`);
    lines.push(`const options = {`);
    lines.push(`  border: true,`);
    lines.push(`  stripe: true,`);
    lines.push(`  highlightCurrentRow: true,`);
    // 不生成 headerCellStyle 默认值：内联样式会压过宿主主题（暗色表头成唯一亮块），
    // 表头底色交给主题 CSS / 组件库默认。
    lines.push(`  apiParams: { url: '/api/xxx' },  // TODO: 替换为实际接口地址`);
    lines.push(`  rowkey: 'id'`);
    lines.push(`}`);
    lines.push(``);
  }

  if (hasDialog) {
    lines.push(`const dialog = useDialog()`);
    lines.push(``);
  }

  lines.push(`// ── 全局装配（permissionValue / i18n labelKey / 远端 apiParams 的前提）──`);
  lines.push(`// 入口 main.ts 须一次性 app.use(ESPlus, { permission, t, httpRequest })，否则对应能力静默失效`);
  lines.push(`// （scaffold_page 输出会随附可直接复制的 main.ts 样板）`);
  lines.push(`</script>`);

  return lines.join("\n");
}
