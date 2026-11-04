#!/usr/bin/env node
/**
 * 组合契约门禁 —— `es-plus.composition@3`（P6b 落地，P7 @2，P11 @3）。
 *
 * ## 判据
 *
 * 对 golden 片段语料（table / form / dialog，三端）组装出多类组合，逐组断言：
 *
 *   ① **接线只来自契约**：每条 wire 的 from 通道 ∈ `ARTIFACT_RUNTIME[artifact].emits`
 *      或 `success.name`；to 节点的通道 ∈ 该 artifact 的 `invokable`（可调用子集 ——
 *      `form.model` 是数据不是方法，接线调不到）；`open` 只接受 row-action 源，
 *      composable 弹窗只能由 row-action 分派 `open`（没有模板 ref）；行按钮接线的
 *      `when.rowAction` 必须是源表**声明过的** rowButtons key（否则是死分支）；
 *   ② **没有静默丢弃**：每个在场 artifact 的每个可触发通道（form submit/query/reset、
 *      dialog success、带行按钮的 table row-action）都出现在某条 wire 的 from；
 *      每条 `to.page` 的 event 都在 `faces.emit` 里，反之亦然（`ui-only` 档位下数据通道
 *      全部是页面事件，这条同时证明「降档不等于丢通道」）；`faces.emit` 只从最终
 *      wires 投影 —— 显式接线覆盖派生后，被覆盖的事件不得留在声明里（幽灵事件）；
 *   ③ **页面与会话自洽**：`Page.vue` 的 `defineEmits` / `defineExpose` 与 `faces`
 *      完全一致；每个节点文件都以相对导入出现；**每条节点目标的接线都真的有模板 ref**
 *      （vue2/3 模板 `ref="…"`，vue3/antdv 另有 `const … = ref(null)`）—— 否则
 *      `filterRef.value?.resetFields?.()` 这类调用在页面里指向不存在的符号；
 *      每个 dialog 节点的标题字面量等于
 *      `intent.defaultTitle ?? dialogTitleFor(id)`（与单独发射同源）；每条成功接线都
 *      真的落到页面代码里 —— invoke 形态是目标表 ref 的 `refresh()`/`reload()` 内联
 *      回调（@3 取代 @2 的 `onTableSuccess`，多表页面因此能分清刷哪张），页面事件
 *      形态是 `emit('<event>', { id, data })`；
 *   ④ **片段字节不变**：节点文件代码与单独 `emitSceneArtifact` 逐字节相等；
 *      `files` 路径唯一、每份 `code` 都在返回文本里；
 *   ⑤ **信封**：contract/target/behavior/roles/wires/faces/nodes 自洽，指纹 16 位、
 *      两次相同、改一个字段（label）必变；
 *   ⑥ **结构化拒绝**：crud 节点、两个 form 节点、混装 target、vue2 + composable、
 *      空节点、非法 behavior、重复 role、未知通道、行动作接线缺 when、未知目标节点、
 *      重复显式接线 —— 都必须是 `isError` 且没有文件 / 信封；
 *   ⑦ **页面真的能编译**：每个组合的 `Page.vue` 都过对应框架的 SFC 编译器
 *      （vue3/antdv：`@vue/compiler-sfc` 的 parse + compileScript + compileTemplate；
 *      vue2：`vue@2.7/compiler-sfc` 的 parse + compileTemplate）。只跑生成器不编译
 *      会漏掉「重复 `const` 声明」这类只差一个 id 就触发的产物错误。
 *
 * ## 驱动方式
 *
 * 与 `check-artifact-envelope.mjs` 同一条路：esbuild 现打包**源码**（命中
 * shared/build 即判红），语料是 `__tests__/golden/cases` 的片段用例，不调用任何
 * MCP handler。运行时见证（真挂载、真点按钮）在 vue3 / antdv 的 Tier-1 spec 里。
 *
 * 用法：`node scripts/check-composition-contract.mjs`
 */
import { mkdtempSync, readFileSync, rmSync, writeFileSync } from 'node:fs'
import { createRequire } from 'node:module'
import { join } from 'node:path'
import { pathToFileURL } from 'node:url'
import { build } from 'esbuild'
import { DIALOG_TITLES, dialogTitleFor } from '@es-plus/shared/scene'
import { ROOT } from './lib/front-door.mjs'

