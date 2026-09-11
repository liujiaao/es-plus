# es-plus 源码深度审计报告

> 审计日期：2026-09-11
> 审计对象：仓库当前工作区（HEAD = `30c7dd8` + 未提交改动）
> 方法：按模块并行静态审计（core/shared、vue3、vue2、adapter-antdv、AI 工具链、工程门禁），
> 关键结论逐条回读源码/grep 复核。

**结论标注约定**：

- `CONFIRMED` —— 可在源码上坐实（已定位到具体行、或已用探针/读取验证）。
- `SUSPECTED` —— 由代码结构推断，未构造运行时复现。

**局限**：本报告为静态分析，**未运行完整测试套件**。文中「1828 passed」「0 error / 1403 warning」
等数据引自 `.session-notes/2026-09-11-工程会话记录.md` 与子审计的实测结果，非本报告全量复跑。

---

## 一、总体判断

**架构分层是认真设计的，但「同一份配置三端共用」目前是工程口号而非可验证契约。**

最尖锐的证据：**「配置项声称支持、渲染器从不消费」这一类缺陷，在同一份代码里至少已出现四轮** ——

| 轮次 | 字段 | 状态 |
|---|---|---|
| 1 | `FormItemOption.props` / `.on`（Vue 3 静默失效） | 已于 `30c7dd8` 修复 |
| 2 | `FormItemOption.placeholder` / `.clearable` / `.disabled` | **仍在，见 C3** |
| 3 | `crud-engine` 注入的 `options.selection` | **仍在，见 C4** |
| 4 | antdv 只读 `row.attrs`、不读 `row.props` 的一组字段 | **仍在，见 A4** |

它们全都能穿过 CI。**根因是三层叠加**：

```
契约类型写得很全（文档承诺多）
        ↓
三端各自手写消费逻辑（use-form-inputs 三份独立实现）
        ↓
一致性门禁只校验名字 / 键集，不校验行为
```

三者合起来，任何一次「忘了接线」都不会被发现。

---

## 二、架构评价

### 2.1 做对的

- `core` 是真正的框架无关层：请求、分页、跨页选择、栅格、字段解析均为纯函数，无 Vue 依赖。
- `shared` 承载生成器 / Zod / 脚手架；依赖方向单向，**core 与 shared 内部均无循环依赖**。
- vue3 → antdv 的 `use-form-layout` / `use-form-request` / `use-table-resize` / `render-dom-tb`
  逐行近乎相同；**只有 `use-form-inputs`（301 vs 542 行）与表格选择各端独立重写** ——
  因为 ADV 的 v-model 字段名、组件名、事件名确实不同。该选择合理，代价是 14 种控件的语义靠人肉对齐。

### 2.2 做错的

- **分层污染**：`packages/core/src/constants.ts:3-11` 声明常量源自 `shared/contract`，
  实际是手抄副本，两边已各自漂移。
- **重复定义**：`normalizeFormType` 存在 4 份（`core/constants.ts:51`、`core/compat.ts:20`、
  `shared/contract.ts:21`、`shared/constants.ts:70`）；`getButtonPosition` 2 份；默认映射 2 份。
- **类型契约偏弱**：
  - `method?: 'GET'|'POST'|'PUT'|'DELETE'|string`（`packages/core/src/types.ts:81`）、
    `fixed?: boolean|'left'|'right'|string`（同文件 `:348`）—— 字面量联合被 `| string` 吞掉，约束失效。
  - `FormItemOption` / `BtnConfig` / `TableColumn` / `TableOptions` / `DialogOptions`
    **全部带 `[key:string]:unknown` 索引签名**，打字错误静默通过。这直接掩盖了后文若干 bug。
  - `EsTableInstance.httpRequestInstance: (model?) => Promise`（`types.ts:948`）与运行时
    `(model, { keepPage })`（`core/src/pagination.ts:26-31`）签名不符。

---

## 三、P0 缺陷（CONFIRMED）

### C1｜请求 Promise 永久挂起 → 远端下拉选项卡死

