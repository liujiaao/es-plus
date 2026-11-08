/**
 * Tier 2 表格 fixture 入口。
 *
 * 一个 dev server 服务两条腿，用查询参数选择：
 *   - `?lib=vue3`（默认）→ Element Plus + `@es-plus/vue3`
 *   - `?lib=antdv`        → Ant Design Vue + `@es-plus/adapter-antdv`
 *   - `?rows=N`           → 渲染行数（默认 60；bench 用 1000/5000/20000）
 *   - `?local=0`          → 关掉内建客户端分页，让全部行一次性渲染（bench 需要）
 *   - `?vxe=1`            → 额外挂一张 `engine: 'vxe'` 的表格，验证行内编辑
 *
 * 两条腿都**动态 import**：同一个 bundle 里同时静态引 element-plus 与
 * ant-design-vue，会让任一页面都下载两份组件库，bench 数字也就失去意义。
 */
import { createApp, type App } from 'vue'
import type { Component } from 'vue'

const params = new URLSearchParams(window.location.search)
const lib = params.get('lib') === 'antdv' ? 'antdv' : 'vue3'

async function installVxe(app: App): Promise<void> {
  if (params.get('vxe') !== '1') return
  const [{ default: VxeUI }, { default: VxeTable }] = await Promise.all([
    import('vxe-pc-ui'),
    import('vxe-table'),
  ])
  await import('vxe-pc-ui/lib/style.css')
  await import('vxe-table/lib/style.css')
  app.use(VxeUI)
  app.use(VxeTable)
}

async function boot(): Promise<void> {
  const root: Component = (
    lib === 'antdv' ? (await import('./AntdvTableApp.vue')).default : (await import('./TableApp.vue')).default
  ) as Component

  const app = createApp(root)

  if (lib === 'antdv') {
    const [{ default: Antd }, { default: ESPlus }] = await Promise.all([
      import('ant-design-vue'),
      import('@es-plus/adapter-antdv'),
    ])
    await import('ant-design-vue/dist/reset.css')
    await import('@es-plus/adapter-antdv/dist/style.css')
    app.use(Antd)
    app.use(ESPlus)
  } else {
    const [{ default: ElementPlus }, { default: ESPlus }] = await Promise.all([
      import('element-plus'),
      import('@es-plus/vue3'),
    ])
    await import('element-plus/dist/index.css')
    await import('@es-plus/vue3/dist/style.css')
    app.use(ElementPlus)
    app.use(ESPlus)
  }

  await installVxe(app)

  app.mount('#app')
  ;(window as unknown as Record<string, unknown>).__fixtureLib = lib
}

void boot()
