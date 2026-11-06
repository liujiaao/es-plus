#!/usr/bin/env node
/**
 * 场景腿接线门禁（P3）。
 *
 * eval 的**门禁路径**必须驱动生产主入口 `generate_scene`，而不是旧 adapter
 * `generate_crud`；否则「宣称主路径」与「被测路径」仍是两条。这个守卫用静态断言
 * 钉住接线（运行期分类由 `scripts/eval/front-door-leg.test.mjs` 钉住）：
 *
 *   (a) 打包入口真的捕获了 `generate_scene`（`captureScene`），不是只捕获旧前门；
 *   (b) eval 腿真的调用 `sceneCap.handler` —— 出现 `cap.handler` / `fd.cap.handler`
 *       就说明有人把 gated 路径改回了旧工具；
 *   (c) 片段腿把模型 intent 喂给同一个 `driveSceneFragment`，且 gated `compiles`
 *       来自它的 witness；
 *   (d) `deriveSurfaces` 只作为「完整 config → 路由器 intent」的投影，不出现在评分器里；
 *   (e) 注册表的 canonical 入口仍是 `generate_scene`；
 *   (f) PRD 腿（eval 与离线守卫）也只驱动场景路由器，不直连旧 adapter。
 *
 * 明确不做：不跑模型、不评准确率、不替代 `check:scene-parity` 的字节等价断言。
 *
 * 用法：node scripts/check-scene-eval.mjs
 * 退出码：0 = 接线正确；1 = 有一处回退/漂移。
 */
import { readFileSync } from 'node:fs'
import { dirname, join } from 'node:path'
import { fileURLToPath } from 'node:url'

const __dirname = dirname(fileURLToPath(import.meta.url))
const ROOT = join(__dirname, '..')
const read = (rel) => readFileSync(join(ROOT, rel), 'utf8')

const failures = []
const fail = (msg) => failures.push(msg)

// ── (a) 打包入口捕获 generate_scene ─────────────────────
const captureSrc = read('scripts/lib/front-door.mjs')
if (!captureSrc.includes('registerGenerateScene')) {
  fail('scripts/lib/front-door.mjs 没有 import registerGenerateScene —— 场景腿打包不到主入口')
}
if (!/export function captureScene\s*\(/.test(captureSrc)) {
  fail('scripts/lib/front-door.mjs 没有导出 captureScene() —— eval 无法捕获 generate_scene')
}

// ── (b) gated 路径调用 sceneCap，而不是旧 cap ───────────
const legSrc = read('scripts/eval/front-door-leg.mjs')
if (!/sceneCap\.handler\s*\(/.test(legSrc)) {
  fail('scripts/eval/front-door-leg.mjs 没有调用 sceneCap.handler —— gated 路径没有走 generate_scene')
}
for (const bad of [/\bcap\.handler\s*\(/, /\.sceneCap\s*\?\.\s*handler/]) {
  if (bad.test(legSrc)) {
    fail(`scripts/eval/front-door-leg.mjs 仍出现旧前门调用 ${bad} —— 必须改成 sceneCap.handler`)
  }
}
if (!/sceneCap\.name\s*!==\s*['"]generate_scene['"]/.test(legSrc)) {
  fail('setupFrontDoor 没有断言捕获到的是 generate_scene —— 捕获错工具会静默测旧入口')
}

// ── (c) 片段腿走同一个路由器 ────────────────────────────
const evalSrc = read('scripts/eval-llm.mjs')
if (!/driveSceneFragment/.test(evalSrc)) {
  fail('scripts/eval-llm.mjs 没有使用 driveSceneFragment —— 片段腿仍直接调生成器')
}
if (!/sceneObs/.test(evalSrc) || !/sceneLeg:\s*sceneObs/.test(evalSrc)) {
  fail('scripts/eval-llm.mjs 没有把场景腿观测（route/intent/landing/witness）落进行产物')
}
if (!/const compiles = witnessOk/.test(evalSrc)) {
  fail('片段腿的 gated `compiles` 不是来自场景路由器 witness（应出现 `const compiles = witnessOk`）')
}

// ── (d) deriveSurfaces 仅诊断 ───────────────────────────
for (const rel of ['scripts/eval/scorers.mjs', 'scripts/eval/fragment-scorers.mjs', 'scripts/eval/run-metrics.mjs']) {
  let src
  try {
    src = read(rel)
  } catch {
    fail(`${rel} 不存在 —— 评分器路径变了，守卫需要同步`)
    continue
  }
  if (/deriveSurfaces/.test(src)) {
    fail(`${rel} 使用了 deriveSurfaces —— 投影只能用于构造落地入参，不能进入评分`)
  }
}
// eval 里 deriveSurfaces 只允许出现在「构造落地入参」的两条腿（CRUD / PRD）。
const deriveUses = [...evalSrc.matchAll(/deriveSurfaces\s*\(/g)].length
if (deriveUses > 2) {
  fail(`scripts/eval-llm.mjs 里 deriveSurfaces 出现 ${deriveUses} 次 —— 疑似被用于评分或第二条投影`)
}

// ── (e) 注册表 canonical 入口 ──────────────────────────
const registrySrc = read('packages/shared/src/scene/registry.ts')
if (!/tool:\s*['"]generate_scene['"]/.test(registrySrc)) {
  fail('场景注册表的 canonical entry.tool 不是 generate_scene')
}

// ── (f) PRD 腿同样只走场景路由器 ───────────────────────
// 模型产出的是**意图表**，落地必须和生产前门一样包成 `{ scene:'crud', intent }`。
// 直连 adapter 会让这条腿继续量一个用户不再被引导去调的入口。
for (const rel of ['scripts/eval/prd-leg.mjs', 'scripts/check-prd.mjs']) {
  let src
  try {
    src = read(rel)
  } catch {
    fail(`${rel} 不存在 —— PRD 腿路径变了，守卫需要同步`)
    continue
  }
  if (!/sceneCap\.handler\s*\(/.test(src)) {
    fail(`${rel} 没有调用 sceneCap.handler —— PRD 腿仍在直连旧 adapter`)
  }
  if (/\bcap\.handler\s*\(/.test(src)) {
    fail(`${rel} 仍出现 cap.handler —— 必须改成 sceneCap.handler`)
  }
}

if (failures.length) {
  console.error(`\n✖ check:scene-eval FAILED（${failures.length} 处）：`)
  for (const m of failures) console.error(`   - ${m}`)
  process.exit(1)
}
console.log('✅ check:scene-eval：eval 的门禁路径真实驱动 generate_scene（含 PRD 腿），deriveSurfaces 仅作诊断投影。')
