---
title: 'MCP Server'
route: '/guide/mcp-server'
canonical: 'https://liujiaao.github.io/es-plus/guide/mcp-server/'
source: 'es-plus-docs/src/docs/mcp-server.en.md'
type: 'guide'
---
# @es-plus/mcp-server

`@es-plus/mcp-server` is the official ES-Plus MCP (Model Context Protocol) server. Drop one config block into your AI coding tool and it gains accurate, schema-driven generation of `@es-plus/vue3` CRUD pages.

## What is MCP?

MCP is Anthropic's open protocol for connecting AI assistants to external tools and data sources. Servers expose:

- **Tools** — actions like generating code or validating config
- **Resources** — context like schema definitions and type docs
- **Prompts** — structured system prompts

ES-Plus's MCP server surfaces the component library's capabilities so the AI can write **correct** config-driven code instead of hallucinating prop names.

## Client Compatibility Matrix

| Client | MCP Support | Recommended Config Location |
|---|---|---|
| **Claude Code (CLI)** | ✅ Official | `~/.claude.json` or project-root `.mcp.json` |
| **Claude Desktop** | ✅ Official | `claude_desktop_config.json` |
| **Cursor** | ✅ Official | `.cursor/mcp.json` |
| **Windsurf** | ✅ Official | `~/.codeium/windsurf/mcp_config.json` |
| **VS Code (GitHub Copilot)** | ✅ Insiders channel | `.vscode/mcp.json` |
| **Continue** | ✅ 0.9+ | `~/.continue/config.json` |
| **Cline / Roo Code** | ✅ Supported | In-client GUI |
| **Claude Web (claude.ai)** | ❌ No MCP client yet | — |
| **GitHub Copilot Chat (Stable)** | ❌ Insiders only | — |
| **OpenAI Codex / Codex CLI** | ❌ **Does not support MCP** | — |
| **Cody** | ⚠️ Older versions don't support; newer untested | — |

::: warning
"Failed to connect" issues on Codex / Claude Web / Copilot Stable are **not bugs in this package** — those clients don't have MCP client implementations at all. Make sure your client is on a ✅ row above.
:::

## Configuration (most stable first)

### Method A — Global install + direct command (**strongly recommended**)

```bash
npm i -g @es-plus/mcp-server
```

Then point your client at the installed binary:

```json
{
  "mcpServers": {
    "es-plus": {
      "command": "mcp-server-es-plus",
      "args": []
    }
  }
}
```

**Why this is recommended**: process startup < 200ms, no `npx` network/cache resolution, **avoids the 10-30s connection timeout most MCP clients impose**.

To upgrade: `npm update -g @es-plus/mcp-server`.

### Method B — npx (no preinstall, but slow first launch)

```json
{
  "mcpServers": {
    "es-plus": {
      "command": "npx",
      "args": ["-y", "@es-plus/mcp-server"]
    }
  }
}
```

::: warning Critical note
**The first `npx -y` run downloads this package and its deps from npm — 30-90 seconds on slow networks**. Most MCP clients have a 10-30s connection timeout, so you'll see "connection failed" — this is **not a configuration error, it's npx still downloading**. Subsequent launches are fast (cache hit).

Mainland China users: `npm config set registry https://registry.npmmirror.com/` for faster downloads.
:::

### Method C — Local path (contributors / self-hosted)

```bash
git clone https://github.com/liujiaao/es-plus.git
cd es-plus/packages/mcp-server
npm install
npm run build
```

```json
{
  "mcpServers": {
    "es-plus": {
      "command": "node",
      "args": ["/abs/path/to/es-plus/packages/mcp-server/build/index.js"]
    }
  }
}
```

## Per-client setup examples

::: tip
All examples below use **Method A**. To use npx instead, swap `"command": "mcp-server-es-plus"` with `"command": "npx"` and `"args": []` with `"args": ["-y", "@es-plus/mcp-server"]`.
:::

### Claude Code (CLI)

```bash
claude mcp add es-plus -- mcp-server-es-plus
```

Or in project-root `.mcp.json`:

```json
{
  "mcpServers": {
    "es-plus": { "command": "mcp-server-es-plus", "args": [] }
  }
}
```

### Cursor

`.cursor/mcp.json`:

```json
{
  "mcpServers": {
    "es-plus": { "command": "mcp-server-es-plus", "args": [] }
  }
}
```

### Windsurf

`~/.codeium/windsurf/mcp_config.json`:

