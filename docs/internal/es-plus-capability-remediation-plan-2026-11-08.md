# es-plus 能力补齐实施方案

> 制定日期：2026-11-08  
> 依据：[es-plus 能力全量审查报告](./es-plus-capability-audit-2026-11-08.md)  
> 适用范围：vue3 / vue2 / adapter-antdv 三端 + core / shared / mcp-server / cli / docs  
> 工作量口径：**熟悉本仓的 1 名维护者的人日**；并行度按 2 人估算可压缩约 35%  
> 本文只定方案与顺序，不替代逐项设计评审；所有“新增声明式键”在合并前必须过第 2 节的四份契约。

---

## 1. 总体策略

**先修真话，再扩契约，最后补体验。**

1. **W1 信任修复**（1 周内）：把“宣称支持、实际不支持”的三处漂移修掉，并加一条可机械执行的“主张必须有证据”守卫。  
2. **W2 AI 契约扩展**（1.5–2 周）：把**已经是 JSON、运行时已消费、只是 schema 没声明**的 vxe 配置块接进 AI 前门。这是投入产出比最高的一步——不改运行时，只改契约。  
3. **W3 高频运行时缺口**（2–3 周）：内置文案 i18n、列筛选、表单只读/详情。  
4. **W4 大件与体验**（按需）：表单数组/嵌套、a11y 键盘、移动端卡片、性能基准、e2e。  

**不做什么**（同样重要）：

- 不在默认引擎上重造行内编辑——官方答案就是 `engine: 'vxe'`。
- 不给 antdv 造虚拟滚动——上游没有，正确做法是告警 + 指引 vxe。
- 不把函数能力硬塞进 JSON schema——函数仍是 Tier C，靠源码串/逃生舱。
- 不为了“低代码平台”扩 scope——没有画布、没有任意组件编排。
- 不加 `permissionFailOpen`——fail-closed 是安全默认，改文档而不是改语义。

---

## 2. 硬约束：任何新增声明式键必须同批进四份契约

本仓已经因为“镜像漏键 → 静默 strip”出过多次事故（`heightType`、`tableBtns.position` 都是真实案例）。新增一个 `tableOptions.<key>` 或列键，**必须同一批**改完：

| # | 契约 | 文件 | 守卫 |
|---|---|---|---|
| 1 | 权威 AI schema | `packages/shared/src/structured-config.schema.ts` | `check:schema-validator`、`check:unknown-keys` |
| 2 | 前门旋钮镜像 | `packages/mcp-server/src/tools/_front-door-knobs.ts` | `check:tool-shapes` |
| 3 | from_config 镜像 | `packages/mcp-server/src/tools/generate-from-config.ts` 的 `configShape` | `check:threeway` |
| 4 | 片段表格镜像 | `packages/shared/src/fragment-generator.ts` 的 `TableBlockOptions` + `TABLE_BLOCK_OPTION_ORDER` + `_fragment-shapes.ts` | `check:fragment` |

另外两处必须同步：

- **生成器双模式发射**：`structured-generator.ts` 的 schema 模式（约 `:792`）与 SFC 模式（约 `:1295`）都要发；SFC 的对象值走 `inlineJson()`，布尔走 `!== undefined`。
- **运行时剥离表**：vue3/vue2/antdv 的 `TABLE_INTERNAL_KEYS` 要把新键列入（不给默认引擎/虚拟引擎当 DOM attr 透传）。antdv 当前表里没有 vxe 键，尤其要补。

**合并纪律**：一个 key 一批；先跑 `check:tool-shapes` / `check:fragment`，再跑生成器与 golden；不要一次改十个键再一起排查。

---

## 3. W1 信任修复（P0，约 4–6 人日）

### W1-1 antdv 虚拟滚动：把四处“支持”改成“不支持”

**源码事实**

- 运行时：`packages/adapter-antdv/src/components/es-table/src/component.vue:390-399` 明确“a-table 从未实现虚拟滚动”，`virtual` 告警并降级。
- 矩阵：`packages/shared/src/capability.ts:107`、`:142` 写 `full`。
- AI schema：`packages/shared/src/structured-config.schema.ts:584-594` 写“Ant Design Vue 4 has native virtual scroll”。
- 文档：`es-plus-docs/src/docs/adapter-antdv.md:139`、`packages/adapter-antdv/README.md:112`。

**方案**

