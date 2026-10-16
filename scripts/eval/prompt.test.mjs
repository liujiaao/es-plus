#!/usr/bin/env node
/**
 * prompt 组装自测（meta-eval，无需 API key，进 CI 的 check:consistency）。
 *
 * 为什么要有这个文件：F9 修法的核心断言是「给定时明示、未给定时**逐字节不变**」。
 * 前者决定 target/mode 的 33.9% 结构性不可命中是否被消除；后者决定这不算一次
 * 对既有语料口径的静默改写。这两条都只能靠确定性断言钉住，不能靠跑真钱跑批。
 *
 * 同时钉住「给了但不照抄照旧翻红」——即在 prompt 层铺好给定，**不**动 scorer 的
 * target/mode 维度（scorers.mjs:279-280），防有人顺手把维度也改成「总是过」。
 */
import { buildInitialMessages, buildGivenLine, pushAssistant, pushUserCorrection } from './prompt.mjs'

let failures = 0
function check(cond, msg) {
  if (cond) return
  failures++
  console.error(`  ✗ ${msg}`)
}
const content = (...args) => buildInitialMessages(...args)[0].content

// ── 1) 无 given、无 fixedFields：必须与 F9 之前的 prompt **逐字节相同** ──
check(content('做一个订单列表') === '做一个订单列表', 'no-given/no-fields: content 恒等于 nl 本身')
check(buildGivenLine(undefined) === '', 'buildGivenLine(undefined) 为空串')
check(buildGivenLine(null) === '', 'buildGivenLine(null) 为空串')
check(buildGivenLine({}) === '', 'buildGivenLine({}) 为空串')
check(buildGivenLine({ target: '', mode: '' }) === '', 'buildGivenLine(空串值) 为空串')

// ── 2) 有 given：两个值都明示，且带「宿主已定、勿推断」语义 ──
const line = buildGivenLine({ target: 'vue2', mode: 'sfc' })
check(line.includes('target=vue2'), 'given 行含 target=vue2')
check(line.includes('mode=sfc'), 'given 行含 mode=sfc')
check(/do NOT infer or override/i.test(line), 'given 行含「勿推断/勿覆盖」指令')
const withGiven = content('做一个订单列表', undefined, { target: 'vue2', mode: 'sfc' })
check(withGiven.startsWith('做一个订单列表\n\n'), 'given 行追加在 NL 之后（NL 仍是首块）')
check(withGiven.includes('target=vue2') && withGiven.includes('mode=sfc'), 'given 行进入 content')
check(!withGiven.includes('Fields (given'), '无 fixedFields 时不得凭空出现 Fields 行')

// ── 3) 缺项：只给 target 时不得编造 mode（反之亦然）──
const onlyTarget = buildGivenLine({ target: 'antdv' })
check(onlyTarget.includes('target=antdv') && !onlyTarget.includes('mode='), '只给 target 时不出现 mode=')
const onlyMode = buildGivenLine({ mode: 'sfc' })
check(onlyMode.includes('mode=sfc') && !onlyMode.includes('target='), '只给 mode 时不出现 target=')

// ── 4) 与 fixedFields 共存：两块都在、顺序稳定、互不吞噬 ──
const both = content('做一个订单列表', ['orderNo', 'amount'], { target: 'vue2', mode: 'sfc' })
const iGiven = both.indexOf('Host context (given')
const iFields = both.indexOf('Fields (given')
check(iGiven > -1 && iFields > -1, 'given 与 fixedFields 两块并存')
check(iGiven < iFields, 'given 行在 fields 行之前（顶层决定先于字段细节）')
check(both.includes('orderNo, amount'), 'fixedFields 仍按原格式连写')
// fixedFields-only 的老路径必须逐字节不变（B2 已上线口径）
check(
  content('做一个订单列表', ['orderNo']) ===
    "做一个订单列表\n\nFields (given — use EXACTLY these props; infer each field's formtype / membership / actions / layout): orderNo",
  'fixedFields-only 路径与 B2 口径逐字节一致'
)

// ── 5) 形状：恒为单条 user 消息 ──
const msgs = buildInitialMessages('x', ['a'], { target: 'vue3', mode: 'schema' })
check(msgs.length === 1 && msgs[0].role === 'user', '恒返回单条 user 消息')

