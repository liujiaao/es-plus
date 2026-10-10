# @es-plus/mcp-server — AI 原生能力 Backlog

> 工程内部路线图，不是公开文案（公开 AI 页文案在 [docs/ai/ai-tools.md](../../docs/ai/ai-tools.md)）。
> 来源：2026-10 的能力评估（Q5 四优先级 + Q6 五个全球借鉴点）。
>
> **Wave 1 已出技术实施方案**：[docs/internal/wave-1-eval-trust-design.md](../../docs/internal/wave-1-eval-trust-design.md)（P0 + AI-05，拆成 PR-1~4）。
>
> **一句话战略判断**：瓶颈不在模型，在 config schema 的表达边界。
> 不该放宽自由字符串逃生舱去「显得能力更强」，而该沿同一条确定性组合路线把
> **typed surface 往外扩**（把当前无法表达的特性建模进 schema），同时把 eval 从
> 单一合成分拆成**可信的按维度记分卡**。前者决定覆盖面，后者决定敢不敢说「生产可用」。

## 图例

**优先级**
| 级 | 含义 |
|----|------|
| **P0** | 可信度基建——没有它，「≥95% / 生产可用」是无凭据承诺。先做。 |
| **P1** | 低成本高回报——几小时到几天，直接抬准确率。 |
| **P2** | 扩 schema 表达力——决定能覆盖多少真实复杂场景（真正的瓶颈）。 |
| **P3** | 收敛逃生舱 + 补齐——把不可校验的自由字符串变成受控能力。 |

**工作量**：`S` ≤1d · `M` 2–5d · `L` 1–2wk · `XL` >2wk

---

## P0 · 评测可信（让「准确率」这个数字有凭据）

当前 `exactIntent` 只打分 fields + 4 个属性 + actions + tableBtn code，忽略
dialogs / operationColumn / permissions / apiParams / render / formatter / i18n /
virtualScroll / target / mode；且仓库里**没有** committed 的 `last-accuracy.json`。

### AI-01 — exactIntent 拆成按能力维度记分卡 · `M`
- **Why**：合成单分无法定位回归（「总分掉了」vs「dialog 维度掉了」是两件事）；现在度量的只是最容易的那一维。
- **验收**：eval 输出 per-capability 分（fields / formtype / membership / dialogs / actions / operationColumn / permissions / apiParams / i18n / target 各一分），回归报告按维度列出 diff。
- **可借 AI-17** 的平台能力，不必自造记分框架。
- **状态**：✅ 已落地（PR-1）。`scripts/eval/scorers.mjs` 16 维条件记分卡（纯函数、无 SDK）+ `scorers.test.mjs` meta-eval（gold-vs-gold 满分 + 每维扰动咬合）接入 `check:consistency`；`eval-llm.mjs` 输出 `byCapability` + 观测 `exactIntentFull`，门禁仍落历史 `exactIntentCore`（决策 B）。

### AI-02 — 补英文 NL eval 用例 · `S`
- **Why**：现有 eval 语料全中文，海外用户的第一个 prompt 就落在分布外。
- **验收**：每个能力维度至少 1 条英文 NL 用例，与中文用例共用记分卡。
- **状态**：✅ 已落地（PR-2）。25 个 golden case 各补 `nlEn`（复用同一份 gold config，零重复）；`eval-llm.mjs` 双语打分，zh 门禁 / en 观测（`byLanguage`）；`score-golden.mjs` 校验 nlEn 并报 `bilingual N/25`。

### AI-03 — runtime tier：mount 生成出来的 schema · `M`
- **Why**：现在 runtime 测试挂的是**手写** schema——等于没测生成物真能渲染/交互。golden 的 `vite build` 只证明「能编译」，不等于「能跑」。
- **验收**：至少对 golden 子集，把生成的 pageSchema mount 起来跑冒烟断言（能渲染、表单能填、弹窗能开）。

