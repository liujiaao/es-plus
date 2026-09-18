# es-plus 深度分析报告

> 分析日期：2026-09-15
> 范围：8 个库包（~31k 行）+ 3 个文档站（~87k 行）+ 工程基建
> 方法：四路并行静态审计（core/shared · 三渲染器 · AI 工具链 · CI/发布），关键结论回读源码复核，并实际执行 `npm test`、`npm run check:consistency`、npm registry 查询做交叉验证。
> 标注：`[已核实]` = 本次亲自执行命令/读源码坐实；`[待核实]` = 子审计推断未二次验证。
> 状态图例：⬜ 未修 · 🔧 修复中 · ✅ 已修 · ⏸ 待决策

---

## 一、项目全貌（实测数据）

| 维度 | 实测 |
|---|---|
| 定位 | 企业级 CRUD 组件库：配置驱动 + AI 原生，一份配置三端渲染 |
| 仓库 | npm workspaces monorepo，8 个包，200 commits（2026-05 起，9 月最活跃） |
| 库代码 | ~31k 行（vue3 6.7k / vue2 7.3k / antdv 6.8k / shared 3.4k / core 3.1k / mcp 3.1k / cli 0.75k） |
| 文档站 | 3 站 ~87k 行（es-eui 40.8k / es-plus-docs 31.9k / es-pc 14.7k） |
| 测试 | **76 文件 / 1928 用例，全绿**（`npm test` 退出 0）`[已核实]` |
| 门禁 | `check:consistency`（15 项）通过 `[已核实]` |
| 发布 | 7 个包已上 npm，最新版与本地 `package.json` 一致；`es-plus-ui` 冻结 1.4.0 `[已核实]` |
| 真实采用度 | **~170–235 下载/月/包** —— 接近爬虫/镜像噪音，实质零用户 `[已核实]` |
| 语言 | 中文注释与文档，面向国内中后台团队 |

**一句话判断**：这是一个**工程质量明显高于其市场验证度**的项目。代码组织、单源同步、契约门禁的成熟度，远超 ~30k 行、零用户开源项目的中位水平；但「三端同构」这个核心卖点，在**配置层为真、行为层半真、命令式 API 层为假**。

---

## 二、架构评价：分层是真的，下沉是成功的

`@es-plus/core` 是真正的框架无关层（零依赖，不 import vue），三个渲染器确实消费它：

- **语义一致性做得好**：`PUBLIC_CONTRACT_TYPES` 由 CI 强制三端同名导出；formtype 的 Map key 三端相等由 `check-renderer-parity.mjs` 锁定。
- **下沉彻底的部分**：表单布局算法、请求链路（三端 `use-form-request` 都委托 core）、跨页选择状态机、vxe 配置映射、按钮/规则归一化。
- **下沉不彻底的部分**：`calculateAutoSpan`、`shouldShowFoldButton`、`getBtnColSpan` 在 core 里已存在，但 **vue2 和 antdv 各自内联重写了一遍**，只有 vue3 调用 core。

`docs/refactor-design.md` 诊断的 P0（formtype 三分叉、请求层绕过 core、inject key 拼写错、`cachePageSelection` 失效、`@ts-nocheck`）——逐项回读源码，**基本已修复**：全库仅剩 1 处 `@ts-nocheck`（`packages/vue3/src/components/es-table/src/component.vue:135`，带明确理由），测试数从基线 core 209/shared 258/vue3 425/vue2 272/antdv 466 增长到 250/277/463/299/537。

**结论**：这个仓库的「自我修复能力」是被验证过的——它有一份准确的自我诊断文档，且真的照做了。

---

## 三、核心卖点检验：「一份配置三端渲染」

### 成立的部分（CI 强制）

- 14 种 formtype 三端全部存在且绑定正确组件 —— 契约测试锁死。
- `FormItemOption` 顶层快捷字段（`placeholder`/`disabled`）经 `normalizeFormItem` 三端都到达控件。
- EsTable/EsForm/EsDialog 的 expose key 集合三端一致 —— CI 锁死。
- vxe 一等公民 API 三端齐备。

### 不成立的部分（无门禁，实测存在）

`scripts/check-renderer-parity.mjs` 是**名字级**门禁，看不到「属性被静默丢弃」。

#### P0-1：antdv 静默吞掉 `clearable` / `filterable` ⬜ `[已核实]`

```
grep -rn "allowClear\|showSearch\|maxTagCount\|showCount" packages/adapter-antdv/src/
→ 0 命中
```

