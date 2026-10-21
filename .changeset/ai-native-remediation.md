---
"@es-plus/shared": minor
"@es-plus/mcp-server": minor
"@es-plus/cli": minor
---

AI 原生化收尾（AN-01…AN-29）：生成器发射正确性、确定性修复环、工具面前门与宣称绑定

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
