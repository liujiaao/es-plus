#!/usr/bin/env node
/**
 * 场景腿自测（meta-eval，无需 API key，进 CI 的 check:consistency）。
 *
 * 为什么值得单测：这条腿的**分类**决定了门禁读什么。分类错了会以两种相反的方式骗人——
 *   · 把「模型侧拒绝」算成门禁失败 ⟹ 每次模型答错都伪装成路由器回归（红盲）；
 *   · 把「路由器产物编译失败 / no-table 分支消失」漏成通过 ⟹ 宣称主路径坏了而门禁全绿。
 * 故这里用**脚本化 handler**把每种分类钉死（真 handler 的打包由 check-front-door 与
 * eval 的 setupFrontDoor 两处各自自证，不在本测试里重复）。
 *
 * P3 起被测入口是 `generate_scene`（scene='crud'），不是旧 `generate_crud`。测试的
 * 假接口因此是 `{ sceneShape, sceneCap }`；任何「又改回旧工具」的回退都会被
 * `check-scene-eval` 静态咬住。
 *
 * 钉住的八条：
 *   1) 有 table → landing='table'；
 *   2) 无 table（模型主动把字段移出表格）→ landing='fragment'；
 *   3) no-table 分支必须被**强制**走到（路由器第二次调用 table 为空）且路由成功；
 *   4) surfaces 空 → 路由器的正确拒绝（landing='empty'），不是「路由失败」；
 *   5) no-table 输出不像片段分支 ⟹ 'unrouted'（不是 ok）；
 *   6) 产物语法错误 ⟹ witness/compileFailures 非空（门禁读它）；
 *   7) summarizeFrontDoor：编译失败 / 从未覆盖 no-table / 零路由 三者任一 ⟹ ok=false。
 *   8) 片段场景的 intent 喂进同一个路由器 → landing='fragment' + witness 为空。
 *   9) `rejectedKind` 归因：模型侧（未知键 / intent 校验）vs 我们自己的（形状拒绝 /
 *      handler 抛错 / 生成期报错）—— 前者不计编译分母，后者必须红。
 *  10) 文案锚点：`generate-scene.ts` 里那两条拒绝文案仍在（改了文案不同步分类会红）。
 */
import { readFileSync } from 'node:fs'
import { driveFrontDoor, driveSceneFragment, isModelSideSceneRejection, summarizeFrontDoor } from './front-door-leg.mjs'

let failures = 0
function check(cond, msg) {
  if (cond) return
  failures++
  console.error(`  ✗ ${msg}`)
}

/** 最小的场景路由器接口：形状直接放行（形状拒绝单独用 `rejectShape` 表达），项目器原样透传。 */
function fakeFd(handler, opts = {}) {
  const calls = []
  return {
    calls,
    project: (f) => ({ ...f }),
    sceneShape: {
      safeParse: (x) =>
        opts.rejectShape
          ? { success: false, error: { issues: [{ path: ['intent', 'name'], message: 'Required' }] } }
          : { success: true, data: x },
      parse: (x) => x,
    },
    sceneCap: {
      handler: async (args) => {
        calls.push(args)
        return handler(args)
      },
    },
  }
}

const ok = (text) => ({ content: [{ type: 'text', text }] })
const err = (text) => ({ content: [{ type: 'text', text }], isError: true })
const TABLE_OUT = 'Generated CRUD\n\n```ts\nconst a: number = 1\n```'
const FRAG_OUT = 'Generated 1 standalone fragment(s) (no table surface — not routed through the CRUD generator).\n\n```ts\nconst b: number = 2\n```'

function config(over = {}) {
  return {
    name: 'Demo',
    apiUrl: '/api/demo',
    target: 'vue3',
    mode: 'schema',
    typescript: true,
    i18n: false,
    fields: [{ prop: 'name', label: '名称', inQuery: true, inTable: true, inForm: true }],
    ...over,
  }
}

