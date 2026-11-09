#!/usr/bin/env node
/**
 * vite 站点的统一构建入口（es-pc 在用；es-plus-docs 遇到同类问题可以直接换过来）。
 *
 * 为什么不是直接 `vite build`：腾讯云 EdgeOne 的构建容器把 RLIMIT_NOFILE 压到
 * 硬上限 1024，而 vite 的 `vite:load-fallback` 用 `fsp.readFile` 异步读源码、
 * rollup 的模块加载对每个 import 扇出并发且没有上限 —— 实测**峰值 1001 个在途
 * 读取**（= 1001 个 fd），于是构建在第 400~600 个模块处
 * `EMFILE: too many open files`。本地 Windows 上限高，永远不会暴露。
 *
 * 这里做三件事：
 *   1. 用 `-r` 预加载 scripts/limit-fs-concurrency.cjs，把在途读取压到 32
 *      （实测峰值 1001 → 32，构建耗时 16.25s → 16.59s）；
 *   2. POSIX 上尽力抬高软上限（硬上限常常就是 1024，抬不动也不阻断）；
 *   3. Linux 上关掉构建器继承来的普通文件 fd，并采样子进程 /proc/<pid>/fd，
 *      失败时把 fd 去向打进日志，方便下次定位。
 * Windows 没有 ulimit，其余行为一致。
 *
 * 用法：`node ../scripts/build-vite.mjs [vite build 的额外参数]`，cwd 必须是站点目录。
 */
import { spawn, spawnSync } from 'node:child_process'
import { existsSync, closeSync, readdirSync, readlinkSync } from 'node:fs'
import { dirname, join } from 'node:path'
import { fileURLToPath } from 'node:url'

const here = dirname(fileURLToPath(import.meta.url))
const cwd = process.cwd()
const viteBin = join(cwd, 'node_modules', 'vite', 'bin', 'vite.js')
if (!existsSync(viteBin)) {
  console.error(`✗ 找不到 vite：${viteBin}（先在站点目录 npm ci）`)
  process.exit(1)
}

/**
 * 压住「同时在途的文件读取」。这条才是 EMFILE 的真因：实测不加限制时构建的
 * 峰值并发读取是 **1001**（本地 Windows 上限高，没暴露过），而云构建容器硬上限
 * 1024 —— 第 400~600 个模块就顶穿了。限到 32 后峰值就是 32，构建耗时无变化
 * （16.25s → 16.59s）。详见 scripts/limit-fs-concurrency.cjs 的头注。
 */
const preload = ['-r', join(here, 'limit-fs-concurrency.cjs')]

// `$0` 是 node 本体，`$@` 是 vite CLI + 透传参数：脚本自己只负责抬上限与报数
const POSIX_SCRIPT = [
  'for n in 65535 16384 4096 1024; do ulimit -n "$n" 2>/dev/null && break; done',
  'echo "[build-vite] RLIMIT_NOFILE=$(ulimit -n)（硬上限 $(ulimit -Hn)）"',
  'exec "$0" "$@"',
].join('\n')

const args = [...preload, viteBin, 'build', ...process.argv.slice(2)]

if (process.platform === 'win32') {
  const res = spawnSync(process.execPath, args, { stdio: 'inherit' })
  if (res.error) {
    console.error(`✗ 启动 vite 失败：${res.error.message}`)
    process.exit(1)
  }
  process.exit(res.status ?? 1)
}

// Linux：先把构建器继承进来的普通文件 fd 关掉，再留一个只握几个 fd 的父进程
// 采样子进程的 /proc/<pid>/fd。EMFILE 只发生在云构建里，光看「谁报了错」定位不到
// 占用者 —— 起始值 / 峰值 / 峰值时 fd 的去向，才能判断是继承、并发峰值还是真漏了。
const canSample = process.platform === 'linux' && existsSync('/proc/self/fd')

/**
 * 关掉从父进程继承来的「普通文件」fd（指向真实路径的那些）。
 *
 * 为什么需要：云端 EMFILE 出现得很早（452 个模块）且两次位置不同 —— 像是进程
 * 一启动就已经被上千个继承来的 fd 顶到上限，而不是构建自己开的。管道 / socket /
 * anon_inode 一律不动（可能是构建器给我们接的日志与状态通道），stdio 更不会碰。
 */
function closeInheritedFileFds() {
  if (!canSample) return 0
  let names
  try {
    names = readdirSync('/proc/self/fd')
  } catch {
    return 0
  }
  const before = names.length
  let closed = 0
  for (const name of names) {
    const fd = Number(name)
    if (!Number.isInteger(fd) || fd <= 2) continue
    let target
    try {
      target = readlinkSync(`/proc/self/fd/${name}`)
    } catch {
      continue
    }
    if (!target.startsWith('/')) continue // pipe:[…] / socket:[…] / anon_inode:[…]
    if (target === '/dev/null' || target.startsWith('/dev/tty')) continue
    try {
      closeSync(fd)
      closed += 1
    } catch {
      /* 关不掉就留着，不影响构建 */
    }
  }
  if (closed) {
    console.error(`[build-vite] 起始 fd ${before}，其中 ${closed} 个是继承来的普通文件，已关闭`)
  }
  return closed
}

closeInheritedFileFds()

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

