<template>
  <div class="es-form-page">
    <h1>EsForm 动态表单</h1>
    <p class="subtitle">
      基于 JSON 配置的动态表单组件。使用 <code>@es-plus/adapter-antdv</code> 适配 Ant Design Vue 4.x。
    </p>

    <a-divider />

    <!-- 分组标签条：19 个示例原本一条长列表（12,961px）。分组后同一时刻只挂当前组，
         深链（#dialog 这种）会自动切到所在分组 —— 逻辑在 composables/useSectionGroups.js -->
    <SectionTabs :groups="groups" :active="activeGroup" @select="selectTab" />

    <!-- 基础用法 -->
    <section v-if="isActive('basics')" id="basic">
      <h2>基础用法</h2>
      <p>通过 <code>form-item-list</code> 配置表单字段。</p>
            <CodeDemo :source="rawSFCs['./es-form/Basic.vue']">
        <EsFormBasic />
      </CodeDemo>
    </section>

    <a-divider v-if="isActive('basics')" />

    <section v-if="isActive('basics')" id="layout">
      <h2>布局与折叠</h2>
      <p>24 栅格布局 + 自动折叠展开，支持响应式自适应。</p>
            <CodeDemo :source="rawSFCs['./es-form/Layout.vue']">
        <EsFormLayout />
      </CodeDemo>
    </section>

    <a-divider v-if="isActive('basics')" />

    <section v-if="isActive('basics')" id="conditional">
      <h2>条件显隐 + 字段联动</h2>
      <p>模型驱动字段显隐，<code>isHidden</code> + <code>on.change</code> 实现字段间联动；声明式解法（0 个回调）见下方「报销单」。</p>
            <CodeDemo :source="rawSFCs['./es-form/Conditional.vue']">
        <EsFormConditional />
      </CodeDemo>
    </section>

    <a-divider v-if="isActive('linkage')" />

    <section v-if="isActive('linkage')" id="declarative-linkage">
      <h2>报销单：零回调联动</h2>
      <p>
        省 → 市 → 门店三级下拉、可选城市才要求发票号、大区自动带出并锁定、金额 &gt; 5000 才要求说明、
        非部分退款时隐藏退款原因 —— 全部来自一份<strong>纯 JSON</strong>（<code>reactions</code> + JSON 表达式），
        示例里 0 个函数。展开表单下方可看驱动它的配置原文。
      </p>
      <CodeDemo :source="rawSFCs['./es-form/DeclarativeLinkage.vue']">
        <EsFormDeclarativeLinkage />
      </CodeDemo>
    </section>

    <a-divider v-if="isActive('linkage')" />

    <section v-if="isActive('linkage')" id="async">
      <h2>异步选项：apiParams + 级联</h2>
      <p><code>apiParams</code> 自动加载下拉选项 + 级联联动。</p>
            <CodeDemo :source="rawSFCs['./es-form/AsyncOptions.vue']">
        <EsFormAsyncOptions />
      </CodeDemo>
    </section>

    <a-divider v-if="isActive('controls')" />

    <section v-if="isActive('controls')" id="validation">
      <h2>校验：rules + 自定义 validator</h2>
      <p>集成 Ant Design Vue 验证体系，支持 rules、pattern、自定义 validator。</p>
            <CodeDemo :source="rawSFCs['./es-form/Validation.vue']">
        <EsFormValidation />
      </CodeDemo>
    </section>

    <a-divider v-if="isActive('controls')" />

    <section v-if="isActive('controls')" id="custom">
      <h2>render 接管任意控件</h2>
      <p><code>render(h, model)</code> 直接接管控件：头像上传、评分、滑块、穿梭框都不需要额外封装。</p>
            <CodeDemo :source="rawSFCs['./es-form/CustomRender.vue']">
        <EsFormCustomRender />
      </CodeDemo>
    </section>

    <a-divider v-if="isActive('scenes')" />

    <section v-if="isActive('scenes')" id="detail">
      <h2>详情 / 编辑双模式</h2>
      <p>同一份 <code>formItems</code>，详情模式整表禁用并隐藏按钮区，切回编辑即可改。</p>
            <CodeDemo :source="rawSFCs['./es-form/Detail.vue']">
        <EsFormDetail />
      </CodeDemo>
    </section>

    <a-divider v-if="isActive('scenes')" />

    <section v-if="isActive('scenes')" id="upload">
      <h2>图片上传</h2>
      <p>支持 picture-card 多图上传、自定义 httpRequest、预览删除等完整上传功能。</p>
            <CodeDemo :source="rawSFCs['./es-form/Upload.vue']">
        <EsFormUpload />
      </CodeDemo>
    </section>

    <a-divider v-if="isActive('controls')" />

    <section v-if="isActive('controls')" id="preferences">
      <h2>偏好设置</h2>
      <p>Radio、Checkbox、Switch、Slider、ColorPicker、Rate 六种组件配置化示例。</p>
            <CodeDemo :source="rawSFCs['./es-form/Preferences.vue']">
        <EsFormPreferences />
      </CodeDemo>
    </section>

    <a-divider v-if="isActive('scenes')" />

    <section v-if="isActive('scenes')" id="search">
      <h2>组合搜索</h2>
      <p><code>isHidden</code> + <code>apiParams</code> + 更多/收起，完整搜索表单模式。</p>
            <CodeDemo :source="rawSFCs['./es-form/SearchForm.vue']">
        <EsFormSearchForm />
      </CodeDemo>
    </section>

    <a-divider v-if="isActive('tools')" />

    <section v-if="isActive('tools')" id="advanced-buttons">
      <h2>按钮左右分栏</h2>
      <p><code>btnColSpanRow</code> + <code>direction</code> 实现左右分栏按钮区；查询真的过滤下方结果集，导出是真的 CSV 文件。</p>
            <CodeDemo :source="rawSFCs['./es-form/AdvancedButtons.vue']">
        <EsFormAdvancedButtons />
      </CodeDemo>
    </section>

    <a-divider v-if="isActive('tools')" />

    <section v-if="isActive('tools')" id="cascader">
      <h2>级联选择器</h2>
      <p>使用 Cascader 组件实现多级联动选择。</p>
            <CodeDemo :source="rawSFCs['./es-form/Cascader.vue']">
        <EsFormCascader />
      </CodeDemo>
    </section>

    <a-divider v-if="isActive('tools')" />

    <section v-if="isActive('tools')" id="tree-select-autocomplete">
      <h2>树选择与联想输入</h2>
      <p>TreeSelect 在树形数据里选任意层级（值为节点 value）；Autocomplete 在选项集上边输边筛（同样是 value 语义）。</p>
            <CodeDemo :source="rawSFCs['./es-form/TreeSelectAutocomplete.vue']">
        <EsFormTreeSelectAutocomplete />
      </CodeDemo>
    </section>

    <a-divider v-if="isActive('tools')" />

    <section v-if="isActive('tools')" id="datetime-range">
      <h2>日期时间范围</h2>
      <p>完整覆盖日期、时间、日期时间范围选择场景。</p>
            <CodeDemo :source="rawSFCs['./es-form/DateTimeRange.vue']">
        <EsFormDateTimeRange />
      </CodeDemo>
    </section>

    <a-divider v-if="isActive('tools')" />

    <section v-if="isActive('tools')" id="dynamic">
      <h2>运行期增删表单项</h2>
      <p>运行时动态增删表单项，支持数组类型表单与动态验证。</p>
            <CodeDemo :source="rawSFCs['./es-form/Dynamic.vue']">
        <EsFormDynamic />
      </CodeDemo>
    </section>

    <a-divider v-if="isActive('linkage')" />

    <section v-if="isActive('linkage')" id="computed-fields">
      <h2>联动计算：选商品自动算总价</h2>
      <p>字段级 <code>on.change</code> 监听下拉选择，其余联动用 <code>watch</code> 跟随 model（antdv 各控件事件名不统一：a-input 用 input、a-slider 只有 update:value / change），实现商品选择 → 自动填充单价 → 数量折扣 → 实时计算总价。</p>
            <CodeDemo :source="rawSFCs['./es-form/ComputedFields.vue']">
        <EsFormComputedFields />
      </CodeDemo>
    </section>

    <a-divider v-if="isActive('tools')" />

    <section v-if="isActive('tools')" id="custom-button">
      <h2>自定义按钮区</h2>
      <p><code>renderBtn</code> 完全自定义按钮区域，支持异步提交、保存草稿、确认弹窗等交互。</p>
            <CodeDemo :source="rawSFCs['./es-form/CustomButton.vue']">
        <EsFormCustomButton />
      </CodeDemo>
    </section>

    <a-divider v-if="isActive('scenes')" />

    <section v-if="isActive('scenes')" id="dialog">
      <h2>弹窗内嵌表单</h2>
      <p>弹窗里直接放 EsForm：确定前先校验，通过后回写结果再 close，弹窗与表单共用一份 model。</p>
            <CodeDemo :source="rawSFCs['./es-form/Dialog.vue']">
        <EsFormDialog />
      </CodeDemo>
    </section>

    <a-divider v-if="isActive('scenes')" />

    <section v-if="isActive('scenes')" id="file-upload">
      <h2>文件上传</h2>
      <p>图片 / PDF 新窗口预览、TXT 内联预览，Office 文档提示走下载；自定义文件列表项（图标 / 大小 / 预览 / 下载 / 删除）。</p>
            <CodeDemo :source="rawSFCs['./es-form/FileUpload.vue']">
        <EsFormFileUpload />
      </CodeDemo>
    </section>

    <a-divider v-if="isActive('scenes')" />

    <!-- 分组布局：容器组件包裹多个 EsForm -->
    <section v-if="isActive('scenes')" id="form-group">
      <h2>分组布局：Tabs / Steps / Collapse</h2>
      <p>用 <code>a-tabs / a-steps / a-collapse</code> 包裹多个 EsForm 实现字段分组，字段联动与校验在各组内独立生效。保存前逐组 <code>validate()</code>，避免错误藏在没打开的标签页里。</p>
            <CodeDemo :source="rawSFCs['./es-form/GroupLayout.vue']">
        <EsFormGroupLayout />
      </CodeDemo>
    </section>

    <a-divider />

    <h2>API / 属性</h2>
    <a-table
      :dataSource="formProps"
      :columns="propColumns"
      :pagination="false"
      size="small"
      bordered
    />

    <h2>方法</h2>
    <p>通过 <code>ref</code> 调用，三端同名同义（<code>this.$refs.form.xxx()</code>）。</p>
    <a-table
      :dataSource="formMethods"
      :columns="methodColumns"
      :pagination="false"
      size="small"
      bordered
    />

    <h2>FormItemOption 配置</h2>
    <p>
      <code>formItemList</code> 的每一项。字段名与语义三端一致；本端（Ant Design Vue）的
      <code>attrs</code> / <code>props</code> 会合并后透传给底层控件。
    </p>
    <a-table
      :dataSource="formItemOptions"
      :columns="propColumns"
      :pagination="false"
      size="small"
      bordered
    />

    <h2>LayoutFormProps 配置</h2>
    <p>
      推荐写 <code>formLayProps</code>；<code>fromLayProps</code> 是旧拼写，仅作兼容保留，
      新代码请勿使用。
    </p>
    <a-table
      :dataSource="layoutFormProps"
      :columns="propColumns"
      :pagination="false"
      size="small"
      bordered
    />

    <h2>BtnConfig 配置</h2>
    <p>
      按钮的点击回调只有键名 <code>click</code>（没有 <code>onClick</code>）；
      <code>key</code> 为 <code>query</code> / <code>rest</code> 且 <code>triggerEvent</code>
      为 <code>true</code> 时，组件内部自动触发表格查询或重置。
    </p>
    <a-table
      :dataSource="formBtns"
      :columns="propColumns"
      :pagination="false"
      size="small"
      bordered
    />
  </div>
