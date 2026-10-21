# @es-plus/mcp-server — 生产级 AI 原生能力修复与实施计划

> **文档地位：本文件是 AI 原生能力修复的「执行单一真源」。**
> 所有修复工作以 `AN-xx` 编号推进；每个 PR 必须引用一个 AN 条目，并在合并时更新本文件状态。
> 「系统如何工作」见 [AI-NATIVE-ARCHITECTURE.md](./AI-NATIVE-ARCHITECTURE.md)；
> 「历史 backlog」见 [ROADMAP.md](./ROADMAP.md)（AI-xx）。
>
> - 制定日期：2026-10-20
> - 基线代码：`1623859` + 工作区
> - 硬目标：**真实编译率 100%**、**heldout `definition95` ≥ 95%**
> - 当前状态：目标未达成（最新完整测量 51.2%）

---

## 0. 目标与验收定义（先对齐，再开工）

### 0.1 两个硬指标的精确定义

| 指标 | 本计划采用的定义 | 不允许的口径 |
|---|---|---|
| **真实编译率 100%** | 对每条**被测到**的模型产物，按 target 跑 Tier A 编译（SFC 解析 + 模板编译 + TS 转译 + JSX 转译）全部通过；`compileRate = compiled / measured = 1.0`，且进入 `passed` | ❌ “`generateFromConfig` 没抛异常” |
| **生成正确率 ≥ 95%** | 在 heldout 集（无 `fixedFields` 提示、无 few-shot 泄漏）上，`definition95 = scoped 零编辑 ∨ ≤K=3 轮真实收敛` ≥ 0.95 | ❌ 只在 core 上算、❌ 真空维度计 pass、❌ 把未测到当答对 |

> K=3 的定义与“scoped”的维度集合必须由 `scripts/eval/scorers.mjs` 单源定义；
> 任何修改先在 `scorers.test.mjs` 写定义级测试。

### 0.2 当前基线（2026-10-19，nightly run `39225471476`）

| 指标 | 数值 | 目标 | 差距 |
|---|---|---|---|
| `definition95` | **51.2%（85/166）** | 95% | −43.8pp |
| `exactIntentCore` | 50.0%（83/166） | — | — |
| `exactIntentScoped` | 48.8% | — | — |
| `exactIntentFull` | 28.3%（47/166） | — | — |
| `compileRate`（旧口径） | 99.47%（187/188） | 100% 真实编译 | 口径失效 |
| 收敛 @3 | 5/5（仅 5 行） | 样本 ≥30 行 | 不可信 |

**测量可信度警告**：
- 工作区 `last-accuracy.json` 是 2026-10-18 旧快照；
- 远端 `43d1d82` 的 2026-10-19 产物才是最新；
- **HEAD `1623859`（AI-47..AI-51，251 条语料）从未完整评测**。

### 0.3 缺口数学（决定优先级）

| 维度 | 通过/适用 | 缺口 | 性质 |
|---|---|---|---|
| `membership` | 103/165（62%） | 62 | 契约/生成器（inQuery 规则、组合归并） |
| `columns` | 10/32（31%） | 22 | 表达力 + few-shot |
| `expandConfig` | 3/15（20%） | 12 | 表达力 + few-shot |
| `reactions` | 3/12（25%） | 9 | 表达力 + few-shot |
| `editConfig` | 5/14（36%） | 9 | 表达力（editRender 通道） |
| `tableBtns` | 2/10（20%） | 8 | **教学契约破损（P0）** |
| `dialogs` | 8/13（62%） | 5 | 契约 + 生成器 |
| 其他 | — | 余量 | 逐项处理 |

> 大部分缺口不是“模型不会”，而是**生成器/契约/语料**问题。先修发射器，再谈 prompt。

---

## 1. 执行纪律

1. **测量先行**：Phase 0 不修功能，只让数字可信；否则后续所有“提升”都不可验证。
2. **不靠 prompt 掩盖发射器漏洞**：能在生成器确定性修掉的，不改提示词。
3. **每个修复必须带守卫**：没有守卫的修复视为未完成。
4. **禁止静默丢弃**：无法表达 → 告警 + 扩展点；未知键 → 错误。
5. **单一真源**：schema / tool shape / validator / 文档台账不得各写一份。
6. **一个 AN = 一个 PR**（可拆多个提交）；PR 描述必须含“证据 + 验收命令 + 文档更新”。
7. **不在 Windows 上重生成产物**：`one-config:check` 等存在 CRLF 假阳性；以 CI 为准。
8. **eval 前先 `npm run build:libs`**：eval 读 `build/`，不读 `src/`。

### 1.1 常用命令

```bash
# 构建（eval/守卫读取 build/）
npm run build:libs

# 探针（不写产物、不门禁）
node scripts/eval-llm.mjs --limit 5
node scripts/eval-llm.mjs --fragments --limit 9

# 全量（写 last-accuracy.json + 徽章）
npm run eval:llm

# 守卫
npm run check:consistency

# 单点
npm run check:front-door
npm run check:scene-coverage
npm run check:scorers
```

### 1.2 PR 完成定义（DoD）

- [ ] 代码 + 单元测试
- [ ] 对应守卫新增/更新，且能在注入缺陷时变红
- [ ] 相关 golden / eval 证据（探针即可，若全量太贵）
- [ ] [AI-NATIVE-ARCHITECTURE.md](./AI-NATIVE-ARCHITECTURE.md) 行为描述更新
- [ ] 本文件 AN 状态更新
- [ ] `check:consistency` 本地绿（Windows 假阳性需注明）

---

## 2. 执行看板

> 状态：`未开始` / `进行中` / `待评审` / `完成`。
> 优先级：P0（阻断正确性）/ P1（能力与度量）/ P2（产品化）。

### Phase 0 — 测量真实性（先做，1–2 天）

| ID | 任务 | 优先级 | 工作量 | 依赖 | 状态 |
|---|---|---|---|---|---|
| AN-01 | 修评分口径（fixedFields / 真空维度 / 分母 / 值比较） | P0 | M | — | 完成 |
| AN-02 | 收敛腿扩样本 + 区分脚本化纠正 | P0 | S | AN-01 | 完成 |
| AN-03 | artifact/徽章单一真源 + HEAD 基线 | P0 | S | AN-01 | 完成（身份字段随下次全量跑批写入） |
| AN-04 | guards 适用数动态化 + ratchet baseline 填充 | P0 | S | AN-01 | 进行中（计数守卫已落，比率基线待口径首跑） |
| AN-05 | en 腿标为“未测量”，不参与门禁展示 | P1 | S | — | 完成 |

### Phase 1 — 发射正确性（3–5 天）

| ID | 任务 | 优先级 | 工作量 | 依赖 | 状态 |
|---|---|---|---|---|---|
| AN-06 | `schema.actions` 恒发射 + 三端兜底按语义推导 | P0 | S | — | 完成 |
| AN-07 | `tableBtns` 契约/示例/评分统一 | P0 | S | — | 完成 |
| AN-08 | 未知键严格判定 + 别名归一 + 表域语义键 / `pageSizes` | P0 | M | — | 完成 |
| AN-09 | capability manifest + `multiSelect`/`snIndex` 三端运行时 | P0 | M | — | 完成 |
| AN-10 | `ellipsis` / `defaultSort` 三端映射 | P0 | S | AN-09 | 完成 |
| AN-11 | 无静默丢弃清扫（SFC 转义、函数值、permissions、editConfig） | P0 | M | AN-08 | 完成 |

### Phase 2 — 编译真实性（3–4 天）

| ID | 任务 | 优先级 | 工作量 | 依赖 | 状态 |
|---|---|---|---|---|---|
| AN-12 | Tier A 编译腿（每行，三端） | P0 | M | — | 完成 |
| AN-13 | 编译率进入门禁 + `noThrow` 分离 | P0 | S | AN-12 | 完成 |
| AN-14 | Tier B 抽样 typecheck（nightly） | P1 | M | AN-12 | 完成 |
| AN-15 | preflight / doctor（运行时前置清单） | P1 | S | AN-06 | 完成 |

### Phase 3 — 覆盖面（5–8 天）

| ID | 任务 | 优先级 | 工作量 | 依赖 | 状态 |
|---|---|---|---|---|---|
| AN-16 | `useDialog` 语料 + 评分 + 运行时见证 | P0 | L | AN-06 | 完成 |
| AN-17 | 三组件组合语料 + 评分 | P0 | L | AN-06 | 完成 |
| AN-18 | 片段腿门禁化 | P0 | S | AN-16/17 | 完成 |
| AN-19 | PRD/设计提取资源 + 文本语料腿 | P1 | M | — | 完成 |
| AN-20 | `ingest_schema` 支持 `ts-interface` / `sql-ddl` | P1 | M | — | 完成 |

### Phase 4 — 准确率收敛（2–3 周迭代）

| ID | 任务 | 优先级 | 工作量 | 依赖 | 状态 |
|---|---|---|---|---|---|
| AN-21 | 前门旋钮类型化（移除 `z.any()`） | P0 | M | AN-08 | 完成 |
| AN-22 | RenderPlan 拆分（plan / emit 分离） | P1 | L | AN-09 | 完成 |
| AN-23 | 按维度补 few-shot（columns/expand/reactions/edit/dialogs） | P0 | M | AN-07 | 完成 |
| AN-24 | canonicalization + 确定性修复环 | P1 | M | AN-08 | 完成 |
| AN-25 | 收敛到 `definition95 ≥ 95%` | P0 | L | 全部 | 阻塞（需付费全量跑批 + 推送 commit；AN-26…AN-29 已先行完成） |

### Phase 5 — 产品化（1–2 周）

| ID | 任务 | 优先级 | 工作量 | 依赖 | 状态 |
|---|---|---|---|---|---|
| AN-26 | 工具面收敛 + profile 开关 | P1 | M | AN-21 | 完成（默认 `full`，偏离计划字面的「生产默认 front-door」，理由见落地记录） |
| AN-27 | 公开声明与 artifact 绑定 | P0 | S | AN-03 | 完成 |
| AN-28 | feature ledger 接入 es-eui / es-pc | P1 | M | — | 完成（映射 126 / 显式 D 72） |
| AN-29 | README / CHANGELOG / 站点文档同步 | P1 | S | 全部 | 完成（changeset 两份，7 包 minor） |

---

## 3. Phase 0 — 测量真实性

### AN-01 — 修评分口径

**目标**：让 95% 这个数字可审计；消除“看起来正确”的虚高。

**证据**
- `scripts/eval-llm.mjs:318`：188/188 行注入 `fixedFields`（184 行全量），propSet 98.9% 主要是抄写保真度。
- `scripts/eval/scorers.mjs:535`：无共享字段时 `attrAcc` 被强制置 1。
- `formtypeEqual` / `membershipEqual` 用 `sharedFields(...).every(...)`，空集恒真。
- `dataOptions` / `extPoints` 只测存在性，不比值。

**改动**
1. **门禁跑不注入 `fixedFields` 的配置**；保留 `fixedFields` 作为独立诊断腿（报告但不计 gate）。
2. 真空维度：`sharedFields.length === 0` → `applicable=false`，不计 pass。
3. `attrAcc` 分母改为“有 attrs 的字段数”，无样本即不适用。
4. `dataOptions` 比较 label/value 集合；`extPoints` 比较类型与必填标记。
5. `tableBtns` core 口径统一为 `name|code|actionType`（与 `CAPABILITY_SCORERS` 一致）。
6. `byCapability` 分母包含模型答错行（按 0）；未测到单独计数并阻断发布。

**验收**
- `npm run check:scorers` 新增 6 条定义级测试（真空/值比较/fixedFields 开关）。
- 用同一模型输出重算：`fixedFields` 关闭后 propSet 应显著下降；若不变，说明提示词仍在泄漏字段名，继续查。
- `last-accuracy.json` 明确写出 `fixedFieldsUsed: false`。

**风险**：历史数字会“下降”。这是正确的，不要回退口径。

**落地记录（2026-10-20）**
- 真空维度：`formtypeEqual` / `membershipEqual` 改为要求 `shared.length > 0`，空集不再恒真；`attrAcc` 在 `attrTotal === 0` 时返回 `null` 而非 1，`exactIntentCore` 要求 `attrTotal > 0 && attrHits === attrTotal`。
- `dataOptions` **偏离**设计字面（原写“比较 label/value 集合”）：落地为 **label 树 + 选项数/唯一性** 比较，不比 `value`。理由：`value` 是宿主数据口径（如 `"1"` vs `1`、字典码），模型从 NL 推不出，比它会制造与能力无关的罚分；label 树已能抓住“选项漏配/层级错”。`extPoints` 的“类型与必填”同理留给 AN-11 的 manifest 层，不在 scorer 里臆造。
- `tableBtns` core 口径统一为 `name|code|actionType`，与 `CAPABILITY_SCORERS` 同源（`tableBtnsMatch` 直接调 `tableBtnsEqual`），不再各算一份。
- `--fixed-fields` **偏离**设计字面（“独立诊断腿”）：没有另立一条付费腿，而是保留该开关为**探针**；`fixedFieldsUsed` 写入 artifact 并由 AN-03 的校验器判 `true` 即红 —— 即“用过泄漏字段的产物不可发布”，等价于“门禁跑不注入”。
- 测试：`scripts/eval/scorers.test.mjs` 新增第 7 节，逐条钉住真空维度、`dataOptions` 树比较、core 同源。

---

### AN-02 — 收敛腿扩样本

**目标**：让“≤3 轮收敛”这条腿有统计意义。

**现状**：仅 5 行，每行一次脚本化 `ref.correction`，贡献了 scoped 81→85 的 4 个 pass。

**改动**
1. 新增 ≥25 条“欠定 NL + gold=最终意图”的用例（按 `convergence-second-leg-structural-miss` 记忆的铰链选法）。
2. 区分：
   - `turn0-scoped`（零编辑）；
   - `scripted-correction`（脚本化纠正）；
   - 两者分别报告，不混算。
3. `refine_config` 的确定性 diff 仍只观测；不把“宿主改对了”算成模型能力。
4. 收敛腿进入 guard 样本数检查（≥30）。

**验收**
- `summarizeConvergence` 输出三列：`turn0`、`scripted`、`combined`。
- 人为删掉 5 条用例 → `check:scene-coverage` 或 convergence guard 变红。

**落地记录（2026-10-20）**
- 新增 25 条收敛语料（`conv-01…conv-25`），收敛腿 5 → **30 条**，铰链分布：`inQuery` ×7、`inTable` ×5、`inForm` ×4、`formtype` ×4、`isHidden` ×3、`actions` ×2。
- 铰链选法严守 `convergence-second-leg-structural-miss`：**欠定 NL + gold = 最终意图**，turn-0 scoped 必 miss；不钉模型本就答对的维度（否则 meanTurns 被稀释成 0，第二条腿是假的）。
- `summarizeConvergence` 输出 `turn0` / `scripted` / `withinK`（`combined` 落地为 `withinK`，语义相同：≤K 内收敛的总数）。
- `ratchet.mjs` 新增 `checkConvergenceSample(total)`（地板 `CONVERGE_SAMPLE_FLOOR = 30`）并接入 eval 的 `combine(...)`；判据是“**跑了**多少条”而非“收敛了多少条”—— 收敛率低是模型问题（该发布），样本太少是度量问题（不该发布）。
- 语料计数用 `scorers.test.mjs` 的语料覆盖断言 + `ratchet.test.mjs` 的 ⑩ 边界块双钉：30 过 / 5、0、`undefined` 红。

---

### AN-03 — artifact / 徽章单一真源

**目标**：消除“工作区旧快照 vs 远端最新”的分叉。

**改动**
1. `last-accuracy.json` 增加 `commit`、`runId`、`artifactSource`、`corpusHash`。
2. 徽章/README 数字只从该文件生成；生成脚本拒绝手写数字。
3. CI 上跑完整 eval 后提交 artifact；本地工作区快照标记 `stale: true`（若 `commit !== HEAD`）。
4. 增加 `check:artifact-freshness`：README/站点引用的数字必须等于 artifact。

**验收**
- 在 HEAD 上跑一次完整 eval，产物 `commit` 与 `git rev-parse HEAD` 一致。
- 手动改 README 数字 → `check:artifact-freshness` 红。

**落地记录（2026-10-20）**
- 路径/身份/指纹集中在**新文件** `scripts/eval/artifact.mjs`：`CASES_DIR`、`ACCURACY_FILE`、`BADGE_FILE`、`BADGE_SCOPED_FILE`、`corpusFingerprint()`、`artifactIdentity()`、`verifyArtifact()`。写端（`eval-llm.mjs`）与查端（`check-artifact-freshness.mjs`）**共用同一实现** —— 本仓付过“双真源”的学费。
- 产物新增 `commit` / `runId` / `artifactSource`（`ci`/`local`）/ `corpusHash` / `corpusFiles` / `fixedFieldsUsed` / `measurement`，**成功行与失败行都带**（失败的运行也必须可追溯）。
- `corpusHash` 取**全量语料**（`allFiles`）而非 `--limit` 切片，否则一次抽样运行会把指纹写坏，后续校验全部误红。
- 校验器的红/黄分界：**自相矛盾**（缺键、`fixedFieldsUsed:true`、`measurement` 未知、`passed:true` 但低于目标、徽章数字与产物不符、`rate` 与 `pass/total` 不一致）→ 红；**陈旧**（`commit !== HEAD`、`corpusHash !== 当前语料`）→ 仅警告。理由：master 上的产物天然落后于工作区，判红会让守卫恒红。
- **偏离**设计第 3 条（“本地快照标记 `stale: true`”）：产物里不写 `stale` 字段，陈旧性由校验器**当场计算**并只发警告 —— 写进文件的 `stale` 会立刻自己过期，等于第二个真源。
- 徽章比对按**数值解析 + 0.05pp 容差**（产物 4 位小数 vs 徽章 1 位小数，字符串比较会在舍入边界假红）。
- 新增 `npm run check:artifact-freshness`；当前工作区产物是 pre-AN-03 旧格式 → 仅警告、退出码 0（不可判红：下一次付费跑批才会补齐身份字段）。

