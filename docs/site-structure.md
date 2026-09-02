# 三端站点同构骨架（site-structure）

> 依据 [`docs/改造三端站点.md` §5.2](../../改造三端站点.md)。本文档是**同构导航骨架的单一真源**，三站导航据此映射，避免「导航逻辑、案例编号、AI 内容深度」跨站割裂。

## 一、同构导航骨架（7 节点）

```
首页（品牌故事 + 30 秒上手 + 三个承诺）
├── 快速开始（安装 / 注册 / 第一个 CRUD）
├── 核心案例（L1–L5 场景化梯度）
├── 组件 API（EsForm / EsTable / EsDialog / EsCrudPage / useDialog）
├── 引擎（vxe / virtual）—— 三站都应有
├── AI 工具链（MCP / CLI / AiCrud）—— 三站都应有
└── 生态（迁移指南 / 竞品对比 / FAQ）
```

| # | 节点 | 内容 | 说明 |
|---|---|---|---|
| 1 | 首页 | 品牌故事 + 三承诺 + L2 头号案例 | 三站 H1 统一「中后台 CRUD 的配置层」 |
| 2 | 快速开始 | 安装 / 注册 / 第一个 CRUD | 对应 `views/QuickStart.*`（L1 聚合页）+ guide |
| 3 | 核心案例 | L1–L5 场景化梯度 | L1 上手 / L2 零事件联动 / L3 横切关切 / L4 vxe·virtual / L5 render·全局配置 |
| 4 | 组件 API | EsForm / EsTable / EsDialog / EsCrudPage / useDialog | 组件能力平铺 |
| 5 | 引擎 | vxe / virtual | 高性能引擎，突破组件库上限 |
| 6 | AI 工具链 | MCP / CLI / AiCrud | 三站都应有（MCP 能生成 vue2/vue3/antdv 三种 target） |
| 7 | 生态 | 迁移指南 / 竞品对比 / FAQ | 采纳与迁移路径 |

## 二、三站现状映射

### es-plus-docs（主站，7 组侧边栏）

| 骨架节点 | 现状侧边栏组 | 状态 |
|---|---|---|
| 首页 | —（Home 独立路由） | ✅ |
| 快速开始 | `起步`（quickstart / getting-started / installation / usage） | ✅ |
| 核心案例 | `高级用法`（use-dialog / linkage / vxe-table） | ⚠️ 部分（无显式 L1–L5 分组） |
| 组件 API | `组件`（es-form / es-table / es-crud-page） | ✅ |
| 引擎 | `高级用法`（vxe-table） | ✅ |
| AI 工具链 | `AI 编码`（mcp-server / cli）+ `工具`（ai-crud / playground） | ✅ |
| 生态 | `跨框架`（vue2 / adapter-antdv / migration）+ `参考` | ✅ |

### es-pc（AntDV，侧边栏 DocLayout）

| 骨架节点 | 现状菜单 | 状态 |
|---|---|---|
| 首页 | `home` | ✅ |
| 快速开始 | `quickstart`（30 秒上手）+ `guide`（快速上手） | ✅ |
| 核心案例 | ❌ 无（`advanced-group` 仅高级联动/vxe） | ❌ 待补 |
| 组件 API | `components-group`（es-form / es-table / es-dialog / es-crud-page） | ✅ |
| 引擎 | `advanced-group`（es-vxe-table） | ✅ |
| AI 工具链 | `ai-tools` | ✅ |
| 生态 | ❌ 无 | ❌ 待补 |

### es-eui（Vue 2 + Element UI，顶部导航 + 子页侧边栏）

| 骨架节点 | 现状导航 | 状态 |
|---|---|---|
| 首页 | `/`（顶部导航） | ✅ |
| 快速开始 | `/quickstart` + `/guide`（顶部导航） | ✅ |
| 核心案例 | ❌ 无显式分组（examples 平铺于组件文档） | ⚠️ 待对齐 |
| 组件 API | `/component`（estable / esform / esdialog / vxetable / combination） | ✅ |
| 引擎 | `/component/vxetable` | ✅ |
| AI 工具链 | `/ai-tools`（本轮已补） | ✅ |
| 生态 | ❌ 无 | ❌ 待补 |

## 三、各站补齐动作

### 已落地（2026-08 本轮）
- **三站 L1「30 秒上手」聚合页**：es-plus-docs / es-pc / es-eui 均建 `QuickStart`，作为「核心案例」的 L1 入口。
- **三站 L2「零事件 CRUD」头号案例**：三站首页 C 位 + 并排 diff（`CodeDiff` 组件）。
- **es-eui AI 工具链页**：`/ai-tools`，补齐「AI 工具链」节点。

### 待落地
- **es-pc 补「核心案例」组**：`DocLayout.vue` 菜单新增「核心案例」分组，聚合 L1（quickstart）+ L2（首页头号案例）。
- **es-eui 顶部导航 → 侧边栏骨架**：es-eui 当前为顶部导航 + 子页侧边栏，宜收敛为与主站同构的侧边栏骨架（`/guide`、`/component` 已具备侧边栏雏形，待统一分组）。
- **三站补「生态」组**：迁移指南 / 竞品对比 / FAQ（es-plus-docs 已有 migration + why-es-plus，es-pc / es-eui 缺）。
- **三站「核心案例」显式 L1–L5 分组**：当前案例按组件平铺，待以 L1–L5 梯度重组（见 `改造三端站点.md` §3.2）。

## 四、一致性守护

- 骨架变更以本文档为单一真源，三站导航据此对齐。
- 品牌文案 / token / 三端快照分别由 `scripts/sync-brand.mjs` / `sync-tokens.mjs` / `sync-tri-render.mjs` 分发并 `--check` 防漂移；站点结构暂以本文档人工守护，后续可扩展为 `sync-structure` 脚本。
