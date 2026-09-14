---
"@es-plus/adapter-antdv": patch
"@es-plus/vue3": patch
"@es-plus/vue2": patch
---

收尾修复审计剩余的三项跨端差异。

**adapter-antdv**
- **Upload `limit` → `maxCount`**：此前 `limit` 被静默忽略（ADV 用 `maxCount` 限制文件数），
  超限限制失效；现自动映射。`on-exceed` 在 ADV 无对应事件，改为显式告警而非静默透传无效 prop。
- **DatePicker/TimePicker 回写统一为原生 `Date`**：未配置 `valueFormat` 时此前回写 dayjs，
  与 vue3/vue2 的 Element 语义（回写 Date）分歧，导致 `model.date.getTime()` 在 antdv 抛错。
  现统一回写 `Date`；配置 `valueFormat` 时仍回写字符串（对齐 EP value-format）。
  **行为变化**：依赖 antdv 侧拿到 dayjs 的代码需改为读 `Date`。

**三端 `es-table`**
- **裸数组响应直接作为表格数据**：此前只有 core 的 `formatConfigOut` 有数组直传路径，
  三端表格的本地映射没有，导致「接口直接返回数组」时渲染空表。现三端本地 `formatConfigOut`
  在收到数组时把数组作为 `tableData`、`total` 取长度。

各修复均补回归测试并反向验证。