1. `capability.ts` 两处 antdv 格子改为 `none(...)`，note 写明“运行时告警并按默认引擎渲染；大数据请用 `engine: 'vxe'`”。
2. schema 的 `virtual` / `engine` 描述改为：antdv 不支持 virtual，唯一大数据路径是 vxe；vue2 同理。
3. 文档/README 同步；删除“ADV 原生虚拟滚动”的表述。
4. `npm run ai:matrix` 重新生成 `docs/ai/ai-capability-matrix.json`。
5. 加测试：`generateFromConfig({ target:'antdv', tableOptions:{ virtual:true } })` 的 schema 与 sfc 两种 mode 都必须 warning 点名 `virtual` + `antdv`（`check:capability-parity` 的 B 判据会接管）。

**影响面**：能力矩阵、schema 文案、两处文档、生成器 warning、AI 矩阵产物。  
**验收**：四处文本一致；antdv + virtual 在生成阶段有 warning；把矩阵改回 `full` 时 `check:capability-parity` 变红。

### W1-2 permission 文档改为 fail-closed

**源码事实**：`packages/core/src/field-resolver.ts:295-329` 是 fail-closed；`permission-i18n.md:96`、`faq.md:49` 写“默认显示、permissionValue 被忽略”。

**方案**

1. 两份文档改成：声明了 `permissionValue` 但未配置 `permission()` → 拒绝 + 一次性 console.warn；需要“全部放行”请显式传 `permission: () => true`。
2. 补一段迁移说明（这是行为变更，不是新功能）。
3. 在 `field-resolver.spec` 中断言：未配 permission 时 `checkPermissionValue('x') === false`，且只 warn 一次。
4. 把“所有按钮默认显示 / permissionValue 被忽略”加入 `check:doc-drift` 的过时措辞黑名单（防止回流）。

**验收**：文档与代码一致；过时措辞守卫变红；现有权限 spec 全绿。

### W1-3 默认引擎 `exportData()`：实现 CSV 兜底

**源码事实**：`packages/vue3/src/components/es-table/src/component.vue:1336` 只代理到引擎；默认引擎 `activeEngineRef` 为 null；`types.ts:1248` 注释写“Element 引擎走内置导出”。

**方案**

- 新增 `packages/core/src/csv.ts`：
  - `buildCsv(rows, columns, opts)`：BOM（Excel 中文）、引号/逗号/换行转义、`formatter` 结果优先、空值占位。
  - `downloadCsv(filename, content)`：仅浏览器路径；无 `document` 时返回内容不下载。
- 三个目标的 `exportData` 统一：
  1. 引擎有 `exportData` → 用引擎（vxe）。
  2. 没有 → `exportConfig.type` 缺省/`csv` 时走 CSV；其它类型（`xlsx` 等）明确 `throw` 或 `Promise.reject`，**不允许静默 no-op**。
  3. 返回 `{ format, rows, filename }`，便于宿主提示。
- `types.ts:1248` 注释改成“vxe 走 vxe-table，其余引擎走 core CSV 兜底”。
- 测试：CSV 转义、BOM、空数据、formatter、默认引擎调用有确定结果；vxe 路径仍代理。

**影响面**：core 新增模块、三端 es-table 的 `exportData`、类型注释、spec。  
**验收**：默认引擎 `exportData({ filename:'x' })` 产出 CSV；`type:'xlsx'` 明确失败；无静默返回 `undefined`。

### W1-4 “主张必须有证据”守卫

**问题**：`check-capability-parity` 只校验结构；`full` 是手写的，没有运行时证据，这是 W1-1 的根因。

**方案**

- 新增 `scripts/capability-witnesses.data.mjs`：
  ```js
  export const WITNESSES = {
    'tableOptions.virtual|antdv': { kind: 'source', file: 'packages/adapter-antdv/src/components/es-table/src/component.vue', contains: '已按默认引擎渲染' },
    'tableOptions.editConfig|vue3': { kind: 'spec', file: 'packages/vue3/src/...spec.ts', test: 'vxe engine ...' },
    // ...
  }
  ```