---

### AN-04 — guards 适用数动态化

**目标**：消除“语料增长就红”的假红。

**现状**：`accuracy-baseline.json` 写死 `applicableCounts`（如 reactions 15），语料变 14 即红。

**改动**
1. 适用数从当前语料实时推导；baseline 只存 `rate` 与 `minApplicable`。
2. `ratchet.mjs` 的 `definition95/coreRate/byDimension` 填充真实值（当前为 null，棘轮惰性）。
3. 适用数变化超过 ±10% 时要求显式说明，而不是硬编码。

**验收**
- `npm run check:ratchet` 能在人为降低某维度 rate 时红。
- 新增/删除一条 reactions 用例不再导致假红。

**落地记录（2026-10-20）**
- `ratchet.mjs` 新增 `deriveMinApplicable(counts)`：`floor(n * 0.9)`。`guardAntiDelete` 升 v2 —— **硬地板判红 + ±10% 漂移只警告**；旧格式（只有 `applicableCounts`）保持精确相等，避免升级当天一片无法解释的红。
- **偏离**设计第 1 条（“baseline 只存 `rate` 与 `minApplicable`”）：`accuracy-baseline.json` 仍**保留观测到的 `applicableCounts`**，`minApplicable` 由它推导。理由：漂移提示需要“当时的数”作参照；只留地板就分不出“少了 1 例（合法）”与“少了 14%”。
- 基线升 `version: 2`，`applicableCounts` 刷新到当前语料（213 条 crud）；`definition95` / `coreRate` / `byDimension` **刻意留空**并注明原因：AN-01 之前的数字是 `fixedFields` 泄漏 + 真空维度抬高的，填进去会让 AN-01 后的**第一次**跑批因“非退步”而红。填充动作挂在首次按新口径的全量跑批之后（同时记 `runId` / `commit`）。
- `ratchet.test.mjs` 拆 v1/v2 两段合成断言 + 真实语料断言（`minApplicable` 覆盖同一组维度、地板不高于当前计数）+ 变异自检（抽掉 `mergeConfig` 用例必须红）。

---

### AN-05 — en 腿状态

**目标**：不把 relay 403 伪装成 0 分。

**改动**
1. `byLanguage.en` 若 `measured < total`，标注 `notMeasured`，不参与门禁展示。
2. 报告区分 `modelFailure` 与 `notMeasured`（已有基础，扩展到语言腿）。
3. en 语料在 relay 可用前只做观察。

**验收**：报告中 en 腿显示“未测量 N 行”，不再出现误导性的 0%。

**落地记录（2026-10-20）**
- `byLanguage.en` 在 `notMeasuredIn(enRows) > 0` 时整体置 `null` 并写 `enSuppressed` + 原因串，门禁/徽章只读 zh 腿（`gateRate` 与 `byLanguage.en` 无连接，`ratchet.test.mjs` 的门禁同源块已钉死）。
- 判据与健康门同源：抑制看的是 `notMeasuredIn`（`err.kind` ∈ no-answer/truncated/未知），**模型答错的行照常按 0 计**并发布 —— 否则“模型暂时答不出”会被伪装成“中继故障”。
- **偏离**设计第 3 条（“en 语料在 relay 可用前只做观察”）：不删/不跳 en 语料，`nlEn` 仍照跑（付费但计入 `--limit` 之外的观测），只是**数字永不进门禁**。理由：en 是对 next-token 偏置的观测窗口，停跑等于放弃诊断；但要接受 `en-leg-label-bias` 记忆里的结构性偏差（gold 是中文 label，en 腿在 tableBtns/operationColumn 上必错），故只能观测。

---

## 4. Phase 1 — 发射正确性

### AN-06 — `schema.actions` 恒发射 + 三端兜底

**目标**：修复“新对话框模式页面动作错误”。

**根因**
- `../shared/src/structured-generator.ts:391-399`：`schema.actions` 只在 legacy 分支发射。
- 三端 `normalized*` 在缺 `actions` 时硬编码 `['add','edit','delete']`。

**改动**
1. `generateSchema()`：把 `schema.actions = [...config.actions]` 移到模式判断之外，两种模式都发射。
2. 三端 `es-crud-page`：
   - 有 `schema.actions` → 用它；
   - 无 actions 但有 `schema.dialogs` → 从 dialog keys 推导（仅 add/edit/view）；
   - 无 actions 但有 `schema.dialogFormItems` → 旧 schema 兼容，回退 `['add','edit','delete']`；
   - 都没有 → `[]`（只读）。
3. `composeCrudConfig` 调用补 `rowkey`（`src/tools/generate-crud.ts:214-236`）。
4. `schema.dialogs` 的 `view` 弹窗提交改为只读（不 PUT），`import` 按钮补处理或显式告警。

**改动文件**
- `../shared/src/structured-generator.ts`
- `../vue3/src/components/es-crud-page/src/es-crud-page.vue`
- `../vue2/src/components/es-crud-page/src/es-crud-page.vue`
- `../adapter-antdv/src/components/es-crud-page/src/es-crud-page.vue`
- `src/tools/generate-crud.ts`

**验收**
- 新增 `packages/mcp-server/__tests__/page-actions.spec.ts`：4 种新模式入口 × 3 target，断言 `pageSchema.actions` 存在且相等。
- 三端 mount：`actions:['add','view']` 不出现编辑/删除行按钮。
- `check:front-door` round-trip 扩展到 actions/dialogs/tableBtns。
- 旧 schema（无 actions）仍能渲染 add/edit/delete。

**风险**：历史 schema 行为变化。用“旧 schema 兼容分支”兜底。

**落地记录（2026-10-20）**
- **偏离**设计第 2 条（“三端各自推导”）：四档判据收敛到 `packages/core/src/crud-actions.ts` 的 `resolveCrudActions`，三端各算一个 `computed(() => resolveCrudActions(props.schema))`。理由：三份同样逻辑的副本=三端可以各自漂移，而这正是本缺陷的形状（同一契约三端各读一遍、漏一端静默失效）；收敛后「三端一致」是结构性质，不是纪律。四档：`actions`（`Array.isArray`，故 `[]` = 显式只读）→ `dialogs` key ∩ {add,edit,view} → `dialogFormItems` 非空 → `[]`。
- `generateSchema()` 把 `schema.actions = [...config.actions]` 放在 if/else **之后**：legacy 分支的键序（dialogFormItems → actions → pagination）逐字节不变，只有新模式多出 actions。
- 第 3 条落在 `withRowkey()`：顶层 `rowkey` 透传进 `tableOptions`；与 `tableOptions.rowkey` 冲突时**取顶层**并 `unshift` 一条警告（弹窗 PUT / 删除 URL / 独立 dialog 块必须用同一个键，静默取一边就是跨页 404）。
- 第 4 条：`view` 弹窗在 wrapper 的 `handleDialogConfirm` 里 `continue`（读操作不发 PUT）；自定义 key 保持原行为。`import` **没有**上传实现，故在生成期加 warning、运行期 `handleBtnClick` 里 `ElMessage.warning('导入尚未实现…')` —— 明示「这是你要接的」，而不是留一个点了没反应的死按钮。
- 守卫：新增 `scripts/check-crud-actions.mjs`（三端静态同源 + **变异自检**：把旧写法喂进同一组判据必须咬住）；`check:front-door` 的 ⑤ 入参改为按真 handler 装配（含 actions/dialogs/tableBtns/各顶层开关），并新增 ⑤b **动作面保真**（gold 声明了 actions/dialog key/tableBtns 就必须原样保留）。⑤b 有实测分辨力：入参未带这些键时 213 条语料红 209 条，补齐后全绿。
- 行为测试：`core/__tests__/crud-actions.spec.ts`(8)、`mcp-server/__tests__/page-actions.spec.ts`(17，四入口 × 三端 + view 只读 + import 告警 + rowkey 冲突)、`vue3/__tests__/es-crud-page.spec.ts`（四条派生判据，替换原先钉住旧 bug 的“默认 add/edit/delete”用例）、`adapter-antdv/__tests__/es-crud-page-actions.spec.ts`(4)。vue2 无挂载 harness（element-ui CJS 解析到根部 vue@3），只受静态守卫保护 —— 已知覆盖边界。
- 三站回归：`es-plus-docs` 的 9 个 EsCrudPage 示例全部显式声明 `toolbarBtns` 和/或 `operationColumn`，不经过 actions 派生，行为不变（`CustomFooter` 显式 `operationColumn`，本就不会因此多出「新增」）；`es-pc` 为同步副本。
- 顺带修：`gen-one-config-diff.mjs` 把嵌入产出的源码行尾归一为 LF。此前 Windows 检出（CRLF）生成含 `\r\n` 的 JSON，与本机/CI 的 LF 版不等，`one-config:check` 在 Windows **恒红而 CI 恒绿**（`sameText` 只归一 JSON 文件本身的行尾，管不到 JSON 字符串里转义后的 `\r\n`）。归一后产出与平台无关，无需再「切勿在 Windows 重生成」。
- 回归：core 355 / shared 594 / vue3 575 / antdv 631 / vue2 351 / mcp-server 270 全绿；`check:crud-actions`、`check:front-door`、`check:generator`、`check:generator-targets`、`check:threeway`、`check:parity`、`check:api`、`check:contract`、`check:legacy-stub`、`check:schema`、`check:one-config`、`check:readme`、`check:site-claims`、`check:cases-links` 全绿；`build:libs` 通过。

---

### AN-07 — `tableBtns` 契约 / 示例 / 评分

**目标**：从 2/10 提升，且消除“照抄示例必错”。

**根因**
- `src/tools/generate-crud.ts:98-101` 示例 `{label, action}` 非法。
- core 评分只比 `code`，与维度口径不一致。

**改动**
1. `TableBtnSchema` 增加别名归一：`label→name`、`action→actionType`；归一后仍缺 `name` 报错。
2. 前门 describe 改为合法示例：`[{ name:'导出', actionType:'export', position:'left' }]`。
3. `scorers.mjs` core 统一用 `name|code|actionType`。
4. 补 3 条 golden（左/右、export/import、dialogKey）。
5. 登记到 `check:fewshot-registration`。

**验收**
- `check:scorers` 断言同一产物在 core 与维度口径结论一致。
- 照抄工具 describe 的示例 → 必须通过校验。

**落地记录（2026-10-20）**
- `TableBtnSchema` 的 `name` 改为**归一化结果**而非字面必填：对象同时接受 `label`/`action` 别名，`superRefine` 在「name 与 label 都没有」时报 `tableBtns[] 缺少 name`。别名键在归一后被**删除**（留着会让下游同时看到 name 与 label 两个可能不一致的真相）。
- **关键修正（偏离设计字面，但不做就是假修）**：归一逻辑抽成 `normalizeTableBtn()`，Zod `.transform()` 与 `generateFromConfig` 入口**共用**。原因：`.transform()` 只作用于 `.parse()` 的返回值，而生成器刻意不消费解析结果（见 `assertValidConfig` 头注：schema 带大量 `.default()`）。只加别名给 Zod，结果是「校验通过、产物里按钮仍没有名字」——照抄旧示例照样错。入口归一后 `generateFromConfig({tableBtns:[{label,action}]})` 的产物是 `{name, actionType, code}`。
- 前门 describe 示例改为 `[{ name: "导出", actionType: "export", position: "left" }]`，并明写「规范键 name/actionType/position；旧别名 label/action 会被归一」。同时把**描述里的示例本身**纳入测试（`generate-tools-and-prompts.spec.ts`）：正则取出示例数组 → 补键引号后 JSON.parse → 过权威 `StructuredCrudConfigSchema` 并断言 `name/actionType/code`。这样「示例与契约分叉」会红，而不是靠人工复核。
- 第 3 条已在 AN-01 落地（`tableBtnKeyParts` 单源 = `name|归一化 code|actionType`，core 与维度共用；`scorers.test.mjs` 已有 core/维度同源断言），本项未再改。
- 第 4 条：新增 3 条 golden —— `189-tablebtns-left-right-vue3`（position 左/右 + actionType/dialogKey 混用）、`190-tablebtns-export-import-vue2`（export/import 两个 actionType + 显式空 `toolbarBtns` 接管工具条）、`191-tablebtns-dialogkey-antdv`（自定义 dialog key `detail` 靠 tableBtns/operationColumn 打开 + `isHiddenFooter` 只读底栏）。三条均通过 `test:golden`（216/216）与**真实 vite build**（vue3 / vue2 / antdv 各 36–79 s）。
- 第 5 条：`check:fewshot-registration` 判定三条新例不在机检下界内（与 few-shot 不同源），故**无需登记**；守卫已跑绿并保持 heldout 地板。此处按守卫裁定执行，不把「为登记而登记」当成完成。
- 守卫同步：`check:schema-contract` 的按钮定位断言原先只认 `.transform()` 字面量函数体，收敛到 helper 后会**静默失明**（只看到一行调用）。已改为「transform 体 + 被调用 helper 的源码」合并断言，且 helper 定位失败直接报错 —— 守卫自己也守住了「不要因为重构而失去分辨力」。
- 回归：shared 598 / mcp-server 271 全绿；`check:schema`、`check:generator`、`check:front-door`、`check:scorers`、`check:eval-prompt`、`test:golden`、`check:fewshot-registration`、`schemas:check`、`docs:check` 全绿；`build:libs` 通过。

---

### AN-08 — 未知键严格判定 + 别名归一

**目标**：让“Schema 校验”名副其实。

**根因**：Zod 非 strict，未知键静默剥离。

**改动**
1. 新增 `normalizeConfig()`（宽松入口）：只做有据可查的别名/搬迁，返回 `renames[]`。
2. 新增 `collectUnknownKeys()`：基于 Zod 4 `.shape` 递归，解包 Optional/Default/Effects/Array；`z.record`/`z.any` 停止下钻。
3. `validateAndRepair` 返回 `unknownKeys`；未知键 = error，附 Levenshtein 建议；`x-*` 放行。
4. 补 schema 缺失键（如 `tableOptions.treeConfig` 的 vxe 语义），避免误杀。
5. 组合层：语义键从三个面都拷贝（当前只 query/form）。
6. schema 模式发射 `pagination.pageSizes`。
7. 片段工具形状加 `.strict()`（工具入参本就应精确）。

**验收**
- 新增 `check:unknown-keys`：顶层拼写错、层级错、别名、`x-*`、数组元素未知键。
- 全部 251 条语料零误杀。
- `validate_config` 对 `rowKey` 给出“did you mean rowkey”。

**风险**：存量配置可能被拒。先补 schema 缺失键 + 一版 warning 过渡，再切 error。

**落地记录（2026-10-20）**

- **版本事实（必须先弄清，否则整项会写错）**：本仓同时装着 **两个 Zod 大版本**——`packages/shared` 自己的依赖是 **zod 4.4.3**（`structured-config.schema.ts` 就是它建的，计划原文明写 Zod 4，方向正确）；根目录 hoist 的是 **zod 3.25.76**，`mcp-server`/`core`/`cli` 解析到它，因此 `validate_config` 的片段形状（zod3 对象）会被传进 shared 的收集器。第一版按 zod4 单词汇写，**所有用例都返回空数组**——不是逻辑错，是根本没认出来。
- `collectUnknownKeys()` 改为**双词汇**：zod3 读 `_def.typeName`（`ZodOptional`…）、zod4 读 `_def.type`（`optional`…），统一成小写短名再分派；判定一律基于 `_def` 字段而非 `instanceof`（esbuild 打包后跨副本 `instanceof` 会静默失配）。解包 `optional/nullable/default/catch/readonly/prefault → innerType`、`branded → type`、zod3 `effects → schema`、`pipe → in`、`lazy → getter()`。
- **record 的边界**：`dialogs`/`permissions`/`attrs` 的**键**是动态的（弹窗 id、权限码），不判未知；但**值形状**照常下钻。`attrs` 的值是 `record<string, unknown>`，自然停住——所以「弹窗里拼错的键必须报、attrs 里的任意键不报」两者同时成立。
- **联合取交集**：`operationColumn: false | {...}`、`isHidden: 条件 | 表达式 | 数组` 都是联合。逐分支报告会把表达式分支的 `field/op/value` 误判成未知键；只有在**所有**能承载对象的候选里都不存在的键才上报。`intersection` 同规则。
- **过渡语义（按风险一节执行）**：`validateAndRepair`（`validate_config` / CLI 前门）= **error**；`generateFromConfig` = **warning**（生成照常，但点名「这些键会被忽略」）。存量配置因此不会一夜被拒，而宿主 LLM 会当场看到提示。
- `normalizeConfig()` 只做**有据可查**的两件事：`tableBtns` 的 `label→name`／`action→actionType`（规范键胜、别名删除并记录；位置→`code` 与 AN-07 同源），以及顶层 `rowkey` 并入 `tableOptions.rowkey`（与 `generate_crud` 前门同优先级：顶层覆盖）。**不猜拼写错误**——`rowKey` 交给未知键判定去报，猜错比不猜更坏。
- **补 schema 缺失键**：`tableOptions.treeConfig`（transform/rowField/parentField/childrenField/children/mapChildren/expandAll/lazy）与 `tableOptions.expandConfig`（expandAll/accordion/lazy）。**位置有硬约束**：`check:schema-contract` 用**非贪婪**捕获 `tableOptions` 到首个 `}).optional()`，这两个嵌套对象必须放在 `configTableOut` **之后**，否则会让整段契约键失检。
- 顶层 `treeConfig` 与 `tableOptions.treeConfig` 是**不同层**（前者跨端窄子集、后者 vxe 语义）。生成器合并到运行时唯一家 `tableOptions.treeConfig`，**顶层同名字键覆盖**（`!== undefined` 判断，不是真值判断——否则 `expandAll: false` 会被当成「没写」）。
- `pagination.pageSizes` 在 schema 模式也发射（此前只有 SFC 发射，同一个键两种模式产物不同）。组合层语义键改为 table（地板）→ query → form 全量拷贝。
- 片段工具形状 `.strict()` **只落在 `validate_config`**：MCP SDK 的 `server.tool()` 只接受 `ZodRawShape`，协议层没法替工具加 strict。同一份形状产出两处判据（zod issue + Levenshtein 建议），不会出现「zod 说未知、建议器说已知」的分叉。
- **复核中发现的真实缺陷（不在计划字面里）**：schema 模式把显式 `columns` **原样**展开进 `pageSchema`，SFC 模式只发结构化键。后果不只是「两种模式产物不同」——列级 `formatter` 在 JSON 里只能是**字符串**，而 `use-column-adapter` 直接 `col.formatter(...)` 调用它，渲染时抛 `formatter is not a function`。已加 `sanitizeExplicitColumns()`：按 `ColumnSchema` 自身形状取契约键（不另写清单）、保留 `x-*`、`groups` 自指递归，并在 `applyExpandConfig` **之前**执行。
- **语料两处修正**（279 条逐条过权威判据，只剩这两条真问题）：`105-campaign-group-edit-vue3` 的分组键误写成 `children`（运行时契约是 `TableColumn.groups`；`children` 是树表子节点，不是表头分组）；`185-dept-merge-explicit-columns-vue3` 移除了列级 `formatter` 字符串及其 NL 表述——JSON 配置承载不了函数，列级自定义格式化属于**源码**扩展点，不是配置契约。
- **守卫**：新增 `check:unknown-keys`（已进 `check:consistency` 链）。判据全部走运行时公开 API（esbuild 从 `shared/src` 打包 + `@es-plus/shared` alias 到源码，避免验到旧的 `build/`），四类：A 判定本身（顶层拼写错/层级错/数组元素/record 值/联合交集/`x-*`，每条断言**具体路径 + 具体建议键**）、B 前门（`rowKey` → 非法 + `did you mean "rowkey"`）、C 产物不泄漏且两模式一致、D **279 条语料零误杀**（片段按 `scene` 分派到三种片段形状）。四种注入自证：收集器返回空 / 建议器恒 undefined / 跳过列清洗 / 把每个键都报未知——各自必须让**对应**判据变红。
- 回归：shared 649 / mcp-server 277 全绿；`test:golden` 216/216；`build:libs` + 全仓 `typecheck` 通过；`check:schema`、`check:fragment`、`check:entry`、`check:front-door`、`check:threeway`、`check:generator`、`check:generator-escaping`、`check:front-door-leg`、`one-config:check`、`check:unknown-keys` 全绿。`check:threeway` 的全键探针补上了 `treeConfig`/`expandConfig` 取值（探针少设一个键，轴① 会把「没给」误读成「生成器不发射」）。

