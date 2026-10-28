// Centralized registry of in-doc example components, used by DemoBlock.vue
// to mount live demos referenced from Markdown via <demo name="..." />.
//
// Naming convention: `${category}-${slug}` where category ∈ {form, table, crud}
// and slug matches the example component file name (numeric prefix stripped, kebab-case).
//
// Example: `<demo name="form-basic" />` → /src/components/examples/form/Basic.vue
//
// 索引**只记名字**，组件与源码都走惰性加载器。
//
// 此前这里两个 glob 都是 `{ eager: true }`：于是任何一篇指南——哪怕正文里一个
// `<demo>` 都没有——都会把 103 个示例组件（~145KB gz）和它们的全部源码文本
// （457KB 原文 / 115KB gz）一起拽进首屏。实测这两项占 /guide/* 首屏的 17%。
// 现在首屏只剩一张「名字 → 加载器」的表（几百字节），真正用到哪个示例才下载哪个。
//
// 同样的做法在 views/component-doc.data.ts、views/advanced-doc.data.ts 里已经用了
// 一年多（那里的注释写着「之前 eager 会在进入任意 /advanced/* 时一次性编译全部示例」），
// 这条腿当时漏了。scripts/check-bundle-sources.mjs 会断言这里不再出现 `eager: true`。

import type { Component } from 'vue'

export interface ExampleSource {
  template: string
  script: string
  style: string
}

export interface ExampleEntry {
  component: Component
  code: ExampleSource
}

const componentLoaders = import.meta.glob('@/components/examples/**/*.vue') as Record<
  string,
  () => Promise<{ default: Component }>
>

const sourceLoaders = import.meta.glob('@/components/examples/**/*.vue', {
  query: '?raw',
  import: 'default',
}) as Record<string, () => Promise<string>>

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

/**
 * 示例名 → 源文件路径。
 * 文件名规范化：去掉数字前缀、PascalCase → kebab-case；crud-page 目录缩成 crud。
 */
function indexPath(path: string): string | null {
  const match = path.match(/\/examples\/([^/]+)\/(.+?)\.vue$/)
  if (!match) return null
  const [, category, fileName] = match
  const slug = fileName
    .replace(/^[0-9]+-?/, '')
    .replace(/([a-z0-9])([A-Z])/g, '$1-$2')
    .toLowerCase()
  const cat = category === 'crud-page' ? 'crud' : category
  return `${cat}-${slug}`
}

const paths = new Map<string, string>()
for (const path of Object.keys(componentLoaders)) {
  const key = indexPath(path)
  if (key) paths.set(key, path)
}

export function listExampleNames(): string[] {
  return [...paths.keys()].sort()
}

export function hasExample(name: string): boolean {
  return paths.has(name)
}

/** 取一个示例：组件与源码并行加载，两者都到齐才返回（源码面板要同步渲染） */
export async function loadExample(name: string): Promise<ExampleEntry | null> {
  const path = paths.get(name)
  if (!path) return null
  const loadComponent = componentLoaders[path]
  const loadSource = sourceLoaders[path]
  // 两个加载器缺席时宁可少一块代码，也不要让整个示例「一直加载中」：
  // 键对不上这种事由 scripts/check-bundle-sources.mjs 在合入前挡住
  const [mod, raw] = await Promise.all([
    loadComponent ? loadComponent() : null,
    loadSource ? loadSource() : Promise.resolve(''),
  ])
  if (!mod) return null
  return { component: mod.default, code: parseSFC(raw) }
}
