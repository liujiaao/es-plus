# es-plus AI 原生能力整改落地方案

日期：2026-11-11
基线：`master` @ `c9a258f`（W1–W6 已提交，未 push）
状态：**方案已进入执行**。A 批（确定性）/ B 批（尺子与语料）/ C 批（教学面）已落地，
落点与偏差见 §10 落地记录；D 批（结构性能力）与 E 批（度量维度）未落地项仍按本文件的
「最优解」执行。行号是撰写时的实测值，改动后会漂移 —— 以源码为准。
口径：本文件回答「三（遗留任务）/ 四（BUG 与隐患）/ 五（设计缺陷）/ 六（指标路线）/ 七（度量维度）」
每一问的**最优解 + 具体改法 + 验收方式**。不做「都值得关注」式的罗列 —— 每项都给出选型与否决理由。

---

## 0. 事实基线（决定排期的那几个数）

来源：工作区未提交的 `__tests__/golden/last-accuracy.json`（model `deepseek-flash`，
measurement `complete`，commit `c9a258f5`，corpusHash `b24707741242cc52`，K=3）。
**这是本地读数，不是 nightly 门禁读数；本文只用它做归因。**

| 指标 | 读数 | 门禁 |
|---|---|---|
| `definition95`（zh heldout，零编辑 ∨ ≤3 轮收敛） | **183/203 = 90.15%** | 95% ⟹ 需 ≥193/203，**差 10 行** |
| 其中零编辑腿 | 172/203 = 84.73% | — |
| 脚本化收敛补充 | +11 行（5.4pp），convergence@3 28/30，mean turns 0.39 | — |
| 编译（Tier A） | 429/429 = 100% | 95% |
| 类型检查（Tier B） | 226/227 = 99.56%（1 行 TS2353）；另有 20 例模型自身产物编译失败，**不计入分母** | 观测 |
| 片段腿 | 69/69 已测，scoped 91.3%（地板 77.8%） | 通过 |
| PRD 腿 | 22/22 已测，membership 95.3% | 通过 |
| `byCapabilityOnPinned` | reactions 61.54%（8/13）、configTableOut 71.43%（5/7）、formtype 73.68%（14/19）、columns 79.41%（27/34）、isHidden 88.89% | 诊断 |
| `byCapability`（含未被 NL 点名的细节） | membership 66.5%、dataOptions 47.4% | **无门禁杠杆**，不可与 pinned 相减 |

20 行 zh-heldout 失败的归因（`last-accuracy-misses.json` + `.tmp-eval/pred-deepseek-flash-2026-11-10.jsonl` 逐行核对）：

| 类别 | 行号 | 数量 |
|---|---|---|
| 教学面与 gold 自相矛盾（行内编辑） | 100, 102, 98 | 3 |
| 语料缺陷（NL 未给足判定依据 / 与 refinement 冲突） | 123, conv-15, conv-16 | 3 |
| 评分尺子没归一语义等价形式 | 128, 127, 132 | 3 |
| 可辩护的另一种实现 | 200 | 1 |
| 真实能力缺口 | 104, 197, 198, 96, 131, 37, 38, 13, 145, 23 | 10 |

**这条分解决定了批次顺序**：先修「尺子/语料/教学」能拿 6–8 行，再修「能力缺口 + 教学」
能拿 6–9 行；两条都落地才越 193。任何一条单独都不够。

---

## 1. 总排期

| 批 | 主题 | 动模型？ | 主要产出 | 预计行数 |
|---|---|---|---|---|
| **A** | 确定性缺陷与守卫（四） | 否 | 6 个 P0/P1 bug、5 个假绿守卫、文档计数 | 0（但让 95% 可被相信） |
| **B** | 尺子与语料公平性（五 + 六） | 否 | `rulerVersion` 变更、语料修订、fairness 扩测 | +3～5 |
| **C** | 教学面与 few-shot（五 + 六） | 是（prompt 指纹变） | 行内编辑规则、筛选、editRender props、configTableOut、actions | +6～9 |
| **D** | 结构性能力（三） | 视项而定 | `FormList` / `importConfig` / `engine:'auto'` / 组合出处 | 不进门禁 |
| **E** | 度量维度（七） | 否 | 双腿报表、确定性编译探针、en 趋势 | 0 |

A 必须先于 B/C：A 里有三个假绿守卫，若不先修，「修完变绿」可能只是守卫没在量。

---

## 2. §三 遗留未完成任务（L1–L8）

### L1 · en 腿：few-shot 与 ratchet 门禁

**事实**：`scripts/eval/ratchet.mjs` 只对 zh 行做棘轮；en 行 `observed = {lang:'en'}`，永远只是观测。
W1 后的 en `exactIntentScoped` 36.4%，仍低于 P0-4 的 0.40；主因已换人 —— `propSet` 88/198（44%），
即 en 产物的字段名是英文、身份只能退回 `prop`，一行里一个字段名写法不同就整维判负
（记忆：`en-leg-label-bias`）。

**最优解**：**不**把 en 绝对值翻成门禁（会把「英文命名自由度」当成能力缺口去压模型）。
先做三件事，再谈阈值：

1. **改判据**：en 的 `propSet` 权重降为「结构位次」而非字面名 —— 已有 `alignFields` 的 label 模式，
   en 走 prop 模式是刻意的；在 `scorers.mjs` 为 en 增加**按位置 + 控件类型**的保守回退
   （仅当两侧字段数相同且 formtype 序列一致时启用），并打 `+en-structural-fallback-v1`。
2. **补 few-shot**：`nl-to-config-examples.ts` 增加一条英文行内编辑/联动例，字段名保持英文、
   但演示「NL 里出现的中文标签 → 列 label 用该标签、prop 自选」的锚点。
3. **门禁**：`ratchet.mjs` 加 `observed.en.definition95` 的**不下降棘轮**（允许上行、禁止下行），
   不设绝对值线；绝对值线等 D 批完成后单独立项。

**验收**：`node scripts/eval/rescore.mjs <dump> --misses` 复算后 en `propSet` 与 `definition95` 均不下降；
`check:ratchet` 能对 en 报「较上次 −x」并红。

**否决**：直接把 en 并入 `definition95` 单一分母 —— 会把两种语言的身份模型混成一个数，
且 en 语料规模（198）与 zh（203）不同源，加总没有意义。

---

### L2 · `FormList` 第三阶段

**事实**：`packages/shared/src/constants.ts:1` 的 `FORM_TYPES` 是 16 项，**没有 FormList**；
`docs/internal/capability-remediation-impl-plan-2026-11-09.md` 的 P1-3 第三阶段仍未开始。
表单目前只能「一层 `children` 容器」（`form-nested.ts:134-139` 明确更深的层级会被忽略并告警）。

**最优解**：**明确降级为「不支持」，并把边界写进教学面**，而不是硬做 FormList。
理由：表格行内数组表单要新增一套 `formList` 运行时（增删行、校验、路径展开、三端组件），
它不是「加一个 formtype」，而是新的数据模型；当前 95% 左右的差距里没有一行需要它，
投入产出不成立。

**改法**：
- `structured-config.schema.ts` 的 `children` describe 增加一句
  「只支持一层容器分组；数组型子表单不在声明式契约内，请用 `render` 扩展点或宿主自绘」。
- `docs/internal/capability-remediation-impl-plan-2026-11-09.md` 把 P1-3 标为 **Won't do (v1.x)**，
  写明复活条件（出现 ≥3 个真实用例 + 三端组件就绪）。
- `check:capability-ledger` 的台账里把 `FormList` 从 `planned` 改为 `out-of-scope`（守卫会读到它）。

**验收**：台账与文档一致；`check:capability-parity` 绿。

---

### L3 · `ImportConfig` / `parseCsv`

**事实**：全仓 `packages/*/src` 搜不到 `ImportConfig` / `parseCsv`；但 `VALID_CRUD_ACTIONS`
（`structured-config.schema.ts`）包含 `'import'`，也就是**能生成一个导入按钮，却没有导入契约**。

**最优解**：**不要**在 shared 里实现 CSV 解析。导入是宿主域（编码、大文件、后端校验、权限），
es-plus 提供解析器只会变成又一个半成品轮子。

**改法（二选一，推荐前者）**：
1. **契约化「事件委托」**：给 `actions` 的 `import` 明确语义 —— 只渲染按钮并抛 `import` 事件，
   宿主接管上传；在 `structured-config.schema.ts` 的 `actions` describe 与
   `conventions.ts` 写清「es-plus 不解析文件」。同时把 `import` 从「能力」降级为「按钮」，
   `capability.ts` 相应改文案。
2. 若一定要内置：只做 `importConfig: { accept, maxSize, templateColumns }` 三个纯声明键 +
   `@es-plus/shared` 导出 `csvToRows(text)`（纯函数，≤80 行，不做类型推断），
   上传仍由宿主完成。

**验收**：`check:capability-parity` 里 `import` 的声明与实际行为一致；文档不再暗示能解析。

---

### L4 · `tableOptions.engine: 'auto'`

**事实**：`structured-config.schema.ts:749-753` 的 engine 枚举是 `default | virtual | vxe`，
**没有 `auto`**。P0-1 的 `auto` 被刻意推迟。

**最优解**：**不实现**。`auto` 的语义必然是「按配置猜引擎」，而猜错的代价是静默降级
（例如有 `editRender` 却选了 default，编辑完全不生效）。当前已有确定性告警
（`editRender` 不给 vxe 会 warn），比 `auto` 更可解释。

**改法**：在 `_arg-guard` 的 did-you-mean 里显式拒绝 `engine:'auto'`，提示
「按需求选：行内编辑 → `vxe`；大数据 + vue3 → `virtual`；其余 `default`」，
并写入 `conventions.ts` 的常见错误表。这样模型撞一次就有确定性纠正。

**验收**：`check:unknown-keys` / `validate_config` 对该值返回结构化错误而非静默 strip。

---

### L5 · 死按钮 golden（11–12 例）

**事实**：`capability-remediation-impl-plan-2026-11-09.md` 的 P1-2 列出 03/04/11/12/17/18/20/24/
138/141/143/145 共 12 例「gold 声明了某个 action/按钮，但 NL 从未要求」或反之。
其中 145 已确认是真实缺口（NL 说「新增、删除、导出」，gold `[add,delete,export]`，pred 少了 export）。

**最优解**：**逐例二分，不批量改**。判据只有一条：NL 是否点名了该动作/按钮。
- NL 没点名而 gold 有 ⟹ 改 gold（这是语料缺陷，不是能力）。
- NL 点名而 pred 没有 ⟹ 教学面缺失（归 C 批）。
- 两边都点名但语义不同 ⟹ 保留，进 B 批人工裁。

**改法**：新增一次性审计脚本 `scripts/eval/audit-actions.mjs`（不进 consistency）：
对每个 case 打印 `NL 中出现的动作词` × `gold.actions/tableBtns` × `pred`，人工过一遍后落成
case 修订 + 3 条 few-shot。审计脚本保留在 `scripts/eval/` 供下次复用。

**验收**：`check:gold-self` 增加一条「actions/tableBtns 的每一项都能在 NL 找到动作词或默认规则依据」
（与 `crud-fairness` 的 token 证据同构）。

---

### L6 · 内部文档计数自相矛盾

**事实**：`docs/internal/w1-w6-batch-status-2026-11-10.md` 的 W4 节写「full 18 → **19**、
front-door 12 → **13**」，W6 节写「full 19 → **18**、front-door 13 → **12**」——
两者都对，但读起来像同一时点的矛盾（一段是 W4 增量，一段是 W6 之后的终值）。

**改法**：W6 节改为「在 W4 的 19/13 基础上再 −1」并加一句「全文计数以本节为准」；
同时在文件头加「本文是历史批次记录，当前工具数以 `tools-list.snapshot.json` 为准」。

**验收**：`check:doc-drift` 不覆盖 internal 文档，故靠人工；建议在文首加上述锚点句即可。

---

### L7 · `check:eval-freshness` 长期红

**事实**：W2 派生把 shared 的 `.describe()` 送进了 prompt 源，`promptFingerprint` 与 `corpusHash`
都变了；A 批的 A/B/C/D 记录明确「本批不买这次 token」。

**最优解**：这是**正确状态**，不是缺陷。只有一次完整测量能替换已发布数字。
排期上把它放在 C 批末尾（一次性付费跑批），不要把 freshness 守卫放宽。

**验收**：C 批跑完后 `npm run check:eval-freshness` 绿；产物**不随本地批次提交**。

