#!/usr/bin/env node
/**
 * 依赖树不变量：同一个库在 workspace 里只允许存在**一个实现**。
 *
 * ## 为什么这条值得守
 *
 * npm 的 hoist 是尽力而为：只要两个包声明的范围没有交集，它就会在其中一个包下面
 * 再装一份嵌套副本 —— 构建全绿、测试全绿、发布也成功，但运行时是两个不同的库实例。
 * 这类缺陷**没有任何现有守卫看得见**，只有把两台对象交给同一个 API 时才会炸：
 *
 *   - zod：`z.object()` 造出的对象带着自己那一份 class。shared 用 v4 建 schema、
 *     mcp-server 用 v3 解析，两者都「合法」，但 v3 形状传进 v4 的自省/转换器
 *     （`zod-to-json-schema`、MCP SDK 的 `server.tool()`）时只能靠 `_def` 鸭子类型
 *     勉强工作，且 v3 的 issue 词汇（`invalid_enum_value`/`options`）与 v4
 *     （`invalid_value`/`values`）不同 —— 错误建议会静默变成另一套说辞。
 *   - vue：两份 Vue 会让 `instanceof` 与 `provide/inject` 失效（本仓是 Vue 2 +
 *     Vue 3 并存的多包仓库，故只对**同一个 workspace 内声明**的库生效）。
 *
 * 2026-11-07 定位到的实况：根 `node_modules/zod` 是 3.25.76（mcp-server 的 `^3.22.0`
 * 拉上来的），而 `packages/shared` 自己声明 `^4.4.3` → 嵌套第二份。体积翻倍只是表象，
 * 真正的问题是两个 zod 实例在同一个进程里各建一半 schema。修法是把 mcp-server 也
 * 升到 4.x（官方 MCP SDK 的 peer 是 `^3.25 || ^4.0`，本来就允许），此后 root 只剩一份。
 *
 * ## 三条判据（缺一不可）
 *
 *   1. **lockfile**：`package-lock.json` 里 `node_modules/…/zod` 这类条目只有一个大版本
 *      —— 这条管「装了没有第二份」，但 lockfile 可以被手改/过期，故不单独作数。
 *   2. **解析结果**：每个声明该依赖的 workspace 用 `createRequire` 真的解析一次，
 *      结果必须是**同一个 realpath**。这条才是运行时的真相：哪怕 lockfile 干净，
 *      只要有一个包解析到别处，它拿到的就是另一份 class。
 *   3. **声明范围**：声明的**下界**大版本必须与解析到的大版本一致 —— 防「装的是 4、
 *      声明的是 ^3」这种靠 hoist 碰巧能跑的组合（下一次 `npm install` 就会分叉）。
 *
 * 用法：node scripts/check-deps.mjs
 * 退出码：0 = 单一实现；1 = 出现多份或声明分叉。
 */
import { readFileSync, existsSync, realpathSync, readdirSync } from 'node:fs'
import { createRequire } from 'node:module'
import { dirname, join } from 'node:path'
import { fileURLToPath } from 'node:url'

const __dirname = dirname(fileURLToPath(import.meta.url))
const ROOT = join(__dirname, '..')

let failed = false
const fail = (msg) => {
  failed = true
  console.error(`❌ ${msg}`)
}
const readJson = (p) => JSON.parse(readFileSync(join(ROOT, p), 'utf-8'))

/** 必须只有一个实现的库（键 = 包名，值 = 允许的主版本）。 */
const SINGLETONS = {
  zod: 4,
}

/** 根 + 所有 packages/* 里声明了该依赖的 workspace。 */
function declaringWorkspaces(dep) {
  const list = [{ dir: '.', rel: 'package.json' }]
  for (const entry of readdirSync(join(ROOT, 'packages'), { withFileTypes: true })) {
    if (!entry.isDirectory()) continue
    const rel = `packages/${entry.name}/package.json`
    if (existsSync(join(ROOT, rel))) list.push({ dir: `packages/${entry.name}`, rel })
  }
  return list.filter(({ rel }) => {
    const pkg = readJson(rel)
    return Boolean(pkg.dependencies?.[dep] ?? pkg.devDependencies?.[dep])
  })
}