- `clearable` 被 antdv 自己的类型声明为一等选项（`packages/adapter-antdv/src/types/index.ts:29`），core 的 `normalizeFormItem` 会把它注入 `attrs`，然后**原样透传给根本不认这个 prop 的 ADV 组件 → 无任何警告地失效**。
- `filterable` 同理（ADV 只认 `showSearch`）→ **远程搜索 Select 在 antdv 站不可用**。
- 推翻 `packages/adapter-antdv/README.md:104` 的「配置 API 完全一致」与 `:126` 的「配置 Schema 100% 兼容」。

#### P0-2：antdv 插件重复注册（注释在撒谎）⬜ `[已核实]`

`packages/adapter-antdv/src/index.ts:48` 注释写「完全对齐 vue3」，但 vue3 在 `packages/vue3/src/index.ts:24-31` 有一段专门的守卫，注释里明确写着这正是为了避免 `"Component xxx has already been registered"` 告警：

```ts
// vue3
if (willInstallPlugins && component.isPlugin && component.Plugin) return
```

**antdv 把这段守卫漏掉了**，于是 `app.component(name, comp)` 与 `app.use(comp.Plugin)` 重复注册同一个名字 → dev 环境必刷告警，且最终生效的是后注册的 Plugin 版本。

#### P1-1：默认列对齐三端不一致 ⬜ `[已核实]`

- vue3 / vue2：`column-item.vue:126-128` 强制 `align='center'`
- antdv 默认引擎：`column-adapter.ts:34` 只在显式传了 `align` 时才设置 → 落到 ADV 默认的 **left**
- antdv 自己的 vxe 引擎走 `use-vxe-column-adapter.ts:120` 又是 `center` → **同一个库内部自相矛盾**

#### P1-2：命令式 API 不同构（用户代码会挂）⬜

| API | vue3 | vue2 | antdv |
|---|---|---|---|
| `useDialog` 返回 | `{instance, close, destroy}` + `cacheKey` + 10min TTL | 同 vue3 | **裸 vNode，无 cacheKey、无 DialogResult** |
| `validateField` | `Promise<boolean>` | **`void`**（await 不会等待） | `Promise<boolean>` |
| `update:dataSource` | 有 | **无**（刻意移除） | 有 |
| 虚拟滚动 | 支持 | **不支持**（降级告警） | ADV 原生 |

`check-exposed-api.mjs` 只比对 key 名字，不看签名与语义 → 这四处**全部无门禁**。

#### P1-3：`sortable` 语义在 antdv 被改变 ⬜ `[已核实]`

`column-adapter.ts:49-51` 把 `sortable:'custom'`（EP 语义 = 服务端排序）映射为 `sorter: true`（ADV 语义 = **本地排序**）→ 点击表头会先本地重排当前页。注释声称「对齐 vue3」，实际引入了 vue3/vue2 没有的行为。

#### 其他已核实的问题

- antdv 无 `key`/`prop` 的列生成 `col_${Math.random()}` 作 key（`column-adapter.ts:27`）→ 每次重算身份都变，破坏 a-table 列状态。
- `emptyText` 是声明过的选项，但 vue3/vue2 默认引擎**硬编码「暂无数据」**忽略它。
- vue2 的 `lazyLoad` 是独有能力；反向地，`virtual` 对 vue2 无效。

---

## 四、文档/工具链侧的信任问题

### 已核实的矛盾：MCP 给 LLM 的指引自相矛盾 ⬜ `[已核实]`

- **类型资源**（`esplus://types` 实时读渲染器源码）说：`position` 是推荐写法，**`code` 已 `@deprecated`**（`packages/vue3/src/types/index.ts:115-118`）。
- **约定资源**（`esplus://conventions`）说：`code` 是唯一权威，**「Do NOT use a `position` field」**（`packages/mcp-server/src/resources/conventions.ts:423-428`），理由写的是「vue2 会忽略 position，破坏多端同构」。
- **示例资源**（`esplus://crud-page-schema`）又**通篇使用 `position`**（`crud-page-schema.ts:110` 等 6 处）。

**实测纠正**：`position` 在 vue2 里**是生效的** —— vue2 的工具栏 `table-btns.vue:168` 和 CRUD 页 `es-crud-page.vue:276-277` 都走 core 的 `getButtonPosition`，而该函数**优先读 `position`**。

真实缺陷不是「position 破坏同构」，而是**两个叠加的问题**：

1. conventions 里那句理由是陈旧的、错误的，它把宿主 LLM 推向一个本已废弃的字段，且三种资源互相打架；
2. **更严重的是：`position` 会被静默改写。** `StructuredCrudConfigSchema` 的 `TableBtnSchema` 只声明了 `code`，而 Zod 默认 strip 未知键 —— 实测 `{ name: '新增', position: 'right' }` 经 `safeParse` 后变成 `{ name: '新增', code: 1 }`：**解析成功、零告警，按钮从右侧跑到左侧**。

