# es-plus 能力短板技术实施方案（2026-11-09）

> 依据：[能力全量审查报告](./es-plus-capability-audit-2026-11-08.md) + 源码逐行复核  
> 基准：master f00047d（2026-11-09），模型 deepseek-flash

## 概述

本方案覆盖 P0–P2 共 13 项缺陷的修复，按"生产风险 → 覆盖度 → 工程质量"排序。每项含：问题、源码证据、实施方案、验收守卫。

---

## P0-1：15 个 vxe-only 键无引擎路由告警

**问题**：`editConfig`/`toolbarConfig`/`keyboardConfig` 等 15 个键标注为 `partial`（仅 vxe 生效），但 `capabilityWarnings()` 只拦截 `none`，`partial` 无告警；无 `engine:'auto'`。

**证据**：
- `packages/shared/src/capability.ts:348-359` — 只判 `cell.level !== 'none'`
- `packages/core/src/types.ts:1008` — 枚举只有 `'default'|'virtual'|'vxe'`
- `packages/shared/src/structured-generator.ts:698` — 只有 `editConfig` 有生成器告警

**实施方案**：

1. `CapabilityEntry` 接口新增 `requires?: { engine: 'vxe' | 'virtual' }` 字段
2. 15 个 vxe-only 条目补 `requires: { engine: 'vxe' }`
3. `capabilityWarnings()` 增加 `resolvedEngine` 参数，扩展 `partial`+`requires` 检查
4. 生成器调用点传入 `resolvedEngine`
5. ~~新增 `engine:'auto'` 枚举 + `resolveTableEngine()` 运行时路由~~
   —— 本批**未实施**：三端「vxe 是否已注册」的探测方式不同（vue3/antdv 走
   `resolveComponent('vxe-grid')`，vue2 走 `Vue.prototype.$vxe`），需要三端各一套运行时见证。
   为避免广告一个尚不存在的开关，warning 文案里已移除 `engine:'auto'` 的提法；
   需要自动选路时请显式写 `engine:'vxe'`（并确保已注册 vxe-table）。

**验收守卫**：`check:engine-warnings` — 断言含 `editConfig`+`engine:'default'` 产出 warning；含 `editConfig`+`engine:'vxe'` 零 warning。

**当前进度**：✅ capability.ts 已完成 `requires` 字段 + `capabilityWarnings` 扩展；15 个条目已补 `requires`；生成器与三端运行时告警已接线；`engine:'auto'` 延后（见上）。

---

## P0-2：antdv 大数据无预警

**问题**：antdv 无虚拟引擎，默认 a-table 5k 行首渲染 12 秒，20k 行约 510 秒；框架无主动预警。

**证据**：
- `packages/adapter-antdv/src/components/es-table/src/component.vue:414-423` — virtual 告警降级
- `docs/internal/bench-table-2026-11-08.json` — antdv 5k=12369ms, 20k=510295ms

**实施方案**：在数据写入路径加 DEV-only 一次性 warning（阈值 1000 行）：
```typescript
if (import.meta.env.DEV && !warned && data.length > 1000 && !isVxeEngine.value) {
  warned = true
  console.warn(`[es-plus] antdv a-table 渲染了 ${data.length} 行...请改用 engine:'vxe'`)
}
```

**验收**：fragment-runtime antdv 大数据运行时测试。

---

## P0-3：import 按钮空壳

**问题**：`actions:['import']` 只 emit `btn-click('import')`，无文件选择器、无解析、无上传。

**证据**：`packages/vue3/src/components/es-crud-page/src/es-crud-page.vue:168-170,370-375`

**实施方案**：
- 短期：增加专用 `emit('import', model)`，对齐 `export` 设计
- 中期：新增 `ImportConfig` 类型 + `parseCsv()` + 内置 `<input type="file">` 生命周期

**验收**：三端 `es-crud-page` 单测覆盖 import 事件。

---

## P0-4：AI 英文腿 23.56%