---

### AN-09 — Capability Manifest + `multiSelect`/`snIndex`

**目标**：三端对同一配置渲染一致。

**改动**
1. 新增 `../shared/src/capability.ts`：键 × target × 支持级别。
2. `buildSemanticWarnings` 读矩阵；`strictThreeEnd` 可升级为 error。
3. vue3/vue2 默认引擎在 `filteredColumns` 前置合成 `{type:'selection'}` / `{type:'index'}`（已存在同类型列则不重复）。
4. 新增 `check:capability-parity.mjs`：矩阵 ↔ schema ↔ 运行时消费点三方对账。

**验收**
- 同一配置三端列集合（含选择/序号）一致。
- 三端 mount 测试。
- 人为从 vue3 删除合成逻辑 → parity 守卫红。

**落地记录（2026-10-20）**

- **矩阵**落在 `packages/shared/src/capability.ts`（与计划一致）：14 个键 × 3 端，每格强制带 `note`（主张必须可追溯），三端必须显式表态。只对 `none` 发告警；`partial` = 「某引擎/子键生效」的文档事实，不刷屏。
- **矩阵键支持两种容器**：`tableOptions.<key>` 与**顶层** `<key>`。守卫 A5（键必须真实存在于 schema）当场抓出计划外的事实：AI schema 里**没有** `tableOptions.expand` —— 展开表达为顶层 `expandConfig` + 显式 `{type:'expand'}` 列；`treeConfig` / `mergeConfig` 也是顶层键，而同名的 `tableOptions.treeConfig` / `tableOptions.expandConfig` 是 vxe-only 富配置，**不同层不能并成一行**。矩阵据此改正（不是改代码去迁就假设）。
- **`equivalents` 相对容器解析**：`tableOptions.virtual` ⟺ `tableOptions.engine: 'virtual'`。首版按根解析，导致 `engine:'virtual'` 在 vue2 上漏告警（守卫 B3 抓出）。
- **运行时合成收敛到 core**（计划原文只说 vue3/vue2 默认引擎）：`synthesizeLeadingColumns`（中性 spec）+ `buildLeadingColumns`（`TableColumn` 形态）。实际有 **8 条列产出路径**共用它：vue3 默认 / 虚拟 / vxe、vue2 默认 / vxe、antdv 默认 / vxe / `adaptColumns`。修前三份 vxe 适配器各写一份 if，两处默认引擎完全没有 —— 同一配置切引擎就少一列。
- **顺序统一**为 `selection → index → expand`（修前虚拟引擎是 selection→expand→index；顺序不是语义，但列位置用户看得见）。
- **幂等**：`filteredColumns`（vue3）是所有引擎的入口，合成放在最后一步（合成列无 `prop`/`key`，不参与 formatter 注入与 `width→minWidth` 转换）；「已显式声明同类型列（含 `hidCol`）」时不重复注入，所以适配器层再调一次是 no-op。
- **antdv 的差异是消费者差异，不是漂移**：选择列由 `rowSelection` 渲染、展开列由 `expandedRowRender` 整行渲染，二者都不进 `adaptedColumns`；只有序号列是真正的列。`createSnAdvColumn` 的默认值改取 `LEADING_COLUMN_DEFAULTS.index`（title/width/align），不再各写一份字面量。
- **`buildSemanticWarnings` 与 `strictThreeEnd` 在代码库里都不存在**（计划原文的接线点）。没有去造同名函数：告警由生成器直接调 `capabilityWarnings(target, config)`，`generate_crud` 与 `generate_crud_from_config` 都经 `result.warnings` 看到；「升级为 error」的钩子无处可挂，故未落地（记录为偏差，等真有 strict 入口再加）。
- **守卫 `check:capability-parity`**（已进 `check:consistency`）：A 矩阵自洽（键在 schema 里存在——走 AN-08 的 `collectUnknownKeys`，不复制形状遍历；三端齐全；level 合法；note 非空；只有 none 发声；空配置零告警）、B **`none` 必须真的响**（每条 none 格用真实 `generateFromConfig` 跑 schema 与 sfc 两种 mode，warnings 必须点名键与 target；含 `engine:'virtual'` 等价写法与 `virtual:false` 静默）、C **单源消费**（8 条路径都必须**调用**并从 `@es-plus/core` **引入**该判据）。四条非空证明：P1 删 vue3 调用点 → C1；P2 幻影键 → A5；P3 让 `isSet` 失明 → B2；P4 让 partial 也告警 → A6。
  - 两条证明做法在复核中被推翻重写：**P3 原设计「把 vue2 的 virtual 格子改成 full」证不了**——那是改数据，B 变成「无事可做」而不是「变红」；必须让**消费路径**失明而矩阵不变。**C1 原用 `src.includes(helper)` 恒真**——import 名就让判据满足了，P1 首轮不红正是这个原因；收紧成调用点正则 `\bhelper\s*\(`。
- **复核中发现的真实缺陷**：`shared/src/unknown-keys.ts` 里 `AnyZod = z.ZodTypeAny` 把「必须与 shared 的 zod 同实例」写进了类型，而 `mcp-server` 解析到根目录的 zod3 → `validate_config` 直接 `TS2345`（运行时完全正常，因为收集器只读 `_def`，从不碰 `instanceof`）。改成结构类型 `object` 并移除 zod import —— 该文件头部本来就声明「双版本、跨副本不靠类型同一性」。
- **回归**：`npm test`（全 workspace）全绿；`build:libs` + 全仓 `typecheck` 通过；core 新增 `table-columns.spec.ts` 15/15；三端 mount 测试（vue3 5、vue2 5、antdv 3，antdv 补「序号列取 core 默认 / 与选择列共存仍在首位 / 显式 index 不重复」）；`test:golden` 216/216；守卫链 `check:capability-parity`、`check:unknown-keys`、`check:parity`、`check:threeway`、`check:front-door`、`check:schema`、`check:generator`、`check:generator-escaping`、`check:exports`、`check:site-nav`、`sites:check`、`check:site-claims`、`docs:check`、`check:docs-layout`、`cases:check`、`check:cases-links`、`check:readme`、`one-config:check`、`check:feature-coverage`、`check:entry`、`check:contract`、`check:api`、`check:theme-bridge`、`check:scaffold` 全绿。
- **对产物与语料的影响**：新增告警只在 `none` 格真的被设置时出现（vue2/antdv 的 `virtual`、`rowHeight`、`estimatedRowHeight`、`overscanCount`）。golden 里 9 个用例含这些键，评分口径是「配置 → 代码」一致性、不读 warnings，故 216/216 不受影响；三站文档案例（`sites:check`/`docs:check`/`cases:check`）同样全绿。

---

### AN-10 — `ellipsis` / `defaultSort`

**目标**：消除端特有键导致的静默失效。

**改动**
1. IR 统一 `ellipsis`；生成器不再写 `showOverflowTooltip`；antdv adapter 兼容两者。
2. antdv 默认引擎把 `tableOptions.defaultSort` 翻译为列 `defaultSortOrder`；vxe 用自身。
3. `check:parity` 增加列选项映射断言。

**验收**：三端对同一列渲染出等价的省略/排序行为（mount 或 adapter 单测）。

**落地记录（2026-10-20）**

- **复核先定缺陷面**（读组件源码而不是只读计划）：①生成器发的是 `showOverflowTooltip` —— **el-table 的原生 prop**，只有 vue3/vue2 默认引擎经 `columnBindAttr` 原样透传时「碰巧能用」，virtual / vxe ×3 / a-table 全部**静默丢弃**；②`FieldConfig` 里**没有 `sortable`**（只有显式 `ColumnSchema` 有），所以 `tableOptions.defaultSort` 指向派生列时，el-table 的 `default-sort` 与 a-table 的 `defaultSortOrder` 都要求目标列可排序 —— 不补 `sortable` 就是一条「什么都不会发生」的 NL；③antdv 默认引擎此前**完全没读** `defaultSort`（a-table 没有整表 prop）；④antdv `bodyCell` 里有一条 `column.ellipsis && text.length > 20` 的 a-tooltip 分支，排在 `render`/`scopedSlots` **之前**（自定义单元格被吞）、直接用原始 text（**绕过 formatter**）、20 字是与列宽无关的拍脑袋阈值。
- **IR 统一 `ellipsis`**：`buildTableColumn`（schema）、`buildTableColumnSFC`（sfc）、`buildTableColumnSFC` 的片段路径三处一致发 `ellipsis`，不再发 `showOverflowTooltip`。三端读取点**同时认**契约键与存量键（`col.ellipsis || col.showOverflowTooltip`）—— 老配置换端不静默失效。
- **各端翻译**：vue3/vue2 默认引擎在 `columnBindAttr`（**唯一**一个所有渲染分支都会走的地方：groups / render / scopedSlots / 简单列）把 `ellipsis` 译成 `showOverflowTooltip`；vxe ×3 译成 `showOverflow: 'tooltip'`；virtual 引擎走已有的 `createEllipsisCellRenderer`（其中已含 formatter，不丢格式化）；antdv 译成列 `ellipsis: true`（CSS 截断 + 原生 title）。
- **`defaultSort` 补齐**：派生列由生成器补 `sortable: true`（schema / sfc / 片段三条路径同口径，且**只补 `defaultSort.prop` 指向的那一列**）；显式 `columns` 路径不补（用户自己写，不覆盖其意图）；vue3/vue2 在 `tableBindAttrs` 里**显式**写 `result.defaultSort = props.options.defaultSort`（此前靠 TABLE_INTERNAL_KEYS 之外的键「碰巧流过去」，不可断言）；antdv 在 `adaptedColumns` 末尾把 `defaultSort` 落到目标列的 `defaultSortOrder`（`ascending→ascend / descending→descend`），并以 `sorter` 为门 —— 不硬塞 sorter，保持与 el-table「列需 sortable」同构。
- **antdv 删掉 20 字 a-tooltip 分支**（连带其 `.ellipsis-text` CSS 规则）：省略号改由列 `ellipsis` 承担，`formatter`/`customRender`/`bodyCell` 插槽可正常叠加。单测直接钉住「ellipsis + formatter 时 customRender 仍被调用且输出为 formatter 结果」。
- **守卫**：`COLUMN_CONTRACT` 增加两行 —— `column:ellipsis`（三端各自的翻译点 token：`options.showOverflowTooltip` / `base.showOverflow` / `createEllipsisCellRenderer` / `advCol.ellipsis`，`deviation` 写明 a-table 是 CSS + 原生 title、el/vxe 是浮层，可见效果等价、机制不同）、`column:defaultSort`（决定性 token `result.defaultSort` 与 `target.defaultSortOrder`，vxe 三端共用 `defaultSort: { field: ds.prop`，`deviation` 写明 a-table 只有列级 `defaultSortOrder`）。**两行都做了注入自证**：注释掉 `advCol.ellipsis = true` → `column:ellipsis/antdv` 红；把 vue3 的 `result.defaultSort` 改名 → `column:defaultSort/vue3` 红；还原后绿。
- **三向守卫联动**：`check:threeway` 的 `DECLARED_NOT_EMITTED` 里原有一行「`fields.ellipsis` 改名发射为 `column.showOverflowTooltip`」**已陈旧**（该键现在真的发射了），守卫自己报红（「能发射了就必须删行」）→ 删行；`EMITTED_NOT_CONSUMED` 的 `column.showOverflowTooltip` 行**保留**（显式列仍可写该存量词形，且 core `TableColumn` 不收该词形），但 reason 改写成「AN-10 已收口」并指明修复点。
- **测试**：shared 生成器 +7（ellipsis 键词形、不泄漏 `showOverflowTooltip`、未设置不发键、defaultSort → 只给目标列 `sortable`、sfc 同口径、无 defaultSort 不补、显式 columns 不补）；片段 +3（同上三面）；vue3 mount +5、vue2 mount +5（render 分支也带 tooltip —— 修前该分支没有）、antdv +8（含存量键、formatter 不被绕过、`descend`/`ascend`、不可排序列静默跳过、指向不存在列不抛）；vxe 适配器 ×3 各 +3。
- **回归**：`build:libs` + 全仓 `typecheck` 通过；`npm test` 全 workspace 绿（645+51+370+277+659+364+588）；`test:golden` 216/216；`check:consistency` 全链绿（`check:parity`、`check:capability-parity`、`check:threeway`、`check:front-door`、`check:contract`、`docs:check`、`sites:check`、`cases:check`、`one-config:check` …），**唯一红是 `og:check`** —— Windows 上 CRLF 参与输入哈希的既有假阳性（CI 绿），未在 Windows 重新生成产物。
- **对产物/语料的影响**：golden 9 例含 `ellipsis`、2 例含 `defaultSort`；评分口径是「配置 → 代码」一致性，216/216 不受影响。三站文档案例全部由 `docs:check`/`sites:check`/`cases:check` 覆盖，全绿。

---

### AN-11 — 无静默丢弃清扫

**目标**：兑现 I2。

**范围**
1. SFC 显式列的 `btns`/`expandConfig`/`editRender`：改用 `inlineJson`/`codegen-escape`，转义 `</script>`。
2. 函数值（formatter/render）不得裸 `JSON.stringify`：走扩展点标记或显式报错。
3. `permissions`：schema 模式接线（动作按钮权限）或明确告警“schema 模式不消费”。
4. `editConfig` + vxe 无 `editRender`：告警（不能静默 no-op）。
5. 片段表单 `render`/`formatter`：告警或支持。
6. `crud-page` 声明但未 emit 的 `query`/`row-click`：要么实现，要么删声明。

**验收**
- `check:schema` / `check:fragment` 增加“声明了必须发射或告警”的扫描。
- 注入 `</script>` label → 编译腿红。

**落地记录（2026-10-20）**

