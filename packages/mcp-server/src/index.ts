#!/usr/bin/env node
import { readFileSync } from "node:fs";
import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { StdioServerTransport } from "@modelcontextprotocol/sdk/server/stdio.js";
import { registerTools } from "./tools/index.js";
import { registerResources } from "./resources/index.js";
import { registerPrompts } from "./prompts/index.js";

const pkg = JSON.parse(readFileSync(new URL("../package.json", import.meta.url), "utf-8"));

// `instructions` is surfaced to the MCP client (Claude Code / Cursor / Continue)
// on initialize. Use it to teach the AI about the dual-renderer model so it
// stops defaulting every generation to vue3 when the user is in a vue2 codebase.
const INSTRUCTIONS = `# es-plus MCP server

This server exposes the same tool implementations that ship with @es-plus/cli,
giving you typed, schema-validated CRUD code generation for both Vue render
targets:

  - **@es-plus/vue3** (Vue 3 + Element Plus) — default
  - **@es-plus/vue2** (Vue 2 + Element UI)

## Always pick the right target

Every code-generating tool (generate_crud_page / generate_crud_schema /
generate_from_config / get_component_api) accepts a \`target: 'vue3' | 'vue2'\`
parameter. **Detect the target FIRST**, then call the generator:

1. Read the user's project \`package.json\` (use your file-read tool)
2. Call \`detect_project_target\` with the JSON content
3. Pass the returned \`target\` to every subsequent tool call

If you skip detection, you'll default to vue3 — which silently produces
\`<script setup>\` / \`v-model:*\` / Element Plus imports that won't compile in
a Vue 2 project.

## Resources

The resource URIs use a target suffix:

  - \`esplus://conventions\` (vue3 default) / \`esplus://conventions/vue2\`
  - \`esplus://examples\` (vue3 default) / \`esplus://examples/vue2\`
  - \`esplus://types\` (vue3 default) / \`esplus://types/vue2\`
  - \`esplus://crud-page-schema\` (vue3 default) / \`esplus://crud-page-schema/vue2\`

Fetch the vue2 variants when working in a Vue 2 codebase — the JSON config
shapes are identical, but syntax examples (defineComponent + setup, .sync,
element-ui imports) differ.

## Schema is portable

The defining feature of es-plus is that \`formItemList\`, \`columns\`,
\`options\`, and \`CrudPageSchema\` JSON are byte-identical between vue2 and
vue3. Only the wrapper SFC syntax changes. When refining an existing
schema across turns, you can keep the same JSON and just regenerate.
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