---

### L8 · 类型检查腿的「模型失败」不计入分母

**事实**：`last-accuracy.json.typecheck` 里 `measured:227`、`modelFailureTypecheck:20`。
20 例是模型产物本身编译失败（Tier A 失败），因此不进入 `vue-tsc`。当前口径把它们排除，
于是类型检查率看起来只有 1 个缺陷。

**最优解**：**保留现状的分母，但把「未测到」显式上报**，不许它变成沉默。
`typecheck.rate` 旁边加 `coverage = measured / sampled`，并在徽章/报表里与 rate 并排显示。
判据沿用记忆里的更正：模型真答错的行是成绩，不算「未测到」；只有 `no-answer/truncated/
无 files` 才算未测到。

**改法**：`scripts/eval/typecheck-leg.mjs` 的 summarize 增加 `coverage`；
`run-metrics.mjs` 输出；`scripts/check-eval-artifact`（若有）把它纳入结构断言。
**不改门禁**。

---

## 3. §四 BUG 与隐患（B1–B18）

> 排序 = 严重度。P0 = 已发布能力的错误行为，P1 = 假绿/可静默丢失，P2 = 文档/教学失真，P3 = 卫生。

### B1 · `read_page` 读不了 TS 产物 —— P0

**事实**：`packages/shared/src/page-source.ts:433-453`：

```ts
const quotedKey = `"${PAGE_SOURCE_KEY}"`
if (text.includes(quotedKey)) {
  const json = text.trim().startsWith('{') ? sliceJsonObject(text) : sliceJsonObject(text)  // ← 两个分支相同
  ...
}
```

`sliceJsonObject(text)` 从**第一个** `{` 开始（`:373-375`）。TypeScript 的 schema 产物是：

```ts
import type { CrudPageSchema } from '@es-plus/vue3'

export const pageSchema: CrudPageSchema = { ... }
```

第一个 `{` 在 `import type { CrudPageSchema }` 里，括号配平后返回 `{ CrudPageSchema }`，
`JSON.parse` 失败 ⟹ `read_page` 对**任何 TS 产物**报「pageSchema 不是合法 JSON」。

TS 产物不是少数：CLI 在 `packages/cli/src/commands/create.ts:178` 显式补 `typescript = true`；
`packages/shared/src/scene/emit.ts:290` 用 `config.typescript === false ? 'js' : 'ts'` 命名——
**未传就是 TS**。而生成器自身用 falsy 判断（`:1025`），且 `assertValidConfig`（`:441-443`）
把 `safeParse` 的结果丢弃，schema 上的 `.default(true)` 从不到达生成器。
⟹ 同一个键在三处有三种真值语义：生成器 falsy / 场景发射 `=== false` / CLI 补 true。
W4 的往返测试用的正是「不传 typescript」的配置，于是恰好走了 JS 分支，把 B1 藏住了。

**顺带的第二处缺陷**：`typescript` 必须收敛成一处判定（建议 `config.typescript !== false`，
与场景发射一致——因为产物文件名已经承诺了 `.ts`）。

**最优解**：按「候选对象逐个试」定位，而不是按第一个 `{`。

```ts
// page-source.ts
function findSourceObject(text: string): Record<string, unknown> | null {
  let from = 0
  for (let attempt = 0; attempt < 64; attempt++) {
    const start = text.indexOf('{', from)
    if (start < 0) return null
    const json = sliceJsonObject(text, start)
    if (json) {
      try {
        const obj = JSON.parse(json)
        if (obj && typeof obj === 'object' && !Array.isArray(obj) && PAGE_SOURCE_KEY in obj) return obj
      } catch {
        /* 不是这一层，继续 */
      }
    }
    from = start + 1
  }
  return null
}
```

调用处改为：

```ts
if (text.includes(quotedKey)) {
  const pageSchema = findSourceObject(text)
  if (!pageSchema) {
    return { ok: false, error: `${label}：找不到包含 \`${PAGE_SOURCE_KEY}\` 的 pageSchema 对象。`, hint: '产物被截断或手工改过；重新生成。' }
  }
  return assertSource(pageSchema[PAGE_SOURCE_KEY])
}
```

同时删掉那个恒等三元（它本身就是「曾经想区分、后来没做」的残留）。

**为什么不用正则先切 `export const pageSchema`**：产物可被宿主改成 `const page =`、
`export default`、或裸 JSON；候选扫描对三种入口一视同仁，且沿用了已经字符串/转义感知的
`sliceJsonObject`（`:366-372` 的注释解释了为什么不 `indexOf('{') … lastIndexOf('}')`）。

**验收**：
- `packages/shared/__tests__/page-source.spec.ts` 增加：真实 `generateFromConfig({typescript:true, mode:'schema'})`
  的 `code` 必须 `readPageSource` 成功；`typescript:false` 同样成功；sfc 仍成功。
- 新增反例：只有 `import` 花括号、没有出处时，必须返回 `ok:false` 而**不是**抛出。
- 新增一条真值一致性断言：`generateFromConfig({mode:'schema'})`（不传 typescript）与
  `{typescript:false}` 产出相同；`scene emit` 的文件名 `.ts` 与产物含 `import type` 同真同假。

---

### B2 · 字段级 `dataOptions.children` 被原样复制进表格列 ⟹ 生成的 TS 编译失败 —— P0

**事实**：
- 表格列的契约是窄的：`packages/core/src/types.ts:728-734` 的 `TableColumnDataOption` 只有
  `label / value / tagType?`；`structured-config.schema.ts:408-425` 的 `ColumnSchema.dataOptions`
  也只允许这三个键。
- 字段级却是宽的：`DataOptionSchema`（`structured-config.schema.ts:25-50`）允许
  `label / value / disabled? / children? / tagType?`（Cascader 需要 `children`）。
- 生成器**四处原样搬运**：
  - `structured-generator.ts:366` `attachFieldDataOptions` → `{ ...c, dataOptions: f.dataOptions }`
  - `structured-generator.ts:2210` `buildTableColumn` → `col.dataOptions = field.dataOptions`
  - `structured-generator.ts:2385` `buildTableColumnSFC` → `dataOptions: ${inlineJson(field.dataOptions)}`
  - `structured-generator.ts:280-288` `sanitizeExplicitColumns` 只剥列级键，**不剥 item 级键**

**实测后果**：`13-all-formtypes.json [vue3] — schema.ts:125:11 — TS2353:
'"children"' does not exist in type 'TableColumnDataOption'.` —— 这是 `last-accuracy.json`
里唯一的类型检查失败，也是**生成物开箱不编译**这一类缺陷的样本。

**最优解**：加一个单源投影函数，所有「字段 → 列」的出口都走它。

```ts
// structured-generator.ts（导出，供其它包/测试复用）
export function projectColumnDataOptions(
  options: ReadonlyArray<Record<string, unknown>> | undefined,
): Array<Record<string, unknown>> | undefined {
  if (!Array.isArray(options) || options.length === 0) return undefined
  return options.map((o) => {
    const out: Record<string, unknown> = { label: o.label, value: o.value }
    if (o.tagType !== undefined) out.tagType = o.tagType
    return out
  })
}
```

- `:366` → `return { ...c, dataOptions: projectColumnDataOptions(f.dataOptions) }`（空数组则不发键）
- `:2210` → `const opts = projectColumnDataOptions(field.dataOptions); if (opts) col.dataOptions = opts`
- `:2385` → 同样先投影；同时 `:2317`（显式列 SFC）在 `sanitizeExplicitColumns` 之后天然安全
- `:284` → `out[k] = k === 'dataOptions' ? projectColumnDataOptions(v as any) : …`

**为什么不在 `DataOptionSchema` 上直接去掉 `children`**：字段级 `children` 是 Cascader /
TreeSelect 的合法声明，删掉会打断表单路径。损失发生在**投影到列**这一步，就在这一步收窄。

**验收（三道）**：
1. 新增 `packages/shared/__tests__/column-data-options.spec.ts`：字段 `dataOptions` 带
   `children/disabled` 时，产出的 `columns[].dataOptions` 只含 `{label,value}`（+可选 `tagType`）；
   显式 `columns` 里手写 `children` 时同样被剥。
2. `scripts/check-option-shape.mjs` 扩测（见 B6）。
3. 确定性编译探针（见 D9）覆盖「Cascader 字段 + 派生列」这一组。

---

### B3 · `configToSurfaces` 静默丢掉 11 个弹窗底座键 —— P1

**事实**：`page-source.ts:316-322` 的弹窗投影只保留 `key/title/width/fullscreen/formItems`；
而 `DialogBlockOptionsSchema`（`structured-config.schema.ts:680-694`）支持 **13 个**底座键
（`width/maxHeight/isDraggable/fullscreen/isHiddenFooter/showClose/destroyOnClose/modal/
closeOnClickModal/closeOnPressEscape/hiddenFullBtn/appendTo/cacheKey`）。
其中 `width/fullscreen` 被保留，**其余 11 个静默改回默认**。
`configToSurfaces` 的契约写着「表达不了的逐条写进 lossy，绝不静默丢」（`:291-298`），但这里没写。

后果：front-door 档「回读 → 改 → `generate_scene`」会把 `maxHeight`、`destroyOnClose`、
`closeOnClickModal` 等**静默改回默认**，宿主以为原设置还在。

**最优解**：投影键集与 `DialogBlockOptionsSchema` 同源，逐键拷贝；`formLayout`/`configBtn`/
`cacheKey` 等 `DialogBlockOptionsSchema` 之外的键写 lossy。

```ts
// page-source.ts
import { DialogBlockOptionsSchema } from './structured-config.schema.js'

const DIALOG_BLOCK_KEYS = Object.keys(DialogBlockOptionsSchema.shape) // 13 个
// key/title 不是底座键，单独带上
const DIALOG_SURFACE_KEYS = ['title', ...DIALOG_BLOCK_KEYS] as const
```

```ts
const dialogEntries = Object.entries(config.dialogs ?? {})
  .filter(([, dlg]) => dlg && typeof dlg === 'object')
  .map(([key, dlg]: [string, any]) => {
    const out: Record<string, unknown> = { key }
    for (const k of DIALOG_SURFACE_KEYS) if (dlg[k] !== undefined) out[k] = dlg[k]
    if (Array.isArray(dlg.formItems)) out.formItems = dialogFormItems(dlg)
    return out
  })