</template>

<script setup>
import { nextTick, onBeforeUnmount, onMounted, watch } from 'vue'
import { useRoute } from 'vue-router'
import CodeDemo from '@/components/CodeDemo.vue'
import SectionTabs from '@/components/doc/SectionTabs.vue'
import { useSectionGroups } from '@/composables/useSectionGroups'
import { realignToHash } from '@/utils/doc-anchor'
import EsFormBasic from './es-form/Basic.vue'
import EsFormLayout from './es-form/Layout.vue'
import EsFormConditional from './es-form/Conditional.vue'
import EsFormDeclarativeLinkage from './es-form/DeclarativeLinkage.vue'
import EsFormAsyncOptions from './es-form/AsyncOptions.vue'
import EsFormValidation from './es-form/Validation.vue'
import EsFormCustomRender from './es-form/CustomRender.vue'
import EsFormDetail from './es-form/Detail.vue'
import EsFormUpload from './es-form/Upload.vue'
import EsFormPreferences from './es-form/Preferences.vue'
import EsFormSearchForm from './es-form/SearchForm.vue'
import EsFormAdvancedButtons from './es-form/AdvancedButtons.vue'
import EsFormCascader from './es-form/Cascader.vue'
import EsFormTreeSelectAutocomplete from './es-form/TreeSelectAutocomplete.vue'
import EsFormDateTimeRange from './es-form/DateTimeRange.vue'
import EsFormDynamic from './es-form/Dynamic.vue'
import EsFormComputedFields from './es-form/ComputedFields.vue'
import EsFormCustomButton from './es-form/CustomButton.vue'
import EsFormDialog from './es-form/Dialog.vue'
import EsFormFileUpload from './es-form/FileUpload.vue'
import EsFormGroupLayout from './es-form/GroupLayout.vue'