const CASES_DIR = join(ROOT, '__tests__', 'golden', 'cases')
const TARGETS = ['vue3', 'vue2', 'antdv']
const FINGERPRINT_RE = /^[0-9a-f]{16}$/

let failures = 0
function fail(message) {
  failures++
  console.error(`  ✗ ${message}`)
}

/**
 * 页面模板的编译见证。
 *
 * vue3 / antdv 走根部的 `@vue/compiler-sfc`：`compileScript` 会像真实构建一样
 * 解析 `<script setup>`（重复 `const`、非法标识符都在这一步红）；`compileTemplate`
 * 兜住模板编译期错误。vue2 走 `packages/vue2` 自带 vue@2.7 的 compiler-sfc：
 * Options API 页面只编译模板，脚本由 Node 语法层保证（生成器只写对象字面量）。
 *
 * 编译器不可用时**判红**而不是跳过 —— 「没跑」和「通过」在门禁里不能是同一件事。
 */
let vue3Compiler
let vue2Compiler
async function compilePage(target, code, label) {
  try {
    if (target === 'vue2') {
      if (!vue2Compiler) {
        vue2Compiler = createRequire(join(ROOT, 'packages', 'vue2', 'package.json'))('vue/compiler-sfc')
      }
      const descriptor = vue2Compiler.parse({ source: code, filename: 'Page.vue' })
      if (descriptor.template) {
        const compiled = vue2Compiler.compileTemplate({
          source: descriptor.template.content,
          filename: 'Page.vue',
        })
        if (compiled.errors.length > 0) {
          fail(`${label}: vue2 模板编译失败 — ${compiled.errors.map(String).join('; ')}`)
        }
      }
      return
    }
    if (!vue3Compiler) vue3Compiler = await import('@vue/compiler-sfc')
    const { descriptor, errors } = vue3Compiler.parse(code, { filename: 'Page.vue' })
    if (errors.length > 0) {
      fail(`${label}: SFC 解析失败 — ${errors.map(String).join('; ')}`)
      return
    }
    if (descriptor.scriptSetup || descriptor.script) {
      try {
        vue3Compiler.compileScript(descriptor, { id: 'composed-page' })
      } catch (err) {
        fail(`${label}: <script setup> 编译失败 — ${err.message}`)
      }
    }
    if (descriptor.template) {
      const compiled = vue3Compiler.compileTemplate({
        source: descriptor.template.content,
        filename: 'Page.vue',
        id: 'composed-page',
      })
      if (compiled.errors.length > 0) {
        fail(`${label}: 模板编译失败 — ${compiled.errors.map(String).join('; ')}`)
      }
    }
  } catch (err) {
    fail(`${label}: 编译见证无法运行 — ${err.message}`)
  }
}

async function loadShared() {
  const tmp = mkdtempSync(join(ROOT, 'node_modules', 'es-composition-'))
  const entry = join(tmp, 'entry.ts')
  try {
    writeFileSync(
      entry,
      [
        "export { emitComposition, planComposition, COMPOSITION_CONTRACT_VERSION } from '../../packages/shared/src/scene/composition.ts'",
        "export { emitSceneArtifact } from '../../packages/shared/src/scene/emit.ts'",
        "export { ARTIFACT_RUNTIME } from '../../packages/shared/src/scene/runtime.ts'",
        "export { DIALOG_TITLES, dialogTitleFor } from '../../packages/shared/src/scene/registry.ts'",
      ].join('\n'),
      'utf8',
    )
    const outfile = join(tmp, 'composition.mjs')
    const result = await build({
      entryPoints: [entry],
      bundle: true,
      format: 'esm',
      outfile,
      platform: 'node',
      logLevel: 'silent',
      metafile: true,
      alias: { '@es-plus/shared': join(ROOT, 'packages', 'shared', 'src', 'index.ts') },
      banner: {
        js: "import { createRequire as __createRequire } from 'node:module';const require = __createRequire(import.meta.url);",
      },
    })
    const inputs = Object.keys(result.metafile.inputs)
    return {
      mod: await import(pathToFileURL(outfile).href),
      fromBuild: inputs.filter((p) => /shared[\\/]build[\\/]/.test(p)),
      cleanup: () => rmSync(tmp, { recursive: true, force: true }),
    }
  } catch (err) {
    rmSync(tmp, { recursive: true, force: true })
    throw err
  }
}

