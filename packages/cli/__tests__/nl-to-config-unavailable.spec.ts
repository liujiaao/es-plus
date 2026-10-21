/**
 * `aiAvailable()` / SDK 不可导入的分支（覆盖率盲区：旧测试只覆盖「SDK 可用」）。
 *
 * 这一支不是边角料：`@anthropic-ai/sdk` 是**可选依赖**，没装它是最常见的部署形态，
 * 而它决定了 `nlToConfig` 抛 `sdk-missing` 还是 `no-key` —— 用户看到的下一步动作
 * 完全不同（`npm i -D @anthropic-ai/sdk` vs 设置环境变量）。
 */
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'

vi.mock('@anthropic-ai/sdk', () => {
  throw new Error("Cannot find module '@anthropic-ai/sdk'")
})

const { aiAvailable, nlToConfig, AiUnavailableError } = await import('../src/ai/nl-to-config')

const prevKey = process.env.ANTHROPIC_API_KEY

beforeEach(() => {
  process.env.ANTHROPIC_API_KEY = 'test-key'
})

afterEach(() => {
  if (prevKey === undefined) delete process.env.ANTHROPIC_API_KEY
  else process.env.ANTHROPIC_API_KEY = prevKey
})

describe('SDK 不可导入（可选依赖未安装）', () => {
  it('aiAvailable → false（key 有没有都不重要，SDK 才是硬门槛）', async () => {
    await expect(aiAvailable()).resolves.toBe(false)
  })

  it('nlToConfig → AiUnavailableError(sdk-missing)，且提示安装命令', async () => {
    const p = nlToConfig('做一个订单列表')
    await expect(p).rejects.toBeInstanceOf(AiUnavailableError)
    await expect(nlToConfig('做一个订单列表')).rejects.toMatchObject({
      reason: 'sdk-missing',
      message: expect.stringContaining('npm i -D @anthropic-ai/sdk'),
    })
  })
})

describe('缺 key（且 SDK 不可导入）', () => {
  it('aiAvailable → false（环境变量检查在前）', async () => {
    delete process.env.ANTHROPIC_API_KEY
    await expect(aiAvailable()).resolves.toBe(false)
  })

  it('nlToConfig → AiUnavailableError(no-key) 而不是 sdk-missing（先报能改的那一个）', async () => {
    delete process.env.ANTHROPIC_API_KEY
    await expect(nlToConfig('做一个订单列表')).rejects.toMatchObject({ reason: 'no-key' })
  })
})
