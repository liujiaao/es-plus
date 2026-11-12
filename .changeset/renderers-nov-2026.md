---
"@es-plus/vue3": minor
"@es-plus/vue2": minor
"@es-plus/adapter-antdv": minor
---

三端渲染器新能力：抽屉弹窗、表单详情/分组/嵌套、列筛选、内置文案单源

三个渲染器同批落地（同一份配置，三端行为对齐）：

- **弹窗**：新增 `type: 'drawer'` 抽屉底座；`useDialog` 的调用入参收窄为按 type 判别的
  `DialogCallOptions`（抽屉拒绝 `isDraggable` / `fullscreen` / `hiddenFullBtn` /
  `alignCenter` / `top`，弹窗拒绝 `direction`）。**类型行为变化**：这类误配此前能编译通过、
  运行时静默无效，现在 `tsc` 直接报错；`DialogOptions` 本身仍是扁平全量，配置槽与缓存合并
  不受影响。
- **表单**：`mode="detail"` 只读详情模式；分组容器 Tabs / Steps / Collapse
  （`formLayout.layout` 与 `dialogs.<id>.formLayout.layout`）；嵌套对象容器（字段 `children`
  一层摊平 + 标题行）；新增 `TreeSelect` / `Autocomplete` 两种 formtype。
- **表格**：列级 `autoFilters` 从 `dataOptions` 自动派生筛选（`ColumnFilterMode` 三端同规）；
  默认引擎的 `exportData()` 改为内置 CSV 兜底（此前是静默 no-op）；`import` 按钮发出专用
  事件；vxe-only 键在非 vxe 引擎上运行时剥离并告警。
- **文案与无障碍**：内置按钮文案改走 core 的 `resolveBuiltinText`，支持运行期切换语言；
  三端补齐廉价可访问名（图标按钮、表单标签、表格操作列）。
- **新增公开类型**：`FormGroupOption` / `FormGroupLayout` / `DialogModalOptions` /
  `DialogDrawerOptions` / `DialogCallOptions` / `ColumnFilterMode` / `TableColumnFilterOption`。
- 依赖 `@es-plus/core` 的下限同步抬到 `^1.5.0`（上述能力由 core 新增模块提供）。
