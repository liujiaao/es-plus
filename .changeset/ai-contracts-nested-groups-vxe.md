---
"@es-plus/shared": minor
"@es-plus/mcp-server": minor
---

AI 契约补齐：嵌套对象、表单分组、列筛选、vxe 配置型键与 surfaces→config 逆函数

- **嵌套对象字段**：字段新增 `children`（一层嵌套），四份契约（shared 权威 schema、前门旋钮、
  `configShape`、片段形状）与生成器发射、评测面同步。
- **表单分组容器**：查询表单与弹窗表单的 `formLayout.layout`（`type: 'tabs' | 'steps' |
  'collapse'` + `groups`），字段用 `group` 引用。
- **列筛选**：列级 `filters` / `autoFilters` 进入 AI 契约与生成器。
- **`tableOptions` 补 11 个 vxe 一等公民 JSON 键**，并接入编译与评测面（新增 `vxeConfig` 维度诊断）。
- **新增 `surfacesToConfig()`**：`intent.surfaces` → 完整配置的逆函数，`read_page` 的投影与
  「回读 → 改 → 再生成」闭环据此不再静默丢字段（丢失项写入 `surfacesLossy[]`）。
- `TreeSelect` / `Autocomplete` 两种 formtype 进入教学面与 schema 枚举。
- 教学面与配置判据同源：`.describe()` 文案由权威 Zod 派生；新增 `check:teaching-keys` 守卫，
  禁止把运行时键（`formItemOptions`）教成配置键。