### AI-04 — commit 真实 accuracy 数字 + README 徽章 · `S`（依赖 AI-01）
- **Why**：没有数字的「AI 原生」是营销。
- **验收**：nightly `eval-llm.yml` 产出的 `last-accuracy.json`（按维度）committed；README 徽章显示总分 + 最弱维度。
- **状态**：✅ 已落地（PR-4）。`eval-llm.mjs` 额外写 shields endpoint `last-accuracy-badge.json`（门禁口径 heldout 分，≥95 brightgreen/≥90 green/≥80 yellow/else red）；`eval-llm.yml` 加 `permissions: contents:write` + `concurrency` + 变更检测的 commit-back（`[skip ci]`，`always()` 使红值也如实回写）；README / README.en 加 endpoint 徽章 + 「heldout 非营销」注脚；徽章文件先种 grey `pending nightly` 占位，首夜真跑后覆盖。

---

## P1 · 补 few-shot 盲区（排在任何 schema 改造之前）

### AI-05 — 填齐 eval steering few-shot 的 heldout 维度 · `S`–`M`
- **Why**：steering prompt 只有 6 个 shot，`cascader / render / i18n / sfc-mode / virtualScroll / formLayout / 多 dialog / permissionValue / operationColumn / antdv` 一个示例都没有——LLM 对没见过示例的维度准确率断崖。补齐是几小时的活、却直接抬分。
- **验收**：上述每个维度 ≥1 个 shot，加入后 AI-01 对应维度分可观测上升。
- **状态**：✅ 已落地（PR-3）。`NL_TO_CONFIG_FEWSHOT` 6 → 14 shot，8 个全新域（AddressBook/MenuManage/TagManage/MetricLog/MemberManage/SalaryManage/TicketManage/CommentManage）覆盖 cascader+children / i18n+formLayout / sfc / virtualScroll / 多 dialog / permissionValue / render+operationColumn对象 / antdv；域名与 25 个 golden 名均不碰撞，`FEWSHOT_DERIVED`（静态 6 文件）不变，heldout 仍是干净泛化测试；spec 加 2 道护栏（generateFromConfig 不抛 + 17 维覆盖断言）。

---

## P2 · 扩 config schema 表达力（真正的瓶颈）

每补一个，就把一类场景从「只能塞进 render 字符串」升级为「类型安全 + golden 可编译保证」。按文档里真实高频、当前**无法表达**的特性排。

### AI-06 — `isHidden` 条件可见性 · `M`
- **Why**：组件文档里有、`FieldConfig` 里却缺，是最刺眼的缺口。
- **验收**：schema 支持 `isHidden`（声明式条件，非裸 JS）；三端生成 + golden 覆盖；eval 维度纳入。

### AI-07 — 字段联动 / computed · `L`
- **Why**：一个字段的值/选项依赖另一个字段，是复杂表单的核心需求，当前完全不可表达。
- **验收**：schema 能声明依赖关系（配合 AI-16 的表达式 DSL 更稳）；三端等价；golden 覆盖。

### AI-08 — `configTableOut` 后端字段映射 · `M`
- **Why**：官方 headline feature，schema 里**完全没有**。
- **验收**：schema 建模入/出参字段映射；生成代码接上；golden 覆盖。

### AI-09 — 高级表格特性 epic（group header / row-expand / tree table / 可编辑单元格）· `L`–`XL`
- **Why**：文档里反复出现的「复杂场景」，当前只能靠 render 字符串硬塞。
- **验收**：建议**拆成 4 个子 issue**独立推进，每个带三端生成 + golden + eval 维度。不要一次性合并。

---

## P3 · 收敛逃生舱 + 补齐

### AI-10 — 编译检查 render/formatter/permissionValue 字符串 · `M`
- **Why**：现在是不经编译检查的 JS 字符串——拼错的变量名能骗过全部 341 测试、运行时才炸。
- **验收**：这些片段喂给 esbuild transform 做 parse 级校验；非法片段在生成期报错。**AI-16 是它更稳的终局形态。**

### AI-11 — SFC-mode ↔ schema-mode 特性对齐 · `M`
- **Why**：SFC 路径当前功能更少，两条路不等价会让 `mode` 选择变成能力陷阱。
- **验收**：两模式特性矩阵对齐；差异点要么补齐、要么在 schema 层显式拒绝并给出告警。

