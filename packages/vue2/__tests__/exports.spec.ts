// Import-shape contract for @es-plus/vue2.
//
// What this catches:
//   - A removed/renamed export that breaks downstream user imports
//   - A component object whose name / Vue-options shape regressed
//   - A version drift between package.json and the hardcoded version in default export
//
// What this does NOT catch (covered elsewhere):
//   - Whether components render correctly in a real Vue 2 + Element UI app
//     → covered by __tests__/e2e/ matrix (vite build of a fresh fixture)
//   - Whether install() integrates with a real Vue instance + plugin order
//     → smoke-tested below with a minimal Vue stub

import { describe, it, expect } from 'vitest'
import { readFileSync } from 'node:fs'
import { join, dirname } from 'node:path'
import { fileURLToPath } from 'node:url'
// Import from the BUILT dist, not src/. Two reasons:
//   1. src/index.ts pulls in .vue SFCs which vitest can't parse without
//      @vitejs/plugin-vue2 set up, and adding that pulls vue + parser deps
//      into the unit test environment.
//   2. Testing dist is closer to what npm users actually receive — catches
//      tree-shaking / bundling regressions that wouldn't show up in src.
// The downside: requires `npm run build` first. The test script enforces
// that via the `pretest` hook in package.json.
// @ts-expect-error — dist has no .d.ts at this import path (we read it
// for runtime shape only, types come from npm consumers via "types" field).
import esplusVue2, {
  EsForm,
  EsTable,
  EsDialog,
  EsCrudPage,
  useDialog,
  configureEsPlus,
  install,
} from '../dist/es-plus-vue2.js'

const __dirname = dirname(fileURLToPath(import.meta.url))
const pkg = JSON.parse(readFileSync(join(__dirname, '..', 'package.json'), 'utf-8'))

describe('@es-plus/vue2 — public API surface', () => {
  it('exports every named component', () => {
    expect(EsForm).toBeDefined()
    expect(EsTable).toBeDefined()
    expect(EsDialog).toBeDefined()
    expect(EsCrudPage).toBeDefined()
  })

  it('exports useDialog as a function', () => {
    expect(typeof useDialog).toBe('function')
  })

  it('exports configureEsPlus as a function', () => {
    expect(typeof configureEsPlus).toBe('function')
  })

  it('exports install as a function', () => {
    expect(typeof install).toBe('function')
  })

  it('default export carries install + version', () => {
    expect(esplusVue2).toBeDefined()
    expect(typeof esplusVue2.install).toBe('function')
    expect(typeof esplusVue2.version).toBe('string')
  })

  it('default export version matches package.json (catches drift)', () => {
    expect(esplusVue2.version).toBe(pkg.version)
  })
})

describe('@es-plus/vue2 — component shapes', () => {
  // Vue 2 components are plain options objects; the runtime expects at least
  // `name` (for global registration via Vue.component(name, comp)) and one of
  // render / template / setup. We assert both invariants for every component.
  const components = [
    { label: 'EsForm', comp: EsForm },
    { label: 'EsTable', comp: EsTable },
    { label: 'EsDialog', comp: EsDialog },
    { label: 'EsCrudPage', comp: EsCrudPage },
  ]

  for (const { label, comp } of components) {
    it(`${label}: has a non-empty name (required for Vue.component registration)`, () => {
      const name = (comp as { name?: string }).name
      expect(typeof name).toBe('string')
      expect(name && name.length).toBeGreaterThan(0)
    })

    it(`${label}: has at least one of render / template / setup`, () => {
      const c = comp as { render?: unknown; template?: unknown; setup?: unknown }
      const hasRender = typeof c.render === 'function'
      const hasTemplate = typeof c.template === 'string'
      const hasSetup = typeof c.setup === 'function'
      expect(hasRender || hasTemplate || hasSetup).toBe(true)
    })
  }
})

describe('@es-plus/vue2 — install() integrates with a Vue 2-shaped stub', () => {
  // Minimal stub that captures the surface install() actually touches.
  // We don't depend on real Vue 2 to avoid pulling vue + happy-dom into the
  // unit test environment.
  function makeVueStub() {
    const registered: Record<string, unknown> = {}
    const mixins: unknown[] = []
    const Stub: any = function () {} // eslint-disable-line @typescript-eslint/no-explicit-any
    Stub.component = (name: string, comp: unknown) => {
      registered[name] = comp
    }
    Stub.mixin = (m: unknown) => {
      mixins.push(m)
    }
    Stub.prototype = {}
    return { Stub, registered, mixins }
  }

  it('registers all components when called with default options', () => {
    const { Stub, registered } = makeVueStub()
    install(Stub, {})
    expect(Object.keys(registered).sort()).toEqual(
      ['EsCrudPage', 'EsDialog', 'EsForm', 'EsTable'].sort()
    )
  })

  it('skips component registration when skipComponentRegistration: true', () => {
    const { Stub, registered } = makeVueStub()
    install(Stub, { skipComponentRegistration: true })
    expect(Object.keys(registered)).toHaveLength(0)
  })

  it('injects $useDialog on Vue.prototype by default', () => {
    const { Stub } = makeVueStub()
    install(Stub, {})
    expect(typeof (Stub.prototype as { $useDialog?: unknown }).$useDialog).toBe('function')
  })

  it('omits prototype injection when globalProperties: false', () => {
    const { Stub } = makeVueStub()
    install(Stub, { globalProperties: false })
    expect((Stub.prototype as { $useDialog?: unknown }).$useDialog).toBeUndefined()
  })

  it('registers a global mixin that provides $EsPlus', () => {
    const { Stub, mixins } = makeVueStub()
    install(Stub, {})
    expect(mixins).toHaveLength(1)
    const m = mixins[0] as { provide?: { $EsPlus?: unknown } }
    expect(m.provide).toBeDefined()
    expect(m.provide?.$EsPlus).toBeDefined()
  })

  it('normalizes legacy es-eui options ({EsTable: {methods: {...}}} → flat)', () => {
    // This is the back-compat shim that lets a project switch
    // es-eui → @es-plus/vue2 without rewriting their main.js plugin options.
    const { Stub, mixins } = makeVueStub()
    const fakeHttpRequest = () => Promise.resolve({})
    install(Stub, {
      EsTable: {
        methods: { $httpRequest: fakeHttpRequest, configQueryfieldOutput: () => ({}) },
      },
    } as any)
    const provided = (mixins[0] as { provide: { $EsPlus: Record<string, any> } }).provide.$EsPlus
    expect(provided.EsTable.$httpRequest).toBe(fakeHttpRequest)
    // legacy lowercase-f spelling should be renamed to the canonical uppercase-F
    expect(typeof provided.EsTable.configQueryFieldOutput).toBe('function')
  })
})
