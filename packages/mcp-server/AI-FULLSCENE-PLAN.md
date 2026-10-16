# @es-plus/mcp-server — 全场景 AI 原生能力 · 最优方案（2026-10-15）

> 本文是 [ROADMAP.md](./ROADMAP.md) 的执行面：ROADMAP 记「做什么/为什么」，本文记「按什么顺序做、每条怎么验收、哪几处是把前序结论**更正**过的」。
> 所有断言均落到源码行（2026-10-15 全量复核）。带 **❌ 更正** 的是对前几轮结论的修正，不是新增意见。
> 配合设计文档：`docs/internal/wave-1-eval-trust-design.md` / `wave-2-production-trust-design.md`。

---

## 1. 设计公理（不可违背，其余一切由此推导）

| # | 公理 | 由来 |
|---|---|---|
| P1 | **一份 JSON → Schema 校验 + 确定性编译 → 三端可运行**（Vue3+Element Plus / Vue2+Element UI / Vue3+Ant Design Vue） | 项目宗旨 |
| P2 | **mark-never-drop**：任何不可达必须**告警 + 登记台账**，绝不静默丢弃 | 三端一致性 |
| P3 | **度量先行**：无产物 = 无完成定义 | 本轮打穿度量可信度后确立 |
| P4 | **守卫先行**：先有护栏再施工（倒过来 = 在没有护栏的桥上施工） | 工程文化 |
| P5 | **四档可达性（A/B/C/D）是受守卫的单一真源**，档位由令牌**最弱档**派生（`rowTier`） | AI-25 |
| P6 | **函数值 / 引擎专有 = Tier-3 逃生舱**；**宿主编排 = D 边界**，写进公开文档 | AI-16 边界 |

---

## 2. 现状定档（实测，非估计）

| 维度 | 实测值 | 判定 |
|---|---|---|
| **编译率** | `compileRate: 1`（186 例 × 3 端 × 2 模式） | ✅ **硬指标已达且稳定** |
| **准确率（core / exactIntentCore）** | `0.3043`（29 例陈旧产物） | 缺口在准确率侧 |
| **准确率（∨ 定义）** | `definition95.rate: 0.7391`（17/23） | 未达 95% |
| **度量新鲜度** | 产物停 `2026-10-12`，今 `2026-10-15`，**断供 3 天** | ❌ 无可信产物 |
| **门禁口径** | 钉 `exactIntentCore`；`definition95` 只观测 | ❌ 口径错位 |
| **可达性台账**（`docs/ai/feature-coverage.json`） | A 28 / B 12 / C 28 / D 28 | 声明式 A+B = 41.7% |
| **被测路径** | eval 只调 `generateFromConfig`，**0 次调前门 `generate_crud`** | ❌ 被测 ≠ 宣称主路径 |

**不可空转的根基**：`eval-llm.mjs` 的编译校验走 `generateFromConfig`（`:39`/`:215`），而 MCP 前门 `generate_crud` 自称 "FRONT DOOR"（`generate-crud.ts:132`）——**被测路径 ≠ 宣称主路径**，坐实。

---

## 3. 目标定义（可验收，一句话）

> **heldout（先扩到 ≥60 例纯泛化）上的 `definition95 = scoped zero-edit ∨ ≤K=3 收敛` ≥ 95%；`exactIntentCore` 并列公布（诊断，不进 exit code）；任一维度不得低于上一基线；编译率恒 100%。**

**为什么是 ∨ 而非 core**：产品形态内含 `validate_config + refine_config + 宿主重试`，**≤K 轮收敛就是实际使用路径**（TypeChat 同构：repair 回路是系统的一部分）；one-shot exact 当门禁 = 永久红 = 红盲。

**但 ∨ 单独做门禁有已知弱点**（加简单语料可稀释均值）→ **必须配 per-dimension ratchet + core 地板**，三者缺一即有失效模式：

| 组合 | 失效模式 |
|---|---|
| core 当门禁 | 永久红 → 红盲 |
| ∨ 单独当门禁 | 扩语料稀释均值 |
| **∨ + ratchet + core 地板** | ✅ 无已知失效模式 |

**稳定性前提**：scoped 与 convergence 均为**确定性打分**（scripted refinements），可复现。**heldout 只有 23 例时单例 = 4.3pp，>95% 门禁在 23 例上是噪声** → **先扩 heldout 再上 ∨ 门禁**。

---

## 4. 三波执行计划（依赖驱动，非编号驱动）