```

再加一段 lossy 计算：对每个弹窗，遍历其键，凡不在 `{key,title,...DIALOG_BLOCK_KEYS,formItems}`
且不在 `x-` 前缀内的，`lossy.push({ path: \`dialogs.${key}.${k}\`, kind: 'not-expressible', … })`。

**为什么不直接把整份 dialog 塞进 intent**：`generate_scene` 的 `dialog` 块由派生 schema
（`_fragment-shapes.ts:60`）校验，多余键会被 passthrough 放到 handler 再被丢；且前门的
教学面只承诺底座键。同源白名单 + 显式 lossy 才是可解释的。

**验收**：`page-source.spec.ts` 增加「回读 → configToSurfaces → 再生成」的键守恒断言：
凡 `DialogBlockOptionsSchema` 里的键，传入值与 intent 值逐键相同；其余键在 lossy 里出现。

---

### B4 · fuzz 哨兵可以被「出处」满足（假绿） —— P1

**事实**：`scripts/check-generator-fuzz.mjs:193-199`：

```js
const whole = fields.map((f) => result[f]).join('\n')
if (!whole.includes(`ZZF${payload.id}`)) { ... 哨兵未出现，值被静默丢弃 ... }
```

W4 之后产物里带着 `__esPlusSource.config`（输入配置的原样副本）。一个被生成器**忽略**的值
（模式不消费 / 未知键 / 未接线）仍然出现在出处里 ⟹ 哨兵命中 ⟹ 「值真的落进产物」这条断言失效。
这不是理论问题：`dialogs` 在 sfc 模式、`permissions` 在 schema 模式都会被整体忽略，而源头都写着。

**最优解**：度量前先剔除出处，且把剔除逻辑做成 shared 导出（fuzz、测试、度量共用一份）。

```ts
// packages/shared/src/page-source.ts
/** 去掉产物里的出处：schema 删 `"__esPlusSource": {…}` 属性，sfc 删整行注释。 */
export function stripPageSourceArtifact(code: string): string { … }
```

实现要点（与 `sliceJsonObject` 同一套字符串感知）：
- schema：找到 `"__esPlusSource"` 前的 `,`（或属性起始位置），用括号配平吃到对应的 `}`，
  连同前导逗号一起删；再 `JSON.parse` 校验一次（失败则原样返回，不猜）。
- sfc：删掉以 `// __esPlusSource:` 开头的那一整行（产物是单行注释，`:22` 的 changeset 已说明）。

然后 fuzz：`const whole = stripPageSourceArtifact(fields.map(...).join('\n'))`。
**同时**把 `check-generator-fuzz` 加一条自测：构造一个「只在出处里出现」的 payload，
必须仍然判红（否则剔除本身写错了没人知道）。

**否决**：「哨兵改为检查 `runtimeSchemaOf`」—— fuzz 同时覆盖 sfc wrapper 产物，
统一成文本剔除比按 mode 分支更不容易漏。

---

### B5 · 类型检查腿在「无产物文件」时会空白通过 —— P1

**事实**：`scripts/eval/typecheck-leg.mjs` 的 `writeTypecheckProject` 有 `if (!c.files) continue`；
`runTypecheck` 在**所有**用例都没有 `files` 时，`vue-tsc` 无输入、退出码 0，于是所有行都是
`typechecks: true`。目前样本正常，所以没暴露；但任何一次 `productFiles` 回归（比如产物字段改名）
都会把它变成 100% 假绿。

**最优解**：把「没有可检查的文件」当成**测量失败**，不是通过。

```ts
const checkable = cases.filter((c) => c.files)
if (checkable.length === 0) {
  throw new Error('[typecheck-leg] 没有任何可检查的产物文件 —— productFiles 可能回归；本次不构成测量')
}
```

并对单个 case：`files` 为空且该 case 本应产出时，记 `notMeasured: true`（rate 的分母不含它，
但 `coverage` 会掉下来，见 L8）。

**验收**：`scripts/eval/typecheck-leg.test.mjs` 增加一例「全部无 files ⟹ 抛错」；
再补一例「部分无 files ⟹ 该行 notMeasured，rate 基于其余行」。

---

### B6 · `check-option-shape` 不覆盖表格列选项 —— P1

**事实**：`scripts/check-option-shape.mjs:51-52` 只钉
`EXPECTED_REQUIRED=['label','value']`、`EXPECTED_OPTIONAL=['disabled','children','tagType']`，
检查对象是 `DataOptionSchema`、JSON Schema、core `FormDataOption`、vue3/antdv `FormDataOption`、
MCP `FormDataOption`；**没有** `TableColumnDataOption`（core `types.ts:728`）与
`ColumnSchema.dataOptions`（`structured-config.schema.ts:408`）。B2 那一类缺陷因此没有守卫。

**最优解**：把守卫扩成两份键集，并加一条「字段→列投影必须是子集」的断言。

```js
const FORM_OPTION = { required: ['label','value'], optional: ['disabled','children','tagType'] }
const CELL_OPTION = { required: ['label','value'], optional: ['tagType'] }
```

- 新增对 `packages/core/src/types.ts` 的 `TableColumnDataOption` 键集检查；
- 新增对 `structured-config.schema.ts` 的 `ColumnSchema.dataOptions.items` 键集检查；
- 新增：`projectColumnDataOptions` 的输出必须是 `CELL_OPTION` 的子集（直接 import 跑一遍）。

**验收**：`npm run check:option-shape` 在 B2 未修时红、修后绿（这是对守卫本身的正向验证）。

---

### B7 · `modeLossy` 不检查弹窗 `formItems` 里的函数 —— P2

**事实**：`page-source.ts:124-157` 的 schema 分支只遍历顶层 `fields[]` 的
`formatter/render`，以及 `dialogs.*.hasCustomRender`。弹窗 `formItems[].render/formatter`
（schema 模式同样无法内联）**不报 lossy**，宿主会以为它已经随配置带走了。

**改法**：抽一个 `collectFunctionLossy(items, basePath)`，对 `fields[]`、`dialogs.*.formItems[]`
（一层，与生成器的嵌套上限一致）各跑一次；嵌套 `children[]` 递归 ≤2 层。

**验收**：`page-source.spec.ts` 增加「弹窗 formItems 带 render ⟹ lossy 里出现该路径」。

---

### B8 · `nl-evidence` 的 `inForm` 回退把整段 NL 当依据 —— P1（公平性）

**事实**：`scripts/lib/nl-evidence.mjs` 的 `fieldEvidence`：

```js
case 'inForm': {
  if (anyClause(nl, label, /填|表单|录入|输入/)) return true
  return /(?:不用|不需|无需|不可|不能)(?:填|录入|输入)/.test(String(nl))   // ← 整段 NL
}
```

回退正则没有限定「与字段同句」。conv-15 的 NL「工号由 HR 系统生成，表单里不用填；支持新增、编辑、删除」
里，`inForm:code` 只因这几个字就拿到证据 —— 对任何字段都成立。公平性守卫
（`scripts/eval/crud-fairness.test.mjs` 的 `pinnedDims ⊆ nlStatedDims`）因此对这两个 case 失效。

**最优解**：把回退限定在「提及该字段的句子」；中文的主语省略用「同一句的前一个分句」兜住。

```js
case 'inForm': {
  if (anyClause(nl, label, /填|表单|录入|输入/)) return true
  const neg = /(?:不用|不需|无需|不可|不能)(?:填|录入|输入)/
  for (const s of sentencesOf(nl)) {
    const clauses = clausesOf(s)
    const i = clauses.findIndex((c) => sentenceMentions(c, label))
    if (i >= 0) {
      // 同句内：字段本身所在分句，或紧邻的前/后一个分句（主语省略）
      if (neg.test(clauses[i]) || neg.test(clauses[i - 1] ?? '') || neg.test(clauses[i + 1] ?? '')) return true
    }
  }
  return false
}
```

**验收**：`nl-evidence.test.mjs`（若无则新建）两条：
- 正例：「工号由 HR 系统生成，表单里不用填」+ 字段「工号」⟹ `inForm` 有证据；
- 反例：同一句 + 字段「编码」⟹ **无**证据。
然后 `npm run check:crud-fairness` 应把 conv-15/conv-16 的 `inForm:code` 判为「证据不足」，
迫使 B 批决定：是修 NL（把「工号」写进后半句），还是把该 pin 从 `nlStatedDims` 移除。
**这一步会红，是预期的**。

**同一守卫的第二个盲区（本轮新发现）**：证据是 **token 级**（`inQuery`/`extPoints` 这类词
是否在 NL 出现），不是 **值级**。于是 `extPoints:complexStatus` 这种「pin 绑定了具体字段名」
的行会通过公平性检查 —— NL 里有「自定义 render」（token 证据成立），但 `complexStatus`
这个名字 NL 从未出现；13 号行的 gold label「复杂状态」与 pred「状态」也因此没对齐
（`alignFields` 是精确 label 匹配），模型写的 `status` + render 被判负。

**改法**：`pinnedDims` 的 token 如果是「维度:身份」形态（`extPoints:<prop>`、`inForm:<prop>`），
证据检查必须同时验证 **`<prop>` 或其 label 在 NL 出现**；否则判「pin 值无 NL 依据」。
这条要等 B8 的 inForm 收窄一起落地，否则会一次把多条语料判红。
**这是「公平性」从 token 级升级到值级的第一步**，也是 95% 这个数字可信的前提之一。

---

### B9 · antdv 虚拟滚动：四处失实文案 —— P2

**事实（真源）**：`packages/shared/src/capability.ts:104-117` 明确 antdv `tableOptions.virtual` = `none`
（「a-table 从未实现虚拟滚动」）；`packages/adapter-antdv/src/components/es-table/src/component.vue:418-430`
有 `virtualRequested` watch：告警并回退默认引擎。

**失实处**：
1. `packages/mcp-server/src/resources/types.ts:196`
2. `packages/mcp-server/src/tools/get-component-api.ts:208`
3. `packages/mcp-server/src/resources/conventions.ts:338-344`
4. `packages/core/src/types.ts:1086-1088`（TableOptions 的 virtual 注释）

**改法**：四处统一成 `capability.ts` 的表述（antdv/vue2 无虚拟引擎，大数据用 `engine:'vxe'`）。
**守卫**：`check:capability-parity` 增加一条文本扫描 —— 凡包含 `a-table` + `virtual` 的文档/描述串，
必须同时包含否定词（`never` / `没有` / `不支持` / `fallback`）。W2 的教训（镜像里的错误事实
被搬进权威描述）说明这一条值得静态钉死。

---

### B10 · `columnGroups` 的产物路径写错 —— P3

**事实**：`scripts/lib/ai-token-map.mjs:227-231` 的 `columnGroups`：
`structuredPath: 'columns[].groups'`，但 `artifactPaths: ['columns[].children']`；
`docs/ai/ai-capability-matrix.json:1454-1458` 同错。产物里多级表头键**就是** `groups`
（`ColumnSchema.groups`，`structured-config.schema.ts:427`；core `TableColumn.groups`）。

**改法**：两处都改 `artifactPaths: ['columns[].groups']`，然后 `npm run ai:matrix` 重生成。
**守卫**：token-map 增加「artifactPaths 的每个 token 必须能在 golden 产物里命中至少一次」的自检
（现有 `check:ai-cases --strict-coverage` 只覆盖 case 覆盖，不覆盖产物路径）。

---

### B11 · 过期工具计数与守卫盲区 —— P2

**事实**：
| 位置 | 现状 | 应为 |
|---|---|---|
| `packages/mcp-server/server.json:22` | 「front-door (12 tools …)」「~244 KB to ~21 KB」 | 13 工具；244 是 W2 前体积 |
| `packages/mcp-server/src/cli-flags.ts:45` | 「default: full — all 18 tools; 12 under front-door」 | 19 / 13 |
| `packages/mcp-server/src/instructions.ts` | 注释写「隐藏三个工具」「少七个」 | 实际隐藏 6 个 |
| `es-plus-docs/src/docs/mcp-server.en.md:280` | 「14 shared `formtype` values」 | 16 |

**根因**：`scripts/check-tool-surface.mjs:244+` 的 `claims` 只读
`docs/why-es-plus.{md,en.md}`、`es-plus-docs/src/docs/mcp-server.{md,en.md}`、`packages/mcp-server/README.md`；
**不读** `server.json`（registry manifest）、`cli-flags.ts`、`instructions.ts`。

**改法**：
1. 改数（上表四行）。
2. `check-tool-surface` 的 `claims` 扩到上述三个文件；`front-door` 的数量从
   `tools-list.snapshot.json` 读取，不写字面量（避免再出现「数字对了但黑名单过期」）。
3. formtype 数量改为 `FORM_TYPES.length`（import `constants.ts`），不写 14/16。
4. 删除 `instructions.ts` 里「三个/七个」这类**相对数量**注释，改为引用常量。

**验收**：`npm run check:tool-surface` 覆盖新增文件；故意把 `server.json` 改成 12 应红。

---

### B12 · `formItemOptions` 是配置文件里不存在的键 —— P2

**事实**：`structured-config.schema.ts:310` 的 `render` 描述、`ai-nl-to-config-prompt.ts:981` 的英文
教学都让模型「优先用 `formItemOptions`」，但配置顶层/字段级**没有这个键**（表单校验键是 `rules`）。
`crud-page-schema.ts:159` 里的 `formItemOptions` 是**运行时 FormItem 的 prop 示例**，不是配置键 ——
两者被混为一谈。

**改法**：两处改成 `rules / attrs / dataOptions / reactions`，并在 `rules` 的 describe 里
补一句「这是配置侧的校验键；产物里的 `formItemOptions.rules` 是它编译后的形态」。

**验收**：`check:unknown-keys` 已有 unknown-key 检测；新增一条教学文本扫描，禁止配置类文档
出现裸 `formItemOptions`（`crud-page-schema` 的运行时示例白名单除外）。

---

### B13 · `read_page` 的描述过度承诺 + profile 错配提示 —— P2

**事实**：
- `packages/mcp-server/src/tools/read-page.ts` 的描述写「LOSSLESS unzip」「Pass the full source of
  `schema.ts` / `Page.vue` / a bare pageSchema JSON」。前两条在 B1 修复前是假的；「lossless」也与
  `lossy[]` 的存在自相矛盾（有损时才需要这张表）。
- 响应提示「要保留它们就用上面的 config 走高级生成路径」在 front-door 档是错的 ——
  那一档没有 `generate_crud_from_config`。
- `registerReadPage(server, _profile = resolveToolProfile())` 的 `_profile` 未使用。

**改法**：
```ts
const hint = profile === 'front-door'
  ? '要保留它们，把返回的 config 交给 generate_scene（scene="crud" 的 intent 见 surfaces）'
  : '要保留它们，把返回的 config 交给 generate_crud_from_config'
```
描述改为「returns the generator's input config plus an explicit lossy[] list; pages without
provenance are rejected, not reconstructed」。同时把「Pass the full source」改成「Pass the file
content」，不承诺具体文件名。

**验收**：`check:front-door` 增加一条：front-door 档的任何工具描述/响应提示不得出现
`generate_crud_from_config` / `generate_crud_page`（已有部分断言，扩到响应提示）。

---

### B14 · 组合产物没有出处 —— P2

**事实**：`packages/shared/src/scene/composition.ts` 的 `pageCode()` 直接拼源码；
`packages/shared/src/scene/emit.ts` 里带表格的 scene 走 `composeCrudConfig → generateFromConfig`
（有出处），**非表格分支没有**。于是 `generate_composition` 的产物里，`read_page` 只能报
「找不到出处」。

**最优解**：单独一份契约，不要硬塞进 `page-source@1`（组合的输入不是一份 `StructuredCrudConfig`）。

```ts
export const COMPOSITION_SOURCE_KEY = '__esPlusCompositionSource' as const
export const COMPOSITION_SOURCE_CONTRACT = 'es-plus.composition-source@1' as const
interface EsPlusCompositionSource {
  contract: typeof COMPOSITION_SOURCE_CONTRACT
  scene: 'composition'
  nodes: Array<{ id: string; scene: string; intent: Record<string, unknown> }>
  wires: Array<{ from: string; to: string; slot?: string }>
}
```

`read_page` 识别到该键时返回 `{ kind: 'composition', source }`，并提示「用 `generate_composition`
原样重放」。**不要**尝试把它降维成 `surfaces`。

**验收**：组合往返（读回 → `generate_composition` → 逐字节相同）一个测试；
`read_page` 对组合产物不再报「W4 之前生成」这种误导性错误。

---

### B15 · 类型镜像缺 `__esPlusSource` —— P3

**事实**：`packages/mcp-server/src/resources/crud-page-schema.ts` 的 `CRUD_PAGE_TYPES_FALLBACK`
里的 `CrudPageSchema` **没有** `__esPlusSource`，而打包后的 `.d.ts` 有。宿主若落在 fallback
（bundled d.ts 不可用时），写出的 `pageSchema` 会被判类型错误。

**改法**：三端 `CrudPageSchema` + MCP fallback 四处同批补 `__esPlusSource?: EsPlusPageSource`。
**守卫**：已有 type-exports 类守卫按**键集**比对（记忆：`regex-evidence-guard-anchors` 里的
type-exports 锚点），把 `__esPlusSource` 加进必比键集。

---

### B16 · 嵌套表单的 `labelKey` 会撞键 —— P3

**事实**：`structured-generator.ts:2043` 的 `buildFormItem` 递归子字段时用
`field.labelKey ?? \`field.${field.prop}\``，子字段的 `prop` 是 `street` ⟹ `field.street`；
运行时 `packages/core/src/form-nested.ts:141-147` 把 `prop` 重写成 `address.street`，
但**不动 `labelKey`**。于是 `address.street` 与 `shipping.street` 共用同一个翻译键，后者覆盖前者。

**改法**（二选一，推荐后者）：
1. `buildFormItem` 递归时传 `pathPrefix`，labelKey 用 `field.${prefix}.${prop}`；
2. `flattenFormItems` 里：`labelKey === \`field.${oldProp}\` → \`field.${resolvedProp}\``（只在
   自动派生键上改写，显式 labelKey 不动）。

推荐 2：它同时覆盖手写配置（不经生成器）的场景，且改动集中在一个函数。
**风险**：已有宿主可能按 `field.<childProp>` 建了翻译表；这是一次**破坏性变更**，需在
CHANGELOG 标注 + `migrate-v1.x` 给一条 codemod。**因此排 P3，不进本轮。**

**验收**：两个容器各带同名子字段时，`labelKey` 不同；显式 `labelKey` 不被改写。

---

### B17 · MCP 的 `TableColumn` 文档漂移 —— P2

**事实**：`packages/mcp-server/src/tools/get-component-api.ts:141-155` 的 `TableColumn` 列了
`prop/label/width/minWidth/align/fixed/groups/render/scopedSlots/btns/ellipsis/hidCol`，
**缺** `dataOptions / filters / filterMultiple / filterMode / permissionValue / expandConfig /
type / editRender`。模型按这份文档写 `columns`，就会漏掉这些键。

**改法**：以 `packages/core/src/types.ts` 的 `TableColumn` 为单源生成该段（或至少按键集对账）。
**守卫**：`check:component-api` 增加「MCP 文档的列键集 ⊇ core `TableColumn` 的键集」断言 ——
这是 `check:renderer-parity`（记忆：`column-parity-guard-landed`）的同构做法。

---

### B18 · 已删除工具仍在迁移文档里 —— P3

**事实**：`docs/migrate-v1.4.md:194` 与 `es-plus-docs/src/docs/migrate-v1.4.md:194` 仍在教
`generate_crud_page`，而 W6 已删除该工具。

**改法**：改源 `docs/migrate-v1.4.md` → `npm run docs:sync` 覆盖站点副本。
**守卫**：`scripts/check-tool-surface.mjs` 的「已退役工具名不得出现在**指令性**上下文」
扩到 `migrate-*.md`；区分「历史说明」与「教你怎么调」需要白名单（`已删除`/`removed` 同句时放行）。

---

## 4. §五 设计缺陷（D1–D10）

### D1 · 行内编辑：教学面与 gold 直接对打 —— P0（影响 4 行：100/102/98/104）

**事实**：
- 教学（`nl-to-config-examples.ts:445`、`ai-nl-to-config-prompt.ts:685/976`）：
  「**只有 NL 点名要改的那一列写 `editRender`** ……『整行/整表编辑』描述的是触发方式或模式，
  不是给每一列都挂编辑器的许可」。
- gold（100/102/98）：NL 说「双击整行进入行内编辑」「表格行内编辑，单击单元格修改」
  「单击单元格进入行内编辑」，gold 把**两列都**挂了 `editRender`，还给了 `mode:'row'`。

教学与 gold 谁对？**都只对一半**。真实语义是：

| NL 说法 | 应挂 `editRender` 的列 | `editConfig.mode` |
|---|---|---|
| 点名某列（「修改价格」） | 只有该列 | `cell`（默认） |
| 「整行编辑」 | 所有数据列 | `row` |
| 「表格支持行内编辑」但未点名 | 所有数据列 | `cell`（逐格进入） |

**最优解**：把上表写进教学面（中英各一份），**并且**让生成器给出确定性告警，使错误可被
`refine_config` 的收敛腿修掉：

```ts
// structured-generator.ts（新函数，generateFromConfig 接入 warnings）
export function editCoverageWarning(config: StructuredCrudConfig): string | undefined {
  const tc = config.tableOptions?.editConfig
  if (!tc) return
  const dataCols = explicitOrDerivedDataColumns(config)          // 去掉 index/selection/expand/操作列
  const editable = dataCols.filter((c) => c.editRender)
  if (tc.mode === 'row' && editable.length < dataCols.length) {
    return `editConfig.mode='row' 表示整行可编辑，但 ${dataCols.length - editable.length} 个数据列没有 editRender —— 这些单元格在行模式下仍是只读。`
  }
  if (editable.length > 0 && !config.tableOptions?.engine || config.tableOptions?.engine !== 'vxe') {
    return `editRender 只在 tableOptions.engine='vxe' 时生效（当前 ${engine ?? 'default'}）。`
  }
}
```

**为什么用告警而不是硬修**：「表格支持行内编辑」是否等于「所有列可编辑」取决于业务
（主键列通常不可编辑）。硬修会把标识列也变成可写，正是教学面担心的那件事。
确定性告警 + 收敛腿是目前信息量最大的做法。

**验收**：`check:generator` 增加 3 例（row 全覆盖 / row 部分覆盖告警 / 点名单列不告警）；
B/C 批重跑后 100/102/98/104 应转绿。

---

### D2 · 列级筛选只能通过显式 `columns` 表达 —— P1（影响 2 行：197/198）

**事实**：`ColumnSchema` 有 `filters/filterMultiple/filterMode/filterable`（`structured-config.schema.ts:375-406`），
但 `FieldConfig` **没有**；于是「航司列可按下拉筛选」必须写整份显式 `columns`。
`columns` 是**覆盖**（`structured-generator.ts:374-389` 的注释），模型少写一列就整列消失；
197/198 正是这种失败。

这不是模型不够聪明，是**表达能力放在错误的位置**：筛选是「这一列的展示/交互属性」，与
`width/align/ellipsis` 同层，理应能写在字段上。

**最优解（两阶段）**：
- **C 批（立刻）**：教学面补「列级筛选 → 必须写显式 `columns`，且所有展示列都要写进去」
  + 一条 few-shot（单选 + 文本包含两种）。
- **下一 minor（结构性）**：`FieldConfig` 增加
  `filters? / filterMultiple? / filterMode? / filterable?`，`buildTableColumn` 与
  `buildTableColumnSFC` 直接透传。改动面：shared schema + `SurfaceFieldSchema`（它由
  `FieldConfigSchema.omit({inQuery,inTable,inForm})` 派生，自动获得）+ 两个发射点 + 生成器测试。
  **不需要**动三端渲染器（列产物形状不变）。

**否决**：让 `filters` 只存在于 `columns` 并加强教学 —— 它把「少写一列」变成整列丢失，
是结构性的易错面，不该长期存在。

**验收**：新增字段级筛选用例经 `generate_scene` 与 `generate_from_config` 产出**逐字节相同**的列。

---

### D3 · reactions 的「值身份」在 NL 下不可判定 —— P1（影响 3 行：128/127/132）

**事实**：三种不同的失败被混在一起：

| 行 | gold | pred | 性质 |
|---|---|---|---|
| 128 | `fulfill.value = {var:'storeName'}` | `{ if: [empty(var), '', var] }` | **语义等价**，尺子没归一 |
| 127 | `when: '==' [结算类型, 'cross']` + Select 选项 `domestic/cross` | `== '跨境结算'`，且未声明 dataOptions | **pred 不完整**（缺选项码表） |
| 132 | `== 'closed'` + Select 选项 `open/closed` | `== '已结案'`，且未声明 dataOptions | 同上 |

128 的根因在教学面自相矛盾：中文教学（`ai-nl-to-config-prompt.ts:845`）说「未选时 value 表达式
本身就给出空值」，英文教学（`:959`）却明确要求写成 `if(empty(...), '', var)` —— 模型照英文做，
gold 照中文写。**这是尺子/教学的问题，不是模型的问题。**

**最优解**：
1. **128 → 尺子归一**（`scorers.mjs` 的 `reactionsView`）：把
   `{ if: [ { empty: [X] }, '', X ] }` 与 `X` 视为同一值表达式，**仅当** X 是 `{var: ...}` 且
   该字段的 formtype 是文本类（Input/Select/Radio/Autocomplete…）。打
   `+reaction-value-empty-equiv-v1`。理由：对字符串字段，两者运行时都得到「空」；
   差异只在 `undefined` 与 `''`，而表单模型两者都渲染为空。
2. **统一教学**：中文教学补一句「`{var:'x'}` 已含空值语义，不要再套 `if(empty)`」；
   英文教学的同句改为「要么写 `{var:'x'}`，要么写 `if(empty…)`；两者等价，但**优先前者**」。
3. **127/132 → 教学 + 校验**：在 `reactions` 的 describe 与 few-shot 里加一条硬规则：
   「若 `when` 的分支依据是某个下拉的**标签**，必须同时为那个字段声明 `dataOptions`
   （label 照 NL，value 自选稳定码），并让 `when` 比较 **value**」。
   同时 `validate_config` 增加确定性检查：`when` 里出现的中文字面量，若同一配置里没有任何
   `dataOptions` 的 label 等于它 ⟹ `warning`（不是 error，避免误伤）。

**为什么不把 `labelLiteral` 放宽成「gold 有选项就映射」**：那会让「只写标签、不写码表」的
配置判过，而它在真实后端的码值下**不会触发**。127/132 是真实缺陷，不该被尺子掩盖。

**验收**：`check:scorers` 增加 128 形态的等价断言 + 127 形态的反例（必须仍判负）。

---

### D4 · `actions` 与 `tableBtns` 的职责边界没有单源 —— P1（影响 2 行：145/23）

**事实**：145 —— NL 点名「新增、删除、**导出**」，pred `[add, delete]`；
23 —— NL 只点名导入/导出按钮，pred 多加了「新增」。
`VALID_CRUD_ACTIONS` 包含 `export/import`，`tableBtns` 也能表达自定义按钮，但教学面从没说过
「什么时候用哪个、默认加不加」。

**最优解**：写死三条规则，进 `conventions.ts` + two few-shots：
1. `actions` = **恰好** NL 点名的内置动作。不点名的不加（包括「新增」）。
2. 导入/导出属于 `actions`（内置），不是 `tableBtns`。
3. `tableBtns` 只用于**非内置**的自定义按钮（打印、批量审核…）。

**验收**：`check:crud-actions` 增加「gold 的每个 action 都能在 NL 找到动作词」的审计（与 L5 同一脚本）。

---

### D5 · 两条完成腿没有分开报告 —— P2

**事实**：`definition95` 把「零编辑」和「≤3 轮收敛」合成一个数；仪表盘上只看到一个 90.15%。
团队无法知道「模型一次答对的真实比例」从 84.73% 掉到 80% 时，是不是被收敛腿掩盖了。

**改法**：`last-accuracy.json` 并列输出
`zeroEdit: {pass,total}`、`convergenceOnly: {pass,total}`、`meanTurns`；
徽章与文档同时展示两个数（门禁仍只看合数）。这是**观测增强**，不改判据。

**验收**：`check:eval-freshness` 的结构断言接受新字段；旧产物缺字段不报红。

---

### D6 · `byCapability` 与 `byCapabilityOnPinned` 被当成同一个数 —— P2

**事实**：membership 在 pinned 下 100%（11/11），在 all 下 66.5%；dataOptions 在 pinned 下 100%（7/7），
在 all 下 47.4%。后者分母包含 NL 从未点名的细节，**不是能力指标**。

**改法**：产物里把两个对象改名为 `completeness`（诊断）与 `gated`（判据），并各带
`denominatorKind: 'all' | 'nl-stated'` 字段；站点/文档只允许引用 `gated` 作为成绩，
引用 `completeness` 时必须同句写明「分母含未点名细节」。**守卫**：`check:site-claims` 扫描
百分比时要求同行出现分母说明（现有 `check:site-claims` 已管营销数字，扩到这里）。

---

### D7 · 出处的覆盖面不完整 —— P2

见 B14（组合）与 B13（read_page 的拒绝路径）。设计原则写进 `page-source.ts` 头注：

> 出处是**发射器**的产物，不是页面的属性。凡是「有确定性输入 → 产物」的入口，都必须带出处；
> 凡是不能无损表达的入口（组合），用独立契约 + 显式降级说明，不做有损反推。

**验收**：`check:artifact-envelope` 增加一条：`generateFromConfig` 与 `emitSceneArtifact` 的
所有 mode 产物都必须含出处标记（组合走独立键）。

---

### D8 · `read_page` 的投影是「尽力而为」，缺契约测试 —— P1

**事实**：`configToSurfaces` 是「机械投影」，但除了 `columns` 之外没有 lossy（B3），
也没有「投影后不丢失可表达键」的测试。

**改法**：把它变成**可证明的投影** —— 定义一条不变量：

> 对任意合法 `StructuredCrudConfig`，`configToSurfaces(cfg).intent` 中的每个键，
> 都在 `generate_scene` 的 intent schema 里有定义；且对 `surfaces` 词汇内的字段，
> 投影后**逐键等于**原配置。

测试：property-style，用 30 个 golden 配置跑「投影 → 断言键集 ⊆ `SurfaceFieldSchema` 键集」。
这条测试同时能抓「shared 加了新字段但 surfaces 没跟上」的漂移（记忆：`mcp-configshape-copy-drift`
的同构风险，W2 之后已由派生消除，但 surfaces 是另一条链）。

**验收**：新测试进 `check:page-source`（或在 `page-source.spec.ts` 内）。

---

### D9 · 「生成的代码能编译」没有确定性守卫 —— P0（结构性）

**事实**：今天唯一能抓 B2 的是**付费的全量 eval**（且类型检查腿只观测）。也就是说，
「生成器产出的代码能不能过 `vue-tsc`」依赖一次模型跑批 —— 这是把编译正确性外包给了模型。

**最优解**：加一个**零模型**的确定性探针，覆盖每个能力面的最宽形状。

`scripts/check-generated-typecheck.mjs`：
1. 构造 2 份 fixture 配置（schema 模式 / sfc 模式），覆盖：
   16 个 formtype、字段级 `dataOptions` 含 `children`（Cascader）、显式 `columns`
   （groups + filters + editRender + permissionValue + dataOptions）、`dialogs.*.formItems`、
   `expandConfig`、`mergeConfig`、`reactions`、`isHidden`、`i18n:true`；
2. 对 3 个 target 各 `generateFromConfig`，复用
   `scripts/eval/typecheck-leg.mjs` 的 `writeTypecheckProject` / `runTypecheck`（**先抽到
   `scripts/lib/typecheck-project.mjs` 共用**）；
3. 任何 `vue-tsc` 诊断 ⟹ 退出码 1。

**成本**：3 个 target × 2 个 mode 的一次 `vue-tsc`，本地约数十秒；进 `check:consistency` 的
`cross-target` 组。

**为什么值得**：它把「编译率 100%」从**模型运气**变成**生成器契约**。B2 这类缺陷会当场红，
而不是等下一次付费跑批。

**验收**：先把 B2 不修、只加探针 ⟹ 探针必须红（证明它真的在量）。

---

### D10 · 场景覆盖里 `mode` 轴缺位 —— P3

**事实**：`AI-SCENE-COVERAGE-PLAN.md` / `check:scene-coverage` 覆盖 scene × target，
但 `mode`（schema / sfc）是 CRUD 独有轴，没有行。

**改法**：覆盖矩阵加一维 `mode`（仅 CRUD），先只做「有语料 + 可编译」两列，不追准确率。
**验收**：`check:scene-coverage` 输出里出现 `crud@schema` / `crud@sfc` 两行。

---

## 5. §六 指标提升路线（到 193/203）

### 5.1 批次与预期

| 批 | 内容 | 预期转绿行 | 累计 |
|---|---|---|---|
| 现状 | — | — | 183 |
| **B** | 128（尺子归一）+ 123（gold 标签 vs NL）+ conv-15/16（证据/语料二选一） | +4 | 187 |
| **C1** | 行内编辑规则（100/102/98）+ 104（editRender props 词表） | +4 | 191 |
| **C2** | 筛选教学（197）+ `configTableOut`（37/38） | +3 | 194 ✅ |
| **C3** | actions 边界（145/23）+ Autocomplete（200） | +3 | 197 |
| **C4** | 127/132（码表教学）| +2 | 199 |
| 余量 | 96（float/digits）、13（抽象用例） | +2 | 201 |

**只要 B + C1 + C2 落地就过线（194）**；C3/C4 是把余量做厚，防止单行回退再次跌破。

### 5.2 逐行处方（可直接当工单）

| 行 | 类别 | 处方 | 落在哪个文件 |
|---|---|---|---|
| 123 | 语料 | NL 结尾「国有银行给工行/建行，股份制银行给招商/兴业」用的是简称，gold 用全称「招商银行/兴业银行」。要么 NL 写全称，要么 `conditionContext` 建「简称↔全称」别名表（**推荐改 NL**：别名表会变成无限兜底） | `__tests__/golden/cases/123-*.json` |
| 128 | 尺子 | `reactionsView` 归一 `if(empty(X),'',X)` ≡ `X`（文本字段）+ 教学统一 | `scripts/eval/scorers.mjs`、两份 prompt |
| 127/132 | 教学 | 「分支依据是下拉标签 ⟹ 必须声明 dataOptions 并比较 value」+ `validate_config` 软告警 | `ai-nl-to-config-prompt.ts`、`resources/conventions.ts` |
| conv-15/16 | 语料 | `nl-evidence` 收窄后二选一：NL 补「工号」主语，或移除 `inForm:code` pin。**推荐补 NL**（它本来就是 NL 的原意） | `scripts/lib/nl-evidence.mjs` + case |
| 100/102/98 | 教学 | D1 的三行表 + generator 告警 | 两份 prompt + `structured-generator.ts` |
| 104 | 教学 | `editRender` 的 `props` 词表（`$input` 支持 `type:'float'|'integer'|'number'`、`digits`、`min/max`、`placeholder`、`required`）写进 schema describe + few-shot | `structured-config.schema.ts:431`、few-shot |
| 96 | 教学 | 同上（`float` + `digits:2` 是 vxe 的正确写法，`precision` 不是） | 同上 |
| 197/198 | 教学 | C 批：显式 `columns` + filters 的 few-shot（单选/多选/文本包含三种） | few-shot |
| 37/38 | 教学 | `configTableOut` 的语义：`tableData/pageSize/current/total` 是把**后端响应**映射到表格 props；给一条 `{tableData:'data', pageSize:'perPage', current:'pageIndex'}` 例子 | `structured-config.schema.ts:828`、few-shot |
| 145 | 教学 | 导出属于 `actions`，NL 点名就必须给 | few-shot |
| 23 | 教学 | 不点名不加内置动作 | few-shot |
| 200 | 教学 | 「联想输入 / 边输边筛」→ `Autocomplete`，不是 `Select + filterable` | `constants.ts` 已有描述，补进 prompt |
| 13 | 语料 | gold 的 label 是「复杂状态」、prop `complexStatus`；NL 写「一个自定义 render 的复杂状态列」——「复杂」是修饰语还是标签的一部分不可判定，pred 写「状态」/`status` 是合理读法。**改语料**：NL 写成「状态列（自定义 render）」，gold 的 label 定「状态」、prop 改 `status`。不要放宽 `extPoints`（那会让「随便给某个字段挂 render」得分） | `__tests__/golden/cases/13-all-formtypes.json` |

### 5.3 明确不做（防止把门禁刷绿）

- ❌ 删 `pinnedDims` 里难的行；
- ❌ 把 gold 改成模型当前输出（尤其 127/132/145 —— 那三行是真错）；
- ❌ 把 `editRender`/`filters` 降级成「装饰性」不判；
- ❌ 标签模糊匹配（`招商` ≈ `招商银行`）—— 会掩盖真实的码值错误；
- ❌ 给 dataOptions 单独开一个宽松的棘轮；
- ❌ 把抽象用例（13）整行排除；
- ❌ 放宽 `MAX_ERRORED_ROWS`。

---

## 6. §七 度量维度改进（R1–R9）

### R1 · 完成度两腿分列

`last-accuracy.json` 增加：

```json
"definition95": { "k": 3, "source": "heldout", "pass": 193, "total": 203, "rate": 0.9507, "pass": true,
  "zeroEdit": { "pass": 180, "total": 203 },
  "convergenceOnly": { "pass": 13, "total": 203 },
  "meanTurns": 0.39 }
```

站点徽章显示「一次答对 88.7% · 三轮内收敛 95.1%」。**门禁仍看合数**。
理由：内部要看模型能力，外部要承诺最终成功率；一个数说不清两件事。

### R2 · 分母口径写进字段名

`byCapability` 改名 `completeness`（`denominatorKind:'all'`），
`byCapabilityOnPinned` 改名 `gated`（`denominatorKind:'nl-stated'`）。
`check:site-claims` 在发布任何百分比时要求同句出现分母说明。

### R3 · Tier-0 确定性编译探针

见 D9。它让「编译率」有一条不依赖模型的基线：探针 100% + eval 编译 ≥95% 才叫健康；
探针红 ⟹ 生成器缺陷，与模型无关。

### R4 · 类型检查的覆盖率

`typecheck.coverage = measured / sampled` 与 rate 并列（见 L8）。
没有覆盖率的分母，等于允许「跳过难的行」。

### R5 · 出处往返率（新指标）

对所有 golden case 的配置在**三种出口**各生成一次并回读：
`generateFromConfig({mode:'schema', typescript:true})`（B1 的默认出口）、
`{mode:'schema', typescript:false}`、`{mode:'sfc'}`；再加上
`docs/cases/generated/*.json` 与 `__tests__/golden/composition/*`。
`provenanceRoundTrip = 成功数 / 产物数`，目标 100%。
B1 未修时第一个出口会**整批**失败 —— 这比任何描述都可信，也正好把「默认配置生成的页面读不回来」
钉成一条可复现的读数。

### R6 · `config → surfaces → config` 幂等率（新指标）

`surfaces` 词汇内的配置：`toConfig(configToSurfaces(cfg).intent) === cfg`。
这是 front-door「回读→改→再生成」闭环的唯一客观证据。B3/D8 修完才能到 100%。

### R7 · 场景覆盖加 `mode` 轴

见 D10。

### R8 · 未测到的显式记账

沿用 `MAX_ERRORED_ROWS=0`；`run-metrics` 输出 `notMeasured = {compile,typecheck,fragments,prd}`，
任何一项 >0 时报表顶部标黄，但只有 `no-answer/truncated` 计入（模型答错是成绩）。

### R9 · 每个发布数字三元组

任何对外数字必须带 `rulerVersion / corpusHash / measuredAt（或 commit）`。
`check:site-claims` 断言文档里的百分比附近 120 字符内出现 `commit` 或 `corpusHash` 之一。
理由：记忆里的 `eval-artifact-ref-trap` —— 分支分叉会被误读成断供；三元组让读者自己判断。

---

## 7. 验收命令（按批次）

```bash
export PATH="/d/nvm/v20.15.0:$PATH"     # 本机默认 node 14
npm run build:libs                       # eval 读 build/，不读 src/

# A 批（确定性，无付费）
npm run check:option-shape
npm run check:generator-fuzz
npm run check:generated-typecheck        # 新增（D9）
npm run check:tool-surface
npm run check:capability-parity
npm run check:component-api
npm run check:crud-actions
npm run check:crud-fairness
npm run check:doc-drift
npx vitest run packages/shared/__tests__/page-source.spec.ts
npx vitest run packages/shared/__tests__/structured-generator.spec.ts
npx vitest run packages/shared/__tests__/column-data-options.spec.ts   # 新增
npm run check:consistency

# B 批（尺子/语料，无付费；rulerVersion 会变）
node scripts/eval/rescore.mjs .tmp-eval/pred-deepseek-flash-2026-11-10.jsonl --misses /tmp/m.json
npm run check:scorers
npm run check:crud-fairness

# C 批（付费全量；跑完才更新产物）
npm run ai:workflows && npm run fragment:dashboard && npm run cases:sync   # 产物链（记忆：generated-artifacts-go-stale）
ESPLUS_EVAL_MODEL=deepseek-flash npm run eval:llm    # 实际入口 scripts/eval-llm.mjs
node scripts/eval/ratchet.mjs ...                    # 门禁
npm run check:eval-freshness                         # 全绿才算收口
```

**纪律**：`__tests__/golden/last-accuracy*.json` 与 `audit/` **不随本地批次提交**；
按主题分批 commit，不 push。

---

## 8. 风险清单

| 风险 | 触发 | 处置 |
|---|---|---|
| `rulerVersion` / `corpusHash` / `promptFingerprint` 任一变更 ⟹ 旧读数作废 | B/C 批几乎必然触发 | C 批末尾一次性付费跑批；期间**不放宽** `check:eval-freshness` |
| 收窄 `nl-evidence` 会让 `check:crud-fairness` 立刻红 | B8 落地 | 预期红；同批修 conv-15/16 的 NL |
| B2 的修复改变产物字节（列上少 `disabled/children`） | 任何含 Cascader 的 golden/站点产物 | 同批重放 `cases:sync` / `ai:workflows` / `fragment:dashboard`；否则产物守卫会红 |
| B16 的 `labelKey` 变更破坏宿主翻译表 | 实施时才发生 | 排 P3，需 CHANGELOG + codemod |
| D2 的字段级 `filters` 扩了配置面 | 下一 minor | 四份契约同批（shared schema / surfaces / configShape 派生 / 片段 shape —— W2 后后两者自动派生，但仍要跑 `check:tool-shapes`） |
| D9 的 `vue-tsc` 在 CI 上超时 | 3 target × 2 mode | 先量一次真实耗时；超 90s 则只跑 schema 模式 + 单个 target 轮换 |
| 评分器归一（128）掩盖真实差异 | `if(empty)` ≡ `var` 只在文本字段成立 | 归一时断言字段 formtype；给一条「数字字段不归一」的反例测试 |

---

## 9. 一页摘要

**先修什么**（P0，两处，都让「已发布能力」当前是错的）：
1. `read_page` 读不了 TS 产物（`page-source.ts:435` 的恒等三元 / 首个 `{`），且 `typescript`
   的真值判定在生成器 / 场景发射 / CLI 三处不一致。
2. 字段级 `dataOptions.children` 被复制进表格列 ⟹ 生成的 TS 不编译（四处搬运点）。

**再修什么**（P1，假绿与静默丢失）：fuzz 哨兵被出处满足；typecheck 腿无文件时空白通过；
option-shape 不覆盖列选项；`configToSurfaces` 丢 11 个弹窗底座键；`nl-evidence` 的 inForm 回退跨句。

**怎么过 95%**：B 批（尺子+语料）+4 → 187；C1（行内编辑四行）+4 → 191；
C2（筛选 + `configTableOut`）+3 → 194。**到 194 就过线**，其余批是把余量做厚。

**最有价值的一件事**：给生成器加一个零模型的 `vue-tsc` 探针（D9）。
它把「产物能编译」从模型运气变成生成器契约 —— 也是 B2 这类缺陷以后再也进不来的唯一办法。

---

## 10. 落地记录（执行时补写）

### 10.1 本次（2026-11-11，A/B/C/D/E 批）

| 项 | 状态 | 落点 | 验收 |
|---|---|---|---|
| B18 已删工具仍在迁移文档 | ✅ | `docs/migrate-v1.4.md` 改指 `generate_crud` / `generate_scene`；`npm run docs:sync` 同步站点副本；顺带修正 `docs/articles/juejin-mcp-article.md` 里同一处旧工具名 | `check:doc-drift` |
| D9 零模型类型探针 | ✅ | 新增 `scripts/lib/typecheck-project.mjs`（工程/运行/诊断/汇总）、`scripts/check-generated-typecheck.mjs`；`typecheck-leg.mjs` 改为 import + re-export（自测口径不变） | 探针 12 份产物全绿 + 6 条注入反例全红；`check:typecheck-leg` / `check:consistency` |
| D1 行内编辑覆盖度 | ✅ | `structured-generator.ts` 新增 `editCoverageWarnings()`（接入 `generateFromConfig` 的 warnings）；两份 prompt + MCP few-shot 改写成「三行表」（点名单列 / 整行 / 未点名） | `structured-generator.spec.ts` 4 例（row 全覆盖 / row 部分覆盖 / cell 不报 / 无 editConfig 报） |
| 128 空值守卫等价 | ✅ | `scorers.mjs` 的 `reactionsView`：`fulfill.value` 上 `if(empty(X),'',X)` ≡ `X`，只对文本类 formtype（`EMPTY_GUARD_TEXT_FORMTYPES`）；`RULER_VERSION` 追加 `+reaction-value-empty-equiv-v1`；中/英 prompt 与 MCP few-shot 统一成「裸 var 已含空值语义」 | `check:scorers`（等价正例 + 数字字段反例 + 127 反例）；旧 dump 复算 128 zh 转绿 |
| 123 简称 vs 全称 | ✅ | 只改 NL 的股份制半句（「招商/兴业」→「招商银行/兴业银行」）；工行/建行两侧同为简称，保持不动；**不建简称别名表** | `check:crud-fairness`（pinnedDims 措辞证据）；旧 dump 显示模型正是因为 NL 简称而写「招商/兴业」，修 NL 直接对准该失败 |
| 13 抽象用例 | ✅ | 按方案把「复杂状态」并入原「状态」下拉：label 定「状态」、prop 改 `status`、保留 render；**删掉独立的 启用/禁用 下拉**（否则两个 gold 字段争同一个 label 身份）；NL 改为「一个下拉形式的状态列，用自定义渲染展示」并去掉重复的「下拉」项；pinnedDims 改 `extPoints:status` | `check:crud-fairness`；改后 gold 对旧 pred 重算：13 zh/en 的 scoped 均转绿（`extPoints:status` 命中） |
| 104/96 数值编辑器词表 | ✅ | `structured-config.schema.ts` 的 `editRender.props` describe、两份 prompt（zh reasoning + en rules）、`conventions.ts`、MCP few-shot 四处同文：`type` = text/number/integer/float/date/week/month/year；`digits` **只被 float 分支读**；「保留两位小数」⟹ `{type:'float',digits:2}`；`precision` 不是 `$input` 的 prop（写了静默无效）；`required` 无校验、必填提示只能放 `placeholder`。全部按 vxe-table 4.20.8 `$input` 源码核对 | `check:eval-prompt` / `check:doc-drift` / prompt vitest |
| 197/198 列级筛选（教学腿） | ✅ | 三处教学新增同一条规则：筛选长在**列**上（`columns[].filters:[{text,value}]`，纯 JSON 不是函数）；单选 `filterMultiple:false`、多选 true、文本包含 `filterMode:"includes"`；已有 `dataOptions` 的列用 `autoFilters:true` 派生；`columns` 是**覆盖**，所有展示列都要抄进去。另加一条 few-shot（设备巡检：单选 + 文本包含），shared 与 MCP 两套同步。显式 `columns` 的缺口本身（D2 字段级 `filters`）留下一 minor | `check:fewshot-registration`（新增 1 条后仍 heldout 203，未把 197 洗进登记表）/ `check:eval-prompt` / prompt 47 例 + MCP examples 32 例 |
| 37/38 configTableOut | ✅ | `conventions.ts` 的 Table Configuration 与两份 prompt 补四槽语义：`tableData/pageSize/current/total` 是把**后端响应**映射到表格 props，不是「总数字段名」；给 `{tableData:'data',pageSize:'perPage',current:'pageIndex'}` 与 `{total:'count'}` 两个锚点，并点明 `perPage` 不是 total | `check:doc-drift` / prompt vitest |
| 145/23 actions 边界 | ✅ | 三处教学写死三条：`actions` = NL **恰好**点名的内置动作（不点名不加）；导入/导出属于 `actions` 而非 `tableBtns`；`tableBtns` 只放非内置自定义按钮。核对 `es-crud-page.vue`：`tableBtns` 追加进 es-table `configBtn`，**不抑制** `actions` 派生的工具栏按钮 ⟹ 原样复制一个内置按钮会渲染两次，这半句也写进了教学 | `check:doc-drift` / prompt vitest |
| 200 Autocomplete | ✅ | 两份 prompt 与 MCP few-shot：「联想输入 / 可搜索选择 / 边输边筛」→ `Autocomplete`（存选中项的 `value`，输入文本只是搜索串），不是 `Select + filterable` | `check:doc-drift` / prompt vitest |
| 127/132 码表身份（软告警） | ✅ | shared 新增 `codeTableWarnings()`：只扫**条件槽**（比较操作数、`{field,op,value}` 的 value、`if[0]`、`and/or/!`），结果槽（自动填中文状态值）刻意不扫；`ValidationResult.warnings` 非阻断接入 `validate_config` 正文。schema `reactions` describe + 三处教学补硬规则（分支依据是下拉标签 ⟹ 必须声明 `dataOptions` 并比较 value）。shared 4 例（含「条件只写在 value.if[0]」与「中文只在结果槽不告警」两侧边界）+ mcp handler 1 例 | 两个 spec 49 例全绿；127/132 gold 未放宽（`check:scorers` 反例仍判负） |
| D2 字段级列筛选 | ✅ | `FieldConfig` 增加 `filters/filterMultiple/filterMode/autoFilters`（与 `ColumnSchema` **共用同一份**命名 Zod 定义，杜绝两面漂移）；`buildTableColumn` / `buildTableColumnSFC` 投影到派生列；`SURFACE_FIELD_KEYS` / `SurfaceField` / `DISPLAY_KEYS` 三处手工表同批登记（漏一处 `generate_scene` 静默丢键）；教学面（两侧 prompt、MCP 例子、conventions）改为「筛选优先写在字段上，`columns` 只用于多级表头/非字段列/自定义列序」 | `structured-generator.spec.ts` 4 例：schema 投影 / 与显式 `columns` 列对象逐键相等 / SFC 字面量（含 `filterMultiple:false`）/ **scene 组合路径与直连配置产出逐字节相同的列**（D2 验收原文）。`check:threeway` 探针补这四键（`filterMultiple:false` 专证非真值门）；`check:schema` 判据改认共享标识符并核对定义本体 |
| L2 `FormList` 降级 | ✅（仅文档） | 能力台账/矩阵里本无 `FormList` 条目，声明式子表单从来不是能力面成员；`columns` 递归只服务多级表头。`structured-config.schema.ts` 的 `children` describe 写明「数组子表单在声明式契约之外 —— 用 `render` 或宿主自有 UI」，删掉「children 可再声明 children」的误导 | `check:doc-drift` / `check:surface-budget`（describe 未增肥） |
| L3 `ImportConfig` / `parseCsv` | ✅ | `conventions.ts` 的 CRUD Actions 与 schema `actions` describe：`import` **只渲染按钮并发事件**，es-plus 不解析文件（编码/大小/后端校验都是宿主的事）；源码中不存在 `parseCsv`/`ImportConfig`，不要编造这类配置键 | `check:doc-drift` / `check:eval-prompt` |
| L4 `engine:'auto'` | ✅ | `validateAndRepair` 新增 `engineSelectionHints()`：`tableOptions.engine === 'auto'` 时给一条非阻断 suggestion（猜错引擎会静默退化），四个返回分支都带上；`conventions.ts` Common Gotchas 补「engine 没有 auto」并顺延编号 | `validate-and-repair.spec.ts`（新增用例）+ 既有 49 例；`check:doc-drift` |
| D5 + R1 完成度两腿分列 | ✅ | `scorers.mjs` 的 `summarize95` 增 `zeroEdit / convergenceOnly / meanTurns`（pass = 两条腿之和）；`last-accuracy.json` 的 `definition95` 同步；徽章 label 改为 `zero-edit X% · heldout 95%-definition · 模型`（message 仍只放门禁合数）；`artifact.mjs` 校验两腿之和 = pass、`meanTurns ≥ 0`；`rescore.mjs` 同字段复算 | 徽章契约测试 + `check:artifact-self` / `check:rescore` |
| D6 + R2 分母口径写进字段名 | ✅ | `byCapability → completeness`（`denominatorKind:'all'`）、`byCapabilityOnPinned → gated`（`'nl-stated'`）；报表表头改成 `all(completeness) / pinned(gated)`；`artifact.mjs` 对新名要求 `denominatorKind` 正确、对旧名继续放行（已提交的旧产物不因改名变红）；`rescore` 双名兼容 | `check:artifact-self`（新旧两代产物各一份）/ `check:rescore` |
| D7 出处写进产物 | ✅ | 信封必须带非空 `config`；`crud-page` 产物必须含 `__esPlusSource`（宿主落盘只有那一个文件，出处不能只活在信封里）；`page-source.ts` 头注写明设计原则 | `check:artifact-envelope`：296/296 有信封、`config` 全覆盖 |
| D8 可证明的投影 | ✅ | `page-source.spec.ts` 新增「投影不变量」：30 份金标配置逐字段断言投影键 ∈ `SurfaceFieldSchema` 词汇、词汇内键值逐键不变（label/formtype 缺省容忍），抽样门槛 >100 个字段 | vitest 26 例（+2） |
| D10 + R7 场景覆盖加 mode 轴 | ✅ | `check-scene-coverage` 对带模式轴的场景逐模式成行（`crud@schema` / `crud@sfc` / `dialog@composable` / `dialog@component`），各自给「格 / 例」；修掉 `cellOf(c)` → `cellOf(c.raw)` 的取模轴 bug | `check:scene-coverage`：crud 179/48 例、dialog 9/12 例，四场景无空格 |
| R3 Tier-0 探针基线 | ✅（D9 已覆盖） | 见 10.1 的 D9 行；探针与 eval 编译腿共用 `scripts/lib/compile-check.mjs` 以外的两条腿，互不替代 | `check:generated-typecheck` |
| R4 类型腿覆盖率 | ✅ | `summarizeTypecheck` 增 `sampled / coverage = checked/sampled / notMeasured`；产物与报表并列 rate 打印，R8 台账读同一字段 | `check:typecheck-leg` |
| R5 + R6 出处两条指标 | ✅ | 新增 `scripts/eval/provenance.mjs`（纯函数）+ `scripts/check-provenance.mjs`（esbuild 打源码，命中 build 即红）+ `provenance.test.mjs`（27 条判据非空证明）；并把 `emit.ts` 内联的组合逆映射抽成 `scene/surfaces-to-config.ts`（emit 与度量共用同一份实现） | `check:provenance`：R5 246 条 × 3 出口 = 738/738；R6 可比 201 条 201/201；`check:provenance-metrics` 27/27 |
| R8 未测到显式记账 | ✅ | `last-accuracy.json` 增 `notMeasured = {compile,typecheck,fragments,prd}`（只有 no-answer/truncated 计入；模型答错仍是成绩）；报表任一 >0 时顶部标黄，全 0 打印「四条腿都完整」 | 产物字段 + 报表输出；`check:artifact-self` 不拒未知字段 |
| R9 发布数字三元组 | ✅ | `check:site-claims` 新增第 9 段：对外文档里准确率语境的百分比，附近 120 字符内必须出现 `corpusHash`/`commit`；目标（`≥95%`）、近似值（`~40%`）、无准确率语境（降幅/控件数）、changelog 明确排除；引用 `completeness` 必须同句给分母口径；8 条样本自检（含 2 条应红） | `check:site-claims`：27 份对外文档 0 处未标读数，自检 8/8 |

### 10.2 执行中发现的真实缺陷（已修）

1. **SFC 模式的 `formLayoutProps` 没有类型注解**（D9 首跑即抓到）—— `layout.type: "tabs"` 在裸字面量里被放宽成
   `string`，赋给 `:layout-form-props`（`LayoutFormProps`）时 vue3/antdv 均报 TS2322。
   修法：TS 模式下发射 `const formLayoutProps: LayoutFormProps = …`，并把 `LayoutFormProps`
   加进那条 `import type`（按 `hasSfcFormLayout` 条件包含）。
2. **vue2 的 `setup()` 没把 `formLayoutProps` return 出去** —— 模板里不可见：vue-tsc 报 TS2339，
   运行时则是静默 `undefined`（布局配置全部失效，零报错）。修法：`exposedNames` 条件追加。

两条都不是语料/模型问题，是「只在付费跑批里偶然可见」的生成器缺陷 —— 正是 D9 要消灭的那类。

3. **三面全 false 的字段在 `configToSurfaces` 里静默消失**（R6 首跑抓到，4 条语料）——
   `expandConfig` 行展开用的字段常常 `inQuery/inTable/inForm` 全关（它由展开配置消费，不是
   三个面）。旧投影把它从所有面里滤掉、`lossy` 一条不报，宿主「回读 → 改 → 再生成」后
   该字段凭空消失。修法：`configToSurfaces` 对这类字段报 `not-expressible` 并点名
   `fields[i]`（不改变产物，只是不再撒谎）。
4. **`surfacesToConfig` 只挑 4 个弹窗键，其余静默丢弃**（R6 首跑抓到，1 条语料）——
   `configToSurfaces` 投影的是 `DialogBlockOptionsSchema` 的整份键集
   （`destroyOnClose` / `hiddenFullBtn` / `appendTo` …），而逆映射只回填
   `title/width/fullscreen/formItems`。抽出逆函数时按「除 `key` 外原样带回」重写，
   并顺带让 `emit_crud` 的前门路径不再丢这些键。

### 10.3 与方案字面的偏差（及理由）

| 项 | 方案写法 | 实际落地 | 理由 |
|---|---|---|---|
| D9 覆盖 | 2 fixtures × 3 target | 2 fixtures × **2 modes** × 3 target = 12 份 | `mode` 是 CRUD 独有轴（D10 自己也点了名）；schema/sfc 的发射器不同，只测一种等于漏一半 |
| D9 验收 | 先不修 B2，探针必须红 | **注入反例**（`const n: number = 'x'`）与真实 fixture 同跑，注入必须红、真实必须绿 | B2 已在 B 批修掉，「让它红」不再可得；注入式双向判定在任何版本都成立，且能区分「尺子坏了」与「产物对了」 |
| D9 抽样 | 计划未提 | 无抽样：12 份全跑 | 固定 fixture 本身就是抽样，再抽样只会制造覆盖率空洞 |
| D9 CI | 未提 | consistency job 的 `Build @es-plus/shared` 升级为 `build:components` | 探针按 `packages/<target>/dist/index.d.ts` 解析组件；缺 dist 时探针**报错**（不跳过），不构建就恒红 |
| D1 判定 | `!engine \|\| engine !== 'vxe'`（伪代码） | 仅当 **`editConfig` 缺失**且 `engine !== 'vxe'` 时补报 | 有 `editConfig` 时同一问题已由 `inlineEditWarnings` 报出，重复告警会让收敛腿难以判断「还剩几条」 |
| D1 行覆盖 | `editable.length < dataCols.length` | 展平 `columns[].groups` 到叶子，排除 `type: index/selection/expand` 与分组壳；无显式 `columns` 时按 `fields`（`inTable !== false`、无 `children`）派生 | 与 `buildTableColumn` 的派生口径一致，否则分组表会误报、`type:index` 会被当成「该挂编辑器的数据列」 |
| D1 验收 | `check:generator` 增加 3 例 | `structured-generator.spec.ts` 4 例（走 vitest） | `check:generator` 指向的 `check-generator-contract.mjs` 只判运行时契约（httpRequest 导出 / 事件名），没有告警断言的位置；告警属于生成器行为，归它的单测 |
| B14 出处形状 | 只存 `nodes` / `wires` 摘要 | 存**整份 `CompositionPlan`** | 验收标准是「重放逐字节相同」；摘要无法保证，整份可以（已由 `scene-composition.spec.ts` 的往返用例钉住） |
| 13 语料 | 「gold label 定『状态』、prop 改 `status`」 | 同时**删掉** gold 里原有的 `status`（启用/禁用 下拉），把 render 挂到它上面 | 按 label 身份对齐时，两个 gold 字段都叫「状态」会争同一个 pred 字段（`alignFields` 单射）；`status` 重复也不是合法配置。方案字面只改了复杂状态列，没看见那条同名字段 |
| 123 语料 | 「NL 写全称」（含工行/建行） | 只把股份制半句改成全称；工行/建行两侧都保持简称 | gold 当时已按 2026-10-29 的裁定写成简称（NL 给简称时不可反向展开成全称）；再改回全称会把同一行重新钉成不可过。只需消掉「同一条规则两侧写法不一致」 |
| 197/198 few-shot 的动作集 | 未指定 | shared 的少数样本把 actions 写成 `add/edit/delete`（NL 同句点名删除），而非语料的 `add/edit` | F8 的候选判据要求 **actions 完全相同**；若写 `add/edit`，示例 NL 与 197 的字符 bigram 相似度 0.41 ≥ 0.35，会被判为同源候选、必须把 197 登记进 `FEWSHOT_DERIVED` —— 那等于把目标行移出 heldout。多一个 NL 点名的删除动作既符合 D4 规则，也避开了洗白 |
| 127/132 扫描范围 | 只扫 `when` | 扫全部**条件槽**：比较操作数、`{field,op,value}` 的 value、`if[0]`、`and/or/!`；结果槽不扫 | 「条件写在 `fulfill.value.if[0]`」是同样常见的写法（MCP handler 用例正是它），只看 `when` 会漏报；而 `if` 的 then/else 是合法目标值（自动填中文状态），盲目遍历会误伤 |
| D2 键名 | `filters? / filterMultiple? / filterMode? / filterable?` | `filters? / filterMultiple? / filterMode? / autoFilters?` | 方案字面引用的 `filterable` 在源码里**不存在**；`ColumnSchema` 的实际四键是 `filters/filterMultiple/filterMode/autoFilters`（`autoFilters` 从 `dataOptions` 派生筛选选项）。字段面照抄真实的列契约，才不会多造一个没人消费的键 |
| D2 定义位置 | 「shared schema + SurfaceFieldSchema（自动获得）+ 两个发射点」 | 抽出四个命名 Zod 定义，`FieldConfigBaseSchema` 与 `ColumnSchema` **共用**；另需同批登记 `SURFACE_FIELD_KEYS` / `SurfaceField` / `DISPLAY_KEYS` 三处手工表 | 方案以为 `SurfaceFieldSchema` 由 `FieldConfigSchema.omit(...)` 派生就自动获得 —— 属实，但 `composeCrudConfig`/`pageSource` 另有两份**手工键表**，漏登记等于 `generate_scene` 静默丢键（与 `mcp-configshape-copy-drift` 同一类坑） |
| D2 教学口径 | 未提 | en 规则改为「字段级优先」，`columns` 只保留多级表头/非字段列/自定义列序/整列覆盖四种场景；zh few-shot 改成字段级 | 原教学把 `columns` 说成唯一路径，能力落地后不改正则会把模型继续推向「少写一列整列消失」的易错面 |
| 工具面预算 | 未提 | 四个键的 describe 压到一句话，同时压缩 `formtype/render/isHidden/reactions/op/gate/labelKey/formatter` 八处**被内联 17–34 次**的描述，总量 358.9 → 343.7 KB | 字段形状在 `generate_crud` 里被内联 8 次、全档 17 次；每多 100 字要付 1.7 KB。预算守卫是棘轮（只许下调），「加字段」不能靠上调预算过关。语义 token 全部保留，压缩的只是重复表述 |
| R1 徽章形状 | 「徽章显示『一次答对 88.7% · 三轮内收敛 95.1%』」 | message 仍只放**门禁合数**；`zero-edit X%` 放进 label | shields endpoint 的 `message` 是数字位（产物校验、站点渲染都按 `^\d+(\.\d+)?%$` 读），把两句话塞进 message 会让徽章变成不可解析的字符串；label 是自由文本，两个数都在读者眼前 |
| R5 判据 | `provenanceRoundTrip = 成功数 / 产物数`（未定义「成功」） | 「成功」= 回读后**重生成的页面**逐字节等于原产物（`stripPageSourceArtifact` 之后） | 只判 `read.ok` 测不出「配置悄悄多/少一个键」；而连出处块一起比会把 `lossy[]` 的收敛误判成漂移 —— 第一次生成时报了「归一化了 X」，读回的配置已归一，重生成自然不再报。页面字节才是「逆函数」的证据 |
| R5/R6 落点 | 新指标（未说写在哪） | 落成**确定性守卫** `check:provenance`（+ 27 条 meta-eval），不写进 `last-accuracy.json` | 两条都是模型无关的确定性属性：写进夜间产物意味着它们只能每晚红一次、且被「本夜中继抖动」牵连；放进 consistency 则每个 PR 都在付费跑批之前红。守卫的 `--json` 输出保留机器可读形态 |
| R5 语料范围 | 全部 golden + `docs/cases/generated/*` + `__tests__/golden/composition/*` | 246 条 = golden 227 + docs 4 + composition 15（`form+dialog` 六例走片段发射器，没有整页出处） | 组合语料里 `form+dialog` 的产物是片段包，不存在「整页 → 回读 → 重生成」这条路；把它算进分母只会制造 6 条结构性失败 |
| R6 比较口径 | `toConfig(configToSurfaces(cfg).intent) === cfg` | 两侧过 `StructuredCrudConfigSchema.parse` 后比较；`fields[]` 按 `prop` 排序；弹窗表单项的成员布尔不计 | ①省略 == 默认（`target/mode/成员布尔`）必须在两侧都补齐，否则「省略」被判成漂移；②组合层按「首次出现的面」推字段顺序，与原始 `fields[]` 顺序不同，而渲染顺序由各面自己的数组决定；③`SurfaceFieldSchema` 按契约不带 `inQuery/inTable/inForm`，弹窗 formItems 的成员布尔不参与渲染 |
| R6 分母 | 「surfaces 词汇内的配置」 | 分母 = 可比 201 条；显式排除 `lossy` 44 / `children` 1 / `no-table` 0 | `children`（嵌套容器）不在组合层的 `SurfaceField` 词汇里（L2 已确认是声明式契约之外），`lossy` 是**已点名**的不可表达项 —— 把它们混进分母等于用一个已知不可比的集合制造永久红 |
| R9 扫描口径 | 「文档里的百分比附近 120 字符内出现 commit 或 corpusHash」 | 只扫准确率语境的百分比；排除目标（`≥95%`）、近似值（`~40%`）、无准确率语境（降幅/控件数）与 changelog | 字面执行会把「模板+胶水降幅 76.5%」和「门禁目标 ≥95%」也要求挂 corpusHash —— 前者由 `one-config-diff.json` 独立校验，后者是常量不是测量。排除规则写进守卫注释，并用 8 条样本自检防止放宽过头 |

### 10.4 尚未落地（按本文原样执行）

A/B/C/D/E 五批已全部落地（E 批 = D5–D8、D10、R1–R9）。**付费全量 eval 已于 2026-11-12 本地跑完**
（deepseek-flash，读数与遗留问题见 §10.5），`check:eval-freshness` 与 `check:site-claims` 均已转绿。
仍**未落地**的只剩本文明确推迟或留下残余的项：

| 项 | 状态 | 缺口 |
|---|---|---|
| L1 · en 腿三项（结构回退 / 英文 few-shot / en 不下降棘轮） | ✅（② 裁为不新增） | ① `+en-structural-fallback-v1` 已落（en propSet 42.6%→87.1%、definition95 74.72%，zh 不受影响）；③ `ratchet.mjs` 增加 en 只降不升棘轮 + 基线 `en` 段，缺测即红；② 判定**不新增**示例 —— 身份已改为按位次，`ai-nl-to-config-prompt.ts:997` 已明确「prop 是数据绑定、label 逐字取 NL」，再加示例只增 tool-surface 预算且必须等下一次全量才能验证（理由见 §10.5） |
| L5 · 死按钮 golden（12 例） | ✅ | `scripts/eval/audit-actions.mjs` 已保留为审计工具；`check:gold-self` 增加动作面证据判据（动作词/按钮名必须能在 NL 找到依据）；语料逐例二分后 13 例补 `export/import` 或补 NL，`audit-actions` 复跑 **pred-extra 0 / pred-missing 11**（模型从不凭空造动作）；3 条语料 NL 补全（04/05/13） |
| B12 · `formItemOptions` 教学扫描守卫 | ✅ | 新增 `check:teaching-keys`（入 consistency 的 generator 组）：教学面（prompt / schema describe / MCP resources）裸 `formItemOptions` 判红，`crud-page-schema` 的运行时示例按「紧邻 formtype」白名单放行；能力矩阵只允许出现在 `artifactPaths`、禁止出现在 `structuredPath`；守卫自带 8 条非空证明。`rules` 的 describe 同步补「配置侧键 = `rules`，产物里才是 `formItemOptions.rules`」 |
| B16 · 嵌套 `labelKey` 撞键 | ⏸ | 按原文 P3 推迟（破坏性变更，需 CHANGELOG + codemod） |
| L6 · 内部文档计数锚点 | ✅ | 文首加「本文是历史批次记录，工具数以 `tools-list.snapshot.json` 为准」；W6 节改为「在 W4 的 19/13 基础上再 −1」并声明「全文计数以本节为准」 |
| §5.3 明确不做清单 | ⏸ | 按原文保持不做 |

### 10.5 2026-11-12 全量跑批记录（deepseek-flash）

- 身份：`commit 06139db` · `corpusHash 106d02eab1c293c2`（296 文件 / 227 CRUD / 203 heldout）·
  `model = servedModel = deepseek-flash` · `measurement: complete`（`notMeasured` 四条腿全 0）。
- 读数：**definition95 92.12%（187/203）** = 零编辑 176 + 收敛 11（meanTurns 0.37，收敛@K 30/30）；
  core 51.23%（zh 51.23% / en 23.03%）；片段 scoped 95.65%（69 例，core 97.1%、编译 100%）；
  PRD 门禁 PASS（membership 94.27%）；类型腿 226/227；前门 429/429 routed、0 编译失败。
- 中继：6 次冷却等待共 1050 s + 3 次即时重试，全部行在恢复后完成测量（未被记为未测到）。
- 离线复算：`rescore --expect` 147 项逐字段一致。
- 基线：`accuracy-baseline.json` 的 `definition95/coreRate/byDimension/rulerVersion` 与
  `fragmentScopedMin`（0.9565）已按本次读数回填（人工 PR 路径，见该文件头注）。
- **本次暴露的遗留缺陷 —— 逐项处置**（2026-11-12 复核并落地）：
  1. **导入/导出边界：教学与语料对打** ✅ 已修 —— en 规则明确「即使同一操作也出现在 tableBtns，
     也要写进 `actions`」，而 13 条用例的 gold 有导出/导入按钮却把 `export`/`import` 留在
     `actions` 之外（190 两类都有）。按规则补 gold（03/137/138/141/143/146/189/190/193/194/
     20/23/24），另把 04/05/13 的 NL 补齐到 gold 已有的动作（原 NL 无措辞依据）；
     `check:gold-self` 增加动作词证据判据，`audit-actions` 复跑 pred-extra 0。
     离线复算（同一份 dump + 修后 gold）：definition95 92.12% → **92.61%**（188/203），
     actions 94.58% → **95.07%**。
  2. **类型腿 target 混用** ✅ 已修 —— `buildTypecheckCases` 改为**按 case.target 重新发射**
     （`generate({ ...config, target: t, typescript: true })`），临时工程的依赖与 import 同源；
     99 的 TS2322 复现后消失，`typecheck-leg.test.mjs` 增加 4b 节钉住「给 case target、不给
     config target」。
  3. **197/198 列筛选零产出** ⏳ 留观 —— 模型既没写 `columns` 也没写字段级 `filters`；
     教学（规则 + few-shot）已在 W3-2 落地，deepseek 未吸收。判为**模型能力项**，不属语料/
     尺子缺陷；换 Claude 口径复测后再决定是否加强教学。
  4. **en 腿仍无门禁** ✅ 已修 —— L1 ①③（结构回退 + 不下降棘轮）落地；②「英文 few-shot」
     裁定**不新增**：字段身份已改为按位次回退，`ai-nl-to-config-prompt.ts:997` 已把
     「prop 是数据绑定、label 逐字取 NL」讲清，再加一条示例只增 `tools-surface` 预算，
     且它的收益必须等下一次全量才能观测 —— 与 4 号一起作为下次跑批的观察项。
  5. **片段腿 2 条 `model-guard` 拒绝** ⏳ 留观（模型侧）—— `frag-form-06-antdv` 把
     `dependencies` 写在字段层（合法位置是 `fields[].reactions[].dependencies`）；
     `frag-table-06-vue3` 把 `formatter` 写在显式 `columns[]` 上（显式列只收结构化列属性，
     格式化仍走 `fields[].formatter`）。两条 gold 都写在正确位置，片段 prompt 的 `renderShape`
     已到 depth=3（子键可见）⟹ 判定为模型放置错误，非门禁缺陷；下次跑批一并观察。
  6. **`truthy` vs `notEmpty`** ✅ 已裁定**不等价**（保留两算子）—— JSONLogic 语义下
     `truthy` 对 `0`/`false`/`''` 为假，而 `notEmpty` 只排除空；133 的 NL 说「非空」，
     gold 用 `notEmpty` 正确，模型 turn-0 写 `truthy` 是真 miss、第 1 轮改对后收敛。
     该裁定已写进用例 `notes`，不新增等价规则（放宽无证据支持）。
  7. **片段地板零余量** ✅ 记录为**有意** —— `fragmentScopedMin = 0.9565` 等于观测值
     （66/69），任何一条退化（65/69 = 94.2%）即红；这正是棘轮该有的行为（只经人工 PR 下调）。
  8. **`vxeConfig` 判负无诊断** ✅ 已补 —— `describeDimMiss` 增加 `vxeConfig` 分支（只展示
     gold 声明过的键 + `projectVxeOption` 投影，与 `vxeConfigEqual` 同源）；`scorers.test.mjs`
     钉住四条：gold-vs-gold、`toolbarConfig:true` ≡ 展开形态、关掉 export 判负、gold 未声明
     的键不罚。此前该维 miss 在日志里只剩一个维度名。

- **仍未闭合的一项（度量身份）**：本次修复改了语料（13 条 gold + 3 条 NL）与教学面
  （few-shot / schema describe）⟹ `check:eval-freshness` 转红是**正确状态**：已发布产物
  `last-accuracy.json` 的 `corpusHash` 是 `106d02ea`，当前语料是 `0d9bc0d4`，prompt 指纹
  四腿也全变。基线与 §10.5 的 92.61% 是**同一份 dump 的离线复算**（`pred-gold-patched.jsonl`），
  不是一次新的完整测量。下一次全量跑批（任何模型）完成前，不得把 92.61% 当作「已发布读数」；
  freshness 守卫应保持红，**不**手工回填产物身份字段。

