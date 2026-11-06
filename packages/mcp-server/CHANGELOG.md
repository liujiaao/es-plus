# @es-plus/mcp-server

## 1.5.0

### Minor Changes

- 3b30d00: AI 原生化收尾（AN-01…AN-29）：生成器发射正确性、确定性修复环、工具面前门与宣称绑定

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

- b71d8c5: 场景前门、能力台账与产物信封（P2 / P5c / P8 / P9 / P10 / P11 / P13）

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

### Patch Changes

- 4bf670d: 新增 `es-plus ingest`：从既有 schema 确定性草拟 StructuredCrudConfig

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

- Updated dependencies [3b30d00]
- Updated dependencies [4bf670d]
- Updated dependencies [b71d8c5]
  - @es-plus/shared@1.5.0

## 1.4.1

### Patch Changes

- 4541d3e: 移除 `DialogOptions.onSubmit` —— 该选项从未生效，请改用 `configBtn[].click`。

  **这不是「删功能」，是承认该 API 不存在。** 三端没有任何一个 dialog 组件 emit `submit`：
  vue3 声明了事件并写了一个**零引用**的 `handleConfirm`（唯一会 emit `submit` 的地方）；vue2 把
  `'submit'` 列进了 `emits` 却从不 emit；antdv 连声明都没有。而三端 `useDialog` 合计 17 处在包装
  `onSubmit`、4 个类型文件声明了它 —— 除最后一步外整条链都接好了，唯独没有触发点。

  因此升级后：

  - **运行时行为完全不变** —— 传 `onSubmit` 的代码本来就不会被调用（弹窗底部按钮只在 `configBtn`
    非空时渲染，写了 `onSubmit` 的调用其实一个按钮都没有）；
  - **类型上会看到错误** —— `DialogOptions` 不再有该字段，这是本次唯一的破坏性变更，故记 minor。

  迁移方式（把确认逻辑挂到按钮自己的 `click` 上）：

  ```ts
  dialog({
    render: (h) =>
      h(EsForm, {
        /* … */
      }),
    configBtn: [
      { name: "取消", click: (_, { close }) => close() },
      {
        name: "确定",
        type: "primary",
        click: (_, { close, getRefs }) => {
          getRefs("form")
            ?.validate()
            .then(() => close());
        },
      },
    ],
  });
  ```

  一并删除：三端 `useDialog` 里的 17 处包装、vue3 的 `submit` 事件声明与死代码 `handleConfirm`、
  vue2 `emits` 里的 `'submit'`、`dialog-options.schema.json` 里的 `onSubmit`（已同步三份副本）、
  `get_component_api` 中「exposed by the type but the runtime never wires it up」那条说明。

  文档站的 4 处示例与 API 表已迁移到上述写法（迁移前这些「点击确定」的示例其实点不动，因为压根
  没有按钮）。

- Updated dependencies [4541d3e]
  - @es-plus/shared@1.4.1

## 1.4.0

### Minor Changes

- 修复三端同构中的「静默失效」类缺陷 —— 这些问题的共同点是**不报错、只是行为悄悄不对**，
  是同一份配置在某一端"没反应"时最难排查的一类。同时收敛若干跨端 API 差异。

  **`@es-plus/adapter-antdv`**

  - **EP 专有属性不再被静默吞掉**：`clearable` / `filterable` / `show-word-limit` / `collapse-tags`
    此前被原样透传给不认识它们的 Ant Design Vue 组件而失效（`grep allowClear` 曾为 0 命中）。
    现按 formtype 限定作用域映射为 `allowClear` / `showSearch` / `showCount` / `maxTagCount`；
    `collapse-tags-tooltip` 无等价物，改为**开发期一次性告警后丢弃**，不再无声消失。
  - **修复插件重复注册**：`install()` 补回 `isPlugin && Plugin` 守卫（vue3 早有针对该场景的守卫，
    本端遗漏且注释写着"完全对齐 vue3"），消除 dev 环境的
    `Component "EsForm" has already been registered` 告警。
  - **`useDialog` 返回值对齐三端的 `DialogResult`**：由裸 vNode 改为
    `{ instance, close, destroy }`，使 `const { close, instance } = dialog({...})` 这种
    在 vue3/vue2 与官方示例中通用的写法在本端也能工作。callable 上的 `.close()` / `.destroy()`
    保留不变，属纯增量变更。
  - **默认列对齐收敛为 `center`**：此前仅在显式配置时才设置 align，落到 a-table 默认的 `left`，
    造成"同一份配置三端三种对齐"，且与本包 vxe 引擎（center）自相矛盾。
  - **列 key 兜底改为确定性**：既无 `key` 又无 `prop` 的列此前用 `Math.random()` 生成身份，
    每次 computed 重算都产生新 key，破坏 a-table 的列状态（排序/筛选/列宽）并让快照失稳。
  - 自动 span 计算改回调用 `@es-plus/core` 的 `applyAutoSpan`，消除内联重写。

  **`@es-plus/vue2`**

  - **`validateField` 由 `void` 桥接为 Promise**：element-ui 的 `validateField` 是纯 callback 式，
    而 vue3(Element Plus) / antdv 返回 Promise。此前本端直接透传，导致
    `await form.validateField('name')` **立刻返回、完全不等待校验** —— 三端里唯独 vue2
    无法用 await 拦截字段级校验。现按 EP/ADV 语义桥接（通过 resolve、不通过 reject），
    并对"未匹配到字段"的情况直接放行，避免 Promise 永不 settle 造成调用方挂起。
  - `isFold` / `getBtnColSpan` / isFold 标注改回调用 core 的同名函数（逐行等价，纯去重）。

  **`@es-plus/shared` / `@es-plus/mcp-server`**

  - **`tableBtns` 接受 `position` 并归一化为 `code`**：schema 此前只声明 `code`，而 Zod 默认
    strip 未知键 —— 宿主 LLM 按 `esplus://crud-page-schema` 示例写 `position: 'right'` 时会被
    **静默改写成 `code: 1`（左侧）**：解析成功、零告警，按钮落到错误的一侧。
    现接受 `position`（渲染器契约里的推荐字段，三端 `BtnConfig` 均把 `code` 标为 deprecated）
    并通过 `.transform()` 归一化出与之一致的 `code`，保证下游读 `code` 的路径（生成物 JSON、
    golden 评分器）始终正确。
  - `toolbarBtns` 同样接受 `position`，不再被 strip。
  - **统一 `position` / `code` 的口径**：`esplus://conventions` 资源此前写着
    "Do NOT use a `position` field"，理由为"vue2 会忽略它"——**该理由不成立**（vue2 的
    `es-table/src/table-btns.vue` 与 `es-crud-page.vue` 都经由 core 的 `getButtonPosition`
    优先读取 `position`，已在源码上核实）。
    该错误口径与 `esplus://types`（标注 `code` 已 deprecated）、`esplus://crud-page-schema`
    （示例通篇用 `position`）三方互相矛盾，会把宿主 LLM 推向已废弃字段。三处口径现已统一。
  - NL→ 配置的 system prompt 同步修正按钮定位指引。

  > `tableBtns` 的 `position` 归一化同时被 `scripts/check-schema-contract.mjs` 守卫，
  > 并新增 golden 用例 `24-position-tablebtns.json` 覆盖该路径。

