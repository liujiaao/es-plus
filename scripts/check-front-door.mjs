#!/usr/bin/env node
/**
 * 前门（`generate_crud`）确定性冒烟 —— 被测路径终于等于宣称主路径。
 *
 * ## 为什么需要它（AI-33 ⑧）
 *
 * `packages/mcp-server/src/tools/generate-crud.ts` 的 docblock 自称
 * "FRONT DOOR for es-plus generation —— use this for ANY request…"，是**宣称的主路径**。
 * 但此前 `scripts/eval-llm.mjs` 只调后端 `generateFromConfig`，**0 次**经过前门；
 * 而前门自带一条**零语料覆盖**的分支（`hasTable` 为假时改发独立片段，见 `:232-283`）。
 * 实测：186 条 crud 语料里**没有任何一条**解析后 table 面为空 —— 也就是说那条分支
 * 既不被 eval 覆盖、也不被语料覆盖，是纯粹的未测代码。
 *
 * 本脚本把语料喂进**真的** handler（不是复制一份逻辑），断言六件事：
 *   ① 可表达性：由 gold 语料推导出的 surfaces 必须过**真的** `crudShape`（证明语料
 *      确实落在前门的输入语言里，而不是「恰好能跑」）；
 *   ② 端到端：handler 返回且 `isError` 为假；
 *   ③ 路由：有 table → CRUD 产物；**人为清空 table 面** → 必须走 no-table 片段分支。
 *      这是那条零覆盖分支唯一的覆盖手段（语料里天然走不到它）；
 *   ④ 编译：抽出产物里所有围栏块，用与 `compile-smoke` / `check-scene-coverage`
 *      同一把尺子（`scripts/lib/compile-check.mjs`）解析语法；
 *   ⑤ round-trip（承重断言）：`composeCrudConfig(推导的 surfaces)` 的
 *      **字段成员关系**必须与 gold 的三面划分逐字段一致。只断言「没抛异常」是不够的 ——
 *      成员关系写错（`inQuery: true` 之类的常量）照样能生成、照样能编译，但语义全错。
 *   ⑥ 报告：可表达 N 条、因逃生舱不可表达 M 条（**点名**，绝不静默跳过）。
 *
 * ## 技术路线
 *
 * esbuild 打包一个**临时入口**到仓库内（`node_modules/` 下），入口里用一个假 `server`
 * 捕获真 handler 与真 Zod 形状（与 `packages/mcp-server/__tests__/generate-tools-and-prompts.spec.ts`
 * 同法），再用 `import()` 取回。三点讲究：
 *   - **`banner` 里的 `createRequire` shim**：ESM 产物里 esbuild 的动态 require 兜底
 *     需要真 `require`（同 `scripts/check-generator-targets.mjs`）；
 *   - **`alias` 把 `@es-plus/shared` 指到 `src/index.ts`**：包的 `exports` 指向
 *     `build/`，而 build 可能陈旧 —— 陈旧构建会让本守卫**静默失明**（测的是旧代码）。
 *     故用 `metafile` 自证「本次打包拉的是 `shared/src`、`shared/build` 零命中」，
 *     把「守卫自己能看见什么」也变成一条断言；
 *   - **临时入口放在仓库内**：ESM 说明符要相对解析，放系统临时目录会在
 *     `import 'esbuild'` 处炸（找不到包）。
 *
 * 与另两个守卫的分工：`check-entry-contract.mjs` 管「**键集**可达性」（前门够不到哪些
 * schema 顶层键）；本脚本管「**驱动**可达性」（拿真语料真跑一遍前门，含零覆盖分支与
 * 成员关系）。二者互补，不重复。
 *
 * 用法：`node scripts/check-front-door.mjs`
 * 退出码：0 = 六类断言全过；1 = 任一红。
 */
import { mkdtempSync, writeFileSync, readFileSync, readdirSync, rmSync } from 'node:fs'
import { join, dirname } from 'node:path'
import { fileURLToPath, pathToFileURL } from 'node:url'
import { build } from 'esbuild'
import { isCrudCase } from './eval/scenes.mjs'
import { parseSfc, parseSource, parseComposable } from './lib/compile-check.mjs'
import { FRONT_DOOR_UNREACHABLE } from './lib/entry-keys.mjs'

const ROOT = join(dirname(fileURLToPath(import.meta.url)), '..')
const CASES_DIR = join(ROOT, '__tests__', 'golden', 'cases')

let failed = false
const fail = (msg) => {
  failed = true
  console.error(`❌ ${msg}`)
}
const note = (msg) => console.log(`   ${msg}`)