### AI-12 — `get_component_api` 扩到 EsDialog / EsCrudPage / vxe · `S`–`M`
- **Why**：覆盖不全，LLM 写 render 字符串时查不到真实 API，只能凭空捏造 prop/slot。
- **验收**：三个组件族的 API 可查；AI-15 依赖它。

---

## Q6 · 全球同类库的借鉴点（approach / spike，横切支撑上面各项）

你现在走的「确定性组合 + schema 校验 + 一次编译保证」和海外最前沿**同向**。以下按能直接接入的程度排。

### AI-13 — 语法受限解码 spike（Outlines / XGrammar / llguidance / GBNF）· `M` spike
- **Why**：「单前门 + 填 surfaces 表」本质是手工约束解码。真正的 constrained decoding 让模型**生成时**就只能吐合法 token，递归结构也能约束——`assertValidConfig` 从「事后拒绝 + 重试」变「根本吐不出非法配置」，一次通过率结构性抬升。
- **验收**：spike 报告——在当前 host（Claude Code / Cursor 走 MCP）下可行性与接入点评估；若 host 不支持，记录为「待 host 能力」。

### AI-14 — TypeChat 式「校验—修复」自愈回路 · `M`
- **Why**：`composeCrudConfig → safeParse → warnings` 已是雏形，差一步：把 error + warnings **自动回灌模型重生成**，而非只返回给人看。从「告警」到「自愈」。
- **验收**：生成失败/带告警时自动触发一轮带错误上下文的重生成；eval 记录自愈前/后通过率。

### AI-15 — 写 render 前先 RAG 组件 API · `M`（依赖 AI-12）
- **Why**：海外做法在让模型写任何自由片段前先检索真实 API 注入上下文，减少捏造。
- **验收**：生成 `render` 字符串前强制先读 `get_component_api`，相关 API 进 prompt 上下文。

### AI-16 — 用表达式 DSL 替代裸 JS 字符串（JSONLogic / CEL）· `L`
- **Why**：`render/formatter/permissionValue` 换成可求值、可静态校验、沙箱安全的表达式语言。好处三连：能校验、三端等价求值、不留注入口。是把 P3 逃生舱收敛成受控能力的正道，也是 AI-07 联动的底座。
- **验收**：选型（JSONLogic vs CEL）→ 三端求值器 → schema 接入 → 迁移现有逃生舱点位。

### AI-17 — 按特性维度的 eval 平台（promptfoo / braintrust / OpenAI-Evals）· `M`
- **Why**：这些平台原生支持 per-assertion / per-feature 记分与回归看板，直接对应 AI-01，不用自造轮子。
- **验收**：选型并接入现有 eval 语料；AI-01 的记分卡跑在该平台上。
- **状态**：**Wave 1 显式推迟**（见设计文档 §6）。当前 scorer 深耦合权威 Zod schema + `generateFromConfig` 编译校验，迁移在本波是净负担；`byCapability` 已满足看板需求。维度矩阵继续膨胀或需对外托管看板时再评估。

---

## 建议执行波次

| 波 | 内容 | 理由 |
|----|------|------|
| **Wave 1** | ✅ 已完成：AI-01 + AI-02 + AI-05 + AI-04（PR-1~4；AI-17 显式推迟） | 先让分数可信、再用低成本 few-shot 把分抬起来——后续每一项改造都要靠这套记分卡证明有效。 |
| **Wave 2** | AI-06 → AI-08 → AI-03 | 先补两个最刺眼的 schema 缺口（isHidden / configTableOut），同时上 runtime mount 让「能跑」有保障。 |
| **Wave 3** | AI-12 → AI-15 → AI-10 → AI-14 | 收敛逃生舱并给自由片段兜底（API 可查 + RAG + 编译检查 + 自愈）。 |
| **Wave 4** | AI-16 → AI-07 → AI-09（拆子项）→ AI-11 | 深水区：表达式 DSL 做底座，再上字段联动与高级表格，最后对齐 SFC parity。 |
| **Spike** | AI-13 | 独立评估，不阻塞主线；host 具备能力时再接。 |
