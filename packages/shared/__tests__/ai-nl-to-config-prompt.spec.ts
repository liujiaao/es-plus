// ai-nl-to-config-prompt.ts 此前零覆盖。它的 docblock 写了一条硬承诺：
//
//   "both are validated against the authoritative StructuredCrudConfigSchema so
//    guidance can never rot into invalid configs"
//
// 这条承诺没有任何测试守 —— 加一条 formtype 写错、actions 写了不存在的动作、
// 或者 position 写成 'center' 的 few-shot，prompt 依然照发，而 LLM 会照着它
// 生成被 CLI/zod 拒绝的配置。所以第一组测试就是把它钉在权威 schema 上。
//
// 第二组锁 prompt 的组装：每条 few-shot 必须原样（无损）出现，且必须带上
// position 规则与「schema 表达不了的业务逻辑要保留为扩展点」这条规则 —— 后者
// 被删掉时，模型会开始静默丢弃需求。

import { describe, it, expect } from 'vitest'
import { NL_TO_CONFIG_FEWSHOT, buildNlToConfigSystemPrompt } from '../src/ai-nl-to-config-prompt.js'
import { StructuredCrudConfigSchema } from '../src/structured-config.schema.js'
import { generateFromConfig } from '../src/structured-generator.js'

describe('NL_TO_CONFIG_FEWSHOT — 必须过权威 schema', () => {
  it('每一条 few-shot 的 config 都能被 StructuredCrudConfigSchema 接受', () => {
    for (const ex of NL_TO_CONFIG_FEWSHOT) {
      const parsed = StructuredCrudConfigSchema.safeParse(ex.config)
      const detail = parsed.success
        ? ''
        : parsed.error.issues.map((i) => `${i.path.join('.')}: ${i.message}`).join('; ')
      expect(parsed.success, `few-shot「${ex.nl.slice(0, 20)}…」校验失败 → ${detail}`).toBe(true)
    }
  })

  it('每条的 nl 与 reasoning 都非空（reasoning 是要被模仿的载荷，不能留空）', () => {
    for (const ex of NL_TO_CONFIG_FEWSHOT) {
      expect(ex.nl.trim().length, 'nl 为空').toBeGreaterThan(0)
      expect(ex.reasoning.trim().length, `「${ex.nl.slice(0, 20)}…」的 reasoning 为空`).toBeGreaterThan(0)
    }
  })

  it('nl 不重复（防止复制一条后只改 config）', () => {
    const seen = NL_TO_CONFIG_FEWSHOT.map((e) => e.nl)
    expect(new Set(seen).size).toBe(seen.length)
  })

  it('config.name 不重复，且都是合法页面名', () => {
    const names = NL_TO_CONFIG_FEWSHOT.map((e) => e.config.name)
    expect(new Set(names).size).toBe(names.length)
    for (const n of names) expect(n).toMatch(/^[A-Za-z][A-Za-z0-9_-]*$/)
  })
})