第 2 点意味着「AI 生成 → 用户拿到页面」的链路上存在一条无提示的错误路径，而且它被 `check-schema-contract.mjs` 主动加固着 —— 该脚本当时有一条规则**禁止 `position` 出现在 tableBtns 中**，理由同样写着「vue2 忽略它」。即：一个基于错误事实的守卫，把正确的写法挡在门外，同时放行静默错误。这也解释了为什么 golden 语料 24 个用例里**没有任何一个使用 `position`** —— 该路径从未被测过。

### 文档站 AI 路径是「平行宇宙」⬜

`es-plus-docs/src/utils/mcp-flow.ts` 自己手写了一份 prompt（`:146-197`），**从不 import shared 的 `buildNlToConfigSystemPrompt`**，因此：教的是已废弃的 `datePicker` 拼写、`target` 枚举缺 `antdv`、示例弱于官方 few-shot。shared 侧任何 prompt 改进都到不了浏览器演示页。

同理，「NL → 配置」这条链路在仓库里有 **4 份独立实现**（CLI `--ai` / MCP / 文档站 / eval），修复循环有 3 份。

### 数字漂移（无门禁）⬜ `[已核实]`

- 根 `README.md:47` 声称 **「38 个跨渲染器契约类型」**，实测 `PUBLIC_CONTRACT_TYPES` 只有 **35 个**。
- `docs/ai/ai-tools.md:22` 引用不存在的工具名 `generate_from_config`（实际 `generate_crud_from_config`）。

---

## 五、工程基建：门禁很多，但漏点集中在「能自动变绿」的地方

### 做得好的

- 单源同步体系（8 个 sync + 对应 check），缺目标即报错（此前审计已加固）。
- PR 会构建三个文档站。
- golden 语料 23 个用例，分两层：**L1 确定性打分（PR 跑，免费）/ L2 真实 LLM 评估（夜间，`exactIntent` ≥ 0.95）**，且特意把 6 个 few-shot 派生用例单列，避免「背 prompt」被算成泛化能力。

### 关键漏洞（按危害排序）

1. **`publish.yml` 目前是未跟踪文件** → GitHub 根本不运行它，**当前不存在任何发布自动化**。`[已核实]`
2. 即便提交，`push: tags: ['v*']` 触发器**永远不会被 changesets 流程命中**：changesets 打的是 `@es-plus/vue3@1.5.1` 这类 per-package tag。且 `changeset publish` **不会 push 它创建的 tag**，配合 `contents: read` 权限，tag 只存在于临时 runner 上即消失。
3. 该 workflow 只跑 `changeset publish`、**不跑 `changeset version`** → 以当前 6 个未消费的 changeset 文件 + 版本已与 npm 一致的状态，手动触发会打印 "No unpublished projects" 然后**绿灯退出，什么都没发布**。
4. **`sync-docs.mjs` 可被删除「绕过」**：只校验源与目标的**交集**。删掉 `es-plus-docs/src/docs/why-es-plus.md`，该文件就退出被检查集合，`docs:check` 依然打印「一致」并退出 0——**而站点页面已经没了**。
5. **`sync-tri-render.mjs` 在源缺失时报告「0 个文件一致」并绿灯**。
6. **formtype 清单存在 3 份手写副本**，而 `check-schema-contract.mjs`（锚定 `core/constants.ts`）与 `check-renderer-parity.mjs`（锚定 `shared/contract.ts`）**之间没有连线**。
7. **PR 层 golden 打分从不编译**（只做字符串匹配）→ 语法错误的生成代码能通过唯一的 PR 门禁；真正的编译验证只在夜间跑，且不阻塞部署。
8. **`deploy-docs` 只依赖 Typecheck workflow**，不依赖 e2e → **e2e 挂了照样部署三站**。
9. `@es-plus/mcp-server` 的 `build`/`bundle-types` 在 CI 中**从不执行**，首次运行发生在发布时的 `prepublishOnly`。
10. `es-plus-legacy` 完全不在任何 workflow 中；且被 `.changeset/config.json` `ignore` → 永远不再 bump，其 `^1.5.0` 依赖在 vue3 升 2.0 时会变成不可满足的悬空。
11. `test:coverage` 从未接入 CI，且**本身是坏的**（没有任何包声明 `@vitest/coverage-v8`）→ 全仓零覆盖率度量。
12. ESLint `--max-warnings 9999`，当前已有 **1491 条 warning** → 等于只拦 error。

---

## 六、安全与代码质量

### 真实风险

