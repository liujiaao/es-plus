/**
 * eval 的「场景腿」（P3）—— 「被测路径 = 宣称主路径」。
 *
 * P2 起生产前门是 `generate_scene`（scene='crud'），旧 `generate_crud` 只是 adapter。
 * 因此本腿驱动的必须是**场景路由器**；继续驱动旧工具会让门禁守着一个用户不会调用的
 * 入口。`driveFrontDoor` 保留旧名字只为减少调用点改动，内部已改为：
 *
 *     route(scene='crud') → intent(由 pred 投影) → landing(generate_scene) → witness(编译)
 *
 * `deriveSurfaces` 在这里**只**用于把模型产出的完整 config 投影成路由器的 intent；
 * 它不参与打分，也不再是「前门」本身。
 *
 * 不额外花模型调用：路由与生成全是确定性代码。判红的两条是「回退即缺陷」而非「模型答错」：
 *   · 场景路由器产物**编译失败**（含 no-table 片段）—— 与 compileRate 同一把尺子；
 *   · **no-table 分支一次都没被走到** —— 那是语料天然到不了的分支（见 check-front-door 头注），
 *     在 eval 里靠「人为清空 table 面」强制覆盖，消失即意味着该分支又被改坏了/删掉了。
 * 路由器对模型产出的**拒绝**（isError / 过不了 intent）只记录、不判红：那是模型侧的问题，
 * 已由分数反映；把它当门禁会让「模型答错」伪装成「路由器回归」。
 *
 * `driveFrontDoor` 是脚本化可测的（`front-door-leg.test.mjs`）：它接收
 * `{ sceneShape, sceneCap, project }` 这样的最小接口，测试用假 handler 就能把每种分类钉死，
 * 不必打包真 handler。
 */
import { captureFrontDoor, fieldProjector, deriveSurfaces, frontDoorArgs, fencedBlocks, compileBlocks } from '../lib/front-door.mjs'

/** 打包并捕获真场景路由器；打包输入必须来自 `shared/src`（陈旧 build 会让这条腿失明）。 */
export async function setupFrontDoor() {
  const captured = await captureFrontDoor()
  const { cap, surfaceFieldSchema } = captured.mod.capture()
  const sceneCap = captured.mod.captureScene()
  if (!cap || cap.name !== 'generate_crud') {
    captured.cleanup()
    throw new Error(`场景腿：没有捕获到 generate_crud（adapter）的注册（拿到 ${cap ? cap.name : 'null'}）`)
  }
  if (!sceneCap || sceneCap.name !== 'generate_scene') {
    captured.cleanup()
    throw new Error(`场景腿：没有捕获到 generate_scene 的注册（拿到 ${sceneCap ? sceneCap.name : 'null'}）`)
  }
  if (captured.fromBuild.length > 0 || captured.fromSrc.length === 0) {
    captured.cleanup()
    throw new Error(
      `场景腿：打包输入不纯（shared/src ${captured.fromSrc.length} / shared/build ${captured.fromBuild.length}）—— ` +
        `陈旧构建会让本腿测旧代码`
    )
  }
  // 进程退出时收走临时打包目录（正常结束、门禁 exit、探针 exit 都走这里）。
  process.once('exit', () => captured.cleanup())
  const { z } = await import('zod')
  return {
    cap,
    sceneCap,
    shape: z.object(cap.shape),
    sceneShape: z.object(sceneCap.shape),
    project: fieldProjector(new Set(Object.keys(surfaceFieldSchema.shape))),
    // AN-19: the published first-mile contract, bundled from the SAME resource
    // module the MCP server registers. Consumers must fail loudly if it is absent
    // rather than silently measuring against an empty/duplicated contract.
    extractionContract:
      typeof captured.mod.buildDesignExtractionContent === 'function'
        ? captured.mod.buildDesignExtractionContent()
        : null,
  }
}

