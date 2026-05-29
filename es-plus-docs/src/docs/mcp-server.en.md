# @es-plus/mcp-server

`@es-plus/mcp-server` is the official ES-Plus MCP (Model Context Protocol) server. Drop one config block into your AI coding tool and it gains accurate, schema-driven generation of `@es-plus/vue3` CRUD pages.

## What is MCP?

MCP is Anthropic's open protocol for connecting AI assistants to external tools and data sources. Servers expose:

- **Tools** — actions like generating code or validating config
- **Resources** — context like schema definitions and type docs
- **Prompts** — structured system prompts

ES-Plus's MCP server surfaces the component library's capabilities so the AI can write **correct** config-driven code instead of hallucinating prop names.

## Supported AI Tools

| Tool | Status | Config |
|------|--------|--------|
| Claude Code (CLI / Desktop / Web) | ✅ Full support | `.claude/settings.json` |
| Cursor | ✅ Full support | `.cursor/mcp.json` |
| Continue | ✅ Full support | `~/.continue/config.json` |
| Windsurf | ✅ Full support | MCP config file |
| VS Code + Copilot Chat | 🔜 Coming | - |

## Quick Setup

### Claude Code

Create or edit `.claude/settings.json` in your project root:

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

### Cursor

Create or edit `.cursor/mcp.json`:

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

### Continue

Add to the `mcpServers` array in `~/.continue/config.json`:

```json
{
  "mcpServers": [
    {
      "name": "es-plus",
      "command": "npx",
      "args": ["-y", "@es-plus/mcp-server"]
    }
  ]
}
```

## What You Get

Once configured, ask the AI things like:

- *"Generate a CRUD page for managing products with name, category, price and stock columns."*
- *"Add a status filter (enum: active/archived) to the search form."*
- *"Make the price column right-aligned and format as currency."*

The AI calls the MCP server's `generate_crud_page` / `generate_form` / `validate_schema` tools and returns valid `@es-plus/vue3` JSON config — including `httpRequest`, `dataOptions`, `triggerEvent` flags, and dialog handlers.

## Tools Exposed by the Server

| Tool | Purpose |
|------|---------|
| `generate_crud_page` | Build a complete `EsCrudPage` schema from natural-language intent |
| `generate_form` | Build an `EsForm` `formItemList` array |
| `generate_table` | Build an `EsTable` `columns` array |
| `validate_schema` | Validate a config object against the live JSON Schema |
| `list_examples` | Return curated `EsForm` / `EsTable` / `EsCrudPage` snippets |

## Resources Exposed by the Server

- `schema://es-form` — JSON Schema for `formItemList` items
- `schema://es-table` — JSON Schema for `columns` and `options`
- `schema://es-crud-page` — JSON Schema for full CRUD pages
- `types://es-plus` — TypeScript types extracted from `packages/es-plus/src/types`

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