const rawSFCs = import.meta.glob('./es-form/*.vue', { query: '?raw', import: 'default', eager: true })

/**
 * 分组声明：20 个 section 原本一条长列表（12,961px），按主题切成 5 组，
 * 同一时刻只挂当前组。`ids` 必须与模板 `<section id>` 一一对应 ——
 * 漏写、写错 key、id 撞车由 `scripts/check-section-groups.mjs` 静态拦下
 * （模板里每个 section 的 `v-if="isActive('<key>')"` 也要同 key）。
 */
const SECTION_GROUPS = [
  { key: 'basics', name: '基础与布局', ids: ['basic', 'layout', 'conditional'] },
  { key: 'linkage', name: '联动与计算', ids: ['declarative-linkage', 'async', 'computed-fields'] },
  { key: 'controls', name: '校验与自定义控件', ids: ['validation', 'custom', 'preferences'] },
  {
    key: 'tools',
    name: '选择、运行期与按钮',
    ids: ['advanced-buttons', 'cascader', 'tree-select-autocomplete', 'datetime-range', 'dynamic', 'custom-button'],
  },
  { key: 'scenes', name: '业务场景', ids: ['detail', 'upload', 'search', 'dialog', 'file-upload', 'form-group'] },
]

const route = useRoute()
const { groups, activeGroup, isActive, activateFromHash, selectGroup } = useSectionGroups(
  SECTION_GROUPS,
  () => String(route.hash || ''),
)

