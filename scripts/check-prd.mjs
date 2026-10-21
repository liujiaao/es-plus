#!/usr/bin/env node
/**
 * AN-19 — PRD extraction corpus guard (offline, no API key).
 *
 * The paid leg (`eval-llm.mjs --prd` / full runs) puts a number on
 * "spec → surfaces". That number is only meaningful if the corpus itself is:
 *
 *   ① **expressible** — every gold surface set passes the REAL `generate_crud`
 *      zod shape (not a copy of it);
 *   ② **routable** — table-bearing cases take the compose branch; no-table cases
 *      take the fragment branch. The no-table branch is where an "invent a table
 *      to complete the page" mistake shows up;
 *   ③ **compilable** — every product passes Tier A (SFC script + template /
 *      TS·TSX module);
 *   ④ **membership round-trips** — `composeCrudConfig(gold surfaces)` restores the
 *      same per-field inQuery/inTable/inForm flags. A corpus whose surfacing
 *      cannot survive composition is testing a language the front door does not
 *      speak;
 *   ⑤ **fair** — every gold label literally appears in the spec (asserted
 *      offline in `prd-leg.test.mjs`), and the set has ≥20 cases with route and
 *      surface coverage.
 *
 * Uses the same captured handler as `check:front-door` and the eval front-door
 * leg; `metafile` proves the bundle came from `shared/src`, not a stale build.
 */
import { join } from 'node:path'
import { captureFrontDoor, fieldProjector, deriveSurfaces, frontDoorArgs, fencedBlocks, compileBlocks, ROOT } from './lib/front-door.mjs'
import { loadPrdCases, presentSurfaces, PRD_MIN_CASES } from './eval/prd-leg.mjs'

const PRD_DIR = join(ROOT, '__tests__', 'golden', 'prd')

let failed = false
function fail(msg) {
  failed = true
  console.error(`❌ ${msg}`)
}