- **① SFC 显式列转义**：`pushSfcColumn` 的 `btns` / `expandConfig` / `editRender` 三个 JSON 槽从裸 `JSON.stringify` 改为 `inlineJson`（把 `</script` 改写为 `<\/script`，JSON/JS 语义不变）。三处都内联进宿主 SFC 的 `<script>` 块，此前一个列级按钮名写成 `</script><script>alert(1)</script>` 就能提前闭合脚本块。`pushSfcColumn` 的 `groups` 是自指的，递归路径同样经过这三个槽，故多级表头一并收口。
- **② 函数值不再靠死代码收口**：原实现是 `try { JSON.stringify(...) } catch { 省略 + 告警 }` —— 而 `JSON.stringify` **对手上的函数根本不抛**（对象里静默删键、数组里变 `null`，只有 BigInt 抛），所以告警永远不触发、状态是「配置里写了 `click`、产物里凭空少一个键」。新增 `codegen-escape.ts` 的 `findNonJsonValues(value, path)`（返回路径列表，如 `btns[0].click`），三处改为显式探测 + 点名路径告警后整键省略。
- **③ `permissions`**：**不是**接线，而是明确告警。复核源码后确认接线不可行：schema 模式的按钮由 core `resolveCrudActions` 在**运行时**从 `actions` 推导，`CrudPageSchema` 里没有「动作 → 权限码」的落点；而 sfc 模式会把 `permissions.{add,export,import,view,edit,delete}` 写进按钮 `permissionValue`。故 `mode=schema` 时有 `permissions` 就发告警（点名键 + 给出 sfc / 显式 `btns[].permissionValue` 两条替代），sfc 不发。
- **④ `editConfig` 死路**：两条独立判据，`generateFromConfig` 里按配置判一次（schema/sfc 共用）：`engine !== 'vxe'` → 「editConfig 只在 vxe 引擎被读」；vxe 但**没有任何列声明 `editRender`**（递归进 `groups`）→ 「vxe 只有列带 `editRender` 的单元格才可编辑」。两种情况运行时都是静默 no-op：页面正常、双击没反应、控制台不报错。
- **⑤ 片段表单 `render`/`formatter`**：`generateFormBlock` 此前两者都不发射、也不告警。改为**标记而非假装支持**（与完整页同一套源码论证）：`item.render` 是源码扩展点，而 `buildFormItem` 恒写 `formtype`，`es-form` 只在**无 formtype** 时才读 `item.render` —— 硬塞进去也是永不可达的死代码；`formatter` 本就是表格单元格扩展点。两条告警各自点名 prop，并给出可行替代。
- **⑥ `crud-page` 的 `query`/`row-click`（三端）**：两者都只写进 `emits`、**从未 emit**。
  - **`row-click`**：三端模板给内层 `<es-table>` 接 `@row-click="onRowClick"` → `emit('row-click', row)`。Vue 3 已声明事件会被从 `$attrs` 摘掉，`v-bind="$attrs"` 带不过去；Vue 2 的 `$listeners` 更不在 `$attrs` 里 —— 两端都必须显式接线。**复核中还发现两处真正的引擎级缺陷**：(a) vue3 `es-table` 的 virtual 引擎分支是**显式绑定**、一个 `on*` 都没接，`<es-table @row-click>` 在 virtual 下被静默吞掉 → 补 `@row-click="handleVirtualRowClick"` 从 `fallthroughAttrs.onRowClick` 转发；(b) antdv 的 a-table **没有 `row-click` 事件**，`onRowClick` 作为普通 attr 落下去只是一枚挂在根节点、名为 `rowclick` 的惰性 DOM 监听 → 在 `tableBindAttrs` 里过滤掉 `onRowClick`，改由既有的 `resolvedCustomRow` 翻译成 `{ onClick }`（与 `highlightCurrentRow` 共用同一个回调，两者任一存在就必须产出 `customRow`）。
  - **`query`**：**没有**改成 `triggerEvent`。复核 vue2 `es-form.spec.ts` 后确认 EsForm 的既有契约：`key ∈ ['query','rest']` + `triggerEvent` 时**由 EsForm 独占请求**（经注入的 es-table 实例发起、回到第 1 页），且**不回调按钮的 `click`**（测试断言 `expect(click).not.toHaveBeenCalled()`）。改成回调会直接推翻该契约与测试。故查询键改为自己发起一次新搜索（`httpRequestInstance(queryModel, { keepPage: false })`，与 EsForm 的 `queryTableRequest` 同口径），再带当前查询模型 `emit('query')`；重置键保持 `triggerEvent`（重置表单 + 刷新）。
  - 三端 `es-crud-page` 同步改，文档 `es-plus-docs/src/docs/crud-page.md` 事件表补 `query` / `row-click` 两行（含「ADV 由 `customRow` 翻译」的端差异说明）。
- **验收口径的一条偏差**：计划写「`check:schema` / `check:fragment` 增加『声明了必须发射或告警』的扫描」。复核这两个脚本后确认它们的职责是**键集/形状同步**（zod3 镜像、接口键集、发射枚举顺序），不是行为探针；把「某配置必须产出某条告警」塞进去，等于给生成器再开一个测试入口、且会与真生成器行为分叉。故改为在 `structured-generator.spec.ts` / `fragment-generator.spec.ts` 里用**真生成器**断言告警原文与产物形状。第二条验收（注入 `</script>` → 编译腿红）由既有 `check:generator-escaping.mjs` 承担：它的 JSON 上下文断言就是「原样 `</script>` 不得出现在产物任何位置」，且脚本块必须能被 esbuild 解析。
- **测试**：shared 生成器 +6（① `</script>` 转义、② `btns[0].click` 路径告警 + 整键省略、③ schema 告警、③b sfc 消费且落到 `permissionValue`、④ vxe 无 `editRender`、④b 非 vxe 引擎）；片段 +3（render / formatter / 无函数不发噪音）；vue3 `es-crud-page` +2、antdv `es-crud-page-actions` +2、vue2 新增 `es-crud-page-events.spec.ts` 2 例（raw `new Vue` + 模块级 mock，沿用本包既有做法）；vue3 `es-table` +1（virtual 引擎转发）、antdv `es-table` +3（customRow 翻译 / 无监听时不产出 / 与高亮共用回调）。行点击的 vue3 用例做过**注入自证**：临时删掉 `@row-click="onRowClick"` → 用例变红（证明测的是接线，而非 `$attrs` 兜底）。
- **守卫修复**：`check-generator-escaping.mjs` 的「非空证明」会用替身模块整体替换 `codegen-escape.ts`；该替身未导出本批次新增的 `findNonJsonValues`，导致 esbuild 在第二次构建时报 `No matching export`。与既有 `assertEmittableExpr` 同理，`findNonJsonValues` **不是转义器**（是探测器），替身里保留真实现。修后正向与反向证明均绿（转义器恒等化后 21 条变红）。
- **回归**：`npm test` 全 workspace 绿（31+2+16+13+18+15+30 个测试文件，末段 591 例）；`build:libs` + 全仓 `typecheck` 通过（0 个 `error TS`）；`test:golden` 216/216；`check:consistency` 全链通过，**唯一红是 `og:check`** —— Windows 上 CRLF 参与输入哈希的既有假阳性（CI 绿），未在 Windows 重新生成产物。
- **对产物与语料的影响**：新增告警只在配置真的踩到对应死路时出现，golden 语料不读 warnings，216/216 不受影响；三站文档与案例由 `docs:check`/`sites:check`/`cases:check` 覆盖，全绿。

---

## 5. Phase 2 — 编译真实性

### AN-12 — Tier A 编译腿

**目标**：让 `compiles` 表示“真的编译了”。

**实现**
1. 新增 `scripts/eval/compile-leg.mjs`：
   - 抽取围栏块；
   - `.vue`：`@vue/compiler-sfc` parse + compileTemplate + compileScript；
   - `.ts`：TS `transpileModule`；
   - `.tsx`：TS jsx；
   - 三端分别跑（target 影响符号，不影响语法）。
2. `eval-llm.mjs`：`compiles = compileLeg(...)`；保留 `noThrow`。
3. 片段腿同样使用。
4. 编译失败时记录**首个错误位置**（文件、行、列），便于修复。

**验收**
- 人为把生成器模板改坏 → 探针立即红。
- 编译腿对 188 条金标产物 100% 通过。

**落地记录（2026-10-20）**

1. **`scripts/eval/compile-leg.mjs`（新）** —— Tier A 的唯一尺子，导出 `compileSfc` / `compileModule` / `compileSource` / `compileProduct` / `compileFragment` / `extractFences` / `compileFences` / `fmtError`：
   - `.vue`：`@vue/compiler-sfc` `parse` → `compileScript` → `compileTemplate`，**模板真的编译**（旧尺子只看 `<script>`，模板里的坏 mustache / 非法插槽名可一路绿到门禁）；
   - 模块：按扩展名 `.ts/.tsx/.js/.jsx` 走 esbuild `transformSync`；
   - 错误统一归一为 `{ message, file, line, column }`；`compileScript` 抛的裸 Error 无 `.loc` 时从消息里的 `(line:col)` 提取位置。
2. **偏离 §实现 1（TS `transpileModule` → esbuild）**：保留**单一把尺子** —— 发射期的 `assertEmittableExpr` 已用 esbuild，两把解析器并存必然漂移；代价只是不做类型检查（Tier B 另行负责）。已在 `compile-leg.test.mjs` 用 `.ts` 里写 JSX 必须红的反证钉住“扩展名决定 loader”。
3. **围栏抽取收口**：`fencedBlocks` 从 `lib/front-door.mjs` 移入 `lib/compile-check.mjs`（共享解析尺子），`front-door.mjs` re-export 保持既有导入面；`compileBlocks` 改为委托 `compileFences`，**前门 `compileFailures` 从此也是“模板编译级”判据**（无围栏时仍返回 `[]`，由 `front-door-leg` 单独记 rejected）。
4. **三处接线**：
   - `__tests__/golden/scripts/score-golden.mjs`：`checkSyntax` 删掉脚本块循环，改 `compileProduct({ code, wrapperCode })`（保留 `pageSchema` JSON 载荷校验）；
   - `scripts/eval-llm.mjs`：CRUD 行 `compiles = noThrow && compileError === null`，行内新增 `noThrow` / `compileError` 字段，探针打印 `fmtError(...)` 带 `file:line:col`；片段腿用 `compileFragment` 按产物自报 `fence` 分派（`tsx` → 模块，其余 → SFC）；catch 行形状补中性 `noThrow:true, compileError:null`；
   - `lib/front-door.mjs` 见 ③。
5. **自测与守卫**：新增 `scripts/eval/compile-leg.test.mjs`（8 条钉死：TS 错/TSX 合法/JSX-in-.ts 必红/SFC 脚本错/SFC **模板**错/SFC 合法/schema 两段任一坏/fence 错配/围栏归一化与空围栏），`check:compile-leg` 插入 `check:consistency`（紧随 `check:fragment-scorers`）；`@vue/compiler-sfc@^3.5.38` 补为根 devDependency（此前仅靠 hoist）。
6. **验收（照做）**：在 `buildSchemaWrapper` 静态模板行临时注入 `<div>{{ 1 + }}</div>` → `build:libs` → `test:golden` 立即红，报 `compile leg failed — golden.wrapper.vue:9:14 — Error parsing JavaScript expression: Unexpected token (1:4)`（脚本块本身合法，旧尺子必绿，证明差异真实）；精确回滚后 `test:golden` 216/216 恢复绿。
7. **基线（测量非假设）**：216 条 CRUD 金标产物 + 63 条片段产物在新尺子下 **0 失败**；`check-front-door` 216 条 no-table 路由/编译全过；`check-scene-coverage` 63/63 可解析。
8. **回归**：`npm test` EXIT=0（含 shared 218 例）、`test:golden` 216/216、`typecheck` 0 error、`check:consistency` 仅 `og:check` 红（Windows CRLF 假阳性，品牌/og 输入零改动，按既有结论不在 Windows 重生成）。语料/产物零影响：只改“如何判定编译”，不改生成结果。

---

### AN-13 — 编译率门禁

**目标**：`compileRate` 进入 `passed`。

**改动**
1. `passed = gateRate >= TARGET && guards.ok && frontDoorStats.ok && compileRate === 1`。
2. `measured` 排除 `no-answer/truncated`；但未测到行数 > 0 时 run 仍红（测量不完整）。
3. 报告分列 `modelFailureCompile`（模型答错但产物能编译）与 `compileFailure`（真编译失败）。

**验收**：注入一个编译失败产物 → nightly 红，且错误信息指向具体行。

**落地记录（2026-10-20）**

1. **`summarizeCompile(rows, passes95)`（纯函数，落在 `scripts/eval/compile-leg.mjs`）** —— 编译门的唯一汇总口径：
   - 分母 = **有产物的行**（`error` 为空）：`measured` / `compiled` / `rate` / `failure` / `modelFailureCompile` / `failureSamples`；
   - `failureSamples` 用 `fmtError` 带 `file:line:col`，报告与退出信息直接可定位。
2. **偏离 §改动 2 字面（分母额外排除 `model-failure`）**：计划只写「排除 `no-answer/truncated`」，但 `model-failure` 行同样**没有产物**（`driveToValidConfig` 从未产出合法 config）。把它算作编译失败有两重错：① 归因错（模型语义错误 ≠ 发射器缺陷）；② **门禁恒红** —— 95% 准确率目标必然允许若干答错行，`compileRate === 1` 就永远不可达，退化成「永久红 = 红盲」。这与既有基线口径一致（`ratchet.mjs` 记录的「实测部分 133/133 = 100%」）。**「未测到行数 > 0 仍红」由健康门保证**（门禁腿零容忍，未改动）；观测腿（en）残缺仍按用户既有决策「发布门禁腿 + 抑制观测腿」处理，不新增红。
3. **两个失败口径分列（§改动 3）**：`compileFailure` = 有产物但编译不过（发射器缺陷，必须 0）；`modelFailureCompile` = 产物编译通过但不满足 `meets95Definition`（语义 miss，属准确率门禁）。产物新增 `compileMeasured` / `compileCompiled` / `compileFailure` / `modelFailureCompile` / `compileFailureSamples`；`measurement:'failed'` 记录也带编译数字（确定性性质，不受中继故障影响）。
4. **门禁接线**：`passed = gateRate >= TARGET && guards.ok && frontDoorStats.ok && compileRate === 1`；退出条件同步加 `compileRate !== 1`。顺带修正退出文案：此前即使准确率达标、只是前门/编译腿红，也会打印「gate … is below target」；现在只在真的低于目标时才那样说。
5. **产物自洽守卫**（`scripts/eval/artifact.mjs`）：新产物带 `compileMeasured` 时校验 `compiled + failure === measured`、`rate` 算术、且 `passed=true ⟹ compileRate === 1`；旧产物无该字段则跳过（否则守卫会一直红到下一次付费跑批 = 红盲）。
6. **meta-eval 同步**（`scripts/eval/ratchet.test.mjs`）：`passed` 源码断言原先只允许 `guards.ok` / `frontDoorStats.ok`，现显式放行 `compileRate === 1`（这是**确定性缺陷**守卫，不是第二个准确率口径），并新增一条「AN-13 编译门必须真的进 `passed`」的断言 —— 否则这条门禁又会退回成没人执行的宣称。
7. **验收（确定性替代，未烧付费跑批）**：取真实 `generateFromConfig` 产物，把 `</es-crud-page>` 前注入 `<div>{{ 1 + }}</div>`，`compileProduct` 返回 `sim.wrapper.vue:8:16 — Error parsing JavaScript expression: Unexpected token (1:4)`；该行过 `summarizeCompile` 得 `measured 1 / compiled 0 / rate 0 / failure 1`，样本含 `file:line:col`。由于 `passed` 与退出条件都要求 `compileRate === 1`（源码结构由 `check:ratchet` 钉住），nightly 会红且信息指向具体行。未运行真 nightly（无 key/额度），此替代已写进本节而非隐去。
8. **回归**：`check:compile-leg` 绿（新增第 9 组：分母口径、两类失败分列、失败样本带位置、空集 rate=null）；`check:ratchet` 绿；`npm test` EXIT=0（366 + 591 例）；`test:golden` 216/216；`check-artifact-freshness` 对旧产物仍绿；`check:consistency` 仅 `og:check` 红（Windows CRLF 假阳性，品牌/og 输入零改动）。

---

### AN-14 — Tier B 抽样 typecheck

**目标**：捕获语法正确但类型不正确的产物。

**实现**
1. 临时工程：`vue` + 对应 UI 库 + `@es-plus/<target>` + stub 模块。
2. `vue-tsc --noEmit`（`skipLibCheck`），每 target 抽样 N=10 模型产物 + 全部金标。
3. 结果进入 artifact；初期 observe，稳定后 gate。

**验收**：`import type { CrudPageSchema }` 缺失或事件签名错误时能红。

**落地记录（2026-10-20）**

1. **`scripts/eval/typecheck-leg.mjs`（新）** —— Tier B 的唯一尺子，导出 `TYPECHECK_TARGETS` / `typecheckTsconfig` / `typecheckShims` / `productFiles` / `sampleTypecheckCases` / `buildTypecheckCases` / `writeTypecheckProject` / `parseTypecheckDiagnostics` / `missingComponentDists` / `runTypecheck` / `summarizeTypecheck` / `fmtTypecheckDiagnostic`。每个 target 一个临时工程（`node_modules/.esplus-typecheck/<target>`），`vue-tsc --noEmit` 跑一次；`tsconfig` 刻意宽松（`strict:false`、`skipLibCheck:true`、`types:[]`），只抓「产物与自己声明的类型不符」。
2. **偏离 §实现（TS 投影）**：216 条 CRUD 金标全是 JS（`typescript:false`），而 Volar **只在 TS SFC（`lang="ts"`）里做模板类型检查** —— 原样检查 JS 产物等于恒定通过，是一条看不见的红盲。故对每个 config 重新生成 `{ ...config, typescript:true }` 的产物再检查（同一发射器、同一配置，只让它产出类型化的那一版）。这样金标也可度量，且验收条件（缺 `import type` / 事件签名错）本身是 TS 属性。已在文件头注与本记录显式标注偏差。
3. **抽样口径**：金标**全量**检查（129 vue3 + 45 vue2 + 42 antdv）；模型产物按 target **每端 N=10**（`sampleTypecheckCases`，保序、可复现）。只吃 `lang === 'zh'` 的行 —— en 腿不参与门禁，混进来只会稀释每端样本。
4. **只观测**：`typecheck` 块进 artifact（成功与 `measurement:'failed'` 记录都带），控制台与探针各自打印；**不进** `passed` / 徽章 / exit code。理由：首次上闸前要先看清真实失败分布（计划「初期 observe，稳定后 gate」），且抽样是投影口径。
5. **依赖与接线**：临时工程从仓库 `node_modules` 解析 `vue` / UI 库；`@es-plus/<target>` 解析的是 `dist/index.d.ts`，故根脚本新增 `build:components`（core + shared + vue2 + vue3 + adapter-antdv），nightly `eval-llm.yml` 的构建步骤从「只建 shared」改为 `npm run build:components`。缺 dist 时腿**显式记 `skipped` + 原因**并打 `console.error`，绝不静默变绿；但也不打断一次已经跑了几小时的全量（失败记录里同样可见）。
6. **机制上踩到的两个假绿陷阱（已修入实现）**：
   - `shims.d.ts` 必须被 tsconfig 的 `include` 收进去（`['cases/**/*', '*.d.ts']`），否则 `GlobalComponents` 从不加载，模板里的 `:schema` / `@btn-click` **完全不检查**；
   - shims 文件结尾必须有 `export {}`，否则它是**脚本**，`declare module 'vue'` 被当成「重新声明整个 vue 模块」而不是「给真实 vue 增量补 GlobalComponents」—— 同样静默失效。两条都由自测的「事件签名错必须红」咬出来（先前用真实金标跑出的 0 诊断里有相当一部分是假绿）。
   - 自测里的 stub 必须是**落盘的包**（`node_modules/<name>/index.d.ts` + `package.json`）：在 shims 里写 `declare module 'stub'` 能解析 import，却不会让 `typeof import('stub').X` 进入 GlobalComponents。