function loadCase(file) {
  return JSON.parse(readFileSync(join(CASES_DIR, file), 'utf8'))
}

function fragmentNode(id, scene, file) {
  const raw = loadCase(file)
  return { id, plan: { scene, intent: { ...(raw.config || {}), target: raw.target } } }
}

function quotedList(code, head) {
  const m = new RegExp(`${head}\\(\\[([^\\]]*)\\]\\)`).exec(code)
  if (!m) return null
  return [...m[1].matchAll(/'([^']*)'/g)].map((x) => x[1])
}

/**
 * 节点 id → 页面里模板 ref 的变量名。
 *
 * 与 `composition.ts` 的 `pascalOf` + `refVar` 同一套规则。守卫**必须**自己算一遍而
 * 不是去读产物里的 `const xxxRef` —— 读产物等于用被检对象定义期望值。
 */
function refOf(id) {
  const pascal = id
    .split('-')
    .filter(Boolean)
    .map((p) => p.charAt(0).toUpperCase() + p.slice(1))
    .join('')
  return `${pascal.charAt(0).toLowerCase()}${pascal.slice(1)}Ref`
}

async function checkPlan(file, plan, mod, expectArtifacts) {
  const { emitComposition, emitSceneArtifact, ARTIFACT_RUNTIME, COMPOSITION_CONTRACT_VERSION } = mod
  const result = emitComposition(plan)
  if (result.isError) {
    fail(`${file}: 组合发射失败 — ${result.text}`)
    return
  }
  const { envelope, files, page, wires, faces, text } = result

  // ④ 片段字节不变 + 文件表
  const nodeFiles = files.slice(0, -1)
  if (page.path !== 'Page.vue') fail(`${file}: 最后一份文件必须是 Page.vue，实际 ${page.path}`)
  const paths = files.map((f) => f.path)
  if (new Set(paths).size !== paths.length) fail(`${file}: 文件路径重复：${paths.join(',')}`)
  for (let i = 0; i < nodeFiles.length; i++) {
    const node = plan.nodes[i]
    const solo = emitSceneArtifact({ scene: node.plan.scene, intent: node.plan.intent })
    if (solo.isError) {
      fail(`${file}: 节点 ${node.id} 单独发射失败 — ${solo.text}`)
      continue
    }
    if (nodeFiles[i].code !== solo.envelope.files[0].code) {
      fail(`${file}: 节点 ${node.id} 的代码与单独发射不一致（组合改写了片段字节）`)
    }
    if (!text.includes(nodeFiles[i].code)) fail(`${file}: 节点 ${node.id} 的代码不在返回文本里`)
  }
  if (!text.includes(page.code)) fail(`${file}: Page.vue 的代码不在返回文本里`)

  // ① 接线两端都必须是契约里的通道
  const artifactOfNode = new Map(
    plan.nodes.map((n, i) => [n.id, envelope.nodes[i].artifact]),
  )
  for (const wire of wires) {
    const fromArtifact = artifactOfNode.get(wire.from.node)
    const fromRuntime = ARTIFACT_RUNTIME[fromArtifact]
    const channels = [...fromRuntime.emits, ...(fromRuntime.success.name ? [fromRuntime.success.name] : [])]
    if (!channels.includes(wire.from.channel)) {
      fail(`${file}: 接线 ${wire.from.node}.${wire.from.channel} 不在 ${fromArtifact} 契约里（${channels.join('/') || '(空)'}）`)
    }
    if ('node' in wire.to) {
      const toArtifact = artifactOfNode.get(wire.to.node)
      const toRuntime = ARTIFACT_RUNTIME[toArtifact]
      if (!toRuntime.expose.includes(wire.to.channel)) {
        fail(`${file}: 接线目标 ${wire.to.node}.${wire.to.channel} 不在 ${toArtifact}.expose 里（${toRuntime.expose.join('/') || '(空)'}）`)
      }
      if (!toRuntime.invokable.includes(wire.to.channel)) {
        fail(
          `${file}: 接线目标 ${wire.to.node}.${wire.to.channel} 不是 ${toArtifact} 的可调用通道` +
            `（invokable=[${toRuntime.invokable.join('/') || '(空)'}]；expose 里其余是数据）`,
        )
      }
    } else if (!faces.emit.includes(wire.to.event)) {
      fail(`${file}: 接线目标是页面事件 "${wire.to.event}"，但 faces.emit 里没有它`)
    }
  }

  // ①b 显式接线必须原样落地，且同一触达点不允许同时存在派生接线（覆盖而不是叠加）。
  const wireKeyOf = (w) =>
    `${w.from.node}.${w.from.channel}${w.when?.rowAction ? `#${w.when.rowAction}` : ''}`
  for (const wire of plan.wires ?? []) {
    const key = wireKeyOf(wire)
    const matches = wires.filter((w) => wireKeyOf(w) === key)
    if (matches.length !== 1) {
      fail(`${file}: 显式接线 ${key} 应恰好落地 1 条，实际 ${matches.length} 条`)
    } else if (JSON.stringify(matches[0]) !== JSON.stringify(wire)) {
      fail(`${file}: 显式接线 ${key} 被改写成 ${JSON.stringify(matches[0])}`)
    }
  }

  // ①c role=master 是数据接线的默认目标（不是「第一个表」）。
  const masterNode = plan.nodes.find((n) => n.role === 'master' && n.plan.scene === 'table')
  const formNode = plan.nodes.find((n) => n.plan.scene === 'form')
  if (masterNode && formNode && (plan.behavior ?? 'crud-requests') === 'crud-requests') {
    const query = wires.find((w) => w.from.node === formNode.id && w.from.channel === 'query')
    if (!query || !('node' in query.to) || query.to.node !== masterNode.id) {
      fail(`${file}: role=master 的 ${masterNode.id} 没有成为查询默认目标（实际 ${JSON.stringify(query)}）`)
    }
  }

  // ② 没有静默丢弃：在场 artifact 的可触发通道都出现了
  const fromChannels = new Set(wires.map((w) => `${w.from.node}.${w.from.channel}`))
  for (const [id, artifact] of artifactOfNode) {
    const node = plan.nodes.find((n) => n.id === id)
    const runtime = ARTIFACT_RUNTIME[artifact]
    const required = new Set(runtime.emits)
    if (artifact === 'table') {
      const buttons = node.plan.intent.rowButtons ?? []
      if (buttons.length === 0) required.delete('row-action')
    }
    if (runtime.success.name) required.add(runtime.success.name)
    for (const channel of required) {
      if (!fromChannels.has(`${id}.${channel}`)) {
        fail(`${file}: ${id}.${channel} 没有接线，也没有升级为页面事件（静默丢弃）`)
      }
    }
  }
  for (const event of faces.emit) {
    if (!wires.some((w) => 'page' in w.to && w.to.event === event)) {
      fail(`${file}: faces.emit 声明了 "${event}"，但没有任何 wire 指向它`)
    }
  }

  // ③ 页面与 faces 自洽
  const isVue2 = envelope.target === 'vue2'
  if (isVue2) {
    for (const event of faces.emit) {
      if (!page.code.includes(`this.$emit('${event}'`)) {
        fail(`${file}: vue2 页面没有派发声明过的事件 "${event}"`)
      }
    }
    for (const name of faces.expose) {
      if (!new RegExp(`^\\s{4}${name}\\(`, 'm').test(page.code)) {
        fail(`${file}: vue2 页面缺少暴露方法 ${name}(`)
      }
    }
    if (page.code.includes('<script setup')) fail(`${file}: vue2 页面不得使用 <script setup>`)
  } else {
    const emitted = quotedList(page.code, 'defineEmits') ?? []
    if (JSON.stringify([...emitted].sort()) !== JSON.stringify([...faces.emit].sort())) {
      fail(`${file}: defineEmits ${JSON.stringify(emitted)} ≠ faces.emit ${JSON.stringify(faces.emit)}`)
    }
    const exposedNames = [...page.code.matchAll(/defineExpose\(\{([^}]*)\}\)/g)].flatMap((m) =>
      m[1].split(',').map((s) => s.trim()).filter(Boolean),
    )
    if (JSON.stringify([...exposedNames].sort()) !== JSON.stringify([...faces.expose].sort())) {
      fail(`${file}: defineExpose ${JSON.stringify(exposedNames)} ≠ faces.expose ${JSON.stringify(faces.expose)}`)
    }
  }
  // ③b 接线目标必须真有模板 ref：契约里的 expose/invokable 只证明「名字存在」，
  // 不证明生成的页面声明了它（form 曾经就是这样：通道在契约里、页面没有 ref）。
  // composable 弹窗是唯一没有 ref 的形态 —— 它只能经行按钮分派（openCall 用解构
  // 出来的 open），出现为其它来源的目标即判红。
  for (const wire of wires) {
    if (!('node' in wire.to)) continue
    const toArtifact = artifactOfNode.get(wire.to.node)
    if (toArtifact === 'dialog-composable') {
      if (wire.from.channel !== 'row-action' || wire.to.channel !== 'open') {
        fail(
          `${file}: composable 弹窗 ${wire.to.node} 只能由 row-action 的 open 调用` +
            `（实际 ${wire.from.node}.${wire.from.channel} → ${wire.to.node}.${wire.to.channel}）`,
        )
      }
      continue
    }
    const rv = refOf(wire.to.node)
    if (!page.code.includes(`ref="${rv}"`)) {
      fail(`${file}: 接线目标 ${wire.to.node}.${wire.to.channel} 在页面模板里没有 ref="${rv}" —— 调用指向不存在的符号`)
    }
    if (!isVue2 && !page.code.includes(`const ${rv} = ref(null)`)) {
      fail(`${file}: 接线目标 ${wire.to.node}.${wire.to.channel} 缺少 const ${rv} = ref(null)`)
    }
  }
  for (const f of nodeFiles) {
    if (!page.code.includes(`from './${f.path}'`)) {
      fail(`${file}: Page.vue 没有导入节点文件 ${f.path}`)
    }
  }
  for (const node of plan.nodes) {
    if (node.plan.scene !== 'dialog') continue
    const declared = node.plan.intent.defaultTitle
    const title = typeof declared === 'string' ? declared : dialogTitleFor(node.id)
    if (!page.code.includes(`'${title}'`)) {
      fail(`${file}: Page.vue 缺少弹窗标题字面量 '${title}'（应与 intent.defaultTitle / DIALOG_TITLES 同源）`)
    }
  }
  // 成功接线必须真的落在页面代码里：@3 不再有 onTableSuccess 中枢，成功回调是
  // 内联在 open(...) 的第三个参数（多表才能分清刷哪张）；升级为页面事件时则必须
  // 真的派发声明过的 event 名。
  for (const wire of wires.filter((w) => w.from.channel === 'onSuccess')) {
    if ('node' in wire.to) {
      const call = isVue2
        ? `this.$refs.${refOf(wire.to.node)}.${wire.to.channel}()`
        : `${refOf(wire.to.node)}.value?.${wire.to.channel}?.()`
      if (!page.code.includes(call)) {
        fail(`${file}: 有成功接线 ${wire.from.node} → ${wire.to.node}.${wire.to.channel}，但页面没有内联调用 ${call}`)
      }
    } else {
      const emitCall = isVue2
        ? `this.$emit('${wire.to.event}', { id: '${wire.from.node}', data })`
        : `emit('${wire.to.event}', { id: '${wire.from.node}', data })`
      if (!page.code.includes(emitCall)) {
        fail(`${file}: 成功接线升级为页面事件 "${wire.to.event}"，但页面没有派发「${emitCall}」`)
      }
    }
  }
  // ⑦ 编译见证
  await compilePage(envelope.target, page.code, file)

  // ⑤ 信封
  if (envelope.contract !== COMPOSITION_CONTRACT_VERSION) {
    fail(`${file}: contract=${envelope.contract}`)
  }
  if (JSON.stringify(envelope.wires) !== JSON.stringify(wires)) fail(`${file}: 信封 wires 与结果不一致`)
  if (JSON.stringify(envelope.faces) !== JSON.stringify(faces)) fail(`${file}: 信封 faces 与结果不一致`)
  if (envelope.nodes.length !== plan.nodes.length) fail(`${file}: 信封节点数不符`)
  const expectedBehavior = plan.behavior ?? 'crud-requests'
  if (envelope.behavior !== expectedBehavior) {
    fail(`${file}: 信封 behavior=${envelope.behavior}，期望 ${expectedBehavior}`)
  }
  const declaredRoles = {}
  for (const n of plan.nodes) if (n.role !== undefined) declaredRoles[n.id] = n.role
  const sortKeys = (o) => Object.fromEntries(Object.keys(o).sort().map((k) => [k, o[k]]))
  if (JSON.stringify(sortKeys(envelope.roles)) !== JSON.stringify(sortKeys(declaredRoles))) {
    fail(`${file}: 信封 roles=${JSON.stringify(envelope.roles)}，期望 ${JSON.stringify(declaredRoles)}`)
  }
  expectArtifacts.forEach((artifact, i) => {
    if (envelope.nodes[i].artifact !== artifact) {
      fail(`${file}: 节点 ${i} artifact=${envelope.nodes[i].artifact}，期望 ${artifact}`)
    }
  })
  if (!FINGERPRINT_RE.test(envelope.fingerprint)) {
    fail(`${file}: fingerprint=${envelope.fingerprint} 不是 16 位十六进制`)
  }
  const again = emitComposition(plan)
  if (again.envelope?.fingerprint !== envelope.fingerprint) {
    fail(`${file}: 同一输入两次指纹不一致`)
  }
  const mutated = JSON.parse(JSON.stringify(plan))
  const firstField = mutated.nodes[0].plan.intent.fields?.[0]
  if (firstField) firstField.label = `${firstField.label}-mut`
  const changed = emitComposition(mutated)
  if (changed.envelope?.fingerprint === envelope.fingerprint) {
    fail(`${file}: 改了节点字段，指纹没变（非空证明失败）`)
  }
}

