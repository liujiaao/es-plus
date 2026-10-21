import type { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";

/**
 * `esplus://design-extraction` — the "first mile" contract: turn a PRD / wireframe
 * description into the `generate_crud` intent table (`surfaces`).
 *
 * Why a resource instead of prose in a tool description: the host reads tool
 * descriptions on EVERY turn (they are part of the constrained-decoding schema),
 * while this contract is only relevant when the user hands over a spec. Keeping
 * it here means a host can fetch it once per session and keep the tool surface
 * small.
 *
 * ## Images are the HOST's job (explicit product boundary)
 *
 * The MCP server never receives an image. There is no image content block in any
 * tool input, and no OCR/vision step server-side. When the user attaches a
 * screenshot or a Figma export, the host's vision model must first turn it into
 * a TEXT inventory (regions → fields/labels/controls/buttons), then call
 * `generate_crud` with that inventory. This file spells out what that inventory
 * must contain so the extraction is reproducible across hosts.
 */

export const DESIGN_EXTRACTION_URI = "esplus://design-extraction";

export const DESIGN_EXTRACTION_CONTENT = `# From a PRD / wireframe to es-plus surfaces

This resource is the contract behind the \`spec-to-surfaces\` prompt and the
\`generate_crud\` front door. It answers ONE question: **which of the four
surfaces (query / table / form / dialog) does this specification imply, and
which fields belong to each?**

## 0. Where the input comes from (and where images are handled)

The server accepts TEXT only. It never receives screenshots, Figma files or
PDFs, and it performs no OCR.

* **Text PRD / user story / ticket** — pass it verbatim.
* **Wireframe / screenshot / design file** — the HOST's vision model must first
  transcribe it into the inventory in §1, then pass that text. A transcription
  that only says "a table with some columns" is not usable; name every region,
  every visible label, every control type and every button.
* **Existing code / ER diagram** — extract the field list and the operations, then
  follow the same procedure.

If a detail is not in the spec, do not invent it. Omission is a valid answer and
is scored as such.

## 1. Text inventory the host must produce from a picture

\`\`\`text
Page: <name>
Regions (top to bottom):
  - Filter bar: <label>: <control>; ...
  - Toolbar: <button label>; ...
  - Table columns: <label> (<data hint>); ...
  - Row actions: <button label>; ...
  - Dialogs/drawers: <title> — fields: <label>: <control>; ...
Notes: <"read-only", "no paging", "created by the system", ...>
\`\`\`

Anything the picture does not show (API URL, permission codes, validation rules)
stays absent — the host supplies those separately.

## 2. Output contract

Call \`generate_crud\` with:

\`\`\`json
{
  "name": "UserManage",
  "apiUrl": "/api/users",
  "target": "vue3",
  "surfaces": {
    "query":  [{ "prop": "userName", "label": "用户名", "formtype": "Input" }],
    "table":  [{ "prop": "userName", "label": "用户名", "formtype": "Input" }],
    "form":   [{ "prop": "userName", "label": "用户名", "formtype": "Input" }],
    "dialog": ["add", "edit"]
  }
}
\`\`\`

Rules:

1. **Membership is expressed by presence in a list.** Never emit
   \`inQuery\` / \`inTable\` / \`inForm\` — those flags belong to the composed
   config, not to the front door input.
2. Every field entry needs \`prop\` (camelCase), \`label\` (the user's wording) and
   \`formtype\` (pick by meaning, not by keyword).
3. \`dialog\` entries are either canned keys (\`"add"\`, \`"edit"\`, \`"view"\`) or a
   full object \`{ "key", "title"?, "width"?, "fullscreen"?, "formItems"? }\`.
   Use the object form only when the spec names a custom dialog id/title or a
   per-dialog field list.
4. A field may appear in several surfaces (a name is usually in query, table and
   form). That is normal; do not force a field into exactly one surface.
5. Do not add a surface that the spec does not imply. An empty list is an
   omission, not a hint.

## 3. Decision table

| Spec says | query | table | form | dialog |
|---|---|---|---|---|
| "列表 / 表格 / 台账" | maybe | **yes** | no | no |
| "筛选 / 搜索 / 查询条件" | **yes** | maybe | no | no |
| "新增 / 编辑 / 修改" | — | — | **yes** | \`add\` / \`edit\` |
| "查看 / 详情（只读）" | — | maybe | no | \`view\` |
| "只读 / 不可修改 / 仅展示" | maybe | **yes** | **no** | no |
| "导出 / 导入 / 批量操作" | — | — | — | not a surface: use \`tableBtns\` |
| "系统生成 / 自动写入 / 创建时间" | no | maybe | **no** | — |
| "仅有搜索框，没有结果列表" | **yes** | no | no | no |
| "只有一个新增表单" | no | no | **yes** | no |
| "只有一个弹窗" | no | no | no | **yes** |

Dialog defaults: with a table present, the dialog body defaults to the \`form\`
surface; with no table, it defaults to \`form\` (else \`query\`). Set
\`formItems\` only when a specific dialog differs.

## 4. Worked positives

### P1 — full CRUD list page
Spec: "用户管理。顶部可按用户名和状态筛选；列表展示用户名、邮箱、手机号、状态和创建时间；支持新增、编辑、删除、查看。"

\`\`\`json
{
  "surfaces": {
    "query":  [{ "prop": "userName", "label": "用户名", "formtype": "Input" },
               { "prop": "status", "label": "状态", "formtype": "Select" }],
    "table":  [{ "prop": "userName", "label": "用户名", "formtype": "Input" },
               { "prop": "email", "label": "邮箱", "formtype": "Input" },
               { "prop": "phone", "label": "手机号", "formtype": "Input" },
               { "prop": "status", "label": "状态", "formtype": "Select" },
               { "prop": "createdAt", "label": "创建时间", "formtype": "DatePicker" }],
    "form":   [{ "prop": "userName", "label": "用户名", "formtype": "Input" },
               { "prop": "email", "label": "邮箱", "formtype": "Input" },
               { "prop": "phone", "label": "手机号", "formtype": "Input" },
               { "prop": "status", "label": "状态", "formtype": "Select" }],
    "dialog": ["add", "edit", "view"]
  }
}
\`\`\`

Why: \`createdAt\` is system-generated → table only. \`status\` is an enum → Select.
"查看" adds the \`view\` dialog.

### P2 — read-only ledger
Spec: "订单台账。可按订单号、状态和下单时间筛选；表格展示订单号、客户、金额、状态、下单时间。页面只读，不提供新增和编辑。"

\`\`\`json
{
  "surfaces": {
    "query": [{ "prop": "orderNo", "label": "订单号", "formtype": "Input" },
              { "prop": "status", "label": "状态", "formtype": "Select" },
              { "prop": "orderedAt", "label": "下单时间", "formtype": "DatePicker" }],
    "table": [{ "prop": "orderNo", "label": "订单号", "formtype": "Input" },
              { "prop": "customer", "label": "客户", "formtype": "Input" },
              { "prop": "amount", "label": "金额", "formtype": "InputNumber" },
              { "prop": "status", "label": "状态", "formtype": "Select" },
              { "prop": "orderedAt", "label": "下单时间", "formtype": "DatePicker" }]
  }
}
\`\`\`

Why: "只读" explicitly removes \`form\` and every dialog. Do not add \`add\`/\`edit\`
just because a table page "usually" has them.

### P3 — no table, search form only
Spec: "提供一个独立查询表单，包含姓名、部门和入职日期，只有查询和重置按钮，没有结果列表。"

\`\`\`json
{
  "surfaces": {
    "query": [{ "prop": "name", "label": "姓名", "formtype": "Input" },
              { "prop": "dept", "label": "部门", "formtype": "Select" },
              { "prop": "hiredAt", "label": "入职日期", "formtype": "DatePicker" }]
  }
}
\`\`\`

Why: no table → the front door emits a standalone query fragment. Do not invent a
table to "complete" the page.

### P4 — custom dialog with per-dialog fields
Spec: "供应商列表展示供应商名称、联系人、电话。行操作有「加入黑名单」，弹窗标题「加入黑名单」，需要填写拉黑原因（多行文本）和生效日期。"

\`\`\`json
{
  "surfaces": {
    "table": [{ "prop": "supplierName", "label": "供应商名称", "formtype": "Input" },
              { "prop": "contact", "label": "联系人", "formtype": "Input" },
              { "prop": "phone", "label": "电话", "formtype": "Input" }],
    "dialog": [{ "key": "blacklist", "title": "加入黑名单",
                 "formItems": [{ "prop": "reason", "label": "拉黑原因", "formtype": "Input", "attrs": { "type": "textarea" } },
                               { "prop": "effectiveAt", "label": "生效日期", "formtype": "DatePicker" }] }]
  }
}
\`\`\`

Why: a custom key/title is a full object; \`formItems\` is set because this dialog's
body differs from the shared form. Multi-line text is Input + \`attrs.type: "textarea"\`.

## 5. Worked negatives (the mistakes that actually happen)

* **N1 — inventing a form on a read-only page.** "只读 / 仅展示 / 不可编辑" means no
  \`form\` and no mutating dialogs. If the page still has a \`view\` dialog, emit only
  that.
* **N2 — putting system fields into the form.** 创建时间 / 更新时间 / 创建人 /
  主键 id are server-generated: table (at most) only, never form.
* **N3 — using \`inQuery\` / \`inTable\` / \`inForm\`.** Those are not part of the
  front-door input. Any such key is rejected or silently dropped, and membership
  is then wrong.
* **N4 — adding a surface because the page type "usually" has one.** Do not add a
  query bar the spec does not mention, nor a table to a form-only spec.
* **N5 — all fields in every surface.** A "备注" written only in the edit dialog
  belongs to \`form\`, not to the table; an "操作人" column shown only in the list
  belongs to \`table\`, not to the query.
* **N6 — labels rewritten.** Use the spec's wording for \`label\` ("手机号", not
  "电话" if the spec says 手机号). The host and the reviewer compare labels.
* **N7 — every fieldtype defaulting to Input.** Status/enum → Select; date →
  DatePicker; number/money/count → InputNumber; on/off → Switch; image/file →
  Upload; multiple choice → Checkbox.

## 6. Checklist before calling the tool

1. Did I omit keys that are not in the spec, instead of filling defaults?
2. Does every listed surface have a sentence in the spec that implies it?
3. Is every system-generated field absent from \`form\`?
4. Are enum/date/number fields typed by meaning?
5. Are labels copied from the spec verbatim?
6. For a custom dialog, did I use the full object with \`key\` (and \`title\` /
   \`formItems\` when specified)?
7. If the input came from a picture, did the host transcribe every region and
   control first — and did I avoid claiming details the picture did not show?

## 7. What this contract does NOT do

* It does not choose \`target\` / \`mode\` — those are host inputs.
* It does not decide API URLs, permissions, validation rules or i18n keys unless
  the spec states them.
* It does not accept images. The host's vision model is the only image reader.
* It does not write code. It only produces the intent table; \`generate_crud\`
  performs the deterministic routing and emission.
`;

export function buildDesignExtractionContent(): string {
  return DESIGN_EXTRACTION_CONTENT;
}

export function registerDesignExtractionResource(server: McpServer) {
  server.resource(
    "design-extraction",
    DESIGN_EXTRACTION_URI,
    {
      description:
        "Contract for turning a text PRD / host-transcribed wireframe into es-plus `generate_crud` surfaces: input boundary (text only; images are read by the host), output shape, surface decision table, positive/negative examples, and a pre-call checklist.",
      mimeType: "text/markdown",
    },
    async () => ({
      contents: [
        {
          uri: DESIGN_EXTRACTION_URI,
          mimeType: "text/markdown",
          text: buildDesignExtractionContent(),
        },
      ],
    }),
  );
}