- 新增 `scripts/check-capability-witnesses.mjs`：
  - 从源码打包 `CAPABILITIES`（复用 `check-capability-parity` 的 esbuild 方式）。
  - 只对 **high-risk key 列表**（`virtual` / `editConfig` / `exportConfig` / `showFooter` / `footerData` / `treeConfig` / `mergeConfig`）要求见证。
  - 规则：`full` → 必须是 `kind:'spec'` 且 spec 文件存在、测试标题存在；`none` → 必须是 `kind:'source'` 且源码包含锚点。
  - 注入自证：把 antdv virtual 改回 `full` 而不加 spec → 必须红。
- 加进 `check:consistency` 的分组 runner。

**验收**：高 risk 的 `full` 格子都有 spec 见证；注入回退变红；不要求一次覆盖全部 41 个 token。

---

## 4. W2 把 vxe 的 JSON 配置接进 AI 前门（P1，约 7–9 人日）

### 4.1 为什么这是最高 ROI

`scripts/feature-coverage.data.mjs:123-129` 把 `vxeFirstClass` 登记为 Tier C，理由是“两处 AI Zod 零声明 + 生成器零发射（经 AI 入口静默 strip）”。但这些键**不是函数**，是纯 JSON：

| 键 | JSON 安全 | 运行时消费 |
|---|---|---|
| `showFooter` | ✅ boolean | `core/vxe-engine/build-grid-config.ts:11` |
| `footerData` | ✅ `unknown[][]` | `:17` |
| `exportConfig` | ✅ `true \| object`（`download` 函数除外） | `:27` |
| `printConfig` | ✅ `true \| object` | `:55` |
| `toolbarConfig` | ✅ `true \| object` | `:32` |
| `columnConfig` | ✅ object | `:39` |
| `keyboardConfig` | ✅ object | `:47` |
| `mouseConfig` | ✅ object | `:48` |
| `validConfig` | ✅ object | `:49` |
| `seqConfig` | ✅ object | `:73` |
| `keepSource` | ✅ boolean | `:51` |

**不纳入**：`footerMethod`（函数）、`proxyConfig`（`ajax.query` 函数）、`vxeConfig` / `vxeOn` / `vxeColumn`（任意/函数逃生舱）。它们继续留在 Tier C，并在文档里明确“需要写函数”。

### 4.2 分两批落地

**Batch 2A（低风险、最常用）**：`showFooter`、`footerData`、`exportConfig`、`toolbarConfig`、`columnConfig`、`keepSource`。  
**Batch 2B（配置型）**：`keyboardConfig`、`mouseConfig`、`validConfig`、`seqConfig`、`printConfig`。

每批固定动作：

1. `StructuredCrudConfigSchema.tableOptions` 加键（`.optional()`；对象用 `z.record(z.string(), z.unknown())`，`exportConfig`/`toolbarConfig`/`printConfig` 收 `boolean | record`）。
2. 生成器 schema 模式发射（`inlineJson` / 直接值）；SFC 模式同步。
3. `_front-door-knobs.ts` 同形镜像（**不写 `.default()`**）。
4. `generate-from-config.ts` 的 `configShape` 同形镜像。
5. `fragment-generator.ts` 的 `TableBlockOptions` + `TABLE_BLOCK_OPTION_ORDER` + `_fragment-shapes.ts`。
6. `capability.ts` 为每个键加条目：三端 `partial`，note 写“仅 `engine:'vxe'` 消费；默认/虚拟引擎忽略并有 DEV 告警/剥离”。
7. few-shot、conventions、组件文档、`docs/ai/*` 生成物。
8. 3–5 个 golden（footer / export / toolbar+columns / keyboard+valid / print）。
9. 守卫全跑：`check:tool-shapes`、`check:fragment`、`check:tool-surface`、`check:threeway`、`check:capability-parity`、`check:capability-ledger`、`check:first-class-vxe-keys`、`check:unknown-keys`、`check:generator`。
10. eval 先 `--limit` 探针，再全量 heldout；确认 `notMeasuredRows = 0` 且 definition95 不回退。

> **需要评审拍板的取舍**：片段入口（`generate_table`）是否要暴露全部 11 个 vxe 键。当前 `check:fragment` 要求 `TableBlockOptions` ≡ 权威 `tableOptions` 键集，所以 shared 一加键，片段就必须加。若不希望片段暴露，唯一干净的做法是把守卫改成“`TableBlockOptions ⊆ tableOptions`，且每个键都有发射路径”并维护排除清单——这是**契约弱化**，不建议在本批做。本方案选择先全量接入，后续根据 prompt 噪声再收窄。

### 4.3 风险与对策

