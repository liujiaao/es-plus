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
 *   - vue：两份 Vue 会让 `instanceof` 与 `provide/inject` 失效。但本仓是 Vue 2 +
 *     Vue 3 并存的多包仓库 —— 不同**主版本**必须并存（`@es-plus/vue2` 交付 2.x，
 *     `vue3`/`adapter-antdv` 交付 3.x），把它塞进 `SINGLETONS` 只会恒红。真正的缺陷
 *     是**同一个主版本内部**出现两份（例如 adapter 自己拉了一份 3.4 而 vue3 用 3.5）：
 *     那时 `instanceof` 同样失效，却没有任何守卫看得见。见下方 `MULTIVERSION`。
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
 * `MULTIVERSION` 里的库把 1/2 改成「每个**允许的主版本**各自只有一份」，判据 3 则
 * 逐 workspace 比对其声明的主版本 —— 跨主版本并存是设计，同主版本分叉是缺陷。
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

/**
 * 刻意允许**跨主版本**并存的库（同主版本仍必须只有一份实现）。
 *
 * `majors` 是白名单兼预期集合：少一个大版本（渲染器被移除/依赖掉了）或多出一个
 * 未登记的大版本都会红 —— 两种都意味着需要人重新确认，而不是让守卫自己猜。
 * 每个 workspace 的声明主版本还必须与它实际解析到的大版本一致（判据 3 的多版本版），
 * 所以「vue2 包声明 ^3」这类抄错也会红。
 */
