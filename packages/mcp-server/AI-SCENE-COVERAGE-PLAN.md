# @es-plus/mcp-server — 全场景（四场景）覆盖方案 · 执行面

> **本文扩展，不覆盖** [AI-FULLSCENE-PLAN.md](./AI-FULLSCENE-PLAN.md)（后者在其自身范围内——CRUD 配置路径——经复核**正确**）。
> 本文补的是它**缺失的那条轴**：**场景覆盖**。
>
> 立项依据：2026-10-15 全量深度复核（四路独立源码审计 + 逐条抽验）。所有断言落源码行；与既有结论冲突处标 **❌ 更正**。

---

## 0. 一句话结论

> **「全场景 ≥95% + 编译 100%」当前不是「没做到」，而是「不可证」——你点名的四个场景里，只有第四个（CRUD 组合）有测量装置，另外三个（独立 es-table / es-form / useDialog）零度量。**
> 所以顺序必须是：**先让四场景同等可测（W1）→ 再守契约（W2）→ 再接线（W3）→ 再对齐独立场景表达力（W4/W5）**。

---

## 1. 复核实测（证据链）

### 1.1 硬指标的真实边界

> **⚠️ 本节初稿有四处事实错误，已按 Wave 0 落地前的逐条复核更正。** 初稿读的是 develop 工作区里那份快照，误把「分支分叉」当成「夜间断供」。教训本身即是方法论：**产物类结论必须指明读的是哪个 ref**。

| 指标 | 实测 | 依据（ref 已注明） |
|---|---|---|
| `compileRate` | `1` | `__tests__/golden/last-accuracy.json`（develop，2026-10-12） |
| `definition95`（∨） | **0.7391**（17/23） | 同上；`eval-llm.mjs` 明注「只观测、不门禁」 |
| `attributeAccuracy` | 0.9305 | 同上 |
| **公开徽章** | **0.0% / 0.0% 双红** | `origin/master:…last-accuracy-badge{,-scoped}.json` |
| 夜间调度 | **未断供**：10-10 → 10-14 每夜都有提交 | `git log origin/master -- __tests__/golden/last-accuracy.json` |
| 语料规模 | master **29** / develop **186** | `git ls-tree origin/master -- __tests__/golden/cases` |
| **❌ 初稿说「双红 30.4%/60.9%、断供 3 天」** | **错**：30.4% 是 develop 快照；master 真实徽章是 **0.0%**，且夜间一直在跑 | — |

**所以 master 上的公开徽章不是「陈旧」，是「伪造的零」**（见 F6）。

### 1.2 四场景 × 测量装置矩阵（**本审计核心**）

| 宣称场景 | eval-llm? | golden? | vite build? | 运行时? | 实际被谁验证 |
|---|---|---|---|---|---|
| 独立 `es-table`（`generate_table`） | ❌ | ❌ 0 | ❌ | ❌ | 仅 `compile-smoke` esbuild 语法解析 |
| 独立 `es-form`（`generate_form`） | ❌ | ❌ 0 | ❌ | ❌ | 同上 |
| 独立 `useDialog`（`generate_dialog`） | ❌ | ❌ 0 | ❌ | ❌ | 同上 |
| CRUD 组合 | ⚠️ 仅 `generateFromConfig`（**后端**），**从不调前门 `generate_crud`** | ✅ 186 | ✅ | ✅ vue2 | config→code 断言 + vite build |

**证据**：`eval-llm.mjs` 只 import/call `generateFromConfig`（`:39` / `:215`）；186 例 golden 全是 `StructuredCrudConfig`；`scripts/compile-smoke.mjs`（唯一片段门）**不在 `check:consistency`**（`package.json:52`）。

### 1.3 既有规划复核