**问题**：`byLanguage.en = 0.2356`，`zh = 0.5075`，差距 27pp。

**证据**：`__tests__/golden/last-accuracy.json:856`

**实施方案**：
1. 补充 en few-shot（目标 30 条，覆盖弱维度）
2. scorer 对 en 腿 label 比对改"身份值优先"
3. prompt 加 prop 命名约束（camelCase，不翻译 prop）
4. ratchet 加英文腿门禁（分阶段：0.40 → 0.65 → 0.80）

**验收**：`byLanguage.en >= 0.40`（第一阶段）。

---

## P1-1：dataOptions 维度 44.1%

**问题**：`dataOptions` 是最差维度，超半数案例首次生成错误。

**证据**：`scripts/eval/scorers.mjs:1067-1082` — scorer 逻辑正确（gold 有则 pred 必须有），问题是模型行为。

**实施方案**：
1. 补 5 条 few-shot（Select/Radio/Checkbox + tagType）
2. schema `.describe()` 补 tagType 使用时机说明
3. 修 `TableColumnDataOption` 类型补 `children` 字段
4. ratchet 加 dataOptions 分维门禁（0.65）

**验收**：`dataOptions >= 0.65`（第一阶段）。

---

## P1-2：dialogs 维度 53.3%

**问题**：弹窗生成失败率近 50%。

**证据**：`packages/mcp-server/src/tools/generate-crud.ts:38-57` — `dialogEntrySchema` 区分字符串键和对象键

**实施方案**：
1. 补 5 条 dialog few-shot
2. `_arg-guard.ts` 对 `formFields`/`formitems` 拼写错误结构化回传
3. ratchet 加 dialogs 门禁（0.70）

---

## P1-3：表单三大结构性缺口

**问题**：无嵌套对象、无数组子表单、无分组容器。

**证据**：`packages/core/src/types.ts:290-440` — `FormItemOption` 无 `children`/`repeatable`/`group`/`layout`

**实施方案（三期）**：
- 第一期（4 人日）：`layout.type:'tabs'|'steps'|'collapse'` + `group` 字段
- 第二期（5 人日）：嵌套对象 `children?: FormItemOption[]`（一层）
- 第三期（10 人日）：数组子表单 `FormList`（独立设计评审）

**验收**：每期四份契约同批 + golden + 三端运行时见证。

**当前进度**：🟡 第一期运行时 + 站点示例已实现（2026-11-09，P1-3a）；AI 四份契约
（Zod / 前门 knobs / `configShape` / 片段 shape）与 golden 未落，P1-3b 单独一批补齐。

**实施记录（P1-3 第一期 · 2026-11-09）**

1. **契约（core 单源）**：`FormItemOption.group?: string`；`LayoutFormProps.layout?: FormGroupLayout`；
   新增 `FormGroupOption { key, label?, labelKey?, description? }`、
   `FormGroupLayout { type: 'tabs'|'steps'|'collapse', groups?, ungrouped?, defaultLabel? }`。
   后两者进 `PUBLIC_CONTRACT_TYPES`（42→44），三端 `types/index.ts` 同批声明，
   `check:type-exports` 成员级对齐。
2. **分桶单源** `packages/core/src/form-groups.ts`：`groupFormItems(items, layout)` 返回
   `{ active, groups }`。规则：无 layout / 无显式 groups → `active:false` 且单桶（历史平铺行为）；
   声明的组按声明顺序在前、未声明的组按字段首次出现追加；空组丢弃、重复/空 key 忽略；
   `ungrouped: 'default'` 把无 group 的字段汇总成末位桶（标题 `defaultLabel` 或「其他」）、
   `'first'` 并入首组、`'hidden'` 丢弃。三端只调用，不各自读 `group`
   （`check:contract` ALLOWLIST 登记原因）。