7. **腿咬出的真实缺陷（已修 + 回归）**：
   - **vue2 schema wrapper 的 `pageSchema` 没从 `setup()` 返回**（`buildSchemaWrapper` 与 `buildSchemaWrapperNew` 都是）：Vue 2 模板只能解析 `setup()` 返回值，`:schema="pageSchema"` 静默变 `undefined`（空表、无报错）；`vue-tsc` 报 TS2339。
   - **绑定表达式被 HTML 实体化**：状态标签 `:type="row.status === 1 ? 'success' : 'danger'"` 经 `qAttr` 变成 `&#39;` / `&amp;&amp;`，Volar 把属性值**原样**交给 TS 解析器 ⟹ TS1003/TS1005。新增 `qExprAttr`：双引号属性里的表达式**只**实体化 `"`。`check-generator-escaping.mjs` 的非空证明替身同步补 `qExprAttr`（恒等化），否则守卫自身 esbuild 失败（与 AN-13 的 `findNonJsonValues` 同型）。
   - **有弹窗、无删除的 SFC 产物**缺 `ElMessage`（antdv 端 `message`）导入：提交路径无条件调用，此前只在 `hasDelete` 时导入 ⟹ `Cannot find name`。
   - **TS 投影下字面量被拓宽**：`formItems` / `queryBtns` / `columns` / `options` / `dialogFormItems` 无非空断言，赋给 `FormItemOption[]` 等会因 `formtype: string` 报错；生成器在 `ts` 模式下补显式注解。
   - **`labelKey`-only 表单项**：`FormItemOption.label` 是必填，生成器只发 `labelKey` 时产物缺 `label`；改为两者都发（`labelKey` 优先序不变）。
   - **`QueryForm` 注解悬空**：无查询字段时仍发 `reactive<QueryForm>`；接口与断言的发射条件统一。
   - **`hasCustomRender` 类型缺口**：生成器把 AI-only 注解键写进 dialog 配置，三端 `CrudDialogConfig` 此前无此键（TS2353）。按运行时既有语义（`DIALOG_PASSTHROUGH_KEYS` 刻意不转发）补成显式可选键而非删标记。
8. **验收证据（确定性，未烧付费跑批）**：`check:typecheck-leg` 用自包含 stub 包真跑 `vue-tsc`：正常产物绿、缺 `import type { CrudPageSchema }` 报 **TS2304**、`@btn-click` 绑 `(n:number)` 报 **TS2322**；反证——把 stub 组件放宽成 `DefineComponent<any,any,any>` 后同一份错误产物**不再**红，证明判红来自组件类型链路而非恒红。真实组件同机制复核：给金标产物注入 `@query="(n: number) => {}"` → `TS2322`（`(model: Record<string, unknown>) => any`）。全量 216 条 TS 投影产物三端 **0 诊断**。
9. **回归**：`build:libs` + `check:generator-escaping` 绿（非空证明 18 条变红）；`npm test` 全 workspace EXIT=0（末段 591 例）；`test:golden` 216/216；`check:typecheck-leg` 绿；`check:consistency` 全链通过，**唯一红是 `og:check`** —— Windows 上 CRLF 参与输入哈希的既有假阳性（CI 绿），未在 Windows 重新生成产物。`check:threeway` 因两处必要同步而修：① 探针配置是 `typescript:true`，`constBlock` 原先按 `const <name> = ` 字面量查找，遇到 TS 注解（`const options: TableOptions = {`）定位失败 → 改为容忍可选注解；② `fields.label` 现在恒发射，按该表纪律（能发射了就必须删行）从 `DECLARED_NOT_EMITTED` 删行。

---

### AN-15 — preflight / doctor

**目标**：把“编译通过但能力静默失效”显式化。

**实现**
1. 生成物输出 `preflight` 块：`httpRequest` / `permission` / `t` / JSX 插件 / UI 库。
2. `scaffold_page` 与生成物共享同一份前置清单。
3. 可选 `doctor_page` 工具：检查宿主入口装配。

**验收**：生成物含 preflight；文档与 `scaffold_page` 一致。

**落地记录**

1. **单一 builder**：新增 `packages/shared/src/preflight.ts` —— `buildPreflight` / `buildScaffoldPreflight` / `formatPreflight`。输入是 `StructuredCrudConfig` 的**结构子集**（`PreflightInput`），刻意不 import 该类型：否则 `structured-generator → preflight → structured-generator` 成环。`generate_crud`、`generate_crud_from_config`、`scaffold_page` 三处调的是同一份逻辑，清单不会分叉。
2. **required 由生成器事实推出，不是「一律要求」**（每条都在源码里核对过）：
   - `httpRequest`：两种模式的产物都恒发 `apiParams: { url: config.apiUrl }`（schema `:463` / sfc `:891`），表挂载即经全局 `httpRequest` 取数 ⟹ 恒 required；`generateScaffold` 只有含 `table` 时才传 `usesRemoteData:true`。
   - `permission`：只认 `permissionValue`（字段/列/弹窗表单项/按钮）与 `config.permissions`。理由写进清单：core 在未配置时**默认放行**，所以缺 `permission` 不是「权限没生效」而是「门看起来配了、实际谁都进」——失败方向是 open。
   - `i18n`：只认 `config.i18n` 与 `labelKey`（含 `columns` / `dialogs[].formItems` / `expandConfig.fields`）。缺 `t` 的降级是回落 `label`（不崩）。
   - `jsx`：只认 `mode=sfc` ∧ `actions` 含 add/edit/view（`generateSFC` 的 `hasDialog` 判据，弹窗 render 走 JSX）；schema 模式由运行时 `<es-crud-page>` 渲染，无 JSX；scaffold 的 `dialog` 只是 `useDialog()`，显式 `jsxRender:false`。
   - 不需要的项**也打印**，并注明「不需要」的依据 —— 否则读者无法区分「忘配」与「本来就不用配」。
3. **生成物接线**：`StructuredGenerateResult` 新增可选 `preflight`（仅 `generateFromConfig` 挂载；内部两个发射器没有「配置事实」）。`generate_crud` / `generate_crud_from_config` 在 warnings 之后、代码之前输出该块；`scaffold_page` 删掉手写入口样板，改调 `formatPreflight(buildScaffoldPreflight(...))`。
4. **`doctor_page`（可选项，已实现）**：`packages/shared/src/doctor.ts` + MCP 工具。只做**字面量静态扫描**，因此是三态 `ok / missing / unverified`（`unverified` 不是通过，报告明确写出）。两个失败方向都钉了测试：① 先**剥注释**再扫 —— 入口样板注释里就写着 `permission / t / httpRequest`，不剥会把「只在注释里提过」判成已配置；② 选项是标识符（`app.use(ESPlus, options)`）或含 spread 时判 `unverified`，不猜。不传 `config` 时 permission / i18n / httpRequest 保守按 required（少报一项就是把「没验到」伪装成「不需要」）。
5. **顺带修复的源码缺陷**：`generateAppEntry('vue3')` 此前**不装配 UI 库** —— vue2/antdv 都有各自的 UI 库，唯独默认 target 的「照抄入口」拿到的是 `el-*` 全部未知元素的页面；三端也都漏了 `@es-plus/<pkg>/dist/style.css`。现三端入口均含 UI 库（含 CSS）与 es-plus 样式导入（`dist/style.css` 在三个包的 `exports` 里均存在）。
6. **偏离计划字面**：计划写「可选 `doctor_page`」，实际实现并纳入 README；`preflight` 没有塞进 `warnings[]`（那是配置映射问题），而是独立块 —— 两者回答的问题不同。
7. **测试**：`packages/shared/__tests__/preflight.spec.ts` 25 例（required 推导、scaffold 共用、format、doctor 三态/注释陷阱/spread/shorthand、`stripJsComments` 保留 URL、`probePluginOptions` 三形态）；MCP 工具测试补 preflight 与 doctor 端到端；`code-generator-scaffold.spec` 补 UI 库/样式断言。
8. **回归**：`build:libs`（core + shared）绿；shared+mcp 977 例、根 `npm test` 591 例全绿；`test:golden` 216/216；`check:exports` / `check:readme` / `check:site-claims` / `check:scaffold` / `check:entry` / `check:front-door` / `check:generator[-targets]` / `check:generator-escaping`（非空证明 18 条）/ `check:threeway` / `check:contract` / `check:docs-layout` / `docs:check` / `sites:check` / `ai:check` 全绿；`og:check` 未在 Windows 重跑（既有 CRLF 假阳性，CI 绿）。

---

## 6. Phase 3 — 覆盖面

### AN-16 — `useDialog` 语料 / 评分 / 运行时见证

**范围**
- composable 与 component 两形态；
- 底座键（appendTo/cacheKey/closeOnClickModal…）；
- `open(title,row?,onSuccess?)` 契约；
- 提交方法（POST/PUT/view 只读）；
- 三端。

**规模**：≥6 例/target（18 例）。

**验收**
- 新增 `scripts/eval/dialog-scorers.mjs` + 定义级测试。
- 三端 mount：打开/提交/只读/关闭。
- `check:scene-coverage` 覆盖 dialog 场景。

**落地记录**

1. **复核结论：语料与评分维度早已就位，缺的是「专用工件 + 定义级测试 + 三端行为见证」。** 21 例语料（每端 7：composable 3 / component 4）、`fragment-scorers.mjs` 的 dialog 维度（`apiUrl` / `noApiUrl` / `rowkey` / `mode` / `composableName` / `defaultTitle` / `dialogMaskNonClosing` / `options.*`）由 AI-28 / AI-47..52 铺好；`check:scene-coverage` 的 dialog 6 格（3 端 × 2 形态）已是既成事实。本轮补的是**契约层的可失败断言**与**提交/只读/关闭的运行时证据**。
2. **`scripts/eval/dialog-scorers.mjs` 是合约透镜，不是第二个 scorer。** 打分一律走 `scoreFragment('dialog', …)` 的单一实现（re-export），本文件只补 dialog 事实：`READ_ONLY_TITLE` / `NEW_TITLE`、`DIALOG_OPTION_KEYS`（13 键）、`dialogSubmitContract()`、`dialogShapeForTitle()`、`dialogGoldProblems()`。另写一份打分逻辑就是让同一个意图在两处判分，阈值一调就分叉。
3. **`dialog-scorers.test.mjs` 钉九件事**（`check:dialog-scorers`，无 API key 进 CI）：语料规模与两形态覆盖；标注健康（无消费者键：component+cacheKey / component+composableName / 拼错的 options.*）；gold-vs-gold full/scoped/stated 全绿；dialog 专属维度**逐个扰动**（只扰 `applicable:true` 的维度 —— 扰一个不适用的键永远「仍判过」，那是测试找错了对象）；等价写法判等（`480`≡`'480px'`、rowkey 省略≡`'id'`、`modal:false`≡`closeOnClickModal:false`）；派生规则与 `fragment-generator.ts` 源码一致（`title === '查看'/'新增'` 各 ≥2 处、两支提交都以 `apiUrl` 为闸门、选项键全集 ≡ `DialogBlockOptions`）；三端语料除 `target` 外逐字节同源；提交合约派生；title→形态。`modal` / `closeOnClickModal` 不各自成维（语义维 `dialogMaskNonClosing` 已按等价编码归一，单列会把一次意图数两遍）。
4. **抓出并修掉一处语料缺陷**：`frag-dialog-01/02-vue3` 的 `pinnedDims` 漏了 `"target"`，vue2/antdv 有 —— 三端同源断言当场点名。缺这个 pin，scoped 腿会放过「把 vue3 产物写成 vue2 语法」的预测。
5. **运行时见证三端（打开 / 提交 / 只读 / 关闭）**：
   - **vue3（Tier 1，`packages/vue3/__tests__/fragment-runtime.spec.ts`）**：component 形态 open('编辑') → PUT `/api/users/1`、open('新增') → POST `/api/users`、open('查看') 只有「关闭」且零请求、关闭后真收起；composable 形态 POST → 收起 → 再开 → 「取消」只关窗不发请求。观察点两处修正：
     - Element Plus 2.14 的 `v-show` 挂在**最外层**（`modal:true` 是 `.el-overlay`，`modal:false` 是 `.el-modal-dialog`），`.el-dialog` 自身恒可见 —— 拿它判「关了没」恒为 false；
     - `useDialog` 单例的 `close()` **只翻转 visible**（容器由 `destroy()` 才移除，见 `use-dialog.ts` 单例分支），故断言应是「弹窗收起」而不是「容器消失」；「容器消失」在 vue2/antdv 的 Tier 2 已由 `destroy` 路径单独覆盖，本轮不重复。
   - **antdv（Tier 1，`packages/adapter-antdv/__tests__/fragment-runtime.spec.ts`）**：与 vue3 同构。组件形态的可见性**不用 DOM 判**：vc-dialog 的 `.ant-modal-wrap` 何时 `display:none` 由 Transition 的 `onAfterLeave` 决定，happy-dom 不跑过渡事件，DOM 会永远停在「未收起」—— 那是环境假阴性，不是组件行为；改读 a-modal 的 `open` prop（契约）。composable 形态 `destroyOnClose:true` 会整体卸载内容，DOM 判据可用。
   - **vue2（Tier 2，`__tests__/e2e-runtime/`）**：补三例 —— 组件形态「新增 → POST」、组件形态「查看 → 只读（只有关闭、零请求）」、composable「取消只关窗」。**顺带修了一处过期定位**：AI-48 让 `appendTo` 在 vue2 显式降级为 `append-to-body` 后，弹窗真的挂到 body，AI-44 写的 `section(...).locator('.el-dialog')` 已失配（完整套件里连带原有用例一起红 —— 上游行为变更后用例未同步，是这次 e2e 复核的直接产出）。
6. **口径说明（偏离计划字面之处）**：计划把「提交方法（POST/PUT/view 只读）」列进评分范围，但这些**不是配置字段** —— 方法由运行时 `title` 派生，记分卡结构上不可能有对应维度。故以两种方式落地：`dialog-scorers.mjs` 导出 `dialogSubmitContract()` / `dialogShapeForTitle()` 作为**合约事实**（供定义级测试与宿主断言），真正的验证放在三端运行时见证里。
7. **回归**：`check:dialog-scorers` 21 例绿、`check:fragment-scorers` 63 例 / 66 维绿、`check:scene-coverage` 四场景 6/6+3/3+3/3+6/6 绿；vue3 593 例、adapter-antdv 652 例全绿；vue2 运行时 E2E 16 例全绿（含新增 3 例）；`test:golden` 216/216。

---

### AN-17 — 三组件组合语料

**范围**：query+table+form+dialog、form+dialog、table+form 并排。

**规模**：≥6 例/target（18 例）。

**评分维度**：成员布尔、同名字段归并、actions/dialogs、operationColumn、三端语法。

**验收**
- 新增 `composition-scorers.mjs`。
- 组合产物走 Tier A 编译。
- 运行时 mount 至少 1 例/target。

**落地记录**

1. **组合不是第五个场景，语料单独成目录。** 组合产物最终仍是一份 `StructuredCrudConfig`（或 no-table 分支的几段片段），若塞进 `__tests__/golden/cases/`，会被 `eval-llm.mjs` 当成 CRUD 计划行（它要求每例都有 `config`），而 `form+dialog` 形状**没有** CRUD 产物 —— 会把一条合法语料变成 eval 的异常行。故新建 `__tests__/golden/composition/`，CRUD / 片段的既有分母（166 heldout、维度 applicableCounts）**零变化**。
2. **18 例 = 3 形状 × 3 端 × 2 例。** `full`（query+table+form+dialog）、`table+form`（无查询、无显式 dialogs）、`form+dialog`（无表格，前门 no-table 分支）。三端语料除 `id`/`target` 外逐字节同源（`check:composition` 断言），否则端间差异会被误当成模型能力差异。字段刻意覆盖三种组合事实：同名跨三面（full 的 `name`/`status`）、table-only（`createdAt`）、form-only（`remark`）。
3. **`composition-scorers.mjs` 是合约透镜，不是第二套记分卡。** 分数一律走 `scoreAll`（re-export），本文件只补 `scoreAll` 结构上看不到的组合事实：形状派生、同名字段归并（`duplicates`）、actions/dialogKeys 派生、legacy `dialogFormItems` 形态、operationColumn 保留。每个 fact 独立给出 `pass`，报告能回答「是归并坏了，还是动作派生坏了」。`compositionScoped()` 只在通用 scoped 上 AND 这些事实；`form+dialog` 标为 `applicable:false`（配置维度对片段产物没有意义，同「表格场景不启用表单专属维度」）。
4. **`check:composition`（无 API key，进 `check:consistency`）钉七件事**：语料规模/三端同源；标注健康；**真前门**驱动（`captureFrontDoor`，不是复制路由逻辑）；Tier A 编译全部产物；`composeCrudConfig(surfaces)` 的事实与语料声明逐项一致 + 经 `generateFromConfig` 落到 pageSchema（`columns`/`formItems`/`dialogs`/`dialogFormItems` 四处成员关系）；gold-vs-gold 全绿；六个事实逐个外科手术式扰动（只扰适用的事实）后总分与 scoped 同时翻红。`front-door.mjs` 只加了一行 `export { generateFromConfig }`，让这条测试能直接验「组合配置 → 运行时 schema」，不必解析产物文本。
5. **`form+dialog` 的验证走 no-table 分支。** 前门对无表格子集不调 `composeCrudConfig`，而是为每个 dialog entry 各发一段 composable，弹窗体 = form 面（省略 `formItems` 时的既有契约）。故该形状的断言是：产物含 `no table surface`、composable 数 = dialog key 数、名字由 key 派生（`useAddDialog`/`useEditDialog`）、每段都含全部 form 面字段、且**不**生成 CRUD 页面。`table+form` 的弹窗不是显式 `dialogs`，而是由「表单面存在」推导 `['add','edit']` 后走 legacy `dialogFormItems` —— 这正是它与 `full` 的语义差，单列为 `legacyDialogFormItems` fact。
6. **运行时三端各 ≥1 例**：
   - **vue3（Tier 1）**：`packages/vue3/__tests__/composition-runtime.spec.ts` 挂 `comp-full-01-vue3` —— surfaces → compose → generateFromConfig → 真 EsCrudPage。断言 table-only 的 `createdAt` 不进表单、form-only 的 `remark` 不进查询/表格、查询面恰好两个字段且查询真触发重载、弹窗体来自 form 面（有备注、无创建时间）。
   - **antdv（Tier 1）**：`packages/adapter-antdv/__tests__/composition-runtime.spec.ts` 与 vue3 同构同语料；按钮按归一化文本找（a-button 会插空格），列字段直接读 EsTable 的 columns prop。
   - **vue2（Tier 2）**：`gen-fragments.mjs` 从 `comp-form-dialog-01-vue2` 生成 **add/edit 两段** composable（证明「一份 form 面 → 多个 dialog key」各自成段），`FragmentsApp.vue` 加两个入口，`vue2-fragments.spec.ts` 断言两段都能独立打开、标题分别为 新增/编辑、字段都来自 form 面、只开窗+取消零写请求。
