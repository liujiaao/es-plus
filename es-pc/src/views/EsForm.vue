<template>
  <div class="es-form-page">
    <h1>EsForm 动态表单</h1>
    <p class="subtitle">
      基于 JSON 配置的动态表单组件。使用 <code>@es-plus/adapter-antdv</code> 适配 Ant Design Vue 4.x。
    </p>

    <a-divider />

    <!-- 基础用法 -->
    <section id="basic">
      <h2>基础用法</h2>
      <p>通过 <code>form-item-list</code> 配置表单字段。</p>
      <EsFormBasic />
    </section>

    <a-divider />

    <section id="layout">
      <h2>布局与折叠</h2>
      <p>24 栅格布局 + 自动折叠展开，支持响应式自适应。</p>
      <EsFormLayout />
    </section>

    <a-divider />

    <section id="conditional">
      <h2>条件显隐 & 联动</h2>
      <p>模型驱动字段显隐，<code>isHidden</code> + <code>on.change</code> 实现字段间联动。</p>
      <EsFormConditional />
    </section>

    <a-divider />

    <section id="async">
      <h2>异步加载选项</h2>
      <p><code>apiParams</code> 自动加载下拉选项 + 级联联动。</p>
      <EsFormAsyncOptions />
    </section>

    <a-divider />

    <section id="validation">
      <h2>表单验证</h2>
      <p>集成 Ant Design Vue 验证体系，支持 rules、pattern、自定义 validator。</p>
      <EsFormValidation />
    </section>

    <a-divider />

    <section id="custom">
      <h2>自定义渲染</h2>
      <p><code>render</code> 函数扩展复杂组件。</p>
      <EsFormCustomRender />
    </section>

    <a-divider />

    <section id="detail">
      <h2>详情模式</h2>
      <p>编辑/详情双模式切换。</p>
      <EsFormDetail />
    </section>

    <a-divider />

    <section id="upload">
      <h2>图片上传</h2>
      <p>支持 picture-card 多图上传、自定义 httpRequest、预览删除等完整上传功能。</p>
      <EsFormUpload />
    </section>

    <a-divider />

    <section id="preferences">
      <h2>偏好设置</h2>
      <p>Radio、Checkbox、Switch、Slider、ColorPicker、Rate 六种组件配置化示例。</p>
      <EsFormPreferences />
    </section>

    <a-divider />

    <section id="search">
      <h2>组合搜索</h2>
      <p><code>isHidden</code> + <code>apiParams</code> + 更多/收起，完整搜索表单模式。</p>
      <EsFormSearchForm />
    </section>

    <a-divider />

    <section id="advanced-buttons">
      <h2>高级按钮区</h2>
      <p><code>btnColSpanRow</code> + <code>direction</code> 实现左右分栏按钮区。</p>
      <EsFormAdvancedButtons />
    </section>

    <a-divider />

    <section id="cascader">
      <h2>级联选择器</h2>
      <p>使用 Cascader 组件实现多级联动选择。</p>
      <EsFormCascader />
    </section>

    <a-divider />

    <section id="datetime-range">
      <h2>日期时间范围</h2>
      <p>完整覆盖日期、时间、日期时间范围选择场景。</p>
      <EsFormDateTimeRange />
    </section>

    <a-divider />

    <section id="dynamic">
      <h2>动态增减表单</h2>
      <p>运行时动态增删表单项，支持数组类型表单与动态验证。</p>
      <EsFormDynamic />
    </section>

    <a-divider />

    <section id="computed-fields">
      <h2>联动计算</h2>
      <p><code>on.change</code> + <code>on.input</code> 实现商品选择 → 自动填充单价 → 数量折扣 → 实时计算总价。</p>
      <EsFormComputedFields />
    </section>

    <a-divider />

    <section id="custom-button">
      <h2>自定义按钮区</h2>
      <p><code>renderBtn</code> 完全自定义按钮区域，支持异步提交、保存草稿、确认弹窗等交互。</p>
      <EsFormCustomButton />
    </section>

    <a-divider />

    <section id="dialog">
      <h2>弹窗表单</h2>
      <p>在弹窗中使用 EsForm，展示表单与弹窗的无缝集成。</p>
      <EsFormDialog />
    </section>

    <a-divider />

    <section id="file-upload">
      <h2>文件上传</h2>
      <p>支持图片、PDF、TXT、Word、Excel、PPT 预览下载及 ZIP 下载，自定义文件列表与操作按钮。</p>
      <EsFormFileUpload />
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
  </div>
</template>

<script setup>
import EsFormBasic from './es-form/Basic.vue'
import EsFormLayout from './es-form/Layout.vue'
import EsFormConditional from './es-form/Conditional.vue'
import EsFormAsyncOptions from './es-form/AsyncOptions.vue'
import EsFormValidation from './es-form/Validation.vue'
import EsFormCustomRender from './es-form/CustomRender.vue'
import EsFormDetail from './es-form/Detail.vue'
import EsFormUpload from './es-form/Upload.vue'
import EsFormPreferences from './es-form/Preferences.vue'
import EsFormSearchForm from './es-form/SearchForm.vue'
import EsFormAdvancedButtons from './es-form/AdvancedButtons.vue'
import EsFormCascader from './es-form/Cascader.vue'
import EsFormDateTimeRange from './es-form/DateTimeRange.vue'
import EsFormDynamic from './es-form/Dynamic.vue'
import EsFormComputedFields from './es-form/ComputedFields.vue'
import EsFormCustomButton from './es-form/CustomButton.vue'
import EsFormDialog from './es-form/Dialog.vue'
import EsFormFileUpload from './es-form/FileUpload.vue'

const propColumns = [
  { title: '属性', dataIndex: 'prop', key: 'prop', width: 140 },
  { title: '类型', dataIndex: 'type', key: 'type', width: 100 },
  { title: '默认值', dataIndex: 'default', key: 'default', width: 100 },
  { title: '说明', dataIndex: 'desc', key: 'desc' },
]

const formProps = [
  { key: '1', prop: 'model', type: 'object', default: '{}', desc: '表单数据模型' },
  { key: '2', prop: 'form-item-list', type: 'FormItemOption[]', default: '[]', desc: '表单项配置数组' },
  { key: '3', prop: 'config-btn', type: 'BtnConfig[]', default: '[]', desc: '操作按钮配置' },
  { key: '4', prop: 'layout-form-props', type: 'LayoutFormProps', default: '{}', desc: '表单布局配置' },
  { key: '5', prop: 'rules', type: 'object', default: '{}', desc: '验证规则' },
]
</script>

<style scoped>
h1 { font-size: 30px; font-weight: 700; color: #1a1a2e; margin-bottom: 8px; }
.subtitle { color: #666; font-size: 15px; line-height: 1.8; }
h2 { font-size: 22px; font-weight: 600; margin: 0 0 16px; color: #1a1a2e; }
section { scroll-margin-top: 100px; }
section p { color: #555; line-height: 1.8; margin-bottom: 16px; }
code { background: #f5f5f5; padding: 2px 6px; border-radius: 4px; font-family: 'Fira Code', monospace; font-size: 13px; color: #d63384; }
</style>