3. **三端渲染**：各端 `es-form.vue` 内新增 `FormGroupShell` 渲染组件，字段区与按钮区改为两个
   作用域插槽（`default({ group })` / `actions`），容器分发：
   - tabs：`ElTabs/ElTabPane`、`a-tabs/a-tab-pane`（`activeKey`）、`el-tabs/el-tab-pane`；
   - collapse：缺省全部展开（内部只记「被收起的组」）；
   - steps：只渲染当前组，内置「上一步 / 下一步」，`description` 仅 steps 消费；
   - 动作区（按钮）在所有容器下单独一行，不在页签/面板内部；
   - 内置折叠按钮（`minFoldRows`）在分组激活时隐藏 —— 折叠是按行裁剪，与容器互斥。
4. **偏离说明**：① steps 的「下一步」**不做校验**（本期是纯布局能力；需要分步校验的宿主
   仍走多实例组合示例，站点示例已写明这条边界）；② `ungrouped:'first'` 在没有任何
   显式组时退回平铺，而不是造一个无名容器；③ 组的标题解析顺序 `labelKey`（全局 `t`）→
   `label` → `key` → 内建「其他」。
5. **i18n**：`BuiltinTextKey` 新增 `other` / `prev` / `next`（中英各一份），三端 shell 经
   `resolveBuiltinText` 取文案，避免新硬编码中文（`check:i18n-literals`）。
6. **守卫**：`check:contract` 登记 `FormItemOption.group`（core 统一分桶）；
   `check:eui-column-prop` 增加「`groups:` 数组上下文」豁免 —— 否则新示例的
   `{ key, label }`（FormGroupOption 的语义字段就是 key）会被误判成「列定义用 key 代替 prop」。
7. **测试**：core `form-groups.spec.ts` 14 例（平铺不变 / 排序 / 空组 / labelKey / 三种
   ungrouped / 空 key / 三种容器同分桶）；vue3 9 例、vue2 5 例、antdv 5 例（容器结构、
   未分组兜底、hidden、collapse 缺省展开、steps 翻页、折叠按钮隐藏）。
8. **站点示例**：三站各增一个 `FormGroups.vue`（容器切换 + `ungrouped` 开关 + 保存校验），
   并把原「分组布局」示例改名为「进阶：多实例组合与逐组校验」，正文与新能力互指
   （不再宣称「EsForm 没有内置分组容器」）。`docs/ai/feature-coverage.json` 增
   `form/22-form-groups`（A 档，tokens: formLayout/formtype）并重跑 `sites:coverage:gen`、
   `llms:gen`、`tri-render:pairs`。
9. **验证**：`build:libs` 后四包单测全绿（core 531 / vue2 445 / vue3 722 / antdv 771）；
   三站构建成功（es-eui 用 `--dest dist-verify` 后删除）；`check:consistency` 140/141，
   唯一红仍是 `check:eval-freshness`（准确率产物需一次新的全量付费测量，不在本地伪造）。

---

## P1-4：TreeSelect + Autocomplete 缺失

**问题**：14 种控件封闭枚举，缺两个高频控件。

**证据**：`packages/shared/src/contract.ts:1` + `packages/core/src/types.ts:118`

**实施方案**：
1. `VALID_FORM_TYPES` + `FormType` union 各加 2 个
2. 三端 `use-form-inputs.ts` 新增 Map entries
3. `form-detail.ts` 展示规则（TreeSelect 复用 Cascader 路径，Autocomplete 走标量）
4. 四份契约同批 + golden 各 2 例

**当前进度**：✅ 已全部实现（实施记录见下）。

**实施记录（2026-11-09）**

1. **契约与类型**：`VALID_FORM_TYPES` 14→16（`TreeSelect` / `Autocomplete`，顺序与
   `shared/src/contract.ts` 逐字一致，`check:schema` 深比对）；`core/src/types.ts` 的
   `FormType` 联合 + 三处内联联合（vue3 / antdv 的 `types/index.ts`、mcp-server
   `resources/types.ts`）同批补齐；`form-item.schema.json` 枚举 + `schemas:sync` 三份副本。