| 风险 | 对策 |
|---|---|
| 宿主可见 schema 变大，模型在简单 CRUD 里乱加 vxe 键 | 描述统一加“advanced; only with `engine:'vxe'`”；prompt 规则“用户没提导出/合计/工具栏/键盘时不要加”；eval 观察 front-door 产物 |
| 四份镜像漏键 → 静默 strip | 一个 key 一批；`check:tool-shapes` / `check:fragment` 先跑 |
| `exportConfig` 含 `download` 函数 | schema 只收 JSON 子集；函数仍走 `vxeConfig`，文档写明 |
| vxe v3/v4 键名差异 | `check:first-class-vxe-keys` 已从上游 props 解析；新增键先过它 |
| 片段产物对入参顺序敏感 | `TABLE_BLOCK_OPTION_ORDER` 冻结顺序，新增键追加到尾部 |

**验收**：11 个键在 `generate_crud_from_config` 与 `generate_scene` 中可生成、可编译；同一配置 schema/sfc 两模式产物一致；vxe 运行时实际生效；eval 不出现新 errored/notMeasured 行。

---

## 5. W3 高频运行时缺口（P1/P2，约 10–13 人日）

### 5.1 内置文案 i18n（3–4 人日）

**事实**：`EsPlusOptions` 有 `t`，但只服务 `labelKey`；内置文案写死中文，共约 60 处、15 个文件（`暂无数据`、`努力加载中...`、`新增/编辑/查看/删除/导出/导入`、`操作`、`取消/确定`、删除确认等）。

**方案**

1. 新增 `packages/core/src/locale.ts`：
   - `LocaleKey` 联合类型 + `zh-CN` / `en-US` 字典。
   - `resolveBuiltinText(key, params?)`：读全局配置的 `locale` / `messages`，缺省 `zh-CN`。
2. `EsPlusGlobalConfig` / `EsPlusOptions` 增加：
   ```ts
   locale?: 'zh-CN' | 'en-US' | { name: string; messages: Record<string, string> }
   messages?: Record<string, string>  // 覆盖单个键
   ```
3. 三端统一用 core 的 `resolveBuiltinText`，**不复用宿主 `t`**（避免 `labelKey` 命名空间污染）。
4. `constants.ts` 的 `DEFAULT_TOOLBAR_BTNS` / `DEFAULT_ROW_BTNS` 保留导出（兼容），新增 `getDefaultToolbarBtns()` / `getDefaultRowBtns()` 供内部使用；CRUD 组件改用它。
5. 替换表格空态/loading、CRUD 自动按钮/标题/确认文案、表单取消按钮、操作列默认标题。
6. 守卫：新增 `check:i18n-literals`，扫描 runtime 文件中的中文 UI 字面量（白名单：注释、日志、测试、用户可见的默认配置文档）。
7. 测试：默认 zh 产物逐字节不变；`locale:'en-US'` 输出英文；`messages` 覆盖单键；三种目标一致。

**分期**：Phase 1 安装时静态 locale（不做运行时热切换）；如确有需求，Phase 2 用 core 的小型订阅器 + 组件内 `ref` 版本号实现热切换。

**验收**：runtime 目录零未经白名单的中文 UI 字面量；中英切换 e2e；默认中文无回归。

### 5.2 列筛选（4–5 人日）

**事实**：`TableColumn` 无 `filters` / `filterMethod`；配置里写会被 `collectUnknownKeys` 报未知键并剥掉。el-table / a-table 原生支持筛选，vxe 有 `filterConfig`，virtual 不支持。

**方案**

1. core 类型：
   ```ts
   interface TableColumnFilterOption { text: string; value: string | number | boolean }
   TableColumn.filters?: TableColumnFilterOption[]
   TableColumn.filterMultiple?: boolean
   TableColumn.filterMode?: 'equals' | 'includes'   // 默认 equals
   TableColumn.filterMethod?: (value, row, column) => boolean  // 函数，Tier C
   ```
2. 运行时：
   - el-table：透传 `filters` / `filter-multiple`；无 `filterMethod` 时用 `filterMode + prop` 合成；监听 `filter-change`，新增 `filter-change` 事件 `{ prop, values }` 供服务端筛选。
   - a-table：透传 `filters` / `filterMultiple`，合成 `filter`；`@change` 归一后 emit。
   - vxe：列上 `filters` + 合成 `filterMethod`；需要远程筛选时走既有 `vxeConfig`。
   - virtual：DEV 告警“virtual 不支持列筛选”，不渲染筛选 UI。
