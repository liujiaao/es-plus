---
"@es-plus/shared": minor
"@es-plus/mcp-server": minor
---

场景前门、能力台账与产物信封（P2 / P5c / P8 / P9 / P10 / P11 / P13）

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