7. **口径说明（偏离计划字面之处）**：
   - 计划把 `operationColumn` 列为评分维度；本语料 18 例的期望都是「未声明（null）」，因为组合页的按钮面本应由 `actions` 在运行时派生。**显式 operationColumn 的保留路径**由既有 CRUD 语料 + `scoreAll` 的 `operationColumn` 维覆盖；组合透镜补的是「派生时不得凭空多出 / 声明时必须原样保留」的可扰动事实。
   - 「三端语法」不另设维度：三端同源语料 + `scoreAll` 的 `target` 维（vue2/antdv 适用）+ 每例**真前门产物过 Tier A 编译**，三条合起来就是三端语法证据。
   - 组合记分卡**尚未**接入付费 eval 腿：当前 eval 的 CRUD 行由模型直接产 `config`，没有「模型产 surfaces → 前门组合」的驱动力（`driveFrontDoor` 只回放已得的 config）。这条观测腿留给 AN-18 的片段腿门禁化之后再接；本批先把合约、语料、编译与运行时证据落地。
8. **回归**：`check:composition` 18 例绿（full=6 / table+form=6 / form+dialog=6）；`check:front-door` / `check:front-door-leg` / `check:dialog-scorers` 保持绿；vue3 596 例、adapter-antdv 655 例全绿；vue2 运行时 E2E **17** 例全绿（新增组合 1 例）；`test:golden` 216/216。

---

### AN-18 — 片段腿门禁化

**目标**：63 例不再只是观测。

**改动**：`passed` 增加片段 `compileRate === 1 && scoped ≥ 阈值`（阈值先按当前值 + 不回退，再逐步提高）。

**验收**：片段腿红时 nightly 红。

**落地记录**

1. **判据落在纯函数模块 `scripts/eval/fragment-leg.mjs`**（`summarizeFragmentLeg`），与 `front-door-leg` / `compile-leg` 同构：付费 eval 只在夜间跑，但「这条腿读什么」必须每次 PR 都能免费验。`fragment-leg.test.mjs` 钉九类：健康通过；49/63=0.77777… 与地板 0.7778 判等（浮点尾数不得假红）；有产物但编译失败必红且带 `file:line:col`；**模型答错不计入编译分母**；未测到 1 行必红；零分母（cases=0 / measured=0）必红；基线缺 `fragmentScopedMin` 必红（fail closed）；scoped 低于地板必红；全部行无产物必红。进 `check:consistency`（`check:fragment-leg`）。
2. **先修一处测量公平性缺陷（否则门禁恒红）**：片段 `compileRate` 原先以 `measured` 为分母，把 `model-failure`（模型三轮都没产出合法工具入参、根本没有产物）也算成编译失败 —— 与 AN-13 记录过的错误完全相同。若照此接 `compileRate === 1`，在「95% 目标必然允许若干答错行」的现实下片段门禁**永远到不了 1**，退化成红盲。改为复用 `summarizeCompile(fragmentRows)`：分母 = 真有产物的行，模型答错按准确率计 0、不进编译分母；未测到由本腿的 `notMeasured === 0` 判红（CRUD 健康门只看 zh CRUD 行，覆盖不到片段，不能把它留给健康门）。报告与产物同步改口径，并新增 `compileMeasured/compileCompiled/compileFailure` 让读者能自己验算。
3. **阈值放在人工基线里，缺失即红**：`accuracy-baseline.json` 新增 `fragmentScopedMin: 0.7778`，来源是 2026-10-19 的 `--fragments` 全量探针（63/63 测到、0 答错、0 降级：core 95.2% / scoped 77.8% / compiles 100%），并在 `fragmentScopedSource` 与 `_comment` 写明。夜间 workflow **不**回写该文件（与 `definition95` 同一原则：一次真实退步不得被自动记成新基线）。缺失/非法值不静默放行 —— 「绿灯只因为没人设线」是本仓反复栽过的红盲。
4. **比较按发布精度四舍五入到 4 位**：scoped 是布尔均值（49/63 = 0.777777…），产物与基线都按 4 位小数发布。直接比较会让**同一次跑批**因浮点尾数翻红（0.77777 < 0.7778），一次假红足够让人不再相信门禁。`fragment-leg` 与 `artifact.mjs` 用同一发布精度。
5. **接线三处同源**：`passed` 增加 `fragmentStats.ok`；exit code 的判据块增加 `!fragmentStats.ok`（nightly 因此真红）并单列 `Fragment leg failed (AN-18)` 原因；产物 `fragments` 块写入 `scopedMin` / `scopedGateOk` / `compile*` / `gateOk` / `gateFailures`。`artifact.mjs` 增加自证：`passed=true` 时片段编译失败必须为 0、未测到必须为 0、`scoped ≥ scopedMin`、`gateOk !== false`；片段编译算术（compiled + failure = measured）对所有新产物成立。旧产物无 `fragments` 块时按旧口径放行（同 AN-13：长期恒红 = 红盲）。
6. **口径分工保持**：CRUD 门禁仍是用户拍板的 `definition95`（scoped zero-edit ∨ ≤K 收敛），片段准确率仍分腿报告（core/stated/full 只观测）；只有片段的**编译**（确定性产物缺陷）与 **scoped 地板**（人工棘轮）进门禁。两个分母不混，避免任一侧回归被另一侧的样本规模稀释。
7. **回归**：`check:fragment-leg`、`check:ratchet`（源码同源断言更新为多行 `passed`，并新增「片段腿必须进 passed / exit / 纯函数模块」三条）、`check:compile-leg`、`check-artifact-freshness`（旧产物仍绿）全部通过；无 key 冒烟跑 `eval:llm` 仍正确 SKIP。
8. **遗留**：AN-17 落地记录第 7 条提到的「组合记分卡接入付费 eval 腿」不在本批范围 —— 本批只把**已有**片段语料从观测抬成门禁，不新增模型驱动力。

---

### AN-19 — PRD / 设计提取资源 + 语料

**目标**：工程化“第一公里”。

**改动**
1. 新增 resource `esplus://design-extraction`：从 PRD/线框提取 surfaces 的契约、检查清单、正反例。
2. 新增 prompt `spec-to-surfaces`。
3. 新增文本 PRD 语料 ≥20 条，进入 eval 观测腿。
4. 明确：截图/设计稿由宿主视觉理解，server 不接收图片。

**验收**：PRD→config 观测腿有数字；资源可被客户端读取。

**落地记录**

1. **资源即契约（发布面）**：`packages/mcp-server/src/resources/design-extraction.ts` 注册 `esplus://design-extraction`（`text/markdown`）。正文分七节：§0 只收文本、图片由宿主视觉转写（server 无图片入参、无 OCR）、§1 转写清单（区域→标签/控件/按钮）、§2 输出契约（成员关系 = 出现在列表里；**禁止** `inQuery/inTable/inForm`；`dialog` 字符串 vs 全参对象；字段可跨面重复）、§3 决策表（只读 / 系统生成字段 / 无表 query/form/dialog / 导出→tableBtns）、§4 正例 P1–P4、§5 反例 N1–N7、§6 检查清单、§7 非目标。`design-extraction.spec.ts` 8 例钉住：聚合注册可见、只读文本边界、成员关系规则与禁用键、四个面与 `formItems`、只读/系统字段不得进表单、正反例与清单、prompt 注入 URI、`target/mode` 默认与转发。
2. **prompt 与资源同源**：`prompts/spec-to-surfaces.ts` 的指令显式要求先读 `${DESIGN_EXTRACTION_URI}`，再按宿主给定项输出 JSON；图片在 STEP 1 由宿主视觉转写（与本机边界一致）。参数 `spec`（必填）+ `target`/`mode`（默认 vue3/schema）。
3. **语料独立成目录，避免污染现有分母**：`__tests__/golden/prd/` 22 条文本 PRD（19 条有表 / 3 条无表：仅查询、仅表单、仅弹窗；3 条自定义弹窗；6 条只读）。**刻意不放进 `cases/`**：CRUD/fragment 的语料指纹与分母不能被第一英里语料稀释（与 AN-17 组合语料同一分离原则）。每条 `spec` 是 `【查询区】【列表】【新增/编辑表单】【工具栏】【行操作】` 式的文本清单，成员关系在 gold `config` 里显式写成 `inQuery:false` 等。
4. **公平性离线可证**：`prd-leg.test.mjs` 断言每个 gold 标签**字面出现**在 `spec` 里（否则模型被要求猜一个从未见过的标签）、文件名等于 id、gold 自评 exact、≥20 条、≥15 条有表、≥3 条无表、≥3 条自定义弹窗、≥3 条只读、四面全覆盖。
5. **语料可表达 / 可路由 / 可编译 / 成员 round-trip**：`scripts/check-prd.mjs`（`check:prd`）用 `captureFrontDoor()` 现打包**真前门**（metafile 自证 `shared/src` 22 个、`shared/build` 0 个），逐条：`deriveSurfaces` → 真 `crudShape` → 真 handler → table/片段路由 → Tier A 编译 → `composeCrudConfig` 还原 per-field `[inQuery,inTable,inForm]`。读数：**22 条可表达 · table 19 / 片段 3 · 编译 22（失败块 0）· 成员 round-trip 19**。没有一条能走 table、或没有一条能走 no-table，都判红。
6. **记分卡是「第一英里」专用**：`scripts/eval/prd-leg.mjs` 只比 **surfaces**（面是否存在、每个面有哪些**标签**字段、弹窗键集合），不比 prop 名、formtype、校验、接口 —— 后者已由 CRUD/片段腿在为此设计的语料上测量。成员关系按 gold∪pred 标签集合**微平均**：漏字段、多造字段、放错面（在两个面各错一次）都算错，"全都放上去" 不会更好。`exact` = presence ∧ membership ∧ dialog 键。测量纪律与其余腿一致：`model-failure` 是成绩（记 0）、`no-answer/truncated` 排除并公布条数、编译分母只含**真有产物**的行（前门拒绝/空 surfaces 不冒充发射器缺陷）。
7. **eval 接线**：`scripts/eval-llm.mjs` 新增 `--prd`（探针；`PROBE` 成员，不写产物）。**全量跑**在片段循环后跑同一批 22 条（多 22 次调用）；`--prd --limit N` 可先探中继。system prompt 由捕获的**真** `generate_crud`（name/description/zod shape）＋打包自资源模块的 `buildDesignExtractionContent()` 组成 —— 契约只有一份，改了资源就改了被测口径（`captureFrontDoor` 的 entry 增加该 import/export，`setupFrontDoor` 返回 `extractionContract`；缺失即 exit 1，不在空契约上测量）。每条再把模型产出喂真前门并过 Tier A 编译。
8. **偏离计划字面（3 处，均有理由）**：
   - `name/apiUrl/target/mode` 作**宿主给定**（初始消息里抄写），只评 surfaces。生产里它们由项目探测/路由表/宿主决定，spec 文本不含；让模型猜常量会把第一英里的分数与「猜命名」混在一起（与 F9 同一处理）。
   - 评分身份用 **label** 而非 prop：spec 给的是中文标签，prop 是命名选择，不应算第一英里的错。
   - **只观测、不设地板**：用户拍板的 95% 定义只针对 CRUD 语料；PRD 语料是不同输入/不同输出。先积累真实数字，再按 `fragmentScopedMin` 的方式人工定线。
9. **产物自证**：成功与失败记录都写 `prd` 块（cases/measured/notMeasured、presence/membership/dialogs/exact、compile 三件套）；`artifact.mjs` 增加算术自检（measured+notMeasured=cases、membershipCorrect≤Total 且与 rate 相符、compiled+failure=measured）。旧产物无 `prd` 块时按旧口径放行（同 AN-13/18）。
10. **回归**：`check:prd-leg`、`check:prd`、`check:front-door`（216 条全通）、`check:front-door-leg`、`check:ratchet`、`check:fragment-leg`、`check:composition`（18 例）、`check:compile-leg`、`check:artifact-freshness` 全绿；mcp-server vitest **289/289**、`tsc --noEmit` 干净；无 key 冒烟 `eval-llm --prd` 正确 SKIP、`--require-key` 正确 FAIL（本机未装 `@anthropic-ai/sdk`）。
11. **遗留**：本机无 key/SDK，付费腿未在本批实跑；接线后**下一次全量夜间跑批**会写出 `prd` 数字（`--prd --limit N` 可先低成本探针）。等首批真实数字出来后再决定是否需要地板与是否需要扩充语料。

---

### AN-20 — `ingest_schema` 补齐

**目标**：覆盖规格文档中的常见数据模型。

**改动**
1. 实现 `ts-interface` 解析（interface/type 字面量）。
2. 实现 `sql-ddl` 解析（CREATE TABLE + 列类型）。
3. 仍只做“类型→formtype”，查询面/按钮交给宿主。

**验收**：新增解析单测 + 2 条 golden 草稿。

**落地记录（2026-10-20）**

1. **`ts-interface` 解析**（`packages/shared/src/schema-ingest.ts`）：识别 `interface X {}` 与
   `type X = {}`（含 `export` / `default` / 泛型参数）；用平衡括号扫描取类型体（字符串与注释里的
   `{}` 不计），按顶层换行/分号切成员（内联对象、泛型参数里的分隔符不切）。
2. **成员语义**：`/** ... */` JSDoc 首段作 label；非可选成员 `required: true`，可选成员**不写**
   `required`（缺席 ≠ false，与既有 JSON 路径一致）；字符串字面量联合 → `Select` + `dataOptions`，
   字面量联合数组（`Array<'a'|'b'>` / `('a'|'b')[]`）→ `Checkbox` + `dataOptions`。
3. **`sql-ddl` 解析**：识别 `CREATE [TEMP] TABLE [IF NOT EXISTS] name (...)`（含
   `` `db`.`table` `` / `"schema"."table"`）；顶层逗号切列定义；`PRIMARY KEY (...)` / `KEY` /
   `INDEX` / `CONSTRAINT` / `FOREIGN KEY` / `CHECK` 等表级约束整条跳过。
4. **列语义**：已知 SQL 类型的**最长族匹配**（INT 族 → integer；DECIMAL/FLOAT/DOUBLE/REAL → number；
   BOOL/BIT → boolean；DATE / DATETIME/TIMESTAMP / TIME / BLOB / JSON → 对应 format）；
   `COMMENT '...'` → label；`NOT NULL` / `PRIMARY KEY` → required；`ENUM/SET(...)` → `Select` +
   `dataOptions`（值去引号）。
5. **失败路径永不抛**：无声明 / 括号不完整 / 非法成员 / 未知命名类型 / 未知 SQL 类型 →
   空字段或 Input 兜底 + 中文告警；多个 interface / 多个 CREATE TABLE → 取第一个并告警。
6. **边界守住**：仍只做「类型→formtype」；查询面保持空（`composeCrudConfig` 默认
   `inTable/inForm: true`、`inQuery: false`），按钮/弹窗交给宿主。嵌套对象与无枚举数组显式告警，
   不静默吞字段。
7. **工具面**：`ingest_schema` 描述去掉「not yet supported」，补两类来源与语义；`text` 参数
   describe 同步。`AI-NATIVE-ARCHITECTURE.md` / `ROADMAP.md` 的「未实现」表述同步删除。
8. **单测**：`packages/shared/__tests__/schema-ingest.spec.ts` 新增 9 例（TS 逐成员 / type 字面量
   与多声明 / 无法识别成员 / 无声明与不完整括号；SQL 列定义 / PostgreSQL 风格与未知类型 /
   无 CREATE TABLE；两类端到端 `composeCrudConfig → generateFromConfig → esbuild parse`）；
   `packages/mcp-server/__tests__/ingest-schema.spec.ts` 新增 2 例（两类来源草稿均过
   `validateStructuredConfig`；空 interface 无 config + 指引告警）。
9. **golden 草稿**：`__tests__/golden/ingest/ts-01-ticket.json` 与 `sql-01-ticket.json`
   （同一 Ticket 模型的两种来源，覆盖 label / required / enum / JSON 兜底）。放在独立
   `ingest/` 目录，**不进入** eval `cases/`，语料分母不变；由 shared spec 直接读取并逐字段断言，
   避免「加了草稿但没人消费」。