/** `^4.4.3` / `~4.4.3` / `4.4.3` / `>=4 <5` 的下界主版本；拿不到就返回 null。 */
function declaredMajor(range) {
  const m = /(\d+)/.exec(String(range ?? ''))
  return m ? Number(m[1]) : null
}

function installedMajor(version) {
  return Number(String(version).split('.')[0])
}

// ── 判据 1：lockfile 里只有一个大版本 ────────────────────────────────
function checkLockfile(dep) {
  const lockPath = join(ROOT, 'package-lock.json')
  if (!existsSync(lockPath)) {
    fail('缺少 package-lock.json —— 无法断言依赖树只有一份实现')
    return
  }
  const lock = JSON.parse(readFileSync(lockPath, 'utf-8'))
  const copies = Object.entries(lock.packages ?? {})
    .filter(([key]) => key === `node_modules/${dep}` || key.endsWith(`/node_modules/${dep}`))
    .map(([key, meta]) => ({ key, version: meta.version }))
  if (copies.length === 0) {
    fail(`package-lock.json 里没有 ${dep} —— 已声明的依赖却没有装上`)
    return
  }
  const majors = new Set(copies.map((c) => installedMajor(c.version)))
  if (majors.size > 1) {
    fail(
      `package-lock.json 里有 ${copies.length} 份 ${dep}，跨 ${majors.size} 个大版本：` +
        copies.map((c) => `${c.key}@${c.version}`).join('、') +
        ` —— 每个大版本都是一个独立实现（${dep} 的对象不能跨副本混用）。`,
    )
    return
  }
  const only = copies[0]
  const expected = SINGLETONS[dep]
  if (expected != null && installedMajor(only.version) !== expected) {
    fail(`${dep} 装的是 ${only.version}，本仓约定主版本 ${expected}.x`)
    return
  }
  console.log(`✅ ${dep} 在 lockfile 里只有一份（${only.version}，${only.key}）`)
}

// ── 判据 2 / 3：每个使用者解析到同一个 realpath，且声明范围对得上 ────────
function checkResolution(dep) {
  const workspaces = declaringWorkspaces(dep)
  if (workspaces.length === 0) {
    fail(`没有任何 workspace 声明 ${dep} —— 断言失去意义，检查清单是否过期`)
    return
  }
  const resolved = []
  for (const { dir, rel } of workspaces) {
    const require = createRequire(join(ROOT, rel))
    let pkgPath
    try {
      pkgPath = require.resolve(`${dep}/package.json`)
    } catch {
      fail(`${rel} 声明了 ${dep} 却解析不到 —— 依赖没装（先跑 npm install）`)
      continue
    }
    const version = JSON.parse(readFileSync(pkgPath, 'utf-8')).version
    resolved.push({ rel, pkgPath: realpathSync(pkgPath), version })
  }
  if (resolved.length !== workspaces.length) return

  const distinct = new Map(resolved.map((r) => [r.pkgPath, r]))
  if (distinct.size > 1) {
    fail(
      `不同 workspace 的 ${dep} 解析到不同副本（${distinct.size} 份）：` +
        resolved.map((r) => `${r.rel} → ${r.pkgPath}@${r.version}`).join('；') +
        ' —— 同一进程里混用两份会让 instanceof / issue 词汇 / 类型身份全部失配。',
    )
    return
  }

  const installed = installedMajor(resolved[0].version)
  const mismatched = workspaces
    .map(({ rel }) => {
      const pkg = readJson(rel)
      return { rel, range: pkg.dependencies?.[dep] ?? pkg.devDependencies?.[dep] }
    })
    .filter(({ range }) => declaredMajor(range) !== installed)
  for (const { rel, range } of mismatched) {
    fail(
      `${rel} 声明 ${dep}: "${range}"，但实际解析到 ${resolved[0].version} ` +
        '—— 声明与安装分叉，下次 npm install 就会装出第二份。',
    )
  }
  if (mismatched.length === 0) {
    console.log(
      `✅ ${workspaces.length} 个 workspace 都解析到同一份 ${dep}（${resolved[0].version}），` +
        '声明范围的下界主版本一致',
    )
  }
}

for (const dep of Object.keys(SINGLETONS)) {
  checkLockfile(dep)
  checkResolution(dep)
}

if (failed) {
  console.error('\n依赖树出现了多份实现或声明分叉。')
  process.exit(1)
}