**位置**：`packages/core/src/request.ts:188`、`:215-245`

`queryTableListMethod` 只在 `res` 为非空对象/数组时才调用 `success`：

```ts
.then((res) => {
  if (typeof options.success === 'function' && res && (isObject(res) || Array.isArray(res))) {
    options.success(res)
  }
})
```

而 `httpRequestFormInstance` 返回的 Promise **只在 `success` / `fail` 回调里 settle**。
当 httpRequest resolve 出 `undefined` / `null` / 字符串 / 数字（204 空响应、业务拦截器 `return undefined`
极常见）时，`then` 与 `catch` 都不触发 → **Promise 永不 settle**。

**影响**：`getEveryFormQueryField`（`request.ts:295`）用 `wrapPromise` 包裹后 `Promise.all` 永不 resolve，
**远端下拉选项整体加载不出来**（表单挂起，无报错）。这是本次审计中影响面最大的一条。

**同类缺陷（本次复核发现，已一并修复）**：三端表格组件的**本地**请求函数同样以
`isObject(res) && Object.keys(res).length` 为 success 守卫（`vue3/.../es-table/src/component.vue:733`、
`adapter-antdv/.../es-table/src/component.vue:852`、`vue2/.../es-table/component.vue:1086`），
空响应（204 / 拦截器 `return undefined`）与数组响应都会跳过 success，而 `httpRequestInstance`
的 Promise 只在 success/fail 中 settle → **表格加载同样会永久挂起**。三端已一并修复。

### C2｜antdv 生成的 wrapper 不可编译

**位置**：`packages/shared/src/schema-generator.ts:207`、`:226-228`

`buildElementImport`（`packages/shared/src/target.ts:75-86`）按 target 重命名导入符号：
`ElMessageBox → Modal`、`ElMessage → message`。但 Vue3 / antdv 共用的 `<script setup>` 分支
直接 `return lines.join('\n')`，**从未调用 `rewriteElementUsage`**（对比 vue2 分支 `:159` 有调用）。

产物中 import 了 `Modal` / `message`，函数体却仍是：

```js
ElMessageBox.confirm('确定删除该条数据吗？', '提示', { type: 'warning' })
ElMessage.success('删除成功')
```

→ 生成代码引用未定义符号，**antdv 产物不可编译**。另 `buildSummary`（`:226-228`）把 antdv
标成 `Target: Vue 3 + Element Plus`。

### C3｜`placeholder` / `clearable` / `disabled` 三端静默丢弃

**位置**：`packages/core/src/compat.ts:194`（`normalizeFormItem`）

`FormItemOption` 文档承诺这三个顶层快捷字段会「自动注入 attrs」（`packages/core/src/types.ts:149-154`），
由 `normalizeFormItem` 实现。但全仓库 **除 core 自身定义 / 导出 / 测试外零调用**（已 grep 确认）；
三端渲染器既不调用它，也不直接读 `row.placeholder`。

→ 用户在 `formItemList` 里写的 `placeholder` / `clearable` / `disabled` **在三端全部无声失效**。
与刚在 `30c7dd8` 修复的 `props` / `on` 完全同类，且同样无测试覆盖。

### C4｜`crud-engine` 注入的 `selection` 是死配置

**位置**：`packages/shared/src/crud-engine.ts:413`

自然语言解析命中「跨页 / 批量审核」等关键词时注入 `patches.selection = true`，
但三端渲染器只识别 `options.multiSelect`（`vue3/.../use-column-adapter.ts:61`、
`use-vxe-column-adapter.ts:36`、`vxe-engine.vue:178`；vue2 / antdv 同）。

→ **选择列根本不渲染**。`crud-engine-presets.spec.ts:192` 只断言 `cachePageSelection`，
未断言列出现，故漏网。

### C5｜antdv Transfer 标题全空、`dataOptions` 失效

**位置**：`packages/adapter-antdv/src/composables/use-form-inputs.ts:287-291`

