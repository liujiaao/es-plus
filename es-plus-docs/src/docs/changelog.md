# 更新日志

> 本页由 `npm run changelog:gen` 从各包的 `CHANGELOG.md` 生成，**请勿手改**；完整历史见 [GitHub Releases](https://github.com/liujiaao/es-plus/releases)。

## 当前版本

| 包 | 版本 | 说明 |
|---|---:|---|
| `@es-plus/core` | 1.5.1 | 框架无关核心（类型 / 布局 / 校验） |
| `@es-plus/vue3` | 1.9.0 | Vue 3 + Element Plus 渲染端 |
| `@es-plus/vue2` | 1.6.1 | Vue 2 + Element UI 渲染端 |
| `@es-plus/adapter-antdv` | 1.5.0 | Vue 3 + Ant Design Vue 适配器 |
| `@es-plus/shared` | 2.0.0 | 配置 schema / 生成器 / 修复环 |
| `@es-plus/cli` | 2.0.0 | 命令行工具 |
| `@es-plus/mcp-server` | 2.0.0 | MCP Server（AI 工具面） |

## 升级前请先读

- **Major Changes（破坏性）**（@es-plus/shared、@es-plus/cli、@es-plus/mcp-server）：BREAKING**：退役 legacy 自然语言整页引擎（`generateCrudPage`），三个包同步升 major

> 完整迁移代码见下方对应条目。

## 最近一次发布

> 每个包只取 CHANGELOG 的最新一段；同一个 changeset 打在多个包上时合并为一条。

### Major Changes（破坏性）

- **BREAKING**：退役 legacy 自然语言整页引擎（`generateCrudPage`），三个包同步升 major

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

  <sub>影响：@es-plus/shared / @es-plus/cli / @es-plus/mcp-server</sub>

### Minor Changes

- 三端渲染器新能力：抽屉弹窗、表单详情/分组/嵌套、列筛选、内置文案单源

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

  <sub>影响：@es-plus/vue3 / @es-plus/adapter-antdv</sub>

- AI 契约补齐：嵌套对象、表单分组、列筛选、vxe 配置型键与 surfaces→config 逆函数

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

  <sub>影响：@es-plus/shared / @es-plus/mcp-server</sub>

- feat(read-back)：生成物携带出处 `__esPlusSource` + `read_page` 回读闭环

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

  <sub>影响：@es-plus/shared / @es-plus/cli / @es-plus/mcp-server</sub>

### Patch Changes

- `exports` 补上 `"./package.json"`

  只暴露了 9 个子路径，`require('@es-plus/core/package.json')` / `import … with { type: 'json' }`
  会以 `ERR_PACKAGE_PATH_NOT_EXPORTED` 失败。读取包版本号与元数据是工具链（bundler 插件、
  版本探针、发版脚本）的常规用法，加上这一条即可，其余子路径与产物文件不变。

  <sub>影响：@es-plus/core</sub>

- 修复 Vue 2.6 下 `import '@es-plus/vue2'` 即抛错（1.6.0 回归）

  1.6.0 把内置文案收敛到 core 的 `resolveBuiltinText` 后，`locale.ts` 在模块顶层执行
  `ref(getLocaleVersion())`。ES 模块的依赖先于使用方求值，所以这行发生在用户
  `Vue.use(EsPlus)` 之前；而 `@vue/composition-api` 的安装当时仍只在 `install()` 里，
  Vue 2.6 宿主因此在 import 阶段就命中：

  ```
  [vue-composition-api] must call Vue.use(VueCompositionAPI) before using any function.
  ```

  现在 `vue-compat` 在导出 `ref` 等 API 之前，按 `Vue.version` 判断并在模块求值阶段安装
  polyfill（Vue 2.7+ 走原生分支，不受影响），同时以 `__composition_api_installed__`
  标记避免 `install()` 二次安装。新增 `vue26-import-order.spec.ts` 回归覆盖安装时机。

  受影响范围：仅 Vue 2.6.x 宿主；Vue 2.7+ 行为不变。用户侧无需改代码。

  <sub>影响：@es-plus/vue2</sub>

- 统一到单份 zod 4，并修好随之暴露的「passthrough 形状闸门全空转」

  `mcp-server` 声明 `zod: ^3.22.0`、`shared` 声明 `^4.4.3` → npm 在
  `packages/shared/node_modules/zod` 又装了一份 4.x，同一个进程里两个 zod 实现：
  体积翻倍只是表象，真正的代价是两边建出的 schema 对象**不能跨副本混用**，而
  `mcp-server` 因此一直维护着一份 shared `StructuredCrudConfigSchema` 的手写副本。

  改动：

  - `mcp-server` 的 `zod` 升到 `^4.4.3`（官方 MCP SDK 1.29 的 peer 本来就是
    `^3.25 || ^4.0`，`zod-to-json-schema` 的 peer 也是 `^3.25.28 || ^4`）→
    `package-lock.json` 里只剩一份 zod。手写副本暂时保留（工具文案独立维护、且有
    守卫逐键对账），升级它不必在同一次改动里做。
  - **`collectUnknownKeys` 在 zod 4 下曾把 `.passthrough()` 当成「所有键都已知」**：
    zod 4 把 `.passthrough()` / `.loose()` 编译成 `catchall: z.unknown()`，与显式
    `.catchall(z.any())` 在 `_def` 上同形，而收集器原来据此放行整层未知键。本仓每一处
    `.passthrough()` 的用途恰恰相反 —— 让未知键活过 `safeParse`，再由这里点名。去掉该
    放行后，`_arg-guard` / `generate_scene` / 覆盖报告 / `validate_config` 的未知键判据
    全部恢复生效（`check:unknown-keys` 新增 A13 直接钉住这一条）。
  - `scripts/eval/fragment-prompt.mjs` 的形状自省改为 zod 3 / 4 双词汇（`typeName` ↔
    `type`、`_def.description` ↔ 公开 `description` getter）。此前在 zod 4 下它读不到
    任何 `.describe()`，片段 prompt 会**静默退化成只有键名、没有教学文案**。
  - 新增 `check:deps`：断言每个成员包解析到同一份 zod，且声明范围的下界主版本与
    实际安装一致（两条判据分别证「没有第二份」与「不会因为下次 install 长出第二份」）。

  发版后 `@es-plus/mcp-server` 的依赖树少一份 zod；三端渲染包不依赖 zod，行为不变。

  <sub>影响：@es-plus/shared / @es-plus/mcp-server</sub>

## 更早的版本

按包查看完整历史：

- `@es-plus/core`：[CHANGELOG](https://github.com/liujiaao/es-plus/blob/master/packages/core/CHANGELOG.md)
- `@es-plus/vue3`：[CHANGELOG](https://github.com/liujiaao/es-plus/blob/master/packages/vue3/CHANGELOG.md)
- `@es-plus/vue2`：[CHANGELOG](https://github.com/liujiaao/es-plus/blob/master/packages/vue2/CHANGELOG.md)
- `@es-plus/adapter-antdv`：[CHANGELOG](https://github.com/liujiaao/es-plus/blob/master/packages/adapter-antdv/CHANGELOG.md)
- `@es-plus/shared`：[CHANGELOG](https://github.com/liujiaao/es-plus/blob/master/packages/shared/CHANGELOG.md)
- `@es-plus/cli`：[CHANGELOG](https://github.com/liujiaao/es-plus/blob/master/packages/cli/CHANGELOG.md)
- `@es-plus/mcp-server`：[CHANGELOG](https://github.com/liujiaao/es-plus/blob/master/packages/mcp-server/CHANGELOG.md)
