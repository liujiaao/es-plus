# @es-plus/vue3 JSON Schema

JSON Schema definitions for `@es-plus/vue3` configuration objects. Enables IDE autocompletion, validation, and hover documentation when writing `@es-plus/vue3` configs. The same schemas describe `@es-plus/vue2` configs (renderers share identical config shape).

## Usage in VS Code

### Method 1: Per-file `$schema` (for JSON config files)

```json
{
  "$schema": "node_modules/@es-plus/vue3/schemas/form-item.schema.json",
  "prop": "name",
  "label": "Name",
  "formtype": "Input"
}
```

### Method 2: VS Code settings (for `.json` files matching a pattern)

Add to `.vscode/settings.json`:

```json
{
  "json.schemas": [
    {
      "fileMatch": ["**/form-items.json", "**/formItems.json"],
      "url": "./node_modules/@es-plus/vue3/schemas/form-item.schema.json"
    },
    {
      "fileMatch": ["**/table-columns.json", "**/columns.json"],
      "url": "./node_modules/@es-plus/vue3/schemas/table-column.schema.json"
    },
    {
      "fileMatch": ["**/table-options.json"],
      "url": "./node_modules/@es-plus/vue3/schemas/table-options.schema.json"
    }
  ]
}
```

### Method 3: Use with AI coding assistants

When using Cursor, Claude Code, or GitHub Copilot, include the schema in your prompt context:

```
Use the @es-plus/vue3 JSON Schema at node_modules/@es-plus/vue3/schemas/index.schema.json
to generate valid configuration for my CRUD page.
```

## Available Schemas

| Schema | Description |
|--------|-------------|
| `form-item.schema.json` | Single form field config (FormItemOption) |
| `table-column.schema.json` | Single table column config (TableColumn) |
| `table-options.schema.json` | Table options config (TableOptions) |
| `btn-config.schema.json` | Button config (BtnConfig) |
| `dialog-options.schema.json` | Dialog options for useDialog() |
| `api-params.schema.json` | API request parameters |
| `index.schema.json` | Root schema with all definitions |

## Schema Structure

```
index.schema.json
├── form-item.schema.json
│   └── api-params.schema.json
├── table-column.schema.json
├── table-options.schema.json
│   ├── api-params.schema.json
│   └── btn-config.schema.json
├── btn-config.schema.json
└── dialog-options.schema.json
    └── btn-config.schema.json
```

## Vue 2 users

`@es-plus/vue2` ships the same schema files at `node_modules/@es-plus/vue2/schemas/...`. Substitute the package name in the paths above. Configs validated against either set are runtime-compatible with both renderers.

## Legacy users (`es-plus-ui`)

If you still depend on the deprecated `es-plus-ui` stub package, the old paths `node_modules/es-plus-ui/schemas/...` no longer exist (the stub does not re-export schemas). Migrate the import path to `@es-plus/vue3` per the [v1.4 migration guide](https://github.com/liujiaao/es-plus/blob/master/docs/migrate-v1.4.md).