```json
{
  "mcpServers": {
    "es-plus": { "command": "mcp-server-es-plus", "args": [] }
  }
}
```

### VS Code (GitHub Copilot Insiders)

`.vscode/mcp.json`:

```json
{
  "servers": {
    "es-plus": { "command": "mcp-server-es-plus", "args": [] }
  }
}
```

### Continue

In `~/.continue/config.json`, add to `experimental.modelContextProtocolServers`:

```json
{
  "experimental": {
    "modelContextProtocolServers": [
      { "transport": { "type": "stdio", "command": "mcp-server-es-plus", "args": [] } }
    ]
  }
}
```

### Claude Desktop

`claude_desktop_config.json`:

```json
{
  "mcpServers": {
    "es-plus": { "command": "mcp-server-es-plus", "args": [] }
  }
}
```

> **Prerequisites**: Node.js >= 18; project has `@es-plus/vue3` + `element-plus` (Vue 3) or `@es-plus/vue2` + `element-ui` (Vue 2) installed.

## Troubleshooting

Ordered by frequency. **90% of "startup failed" reports are #1 or #2.**

### 1. Client reports "connection failed / timeout"

**Cause**: Method B (`npx -y`) — first run downloads from npm, 30-90s on slow network, exceeds the client's 10-30s connection timeout.

**Fix**:
- Switch to **Method A** (global install) — process starts in < 200ms, no npx involved
- If you must use npx, run `npx -y @es-plus/mcp-server --version` once in a terminal first to warm the cache, then start the client
- Mainland China: `npm config set registry https://registry.npmmirror.com/`

### 2. Windows: npx not found / spawn error

**Cause**:
- npm global bin not in PATH
- User home contains non-ASCII chars or spaces (e.g. `C:\Users\张三`), npx cache write fails
- PowerShell vs CMD vs Git Bash PATH differences

**Fix**:
- Prefer Method A: after install, run `mcp-server-es-plus --version` in a terminal — if it prints, your PATH is fine
- Add `npm config get prefix` to `%PATH%`
- Non-ASCII home: use Method C (local path) with absolute paths

### 3. Connection drops immediately / "Unexpected token" / JSON parse error

**Cause**: MCP uses stdio for protocol; **anything written to stdout is parsed as a protocol message**. A stray `console.log` corrupts the stream → client disconnects.

**Fix**: this package routes all logging to `process.stderr`. If you still see this, it's likely a Node version issue (next item) or an npm warning leaking to stdout.

### 4. "SyntaxError: Unexpected token '??=' / private field"

**Cause**: Node < 18. This package uses Node 18+ syntax.

```bash
node --version    # must be >= 18.0.0
```