| 结论 | 判定 |
|---|---|
| AI-01~AI-34 的源码断言 | ✅ 逐条抽验**几乎全部成立**（含 `formLayout.span` 死键、`hasCustomRender` 不可删、AI-34 前提落空） |
| 整套 Wave 0–3 地图 | ⚠️ **只画了一条路**（CRUD 配置）：AI-06/07/08/09/21/22/23/25/26/27/30/31/32/33/34 全属此路；独立 useDialog 仅 AI-28 一条且「未落地」；独立 es-table/es-form **零条目** |
| `config.permissions` = 死键 | **❌ 更正（推翻）**：其消费者是**生成器**——`structured-generator.ts:512/516/520`、`:1285/1289/1293` 把 `permissions.add/edit/delete/...` 物化为按钮 `permissionValue`，后者真被运行时消费（三端 `esPlus.permission(code)`）。**它不是死键**；真死键只有 `formLayout.span` |

---

## 2. 结构性发现（每项附证据）

### F1 · 被测集合 ⊊ 宣称集合
见 §1.2。附带：`generate_crud_page` / `generate_crud_schema` / `list_form_types` **零测试零守卫**，且前两者是 NL→config 的陈旧重复实现。

### F2 · 片段路径无任何契约/可达性守卫
`check-fragment-contract.mjs` 是**名字陷阱**——只锁 `SurfaceField` ↔ zod3 镜像的词表（`_fragment-shapes.ts:47-114`），**从不运行** `fragment-generator.ts`。
→ 后果：**任何新加进 `FieldConfig` 的能力，静默不到达独立 es-table/es-form/useDialog**——正是 `check-entry-contract.mjs` 自称在守的那条轴。

### F3 · 双模式无告警静默丢弃（违反本项目 P2「mark-never-drop」）

| 键 | schema | sfc | 告警 |
|---|---|---|---|
| `height`（无 `virtual`） | 发 `structured-generator.ts:218` | 丢（门 `:577` `if(tOpts.virtual)`） | **无** |
| `estimatedRowHeight`/`overscanCount`/`rowClassName` | 发 `:223-225` | 丢 | **无** |
| 自定义 `headerCellStyle` | 尊重用户 `:213` | 硬编码 `#f5f7fa` `:572` | **无** |
| 顶层 `formLayout` | 发 `:259-261` | 从不读 | **无** |
| `pagination.pageSizes` | 丢 `:304` | 发 `:494` | **无** |

对照：`dialogs`/`tableBtns`/`toolbarBtns`/`operationColumn` 在 SFC 下**有**集中告警（`:389-410`）。即"有告警的都在，没告警的反而静默丢"。

### F4 · dialog 契约三向漂移 + 独立 useDialog 三端不等价
- 运行时 `CrudDialogConfig` **13 键** vs AI `DialogConfigSchema` **9 键**（**闭合对象 → 静默剥**）。
- antdv `useDialog` **完全没有 `cacheKey`/TTL**（vue3/vue2 有）；已登记 `MEMBER_DEVIATIONS`（`check-type-exports.mjs:103`）。

### F5 · emits 契约无人守望（逐条复验）

| 组件 | 偏差 | 性质 |
|---|---|---|
| es-form `confirm`/`reset` | vue3 声明+定义（`es-form.vue:507-508`）但**无按钮绑定**；vue2/antdv 连声明都无 | **惰性声明**（宿主写 `@confirm` 得到静默） |
| es-dialog `open` | vue3/vue2 有；**antdv `defineEmits` 只有 `update:visible`/`closed`**（`component.vue:179-182`） | 真跨端差异 |
| es-table `update:dataSource` | vue2 **已移除**（代码注释 `component.vue:1013` 自述） | **有意为之**，但只在散文注释里、无机器守卫 |

任何 `check-*.mjs` 都**不校验 emits**。

### F6 · 度量管道无法区分「测量未发生」与「模型得 0 分」（**Wave 0 复核时新发现，最紧急**）

**现象**：`origin/master` 的公开徽章现为 **0.0% 红**，夜间 10-13、10-14 连续两晚写入全零产物
（`compileRate: 0`，且**每个维度 `applicable: 0`**）。

