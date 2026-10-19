#!/usr/bin/env node
/**
 * 「入口 vs schema」可达性守卫（AI-24）
 *
 * 背景：es-plus 的 AI 生成有三个入口，**表达力不等** ——
 *   - `generate_crud_from_config`：完整 typed config（能到 schema 的一切）；
 *   - `generate_crud`（前门）：只填一张 surfaces 意图表 + 若干标量键；
 *   - fragments（generate_form/table/dialog）：精简 surfaceFieldSchema，SFC-only。
 *
 * 历史上「往 FieldConfig 加字段却不加进 SurfaceField」「schema 顶层新增键、前门没暴露」
 * 这两类缺口**不影响任何现有守卫**：check-fragment-contract 只对齐 SurfaceField↔zod3 镜像，
 * check-contract-consumption 只量渲染器对 core 契约的消费 —— **「入口 vs schema」这条轴
 * 结构上无守卫**。后果：新能力对前门**静默不可达**（LLM 以为能填、前门收不到、生成物里没有），
 * 与「mark, never drop」直接冲突。
 *
 * 本守卫把这条轴钉死，三向断言：
 *   1. `SurfaceField` ⊆ `FieldConfig` —— 前门/片段字段词汇必须是权威 FieldConfig 的子集。
 *      往 SurfaceField 加一个 FieldConfig 不认的键 → 该键会被前门 Zod 静默剥掉（假承诺）。
 *   2. `crudShape` 顶层键 ⊆ schema 顶层键 ∪ `FRONT_DOOR_ONLY` —— 前门暴露的键 schema 必须认识
 *      （例外＝前门独有键，登记并写明原因）。
 *   3. `schema 顶层键 \ crudShape 顶层键` === `FRONT_DOOR_UNREACHABLE` —— schema 里前门**够不到**
 *      的键必须**显式登记**（每键写明原因）。往 schema 加一个顶层能力，既不暴露到前门、
 *      也不登记 → 红（这正是 AI-21/22 的缺口长期隐形的原因）。
 *   4. `FieldConfig 键 \ SurfaceField 键` === `SURFACE_FIELD_UNREACHABLE` —— 权威**字段级**词汇里
 *      入口够不到的键同样必须登记（同上，只是发生在字段级：AI-22 给 FieldConfig 加了 labelKey
 *      却没提进 SurfaceField，前门/片段仍表达不了，此前**无任何守卫可见**）。
 *  5. **Wave 4 泛化**：三个独立场景工具（`tableShape` / `formShape` / `dialogShape`）的顶层键
 *     ⊆ schema 顶层键 ∪ `FRAGMENT_TOOL_ONLY`。此前守卫只切 `crudShape`，片段工具是**另一组
 *     工具形状**——给它们加一个 schema 不认识的键 = 新开一条无守卫入口。本断言把「所有生成
 *     工具形状」纳入守望（`readReachability` 已从「单个 crudShape」泛化为「遍历
 *     `FRAGMENT_TOOL_SRC`」）。
 *  6. **容器级镜像全等**：片段工具的嵌套词汇必须与权威 schema 的同名块**逐键相等**
 *     （`tableOptions` 26 键 / `formLayout` 2 键 / `pagination` 2 键）。子集不够——子集允许
 *     「权威加了键、片段悄悄收窄」，而 `z.object` 无 passthrough ⇒ 静默 strip。
 *  7. `validate_config` 必须认识三种片段配置类型，且从三个工具模块**直接复用**同一份 Zod
 *     形状（否则校验判据与工具判据会分叉出第三份字段清单）。
 *
 * 断言 1 与 4 是一对：1 防「SurfaceField 里有 FieldConfig 不认的键」（假承诺），
 * 4 防「FieldConfig 有 SurfaceField 够不到的键」（静默不可达）。合起来 = 入口词汇与权威
 * 字段词汇在「可达」维度上等价。
 *
 * `FRONT_DOOR_UNREACHABLE` 是**可收缩的**：AI-21①②④ / AI-23 每让前门多到一个键，就删掉对应一行。
 * （AI-21① 已落地：tableOptions/formLayout/operationColumn/tableBtns/toolbarBtns 五行已移除。
 *   AI-21② 已落地：expandConfig/treeConfig 两行已移除。
 *   AI-21④ 已落地：`dialogs` 的**合成能力**放宽（罐头键 → 全参对象），但 schema 无同名顶层
 *   入参、前门仍由 `surfaces.dialog` 合成，故该行保留、仅更新原因。
 *   AI-23 已落地：顶层 `mergeConfig`（声明式合并单元格）**直接进前门**（crudShape + 转发），
 *   故从未出现在本表 —— 新增即已可达。）
 *
 * 与 check-fragment-contract.mjs 的分工：那条守卫管 `SurfaceField`↔zod3 镜像**双向相等**
 * （手写副本漂移）；本条管「入口词汇 ⊆ 权威词汇」「前门顶层键 vs schema 顶层键」的**可达性**。
 *
 * 用法：node scripts/check-entry-contract.mjs
 * 退出码：0 = 一致；1 = 发现漂移。
 *
 * 注：解析原语（stripComments/sliceBlock/topLevelKeys）、三个注册表与源路径常量已抽出到
 * `scripts/lib/entry-keys.mjs`，与 `check-feature-coverage.mjs`（AI-25）共享单一真源。
 */
