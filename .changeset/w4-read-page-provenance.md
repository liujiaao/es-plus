---
"@es-plus/shared": minor
"@es-plus/mcp-server": minor
"@es-plus/cli": minor
---

feat(read-back)：生成物携带出处 `__esPlusSource` + `read_page` 回读闭环

生成一张页面之后，宿主手里只剩产物。下一轮「再加一列」时从源码反推配置必然有损
（`formItems` 已按 formtype 展开、可见性被压成「在不在数组里」、schema 模式根本没有
`permissions`），反推出来的「配置」看起来像真的，却会把猜测固化成再生成的输入。
本次让生成器把**自己的输入原样带进产物**，回读就是解压，不是推理。

**`@es-plus/shared`**

- 新增 `es-plus.page-source@1` 契约：`buildPageSource()` / `readPageSource()` /
  `configToSurfaces()`，以及 `PAGE_SOURCE_CONTRACT` / `PAGE_SOURCE_KEY` /
  `PAGE_SOURCE_MARK` 常量与 `EsPlusPageSource` / `EsPlusLossyEntry` 类型。
- `generateFromConfig` 的产物自带出处：schema 模式的 pageSchema 内嵌
  `__esPlusSource`；sfc 模式写成 `<script>` 内单行注释 `// __esPlusSource: {…}`
  （`</script>` 与 U+2028/U+2029 均已转义）。运行时渲染器忽略该键。
- `lossy[]` 逐条记录输入与产物的差异：`dropped`（未知键 / 非 JSON 值）、
  `ignored-in-mode`（该模式不执行，如 schema 模式的 `permissions`）、
  `not-expressible`（行内函数）、`normalized`（确定性修复改写过的键）。

**`@es-plus/mcp-server`**

- 新增 `read_page`：传入 `schema.ts` / `Page.vue` / 裸 pageSchema JSON，返回
  生成器当时的 `config`、`lossy[]`，以及机械投影的 `surfaces` 意图表（可直接喂
  `generate_scene`）；投影丢掉的键（显式 `columns`）写进 `surfacesLossy[]`。
  两种 profile 都注册 —— front-door 没有 `generate_crud_from_config`，
  「回读 → 改 → 再生成」正是那一档需要的闭环。工具面 full 18 → **19**、
  front-door 12 → **13**（隐藏集不变）。
- 无出处的页面（本版本之前生成 / 手写）明确报错并给提示，不做有损反推。

**`@es-plus/cli`**

- 消费同一份 `@es-plus/shared` 导出；CLI 行为不变（linked 版本同步升 minor）。
