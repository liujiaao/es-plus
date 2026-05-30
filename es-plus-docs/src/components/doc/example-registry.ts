// Centralized registry of in-doc example components, used by DemoBlock.vue
// to mount live demos referenced from Markdown via <demo name="..." />.
//
// Naming convention: `${category}-${slug}` where category ∈ {form, table, crud}
// and slug matches the example component file name (numeric prefix stripped, kebab-case).
//
// Example: `<demo name="form-basic" />` → /src/components/examples/form/Basic.vue

import type { Component } from 'vue'

interface ExampleSource {
  template: string
  script: string
  style: string
}

interface ExampleEntry {
  component: Component
  code: ExampleSource
}

// Eager-import all example components and their raw SFC sources at build time.
const components = import.meta.glob('@/components/examples/**/*.vue', {
  eager: true,
}) as Record<string, { default: Component }>

const rawSFCs = import.meta.glob('@/components/examples/**/*.vue', {
  query: '?raw',
  import: 'default',
  eager: true,
}) as Record<string, string>

function parseSFC(raw: string): ExampleSource {
  const t = raw.match(/<template>([\s\S]*)<\/template>/)
  const s = raw.match(/<script[^>]*>([\s\S]*?)<\/script>/)
  const st = raw.match(/<style[^>]*>([\s\S]*?)<\/style>/)
  return {
    template: t ? t[1].trim() : '',
    script: s ? s[1].trim() : '',
    style: st ? st[1].trim() : '',
  }
}

// Build the registry: derive `${category}-${slug}` from each path.
function buildRegistry(): Record<string, ExampleEntry> {
  const registry: Record<string, ExampleEntry> = {}

  for (const path in components) {
    // path = "/src/components/examples/form/Basic.vue"
    const match = path.match(/\/examples\/([^/]+)\/(.+?)\.vue$/)
    if (!match) continue
    const [, category, fileName] = match

    // Normalize file name: strip leading digits, convert PascalCase → kebab-case
    const slug = fileName
      .replace(/^[0-9]+-?/, '')
      .replace(/([a-z0-9])([A-Z])/g, '$1-$2')
      .toLowerCase()

    // category 'crud-page' → 'crud' for shorter demo names
    const cat = category === 'crud-page' ? 'crud' : category

    const key = `${cat}-${slug}`
    const raw = rawSFCs[path] || ''
    registry[key] = {
      component: components[path].default,
      code: parseSFC(raw),
    }
  }

  return registry
}

export const exampleRegistry: Record<string, ExampleEntry> = buildRegistry()

export function getExample(name: string): ExampleEntry | null {
  return exampleRegistry[name] || null
}

export function listExampleNames(): string[] {
  return Object.keys(exampleRegistry).sort()
}