describe('buildNlToConfigSystemPrompt — 组装与无损性', () => {
  const prompt = buildNlToConfigSystemPrompt()

  function configsInPrompt(): unknown[] {
    return prompt
      .split('### Example ')
      .slice(1)
      .map((block) => {
        const line = block.split('\n').find((l) => l.startsWith('Config: '))
        if (!line) throw new Error('某个 Example 块里没有 Config: 行')
        return JSON.parse(line.slice('Config: '.length))
      })
  }

  it('每条 few-shot 都作为一个 Example 块出现，条数一致', () => {
    expect(prompt.split('### Example ').length - 1).toBe(NL_TO_CONFIG_FEWSHOT.length)
  })

  it('每条 nl 与 reasoning 都原样进入了 prompt', () => {
    for (const ex of NL_TO_CONFIG_FEWSHOT) {
      expect(prompt).toContain(`NL: ${ex.nl}`)
      expect(prompt).toContain(`Reasoning: ${ex.reasoning}`)
    }
  })

  it('prompt 里的 config 可 JSON.parse 回来，且与源对象逐键相等', () => {
    // 用 toStrictEqual 而不是 toEqual：value 为 undefined 的键在 JSON.stringify
    // 时会静默消失，toEqual 对这种丢键是视而不见的。
    const parsed = configsInPrompt()
    expect(parsed).toHaveLength(NL_TO_CONFIG_FEWSHOT.length)
    parsed.forEach((cfg, i) => {
      expect(cfg).toStrictEqual(NL_TO_CONFIG_FEWSHOT[i].config)
      expect(Object.keys(cfg as object).sort()).toEqual(
        Object.keys(NL_TO_CONFIG_FEWSHOT[i].config).sort()
      )
    })
  })

  it('带上 position 规则（并说明 code 是 legacy 别名）', () => {
    expect(prompt).toContain('position')
    expect(prompt).toContain('legacy alias')
  })

  it('带上按钮 dialogKey vs actionType 的库契约规则（防 actionType:"add" 死按钮回归）', () => {
    // add/edit/view → dialogKey（开弹窗）；export/import → actionType（副作用）。
    // 这条库契约（DEFAULT_TOOLBAR_BTNS/DEFAULT_ROW_BTNS）此前只隐含在示例里、且示例本身
    // 把新增写成了 actionType:"add"（死按钮）。规则显式点名后钉在这里，防止回退。
    expect(prompt).toContain('dialogKey:"add" opens the built-in add dialog')
    expect(prompt).toContain('actionType:"export"')
    expect(prompt).toContain('NEVER put actionType:"add"')
  })

  it('带上「schema 表达不了就保留为扩展点」的规则与三个扩展点名字', () => {
    for (const token of ['formatter', 'render', 'permissionValue']) {
      expect(prompt, `prompt 漏了扩展点 ${token}`).toContain(token)
    }
  })

  it('带上「permissionValue / labelKey 需宿主入口装配才生效」的跨文件前提规则（AI-19）', () => {
    // permissionValue / labelKey 是跨文件依赖：只有入口 app.use(ESPlus, { permission, t })
    // 后才生效。prompt 的输出契约是纯 config JSON，故「强制引用」= 一条规则行（指宿主入口），
    // 不新增字段、不把 t(...) / 权限判断内联进字段。
    expect(prompt).toContain('app.use(ESPlus')
    expect(prompt).toContain('t: (key)')
    expect(prompt).toContain('INERT')
  })

  it('few-shot reasoning 补了装配前提（permission / i18n 两例）', () => {
    const salary = NL_TO_CONFIG_FEWSHOT.find((e) => e.config.name === 'SalaryManage')
    const menu = NL_TO_CONFIG_FEWSHOT.find((e) => e.config.name === 'MenuManage')
    expect(salary?.reasoning).toContain('app.use(ESPlus,{permission})')
    expect(menu?.reasoning).toContain('app.use(ESPlus,{t})')
  })

  it('带上「只在该排除时才写 false，省略即包含」的双向规则（inQuery 陷阱）', () => {
    // 单边规则（只说「没提到就写 false」）会把「NL 没提查询但 gold 靠默认 true」的用例教坏；
    // 另一单边（不写规则）则放任模型在 NL 穷举列举时漏标排除。两向都必须说清，故两向都钉。
    expect(prompt).toContain('Exclude ONLY where the description says so')
    expect(prompt).toContain('Do NOT invent an exclusion')
    expect(prompt).toContain('Only an explicit `false` excludes')
  })

  it('要求只输出 JSON（否则模型会裹 markdown 围栏，调用方 JSON.parse 直接抛）', () => {
    expect(prompt).toContain('Respond with ONLY the JSON object')
  })

  it('输出确定：两次调用逐字节相同', () => {
    expect(buildNlToConfigSystemPrompt()).toBe(prompt)
  })
})

