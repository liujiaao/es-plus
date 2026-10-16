import { describe, it, expect, vi, beforeEach } from 'vitest'

/**
 * nlToConfig 的自修复环 —— 行为级回归（2026-10-16 京东云网关 400 事故）。
 *
 * 事故的形状：`thinking: {type:'adaptive'}` 下模型**可能产出只有 thinking 块、没有 text 块**
 * 的一轮（京东云网关还会把 thinking 正文剥掉），`textOf` 拿到空串；旧实现把它原样推回，
 * 下一次请求就带一个**空的 text block** → 严格中继直接
 * `400 messages: text content blocks must be non-empty`。
 *
 * 旧实现还有第二个毛病：空轮会**吃掉一次修复机会**，于是「一次没答 + 两次答不对」被报成
 * 「三次都答不对」—— 用户于是去改语料/提示词，而真正的病灶在中继。
 *
 * 这里用假 SDK 把每轮返回**脚本化**，钉住两条不变量（这不能用真跑验：真模型不会按你要的顺序犯错）：
 *   1) 发出的每一次请求，历史消息里**不得有任何空 content 块**；
 *   2) 空轮**不消耗**三次修复机会，但有独立上限（不得挂死）。
 */

const create = vi.fn()
vi.mock('@anthropic-ai/sdk', () => ({
  default: class FakeAnthropic {
    messages = { create: (...args: unknown[]) => create(...args) }
  },
}))

const { nlToConfig } = await import('../src/ai/nl-to-config')

const VALID = {
  name: 'OrderManage',
  apiUrl: '/api/orders',
  actions: ['add', 'view', 'delete'],
  fields: [{ prop: 'orderNo', label: '订单号', formtype: 'Input' }],
}

/** 一次 Anthropic 响应：content 里的 text 块由参数给出（空数组 = 空轮）。 */
const reply = (texts: string[]) => ({ model: 'fake', content: texts.map((t) => ({ type: 'text', text: t })) })

/** 按序吐出预置响应；用尽后重复最后一个。fuse 防止「环失去上限」时测试挂死。 */
function scripted(replies: unknown[], fuse = 40) {
  let i = 0
  const seen: Array<Array<{ role: string; content: string }>> = []
  create.mockImplementation((args: any) => {
    if (i >= fuse) throw new Error(`TEST FUSE BLOWN: 请求次数超过 ${fuse}`)
    seen.push(args.messages.map((m: any) => ({ role: m.role, content: m.content })))
    const r = replies[Math.min(i, replies.length - 1)]
    i++
    return Promise.resolve(r)
  })
  return { seen, count: () => i }
}

/** 所有已发出的请求里，都不得有任何空 content 块。 */
const assertNoEmptyBlocks = (seen: Array<Array<{ role: string; content: string }>>) => {
  for (const [reqIdx, msgs] of seen.entries()) {
    for (const m of msgs) {
      expect(typeof m.content, `第 ${reqIdx + 1} 次请求的 ${m.role} 轮 content 必须是字符串`).toBe('string')
      expect(m.content.trim().length, `第 ${reqIdx + 1} 次请求的 ${m.role} 轮 content 不得为空`).toBeGreaterThan(0)
    }
  }
}

describe('nlToConfig 自修复环 — 空轮与回灌', () => {
  beforeEach(() => {
    process.env.ANTHROPIC_API_KEY = 'test-key'
    create.mockReset()
  })

  it('空轮不得消耗修复机会：[空 → 坏 JSON → 好] 必须成功', async () => {
    const s = scripted([reply([]), reply(['这不是 JSON']), reply([JSON.stringify(VALID)])])
    const res = await nlToConfig('做一个订单列表')
    expect(res.config.name).toBe('OrderManage')
    expect(s.count()).toBe(3)
    assertNoEmptyBlocks(s.seen)
  })

  it('空轮不得往对话里塞空块（旧实现在这里 400）', async () => {
    const s = scripted([reply([]), reply([JSON.stringify(VALID)])])
    await nlToConfig('做一个订单列表')
    // 第 1 轮空轮「什么都没产出 ⟹ 对话状态不变 ⟹ 纯重发」，故第 2 次请求的历史仍是初始那一条。
    expect(s.seen[0]).toHaveLength(1)
    expect(s.seen[1]).toHaveLength(1)
    assertNoEmptyBlocks(s.seen)
  })

  it('连续空轮也不得吃掉机会，但必须有上限（不得挂死）', async () => {
    const ok = scripted([reply([]), reply([]), reply([JSON.stringify(VALID)])])
    await expect(nlToConfig('做一个订单列表')).resolves.toBeTruthy()
    expect(ok.count()).toBe(3)

    // 全程空轮 → 有界失败（= 1 次初始 + 3 次重发 + 2 次用尽的尝试 = 6），且诊断点名「空轮」。
    const allEmpty = scripted([reply([])])
    await expect(nlToConfig('做一个订单列表')).rejects.toThrow(/空轮/)
    expect(allEmpty.count()).toBe(6)
    assertNoEmptyBlocks(allEmpty.seen)
  })

  it('三次 schema 不过 → 诊断点名「schema 不过」而非「空轮」（病因必须可分辨）', async () => {
    const s = scripted([reply(['{"nope":1}'])])
    await expect(nlToConfig('做一个订单列表')).rejects.toThrow(/schema 不过/)
    await expect(nlToConfig('做一个订单列表')).rejects.not.toThrow(/空轮/)
    expect(s.count()).toBeGreaterThan(0)
  })

  it('三次非 JSON → 诊断点名「非 JSON」', async () => {
    scripted([reply(['完全不是 JSON'])])
    await expect(nlToConfig('做一个订单列表')).rejects.toThrow(/非 JSON/)
  })

  it('诊断链报告实际调用次数与最后一次输出长度（0 长度本身就是证据）', async () => {
    scripted([reply([])])
    await expect(nlToConfig('做一个订单列表')).rejects.toThrow(/6 call\(s\).*Last output \(0 chars\)/s)
  })
})
