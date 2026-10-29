---
"@es-plus/cli": minor
"@es-plus/shared": minor
"@es-plus/mcp-server": patch
---

新增 `es-plus ingest`：从既有 schema 确定性草拟 StructuredCrudConfig

- **新命令**：`es-plus ingest <file>` 支持 OpenAPI JSON / JSON Schema / 样例 JSON /
  `.ts` 接口 / `.sql` DDL。`--kind` 缺省时按扩展名（`.sql` / `.ts` / `.yaml`）与 JSON 顶层
  特征（`openapi`、`swagger`、`$schema`、`type:"object"` + `properties`）推断，`-k` 可覆盖；
  拼错的 `--kind` 直接报错，不静默回落。
- **stdout 只有草稿 JSON**，推断说明、告警、下一步提示一律走 stderr ——
  `es-plus ingest x.json > config.json` 与 `-o` 产出完全相同字节，管道里不会混进装饰行。
- **失败即非零**：文件不存在 / `--kind` 非法 / 抽取不到字段 三种情况均 `exitCode=1`。
- **与 MCP 同源**：`buildIngestDraft` 与 `INGEST_KINDS` 下沉到 `@es-plus/shared`
  （`src/ingest-draft.ts`），`@es-plus/mcp-server` 的 `ingest_schema` 改为转出同一实现，
  两处占位符与告警文案不再可能分叉（对外行为不变）。
- 本版**不解析 YAML**：`.yaml/.yml` 按 OpenAPI 识别并给出「请先转成 JSON」的告警，
  这比静默当成 sample-json 更接近用户意图。
