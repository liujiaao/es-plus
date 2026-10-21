/**
 * `create` 的 AI 路径接线（A10）。
 *
 * 三件在源码里可证、但在旧实现里会静默出错的接线：
 *
 *  1. **`--target` / `--mode` 必须只在用户真的传了标志时下发。** 命令的默认值
 *     （vue3 / schema）不能冒充用户选择 —— 模型会按 NL 判定 target/mode（few-shot
 *     教过「明确要 Vue2 / Ant Design Vue / SFC → 写这两个键」），拿默认值当显式指令
 *     就会把这个解读压掉。
 *  2. **显式标志在 AI 路径里必须生效。** 旧实现只在「模型省略」时才覆盖，而模型恰恰
 *     在提到框架/形态的描述里给出这两个键 —— `--target antdv` 于是被静默忽略。
 *  3. **AI 不可用时不得静默降级。** 旧实现先 `aiAvailable()` 再分支：key 已设置但
 *     SDK 未安装时探测返回 false，`--ai` 未显式给定时整段跳过、一条提示都没有 ——
 *     用户以为走了 AI，实际拿到的是正则生成器。
 */
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'
import { mkdtempSync, rmSync, existsSync, readFileSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join } from 'node:path'

const mocks = vi.hoisted(() => ({ nlToConfig: vi.fn() }))

vi.mock('../src/ai/nl-to-config', async (importOriginal) => {
  const actual = await importOriginal<typeof import('../src/ai/nl-to-config')>()
  return { ...actual, nlToConfig: mocks.nlToConfig }
})

import { createCommand } from '../src/commands/create'
import { AiUnavailableError } from '../src/ai/nl-to-config'

/** 一份模型可能给出的合法配置（target/mode 会被 CLI 标志覆盖，故这里写什么不影响断言）。 */
const MODEL_CONFIG = {
  name: 'order-manage',
  apiUrl: '/api/orders',
  actions: ['add'],
  fields: [{ prop: 'orderNo', label: '订单号', formtype: 'Input' }],
  target: 'vue3',
  mode: 'schema',
}

let dir: string
let logSpy: ReturnType<typeof vi.spyOn>
const prevKey = process.env.ANTHROPIC_API_KEY

beforeEach(() => {
  dir = mkdtempSync(join(tmpdir(), 'esplus-ai-'))
  mocks.nlToConfig.mockReset()
  logSpy = vi.spyOn(console, 'log').mockImplementation(() => {})
  process.env.ANTHROPIC_API_KEY = 'test-key'
  // commander 把解析结果缓存在命令实例上（`_optionValues`），同一实例二次 parseAsync
  // 会**继承上一次的选项**（实测：上一条用例的 `--mode sfc` 会漏进下一条，让 schema
  // 分支走了 SFC 分支）。每条用例先清空，保证「本用例传了什么就是什么」。
  ;(createCommand as any)._optionValues = {}
})

afterEach(() => {
  logSpy.mockRestore()
  if (prevKey === undefined) delete process.env.ANTHROPIC_API_KEY
  else process.env.ANTHROPIC_API_KEY = prevKey
  rmSync(dir, { recursive: true, force: true })
  process.exitCode = 0
})

const logs = () => logSpy.mock.calls.map((c: unknown[]) => c.join(' ')).join('\n')