/**
 * 落点偏移：标签条是 sticky 的（顶栏 64px + 标签条 ~50px），要在顶栏之外再让出它的高度。
 * 单一来源是路由的 `meta.anchorTop`（router 的 scrollBehavior 用同一个值）——
 * 两边各写一个数，迟早会在平滑滚动结束后来一次小跳。
 */
const ANCHOR_TOP = Number(route.meta.anchorTop) || 88

let stopRealign = () => {}
const realign = (hash) => {
  stopRealign()
  stopRealign = realignToHash(hash, { offset: ANCHOR_TOP })
}

const selectTab = async (key) => {
  if (activeGroup.value === key) return
  selectGroup(key)
  // 正文整组换掉：把新组的第一节带回标签条下方。不按「滚回页首」处理 ——
  // 用户可能已经滚到组的中段，回页首等于白扔一屏滚动距离。
  await nextTick()
  const first = SECTION_GROUPS.find((g) => g.key === key)
  realign(first && first.ids[0] ? `#${first.ids[0]}` : '')
}

// 深链 / 目录点击：先切到锚点所在的分组（DOM 才会出现），再二次对准。
// 顺序反过来就是滚一个还不存在的元素，落空且不会自己重试。
watch(
  () => route.hash,
  async (hash) => {
    activateFromHash(String(hash || ''))
    await nextTick()
    realign(String(hash || ''))
  },
)
// 首屏带 #dialog 这类深链：setup 里 useSectionGroups 已同步切好组，这里只负责落点
onMounted(() => realign(String(route.hash || '')))
onBeforeUnmount(() => stopRealign())

