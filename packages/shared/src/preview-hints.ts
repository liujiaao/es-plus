import type { StructuredCrudConfig } from './structured-config.schema.js'

/**
 * 「配置里声明了，但实时预览看不到 / 需要宿主补一步」的确定性清单。
 *
 * ## 为什么必须有这个函数
 *
 * 预览此前只渲染查询表单 + 表格 + 查询按钮。配置里真实存在的弹窗、批量选择、
 * 虚拟滚动、自定义 render，在预览里**没有任何痕迹** —— 用户看到一张平表，
 * 只能得出「生成器把需求丢了」的结论。而这两个事实必须分开：
 *
 *   - **生成器丢了** → 是 bug（适配器/发射器要修）；
 *   - **生成了，但预览画不出来** → 是预览的边界，必须**说出来**。
 *
 * 这里只负责后者，且判据必须来自配置本身（不猜 NL、不看关键词）：
 * 每一条 hint 都能在 `config` 里找到对应的键。反过来，这里**不报**已经能被
 * 预览渲染的东西（dialogs 底座 / actions / 分页 / tree / 行内编辑）—— 但「弹窗体」
 * 与 `action:'custom'` 的按钮是函数，schema 模式渲染不出来，属于前者，必须报。
 * 否则提示条会变成噪音，用户很快学会无视它。
 *
 * 调用方：站点预览（`es-plus-docs`）与 MCP 工具的 summary 共用这一份文案来源。
 */
export function describeUnrenderedFeatures(config: StructuredCrudConfig): string[] {
  const out: string[] = []
  const fields = config.fields ?? []
  const tableFields = fields.filter((f) => f.inTable !== false)

  const renderProps = tableFields.filter((f) => f.render).map((f) => f.prop)
  if (renderProps.length > 0) {
    // schema 模式无法内联函数；structured-generator 会以 TODO(es-plus) 槽位保留在
    // 包装 SFC 里。预览按 schema 视图渲染，因此这列显示的是原始值。
    out.push(
      `自定义 render（${renderProps.join(', ')}）不在预览中：schema 模式无法内联函数，` +
        `包装 SFC 里保留了 TODO(es-plus) 槽位，需按注释补成真实标记`,
    )
  }

  const formatterProps = tableFields
    .filter((f) => typeof f.formatter === 'string' && f.formatter)
    .map((f) => f.prop)
  if (formatterProps.length > 0) {
    out.push(
      `列 formatter（${formatterProps.join(', ')}）不在预览中：函数无法序列化进 schema，` +
        `包装 SFC 里以 TODO 槽位保留`,
    )
  }

  const t = (config.tableOptions ?? {}) as {
    virtual?: boolean
    multiSelect?: boolean
    cachePageSelection?: boolean
  }
  if (t.virtual) {
    out.push(
      '虚拟滚动已启用（tableOptions.virtual）：预览使用少量模拟数据，' +
        '滚动复用/行高估算需在真实数据量下验证',
    )
  }
  if (t.multiSelect) {
    out.push(
      '选择列已启用（tableOptions.multiSelect）：表格会出现勾选列；' +
        (t.cachePageSelection
          ? '跨页保留（cachePageSelection）已开启，但底部的批量操作栏不属于 es-crud-page，需宿主实现'
          : '批量操作栏不属于 es-crud-page，需宿主实现'),
    )
  }

  const mode = config.mode ?? 'schema'
  if (mode === 'sfc') {
    out.push(
      "mode:'sfc' 产物含 schema 无法承载的函数/插槽；实时预览按同一份配置的 schema 视图渲染，" +
        '最终外观以「生成代码」为准',
    )
  }

  // 弹窗**底座**能渲染（开合、宽度、按钮排布），但「弹窗体」和「自定义按钮」是函数，
  // schema 模式既传不进去也调不起来 —— 预览里分别是空壳与死按钮，必须点名。
  const dialogs = (config.dialogs ?? {}) as Record<
    string,
    { hasCustomRender?: boolean; configBtn?: Array<{ name?: string; action?: string }> }
  >

  const customBodies = Object.entries(dialogs)
    .filter(([, d]) => d?.hasCustomRender === true)
    .map(([key]) => key)
  if (customBodies.length > 0) {
    out.push(
      `弹窗自定义体（${customBodies.join(', ')}）不在预览中：弹窗体是函数，schema 模式只留 ` +
        `TODO(es-plus) 槽位，预览里打开的是没有表单内容的空壳`,
    )
  }

  // `action: 'custom'`（或省略 action）的底部按钮在 schema 模式的纯模板包装里没有处理函数。
  const deadBtns = Object.entries(dialogs).flatMap(([key, d]) =>
    (d?.configBtn ?? [])
      .filter((b) => !b.action || b.action === 'custom')
      .map((b) => `${key}/${b.name ?? '(未命名按钮)'}`),
  )
  if (deadBtns.length > 0) {
    out.push(
      `弹窗自定义按钮（${deadBtns.join(', ')}）是死按钮：schema 模式的包装是纯模板，` +
        `action:'custom' 没有处理函数（点不动），需 mode:'sfc' 自行接线或删掉`,
    )
  }

  return out
}
