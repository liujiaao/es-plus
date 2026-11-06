---
title: '更新日志'
route: '/guide/changelog'
canonical: 'https://main.esplus-ai.com/guide/changelog/'
source: 'es-plus-docs/src/docs/changelog.md'
type: 'guide'
---
# 更新日志

> 本页由 `npm run changelog:gen` 从各包的 `CHANGELOG.md` 生成，**请勿手改**；完整历史见 [GitHub Releases](https://github.com/liujiaao/es-plus/releases)。

## 当前版本

| 包 | 版本 | 说明 |
|---|---:|---|
| `@es-plus/core` | 1.4.0 | 框架无关核心（类型 / 布局 / 校验） |
| `@es-plus/vue3` | 1.8.0 | Vue 3 + Element Plus 渲染端 |
| `@es-plus/vue2` | 1.5.0 | Vue 2 + Element UI 渲染端 |
| `@es-plus/adapter-antdv` | 1.4.0 | Vue 3 + Ant Design Vue 适配器 |
| `@es-plus/shared` | 1.5.0 | 配置 schema / 生成器 / 修复环 |
| `@es-plus/cli` | 1.5.0 | 命令行工具 |
| `@es-plus/mcp-server` | 1.5.0 | MCP Server（AI 工具面） |

## 最近一次发布

> 每个包只取 CHANGELOG 的最新一段；同一个 changeset 打在多个包上时合并为一条。

### Minor Changes

- 三端渲染与列合成收口（AI 原生化 AN-06…AN-11）

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

  <sub>影响：@es-plus/core / @es-plus/vue3 / @es-plus/vue2 / @es-plus/adapter-antdv</sub>

- 扁平配置键、默认值层与 fail-closed 权限门（P5 / P5b / P6）

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
  - antdv 权限位与分页 `layout` 与 vue3 对齐。**权限门写在 `<template v-for>` 的内层元素上**
    —— Vue 3 里 `v-if` 优先于 `v-for`，两个指令落在同一元素时条件会被提到循环外求值
    （`_ctx.checkPermission(_ctx.item.permissionValue)`），循环变量是 `undefined`，渲染直接抛错。
    该写法会让 `EsForm` / `EsDialog` 只要带按钮就崩，且 `typecheck` 报 TS2339（它同时是
    发布阻断）。回归用例见 `__tests__/button-permission-gate.spec.ts`。

  <sub>影响：@es-plus/core / @es-plus/vue3 / @es-plus/vue2 / @es-plus/adapter-antdv</sub>

- AI 原生化收尾（AN-01…AN-29）：生成器发射正确性、确定性修复环、工具面前门与宣称绑定

  **生成器与共享层（`@es-plus/shared`）**

  - `schema.actions` 恒发射；模型省略时由三端按语义推导兜底。
  - `tableBtns` 契约统一为 `name | code | actionType` 单源判据；`label` / `action` 作为别名
    自动归一（规范键胜、别名删除并记录）。
  - **未知键严格判定**：`validate_config` / CLI 前门把未知键判为 error，并给出
    `did you mean` 建议（`x-*` 放行）；`generateFromConfig` 过渡为 warning，存量配置不会被
    一夜拒绝。补齐 `tableOptions.treeConfig`、`tableOptions.expandConfig` 等此前缺失的 schema 键。
  - **确定性修复环**：新增 `normalizeConfig()` 与 `repairConfig()`，把常见格式错误
    （`null`、`"true"` / `1` 布尔、按钮别名、`dialogs` 罐头键、`formItems` 简写）在生成前
    修掉。修复由 schema issue 驱动，**只有 issue 总数严格下降才接受**，不猜用户意图；
    `validate_config` 仍只判不改。
  - `pagination.pageSizes` 在 schema 模式也发射（此前只有 SFC 发射，同一配置两种产物不同）。
  - **运行时前置清单**：新增 `preflight.ts` / `doctor.ts`。生成物带 `preflight` 块
    （`httpRequest` / `permission` / `i18n` / JSX 插件 / UI 库，并写明「不需要」的依据）；
    `doctor_page` 对宿主入口做静态体检，结果三态 `ok / missing / unverified`。
    `generateAppEntry('vue3')` 补装 UI 库，三端入口补 `dist/style.css` 导入。
  - **`ingest_schema` 支持 `ts-interface` 与 `sql-ddl`**（类型 → formtype，含 `COMMENT` /
    JSDoc label、`ENUM` / 字面量联合 → `dataOptions`）；解析失败只告警，不抛异常。
  - 片段与三组件组合的生成、评分配置收口；`useDialog` 场景有运行时见证。

  **MCP 工具面（`@es-plus/mcp-server`）**

  - `generate_crud` 是唯一 **FRONT DOOR**；`generate_crud_from_config` 标 **ADVANCED**；
    `generate_crud_page` / `generate_crud_schema` 标 **LEGACY FALLBACK**。
  - 新增 `ESPLUS_MCP_PROFILE=front-door|full`：`front-door` 隐藏 advanced 与 legacy 工具
    （15 → 12），server instructions 同步说明。**默认 `full`**，现有宿主与文档不受影响。
  - 新增 `check:tool-surface` 守卫：断言只有一个工具含 FRONT DOOR、profile 解析与隐藏集合
    精确匹配。

  **CLI（`@es-plus/cli`）**

  - `nl-to-config` 先用 `repairConfig` 再校验：无歧义的格式错误不再消耗一次模型重试。

  **文档与宣称（不改变运行时）**

  - README / 站点文档中的 AI 准确率改为「目标 ≥95% + 当前值见徽章」，语料规模与
    `last-accuracy.json` 同源；`check:site-claims` 读取 artifact 校验，宣称 95% 而实测不足
    即红，且 artifact 存在未测到的行时拒绝发布声明。
  - 三站案例以确定性方式登记进 `feature-coverage.json`（`sites`）：映射到单源演示的案例
    继承能力令牌，未匹配的显式登记为 D 级并附原因，不猜能力。

  <sub>影响：@es-plus/shared / @es-plus/cli / @es-plus/mcp-server</sub>

- 新增 `es-plus ingest`：从既有 schema 确定性草拟 StructuredCrudConfig

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

  <sub>影响：@es-plus/shared / @es-plus/cli / @es-plus/mcp-server</sub>

- 场景前门、能力台账与产物信封（P2 / P5c / P8 / P9 / P10 / P11 / P13）

  这一批在 `ai-native-remediation` 之后落地，此前没有任何 changeset 覆盖 —— 本轮补记。

  **场景路由器（`@es-plus/shared` / `@es-plus/mcp-server`）**

  - `shared/scene/emit.ts` 新增 `ScenePlan` + `emitScene`：CRUD 分支整体搬迁自
    `generate_crud`，四个场景（crud / table / form / dialog）共用同一发射器；
    `config-feedback.ts` 承接语义告警与校验错误格式化，旧导出路径保持兼容。
  - `mcp-server` 新增 `generate_scene`：`{ scene, intent }`，`scene` 枚举来自场景注册表、
    缺省 `crud`；未知键与非法意图在生成前结构化拒绝。**这是唯一 FRONT DOOR** ——
    `generate_crud` 降为 COMPAT adapter，产物与旧入口逐字节相同。
  - 新增 `generate_composition`：把 1–3 个片段装配成可运行的 `Page.vue`，接线由
    `ARTIFACT_RUNTIME` 派生（行按钮 key 命中弹窗节点 id 就开窗，否则升级为页面事件
    `row-action`）；`wires` 可显式声明接线，覆盖派生结果。组合契约同步升到
    `es-plus.composition@3`（多表 / 多弹窗 / 显式接线 / `behavior`）。
  - 工具面重新计数：full **19** 个、`ESPLUS_MCP_PROFILE=front-door` **16** 个。

  **能力台账（`es-plus.capabilities@1`）**

  - 四场景意图词汇（crud 19 / table 8 / form 7 / dialog 10）用 `satisfies` 抓多余键、
    用 `AssertNever<Exclude<keyof Input, listed>>` 抓接口新增键漏登记（tsc 即红）。
  - `assessIntent({ scene, intent })` 逐键判 `accepted` / `degraded` / `unsupported` 并给出
    可验证的替代路径；产物信封透出逐键判定，宿主在生成前后都能回答「我给的键会不会落地」。
  - 新增工具 `validate_intent`（生成前只判不改）与 `coverage_report`（多页清单分级
    L1 直出 / L2 直出+扩展点 / L3 需宿主代码）。

  **产物信封**

  - `ARTIFACT_CONTRACT_VERSION` 升 `es-plus.artifact@2`：`capability` 刻意为不参与身份，
    @1 的「指纹覆盖全部字段」承诺已不成立，宿主按版本即可判断「能力判定必在」。
  - `generate_scene` / `generate_crud` / `generate_composition` 三个入口把信封挂到
    `structuredContent`；`content.text` 逐字节不变。

  **生成器与适配器**

  - 生成器与约定文案改用扁平配置键；嵌套形状一律 `passthrough`，未知键活到前门闸门
    再被判 —— 不再在转发层被静默吞掉。
  - 片段表格与 CRUD 页共用同一套表格词汇（P10）。
  - 导出/导入按钮不再「能点、零反馈」：两条 legacy 路径补齐可见处理。
  - `usage` 诊断订正：`duplicate-prop` 不再声称「后者被静默丢弃」（实际是前者）。
  - `ingest_schema` 修复单行逗号分隔的 TS 成员丢字段；`INGEST_KINDS` 加反向穷尽断言。
  - `coverage_report` 复用未知键扫描；`generate_table` 不再伪造 `rowkey` 默认值。

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