- **生成代码注入面**：`FieldConfig.formatter` / `render` 是自由函数源码字符串，`q()` **刻意不转义**它们，直接拼进生成的 SFC（`packages/shared/src/structured-generator.ts:819`、`:908-909`）。路径穿越防护扎实（`isSafePathSegment` + `isPathInside` + zod refine，有测试），但**代码内容无任何沙箱或 AST 校验**。任何不可信来源的配置（LLM 输出、下载的 JSON、贡献者 PR）都等于任意代码执行。
- **文档站 API Key 走浏览器**：`AiCrud.vue` 把 key 从浏览器发到可配置的 `baseUrl`；生产 CORS 方案至今空缺。
- ~~**es-eui 遗留问题仍在**~~ **已全部处理（2026-09-18 复核）**：本条当初记录的两件事现在都不成立 ——
  内网域名硬编码（`https://wdshop-be.szlanyou.com`）与孤儿目录 `src/views/salesPolicy/` 已在更早一轮清除
  （现全库检索 `szlanyou`/`dfwxfw` 为 0 命中）；`package.lib.json` / `PUBLISH_GUIDE.md` / `test-project/`
  等发布残留已按「只清无引用的发布残留」决策删除（连同 `vue.lib.config.js`、`LIBRARY_README.md`、
  `PAIN_POINT_ANALYSIS.md`、`README_DETAILED.md`、`plans/`、`scripts/*.bat`、`.npmignore` 与跑不通的
  `build:lib`）。**保留此条是为了记录它曾被判定为遗留风险，勿据此再报一次。**
- **勘误（复核后修正，2026-09-18 追加结论）**：上一轮审计把 `es-eui/src/views/test/RechargeRecord.vue`
  描述为「反被路由暴露到公网」暗示风险，复核后不成立 —— 该页使用**公开** API
  `https://dummyjson.com/users`，文件头注明其用途是演示 `brcb` 与 Vue 2.6 + Composition API 兼容性，
  `TODO:237` 是「此处替换为真实接口」的常规模板提示。**它不是安全问题。**
  但后续按「公网可达的测试页不值得留在路由表里」另行处理：路由 `/test/recharge-record` 已移除
  （该能力有专用 CI 覆盖：`__tests__/e2e-runtime/tests/vue2-crud.spec.ts`），页面移到
  `src/examples/vue2-compat/` 作为参考示例保留，文件头补注了「无路由、数据源是外部公开 API」。

### 一般质量问题

- `any` 密度集中在重复代码处：antdv 207 / vue3 182 / vue2 157 处。
- 死代码：core `filterVisibleFormItems`、`applyAutoSpan`、`splitButtonsByDirection`、`normalizeButtonsHideState` **零消费者**；`normalizeFormType` 有 **4 份实现**；`shared/src/constants.ts` 的导出不可达。
- 三端同构的真相：**`es-crud-page.vue` 在 vue3/antdv 间约 74% 逐字相同，`use-vxe-column-adapter.ts` 约 90% 相同**——渲染层本质是三份 fork。
- vue3 的 `tsconfig` 是 `strict: false`；三个渲染器的 dts 插件都设了 `skipDiagnostics: true` → **类型错误无法阻止发布包产出 .d.ts**。

---

## 七、优先级建议

### 第一梯队（用户必撞，且当前无门禁）

1. 补 antdv 的 `clearable→allowClear`、`filterable→showSearch`、`collapse-tags→maxTagCount`、`show-word-limit→showCount` 映射，并加**属性级**契约测试。
2. 修 antdv `install()` 重复注册，并纠正「完全对齐 vue3」注释。
3. 统一三端默认列对齐，antdv 内部两引擎也要一致。
4. 修 `useDialog` / `validateField` / `update:dataSource` 的三端 API 差异，或至少在文档中列出差异表。

### 第二梯队（信任与证据链）

5. 清理 MCP 资源里 `position` vs `code` 的三方矛盾口径（`position` 三端都 work，删掉错误理由即可）。
6. 修好 `publish.yml`：改用 changesets 实际 tag 格式或 `workflow_dispatch`、加 `changeset version`、给 `contents: write` 并 push tags。
7. 堵 `sync-docs.mjs` 的交集漏洞、`sync-tri-render.mjs` 的空集绿灯。
8. 让 golden L1 至少做语法校验，并把编译验证提到 PR 门禁。

### 第三梯队（收敛与清债）

9. 把 vue2/antdv 内联的 auto-span / fold 算法切回 core 已有实现，消除 formtype 第 3 份副本。
10. 文档站 AI 路径改为 import shared 的 prompt，消除第 4 份 NL→配置实现。
11. 补 `test:coverage` 依赖或删除该脚本；`es-eui` 孤儿业务代码与内网域名从公开站点移除。
12. 修正 README「38 个契约类型」→ 35，并给这类数字加校验脚本。

---

## 八、总体结论

