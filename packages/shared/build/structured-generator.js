import { SPECIAL_BTN_KEYS, OPERATION_COLUMN_PROP_SFC, CRUD_PAGE_BTN_CLICK_KEYS } from './contract.js';
export function generateFromConfig(config) {
    const mode = config.mode || 'schema';
    if (mode === 'sfc') {
        return generateSFC(config);
    }
    return generateSchema(config);
}
function generateSchema(config) {
    const warnings = [];
    const queryFields = config.fields.filter(f => f.inQuery !== false);
    const tableFields = config.fields.filter(f => f.inTable !== false);
    const formFields = config.fields.filter(f => f.inForm !== false);
    const hasDelete = config.actions.includes('delete');
    const hasDialog = config.actions.includes('add') || config.actions.includes('edit') || config.actions.includes('view');
    const useNewDialogMode = !!(config.dialogs || config.toolbarBtns || config.tableBtns || config.operationColumn !== undefined);
    const renderFields = tableFields.filter(f => f.render);
    if (renderFields.length > 0) {
        warnings.push(`Schema mode does not support inline render expressions. Fields [${renderFields.map(f => f.prop).join(', ')}] have render — handle in wrapper SFC via scopedSlots or event handlers.`);
    }
    const schema = {};
    if (queryFields.length > 0) {
        schema.formItems = queryFields.map(f => buildFormItem(f, 'query', config.i18n));
    }
    schema.columns = tableFields.map(f => buildTableColumn(f, config.i18n));
    const tOpts = (config.tableOptions || {});
    schema.tableOptions = {
        border: tOpts.border !== false,
        stripe: tOpts.stripe !== false,
        highlightCurrentRow: tOpts.highlightCurrentRow !== false,
        headerCellStyle: tOpts.headerCellStyle || { background: '#f5f7fa' },
        apiParams: { url: config.apiUrl },
        rowkey: tOpts.rowkey || 'id',
        ...(tOpts.heightType ? { heightType: tOpts.heightType } : {}),
        ...(tOpts.multiSelect ? { multiSelect: true } : {}),
    };
    // Query form layout (minFoldRows for collapse)
    if (config.formLayout) {
        schema.formLayout = config.formLayout;
    }
    // New multi-dialog mode
    if (useNewDialogMode) {
        if (config.toolbarBtns) {
            schema.toolbarBtns = config.toolbarBtns;
        }
        if (config.tableBtns) {
            schema.tableBtns = config.tableBtns;
        }
        if (config.operationColumn !== undefined) {
            schema.operationColumn = config.operationColumn;
        }
        if (config.dialogs) {
            const schemaDialogs = {};
            for (const [key, dlg] of Object.entries(config.dialogs)) {
                const dialogSchema = {};
                if (dlg.title)
                    dialogSchema.title = dlg.title;
                if (dlg.width)
                    dialogSchema.width = dlg.width;
                if (dlg.formItems) {
                    dialogSchema.formItems = dlg.formItems.map((f) => buildFormItem(f, 'form', config.i18n));
                }
                if (dlg.formLayout)
                    dialogSchema.formLayout = dlg.formLayout;
                if (dlg.isDraggable)
                    dialogSchema.isDraggable = true;
                if (dlg.maxHeight)
                    dialogSchema.maxHeight = dlg.maxHeight;
                if (dlg.fullscreen)
                    dialogSchema.fullscreen = true;
                if (dlg.isHiddenFooter)
                    dialogSchema.isHiddenFooter = true;
                if (dlg.hasCustomRender) {
                    dialogSchema.hasCustomRender = true;
                    warnings.push(`Dialog "${key}" has hasCustomRender=true — implement render function in wrapper SFC.`);
                }
                schemaDialogs[key] = dialogSchema;
            }
            schema.dialogs = schemaDialogs;
        }
    }
    else {
        // Legacy mode: use dialogFormItems + actions
        if (formFields.length > 0 && hasDialog) {
            schema.dialogFormItems = formFields.map(f => buildFormItem(f, 'form', config.i18n));
        }
        schema.actions = config.actions;
    }
    schema.pagination = { pageSize: config.pagination?.pageSize || 10 };
    const schemaJson = JSON.stringify(schema, null, 2);
    const wrapperCode = useNewDialogMode
        ? buildSchemaWrapperNew(config, renderFields, warnings)
        : buildSchemaWrapper(config, hasDelete, hasDialog, renderFields);
    const tsImport = config.typescript
        ? `import type { CrudPageSchema } from 'es-plus-ui'\n\nexport const pageSchema: CrudPageSchema = `
        : `export const pageSchema = `;
    const code = `${tsImport}${schemaJson}\n`;
    const dialogCount = config.dialogs ? Object.keys(config.dialogs).length : (hasDialog ? 1 : 0);
    const summary = [
        `Generated CrudPageSchema (structured mode):`,
        `- ${queryFields.length} query fields, ${tableFields.length} table columns`,
        `- ${dialogCount} dialog(s) configured`,
        `- Actions: ${config.actions.join(', ')}`,
        `- API: ${config.apiUrl}`,
        `- Mode: schema + wrapper SFC`,
        useNewDialogMode ? '- Multi-dialog mode' : '- Legacy actions mode',
        config.typescript ? '- TypeScript enabled' : '',
        config.permissions ? '- Permissions configured' : '',
    ].filter(Boolean).join('\n');
    return { code, wrapperCode, summary, warnings };
}
function generateSFC(config) {
    const warnings = [];
    const queryFields = config.fields.filter(f => f.inQuery !== false);
    const tableFields = config.fields.filter(f => f.inTable !== false);
    const formFields = config.fields.filter(f => f.inForm !== false);
    const hasDelete = config.actions.includes('delete');
    const hasDialog = config.actions.includes('add') || config.actions.includes('edit') || config.actions.includes('view');
    const hasRender = tableFields.some(f => f.render);
    const ts = config.typescript;
    const lines = [];
    // Template
    lines.push(`<template>`);
    lines.push(`  <es-table`);
    lines.push(`    ref="tableRef"`);
    lines.push(`    :columns="columns"`);
    lines.push(`    :options="options"`);
    lines.push(`    v-model:data-source="tableData"`);
    lines.push(`    v-model:pagination="pagination"`);
    lines.push(`  >`);
    lines.push(`    <es-form :model="queryForm" :form-item-list="formItems" :config-btn="queryBtns" />`);
    lines.push(`  </es-table>`);
    lines.push(`</template>`);
    lines.push(``);
    // Script
    lines.push(ts ? `<script setup lang="ts">` : `<script setup>`);
    // Imports
    const vueImports = ['reactive', 'ref'];
    if (hasRender)
        vueImports.push('h');
    lines.push(`import { ${vueImports.join(', ')} } from 'vue'`);
    if (hasDialog) {
        lines.push(`import { useDialog } from 'es-plus-ui'`);
    }
    const epImports = [];
    if (hasRender)
        epImports.push('ElTag');
    if (hasDelete)
        epImports.push('ElMessageBox', 'ElMessage');
    if (epImports.length > 0) {
        lines.push(`import { ${epImports.join(', ')} } from 'element-plus'`);
    }
    lines.push(``);
    // TypeScript interface
    if (ts && queryFields.length > 0) {
        lines.push(`interface QueryForm {`);
        for (const f of queryFields) {
            const tsType = inferTsType(f);
            lines.push(`  ${f.prop}: ${tsType}`);
        }
        lines.push(`}`);
        lines.push(``);
    }
    // Reactive state
    const modelInit = queryFields.map(f => `${f.prop}: ${getDefaultValue(f)}`).join(', ');
    if (ts) {
        lines.push(`const queryForm = reactive<QueryForm>({ ${modelInit} })`);
    }
    else {
        lines.push(`const queryForm = reactive({ ${modelInit} })`);
    }
    lines.push(`const tableData = ref([])`);
    lines.push(`const tableRef = ref(null)`);
    lines.push(`const pagination = ref({ current: 1, pageSize: ${config.pagination?.pageSize || 10}, total: 0 })`);
    if (hasDialog)
        lines.push(`const dialog = useDialog()`);
    lines.push(``);
    // formItems
    const formItemsJson = JSON.stringify(queryFields.map(f => buildFormItem(f, 'query', config.i18n)), null, 2);
    lines.push(`const formItems = ${formItemsJson}`);
    lines.push(``);
    // queryBtns
    lines.push(`const queryBtns = [`);
    lines.push(`  { name: '查询', type: 'primary', key: '${SPECIAL_BTN_KEYS.QUERY}', triggerEvent: true },`);
    lines.push(`  { name: '重置', key: '${SPECIAL_BTN_KEYS.RESET}', triggerEvent: true },`);
    if (config.actions.includes('add')) {
        const perm = config.permissions?.add ? `, permissionValue: '${config.permissions.add}'` : '';
        lines.push(`  { name: '新增', type: 'primary', key: 'add', icon: 'Plus', click: () => openForm('新增')${perm} },`);
    }
    if (config.actions.includes('export')) {
        const perm = config.permissions?.export ? `, permissionValue: '${config.permissions.export}'` : '';
        lines.push(`  { name: '导出', key: 'export', icon: 'Download', click: () => handleExport()${perm} },`);
    }
    if (config.actions.includes('import')) {
        const perm = config.permissions?.import ? `, permissionValue: '${config.permissions.import}'` : '';
        lines.push(`  { name: '导入', key: 'import', icon: 'Upload', click: () => handleImport()${perm} },`);
    }
    lines.push(`]`);
    lines.push(``);
    // columns
    lines.push(`const columns = [`);
    for (const f of tableFields) {
        const col = buildTableColumnSFC(f, config);
        lines.push(`  ${col},`);
    }
    // operation column
    const actionBtns = buildActionBtns(config);
    if (actionBtns.length > 0) {
        lines.push(`  {`);
        lines.push(`    prop: '${OPERATION_COLUMN_PROP_SFC}',`);
        lines.push(`    label: '操作',`);
        lines.push(`    width: ${actionBtns.length * 80 + 20},`);
        lines.push(`    fixed: 'right',`);
        lines.push(`    btns: [`);
        for (const btn of actionBtns) {
            lines.push(`      ${btn},`);
        }
        lines.push(`    ]`);
        lines.push(`  }`);
    }
    lines.push(`]`);
    lines.push(``);
    // options
    const tOpts = (config.tableOptions || {});
    lines.push(`const options = {`);
    lines.push(`  border: ${tOpts.border !== false},`);
    lines.push(`  stripe: ${tOpts.stripe !== false},`);
    lines.push(`  highlightCurrentRow: ${tOpts.highlightCurrentRow !== false},`);
    lines.push(`  headerCellStyle: { background: '#f5f7fa' },`);
    lines.push(`  apiParams: { url: '${config.apiUrl}' },`);
    lines.push(`  rowkey: '${tOpts.rowkey || 'id'}'`);
    lines.push(`}`);
    // delete handler
    if (hasDelete) {
        lines.push(``);
        lines.push(`function handleDelete(row${ts ? ': any' : ''}) {`);
        lines.push(`  ElMessageBox.confirm('确定删除该条数据吗？', '提示', { type: 'warning' })`);
        lines.push(`    .then(async () => {`);
        lines.push(`      await httpRequest({ url: \`${config.apiUrl}/\${row.${tOpts.rowkey || 'id'}}\`, method: 'DELETE' })`);
        lines.push(`      ElMessage.success('删除成功')`);
        lines.push(`      tableRef.value?.httpRequestInstance()`);
        lines.push(`    })`);
        lines.push(`    .catch(() => {})`);
        lines.push(`}`);
    }
    // export/import handlers
    if (config.actions.includes('export')) {
        lines.push(``);
        lines.push(`function handleExport() {`);
        lines.push(`  window.open(\`${config.apiUrl}/export?\${new URLSearchParams(queryForm as any).toString()}\`)`);
        lines.push(`}`);
    }
    if (config.actions.includes('import')) {
        lines.push(``);
        lines.push(`function handleImport() {`);
        lines.push(`  // Implement import dialog/upload logic`);
        lines.push(`}`);
    }
    // dialog form
    if (hasDialog) {
        lines.push(``);
        lines.push(`function openForm(title${ts ? ': string' : ''}, row${ts ? ': any' : ''} = {}) {`);
        const dialogModelInit = formFields.map(f => `${f.prop}: ${getDefaultValue(f)}`).join(', ');
        lines.push(`  const formData = reactive({ ${dialogModelInit}, ...row })`);
        lines.push(`  const isView = title === '查看'`);
        lines.push(``);
        const dialogFormItemsJson = JSON.stringify(formFields.map(f => buildFormItem(f, 'form', config.i18n)), null, 4);
        lines.push(`  const dialogFormItems = ${dialogFormItemsJson}`);
        lines.push(``);
        lines.push(`  dialog({`);
        lines.push(`    title,`);
        lines.push(`    width: '560px',`);
        lines.push(`    render: (h, { registerRef }) => (`);
        lines.push(`      <EsForm`);
        lines.push(`        ref={el => el && registerRef('form', el)}`);
        lines.push(`        model={formData}`);
        lines.push(`        formItemList={dialogFormItems}`);
        lines.push(`        layoutFormProps={{ fromLayProps: { labelWidth: '100px', isBtnHidden: true } }}`);
        lines.push(`      />`);
        lines.push(`    ),`);
        lines.push(`    configBtn: isView ? [`);
        lines.push(`      { name: '关闭', click: (_, { close }) => close() }`);
        lines.push(`    ] : [`);
        lines.push(`      { name: '取消', click: (_, { close }) => close() },`);
        lines.push(`      { name: '确定', type: 'primary', click: async (_, { close, getRefs }) => {`);
        lines.push(`        try {`);
        lines.push(`          await getRefs('form')?.validate()`);
        lines.push(`          const method = title === '新增' ? 'POST' : 'PUT'`);
        lines.push(`          const url = title === '新增' ? '${config.apiUrl}' : \`${config.apiUrl}/\${formData.${tOpts.rowkey || 'id'}}\``);
        lines.push(`          await httpRequest({ url, method, data: formData })`);
        lines.push(`          ElMessage.success(\`\${title}成功\`)`);
        lines.push(`          close()`);
        lines.push(`          tableRef.value?.httpRequestInstance()`);
        lines.push(`        } catch {}`);
        lines.push(`      }}`);
        lines.push(`    ]`);
        lines.push(`  })`);
        lines.push(`}`);
    }
    lines.push(`</script>`);
    const code = lines.join('\n');
    const summary = [
        `Generated full SFC (structured mode):`,
        `- ${queryFields.length} query fields, ${tableFields.length} table columns, ${formFields.length} dialog fields`,
        `- Actions: ${config.actions.join(', ')}`,
        `- API: ${config.apiUrl}`,
        config.typescript ? '- TypeScript enabled' : '',
        config.permissions ? '- Permissions configured' : '',
    ].filter(Boolean).join('\n');
    return { code, summary, warnings };
}
function buildSchemaWrapper(config, hasDelete, _hasDialog, renderFields) {
    const ts = config.typescript;
    const tOpts = (config.tableOptions || {});
    const lines = [];
    lines.push(`<template>`);
    lines.push(`  <es-crud-page`);
    lines.push(`    ref="crudRef"`);
    lines.push(`    :schema="pageSchema"`);
    lines.push(`    :http-request="fetchData"`);
    if (hasDelete)
        lines.push(`    @delete="handleDelete"`);
    lines.push(`    @btn-click="handleBtnClick"`);
    if (renderFields.length > 0) {
        for (const f of renderFields) {
            lines.push(`    #column-${f.prop}="{ row }"`);
        }
    }
    lines.push(`  >`);
    if (renderFields.length > 0) {
        for (const f of renderFields) {
            lines.push(`    <template #column-${f.prop}="{ row }">`);
            lines.push(`      <!-- ${f.label} custom render -->`);
            lines.push(`      <el-tag :type="row.${f.prop} === 1 ? 'success' : 'danger'">`);
            lines.push(`        {{ row.${f.prop} === 1 ? '启用' : '禁用' }}`);
            lines.push(`      </el-tag>`);
            lines.push(`    </template>`);
        }
    }
    lines.push(`  </es-crud-page>`);
    lines.push(`</template>`);
    lines.push(``);
    lines.push(ts ? `<script setup lang="ts">` : `<script setup>`);
    lines.push(`import { ref } from 'vue'`);
    const epImports = [];
    if (hasDelete)
        epImports.push('ElMessageBox', 'ElMessage');
    if (epImports.length > 0) {
        lines.push(`import { ${epImports.join(', ')} } from 'element-plus'`);
    }
    lines.push(`import { pageSchema } from './schema'`);
    lines.push(``);
    lines.push(`const crudRef = ref(null)`);
    lines.push(``);
    lines.push(`async function fetchData(params${ts ? ': any' : ''}) {`);
    lines.push(`  const res = await httpRequest({`);
    lines.push(`    url: '${config.apiUrl}',`);
    lines.push(`    method: 'GET',`);
    lines.push(`    params: { ...params.formParams, pageIndex: params.pageIndex, pageSize: params.pageSize }`);
    lines.push(`  })`);
    lines.push(`  return res`);
    lines.push(`}`);
    if (hasDelete) {
        lines.push(``);
        lines.push(`function handleDelete(row${ts ? ': any' : ''}) {`);
        lines.push(`  ElMessageBox.confirm('确定删除该条数据吗？', '提示', { type: 'warning' })`);
        lines.push(`    .then(async () => {`);
        lines.push(`      await httpRequest({ url: \`${config.apiUrl}/\${row.${tOpts.rowkey || 'id'}}\`, method: 'DELETE' })`);
        lines.push(`      ElMessage.success('删除成功')`);
        lines.push(`      crudRef.value?.refresh()`);
        lines.push(`    })`);
        lines.push(`    .catch(() => {})`);
        lines.push(`}`);
    }
    lines.push(``);
    lines.push(`function handleBtnClick(key${ts ? ': string' : ''}, data${ts ? ': any' : ''}) {`);
    if (config.actions.includes('add')) {
        lines.push(`  if (key === '${CRUD_PAGE_BTN_CLICK_KEYS.ADD_CONFIRM}') {`);
        lines.push(`    httpRequest({ url: '${config.apiUrl}', method: 'POST', data }).then(() => {`);
        lines.push(`      ElMessage.success('新增成功')`);
        lines.push(`      crudRef.value?.refresh()`);
        lines.push(`    })`);
        lines.push(`  }`);
    }
    if (config.actions.includes('edit')) {
        lines.push(`  if (key === '${CRUD_PAGE_BTN_CLICK_KEYS.EDIT_CONFIRM}') {`);
        lines.push(`    httpRequest({ url: \`${config.apiUrl}/\${data.${tOpts.rowkey || 'id'}}\`, method: 'PUT', data }).then(() => {`);
        lines.push(`      ElMessage.success('编辑成功')`);
        lines.push(`      crudRef.value?.refresh()`);
        lines.push(`    })`);
        lines.push(`  }`);
    }
    lines.push(`}`);
    lines.push(`</script>`);
    return lines.join('\n');
}
function buildSchemaWrapperNew(config, renderFields, warnings) {
    const ts = config.typescript;
    const tOpts = (config.tableOptions || {});
    const lines = [];
    const hasDelete = config.actions.includes('delete');
    const dialogs = config.dialogs || {};
    const customRenderDialogs = Object.entries(dialogs).filter(([, d]) => d.hasCustomRender);
    lines.push(`<template>`);
    lines.push(`  <es-crud-page`);
    lines.push(`    ref="crudRef"`);
    lines.push(`    :schema="pageSchema"`);
    lines.push(`    :http-request="fetchData"`);
    if (hasDelete)
        lines.push(`    @delete="handleDelete"`);
    lines.push(`    @dialog-confirm="handleDialogConfirm"`);
    lines.push(`    @btn-click="handleBtnClick"`);
    lines.push(`  >`);
    if (renderFields.length > 0) {
        for (const f of renderFields) {
            lines.push(`    <template #column-${f.prop}="{ row }">`);
            lines.push(`      <el-tag :type="row.${f.prop} === 1 ? 'success' : 'danger'">`);
            lines.push(`        {{ row.${f.prop} === 1 ? '启用' : '禁用' }}`);
            lines.push(`      </el-tag>`);
            lines.push(`    </template>`);
        }
    }
    lines.push(`  </es-crud-page>`);
    lines.push(`</template>`);
    lines.push(``);
    lines.push(ts ? `<script setup lang="ts">` : `<script setup>`);
    lines.push(`import { ref } from 'vue'`);
    const epImports = [];
    if (hasDelete)
        epImports.push('ElMessageBox', 'ElMessage');
    else
        epImports.push('ElMessage');
    lines.push(`import { ${[...new Set(epImports)].join(', ')} } from 'element-plus'`);
    lines.push(`import { pageSchema } from './schema'`);
    lines.push(``);
    lines.push(`const crudRef = ref(null)`);
    lines.push(``);
    // fetchData
    lines.push(`async function fetchData(params${ts ? ': any' : ''}) {`);
    lines.push(`  const res = await httpRequest({`);
    lines.push(`    url: '${config.apiUrl}',`);
    lines.push(`    method: 'GET',`);
    lines.push(`    params: { ...params.formParams, pageIndex: params.pageIndex, pageSize: params.pageSize }`);
    lines.push(`  })`);
    lines.push(`  return res`);
    lines.push(`}`);
    // delete handler
    if (hasDelete) {
        lines.push(``);
        lines.push(`function handleDelete(row${ts ? ': any' : ''}) {`);
        lines.push(`  ElMessageBox.confirm('确定删除该条数据吗？', '提示', { type: 'warning' })`);
        lines.push(`    .then(async () => {`);
        lines.push(`      await httpRequest({ url: \`${config.apiUrl}/\${row.${tOpts.rowkey || 'id'}}\`, method: 'DELETE' })`);
        lines.push(`      ElMessage.success('删除成功')`);
        lines.push(`      crudRef.value?.refresh()`);
        lines.push(`    })`);
        lines.push(`    .catch(() => {})`);
        lines.push(`}`);
    }
    // dialog-confirm handler
    lines.push(``);
    lines.push(`function handleDialogConfirm(dialogKey${ts ? ': string' : ''}, data${ts ? ': any' : ''}) {`);
    const dialogEntries = Object.entries(dialogs).filter(([, d]) => !d.hasCustomRender);
    for (const [key] of dialogEntries) {
        const method = key === 'add' ? 'POST' : 'PUT';
        const url = key === 'add' ? `'${config.apiUrl}'` : `\`${config.apiUrl}/\${data.${tOpts.rowkey || 'id'}}\``;
        lines.push(`  if (dialogKey === '${key}') {`);
        lines.push(`    httpRequest({ url: ${url}, method: '${method}', data }).then(() => {`);
        lines.push(`      ElMessage.success('操作成功')`);
        lines.push(`      crudRef.value?.refresh()`);
        lines.push(`    })`);
        lines.push(`  }`);
    }
    lines.push(`}`);
    // btn-click handler (for non-dialog actions like export)
    lines.push(``);
    lines.push(`function handleBtnClick(key${ts ? ': string' : ''}, payload${ts ? '?: any' : ''}) {`);
    if (config.actions.includes('export')) {
        lines.push(`  if (key === 'export') {`);
        lines.push(`    window.open(\`${config.apiUrl}/export?\${new URLSearchParams(payload || {}).toString()}\`)`);
        lines.push(`  }`);
    }
    lines.push(`}`);
    // Custom render dialog placeholders
    if (customRenderDialogs.length > 0) {
        lines.push(``);
        lines.push(`// Custom render dialogs — implement in pageSchema.dialogs[key].render`);
        for (const [key] of customRenderDialogs) {
            lines.push(`// Dialog "${key}" uses custom render — configure in schema or override via openDialog`);
        }
    }
    lines.push(`</script>`);
    return lines.join('\n');
}
function buildFormItem(field, context, i18n) {
    const item = {
        prop: field.prop,
        ...(i18n ? { labelKey: `field.${field.prop}` } : { label: field.label }),
        formtype: field.formtype,
        span: context === 'query'
            ? (field.querySpan || (field.formtype === 'datePicker' || field.formtype === 'timePicker' ? 8 : 6))
            : (field.formSpan || 24),
        attrs: { clearable: true, ...(field.attrs || {}) },
    };
    if (field.dataOptions)
        item.dataOptions = field.dataOptions;
    if (field.apiParams)
        item.apiParams = field.apiParams;
    if (context === 'form') {
        const rules = [];
        if (field.required) {
            const isSelectType = ['Select', 'Radio', 'Checkbox', 'Cascader', 'datePicker', 'timePicker', 'Switch'].includes(field.formtype);
            rules.push({
                required: true,
                message: `请${isSelectType ? '选择' : '输入'}${field.label}`,
                trigger: isSelectType ? 'change' : 'blur',
            });
        }
        if (field.rules) {
            for (const r of field.rules) {
                const rule = { message: r.message };
                if (r.required)
                    rule.required = true;
                if (r.pattern)
                    rule.pattern = r.pattern;
                if (r.min !== undefined)
                    rule.min = r.min;
                if (r.max !== undefined)
                    rule.max = r.max;
                if (r.type)
                    rule.type = r.type;
                if (r.trigger)
                    rule.trigger = r.trigger;
                rules.push(rule);
            }
        }
        if (rules.length > 0) {
            item.formItemOptions = { rules };
        }
    }
    return item;
}
function buildTableColumn(field, i18n) {
    const col = {
        prop: field.prop,
        ...(i18n ? { labelKey: `field.${field.prop}` } : { label: field.label }),
    };
    if (field.width)
        col.width = field.width;
    if (field.minWidth)
        col.minWidth = field.minWidth;
    if (field.align)
        col.align = field.align;
    if (field.fixed)
        col.fixed = field.fixed;
    if (field.ellipsis)
        col.showOverflowTooltip = true;
    return col;
}
function buildTableColumnSFC(field, config) {
    const parts = [];
    parts.push(`prop: '${field.prop}'`);
    parts.push(`label: '${config.i18n ? `\${t('field.${field.prop}')}` : field.label}'`);
    if (field.width)
        parts.push(`width: ${typeof field.width === 'number' ? field.width : `'${field.width}'`}`);
    if (field.minWidth)
        parts.push(`minWidth: ${typeof field.minWidth === 'number' ? field.minWidth : `'${field.minWidth}'`}`);
    if (field.align)
        parts.push(`align: '${field.align}'`);
    if (field.fixed)
        parts.push(`fixed: ${typeof field.fixed === 'boolean' ? field.fixed : `'${field.fixed}'`}`);
    if (field.ellipsis)
        parts.push(`showOverflowTooltip: true`);
    if (field.formatter)
        parts.push(`formatter: ${field.formatter}`);
    if (field.render)
        parts.push(`render: ${field.render}`);
    return `{ ${parts.join(', ')} }`;
}
function buildActionBtns(config) {
    const btns = [];
    if (config.actions.includes('view')) {
        const perm = config.permissions?.view ? `, permissionValue: '${config.permissions.view}'` : '';
        btns.push(`{ name: '查看', type: 'primary', clickEvent: (row) => openForm('查看', row)${perm} }`);
    }
    if (config.actions.includes('edit')) {
        const perm = config.permissions?.edit ? `, permissionValue: '${config.permissions.edit}'` : '';
        btns.push(`{ name: '编辑', type: 'primary', clickEvent: (row) => openForm('编辑', row)${perm} }`);
    }
    if (config.actions.includes('delete')) {
        const perm = config.permissions?.delete ? `, permissionValue: '${config.permissions.delete}'` : '';
        btns.push(`{ name: '删除', type: 'danger', clickEvent: (row) => handleDelete(row)${perm} }`);
    }
    return btns;
}
function inferTsType(field) {
    switch (field.formtype) {
        case 'Switch': return 'boolean';
        case 'Rate':
        case 'Slider': return 'number';
        case 'Checkbox':
        case 'Transfer': return 'any[]';
        case 'Cascader': return 'any[]';
        case 'datePicker':
        case 'timePicker':
            return field.attrs?.type?.toString().includes('range') ? 'string[]' : 'string';
        case 'Select':
            return "string | number | ''";
        default: return 'string';
    }
}
function getDefaultValue(field) {
    switch (field.formtype) {
        case 'Switch': return 'false';
        case 'Rate':
        case 'Slider': return '0';
        case 'Checkbox':
        case 'Transfer':
        case 'Cascader': return '[]';
        case 'datePicker':
        case 'timePicker':
            return field.attrs?.type?.toString().includes('range') ? '[]' : "''";
        default: return "''";
    }
}
//# sourceMappingURL=structured-generator.js.map