> **度量（W1）定义「完成」→ 守卫（W2）保证「修的时候不引入新漂移」→ 接线（W3）才是修复本身。**
> 倒过来做：先修接线再补守卫 = 无护栏施工；先谈口径再修管道 = 给不走的表校准。

### Wave 0 · 止血（今天，零风险）

| # | 动作 | 核对 |
|---|---|---|
| 0.1 | 提交推送 **AI-29~34 条目**（含本方案三处更正） | ⚠️ AI-26/27/28 已推（`9247f6b` ∈ `origin/develop`），**别重复提交** |
| 0.2 | 两个徽章回灰 `pending nightly`（`last-accuracy-badge.json` + `last-accuracy-badge-scoped.json`） | ✅ ROADMAP:93 确记 AI-04 设计过该占位态；展示层止血，非根因修复 |
| 0.3 | AI-31/AI-34 条目按 §8 更正重写 | 见 §8 |

### Wave 1 · 度量地基（AI-33，2–3 天）

| # | 动作 | 验收（变异 → 红） |
|---|---|---|
| 1.1 | 查清 nightly 3 天断供根因（secret/调度）→ 跑全量付费 eval | 由 **nightly workflow** 回写产物；**本地跑完必须还原，不得本地提交**（本仓铁律） |
| 1.2 | 门禁 `gateExact` → `definition95`；core 保留并列输出 | 篡改 ∨ 分数 → `exit 1` |
| 1.3 | **徽章与门禁同源**（徽章 = ∨，非 core） | 防「CI 绿、徽章红」次级红盲 |
| 1.4 | **core 非回归地板**（如 <20% 直接红） | 收敛腿掩盖 core 崩塌 → 红 |
| 1.5 | `last-accuracy.json` 增 `byDimension` 基线 + 「维度 < 基线 → 红」检查；**并加防「删难例洗分」守卫** | 某维度退步 / 难例被抽走 → 红 |
| 1.6 | **补 6 条 few-shot COVERAGE 断言**：`reactions`、`columns/columnGroups`、`expandConfig`、`treeConfig`、`editConfig`、**`mergeConfig`** | ❌ **更正：是 6 个不是 5**（你漏了 `mergeConfig`：`scorers.mjs:332` 有该维度、COVERAGE 19 条里无）；删示例 → 红 |
| 1.7 | **扩 heldout 到 ≥60 例**（纯泛化），与 1.6 的新 few-shot 分离 | ❌ **反噬警告**：补 COVERAGE 会迫使加 few-shot → 若不同步扩 `FEWSHOT_DERIVED`（`eval-llm.mjs:67`）与 heldout，**诚实语料缩水**，与目标自相矛盾 |
| 1.8 | **eval 扩前门冒烟**：对 `generate_crud` 至少跑一遍 | 被测路径 = 宣称主路径 |

### Wave 2 · 契约守卫（AI-26 + AI-29 + AI-32，1–2 天）

| # | 动作 | 验收 |
|---|---|---|
| 2.1 | **双份 Zod 全等断言**（`configShape` 顶层键集 === `schemaKeys`），替换枚举清单式 | 任一侧加游离键 → 两守卫全红 |
| 2.2 | `readReachability` **下潜 `dialogs`**（产 `dialogKeys`），与 AI-26 的 `STRUCTURED_DIALOG_CONTRACT` 合用 | 改 dialog 键 → 红 |
| 2.3 | **MCP resource 第三份对齐**：`crud-page-schema.ts:58-66` 的 `render` 是 **3 参**（运行时 2 参）、叫 **`onCancel`**（运行时 `onClose`）、`formLayout` 缺 `span`、缺 `configBtn/isDraggable/maxHeight/fullscreen/onOpen` → **从真实类型生成或加全等断言** | ✅ 属实：教给 LLM 的契约是假的 |
| 2.4 | `check-feature-coverage` 补 **B 档第二腿**：「`from_config` 真能发射该键」 | 删发射 → 台账红 |
| 2.5 | **`TABLE_INTERNAL_KEYS` 三端 diff 进 `check:parity`** | ✅ 数字核实：v3=41/v2=42/antdv=31；`v3\antdv` = **恰 17 个 vxe 键**、`v2\v3` = **`lazyLoad`**。⚠️ 登记为「集合差」而非「antdv 缺 vxe 支持」（反向看 antdv 有 7 个 v3 没有的：`border/emptyText/headerCellStyle/highlightCurrentRow/showHeader/size/stripe`） |
| 2.6 | `vxeFirstClass` 降 C/D + 台账改正 | ✅ 11 键在 shared+mcp src 除文档串外**出现 0 次** |

