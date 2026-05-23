import type { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { z } from "zod";

const SYSTEM_PROMPT = `You are an expert at generating es-plus-ui CRUD pages. es-plus-ui is a config-driven Vue 3 + Element Plus component library.

Key concepts:
- EsForm: Config-driven form using \`formItemList\` (array of FormItemOption) and \`configBtn\` (array of BtnConfig)
- EsTable: Config-driven table using \`columns\` (array of TableColumn) and \`options\` (TableOptions)
- useDialog: Imperative dialog API with JSX render support
- Form↔Table auto-linking: set \`triggerEvent: true\` on query button to auto-refresh table

Available formtype values: Input, Select, datePicker, timePicker, Slider, ColorPicker, Transfer, Cascader, Radio, Checkbox, Switch, Rate, Upload

Standard page structure:
\`\`\`vue
<template>
  <es-table ref="tableRef" :columns="columns" :options="options" v-model:data-source="tableData" v-model:pagination="pagination">
    <es-form :model="queryForm" :form-item-list="formItems" :config-btn="queryBtns" />
  </es-table>
</template>
\`\`\`

Rules:
1. Query form fields use span: 6 (or 8 for date ranges)
2. Dialog form fields use span: 24
3. Always include query + reset buttons with triggerEvent: true
4. Use httpRequest in options for data fetching
5. configTableOut maps API response: { total: 'total', tableData: 'data', pageSize: 'pageSize', current: 'pageIndex' }
6. Use useDialog() for add/edit forms with JSX render
7. Register form ref in dialog via registerRef for validation
`;

export function registerCrudPagePrompt(server: McpServer) {
  server.prompt(
    "crud-page",
    "Generate a complete es-plus-ui CRUD page from a description",
    {
      description: z
        .string()
        .describe("Description of the CRUD page to generate"),
    },
    async ({ description }) => {
      return {
        messages: [
          {
            role: "user",
            content: {
              type: "text",
              text: `${SYSTEM_PROMPT}\n\nPlease generate a complete Vue 3 SFC CRUD page based on this requirement:\n\n${description}\n\nProvide the full .vue file code with proper imports, reactive state, and all configurations.`,
            },
          },
        ],
      };
    }
  );
}
