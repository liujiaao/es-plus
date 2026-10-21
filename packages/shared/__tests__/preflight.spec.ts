// AN-15:前置清单与宿主入口 doctor。
//
// 这里钉的是「按配置推导 required」而非文案：permission 只有真的声明了门才 required
// （否则运行时默认放行正是想要的语义）、i18n 只认 labelKey、JSX 只认 sfc+dialog。
// doctor 侧则钉住**失败方向**：注释里的字样不能算配置（入口样板注释就写着
// permission / t / httpRequest，不剥注释会假绿），标识符参数只能 unverified。
import { describe, it, expect } from 'vitest'
import {
  buildPreflight,
  buildScaffoldPreflight,
  formatPreflight,
  type PreflightId,
  type PreflightReport,
} from '../src/preflight'
import { doctorPage, formatDoctor, probePluginOptions, stripJsComments } from '../src/doctor'
import { generateAppEntry } from '../src/code-generator'
import { generateFromConfig } from '../src/structured-generator'

function byId(r: PreflightReport, id: PreflightId) {
  const item = r.items.find((x) => x.id === id)
  expect(item, `preflight missing item ${id}`).toBeDefined()
  return item!
}

const base = {
  target: 'vue3' as const,
  mode: 'schema' as const,
  actions: ['add', 'edit', 'delete'],
  fields: [{ prop: 'name' }],
}

describe('buildPreflight — required 由本配置推导', () => {
  it('always lists all six items; UI library / plugin / httpRequest are required', () => {
    const r = buildPreflight(base)
    expect(r.items.map((i) => i.id)).toEqual([
      'ui-library',
      'es-plus-plugin',
      'http-request',
      'permission',
      'i18n',
      'jsx',
    ])
    expect(byId(r, 'ui-library').required).toBe(true)
    expect(byId(r, 'es-plus-plugin').required).toBe(true)
    expect(byId(r, 'http-request').required).toBe(true)
    expect(byId(r, 'permission').required).toBe(false)
    expect(byId(r, 'i18n').required).toBe(false)
    expect(byId(r, 'jsx').required).toBe(false)
  })

  it('permission becomes required for a field permissionValue — and says the runtime fails OPEN', () => {
    const r = buildPreflight({ ...base, fields: [{ prop: 'x', permissionValue: 'user:add' }] })
    const p = byId(r, 'permission')
    expect(p.required).toBe(true)
    expect(p.reason).toContain('FAILS OPEN')
    expect(p.reason).toContain('1 permission gate')
  })

  it('permission counts config.permissions (action buttons) too', () => {
    const r = buildPreflight({ ...base, permissions: { add: 'a', edit: 'e' } })
    expect(byId(r, 'permission').reason).toContain('2 action permission code(s)')
  })

  // 回归：权限码不只挂在字段/工具栏按钮上。列内按钮、分组子列、弹窗底部按钮都是载体，
  // 漏收 ⇒ preflight 宣称「本配置没有权限门」，而产物里明明有 permissionValue
  // （缺 permission() 时失败方向是**放行**）。
  it('permission counts columns[].btns / nested groups / dialogs[k].configBtn', () => {
    expect(
      byId(
        buildPreflight({ ...base, columns: [{ prop: 'a', btns: [{ name: '编辑', permissionValue: 'a:edit' }] }] }),
        'permission',
      ).required,
    ).toBe(true)
    expect(
      byId(
        buildPreflight({
          ...base,
          columns: [{ label: '分组', groups: [{ prop: 'b', permissionValue: 'b:read' }] }],
        }),
        'permission',
      ).required,
    ).toBe(true)
    expect(
      byId(
        buildPreflight({
          ...base,
          dialogs: { add: { configBtn: [{ name: '确定', permissionValue: 'x:add' }] } },
        }),
        'permission',
      ).required,
    ).toBe(true)
  })

  it('i18n is required by config.i18n or by any labelKey (columns / dialogs / expandConfig)', () => {
    expect(byId(buildPreflight({ ...base, i18n: true }), 'i18n').required).toBe(true)
    expect(byId(buildPreflight({ ...base, columns: [{ labelKey: 'col.name' }] }), 'i18n').required).toBe(true)
    expect(
      byId(buildPreflight({ ...base, dialogs: { add: { formItems: [{ labelKey: 'f.name' }] } } }), 'i18n').required,
    ).toBe(true)
    expect(
      byId(buildPreflight({ ...base, expandConfig: { fields: [{ labelKey: 'x.y' }] } }), 'i18n').required,
    ).toBe(true)
  })

  it('jsx is required only for mode=sfc with add/edit/view (the dialog render)', () => {
    expect(byId(buildPreflight({ ...base, mode: 'sfc' }), 'jsx').required).toBe(true)
    expect(byId(buildPreflight({ ...base, mode: 'sfc', actions: ['delete'] }), 'jsx').required).toBe(false)
    // schema 模式的弹窗由运行时 <es-crud-page> 渲染，模板里没有 JSX
    expect(byId(buildPreflight({ ...base, mode: 'schema' }), 'jsx').required).toBe(false)
  })

  it('jsx action points at the right preset per target', () => {
    expect(byId(buildPreflight({ ...base, mode: 'sfc' }, { target: 'vue3' }), 'jsx').action).toContain(
      '@vitejs/plugin-vue-jsx',
    )
    expect(byId(buildPreflight({ ...base, mode: 'sfc' }, { target: 'vue2' }), 'jsx').action).toContain(
      '@vue/babel-preset-jsx',
    )
  })

  it('httpRequest is not required when the artifact fetches nothing', () => {
    const r = buildPreflight({ ...base, usesRemoteData: false })
    expect(byId(r, 'http-request').required).toBe(false)
  })

  it('names the UI library per target', () => {
    expect(byId(buildPreflight({}, { target: 'vue3' }), 'ui-library').title).toContain('element-plus')
    expect(byId(buildPreflight({}, { target: 'vue2' }), 'ui-library').title).toContain('element-ui')
    expect(byId(buildPreflight({}, { target: 'antdv' }), 'ui-library').title).toContain('Ant Design Vue')
  })

  it('entry / entryFile follow the target', () => {
    const v3 = buildPreflight({}, { target: 'vue3' })
    expect(v3.entryFile).toBe('src/main.ts')
    expect(v3.entry).toContain('app.use(ESPlus')
    const v2 = buildPreflight({}, { target: 'vue2' })
    expect(v2.entryFile).toBe('src/main.js')
    expect(v2.entry).toContain('Vue.use(ESPlus')
  })
})

