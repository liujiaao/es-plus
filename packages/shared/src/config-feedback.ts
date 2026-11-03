import type { ValidationResult } from './schema-validator.js'

/**
 * 生成前/生成后的**确定性反馈文案** —— 只做格式化，不判模型、不产代码。
 *
 * 为什么下沉到 shared：`generate_crud` 与场景路由器 `generate_scene` 必须对同一份
 * config 给出**逐字节相同**的告警/错误正文（P2 的验收是 279 条语料字节等价）。
 * 两份各写一版文案，哪怕只差一个空格，字节等价就失效，且宿主 LLM 会看到两种
 * 「同一校验、不同说法」的错误。
 *
 * 与 `validate-and-repair.ts` 的分工：那边判**合法性**（errors/suggestions），
 * 这边只把结果渲染成宿主可读的文本；告警函数则在 config 已合法后，补充
 * 「能生成但很可能不是用户想要」的语义提示。
 */

/**
 * Cheap post-parse semantic invariants. These never block generation (the
 * config is already schema-valid); they surface as non-blocking warnings so
 * the host LLM can self-correct on the next turn if the mapping looks off.
 */
export function buildSemanticWarnings(config: any): string[] {
  const warnings: string[] = []
  const fields: any[] = Array.isArray(config.fields) ? config.fields : []
  const topProps = new Set(fields.map((f) => f.prop))

  // Add/edit requested but no field is form-visible → the form would be empty.
  const mutating = (config.actions ?? []).some((a: string) => a === 'add' || a === 'edit')
  if (mutating && fields.length > 0 && fields.every((f) => f.inForm === false)) {
    warnings.push(
      'actions include add/edit but every field has inForm:false — the add/edit form will be empty. Set inForm:true on the fields users should fill.',
    )
  }

  // dialogs.formItems referencing props absent from the top-level field set.
  const dialogs = config.dialogs ?? {}
  for (const [dialogId, dlg] of Object.entries<any>(dialogs)) {
    // An add/edit dialog with no form items renders an empty modal body — the
    // generator silently emits a dialog with nothing to fill (see the
    // `if (dlg.formItems)` guard in structured-generator). Surface it so the
    // host LLM either supplies formItems or drops the dialog. Skip when
    // hasCustomRender:true — the modal body is a bespoke render, not an empty
    // form, so "no formItems" is expected and the warning would be noise.
    const isMutatingDialog = dialogId === 'add' || dialogId === 'edit'
    const formItems = Array.isArray(dlg?.formItems) ? dlg.formItems : []
    if (isMutatingDialog && formItems.length === 0 && !dlg?.hasCustomRender) {
      warnings.push(
        `dialog "${dialogId}" is an add/edit dialog but has no formItems — the modal body will be empty. Add formItems (usually the mutable subset of fields) so users have inputs to fill.`,
      )
    }
    for (const fi of formItems) {
      if (fi?.prop && !topProps.has(fi.prop)) {
        warnings.push(
          `dialog "${dialogId}" form item "${fi.prop}" is not in the top-level fields — confirm this is intentional (it won't map to a table column).`,
        )
      }
    }
  }

  // Select/Cascader with neither static nor remote options.
  for (const f of fields) {
    const needsOptions = f.formtype === 'Select' || f.formtype === 'Cascader'
    const hasOptions =
      (Array.isArray(f.dataOptions) && f.dataOptions.length > 0) || !!f.apiParams
    if (needsOptions && !hasOptions) {
      warnings.push(
        `field "${f.prop}" is a ${f.formtype} but has no dataOptions or apiParams — it will render an empty dropdown. Provide dataOptions (fixed enum) or apiParams (remote source).`,
      )
    }
  }

  return warnings
}

/**
 * 把一次校验失败渲染成前门的结构化错误正文（C2·A3）。
 *
 * 与 `validate_config` 工具的错误块同形（`  - {error}` + `Suggestions:` +
 * `  → {s}`），让宿主 LLM 两条路径看到的失败格式一致。关键点：**什么都没生成** ——
 * 非法 config 到不了用户面前，而不是像过去那样被 `assertValidConfig` 抛成一句
 * 泛化 `Error generating code: …`。
 */
export function formatValidationError(result: ValidationResult): string {
  return [
    '✗ Config failed structured-config validation — nothing was generated:\n',
    ...result.errors.map((e) => `  - ${e}`),
    '',
    result.suggestions.length > 0 ? 'Suggestions:' : '',
    ...result.suggestions.map((s) => `  → ${s}`),
    '',
    'Fix these and call again.',
  ]
    .filter(Boolean)
    .join('\n')
}