function checkStructuralRejects(mod) {
  const { emitComposition } = mod
  const field = { fields: [{ prop: 'name', label: '姓名' }] }
  const tableNode = (id, extra = {}) => ({ id, plan: { scene: 'table', intent: { ...field, ...extra } } })
  const cases = [
    ['空节点', { nodes: [] }, /至少需要一个节点/],
    ['crud 节点', { nodes: [{ id: 'root', plan: { scene: 'crud', intent: { name: 'x', apiUrl: '/x', surfaces: {} } } }] }, /crud 节点不能参与组合/],
    [
      '两个 form 节点',
      {
        nodes: [
          { id: 'a', plan: { scene: 'form', intent: field } },
          { id: 'b', plan: { scene: 'form', intent: field } },
        ],
      },
      /form 场景出现了 2 个节点/,
    ],
    [
      '混装 target',
      {
        nodes: [
          { id: 't', plan: { scene: 'table', intent: { ...field, target: 'vue3' } } },
          { id: 'f', plan: { scene: 'form', intent: { ...field, target: 'antdv' } } },
        ],
      },
      /target=/,
    ],
    [
      'vue2 + composable 弹窗',
      {
        target: 'vue2',
        nodes: [{ id: 'edit', plan: { scene: 'dialog', intent: { ...field, mode: 'composable' } } }],
      },
      /vue2 页面只支持 mode: 'component'/,
    ],
    ['非法 behavior', { behavior: 'auto', nodes: [tableNode('a')] }, /behavior="auto" 非法/],
    [
      '同场景重复角色',
      {
        nodes: [
          { ...tableNode('a'), role: 'master' },
          { ...tableNode('b'), role: 'master' },
        ],
      },
      /都声明了 role="master"/,
    ],
    [
      '未知通道',
      {
        nodes: [tableNode('a')],
        wires: [{ from: { node: 'a', channel: 'nope' }, to: { page: 'emit', event: 'x' } }],
      },
      /不存在的通道/,
    ],
    [
      '行动作接线缺 when',
      {
        nodes: [tableNode('a')],
        wires: [{ from: { node: 'a', channel: 'row-action' }, to: { page: 'emit', event: 'x' } }],
      },
      /必须声明 when\.rowAction/,
    ],
    [
      '未知目标节点',
      {
        nodes: [tableNode('a')],
        wires: [
          {
            from: { node: 'a', channel: 'row-action' },
            to: { node: 'ghost', channel: 'refresh' },
            when: { rowAction: 'view' },
          },
        ],
      },
      /未知节点 "ghost"/,
    ],
    [
      '重复的显式接线',
      {
        nodes: [tableNode('a', { rowButtons: [{ key: 'view', name: '查看' }] })],
        wires: [
          { from: { node: 'a', channel: 'row-action' }, to: { page: 'emit', event: 'a' }, when: { rowAction: 'view' } },
          { from: { node: 'a', channel: 'row-action' }, to: { page: 'emit', event: 'b' }, when: { rowAction: 'view' } },
        ],
      },
      /重复声明/,
    ],
    [
      '行动作接线指向未声明的行按钮（死分支）',
      {
        nodes: [tableNode('a', { rowButtons: [{ key: 'view', name: '查看' }] })],
        wires: [
          {
            from: { node: 'a', channel: 'row-action' },
            to: { page: 'emit', event: 'x' },
            when: { rowAction: 'ghost' },
          },
        ],
      },
      /rowButtons 只有 \[view\]/,
    ],
    [
      '接线目标不是可调用通道（form.model 是数据）',
      {
        nodes: [
          tableNode('a', { rowButtons: [{ key: 'view', name: '查看' }] }),
          { id: 'f', plan: { scene: 'form', intent: { ...field, context: 'query' } } },
        ],
        wires: [
          {
            from: { node: 'a', channel: 'row-action' },
            to: { node: 'f', channel: 'model' },
            when: { rowAction: 'view' },
          },
        ],
      },
      /不是可调用通道/,
    ],
    [
      'composable 弹窗不能被显式接线调用（无模板 ref）',
      {
        nodes: [
          { id: 'a', plan: { scene: 'dialog', intent: { ...field, mode: 'composable' } } },
          { id: 'b', plan: { scene: 'dialog', intent: { ...field, mode: 'composable' } } },
        ],
        wires: [{ from: { node: 'a', channel: 'onSuccess' }, to: { node: 'b', channel: 'open' } }],
      },
      /composable 弹窗/,
    ],
    [
      '接线目标同时给 node 与 page',
      {
        nodes: [tableNode('a')],
        wires: [
          {
            from: { node: 'a', channel: 'row-action' },
            to: { node: 'a', channel: 'reload', page: 'emit', event: 'x' },
            when: { rowAction: 'view' },
          },
        ],
      },
      /不能同时给 node 与 page/,
    ],
    [
      'to.page 必须是字面量 emit',
      {
        nodes: [tableNode('a')],
        wires: [
          { from: { node: 'a', channel: 'row-action' }, to: { page: 'send', event: 'x' }, when: { rowAction: 'view' } },
        ],
      },
      /必须是字面量 'emit'/,
    ],
  ]
  for (const [name, plan, re] of cases) {
    const result = emitComposition(plan)
    if (!result.isError) {
      fail(`结构化拒绝「${name}」：没有报错`)
      continue
    }
    if (!re.test(result.text)) fail(`结构化拒绝「${name}」：错误文案不含 ${re}\n      实际：${result.text}`)
    if (result.files || result.envelope) fail(`结构化拒绝「${name}」：失败分支不应有文件 / 信封`)
  }
  return cases.length
}

