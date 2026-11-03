#!/usr/bin/env node
/**
 * 生成场景分类法（eval 侧适配层）。
 *
 * 单一真源已迁到 `packages/shared/src/scene/registry.ts`（`@es-plus/shared/scene`）：
 * 场景、产物、模式轴、工具映射、评测腿都在那里定义。本文件只保留 **eval 语料形状**
 * 相关的两个纯函数（`cellOf` / `cellName`），并把注册表常量原样 re-export，避免
 * `check-scene-coverage`、`fragment-cases`、`check-threeway` 等消费者改 import。
 *
 * 为什么需要 `cellOf`：语料的 target/mode 位置按场景不同 ——
 *   - 片段场景：`target` 在**用例顶层**（片段输入本身不含 target）；
 *   - CRUD 场景：`target`/`mode` 在 `config` 内（schema 有默认值，解析后恒有值）；
 *   - dialog：`mode` 是**产物形态**（composable/component），缺省 composable；
 *   - table/form：无模式轴，`MODELESS`。
 *
 * 关键约定保持不变：
 * 1. `scene` 缺省即 `'crud'`（216 条既有用例一个字节都不用改）。
 * 2. `mode` 轴按场景分域；真实矩阵是 crud 3 端 × 2 模式、dialog 3 端 × 2 形态、
 *    table|form 3 端 × 1 —— 计划语「四场景 × 三端 × 两模式」的算术不成立。
 * 3. `MODELESS` 用 `null` 表示「该场景没有这条轴」，与「这一格缺语料」区分开。
 *
 * 注意：本文件从 `@es-plus/shared/scene` 读注册表，执行前需 `npm run build:libs`
 * （仓库既有约定；eval/guards 本就读取 shared build）。
 */

import {
  DEFAULT_SCENE,
  SCENES,
  SCENE_TOOL,
  MODES,
  DIALOG_MODES,
  MODELESS,
  modesOf,
  artifactFamilyOf,
  isScene,
  sceneOf,
} from '@es-plus/shared/scene'

export {
  DEFAULT_SCENE,
  SCENES,
  SCENE_TOOL,
  MODES,
  DIALOG_MODES,
  MODELESS,
  modesOf,
  artifactFamilyOf,
  isScene,
  sceneOf,
}

/** 该用例是否走 CRUD 配置路径（`config` 是 StructuredCrudConfig）。 */
export function isCrudCase(caseObj) {
  return sceneOf(caseObj) === DEFAULT_SCENE
}

/**
 * 一条用例在「场景 × 端 × 模式」矩阵里的格坐标。
 * - 片段场景：`target` 在**用例顶层**（片段输入本身不含 target）。
 * - CRUD 场景：`target`/`mode` 在 `config` 内（schema 有默认值，故解析后恒有值）。
 *   调用方若传的是**未经 Zod 解析**的 raw config，这里落到与 schema 一致的默认值
 *   （vue3 / schema）。
 * - dialog 场景：`mode` 是**产物形态**（composable/component，在 `config` 内，
 *   缺省 `composable` —— 与工具 zod 的 `.default('composable')` 一致）。
 * - table/form：`MODELESS`。
 */
export function cellOf(caseObj) {
  const scene = sceneOf(caseObj)
  const config = caseObj?.config || {}
  const target = scene === DEFAULT_SCENE ? config.target || 'vue3' : caseObj?.target
  const mode =
    scene === DEFAULT_SCENE
      ? config.mode || 'schema'
      : scene === 'dialog'
        ? config.mode || 'composable'
        : MODELESS
  return { scene, target, mode }
}

/** 矩阵格的可读名字，报错与统计输出共用。 */
export function cellName({ scene, target, mode }) {
  return `${scene} × ${target ?? '(无 target)'}${mode ? ` × ${mode}` : ''}`
}