**技术判断**：架构方向正确且执行认真——分层清晰、单源同步有成体系的门禁、测试与自我诊断文档的质量脱俗。上一轮审计与重构诊断中的 P0 基本落地，这是罕见的。

**产品判断**：核心卖点「三端同构」当前**被高估**。配置 schema 层是真同构（并且 CI 强制）；但属性透传、默认视觉、命令式 API 这三层都存在静默失效——**而静默失效恰恰是最伤信任的失败模式**：用户不会收到报错，只会发现「在 Element 上好好的，换 antdv 就没反应」。

**最大风险不是代码质量，而是证据链与市场**：tri-render 快照仍为 0、发布自动化实际不存在、下载量处于噪音水平。项目的问题已经从「能不能写对」转变为「**如何让人相信它是对的并愿意用**」。当前所有门禁都在验证「三端名字一致」，而没有一条在验证「三端看到的东西一样」——而后者才是卖点本身。

---

## 附：修复进展（2026-09-15）

一轮内完成，每项均**先复现/读源码坐实，再改，再验证**（含"反向探针"：故意重新引入缺陷，确认守卫确实变红）。

### 第一梯队

| # | 问题 | 修复 | 验证 |
|---|---|---|---|
| 1 | antdv 静默吞掉 `clearable`/`filterable`/`collapse-tags`/`show-word-limit` | 新增 `EP_ATTR_MAP` 按 formtype 限定作用域改名（`clearable→allowClear` 等），`collapse-tags` 做 boolean→`maxTagCount` 语义转换，无等价物的 `collapse-tags-tooltip` 改为**告警后丢弃** | 新增 13 条契约测试；antdv 561→**565 全绿**。`grep allowClear` 从 0 命中变为有映射 |
| 2 | antdv `install()` 重复注册 | 补回 vue3 已有的 `isPlugin && Plugin` 守卫（此前注释谎称"完全对齐 vue3"） | 新增 `install.spec.ts` 5 条，含"默认安装不得产生 already-been-registered 告警" |
| 3 | 三端默认列对齐不一致 | `adaptColumn` 默认 `align='center'`，与 vue3/vue2 及本包 vxe 引擎收敛；顺带修掉列 key 的 `Math.random()`（改为确定性位置路径） | 新增 6 条测试；22 文件 565 测试全绿 |
| 4 | 命令式 API 不同构 | antdv `useDialog` 返回值改为 `{instance, close, destroy}`（保留 callable 上的 close/destroy，纯增量）；vue2 `validateField` 由 `void` 桥接为 Promise（含"无匹配字段不挂起"处理） | 新增 8 条测试。`update:dataSource` 经复核是**有意移除**（Vue2 `.sync` 回环），改为在 vue2 README 明确文档化而非强改 |

### 第二梯队

| # | 问题 | 修复 | 验证 |
|---|---|---|---|
| 5 | `position` 被静默改写为 `code:1` | `TableBtnSchema`（shared zod4 + mcp zod3 两份）接受 `position` 并 `.transform()` 归一化成一致的 `code`；修正 conventions / AI prompt / 检查脚本里"vue2 忽略 position"的错误理由 | 探针验证：关掉归一化后 golden 24 号用例**精确报错**「declares position="right" but normalized code=1」；关掉整个 transform 后 19/24 失败。新增 golden 用例 24 + 6 条 schema 测试 |
| 6 | publish.yml 不可用 | 触发器改为 `workflow_dispatch`（原 `v*` 永不命中 changesets 的 `@scope/pkg@ver` tag）；`contents: write` + 新增 `git push origin --tags`（changesets 只本地打 tag、从不推送）；新增"必须先 changeset version"前置守卫，堵住"绿灯但没发布" | 用 js-yaml 解析校验；逐条比对 `@changesets/cli` 源码确认 tag 格式与不推送行为 |
| 7 | sync 门禁可被"删除"绕过 | `sync-docs` 由"两目录交集"改为显式 `MIRRORED_DOCS` 清单，源/目标缺失均报错；`sync-tri-render` 由"存在性过滤"改为显式 `DISTRIBUTED_FILES`，缺失即失败（不再退化成"0 个文件恒绿"） | 两种失败模式实测退出码均为 1，健康态为 0 |
| 8 | golden L1 不校验语法；编译只在夜间 | L1 增加真实解析（pageSchema JSON 载荷 `JSON.parse` + SFC `<script>` 块 esbuild 解析，按 `lang` 选 ts/tsx loader），esbuild 显式声明为根 devDependency（不靠 hoisting）；`golden-compile`（全语料 24 用例 × 三目标真实 vite build）从夜间**移入 typecheck.yml** | 探针注入语法错误 → 19/24 失败。附带收益：deploy-docs 依赖 Typecheck，全语料编译现在也是部署前置 |

### 第三梯队

