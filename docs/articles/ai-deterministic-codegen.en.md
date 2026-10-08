# Stop letting AI wing your frontend: deterministic, reproducible CRUD codegen

> In one line: **let the LLM write only a config; hand "emit correct code" to a compiler.** The same config compiles deterministically to Vue 3 + Element Plus / Vue 2 + Element UI / Vue 3 + Ant Design Vue — byte-reproducible, guarded in CI.

## 1. The real problem with AI-generated frontend isn't "it can't write code"

In 2026, having an LLM write a CRUD page is nothing special. You hand Claude, Cursor, or v0 a requirement and it spits out a screen of runnable code.

What *is* special: **do you dare merge it as-is?**

Most people don't, because AI codegen runs on vibes:

- **Non-deterministic**: ask the same thing twice, get two different implementations. It runs today; regenerate tomorrow and it's a different structure.
- **Doesn't match your design system**: it writes the "average-internet" component it has in its head — not your `EsTable`, not your field-mapping conventions, not your permission directives.
- **Nothing validates it**: a typo in `prop`, a `formtype` that doesn't exist, a missing pagination handler — nothing catches it before merge.

So the typing time you saved gets paid back in **review → fix → review again**. The thrill of generation loses to the drag of inspection.

## 2. The counterintuitive split: LLM does semantics, compiler does determinism

The root cause is a **misplaced boundary**. The default is to let the LLM go end-to-end — from "understand the requirement" all the way to "emit final code." But those two jobs have opposite natures:

| | Who's good at it | What it needs |
|---|---|---|
| Turn fuzzy requirements into structured intent | **the LLM** | semantics, tolerance, filling gaps |
| Turn structured intent into correct code | **a compiler** | determinism, validation, reproducibility |

The LLM's non-determinism is a **feature**, not a bug — you *want* that flexibility on the "understand human language" end. But you should **not let that flexibility leak into the "emit code" end**.

ES-Plus draws that line cleanly:

> **The LLM emits a single JSON config; the library validates it and deterministically compiles it to three renderers.**

The LLM never touches a single character of the final code. Its output is a **declarative config** — and config can be schema-validated and deterministically compiled. Non-determinism stays boxed in the "understand the requirement" cell.

## 3. How it works (every claim is verifiable, not asserted)

### 1. MCP hands the schema & conventions to the host LLM

ES-Plus ships an MCP Server. Wire it into Claude Code / Cursor and the host LLM gets ES-Plus's config schema, field conventions, and golden examples. You say "an order-management page with status filtering and bulk delete," and the LLM emits not a `.vue` file but a structured config:

```jsonc
{
  "mode": "crud-page",
  "fields": [
    { "prop": "orderNo", "label": "Order No.", "formtype": "Input" },
    { "prop": "status", "label": "Status", "formtype": "Select",
      "dataOptions": [{ "label": "Unpaid", "value": 0 }, { "label": "Done", "value": 1 }] }
  ],
  "tableBtns": [{ "name": "Bulk delete", "type": "danger" }]
}
```

### 2. The library validates before compiling — bad config never reaches output

That config first passes zod + JSON Schema validation. Illegal things get rejected **before compilation**, instead of compiling into a buggy page you discover in production:

- `formtype` must be one of 14 legal controls (`Input`/`Select`/`DatePicker`/…). The LLM hallucinates a `"dropdown"`? Rejected.
- `prop` may not contain path separators and may not be `__proto__`/`constructor`/`prototype` — it becomes a member name and core slot name in the generated file, so anything with injection characters is rejected.
- Missing required fields (a table column with no `prop`, a dialog with no `title`) errors out with detail.

### 3. Deterministic compilation — the same config, byte-identical code across three renderers

Once validated, `generateFromConfig` compiles the config into three codebases. The key word is **deterministic**: the same config, run any number of times, on anyone's machine, produces **byte-identical** output.

This isn't a slogan — it's held down by a reverse probe: even if someone slips in an injection payload like `width: "20' + (1) + '"`, the compiler only ever escapes it as a string; the output will **not** contain an executable injection. The `check:generator-escaping` guard proves exactly this in CI every day with malicious config.

### 4. Backed by guards — verifiability is enforced, not claimed

Other libraries saying "we're reliable" is a slide deck. ES-Plus's reliability is **assertions running in CI every day**:

- **25 golden cases** × multiple determinism invariants, each including **real esbuild parsing** — the output isn't "looks like code," it's "code that actually parses to an AST."
- **32 consistency guards** chained together: isomorphic type exports across the three renderers, single-source schema, contract consumption, cross-renderer render parity… if any one renderer quietly diverges, CI goes red on the spot.

That's the biggest difference between ES-Plus and "yet another AI codegen toy": **it turns "the generated output is trustworthy" into an executable, reproducible, continuously-verified engineering contract.**

## 4. Demo

> 📺 _(60-second demo slot: say "build an order-management CRUD" in Claude Code, MCP emits the config, and all three renderers spin up and link live. GIF TBD.)_

## 5. Honest boundaries

Not overselling — which makes it more credible:

- **It's not "generate any UI."** It focuses on the CRUD full chain — form query, table display, dialog editing. A marketing landing page or a data dashboard is not its scene.
- **Non-standard needs have an escape hatch.** Where config can't reach, the `render` field lets you write native JSX/template, unconstrained by the declarative framing.
- **Three-renderer consistency ≠ pixel-identical.** Element and Ant Design are different design languages; ES-Plus guarantees **consistent behavior and structure**, not making Ant's button look like Element's.

## 6. Three steps to start

```bash
# 1. Install a renderer (Vue 3 + Element Plus here)
npm install @es-plus/vue3 element-plus @element-plus/icons-vue

# 2. Wire up the MCP Server (add @es-plus/mcp-server to your Claude Code / Cursor MCP config)

# 3. Tell the AI: "build an order-management CRUD page with es-plus"
```

- Docs & Playground: https://liujiaao.github.io/es-plus/
- AI CRUD generator (try online): https://liujiaao.github.io/es-plus/#/ai-crud
- Source: https://github.com/liujiaao/es-plus

If you've been burned by "AI-generated frontend you can't merge," drop a star on the repo or open an issue to talk through your use case.
