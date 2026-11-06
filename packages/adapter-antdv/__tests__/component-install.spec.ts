/**
 * 每个组件自带的 `.install()` 入口此前**没有任何测试覆盖** ——
 * `coverage.thresholds.functions` 正是被这类「一眼看过去像样板代码」的入口拖下去的
 * （2026-11-06 实测：安装入口 + EsForm/EsTable 的 Plugin.install 共 9 个函数全 0 命中）。
 *
 * 这些入口虽然只有一行 `app.component(...)`，但它们是**包级契约**：
 *   - 用户 `import { EsForm } from '@es-plus/adapter-antdv'` 后 `app.use(EsForm)` 能否生效；
 *   - 注册名缺省时用组件 `name`，组件改名会静默换掉全局组件名；
 *   - Plugin 版本还要 `provide('$esPlusForm'/'$esPlusTable')` 并挂 `methods.useDialog`。
 * 改动这些地方不会让任何既有测试变红，只会让上面三条悄悄失效 —— 所以这里逐条钉住。
 */
import { describe, it, expect } from 'vitest'
import { defineComponent, h, nextTick } from 'vue'
import { mount } from '@vue/test-utils'

import EsCrudPage from '../src/components/es-crud-page'
import EsDialog from '../src/components/es-dialog'
import EsForm from '../src/components/es-form'
import EsTable from '../src/components/es-table'
import EsErrorBoundary from '../src/components/es-error-boundary'
import SvgIcon from '../src/components/svg-icon'

/**
 * 最小 app 桩：只实现各 install 会碰到的两个方法。
 * 用 `createApp` 也行，但桩能让「注册名」「provide 的键」成为可直接断言的记录。
 */
function makeApp() {
  const registered: Record<string, any> = {}
  const provided: Record<string, any> = {}
  return {
    app: {
      component(name: string, comp?: any) {
        if (comp === undefined) return registered[name]
        registered[name] = comp
        return comp
      },
      provide(key: string, value: any) {
        provided[key] = value
      },
    },
    registered,
    provided,
  }
}

describe('adapter-antdv 组件自带的 install()', () => {
  const CASES: Array<{ label: string; comp: any; fallbackName: string }> = [
    { label: 'EsCrudPage', comp: EsCrudPage, fallbackName: 'EsCrudPage' },
    { label: 'EsDialog', comp: EsDialog, fallbackName: 'EsDialog' },
    { label: 'EsForm', comp: EsForm, fallbackName: 'EsForm' },
    { label: 'EsTable', comp: EsTable, fallbackName: 'EsTable' },
    { label: 'EsErrorBoundary', comp: EsErrorBoundary, fallbackName: 'EsErrorBoundary' },
    { label: 'SvgIcon', comp: SvgIcon, fallbackName: 'SvgIcon' },
  ]

  for (const { label, comp, fallbackName } of CASES) {
    it(`${label}.install 按组件 name 全局注册同一份实现`, () => {
      const { app, registered } = makeApp()

      // 缺省名规则与源码一致：`Comp.name || '<备选名>'`
      const expectedName = comp.name || fallbackName

      comp.install(app)

      expect(Object.keys(registered)).toContain(expectedName)
      expect(registered[expectedName]).toBe(comp)
    })
  }
})

describe('EsForm / EsTable 的 Plugin.install', () => {
  it('EsForm：注入 $esPlusForm 配置视图，并给注册的组件挂 methods.useDialog', () => {
    const { app, registered, provided } = makeApp()

    EsForm.Plugin.install(app, {})

    const view = provided.$esPlusForm
    expect(view).toBeTruthy()
    // 配置视图的 `useDialog` 是 extras 里带进来的（不是从全局配置读的）
    expect(typeof view.useDialog).toBe('function')
    // 真的调一次：这个箭头是 extras 传入的独立函数，只 `typeof` 断言不会执行到它
    expect(typeof view.useDialog()).toBe('function')

    const registeredForm = registered[EsForm.name || 'EsForm']
    expect(registeredForm).toBeTruthy()
    // 注册的是 EsForm 的**副本**，本体不能被就地改写
    expect(registeredForm).not.toBe(EsForm)
    expect(typeof registeredForm.methods.useDialog).toBe('function')
    // 调用一次确认返回的是可调用的 useDialog（而不是抛错的空壳）
    expect(typeof registeredForm.methods.useDialog()).toBe('function')
  })

  it('EsForm：options.methods 会并入注册副本', () => {
    const { app, registered } = makeApp()

    EsForm.Plugin.install(app, { methods: { custom: () => 42 } })

    expect(registered[EsForm.name || 'EsForm'].methods.custom()).toBe(42)
  })

  it('EsTable：注入 $esPlusTable，并透传 options.methods', () => {
    const { app, registered, provided } = makeApp()

    EsTable.Plugin.install(app, { methods: { rowKeyOf: (row: any) => row.id } })

    expect(provided.$esPlusTable).toBeTruthy()
    const registeredTable = registered[EsTable.name || 'EsTable']
    expect(registeredTable).not.toBe(EsTable)
    expect(registeredTable.methods.rowKeyOf({ id: 7 })).toBe(7)
  })
})

describe('EsErrorBoundary.reset()', () => {
  it('捕获子树错误后，reset 能清掉错误态并重新渲染子树', async () => {
    let broken = true
    const Flaky = defineComponent({
      name: 'Flaky',
      render() {
        if (broken) throw new Error('boom')
        return h('div', { class: 'recovered' }, 'ok')
      },
    })

    const wrapper = mount(EsErrorBoundary, {
      slots: { default: () => h(Flaky) },
    })
    // onErrorCaptured 在渲染期触发，改用 fallback 的那次重渲染要等到下一拍
    await nextTick()

    // 先确认确实降级到了 fallback（否则下面的 reset 断言等于什么都没验）
    expect(wrapper.find('.es-error-boundary').exists()).toBe(true)

    broken = false
    ;(wrapper.vm as any).reset()
    await nextTick()

    expect(wrapper.find('.es-error-boundary').exists()).toBe(false)
    expect(wrapper.find('.recovered').text()).toBe('ok')
  })
})
