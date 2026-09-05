/**
 * CLI 纯字符串/参数工具（可单测，复用于多个命令）
 *
 * 抽取动机：toPascalCase 原先在 scaffold.ts 与 create.ts 各复制一份；target 归一化
 * 三段三元表达式散落在 create/scaffold 命令里。收敛到此处消除重复，并让单测直接覆盖
 * 发货实现（而非命令闭包内的副本）。
 */

export type CliTarget = 'vue3' | 'vue2' | 'antdv'

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
