#!/usr/bin/env node
/**
 * vite 站点的统一构建入口（es-pc 在用；es-plus-docs 遇到同类问题可以直接换过来）。
 *
 * 为什么不是直接 `vite build`：腾讯云 EdgeOne 的构建容器把 RLIMIT_NOFILE 压得
 * 很低，而 vite 解析依赖时会并发读大量 package.json，于是构建在 1582 个模块之后
 * 以 `EMFILE: too many open files`（读 node_modules/vue/package.json）失败 ——
 * 本地 Windows 完全复现不了，只发生在云构建里。
 *
 * 这里在 POSIX 上先尽力把软上限抬到硬上限允许的最大值，再 `exec` 同一个 node
 * 跑 vite 的 CLI（rlimit 随 exec 继承）。抬不动（硬上限本身就很低）就保持原样
 * 继续 —— 不阻断本来能过的构建，只是把失败留在 vite 那边。
 * Windows 没有 ulimit，直接跑。
 *
 * 用法：`node ../scripts/build-vite.mjs [vite build 的额外参数]`，cwd 必须是站点目录。
 */
import { spawnSync } from 'node:child_process'
import { existsSync } from 'node:fs'
import { join } from 'node:path'

const cwd = process.cwd()
const viteBin = join(cwd, 'node_modules', 'vite', 'bin', 'vite.js')
if (!existsSync(viteBin)) {
  console.error(`✗ 找不到 vite：${viteBin}（先在站点目录 npm ci）`)
  process.exit(1)
}

// `$0` 是 node 本体，`$@` 是 vite CLI + 透传参数：脚本自己只负责抬上限与报数
const POSIX_SCRIPT = [
  'for n in 65535 16384 4096 1024; do ulimit -n "$n" 2>/dev/null && break; done',
  'echo "[build-vite] RLIMIT_NOFILE=$(ulimit -n)"',
  'exec "$0" "$@"',
].join('\n')

const args = [viteBin, 'build', ...process.argv.slice(2)]
const res =
  process.platform === 'win32'
    ? spawnSync(process.execPath, args, { stdio: 'inherit' })
    : spawnSync('sh', ['-c', POSIX_SCRIPT, process.execPath, ...args], { stdio: 'inherit' })

if (res.error) {
  console.error(`✗ 启动 vite 失败：${res.error.message}`)
  process.exit(1)
}
process.exit(res.status ?? 1)