async function main() {
  const { mod, fromBuild, cleanup } = await loadShared()
  try {
    if (fromBuild.length > 0) {
      fail(`组合契约读取了构建产物而不是源码：${fromBuild.join(', ')}`)
    }

    let plans = 0
    for (const target of TARGETS) {
      const table = () => fragmentNode('users-table', 'table', `frag-table-01-${target}.json`)
      const secondTable = () => fragmentNode('items', 'table', `frag-table-01-${target}.json`)
      const form = () => fragmentNode('query-form', 'form', `frag-form-01-${target}.json`)
      const dialog = () => fragmentNode('edit', 'dialog', `frag-dialog-02-component-${target}.json`)
      // 第二个弹窗换一个标题，标题分派才不是「两条相同的字面量」。
      const viewDialog = () => {
        const node = fragmentNode('view', 'dialog', `frag-dialog-02-component-${target}.json`)
        return { ...node, plan: { ...node.plan, intent: { ...node.plan.intent, defaultTitle: '查看用户' } } }
      }

      const combos = [
        // 单节点：组合页也必须是一张能编译的页面（ref 名、faces 都按同一套规则）。
        ['table', { nodes: [table()] }, ['table']],
        ['form', { nodes: [form()] }, ['form']],
        ['dialog', { nodes: [dialog()] }, ['dialog-component']],
        ['table+form', { nodes: [table(), form()] }, ['table', 'form']],
        ['form+dialog', { nodes: [form(), dialog()] }, ['form', 'dialog-component']],
        ['table+dialog', { nodes: [table(), dialog()] }, ['table', 'dialog-component']],
        // 弹窗节点 id 与表格的旧写死 ref 名撞车（@1 会生成两条 `const tableRef`）。
        // 这条用例存在的唯一目的就是让派生 ref 名的回归在编译腿里变红。
        [
          'table+dialog(id=table)',
          { nodes: [table(), fragmentNode('table', 'dialog', `frag-dialog-02-component-${target}.json`)] },
          ['table', 'dialog-component'],
        ],
        ['table+form+dialog', { nodes: [table(), form(), dialog()] }, ['table', 'form', 'dialog-component']],
        // @3 多弹窗：三个行按钮里 view / edit 各开各的窗，delete 升级为页面事件。
        [
          'table+2 dialogs',
          { nodes: [table(), dialog(), viewDialog()] },
          ['table', 'dialog-component', 'dialog-component'],
        ],
        // @3 master-detail：主表行按钮 → 明细表 reload(row)，角色同时决定数据默认目标。
        [
          'table+table(master-detail wire)',
          {
            nodes: [{ ...table(), role: 'master' }, secondTable(), form()],
            wires: [
              {
                from: { node: 'users-table', channel: 'row-action' },
                to: { node: 'items', channel: 'reload' },
                when: { rowAction: 'view' },
              },
            ],
          },
          ['table', 'table', 'form'],
        ],
        // @3 role 决定默认表：master 不是第一个节点时查询/成功也落到它。
        [
          'table+table(role=master)',
          { nodes: [secondTable(), { ...table(), role: 'master' }, dialog()] },
          ['table', 'table', 'dialog-component'],
        ],
        // @3 ui-only：数据通道全部升级为页面事件，UI 接线（行按钮 → 弹窗）保留。
        [
          'table+form+dialog(ui-only)',
          { nodes: [table(), form(), dialog()], behavior: 'ui-only' },
          ['table', 'form', 'dialog-component'],
        ],
        // P11 复核：显式接线覆盖派生页面事件后，faces.emit 不得留下幽灵事件；
        // 成功回调指向表单时页面必须真的生成表单模板 ref。
        [
          'table+form+dialog(explicit wires)',
          {
            nodes: [table(), form(), dialog()],
            wires: [
              {
                from: { node: 'users-table', channel: 'row-action' },
                to: { page: 'emit', event: 'removed' },
                when: { rowAction: 'delete' },
              },
              {
                from: { node: 'query-form', channel: 'submit' },
                to: { page: 'emit', event: 'saved' },
              },
              {
                from: { node: 'edit', channel: 'onSuccess' },
                to: { node: 'query-form', channel: 'resetFields' },
              },
            ],
          },
          ['table', 'form', 'dialog-component'],
        ],
      ]
      for (const [label, planExtra, artifacts] of combos) {
        await checkPlan(`${target} / ${label}`, { target, ...planExtra }, mod, artifacts)
        plans++
      }
    }

    // composable 形态：vue3 / antdv 各一组（vue2 被结构化拒绝，已在下面覆盖）。
    for (const target of ['vue3', 'antdv']) {
      const nodes = [
        fragmentNode('users-table', 'table', `frag-table-01-${target}.json`),
        fragmentNode('edit', 'dialog', `frag-dialog-01-${target}.json`),
      ]
      await checkPlan(`${target} / table+dialog(composable)`, { target, nodes }, mod, ['table', 'dialog-composable'])
      plans++
    }

    const rejectCount = checkStructuralRejects(mod)

    if (failures > 0) {
      console.error(`\n✖ 组合契约有 ${failures} 处漂移`)
      process.exitCode = 1
    } else {
      console.log(
        `\n✓ 组合契约一致：${plans} 组组合 / 接线通道全部来自 ARTIFACT_RUNTIME / 结构化拒绝 ${rejectCount} 例` +
          `（标题 ${Object.values(DIALOG_TITLES).join('/')}）`,
      )
    }
  } finally {
    cleanup()
  }
}

main().catch((err) => {
  console.error(err)
  process.exit(1)
})
