// Inline shared util sources (vite ?raw) so we can ship them as files inside
// the StackBlitz sandbox when an example references them via the `@/utils/...`
// alias. The alias only exists in our docs project — sandbox doesn't have it,
// so we copy the file in and rewrite the import to a relative path.
import mockApiSource from './mock-api?raw'

// Open the given Vue SFC source in a new StackBlitz tab.
// Why StackBlitz over CodeSandbox: StackBlitz's WebContainer runs real Node.js
// + real npm in the browser and is the de-facto standard for Vue ecosystem
// demos (vuejs.org, element-plus.org both use it). CodeSandbox NodeBox's npm
// mirror has been observed to silently fail for newly-published scoped packages
// (left @es-plus/vue3 uninstalled, blank preview, no error surface).
//
// API: POST to https://stackblitz.com/run with form-encoded
// `project[files][<path>]=<content>` plus a few control fields.
// Reference: https://developer.stackblitz.com/platform/api/posting-data-to-create-projects

interface StackBlitzFiles {
  [path: string]: string
}

export interface SandboxInput {
  template: string
  script: string
  style?: string
  /** Title shown on the project page */
  title?: string
  /** Description shown on the project page */
  description?: string
}

const PUBLISHED_PKG = '@es-plus/vue3'
const PUBLISHED_VERSION = '^1.4.0'
const ELEMENT_PLUS_VERSION = '^2.5.0'
const ICONS_VUE_VERSION = '^2.3.0'
const VUE_VERSION = '^3.4.0'

