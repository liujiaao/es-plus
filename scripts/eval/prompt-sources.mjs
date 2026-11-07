/**
 * 采集**当前源码**渲染出的模型输入文本，并算指纹（`prompt-fingerprint.mjs` 的采集侧）。
 *
 * ## 与 eval 同源
 *
 * 各条腿在 `eval-llm.mjs` 里的输入来源：
 *   · CRUD  —— `buildNlToConfigSystemPrompt()`（`@es-plus/shared` 的构建产物，与 eval 同一 import）；
 *   · 片段  —— `setupFragmentTools()` 现打包 `mcp-server/src` 捕获真实注册（与 eval 同一个 helper）；
 *   · PRD   —— `setupFrontDoor()` 捕获 `generate_scene` + 同一份发布契约（与 eval 同一个 helper）。
 *
 * 这里刻意**不**另写一套渲染：指纹若与模型实际收到的文本不同，守卫校验的就不是产物
 * 实际写下的东西（本仓库反复栽过的「双真源」坑）。
 *
 * ## 为什么独立于 `prompt-fingerprint.mjs`
 *
 * 本模块会拉起 esbuild 与 shared 构建；`artifact.mjs` / `freshness.mjs` 只 import
 * 纯函数那一半，避免每个守卫都被迫打包一次。
 */
import { buildNlToConfigSystemPrompt } from '@es-plus/shared'
import { setupFrontDoor } from './front-door-leg.mjs'
import { setupFragmentTools } from '../lib/fragment-shapes.mjs'
import { buildFragmentSystemPrompt, FRAGMENT_SCENE_TOOLS } from './fragment-prompt.mjs'
import { buildPrdSystemPrompt } from './prd-prompt.mjs'
import { fingerprintPrompts } from './prompt-fingerprint.mjs'

/** 三个片段场景的 system prompt（与 eval-llm 逐字节同源）。 */
export function fragmentPromptTexts(tools) {
  const out = {}
  for (const [scene, toolName] of Object.entries(FRAGMENT_SCENE_TOOLS)) {
    const tool = tools?.[toolName]
    if (!tool) throw new Error(`fragmentPromptTexts: 没有捕获到 ${toolName}`)
    out[scene] = buildFragmentSystemPrompt(scene, tool)
  }
  return out
}

/** PRD 腿的 system prompt（工具捕获 + 发布契约，与 eval-llm:1027 同源）。 */
export function prdPromptText(frontDoor) {
  return buildPrdSystemPrompt(
    { name: frontDoor.sceneCap.name, description: frontDoor.sceneCap.desc, shape: frontDoor.cap.shape },
    frontDoor.extractionContract
  )
}

/**
 * 当前检出上的模型输入指纹。
 *
 * 注意：CRUD 一项读 `@es-plus/shared` 的**构建产物** —— 这正是 eval-llm 喂给模型的
 * 那一份。故调用前必须 `npm run build:libs`（CI 的 consistency job 已先 build shared）。
 *
 * @returns {Promise<ReturnType<typeof fingerprintPrompts>>}
 */
export async function currentPromptFingerprint() {
  const frontDoor = await setupFrontDoor()
  if (typeof frontDoor.extractionContract !== 'string' || !frontDoor.extractionContract.trim()) {
    throw new Error('currentPromptFingerprint: 前门打包里没有发布契约（PRD system prompt 无法重建）')
  }
  const tools = await setupFragmentTools()
  return fingerprintPrompts({
    crud: buildNlToConfigSystemPrompt(),
    prd: prdPromptText(frontDoor),
    fragments: fragmentPromptTexts(tools),
  })
}