3. schema：`ColumnSchema` 加 `filters` / `filterMultiple` / `filterMode`；只允许 JSON，`filterMethod` 不收函数。
4. 生成器：显式 `columns[]` 发射；字段派生列暂不支持（`FieldConfig` 不扩，保持“筛选是列级配置”）。
5. MCP：`generate-from-config.ts` 的 `configShape.columns` 收新键；前门不暴露 `columns`，无需改 `_front-door-knobs`。
6. 测试：三端本地筛选、服务端 `filter-change`、AI 生成 + 编译、virtual 告警、golden 2 例。

**验收**：同一份 `columns` 在 el-table / a-table / vxe 下筛选行为一致（vxe 至少本地等价）；AI 配置不再被未知键检查拒绝；文档写清 virtual 不支持。

### 5.3 表单只读/详情模式（2–3 人日）

**事实**：`EsForm` 没有表单级 `readonly` / `disabled` / `mode`；只能逐控件传 `attrs`。详情页是 CRUD 的高频配套。

**方案**

1. `EsForm` 增加 `mode?: 'edit' | 'detail'`（或 `readonly?: boolean`）。
2. detail 模式：控件渲染为文本（`dataOptions` 翻译、日期格式化、空值占位），保留 `label` 布局；`render` 字段仍按函数渲染。
3. 按钮区在 detail 模式默认只保留“关闭/返回”（可被 `configBtn` 覆盖）。
4. schema/生成器：`formLayout.mode` 或顶层 `mode`；先只做运行时 + 文档，AI 契约后补。
5. 测试：14 种控件 detail 渲染、`dataOptions` 映射、空值、按钮区。

**验收**：`<EsForm mode="detail">` 不出现可编辑输入；同一份 `formItemList` 在 edit/detail 下标签与布局一致。

### 5.4 可选：CRUD Drawer（3–4 人日）

`useDialog` 已有 `draggable/fullscreen/appendTo`，但没有 drawer 变体。若业务需要“列表 → 抽屉详情”，再加 `useDrawer` 或 `useDialog({ type:'drawer' })`；优先级低于 5.1–5.3，按需求触发。

---

## 6. W4 大件与体验（按需，约 20–28 人日）

| 项 | 估算 | 建议 | 说明 |
|---|---:|---|---|
| 表单数组 / 嵌套子表单 | 8–10 人日 | **先设计后做** | 需要 `prop` 路径、增删行、嵌套校验、三端渲染；不要用 `render` 逃生舱硬凑后宣称“支持” |
| a11y 键盘网格 | 8–10 人日 | **暂不做全量** | el-table/a-table/vxe 行 DOM 结构不同，roving tabindex 侵入大；先做 1–2 人日的廉价项：icon-only 按钮 `aria-label`、loading `aria-busy`、空态 `role="status"`、文档明确“行不可聚焦” |
| 移动端卡片模式 | 5–6 人日 | **按需** | 先用 `hidCol` + 按钮换行覆盖；真要做，新增 `mobileCard` 渲染分支并补断点 e2e |
| 性能基准 | 2–3 人日 | **建议做** | Playwright 渲染 1k/5k/20k 行，记录首屏与滚动帧；产物存 `docs/internal/bench-*.json`，不做门禁，先可观测 |
| vue3/antdv e2e 表格交互 | 2–3 人日 | **建议做** | 排序、选择、分页、导出、编辑各一条；补上现有 e2e 只有 vue2/docs 的盲区 |
| 多列排序 | 3–4 人日 | **暂不做** | el-table 无原生多列排序，三端语义不一致；vxe 可用 `vxeConfig` 逃生，文档标注即可 |
| 懒加载树 | 2–3 人日 | **暂不做声明式** | vxe 已可配；跨端懒加载需要统一 `load` 契约，收益低于成本 |

---

## 7. 排期与依赖

假设 1 名熟悉仓库的维护者全职，2 人并行可压缩：

