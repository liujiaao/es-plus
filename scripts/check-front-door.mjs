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
 *      入参按真 handler 的装配（含 actions / dialogs / tableBtns / 各顶层开关）喂，
 *      否则验的是 compose 的推导分支而不是页面真实产物。
 *   ⑤b 动作面保真（AN-06）：gold 声明了 `actions` / `dialogs` / `tableBtns` 时，
 *      组合结果必须原样保留（少一个键不会编译失败，只会让页面少/多按钮 —— 曾因三端
 *      各自硬编码 add/edit/delete 兜底，把只读页变成能删）。
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
import { readFileSync, readdirSync } from 'node:fs'
import { join } from 'node:path'
import { isCrudCase } from './eval/scenes.mjs'
import { FRONT_DOOR_UNREACHABLE } from './lib/entry-keys.mjs'
// 打包/捕获前门、字段投影、面推导、围栏块编译 —— 与 eval 的「前门腿」共用同一份实现
// （各写一份必然漂移，而漂移会让「eval 测到的」不等于「本守卫断言的」）。
import { captureFrontDoor, fieldProjector, deriveSurfaces, frontDoorArgs, DIALOG_ACCEPTED, fencedBlocks, compileBlocks, ROOT } from './lib/front-door.mjs'

const CASES_DIR = join(ROOT, '__tests__', 'golden', 'cases')

let failed = false
const fail = (msg) => {
  failed = true
  console.error(`❌ ${msg}`)
}
const note = (msg) => console.log(`   ${msg}`)

async function main() {
  console.log('[front-door] 打包并捕获真 handler…')
  const { mod, cleanup, fromBuild, fromSrc } = await captureFrontDoor()
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
    const actionMsgs = []

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

      // 顶层透传键与 eval 的前门腿共用一份装配（见 lib/front-door.mjs 的 frontDoorArgs）。
      const argsFor = (table) => frontDoorArgs(config, { ...surfaces, table })

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
      // 入参必须与真 handler 一致（`generate-crud.ts:241-263`）—— 只喂 query/table/form
      // 会让 actions/tableBtns 走 compose 的**推导**分支，测出来的就不是页面真实产物。
      const dialogBody = surfaces.form.length ? surfaces.form : surfaces.table
      const dialogs = surfaces.dialog
        ? Object.fromEntries(
            surfaces.dialog.map((d) => [
              String(d.key),
              {
                title: d.title !== undefined ? d.title : String(d.key),
                ...(d.width !== undefined ? { width: d.width } : {}),
                ...(d.fullscreen !== undefined ? { fullscreen: d.fullscreen } : {}),
                formItems: d.formItems !== undefined ? d.formItems : dialogBody,
              },
            ])
          )
        : undefined
      const composed = composeCrudConfig({
        name: config.name,
        apiUrl: config.apiUrl,
        target: config.target,
        mode: config.mode,
        typescript: config.typescript,
        i18n: config.i18n,
        query: surfaces.query,
        table: surfaces.table,
        form: surfaces.form,
        actions: config.actions,
        permissions: config.permissions,
        pagination: config.pagination,
        tableOptions: config.tableOptions,
        formLayout: config.formLayout,
        operationColumn: config.operationColumn,
        tableBtns: config.tableBtns,
        toolbarBtns: config.toolbarBtns,
        dialogs,
        expandConfig: config.expandConfig,
        treeConfig: config.treeConfig,
        mergeConfig: config.mergeConfig,
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

      // ⑤b 动作面保真（AN-06）：actions / dialog key / tableBtns 决定页面上有哪些按钮。
      // 少一个键既不会编译失败、也不会少字段 —— 只会让页面少/多按钮（曾靠三端各自
      // 硬编码 add/edit/delete 兜底，把「页面只读」变成「页面能删」），故必须逐条比。
      const keyList = (xs) => [...xs].sort().join('|')
      if (Array.isArray(config.actions) && keyList(config.actions) !== keyList(composed.actions ?? [])) {
        actionMsgs.push(
          `${file} — actions 不保真：gold [${config.actions.join(', ')}] vs composed [${(composed.actions ?? []).join(', ')}]`
        )
      }
      const goldDialogKeys = Object.keys(config.dialogs ?? {})
      const compDialogKeys = Object.keys(composed.dialogs ?? {})
      if (keyList(goldDialogKeys) !== keyList(compDialogKeys)) {
        actionMsgs.push(
          `${file} — dialog key 不保真：gold [${goldDialogKeys.join(', ')}] vs composed [${compDialogKeys.join(', ')}]`
        )
      }
      const goldTb = Array.isArray(config.tableBtns) ? config.tableBtns.length : null
      const compTb = Array.isArray(composed.tableBtns) ? composed.tableBtns.length : null
      if (goldTb !== compTb) {
        actionMsgs.push(`${file} — tableBtns 不保真：gold ${goldTb ?? '未声明'} 条 vs composed ${compTb ?? '未声明'} 条`)
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
    if (actionMsgs.length) {
      fail(`round-trip 动作面 ${actionMsgs.length} 条不忠实（AN-06 ⑤b）：`)
      for (const m of actionMsgs.slice(0, 5)) console.error(`     ✗ ${m}`)
    }
    if (routeMsgs.length) {
      fail(`no-table 路由断言③ ${routeMsgs.length} 条未过：`)
      for (const m of routeMsgs.slice(0, 5)) console.error(`     ✗ ${m}`)
    }
    // 断言③ 的见证下限：一条都路由不过去时，下面那句「N 条路由到片段发射器」
    // 打印的是 0，断言③ 本身却仍然全绿 —— 守卫在空转（语料/路由改坏了也看不见）。
    if (noTableRouted === 0) {
      fail('no-table 路由断言③ 没有任何见证（0 条走到片段发射器）—— 断言在空转，请检查语料是否还有纯 query/form 面。')
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
    cleanup()
  }
}

main().catch((err) => {
  console.error('[front-door] 致命：', err)
  process.exit(1)
})