function rewriteImports(src: string): string {
  if (!src) return src
  // 1) Local 'es-plus' alias → published '@es-plus/vue3'
  // 2) '@/...' docs-project alias → './...' relative path (sandbox layout
  //    has src/App.vue + src/utils/* siblings, so the relative form works)
  return src
    .replace(/(['"])es-plus\1/g, `'${PUBLISHED_PKG}'`)
    .replace(/(['"])es-plus\/dist\/style\.css\1/g, `'${PUBLISHED_PKG}/dist/style.css'`)
    .replace(/(['"])es-plus\/([^'"]+)\1/g, `'${PUBLISHED_PKG}/$2'`)
    .replace(/(['"])@\/([^'"]+)\1/g, `'./$2'`)
}

// Map of shared docs utils that examples can reference via `@/utils/<name>`.
// Each entry gets dropped into the sandbox as `src/utils/<name>.<ext>` only
// when the example actually imports it.
const SHARED_UTIL_FILES: Array<{ importMatch: RegExp; sandboxPath: string; content: string }> = [
  {
    importMatch: /(['"])@\/utils\/mock-api\1/,
    sandboxPath: 'src/utils/mock-api.ts',
    content: mockApiSource,
  },
]

function collectSharedUtilFiles(script: string): Record<string, string> {
  const out: Record<string, string> = {}
  for (const util of SHARED_UTIL_FILES) {
    if (util.importMatch.test(script)) {
      out[util.sandboxPath] = util.content
    }
  }
  return out
}

// Detect JSX usage inside a <script setup> body. We look for the most common
// patterns: returning a tag, an arrow returning a tag, or a closing tag with
// a PascalCase or kebab-cased component name. Heuristic-only — false positives
// are cheap (extra `lang="jsx"` is harmless when @vitejs/plugin-vue-jsx is on).
function detectJsx(script: string): boolean {
  if (!script) return false
  return (
    /\breturn\s*\(?\s*<[A-Za-z]/.test(script) ||
    /=>\s*\(?\s*<[A-Za-z]/.test(script) ||
    /<\/[A-Za-z][A-Za-z0-9-]*>/.test(script)
  )
}

function detectTs(script: string): boolean {
  if (!script) return false
  // Common TS-only constructs: type annotations on declarations, generics,
  // `as` type assertions, interface/type keywords. These don't appear in plain JS.
  return (
    /\b(?:const|let|var|function)\s+\w+\s*:\s*[A-Z]/.test(script) ||
    /\bas\s+[A-Z][\w<>[\]]*\b/.test(script) ||
    /\b(?:interface|type)\s+[A-Z]/.test(script) ||
    /<[A-Z][\w]*>/.test(script.replace(/return[^;]*/g, '')) // generic <T>, but avoid matching JSX returns
  )
}

function buildAppVue({ template, script, style }: SandboxInput): string {
  const styleBlock = style && style.trim() ? `\n\n<style scoped>\n${style}\n</style>\n` : ''
  const looksLikeSetup =
    /\bimport\s+/.test(script) ||
    /\b(const|let|var)\s+/.test(script) ||
    /\bdefineProps\b|\bdefineEmits\b|\bref\(|\breactive\(/.test(script)
  const hasJsx = detectJsx(script)
  const hasTs = detectTs(script)
  // tsx > jsx > ts > (none)
  let lang = ''
  if (hasJsx && hasTs) lang = 'tsx'
  else if (hasJsx) lang = 'jsx'
  else if (hasTs) lang = 'ts'
  const langAttr = lang ? ` lang="${lang}"` : ''
  const scriptOpen = looksLikeSetup ? `<script setup${langAttr}>` : `<script${langAttr}>`
  const rewritten = rewriteImports(script)
  return `<template>
${template}
</template>

${scriptOpen}
${rewritten}
</script>${styleBlock}
`
}

function buildIndexHtml(title: string): string {
  return `<!DOCTYPE html>
<html lang="zh-CN">
<head>
  <meta charset="UTF-8" />
  <title>${title}</title>
</head>
<body>
  <div id="app"></div>
  <script type="module" src="/src/main.js"></script>
</body>
</html>
`
}

function buildMainJs(): string {
  return `import { createApp } from 'vue'
import ElementPlus from 'element-plus'
import 'element-plus/dist/index.css'
import * as ElementPlusIconsVue from '@element-plus/icons-vue'
import ESPlus from '${PUBLISHED_PKG}'
import '${PUBLISHED_PKG}/dist/style.css'
import App from './App.vue'

const app = createApp(App)
for (const [key, component] of Object.entries(ElementPlusIconsVue)) {
  app.component(key, component)
}
app.use(ElementPlus, { size: 'small' })
app.use(ESPlus)
app.mount('#app')
`
}

function buildPackageJson(title: string): string {
  return JSON.stringify({
    name: title.replace(/[^a-z0-9-]/gi, '-').toLowerCase() || 'es-plus-demo',
    version: '0.0.0',
    private: true,
    type: 'module',
    scripts: {
      dev: 'vite',
      build: 'vite build',
      preview: 'vite preview',
    },
    dependencies: {
      vue: VUE_VERSION,
      'element-plus': ELEMENT_PLUS_VERSION,
      '@element-plus/icons-vue': ICONS_VUE_VERSION,
      [PUBLISHED_PKG]: PUBLISHED_VERSION,
    },
    devDependencies: {
      '@vitejs/plugin-vue': '^5.0.0',
      '@vitejs/plugin-vue-jsx': '^4.0.0',
      vite: '^5.0.0',
    },
  }, null, 2)
}

function buildViteConfig(): string {
  return `import { defineConfig } from 'vite'
import vue from '@vitejs/plugin-vue'
import vueJsx from '@vitejs/plugin-vue-jsx'

export default defineConfig({
  plugins: [vue(), vueJsx()],
})
`
}

// Kept as an exported no-op so existing callers don't need to change.
// The previous implementation prefetched dist files from unpkg; StackBlitz
// installs everything itself via npm so no prefetch is needed.
export function prefetchSandboxVendor(): void {
  // intentionally empty
}

export async function openInCodeSandbox(input: SandboxInput): Promise<void> {
  const title = input.title || 'ES-Plus Demo'
  const description = input.description || 'Live demo of an ES-Plus example.'

  const files: StackBlitzFiles = {
    'package.json': buildPackageJson(title),
    'vite.config.js': buildViteConfig(),
    'index.html': buildIndexHtml(title),
    'src/main.js': buildMainJs(),
    'src/App.vue': buildAppVue(input),
    ...collectSharedUtilFiles(input.script),
  }

  // StackBlitz's run endpoint expects form-urlencoded fields:
  //   project[title], project[description], project[template]
  //   project[files][<path>] for each file
  // template=node uses WebContainer (real Node.js + npm install).
  const form = document.createElement('form')
  form.method = 'POST'
  form.action = 'https://stackblitz.com/run?file=src/App.vue'
  form.target = '_blank'
  form.style.display = 'none'

  const addField = (name: string, value: string) => {
    const input = document.createElement('input')
    input.type = 'hidden'
    input.name = name
    input.value = value
    form.appendChild(input)
  }

  addField('project[title]', title)
  addField('project[description]', description)
  addField('project[template]', 'node')
  for (const [path, content] of Object.entries(files)) {
    addField(`project[files][${path}]`, content)
  }

  document.body.appendChild(form)
  form.submit()
  setTimeout(() => {
    if (form.parentNode) form.parentNode.removeChild(form)
  }, 0)
}