**根因链**（逐行核实）：
1. 逐 case 失败也照常入行：`eval-llm.mjs` catch 分支推 `{…, compiles:false, byCapability:{}, error}`。
2. 聚合后 `applicable` 全零 → 门禁 `gateExact = 0` → 徽章按阈值算成 `red` / `"0.0%"` → **照常写入**。
3. workflow 的 commit-back 是 **`always()`**（含红跑）→ 伪造的 0.0% 被提交回 master。

**为何必然发生**：`--require-key` 只防**缺 key**（`eval-llm.mjs:92`），不防**无效 key**。中继 key 失效 → 逐 case 401 → 全零。
对照 memory `ppio-eval-relay-config`：「GitHub secret 必须是 PPIO key，否则**全 401**」。

**为何危险**：`applicable: 0` 意味着**没有任何 gold 走到打分器**——这是一次**基础设施故障**，
却被公开发布成「模型得 0 分」。它看起来完全像一次真实的灾难性回归，**因此天然不可察觉**。
这正是本项目最想消灭的失效模式：**一个不会被任何人怀疑的假信号**。

**已修（Wave 0.2）**：在聚合之后、写产物之前加**健康门**——`propSet/formtype/membership/actions`
四维恒 `applicable: () => true`（`scorers.mjs:267-270`），故任一**成功打分**的行必给 applicable 累加 ≥4。
于是「所有维度 applicable 合计为 0」⟺ 测量根本没发生 ⟹ **拒绝发布百分比**，改写 `measurement: "failed"`
记录 + 灰度 `measurement failed` 徽章 + `exit 1`。已用 **master 10-14 真实故障产物**回放验证：对故障产物触发、对健康产物不触发。


---

## 3. 设计公理（沿用 P1–P5，新增两条）

| # | 公理 | 由来 |
|---|---|---|
| P1–P5 | 一份 JSON 三端可运行 / mark-never-drop / 度量先行 / 守卫先行 / 四档可达性 | 既有 |
| **P6** | **「全场景适配」四腿判据**：任一能力只当 ①权威 schema 声明 ②**双模式**发射 ③**三端**消费 ④**三端**被测（golden + 运行时）**同时成立**才算达标 | 本审计 |
| **P7** | **每个生成场景必须由同一语料格式测量，且必须进 `check:consistency`**；不允许任何场景停留在「syntax-smoke only」 | 本审计 |

---

## 4. 执行计划（Wave 0–6，依赖驱动）

### Wave 0 · 止血 ✅ **已落地（2026-10-15）**

| # | 动作 | 状态 / 核对结论 |
|---|---|---|
| 0.1 | ~~双徽章回灰 `pending nightly`~~ → **❌ 取消，前提被复核推翻** | 初稿以为徽章「陈旧」。实测：master 夜间**未断供**（10-10→10-14 每夜提交），徽章是**新鲜的 0.0%**。回灰会抹掉一次**真实测量**——比错误更糟。**真问题在管道，不在徽章**，见 F6 |
| 0.2 | **修度量管道健康门**（F6） | ✅ 已加：`applicable` 全零 ⟹ 拒绝发布百分比，写 `measurement:"failed"` + 灰度徽章 + `exit 1`。真实故障产物回放验证通过 |
| 0.3 | 更正过期工具名（AI 面向 + 公开文案） | ✅ 见下 |
| 0.4 | 本文件落盘 + §1.1 事实更正 + F6 记录 | ✅ |

#### 0.3 明细（复核后范围比初稿更大）

初稿只写了「更正 `ai-tools` 里的过期名」。复核发现更严重的两处：

1. **`packages/mcp-server/src/index.ts:26-27`** —— 这是**直接喂给 LLM 的 server instructions**，
   它让 AI 去调 `generate_from_config`，而**该工具不存在**（实名 `generate_crud_from_config`），
   且该行的工具清单**漏了 5 个**（含前门 `generate_crud`）。同行 `:70`/`:109` 反倒是正确的。