### Wave 3 · 接线修复（AI-27 + AI-30 + AI-31 + AI-34，3–5 天）

> **状态：✅ 本批已全部落地（2026-10-16）**——逐项状态、偏离与变异验证见 [ROADMAP.md](./ROADMAP.md) 的 AI-27 / AI-30 / AI-31 / AI-32 / AI-34 状态行。
> 落地期间新增两条与本批直接相关的结论：
> - **AI-27 的三处偏离**（`render`/`renderHeader`/`renderFooter` **不收**；`configBtn` 字段名是 `name` 非 ROADMAP 原文的 `label`）——理由见 ROADMAP §AI-27。
> - **新发现 AI-35 · ✅ 已修（2026-10-16）**：显式 `dialogs` 模式下 `dialogs.add` 可能**无任何入口**（三端 `normalizedToolbarBtns` 在见到 `dialogs` 时返回 `[]`，而 `normalizedOperationColumn` 不认 `dialogs` 照旧派生 → 只有「新增」全灭且零告警）。188 例语料里 **6 例**命中。**修法**：`dialogs` 从工具栏门的判据里摘掉（三端同改，按钮照旧由 `actions` 派生）+ 生成器 `findDialogsWithoutOpener` 非静默告警 + 反向修正 AI-27 那条自相矛盾的教学规则 + `check-threeway-consistency` 新增**轴⑤ 弹窗可达性**静态锁与语料重放。**依据是已发布契约而非猜测**：schema 的 `columns.describe` 早已写「按钮仍由 `actions`/`operationColumn` 派生」。**语料零改动**——原 6 例无需补一个字节即达，反证缺陷在运行时判据。**变异验证**：把 `|| schema.dialogs` 加回 → 轴⑤ + 两处运行时见证同时红。

| # | 动作 | 更正 / 边界 |
|---|---|---|
| 3.1 | **AI-31 表单 render 接线**：`buildFormItem`（`structured-generator.ts:1034-1095`）补 emit + esbuild 门 + 降级告警（与表格 render 同待遇） | ✅ `renderFields` 只扫表格字段（`:157`） |
| 3.2 | **dialog 5 键裁决**：`{render, configBtn, onOpen, onConfirm, onClose}` | ⚠️ 其中 **4 个是函数值** → Tier-3 通道（须新建）；**只有 `configBtn` 可声明式**。别按「5 个一起声明式」落 |
| 3.3 | ~~`hasCustomRender` AI schema 删除~~ → **❌ 更正：不可删** | 它**有真实消费者**：`generate-from-config.ts:648` 用它放行「无 formItems 的变更型弹窗」，生成器 `:288-290`/`:986-989` 用它派生 TODO 槽 + 告警。**正解 = 对齐语义 + 写文档** |
| 3.4 | ~~`formLayout.span` 组件补转发（一行）~~ → **❌ 更正：假修** | core **无 layout 级 span 消费者**（只读字段级 `item.span`：`form-layout.ts:63`/`field-resolver.ts:174`）。正解二选一：**(a) core 把 layout 级 span 当默认值应用到未配字段**，或 **(b) 从 schema/文档删除**。另 `scorers.test.mjs:67` 拿 `formLayout:{span:12}` 触发 formLayout 维度 → **在给死键记分**，一并处理 |
| 3.5 | **AI-30 SFC 三键补发**（`estimatedRowHeight/overscanCount/rowClassName`）+ `height` 解绑 virtual 门 + `dialogs/tableBtns` 丢项**显式告警进 SFC 能力表** | ✅ schema 发（`:223-225`）SFC 不发（`:577-606`） |
| 3.6 | ~~AI-34「7 键补扫」~~ → **❌ 更正：前提落空**（见 §8.3）。**AI-34 改为机制版「三向一致性扫描」** | 逐键断「Zod 声明 ⊆ 生成器发射(双模式) ∪ 显式降级登记」且「发射 ⊆ 消费 ∪ 白名单」 |
| 3.7 | 每个修复带 **golden 用例 + 运行时见证**（复用 `generated-runtime.spec.ts`） | 三端真生效 |

---

## 5. 全场景覆盖矩阵（es-plus 三端 × 四档）

| 场景 | A（前门一步） | B（from_config） | C（逃生舱） | D（边界） |
|---|---|---|---|---|
| **es-table** | 基础列 / 合并 / 树 / 展开 / 虚拟 / 内联编辑 | 富列数组 `columns`、分组表头 | vxe 深键、`formatter` | — |
| **es-form** | 控件类型 / 校验 / 联动 / 条件显隐 | — | 表单字段 `render`、`httpRequest`/`on` | — |
| **useDialog** | `dialogs` 多弹窗（前门经 `surfaces.dialog`） | — | `render`/`configBtn`/`onConfirm` | 12 例编排、分步向导、动态字段集、偏好持久化 |
| **组合** | EsCrudPage 单 schema 整页 | — | — | 整页骨架 / 后台布局 |

