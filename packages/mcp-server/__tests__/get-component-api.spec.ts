// get_component_api is the tool the host LLM consults before writing render
// strings / choosing props. If a doc silently drifts from the real component
// API — or a template-literal escape leaks a literal `\n` into a TS fence — the
// model ingests wrong facts and the whole "don't fabricate the API" premise
// collapses. These tests drive the REAL handler and pin the shape of every doc
// for all six components across all three targets, plus the per-target branches
// (antdv-only props/emits, the vxe engine section). Written because two such
// defects (a literal `\n` in the SvgIcon fence, a self-contradicting antdv
// `open` emit) shipped past typecheck + 118 green tests with no signal.

import { describe, it, expect, beforeAll } from 'vitest'
import { COMPONENT_LIST, type ComponentName } from '@es-plus/shared'
import { registerGetComponentApi } from '../src/tools/get-component-api.js'

type Target = 'vue3' | 'vue2' | 'antdv'
const TARGETS: Target[] = ['vue3', 'vue2', 'antdv']

let call: (args: { component: ComponentName; target: Target }) => Promise<string>

beforeAll(() => {
  let handler: ((args: any) => Promise<any>) | undefined
  const stubServer = {
    tool(_name: string, _desc: string, _shape: unknown, h: (args: any) => Promise<any>) {
      handler = h
    },
  }
  registerGetComponentApi(stubServer as any)
  if (!handler) throw new Error('get_component_api did not register a handler')
  const h = handler
  call = async ({ component, target }) => {
    const res = await h({ component, target })
    return res.content[0].text as string
  }
})

describe('get_component_api — every doc is well-formed markdown', () => {
  const cases = COMPONENT_LIST.flatMap((c) => TARGETS.map((t) => [c, t] as const))

  it.each(cases)('%s / %s', async (component, target) => {
    const doc = await call({ component, target })
    expect(doc.length).toBeGreaterThan(80)
    expect(doc.startsWith('# ')).toBe(true)
    expect(doc).toContain(`(${target === 'antdv' ? '@es-plus/adapter-antdv' : `@es-plus/${target}`})`)
    // Balanced code fences — an odd count means a broken/empty block.
    const fences = doc.split('\n').filter((l) => l.trimStart().startsWith('```')).length
    expect(fences % 2, `unbalanced code fences in ${component}/${target}`).toBe(0)
    // No template-literal escape may leak as visible text (the SvgIcon `\n` bug).
    expect(doc, `literal escape leaked in ${component}/${target}`).not.toMatch(/\\[nt]/)
    expect(doc).not.toMatch(/\\`/)
  })
})

describe('get_component_api — EsDialog per-target branches', () => {
  it('antdv documents that it emits no `open` (and does not list it as a normal emit)', async () => {
    const doc = await call({ component: 'EsDialog', target: 'antdv' })
    expect(doc).toContain('antdv emits **no** `open` event')
    expect(doc).not.toContain('`open` — fired when it opens')
  })

  it.each(['vue3', 'vue2'] as const)('%s lists `open` as a normal emit', async (target) => {
    const doc = await call({ component: 'EsDialog', target })
    expect(doc).toContain('`open` — fired when it opens')
  })

  it.each(TARGETS)('%s exposes the uniform {close,closed,toggleFullscreen,doClose}', async (target) => {
    const doc = await call({ component: 'EsDialog', target })
    for (const m of ['`close()`', '`closed()`', '`toggleFullscreen()`', '`doClose()`']) {
      expect(doc, `missing ${m} in ${target}`).toContain(m)
    }
  })

  it('antdv adds title/default/footer slots; vue3/vue2 list footer only', async () => {
    const antdv = await call({ component: 'EsDialog', target: 'antdv' })
    const vue3 = await call({ component: 'EsDialog', target: 'vue3' })
    expect(antdv).toContain('`title` — header / `default` — body / `footer`')
    expect(vue3).not.toContain('`title` — header')
    expect(vue3).toContain('`footer`')
  })
})

describe('get_component_api — SvgIcon per-target props', () => {
  it('antdv: iconClass optional + iconName compat prop, no literal escape in the fence', async () => {
    const doc = await call({ component: 'SvgIcon', target: 'antdv' })
    expect(doc).toContain('iconClass?: string')
    expect(doc).toContain('iconName?: string')
    expect(doc).toContain('resolution = iconClass || iconName')
    // The exact defect: a raw `\n` rendered inside the TS interface fence.
    expect(doc).not.toContain('\\n')
    // And no stray blank line inside the interface block.
    expect(doc).not.toMatch(/className\?:\s*string[^\n]*\n\s*\n\s*}/)
  })

  it.each(['vue3', 'vue2'] as const)('%s: iconClass is required and there is no iconName', async (target) => {
    const doc = await call({ component: 'SvgIcon', target })
    expect(doc).toContain('iconClass: string')
    expect(doc).not.toContain('iconName')
  })

  it.each(TARGETS)('%s: documents the sprite id and the external-URL detector', async (target) => {
    const doc = await call({ component: 'SvgIcon', target })
    expect(doc).toContain('#icon-{iconClass}')
    expect(doc).toContain('/^(https?:|mailto:|tel:|open)/')
  })
})

describe('get_component_api — EsTable vxe engine section', () => {
  it.each(TARGETS)('%s documents engine:vxe, the escape hatch, and vxe-only methods', async (target) => {
    const doc = await call({ component: 'EsTable', target })
    expect(doc).toContain("## vxe engine — `options.engine: 'vxe'`")
    expect(doc).toContain('vxeConfig')
    expect(doc).toContain('vxeInstance()')
    expect(doc).toContain('getUpdateRecords()')
    for (const k of ['editConfig', 'toolbarConfig', 'treeConfig', 'proxyConfig']) {
      expect(doc, `missing vxe option ${k} in ${target}`).toContain(k)
    }
  })
})

describe('get_component_api — EsCrudPage surface', () => {
  it.each(TARGETS)('%s lists the full emits + exposed method set', async (target) => {
    const doc = await call({ component: 'EsCrudPage', target })
    for (const e of [
      'query', 'add', 'edit', 'delete', 'view', 'export',
      'row-click', 'btn-click', 'dialog-confirm', 'dialog-cancel', 'dialog-open',
    ]) {
      expect(doc, `missing emit ${e} in ${target}`).toContain(e)
    }
    for (const m of ['refresh()', 'getSelectedRows()', 'tableRef', 'formRef', 'queryModel', 'openDialog', 'closeDialog']) {
      expect(doc, `missing exposed ${m} in ${target}`).toContain(m)
    }
    // Key schema surface, must not silently drop.
    for (const k of ['formItems', 'formLayout', 'toolbarBtns', 'tableBtns', 'columns', 'tableOptions', 'pagination', 'operationColumn', 'dialogs']) {
      expect(doc, `missing CrudPageSchema key ${k} in ${target}`).toContain(k)
    }
  })
})

describe('get_component_api — registration contract', () => {
  it('the component enum documents all six names on one describe', () => {
    let shape: any
    const stub = { tool: (_n: string, _d: string, s: any) => { shape = s } }
    registerGetComponentApi(stub as any)
    const desc: string = shape.component.description
    for (const name of ['EsForm', 'EsTable', 'EsDialog', 'EsCrudPage', 'SvgIcon', 'useDialog']) {
      expect(desc).toContain(name)
    }
    expect(desc).toContain('vxe')
  })
})
