import type { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { z } from "zod";

import { DESIGN_EXTRACTION_URI } from "../resources/design-extraction.js";

type Target = "vue3" | "vue2" | "antdv";

const PKG: Record<Target, string> = {
  vue3: "@es-plus/vue3",
  vue2: "@es-plus/vue2",
  antdv: "@es-plus/adapter-antdv",
};

function buildInstruction(spec: string, target: Target, mode: "schema" | "sfc"): string {
  return `You are the host LLM for the es-plus MCP server. Your job is the FIRST MILE:
turn the specification below into the intent table that the \`generate_crud\`
front door consumes. Do NOT write Vue code yourself — the server routes and emits
deterministically from your \`surfaces\`.

STEP 0 — get the contract. Read the MCP resource \`${DESIGN_EXTRACTION_URI}\`
(surface decision table, output shape, positive/negative examples, checklist).
If you cannot read resources, use this summary: membership is expressed ONLY by
presence in \`surfaces.query\` / \`surfaces.table\` / \`surfaces.form\` /
\`surfaces.dialog\`; never emit \`inQuery\` / \`inTable\` / \`inForm\`; omit every
surface the spec does not imply; system-generated fields (id / createdAt /
updatedAt / 创建人) are never form fields.

STEP 1 — if the user attached a screenshot, wireframe or design file, YOU (the
host's vision model) must first transcribe it into the text inventory described
in §1 of the resource. The es-plus server does not accept images and performs no
OCR. Pass the transcription, not the image.

STEP 2 — call \`generate_crud\` (or emit its arguments as one JSON object) with:

{
  "name": "<PascalCase page name>",
  "apiUrl": "<REST base path, e.g. /api/users>",
  "target": "${target}",
  "mode": "${mode}",
  "surfaces": {
    "query":  [ { "prop": "...", "label": "...", "formtype": "..." } ],
    "table":  [ ... ],
    "form":   [ ... ],
    "dialog": [ "add", "edit" ]  // or full objects for custom dialogs
  }
}

Rules:
1. Use the spec's wording verbatim for \`label\`. Infer camelCase \`prop\` names.
2. Pick \`formtype\` by MEANING: status/enum → Select; date → DatePicker;
   number/money/count → InputNumber; on/off → Switch; image/file → Upload;
   long text → Input with attrs.type "textarea"; multi-choice → Checkbox.
3. Read-only wording ("只读", "仅展示", "不可编辑") removes \`form\` and every
   mutating dialog. Do not add surfaces the spec does not imply.
4. A custom dialog (named id/title or per-dialog fields) uses the full object
   \`{ "key", "title"?, "formItems"? }\`; canned keys stay as strings.
5. Omit keys the spec does not mention. Do not invent validation, options,
   permissions or API parameters.
6. Output ONLY the JSON object — no prose, no markdown fences.

Specification (target=${target}, mode=${mode}, package ${PKG[target]}):

${spec}`;
}

export function registerSpecToSurfacesPrompt(server: McpServer) {
  server.prompt(
    "spec-to-surfaces",
    "Turn a PRD / wireframe transcription into es-plus generate_crud surfaces (the first mile)",
    {
      spec: z
        .string()
        .describe(
          "The PRD text, user story, wireframe transcription, or field inventory. Images must be transcribed by the host first — the server does not accept images.",
        ),
      target: z
        .enum(["vue3", "vue2", "antdv"])
        .default("vue3")
        .describe("Renderer target, decided by the host (run detect_project_target)."),
      mode: z
        .enum(["schema", "sfc"])
        .default("schema")
        .describe("Output mode forwarded to generate_crud."),
    },
    async ({ spec, target, mode }) => {
      const t = (target ?? "vue3") as Target;
      const m = mode ?? "schema";
      return {
        messages: [
          {
            role: "user",
            content: {
              type: "text",
              text: buildInstruction(spec, t, m),
            },
          },
        ],
      };
    },
  );
}

export { buildInstruction as buildSpecToSurfacesInstruction };
