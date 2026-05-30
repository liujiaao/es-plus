// Unit tests for the detect_project_target MCP tool. This tool is the FIRST
// thing AI-aware clients (Claude Code / Cursor / Continue) call before they
// invoke any generator — so a wrong answer here cascades into vue3 code
// being emitted into a vue2 project (or vice versa). Cover every realistic
// package.json shape we expect to see in the wild.

import { describe, it, expect } from 'vitest'
import { detect } from '../src/tools/detect-project-target.js'

const stringify = (obj: unknown) => JSON.stringify(obj)

describe('detect — tier 1: explicit es-plus packages (high confidence)', () => {
  it('returns vue3 when only @es-plus/vue3 is declared', () => {
    const r = detect(stringify({ dependencies: { '@es-plus/vue3': '^1.4.0' } }))
    expect(r.target).toBe('vue3')
    expect(r.confidence).toBe('high')
    expect(r.signals['@es-plus/vue3']).toBe('^1.4.0')
  })

  it('returns vue2 when only @es-plus/vue2 is declared', () => {
    const r = detect(stringify({ dependencies: { '@es-plus/vue2': '^1.0.0' } }))
    expect(r.target).toBe('vue2')
    expect(r.confidence).toBe('high')
  })

  it('falls back to vue3 with LOW confidence when both vue2 and vue3 declared', () => {
    const r = detect(stringify({
      dependencies: { '@es-plus/vue3': '^1.4.0', '@es-plus/vue2': '^1.0.0' },
    }))
    expect(r.target).toBe('vue3')
    expect(r.confidence).toBe('low')
    expect(r.reasoning.toLowerCase()).toContain('ambiguous')
  })

  it('returns vue3 + migration hint when legacy es-plus-ui is declared', () => {
    const r = detect(stringify({ dependencies: { 'es-plus-ui': '^1.3.5' } }))
    expect(r.target).toBe('vue3')
    expect(r.confidence).toBe('high')
    expect(r.reasoning).toContain('es-plus-ui')
    expect(r.reasoning.toLowerCase()).toMatch(/migrat|migration|legacy/)
  })
})

describe('detect — tier 2: infer from Vue + Element layer', () => {
  it('vue@2 + element-ui → vue2 high confidence', () => {
    const r = detect(stringify({
      dependencies: { vue: '^2.7.0', 'element-ui': '^2.15.0' },
    }))
    expect(r.target).toBe('vue2')
    expect(r.confidence).toBe('high')
  })

  it('vue@3 + element-plus → vue3 high confidence', () => {
    const r = detect(stringify({
      dependencies: { vue: '^3.4.0', 'element-plus': '^2.5.0' },
    }))
    expect(r.target).toBe('vue3')
    expect(r.confidence).toBe('high')
  })

  it('vue@2 only (no element layer) → vue2 medium confidence', () => {
    const r = detect(stringify({ dependencies: { vue: '~2.6.14' } }))
    expect(r.target).toBe('vue2')
    expect(r.confidence).toBe('medium')
  })

  it('vue@3 only (no element layer) → vue3 medium confidence', () => {
    const r = detect(stringify({ dependencies: { vue: '3.4.0' } }))
    expect(r.target).toBe('vue3')
    expect(r.confidence).toBe('medium')
  })

  it('element-ui only (no vue dep listed — peer-only) → vue2 medium', () => {
    const r = detect(stringify({ dependencies: { 'element-ui': '^2.15.0' } }))
    expect(r.target).toBe('vue2')
    expect(r.confidence).toBe('medium')
  })

  it('element-plus only → vue3 medium', () => {
    const r = detect(stringify({ dependencies: { 'element-plus': '^2.5.0' } }))
    expect(r.target).toBe('vue3')
    expect(r.confidence).toBe('medium')
  })
})

describe('detect — devDependencies + peerDependencies are checked too', () => {
  it('reads vue from devDependencies', () => {
    const r = detect(stringify({ devDependencies: { vue: '^3.4.0' } }))
    expect(r.target).toBe('vue3')
  })

  it('reads es-plus packages from peerDependencies', () => {
    const r = detect(stringify({ peerDependencies: { '@es-plus/vue2': '^1.0.0' } }))
    expect(r.target).toBe('vue2')
    expect(r.confidence).toBe('high')
  })
})

describe('detect — semver edge cases', () => {
  it('handles range prefixes correctly (^, ~, >=)', () => {
    expect(detect(stringify({ dependencies: { vue: '^2.7.0' } })).target).toBe('vue2')
    expect(detect(stringify({ dependencies: { vue: '~2.6.0' } })).target).toBe('vue2')
    expect(detect(stringify({ dependencies: { vue: '>=3.0.0' } })).target).toBe('vue3')
  })

  it('handles exact pinned version', () => {
    expect(detect(stringify({ dependencies: { vue: '3.4.0' } })).target).toBe('vue3')
  })

  it('handles pre-release suffix', () => {
    expect(detect(stringify({ dependencies: { vue: '3.5.0-beta.1' } })).target).toBe('vue3')
  })
})

describe('detect — degenerate input → low-confidence vue3 fallback', () => {
  it('empty package.json → low confidence vue3', () => {
    const r = detect(stringify({}))
    expect(r.target).toBe('vue3')
    expect(r.confidence).toBe('low')
  })

  it('no vue / no element / no es-plus → low confidence vue3', () => {
    const r = detect(stringify({ dependencies: { axios: '^1.0.0', lodash: '^4.17.0' } }))
    expect(r.target).toBe('vue3')
    expect(r.confidence).toBe('low')
  })

  it('completely malformed JSON → low confidence vue3 with parse error reason', () => {
    const r = detect('{this is not json')
    expect(r.target).toBe('vue3')
    expect(r.confidence).toBe('low')
    expect(r.reasoning).toContain('parse')
  })

  it('JSON but not an object (e.g. array) → still safe, returns low-confidence vue3', () => {
    // detect should not throw on weird input
    const r = detect('[]')
    expect(r.target).toBe('vue3')
    expect(r.confidence).toBe('low')
  })
})

describe('detect — output shape contract', () => {
  it('always returns target / confidence / reasoning / signals', () => {
    const r = detect(stringify({ dependencies: { vue: '^3.4.0' } }))
    expect(r).toHaveProperty('target')
    expect(r).toHaveProperty('confidence')
    expect(r).toHaveProperty('reasoning')
    expect(r).toHaveProperty('signals')
    expect(['vue3', 'vue2']).toContain(r.target)
    expect(['high', 'medium', 'low']).toContain(r.confidence)
    expect(typeof r.reasoning).toBe('string')
    expect(typeof r.signals).toBe('object')
  })

  it('signals dict reflects only relevant deps (no axios noise)', () => {
    const r = detect(stringify({
      dependencies: {
        vue: '^3.4.0',
        'element-plus': '^2.5.0',
        axios: '^1.0.0',
        lodash: '^4.17.0',
      },
    }))
    expect(r.signals.vue).toBe('^3.4.0')
    expect(r.signals['element-plus']).toBe('^2.5.0')
    expect(r.signals.axios).toBeUndefined()
    expect(r.signals.lodash).toBeUndefined()
  })
})
