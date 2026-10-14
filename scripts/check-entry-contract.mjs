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
  readReachability,
  FRONT_DOOR_ONLY,
  FRONT_DOOR_UNREACHABLE,
  SURFACE_FIELD_UNREACHABLE,
} from './lib/entry-keys.mjs'

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

  if (ok) {
    console.log(
      `✅ 入口 vs schema 可达性一致（SurfaceField ${sfKeys.length} ⊆ FieldConfig ${fcKeys.length}；` +
        `crudShape ${frontKeys.length} 键 ⊆ schema ${schemaKeys.length} 键 + 前门独有 ${Object.keys(FRONT_DOOR_ONLY).length}；` +
        `前门不可达 ${registered.length} 项 + 字段级不可达 ${Object.keys(SURFACE_FIELD_UNREACHABLE).length} 项均已登记）`
    )
    process.exit(0)
  }
  process.exit(1)
}

main()