2. **四份契约同批**：Zod（`structured-config.schema.ts` 的 describe 指明
   「任意层级可选 → TreeSelect / 边输边筛 → Autocomplete」）、MCP 前门 knobs、
   生成器 `configShape`、片段 shape 均同批更新；`FORM_TYPES` 补说明与示例。
3. **三端渲染**：
   - vue3 `ElTreeSelect`；`Autocomplete` = `ElSelect` + `filterable` + `ElOption` 子节点。
   - vue2 `TreeSelect` **降级为 `el-cascader` + `props.props:{checkStrictly:true, emitPath:false}`**
     （Element UI 无树选择器；值语义 = 节点 value，而非路径）。
   - antdv `TreeSelect`（`treeData` + `fieldNames`）；`Autocomplete` = `Select` + `showSearch`
     + 按 label 的 `filterOption`。
   - **偏离说明**：`Autocomplete` 刻意不用三库各自的 `AutoComplete` 组件 —— 它们的 model
     是「输入文本」，与 `dataOptions` 的 value 契约冲突；统一为「选项集上的可搜索选择」。
4. **守卫**：`FORM_RENDER_CONTRACT` 新增两项；`check-renderer-parity` 的反向断言会把
   `Autocomplete` 的 `ElSelect`/`el-select`/`Select` 误判为 `Select` 分支串味，故引入
   `overlaps` 白名单（只豁免已登记的两两配对，不关闭整条反向检查）；vue2 的
   `Cascader ↔ TreeSelect`（同为 `el-cascader`）同样登记。
5. **展示与生成**：`form-detail.ts` 的 `TreeSelect` 走**递归** `findOptionDeep`（任意层级
   label 可解析，多选逐项映射）；`Autocomplete` 走标量。`inferTsType` / 必填消息 /
   `config-feedback` 的 needsOptions、`crud-engine` 关键词与 `nl-evidence` 词表同步。
6. **语料**：`199-org-tree-select.json`（部门树 + 任意层级 + apiParams）、
   `200-customer-autocomplete.json`（联想输入 + dataOptions）；语料 223→225 crud /
   199→201 heldout，`accuracy-baseline.json` 的 `applicableCounts`（apiParams 9→10、
   dataOptions 121→122）与 `minApplicable` 同批重算。
7. **站点案例**：es-plus-docs `AllFormtypes.vue`（⑩ TreeSelect / ⑪ Autocomplete，其余顺延至 ⑯）、
   es-pc 新增 `views/es-form/TreeSelectAutocomplete.vue` 并注册进 `EsForm.vue` 的 `tools` 分组、
   es-eui `examples/form/Controls.vue` 增两例；三站文档的「16 种」口径与 README 计数同步。
8. **验证**：`check:consistency` 140/141（唯一红 = `check:eval-freshness`：formtype 枚举属系统
   prompt 指纹，新增类型必然使既有准确率产物失效，需一次新的全量付费测量才能回绿，不在本地伪造）；
   四包单测全绿（core 512 / vue2 438 / vue3 711 / antdv 764）；三站构建均成功。

---

## P1-5：fold/unfold 未接 locale

**问题**：三端 es-form.vue 用中文字面量 `'展开'/'收起'`，不在 `BuiltinTextKey` 中。

**证据**：vue3 `es-form.vue:76,125`；antdv `:103,156`；vue2 `:91,127`

**实施方案**：
1. `locale.ts`：`BuiltinTextKey` 加 `fold`/`unfold`；zh/en 字典各填值
2. 三端 es-form.vue 替换字面量为 `resolveBuiltinText('fold')`/`resolveBuiltinText('unfold')`
3. vue2 需在 setup return 中暴露 `resolveBuiltinText`

**当前进度**：✅ 已全部完成（locale.ts + 三端 es-form.vue）。

---

## P1-6：drawer 判别联合类型

