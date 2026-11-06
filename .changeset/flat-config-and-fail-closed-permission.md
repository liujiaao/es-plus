---
"@es-plus/core": minor
"@es-plus/vue3": minor
"@es-plus/vue2": minor
"@es-plus/adapter-antdv": minor
---

扁平配置键、默认值层与 fail-closed 权限门（P5 / P5b / P6）

这一批在 `ai-native-runtime` 之后落地，此前没有任何 changeset 覆盖 —— 本轮补记。

> **行为变更（需要留意）**：`permission` 门由 fail-open 改为 **fail-closed**。
> 只有「声明了 `permissionValue` 但宿主没配 `permission()`」这一种错配会从**放行**变成
> **拒绝并告警**；既没声明门、或门与判定函数都配齐的项目行为不变。见下方 core 段落。

**`@es-plus/core`**

- 新增 `checkPermissionValue`：无 `permissionValue` 放行；声明了门且配了 `permission()`
  以函数结果为准；声明了门但宿主漏配判定函数 → **拒绝**，并按权限码告警一次
  （去重）。`filterButtonsByPermission` / `normalizeButtonsHideState` 改为委托它，
  此前"没配就放行"的回退已删除。
- 新增 `normalizeSectionConfig`（写入时归一）：展平 `EsTable` / `EsForm` / `EsDialog`
  下的 `methods` 嵌套（同名键以 `methods` 内为准）、剥掉 `$httpRequest` 的 `$` 前缀但
  保留原名、把 `configQueryfieldOutput` 改名为 `configQueryFieldOutput`。
- 新增 `resolveComponentConfig`：两条安装路径（`app.use(EsPlus, { EsTable: {...} })` 与
  `configureEsPlus`）写进「组件能读到的那份配置」的形状原本不同，现在统一为读时视图 ——
  安装之后再调 `configureEsPlus` 才真的能改到组件。
- `TableOptions` 补上 `mergeConfig: { rowsBy: [...] }`（声明式合并单元格）：它早就被
  antdv 渲染器、schema 与 MCP 提示词消费，却从未在任何一份契约里声明过，用户照着写会撞
  TS2353。
- `core` ↔ `shared` 同名契约常量加全等守卫，两边不再可能各自漂移。

**三端渲染器（`@es-plus/vue3` / `@es-plus/vue2` / `@es-plus/adapter-antdv`）**

- 接入扁平配置键与 **defaults 层**：`options` prop 默认值改为 `{}`，内置默认值移进
  `tableOptions` computed（`{ ...内置默认, ...全局 defaults, ...props.options }`）。
  此前每个键都算「显式传入」，**全局默认值永远赢不了内置值**；现在实例 > 全局 > 内置。
  模板与脚本统一读 `tableOptions`（vue3 约 40 处）。
- `provide` 从安装时的快照改为读时视图（`createGlobalConfigView` /
  `createComponentConfigView`），`install` 之后调 `configureEsPlus` 才生效。
- 三端 12 处本地 `checkPermission` / `hasPermission` 实现全部替换为 core 的单一真源。
- `dataOptions` 形状三端统一：放行 `children` / `tagType`，前门校验通过的配置不再被
  本库自己的类型判红；新增逐键对账守卫。
- `es-crud-page` 的 `formLayout.labelWidth` 落到**字段**（此前误取
  `layout.labelBtnWidth`，只改了空按钮行，查询字段标签宽度不变）；按钮行专用键保持独立。
- `operationColumn.fixed` 不再用 `|| 'right'` 把显式 `fixed: false` 顶成右固定。
- antdv 权限位与分页 `layout` 与 vue3 对齐。
