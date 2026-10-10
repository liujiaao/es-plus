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

  it('带上「schema 表达不了就保留为扩展点」的规则与三个扩展点名字', () => {
    for (const token of ['formatter', 'render', 'permissionValue']) {
      expect(prompt, `prompt 漏了扩展点 ${token}`).toContain(token)
    }
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
    '多弹窗 dialogs（新增/编辑不同表单）': () =>
      cfgs.some((c) => c.dialogs !== undefined && Object.keys(c.dialogs).length >= 2),
    'permissionValue（字段级可见性门控）': () => anyField((f) => f.permissionValue !== undefined),
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
  }

  for (const [dim, present] of Object.entries(COVERAGE)) {
    it(`覆盖「${dim}」`, () => {
      expect(present(), `没有任何 few-shot 演示「${dim}」—— 模型会在该维度回退`).toBe(true)
    })
  }
})