该分支只把 EP 的 `data` 改名为 ADV 的 `dataSource`，**未把 EP 的 `label` 映射为 ADV 的 `title`**
（`ant-design-vue/es/transfer/index.d.ts:14-16` 确认为 `TransferItem.title`）。
且 Transfer 分支从不读 `row.dataOptions` —— es-plus 的标准选项字段完全失效。

→ Transfer 列表项**无标题**。

### C6｜antdv 嵌套 prop 校验必错

**位置**：`packages/adapter-antdv/src/components/es-form/src/es-form.vue:21`

模板用 `:name="item.prop"`，`prop` 为 `'user.name'` 时作为**单个键**传入。
ADV 的 `getNamePath = toArray`（`ant-design-vue/es/form/utils/valueUtil.js:12`，
其注释明说不支持 `a.b.c` 拆分），校验读取 `model['user.name']` = `undefined`。

→ **能输入、校验必错**（数据绑定走 `getNestedValue` 正常）。EP 的 `prop="user.name"` 原生支持，
属**跨端行为分歧**。

### C7｜vue2 单行按钮布局下 `triggerEvent` 无效

**位置**：`packages/vue2/src/components/es-form/es-form.vue:112`（另 `:60`）

`btnColSpanRow = false` 的单行布局用 `handleBtnClick`，该方法只调 `it.click?.()`
（`es-form.vue:516-520`），**不处理 `triggerEvent`**；右栏按钮（`:76`）才用 `clickBtn`。
vue3 全路径统一 `clickBtn`（`vue3/.../es-form.vue:60`）。

→ 该布局下内置**查询 / 重置按钮点击无效**，且无提示。e2e 未覆盖此布局。

### C8｜CLI 路径遍历

**位置**：`packages/cli/src/utils/strings.ts:24-28` + `packages/shared/src/structured-config.schema.ts:122`