10. **回归**：`packages/shared` 31 例、`packages/mcp-server` 6 例全绿；`build:libs` 后
    mcp-server 从 `@es-plus/shared` build 读到新解析器。
11. **刻意未做**：不解析 TS 交叉类型 / `extends` / 引用其他命名的嵌套类型（告警兜底）；不解析
    OpenAPI YAML（既有边界不变）；不改 `SchemaKind` 枚举（两类早已声明）。

---

## 7. Phase 4 — 准确率收敛

### AN-21 — 前门旋钮类型化

**目标**：让 MCP 客户端的受约束解码覆盖全部入参。

**改动**
- 把 `tableOptions`/`tableBtns`/`toolbarBtns`/`operationColumn`/`expandConfig`/`treeConfig`/`mergeConfig` 从 `z.any()`/`z.record` 换成显式形状。
- 由于 mcp-server 用 zod 3、shared 用 zod 4，**不得直接复用 shared 的 Zod 对象**；用以下两种方式之一：
  - 升级 mcp-server 到 zod 4（先验证 MCP SDK 兼容）；
  - 从 shared 导出 JSON Schema，再用 zod 3 镜像（由 `check:tool-shapes` 对账）。

**验收**
- 工具 describe 的 JSON Schema 含所有键。
- 传入未知旋钮 → 工具层直接报错，而不是静默通过。

**落地记录（2026-10-20）**

1. **选第二条路（zod 3 镜像），不升级 zod 4。** 升 4 需要同时验证 MCP SDK 的
   `tool(name, desc, shape, handler)` 注册面与全仓 290+ 个 mcp-server 测试；镜像 + 对账
   守卫已能把「漏键」从静默 strip 变成 CI 红，风险与收益不匹配。
2. **新增 `packages/mcp-server/src/tools/_front-door-knobs.ts`**：8 颗旋钮
   （`tableOptions` / `formLayout` / `operationColumn` / `tableBtns` / `toolbarBtns` /
   `expandConfig` / `treeConfig` / `mergeConfig`）的显式 zod 3 形状，全部 `.strict()`。
   `generate-crud.ts` 的 `crudShape` 改用它；`tableBtns`/`toolbarBtns` 复用
   `generate-from-config.ts` 导出的具名 schema（同一份归一化实现）。
3. **有意不写 `.default()`**（与 `generate-from-config.ts` 的 `tableOptions` 不同）。
   前门把旋钮原样交给 `composeCrudConfig`：若镜像注入 `rowkey:"id"`，`withRowkey`
   会把默认值当成用户显式配置并产生**假冲突告警**；同时会让经 MCP 的真实调用与直接
   驱动 handler 的 eval 看到不同入参。默认值仍由 shared 权威 schema 在校验/生成阶段提供。
4. **修复既有不一致：`TableBtnSchema` 缺 `label`/`action` 别名。** 前门 describe 与
   few-shot 一直教 `{ label, action }`，而 zod 3 副本只认 `{ name, actionType }` ——
   照抄示例会得到「解析成功、按钮无名字/无动作」的空壳。现改为 `name?` + 别名 +
   `superRefine`（名字必须存在）+ `.transform(normalizeTableBtn)`，**helper 从 shared
   import**，不再手抄第二份。
5. **修复 `formLayout` describe 的幻影 `span` 键。** 列宽是字段级 `querySpan`/`formSpan`，
   `formLayout` 只有 `labelWidth`/`minFoldRows`；旧 describe 会让模型写一个必然被 strip 的键。
6. **`check:tool-shapes`（新守卫）**：`scripts/lib/front-door.mjs` 现同包导出
   `capture()`、`StructuredCrudConfigSchema`（zod 4）与 `z`（zod 3），脚本在同一进程里
   用各代 API 读取键树并**递归**对账（含 `expandConfig.fields[]` 等嵌套键），另断言：
   无 `z.any()`/裸 `z.record` 回退、7 条未知键探针全部报错、合法最小值不误杀、
   `{ label, action }` 别名归一化为 `name`/`actionType`/`code` 且别名键被删除。
   已挂入 `check:consistency`。另用 MCP SDK 自己的转换器（`zod-json-schema-compat`
   的 `toJsonSchemaCompat(obj, { pipeStrategy: 'input' })`）实跑核对：8 颗旋钮的
   `properties` 与嵌套键全部出现在 `tools/list` 的 `inputSchema` 里，
   `tableOptions`/`formLayout` 的 `additionalProperties:false` 也已落地。
7. **`check-schema-contract.mjs` 跟进 import**：`assertButtonPositionContract` 在副本里
   找不到 `normalizeTableBtn` 时回退到 shared 权威文件里定位 —— 否则「消除重复实现」
   这个正确动作会直接把守卫变红。
8. **回归**：mcp-server 291/291、shared 全量绿、`check:schema-contract` /
   `check:tool-shapes` / `check:front-door`（语料 216 条）全绿；三处 typecheck 绿。
   `operationColumn.btns` 保持 shared `RowBtnSchema` 的 7 键（不含 `actionType` —— 行按钮
   由 `dialogKey`/宿主事件装配，`actionType` 无运行时消费者，不补幻影能力）。

---

### AN-22 — RenderPlan 拆分

**目标**：从结构上杜绝“某个模式漏发射”。

**改动**
1. 新增 `buildRenderPlan(config, target)`：一次性决定每个键的“发射/告警/报错”。
2. `structured-generator` 只消费 plan。
3. `check:render-plan` 对 plan 做键集快照。

**验收**
- AN-06 类缺陷在 plan 层可测。
- 新增键时漏接 plan → 守卫红。

**落地记录（2026-10-20）**

1. **新增 `packages/shared/src/render-plan.ts`**：`RENDER_PLAN_CONTRACT` 覆盖
   `StructuredCrudConfig` 全部 20 个顶层键，每行给出 `schema`/`sfc` 两种 mode 的
   disposition（`emit`/`derive`/`meta`/`downgrade`）、产物证据 token 与降级原因；
   并以 `satisfies Record<RenderPlanKey, PlanRule>` 做编译期缺键守卫。
   `buildRenderPlan(config, {mode,target})` 按 config 落成 `absent`（`always` 键除外），
   暴露 `emits`/`renders`/`downgrades()`/`anyRenders()`。
2. **生成器改为消费 plan**：`generateFromConfig` 先算 plan 再分派
   `generateSchema(config, plan)` / `generateSFC(config, plan)`；schema 侧的
   `useNewDialogMode` 与 `formLayout`/`toolbarBtns`/`tableBtns`/`operationColumn`/`dialogs`
   的发射条件、SFC 侧的 `formLayout` 门全部改读 `plan`。发射结果与改造前逐个黄金用例等价
   （216/216 全绿）。
3. **顺带修复 AN-06 同构缺陷（SFC `operationColumn:false`）**：此前 SFC 模式无条件按
   `actions` 派生操作列 —— `false`（「隐藏操作列」）既不生效也**不告警**
   （`ignoredInSfc` 只登记 truthy 值）；同一份 config 换 mode 就多出一列。
   现在 plan 把 `false` 落成 `emit`（抑制即语义）、对象形态才是 `downgrade`，
   `actionBtns` 据此为 `[]`。保留 `ignoredInSfc.push('<key>…')` 字面量不动
   （`check-threeway-consistency` 按字面量扫描该清单）。
4. **`check:render-plan`（新守卫）**：esbuild 打包 `shared/src` 后，
   ① 断言 `RENDER_PLAN_CONTRACT` 键集 == `StructuredCrudConfigSchema.shape` 键集；
   ② 与 `scripts/render-plan.baseline.json` 逐键比对（`--update` 显式重写）；
   ③ 对每个键构造最小配置、真跑两个 mode：`emit`/`derive` 必须出现登记的证据 token，
   `downgrade` 必须在告警里点名该键，未声明（非 `always`）必须落 `absent`；
   ④ AN-06 类行为探针：schema 的 `operationColumn:false` 必须发射
   `"operationColumn": false`，SFC 的 `false` 必须真的不出现操作列。
   已挂入 `check:consistency`。
5. **快照守卫非空证明**：手动把 baseline 的 `actions.schema` 改成 `derive` 再跑，
   守卫按预期变红（`键 "actions" 的账本与快照不一致`），随后恢复。
6. **回归**：shared 20 文件 / 715 tests、mcp-server 14 文件 / 291 tests、
   `check:render-plan` / `check:threeway` / `check:front-door` / `check:tool-shapes` /
   `check:capability-parity` 全绿；`build:libs` 后 `test:golden` 216/216；
   `tsc -p packages/shared` 绿。

---

### AN-23 — 按维度补 few-shot

**目标**：用教学语料补齐模型不会的维度，而不是放宽评分。

**范围**
- `columns`（多级表头/非字段列/列序）
- `expandConfig`
- `reactions` / `isHidden`
- `editConfig` + `editRender`
- `dialogs` 多弹窗/自定义标题
- `permissions`

**要求**
- 每条 few-shot 必须登记到 `check:fewshot-registration`；
- 不得与 heldout 重叠（字段名存活判据）。

**验收**：各维度 rate 提升可归因到具体 few-shot；heldout 不退化。

**落地记录（2026-10-20）**

1. **先审计再生产，不重复教学。** 现有 22 条 few-shot 已由 AI-33⑥ 的维度断言覆盖了
   AN-23 的大部分范围：多级表头 + index 非字段列（#18）、`expandConfig`（#19）、
   `isHidden`（#16）、`reactions` 选项联动（#17）、`editConfig` + `editRender`（#22）、
   多弹窗 + 自定义标题（#11）、按钮级/字段级权限（#6/#12）。逐条核对
   `ai-nl-to-config-prompt.spec.ts` 的 COVERAGE 后，真正的教学缺口是三个**只写在规则里、
   没有示例承担**的子维度：
   - `columns` 的 `selection` 非字段列（此前只演示 `index`）；
   - `reactions.fulfill.required`（条件必填）与 `fulfill.value`（自动写回 + `dependencies`）；
   - `dialogs[k].configBtn`（自定义底部按钮；标题已由 #11 覆盖）。
2. **新增 3 条 few-shot（#23–#25）**：
   - 客户合同：复选框列 + 显式列序 —— 教「`columns` 是覆盖不是 merge，漏列即消失」；
   - 报销单：`required` 用表达式节点（**不是**裸 boolean / `{field,op,value}`），
     `value` 用 `if` 三操作数 + 非空 `dependencies`；
   - 请假单：`dialogs.view.title` + `configBtn:[{name:'关闭',action:'cancel'}]`，
     并重申 `dialogs` 不关闭按钮派生。
3. **COVERAGE 断言补 6 条**（`ai-nl-to-config-prompt.spec.ts`）：selection 非字段列、
   `columns[].editRender`、`reactions.fulfill.required`、`reactions.fulfill.value +
   dependencies`、`dialogs[k].title`、`dialogs[k].configBtn`。删掉对应示例即红。
4. **登记与 heldout 隔离**：`check:fewshot-registration` 报 25 条 few-shot、语料
   216 crud（登记 22 / heldout 194），机检下界仍为 16 例且全部已登记 —— 新增示例
   **没有**产生新的同源候选，heldout 规模与登记表均未变（结构性不退化）。
5. **每条示例都过权威 schema 且能真生成**：shared 单测对每条 few-shot 执行
   `StructuredCrudConfigSchema.parse` + `generateFromConfig`（含生成的 JSON 回读逐键相等）。
6. **回归**：shared 20 文件 / 721 tests、mcp-server 14 文件 / 291 tests、
   `check:fewshot-registration`、`check:eval-prompt`、`tsc -p packages/shared` 全绿；
   `build:libs` 后 `test:golden` 216/216。
7. **口径说明**：「rate 提升可归因」需要付费全量 eval，本批次未跑（无授权、且探针
   `--limit` 只切前 N 条 CRUD，切不到这些维度）。下一步 AN-25 Phase 0 的全量跑批
   负责给出真实增量；在那之前，这里只声明「示例有效 + 隔离干净」两个可离线证明的性质。

---

### AN-24 — canonicalization + 确定性修复环

**目标**：把常见格式错误在入口修掉，不消耗模型轮次。

**改动**
1. `normalizeConfig()` 扩展：别名、空值、成员布尔缺省、`dialogs` 罐头键展开。
2. 新增 `repairConfig(config)`：只做**有据可查**的修复，返回 `repairs[]`（与 `validate` 分离）。
3. 生成前自动 repair；`validate_config` 仍只判不改。

**验收**
- 修复项逐条有测试；
- 不引入“猜用户意图”的修复。

**落地记录（2026-10-20）**

1. **两层分工，避免把「校验」改成「改写」。**
   - `normalizeConfig()`（`packages/shared/src/normalize-config.ts`）扩为**词汇/形态**
     归一：按钮别名（`label→name`）、`toolbarBtns` 的 `action→actionType`、顶层
     `rowkey` 搬迁、`dialogs` 罐头键展开、`dialogs[k].formItems` 简写展开。
     别名同时覆盖 `operationColumn.btns[]` 与 `dialogs[k].configBtn[]`；但弹窗底部
     按钮的 `action` 是 confirm/cancel/custom 的**语义键**，刻意不做 `actionType` 归一。
   - 新增 `repairConfig()`（`packages/shared/src/repair-config.ts`）做**数据形状**修复：
     `null` 视为未声明（仅当删除能让 schema issue 数**严格下降**）、成员布尔
     `"true"/"false"/1/0` 的无歧义转换、弹窗表单项引用的兜底展开。返回
     `{ config, repairs[], renames[] }`；`repairs.kind` 为
     `remove-null | coerce-boolean | expand-dialogs | expand-form-item`。
2. **安全阀：schema 驱动 + 单调改进。** 修复不写死字段清单，而是 `safeParse` 得到
   issues，逐条生成候选，再对副本重新校验；**只有 issue 总数严格下降才接受**。
   于是「删掉必填键只是把类型错换成缺失」这类候选会被自动拒绝，修复永远不会把
   配置改得更坏。无法有据修复时就原样保留，让 `assertValidConfig` /
   `validateAndRepair` 正常报错。
3. **接线（生成前自动 repair，校验器不动）：**
   - `generateFromConfig`：`repairConfig(raw)` → `assertValidConfig` → 发射；归一/修复
     记录进入 `warnings`（`自动归一：…` / `自动修复：…`）。
   - `generate_crud_from_config`：先 `repairConfig`，再用**修复后的 config** 过
     `validateAndRepair` 并生成；修复记录进入产物 warnings。
   - CLI `nl-to-config`：模型候选先 repair 再 `safeParse`，无歧义格式错误不消耗一次
     重试。
   - eval（`scripts/eval-llm.mjs`）：自修复环的 validate 先 repair 再 parse，同样
     不把格式噪声算成「模型答错」。
   - **`validate_config` 未改**：仍只判不改（AN-24 原文要求）。
4. **「成员布尔缺省」的刻意口径。** 省略的 `inQuery/inTable/inForm` 仍保持省略：
   生成器按 `!== false` 解释（省略 = true），显式补 `true` 会改写输入语义，与
   C2·A3 / `assertValidConfig` 的既有边界冲突。本项只修 `null` 与无歧义字面量，
   不 materialize `.default()`。
5. **别名覆盖的边界（诚实登记）。** 经真 MCP SDK 的 `tools/call`，
   `generate_crud_from_config` 会先用 zod3 `configShape` 解析参数：`null`、字符串
   布尔、`{prop}` 简写等**在进入 handler 前就被拒绝/剥离**。因此修复环实际生效的
   是**直接调用 handler / 生成器 / CLI / eval** 的路径；MCP 结构化工具仍按 typed
   config 契约严格收参。要放宽到 SDK 入口需要改 `configShape` 的叶子类型，属于
   另一项契约变更，未在本批次做。
6. **测试（逐条修复均有正/反例）：**
   - `packages/shared/__tests__/normalize-config.spec.ts` +12：toolbar/行按钮/弹窗
     按钮别名、罐头键数组与 `true`、非罐头项整段不动、formItems 字符串/`{prop}`
     展开、条目自身键优先、找不到 prop 不猜、展开结果是独立副本。
   - `packages/shared/__tests__/repair-config.spec.ts` +17：null 删除（顶层/字段/
     tableOptions/弹窗嵌套）、必填 null 不删、四种成员布尔、`"no"` 不猜、弹窗成员
     布尔、dialogs 简写、幂等、不改入参、非对象输入、修不好仍非法、
     `validate_config` 仍判红（只判不改）、生成器 warnings。
   - mcp `generate-tools-and-prompts.spec.ts` +2：handler 层「先修复后校验」真的
     产出代码 + `自动修复` 警告；修复不会把非法 formtype 洗白。
7. **回归：** shared 21 文件 / **751** tests；mcp-server 14 文件 / **293** tests；
   CLI 2 文件 / **51** tests；`build:libs` 后 `test:golden` **216/216**；
   `check:schema`、`check:tool-shapes`、`check:render-plan`、`check:unknown-keys`
   （语料 279 条零误杀）、`check:front-door`（216/216 路由与成员 round-trip）、
   `check:exports`、`check:generator`、`check:generator-targets`、
   `check:generator-escaping`、`check:threeway`、`check:capability-parity`、
   `check:contract`、`check:feature-coverage`、`check:repair-loop`、
   `check:front-door-leg`、`check:fewshot-registration`、`check:membership-trap`、
   `check:scorers` 全绿；各端 `typecheck` 0。
8. **口径说明：** 本批次**没有**跑付费全量 eval，因此不声明 rate 增量；可离线证明的
   是「常见格式错误在入口被确定性修掉、且不会猜答案」。真实增量由 AN-25 的全量跑批
   给出。

---

### AN-25 — 收敛到 95%

**目标**：`definition95 ≥ 95%`（heldout，无 fixedFields）。