// few-shot 的 config 过 schema 还不够 —— schema 合法但 generateFromConfig 落地时抛错
// 的配置，照样会把一个「看着对」的示例教给模型，然后在真实生成路径上炸。所以每条
// few-shot 都必须能真正走完 generateFromConfig（schema / sfc / 三端 target 全覆盖）。
describe('NL_TO_CONFIG_FEWSHOT — 必须能被 generateFromConfig 真正落地', () => {
  it('每条 few-shot 的 config 都能被 generateFromConfig 生成而不抛', () => {
    for (const ex of NL_TO_CONFIG_FEWSHOT) {
      // 先过权威 schema 得到解析后配置（默认已填），再交给生成器 —— 与 CLI 真实路径一致。
      const parsed = StructuredCrudConfigSchema.parse(ex.config)
      expect(
        () => generateFromConfig(parsed),
        `few-shot「${ex.nl.slice(0, 20)}…」(${ex.config.name}) 落地抛错`
      ).not.toThrow()
    }
  })
})

// few-shot 的价值是把「schema 能表达、但 25 条 heldout 的 few-shot-derived 子集没覆盖到」
// 的高级能力演示给模型。若某条演示被删掉、或新增 shot 时某个维度无人承担，模型会在该
// 维度上静默回退。这里把每个必须被教到的维度钉成一条断言 —— 删示例就会亮红。
describe('NL_TO_CONFIG_FEWSHOT — 维度覆盖（few-shot 必须教全这些能力）', () => {
  const cfgs = NL_TO_CONFIG_FEWSHOT.map((e) => e.config)
  const anyField = (pred: (f: (typeof cfgs)[number]['fields'][number]) => boolean) =>
    cfgs.some((c) => c.fields.some(pred))

  const COVERAGE: Record<string, () => boolean> = {
    'Cascader + 嵌套 children（固定多级树，非接口）': () =>
      anyField(
        (f) =>
          f.formtype === 'Cascader' &&
          (f.dataOptions ?? []).some((o) => Array.isArray(o.children) && o.children.length > 0)
      ),
    'apiParams（选项来自接口）': () => anyField((f) => f.apiParams !== undefined),
    'dataOptions（固定枚举）': () => anyField((f) => (f.dataOptions ?? []).length > 0),
    'i18n（界面国际化）': () => cfgs.some((c) => c.i18n === true),
    'formLayout（表单布局）': () => cfgs.some((c) => c.formLayout !== undefined),
    'mode:sfc（单文件组件）': () => cfgs.some((c) => c.mode === 'sfc'),
    'tableOptions.virtual（虚拟滚动）': () => cfgs.some((c) => c.tableOptions?.virtual === true),
    'tableOptions.configTableOut（后端响应字段映射）': () =>
      cfgs.some((c) => c.tableOptions?.configTableOut !== undefined),
    '多弹窗 dialogs（新增/编辑不同表单）': () =>
      cfgs.some((c) => c.dialogs !== undefined && Object.keys(c.dialogs).length >= 2),
    'permissionValue（字段级可见性门控）': () => anyField((f) => f.permissionValue !== undefined),
    'isHidden（声明式条件显隐）': () => anyField((f) => f.isHidden !== undefined),
    'render（自定义单元格扩展点）': () => anyField((f) => f.render !== undefined),
    'formatter（展示格式化扩展点）': () => anyField((f) => f.formatter !== undefined),
    'permissions（按钮级 RBAC）': () =>
      cfgs.some((c) => c.permissions !== undefined && Object.keys(c.permissions).length > 0),
    'tableBtns（工具栏按钮 + 左右定位）': () => cfgs.some((c) => (c.tableBtns ?? []).length > 0),
    'operationColumn:false（只读关列）': () => cfgs.some((c) => c.operationColumn === false),
    'operationColumn 对象（显式行按钮）': () =>
      cfgs.some((c) => c.operationColumn !== undefined && c.operationColumn !== false),
    'target:vue2': () => cfgs.some((c) => c.target === 'vue2'),
    'target:antdv': () => cfgs.some((c) => c.target === 'antdv'),
    // ── AI-33⑥：补齐 6 个「scorer 里有维度、COVERAGE 里无人承担」的高级能力 ──────
    // 这 6 个键在 scorers.mjs 里各有独立维度（reactions:295 / columns:302 /
    // expandConfig:309 / treeConfig:316 / editConfig:324 / mergeConfig:332），
    // 但此前 COVERAGE 只到 19 条，漏了它们 —— 删掉对应 few-shot 无人报警，
    // 模型会在该维度静默回退。补上断言即闭环（**无需新增 few-shot**：6 个维度
    // 现有示例已全部演示，本组只是把「已被演示」这件事钉成可失败断言）。
    'reactions（字段联动）': () => anyField((f) => f.reactions !== undefined),
    // 多级表头的键名是 `groups`（递归 ColumnSchema，structured-config.schema.ts:288），
    // **不是** `children` —— 组件 TableColumn.groups 同形。
    'columns 多级表头（groups 递归）': () =>
      cfgs.some((c) => (c.columns ?? []).some((col) => Array.isArray(col.groups) && col.groups.length > 0)),
    'expandConfig（声明式行展开）': () => cfgs.some((c) => c.expandConfig !== undefined),
    'treeConfig（声明式树表）': () => cfgs.some((c) => c.treeConfig !== undefined),
    // vxe 行内编辑在 tableOptions 下（顶层无 editConfig 键）；列级 editRender 由
    // columns 维度整体深等覆盖，与 scorers.mjs:324 的分工一致。
    'tableOptions.editConfig（vxe 行内编辑）': () => cfgs.some((c) => c.tableOptions?.editConfig != null),
    'mergeConfig（声明式合并单元格）': () => cfgs.some((c) => c.mergeConfig !== undefined),
    // ── AN-23：把「只写在规则里、没有示例承担」的子维度钉住 ──────────────────
    // columns 的非字段列不止 index：复选框（selection）也必须是模型见过的形态。
    'columns 非字段列（selection）': () =>
      cfgs.some((c) => (c.columns ?? []).some((col) => col.type === 'selection')),
    // vxe 行内编辑真正生效靠列级 editRender —— 只有 editConfig 是空转（见规则原文）。
    'columns[].editRender（列级编辑器）': () =>
      cfgs.some((c) => (c.columns ?? []).some((col) => col.editRender !== undefined)),
    // reactions 不止「选项联动」：条件必填 / 自动写回同样必须被演示。
    'reactions.fulfill.required（条件必填）': () =>
      anyField((f) => (f.reactions ?? []).some((r) => r.fulfill.required !== undefined)),
    'reactions.fulfill.value + dependencies（自动写回）': () =>
      anyField((f) =>
        (f.reactions ?? []).some(
          (r) => r.fulfill.value !== undefined && (r.dependencies ?? []).length > 0
        )
      ),
    // 弹窗自定义标题与底部按钮是 dialogs 的两个高频基础键。
    'dialogs[k].title（自定义标题）': () =>
      cfgs.some((c) =>
        Object.values(c.dialogs ?? {}).some((d) => typeof d.title === 'string' && d.title.length > 0)
      ),
    'dialogs[k].configBtn（自定义底部按钮）': () =>
      cfgs.some((c) =>
        Object.values(c.dialogs ?? {}).some((d) => (d.configBtn ?? []).length > 0)
      ),
  }

  for (const [dim, present] of Object.entries(COVERAGE)) {
    it(`覆盖「${dim}」`, () => {
      expect(present(), `没有任何 few-shot 演示「${dim}」—— 模型会在该维度回退`).toBe(true)
    })
  }
})