| # | 问题 | 修复 | 验证 |
|---|---|---|---|
| 9 | 三端布局算法各写一份 | vue2 的 `isFold`/`getBtnColSpan`/`formItem` 与 antdv 的自动 span 内联实现改回调用 core 已有函数（逐行等价，纯去重） | vue2 303 / antdv 565 全绿，typecheck 干净 |
| 10 | formtype 契约两处手写副本无关联 | 复核后确认 **core 不能 import shared**（会把 ajv+zod 拖进三个渲染器产物），故不强行合并；改为修正 core 里"重新导出"的错误注释 + 在 `check-schema-contract.mjs` 新增 core↔shared 的**逐项相等**校验 | 探针删除 shared 里一个类型 → 精确报"已分叉：仅 core 有 [Rate]"，退出码 1 |
| 11 | `test:coverage` 是坏的；es-eui 孤儿代码含内网域名 | 补声明 `@vitest/coverage-v8@1.6.1`；删除 `es-eui/src/views/salesPolicy/`（5 文件，全站 0 引用、未注册路由，是 `wdshop-be.szlanyou.com` 的全部残留） | coverage 实测跑通（vue3 88.26% stmts）；内网域名命中数 0；es-eui 站点**构建成功**（exit 0） |
| 12 | README 契约类型数 38 ≠ 实际 35 | README.md / README.en.md 改为 35；新增 `scripts/check-readme-claims.mjs`（数量 + 控件枚举**集合相等**校验），接入 `check:consistency` | 探针改回 38 → 精确报错退出 1 |

### OIDC 与 `.npmrc` 的实测结论（2026-09-15 追加）

`actions/setup-node` 在设置 `registry-url` 时会往 runner 的 `.npmrc` 写入一行
`//registry.npmjs.org/:_authToken=${NODE_AUTH_TOKEN}`，而 Trusted Publishing 下该变量并不存在。
**这一行不是惰性的** —— 用真实 registry 请求实测（npm 10.9.8）：

| `.npmrc` 情形 | `npm whoami` 的结果 |
|---|---|
| 含 `_authToken=${NODE_AUTH_TOKEN}` 且变量未设置 | npm **真的发出带凭据的请求**，收到 `E401 Unauthorized` |
| 不含该行 | npm 直接判定 `ENEEDAUTH`（need auth），不发送凭据 |

即：该行的存在会改变 npm 的认证行为（从"我知道自己没登录"变成"拿一个无效凭据去请求"），
对需要走 OIDC 的发布流程是实质风险。

**修复**：工作流去掉 `registry-url`（所有包都在 npmjs 默认 registry 下，去掉不损失能力），
并新增 `Assert no npm auth token is configured (OIDC only)` 前置守卫，检查
userconfig / globalconfig / 仓库 `.npmrc` 三处是否出现 `_authToken`，出现即失败并给出明确原因 ——
把"发布环境不得存在任何 npm 凭据"变成显式不变量，避免将来有人加回 `registry-url` 后以难定位的 401 告终。
守卫逻辑已用离线探针验证：干净环境通过、注入 token 行后退出码 1。

> 局限：本地只有 npm 10.9.8，而工作流会升级到 npm ≥ 11.5；跨版本的 OIDC 行为差异未能实测。
> 但"移除 token 行"在任何版本下都是正确方向（Trusted Publishing 本就不需要 token）。

### 发布工作流实跑记录（2026-09-15 ~ 09-17）

`changeset version` 消费全部 changeset 后的版本：adapter-antdv 1.2.0 · vue2 1.3.0 · vue3 1.6.0 ·
core 1.2.0 · shared 1.4.0 · mcp-server 1.4.0 · cli 1.4.0（es-plus-ui 按 `ignore` 保持 1.4.0）。

`workflow_dispatch` 共试跑 **4 次**（另有 1 处静态预检），每次都暴露了一个**只有真实运行才会出现**的缺陷：

| 运行 | 结果 | 根因 / 修复 |
|---|---|---|
| #1 `34951712093` | 在 `Upgrade npm` 一步 `EBADENGINE` 失败 | `npm@latest` 已指向 **12.0.2**，其 engines 为 `^22.22.2 \|\| ^24.15.0 \|\| >=26.0.0`，而工作流用 Node 20 → 改为钉住 `npm@^11.5.0`（engines `^20.17.0 \|\| >=22.9.0`，且满足 trusted publishing 的 ≥11.5 要求） |
| （静态预检） | 发现守卫自身有 bug | `Verify versioning` 的 glob `.changeset/*.md` 会匹配常驻的 `.changeset/README.md` → 在**正确**的已 version 状态下也会失败，等于把工作流变成永久红。改为遍历时排除 README.md，并双向验证 |
| #2 `34952065486` | 走到 `Publish changed packages` 失败（`ENEEDAUTH`） | npmjs.com 侧尚未配置 Trusted Publisher（详见下） |
| #3 `35190832275` | 部分发布 + 我的一处误判 | shared 缺 `repository` 字段致 provenance 校验 E422；其余 6 个包**实际已发布** |
| #4 `35191386293` | **全绿** | 补齐 shared 元信息后 7 个包全部上线，tag 已推送 |