**执行顺序**
1. Phase 0–3 完成后重跑全量，得到真实基线。
2. 按维度缺口排序（membership → columns → expand → reactions → edit → tableBtns → dialogs）。
3. 每修一类，跑一次 heldout 探针，记录增量。
4. 若某维度长期不动，优先检查“生成器是否真的发射/运行时是否真的消费”，再考虑 few-shot。
5. 95% 达成后，把 full 口径作为下一阶段目标（≥60%）。

**验收**
- `last-accuracy.json`：`definition95 ≥ 0.95`，`measured = total`，`fixedFieldsUsed=false`。
- `check:ratchet` 记录新基线。

**当前状态（2026-10-20）：阻塞，待授权与推送。**

- 本项**无法离线完成**：`definition95` 只能由一次**付费全量跑批**产生。工作区当前 artifact
  的目标行是旧口径产物，不能用来声明收敛。
- 也不能用 CI `workflow_dispatch` 替代：远端 master 仍是 AN-24 之前的代码，跑出来测的是旧
  生成器；必须先推送本批改动，才能在远端测到 AN-01…AN-24 的真实增量。
- 因此按依赖顺序**先完成可离线的产品化收尾（AN-26…AN-29）**，再在用户授权付费跑批、且本批
  改动已推送后执行 AN-25 的①②③步。AN-27 的守卫保证：在 `definition95` 真正达标前，任何
  「宣称 95%」的文案都会红。

---

## 8. Phase 5 — 产品化

### AN-26 — 工具面收敛

- `generate_crud` 唯一 “FRONT DOOR”；
- `generate_crud_from_config` 标 “advanced”；
- `generate_crud_schema` / `generate_crud_page` 标 “legacy fallback”；
- 引入 `ESPLUS_MCP_PROFILE=front-door|full`，生产默认 front-door；
- 下一大版本合并/移除 legacy。

**验收**：`check:tool-surface` 断言只有一个工具含 “FRONT DOOR”。

**落地记录（2026-10-20）**

1. **开关落在注册层，不在工具内。** `packages/mcp-server/src/tools/index.ts` 新增
   `ToolProfile = 'full' | 'front-door'`、`resolveToolProfile(raw = process.env.ESPLUS_MCP_PROFILE)`
   与 `registerTools(server, profile = resolveToolProfile())`：`front-door` 只跳过
   `generate_crud_page` / `generate_crud_schema` / `generate_crud_from_config` 三个注册调用，
   不改变已注册工具的形状。`src/index.ts` 在 `front-door` 下把一段 profile 说明追加进 server
   instructions，宿主能直接读到「legacy 工具被隐藏」而不是遇到 tool-not-found。
2. **偏离计划字面（刻意）：默认 `full`，不是 `front-door`。** 计划写「生产默认 front-door」，
   但 `AI-NATIVE-ARCHITECTURE.md` §9.4 的废弃流程自己写的是「先改描述 → 再加 profile/env 开关
   （**默认关闭**）→ 大版本移除」；且现有宿主与本站文档都在调 `generate_crud_from_config`，
   改默认会在同一个小版本里让它们静默失败。两处冲突按「不破坏存量」取默认 `full`，
   `front-door` 作为显式 opt-in。待 AN-25 收敛完成后，再按 §9.4 的下一档把默认翻过来。
3. **描述分层（唯一性靠可断言的措辞）。** `generate_crud` 保持 `FRONT DOOR`；
   `generate_crud_from_config` 首句 `ADVANCED path — ...`；`generate_crud_page` /
   `generate_crud_schema` 首句 `LEGACY FALLBACK (deprecated)`。首版在 from_config 里写了
   「(the FRONT DOOR)」做指路，守卫立刻数出**两个** FRONT DOOR —— 改为小写
   「the front door」/“front-door tool”，语义不变但判据只有一个。这也回答了「怎么让模型
   知道该用哪个」：靠首句的档位词，而不是靠重复前门名。
4. **守卫 `scripts/check-tool-surface.mjs`**（已进 `check:consistency`）：esbuild 直接从
   `src` 打包 `registerTools` / `resolveToolProfile`（`@es-plus/shared` alias 到源码，避免验到
   旧的 `build/`），用假 server 捕获 `(name, description)`。断言：full 恰好 15 个工具且无重名
   （与硬编码清单逐项相等）；front-door 恰好是其余 12 个（隐藏集合精确等于 3 个 legacy/advanced）；
   `generate_form` / `generate_table` / `generate_dialog` 两档都在；**恰好一个**描述含
   `FRONT DOOR`；档位前缀正确；解析器对 `undefined` / `''` / `'full'` / 乱值回落 `full`，
   对 `'front-door'` / `'  FRONT-DOOR  '` 归一为 `front-door`。
5. **单元层同源断言**：`packages/mcp-server/__tests__/tool-surface.spec.ts`（7 例）用同样的
   假 server 在进程内捕获注册，避免「守卫 esbuild 打包的代码」与「测试 import 的代码」分叉。
6. **回归**：mcp-server 测试全绿、`tsc -p packages/mcp-server --noEmit` 0；
   `check:tool-surface` 绿（`full 15 / front-door 12（隐藏 3）`）；站点与 README 的工具面文案
   在 AN-29 同步。

---

### AN-27 — 公开声明与 artifact 绑定

- `check:site-claims` 读取 artifact：宣称 95% 则 `definition95 ≥ 95%`，否则红；
- 或文案改为“目标/当前”双数字；
- 徽章由 artifact 生成。

**验收**：手工把 README 改成 99% → 守卫红。

**落地记录（2026-10-20）**

1. **选「目标 / 当前」双数字，不把 nightly 数字写死进文档。** 文档写**目标**（`≥95%`）与
   **语料规模**（`last-accuracy.json` 的 `cases` / `heldoutCases`），**当前值只出现在由 artifact
   生成的徽章里**。理由是 AN-03 的单一真源：`last-accuracy.json` 每次跑批都会被覆盖，任何
   把 `48.8%` 抄进正文的写法第二天就过期，而抄错的方向恰好是「虚高」。
2. **`check:site-claims` 新增 `checkAccuracyClaims()`**（在理念文档检查之后执行）：
   - **测量完整性前置**：`notMeasuredRows !== 0` 或 `definition95.rate/total` 缺失 → 红。
     artifact 不能自证「全部测到」时，不许用它背任何公开声明。
   - **徽章与 artifact 同源**：`last-accuracy-badge.json` 的 `message` 必须等于
     artifact 当前率（`toFixed(1)`），`label` 必须包含 `${targetPct}%-definition`。
   - **README 双语**：语料例数、留出例数、门禁目标三个数字必须与 artifact 相等，
     且两版都必须提到 `last-accuracy.json`（读者能回源）。
   - **理念文档**：`docs/why-es-plus.md` / `.en.md` 中提到 `definition95` 的每一行，其
     `≥X%` 必须等于 artifact 的 target、必须出现「徽章 / badge」，**且不得**匹配
     `/definition95\s*=\s*[\d.]+\s*%/` —— 即禁止把当前值写成等式。
3. **文案改动**：`README.md` / `README.en.md` 准确率小节改为「语料 188 例（留出 166 例）、
   门禁目标 ≥95%、当前值见徽章（由 `__tests__/golden/last-accuracy.json` 生成）」；
   `docs/why-es-plus.md` / `.en.md` 的对比表行改为「目标 ≥95%；当前实测见徽章」。
4. **验收（真跑了）**：手工把 README 的 `≥95%` 改成 `99%` → `check:site-claims` 红并点名
   不匹配的数字；改回后绿。当前 artifact 为 `48.8%`（188 例 / 留出 166），文档**没有**
   声称已达成 95%。
5. **边界（诚实登记）**：本守卫只校验「文档里的声明 = artifact 里的数字」。artifact 本身是否
   等于线上模型能力，由 AN-25 的全量跑批与 `check:ratchet` 负责；两者不互相替代。

---

### AN-28 — feature ledger 接入三站

- `feature-coverage.data.mjs` 覆盖 `es-eui`（88 examples / 16 combination）与 `es-pc`（110 views）；
- 案例 ↔ 能力 ↔ 语料三方映射；
- 新增 `check:feature-coverage` 对三站目录扫描。

**验收**：台账中 es-eui/es-pc 引用数 > 0；未覆盖案例显式列为 D 级。

**落地记录（2026-10-20）**

1. **确定性派生，不手抄 198 行。** 新增 `scripts/lib/site-coverage.mjs`：对 `SITE_ROOTS`
   声明的两个站点目录做递归扫描（`es-eui` = 88 个示例、`es-pc` = 110 个视图），把每个案例名
   kebab 化后与台账里已有单源演示的 slug 匹配；唯一命中即继承该演示的令牌，多个命中时先按
   同分类收窄；仍无命中则显式登记
   `{ demo: null, tokens: ['siteUncovered'], tier: 'D', reason }`。**不猜能力** —— 匹配不上
   就是 D 并写明原因，补上同名演示后重跑即自动升档。
2. **生成与消费**：`scripts/gen-site-coverage.mjs`（`npm run sites:coverage:gen`）只改
   `docs/ai/feature-coverage.json` 的 `sites` 键，保留其余键与源文件 EOL（CRLF），内容无变化
   时不写盘。当前结果：**es-eui 88（映射 33 / D 55）· es-pc 110（映射 93 / D 17）· 合计
   198 例，映射 126 例**。
3. **schema**：`docs/ai/feature-coverage.schema.json` 把 `sites` 加入 `required`，并给出
   对象/数组形状（`site` 枚举 `es-eui|es-pc`、`root`、`refs ≥ 1`、`uncovered`、`cases[]` 的
   `id` / `demo`（string|null）/ `tokens` / `tier` / 可选 `reason`）。
4. **守卫（`check:feature-coverage` 第 ⑤b 段）**：重新派生并与 JSON 逐字节比较（新鲜度，
   等价于「台账没过期」）；`sites.length === 2`；每站 `refs > 0`；`cases.length ===
   refs + uncovered`；未映射行必须 D 且带 `reason`；所有令牌（含 `siteUncovered`）必须在
   注册表里；`tier === rowTier(tokens)`。`siteUncovered` 作为 D 档令牌登记，理由写明
   「站点案例未匹配到同名单源演示 —— 显式登记为 D，不猜能力令牌」。
5. **对「三方映射」的诚实边界**：计划写「案例 ↔ 能力 ↔ 语料三方映射」。落地为
   **站点案例 → 单源演示 → 能力令牌**；令牌再经既有 `check:feature-coverage` 断言与
   `keys` / `via` 真实性校验，与 golden 语料的关联走**能力令牌**而非逐案例直连——
   站点示例与 eval 语料本就是两套产物，硬造一一对应只会产生假精确。
6. **回归**：`check:feature-coverage` 绿（映射 126 / D 72，令牌全部登记）；
   `docs:check`、`check:docs-layout`、`sites:check`、`ai:check` 绿。

---

### AN-29 — 文档同步

- README 工具章节改为指向 ARCHITECTURE；
- CHANGELOG 记录每个 AN；
- 站点 AI 文案与 artifact 一致。

**落地记录（2026-10-20）**

1. **README（zh/en）**：AI 工具链小节新增一段工具面说明 —— `generate_crud` 是唯一前门、
   `generate_crud_from_config` 是 ADVANCED、`generate_crud_page` / `generate_crud_schema`
   是 LEGACY FALLBACK、`ESPLUS_MCP_PROFILE=front-door` 可隐藏后三者，并直接链到
   `packages/mcp-server/AI-NATIVE-ARCHITECTURE.md`（而不是在 README 里复制架构文档）。
   准确率小节的「目标 / 当前」口径见 AN-27。
2. **站点文档**：
   - `es-plus-docs/src/docs/mcp-server.md` 的 MCP 章节重写：新增
     「`generate_crud`（唯一前门 / FRONT DOOR）」小节；`generate_crud_from_config` 改标
     ADVANCED 并恢复「已持有类型化配置 / 约束解码」的说明；`generate_crud_page` 改标
     LEGACY FALLBACK 并保留 no-LLM 警告；关键词表补前门说明。
   - `.en.md` 同步：intro 改写为「AI 调 `generate_crud` 前门」，Tools 表按
     FRONT DOOR / ADVANCED / LEGACY FALLBACK 三档重排，并把 `generate_crud_schema`、
     `validate_config`、`list_form_types` 补进表里（此前漏列）。
   - 根 `docs/why-es-plus.md` / `.en.md` 的工具表同步打上 ADVANCED / LEGACY FALLBACK 档位词；
     三份根 docs 经 `npm run docs:sync` 镜像到站点。
3. **CHANGELOG 机制**：用 changesets 记录（而不是手改各包 `CHANGELOG.md`，那会在下次
   `changeset version` 时冲突）。新增两份：
   - `.changeset/ai-native-runtime.md` → `@es-plus/core`、`@es-plus/vue3`、`@es-plus/vue2`、
     `@es-plus/adapter-antdv`（minor）：列合成单一真源、`ellipsis` / `defaultSort`、
     `multiSelect` / `snIndex`、无静默丢弃。
   - `.changeset/ai-native-remediation.md` → `@es-plus/shared`、`@es-plus/mcp-server`、
     `@es-plus/cli`（minor）：`schema.actions`、`tableBtns` 契约、未知键严格判定、
     确定性修复环、`pageSizes`、preflight / doctor、`ingest_schema` 两来源、
     工具面 profile、宣称绑定。
   `npx changeset status` 已验证 7 个包均按 minor 计入。
4. **回归**：`docs:sync` → `docs:check`（3 个镜像逐字节一致）、`check:site-claims`
   （含 AN-27 的 artifact 绑定）、`check:readme`、`check:docs-layout`、`sites:check`、
   `ai:check`、`check:tool-surface`、`check:feature-coverage` 全绿；
   `check:consistency` 中除 `og:check` 在 Windows 的既有 CRLF 假阳性（CI 绿，未重生成）
   外全部通过。

---

## 9. 阶段门禁矩阵

| 阶段 | 必须通过 | 预期结果 |
|---|---|---|
| Phase 0 | `check:scorers`、`check:ratchet`、完整 eval | 基线可信；artifact 标注 commit/runId |
| Phase 1 | `check:schema`、`check:front-door`、`check:parity`、`check:unknown-keys` | 三端一致；未知键可诊断 |
| Phase 2 | Tier A 编译腿、`passed` 含 compileRate | 编译失败即红 |
| Phase 3 | `check:scene-coverage`、dialog/composition scorers | 4 类场景都有语料 |
| Phase 4 | heldout 探针 + 全量 | `definition95 ≥ 95%` |
| Phase 5 | `check:site-claims`、`check:tool-surface`、`check:readme` | 宣称与实测一致 |

---

## 10. 风险登记与回滚

| 风险 | 影响 | 缓解 | 回滚 |
|---|---|---|---|
| 未知键改 error 打断存量 | 高 | 先补 schema 缺失键；`x-*` 逃生口；一版 warning 过渡 | 降级为 warning |
| 三端补选择列改变渲染 | 中 | minor 版本 + changelog；显式 `false` 可关闭 | 移除合成逻辑 |
| 编译腿初期误报 | 中 | observe 一周再 gate | 关闭 gate |
| fixedFields 关闭后数字骤降 | 中 | 视为正确基线；不回调口径 | — |
| 95% 仍达不到 | 高 | 按维度补 few-shot/发射器；不放宽定义 | — |
| zod 3/4 双版本 | 中 | AN-21 二选一方案；`check:tool-shapes` 对账 | 保留 `z.any()` + 运行时校验 |

---

## 11. 里程碑（相对时间）

| 里程碑 | 内容 | 预计 |
|---|---|---|
| M0 | Phase 0 完成，HEAD 真实基线 | 第 1 周 |
| M1 | P0 发射正确性全修，三端一致 | 第 2 周 |
| M2 | 真实编译门禁上线 | 第 3 周 |
| M3 | 4 类场景可测 + 片段门禁 | 第 5 周 |
| M4 | `definition95 ≥ 95%` | 第 8–10 周 |
| M5 | 产品化收尾，宣称与实测一致 | 第 10–12 周 |

> 时间为工程估算，不含模型/语料反复迭代的不确定性。

---

## 12. 附录

### 12.1 每条 AN 的 PR 模板

```
AN-xx — <标题>

问题/证据：
  <文件:行 / 运行日志 / 指标>

方案：
  <改动摘要>

改动文件：
  - ...

守卫/测试：
  - <新增或更新的 check>

验收命令：
  npm run build:libs && <command>

结果：
  <before → after>

文档：
  - AI-NATIVE-ARCHITECTURE.md §...
  - AI-NATIVE-REMEDIATION-PLAN.md AN-xx 状态
```

### 12.2 与 ROADMAP 的映射

| AN | 关联历史条目 |
|---|---|
| AN-01/02 | AI-33（度量管道）、AI-01（维度记分卡） |
| AN-06 | 新增（`schema.actions` 漏发射） |
| AN-07 | AI-47（tableBtns 语料） |
| AN-08 | C2·A3（前门校验）、AI-22（strip-hazard） |
| AN-09/10 | AI-34（三向一致性）、AI-09（表格特性） |
| AN-12/13 | Wave 2 C1（编译门）、AI-10 |
| AN-16/17 | AI-28（useDialog）、AI-SCENE-COVERAGE |
| AN-20 | A2'（ingest） |
| AN-21 | AI-21/AI-22（前门表达力） |
| AN-26 | AI-33 的信任链收尾 |
| AN-28 | AI-25（可达性台账） |

### 12.3 禁止事项

- ❌ 为了让数字变绿而修改 95% 定义。
- ❌ 用 prompt 修补本可在生成器确定性修复的缺陷。
- ❌ 在 Windows 上重生成 `one-config` 等产物（CRLF 假阳性）。
- ❌ 新增第二份字段清单或第二个 schema 真源。
- ❌ 未加守卫就合并修复。
- ❌ 声称 server 能直接读设计稿/截图。