describe('create --ai — target/mode 接线', () => {
  it('用户没传 --target / --mode → 不下发（默认值不得冒充用户选择，模型保留 NL 解读）', async () => {
    mocks.nlToConfig.mockResolvedValue({ config: MODEL_CONFIG, attempts: 1 })
    await createCommand.parseAsync([
      'node', 'create', 'order-manage', '-d', '做一个订单列表', '--ai', '-o', join(dir, 'out'), '--force',
    ])
    expect(mocks.nlToConfig).toHaveBeenCalledTimes(1)
    const opts = mocks.nlToConfig.mock.calls[0][1]
    expect(opts.target).toBeUndefined()
    expect(opts.mode).toBeUndefined()
  })

  it('用户显式传 --target antdv → 原样下发（即便模型给了别的）', async () => {
    mocks.nlToConfig.mockResolvedValue({ config: { ...MODEL_CONFIG, target: 'antdv' }, attempts: 1 })
    await createCommand.parseAsync([
      'node', 'create', 'order-manage', '-d', '做一个订单列表', '--ai', '--target', 'antdv', '-o', join(dir, 'out'), '--force',
    ])
    expect(mocks.nlToConfig.mock.calls[0][1].target).toBe('antdv')
    // 真实路径由 nlToConfig 覆盖模型值；这里断言日志报告的是**生效后**的目标
    expect(logs()).toContain('target=antdv')
  })

  it('用户显式传 --mode sfc → 原样下发；生成日志报告实际模式', async () => {
    mocks.nlToConfig.mockResolvedValue({ config: { ...MODEL_CONFIG, mode: 'sfc' }, attempts: 1 })
    const outFile = join(dir, 'OrderManage.vue')
    await createCommand.parseAsync([
      'node', 'create', 'order-manage', '-d', '做一个订单列表', '--ai', '--mode', 'sfc', '-o', outFile, '--force',
    ])
    expect(mocks.nlToConfig.mock.calls[0][1].mode).toBe('sfc')
    expect(existsSync(outFile)).toBe(true)
    expect(logs()).toContain('mode=sfc')
  })

  it('AI 路径产出的配置直接交给确定性生成器（落盘可读）', async () => {
    mocks.nlToConfig.mockResolvedValue({ config: MODEL_CONFIG, attempts: 2 })
    const outDir = join(dir, 'out')
    await createCommand.parseAsync([
      'node', 'create', 'order-manage', '-d', '做一个订单列表', '--ai', '-o', outDir, '--force',
    ])
    const schemaFile = join(outDir, 'schema.ts')
    expect(existsSync(schemaFile)).toBe(true)
    expect(readFileSync(schemaFile, 'utf-8')).toContain('pageSchema')
    expect(logs()).toContain('2 次尝试')
  })
})

describe('create — AI 不可用时降级必须可见', () => {
  it('key 已设置但 SDK 不可用（未显式 --ai，自动启用）→ 必须打出降级原因，而不是静默走正则', async () => {
    mocks.nlToConfig.mockRejectedValue(new AiUnavailableError('sdk-missing'))
    const outDir = join(dir, 'out')
    await createCommand.parseAsync([
      'node', 'create', 'order-manage', '-d', '做一个订单列表', '-o', outDir, '--force',
    ])
    expect(logs()).toContain('AI 路径不可用')
    expect(logs()).toContain('@anthropic-ai/sdk is not installed')
    // 降级后仍然完成生成（可见降级 ≠ 失败）
    expect(existsSync(join(outDir, "schema.ts")), logs()).toBe(true)
  })

  it('显式 --ai 但缺 key → 同样给出可见原因', async () => {
    delete process.env.ANTHROPIC_API_KEY
    mocks.nlToConfig.mockRejectedValue(new AiUnavailableError('no-key'))
    await createCommand.parseAsync([
      'node', 'create', 'order-manage', '-d', '做一个订单列表', '--ai', '-o', join(dir, 'out'), '--force',
    ])
    expect(logs()).toContain('AI 路径不可用')
    expect(logs()).toContain('ANTHROPIC_API_KEY is not set')
  })

  it('LLM 三轮都没产出合法配置 → 报「LLM 路径失败」并降级（与「不可用」区分开）', async () => {
    mocks.nlToConfig.mockRejectedValue(new Error('LLM did not produce a schema-valid config'))
    await createCommand.parseAsync([
      'node', 'create', 'order-manage', '-d', '做一个订单列表', '--ai', '-o', join(dir, 'out'), '--force',
    ])
    expect(logs()).toContain('LLM 路径失败')
    expect(logs()).not.toContain('AI 路径不可用')
  })
})

describe('create --ai — 落盘失败不得被「降级」掩盖', () => {
  it('确定性生成器抛错 → 报「生成/写盘失败」、exit 1，且不被正则产物覆盖', async () => {
    // 模型给出的配置 schema 非法（fields 为空）→ generateFromConfig 在写盘前抛错。
    // 旧实现把 emitFromStructuredConfig 也包在 LLM 的 try 里：错误被当成「LLM 路径失败」，
    // 随后正则生成器用**同一路径**写出一份完全不同的页面并以 0 退出 —— 用户拿到
    // 「名为 AI 生成、实为正则」的产物，且没有任何错误信号。
    mocks.nlToConfig.mockResolvedValue({ config: { ...MODEL_CONFIG, fields: [] }, attempts: 1 })
    const outDir = join(dir, 'out')
    await createCommand.parseAsync([
      'node', 'create', 'order-manage', '-d', '做一个订单列表', '--ai', '-o', outDir, '--force',
    ])
    expect(process.exitCode).toBe(1)
    expect(logs()).toContain('生成/写盘失败')
    expect(logs()).not.toContain('LLM 路径失败')
    expect(existsSync(join(outDir, 'schema.ts'))).toBe(false)
  })
})
