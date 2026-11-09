#!/usr/bin/env node
/**
 * 「NL/宿主是否**确实说了**某维度」的机器证据（纯函数，无 I/O）。
 *
 * ## 为什么需要它
 *
 * CRUD 语料新增 `nlStatedDims` 后，公平性不变量是 `pinnedDims ⊆ nlStatedDims`。
 * 但**自报的产物证明不了自己诚实**（`check-membership-trap` 的同一结论）：把每个
 * pin 原样抄进 `nlStatedDims` 也能让不变量恒真。所以每个 token 还要能对上一句
 * **真实存在的 NL 措辞**——这里就是那张措辞表。
 *
 * 单一出处：`scripts/eval/crud-fairness.test.mjs`（守卫）与一次性语料迁移脚本都从
 * 这里取，避免「守卫以为标对了、迁移却按另一套谓词写」。
 *
 * 判定刻意**保守**：只认明确的措辞；认不出返回 false（守卫会红，人去补 NL 或摘
 * pin），而不是猜。字段名匹配复用 `membership-trap` 的 label 归一化（「部门负责人」
 * ↔ `负责人` 这类同义写法）。
 */
import { extractSurfaceList, listMentions, statesSurface } from './membership-trap.mjs'

/** 把 label 里的正则元字符转义（label 可能含 `.` `(` 等）。 */
const escapeRe = (s) => String(s).replace(/[.*+?^${}()|[\]\\]/g, '\\$&')

/**
 * 容器/顶层维度的措辞证据（整维 token，不含 `:字段`）。
 *
 * 只覆盖「NL 里有一句明确的话」的维度；`membership`（三面归属全等）与
 * `propSet/target/mode`（宿主给定）走各自的口径，不在这里。
 */
export const CONTAINER_EVIDENCE = {
  // 「支持新增、编辑、删除」/「增删改查」/「每行可编辑删除」/「行内可删除」；
  // 「只读」= 只有 view；「导出/导入按钮」= 页面级 export/import 动作。
  actions:
    /支持[^。；]*?(?:新增|添加|新建|编辑|修改|删除|查看|导出|导入|导出|启用|禁用)|增删改查|行内(?:有|可)|每行(?:有|可)|操作列[^。；]*?(?:编辑|删除)|只读|导出|导入/,
  tableBtns: /表格上方|工具栏|上方左侧|上方右侧|表格顶部/,
  operationColumn: /每行有|每行可|行内有|行内可|每行(?:的)?操作|操作列/,
  dialogs: /弹窗|对话框/,
  mergeConfig: /合并/,
  treeConfig: /树形|层级结构|下级|子级|子节点|放在[^。；]*?字段里/,
  expandConfig: /展开/,
  editConfig: /行内编辑|单元格(?:修改|编辑)|双击整行|单击[^。；]*?单元格/,
  // 「行内编辑」在本库里只有 vxe 引擎能实现 ⟹ NL 提出编辑要求就等于指定了该引擎
  // （`virtualScroll` 维度的 applicable 正是 `engine ∈ {virtual, vxe}`）。
  // 明确说「用 vxe 引擎」同样是引擎依据（AI-31 的表尾/导出/打印用例即此写法）。
  virtualScroll: /虚拟滚动|行内编辑|单元格(?:修改|编辑)|双击整行|vxe/i,
  // vxe 一等公民的 JSON 子集（AI-31）：表尾合计 / 导出 / 工具栏 / 列宽拖拽 /
  // 键盘导航 / 单元格选中 / 校验提示 / 打印。刻意只收「这些能力在 NL 里被点名」的措辞。
  vxeConfig:
    /合计行|表尾合计|导出[^。；]{0,12}?(?:CSV|Excel|xlsx|csv)|工具栏|列宽拖拽|列宽可(?:以)?拖|键盘导航|方向键|单元格高亮|点击单元格选中|校验提示|打印表格/,
  i18n: /i18n|国际化|labelKey/i,
  permissions: /权限码|按权限可见|有权限时可见|只有拥有权限码|需要权限/,
  formLayout: /标签宽度|页签|标签页|分步填写|分步表单|折叠面板/,
  fieldSpan: /分\s*2\s*列|列布局|栅格/,
  configTableOut: /后端[\s\S]{0,20}?返回|响应字段映射|分页接口|页码字段|分页用的|分页字段/,
  // 「表头分组 / 两级表头 / 首列 / 勾选列 / 序号列 / 列顺序 / 固定列」
  columns:
    /分组表头|两级表头|多级表头|首列|勾选列|序号列|列序|列顺序|固定列|列宽|表头|展示|列有/,
  defaultSort: /默认按[^。；]*?(?:倒序|升序)/,
  // P1-3 第二期：嵌套对象容器。NL 必须把「一个对象 / 一组子字段」说出口，
  // 只列几个字段名不算（那可能只是普通平铺字段）。
  fieldChildren: /嵌套对象|子字段|一组(?:字段|输入项|表单)/,
  // 导出/导入这类只落在按钮上的能力，也常以「表格上方…按钮」表述
  exportBtn: /导出/,
}