试跑 #2 的**成功步骤**（即本仓库侧已全部验证通过）：

```
Run actions/checkout@v4                              success
Run actions/setup-node@v4                            success
Upgrade npm (Trusted Publishing 需要 >= 11.5)         success   ← 修复后通过
Assert no npm auth token is configured (OIDC only)   success   ← .npmrc 凭据守卫通过，确认无凭据泄漏
Verify versioning has been done                      success   ← 版本前置守卫通过
Install                                              success
Build packages                                       success   ← 7 个包全部构建成功
Configure git identity                               success
Publish changed packages                             FAILURE (ENEEDAUTH)
Push release tags                                    skipped
```

changesets 已正确识别出 7 个待发包并进入发布（`@es-plus/adapter-antdv/cli/core/mcp-server/shared/vue2/vue3`
均报 "has not been published on npm"），在**第一个包** `@es-plus/shared` 上以
`ENEEDAUTH This command requires you to be logged in to https://registry.npmjs.org` 终止。

**根因**：`ENEEDAUTH` 表示 npm 无法取得任何凭据。仓库侧的三项前置条件均已满足并被日志证实
（`id-token: write` 已声明、npm 11.19.1 ≥ 11.5、环境内无任何 `.npmrc` 凭据）—— 因此剩余的唯一解释是
**npmjs.com 上尚未为这些包配置 Trusted Publisher**，npm 没有可交换 OIDC 令牌的对象，于是回退到 token 认证并失败。

**后果与状态**：该次运行在第一个包（`@es-plus/shared`）上失败，**未发布任何包** ——
已核对 registry，7 个包的 latest 仍是旧版本，无残留 tag。配置 Trusted Publisher 后可直接重试，无需回滚。

**待办（需在 npmjs.com 操作，仓库内无法完成）**：为上述 7 个包各配置一次
`Settings → Trusted Publisher → GitHub Actions`：Organization or user `liujiaao`、
Repository `es-plus`、Workflow filename `publish.yml`、Environment 留空。**已完成。**

> 另注：这次日志里的 `npm warn publish "repository.url" was normalized` 当时被我记为「顺手清掉」
> 的次要警告 —— 它其实是下一轮发布的**硬阻塞**（见「试跑 #4」）。教训：provenance 相关警告不可降级处理。

#### 试跑 #3（配置 Trusted Publisher 后，run 35190832275）—— 部分发布 + 误判

Trusted Publisher 配置生效，OIDC 交换成功（日志出现 `Signed provenance statement with source and
build information from GitHub Actions`），但发布报 **E422**：

```
Error verifying sigstore provenance bundle: Failed to validate repository information:
package.json: "repository.url" is "", expected to match "https://github.com/liujiaao/es-plus"
```

根因：**7 个包里只有 `@es-plus/shared` 的 `package.json` 缺 `repository` 字段**（其余 6 个都有）。
已补齐（并顺带补上该文件同样缺失的 description/keywords/author/license/publishConfig ——
缺 `license` 会让 npm 上显示为 UNLICENSED）。

**本轮的一处判断错误（已更正）**：该次运行整体结论是 failure，我据此判断「没有部分发布」。
实际上 `changeset publish` 会**先把所有包都尝试一遍，最后才因存在失败而抛错** ——
那一次真正失败的是 `shared` 一个包，**其余 6 个已成功发布**（registry 时间戳 06:41:25–06:46:53
可佐证）。教训：changesets 的「整体失败」不等于「全部未发布」，判断发布状态必须以 registry 为准，
不能只看 workflow 结论。

#### 试跑 #4（run 35191386293）—— 全绿

补齐 shared 元信息后重跑，**10 个步骤全部 success**，`shared@1.4.0` 发布完成。至此 7 个包全部上线：

| 包 | 版本 | 发布时间(UTC) |
|---|---|---|
| @es-plus/core | 1.2.0 | 06:41:25 |
| @es-plus/vue2 | 1.3.0 | 06:42:05 |
| @es-plus/adapter-antdv | 1.2.0 | 06:42:13 |
| @es-plus/mcp-server | 1.4.0 | 06:44:18 |
| @es-plus/cli | 1.4.0 | 06:46:53 |
| @es-plus/vue3 | 1.6.0 | 06:43:49 |
| @es-plus/shared | 1.4.0 | 06:50:28 |

