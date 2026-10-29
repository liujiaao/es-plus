#!/usr/bin/env node
/**
 * 预测落盘原语自测（meta-eval，无需 API key，进 CI 的 check:consistency）。
 *
 * ## 为什么值得单测
 *
 * dump 是**所有离线复算的唯一证据源**。它若静默丢行、静默截断或哈希不稳，
 * 复算出来的数字会"看起来正常"却是错的 —— 而这类错误没有任何其它信号能发现
 * （跑批本身是绿的）。故这里钉死：
 *
 *   1) `stableStringify` 与对象键序无关，但保留数组顺序；
 *   2) `goldHashOf` 对键序稳定、对内容敏感（语料改了哈希必须变）；
 *   3) 无路径时是 **no-op**（不能抛、不能写文件）；
 *   4) 有路径时**截断旧文件**（两次跑批的 dump 不能混算）；
 *   5) 写-读往返保真，半行 JSON（进程被杀）被跳过并计数，而不是让整份 dump 报废。
 *
 * 用法：node scripts/eval/dump.test.mjs
 * 退出码：0 = 原语行为全部成立；1 = 至少一条失效。
 */
import { mkdtempSync, readFileSync, appendFileSync, rmSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { createDumpWriter, goldHashOf, readDump, stableStringify } from './dump.mjs'

let failures = 0
function check(cond, msg) {
  if (cond) return
  failures++
  console.error(`  ✗ ${msg}`)
}
const eq = (a, b, msg) => check(a === b, `${msg}（期望 ${JSON.stringify(b)}，实得 ${JSON.stringify(a)}）`)
const ne = (a, b, msg) => check(a !== b, `${msg}（两边都是 ${JSON.stringify(a)}）`)

// ── 1. 稳定序列化 ────────────────────────────────────────────────────────────
{
  const a = { b: 1, a: { d: [3, 2], c: 'x' } }
  const b = { a: { c: 'x', d: [3, 2] }, b: 1 }
  eq(stableStringify(a), stableStringify(b), '键序不同的同一对象必须序列化相同')
  eq(stableStringify([2, 1]), '[2,1]', '数组顺序必须保留（不能排序）')
  ne(stableStringify([1, 2]), stableStringify([2, 1]), '数组顺序不同必须序列化不同')
  eq(stableStringify(null), 'null', 'null 直通')
  eq(stableStringify('中'), '"中"', '字符串按 JSON 规则转义')
}

// ── 2. 语料哈希 ──────────────────────────────────────────────────────────────
{
  const g1 = { fields: [{ prop: 'a', label: '甲' }, { prop: 'b', label: '乙' }], actions: ['add'] }
  const g2 = { actions: ['add'], fields: [{ label: '甲', prop: 'a' }, { prop: 'b', label: '乙' }] }
  eq(goldHashOf(g1), goldHashOf(g2), '键序不同但内容相同：哈希必须一致')
  const g3 = { fields: [{ prop: 'a', label: '甲甲' }, { prop: 'b', label: '乙' }], actions: ['add'] }
  ne(goldHashOf(g1), goldHashOf(g3), '内容变了：哈希必须变')
  check(/^[0-9a-f]{16}$/.test(goldHashOf(g1)), '哈希是 16 位十六进制（发布用短哈希）')
}

// ── 3/4/5. 写入器 ────────────────────────────────────────────────────────────
const dir = mkdtempSync(join(tmpdir(), 'esplus-dump-'))
try {
  // 无路径 → no-op，且绝不创建文件。
  const noop = createDumpWriter(null)
  eq(noop.enabled, false, '无路径：enabled = false')
  noop.write({ kind: 'meta' })
  noop.close()

  const p = join(dir, 'pred.jsonl')
  const w1 = createDumpWriter(p)
  eq(w1.enabled, true, '有路径：enabled = true')
  w1.write({ kind: 'meta', schemaVersion: 1, rulerVersion: 'prop-identity-v1' })
  w1.write({ kind: 'crud', file: 'a', turn0: { fields: [] } })
  w1.write({ kind: 'crud', file: 'b', turn0: null, error: 'boom', errorKind: 'model-failure' })

  // 进程被杀留下的半行：必须跳过并计数，不能让整份 dump 报废。
  appendFileSync(p, '{"kind":"crud","file":"half"\n')

  const r1 = readDump(p)
  eq(r1.meta?.rulerVersion, 'prop-identity-v1', 'meta 首行可读回')
  eq(r1.rows.length, 2, '两行有效记录')
  eq(r1.skipped, 1, '半行 JSON 被跳过并计数')
  eq(r1.rows[1].errorKind, 'model-failure', '错误行原样保留（复算要能重建分母）')
  check(r1.rows[1].turn0 === null, '错误行 turn0 = null 保真')

  // 第二次开同一个路径必须截断：两次跑批的行混在一起会被复算成一次。
  const w2 = createDumpWriter(p)
  w2.write({ kind: 'meta', schemaVersion: 1, rulerVersion: 'label-identity-v1' })
  w2.write({ kind: 'crud', file: 'c', turn0: { fields: [] } })
  const text = readFileSync(p, 'utf8')
  eq(text.trim().split('\n').length, 2, '重开路径必须截断旧 dump')
  const r2 = readDump(p)
  eq(r2.rows.length, 1, '截断后只剩本次跑批的行')
  eq(r2.meta?.rulerVersion, 'label-identity-v1', 'meta 跟随本次跑批')

  // ── 6. 同一行写两次（行级重放）⟹ 后写的覆盖先写的，且**只算一行** ─────────────
  // 若按「出现几次算几行」，重放过的行会在分母里被算两次：一次没测到（0 分）+ 一次测到了，
  // 于是一次基础设施抖动被记成半次模型失败 —— 复算与产物必然对不上。
  const p3 = join(dir, 'replay.jsonl')
  const w3 = createDumpWriter(p3)
  w3.write({ kind: 'meta', schemaVersion: 1, rulerVersion: 'label-identity-v1' })
  w3.write({ kind: 'crud', file: 'd', lang: 'zh', turn0: null, error: 'Connection error.', errorKind: null })
  w3.write({ kind: 'crud', file: 'e', lang: 'zh', turn0: { fields: [] }, error: null })
  // 重放：没测到的 d 又跑了一遍并成功
  w3.write({ kind: 'crud', file: 'd', lang: 'zh', turn0: { fields: [{ prop: 'x' }] }, error: null, replay: true })
  const r3 = readDump(p3)
  eq(r3.rows.length, 2, '重放的行不得使分母变大（同一 (kind,file,lang) 只算一行）')
  eq(r3.superseded, 1, '被覆盖的行要计数（产物/日志能说明「这一行重放过」）')
  const d = r3.rows.find((x) => x.file === 'd')
  eq(d.error, null, '后写覆盖先写：读到的必须是重放成功的那一版')
  eq(r3.rows[1].file, 'd', '覆盖后仍保持它实际出现的位置（保序）')
  // 不同语言是不同行（zh / en 各一份，不能互相覆盖）
  w3.write({ kind: 'crud', file: 'd', lang: 'en', turn0: { fields: [] }, error: null })
  eq(readDump(p3).rows.length, 3, '同一语料的 zh / en 是两行，键必须含 lang')
} finally {
  rmSync(dir, { recursive: true, force: true })
}

if (failures > 0) {
  console.error(`\ndump 原语自测失败：${failures} 条`)
  process.exit(1)
}
console.log('✅ 预测落盘原语自测通过（稳定序列化 / 语料哈希 / no-op / 截断 / 半行容错）')
