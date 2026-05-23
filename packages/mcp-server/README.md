# @es-plus/mcp-server

MCP (Model Context Protocol) Server for [es-plus-ui](https://www.npmjs.com/package/es-plus-ui) — 让 AI 编码工具（Claude Code、Cursor、Continue 等）直接调用 es-plus CRUD 生成能力。

## 快速配置

### Claude Code

在项目根目录 `.claude/settings.json` 中添加：

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

在 `.cursor/mcp.json` 中添加：

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

## 功能 (Tools)

| Tool | 描述 |
|------|------|
| `generate_crud_page` | 自然语言 → 完整 .vue CRUD 页面 |
| `validate_config` | JSON 配置校验 + 修复建议 |
| `list_form_types` | 列出 13 种 formtype 及说明 |
| `get_component_api` | 获取组件 API 文档 (EsForm/EsTable/useDialog) |
| `scaffold_page` | 生成空白页面脚手架 |

## 资源 (Resources)

| URI | 内容 |
|-----|------|
| `esplus://schemas/form-item` | FormItemOption JSON Schema |
| `esplus://schemas/table-column` | TableColumn JSON Schema |
| `esplus://schemas/table-options` | TableOptions JSON Schema |
| `esplus://schemas/dialog-options` | DialogOptions JSON Schema |
| `esplus://types` | TypeScript 类型定义全文 |
| `esplus://examples` | 6 个预设 CRUD 示例 |

## 提示模板 (Prompts)

| Prompt | 用途 |
|--------|------|
| `crud-page` | 生成完整 CRUD 页面 |
| `form-config` | 仅生成表单配置 JSON |

## 使用示例

配置好 MCP server 后，在 AI 编码工具中直接对话：

```
帮我生成一个用户管理页面，查询条件有姓名、手机号、状态，
表格显示姓名、手机号、邮箱、状态、创建时间，支持新增编辑删除
```

AI 工具会自动调用 `generate_crud_page`，返回完整可用的 `.vue` 文件代码。

## 本地开发

```bash
cd packages/mcp-server
npm install
npm run build
npm start
```

## License

MIT
