/**
 * Vue 2 SFC 模板编译守卫
 *
 * 背景：Vue 2 要求模板**恰好一个根节点**，且 `<slot>` 不能作根 —— 它可能展开为多个节点。
 * 这类问题 vue-template-compiler 只给 warning、不阻断构建，dist 照常产出，于是能长期潜伏：
 * `src/components/es-error-boundary/es-error-boundary.vue` 曾以 `<slot v-if>` / `<slot v-else>`
 * 两个节点为根，默认插槽是多节点时渲染函数会返回节点数组而无法渲染；
 * 而 ESLint 因为配置加载不了从未跑起来，所以一直没人发现。
 *
 * 这个测试直接调用 Vue 2 编译器编译 src 下全部 SFC 模板，断言零编译错误，
 * 把这一类问题挡在构建之前。
 *
 * 注意：用 `vue-template-compiler/build.js` 而非包入口 —— 后者会拿被提升到仓库根的
 * vue@3 做版本校验并直接抛错（本包实际使用的是 packages/vue2/node_modules/vue@2.7.16）。
 */
import { describe, it, expect } from 'vitest'
import { readFileSync, readdirSync } from 'node:fs'
import { join, relative, dirname } from 'node:path'
import { fileURLToPath } from 'node:url'
import { createRequire } from 'node:module'

const nodeRequire = createRequire(import.meta.url)
const compiler = nodeRequire('vue-template-compiler/build.js') as {
  compile: (template: string) => { errors: string[] }
  parseComponent: (source: string) => { template?: { content: string } }
}

const SRC = join(dirname(fileURLToPath(import.meta.url)), '..', 'src')

function walk(dir: string, out: string[] = []): string[] {
  for (const entry of readdirSync(dir, { withFileTypes: true })) {
    const p = join(dir, entry.name)
    if (entry.isDirectory()) walk(p, out)
    else if (entry.name.endsWith('.vue')) out.push(p)
  }
  return out
}

describe('vue2 SFC 模板编译守卫', () => {
  const files = walk(SRC)

  it('src 下能扫描到 SFC', () => {
    expect(files.length).toBeGreaterThan(0)
  })

  it('全部 SFC 模板在 Vue 2 编译器下零错误', () => {
    const failures: string[] = []
    for (const file of files) {
      const sfc = compiler.parseComponent(readFileSync(file, 'utf8'))
      if (!sfc.template) continue
      const result = compiler.compile(sfc.template.content)
      if (result.errors.length) {
        const rel = relative(SRC, file).split('\\').join('/')
        failures.push(`${rel}\n      ${result.errors.join('\n      ')}`)
      }
    }
    expect(failures, `以下 SFC 模板存在 Vue 2 编译错误：\n    ${failures.join('\n    ')}`).toEqual([])
  })
})