import {
  fail,
  read,
  readReachability,
  FRONT_DOOR_ONLY,
  FRONT_DOOR_UNREACHABLE,
  SURFACE_FIELD_UNREACHABLE,
  FRAGMENT_TOOL_ONLY,
  FRAGMENT_TOOL_SRC,
} from './lib/entry-keys.mjs'

/** `validate_config` 的片段配置类型 → 工具源文件（AI-40：三类型必须各自接线）。 */
const FRAGMENT_VALIDATE_TYPES = {
  'es-table-config': 'generate-table.ts',
  'es-form-config': 'generate-form.ts',
  'es-dialog-config': 'generate-dialog.ts',
}
const VALIDATE_CONFIG_SRC = 'packages/mcp-server/src/tools/validate-config.ts'

const diffKeys = (a, b) => {  const bs = new Set(b)
  const as = new Set(a)
  return {
    onlyA: a.filter((k) => !bs.has(k)),
    onlyB: b.filter((k) => !as.has(k)),
  }
}

function main() {
  let ok = true

  // ── 解析四处：前门 crudShape / schema 顶层 / SurfaceField / FieldConfig ──
  const reach = readReachability()
  if (reach === null) process.exit(1)

  const { frontKeys, schemaKeys, sfKeys, fcKeys } = reach

  if (sfKeys.length === 0 || fcKeys.length === 0 || frontKeys.length === 0 || schemaKeys.length === 0) {
    fail('解析出的键集为空（选择器可能已失效）—— 拒绝静默放行')
    process.exit(1)
  }

  const frontSet = new Set(frontKeys)
  const schemaSet = new Set(schemaKeys)
  const fcSet = new Set(fcKeys)

  // ── 1. SurfaceField ⊆ FieldConfig ──
  const sfOrphans = sfKeys.filter((k) => !fcSet.has(k))
  if (sfOrphans.length) {
    ok = fail(
      `SurfaceField 含 FieldConfig 不认的键：${sfOrphans.join(', ')}` +
        '（会被前门 Zod 静默剥掉 —— LLM 以为填了、生成物里没有，违反「mark, never drop」）'
    )
  }

  // ── 2. crudShape 顶层键 ⊆ schema 顶层键 ∪ FRONT_DOOR_ONLY ──
  const frontOrphans = frontKeys.filter((k) => !schemaSet.has(k) && !(k in FRONT_DOOR_ONLY))
  if (frontOrphans.length) {
    ok = fail(
      `crudShape 暴露了 schema 不认识的顶层键：${frontOrphans.join(', ')}` +
        '（若非笔误，应登记进 FRONT_DOOR_ONLY 并写明原因）'
    )
  }

  // ── 3. schema 顶层键 \ crudShape 顶层键 === FRONT_DOOR_UNREACHABLE ──
  const unreachable = schemaKeys.filter((k) => !frontSet.has(k))
  const registered = Object.keys(FRONT_DOOR_UNREACHABLE)
  const unregistered = unreachable.filter((k) => !(k in FRONT_DOOR_UNREACHABLE))
  if (unregistered.length) {
    ok = fail(
      `schema 顶层新增了前门够不到、又未登记的键：${unregistered.join(', ')}` +
        '（要么在前门暴露它，要么登记进 FRONT_DOOR_UNREACHABLE 并写明原因）'
    )
  }
  // 反向：登记表不得有陈旧项（该键已被前门暴露 或 已不在 schema 里）。
  const stale = registered.filter((k) => !schemaSet.has(k) || frontSet.has(k))
  if (stale.length) {
    ok = fail(
      `FRONT_DOOR_UNREACHABLE 存在陈旧登记：${stale.join(', ')}` +
        '（该键已被前门暴露或已不在 schema 顶层 —— 请从登记表移除）'
    )
  }
  // 登记项原因非空强制（空串占位会红）。
  for (const [k, reason] of Object.entries(FRONT_DOOR_UNREACHABLE)) {
    if (!reason || !reason.trim()) {
      ok = fail(`FRONT_DOOR_UNREACHABLE['${k}'] 未写明原因`)
    }
  }

  // ── 4. FieldConfig 键 \ SurfaceField 键 === SURFACE_FIELD_UNREACHABLE ──
  const sfUnreachable = fcKeys.filter((k) => !sfKeys.includes(k))
  const sfUnregistered = sfUnreachable.filter((k) => !(k in SURFACE_FIELD_UNREACHABLE))
  if (sfUnregistered.length) {
    ok = fail(
      `FieldConfig 新增了入口词汇够不到、又未登记的字段级键：${sfUnregistered.join(', ')}` +
        '（要么提进 SurfaceField，要么登记进 SURFACE_FIELD_UNREACHABLE 并写明原因）'
    )
  }
  const sfStale = Object.keys(SURFACE_FIELD_UNREACHABLE).filter((k) => !fcSet.has(k) || sfKeys.includes(k))
  if (sfStale.length) {
    ok = fail(
      `SURFACE_FIELD_UNREACHABLE 存在陈旧登记：${sfStale.join(', ')}` +
        '（该键已提进 SurfaceField 或已不在 FieldConfig —— 请从登记表移除）'
    )
  }
  for (const [k, reason] of Object.entries(SURFACE_FIELD_UNREACHABLE)) {
    if (!reason || !reason.trim()) {
      ok = fail(`SURFACE_FIELD_UNREACHABLE['${k}'] 未写明原因`)
    }
  }

  // ── 5. 片段工具顶层形状 ⊆ schema 顶层键 ∪ FRAGMENT_TOOL_ONLY（Wave 4）──
  const {
    fragmentShapes,
    fragmentTableOptionsKeys,
    fragmentFormLayoutKeys,
    fragmentPaginationKeys,
    tableOptionsKeys,
    formLayoutKeys,
    paginationKeys,
  } = reach
  const fragmentShapeNames = Object.keys(fragmentShapes)
  if (fragmentShapeNames.length !== Object.keys(FRAGMENT_TOOL_SRC).length) {
    ok = fail(
      `片段工具形状只解析到 ${fragmentShapeNames.length} 个（应为 ${Object.keys(FRAGMENT_TOOL_SRC).length} 个）—— 拒绝静默放行`
    )
  }
  for (const [name, keys] of Object.entries(fragmentShapes)) {
    if (keys.length === 0) {
      ok = fail(`片段工具 ${name} 的顶层键集为空（选择器可能已失效）`)
      continue
    }
    const orphans = keys.filter((k) => !schemaSet.has(k) && !(k in FRAGMENT_TOOL_ONLY))
    if (orphans.length) {
      ok = fail(
        `${name}Shape 暴露了 schema 不认识的顶层键：${orphans.join(', ')}` +
          '（会被工具的 Zod 静默 strip，或生成器根本收不到 —— 要么接进 schema，要么登记进 FRAGMENT_TOOL_ONLY 并写明原因）'
      )
    }
  }
  // 反向陈旧：登记项必须仍被至少一个片段形状使用，且本身不是 schema 顶层键
  // （若已成为 schema 顶层键，片段可直接指权威词汇，登记行应删）。
  const usedByFragment = new Set(Object.values(fragmentShapes).flat())
  const fragmentOnlyStale = Object.keys(FRAGMENT_TOOL_ONLY).filter(
    (k) => !usedByFragment.has(k) || schemaSet.has(k)
  )
  if (fragmentOnlyStale.length) {
    ok = fail(
      `FRAGMENT_TOOL_ONLY 存在陈旧登记：${fragmentOnlyStale.join(', ')}` +
        '（该键已不被任何片段工具使用，或已成为 schema 顶层键 —— 请从登记表移除）'
    )
  }
  for (const [k, reason] of Object.entries(FRAGMENT_TOOL_ONLY)) {
    if (!reason || !reason.trim()) {
      ok = fail(`FRAGMENT_TOOL_ONLY['${k}'] 未写明原因`)
    }
  }

  // ── 6. 容器级镜像全等（片段嵌套词汇 ≡ 权威同名块）──
  const containerPairs = [
    ['tableOptions', fragmentTableOptionsKeys, tableOptionsKeys],
    ['formLayout', fragmentFormLayoutKeys, formLayoutKeys],
    ['pagination', fragmentPaginationKeys, paginationKeys],
  ]
  for (const [label, fragmentKeys, authKeys] of containerPairs) {
    if (!fragmentKeys || !authKeys || authKeys.length === 0) {
      ok = fail(`容器级 ${label} 键集解析失败（选择器失效）—— 拒绝静默放行`)
      continue
    }
    const { onlyA, onlyB } = diffKeys(fragmentKeys, authKeys)
    if (onlyA.length || onlyB.length) {
      ok = fail(
        `片段 ${label} 与权威 schema 的 ${label} 键集不等价：` +
          `片段多出 [${onlyA.join(', ') || '无'}]、权威多出 [${onlyB.join(', ') || '无'}]` +
          '（片段必须是权威词汇的**全等镜像**；只收子集会静默丢弃权威键）'
      )
    }
  }

  // ── 7. validate_config 三类型接线（复用工具形状，不另抄一份）──
  const validateSrc = read(VALIDATE_CONFIG_SRC)
  // 路由数组必须列全三个常量 —— 只断言「类型名出现在文件里」不够：常量声明本身
  // 就含该串，从路由数组里摘掉一个仍然全绿（实测过的假绿）。
  const routingMatch = validateSrc.match(/const FRAGMENT_CONFIG_TYPES = \[([^\]]*)\] as const/)
  if (routingMatch === null) {
    ok = fail('未能在 validate-config.ts 定位 FRAGMENT_CONFIG_TYPES 路由数组')
  } else {
    for (const constant of ['ES_TABLE_TYPE', 'ES_FORM_TYPE', 'ES_DIALOG_TYPE']) {
      if (!routingMatch[1].includes(constant)) {
        ok = fail(`validate_config 的路由数组 FRAGMENT_CONFIG_TYPES 漏了 ${constant}（该片段配置类型不会被独立校验）`)
      }
      if (!validateSrc.includes(`case ${constant}:`)) {
        ok = fail(`validate_config 的 fragmentSchemaFor 缺 case ${constant}（类型登记了却没有判据）`)
      }
    }
  }
  for (const [typeName, toolFile] of Object.entries(FRAGMENT_VALIDATE_TYPES)) {
    if (!validateSrc.includes(typeName)) {
      ok = fail(
        `validate_config 未登记片段配置类型 '${typeName}'` +
          `（Wave 4 要求 generate_table/form/dialog 的入参可被独立校验）`
      )
    }
    if (!validateSrc.includes(`from "./${toolFile.replace(/\.ts$/, '.js')}"`)) {
      ok = fail(
        `validate_config 未从 ${toolFile} 复用 Zod 形状` +
          '（另抄一份判据会与工具分叉出第三份字段清单）'
      )
    }
  }

  if (ok) {
    console.log(
      `✅ 入口 vs schema 可达性一致（SurfaceField ${sfKeys.length} ⊆ FieldConfig ${fcKeys.length}；` +
        `crudShape ${frontKeys.length} 键 ⊆ schema ${schemaKeys.length} 键 + 前门独有 ${Object.keys(FRONT_DOOR_ONLY).length}；` +
        `片段工具 ${fragmentShapeNames.join('/')} 顶层键 ⊆ schema + 片段独有 ${Object.keys(FRAGMENT_TOOL_ONLY).length}；` +
        `容器级 tableOptions ${tableOptionsKeys.length} / formLayout ${formLayoutKeys.length} / pagination ${paginationKeys.length} 键全等；` +
        `前门不可达 ${registered.length} 项 + 字段级不可达 ${Object.keys(SURFACE_FIELD_UNREACHABLE).length} 项均已登记）`
    )
    process.exit(0)
  }
  process.exit(1)
}

main()
