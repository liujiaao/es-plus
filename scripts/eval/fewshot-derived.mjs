#!/usr/bin/env node
/**
 * few-shot 派生用例登记表（heldout 排除集）。
 *
 * ## 为什么需要它
 *
 * `eval-llm.mjs` 把 `NL_TO_CONFIG_FEWSHOT`（shared/src/ai-nl-to-config-prompt.ts:29，22 条）
 * 逐条放进 system prompt。若语料里存在与某条 few-shot 同源/近变体的 case，在该 case 上打分
 * 测的是**模型复述它刚看过的那段 few-shot**，而非泛化到未见场景 → 系统性抬高准确率。
 * 因此这些 case 必须从 heldout 里排除，单独作 few-shot recall 报告。
 *
 * **登记缺失是实测过的真缺陷**（F8，2026-10-15）：登记 6 个 vs few-shot 22 条，
 * 语料里确有大量派生 case 混在 heldout（`63-order-expand-detail` 与 few#19 的 NL 相似度
 * 高达 0.89，却被当 heldout 计分）。
 *
 * ## 裁定规则（语义裁定，非文本相似度）
 *
 * **文本相似度是不可靠判据**——已验证的反例：`03-order-tablebtns` 与 few#3 相似度仅 0.45、
 * `09-audit-readonly` 与 few#5 仅 0.30，而它们确实同源（是「变体」）；反之同族但独立撰写的
 * 用例（如 `32/33/34/38-*-response-map` 各用**不同**的响应映射键）相似度也不低。
 * 故一律按「**配置是否是 few-shot 配置的改写**」逐条语义裁定：
 *
 *   ① **字段名集合存活**（prop Jaccard 高）：改写只换 NL 措辞与列语义，`prop` 名会留下；
 *   ② **同一教学点的字面取值复用**：如 `configTableOut:{tableData:'list',total:'totalCount'}`、
 *      `tableBtns` 的「位置/类型/dialogKey」组合、`editConfig` 的 `{engine:'vxe',mode:'cell'}`；
 *   ③ **NOT** 仅「特征集相同而字段名与取值全换」——那属独立撰写的特性覆盖
 *      （如 `99/102/105/106` 都是 editConfig 特性覆盖，但字段名与 few#22 无一相同 → 不登记）。
 *
 * ## 下界守卫
 *
 * `scripts/check-fewshot-registration.mjs` 用可机械化的规则
 * （`prop ≥ 0.6 ∨ NL ≥ 0.35` 且 actions 相同）算出**下界候选集**并断言其 ⊆ 本表。
 * 该下界能机检地抓到 F8 里 16 条新登记中的 11 条——即「登记缺失」这个缺陷类别不会再复发。
 * 但下界**不是**全集：人工裁定还会并入若干低相似度同源例（本表标注了哪些是人工覆盖）。
 */

/**
 * 已被 few-shot 覆盖的用例（相对 `__tests__/golden/cases/` 的文件名）。
 * 按 few-shot 编号分组，便于核对「22 条 few-shot 各自在语料里有哪些派生 case」。
 */
export const FEWSHOT_DERIVED = new Set([
  // #1 用户管理（逐字相同）
  '01-user-manage.json',
  // #2 商品列表（逐字相同）
  '02-product-remote-select.json',
  // #3 订单 tableBtns：03 = 左右互换变体；24 = 换域数据改写（props 全换但
  //    tableBtns 逐项同形〔批量导出/left/export + 新增X/primary/right/dialogKey:add〕且 actions 相同）
  '03-order-tablebtns.json',
  '24-position-tablebtns.json',
  // #4 vue2 任务管理（变体）
  '07-vue2-task-manage.json',
  // #5 审计只读：09 = 列名改写变体；21 = 同域 sfc 变体（prop 0.80、actions 同为 view）
  '09-audit-readonly.json',
  '21-audit-readonly-sfc.json',
  // #6 部门权限（变体）
  '16-dept-permissions.json',
  // #13 工单彩色标签：149 = 去掉 operationColumn 半边的改写（4 个 prop 名全同 + 自定义渲染教学点同）
  '149-ticket-status-render.json',
  // #15 资金台账响应映射：31 = 字段名全换但 configTableOut 键值逐字相同
  //     （{tableData:'list',total:'totalCount'}）且 NL 同样给出该映射提示。
  //     同族的 32/33/34/38 各用**不同**映射键 → 独立撰写，不登记。
  '31-inventory-response-map.json',
  // #17 省份城市联动：122 = 逐字同源（prop 1.00 / NL 0.83）；135 = 加一列「客户名称」的改写（prop 0.75）
  '122-province-city-select-vue3.json',
  '135-city-multi-rule-vue3.json',
  // #19 订单展开明细（prop 1.00 / NL 0.89——F8 里相似度最高的旗舰证据）
  '63-order-expand-detail.json',
  // #20 部门树形：77 = 去掉两列的改写（NL 0.58、treeConfig 教学点同）
  '77-dept-tree-vue3.json',
  // #21 员工台账合并单元格：整族都复用 `dept/team/name` 三元字段名（人工裁定，多为 prop 0.60 故机检下界抓不全）
  //     180-city-sku-merge 同为 mergeConfig 但字段名全换 → 不登记
  '172-dept-staff-merge-vue3.json',
  '181-dept-team-role-merge-vue3.json',
  '173-dept-team-merge-vue3.json',
  '177-dept-team-merge-vue2.json',
  '176-dept-staff-merge-vue2.json',
  '185-dept-merge-explicit-columns-vue3.json',
  '179-dept-role-merge-vue3-sfc.json',
  // #22 商品价格行内编辑：92 = 同域（SKU 单价）改写，复用 skuName/price 名与 vxe editConfig 教学点（人工裁定）
  '92-sku-price-edit-vue3.json',
])
