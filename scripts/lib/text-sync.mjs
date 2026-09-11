/**
 * 单源同步脚本的共享文本工具。
 *
 * 背景：scripts/sync-*.mjs 以「单源与各站点副本逐字节一致」作为漂移门禁。
 * 但行尾符是 **git 检出的产物**，不是文件内容的一部分：仓库 blob 里存的是 LF，
 * 在 Windows 上（core.autocrlf=true）会被检出成 CRLF，而由同步脚本写入的副本是 LF。
 * 同一个文件、同样的内容，却因行尾符不同被判为「漂移」—— 门禁只在 Linux CI 上为真，
 * 在 Windows 本机恒为红，于是被整体搁置。
 *
 * 因此：**比较时忽略行尾符差异**，判定的是「内容」而非「检出方式」。
 *
 * 注意这里刻意**不**在写回时归一化行尾 —— 写入保持单源原样（`readText` 的结果），
 * 这样 `sync` 对已经同步的文件是真正的 no-op，不会因为跑一次 sync 就把一批文件
 * 的行尾符翻掉。行尾是否统一属于版本控制层面的决策（.gitattributes），
 * 不该由同步脚本顺手改变。
 */
import { readFileSync } from 'node:fs'

/** 将 CRLF 与孤立 CR 统一为 LF（仅用于比较） */
export function normalizeEol(text) {
  return text.replace(/\r\n?/g, '\n')
}

/** 按 UTF-8 原样读取文本文件（不改变行尾符；文件缺失时同 readFileSync 一样抛错） */
export function readText(path) {
  return readFileSync(path, 'utf-8')
}

/**
 * 比较两段文本内容是否一致，忽略行尾符差异。
 * `null` 表示「文件不存在」，只有两边都是 null 才算一致。
 */
export function sameText(a, b) {
  if (a === null || b === null) return a === b
  return normalizeEol(a) === normalizeEol(b)
}