3 个抽查包（vue3 / shared / adapter-antdv）均带 **provenance attestation**
（`dist.attestations.provenance` 存在，发布者 `npm-oidc-no-reply@github.com`）。

#### 补记：6 个 tag 一度丢失（已修复）

试跑 #3（`35190832275`）的 `Push release tags` 步骤因 publish 失败被跳过，导致它**在 runner 上创建的 6 个 tag
随 runner 一起销毁** —— 这正是本报告 §五 描述的失效模式（"changesets 从不推送它创建的 tag"）
在真实环境中的一次复现：包已上 npm，但 git 里没有任何发布痕迹。

已按 changesets 的实际格式（annotated tag、message 为 tag 名、tagger 为
`github-actions[bot] <github-actions[bot]@users.noreply.github.com>`）在**该次运行 checkout 的
commit `6c7d7cb`** 上补建并推送这 6 个 tag。如需撤销：

```bash
TAGS=(@es-plus/vue3@1.6.0 @es-plus/vue2@1.3.0 @es-plus/core@1.2.0 @es-plus/cli@1.4.0 @es-plus/mcp-server@1.4.0 @es-plus/adapter-antdv@1.2.0)
git tag -d "${TAGS[@]}"
for t in "${TAGS[@]}"; do git push origin --delete "$t"; done
```

### 复核后**未**修改的项（附理由）

- **`RechargeRecord.vue`**：见上文勘误，是使用公开 API 的正当演示页，删除会丢功能。
- **`update:dataSource` 缺失**：有意为之（Vue2 `.sync` 回环），已在 vue2 README 文档化差异，未强行加回。
- **`es-plus-legacy`**：`package.json` 的 `^1.5.0` 与 vue3 1.5.0 实际**一致**（上一轮审计的"版本漂移"指控不成立，漂的是 README 文案）；已把 `ignore` 冻结的后果写进 RELEASE.md。
- **`check-schema-contract` 的 formtype 部分**：仅修了我改坏的 `z\s*\.object` 正则容错（原来不容忍换行，纯格式化就会失配并误报"契约漂移"）。

### 尚未处理（需决策 / 超出本轮范围）

- **真正的单一真源**：`core/constants.ts` ↔ `shared/contract.ts` 仍是手写双份 + 门禁。彻底解决需要一个独立的无依赖契约包（如 `@es-plus/contract`），属结构性改造。
- **发布链路已打通并完成一次真实发版**（见下「实跑记录」）：Trusted Publishing 配置完成，7 个包已带 provenance 发布，release tag 已推送。
- **coverage 无阈值门禁**：脚本已可用，但"覆盖率不得低于 X%"是策略决定，未擅自设阈值。
- ~~**`es-eui` 发布残留**~~ **已于 2026-09-18 处理**：按「只清无引用的发布残留」决策删除
  `package.lib.json`/`vue.lib.config.js`/`PUBLISH_GUIDE.md`/`LIBRARY_README.md`/
  `PAIN_POINT_ANALYSIS.md`/`README_DETAILED.md`/`plans/`/`scripts/*.bat`/`test-project/`/`.npmignore`
  与跑不通的 `build:lib`；`/test/recharge-record` 从路由表移除（能力有专用 e2e 覆盖），
  页面保留为参考示例移至 `src/examples/vue2-compat/`。
- **`raw-sources.generated.js` 每次构建弄脏工作树**：仍未处理（生成物含时间戳 + 被 glob 的示例源码）。
- **生成代码注入面**：`formatter`/`render` 仍是原样拼进产物，未见沙箱化设计。
- **三端快照（tri-render PNG）**：数量仍为 0（渲染证据现由 `pairs.json` 的同名示例逐行实测承担）。

### 本轮验证快照

| 项 | 结果 |
|---|---|
| `npm test`（7 包） | **1966 用例全绿**（分析起点为 1928，本轮 +38） |
| `npm run typecheck`（7 包） | exit 0，0 个 TS 错误 |
| `npm run check:consistency` | 全绿（含 `check:readme` 与 core↔shared formtype 两项新增校验） |
| `npm run test:golden` | 24/24（含新增的 position 用例与新增的真实语法解析） |
| 文档站 `es-plus-docs` 构建 | 成功（2m5s）；shared prompt 的规则串与 few-shot 均已进入产物，旧 sketch 与废弃 `datePicker` 写法命中数 0 |
| `es-eui` 构建 | 成功（exit 0），孤儿代码删除后无影响 |
| `vitest run --coverage`（vue3） | 跑通，88.26% stmts |

各包用例数：core 250 · shared 283 · vue2 303 · vue3 463 · adapter-antdv 565 · mcp-server 59 · cli 43。