async function main() {
  // 1) table 分支 + no-table 强制覆盖
  {
    const fd = fakeFd((args) => ok(args.intent.surfaces.table.length > 0 ? TABLE_OUT : FRAG_OUT))
    const r = await driveFrontDoor(fd, config())
    check(r.route === 'crud', `① route 应记录请求的场景 crud（实得 ${r.route}）`)
    check(r.intent === 'ok', `① intent 投影应通过路由器形状（实得 ${r.intent}）`)
    check(r.branch === 'table', `① 有 table 时应走 table 分支（实得 ${r.branch}）`)
    check(r.landing === 'table', `① landing 应记录 table（实得 ${r.landing}）`)
    check(r.noTable === 'ok', `① no-table 应被强制覆盖并路由成功（实得 ${r.noTable}）`)
    check(r.witness.length === 0, `① 两段产物都合法时 witness 应为空（实得 ${r.witness.length}）`)
    check(r.compileFailures.length === 0, `① 两段产物都合法时不应有编译失败（实得 ${r.compileFailures.length}）`)
    check(fd.calls.length === 2, `① 应调用 handler 两次（table + 强制 no-table），实得 ${fd.calls.length}`)
    check(fd.calls[0].scene === 'crud', '① 第一次调用必须走 generate_scene 的 crud 场景')
    check(fd.calls[1].intent.surfaces.table.length === 0, '① 第二次调用必须清空 table 面（no-table 分支的唯一覆盖手段）')
    check(fd.calls[1].intent.surfaces.query.length === 1, '① 清空 table 不得连带清空 query 面（否则测到的是「空拒绝」而非片段分支）')
  }

  // 2) 模型主动把字段移出表格 → fragment
  {
    const fd = fakeFd((args) => ok(args.intent.surfaces.table.length > 0 ? TABLE_OUT : FRAG_OUT))
    const r = await driveFrontDoor(fd, config({ fields: [{ prop: 'name', inTable: false, inQuery: true, inForm: true }] }))
    check(r.branch === 'fragment', `② 无 table 字段时应走片段分支（实得 ${r.branch}）`)
    check(r.landing === 'fragment', `② landing 应记录 fragment（实得 ${r.landing}）`)
    check(r.noTable === 'ok', `② 片段分支输出应被识别为已路由（实得 ${r.noTable}）`)
  }

  // 3) surfaces 全空 → 路由器的正确拒绝
  {
    const fd = fakeFd(() => err('Error: `surfaces` is empty — set at least one of query / table / form / dialog.'))
    const r = await driveFrontDoor(fd, config({ fields: [{ prop: 'x', inQuery: false, inTable: false, inForm: false }] }))
    check(r.branch === 'empty', `③ 空 surfaces 应记 branch='empty'（实得 ${r.branch}）`)
    check(r.landing === 'empty', `③ landing 应记录 empty（实得 ${r.landing}）`)
    check(r.noTable === 'empty', `③ 强制 no-table 也应得到「空拒绝」（实得 ${r.noTable}）`)
    check(typeof r.rejected === 'string' && r.rejected.includes('surfaces'), '③ 拒绝原因应可读（进报告，不判红）')
  }

  // 4) 有产物但不像片段分支 → unrouted（不是 ok）
  {
    const fd = fakeFd((args) => ok(args.intent.surfaces.table.length > 0 ? TABLE_OUT : 'something else entirely'))
    const r = await driveFrontDoor(fd, config())
    check(r.noTable === 'unrouted', `④ no-table 产物未走片段分支时应记 unrouted（实得 ${r.noTable}）`)
  }

  // 5) 产物语法错误 → compileFailures / witness
  {
    const bad = '```ts\nconst = ;\n```'
    const fd = fakeFd((args) => ok(args.intent.surfaces.table.length > 0 ? bad : FRAG_OUT))
    const r = await driveFrontDoor(fd, config())
    check(r.compileFailures.length >= 1, `⑤ 语法错误必须进 compileFailures（实得 ${r.compileFailures.length}）`)
    check(r.witness.length >= 1, `⑤ 语法错误必须进 witness（实得 ${r.witness.length}）`)
  }

  // 6) 形状拒绝 / handler 抛错 → 只记录，不抛
  {
    const fd = fakeFd(() => ok(TABLE_OUT), { rejectShape: true })
    const r = await driveFrontDoor(fd, config())
    check(r.intent === 'rejected', `⑥ intent 形状拒绝应记 intent='rejected'（实得 ${r.intent}）`)
    check(typeof r.rejected === 'string' && r.rejected.startsWith('intent:'), `⑥ 形状拒绝应记 'intent: …'（实得 ${r.rejected}）`)
    check(r.compileFailures.length === 0, '⑥ 形状拒绝不应伪造编译失败')
  }
  {
    const fd = fakeFd(() => {
      throw new Error('boom')
    })
    const r = await driveFrontDoor(fd, config())
    check(typeof r.rejected === 'string' && r.rejected.startsWith('threw:'), `⑥ handler 抛错应记 'threw: …'（实得 ${r.rejected}）`)
  }

  // 7) 聚合门禁
  {
    const good = [
      { file: 'a.json', lang: 'zh', frontDoor: { branch: 'table', rejected: null, compileFailures: [], noTable: 'ok' } },
      { file: 'a.json', lang: 'en', frontDoor: { branch: 'table', rejected: null, compileFailures: [], noTable: 'ok' } },
    ]
    check(summarizeFrontDoor(good).ok === true, '⑦ 两行都健康时 ok 必须为 true')
    check(summarizeFrontDoor([]).ok === false, '⑦ 零观测不得算通过（no-table/路由都没发生）')
    const noCover = [{ file: 'a.json', lang: 'zh', frontDoor: { branch: 'table', rejected: null, compileFailures: [], noTable: 'unrouted' } }]
    check(summarizeFrontDoor(noCover).ok === false, '⑦ no-table 一次没走成 ⟹ ok=false')
    const compileBad = [
      { file: 'a.json', lang: 'zh', frontDoor: { branch: 'table', rejected: null, compileFailures: ['x — bad'], noTable: 'ok' } },
    ]
    check(summarizeFrontDoor(compileBad).ok === false, '⑦ 任一编译失败 ⟹ ok=false')
    const rejected = [{ file: 'a.json', lang: 'zh', frontDoor: { branch: null, landing: 'rejected', intent: 'ok', rejected: 'model-side', compileFailures: [], noTable: 'empty' } }]
    const s = summarizeFrontDoor(rejected)
    check(s.ok === false && s.rejected === 1, '⑦ 全被模型侧拒绝时 ok=false（routed=0），且 rejected 计数正确')
    check(s.landing.rejected === 1, '⑦ landing 计数应记录 rejected（实得 ' + s.landing.rejected + '）')
  }

  // 8) 片段场景：同一个 generate_scene 落地 + 编译见证
  {
    const fd = fakeFd(() => ok(FRAG_OUT))
    const r = await driveSceneFragment(fd, 'table', { fields: [{ prop: 'name', label: '名称' }], target: 'vue3' })
    check(r.route === 'table', `⑧ route 应记录 table（实得 ${r.route}）`)
    check(r.intent === 'ok', `⑧ 合法 intent 应通过路由器形状（实得 ${r.intent}）`)
    check(r.landing === 'fragment', `⑧ landing 应记录 fragment（实得 ${r.landing}）`)
    check(r.witness.length === 0, `⑧ 合法片段产物 witness 应为空（实得 ${r.witness.length}）`)
    check(fd.calls[0].scene === 'table', '⑧ 必须把片段场景名传给 generate_scene')
  }
  {
    const fd = fakeFd(() => err('✗ intent failed schema validation for scene "form" — nothing was generated'))
    const r = await driveSceneFragment(fd, 'form', { fields: [] })
    check(r.landing === 'rejected', `⑧ 路由器拒绝应记 landing='rejected'（实得 ${r.landing}）`)
    check(typeof r.rejected === 'string' && r.rejected.includes('scene "form"'), '⑧ 拒绝原因应原样带出')
  }

  // 9) 拒绝归因：模型侧 vs 我们自己
  {
    for (const text of [
      '✗ Unknown argument(s) for generate_scene — nothing was generated.',
      '✗ intent failed schema validation for scene "form" — nothing was generated:',
    ]) {
      const fd = fakeFd(() => err(text))
      const r = await driveSceneFragment(fd, 'table', {})
      check(r.rejectedKind === 'model-guard', `⑨ 模型侧拒绝应记 model-guard（实得 ${r.rejectedKind}）`)
      check(isModelSideSceneRejection(text) === true, `⑨ isModelSideSceneRejection 应认 @ 模型侧文案`)
    }
    for (const text of ['✗ scene "crud" is not supported', '✗ generator threw: boom']) {
      const fd = fakeFd(() => err(text))
      const r = await driveSceneFragment(fd, 'table', {})
      check(r.rejectedKind === 'tool-error', `⑨ 非模型侧 isError 应记 tool-error（实得 ${r.rejectedKind}）`)
    }
    {
      const fd = fakeFd(() => {
        throw new Error('boom')
      })
      const r = await driveSceneFragment(fd, 'table', {})
      check(r.rejectedKind === 'threw', `⑨ handler 抛错应记 threw（实得 ${r.rejectedKind}）`)
    }
    {
      const fd = fakeFd(() => ok(FRAG_OUT), { rejectShape: true })
      const r = await driveSceneFragment(fd, 'table', {})
      check(r.rejectedKind === 'intent-schema', `⑨ 形状拒绝应记 intent-schema（实得 ${r.rejectedKind}）`)
    }
  }

  // 10) 文案锚点：分类依赖 generate-scene.ts 的两处文案，改文案必须同步
  {
    const src = readFileSync(
      new URL('../../packages/mcp-server/src/tools/generate-scene.ts', import.meta.url),
      'utf8'
    )
    check(src.includes('✗ Unknown argument(s) for generate_scene'), '⑩ 源码必须仍含「未知入参」拒绝文案')
    check(src.includes('✗ intent failed schema validation for scene'), '⑩ 源码必须仍含「intent 校验」拒绝文案')
  }

  if (failures) {
    console.error(`\n[front-door-leg] ${failures} 条断言失败`)
    process.exit(1)
  }
  console.log('[front-door-leg] 分类 / 强制 no-table 覆盖 / 门禁聚合 全部通过 ✔')
}

main().catch((err) => {
  console.error('[front-door-leg] 致命：', err)
  process.exit(1)
})
