import type { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { z } from "zod";

type Target = "vue3" | "vue2" | "antdv";

const PKG: Record<Target, string> = {
  vue3: "@es-plus/vue3",
  vue2: "@es-plus/vue2",
  antdv: "@es-plus/adapter-antdv",
};

// Per-target syntax / UI-library differences the model must respect. The schema
// JSON is framework-invariant — only the wrapper/SFC syntax and UI-library
// symbols differ. Keep this in sync with packages/shared/src/target.ts.
function targetNotes(target: Target): string {
  if (target === "vue2") {
    return `Target = @es-plus/vue2 (Vue 2.7 + Element UI):
- Wrapper/SFC uses \`defineComponent({ setup() { ... return {...} } })\`, NOT <script setup>.
- Template multi-target binding uses \`:data-source.sync\` / \`:pagination.sync\`, NOT \`v-model:xxx\`.
- UI-library symbols: \`Message\` / \`MessageBox\` from 'element-ui' (NOT ElMessage/ElMessageBox).
- Status tags: <el-tag :type="... ? 'success' : 'danger'">.
- Element UI has NO virtual scrolling (no el-table-v2) — ignore \`virtual\`.
- JSX render (dialogs) needs @vue/babel-preset-jsx; prefer mode=schema to avoid JSX.`;
  }
  if (target === "antdv") {
    return `Target = @es-plus/adapter-antdv (Vue 3 + Ant Design Vue 4.x):
- Wrapper/SFC uses <script setup> (same as vue3); dialogs' JSX render needs lang="tsx"/"jsx" + @vitejs/plugin-vue-jsx.
- Template multi-target binding uses \`v-model:data-source\` / \`v-model:pagination\`.
- UI-library symbols: \`message\` (function) and \`Modal.confirm({ title, content, async onOk(){} })\` from 'ant-design-vue' (object form, NOT the Element Promise .then form).
- Status tags: <a-tag :color="... ? 'green' : 'red'"> — Ant tags use \`color\`, NOT \`type\`.
  IMPORTANT: in SFC mode an inline column render() written with Element semantics
  (h(Tag, { type })) will NOT map colors correctly — prefer mode=schema, which
  emits a correct <a-tag :color> slot automatically.`;
  }
  return `Target = @es-plus/vue3 (Vue 3 + Element Plus):
- Wrapper/SFC uses <script setup>; dialogs' JSX render needs lang="tsx"/"jsx" + @vitejs/plugin-vue-jsx.
- Template multi-target binding uses \`v-model:data-source\` / \`v-model:pagination\`.
- UI-library symbols: \`ElMessage\` / \`ElMessageBox.confirm(...).then(...)\` from 'element-plus'.
- Status tags: <el-tag :type="... ? 'success' : 'danger'">.`;
}

function buildSystemPrompt(target: Target): string {
  const pkg = PKG[target];
  return `You are an expert at generating ${pkg} CRUD pages. ${pkg} is a config-driven component library (one JSON config, three renderers — the schema is framework-invariant).

IMPORTANT — pick the right renderer first: call the \`detect_project_target\` tool with the user's package.json to confirm the target (vue3 / vue2 / antdv) before generating. Do not assume vue3.

Key concepts:
- EsForm: Config-driven form using \`formItemList\` (array of FormItemOption) and \`configBtn\` (array of BtnConfig)
- EsTable: Config-driven table using \`columns\` (array of TableColumn) and \`options\` (TableOptions)
- EsCrudPage: Schema-driven component that renders a complete CRUD page from a single JSON config
- useDialog: Imperative dialog API with JSX render support
- Form↔Table auto-linking: set \`triggerEvent: true\` on query button to auto-refresh table

${targetNotes(target)}

Available formtype values: Input, Select, DatePicker, TimePicker, Slider, ColorPicker, Transfer, Cascader, Radio, Checkbox, Switch, Rate, Upload

Rules:
1. Query form fields use span: 6 (or 8 for date ranges)
2. Dialog form fields use span: 24
3. Always include query + reset buttons with triggerEvent: true
4. Data fetch: set \`apiParams: { url: '/api/xxx' }\` in tableOptions so EsTable auto-fetches. For add/edit/delete mutations, import the global request function: \`import { httpRequest } from '${pkg}'\` and call \`httpRequest({ url, method, data })\`. The app entry MUST configure it: \`app.use(EsPlus, { httpRequest: (p) => axios(p) })\` (vue2: \`Vue.use\`).
5. configTableOut maps API response: { total: 'total', tableData: 'data', pageSize: 'pageSize', current: 'pageIndex' }
6. Use useDialog() for add/edit forms with JSX render (SFC mode only)
7. Register form ref in dialog via registerRef for validation (SFC mode only)
8. Reset button key MUST be "rest" (NOT "reset") — this is a known convention, not a typo
9. render() functions that use UI-library components (ElTag/a-tag, buttons, etc.) MUST import them; match the target's UI library (see per-target notes above)
10. Prefer EsCrudPage + CrudPageSchema mode over full SFC — simpler, less error-prone, and it handles per-target UI differences (message/confirm/tag) for you
11. In EsCrudPage mode, operation column prop is "action"; in SFC mode it is "operate"
12. EsCrudPage @btn-click event keys: "add-confirm" for add dialog submit, "edit-confirm" for edit dialog submit
13. For custom column rendering in schema mode, set the column's \`scopedSlots: { customRender: 'column-<prop>' }\` and provide a matching \`<template #column-<prop>="{ row }">\` in the wrapper — es-table only renders a column slot when scopedSlots.customRender is set

Preferred path: for most requests, DRAFT a StructuredCrudConfig and call the
\`generate_crud_from_config\` tool rather than hand-writing the SFC — it maps
your typed config to correct, compilable per-target code deterministically. Use
hand-written output only when the request is outside the schema's expressiveness.

Self-review checklist — run this against the ORIGINAL request BEFORE emitting:
- Every field the user named is present, with a formtype chosen by MEANING
  (status/enum → Select, date/time → DatePicker/TimePicker, image/file → Upload,
  on/off → Switch), not by keyword matching.
- Query / table / form partitions are right: system columns (id, createdAt) are
  inForm:false; detail-only fields are inQuery:false.
- Every requested action is present; each Select/Cascader has dataOptions or apiParams.
- Table buttons use code (1=left, 2=right), never position.
- Business logic the schema can't express (permission gates, conditional display,
  computed cells) is emitted as a typed extension point (permissionValue / formatter
  / render) and NOT silently dropped.

Before generating code, read these MCP resources for accurate types and conventions:
- esplus://examples/nl-to-config — few-shot NL→config with reasoning (read for the config path)
- esplus://types — live TypeScript definitions
- esplus://conventions — generation rules and patterns
- esplus://crud-page-schema — EsCrudPage API and usage examples
`;
}

export function registerCrudPagePrompt(server: McpServer) {
  server.prompt(
    "crud-page",
    "Generate a complete es-plus CRUD page (vue3 / vue2 / antdv) from a description",
    {
      description: z
        .string()
        .describe("Description of the CRUD page to generate"),
      target: z
        .enum(["vue3", "vue2", "antdv"])
        .default("vue3")
        .describe("Renderer target. Run detect_project_target first to pick the right one (vue3 = Element Plus, vue2 = Element UI, antdv = Ant Design Vue)."),
      mode: z
        .enum(["schema", "sfc"])
        .default("schema")
        .describe("Output mode: 'schema' for CrudPageSchema JSON + wrapper, 'sfc' for full Vue SFC"),
    },
    async ({ description, target, mode }) => {
      const t = (target ?? "vue3") as Target;
      const pkg = PKG[t];
      const modeInstruction =
        mode === "schema"
          ? `\n\nOutput as CrudPageSchema JSON + minimal wrapper SFC using <es-crud-page>. The schema should be pure JSON (no functions). Put event handlers in the wrapper SFC. Import es-plus symbols from '${pkg}'.`
          : `\n\nOutput as a complete Vue SFC with EsTable + EsForm. Include all configurations, imports, and event handlers inline. Import es-plus symbols from '${pkg}'.`;

      return {
        messages: [
          {
            role: "user",
            content: {
              type: "text",
              text: `${buildSystemPrompt(t)}\n\nPlease generate a CRUD page (target=${t}) based on this requirement:\n\n${description}${modeInstruction}\n\nProvide the complete code with proper imports, reactive state, and all configurations.`,
            },
          },
        ],
      };
    }
  );
}
