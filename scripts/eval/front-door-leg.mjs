/**
 * eval 的「前门腿」（W1.3）—— 「被测路径 = 宣称主路径」。
 *
 * 此前 `scripts/eval-llm.mjs` 的编译校验只调后端 `generateFromConfig`，而 `generate_crud`
 * 自称 FRONT DOOR（生产里宿主 LLM 的直接入口）。`scripts/check-front-door.mjs` 已把**语料**
 * 确定性喂过前门；本模块补的是它无法回答的那一半：**模型产出**能不能经前门落地。
 *
 * 不额外花模型调用：前门只吃已经拿到的 `pred`（模型产出），路由与生成全是确定性代码。
 * 判红的两条是「回退即缺陷」而非「模型答错」：
 *   · 前门产物**编译失败**（含 no-table 片段）—— 与 compileRate 同一把尺子；
 *   · **no-table 分支一次都没被走到** —— 那是语料天然到不了的分支（见 check-front-door 头注），
 *     在 eval 里靠「人为清空 table 面」强制覆盖，消失即意味着该分支又被改坏了/删掉了。
 * 前门对模型产出的**拒绝**（isError / 过不了 crudShape）只记录、不判红：那是模型侧的问题，
 * 已由分数反映；把它当门禁会让「模型答错」伪装成「前门回归」。
 *
 * `driveFrontDoor` 是脚本化可测的（`front-door-leg.test.mjs`）：它接收 `{ shape, cap, project }`
 * 这样的最小接口，测试用假 handler 就能把每种分类钉死，不必打包真 handler。
 */
import { captureFrontDoor, fieldProjector, deriveSurfaces, frontDoorArgs, fencedBlocks, compileBlocks } from '../lib/front-door.mjs'

/** 打包并捕获真前门；打包输入必须来自 `shared/src`（陈旧 build 会让这条腿失明）。 */
export async function setupFrontDoor() {
  const captured = await captureFrontDoor()
  const { cap, surfaceFieldSchema } = captured.mod.capture()
  if (!cap || cap.name !== 'generate_crud') {
    captured.cleanup()
    throw new Error(`前门腿：没有捕获到 generate_crud 的注册（拿到 ${cap ? cap.name : 'null'}）`)
  }
  if (captured.fromBuild.length > 0 || captured.fromSrc.length === 0) {
    captured.cleanup()
    throw new Error(
      `前门腿：打包输入不纯（shared/src ${captured.fromSrc.length} / shared/build ${captured.fromBuild.length}）—— ` +
        `陈旧构建会让本腿测旧代码`
    )
  }
  // 进程退出时收走临时打包目录（正常结束、门禁 exit、探针 exit 都走这里）。
  process.once('exit', () => captured.cleanup())
  const { z } = await import('zod')
  return {
    cap,
    shape: z.object(cap.shape),
    project: fieldProjector(new Set(Object.keys(surfaceFieldSchema.shape))),
  }
}

/** 把一条模型产出喂进真前门；返回可聚合的观测（不抛 —— 单行异常只记在该行）。 */
export async function driveFrontDoor(fd, pred) {
  const out = { branch: null, rejected: null, compileFailures: [], noTable: null }
  try {
    const surfaces = deriveSurfaces(pred, fd.project)
    const parsed = fd.shape.safeParse(frontDoorArgs(pred, surfaces))
    if (!parsed.success) {
      out.rejected = `crudShape: ${parsed.error.issues
        .slice(0, 2)
        .map((i) => `${i.path.join('.') || '(root)'}: ${i.message}`)
        .join('; ')}`
      return out
    }
    const r = await fd.cap.handler(parsed.data)
    const text = r.content?.[0]?.text ?? ''
    if (r.isError) {
      // 空 surfaces 是前门的**正确**拒绝（模型把各面与弹窗都清空），与「路由失败」分开记。
      out.branch = /surfaces` is empty/.test(text) ? 'empty' : null
      out.rejected = text.split('\n')[0]
    } else {
      out.branch = surfaces.table.length > 0 ? 'table' : 'fragment'
      if (fencedBlocks(text).length === 0) out.rejected = '产物里没有任何围栏代码块'
      out.compileFailures.push(...compileBlocks(text, 'front-door'))
    }

    // no-table 分支：语料天然走不到，这里强制清空 table 面覆盖它（每次一行，成本是纯代码）。
    const nt = await fd.cap.handler(fd.shape.parse(frontDoorArgs(pred, { ...surfaces, table: [] })))
    const ntText = nt.content?.[0]?.text ?? ''
    if (/surfaces` is empty/.test(ntText)) out.noTable = 'empty'
    else if (nt.isError) out.noTable = 'error'
    else if (!/no table surface/.test(ntText)) out.noTable = 'unrouted'
    else {
      out.noTable = 'ok'
      out.compileFailures.push(...compileBlocks(ntText, 'front-door no-table'))
    }
  } catch (err) {
    out.rejected = `threw: ${String(err?.message ?? err).split('\n')[0]}`
  }
  return out
}

/** 把逐行观测聚合成门禁读数（判据见文件头注）。纯函数，测试直接喂构造行。 */
export function summarizeFrontDoor(rows) {
  const fdRows = rows.filter((r) => r.frontDoor)
  const compileFailures = fdRows.flatMap((r) =>
    (r.frontDoor.compileFailures ?? []).map((m) => `${r.file} [${r.lang}] — ${m}`)
  )
  const routed = fdRows.filter((r) => r.frontDoor.branch === 'table' || r.frontDoor.branch === 'fragment')
  const noTableOk = fdRows.filter((r) => r.frontDoor.noTable === 'ok')
  return {
    rows: fdRows.length,
    routed: routed.length,
    rejected: fdRows.filter((r) => r.frontDoor.rejected).length,
    compileFailures,
    noTableExercised: noTableOk.length,
    ok: compileFailures.length === 0 && noTableOk.length > 0 && routed.length > 0,
  }
}
