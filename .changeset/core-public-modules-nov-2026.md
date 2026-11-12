---
"@es-plus/core": minor
---

新增一批框架无关的公开模块（内置文案、表单容器、详情模式、列筛选、CSV 导出）

- **内置文案 `locale`**：`resolveBuiltinText` / `resolveLocaleName` / `getDefaultToolbarBtns` /
  `getDefaultRowBtns` / `ZH_CN_MESSAGES` / `EN_US_MESSAGES`，以及 `getLocaleVersion` /
  `subscribeLocaleChange`。三端按钮文案自此同源，并支持运行期热切换。
- **表单分组容器**：`groupFormItems` / `UNGROUPED_FORM_GROUP_KEY` —— Tabs / Steps / Collapse
  的分桶、未分组字段追加顺序与空组剔除全在本模块，三端只画容器。
- **嵌套对象字段**：`flattenFormItems` / `resolveNestedProp` / `isNestedFormHead` /
  `isNestedFormChild` / `pruneEmptyNestedContainers` 与 `NESTED_FORM_HEAD` /
  `NESTED_FORM_PARENT` 标记。字段用 `children` 表达一层嵌套，三端不再各写一份摊平逻辑。
- **表单详情模式**：`resolveFormDetailText` / `formatDetailDate`（`mode="detail"` 的展示解析单源）。
- **列筛选**：`normalizeFilterMode` / `matchesColumnFilter` / `columnFilterKey` /
  `hasColumnFilters` / `withAutoFilters` / `buildColumnFilterMethod`。
- **表格内部键与 vxe-only 键**：`BASE_TABLE_INTERNAL_KEYS`、`VXE_ONLY_TABLE_KEYS` /
  `findVxeOnlyKeysOutsideVxe` / `warnVxeOnlyKeysOutsideVxe`。
- **默认引擎 CSV 导出兜底**：`buildCsv` / `downloadCsv` / `ensureCsvExtension` /
  `exportTableCsv` / `isCsvExportableColumn`。
- **新增公开类型**：`DialogModalOptions` / `DialogDrawerOptions` / `DialogCallOptions`、
  `ColumnFilterMode` / `TableColumnFilterOption`、`FormGroupOption` / `FormGroupLayout` 等
  （`PUBLIC_CONTRACT_TYPES` 39 → 42，三端由 `check:exports` 强制同名同数）。