/** 从 ```` ```lang ```` 围栏里抽出所有代码块（lang 归一化：vue / tsx / ts / js）。 */
function fencedBlocks(text) {
  const out = []
  for (const m of text.matchAll(/```([a-zA-Z]*)[ \t]*\r?\n([\s\S]*?)```/g)) {
    const raw = m[1].toLowerCase()
    const lang = raw === 'vue' ? 'vue' : raw === 'tsx' ? 'tsx' : raw === 'json' ? 'json' : raw === 'js' || raw === 'jsx' ? 'js' : 'ts'
    out.push({ lang, code: m[2] })
  }
  return out
}

/** 用共享尺子解析产物里每个围栏块；返回失败描述（空数组 = 全过）。 */
function compileBlocks(text, label) {
  const failures = []
  for (const { lang, code } of fencedBlocks(text)) {
    if (lang === 'vue') parseSfc(code, label, failures)
    else if (lang === 'tsx') parseComposable(code, true, label, failures)
    else if (lang === 'json') {
      try {
        JSON.parse(code)
      } catch (err) {
        failures.push(`${label} — JSON 载荷解析失败：${String(err.message).split('\n')[0]}`)
      }
    } else parseSource(code, lang, label, failures)
  }
  return failures
}

/**
 * 打包并捕获前门的真 handler / 真形状。
 * `metafile` 用于自证打包拉的是 `shared/src`（见文件头注）。
 */
async function captureFrontDoor() {
  const tmp = mkdtempSync(join(ROOT, 'node_modules', 'es-front-door-'))
  const entry = join(tmp, 'entry.ts')
  try {
    writeFileSync(
      entry,
      [
        "import { registerGenerateCrud } from '../../packages/mcp-server/src/tools/generate-crud.ts'",
        "import { surfaceFieldSchema } from '../../packages/mcp-server/src/tools/_fragment-shapes.ts'",
        "export { composeCrudConfig } from '@es-plus/shared'",
        'export function capture() {',
        '  let cap = null',
        '  const fake = { tool: (name, desc, shape, handler) => { cap = { name, desc, shape, handler } } }',
        '  registerGenerateCrud(fake)',
        '  return { cap, surfaceFieldSchema }',
        '}',
      ].join('\n'),
      'utf8'
    )
    const outfile = join(tmp, 'front-door.mjs')
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
    const fromBuild = inputs.filter((p) => /shared[\\/]build[\\/]/.test(p))
    const fromSrc = inputs.filter((p) => /shared[\\/]src[\\/]/.test(p))
    return { mod: await import(pathToFileURL(outfile).href), tmp, fromBuild, fromSrc }
  } catch (err) {
    // 打包/导入失败也要清干净临时目录，别在 node_modules 里留垃圾。
    rmSync(tmp, { recursive: true, force: true })
    throw err
  }
}

/** 把 gold 的一个字段投影成前门字段词汇（只保留 `surfaceFieldSchema` 认识的键）。 */
function fieldProjector(surfaceKeys) {
  return (f) => {
    const o = {}
    for (const k of Object.keys(f)) if (surfaceKeys.has(k)) o[k] = f[k]
    return o
  }
}

/**
 * gold config → 前门 `surfaces`。
 * 面成员由 `inQuery/inTable/inForm !== false` 决定（与 `compose-crud-config.ts:178-180`
 * 的写入方向相反、语义相同）；dialog 用「全参对象」形式，只带前门形状接受的键。
 */
function deriveSurfaces(config, project) {
  const query = config.fields.filter((f) => f.inQuery !== false).map(project)
  const table = config.fields.filter((f) => f.inTable !== false).map(project)
  const form = config.fields.filter((f) => f.inForm !== false).map(project)
  const dialog = config.dialogs
    ? Object.entries(config.dialogs).map(([key, d]) => ({
        key,
        ...(d.title !== undefined ? { title: d.title } : {}),
        ...(d.width !== undefined ? { width: d.width } : {}),
        ...(d.fullscreen !== undefined ? { fullscreen: d.fullscreen } : {}),
        ...(d.formItems !== undefined ? { formItems: d.formItems.map(project) } : {}),
      }))
    : undefined
  return { query, table, form, dialog }
}

/** 前门形状里没有的 dialog 子键（前门表达不了，报告用）。 */
const DIALOG_ACCEPTED = new Set(['key', 'title', 'width', 'fullscreen', 'formItems'])

