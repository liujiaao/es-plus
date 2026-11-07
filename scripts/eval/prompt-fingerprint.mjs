/**
 * 已发布准确率对应的**模型输入指纹**。
 *
 * ## 为什么需要指纹
 *
 * `last-accuracy.json` 已经自证了「哪次提交、哪份语料、哪把尺子」（见 `artifact.mjs`），
 * 但漏了最重要的一件：**模型当时看到的 system prompt 是哪一版**。
 *
 * 于是 prompt 一改（教法、few-shot、工具描述、PRD 契约），旧数字仍然挂在徽章上，
 * 看起来像「当前 prompt 的成绩」——它其实来自另一版 prompt。语料变更已经由
 * `corpusHash` 抓住；prompt 变更此前完全无声。
 *
 * ## 指纹覆盖什么
 *
 * 只覆盖**每次跑批恒定的模型输入**：
 *   · `crud`       —— `buildNlToConfigSystemPrompt()`（含 few-shot）；
 *   · `prd`        —— `generate_scene` 的 name/description/shape + 发布契约；
 *   · `fragments`  —— table / form / dialog 三个工具各自渲染出的 system prompt
 *                     （工具 description 与 shape 自省都在里面）。
 *
 * 逐条语料变化的内容（NL、given、fixedFields）**不进**指纹：它们由 `corpusHash`
 * 与身份块的 `fixedFieldsUsed` 负责，混进来会让指纹随跑批子集抖动。
 *
 * ## 为什么是截断的 sha256
 *
 * 与 `corpusFingerprint` 同一口径（16 位十六进制）。它的问题不是抗碰撞，而是
 * 「同输入必同、变一个字节必不同」；16 位（64 bit）对这类漂移检测绰绰有余，
 * 且产物可读。
 *
 * 本模块是**纯函数**（无 fs / 无 esbuild / 无 shared 导入），因为 `artifact.mjs`
 * 会被大量守卫 import —— 指纹的真实文本由 `prompt-sources.mjs` 采集，采集侧
 * 才允许引入 `@es-plus/shared` 与片段工具打包。
 */
import { createHash } from 'node:crypto'
import { FRAGMENT_SCENE_TOOLS } from './fragment-prompt.mjs'

export const PROMPT_FINGERPRINT_VERSION = 1

const HEX16 = /^[0-9a-f]{16}$/
const sha16 = (text) => createHash('sha256').update(text, 'utf8').digest('hex').slice(0, 16)

/**
 * 从**模型实际收到的文本**算指纹。
 *
 * @param {{crud: string, prd: string, fragments: Record<string, string>}} prompts
 */
export function fingerprintPrompts({ crud, prd, fragments }) {
  if (typeof crud !== 'string' || !crud) throw new Error('promptFingerprint: crud system prompt 为空')
  if (typeof prd !== 'string' || !prd) throw new Error('promptFingerprint: prd system prompt 为空')
  const frag = {}
  for (const scene of Object.keys(FRAGMENT_SCENE_TOOLS)) {
    const text = fragments?.[scene]
    if (typeof text !== 'string' || !text) {
      throw new Error(`promptFingerprint: 缺少片段场景 "${scene}" 的 system prompt`)
    }
    frag[scene] = sha16(text)
  }
  return { version: PROMPT_FINGERPRINT_VERSION, crud: sha16(crud), prd: sha16(prd), fragments: frag }
}

/** 结构校验（不含「是否与当前源码一致」——那是 freshness 的职责）。 */
export function isPromptFingerprint(value) {
  if (!value || typeof value !== 'object') return false
  if (value.version !== PROMPT_FINGERPRINT_VERSION) return false
  if (!HEX16.test(value.crud) || !HEX16.test(value.prd)) return false
  const frag = value.fragments
  if (!frag || typeof frag !== 'object') return false
  return Object.keys(FRAGMENT_SCENE_TOOLS).every((scene) => HEX16.test(frag[scene]))
}

/**
 * 逐项差异（只用于诊断消息；两项指纹相等时返回空数组）。
 * 刻意不 `JSON.stringify` 整体比较：键顺序不该让「同一份指纹」判成不同。
 */
export function diffPromptFingerprint(recorded, current) {
  if (!isPromptFingerprint(recorded) || !isPromptFingerprint(current)) {
    return ['指纹结构非法']
  }
  const diffs = []
  const name = (v) => `${v.slice(0, 8)}…`
  if (recorded.crud !== current.crud) diffs.push(`crud ${name(recorded.crud)} → ${name(current.crud)}`)
  if (recorded.prd !== current.prd) diffs.push(`prd ${name(recorded.prd)} → ${name(current.prd)}`)
  for (const scene of Object.keys(FRAGMENT_SCENE_TOOLS)) {
    if (recorded.fragments[scene] !== current.fragments[scene]) {
      diffs.push(`${scene} ${name(recorded.fragments[scene])} → ${name(current.fragments[scene])}`)
    }
  }
  return diffs
}

export const promptFingerprintEqual = (a, b) => diffPromptFingerprint(a, b).length === 0
