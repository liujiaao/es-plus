/**
 * 产物信封 —— `es-plus.artifact@1`（P5）。
 *
 * ## 为什么需要信封
 *
 * 在 P5 之前，生成物只有一个**文本**形态：summary + 告警 + 代码围栏 + 前置清单。
 * 宿主 / eval / 后续组合层只能靠正则从文本里捞代码，既不知道「这份产物属于哪个
 * 场景、哪种 artifact、哪个 target」，也无法判断「拿到的两份东西是不是同一份」。
 * 信封把这些身份信息显式化：
 *
 *   - `contract`：协议版本。宿主可以先看版本再决定怎么解析；
 *   - `scene` / `artifact` / `target` / `mode`：身份四元组，与 `registry.ts` /
 *     `runtime.ts` 同一套枚举；
 *   - `files`：逐文件的 `{ path, code, language }`，不再需要宿主切围栏；
 *   - `config`：真正喂给生成器的那份结构化配置（片段场景是解析后的意图）；
 *   - `warnings`：与文本里的告警同源；
 *   - `fingerprint`：对以上全部字段的**内容指纹**，用于去重 / 缓存 / 比对。
 *
 * ## 指纹不是安全哈希
 *
 * 不引 `node:crypto`：shared 要能在浏览器侧被 import（文档站的内联预览也用它）。
 * 这里用 FNV-1a 双种子拼成 16 位十六进制 —— 对「同一份产物是否变化」足够，
 * **不要**用于防篡改或安全边界。指纹覆盖 `files` 的代码与路径、`config`、告警，
 * 排序键后序列化，因此对象键序不影响结果。
 *
 * ## 不改变入口字节
 *
 * 信封是 `emitScene` 结果的**附加视图**（`emitSceneArtifact`），文本仍由同一条
 * 路径生成；`check:scene-parity`（279 条语料逐字节）与
 * `check-artifact-envelope`（`emitScene` 文本 === `emitSceneArtifact` 文本）共同守住。
 */

import type { TargetFramework } from '../target.js'
import { ARTIFACT_KINDS, type ArtifactKind, type SceneId, type SceneMode } from './registry.js'

/** 协议版本。任何破坏兼容的字段改动都必须换版本号。 */
export const ARTIFACT_CONTRACT_VERSION = 'es-plus.artifact@1' as const

/** 信封里的一个产物文件。`language` 与 `path` 的扩展名必须自洽（守卫断言）。 */
export interface ArtifactFile {
  path: string
  code: string
  language: 'vue' | 'typescript' | 'javascript' | 'tsx' | 'jsx'
}

/**
 * 信封的**未盖章**部分 —— 由发射层按真实产物填写。
 *
 * 单独拆出来是为了让 `buildArtifactEnvelope` 成为唯一的盖章点：调用方不能自己
 * 拼 `contract` / `fingerprint`，否则协议版本会散落成字面量。
 */
export interface ArtifactDraft {
  scene: SceneId
  artifact: ArtifactKind
  target: TargetFramework
  mode: SceneMode | null
  files: readonly ArtifactFile[]
  /** 生成这份产物所用的结构化配置 / 意图。 */
  config: unknown
  warnings: readonly string[]
}

export interface ArtifactEnvelope extends ArtifactDraft {
  contract: typeof ARTIFACT_CONTRACT_VERSION
  fingerprint: string
}

/**
 * 规范化 JSON：对象键排序、丢弃 `undefined`、函数以固定标记代替。
 *
 * 不直接用 `JSON.stringify` 是因为它保留插入顺序 —— 同一份 config 经过不同路径
 * （zod 解析 / 手工构造）会得到不同字符串，指纹就失去「同一份内容」的含义。
 */
function canonical(value: unknown, seen: Set<object>): string {
  if (value === undefined) return 'null'
  if (value === null) return 'null'
  const t = typeof value
  if (t === 'function') return '"[[function]]"'
  if (t === 'number') return Number.isFinite(value as number) ? String(value) : 'null'
  if (t === 'bigint') return JSON.stringify(String(value))
  if (t !== 'object') return JSON.stringify(value)
  const obj = value as object
  if (seen.has(obj)) return '"[[circular]]"'
  seen.add(obj)
  try {
    if (Array.isArray(obj)) return '[' + obj.map((v) => canonical(v, seen)).join(',') + ']'
    const record = obj as Record<string, unknown>
    const keys = Object.keys(record)
      .filter((k) => record[k] !== undefined)
      .sort()
    return '{' + keys.map((k) => JSON.stringify(k) + ':' + canonical(record[k], seen)).join(',') + '}'
  } finally {
    seen.delete(obj)
  }
}

/** FNV-1a 32 位。用 `Math.imul` 保证与平台无关。 */
function fnv1a(text: string, seed: number): number {
  let hash = seed >>> 0
  for (let i = 0; i < text.length; i++) {
    hash ^= text.charCodeAt(i)
    hash = Math.imul(hash, 0x01000193) >>> 0
  }
  return hash >>> 0
}

/**
 * 内容指纹（16 位十六进制）。见文件头：不是安全哈希。
 *
 * `contract` 是协议名 + 版本；其余字段由调用方给（产物信封 / 组合信封各一套）。
 * 键排序后序列化，因此对象键序不影响结果。
 */
export function fingerprintPayload(contract: string, payload: Readonly<Record<string, unknown>>): string {
  const text = canonical({ contract, ...payload }, new Set())
  const a = fnv1a(text, 0x811c9dc5)
  const b = fnv1a(text, 0x9e3779b9)
  return a.toString(16).padStart(8, '0') + b.toString(16).padStart(8, '0')
}

/** 产物信封的指纹 —— 与 `fingerprintPayload` 同一实现，只是固定了字段集。 */
export function fingerprintArtifact(draft: ArtifactDraft): string {
  return fingerprintPayload(ARTIFACT_CONTRACT_VERSION, {
    scene: draft.scene,
    artifact: draft.artifact,
    target: draft.target,
    mode: draft.mode,
    files: draft.files.map((f) => ({ path: f.path, code: f.code, language: f.language })),
    config: draft.config,
    warnings: draft.warnings,
  })
}

function assertDraft(draft: ArtifactDraft): void {
  if (!ARTIFACT_KINDS.includes(draft.artifact)) {
    throw new Error(`产物信封：未知 artifact 形态 "${String(draft.artifact)}"`)
  }
  if (!Array.isArray(draft.files) || draft.files.length === 0) {
    throw new Error(`产物信封：${draft.scene} 的产物没有任何文件（files 不能为空）`)
  }
  const paths = new Set<string>()
  for (const file of draft.files) {
    if (!file.path) throw new Error(`产物信封：${draft.scene} 有文件缺少 path`)
    if (paths.has(file.path)) throw new Error(`产物信封：${draft.scene} 出现重复文件路径 "${file.path}"`)
    paths.add(file.path)
  }
}

/** 给草稿盖章 —— 唯一允许产生 `contract` / `fingerprint` 的入口。 */
export function buildArtifactEnvelope(draft: ArtifactDraft): ArtifactEnvelope {
  assertDraft(draft)
  return Object.freeze({
    contract: ARTIFACT_CONTRACT_VERSION,
    scene: draft.scene,
    artifact: draft.artifact,
    target: draft.target,
    mode: draft.mode,
    files: Object.freeze(draft.files.map((f) => Object.freeze({ ...f }))),
    config: draft.config,
    warnings: Object.freeze([...draft.warnings]),
    fingerprint: fingerprintArtifact(draft),
  })
}
