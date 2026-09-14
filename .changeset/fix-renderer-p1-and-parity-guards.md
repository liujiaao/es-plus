---
"@es-plus/vue3": patch
"@es-plus/vue2": patch
"@es-plus/adapter-antdv": patch
---

修复源码审计结构性档（`docs/source-audit-report.md` 第七节）中的 P1 缺陷。

**vue3**
- **分页/请求竞态**：`es-table` 此前用全局 `loadingStatus` 当互斥锁，在途时直接
  `fail(request already in progress)`；而翻页先改页码再发请求。现改为递增请求序号，
  只让最新请求写数据/清错误，被淘汰的请求静默 `resolve(undefined)`（不再误报 request-error）。
- **`modelValue` 被透传覆盖**：`rowPassThrough` 现在剔除用户经 `props`/`attrs`/`on`
  透传的 `modelValue` 与 `onUpdate:modelValue`，保持内部双向绑定优先。
- **运行期配置快照失效**：`useTableResize` 支持 ref/getter 并在 `heightType`/`tabHeight`
  变化时重挂 observer / 重算；`useVirtualSelection` / `useColumnAdapter` 的 `rowkey` 改为
  动态读取（支持 ref）。

**adapter-antdv**
- **Transfer**：补 `label→title`、`value→key` 映射，并让 `row.dataOptions` 成为数据源
  （优先级 `dataSource` > `data` > `dataOptions`）。
- **`props` 参与字段映射**：新增 `mergedRowAttrs`（attrs 优先），使 `props.type`、
  `props['active-value']`、`props.texts/max`、`value-format` 等同名配置不再被忽略；
  保留「`attrs.type` 优先于 `props.type`」的历史回归守卫。
- **嵌套 prop 校验**：`a-form-item` 的 `name` 改为数组 name path；form 级规则绑定前把
  `'user.name'` 展开为嵌套结构，item 级与 form 级嵌套规则同时生效。

**vue2**
- **单行/左栏按钮 `triggerEvent` 失效**：统一走 `clickBtn`，查询/重置按钮在任何布局下都生效。
- **数组下标赋值非响应式**：远端字段 `dataOptions` 重载改为整体替换数组，视图正确刷新。
- **use-dialog 延迟销毁竞态**：延迟回调只销毁自己那次创建的实例，关闭后 300ms 内重开不再误销毁新弹窗。

**验证**：全量 1889 passed（7 包）、7 包 typecheck 全过、lint 0 error、
`check:consistency` 22 项全绿；各修复均补回归测试并逐条反向验证。
