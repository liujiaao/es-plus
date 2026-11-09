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

---

## P1-4：TreeSelect + Autocomplete 缺失

**问题**：14 种控件封闭枚举，缺两个高频控件。

**证据**：`packages/shared/src/contract.ts:1` + `packages/core/src/types.ts:118`

**实施方案**：
1. `VALID_FORM_TYPES` + `FormType` union 各加 2 个
2. 三端 `use-form-inputs.ts` 新增 Map entries
3. `form-detail.ts` 展示规则（TreeSelect 复用 Cascader 路径，Autocomplete 走标量）
4. 四份契约同批 + golden 各 2 例

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

---

## P1-7：localPagination AI 生成零分

**问题**：3 个适用案例全部生成错误。

**证据**：`__tests__/golden/last-accuracy.json:416`

**实施方案**：检查 schema `.describe()` + 补 2 条 fragment golden。

---

## P2-1：TABLE_INTERNAL_KEYS 三端不对齐

**实施方案**：`core/constants.ts` 定义 `BASE_TABLE_INTERNAL_KEYS`，三端用 `new Set([...BASE, ...端专有])`；新增守卫。

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

---

## P2-4：locale 运行期热切换

**实施方案**：Phase 2，全局配置改 reactive。3 人日，按需做。

---

## P2-5：propNameMatch 76.19%

**实施方案**：统一 golden 语料 prop 命名规范（camelCase）+ prompt 加规则。