2. **`docs/why-es-plus.md` 把 `generate_crud_schema` 标为「主路径：由宿主 LLM 语义推理生成」** ——
   源码显示它是 `generateCrudSchema(description)` → `generateCrudConfig()`，
   即 `crud-engine.ts` 里的**中文关键词/正则解析**（`/状态|启用|禁用/`…），**零 LLM 调用**。
   而 `index.ts:130` 明说主路径是前门 `generate_crud`。→ 该行**同时错了两件事**。

已修：`index.ts`（工具清单补全 + 改名）、`docs/ai/ai-tools.{json,md}`（flow 改为前门链路，`ai:sync` 分发三站）、
`docs/why-es-plus.md` + `.en.md`（工具表重写 + 工作流改为前门 5 步 + 顺带修正 en 版 formtype 数 13→**14**，真源 `contract.ts`）、
`docs/promo/{blog-juejin,twitter-thread}.md`。

**验证**：`ai:check` / `docs:check` / `check:site-claims` / `check:docs-layout` / `check:api` / `check:readme` / `check:contract` 全绿；mcp-server `tsc --noEmit` 通过；全仓 `generate_from_config` 零残留。
（`packages/mcp-server/CHANGELOG.md:180` 与 `*/dist`、`build/` 为历史/生成物，**不改**。）


### Wave 1 · 让「全场景」可测（**最高杠杆，先于一切修复**）

| # | 动作 | 验收（变异 → 红） |
|---|---|---|
| 1.1 | **场景分类法**：语料统一为 `{scene, config, target, mode}`，`scene ∈ {crud, table, form, dialog}` | 新场景无语料 → 红 |
| 1.2 | **片段路径进 `check:consistency`**：`compile-smoke` 升格为门禁 + 新增 `check-scene-coverage`（断「四场景 × 三端 × 两模式」无空格） | 删任一场景覆盖 → 红 |
| 1.3 | **前门进 eval**：对 `generate_crud`（含 no-table 分支）至少跑一遍 | 前门回归 → 红 |
| 1.4 | AI-33 原 8 条（门禁迁 ∨ + core 地板 + per-dim ratchet + 徽章与门禁同源 + 补 6 维 COVERAGE + heldout ≥60 + 防删难例） | 篡改 ∨ / 维度退步 / 删语料 → 红 |

> **反噬警告**：补 COVERAGE 会迫使加 few-shot，而 `FEWSHOT_DERIVED`（`eval-llm.mjs:67-74`）只登记 **6** 个文件、few-shot 已有 **14** 条 → **heldout 必须先扩再上 ∨ 门禁**。

### Wave 2 · 契约守卫补齐（守卫先行）

| # | 动作 |
|---|---|
| 2.1 | **AI-26 + AI-32**：dialog 契约双份全等 + `readReachability` 下潜 `dialogs` + MCP resource 第三份对齐 |
| 2.2 | **AI-29**：`vxeFirstClass` 降档 + B 档「第二腿」（断「声明的键真能经 from_config 发射」） |
| 2.3 | **S4 · emits parity 守卫**：三端 `emits` 键集 diff 进 `check:renderer-parity`；F5 三条逐条「修 or 登记 + 原因非空」 |
| 2.4 | **S5 · 跨模式差异台账**：F3 五键进登记表，**要么补齐、要么发告警** |

### Wave 3 · 接线修复

| # | 动作 |
|---|---|
| 3.1 | **AI-27** dialog 配置面收敛 + 消除 `openDialog` 硬编码 9 键转发 |
| 3.2 | **AI-30** SFC/schema 对齐（含 F3） |
| 3.3 | **AI-31** 表单 `render`/`on`/`httpRequest`/`isInitRun` 接线 + `formLayout.span` 死键裁决 |
| 3.4 | **AI-34** 三向一致性扫描 |
| 3.5 | **AI-21 余项** + **AI-28**（useDialog 骨架 + options 块） |

每条带 **golden + 运行时见证**。

### Wave 4 · 独立组件场景对齐（**新增——「最贴合 es-plus」的关键**）