const MULTIVERSION = {
  vue: {
    majors: [2, 3],
    why: '本仓同时交付 Vue 2（@es-plus/vue2）与 Vue 3（vue3 / adapter-antdv）',
  },
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
    // peer 也要算：只声明 peer 的包同样会在运行时拿到那个库的实例（例如 vue2 的
    // peer 是 `^2.6.14 || ^2.7.0`，dev 里还有一份 —— 只要解析到别处就分叉）。
    return Boolean(
      pkg.dependencies?.[dep] ?? pkg.devDependencies?.[dep] ?? pkg.peerDependencies?.[dep]
    )
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

/** lockfile 里该依赖的**所有**副本（hoist 到根的 + 各包下嵌套的）。 */
function lockfileCopies(dep) {
  const lockPath = join(ROOT, 'package-lock.json')
  if (!existsSync(lockPath)) return null
  const lock = JSON.parse(readFileSync(lockPath, 'utf-8'))
  return Object.entries(lock.packages ?? {})
    .filter(([key]) => key === `node_modules/${dep}` || key.endsWith(`/node_modules/${dep}`))
    .map(([key, meta]) => ({ key, version: meta.version }))
}

// ── 判据 1：lockfile 里只有一个大版本 ────────────────────────────────
function checkLockfile(dep) {
  const copies = lockfileCopies(dep)
  if (copies === null) {
    fail('缺少 package-lock.json —— 无法断言依赖树只有一份实现')
    return
  }
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

// ── 多版本库：每个**允许的主版本**各自只有一份实现 ─────────────────────
function checkMultiVersion(dep, spec) {
  const allowed = new Set(spec.majors)
  let ok = true
  const problems = []
  const failMulti = (msg) => {
    ok = false
    problems.push(msg)
  }

  // 判据 1'：lockfile 里每个允许的主版本**恰好一个副本**。
  // 同一主版本装两份（哪怕 patch 相同）也是两个模块实例，`instanceof` 照样失效。
  const copies = lockfileCopies(dep)
  if (copies === null) {
    failMulti('缺少 package-lock.json —— 无法断言依赖树只有一份实现')
  } else if (copies.length === 0) {
    failMulti(`package-lock.json 里没有 ${dep} —— 已声明的依赖却没有装上`)
  } else {
    const present = new Set(copies.map((c) => installedMajor(c.version)))
    const unexpected = [...present].filter((m) => !allowed.has(m))
    const missing = spec.majors.filter((m) => !present.has(m))
    if (unexpected.length) {
      failMulti(
        `${dep} 出现未登记的主版本 ${unexpected.join('/')}（lockfile：` +
          copies.map((c) => `${c.key}@${c.version}`).join('、') +
          `）—— 允许的是 ${spec.majors.join('/')}：${spec.why}。` +
          '若这是有意新增的渲染器，请同步 MULTIVERSION。'
      )
    }
    if (missing.length) {
      failMulti(
        `${dep} 缺少预期的主版本 ${missing.join('/')}（lockfile：` +
          copies.map((c) => `${c.key}@${c.version}`).join('、') +
          `）—— ${spec.why}。若该渲染器确已移除，请同步 MULTIVERSION。`
      )
    }
    for (const major of spec.majors) {
      const list = copies.filter((c) => installedMajor(c.version) === major)
      if (list.length > 1) {
        failMulti(
          `${dep} 主版本 ${major}.x 在 lockfile 里有 ${list.length} 份：` +
            list.map((c) => `${c.key}@${c.version}`).join('、') +
            ' —— 同一主版本的两份副本仍是两个实现（instanceof / inject 失效）。'
        )
      }
    }
  }

  // 判据 2' / 3'：每个使用者解析到的**大版本与自己声明的一致**，且同一大版本内
  // 所有使用者解析到**同一个 realpath**。
  const workspaces = declaringWorkspaces(dep)
  if (workspaces.length === 0) {
    failMulti(`没有任何 workspace 声明 ${dep} —— 断言失去意义，检查清单是否过期`)
  } else {
    const byMajor = new Map()
    for (const { rel } of workspaces) {
      const pkg = readJson(rel)
      const range = pkg.dependencies?.[dep] ?? pkg.devDependencies?.[dep] ?? pkg.peerDependencies?.[dep]
      const declared = declaredMajor(range)
      const require = createRequire(join(ROOT, rel))
      let pkgPath
      try {
        pkgPath = require.resolve(`${dep}/package.json`)
      } catch {
        failMulti(`${rel} 声明了 ${dep} 却解析不到 —— 依赖没装（先跑 npm install）`)
        continue
      }
      const version = JSON.parse(readFileSync(pkgPath, 'utf-8')).version
      const installed = installedMajor(version)
      if (declared === null) {
        failMulti(`${rel} 的 ${dep} 声明范围 ${JSON.stringify(range)} 解析不出主版本`)
        continue
      }
      if (!allowed.has(declared)) {
        failMulti(
          `${rel} 声明 ${dep}: "${range}"（主版本 ${declared}）不在允许集合 ${spec.majors.join('/')} ` +
            `—— ${spec.why}。声明写错了主版本？`
        )
        continue
      }
      if (declared !== installed) {
        failMulti(
          `${rel} 声明 ${dep}: "${range}"，但解析到 ${version} — ` +
            '声明与安装分叉，下次 npm install 就会装出另一份。'
        )
        continue
      }
      const list = byMajor.get(installed) ?? []
      list.push({ rel, pkgPath: realpathSync(pkgPath), version })
      byMajor.set(installed, list)
    }
    for (const [major, list] of byMajor) {
      const distinct = new Set(list.map((r) => r.pkgPath))
      if (distinct.size > 1) {
        failMulti(
          `${dep} 主版本 ${major}.x 出现 ${distinct.size} 份实现：` +
            list.map((r) => `${r.rel} → ${r.pkgPath}@${r.version}`).join('；') +
            ' —— 同主版本多副本同样会让 instanceof / provide-inject 失配。'
        )
      }
    }
    if (ok) {
      const summary = [...byMajor.entries()]
        .sort(([a], [b]) => a - b)
        .map(([major, list]) => `${major}.x → ${list[0].version}`)
        .join(' / ')
      console.log(
        `✅ ${dep} 的 ${spec.majors.join('/')} 各自只有一份实现（${summary}；${workspaces.length} 个 workspace）`
      )
    }
  }

  for (const p of problems) fail(p)
}

for (const dep of Object.keys(SINGLETONS)) {
  checkLockfile(dep)
  checkResolution(dep)
}
for (const [dep, spec] of Object.entries(MULTIVERSION)) {
  checkMultiVersion(dep, spec)
}

if (failed) {
  console.error('\n依赖树出现了多份实现或声明分叉。')
  process.exit(1)
}