| 周 | 工作 | 依赖 / 并行 |
|---|---|---|
| 第 1 周 | W1-1 → W1-2 → W1-3 → W1-4 | W1-3 与 W1-1/2 可并行；W1-4 最后做（要引用前三条的证据） |
| 第 2 周 | W2 Batch 2A | 必须等 W1 完成（矩阵/文档/生成器同一批产物） |
| 第 3 周 | W2 Batch 2B + W3-1 i18n 启动 | i18n 只碰运行时，可与 2B 并行；避免同时改 `component.vue` 的同一段 |
| 第 4 周 | W3-1 收尾 + W3-2 列筛选 | 列筛选要改 schema/镜像，接在 2B 后减少冲突 |
| 第 5 周 | W3-3 表单详情 + W4 廉价 a11y | 与列筛选无文件冲突 |
| 第 6 周+ | 性能基准、e2e、按需大件 | 前五周稳定后再开 |

**关键路径**：W1-1 → W2 → W3-2。  
**可并行**：W1-3 与 W1-1/2；W3-1 与 W2；W4 的基准/e2e 可与 W3 并行。

---

## 8. 验证协议（每批都必须跑）

### 8.1 构建与测试

```bash
npm run build:libs          # eval 读 build/，不是 src
npm test                    # 188 个 spec
npm run check:consistency   # 分组 runner，实测约 70–90 秒；不要用“10 分钟”旧预期
```

> 不要把 `check:*` 管道到 `| tail`——会吞掉退出码。

### 8.2 契约与生成器守卫（W2/W3-2 必跑）

```bash
npm run check:tool-shapes
npm run check:fragment
npm run check:tool-surface
npm run check:threeway
npm run check:capability-parity
npm run check:capability-ledger
npm run check:first-class-vxe-keys
npm run check:unknown-keys
npm run check:generator
npm run check:schema-validator
```

### 8.3 站点构建

```bash
cd es-plus-docs && npm run build
cd es-pc && npm run build
cd es-eui && npm run build -- --dest dist-verify   # 句柄锁时用独立目录，验完删除
```

### 8.4 生成物链（改文案/示例/文档后）

```bash
npm run ai:workflows
npm run fragment:dashboard
npm run cases:sync
```

> 这三步不会自动发生；漏跑会让 `check:ai-workflows` / `check:fragment-dashboard` / `cases:check` 变红。  
> 不要 `import` `scripts/gen-one-config-diff.mjs`——它没有 main-guard，import 会直接覆写产物。

### 8.5 eval

```bash
npm run test:golden -- --limit 20    # 先探针，确认中继/鉴权/无空轮
npm run test:golden                  # 全量 heldout
```

判据：

- `erroredRows = 0`、`notMeasuredRows = 0`（未测到按 0 计，部分失败比全灭更隐蔽）。
- definition95 不低于改动前（当前 89.18%）；compileRate 保持 100%。
- 新增 golden 用例的 `fieldMap` 若有改动，两处必须同批（scorer 与语料）。

### 8.6 e2e

```bash
npm run test:e2e:runtime -- --project=vue3-table   # W4 新增 project
```

### 8.7 提交纪律

- 按主题分批提交，**不 push**。
- accuracy 产物不随本地批次提交（除非该批就是更新评测基线）。
- Windows 换行：生成前 `toLF`；产物纯 CRLF churn 用 `git checkout --` 丢弃，不要提交。
- 别在跑批期间改生成器/文案——分组 runner 期间编辑会让“生成器比对型”守卫变红。

---

## 9. 验收记分卡

| 维度 | 当前 | 目标 | 验收方式 |
|---|---|---|---|
| antdv virtual 宣称 | 4 处“支持” | 0 处 | 文本 grep + `check:capability-parity` |
| permission 文档 | 与实现相反 | 一致 | 过时措辞守卫 |
| 默认引擎导出 | 静默 no-op | CSV 或明确失败 | 组件 spec |
| `full` 宣称证据 | 无 | 高风险 key 全有 spec 见证 | 新守卫 + 注入自证 |
| vxe JSON 键 AI 可达 | 0 / 11 | 11 / 11 | `generate_from_config` 生成 + 编译 |
| 内置文案硬编码 | ~60 处 | 0（白名单外） | `check:i18n-literals` |
| 列筛选 | 无契约 | 三端 + AI + virtual 告警 | e2e + golden |
| 表单详情模式 | 无 | `mode:'detail'` | 组件 spec |
| 性能基准 | 无 | 1k/5k/20k 基线 | 基准产物 |
| vue3/antdv e2e | 无 | 5 条交互 | Playwright |