**问题**：独立生成入参是**窄 ad-hoc 表**——`generate_table` 7 键（`tableOptions` 仅 5 个布尔）、`generate_dialog` 7 键（**宽度/底部按钮硬编码，传不进任何 DialogOptions**），而 CRUD 侧同族词汇已有 `FieldConfig` 24 / `TableColumn` 15 / `TableOptions` 26 键 → **文档站 demo 能做的独立表格/表单/弹窗，AI 生成不出来**。

**方案**：新增 `EsTableConfig` / `EsFormConfig` / `EsDialogConfig`（**严格复用** `FieldConfig` / `TableColumn` / `TableOptions` / `DialogOptions` 的**数据子集**），三个片段工具 + `validate_config` 一并接受。

**收益**：① P1「一份 JSON」字面成立；② 既有守卫（entry-contract / feature-coverage）**自动覆盖**；③ 语料格式统一，度量成本低。**风险**：纯 AI 契约层扩展，**不动组件源码**。

### Wave 5 · 三端组件偏差裁决（**新增**）

逐条「修 or 登记」，禁止「声明了等于承诺不存在的能力」：

| 偏差 | 建议 |
|---|---|
| antdv `useDialog` 无 `cacheKey`/TTL | **修**（对齐 vue3/vue2） |
| antdv `ColorPicker` 降级原生 input | 登记（已有 `FORM_RENDER_CONTRACT:27`）+ AI 教学告知 |
| `engine:'virtual'` 真引擎 vue3-only | 登记 + AI 侧明确「三端安全子集」 |
| vue2 es-table 无 `update:dataSource` | 从注释升格为**机器登记** |

### Wave 6 · 准确率工程（与 W1 并行收口）

- `formLayout.span` 死键：core 落地为「未配字段默认 span」**或**从 schema/文档删除（二选一）；同步修 `scorers.test.mjs:40` 的「给死键记分」
- 清理零覆盖工具（`list_form_types` / `generate_crud_page` / `generate_crud_schema`）：**删或补测试**，不许悬空

---

## 5. 硬指标如何被强制（可验收）

```
前置（Wave 0 已落地）: 测量未发生 ⟹ 不发布百分比（健康门，见 F6）
                      ——「没有数字」必须长得和「数字是 0」不一样
编译率 100%  := 四场景 × 三端 × 两模式 的**全部**语料 vite build 通过
                （今天只对 CRUD schema 路径成立；W1.2/1.3 后才四场景成立）
准确率 ≥95%  := 各场景 heldout 上 definition95 = scoped zero-edit ∨ ≤K=3 收敛 ≥ 95%
                + per-dimension ratchet + core 非回归地板 + 防「删难例洗分」守卫
门禁         := definition95 进 exit code；exactIntentCore 降为并列诊断
```

**稳定性前提**：scoped 与 convergence 均为**确定性打分**（scripted refinements）→ 可复现；
**heldout < 60 例时单例 = 1.7pp，>95% 门禁落在噪声上** → **先扩语料再上闸**。

---

## 6. 风险与回退

| 风险 | 回退 |
|---|---|
| 付费 eval（PPIO 中继，真实费用）是 W1 唯一外部依赖 | 额度受限时先跑子集，**必须标 `subset:N`**（master 29 例与 develop 186 例是**两个分支的不同语料**，分布不同，不标 = 口径断层） |
| Wave 4 扩 AI 契约面 | 纯加法、组件零改动；某键三端不等价 → 降 `knownGaps` 登记，**绝不静默** |
| 其余全为确定性本地工作 | 无回退风险 |

---

## 7. 与既有文档的对应

| 本文 | 既有 |
|---|---|
| §1.3 复核结论 | [ROADMAP.md](./ROADMAP.md) · [AI-FULLSCENE-PLAN.md](./AI-FULLSCENE-PLAN.md) |
| Wave 1.4 | AI-33 |
| Wave 2.1 / 2.2 | AI-26 + AI-32 / AI-29 |
| Wave 3 | AI-27 / AI-30 / AI-31 / AI-34 / AI-21 / AI-28 |
| Wave 0 / 1.1–1.3 / 2.3–2.4 / 4 / 5 / 6 | **本文新增（既有文档无对应条目）** |
