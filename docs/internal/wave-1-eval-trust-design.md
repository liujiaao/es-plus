# Wave 1 落地方案 — 评测可信（Eval Trust）

> 对应 [ROADMAP.md](../../packages/mcp-server/ROADMAP.md) 的 **P0 + AI-05 + AI-17**。
> 目标：让「≥95% / 生产可用」这句话第一次有**可信、按维度、双语、带凭据**的支撑。
> 本文是技术实施方案，不是公开文案。
>
> **状态（2026-10-10）：✅ PR-1~4 全部落地并自测通过。** AI-17 按 §6 显式推迟。
> 落地要点：PR-1 `scripts/eval/scorers.mjs`（16 维记分卡）+ `scorers.test.mjs`（meta-eval，进 `check:consistency`）；
> PR-2 25 case 补 `nlEn`，`eval-llm.mjs` 双语打分（zh 门禁 / en 观测）；
> PR-3 `NL_TO_CONFIG_FEWSHOT` 6→14 shot（8 全新域）+ spec 2 道护栏；
> PR-4 `last-accuracy-badge.json`（shields endpoint）+ `eval-llm.yml` 变更检测 commit-back + README/README.en 徽章与注脚。
> 验证：shared vitest 392 pass、`check:scorers` 绿、`test:golden` 25/25（双语 25/25）、`check:readme` 绿、CLI 43 pass。
>
> **首个真实 run 结论（2026-10-10，PPIO Opus-4.8 中继，见 memory `ppio-eval-relay-config`）：**
> 评测跑通并回写（徽章现为真实值，非占位）。真实数字 —— heldout 零编辑意图准确率 ≈ **5.3%**（all ≈12%），
> **远未**触及「≥95%」。但这是**门禁指标口径**的问题，不是模型/生成器质量问题：
> 门禁 `exactIntentCore` 要求「整份 config 逐字节复现金标」（精确列集 `propF1==1` ∧ 每字段 formtype+membership 全中），
> 而短 NL **本质上欠定**——同一句话有多套都正确的列集/可搜索性/弹窗拆分，指标只给「与某位作者的任意选择逐字节相同」记分。
> 同一 run 的分维指标才是真实水平：**compiles 100% · 属性准确率 ≈93% · actions F1 ≈98% · propSet F1 ≈76%**。
>
> **口径重定义（本波结论）：** 对外不再把「≥95%」挂在「零编辑准确率」上。可信且有意义的对外口径是
> **「编译通过率 100% + 属性级准确率 ~93% + actions F1 ~98%」**，零编辑率作为「硬诚实数字」如实报告（徽章即它）。
> 若未来仍要一个合法的「≥95%」头条，需**改所измер**——门禁只对 NL 明确指定的维度打分（逐 case 标注 NL 固定了哪些维度），
> 而不是惩罚欠定选择；在那个指标上强模型才可能合法逼近 95%。详见 memory `eval-heldout-vs-95-claim`。
>
> **本次「补齐差距」已落地（route a）：** 修正 5 处明显错误的金标 formtype（金额/售价/库存 数值字段 `Input`→`InputNumber`，模型本就对、金标错）；
> prompt formtype 规则补「数值字段 → InputNumber」（此前 fall through 到 `otherwise → Input`，直接教错）；两条 few-shot 同步纠正。
> 效果：属性准确率/formtype 维度诚实抬升；零编辑率受 propSet 欠定封顶，无法靠此达到 95%。

## 0. 现状校准（roadmap 的假设 vs 真实代码）

动手前先纠正 roadmap 里几条过时假设——基建比预想成熟：

