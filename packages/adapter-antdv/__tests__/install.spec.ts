/**
 * 插件安装语义测试
 *
 * 回归背景：`install()` 此前把「普通全局注册」和「per-component Plugin 注册」两段
 * 无条件各跑一遍，导致 EsForm/EsTable 同名注册两次 —— dev 环境必刷
 * `[Vue warn] Component "EsForm" has already been registered`，且最终生效的是
 * 后注册的 Plugin 版本。@es-plus/vue3 早有针对该场景的守卫，antdv 端遗漏
 * （源码注释却写着「完全对齐 vue3」）。
 *
 * 这里锁死两条不变量：
 *   1. 默认安装不得产生重复注册告警；
 *   2. `globalProperties: false` 时组件仍会被普通注册（守卫不能把这条路径也跳过）。
 */
import { describe, it, expect, vi, afterEach } from 'vitest'
import { createApp } from 'vue'
import ESPlus from '../src/index'

const makeApp = () => createApp({ render: () => null })

afterEach(() => {
  vi.restoreAllMocks()
})

describe('adapter-antdv install() — 注册语义', () => {
  it('默认安装不产生 "already been registered" 告警', () => {
    const warnSpy = vi.spyOn(console, 'warn').mockImplementation(() => {})
    const app = makeApp()

    app.use(ESPlus, {})

    const duplicateWarns = warnSpy.mock.calls.filter((args) =>
      String(args[0] ?? '').includes('already been registered'),
    )
    expect(duplicateWarns).toEqual([])
  })

  it('globalProperties:false 时组件走普通注册路径', () => {
    const app = makeApp()

    app.use(ESPlus, { globalProperties: false })

    // 该模式下不会有 Plugin 注册，组件必须由普通注册补上，否则用户拿不到全局组件
    expect(app.component('EsForm')).toBeTruthy()
    expect(app.component('EsTable')).toBeTruthy()
  })

  it('默认安装后 EsForm / EsTable 仍可用（守卫未误伤组件注册）', () => {
    const app = makeApp()

    app.use(ESPlus, {})

    expect(app.component('EsForm')).toBeTruthy()
    expect(app.component('EsTable')).toBeTruthy()
  })

  it('skipComponentRegistration 单独使用不足以阻止注册（Plugin 自身会注册，与 vue3 一致）', () => {
    const app = makeApp()

    app.use(ESPlus, { skipComponentRegistration: true })

    // 记录既有语义：带 Plugin 的组件由 Plugin 的 install 自行 app.component，
    // 该 flag 只跳过 install() 里的普通注册循环。vue3 端行为完全相同。
    expect(app.component('EsForm')).toBeTruthy()
  })

  it('skipComponentRegistration + globalProperties:false 才是完全跳过注册', () => {
    const app = makeApp()

    app.use(ESPlus, { skipComponentRegistration: true, globalProperties: false })

    expect(app.component('EsForm')).toBeFalsy()
    expect(app.component('EsTable')).toBeFalsy()
  })
})
