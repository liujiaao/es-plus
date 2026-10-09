#!/usr/bin/env node
import { readFileSync } from "node:fs";
import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { StdioServerTransport } from "@modelcontextprotocol/sdk/server/stdio.js";
import { registerTools } from "./tools/index.js";
import { registerResources } from "./resources/index.js";
import { registerPrompts } from "./prompts/index.js";

const pkg = JSON.parse(readFileSync(new URL("../package.json", import.meta.url), "utf-8"));

// `instructions` is surfaced to the MCP client (Claude Code / Cursor / Continue)
// on initialize. Use it to teach the AI about the multi-renderer model so it
// stops defaulting every generation to vue3 when the user is in a vue2 / antdv codebase.
const INSTRUCTIONS = `# es-plus MCP server

This server exposes the same tool implementations that ship with @es-plus/cli,
giving you typed, schema-validated CRUD code generation for all three Vue render
targets:

  - **@es-plus/vue3** (Vue 3 + Element Plus) — default
  - **@es-plus/vue2** (Vue 2 + Element UI)
  - **@es-plus/adapter-antdv** (Vue 3 + Ant Design Vue)

## Always pick the right target

Every code-generating tool (generate_crud_page / generate_crud_schema /
generate_from_config / get_component_api) accepts a \`target: 'vue3' | 'vue2' | 'antdv'\`
parameter. **Detect the target FIRST**, then call the generator:

1. Read the user's project \`package.json\` (use your file-read tool)
2. Call \`detect_project_target\` with the JSON content
3. Pass the returned \`target\` to every subsequent tool call

If you skip detection, you'll default to vue3 — which silently produces
\`<script setup>\` / \`v-model:*\` / Element Plus imports that won't compile in
a Vue 2 project, or the wrong UI-library imports for an Ant Design Vue project.

Note: \`antdv\` uses Vue 3 syntax (identical to vue3); only the UI-library
symbols differ — \`message\` / \`Modal\` / \`Tag\` from ant-design-vue, and
\`<a-tag :color>\` instead of \`<el-tag :type>\`.

## Tool selection — ONE front door, then fill the intent table

Do NOT shop around the tool list. For almost every request, the entry point is
**\`generate_crud\`**, and your only real decision is filling its \`surfaces\`
intent table — which of **query / table / form / dialog** the request implies,
and the fields in each. Routing after that is deterministic code, not your
choice:

  - any **table** present → composed and compiled through the single
    golden-covered generator (one-shot compile guaranteed);
  - **no table** (standalone form, a search filter, an add/edit dialog on its
    own, form+dialog) → emitted as self-contained fragments.

So "which tool / how many tools" collapses to "set the surfaces that match the
request". Table-only, query+table, table+add/edit, full CRUD, dialog-only — all
are just different \`surfaces\` subsets of the SAME call.

Use a standalone tool ONLY for an explicit single-component ask, or to produce a
fragment you'll drop next to native / third-party components:

  - \`generate_form\`  — one \`<es-form>\` SFC (filter / settings / embedded form)
  - \`generate_table\` — one \`<es-table>\` SFC (list that sits beside other UI)
  - \`generate_dialog\`— one \`useXxxDialog()\` composable (reusable add/edit modal)

Never hand-assemble a CRUD page by calling several standalone tools — that
re-introduces the orchestration mistakes the front door exists to prevent. Fill
\`surfaces\` and let the routing compose them.

(\`generate_crud_from_config\` remains available if you want to hand-author a full
typed \`StructuredCrudConfig\` directly — \`generate_crud\` is a thinner intent
layer over the same deterministic generator. \`generate_crud_page\` uses a regex
NL parser and is only a no-LLM fallback for hosts that can't reason.)

## Mapping the surfaces (same reasoning as the config path)

**YOU do the reasoning** — read the natural-language request and fill each
surface's fields by understanding intent. This is real semantic mapping, not
keyword matching.

Two passes, every time:

1. **Read first**: \`esplus://examples/surfaces\` (few-shot NL→\`generate_crud\`
   surfaces across every subset — the front-door decision) and/or
   \`esplus://examples/nl-to-config\` (few-shot NL→full config with reasoning),
   plus \`esplus://conventions\` + \`esplus://types\` for the target.
2. **Draft** the surfaces: map each requested field by MEANING, not keywords —
   status/type/enum → Select (dataOptions, or apiParams for remote); date/time →
   DatePicker/TimePicker; image/file → Upload; on/off → Switch. Membership is
   implied by WHICH surface list a field appears in: a filter field goes in
   \`surfaces.query\`, a visible column in \`surfaces.table\`, a mutable add/edit
   field in \`surfaces.form\`. A field that appears in several surfaces is listed
   in each — the generator reconciles duplicates deterministically (identity
   first-wins, semantic from form, display from table). System columns: put in
   \`table\` but not \`form\`; detail-only: put in \`table\`/\`form\` but not
   \`query\`. (If you hand-author the full config instead, this is the
   \`inQuery\`/\`inTable\`/\`inForm\` partition.)
3. **Self-review** against the original request BEFORE calling:
   - Did every field the user named make it in, with the right \`formtype\`?
   - Is each field in the right surface list(s)? Did you set \`surfaces.dialog\`
     for every add/edit/view the request implies?
   - Are all requested actions present? Do Select/Cascader fields have options?
   - Business logic the schema can't express (permission gates, conditional
     display, computed values) → emit a typed extension point
     (\`permissionValue\` / \`formatter\` / \`render\`). **Mark it, never drop it.**
4. **Call** \`generate_crud\` (or \`generate_crud_from_config\`), then **read the
   returned warnings** — each one flags a likely mapping mistake; fix and
   regenerate.

## Resources

Steering few-shots (target-independent — read before generating):

  - \`esplus://examples/surfaces\` — NL → \`generate_crud\` surfaces, every subset (the front-door decision)
  - \`esplus://examples/nl-to-config\` — NL → full StructuredCrudConfig, with reasoning

The remaining resource URIs use a target suffix:

  - \`esplus://conventions\` (vue3 default) / \`esplus://conventions/vue2\` / \`esplus://conventions/antdv\`
  - \`esplus://examples\` (vue3 default) / \`esplus://examples/vue2\` / \`esplus://examples/antdv\`
  - \`esplus://types\` (vue3 default) / \`esplus://types/vue2\` / \`esplus://types/antdv\`
  - \`esplus://crud-page-schema\` (vue3 default) / \`esplus://crud-page-schema/vue2\` / \`esplus://crud-page-schema/antdv\`

Fetch the vue2 / antdv variants when working in those codebases — the JSON
config shapes are identical, but syntax examples (defineComponent + setup,
.sync, element-ui imports for vue2; ant-design-vue imports for antdv) differ.

## Schema is portable

The defining feature of es-plus is that \`formItemList\`, \`columns\`,
\`options\`, and \`CrudPageSchema\` JSON are byte-identical across vue2, vue3,
and antdv. Only the wrapper SFC syntax / UI-library symbols change. When
refining an existing schema across turns, you can keep the same JSON and just
regenerate.
`;

const server = new McpServer({
  name: "es-plus-mcp-server",
  version: pkg.version,
}, {
  instructions: INSTRUCTIONS,
});

registerTools(server);
registerResources(server);
registerPrompts(server);

const transport = new StdioServerTransport();
await server.connect(transport);
