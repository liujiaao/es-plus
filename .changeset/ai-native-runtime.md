---
"@es-plus/core": minor
"@es-plus/vue3": minor
"@es-plus/vue2": minor
"@es-plus/adapter-antdv": minor
---

三端渲染与列合成收口（AI 原生化 AN-06…AN-11）

- **前导列合成单一真源**：选择列 / 序号列 / 展开列改由 core 的
  `synthesizeLeadingColumns` + `buildLeadingColumns` 生成，顺序统一为
  `selection → index → expand`。此前 8 条列产出路径（三端各自的默认 / 虚拟 / vxe 引擎，
  外加 antdv 的 `adaptColumns`）里，三份 vxe 适配器各写一份 if，两处默认引擎则完全没有
  —— 同一配置切换引擎就少一列，现在收敛到一处。
- **幂等且不覆盖显式列**：已显式声明同类型列（含 `hidCol`）时不再注入；合成列不参与
  formatter 注入与 `width → minWidth` 转换。
- **`ellipsis` / `defaultSort` 生效**：`ellipsis` 发射为 `column.showOverflowTooltip`
  （含 vxe 适配），`defaultSort` 三端映射。
- **`multiSelect` / `snIndex` 运行时接线**：生成配置即可用，不再是「生成器懂、运行时不懂」。
- **无静默丢弃**：字段/列级 `permissions`、`editConfig` 等此前被吞掉的配置现在要么生效、
  要么显式告警。
- **antdv 的差异是消费者差异**：选择列由 `rowSelection`、展开列由 `expandedRowRender`
  渲染，二者都不进 `adaptedColumns`；只有序号列是真实列，其默认值改取 core 的
  `LEADING_COLUMN_DEFAULTS.index`，不再各写一份字面量。
- 回归：三端 mount 测试与 vxe 引擎测试补齐（含「显式 index 不重复」「与选择列共存仍在
  首位」「antdv 序号列取 core 默认」），`check:capability-parity` 对账矩阵 ↔ schema ↔
  运行时消费点。