// ── 6) 反放水：scorer 的 target/mode 维度必须仍在比对 gold vs pred ──
{
  const { CAPABILITY_SCORERS } = await import('./scorers.mjs')
  const byKey = Object.fromEntries(CAPABILITY_SCORERS.map((d) => [d.key, d]))
  for (const key of ['target', 'mode']) {
    const dim = byKey[key]
    check(!!dim, `scorer 仍存在 ${key} 维度`)
    if (!dim) continue
    const gold = { target: 'vue2', mode: 'sfc' }
    check(dim.applicable(gold) === true, `${key} 维度对非默认 gold 仍 applicable`)
    check(dim.pass(gold, { ...gold }) === true, `${key} 维度：一致则过`)
    check(dim.pass(gold, { ...gold, [key]: gold[key] === 'vue2' ? 'antdv' : 'schema' }) === false,
      `${key} 维度：给定却不照抄必须翻红（防放水）`)
  }
}

// ── 7) 回灌轮不得留空 text block（2026-10-16 京东云网关 400 的回归钉）──
// `thinking: adaptive` 下模型可能只产出 thinking 块 → textOf 返回 ''。若把空串原样推回，
// 下一次请求就带上空的 text block：宽松中继默默放行，严格中继直接
// 400 `messages: text content blocks must be non-empty`（实测死在 02-product-remote-select [en]）。
// 这条断言钉的是「regardless of relay 宽严，我们这边永不产生空块」。
{
  const fresh = () => []
  for (const [label, empty] of [
    ['空串', ''],
    ['纯空白', '   \n\t '],
  ]) {
    const m = fresh()
    pushAssistant(m, empty)
    check(m.length === 1 && m[0].role === 'assistant', `pushAssistant(${label})：推入一条 assistant 轮`)
    check(
      typeof m[0].content === 'string' && m[0].content.trim().length > 0,
      `pushAssistant(${label})：content 必须非空（否则下一次请求带空 text block → 严格中继 400）`
    )
  }
  // 非空文本必须**原样**保留（不许被标记覆盖，否则多轮上下文就丢了）
  const keep = fresh()
  pushAssistant(keep, '{"fields":[]}')
  check(keep[0].content === '{"fields":[]}', 'pushAssistant(有文本)：必须逐字节保留模型产出')

  // 非字符串（防御性）：不得抛异常、不得留空块
  const weird = fresh()
  pushAssistant(weird, undefined)
  check(
    typeof weird[0].content === 'string' && weird[0].content.trim().length > 0,
    'pushAssistant(undefined)：不得留空块（textOf 边界外仍有防御）'
  )

  // user 纠正轮同理（refinement / 自修复的 correction 理论上可能为空）
  const corr = fresh()
  pushUserCorrection(corr, '   ')
  check(corr.length === 1 && corr[0].role === 'user', 'pushUserCorrection：角色为 user')
  check(
    typeof corr[0].content === 'string' && corr[0].content.trim().length > 0,
    'pushUserCorrection(空白)：必须非空'
  )
  const corrKeep = fresh()
  pushUserCorrection(corrKeep, 'inQuery must be false')
  check(corrKeep[0].content === 'inQuery must be false', 'pushUserCorrection：非空文本原样保留')
}

// ── 8) 回灌轮必须**就地** push 到传进来的数组（否则多轮上下文断链）──
{
  const messages = [{ role: 'user', content: 'x' }]
  const ret = pushAssistant(messages, 'y')
  check(messages.length === 2 && messages[1] === ret, 'pushAssistant：就地 push 并返回该消息（调用方靠同一数组延续对话）')
  const ret2 = pushUserCorrection(messages, 'z')
  check(messages.length === 3 && messages[2] === ret2, 'pushUserCorrection：同上')
  check(
    messages.every((m) => typeof m.content === 'string' && m.content.trim().length > 0),
    '整段对话里不得有任何空 content 块'
  )
}

if (failures) {
  console.error(`\nmeta-eval FAILED: ${failures} 处断言未过`)
  process.exit(1)
}
console.log('\nmeta-eval OK — prompt 给定输入明示、旧路径逐字节不变、target/mode 维度未放水、回灌轮永不留空 text block。✔')
