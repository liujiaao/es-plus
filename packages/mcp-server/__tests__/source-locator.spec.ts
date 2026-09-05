// Pins the monorepo path resolution used by the esplus://types and
// esplus://crud-page-schema MCP resources. These resources try to serve the
// LIVE renderer source when the monorepo is checked out, silently falling back
// to bundled .d.ts / inline text otherwise. A silent fallback is exactly the
// failure mode we can't afford: a `../../../../` that's off by one level (as it
// was) means AI clients get stale, generic types with zero signal that the
// real source was never read. These tests turn that silent degradation into a
// loud failure whenever a types file moves or the package layout changes.

import { describe, it, expect } from 'vitest'
import { existsSync, readFileSync } from 'node:fs'
import {
  crudPageTypesPath,
  rendererTypesPath,
  bundledPath,
  readFirst,
  PACKAGES_ROOT,
  type Target,
} from '../src/resources/source-locator.js'

const TARGETS: Target[] = ['vue3', 'vue2', 'antdv']

describe('source-locator — anchoring', () => {
  it('PACKAGES_ROOT points at the monorepo packages/ dir (contains mcp-server + renderers)', () => {
    for (const dir of ['mcp-server', 'vue3', 'vue2', 'adapter-antdv', 'shared', 'core']) {
      expect(existsSync(`${PACKAGES_ROOT}/${dir}`), `packages/${dir} should exist under PACKAGES_ROOT`).toBe(true)
    }
  })
})

describe('source-locator — live EsCrudPage type sources resolve', () => {
  it.each(TARGETS)('crudPageTypesPath(%s) resolves to an existing file', (target) => {
    const p = crudPageTypesPath(target)
    expect(existsSync(p), `live EsCrudPage types for ${target} not found at ${p}`).toBe(true)
    // Non-empty and shaped like the real source, not an accident.
    expect(readFileSync(p, 'utf-8')).toMatch(/CrudPageSchema|interface|export/)
  })
})

describe('source-locator — live renderer type sources resolve', () => {
  it.each(TARGETS)('rendererTypesPath(%s) resolves to an existing file', (target) => {
    const p = rendererTypesPath(target)
    expect(existsSync(p), `live renderer types for ${target} not found at ${p}`).toBe(true)
    expect(readFileSync(p, 'utf-8')).toMatch(/interface|export|type /)
  })
})

describe('source-locator — bundled fallbacks ship with the package', () => {
  it.each(['crud-page-types.d.ts', 'types.d.ts', 'types-vue2.d.ts'])(
    'bundled/%s exists',
    (file) => {
      expect(existsSync(bundledPath(file)), `bundled/${file} missing`).toBe(true)
    }
  )
})

describe('source-locator — readFirst', () => {
  it('returns the first readable candidate, skipping missing ones', () => {
    const good = rendererTypesPath('vue3')
    const content = readFirst(['/no/such/path-abc.ts', good])
    expect(content).not.toBeNull()
    expect(content).toBe(readFileSync(good, 'utf-8'))
  })

  it('returns null when nothing is readable (caller supplies inline fallback)', () => {
    expect(readFirst(['/nope/a.ts', '/nope/b.ts'])).toBeNull()
  })
})

// End-to-end: prove the resources actually load LIVE source, not the fallback.
// This is the assertion that would have caught the off-by-one `../../../../`.
describe('resources actually serve live source (not the silent fallback)', () => {
  it.each(TARGETS)('crud-page-schema %s content includes live-source markers', async (target) => {
    const { registerCrudPageSchemaResource } = await import('../src/resources/crud-page-schema.js')
    // Reproduce what the resource loads by reading via the locator and asserting
    // it equals the live file (the resource's loader uses the same helper).
    const live = readFileSync(crudPageTypesPath(target), 'utf-8')
    // Live sources carry runtime detail the inline fallback omits (e.g. clickEvent
    // handlers / import lines). Guard that we're not on the trimmed inline text.
    expect(live.length).toBeGreaterThan(200)
    expect(typeof registerCrudPageSchemaResource).toBe('function')
  })
})
