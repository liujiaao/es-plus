// AI-19: `generateScaffold` 现无任何单测（唯一相关的 check-scaffold.mjs 覆盖的是另一个
// 起点模板 create-es-plus）。本文件钉住两件事：
//
//  1. `generateScaffold` 的返回值仍然是**合法的单文件 .vue**（`<template>` 开头、
//     `</script>` 结尾）—— CLI `scaffold` 命令按单文件写入，一旦入口样板误混进 SFC，
//     写出的 .vue 会坏。新增的装配说明必须是**注释**。
//  2. `generateAppEntry` 产出三端各自的入口装配样板（vue3/antdv `app.use(ESPlus, …)`、
//     vue2 `Vue.use(ESPlus, …)`），且带上 permission / t / httpRequest 三个跨文件前提项。

import { describe, it, expect } from 'vitest'
import { generateScaffold, generateAppEntry } from '../src/code-generator.js'

const TARGETS = ['vue3', 'vue2', 'antdv'] as const

describe('generateScaffold — 返回值仍是合法单文件 .vue', () => {
  for (const target of TARGETS) {
    for (const features of [undefined, ['query'], ['table'], ['query', 'table', 'dialog']]) {
      it(`target=${target} features=${JSON.stringify(features)}：<template> 开头、</script> 结尾`, () => {
        const sfc = generateScaffold('user-manage', features, target)
        expect(sfc.startsWith('<template>')).toBe(true)
        expect(sfc.trimEnd().endsWith('</script>')).toBe(true)
      })
    }
  }

  it('装配说明只以注释形式出现 —— 不含可执行的 app.use(ESPlus / Vue.use(ESPlus', () => {
    for (const target of TARGETS) {
      const sfc = generateScaffold('user-manage', ['query', 'table'], target)
      // 注释行里有 app.use(ESPlus / Vue.use(ESPlus 字样是允许的（说明用），
      // 但绝不能是本文件内的**可执行装配**——用「不在注释里」探测：
      for (const line of sfc.split('\n')) {
        if (/app\.use\(ESPlus|Vue\.use\(ESPlus/.test(line)) {
          expect(line.trim().startsWith('//'), `target=${target} 出现非注释装配行: ${line}`).toBe(true)
        }
      }
    }
  })
})

describe('generateAppEntry — 三端入口装配样板', () => {
  it('vue3：app.use(ESPlus, …) + permission / t / httpRequest', () => {
    const entry = generateAppEntry('vue3')
    expect(entry).toContain('app.use(ESPlus, {')
    expect(entry).not.toContain('Vue.use(ESPlus')
    expect(entry).toContain('permission:')
    expect(entry).toContain('t:')
    expect(entry).toContain('httpRequest:')
    expect(entry).toContain('@es-plus/vue3')
    expect(entry).toContain('src/main.ts')
    // AN-15：默认 target 也必须装配自己的 UI 库与 es-plus 样式 —— 否则「照抄入口」的
    // 用户拿到的是 el-* 全部未知元素的页面（生成物本身编译通过）。
    expect(entry).toContain("import ElementPlus from 'element-plus'")
    expect(entry).toContain("import 'element-plus/dist/index.css'")
    expect(entry).toContain('app.use(ElementPlus)')
    expect(entry).toContain("import '@es-plus/vue3/dist/style.css'")
  })

  it('antdv：额外前置 app.use(Antd) 且包名指向 adapter-antdv', () => {
    const entry = generateAppEntry('antdv')
    expect(entry).toContain('app.use(Antd)')
    expect(entry).toContain('app.use(ESPlus, {')
    expect(entry).toContain('@es-plus/adapter-antdv')
    expect(entry).toContain('permission:')
    expect(entry).toContain('t:')
    expect(entry).toContain('httpRequest:')
    expect(entry).toContain("import '@es-plus/adapter-antdv/dist/style.css'")
  })

  it('vue2：Vue.use(ESPlus, …) —— 且不含 app.use(ESPlus，文件名为 main.js', () => {
    const entry = generateAppEntry('vue2')
    expect(entry).toContain('Vue.use(ESPlus, {')
    expect(entry).not.toContain('app.use(ESPlus')
    expect(entry).toContain('Vue.use(ElementUI)')
    expect(entry).toContain('@es-plus/vue2')
    expect(entry).toContain('permission:')
    expect(entry).toContain('t:')
    expect(entry).toContain('httpRequest:')
    expect(entry).toContain('src/main.js')
    expect(entry).toContain("import '@es-plus/vue2/dist/style.css'")
  })

  it('默认 target（未传参）等同 vue3', () => {
    expect(generateAppEntry()).toBe(generateAppEntry('vue3'))
  })
})
