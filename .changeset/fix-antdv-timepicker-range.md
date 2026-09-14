---
"@es-plus/adapter-antdv": patch
---

修复 TimePicker 范围模式渲染与占位符映射。

- **范围模式静默降级**：ADV 4.x 的范围时间选择器是独立导出的 `TimeRangePicker`，
  `TimePicker.RangePicker` 已不存在 —— 此前 `TimePicker` 的 range 模式会静默退化为**单选**组件。
  现改为 `isRange ? TimeRangePicker : TimePicker`。
- **占位符映射对齐 DatePicker**：补 `start-placeholder` / `end-placeholder` → ADV
  `placeholder: [start, end]` 的映射（只配字符串 `placeholder` 时复制为数组），并清理透传给 ADV 的
  EP 专属键（`is-range` / `start-placeholder` / `end-placeholder`）。此前这些配置被当未知 attr 丢弃。

各修复均补回归测试并反向验证。
