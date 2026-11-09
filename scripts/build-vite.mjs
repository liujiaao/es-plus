#!/usr/bin/env node
/**
 * vite 站点的统一构建入口（es-pc 在用；es-plus-docs 遇到同类问题可以直接换过来）。
 *
 * 为什么不是直接 `vite build`：腾讯云 EdgeOne 的构建容器把 RLIMIT_NOFILE 压得
 * 很低（实测硬上限 1024，抬不动），而 vite 解析依赖时会读大量 package.json，
 * 于是构建以 `EMFILE: too many open files`（读 node_modules/vue/package.json）失败
 * —— 本地 Windows 完全复现不了，只发生在云构建里。
 *
 * 这里做两件事：
 *   1. POSIX 上先尽力把软上限抬到硬上限允许的最大值（rlimit 随 exec 继承），
 *      抬不动就保持原样继续 —— 不阻断本来能过的构建；
 *   2. Linux 上留一个只握几个 fd 的父进程采样子进程的 /proc/<pid>/fd，失败或
 *      峰值偏高时把「fd 都指向什么」打进日志 —— 光看报错定位不到占用者。
 * Windows 没有 ulimit，直接跑 vite，行为与改动前一致。
 *
 * 用法：`node ../scripts/build-vite.mjs [vite build 的额外参数]`，cwd 必须是站点目录。
 */
import { spawn, spawnSync } from 'node:child_process'
import { existsSync, readdirSync, readlinkSync } from 'node:fs'
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
  'echo "[build-vite] RLIMIT_NOFILE=$(ulimit -n)（硬上限 $(ulimit -Hn)）"',
  'exec "$0" "$@"',
].join('\n')

const args = [viteBin, 'build', ...process.argv.slice(2)]

if (process.platform === 'win32') {
  const res = spawnSync(process.execPath, args, { stdio: 'inherit' })
  if (res.error) {
    console.error(`✗ 启动 vite 失败：${res.error.message}`)
    process.exit(1)
  }
  process.exit(res.status ?? 1)
}

// Linux：不 exec，留一个只握着几个 fd 的父进程去采样子进程的 /proc/<pid>/fd。
// EMFILE 只发生在云构建里，光看「谁报了错」定位不到占用者 —— 把峰值时的 fd
// 去向打出来，才知道是并发峰值、继承来的 fd，还是真漏了。
const canSample = process.platform === 'linux' && existsSync('/proc/self/fd')
if (!canSample) {
  const res = spawnSync('sh', ['-c', POSIX_SCRIPT, process.execPath, ...args], { stdio: 'inherit' })
  if (res.error) {
    console.error(`✗ 启动 vite 失败：${res.error.message}`)
    process.exit(1)
  }
  process.exit(res.status ?? 1)
}

const child = spawn('sh', ['-c', POSIX_SCRIPT, process.execPath, ...args], { stdio: 'inherit' })
const fdDir = `/proc/${child.pid}/fd`
let peak = 0
let baseline = -1
let sample = []
let lastSample = 0

/** 峰值附近每秒采一次「fd 指向什么」，按目标聚合（node_modules 里的去掉前缀便于阅读） */
function takeSample() {
  let fds
  try {
    fds = readdirSync(fdDir)
  } catch {
    return
  }
  if (baseline < 0) baseline = fds.length
  if (fds.length > peak) peak = fds.length
  const now = Date.now()
  if (now - lastSample < 1000 || fds.length < 64) return
  lastSample = now
  const hist = new Map()
  for (const fd of fds) {
    let target
    try {
      target = readlinkSync(`${fdDir}/${fd}`)
    } catch {
      continue
    }
    const key = target.replace(/^.*\/node_modules\//, 'node_modules/')
    hist.set(key, (hist.get(key) || 0) + 1)
  }
  sample = [...hist.entries()].sort((a, b) => b[1] - a[1]).slice(0, 8)
}

const timer = setInterval(takeSample, 200)
timer.unref()

child.on('exit', (code, signal) => {
  clearInterval(timer)
  takeSample()
  if (code !== 0 || peak > 512) {
    console.error(`[build-vite] 子进程 fd：起始 ${baseline}，峰值 ${peak}`)
    for (const [target, n] of sample) console.error(`[build-vite]   ${n} × ${target}`)
  }
  process.exit(code ?? (signal ? 1 : 0))
})