describe('buildScaffoldPreflight — 与生成物共用同一份判定', () => {
  it('table ⇒ httpRequest required', () => {
    const r = buildScaffoldPreflight({ target: 'vue3', features: ['query', 'table'] })
    expect(byId(r, 'http-request').required).toBe(true)
  })

  it('query-only scaffold fetches nothing ⇒ httpRequest not required', () => {
    const r = buildScaffoldPreflight({ target: 'vue3', features: ['query'] })
    expect(byId(r, 'http-request').required).toBe(false)
  })

  it('scaffold dialog is useDialog only — no JSX (unlike a generated sfc dialog)', () => {
    const r = buildScaffoldPreflight({ target: 'vue3', features: ['query', 'table', 'dialog'] })
    expect(byId(r, 'jsx').required).toBe(false)
  })
})

describe('formatPreflight', () => {
  it('prints every item with required/not-needed and the entry boilerplate', () => {
    const text = formatPreflight(buildPreflight({ ...base, fields: [{ permissionValue: 'p' }] }))
    expect(text).toContain('## Preflight')
    expect(text).toContain('**[required]** **Global permission()**')
    expect(text).toContain('[not needed] **Global t() (i18n)**')
    expect(text).toContain('### App entry — src/main.ts (copy once)')
    expect(text).toContain('app.use(ESPlus, {')
    // 不需要的项不给 Do，避免把「本来就不用配」说成待办
    const notNeeded = text.slice(text.indexOf('[not needed] **Global t()'))
    expect(notNeeded).not.toContain('- Do:')
  })
})

describe('generateFromConfig exposes the same preflight', () => {
  it('attaches a preflight report driven by the same config', () => {
    const r = generateFromConfig({
      name: 'X',
      apiUrl: '/api/x',
      fields: [{ prop: 'name', label: '名称', formtype: 'Input', permissionValue: 'x:read' }],
      actions: ['add'],
      i18n: true,
      mode: 'schema',
      target: 'vue3',
    })
    expect(r.preflight).toBeDefined()
    const ids = r.preflight!.items.map((i) => i.id)
    expect(ids).toContain('permission')
    expect(byId(r.preflight!, 'permission').required).toBe(true)
    expect(byId(r.preflight!, 'i18n').required).toBe(true)
    expect(byId(r.preflight!, 'jsx').required).toBe(false)
  })

  // 端到端：只把权限码写在弹窗底部按钮上（configBtn），生成物的 preflight 也必须报门。
  it('a permission code carried only by dialogs[k].configBtn still gates', () => {
    const r = generateFromConfig({
      name: 'X',
      apiUrl: '/api/x',
      fields: [{ prop: 'name', label: '名称', formtype: 'Input' }],
      actions: ['add'],
      dialogs: { add: { configBtn: [{ name: '确定', action: 'confirm', permissionValue: 'x:add' }] } },
      mode: 'schema',
      target: 'vue3',
    })
    const p = byId(r.preflight!, 'permission')
    expect(p.required).toBe(true)
    expect(p.reason).toContain('1 permission gate')
  })
})

