import { describe, it, expect, afterEach } from 'vitest'
import {
  ZH_CN_MESSAGES,
  EN_US_MESSAGES,
  resolveBuiltinText,
  resolveLocaleName,
  getDefaultToolbarBtns,
  getDefaultRowBtns,
} from '../src/locale'
import { configureEsPlus, resetGlobalConfig, getLocaleVersion, subscribeLocaleChange } from '../src/config'

afterEach(() => resetGlobalConfig())

describe('内置文案字典', () => {
  it('zh/en 键集完全一致（漏键会渲染出 undefined）', () => {
    expect(Object.keys(EN_US_MESSAGES).sort()).toEqual(Object.keys(ZH_CN_MESSAGES).sort())
  })

  it('默认（未配置 locale）解析为 zh-CN，且逐值与历史字面量相同', () => {
    expect(resolveLocaleName()).toBe('zh-CN')
    expect(resolveBuiltinText('emptyText')).toBe('暂无数据')
    expect(resolveBuiltinText('loading')).toBe('努力加载中...')
    expect(resolveBuiltinText('operation')).toBe('操作')
    expect(resolveBuiltinText('deleteConfirm')).toBe('确定删除该条数据吗？')
    expect(resolveBuiltinText('confirmAction')).toBe('确定执行此操作吗？')
    expect(resolveBuiltinText('ok')).toBe('确定')
    expect(resolveBuiltinText('confirm')).toBe('确认')
  })

  it("locale:'en-US' 输出英文", () => {
    configureEsPlus({ locale: 'en-US' })
    expect(resolveBuiltinText('emptyText')).toBe('No data')
    expect(resolveBuiltinText('add')).toBe('Add')
    expect(resolveBuiltinText('operation')).toBe('Actions')
  })

  it('图标按钮的可访问名（aria-label）也有字典键，不再硬编码中文', () => {
    expect(resolveBuiltinText('fullscreen')).toBe('全屏')
    expect(resolveBuiltinText('exitFullscreen')).toBe('退出全屏')
    expect(resolveBuiltinText('close')).toBe('关闭')
    configureEsPlus({ locale: 'en-US' })
    expect(resolveBuiltinText('fullscreen')).toBe('Fullscreen')
    expect(resolveBuiltinText('exitFullscreen')).toBe('Exit fullscreen')
    expect(resolveBuiltinText('close')).toBe('Close')
  })

  it('messages 覆盖单键，且优先于 locale 字典', () => {
    configureEsPlus({ locale: 'en-US', messages: { operation: '操作列' } })
    expect(resolveBuiltinText('operation')).toBe('操作列')
    expect(resolveBuiltinText('add')).toBe('Add')
  })

  it('自定义 locale：name 以 en 开头取英文字典，否则回落 zh', () => {
    configureEsPlus({ locale: { name: 'en-GB', messages: { add: 'New' } } })
    expect(resolveBuiltinText('add')).toBe('New')
    expect(resolveBuiltinText('delete')).toBe('Delete')

    configureEsPlus({ locale: { name: 'ja-JP' } })
    expect(resolveBuiltinText('delete')).toBe('删除')
  })

  it('resetGlobalConfig 后回到缺省中文（locale 不会跨测试泄漏）', () => {
    configureEsPlus({ locale: 'en-US' })
    resetGlobalConfig()
    expect(resolveBuiltinText('add')).toBe('新增')
  })
})

describe('默认按钮 getter（locale 感知）', () => {
  it('默认中文：与静态兼容常量逐值相同', () => {
    const tb = getDefaultToolbarBtns()
    const row = getDefaultRowBtns()
    expect(tb.ADD).toMatchObject({ name: '新增', key: 'add', dialogKey: 'add' })
    expect(tb.EXPORT).toMatchObject({ name: '导出', actionType: 'export' })
    expect(tb.IMPORT).toMatchObject({ name: '导入', actionType: 'import' })
    expect(row.VIEW).toMatchObject({ name: '查看', dialogKey: 'view' })
    expect(row.EDIT).toMatchObject({ name: '编辑', dialogKey: 'edit' })
    expect(row.DELETE).toMatchObject({ name: '删除', confirm: '确定删除该条数据吗？' })
  })

  it('en-US：按钮名与确认文案一起切换', () => {
    configureEsPlus({ locale: 'en-US' })
    const tb = getDefaultToolbarBtns()
    const row = getDefaultRowBtns()
    expect(tb.ADD.name).toBe('Add')
    expect(row.DELETE.name).toBe('Delete')
    expect(row.DELETE.confirm).toBe(EN_US_MESSAGES.deleteConfirm)
  })
})

/**
 * P2-4：locale 运行期热切换的**通知层**（框架无关）。
 *
 * 真正的重算发生在渲染器包（各自的 `locale.ts` 用 ref 桥接版本号）；这里只钉
 * 「什么时候该通知 / 不该通知」的语义，避免 install 或无关配置把整棵树刷一遍。
 */
describe('locale 变更通知（P2-4）', () => {
  it('locale 真的变化时版本号 +1，并同步通知订阅者', () => {
    const before = getLocaleVersion()
    const seen: number[] = []
    const off = subscribeLocaleChange(() => seen.push(getLocaleVersion()))

    configureEsPlus({ locale: 'en-US' })

    expect(getLocaleVersion()).toBe(before + 1)
    expect(seen).toEqual([before + 1])
    off()
  })

  it('messages 覆盖也算 locale 变化（单键覆盖同样要重算）', () => {
    const before = getLocaleVersion()
    configureEsPlus({ messages: { operation: '操作列' } })
    expect(getLocaleVersion()).toBe(before + 1)
  })

  it('重复写同一 locale、或写无关配置，不通知', () => {
    configureEsPlus({ locale: 'en-US' })
    const v = getLocaleVersion()
    let calls = 0
    const off = subscribeLocaleChange(() => {
      calls += 1
    })

    configureEsPlus({ locale: 'en-US' })
    configureEsPlus({ componentSize: 'small' })

    expect(getLocaleVersion()).toBe(v)
    expect(calls).toBe(0)
    off()
  })

  it('resetGlobalConfig 回到默认中文并通知（避免测试间泄漏旧语言）', () => {
    configureEsPlus({ locale: 'en-US' })
    let calls = 0
    const off = subscribeLocaleChange(() => {
      calls += 1
    })

    resetGlobalConfig()

    expect(calls).toBe(1)
    expect(resolveBuiltinText('add')).toBe('新增')
    off()
  })

  it('退订后不再收到通知；某个订阅者抛错不影响其它订阅者', () => {
    const seen: string[] = []
    const offBad = subscribeLocaleChange(() => {
      throw new Error('boom')
    })
    const offGood = subscribeLocaleChange(() => seen.push('good'))

    expect(() => configureEsPlus({ locale: 'en-US' })).not.toThrow()
    offGood()
    configureEsPlus({ locale: 'zh-CN' })

    expect(seen).toEqual(['good'])
    offBad()
  })
})