/** 把一条模型产出喂进真场景路由器；返回可聚合的观测（不抛 —— 单行异常只记在该行）。 */
export async function driveFrontDoor(fd, pred) {
  const out = {
    route: 'crud',
    intent: null,
    landing: null,
    witness: [],
    branch: null,
    rejected: null,
    compileFailures: [],
    noTable: null,
  }
  try {
    // 诊断投影：模型产出的是完整 config，场景路由器的 intent 需要 surfaces。
    // 这里只用它构造入参，不参与任何分数。
    const surfaces = deriveSurfaces(pred, fd.project)
    const parsed = fd.sceneShape.safeParse({ scene: 'crud', intent: frontDoorArgs(pred, surfaces) })
    if (!parsed.success) {
      out.intent = 'rejected'
      out.landing = 'rejected'
      out.rejected = `intent: ${parsed.error.issues
        .slice(0, 2)
        .map((i) => `${i.path.join('.') || '(root)'}: ${i.message}`)
        .join('; ')}`
      return out
    }
    out.intent = 'ok'
    const r = await fd.sceneCap.handler(parsed.data)
    const text = r.content?.[0]?.text ?? ''
    if (r.isError) {
      // 空 surfaces 是路由器的**正确**拒绝（模型把各面与弹窗都清空），与「路由失败」分开记。
      out.branch = /surfaces` is empty/.test(text) ? 'empty' : null
      out.landing = out.branch ?? 'rejected'
      out.rejected = text.split('\n')[0]
    } else {
      out.branch = surfaces.table.length > 0 ? 'table' : 'fragment'
      out.landing = out.branch
      if (fencedBlocks(text).length === 0) out.rejected = '产物里没有任何围栏代码块'
      out.witness = compileBlocks(text, 'scene:crud')
      out.compileFailures.push(...out.witness)
    }

    // no-table 分支：语料天然走不到，这里强制清空 table 面覆盖它（每次一行，成本是纯代码）。
    const ntParsed = fd.sceneShape.safeParse({
      scene: 'crud',
      intent: frontDoorArgs(pred, { ...surfaces, table: [] }),
    })
    if (!ntParsed.success) {
      out.noTable = 'rejected'
    } else {
      const nt = await fd.sceneCap.handler(ntParsed.data)
      const ntText = nt.content?.[0]?.text ?? ''
      if (/surfaces` is empty/.test(ntText)) out.noTable = 'empty'
      else if (nt.isError) out.noTable = 'error'
      else if (!/no table surface/.test(ntText)) out.noTable = 'unrouted'
      else {
        out.noTable = 'ok'
        out.compileFailures.push(...compileBlocks(ntText, 'scene:crud no-table'))
      }
    }
  } catch (err) {
    out.rejected = `threw: ${String(err?.message ?? err).split('\n')[0]}`
    out.landing = 'rejected'
  }
  return out
}

/**
 * 片段场景：把模型产出的 intent 喂进**同一个** `generate_scene`，返回落地与编译见证。
 * 这是片段腿的 gated witness —— 直接调 `FRAGMENT_GENERATORS[scene]` 只能证明生成器，
 * 证明不了「宿主实际调用的入口」能把这份 intent 落地。
 */
export async function driveSceneFragment(fd, scene, intent) {
  const out = { route: scene, intent: null, landing: null, witness: [], rejected: null, compileFailures: [] }
  try {
    const parsed = fd.sceneShape.safeParse({ scene, intent })
    if (!parsed.success) {
      out.intent = 'rejected'
      out.landing = 'rejected'
      out.rejected = `intent: ${parsed.error.issues
        .slice(0, 2)
        .map((i) => `${i.path.join('.') || '(root)'}: ${i.message}`)
        .join('; ')}`
      return out
    }
    out.intent = 'ok'
    const r = await fd.sceneCap.handler(parsed.data)
    const text = r.content?.[0]?.text ?? ''
    if (r.isError) {
      out.landing = 'rejected'
      out.rejected = text.split('\n')[0]
      return out
    }
    out.landing = 'fragment'
    out.witness = compileBlocks(text, `scene:${scene}`)
    out.compileFailures.push(...out.witness)
  } catch (err) {
    out.landing = 'rejected'
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
  // P3 四段的可观测计数：route（请求的场景）→ intent（投影是否过路由器形状）→
  // landing（路由器接受了哪条分支）→ witness（产物编译失败数，见 compileFailures）。
  const landing = { table: 0, fragment: 0, empty: 0, rejected: 0, none: 0 }
  for (const r of fdRows) {
    const key = r.frontDoor.landing
    if (key in landing) landing[key]++
    else landing.none++
  }
  return {
    rows: fdRows.length,
    routed: routed.length,
    rejected: fdRows.filter((r) => r.frontDoor.rejected).length,
    intentRejected: fdRows.filter((r) => r.frontDoor.intent === 'rejected').length,
    landing,
    compileFailures,
    witnessFailures: compileFailures.length,
    noTableExercised: noTableOk.length,
    ok: compileFailures.length === 0 && noTableOk.length > 0 && routed.length > 0,
  }
}