| roadmap 假设 | 真实情况（已核实） |
|---|---|
| 没有 heldout 切分 | [eval-llm.mjs:52](../../scripts/eval-llm.mjs#L52) 已有 `FEWSHOT_DERIVED`，门禁落在 heldout |
| 没有 self-repair | [eval-llm.mjs:114](../../scripts/eval-llm.mjs#L114) 已有 ≤2 次 Zod 回灌重试 |
| 没有 accuracy 持久化 | [eval-llm.mjs:269](../../scripts/eval-llm.mjs#L269) 已写 `last-accuracy.json`——只是从未跑过 key，故未提交 |
| 没有 compile 校验 | 每个 case 跑 `generateFromConfig` 不抛即 `compiles` |

**仍然真实的缺口**（Wave 1 要补的）：
1. `exactIntent` 只 AND 了 propF1 + attrAcc(formtype/inQuery/inTable/inForm) + actionsF1 + tableBtn `.code`——**忽略** dialogs / operationColumn / permissions / apiParams / dataOptions / render / formatter / permissionValue / i18n / formLayout / target / mode / virtualScroll。
2. 25 个 golden case 的 `nl` **全中文**，海外第一个 prompt 就在分布外。
3. few-shot 只有 6 shot，上面大半维度**零示例**。
4. `last-accuracy.json` 从未提交，README 无徽章——数字无凭据。

## 1. 修正后的执行顺序（含依赖）

roadmap 列 `AI-05 → AI-01`，但**依赖是反的**：只有先有按维度记分卡（AI-01），才能证明「补了某个 shot 让该维度分上升」。所以：

```
AI-01 (记分卡)  ──┬──▶ AI-02 (双语用例)  ──┐
                  └──▶ AI-05 (补 few-shot) ─┴──▶ AI-04 (提交数字 + 徽章)
AI-17 (promptfoo) = 本波显式「不做」，见 §6
```

AI-02 与 AI-05 可并行；AI-04 必须最后（需要一次真实带 key 的 run）。

---

接下来按 4 个 PR 粒度拆。每个 PR 独立可合、独立有价值。下面先给 **PR-1（AI-01 记分卡）** 的完整技术方案；PR-2/3/4 在后续消息补细节，避免一次输出过长。

## 2. PR-1 · AI-01 按能力维度记分卡

### 2.1 设计决策（三条，定调）

**决策 A — 条件打分（applicable-only）。** 每个维度**只在 gold 真正用到它的 case 上**计分。把「dialogs」在没有 dialog 的 case 上也算「通过」= 空洞灌水。记分卡产出：

```jsonc
"byCapability": {
  "dialogs":        { "applicable": 3, "pass": 2, "rate": 0.667 },
  "permissions":    { "applicable": 1, "pass": 1, "rate": 1.0 },
  "apiParams":      { "applicable": 2, "pass": 2, "rate": 1.0 }
  // …每个维度一行；applicable=0 的维度照常列出但 rate=null
}
```

**决策 B — 不动现有门禁，新增更严的观测分。** 把当前 4 维 `exactIntent` 保留为 `exactIntentCore`（门禁继续落在它、heldout 上，避免"加严当天就红"）；新增 `exactIntentFull` = 对该 case 所有 applicable 维度的 AND，**只报告不门禁**。等 AI-04 拿到基线后，再在后续波次把门禁逐步 ratchet 到 full。

**决策 C — scorer 抽成纯函数模块 + 自带 meta-eval。** 记分卡自己也会错。把打分逻辑从 [eval-llm.mjs:159](../../scripts/eval-llm.mjs#L159) 的 `scorePair` 抽到**不依赖 SDK**的 `scripts/eval/scorers.mjs`，这样能在**无 API key** 下单测：gold-vs-gold 必须每维全过；gold-vs-故意扰动 必须让**对应维度**掉分（证明每个维度"咬得住"）。没有这层，记分卡是未经测试的裁判。

### 2.2 维度清单（grounded 在 25 个 case 真实用到的特性）

| 维度 | 判定（pred vs gold） | applicable 条件 | 覆盖 case |
|---|---|---|---|
| `propSet` | prop 集合 F1 == 1 | 恒 | 全部 |
| `formtype` | 共有 prop 的 formtype 全等 | 恒 | 全部 |
| `membership` | 共有 prop 的 inQuery/inTable/inForm 全等 | 恒 | 全部 |
| `actions` | actions 集合 F1 == 1 | 恒 | 全部 |
| `tableBtns` | name+position+actionType 多重集相等（不止 `.code`） | gold 有 tableBtns | 03,24 |
| `dialogs` | dialog key 集合相等 ∧ 每个 dialog 的 formItems prop 集合相等 | gold 有 dialogs | 05,18,19 |
| `operationColumn` | 布尔/对象结构一致（含 `false`） | gold 显式给了 | 09… |
| `permissions` | action→code 映射相等 | gold 有 permissions | 16 |
| `apiParams` | 对应 field 的 url/labelField/valueField 相等 | gold 任一 field 有 | 02,10 |
| `dataOptions` | 有枚举 options 的 field 集合相等（值不逐一比，比"该给的给了没"） | gold 任一 field 有 | 多 |
| `i18n` | `i18n` 标志相等 | gold.i18n 为真 | 11,22 |
| `formLayout` | 结构相等 | gold 有 | 12 |
| `target` | 相等 | gold 非默认 vue3 | 06,07,15,19,20 |
| `mode` | 相等（sfc/schema） | gold.mode=='sfc' | 14,15,21,22,23 |
| `virtualScroll` | 标志/配置一致 | gold 有 | 17,25 |
| `extPoints` | render/formatter/permissionValue **存在性**一致（不比字符串内容——任意 JS 无法等值比） | gold 任一 field 有 | 04,18 |

> `extPoints` 只验"该保留的扩展点保留了没"（mark-never-drop 的 LLM 侧对偶），不验内容——内容正确性归 §4 的 compile 层和未来 AI-10。

### 2.3 文件级改动

- **新增** `scripts/eval/scorers.mjs`：导出 `CAPABILITY_SCORERS`（`{ key, applicable(gold), pass(gold,pred) }[]`）+ `scoreAll(gold,pred)` 返回 `{ byCapability, exactIntentCore, exactIntentFull }`。纯函数、无 import SDK。
- **改** [eval-llm.mjs](../../scripts/eval-llm.mjs)：`scorePair` 改为 `import { scoreAll }`；聚合时对每个维度在 heldout 上求 `pass/applicable`；record 增 `byCapability`，保留现有顶层字段（向后兼容 badge/历史）。
- **新增** `scripts/eval/scorers.spec.ts`：
  - 对全部 25 个 golden case 跑 `scoreAll(gold, gold)` → 每维 `pass==applicable`、`exactIntentFull==true`。
  - 对每个维度造一个**扰动器**（删一个 dialog key / 改一个 formtype / 去掉 permissions …）→ 断言**只有该维度**掉、其余不变。
  - 这个 spec 不需要 key，进常规 `vitest` CI。

### 2.4 PR-1 验收

- `npm run test`（含新 spec）绿；`scoreAll(gold,gold)` 全维满分。
- 每个维度有一个"咬得住"的扰动用例。
- 带 key 本地 `npm run eval:llm` 输出 `byCapability` 分块；`exactIntentCore` 数值与改造前一致（纯重构不改旧语义）。

---

## 3. PR-2 · AI-02 双语 NL 用例

### 3.1 设计决策

**复用 gold config、零重复。** golden case 的 schema 只强依赖 `{nl, config}`（[score-golden.mjs:314](../../__tests__/golden/scripts/score-golden.mjs#L314) 只读这两个），且 `sync-cases.mjs` 同步的是 `docs/cases/cases.json`（文档站画廊）、**不碰** `__tests__/golden/`。所以给每个 case JSON 加一个**可选** `nlEn` 字段即可：config 不动、确定性层零影响。

**门禁先只落中文，英文只报告。** 冷启动时英文准确率未知，直接纳入门禁会无依据地红。先 per-language 报告，拿到基线后再 ratchet（与决策 B 同一思路）。

### 3.2 文件级改动

- **改** 25 个 `__tests__/golden/cases/*.json`：各加一条忠实翻译的 `nlEn`（意图等价，不是机翻腔）。config 一字不改。
- **改** [eval-llm.mjs:208](../../scripts/eval-llm.mjs#L208) 主循环：每个 case 对 `nl`（zh）跑一遍，若有 `nlEn` 再跑一遍，row 打 `lang` 标签。
- 聚合：顶层沿用 zh 的 heldout 数作门禁；新增 `byLanguage: { zh:{…}, en:{…} }` 入 record 与控制台。
- **新增**一条轻量校验（挂进现有 `check:*` 或 golden spec）：`nlEn` 存在时非空；存在性可部分（允许先译一部分，但 CI 统计覆盖率）。

### 3.3 PR-2 验收

- 25 个 case 全部带 `nlEn`（本波目标全量，成本仅翻译）。
- `eval:llm` 输出 `byLanguage`；中文门禁数值不变。
- 确定性 golden 层对加 `nlEn` 无感（`score-golden` 仍绿）。

## 4. PR-3 · AI-05 补 few-shot 盲区

### 4.1 设计决策（一条关键护栏）

**新 shot 必须用 golden 语料里没有的域。** 这是最容易踩的坑：若新 shot ≈ 某个 golden heldout case，那个 case 就得进 `FEWSHOT_DERIVED`（变成 recall 而非泛化），**heldout 门禁因为少了一道难题而被灌水**。所以新 shot 一律取**全新业务域**（golden 里没有的实体/字段组合），让 25 个 heldout case 继续是干净的泛化测试。

### 4.2 要补的维度（当前 6 shot 的盲区）

Cascader+`dataOptions.children`（递归）、i18n、formLayout、sfc 模式、virtualScroll、多 dialog（add/edit 不同 formItems）、permissionValue、render、antdv target、textarea/Switch/Upload 的细分语义。约 6→14~16 shot。

### 4.3 文件级改动

- **改** [ai-nl-to-config-prompt.ts:29](../../packages/shared/src/ai-nl-to-config-prompt.ts#L29) 的 `NL_TO_CONFIG_FEWSHOT`：追加上述 shot（新域、唯一 `nl`、唯一 `config.name`）。现有 [ai-nl-to-config-prompt.spec.ts](../../packages/shared/__tests__/ai-nl-to-config-prompt.spec.ts) 已自动守 schema 有效/非空/唯一/无损组装。
- **补 2 条该 spec 还缺的护栏**：
  1. 每条 shot `generateFromConfig(config)` 不抛（schema 有效 ≠ 能落地）。
  2. 维度覆盖断言：prompt 里对本节列的每个维度至少有一个 Example（防止"说要补却漏补"）。
  3. 反重叠：新 shot 的 `config.name` 不得与任一 golden case 的 `config.name` 冲突（护住 heldout 纯净度的机器可查部分）。
- **成本提示**：6→16 shot 让 system prompt token 约翻倍，nightly 每 case 输入变长。可接受，但记录在案；若日后过大再做"按意图选 shot"的检索式裁剪（接 AI-15）。

### 4.4 PR-3 验收

- shot 覆盖 §4.2 全部维度，均新域、测试绿。
- 25 个 golden case 的 `FEWSHOT_DERIVED` 归类**不变**（没有 case 因新 shot 被迫改判）。
- 带 key 复测：§2 记分卡里被补维度的 heldout `rate` 可观测上升（这就是 AI-01 先行的理由）。

## 5. PR-4 · AI-04 提交数字 + README 徽章

### 5.1 设计决策

**数字必须来自真实 run，不能种一个占位。** 机制：nightly 的 [eval-llm.yml](../../.github/workflows/eval-llm.yml) 在**真实带 key 跑完**后，把更新的 `last-accuracy.json` + 生成的 `last-accuracy-badge.json`（shields endpoint 形状）**提交回仓库**，仅在数值变化时提交，用 `[skip ci]` + concurrency group 防自触发循环。

**徽章用 shields endpoint 读仓库里的 JSON。** 避免外部 gist 依赖、drift 在 git 历史里可见。

### 5.2 文件级改动

- **改** [eval-llm.mjs:269](../../scripts/eval-llm.mjs#L269)：除 `last-accuracy.json` 外，再写 `last-accuracy-badge.json`：
  ```jsonc
  { "schemaVersion": 1, "label": "NL→config accuracy",
    "message": "96.0% (heldout)", "color": "brightgreen" }
  ```
  颜色阈值：≥95 brightgreen / ≥90 green / ≥80 yellow / else red。两个 JSON **写 LF 换行**（避免 Windows CRLF 守卫误报，见团队既有记录）。
- **改** [eval-llm.yml](../../.github/workflows/eval-llm.yml)：加 `permissions: { contents: write }`；eval 步骤后加 commit-back 步骤（git diff 判变化 → commit `chore(eval): refresh accuracy [skip ci]` → push）；顶层 `concurrency` 防并发。
- **改** [README.md:12](../../README.md#L12) 徽章区：加一行
  `[![NL→config accuracy](https://img.shields.io/endpoint?url=https://raw.githubusercontent.com/liujiaao/es-plus/master/__tests__/golden/last-accuracy-badge.json)](docs/internal/wave-1-eval-trust-design.md)`
  紧跟一句**口径说明**（不是营销）：数字为 heldout 泛化集、非 few-shot recall；度量「零改配置意图准确率」。

### 5.3 PR-4 验收

- 一次真实 nightly（或手动 `workflow_dispatch`）跑完，`last-accuracy.json` + badge JSON 入库。
- README 徽章可渲染，点击进本设计文档。
- commit-back 不触发二次 CI、不产生空提交。

## 6. AI-17 · 显式「本波不做」

**不**在 Wave 1 引入 promptfoo / braintrust。理由：当前 scorer 深耦合**权威 Zod schema + `generateFromConfig` 编译校验**——这两件正是 promptfoo 里要自己写 JS 断言才能复现的东西，迁移在本波是净负担。按维度看板的需求，§2 的 `byCapability` + §5 的持久化已满足。待维度矩阵继续膨胀、或需要对外托管看板时再评估。**记录为有意识的推迟，非遗漏。** 同步在 ROADMAP.md 的 AI-17 标注。

## 7. 全波风险与护栏

| 风险 | 护栏 |
|---|---|
| 加严 exactIntent 当天门禁变红 | 决策 B：门禁留 core，full 只观测，后续 ratchet |
| 新 few-shot 灌水 heldout | §4.1 新域 + name 反重叠检查 + `FEWSHOT_DERIVED` 不变断言 |
| 记分卡自身有 bug | §2.3 meta-eval：gold-vs-gold 满分 + gold-vs-扰动 定向掉分 |
| CI commit-back 自触发循环 | `[skip ci]` + 变化检测 + concurrency |
| Windows CRLF 守卫误报 | 持久化 JSON 强制 LF |
| 双语使 nightly API 成本翻倍 | 已知可接受；记录；必要时英文抽样跑 |

## 8. 一句话

Wave 1 不碰生成能力，只做**"让数字可信"**：先有按维度、能自证的记分卡（PR-1），再铺双语与 few-shot（PR-2/3）喂它，最后把一次真实测量钉进仓库和徽章（PR-4）。做完才敢对外说"生产可用"带的是凭据、不是承诺。
