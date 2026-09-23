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
