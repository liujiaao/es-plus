# ES-Plus 改造设计方案

> 版本对应：vue3 1.4.2 / vue2 1.1.5 / core 1.0.1 / shared 1.1.1 / cli 1.2.1 / mcp-server 1.2.1 / adapter-antdv 1.0.0
> 基线：core 209 / shared 258 / vue3 425 / vue2 272 / antdv 466 用例全绿

---

## 0. 设计总纲

**核心原则：单一权威源（Single Source of Truth）。**

诊断结果表明，几乎所有 P0/P1 问题都指向同一个根因——**同一个逻辑在三个渲染器里被复制粘贴成三个版本，各自演化后产生了行为分叉**。因此改造主线不是"逐个打补丁"，而是：

> 把框架无关逻辑全部下沉到 `@es-plus/core`，渲染器退化为"薄适配层"，并用**契约测试**替代"人肉同步"来保证三端一致。

分四条并行轨道：

| 轨道 | 目标 | 对应问题 |
|---|---|---|
| **A. 跨渲染器一致性** | 消除三端行为分叉 | formtype / 请求层 / 跨页选择 / formatter / inject key |
| **B. 消除复制粘贴 + 类型安全** | 可持续性 | 三端重复代码、死代码、`@ts-nocheck` |
| **C. 品牌与文档统一** | 口碑 | 三站点分裂、口径互斥、治理混乱 |
| **D. 营销可信度** | 可信度 | 量化数字无实测、绝对化表述、竞品对比失真 |

---

## 1. 现状诊断（源码事实 → 根因归类）

| # | 症状 | 根因（源码证据） | 严重度 |
|---|---|---|---|
| 1 | formtype 解析三端三分叉 | vue3 `use-form-inputs.ts:293` 用 `normalizeFormType`；antdv `:429` 同；vue2 `:565-579` 手写 flip+大小写扫描，且含 vue2 独有 `InputNumber`（`:141`），不在 `VALID_FORM_TYPES` | P0 |
| 2 | 请求层 vue3 绕过 core 且行为分叉 | vue3 `use-form-request.ts:60` resolve `{data:res}`（不剥层）、`:98` 只认 `crtn` 不支持 `responseTransform`；core `request.ts:234-237` resolve `{data:res?.data}`、`:319` 用 `getCallback(...,'responseTransform')` | P0 |
| 3 | `cachePageSelection:false` 未生效 | core `table-selection.ts:73` 只看 `if(rowkey)`，不读该 flag | P1 |
| 4 | `formatter` schema 模式被静默丢弃 | `structured-generator.ts` `buildTableColumn` 不 emit `formatter`，连 TODO 都没有 | P0 |
| 5 | 联动注入 key 拼写错误 | `getTableInstantce` 固化进三端 + 测试；文档写成 `inject('EsTableContext')` 于 648 行（实际 `:222`） | P1 |
| 6 | 三端组件数千行复制粘贴已分叉 | es-table 行数 vue3=1078/antdv=1007/vue2=1448；antdv 有双份 `render-dom-tb.ts`；`calculateAutoSpan` 在 core 与 vue3 各一份 | P1 |
| 7 | 类型安全关闸 | vue3 es-form.vue:153、es-table:135、use-dialog:1 等 `@ts-nocheck` | P1 |
| 8 | schema 与运行时脱节 | `form-item.schema.json` enum 只含 13 个 PascalCase，不含 camelCase 别名，CLI `validate` 会拒绝 README 仍推荐的 `datePicker` 写法 | P1 |
| 9 | 品牌分裂 | ES-Plus / ES Plus / ES-EUI 三种拼写并存 | P0（口碑） |
| 10 | 营销数字无实测 | 70/84/85/88%、286h/358h、95%/40%/60% 互相矛盾 | P0（信任） |

---

## 2. Track A —— 跨渲染器一致性

### A1. 统一 formtype 解析为单一权威源
- 三端 `formPutList` 一律 PascalCase 键（对齐 `VALID_FORM_TYPES`）；删 vue3 死键 `datePicker`/`timePicker`。
- 三端查找入口统一 `formPutList.get(normalizeFormType(item.formtype ?? ''))`；删 vue2 自研 flip+扫描。
- 决策 `InputNumber`：推荐提升为正式第 14 种，三端都实现并同步 schema/文档。

### A2. 请求链路收敛回 core
- vue3 `use-form-request.ts` 退化为薄包装，只保留 Vue 特有 `toRaw/unref/nextTick`，逻辑委托 core。
- 以 core 为准（剥层 `res?.data` + 支持 `responseTransform`），CHANGELOG 标注行为变更。

### A3. `cachePageSelection` 语义显式化
- `applySelectionChange` 增加 `cachePageSelection` 参数，调用方从 options 读取传入。

### A4. `formatter` 在 schema 模式不丢弃
- sfc 模式内联 emit；schema 模式生成 `TODO(es-plus): formatter` 扩展点标记；golden 增加断言。

### A5. 修正 inject key 拼写
- 新增 `core/constants.ts` 的 `TABLE_CONTEXT_INJECT_KEY`；三端 + 测试一次重命名；修正文档符号名与行号。

---

## 3. Track B —— 消除复制粘贴 + 类型安全
- B1：渲染器薄化，`calculateAutoSpan` 等重复逻辑下沉 core。
- B2：删 antdv 双份 `render-dom-tb.ts`、vue3 死键、未用 import、空实现；魔法数字常量化。
- B3：移除 `@ts-nocheck`，目标 `vue-tsc --noEmit` strict 全绿。
- B4：新增跨端一致性契约测试，锁死三端 formtype/组件导出/关键行为一致。

---

## 4. Track C —— 品牌与文档统一
- C1 单一品牌 `ES-Plus`（es-eui 去 "ES-EUI"，es-pc "ES Plus"→"ES-Plus"，清旧 devDep `es-eui`）。
- C2 口径统一（控件 13 或 14、渲染器 3、组件 4+1hook）。
- C3 三站点收敛（主站修正双→三渲染器；es-eui 冻结为 Vue2 文档；es-pc 补 vxe/MCP/CLI）。
- C4 英文同步（重写 README.en）。
- C5 治理补全（发布流程二选一、SECURITY/RELEASE 补包）。

---

## 5. Track D —— 营销可信度
- D1 LLM 评估语料与 few-shot 隔离（避免"背 prompt"）。
- D2 真实数据回填（benchmark + eval-llm 实测值）。
- D3 删除"唯一/第一个"绝对化，改用可验证差异点。
- D4 修正 vxe-table 竞品对比（已内置为引擎）。

---

## 6. 分阶段计划

| 阶段 | 内容 | 验收 |
|---|---|---|
| Phase 0 | A1 + A2 + A4 | 三端一致性测试 + 单测全绿 |
| Phase 1 | A3 + A5 + B4 | 契约测试门禁化 |
| Phase 2 | C1-C5 | 全库无旧名/旧口径 |
| Phase 3 | B1-B3 | strict 全绿 |
| Phase 4 | D1-D4 | 营销数字可追溯 |