**不承诺**：definition95 在 W2/W3 后一定到 95%。它受语料与尺子约束（当前硬上限约 83.5% 的结构性分析见既有 eval 债务），本方案的 AI 目标是**不回退 + 扩覆盖**，不是“靠加 schema 冲 95%”。

---

## 10. 风险清单

| 风险 | 触发点 | 缓解 |
|---|---|---|
| 四份镜像漏键 | W2/W3-2 新增键 | 一 key 一批；先跑 `check:tool-shapes`/`check:fragment` |
| 生成器 schema/SFC 两模式不一致 | W2 | 每键两处都加；golden 同时断言两模式 |
| 宿主可见 schema 变大导致 prompt 噪声 | W2 | 描述标“advanced/vxe only”；prompt 规则；eval 探针 |
| `exportConfig` 含函数 | W1-3/W2 | schema 只收 JSON 子集；函数留 `vxeConfig` |
| i18n 与现有 `t` 命名冲突 | W3-1 | 独立 `locale/messages` + core 字典，不复用宿主 `t` |
| 列筛选三端语义不一致 | W3-2 | 默认 `equals`；`filter-change` 归一；virtual 明确不支持 |
| 修改 `component.vue` 冲突 | W1-3 / W3-1 / W3-2 | 按 W1-3 → W3-1 → W3-2 顺序，不同分支 rebase |
| 生成物过期 | 任何文档/示例改动 | `ai:workflows → fragment:dashboard → cases:sync` |
| vxe v3/v4 键名差异 | W2 | `check:first-class-vxe-keys` |
| eval 中继抖动 | 全量跑批 | 先 `--limit` 探针；中继整段抖动时冷却等待，不快速失败 |
| 类型守卫误伤 | 新增公开类型 | `check:exports`、`check:contract`；先 grep 锚点再跑全链 |

---

## 11. 文件触达地图

| 工作包 | 主要文件 |
|---|---|
| W1-1 | `packages/shared/src/capability.ts`、`structured-config.schema.ts`、`docs/ai/ai-capability-matrix.json`、`es-plus-docs/src/docs/adapter-antdv.md`、`packages/adapter-antdv/README.md` |
| W1-2 | `es-plus-docs/src/docs/permission-i18n.md`、`faq.md`、`packages/core/src/field-resolver.ts`（只读核对） |
| W1-3 | `packages/core/src/csv.ts`（新）、`packages/core/src/index.ts`、三端 `es-table/component.vue`、`packages/core/src/types.ts:1248` |
| W1-4 | `scripts/capability-witnesses.data.mjs`（新）、`scripts/check-capability-witnesses.mjs`（新）、`package.json`、`scripts/check-consistency.mjs` |
| W2 | `packages/shared/src/structured-config.schema.ts`、`structured-generator.ts`、`packages/core/src/types.ts`、`packages/shared/src/fragment-generator.ts`、`packages/mcp-server/src/tools/_front-door-knobs.ts`、`generate-from-config.ts`、`_fragment-shapes.ts`、`packages/shared/src/capability.ts` |
| W3-1 | `packages/core/src/locale.ts`（新）、`config.ts`、`types.ts`、`constants.ts`、三端 `es-table` / `es-form` / `es-crud-page` |
| W3-2 | `packages/core/src/types.ts`、`packages/shared/src/structured-config.schema.ts`、`structured-generator.ts`、三端 `column-item` / `component.vue` / 列适配器 |
| W3-3 | `packages/vue3/src/components/es-form/src/es-form.vue`、vue2 / antdv 对应文件、`packages/core/src/types.ts` |
| W4 | `__tests__/e2e-runtime/`、`scripts/bench-table.mjs`（新）、`docs/internal/bench-*.json`（新） |

---

## 12. 一页决策摘要

- **如果只做一件事**：W1-1（antdv virtual 改口）+ W1-4（主张证据守卫）。这是“可信度”问题，不是功能问题。
- **如果做两件事**：再加 W2 Batch 2A（footer/export/toolbar/column/keepSource 接进 AI）。运行时已经支持，只差契约。
- **如果做三件事**：再加 W3-1（内置文案 i18n）。用户已经点到了这一项，且它是“多语言产品”的选型阻断项。
- **暂时不要做**：默认引擎行内编辑、跨端多列排序、antdv 虚拟滚动、全量键盘网格、表单数组。它们要么有更优的既有路径（vxe），要么成本/收益不匹配。