> **D 档必须写进公开文档「能力边界」章节**，让用户生成前就知道——这是「全场景」诚实性的下限。

---

## 6. 验收范式（项目既有工程文化）

**每条 = 一个变异 → 守卫红**（meta-eval / 负测 / mutation 验证都是现成的）：

1. 前门加非清单键 → 2.1 红
2. 删 B 档令牌发射 → 2.4 红
3. 某维度退步 → 1.5 红
4. 删 few-shot 示例 → 1.6 红
5. SFC / schema 同配置异产物 → 3.5 红

---

## 7. 风险与回退

| 风险 | 回退 |
|---|---|
| Wave 1 唯一外部依赖 = 付费 eval（PPIO 中继，费用真实） | 额度受限时**先用 29 例子集刷新产物，但必须标 `subset:29`**——29 例与现 186 例**分布不同**，不标 = 又一次口径断层 |
| 其余全为确定性本地工作 | 无回退风险 |

---

## 8. 三处硬伤更正（对前序结论的修正，须回写 ROADMAP）

### 8.1 `hasCustomRender` **不可删**
它不是「发射未消费」的幽灵——**有真实消费者**：
- `generate-from-config.ts:648` 用它**放行「无 formItems 的变更型弹窗」**（校验豁免）；
- `structured-generator.ts:288-290`（schema 模式置位 + 告警）、`:986-989`（SFC 模式派生 `TODO(es-plus)` 槽）。

准确表述：**它是 AI/生成器侧 hint 键，未进运行时 `CrudDialogConfig` 类型** → 是**契约不一致（AI-only key）**。**正解 = 对齐语义 + 写文档**，不是删除。

### 8.2 `formLayout.span`「补转发一行」是**假修**
core **无 layout 级 span 消费者**——只读**字段级** `item.span`（`form-layout.ts:63` / `field-resolver.ts:174`）。把 span 送进 `formLayProps` **没人读** → 「看起来修了其实没效果」。正解二选一：**(a) core 把 layout 级 span 当默认值应用到未配 span 的字段**，或 **(b) 从 schema/文档删除**。
附：`scorers.test.mjs:67` 用 `formLayout:{span:12}` 触发 formLayout 维度 → **在给死键记分**。

### 8.3 AI-34「7 个键补扫」前提**落空**
14 键矩阵实测（`sharedZod` = shared schema 声明 / `genEmit` = 生成器发射 / `mcpFromCfg` = from_config Zod）：

| 键 | sharedZod | genEmit | mcpFromCfg | 判定 |
|---|---|---|---|---|
| `cachePageSelection` | ✓ | ✓ | ✓ | **已齐全** |
| `localPagination` | ✓ | ✓ | ✓ | **已齐全** |
| `defaultSort` | ✓ | ✓ | ✓ | **已齐全** |
| `emptyText` | ✓ | ✓ | ✓ | **已齐全** |
| `refetchKeepPage` / `snIndex` / `showHeader` / `leftText` / `heightType` / `tabHeight` | ✓ | ✓ | ✓ | **已齐全** |
| `showFooter` / `footerData` | — | — | — | 未建模 → 归 **AI-29**（vxe 键） |
| `isInitRun` / `entryQuery` | — | — | — | 未建模 → 归 **AI-31**（字段级） |

即 **10 个早已端到端齐全**，真未建模仅 **4 个**（且已归口）→ **AI-34 净新增 ≈ 0**。故 AI-34 只按**机制版「三向一致性扫描」**落，不得写成「补 7 个键」。

---

## 9. 与 ROADMAP 的对应

| 本文 | ROADMAP 条目 |
|---|---|
| Wave 0 | 「当前执行计划」表 |
| Wave 1 | **AI-33**（度量管道修复 + ∨ 口径拍板） |
| Wave 2 | **AI-26**（dialog 守卫轴）· **AI-29**（vxeFirstClass 降档 + B 第二腿）· **AI-32**（契约全等守卫 + MCP resource 对齐） |
| Wave 3 | **AI-27**（dialog 配置面收敛）· **AI-30**（SFC/schema 对齐）· **AI-31**（表单扩展点接线，含 §8.1/§8.2 更正）· **AI-34**（三向一致性扫描，含 §8.3 更正） |
