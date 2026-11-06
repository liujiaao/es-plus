/**
 * 产物运行时契约 —— 片段「挂上页面之后能做什么」的单一真源。
 *
 * ## 为什么必须与 registry 分开
 *
 * `registry.ts` 回答「这个场景产出什么形态」，本文件回答「这个形态的产物向宿主
 * 暴露什么」。两者混在一张表里会让「场景元数据」被迫依赖生成器实现细节
 * （`scene/index.ts` 之所以能只导出元数据、不加载生成器，就是因为有这个边界）。
 *
 * ## 契约不是文档，是**被见证**的断言
 *
 * 每一条都必须在生成器产物里真的出现（`scripts/check-artifact-runtime.mjs` 静态断言），
 * 并在三端运行时真的可用（Tier-1 vitest / Tier-2 Playwright 见证）。声明了却永不触发
 * 的通道 = 承诺了不存在的能力 —— 这正是本仓 F5a（删除 es-form 的 confirm/reset）
 * 与 AI-43（弹窗默认插槽被静默丢弃）反复咬出的那类缺陷。
 *
 * ## 四类组合接线都建立在这张表上
 *
 *   1. `table` 的 `row-action` → 宿主 `dialog.open(title, row)`
 *   2. `form` 的 `submit`（校验通过才发）→ 宿主保存
 *   3. `form` 的 `query` → 宿主 `table.refresh(model)`
 *   4. `dialog` 的 `open(..., onSuccess)` → 宿主在 `onSuccess` 里 `table.refresh()`
 *
 * 注意：这些都是**片段包装层**（generator 产出的自包含 SFC）的面，不是底层
 * `es-form` / `es-table` / `es-dialog` 组件的面。底层组件的能力由各自的
 * `defineExpose` / `defineEmits` 决定；包装层只做「宿主真正需要的那一小块」。
 */

import type { ArtifactKind } from './registry.js'

/** 「提交成功」的通知通道类型：事件（片段自派发）/ 回调（open 的第三参）/ 无。 */
export type SuccessKind = 'event' | 'callback' | 'none'

export interface ArtifactSuccessContract {
  kind: SuccessKind
  /** `kind !== 'none'` 时的通道名；`none` 时省略。 */
  name?: string
}

export interface ArtifactRuntimeContract {
  /**
   * 宿主通过模板 ref（vue3/antdv `defineExpose`、vue2 setup return）可拿到的一切：
   * 方法**和数据**。`form.model` 是 reactive 数据，不是可调用方法。
   */
  expose: readonly string[]
  /**
   * `expose` 里**可被当方法调用**的子集（P11 复核）。
   *
   * 为什么要单独一行：组合页的显式接线会把它拼成 `ref.value?.<channel>()`。若只按
   * `expose` 校验，`to: { node: 'filter', channel: 'model' }` 会生成
   * `filterRef.value?.model?.()` —— 编译得过、运行即 TypeError（调用一个对象）。
   * `expose` 回答「宿主能拿到什么」，`invokable` 回答「接线能调用什么」，两者不可
   * 互相替代。不变式（`check-artifact-runtime` 断言）：`invokable ⊆ expose`。
   */
  invokable: readonly string[]
  /** 片段组件向宿主派发的事件（三端同一套名字）。 */
  emits: readonly string[]
  /** 提交成功通道。 */
  success: ArtifactSuccessContract
}

/**
 * 五种 artifact 的运行时契约。
 *
 * `crud-page` 刻意是空契约：整页的能力由 `CrudPageSchema` 声明（表格/表单/弹窗的
 * 行为都已编码进 schema），生成物不向宿主二次暴露片段式方法。空数组不是遗漏，
 * 而是「这个形态没有片段级运行时面」的显式表达。
 */
export const ARTIFACT_RUNTIME: Readonly<Record<ArtifactKind, ArtifactRuntimeContract>> = Object.freeze({
  'crud-page': Object.freeze({
    expose: Object.freeze([]),
    invokable: Object.freeze([]),
    emits: Object.freeze([]),
    success: Object.freeze({ kind: 'none' }),
  }),
  table: Object.freeze({
    // es-table 已有的命令式刷新面（vue3/antdv defineExpose、vue2 setup return）。
    expose: Object.freeze(['refresh', 'reload']),
    invokable: Object.freeze(['refresh', 'reload']),
    // 行操作按钮的唯一可用通道：库内是 `clickEvent(row)`，片段把它翻译成语义事件。
    // 旧产物的 `triggerEvent: true` 没有任何消费者（死按钮），P4 起删除。
    emits: Object.freeze(['row-action']),
    success: Object.freeze({ kind: 'none' }),
  }),
  form: Object.freeze({
    // 包装层把内部 es-form 的 validate/resetFields 透出，并暴露 reactive model。
    // `model` 是数据（`invokable` 里刻意没有它）。
    expose: Object.freeze(['model', 'validate', 'resetFields']),
    invokable: Object.freeze(['validate', 'resetFields']),
    // save → submit（校验通过后才发）；query → query；rest → reset。
    emits: Object.freeze(['submit', 'query', 'reset']),
    success: Object.freeze({ kind: 'event', name: 'submit' }),
  }),
  'dialog-composable': Object.freeze({
    expose: Object.freeze(['open']),
    invokable: Object.freeze(['open']),
    emits: Object.freeze([]),
    success: Object.freeze({ kind: 'callback', name: 'onSuccess' }),
  }),
  'dialog-component': Object.freeze({
    expose: Object.freeze(['open', 'close']),
    invokable: Object.freeze(['open', 'close']),
    emits: Object.freeze([]),
    success: Object.freeze({ kind: 'callback', name: 'onSuccess' }),
  }),
})

export function runtimeOf(kind: ArtifactKind): ArtifactRuntimeContract {
  const contract = ARTIFACT_RUNTIME[kind]
  if (!contract) throw new Error(`未知 artifact 形态：${kind}`)
  return contract
}
