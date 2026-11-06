# @es-plus/cli

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

### Patch Changes

- Updated dependencies [3b30d00]
- Updated dependencies [4bf670d]
- Updated dependencies [b71d8c5]
  - @es-plus/shared@1.5.0

## 1.4.0

### Patch Changes

- 2d748f6: 修复源码审计（`docs/source-audit-report.md`）中的 5 条「立即」级缺陷。

  **C1 请求 Promise 永久挂起（core + 三端）**

  - `queryTableListMethod` 此前仅在响应为非空对象/数组时调用 `success`，而非对象响应（204 空响应、
    拦截器 `return undefined`、原始值）既不触发 `success` 也不触发 `fail`，导致
    `httpRequestFormInstance` 的 Promise 永不 settle，`getEveryFormQueryField` 的 `Promise.all`
    整体挂起（远端下拉选项加载不出来且无报错）。现非对象响应归一为 `{}` 后仍调用 `success`。
  - **同类缺陷同时存在于三端表格组件的本地请求函数**：`isObject(res) && Object.keys(res).length`
    守卫会跳过空响应与数组响应，而 `httpRequestInstance` 的 Promise 只在 success/fail 中 settle
    → 表格加载永久挂起。三端一并修复。
    **行为变化**：空 / 非对象响应（如 204、拦截器 `return undefined`）现在会 settle 并被视为空列表
    （清空行、`total` 归 0），此前是 Promise 挂起；数组响应也会 settle，但表格本地映射不含数组直传分支，
    会渲染为空表（如需支持裸数组列表响应，是独立的后续需求）。

  **C2 antdv 代码生成不可编译（shared）**

  - `schema-generator` 的 Vue3/antdv 共用 `<script setup>` 分支此前漏调 `rewriteElementUsage`：
    import 已被映射为 `Modal` / `message`，代码体却仍引用 `ElMessageBox` / `ElMessage`。
    现该分支的删除确认块复用 `buildDeleteConfirmBlock`（antdv 走 `Modal.confirm` 对象式），
    并在返回前统一改写 UI 库命名；`summary` 的 target 文案同步修正（antdv 不再误标 Element Plus）。

  **C3 顶层快捷字段静默丢弃（core + 三端）**

  - `FormItemOption.placeholder` / `clearable` / `disabled` 文档承诺自动注入 `attrs`，但
    `normalizeFormItem` 除 core 自身外零调用，三端全部静默丢弃。现三端 `es-form` 的
    `formItemListFilter` 统一接入 `normalizeFormItem`。
  - `normalizeFormItem` / `normalizeFormItemList` 改为泛型，只约束真正使用的字段
    （新增 `FormItemShortcutSource`）—— 三端各自特化的 `render` / `isHidden` 签名与 core 的
    `FormItemOption` 不兼容，直接收完整类型会导致 antdv / vue2 编译失败。

  **C4 跨页选择列不渲染（shared）**

  - `crud-engine` 自然语言解析误写 `options.selection`（非法键），三端只识别 `options.multiSelect`。
    现改为 `multiSelect`，提示文案同步。

  **C8 CLI 路径穿越（cli + shared）**

  - `name` 此前只约束 `min(1)`，`toPascalCase` 不剥离分隔符，`--from-config` 载入不可信配置时
    可通过 `name: "../../evil"` 把产物写出输出目录。现：契约层对 `StructuredCrudConfigSchema.name`
    增加 refine 拒绝路径分隔符 / `.` / `..` / 盘符；CLI 侧新增 `isSafePathSegment` / `isPathInside`
    守卫（`create` 的 `[name]`、`--from-config` 两条路径，以及 `scaffold` 的 `[name]`），
    并在拼出文件路径后做输出目录越界兜底。

  **测试**

  - 全部修复均补回归测试，并逐条反向验证（临时拆掉修复后测试确实变红）：
    C1（core）、C2、C3（三端）、C4、C8（含 create / scaffold 接线级测试）、三端表格 settle。
  - 新增 `packages/vue2/__tests__/es-table.spec.ts`（此前 vue2 无表格挂载测试）。
  - 全量：core 244 / shared 277 / cli 42 / vue3 450 / vue2 285 / adapter-antdv 499 / mcp-server 59；
    7 包 typecheck 全过；lint 0 error；`check:consistency` 全绿。

- Updated dependencies [2d748f6]
- Updated dependencies
  - @es-plus/shared@1.4.0

## 1.3.0

### Minor Changes

- 9869180: 新增 NL→Config AI 生成能力与 antdv 渲染器支持；加固生成器健壮性（覆盖保护/未知 target/写盘事务/顶层兜底）。

### Patch Changes

- Updated dependencies [9869180]
  - @es-plus/shared@1.3.0

## 1.2.0 — Vue 2 generation actually compiles

This release fixes two bugs in the @es-plus/shared code generator (which
this cli delegates to) that prevented the produced code from actually
building in real projects. Both bugs were caught by the new end-to-end
test matrix in the monorepo (`__tests__/e2e/`).

### Fixed

- **Dialog SFC generation now declares `<script setup lang="jsx">`** when
  the body uses JSX (`render: (h, { registerRef }) => <EsForm ... />`).
  Without `lang="jsx"`, esbuild's plain-JS loader rejected the JSX syntax
  and `vite build` failed. Affected: `--mode sfc` for any prompt that
  produces a dialog (i.e. anything with add/edit actions).
- **Vue 2 `<script setup>` → `defineComponent` rewrite no longer moves
  `import` statements inside the `setup()` function body**, where they are
  illegal JS. Imports now stay at the top of `<script>` as required; the
  setup function body contains only non-import code. Affected:
  `--target vue2 --mode sfc`.

### Added

- **End-to-end test harness** (in the monorepo root, not shipped to npm):
  generates code via the cli for each (target, mode) combination, installs
  packed `@es-plus/{shared,vue3,vue2,cli}` tarballs into a fresh Vite +
  Vue project, and runs `vite build`. Any future regression in the cli, the
  generator, or the runtime component packages fails CI.

### Notes

The cli's `--target vue3|vue2` and `--mode schema|sfc` flags already existed
in 1.1.x; this release makes them actually produce code that compiles end-
to-end in both targets. No new commands or flags.