const propColumns = [
  { title: '属性', dataIndex: 'prop', key: 'prop', width: 140 },
  { title: '类型', dataIndex: 'type', key: 'type', width: 100 },
  { title: '默认值', dataIndex: 'default', key: 'default', width: 100 },
  { title: '说明', dataIndex: 'desc', key: 'desc' },
]

const methodColumns = [
  { title: '方法', dataIndex: 'prop', key: 'prop', width: 200 },
  { title: '说明', dataIndex: 'desc', key: 'desc' },
  { title: '参数', dataIndex: 'params', key: 'params', width: 160 },
]

const formProps = [
  { key: '1', prop: 'model', type: 'object', default: '{}', desc: '表单数据模型' },
  { key: '2', prop: 'formItemList', type: 'FormItemOption[]', default: '[]', desc: '表单项配置数组' },
  { key: '3', prop: 'configBtn', type: 'BtnConfig[]', default: '[]', desc: '操作按钮配置' },
  { key: '4', prop: 'layoutFormProps', type: 'LayoutFormProps', default: '{}', desc: '表单布局配置' },
  { key: '5', prop: 'rules', type: 'object', default: '{}', desc: '验证规则' },
  { key: '6', prop: 'renderBtn', type: 'Function | boolean', default: 'false', desc: '自定义按钮区渲染函数 (row, model, formItemList, h) => VNode' },
  { key: '7', prop: 'btnColSpanRow', type: 'boolean', default: 'true', desc: 'true = 按钮独占一行；false = 接在最后一个字段后' },
  { key: '8', prop: 'fieldFieldOutput', type: 'Function', default: '-', desc: '字段级 apiParams 的请求字段映射钩子 (defaults) => defaults' },
  { key: '9', prop: 'mode', type: "'edit' | 'detail'", default: "'edit'", desc: 'detail 把控件换成只读文本（dataOptions 翻译、日期格式化、空值占位），label 布局不变；render 字段仍走自定义函数，triggerEvent 按钮默认不渲染' },
]

const formMethods = [
  { key: '1', prop: 'validate', params: '()', desc: '校验整个表单，返回 Promise<boolean>（不通过时 reject，需 catch）' },
  { key: '2', prop: 'validateField', params: '(props)', desc: '校验指定字段' },
  { key: '3', prop: 'resetFields', params: '()', desc: '重置表单（恢复初始值并清除校验）' },
  { key: '4', prop: 'clearValidate', params: '(props?)', desc: '只清除验证状态，不改数据' },
  { key: '5', prop: 'scrollToField', params: '(prop)', desc: '滚动到指定字段' },
  { key: '6', prop: 'getFormRef', params: '()', desc: '取底层 a-form 实例' },
  { key: '7', prop: 'formItmeRequestInstance', params: '(propsList)', desc: '手动触发字段级数据请求（源码即此拼写，非笔误可改）' },
]

