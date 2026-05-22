# ES-Plus UI JSON Schema

JSON Schema definitions for es-plus-ui configuration objects. Enables IDE autocompletion, validation, and hover documentation when writing es-plus-ui configs.

## Usage in VS Code

### Method 1: Per-file `$schema` (for JSON config files)

```json
{
  "$schema": "node_modules/es-plus-ui/schemas/form-item.schema.json",
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
      "url": "./node_modules/es-plus-ui/schemas/form-item.schema.json"
    },
    {
      "fileMatch": ["**/table-columns.json", "**/columns.json"],
      "url": "./node_modules/es-plus-ui/schemas/table-column.schema.json"
    },
    {
      "fileMatch": ["**/table-options.json"],
      "url": "./node_modules/es-plus-ui/schemas/table-options.schema.json"
    }
  ]
}
```

### Method 3: Use with AI coding assistants

When using Cursor, Claude Code, or GitHub Copilot, include the schema in your prompt context:

```
Use the es-plus-ui JSON Schema at node_modules/es-plus-ui/schemas/index.schema.json
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
