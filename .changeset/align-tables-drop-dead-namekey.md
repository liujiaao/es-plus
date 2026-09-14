---
"@es-plus/core": minor
"@es-plus/vue2": patch
"@es-plus/adapter-antdv": patch
---

对齐三端表格同构缺陷，并移除从未生效的契约字段。

**`@es-plus/core`**
- **移除 `BtnConfig.nameKey`**：该字段自声明起就无任何读取（三端按钮均直接渲染 `name`），
  属「契约声明 ≠ 实际消费」。经评估接线需改约 30 处三端按钮渲染点、收益不成比例，故移除；
  同步更正 `config.ts` 的 `t` 注释与 `adapter-antdv/README.md` 的 i18n 说明
  （此前写作「labelKey / nameKey → text」）。
  说明：纯类型面移除，运行时行为不变（该字段从未生效）。

**`@es-plus/vue2` / `@es-plus/adapter-antdv`**
- **并发分页/请求竞态对齐 vue3**：`es-table` 的本地请求函数改为递增请求序号（requestTicket），
  只让最新请求写数据 / 清 `requestError` / 复位 loading；被淘汰请求静默 `resolve(undefined)`，
  不再误报 `request-error`；边界回退的递归请求不被序号机制误杀。
- **`useTableResize` 运行期快照对齐 vue3**：`heightType` / `tabHeight` 支持 ref/getter，
  运行期修改生效；`heightType` 变化时重挂 ResizeObserver。
- **（antdv）`useTableSelection` rowkey 运行期读取**：`rowkey` 支持 ref/getter，
  运行期切换后选择按新键判定。

**本次复核补充修复（对抗式审计发现）**
- **`dataOptions.disabled` 透传**（vue3 / adapter-antdv）：Select/Radio/Checkbox 选项此前丢弃
  `disabled`，禁用项仍可点；现随选项透传（vue2 本就已支持）。
- **antdv 嵌套路径支持方括号**：`toAdvNamePath` / `nestDottedRuleKeys` 此前只按 `.` 切分，
  会破坏 schema 明确支持的 `prop: 'a[0].b'`（ADV 读 `model['a[0]']` → 校验必错）。
  改为复用 core 新增的**单源分词器** `parsePathSegments`（与 `getNestedValue/setNestedValue` 同源）。
- **antdv 透传不得覆盖 v-model**：`rowPassThrough` 现在剔除 `value/checked/targetKeys/fileList`，
  用户经 `props/attrs` 透传的同名值不再覆盖内部 model 绑定（与 vue3 剔除 `modelValue` 同构）。
- **左栏 / 单行按钮 `triggerEvent` 对齐**（vue3 / adapter-antdv）：此前只有右栏走 `clickBtn`，
  查询/重置在左栏或单行布局下不生效，与 vue2 不一致；现三端统一。
- **表格请求提前返回不再卡 loading**（三端）：无 url / 无 httpRequest 的 fail 分支补收
  `loadingStatus`，避免上一请求在途时其 `finally` 因序号过期跳过复位而永久转圈。
- **useTableResize 观察器不再在连续变更时泄漏**（三端）：仅 `heightType` 变化才重挂 observer，
  `tabHeight` 变化只重算；`startObserver` 幂等（先断开旧 observer）。
- **vue2 `onlyInstance` 延迟销毁加 visible 守卫**：关闭后 300ms 内被重新打开不再误销毁。

**门禁加固（脚本层，非发布包）**
- `check-renderer-parity`：去注释后再匹配组件 token（此前把组件名写进注释即可绕过）。
- `check-contract-consumption`：去注释 + 花括号深度识别字段（此前写死两格缩进、注释也算消费）。
- 新增 `props` 到 `form-item.schema.json`（此前 MCP/LLM 按 schema 无法发现该逃生舱）。
- CLI `isSafePathSegment` 拒绝 Windows 会规范化的结尾空格/点（`'.. '` 绕过）。

**验证**：全量测试全绿；各修复均补回归测试并逐条反向验证。
