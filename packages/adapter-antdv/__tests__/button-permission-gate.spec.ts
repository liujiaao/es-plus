/**
 * Ant Design Vue 适配器 — 按钮级 permissionValue 门控（渲染见证）
 *
 * 为什么单独立一份：`es-form.spec.ts` 覆盖的是**字段级**门控，按钮级只有
 * `config.spec.ts` 的「permission 能注入」这种不渲染的断言 —— 于是下面这个真实的
 * 渲染缺陷在 702 条用例全绿的情况下溜进了发布候选：
 *
 *   `<a-button v-for="…" v-if="checkPermission(it.permissionValue)">`
 *
 * Vue 3 里 **v-if 优先于 v-for**，两个指令落在同一元素时，v-if 的表达式会被提到循环
 * **外面**求值（`@vue/compiler-sfc` 编出 `_ctx.checkPermission(_ctx.item.permissionValue)`），
 * 而 `_ctx.item` 在循环外是 undefined —— 渲染直接抛 `Cannot read properties of undefined`。
 * 表现是「只要有按钮就崩」，且 vue-tsc 会报 TS2339（adapter-antdv 的 prepublishOnly 是
 * `typecheck && build`，所以它同时是一条发布阻断）。
 *
 * 契约：按钮上的权限门必须写在 **`<template v-for>` 内层元素**的 v-if 上，
 * 与 `@es-plus/vue3` / `@es-plus/vue2` 同形。本文件同时钉住 fail-closed 语义：
 * 声明了 permissionValue 却没配 permission() → 拒绝渲染（不是放行）。
 */
import { describe, it, expect, afterEach, vi } from 'vitest'
import { mount } from '@vue/test-utils'
import { nextTick } from 'vue'

// EsForm 会 import es-table 与 use-dialog；渲染门控不需要它们。
vi.mock('../src/components/es-dialog/src/use-dialog', () => ({
  useDialog: vi.fn(() => ({ close: vi.fn(), destroy: vi.fn() })),
  default: vi.fn(() => ({ close: vi.fn(), destroy: vi.fn() }))
}))
vi.mock('../src/components/es-table', () => ({
  default: { name: 'EsTable', install: vi.fn() }
}))

import EsForm from '../src/components/es-form/src/es-form.vue'
import EsDialog from '../src/components/es-dialog/src/component.vue'

/** antdv 在两个中文字符之间插入空格，断言前先抹平 */
const btnTexts = (root: ParentNode) =>
  [...root.querySelectorAll('.ant-btn')].map((b) => b.textContent?.replace(/\s+/g, '') ?? '')

const settle = async () => {
  await nextTick()
  await nextTick()
  await nextTick()
}

const mountForm = (props: Record<string, unknown> = {}) =>
  mount(EsForm, {
    props: { model: {}, formItemList: [{ prop: 'a', label: 'A', formtype: 'Input' }], ...props }
  })

afterEach(async () => {
  document.body.innerHTML = ''
  const { resetGlobalConfig } = await import('@es-plus/core')
  resetGlobalConfig()
})

describe('按钮级 permissionValue 门控（ADV 端）', () => {
  it('EsForm 的 configBtn 真的渲染出来（v-for / v-if 同标签会整块抛错）', async () => {
    const wrapper = mountForm({
      configBtn: [
        { name: '查询', key: 'query', type: 'primary' },
        { name: '重置', key: 'rest' }
      ]
    })
    await settle()
    const texts = btnTexts(wrapper.element)
    expect(texts).toContain('查询')
    expect(texts).toContain('重置')
  })

  it('permission() 拒绝的按钮不渲染，其余照常', async () => {
    const { configureEsPlus } = await import('@es-plus/core')
    configureEsPlus({ permission: (v: string) => v !== 'user:delete' } as any)
    const wrapper = mountForm({
      configBtn: [
        { name: '新增', key: 'add', permissionValue: 'user:add' },
        { name: '删除', key: 'del', permissionValue: 'user:delete' }
      ]
    })
    await settle()
    const texts = btnTexts(wrapper.element)
    expect(texts).toContain('新增')
    expect(texts).not.toContain('删除')
  })

  it('未配置 permission() 时，声明了 permissionValue 的按钮被拒绝（fail-closed）', async () => {
    const wrapper = mountForm({
      configBtn: [
        { name: '新增', key: 'add', permissionValue: 'user:add' },
        { name: '重置', key: 'rest' }
      ]
    })
    await settle()
    const texts = btnTexts(wrapper.element)
    expect(texts).toContain('重置')
    expect(texts).not.toContain('新增')
  })

  it('EsDialog 的 footer 按钮真的渲染出来（同一类 v-for / v-if 缺陷）', async () => {
    mount(EsDialog, {
      props: {
        visible: true,
        render: () => null,
        configBtn: [
          { name: '确定', key: 'ok', type: 'primary' },
          { name: '取消', key: 'cancel' }
        ]
      }
    })
    await settle()
    const texts = btnTexts(document.body)
    expect(texts).toContain('确定')
    expect(texts).toContain('取消')
  })
})