/**
 * 控件类型（formtype）在 NL 里的叫法。按 gold 的 formtype 取证，不按字段名猜。
 *
 * 只认**控件名词**（输入框 / 下拉 / 单选 / 日期选择器…），不认裸的语义词（日期、
 * 文本、数字）：后者常出现在「表格展示…日期」这类与控件无关的句子里，会把
 * 「NL 没说控件」误判成「说了」。
 */
const FORM_TYPE_CUES = {
  Input: /输入框|文本框|文本域|多行文本|单行文本/,
  InputNumber: /数字输入|数值输入|数字框|输入数字|保留两位小数/,
  Select: /下拉|选择器|选择框/,
  Radio: /单选/,
  Checkbox: /多选|勾选/,
  Switch: /开关/,
  DatePicker: /日期选择|日期范围|选日期|日期控件/,
  TimePicker: /时间选择|时间范围|时段选择|时间控件/,
  Slider: /滑块/,
  ColorPicker: /颜色选择/,
  Transfer: /穿梭/,
  Cascader: /级联/,
  TreeSelect: /树选择|树形选择|树状选择|树形下拉|组织树|部门树/,
  Autocomplete: /联想|自动补全|输入建议|边输边筛|可搜索选择/,
  Rate: /评分|星级/,
  Upload: /上传/,
}

/** 按句切分（`；` / `。` 算句界，逗号不算——列举常在逗号之间）。 */
export function sentencesOf(nl) {
  return String(nl ?? '')
    .split(/[；;。]/)
    .map((s) => s.trim())
    .filter(Boolean)
}

/** 把 label 归一化后判断某句是否提到它（双向包含，容忍「部门负责人」↔`负责人`）。 */
export function sentenceMentions(sentence, label) {
  return listMentions([sentence], label)
}

/** 该字段所在的句子（第一句提到它的）；没有则 null。 */
export function clauseOf(nl, label) {
  return sentencesOf(nl).find((s) => sentenceMentions(s, label)) ?? null
}

/**
 * **所有**提到该字段的句子。
 *
 * 一件事常在后一句才说清：「表格展示 …、病假证明」「表单里「病假证明」在…时隐藏」。
 * 只看首句会把 `isHidden`/`reactions`/`extPoints` 全判成「NL 没说」。
 */
export function clausesOf(nl, label) {
  return sentencesOf(nl).filter((s) => sentenceMentions(s, label))
}

/** 任一提到该字段的句子满足 `re`。 */
function anyClause(nl, label, re) {
  return clausesOf(nl, label).some((s) => re.test(s))
}

/**
 * 字段级 token（`维度:prop`）的证据。
 *
 * @param {string} dim 维度名（冒号前）
 * @param {string} nl 中文 NL
 * @param {{prop:string,label:string,formtype?:string,dataOptions?:unknown[]}} field gold 字段
 * @returns {boolean}
 */
