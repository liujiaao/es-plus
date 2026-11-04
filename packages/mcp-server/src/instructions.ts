import type { ToolProfile } from "./profile.js";

/**
 * 服务器 `instructions`（initialize 时交给宿主）。
 *
 * 抽成纯函数而不是 `index.ts` 里的常量：`index.ts` 在 import 时就起 transport，
 * 测不了；而这段文字的**正确性**恰恰需要被钉住 —— `front-door` 档下三个工具不注册
 * （见 `src/profile.ts`），若正文仍写「generate_crud_from_config remains available」，
 * 宿主读到的就是一句假话，随后调用只会拿到 tool not found。两种档位的正文共用这一段
 * 模板，差异只在三处指代上，避免复制整段导致再次漂移。
 */
export function buildInstructions(profile: ToolProfile = "full"): string {
  const fd = profile === "front-door";

  // ① 工具清单：只列**已注册**的生成入口。
  const codeGenTools = fd
    ? "generate_scene / generate_composition / generate_crud /\ngenerate_form / generate_table / generate_dialog /\nscaffold_page / get_component_api"
    : "generate_scene / generate_composition / generate_crud /\ngenerate_crud_from_config / generate_form / generate_table /\ngenerate_dialog / generate_crud_page / generate_crud_schema /\nscaffold_page / get_component_api";

  // ② 「高级路径仍可用」那一段：front-door 档下必须换成事实陈述。
  const advancedNote = fd
    ? `(\`generate_scene\` is the front door in this profile: pick \`scene\` ('crud' /
'table' / 'form' / 'dialog') and fill that scene's \`intent\`. For a plain page
\`scene: 'crud'\` composes a typed \`StructuredCrudConfig\` and runs the same
deterministic generator; \`generate_crud\` takes that same intent table under a
compatibility name and produces identical bytes. \`generate_composition\` puts
1–3 standalone fragments on one page. \`validate_config\` and \`refine_config\`
still accept a config you hand-author — they just don't emit code.)`
    : `(\`generate_crud_from_config\` remains available if you want to hand-author a full
typed \`StructuredCrudConfig\` directly — \`generate_scene\` (scene='crud') and
\`generate_crud\` are thinner intent layers over the same deterministic
generator. \`generate_crud_page\` uses a regex NL parser and is only a no-LLM
fallback for hosts that can't reason.)`;

  // ③ 第四步的调用指代（注意结尾不带 `**`：模板里统一收口，否则会出现 `****`）。
  const step4Call = fd
    ? "4. **Call** `generate_scene` (scene='crud'), then **read the\n   returned warnings"
    : "4. **Call** `generate_scene` (scene='crud') or its compatibility alias\n   `generate_crud`/`generate_crud_from_config`, then **read the\n   returned warnings";

  // ④ 档位说明：只在 front-door 追加（回答「为什么工具表里少三个」）。
  const profileNote = fd
    ? `
## Tool profile (front-door)

This server runs with \`ESPLUS_MCP_PROFILE=front-door\`: \`generate_crud_from_config\`
(advanced, hand-authored config) and \`generate_crud_page\` / \`generate_crud_schema\`
(legacy regex fallbacks) are NOT registered. Use \`generate_scene\` for every
request — \`scene: 'crud'\` for list/table pages, \`table\` / \`form\` / \`dialog\` for
an explicit single component; \`generate_composition\` assembles several of those
fragments into one page; \`generate_crud\` is the same route under a compatibility
name (identical bytes). Restart the server without
\`ESPLUS_MCP_PROFILE\` (or set it to \`full\`) to expose the advanced/legacy tools.
`
    : "";

  return `# es-plus MCP server

This server exposes the same tool implementations that ship with @es-plus/cli,
giving you typed, schema-validated CRUD code generation for all three Vue render
targets:

  - **@es-plus/vue3** (Vue 3 + Element Plus) — default
  - **@es-plus/vue2** (Vue 2 + Element UI)
  - **@es-plus/adapter-antdv** (Vue 3 + Ant Design Vue)

## Always pick the right target

Every code-generating tool (${codeGenTools}) accepts a \`target: 'vue3' | 'vue2' | 'antdv'\`
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
**\`generate_scene\`**, and your only real decision is \`scene\` plus filling that
scene's intent table — for a page, \`scene: 'crud'\` and which of **query / table /
form / dialog** the request implies, and the fields in each. Routing after that
is deterministic code, not your choice:

  - any **table** present → composed and compiled through the single
    golden-covered generator (one-shot compile guaranteed);
  - **no table** (standalone form, a search filter, an add/edit dialog on its
    own, form+dialog) → emitted as self-contained fragments.

So "which tool / how many tools" collapses to "set the surfaces that match the
request". Table-only, query+table, table+add/edit, full CRUD, dialog-only — all
are just different \`surfaces\` subsets of the SAME \`{ scene: 'crud', intent }\`
call. **\`generate_crud\` is the same route under a compatibility name** (identical
bytes) — use it only if a host prompt already names it.

Use a standalone tool ONLY for an explicit single-component ask, or to produce a
fragment you'll drop next to native / third-party components:

  - \`generate_form\`  — one \`<es-form>\` SFC (filter / settings / embedded form)
  - \`generate_table\` — one \`<es-table>\` SFC (list that sits beside other UI)
  - \`generate_dialog\`— one \`useXxxDialog()\` composable (reusable add/edit modal)

When several of those pieces must live TOGETHER in one page (but the request is
not a CRUD page), use **\`generate_composition\`** — it wires row actions to
dialogs, query/reset to the table, and dialog success to a table refresh.

Never hand-assemble a CRUD page by calling several standalone tools — that
re-introduces the orchestration mistakes the front door exists to prevent. Fill
\`surfaces\` and let the routing compose them.

${advancedNote}

## Mapping the surfaces (same reasoning as the config path)

**YOU do the reasoning** — read the natural-language request and fill each
surface's fields by understanding intent. This is real semantic mapping, not
keyword matching.

Two passes, every time:

1. **Read first**: \`esplus://examples/surfaces\` (few-shot NL→\`generate_scene\`
   (scene='crud') surfaces across every subset — the front-door decision) and/or
   \`esplus://examples/nl-to-config\` (few-shot NL→full config with reasoning),
   plus \`esplus://conventions\` + \`esplus://types\` for the target.
2. **Draft** the surfaces: map each requested field by MEANING, not keywords —
   status/type/enum → Select (dataOptions, or apiParams for remote); date/time →
   DatePicker/TimePicker; image/file → Upload; on/off → Switch; any numeric
   value (amount / price / quantity / stock / count / money / integer) →
   InputNumber. Membership is
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
     for every add/edit/view the request implies? (A dialog entry is a canned
     key \`add\`/\`edit\`/\`view\`, or a full object \`{ key, title?, width?,
     fullscreen?, formItems? }\` when the request names a custom dialog id /
     title / width or a per-dialog field list.)
   - Are all requested actions present? Do Select/Cascader fields have options?
   - Business logic the schema can't express (permission gates, conditional
     display, computed values) → emit a typed extension point
     (\`permissionValue\` / \`formatter\` / \`render\`). **Mark it, never drop it.**
${step4Call}** — each one flags a likely mapping mistake; fix and
   regenerate.
5. **Read the \`preflight\` section** at the end of the result. It lists the HOST
   prerequisites (\`app.use(ESPlus, { httpRequest, permission, t })\`, the UI
   library, and — for mode=sfc dialogs — the JSX plugin) with a copy-once entry
   boilerplate. These do not break compilation; the matching capability silently
   turns inert, and a missing \`permission\` fails OPEN. When the host already has
   an entry, pass it to \`doctor_page\` and act on every \`missing\` line.

## Resources

Steering few-shots (target-independent — read before generating):

  - \`esplus://examples/surfaces\` — NL → \`generate_scene\` (scene='crud') surfaces, every subset (the front-door decision)
  - \`esplus://examples/nl-to-config\` — NL → full StructuredCrudConfig, with reasoning
  - \`esplus://capabilities\` — scene capability ledger (\`es-plus.capabilities@1\`): accepted/required intent keys per scene, CRUD key dispositions per mode (downgrade + reason), target × key matrix. Read it before composing an intent to know which keys actually land in the artifact.

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
${profileNote}`;
}