const formItemOptions = [
  { key: '1', prop: 'prop', type: 'string', default: '-', desc: '字段名（必填，支持 user.name 这类嵌套路径）' },
  { key: '2', prop: 'label', type: 'string', default: '-', desc: '标签文本' },
  { key: '3', prop: 'labelKey', type: 'string', default: '-', desc: '国际化 key，配置了全局 t 函数时优先于 label' },
  { key: '4', prop: 'formtype', type: 'string', default: '-', desc: '控件类型：Input / InputNumber / Select / DatePicker / TimePicker / Slider / ColorPicker / Transfer / Cascader / TreeSelect / Autocomplete / Radio / Checkbox / Switch / Rate / Upload' },
  { key: '5', prop: 'span', type: 'number', default: '6', desc: '栅格占位（1-24）' },
  { key: '6', prop: 'placeholder', type: 'string', default: '-', desc: '占位文本快捷方式，自动注入 attrs.placeholder（attrs 同名优先）' },
  { key: '6.1', prop: 'emptyPlaceholder', type: 'string', default: "'-'", desc: '详情模式（mode="detail"）下空值的展示文本；编辑模式不消费' },
  { key: '7', prop: 'clearable', type: 'boolean', default: '-', desc: '可清除快捷方式，自动注入 attrs.clearable（attrs 同名优先）' },
  { key: '8', prop: 'disabled', type: 'boolean', default: '-', desc: '禁用快捷方式，自动注入 attrs.disabled / props.disabled（attrs 同名优先）' },
  { key: '9', prop: 'attrs', type: 'object', default: '-', desc: '透传给控件的属性袋；与 props 合并后交给底层组件' },
  { key: '10', prop: 'props', type: 'object', default: '-', desc: '透传给控件的组件 props 袋（与 attrs 合并）' },
  { key: '11', prop: 'on', type: 'object', default: '-', desc: '事件监听，如 { change: (val) => {} }' },
  { key: '12', prop: 'dataOptions', type: 'Array<{ label, value }>', default: '-', desc: '静态选项（Select / Autocomplete / Radio / Checkbox / Cascader / TreeSelect）' },
  { key: '13', prop: 'isHidden', type: 'Function | 声明式条件', default: '-', desc: '返回 true 表示隐藏该字段；(model, item, formProps) => boolean，也可写 JSON 条件' },
  { key: '14', prop: 'reactions', type: 'FieldReaction[]', default: '-', desc: '声明式字段联动（纯 JSON）：选项 / 必填 / 禁用 / 值由其他字段决定' },
  { key: '15', prop: 'render', type: 'Function', default: '-', desc: '自定义渲染 (h, model, { row, index }) => VNode' },
  { key: '16', prop: 'apiParams', type: 'ApiParams', default: '-', desc: '远程选项配置 { url, method, model, headers }' },
  { key: '17', prop: 'httpRequest', type: 'Function', default: '-', desc: '自定义请求方法，覆盖全局配置' },
  { key: '18', prop: 'isInitRun', type: 'boolean', default: 'true', desc: '初始化时是否自动加载接口数据' },
  { key: '19', prop: 'callOptionListFormat', type: 'Function', default: '-', desc: '(data) => [{ label, value }]，转换接口响应' },
  { key: '20', prop: 'listenToCallBack', type: 'Object', default: '-', desc: '请求/响应回调管线 { beforeRequest, afterResponse, responseTransform }' },
  { key: '21', prop: 'required', type: 'boolean', default: '-', desc: '是否必填（与 rules 二选一；formItemOptions.required 优先）' },
  { key: '22', prop: 'rules', type: 'Array', default: '-', desc: '字段校验规则，与表单级 rules 叠加（formItemOptions.rules 优先）' },
  { key: '23', prop: 'formItemOptions', type: 'object', default: '-', desc: '直接透传给 a-form-item 的低层逃生舱，其中 required / rules 优先于上面的快捷字段' },
  { key: '24', prop: 'width', type: 'number | string', default: '-', desc: '字段宽度（表格场景下列宽）' },
  { key: '25', prop: 'permissionValue', type: 'string', default: '-', desc: '字段级权限编码：无权限时整个表单项不渲染（声明了门但宿主没配全局 permission 时按 fail-closed 拒绝）' },
]