describe('doctorPage — 静态扫描的诚实边界', () => {
  const needsPermission = {
    target: 'vue3' as const,
    mode: 'schema' as const,
    actions: ['add'],
    fields: [{ prop: 'x', permissionValue: 'user:add', labelKey: 'f.x' }],
  }

  it('a full entry from generateAppEntry satisfies everything it can see', () => {
    const report = doctorPage({
      entry: generateAppEntry('vue3'),
      target: 'vue3',
      config: needsPermission,
      viteConfig: 'export default { plugins: [vue(), vueJsx()] }',
    })
    expect(report.ok).toBe(true)
    for (const f of report.findings) expect(f.status).toBe('ok')
    expect(formatDoctor(report)).toContain('All required prerequisites')
  })

  it('bare app.use(ESPlus) ⇒ httpRequest missing (the table would throw on mount)', () => {
    const report = doctorPage({
      entry: "import ESPlus from '@es-plus/vue3'\napp.use(ESPlus)",
      target: 'vue3',
      config: needsPermission,
    })
    const http = report.findings.find((f) => f.id === 'http-request')!
    expect(http.status).toBe('missing')
    expect(report.ok).toBe(false)
    // UI 库也缺
    expect(report.findings.find((f) => f.id === 'ui-library')!.status).toBe('missing')
  })

  it('comments never count as configuration (the boilerplate comments name all keys)', () => {
    const entry = [
      "import ESPlus from '@es-plus/vue3'",
      '// app.use(ESPlus, { permission, t, httpRequest })',
      'app.use(ESPlus)',
    ].join('\n')
    const report = doctorPage({ entry, target: 'vue3', config: needsPermission })
    expect(report.findings.find((f) => f.id === 'http-request')!.status).toBe('missing')
    expect(report.findings.find((f) => f.id === 'permission')!.status).toBe('missing')
  })

  it('identifier options ⇒ unverified, not ok and not missing', () => {
    const entry = [
      "import ElementPlus from 'element-plus'",
      "import ESPlus from '@es-plus/vue3'",
      'app.use(ElementPlus)',
      'const options = build()',
      'app.use(ESPlus, options)',
    ].join('\n')
    const report = doctorPage({ entry, target: 'vue3', config: needsPermission })
    expect(report.findings.find((f) => f.id === 'http-request')!.status).toBe('unverified')
    expect(report.findings.find((f) => f.id === 'permission')!.status).toBe('unverified')
    // unverified 不判失败
    expect(report.ok).toBe(true)
  })

  it('spread options with a missing literal key ⇒ unverified', () => {
    const entry = ["import ESPlus from '@es-plus/vue3'", 'app.use(ESPlus, { ...options, t: (k) => k })'].join('\n')
    const report = doctorPage({ entry, target: 'vue3', config: needsPermission })
    expect(report.findings.find((f) => f.id === 'http-request')!.status).toBe('unverified')
    const i18n = report.findings.find((f) => f.id === 'i18n')!
    expect(i18n.status).toBe('ok')
  })

  it('shorthand keys count ({ permission, t, httpRequest })', () => {
    const entry = [
      "import ESPlus from '@es-plus/vue3'",
      'app.use(ESPlus, { permission, t, httpRequest })',
    ].join('\n')
    const report = doctorPage({ entry, target: 'vue3', config: needsPermission, viteConfig: 'plugins:[vueJsx()]' })
    for (const id of ['http-request', 'permission', 'i18n'] as const) {
      expect(report.findings.find((f) => f.id === id)!.status).toBe('ok')
    }
  })

  it('items not needed by the config are ok even when absent from the entry', () => {
    const report = doctorPage({
      entry: generateAppEntry('vue3'),
      target: 'vue3',
      config: { target: 'vue3', mode: 'schema', actions: ['add'], fields: [{ prop: 'name' }] },
    })
    expect(report.findings.find((f) => f.id === 'permission')!.required).toBe(false)
    expect(report.findings.find((f) => f.id === 'permission')!.status).toBe('ok')
  })

  it('JSX required but no viteConfig ⇒ unverified (not a silent pass)', () => {
    const report = doctorPage({
      entry: generateAppEntry('vue3'),
      target: 'vue3',
      config: { target: 'vue3', mode: 'sfc', actions: ['add'], fields: [{ prop: 'name' }] },
    })
    expect(report.findings.find((f) => f.id === 'jsx')!.status).toBe('unverified')
  })

  it('JSX required + viteConfig without the plugin ⇒ missing', () => {
    const report = doctorPage({
      entry: generateAppEntry('vue3'),
      target: 'vue3',
      config: { target: 'vue3', mode: 'sfc', actions: ['add'], fields: [{ prop: 'name' }] },
      viteConfig: 'plugins: [vue()]',
    })
    expect(report.findings.find((f) => f.id === 'jsx')!.status).toBe('missing')
    expect(report.ok).toBe(false)
  })
})

describe('doctor helpers — 失败方向是「少扫到」而不是「凭空扫到」', () => {
  it('stripJsComments keeps strings intact (URLs must not be cut at //)', () => {
    expect(stripJsComments("const u = 'https://x.y' // c")).toContain("'https://x.y'")
    expect(stripJsComments("const u = 'https://x.y' // c")).not.toContain('// c')
  })

  it('probePluginOptions distinguishes no-option / literal / opaque', () => {
    expect(probePluginOptions('app.use(ESPlus)').body).toBe('')
    expect(probePluginOptions('app.use(ESPlus, { a: 1 })').body).toContain('a: 1')
    expect(probePluginOptions('app.use(ESPlus, opts)').body).toBeNull()
    expect(probePluginOptions('configureEsPlus({ t: 1 })').body).toContain('t: 1')
  })
})
