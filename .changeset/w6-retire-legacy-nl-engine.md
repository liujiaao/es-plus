---
"@es-plus/shared": major
"@es-plus/mcp-server": major
"@es-plus/cli": major
---

**BREAKING**：退役 legacy 自然语言整页引擎（`generateCrudPage`），三个包同步升 major

`generateCrudPage` 把自然语言经本地正则/关键词表解析成整页 SFC。它的产物与
`generate_scene`（`scene='crud'`）**逐字节相同**，但准确率受关键词覆盖度支配、
无法随宿主推理一起进步；保留它等于给同一件事维护两条真相。本次删除引擎本体，
并把所有消费方改指前门。

**删除的公开 API（`@es-plus/shared`）**

- `generateCrudPage()`、`GenerateResult`：legacy 正则引擎的入口与返回类型。
- `PRESET_EXAMPLES`：不再作为共享数据导出（CLI 与站点各自保留本地副本）。

`generateScaffold()` / `generateAppEntry()` 仍然导出，实现移到
`scaffold-generator.ts`（它们不是 crud-engine 的依赖）。

**MCP 工具面（`@es-plus/mcp-server`）**

- 删除 `generate_crud_page`：full 19 → **18**、front-door 13 → **12**（隐藏 6 个）。
  迁移：改用 `generate_scene`（`scene: 'crud'`）或兼容入口 `generate_crud`；
  需要 `CrudPageSchema` 形态时用 `generate_crud_schema`。
- `esplus://examples` 改走前门同一条 `composeCrudConfig → generateFromConfig`
  链（此前展示的是另一个引擎的产物，这正是「资源文案失实」的根因）。

**CLI（`@es-plus/cli`）**

- `create` 的 **sfc 模式离线自然语言生成**不再可用（`--mode sfc` 仍可与
  `--ai` / `--from-config` 一起用，只是不再有本地正则兜底）。请改用
  `--ai`、`--from-config <file>` 或 `--mode schema`。