`name: z.string().min(1)` 不限字符集；`toPascalCase` 只处理 `^`/`-`/`_` 的字母大写与 `-`/`_` 剥离，
**不剥离 `/`、`\`、`..`**。随后：

```ts
const outputPath = resolve(process.cwd(), output)
const wrapperFile = resolve(outputDir, `${pascalName}.vue`)
```

→ `es-plus create --from-config` 载入不可信 / LLM 生成的 config 时，可写出目标目录之外
（`-o/--output` 亦接受任意绝对路径）。无 shell 执行，风险限于本地。

**同类入口（本次复核发现，已一并修复）**：`scaffold` 命令的 `<name>` 同样直接进入
`resolve(process.cwd(), options.output || \`src/views/${toPascalCase(name)}.vue\`)`
（`packages/cli/src/commands/scaffold.ts:25-28`），已加同一 `isSafePathSegment` 守卫。

---

## 四、P1 缺陷

### 渲染层

- **vue3 分页 / 请求竞态**（CONFIRMED）：`vue3/.../es-table/src/component.vue:717-722` 用全局
  `loadingStatus` 锁，在途时直接 `fail(new Error('request already in progress'))`；
  而 `handleIndexChange` / `handleSizeChange`（`:851-870`）**先改页码再发请求**。
  快速翻页 → 页码跳了、数据是旧页、还弹 request-error，失败不回滚。无请求序列号 / cancel。
- **`modelValue` 可被透传覆盖**（CONFIRMED）：`vue3/.../use-form-inputs.ts:63-69` 等，
  `rowPassThrough(row)` 在 `modelValue` 之后展开。用户 `props/attrs` 带 `modelValue`
  → 输入框与 model 脱钩且静默。
- **运行期快照失效**（CONFIRMED）：`useTableResize` / `useVirtualSelection` / `useColumnAdapter`
  把 `heightType`、`tabHeight`、`rowkey` 以**原始值**传入（`component.vue:532-541`、
  `virtual-engine.vue:93,120-135`）。运行期改 `options` 不生效。
- **vue2 响应式**（CONFIRMED）：
  - `vue2/.../es-form.vue:620` `formItemRowsList.value[itemIndex] = {...}` 数组下标赋值
    → 远端字段选项重载后不刷新视图。
  - `vue2/.../es-dialog/render-jsx.vue:102,123` 向 `reactive({})` 直接追键，同样不驱动重渲染
    （正确写法见 `es-crud-page.vue:103` 用 `set()`）。
- **vue2 dialog 300ms 销毁竞态**（CONFIRMED）：`vue2/.../use-dialog.ts:263-271` 等，
  延迟销毁回调引用可变 `lastVm` / `vm`；关闭后 300ms 内重开会销毁新弹窗。
- **vue2 `closed` 时序分歧**（CONFIRMED）：`es-dialog/component.vue:335-346` 在
  `dialogVisible` setter 内同步 emit `closed`，el-dialog 原生 `@closed`（动画后）被空实现吞掉。
- **antdv 只读 `row.attrs`、不读 `row.props`**（CONFIRMED，系统性问题）：DatePicker `type`
  （`use-form-inputs.ts:147`）、Input `type`（`:167`）、Switch `active-value`（`:373-380`）、
  Rate `texts/max`（`:395-396`）、`resolveValueFormat`（`:92-94`）。
  → `props: { type: 'textarea' }` 被静默忽略，放 `attrs` 才生效，同名配置放错袋行为完全不同。
- **antdv Upload `limit` 未映射为 `maxCount`**（CONFIRMED）：`use-form-inputs.ts:401-481`，
  限制数被忽略；`on-exceed` 在 ADV 无对应事件。
- **`dataOptions.disabled` 三端全丢**（CONFIRMED）：Select / Radio / Checkbox 只透传 label/value
  （antdv `:208-210` / `:337-339` / `:356-358`），禁用项可点。
- **antdv ColorPicker 降级**（CONFIRMED）：`:252-275` 渲染原生 `<input type="color">`，
  丢失 alpha / predefine / clearable / disabled，且不触发 a-form-item 的 fieldChange，
  change / blur 触发式校验失效。

### AI 工具链

- **未知键静默剥离**（CONFIRMED）：全库无任何 `.strict()`，Zod 对象默认 strip。
  LLM 幻觉字段（如文档明令禁止的 `position`）被无声删除、无 warning。
- **两套 schema 漂移**（CONFIRMED）：MCP 手维护 zod 副本（`mcp-server/.../generate-from-config.ts:91-211`）
  与权威 schema（`shared/.../structured-config.schema.ts:121-160`）不一致（如 `toolbarBtns.triggerEvent`），
  漂移部分无守护。
- **schema 模式静默丢配置**（CONFIRMED）：丢 `pagination.pageSizes`（`structured-generator.ts:157`）、
  丢顶层 `permissions`；new-dialog 分支不再写 `schema.actions`（`:117-148`），
  渲染器回退默认增删改（`vue3/.../es-crud-page.vue:114,136,156`）。
- **自带 few-shot 例 5 不可用**（CONFIRMED）：`nl-to-config-examples.ts:141-169` 的 `dialogs`
  无 `toolbarBtns`，渲染器在 dialogs 存在时不自动生成工具栏按钮（`es-crud-page.vue:133`），
  「新增」弹窗无入口且无 warning。
- **eval 自证**（CONFIRMED）：`scripts/eval-llm.mjs:52-59` 把与 few-shot 逐字相同的 golden
  case 04/05/06 标成 heldout，headline 准确率被系统性抬高。
- **「零 TODO」不成立**：结构化 SFC 模式（`structured-generator.ts:429`）、schema 模式（`:803`）、
  NL fallback（`schema-generator.ts:119,130,144,148`、`code-generator.ts:675,677,706,754`）均有桩。
  仅「结构化 + 无 import/render」路径接近零 TODO。

### core / shared

- **缺 rowkey 的行被静默剔除**（CONFIRMED）：`core/src/table-selection.ts:87`，
  行缺 `rowkey` 字段时不计入，`multipleSelection` 变空；rowkey 为对象时 `String(key)='[object Object]'`
  还会互相去重。
- **Zod 默认值不生效**（CONFIRMED）：`structured-generator.ts:47` 不调用
  `StructuredCrudConfigSchema.parse`，而 schema 声明 `typescript` 默认 `true`
  （`structured-config.schema.ts:148`），导致默认行为与文档不一致。
- **`findValueByKey` 深层覆盖浅层**（CONFIRMED，语义歧义）：`shared/src/shared.ts:94-104`，
  `{total:5, meta:{total:99}}` 返回 99；`shared.spec.ts:93-96` 已把该行为固化为测试。
- **`selection` 状态列 render 被丢弃**（CONFIRMED）：`schema-generator.ts:47-53` 解构掉 `render`
  却不补 `scopedSlots`，`ElTag` 成死导入（`:106-108`），违反本项目「标记而非静默丢弃」原则。
- **远端选项无法依赖当前表单值**（CONFIRMED）：`request.ts:281-287` 只传 `{...apiParams.model}`，
  函数本身无 model 入参，级联下拉（选省后拉市）无法实现。

---

## 五、系统性问题

### 5.1 「声明多于实现」是慢性病

`types.ts` 写明 `placeholder/clearable/disabled` 自动注入、`props` 与 `attrs` 合并透传、
`EsPlusGlobalConfig.EsForm.rules` 可用 —— 前者从未接线、后两者刚修。
**契约类型成了愿望清单。**

### 5.2 门禁只验名字，不验行为

四个「同构」守卫均可被真实缺陷绕过：

| 脚本 | 实际校验 | 反例（可绿灯放行） |
|---|---|---|
| `check-type-exports.mjs:37-65` | 正则抽 `export type {}` 的**名字** | `export type FormType = any`；指向同名错误结构 |
| `check-renderer-parity.mjs:46-50` | 只抽 Map 的**键** | 把 `'DatePicker': DatePicker` 改成指向 `TimePicker` 实现 |
| `check-exposed-api.mjs:76-137` | 纯键集，跳过 spread | `close: () => {}` 空实现；`validate: (...a)=>true` |
| `check-generator-contract.mjs` | 文本出现在任意位置 | 加一行 `// httpRequest` 注释即通过 |
| `check-schema-contract.mjs:67-110` | **唯一做真校验**，但字段白名单手写 | core 新增契约字段而不动 schema |

另：`es-plus-docs/src/schemas/*` 是**第三、四份手写 schema**，不在任何 `sync-*` 的 TARGETS 内、
不受漂移门禁约束，却会被 `deploy-docs` 发布。

### 5.3 测试偏「不抛异常」

- `adapter-antdv/__tests__/scenario-form-all-types.spec.ts:40-44` 多数只断言不抛异常。
- `shared` 大量 `toContain` 字符串断言生成源码，不校验生成代码的符号一致性 ——
  C2 / C4 / C5 / C6 全部因此漏网。
- 无覆盖率门禁：仅 `packages/core/vitest.config.ts:6-11` 配了 reporter，无 thresholds，CI 不跑 `--coverage`。

### 5.4 提交纪律

- **232 个** `packages/*/build/**` 编译产物入库（`.gitignore` 只忽略 `dist/`），源码与产物有漂移风险。
- 本次修复的**两个回归测试文件 + changeset 至今 untracked**
  （`packages/vue2/__tests__/es-form.spec.ts`、`packages/adapter-antdv/__tests__/es-form.spec.ts`、
  `.changeset/fixed-form-escape-hatches-and-validation.md`），意味着 HEAD 上 CI 跑不到它们。
- lint 未进 CI；无 publish job，发布 100% 手动（且 npm 写操作 403 未解决，见会话记录第六节）。
- `deploy-docs.yml` 无 `paths` 过滤、无 `needs`，与 typecheck/e2e 并行，破坏 mcp-server 的提交也会照常部署。
- 无 `.gitattributes`。

---

## 六、纠正既有说法

- **默认尺寸「分歧」不是 bug**：vue2 有 `packages/vue2/src/utils/size.ts` 做语义映射
  （`small → mini`，因 Element UI 无 24px 档），是有意设计，且 `mapSize` 已把 EP 的 `large/default/small`
  映射到 EUI 的 `medium/small/mini`。此前会话记录把它列为「行为分歧」不准确。
- **CRLF 说法不准确**：仓库 blob 实为 LF（`git ls-files --eol`：`i/lf` 1079、`i/none` 108），
  是 `core.autocrlf=true` 让 **779 个工作区文件**检出为 CRLF，而非「1186 个 blob 含 CRLF」。
- **`DatePicker` valueFormat 回写类型分歧属实**：`valueFormat` 未配置时，vue3 / vue2 回写原生
  `Date`（`vue3/.../use-form-inputs.ts:214-237`），antdv 回写 dayjs
  （`adapter-antdv/.../use-form-inputs.ts:106-123,491-499`，代码注释自认「必要偏离」）。
  `model.date.getTime()` 在 antdv 会抛错。

---

## 七、修复优先级建议

> **修复进展（2026-09-11）**：`立即` 档 5 条（**C1 / C2 / C3 / C4 / C8**）已修复，各自补齐回归测试并
> 逐条反向验证（临时拆掉修复 → 测试变红）。C3 按决策采用「接线 `normalizeFormItem`」方案。
> 复核阶段另发现并修复了两处**同类遗漏**：三端表格本地请求函数的 settle 守卫（C1 同类）、
> `scaffold` 的 `<name>` 路径穿越（C8 同类）。全量 7 包 typecheck 全过、lint 0 error、
> `check:consistency` 全绿。变更记录见 `.changeset/fix-request-settle-and-codegen-traversal.md`。
> **`结构性` 档（6–10）本轮未动。**

### 立即（发版前必须）

| 序 | 对应 | 动作 |
|---|---|---|
| 1 | C1 | 修 `request.ts` 的 settle 缺失：非对象/空响应也应 settle（成功或失败），避免 Promise 悬空 |
| 2 | C2 | `schema-generator.ts` script-setup 分支补 `rewriteElementUsage`；修正 `buildSummary` 的 target 文案 |
| 3 | C3 | 接线 `normalizeFormItem`（或删除该契约字段）——二选一，别让它继续骗人 |
| 4 | C4 | `crud-engine.ts:413` 的 `selection` → `multiSelect` |
| 5 | C8 | CLI `name` 加字符集约束，`resolve` 后校验仍在 outputDir 内 |

### 结构性（决定能否兑现「三端同构」卖点）

6. **补行为层 parity 断言**：同一个 `formtype`，三端渲染出的**能力集**必须一致，而不只是键存在。
   这是把口号变成契约的唯一办法。
7. **加「契约字段必须被消费」静态检查**：扫描 `FormItemOption` 等契约类型字段，排除白名单后，
   要求每个字段至少被一个渲染器读取。可一次性挡住整类静默失效。
8. 落地并发翻页的请求序号 / 取消；给 antdv 补 `attrs` + `props` 合并读取；antdv Transfer 映射
   `label → title` 并消费 `dataOptions`；嵌套 prop 用数组 name path 传给 `a-form-item`。
9. 工程卫生：提交 untracked 测试与 changeset、`build/` 移出版本库、lint 进 CI、
   `deploy-docs` 加 `needs`/`paths`、补 publish job（发版前先验证 npm 写权限）。
10. 修 `check-*` 脚本的白名单化与文本匹配，使其能发现行为分叉。

---

## 附录：审计覆盖与证据来源

- core / shared：`packages/core/src`、`packages/shared/src` 全量读。
- 渲染器：`packages/{vue3,vue2,adapter-antdv}/src` + `__tests__`。
- AI 工具链：`packages/{mcp-server,cli}` + `shared` 生成器。
- 基础设施：`scripts/`、`.github/workflows/`、各包 `package.json` / 构建配置、`__tests__/`。
- 本次审计期间**未修改任何产品代码**。