async function main() {
  console.log('[front-door] 打包并捕获真 handler…')
  const { mod, tmp, fromBuild, fromSrc } = await captureFrontDoor()
  try {
    if (fromBuild.length > 0) {
      fail(
        `打包拉到了 build/ 产物（${fromBuild.slice(0, 3).join(', ')}…）—— 陈旧构建会让本守卫测旧代码。` +
          `alias 未生效？`
      )
    }
    if (fromSrc.length === 0) fail('打包没有拉到任何 shared/src 输入 —— 想当然的 alias 没接上。')
    if (!failed) console.log(`[front-door] 自证：打包输入 shared/src ${fromSrc.length} 个，shared/build 0 个 ✔`)

    const { cap, surfaceFieldSchema } = mod.capture()
    const composeCrudConfig = mod.composeCrudConfig
    if (!cap || cap.name !== 'generate_crud') {
      fail(`没有捕获到 generate_crud 的注册（拿到 ${cap ? cap.name : 'null'}）`)
      return
    }
    if (typeof composeCrudConfig !== 'function') {
      fail('没拿到 composeCrudConfig —— 承重断言⑤无从执行')
      return
    }
    const surfaceKeys = new Set(Object.keys(surfaceFieldSchema.shape))
    const project = fieldProjector(surfaceKeys)

    // Zod 形状来自真注册（`crudShape`），不另抄一份 —— 前门加了键这里自动跟上。
    const { z } = await import('zod')
    const crudShapeObj = z.object(cap.shape)

    const files = readdirSync(CASES_DIR).filter((f) => f.endsWith('.json')).sort()
    let expressible = 0
    const columnsCases = []
    const dialogKeyGaps = new Map()
    let handlerFail = 0
    let e2eOk = 0
    let roundOk = 0
    let noTableRouted = 0
    let noTableEmpty = 0
    const routeMsgs = []
    const compileMsgs = []
    const roundMsgs = []

    for (const file of files) {
      const raw = JSON.parse(readFileSync(join(CASES_DIR, file), 'utf8'))
      if (!isCrudCase(raw)) continue
      const config = raw.config
      const surfaces = deriveSurfaces(config, project)

      // gold 顶层用了但前门表达不了的细节：计数 + 点名（绝不静默跳过）。
      if ((config.columns ?? []).length > 0) columnsCases.push(file)
      for (const d of Object.values(config.dialogs ?? {})) {
        for (const k of Object.keys(d)) {
          if (!DIALOG_ACCEPTED.has(k)) dialogKeyGaps.set(k, (dialogKeyGaps.get(k) ?? 0) + 1)
        }
      }

      const argsFor = (table) => ({
        name: config.name,
        apiUrl: config.apiUrl,
        surfaces: { query: surfaces.query, table, form: surfaces.form, dialog: surfaces.dialog },
        target: config.target,
        mode: config.mode,
        typescript: config.typescript,
        i18n: config.i18n,
        actions: config.actions,
        permissions: config.permissions,
        pagination: config.pagination,
        tableOptions: config.tableOptions,
        formLayout: config.formLayout,
        operationColumn: config.operationColumn,
        tableBtns: config.tableBtns,
        toolbarBtns: config.toolbarBtns,
        expandConfig: config.expandConfig,
        treeConfig: config.treeConfig,
        mergeConfig: config.mergeConfig,
      })

      // ① 可表达性：推导出的 surfaces 必须过真的 crudShape。
      const parsed = crudShapeObj.safeParse(argsFor(surfaces.table))
      if (!parsed.success) {
        fail(
          `${file} — 推导的 surfaces 过不了前门 crudShape：` +
            parsed.error.issues
              .slice(0, 3)
              .map((i) => `${i.path.join('.') || '(root)'}: ${i.message}`)
              .join('; ')
        )
        continue
      }
      expressible++

      // ② 端到端 + ④ 编译（table 分支）。
      const r0 = await cap.handler(parsed.data)
      const t0 = r0.content?.[0]?.text ?? ''
      if (r0.isError) {
        handlerFail++
        if (handlerFail <= 3) fail(`${file} — 前门返回 isError：${t0.split('\n')[0]}`)
        continue
      }
      if (fencedBlocks(t0).length === 0) fail(`${file} — table 分支产物里没有任何围栏代码块`)
      e2eOk++
      compileMsgs.push(...compileBlocks(t0, `${file} × ${config.target}/${config.mode} table 分支`))

      // ③ no-table 路由：人为清空 table 面（语料天然走不到这条分支，见文件头注）。
      const r1 = await cap.handler(crudShapeObj.parse(argsFor([])))
      const t1 = r1.content?.[0]?.text ?? ''
      if (/surfaces` is empty/.test(t1)) {
        noTableEmpty++
      } else if (!/no table surface/.test(t1)) {
        routeMsgs.push(`${file} — 清空 table 后没走 no-table 分支（产物开头：${t1.split('\n')[0].slice(0, 80)}）`)
      } else if (fencedBlocks(t1).length === 0) {
        routeMsgs.push(`${file} — no-table 分支没有发出任何片段`)
      } else {
        noTableRouted++
        compileMsgs.push(...compileBlocks(t1, `${file} × ${config.target} no-table 片段`))
      }

      // ⑤ round-trip 成员关系（承重断言）。
      const composed = composeCrudConfig({
        name: config.name,
        apiUrl: config.apiUrl,
        query: surfaces.query,
        table: surfaces.table,
        form: surfaces.form,
      }).config
      const goldMem = new Map(config.fields.map((f) => [f.prop, [f.inQuery !== false, f.inTable !== false, f.inForm !== false]]))
      const compMem = new Map(composed.fields.map((f) => [f.prop, [f.inQuery === true, f.inTable === true, f.inForm === true]]))
      const lost = [...goldMem.keys()].filter((p) => !compMem.has(p))
      // gold 里三面全 false 的字段（例如只在 expandConfig 行展开里出现的日期）本就不属于任何面，
      // 组合层按设计丢弃 —— 只有**非全 false** 的字段丢失才是真缺陷。
      const unexpectedLoss = lost.filter((p) => goldMem.get(p).some(Boolean))
      const extra = [...compMem.keys()].filter((p) => !goldMem.has(p))
      const mismatch = [...compMem.entries()].filter(([p, v]) => {
        const g = goldMem.get(p)
        return g !== undefined && (g[0] !== v[0] || g[1] !== v[1] || g[2] !== v[2])
      })
      if (unexpectedLoss.length || extra.length || mismatch.length) {
        roundMsgs.push(
          `${file} — 成员关系不忠实：非全 false 却丢失 [${unexpectedLoss.join(', ')}]` +
            `${extra.length ? `；凭空多出 [${extra.join(', ')}]` : ''}` +
            `${mismatch.length ? `；成员位不符 ${mismatch.map(([p, v]) => `${p}=${v.join('/')}`).join(', ')}` : ''}`
        )
      } else {
        roundOk++
      }
    }

    // 生效缺口：只减不增清单（逃生舱由用户拍板，登记在 lib/entry-keys.mjs 的 FRONT_DOOR_UNREACHABLE）。
    if (!('columns' in FRONT_DOOR_UNREACHABLE)) {
      fail(
        '`columns` 不再登记为「前门不可达」—— 前门若已收 columns，请让本守卫把 columns 一并透传，' +
          '否则下面的「不可表达」计数会变成谎言。'
      )
    }
    if (roundMsgs.length) {
      fail(`round-trip 成员关系 ${roundMsgs.length} 条不忠实（承重断言⑤）：`)
      for (const m of roundMsgs.slice(0, 5)) console.error(`     ✗ ${m}`)
    }
    if (routeMsgs.length) {
      fail(`no-table 路由断言③ ${routeMsgs.length} 条未过：`)
      for (const m of routeMsgs.slice(0, 5)) console.error(`     ✗ ${m}`)
    }
    if (compileMsgs.length) {
      fail(`产物语法解析（断言④）${compileMsgs.length} 处失败：`)
      for (const m of compileMsgs.slice(0, 5)) console.error(`     ✗ ${m}`)
    }

    console.log('')
    console.log(`[front-door] 语料 ${expressible} 条可表达（过真的 crudShape）`)
    console.log(`[front-door] 端到端：${e2eOk} 条 handler 返回非 isError`)
    console.log(`[front-door] ⑤ 成员关系 round-trip：${roundOk}/${expressible} 条忠实`)
    console.log(`[front-door] no-table 分支：${noTableRouted} 条路由到片段发射器并编译通过；${noTableEmpty} 条因清空后 surfaces 全空而走「空表」拒绝路径`)
    console.log(
      `[front-door] 不可表达（逃生舱，由 surfaces 推导不到）：columns ${columnsCases.length} 条 —— ` +
        `原因见 FRONT_DOOR_UNREACHABLE.columns：「${FRONT_DOOR_UNREACHABLE.columns}」`
    )
    console.log(`[front-door] 不可表达（dialog 子键）：${dialogKeyGaps.size ? [...dialogKeyGaps].map(([k, n]) => `${k} ${n} 例`).join(' / ') : '无'}`)
    if (columnsCases.length) console.log(`[front-door]   点名：${columnsCases.slice(0, 6).join(', ')}${columnsCases.length > 6 ? ` …共 ${columnsCases.length} 条` : ''}`)
    if (handlerFail > 3) console.error(`[front-door]   （另有 ${handlerFail - 3} 条 isError 未逐条打印）`)

    if (failed) {
      console.error('\n[front-door] 前门确定性冒烟未过。')
      process.exitCode = 1
    } else {
      console.log('\n[front-door] 前门路由 / 编译 / 成员关系 round-trip 全部通过 ✔')
    }
  } finally {
    rmSync(tmp, { recursive: true, force: true })
  }
}

main().catch((err) => {
  console.error('[front-door] 致命：', err)
  process.exit(1)
})