export function fieldEvidence(dim, nl, field) {
  if (!field) return false
  const label = field.label
  switch (dim) {
    case 'inQuery':
    case 'inTable': {
      // ① 穷举列举里点了这个字段的名：与 membership-trap 同一把尺子（保守下界）。
      const list = extractSurfaceList(nl, dim)
      if (list && listMentions(list, label)) return true
      // ② 否定句：「备注…列表里不显示」「备注不在表格展示」——排除也是一种申明。
      const noun = dim === 'inQuery' ? '(?:查询|搜索|筛选)' : '(?:表格|列表|列表页)'
      const neg = new RegExp(`${noun}[^。；]{0,8}?(?:不显示|不展示|不出现|不含|不放)`)
      if (anyClause(nl, label, neg)) return true
      // ③ 排他句：「初版只要能按工单标题搜索」——只说了这一个，其余即为「不在查询面」。
      if (
        dim === 'inQuery' &&
        /只能[^。；]{0,4}?(?:按|根据|用)[^。；]*?(?:搜索|查询|筛选)/.test(String(nl))
      )
        return true
      if (dim === 'inQuery') {
        // ④ 单字段追加句（纠正轮最常见的写法）：「创建时间**也要能**当查询条件，按时间
        // 区间筛选」。要求「标签在前、查询/筛选语在后」，避免「…支持按 X 筛选、展示 Y」
        // 这种反向句把 Y 也算成查询面。
        const cue = /查询条件|筛选|搜索|过滤|能查|可以查|当筛选项/
        for (const s of clausesOf(nl, label)) {
          const m = s.match(cue)
          if (!m) continue
          const at = s.indexOf(label)
          if (at === -1 || at <= m.index) return true
        }
      }
      return false
    }
    case 'inForm': {
      // 「表单里…」「…由系统自动生成，表单里不用填」——出现与否都以「填/表单」为锚。
      if (anyClause(nl, label, /填|表单|录入|输入/)) return true
      return /(?:不用|不需|无需|不可|不能)(?:填|录入|输入)/.test(String(nl))
    }
    case 'formtype': {
      const cue = field.formtype && FORM_TYPE_CUES[field.formtype]
      if (cue && anyClause(nl, label, cue)) return true
      // 「状态（启用/禁用）」把候选值写进括号，指向枚举型控件（Select/Radio）；具体是
      // 哪一个由库的约定决定，NL 已把「枚举」这一语义说清。
      const enumAfterLabel = new RegExp(`${escapeRe(label)}\\s*[（(][^）)]*[/、][^）)]*[）)]`)
      return enumAfterLabel.test(String(nl))
    }
    case 'dataOptions': {
      // ①「状态（启用/禁用）」这种把候选值写出来的穷举；②同句说「下拉选项/选择/取值」。
      const enumAfterLabel = new RegExp(`${escapeRe(label)}\\s*[（(][^）)]*[/、][^）)]*[）)]`)
      if (enumAfterLabel.test(String(nl))) return true
      return anyClause(nl, label, /下拉|选项|选择|取值|可选/)
    }
    case 'apiParams': {
      return anyClause(nl, label, /接口|数据来自|来源|远程/)
    }
    case 'isHidden': {
      return anyClause(nl, label, /隐藏|显示|不显示|可见|不出现/)
    }
    case 'reactions': {
      return anyClause(
        nl,
        label,
        /随|自动等于|自动为|自动同步|自动带出|才是必填|必填|不可修改|不可编辑|不可手改|只读|禁用|联动/,
      )
    }
    case 'extPoints': {
      return anyClause(
        nl,
        label,
        /自定义渲染|渲染|标签|按权限可见|仅在有权限时可见|权限码|才能查看|有权限|保留两位小数|进度条|链接|头像|徽标|趋势图|仪表盘|富文本|显示为|显示|颜色|图标/,
      )
    }
    case 'membership': {
      // 字段级 membership = 三面归属，NL 必须穷举查询面（与 check:membership-trap 同口径）。
      return statesSurface(nl, 'inQuery')
    }
    default:
      return false
  }
}

/** 宿主给定（不是 NL 措辞，而是 eval 每次都会附给模型的输入）。 */
export const HOST_GIVEN_DIMS = ['target', 'mode', 'propSet']

/**
 * 「模型被告知的全部自然语言」= 初版 NL ∪ 每轮纠正。
 *
 * 收敛语料**刻意**把铰链维度留到纠正轮（见各 conv-* 的 `notes`：欠定 NL +
 * gold=最终意图，turn-0 结构性 miss 才能让循环真的 fire）。所以公平性口径是
 * 「整个交互里说过」，而不是「初版 NL 说过」——后者是零编辑腿的口径，由
 * `nlOnlyText` 保留，供需要严格口径的检查使用。
 */
export function statedText(raw) {
  const parts = [raw?.nl, ...(raw?.refinements ?? []).map((r) => r?.correction)]
  return parts.filter(Boolean).join('；')
}

/** 只含初版 NL（零编辑腿口径）。 */
export function nlOnlyText(raw) {
  return String(raw?.nl ?? '')
}

/**
 * 一个 `nlStatedDims` token 是否有证据。
 *
 * `target` / `mode` / `propSet` 是宿主给定（`eval/prompt.mjs` 的 given 行 +
 * fixedFields 行）；`membership` 走穷举查询面；其余容器维度看措辞表，
 * 字段级 token 看 `fieldEvidence`。
 */
export function tokenEvidence(token, { nl, gold }) {
  const [dim, prop] = String(token).split(':')
  if (!prop && HOST_GIVEN_DIMS.includes(dim)) return true
  if (prop) {
    const field = (gold?.fields ?? []).find((f) => f.prop === prop)
    return fieldEvidence(dim, nl, field)
  }
  if (dim === 'membership') return statesSurface(nl, 'inQuery')
  const cue = CONTAINER_EVIDENCE[dim]
  return !!cue && cue.test(String(nl ?? ''))
}
