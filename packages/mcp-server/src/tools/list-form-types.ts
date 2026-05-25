import type { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { FORM_TYPES } from "@es-plus/shared";

export function registerListFormTypes(server: McpServer) {
  server.tool(
    "list_form_types",
    "List all 13 available form field types (formtype) in es-plus-ui with descriptions and usage examples.",
    {},
    async () => {
      const lines = FORM_TYPES.map(
        (ft, i) =>
          `${i + 1}. **${ft.type}** — ${ft.description}\n   Example: ${ft.example}`
      );

      const output = [
        "# es-plus-ui Form Types (formtype)\n",
        "Available types for the `formtype` property in `FormItemOption`:\n",
        ...lines,
        "",
        "---",
        "Usage in config:",
        "```json",
        '{ "prop": "status", "label": "状态", "formtype": "Select", "dataOptions": [...] }',
        "```",
      ].join("\n");

      return {
        content: [{ type: "text", text: output }],
      };
    }
  );
}
