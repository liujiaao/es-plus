/**
 * CLI 纯字符串/参数工具（可单测，复用于多个命令）
 *
 * 抽取动机：toPascalCase 原先在 scaffold.ts 与 create.ts 各复制一份；target 归一化
 * 三段三元表达式散落在 create/scaffold 命令里。收敛到此处消除重复，并让单测直接覆盖
 * 发货实现（而非命令闭包内的副本）。
 */

import { isAbsolute, relative } from 'node:path'

export type CliTarget = 'vue3' | 'vue2' | 'antdv'

/** 受支持的三端目标（顺序即 --help / 报错提示里的展示顺序）。 */
export const CLI_TARGETS: readonly CliTarget[] = ['vue3', 'vue2', 'antdv'] as const

/**
 * 校验 --target 是否为受支持值。undefined（未传）视为合法（命令层会默认 vue3）。
 * 命令应在 normalizeTarget 之前调用它，对显式的未知 target 报错退出，而不是
 * 让 normalizeTarget 静默回落 vue3（B5：把用户明确的不支持请求无声降级为 vue3）。
 */
export function isValidTarget(input: string | undefined): boolean {
  return input === undefined || (CLI_TARGETS as readonly string[]).includes(input)
}

/** kebab/snake → PascalCase（如 user-management → UserManagement）。 */
export function toPascalCase(str: string): string {
  return str
    .replace(/(^|[-_])([a-z])/g, (_, __, letter) => letter.toUpperCase())
    .replace(/[-_]/g, '')
}

/** camel/Pascal → kebab-case（如 UserManagement → user-management）。 */
export function toKebabCase(str: string): string {
  return str.replace(/([a-z])([A-Z])/g, '$1-$2').toLowerCase()
}

/**
 * 归一化 --target 输入到受支持的三端之一，默认 vue3。
 * 仅 'vue2' / 'antdv' 精确匹配；其余（含 undefined / 拼写错误）一律回落 vue3。
 */
export function normalizeTarget(input: string | undefined): CliTarget {
  return input === 'vue2' ? 'vue2' : input === 'antdv' ? 'antdv' : 'vue3'
}

/** 三端目标框架 → 对应 npm 包名（生成的 import 语句用）。 */
export function esPlusPkgFor(target: CliTarget): string {
  return target === 'vue2'
    ? '@es-plus/vue2'
    : target === 'antdv'
      ? '@es-plus/adapter-antdv'
      : '@es-plus/vue3'
}

/**
 * 判断一个「由页面名派生的文件/目录基名」是否安全。
 *
 * 只拒绝与路径穿越相关的形态：路径分隔符、`.` / `..`、Windows 盘符前缀。
 * 不限制中文等其余字符 —— LLM 可能产出中文页面名，那是合法的（非穿越）文件名。
 *
 * 背景：`name` 此前只约束 `min(1)`，`toPascalCase` 也不剥离分隔符，
 * 于是 `--from-config` 载入不可信配置时可通过 `name: "../../evil"` 把文件写出输出目录。
 */
export function isSafePathSegment(segment: string): boolean {
  if (!segment) return false
  if (segment === '.' || segment === '..') return false
  if (/[\\/]/.test(segment)) return false
  if (/^[A-Za-z]:/.test(segment)) return false
  return true
}

/**
 * 兜底校验：`target` 解析后必须位于 `baseDir` 之内。
 * 用于拼出文件路径后再核一次，任何形式的逃逸都会返回 false。
 */
export function isPathInside(baseDir: string, target: string): boolean {
  const rel = relative(baseDir, target)
  return rel !== '' && !rel.startsWith('..') && !isAbsolute(rel)
}
