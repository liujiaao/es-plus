import type { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { z } from "zod";

const SYSTEM_PROMPT = `You are an expert at generating @es-plus/vue3 CRUD pages. @es-plus/vue3 is a config-driven Vue 3 + Element Plus component library.

Key concepts:
- EsForm: Config-driven form using \`formItemList\` (array of FormItemOption) and \`configBtn\` (array of BtnConfig)
- EsTable: Config-driven table using \`columns\` (array of TableColumn) and \`options\` (TableOptions)
- EsCrudPage: Schema-driven component that renders a complete CRUD page from a single JSON config
- useDialog: Imperative dialog API with JSX render support
- Form↔Table auto-linking: set \`triggerEvent: true\` on query button to auto-refresh table

Available formtype values: Input, Select, DatePicker, TimePicker, Slider, ColorPicker, Transfer, Cascader, Radio, Checkbox, Switch, Rate, Upload

Rules:
1. Query form fields use span: 6 (or 8 for date ranges)
2. Dialog form fields use span: 24
3. Always include query + reset buttons with triggerEvent: true
4. Use \`apiParams: { url: '/api/xxx' }\` in tableOptions (not inline httpRequest) when global config is set
5. configTableOut maps API response: { total: 'total', tableData: 'data', pageSize: 'pageSize', current: 'pageIndex' }
6. Use useDialog() for add/edit forms with JSX render (SFC mode only)
7. Register form ref in dialog via registerRef for validation (SFC mode only)
8. Reset button key MUST be "rest" (NOT "reset") — this is a known convention, not a typo
9. render() functions that use Element Plus components (ElTag, ElButton, etc.) MUST import them
10. Prefer EsCrudPage + CrudPageSchema mode over full SFC — simpler, less error-prone
11. In EsCrudPage mode, operation column prop is "action"; in SFC mode it is "operate"
12. EsCrudPage @btn-click event keys: "add-confirm" for add dialog submit, "edit-confirm" for edit dialog submit

Before generating code, read these MCP resources for accurate types and conventions:
- esplus://types — live TypeScript definitions
- esplus://conventions — generation rules and patterns
- esplus://crud-page-schema — EsCrudPage API and usage examples
`;

export function registerCrudPagePrompt(server: McpServer) {
  server.prompt(
    "crud-page",
    "Generate a complete @es-plus/vue3 CRUD page from a description",
    {
      description: z
        .string()
        .describe("Description of the CRUD page to generate"),
      mode: z
        .enum(["schema", "sfc"])
        .default("schema")
        .describe("Output mode: 'schema' for CrudPageSchema JSON + wrapper, 'sfc' for full Vue SFC"),
    },
    async ({ description, mode }) => {
      const modeInstruction =
        mode === "schema"
          ? `\n\nOutput as CrudPageSchema JSON + minimal wrapper SFC using <es-crud-page>. The schema should be pure JSON (no functions). Put event handlers in the wrapper SFC.`
          : `\n\nOutput as a complete Vue 3 SFC with EsTable + EsForm. Include all configurations, imports, and event handlers inline.`;

      return {
        messages: [
          {
            role: "user",
            content: {
              type: "text",
              text: `${SYSTEM_PROMPT}\n\nPlease generate a CRUD page based on this requirement:\n\n${description}${modeInstruction}\n\nProvide the complete code with proper imports, reactive state, and all configurations.`,
            },
          },
        ],
      };
    }
  );
}
