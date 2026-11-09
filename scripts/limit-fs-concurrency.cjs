// 限制「同时在途的文件读取」数量（构建期 preload，用 NODE_OPTIONS=--require 注入）。
//
// 为什么需要：Vite 的 `vite:load-fallback` 读源码用的是 `fsp.readFile`（异步），
// 而 rollup 的模块加载会对每个 import 扇出并发 —— 没有任何并发上限。于是「同时
// 挂着的 fd 数 ≈ 在途读取数」，模块一多就是几百上千个 fd。本地 Windows 的上限很高
// 所以从没暴露；腾讯云构建容器硬上限 1024，构建就在 400~600 个模块处
// `EMFILE: too many open files`（vite 解析 node_modules/vue/package.json 时触发）。
//
// 这里只包装协程友好的异步 API（promises.readFile / promises.open），用一个小队列
// 把并发压到 ES_BUILD_FS_CONCURRENCY（默认 32）。readFile 不会递归调用自己，
// 所以不会把名额占死。同步 API 不包装：它们本来就是一次一个，不存在并发峰值。
//
// 观测：退出前打印峰值并发（一行，`[fs-limit] 峰值并发读取 32（限制 32）`）；
// ES_BUILD_FS_CONCURRENCY=0 表示只观测不限制（排查用）。
const fs = require('fs')

const raw = Number(process.env.ES_BUILD_FS_CONCURRENCY)
const LIMIT = Number.isFinite(raw) && raw >= 0 ? raw : 32
const limited = LIMIT > 0
const limit = limited ? LIMIT : Infinity

let active = 0
let peak = 0
const queue = []

function acquire() {
  if (active < limit) {
    active += 1
    if (active > peak) peak = active
    return null
  }
  return new Promise((resolve) => queue.push(resolve))
}

function release() {
  const next = queue.shift()
  if (next) next()
  else active -= 1
}

/** 把「打开一个 fd 完成读取」的异步 API 包一层名额 */
function throttle(fn) {
  return async function (...args) {
    const wait = acquire()
    if (wait) await wait
    try {
      return await fn.apply(this, args)
    } finally {
      release()
    }
  }
}

const p = fs.promises
if (typeof p.readFile === 'function') p.readFile = throttle(p.readFile)
if (typeof p.open === 'function') p.open = throttle(p.open)

process.on('exit', () => {
  console.error(`[fs-limit] 峰值并发读取 ${peak}（限制 ${limited ? LIMIT : '无'}）`)
})
