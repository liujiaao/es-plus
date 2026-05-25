import { generateCrudConfig, generateCode, type GeneratedConfig } from "./crud-engine.js";

export interface GenerateResult {
  code: string;
  config: GeneratedConfig;
  summary: string;
}

export function generateCrudPage(description: string): GenerateResult {
  const config = generateCrudConfig(description);
  const code = generateCode(config);

  const summary = [
    `Generated CRUD page with:`,
    `- ${config.formItems.length} query form fields`,
    `- ${config.columns.length} table columns`,
    `- Actions: ${config.actions.join(", ")}`,
    config.dialogFormItems?.length
      ? `- ${config.dialogFormItems.length} dialog form fields (with validation rules)`
      : "",
    config.hasStatusRender ? `- Status column with ElTag render` : "",
    config.actions.includes("delete") ? `- Delete confirmation dialog` : "",
    ``,
    `Note: 需要在 main.ts 中配置全局 app.use(ESPlus, { EsTable: { methods: { $httpRequest, configQueryFieldOutput } } })`,
    `详见: https://es-plus.liujiaao.top/docs/usage`,
  ]
    .filter(Boolean)
    .join("\n");

  return { code, config, summary };
}

export function generateScaffold(
  name: string,
  features?: string[]
): string {
  const componentName =
    name.charAt(0).toUpperCase() + name.slice(1).replace(/-(\w)/g, (_, c) => c.toUpperCase());

  const hasQuery = !features || features.includes("query");
  const hasTable = !features || features.includes("table");
  const hasDialog = features?.includes("dialog");

  const lines: string[] = [];
  lines.push(`<template>`);
  lines.push(`  <div class="${name}-page">`);

  if (hasTable) {
    lines.push(`    <es-table`);
    lines.push(`      ref="tableRef"`);
    lines.push(`      :columns="columns"`);
    lines.push(`      :options="options"`);
    lines.push(`      v-model:data-source="tableData"`);
    lines.push(`      v-model:pagination="pagination"`);
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
  lines.push(`<script setup>`);
  lines.push(`import { reactive, ref } from 'vue'`);
  if (hasDialog) {
    lines.push(`import { useDialog } from 'es-plus-ui'`);
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
