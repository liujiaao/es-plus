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

## Resources

The resource URIs use a target suffix:

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