**问题**：`type:'drawer'` 时 `isDraggable`/`fullscreen` 静默忽略，类型系统无约束。

**证据**：`packages/vue3/src/components/es-dialog/src/component.vue:187-188`

**实施方案**：`DialogOptions` 改判别联合（纯类型，不影响运行时）。

**当前进度**：✅ 已实现（实施记录见下）。

**实施记录（2026-11-09）**

1. **保留扁平基线，新增判别联合**：`DialogOptions` 仍是全量扁平接口 —— 它同时被
   `Partial<DialogOptions>`（CRUD 配置槽）与缓存合并使用，那些场景**不知道** `type`，
   强行改写成联合会让 `dialogOptions` 配置项无法表达。新增：
   - `DialogModalOptions extends DialogOptions { type?: 'dialog'; direction?: never }`
   - `DialogDrawerOptions extends DialogOptions { type: 'drawer'; isDraggable/fullscreen/
     hiddenFullBtn/alignCenter/top?: never }`
   - `DialogCallOptions = DialogModalOptions | DialogDrawerOptions`
2. **`[key: string]: unknown` 不妨碍收窄**：索引签名是刻意开的扩展键契约；同名的具名
   `never` 属性优先级高于索引签名，故 `{ type: 'drawer', isDraggable: true }` 会真的编译报错。
3. **收窄点**：三端 `useDialog` 的 `DialogCallable` 调用签名改为 `DialogCallOptions`
   （vue2 额外带 `cacheKey`）；三个类型进入 `PUBLIC_CONTRACT_TYPES`（39→42），
   vue3 / antdv 各自特化、vue2 透传 core，`check:exports` 成员级比对通过。
4. **类型级测试**：`packages/core/__tests__/dialog-call-options.types.spec.ts` 用
   `@ts-expect-error` 覆盖 6 种误配（抽屉带拖拽/全屏/全屏按钮/居中/外边距、弹窗带方向），
   由 `npm run typecheck -w @es-plus/core`（`tsc --noEmit`，include 含 `__tests__`）真的检查；
   vitest 不做类型检查，文件内附一条运行时断言避免被判为空套件。
5. **已知边界（刻意不做）**：`dialogOptions?: Partial<DialogOptions>` 配置槽不参与收窄
   （它不带 `type`，无从判别）；`<es-dialog>` 的 Vue 运行时 props 无法表达判别联合，
   组件 props 接口保持扁平，约束只落在编程式 `useDialog` 调用面。
   显式标注 `DialogOptions` 的变量传入 `useDialog` 现在会报错 —— 改标 `DialogCallOptions`
   或用 `satisfies` 即可（这是该能力的必要代价，已在类型注释中说明）。

---

## P1-7：localPagination AI 生成零分

**问题**：3 个适用案例全部生成错误。

**证据**：`__tests__/golden/last-accuracy.json:416`

**实施方案**：检查 schema `.describe()` + 补 2 条 fragment golden。

---

## P2-1：TABLE_INTERNAL_KEYS 三端不对齐

**问题**：三端各写一份「不透传到底座表格」的内部键清单（修前 43 / 44 / 50），新增跨端键时
漏改一端 = 该端 DOM 上多一枚死属性，构建与单测全绿、无人发现。

**实施记录**：
1. `packages/core/src/table-internal-keys.ts` 定义 `BASE_TABLE_INTERNAL_KEYS`（43 个公共键，
   按「前置列 / 请求映射 / 布局高度 / 引擎与虚拟滚动 / vxe 一等公民 / 声明式翻译」分组注释），
   从 core 入口导出；
2. 三端改为 `new Set<string>([...BASE_TABLE_INTERNAL_KEYS, ...端专有])`：vue2 专有 `lazyLoad`，
   antdv 专有 7 个 a-table 映射键（border/stripe/size/showHeader/emptyText/headerCellStyle/
   highlightCurrentRow），vue3 无专有；