async function main() {
  console.log('[prd] 打包并捕获真前门…')
  const { mod, cleanup, fromBuild, fromSrc } = await captureFrontDoor()
  try {
    if (fromBuild.length > 0) {
      fail(`打包拉到了 build/ 产物（${fromBuild.slice(0, 3).join(', ')}…）—— 陈旧构建会让本守卫测旧代码。`)
    }
    if (fromSrc.length === 0) fail('打包没有拉到任何 shared/src 输入 —— alias 没接上。')
    if (!failed) console.log(`[prd] 自证：打包输入 shared/src ${fromSrc.length} 个，shared/build 0 个 ✔`)

    const { cap, surfaceFieldSchema } = mod.capture()
    if (!cap || cap.name !== 'generate_crud') {
      fail(`没有捕获到 generate_crud 的注册（拿到 ${cap ? cap.name : 'null'}）`)
      return
    }
    const { z } = await import('zod')
    const shape = z.object(cap.shape)
    const project = fieldProjector(new Set(Object.keys(surfaceFieldSchema.shape)))

    const { cases, errors } = loadPrdCases(PRD_DIR)
    for (const e of errors) fail(`语料解析：${e}`)
    if (cases.length < PRD_MIN_CASES) fail(`PRD 语料至少 ${PRD_MIN_CASES} 条，实际 ${cases.length}`)
    if (!cases.length) return

    let expressible = 0
    let tableRouted = 0
    let fragmentRouted = 0
    let roundTrips = 0
    let compiled = 0
    let compileFailures = 0

    for (const c of cases) {
      const config = { target: 'vue3', ...c.raw.config }
      const surfaces = deriveSurfaces(config, project)
      const present = presentSurfaces(surfaces)
      if (!present.length) {
        fail(`${c.id}: gold 没有任何面`)
        continue
      }

      // ① 可表达
      const args = frontDoorArgs(config, surfaces)
      const parsed = shape.safeParse(args)
      if (!parsed.success) {
        fail(
          `${c.id}: gold surfaces 过不了真 crudShape — ` +
            parsed.error.issues.slice(0, 2).map((i) => `${i.path.join('.') || '(root)'}: ${i.message}`).join('; ')
        )
        continue
      }
      expressible++

      // ② 端到端 + 路由
      const r = await cap.handler(parsed.data)
      const text = r.content?.[0]?.text ?? ''
      if (r.isError) {
        fail(`${c.id}: 前门返回 isError — ${text.split('\n')[0]}`)
        continue
      }
      const hasTable = (surfaces.table ?? []).length > 0
      const isFragmentText = /no table surface/.test(text)
      if (hasTable && isFragmentText) {
        fail(`${c.id}: 有 table 却走了 no-table 片段分支`)
        continue
      }
      if (!hasTable && !isFragmentText) {
        fail(`${c.id}: 无 table 却没走 no-table 片段分支（产物开头：${text.split('\n')[0].slice(0, 80)}）`)
        continue
      }
      if (hasTable) tableRouted++
      else fragmentRouted++

      // ③ 编译
      if (fencedBlocks(text).length === 0) {
        fail(`${c.id}: 产物里没有任何围栏代码块`)
        continue
      }
      const cf = compileBlocks(text, `${c.id} × ${config.target}`)
      if (cf.length) {
        compileFailures += cf.length
        fail(`${c.id}: 产物编译失败 — ${cf[0]}`)
      } else {
        compiled++
      }

      // ④ 成员关系 round-trip（只对 table 分支：无表分支不经过 compose）
      if (hasTable) {
        const dialogBody = (surfaces.form ?? []).length ? surfaces.form : surfaces.table
        const dialogs = (surfaces.dialog ?? []).length
          ? Object.fromEntries(
              surfaces.dialog.map((d) => [
                String(d.key),
                {
                  title: d.title ?? String(d.key),
                  ...(d.width !== undefined ? { width: d.width } : {}),
                  ...(d.fullscreen !== undefined ? { fullscreen: d.fullscreen } : {}),
                  formItems: d.formItems !== undefined ? d.formItems : dialogBody,
                },
              ])
            )
          : undefined
        const composed = mod.composeCrudConfig({
          name: config.name,
          apiUrl: config.apiUrl,
          target: config.target,
          mode: config.mode,
          query: surfaces.query,
          table: surfaces.table,
          form: surfaces.form,
          dialogs,
        }).config
        const goldMem = new Map(
          config.fields.map((f) => [f.prop, [f.inQuery !== false, f.inTable !== false, f.inForm !== false]])
        )
        const compMem = new Map(
          composed.fields.map((f) => [f.prop, [f.inQuery === true, f.inTable === true, f.inForm === true]])
        )
        const lost = [...goldMem.keys()].filter((p) => !compMem.has(p))
        const drift = [...goldMem.entries()].filter(([p, flags]) => {
          const got = compMem.get(p)
          return !got || got.some((v, i) => v !== flags[i])
        })
        if (lost.length) fail(`${c.id}: compose 丢了字段 ${lost.join(', ')}`)
        else if (drift.length) {
          fail(
            `${c.id}: compose 改了成员关系 — ` +
              drift.slice(0, 3).map(([p, want]) => `${p} want ${want} got ${compMem.get(p)}`).join('; ')
          )
        } else roundTrips++
      }
    }

    console.log(
      `\n[prd] 语料 ${cases.length} 条：可表达 ${expressible} · table 路由 ${tableRouted} / 片段路由 ${fragmentRouted}` +
        ` · 编译 ${compiled}（失败块 ${compileFailures}）· 成员 round-trip ${roundTrips}`
    )
    if (cases.length && tableRouted === 0) fail('没有一条走 table 分支 —— 语料路由覆盖失效')
    if (cases.length && fragmentRouted === 0) fail('没有一条走 no-table 分支 —— 片段路由覆盖失效')
    if (failed) {
      console.error('\n[prd] FAILED — 见上方 ❌')
      process.exitCode = 1
    } else {
      console.log('\n[prd] OK — 语料可表达、可路由、可编译且成员关系 round-trip。✔')
    }
  } finally {
    cleanup()
  }
}

main().catch((err) => {
  console.error(`[prd] 崩溃：${err?.stack ?? err}`)
  process.exitCode = 1
})