### Patch Changes

- Updated dependencies [2d748f6]
- Updated dependencies
  - @es-plus/shared@1.4.0

## 1.3.0

### Minor Changes

- 9869180: 新增 NL→Config AI 层、SFC 模式、InputNumber、antdv 渲染器与全局 httpRequest 支持。

### Patch Changes

- Updated dependencies [9869180]
  - @es-plus/shared@1.3.0

## 1.2.0 — Dual-target awareness + protocol clarity

This release closes the vue3-only blind spot in the MCP surface. Resources
and tools are now target-aware end-to-end, with a new `detect_project_target`
tool that lets AI clients pick the right target before generating anything.

### Added

- **`detect_project_target`** tool — reads a project's `package.json` content
  (as a string the client provides) and returns
  `{ target, confidence, reasoning, signals }`. AI-aware clients
  (Claude Code / Cursor / Continue) should call this FIRST, then pass the
  returned `target` to every subsequent generator. Covers explicit
  `@es-plus/{vue3,vue2}` deps, legacy `es-plus-ui`, Vue major + Element layer
  inference, semver range parsing, and degenerate / malformed input.
- **Server-level `instructions`** field — initialized via the MCP SDK so
  every client sees up-front guidance to "detect target first, then
  generate" + the resource URI naming convention.
- **`target` parameter on `get_component_api`** — emits Vue 3 vs Vue 2
  import / `v-model:*` vs `:*.sync` / `<script setup>` vs `defineComponent`
  appropriately. Default remains `vue3` for backward compat.
- **Vue 2 resource variants** for every existing resource. URIs follow a
  consistent suffix pattern; the bare URI continues to default to vue3:
  - `esplus://conventions` / `esplus://conventions/vue3` / `esplus://conventions/vue2`
  - `esplus://examples` / `esplus://examples/vue3` / `esplus://examples/vue2`
  - `esplus://types` / `esplus://types/vue3` / `esplus://types/vue2`
  - `esplus://crud-page-schema` / `esplus://crud-page-schema/vue3` / `esplus://crud-page-schema/vue2`
- **First unit-test coverage** in `__tests__/detect-project-target.spec.ts`
  (21 cases — tier 1 / tier 2 / semver edges / malformed input / output
  shape).
- **Vue 2 bundled types** as a separate fallback file
  (`bundled/types-vue2.d.ts`) so `esplus://types/vue2` works even when the
  monorepo source isn't on disk.

### Changed

- `bundle-types` script now reads from the renamed `packages/vue3/`
  directory and additionally bundles `packages/vue2/src/types/index.ts`.
- `loadTypesFromSource` in the types resource accepts a target argument and
  resolves the correct monorepo path per target.

### Fixed

- (Internal, no user-facing impact) Hardcoded `packages/es-plus/...` paths in
  the types and crud-page-schema resources updated to the renamed
  `packages/vue3/...` layout.

### Migration

No breaking changes for existing AI clients — every URI and tool retained
its prior signature. To take advantage of vue2-aware generation:

1. Have the AI call `detect_project_target` with the project's
   `package.json` content.
2. Pass the returned `target` to `generate_crud_page` /
   `generate_crud_schema` / `generate_from_config` / `get_component_api`.
3. (Optional) Read the matching `esplus://conventions/<target>` resource for
   Vue 2 syntax deltas.

## 1.1.x

(Earlier versions had only vue3 support — see git history for details.)