Use [nvm](https://github.com/nvm-sh/nvm) to switch to Node 20 LTS.

### 5. Tool returns wrong schema type / protocol version mismatch

**Cause**: MCP SDK version mismatch with older clients. This package uses `@modelcontextprotocol/sdk@^1.0.0` and requires clients on SDK 1.x. Continue 0.8.x and Cursor before 0.40 have known compatibility issues.

**Fix**: upgrade your AI client to the latest version.

### 6. Many clients connecting at once → frequent restarts

**Cause**: each client spawns its own stdio child process. This is the MCP protocol's intended design but consumes resources. HTTP transport is not yet offered — file an issue if you need it.

### 7. `detect_project_target` returns errors

**Cause**: the client didn't pass your `package.json` content to the tool.

**Fix**: include "my package.json contents are: ..." in the prompt, or have the AI read project files before calling the tool.

### Self-check commands (v1.2.2+)

```bash
mcp-server-es-plus --version
mcp-server-es-plus --help
```

## What You Get

Once configured, ask the AI things like:

- *"Generate a CRUD page for managing products with name, category, price and stock columns."*
- *"Add a status filter (enum: active/archived) to the search form."*
- *"Make the price column right-aligned and format as currency."*

The AI calls the MCP server's `generate_crud` front door (or a standalone fragment tool) and returns valid `@es-plus/vue3` JSON config — including `httpRequest`, `dataOptions`, `triggerEvent` flags, and dialog handlers.

## Tools Exposed by the Server

The default `full` profile exposes **15 tools**. With `ESPLUS_MCP_PROFILE=front-door`, three are hidden (one advanced + two legacy parsers) and only the front door, the single-surface fragments, and the deterministic support tools remain.

| Tool | Purpose | front-door |
|------|---------|:----------:|
| `generate_crud` | **FRONT DOOR** — fill the `surfaces` intent table (query/table/form/dialog); routing and compilation are deterministic. Use this for natural-language requests. | ✅ |
| `generate_form` | **Fragment** — a self-contained `<es-form>` SFC (own model + `formItemList`) | ✅ |
| `generate_table` | **Fragment** — a self-contained `<es-table>` SFC (columns, options, data source, pagination) | ✅ |
| `generate_dialog` | **Fragment** — a reusable `useXxxDialog()` composable (default) or a self-contained `<es-dialog>` SFC | ✅ |
| `detect_project_target` | Read the host `package.json` and pick `vue3` / `vue2` / `antdv` — **run this before any `generate_*`** | ✅ |
| `validate_config` | Validate a config against the live schema (judge-only; it does not rewrite) | ✅ |
| `ingest_schema` | Draft a config from OpenAPI / JSON Schema / sample JSON / TS interface / SQL DDL (deterministic, a head start you then edit) | ✅ |
| `refine_config` | One round of refinement on a pinned config: validate `revised` + return a structured diff | ✅ |
| `list_form_types` | List the 14 shared `formtype` values and their renderers | ✅ |
| `get_component_api` | Component API and type docs | ✅ |
| `scaffold_page` | Minimal page scaffold | ✅ |
| `doctor_page` | Static-check the host entry against the es-plus preflight checklist (ok / missing / unverified) | ✅ |
| `generate_crud_from_config` | **ADVANCED** — generate from a STRUCTURED, typed config you already hold (persisted, diffed, or refined). Same deterministic generator as the front door. | ⛔ |
| `generate_crud_page` | **LEGACY FALLBACK** (no-LLM) — build a CRUD page from natural-language intent via a regex/keyword parser; accuracy is bounded by keyword coverage. | ⛔ |
| `generate_crud_schema` | **LEGACY FALLBACK** (no-LLM) — `CrudPageSchema` JSON + wrapper SFC from the same regex parser. | ⛔ |

The profile only changes which tools are *listed* — the hidden three share the same deterministic generator as `generate_crud`. Prompts, resources and tool descriptions are adapted from the same profile, so the host is never told to call a tool that isn't registered.

## Resources Exposed by the Server

Eight resource families (target-specific variants for `vue3` / `vue2` / `antdv` where noted):

- `esplus://conventions` — generation rules (formtype, button keys, multi-dialog mode, `configureEsPlus`); `/vue3`, `/vue2`, `/antdv`
- `esplus://crud-page-schema` — `EsCrudPage` schema and usage examples; `/vue3`, `/vue2`, `/antdv`
- `esplus://schemas/{form-item,table-column,table-options,dialog-options,btn-config,api-params}` — JSON Schema per config shape
- `esplus://types` — TypeScript type definitions extracted from the renderers; `/vue3`, `/vue2`, `/antdv`
- `esplus://examples` — 8 preset CRUD page examples with full code; `/vue3`, `/vue2`, `/antdv`
- `esplus://examples/nl-to-config` — few-shot pairs for natural language → `StructuredCrudConfig`
- `esplus://examples/surfaces` — few-shot for the `surfaces` intent table
- `esplus://design-extraction` — how to transcribe a mockup (images must be transcribed by the host first)

## Prompts Exposed by the Server

| Prompt | Parameters | Purpose |
|--------|------------|---------|
| `crud-page` | `description`, `target?`, `mode?` | Full CRUD page system prompt with es-plus best practices |
| `form-config` | `description`, `target?` | Generate only a `formItemList` JSON array |
| `spec-to-surfaces` | `spec`, `target?`, `mode?` | Turn a PRD / user story / wireframe transcription into `generate_crud` `surfaces` (the first mile) |

## Local Development

If you cloned the repo, point the AI tool at your local build:

```json
{
  "mcpServers": {
    "es-plus": {
      "command": "node",
      "args": ["/absolute/path/to/es-plus/packages/mcp-server/dist/index.js"]
    }
  }
}
```

## Why It Matters

LLMs are good at code, less good at prop name memorization. The MCP server pins generation to the same JSON Schema the runtime validates against — so every output is guaranteed to deserialize and render. No more `formtype: "input"` (lowercase) bugs or invented props.

## Next Steps

- [Getting Started](/guide/getting-started)
- [IDE Schema Setup](/guide/schema-setup) — same schemas, IDE-only setup
- [CLI Tool](/guide/cli) — non-AI scaffolding flow