3. 新守卫 `check:table-internal-keys`（已进 `check:consistency` 的 cross-target 组）：
   ① 单源 ⊆ 每端集合；② 单源 === 三端交集（三端共同新增却忘记回填单源 = 红）；
   ③ 每端必须 `...BASE_TABLE_INTERNAL_KEYS` 展开、集合内无重复键；带 5 条自证
   （缺键 / 未展开 / 未回填 / 重复 / 解析为空）。

**当前进度**：✅ 已完成。三端 es-table 单测 64 / 36 / 77 全绿，typecheck 绿。

---

## P2-2：export 按钮无内置调用

**问题**：内置 `export` 操作只 `emit('export', queryModel)`；宿主没监听时点了没反应（空壳）。三端同病。

**实施记录**（与初版方案的差异）：不能无条件调 `tableRef.exportData()` —— 宿主监听 `@export` 自己做导出时会**双份下载**。
故先探测「宿主是否真的监听」，再决定是否兜底：

- vue3 / antdv：已声明事件会被从 `$attrs` 摘掉，读 `getCurrentInstance().vnode.props.onExport`；
- vue2：读 `instance.proxy.$listeners.export`（Vue 2 的监听仍在 `$listeners`）；
- 判定为函数才视为「宿主接管」，否则 `tableRef.value?.exportData?.()`。

**验收**：三端各两条用例（未监听 → 内置导出被调用 1 次；已监听 → 内置导出 0 次、宿主 handler 1 次）。

**当前进度**：✅ 三端已实施（`vue3`/`vue2`/`adapter-antdv` 的 `es-crud-page`），用例 `vue3 50/50`、`vue2 7/7`、`antdv 11/11`，`typecheck` 与 `check:consistency 140/140` 全绿。

---

## P2-3：filters 不从 dataOptions 自动派生

**实施方案**：`TableColumn.autoFilters?: boolean`，列适配器自动合成 `filters`。

**当前进度**：✅ 已实现（实施记录见下）。

**实施记录（2026-11-09）**

1. **合成单源**：core `table-filter.ts` 新增 `withAutoFilters(col)` —— 显式 `filters` 优先；
   `autoFilters === true` 且 `dataOptions` 非空时把 `label/value` 映射成 `text/value`；
   分组列递归；`type: index/selection/expand` 非数据列不合成。入参用结构最小面 +
   泛型返回，三端列类型不必来回强转。
2. **三端接线**：都在**列归一化的同一处**调用（先合成 filters，再由既有的
   `withColumnFilters` 生成谓词）：
   - vue3 `filteredColumns`（虚拟引擎跳过 —— 无筛选 UI，合成只会触发 DEV 告警）；
   - vue2 `filteredColumns`（默认 + vxe 两条引擎路径共用）；
   - antdv `filteredColumns`（a-table 列适配与 vxe 适配器共用）。
3. **AI 契约同批**：`ColumnSchema.autoFilters`（shared Zod + mcp 内联副本）、
   `table-column.schema.json` 单源（`schemas:sync` 分发三份）、生成器
   `bool('autoFilters')`、文档站 `TableColumn` API 表。
4. **守卫**：`check:contract` 把 `TableColumn.autoFilters` 登记进 ALLOWLIST
   （消费点在 core，与 filterMode 同因）；`check:exports` 要求 vue3/antdv 的
   `TableColumn` 副本同批补成员 —— 都已补齐。
5. **测试**：core 纯函数 5 例（映射 / 优先级 / 非数据列 / 分组递归 / 谓词生效）；
   vue3、vue2、antdv 各 2 例（默认引擎拿到 filters + `filterMethod`、显式 filters 优先）。

---

## P2-4：locale 运行期热切换

**实施方案**：Phase 2，全局配置改 reactive。3 人日，按需做。

---

## P2-5：propNameMatch 76.19%

**实施方案**：统一 golden 语料 prop 命名规范（camelCase）+ prompt 加规则。