const layoutFormProps = [
  { key: '1', prop: 'rowLayProps', type: 'object', default: '-', desc: '透传给 a-row 的属性，如 { gutter: 16 }' },
  { key: '2', prop: 'formLayProps', type: 'object', default: '-', desc: '表单本体配置（推荐写法）' },
  { key: '3', prop: 'formLayProps.labelWidth', type: 'string | number', default: '-', desc: '标签宽度' },
  { key: '4', prop: 'formLayProps.size', type: 'string', default: '-', desc: '控件尺寸：large / middle / small' },
  { key: '5', prop: 'formLayProps.minFoldRows', type: 'number', default: '0', desc: '超过多少行折叠（0 = 不折叠）' },
  { key: '6', prop: 'formLayProps.isBtnHidden', type: 'boolean', default: 'false', desc: '隐藏内置按钮区' },
  { key: '7', prop: 'formLayProps.btnColSpan', type: 'number', default: '-', desc: '按钮所在列的 span' },
  { key: '8', prop: 'formLayProps.labelBtnWidth', type: 'string | number', default: '-', desc: '按钮区标签宽度' },
  { key: '9', prop: 'fromLayProps', type: 'object', default: '-', desc: '旧拼写（同 formLayProps 的键），仅为兼容保留，新代码请改用 formLayProps' },
  { key: '10', prop: 'setOptions', type: 'boolean', default: '-', desc: '是否启用设置下拉' },
]

const formBtns = [
  { key: '1', prop: 'name', type: 'string', default: '-', desc: '按钮文本' },
  { key: '2', prop: 'key', type: 'string', default: '-', desc: '按钮唯一标识；query / rest 配合 triggerEvent 触发联动' },
  { key: '3', prop: 'type', type: 'string', default: 'default', desc: '按钮类型：primary / default / dashed / text / link / danger' },
  { key: '4', prop: 'size', type: 'string', default: '-', desc: '按钮尺寸：large / middle / small' },
  { key: '5', prop: 'icon', type: 'string', default: '-', desc: '图标名称' },
  { key: '6', prop: 'position', type: 'string', default: 'left', desc: '按钮位置：left / right' },
  { key: '7', prop: 'code', type: '1 | 2', default: '-', desc: '位置旧写法：2 视为 right，其余视为 left（position 优先）' },
  { key: '8', prop: 'direction', type: 'string', default: '-', desc: '按钮区方向：left / right' },
  { key: '9', prop: 'loading', type: 'boolean', default: 'false', desc: '加载态' },
  { key: '10', prop: 'disabled', type: 'boolean | Function', default: 'false', desc: '禁用状态，支持函数动态判断' },
  { key: '11', prop: 'permissionValue', type: 'string', default: '-', desc: '按钮级权限编码' },
  { key: '12', prop: 'triggerEvent', type: 'boolean', default: 'false', desc: 'true 时由组件内部自动触发表格查询 / 表单重置（仅 key 为 query / rest 生效）' },
  { key: '13', prop: 'click', type: 'Function', default: '-', desc: '(model, formRef, httpRequestInstance) => void；只有 click 这一个键名' },
  { key: '14', prop: 'dialogKey', type: 'string', default: '-', desc: '在 EsCrudPage 中绑定要打开的弹窗' },
  { key: '15', prop: 'actionType', type: 'string', default: '-', desc: '在 EsCrudPage 中声明内置动作' },
  { key: '16', prop: 'confirm', type: 'string | boolean', default: '-', desc: '点击前的二次确认文案（true 用默认文案）' },
]
</script>

<style scoped>
h1 { font-size: var(--es-text-3xl); font-weight: 700; color: var(--es-doc-heading); margin-bottom: 8px; }
.subtitle { color: var(--es-text-secondary); font-size: 15px; line-height: 1.8; }
h2 { font-size: var(--es-text-2xl); font-weight: 600; margin: 0 0 16px; color: var(--es-doc-heading); }
/* 120 而不是 100：标签条 sticky 在顶栏下方，落点要让出它的高度（见脚本里的 ANCHOR_TOP） */
section { scroll-margin-top: 120px; }
section p { color: var(--es-text-regular); line-height: 1.8; margin-bottom: 16px; }
code { background: var(--es-fill); padding: 2px 6px; border-radius: 4px; font-family: 'Fira Code', monospace; font-size: 13px; color: var(--es-doc-inline-code-text); }
</style>
