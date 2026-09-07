<template>
  <div class="dev-guide-page">
    <!-- Hero Section -->
    <section class="hero-section">
      <div class="hero-badge">
        <i class="el-icon-s-management" />
        <span>开发手册</span>
      </div>
      <h1 class="hero-title">
        ES-Plus 开发者完全指南
      </h1>
      <p class="hero-desc">
        深度剖析配置化组件库架构，掌握"配置即开发"核心理念，从原理到实战，一本手册覆盖全部用法。
      </p>
    </section>

    <!-- ==================== 第一篇：架构剖析 ==================== -->
    <section class="section">
      <div class="section-header">
        <div class="section-icon blue">
          <i class="el-icon-s-marketing" />
        </div>
        <h2 class="section-title">
          第一篇：架构剖析
        </h2>
      </div>

      <!-- 1.1 整体架构 -->
      <div class="content-card">
        <h3>1.1 组件库分层架构</h3>
        <p>ES-Plus 采用三层架构设计，从顶层的<strong>配置描述层</strong>到底层的 <strong>Element UI 渲染层</strong>，中间通过<strong>渲染引擎</strong>自动完成配置到 UI 的转换。</p>
        <div class="arch-diagram">
          <div class="arch-layer config-layer">
            <div class="layer-label">
              配置描述层 (Configuration)
            </div>
            <div class="layer-items">
              <span class="layer-item">formItemList[]</span>
              <span class="layer-item">columns[]</span>
              <span class="layer-item">options{}</span>
              <span class="layer-item">configBtn[]</span>
              <span class="layer-item">apiParams{}</span>
            </div>
          </div>
          <div class="arch-arrow">
            &#8595; Plugin Method Injection + Map Dispatch
          </div>
          <div class="arch-layer engine-layer">
            <div class="layer-label">
              渲染引擎层 (Rendering Engine)
            </div>
            <div class="layer-items">
              <span class="layer-item">formInputComponents()</span>
              <span class="layer-item">columnItem.vue</span>
              <span class="layer-item">RenderDom</span>
              <span class="layer-item">RenderBtn</span>
              <span class="layer-item">httpRquestInstace()</span>
            </div>
          </div>
          <div class="arch-arrow">
            &#8595; JSX Render Functions
          </div>
          <div class="arch-layer ui-layer">
            <div class="layer-label">
              Element UI 渲染层 (UI Components)
            </div>
            <div class="layer-items">
              <span class="layer-item">el-input</span>
              <span class="layer-item">el-table</span>
              <span class="layer-item">el-select</span>
              <span class="layer-item">el-pagination</span>
              <span class="layer-item">el-dialog</span>
            </div>
          </div>
        </div>
        <div class="tip-card tip-card--info">
          <div class="tip-icon">
            <i class="el-icon-info-filled" />
          </div>
          <div class="tip-content">
            <strong>核心理念</strong>
            <span>开发者在<strong>配置描述层</strong>用 JSON 声明"我需要什么"，渲染引擎自动完成"如何渲染"。一行 JSON 配置，胜过一百行模板代码。</span>
          </div>
        </div>
      </div>

      <!-- 1.2 Plugin 配置注入机制 -->
      <div class="content-card">
        <h3>1.2 Plugin 配置注入机制</h3>
        <p>EsForm 和 EsTable 通过 Vue Plugin 系统实现全局配置的依赖注入。注册时配置的方法会被合并到组件实例的方法中。</p>
        <div class="arch-diagram small">
          <div class="arch-layer config-layer">
            <div class="layer-label">
              Vue.use(EsPlus, globalConfig)
            </div>
          </div>
          <div class="arch-arrow">
            &#8595; importFnComponents() 遍历组件列表
          </div>
          <div class="arch-layer engine-layer">
            <div class="layer-label">
              检测 el.isPlugin === true
            </div>
          </div>
          <div class="arch-arrow">
            &#8595; Vue.use(el.Plugin, options[el.name])
          </div>
          <div class="arch-layer engine-layer">
            <div class="layer-label">
              Plugin.install(app, options)
            </div>
            <div class="layer-detail">
              1. app.provide('$tableInstance', options.methods)
              2. app.component(name, { ...Component, methods: { ...Component.methods, ...options.methods } })
            </div>
          </div>
        </div>
        <div class="code-block">
          <div class="code-header">
            <span class="code-lang">源码: esTable/index.js</span>
          </div>
          <pre v-pre><code>EsTable.isPlugin = true
EsTable.Plugin = {
  install(app, options) {
    // 1. 依赖注入：后代组件通过 inject 获取
    app.provide('$tableInstance', { ...(options.methods || {}) })
    // 2. 方法合并：组件自身可直接调用 this.$httpRequest()
    app.component(EsTable.name, {
      ...EsTable,
      methods: { ...EsTable.methods, ...(options.methods || {}) }
    })
  }
}</code></pre>
        </div>
      </div>

      <!-- 1.3 渲染引擎 Map 调度 -->
      <div class="content-card">
        <h3>1.3 EsForm 渲染引擎：Map 调度模式</h3>
        <p>EsForm 的核心渲染方法 <code>formInputComponents(item)</code> 使用 <code>Map&lt;formtype, renderFactory&gt;</code> 结构，根据配置中的 <code>formtype</code> 字符串分派到对应的 JSX 渲染工厂函数。</p>
        <div class="code-block">
          <div class="code-header">
            <span class="code-lang">源码: esForm.vue formInputComponents()</span>
          </div>
          <pre v-pre><code>const formPutList = new Map([
  ['Input',       (h, model, row) => h('el-input', { ... })],
  ['Select',      (h, model, row) => h('el-select', { ... }, [optionVNodes])],
  ['DatePicker',  (h, model, row) => h('el-date-picker', { ... })],
  ['Cascader',    (h, model, row) => h('el-cascader', { ... })],
  ['Radio',       (h, model, row) => h('el-radio-group', { ... }, [radioVNodes])],
  ['Checkbox',    (h, model, row) => h('el-checkbox-group', { ... }, [checkboxVNodes])],
  ['Switch',      (h, model, row) => h('el-switch', { ... })],
  ['Rate',        (h, model, row) => h('el-rate', { ... })],
  ['Upload',      (h, model, row) => h('el-upload', { ... }, [triggerVnode])],
  ['InputNumber', (h, model, row) => h('el-input-number', { ... })],
  ['TimePicker',  (h, model, row) => h('el-time-picker', { ... })]
])

// dispatch
if (formPutList.get(capitalize(item.formtype))) {
  return formPutList.get(capitalize(item.formtype))
}</code></pre>
        </div>
      </div>

      <!-- 1.4 数据请求生命周期 -->
      <div class="content-card">
        <h3>1.4 数据请求生命周期</h3>
        <p>EsTable 的自动数据请求遵循严格的管道处理流程：</p>
        <div class="pipe-diagram">
          <div
            v-for="(step, i) in pipeSteps"
            :key="i"
            class="pipe-step"
          >
            <div class="pipe-num">
              {{ i + 1 }}
            </div>
            <div class="pipe-name">
              {{ step.name }}
            </div>
            <div class="pipe-desc">
              {{ step.desc }}
            </div>
          </div>
        </div>
      </div>
    </section>

    <!-- ==================== 第二篇：快速上手 ==================== -->
    <section class="section">
      <div class="section-header">
        <div class="section-icon green">
          <i class="el-icon-time" />
        </div>
        <h2 class="section-title">
          第二篇：5 分钟快速上手
        </h2>
      </div>
      <p class="section-desc">
        从零搭建一个带查询功能的员工管理 CRUD 页面。
      </p>

      <div class="content-card">
        <h3>Step 1：全局注册</h3>
        <div class="code-block">
          <div class="code-header">
            <span class="code-lang">main.js</span>
          </div>
          <pre v-pre><code>import Vue from 'vue'
import ElementUI from 'element-ui'
import 'element-ui/lib/theme-chalk/index.css'
import EsPlus from '@es-plus/vue2'
import '@es-plus/vue2/dist/style.css'
import axios from 'axios'

Vue.use(ElementUI, { size: 'mini' })
Vue.use(EsPlus, {
  EsTable: {
    methods: {
      $httpRequest({ url, formParams, headers, ...options }) {
        const config = { url, method: options.method || 'POST' }
        if (config.method === 'GET') config.params = formParams
        else config.data = formParams
        return axios(config)
      }
    }
  },
  EsForm: {
    methods: {
      $httpRequest({ url, formParams, ...options }) {
        return axios.post(url, formParams)
      }
    }
  }
})</code></pre>
        </div>
      </div>

      <div class="content-card">
        <h3>Step 2：编写页面</h3>
        <div class="code-block">
          <div class="code-header">
            <span class="code-lang">EmployeeList.vue</span>
          </div>
          <pre v-pre><code>&lt;template&gt;
  &lt;div class="page"&gt;
    &lt;!-- 查询表单 --&gt;
    &lt;es-form
      :form-item-list="searchForm"
      :model="searchModel"
      :config-btn="searchBtns"
      :layout-form-props="formLayout"
    /&gt;
    &lt;!-- 数据表格 --&gt;
    &lt;es-table
      :columns="columns"
      :data-source.sync="dataSource"
      :pagination="pagination"
      :options="tableOpts"
      :config-btn="tableBtns"
    /&gt;
  &lt;/div&gt;
&lt;/template&gt;

&lt;script&gt;
export default {
  data() {
    return {
      // 查询表单配置
      searchModel: { name: '', status: '' },
      searchForm: [
        { prop: 'name', label: '员工姓名', span: 8, formtype: 'Input',
          attrs: { placeholder: '请输入', clearable: true } },
        { prop: 'status', label: '状态', span: 8, formtype: 'Select',
          dataOptions: [{ label: '在职', value: '1' }, { label: '离职', value: '0' }],
          attrs: { clearable: true } }
      ],
      searchBtns: [
        { name: '查询', type: 'primary', key: 'query', triggerEvent: true, icon: 'el-icon-search' },
        { name: '重置', key: 'rest', triggerEvent: true, icon: 'el-icon-refresh' }
      ],
      formLayout: { fromLayProps: { labelWidth: '80px' } },

      // 表格配置
      dataSource: [],
      columns: [
        { key: 'id', label: 'ID', width: 80 },
        { key: 'name', label: '姓名' },
        { key: 'department', label: '部门' },
        { key: 'statusText', label: '状态' }
      ],
      pagination: { current: 1, pageSize: 10, total: 0 },
      tableOpts: {
        isInitRun: true,
        apiParams: { url: '/api/employees' },
        border: true
      },
      tableBtns: [
        { name: '新增', type: 'primary', icon: 'el-icon-plus', direction: 'left',
          onClick(model, ref, refreshFn) { /* 打开新增弹窗 */ } }
      ]
    }
  }
}
&lt;/script&gt;</code></pre>
        </div>
      </div>

      <div class="content-card">
        <h3>关键机制说明</h3>
        <div class="info-grid">
          <div
            v-for="(item, i) in keyMechanisms"
            :key="i"
            class="info-item"
          >
            <div class="info-item-icon">
              {{ i + 1 }}
            </div>
            <div>
              <strong>{{ item.title }}</strong>
              <p>{{ item.desc }}</p>
            </div>
          </div>
        </div>
      </div>
    </section>

    <!-- ==================== 第三篇：EsForm 完全配置手册 ==================== -->
    <section class="section">
      <div class="section-header">
        <div class="section-icon purple">
          <i class="el-icon-s-order" />
        </div>
        <h2 class="section-title">
          第三篇：EsForm 完全配置手册
        </h2>
      </div>

      <!-- 3.0 Props 速查 -->
      <div class="content-card">
        <h3>3.0 Props 速查表</h3>
        <div class="api-table-wrap">
          <table class="api-table">
            <thead><tr><th>Prop</th><th>类型</th><th>默认值</th><th>说明</th></tr></thead>
            <tbody>
              <tr><td><code>formItemList</code></td><td>Array</td><td>[]</td><td>表单字段配置数组，每个元素描述一个表单控件</td></tr>
              <tr><td><code>model</code></td><td>Object</td><td>{}</td><td>表单数据模型（响应式绑定，支持 template / v-model / JSX 字面量三种写法）</td></tr>
              <tr><td><code>layoutFormProps</code></td><td>Object</td><td>{}</td><td>表单布局配置对象</td></tr>
              <tr><td><code>configBtn</code></td><td>Array</td><td>[]</td><td>表单底部/行内按钮配置</td></tr>
              <tr><td><code>renderBtn</code></td><td>Function | Boolean</td><td>false</td><td>自定义按钮区域渲染函数</td></tr>
              <tr><td><code>btnColSpanRow</code></td><td>Boolean</td><td>true</td><td>true=按钮独占一行(left/right布局)，false=按钮接在最后一个字段后</td></tr>
              <tr>
                <td
                  colspan="4"
                  class="inherit-note"
                >
                  <em>继承全部 Element UI <code>el-form</code> Props（rules, inline, label-width, size 等）</em>
                </td>
              </tr>
            </tbody>
          </table>
        </div>
      </div>

      <!-- 3.1 formItemList 属性完全说明 -->
      <div class="content-card">
        <h3>3.1 formItemList 元素属性全解</h3>
        <p>每个 <code>formItemList</code> 数组元素是一个描述单个表单字段的配置对象，支持以下全部属性：</p>

        <div class="api-table-wrap">
          <table class="api-table">
            <thead>
              <tr>
                <th style="width:15%">
                  属性
                </th><th style="width:12%">
                  类型
                </th><th style="width:10%">
                  必填
                </th><th>说明</th>
              </tr>
            </thead>
            <tbody>
              <tr>
                <td><code>prop</code></td>
                <td>String | Function</td>
                <td><span class="badge required">是</span></td>
                <td>绑定 <code>model</code> 中的字段名。支持函数返回动态 key：<code>() => this.type === 'A' ? 'fieldA' : 'fieldB'</code></td>
              </tr>
              <tr>
                <td><code>label</code></td>
                <td>String</td>
                <td><span class="badge optional">否</span></td>
                <td>表单标签文本</td>
              </tr>
              <tr>
                <td><code>formtype</code></td>
                <td>String</td>
                <td><span class="badge required">是*</span></td>
                <td>内置控件类型，详见 <a href="#formtype-table">3.2 formtype 类型对照表</a>。<strong>与 render 至少提供一个</strong></td>
              </tr>
              <tr>
                <td><code>span</code></td>
                <td>Number</td>
                <td><span class="badge optional">否</span></td>
                <td>栅格列数 (1-24)，默认 6。常用值：8(1/3行)、6(1/4行)、12(半行)、24(整行)</td>
              </tr>
              <tr>
                <td><code>attrs</code></td>
                <td>Object</td>
                <td><span class="badge optional">否</span></td>
                <td>传递给控件的 HTML 属性和 Element UI props。如 <code>{ placeholder: '请输入', clearable: true, disabled: false }</code>。<br><strong>disabled 支持函数动态计算</strong>：<code>disabled: () => this.role !== 'admin'</code></td>
              </tr>
              <tr>
                <td><code>formItemOptions</code></td>
                <td>Object</td>
                <td><span class="badge optional">否</span></td>
                <td><code>el-form-item</code> 的配置项：<code>{ rules, labelWidth, style, class, required }</code> 等</td>
              </tr>
              <tr>
                <td><code>dataOptions</code></td>
                <td>Array | Function</td>
                <td><span class="badge conditional">条件</span></td>
                <td>用于 Select/Radio/Checkbox/Cascader 的选项数据。格式：<code>[{ label: '选项名', value: '选项值' }]</code>。<br>支持函数动态返回：<code>() => this.getDynamicOptions()</code></td>
              </tr>
              <tr>
                <td><code>isHiden</code></td>
                <td>Function</td>
                <td><span class="badge optional">否</span></td>
                <td>条件渲染函数：<code>(model, item, formProps) => boolean</code>。返回 <code>true</code> 则隐藏该字段</td>
              </tr>
              <tr>
                <td><code>render</code></td>
                <td>Function</td>
                <td><span class="badge conditional">条件</span></td>
                <td>自定义渲染函数：<code>(createElement, model, row) => VNode</code>。当不设置 <code>formtype</code> 时使用此函数渲染</td>
              </tr>
              <tr>
                <td><code>on</code></td>
                <td>Object</td>
                <td><span class="badge optional">否</span></td>
                <td>事件监听器对象。<br>通用：<code>{ input, change, blur, focus }</code><br>Upload 专用：<code>{ remove, preview, download, success, error }</code><br><strong>input</strong> 事件会替代默认的双向绑定逻辑</td>
              </tr>
              <tr>
                <td><code>apiParams</code></td>
                <td>Object</td>
                <td><span class="badge optional">否</span></td>
                <td>远程数据源配置（用于 Select/Cascader 的异步选项加载）：<br><code>{ url, method, model, headers, options, httpRequest }</code></td>
              </tr>
              <tr>
                <td><code>httpRequest</code></td>
                <td>Function</td>
                <td><span class="badge optional">否</span></td>
                <td>Upload 类型的自定义上传函数：<code>({ file, filename }) => Promise</code></td>
              </tr>
              <tr>
                <td><code>triggerRender</code></td>
                <td>Function</td>
                <td><span class="badge optional">否</span></td>
                <td>Upload 类型的自定义触发元素：<code>(createElement) => VNode</code></td>
              </tr>
              <tr>
                <td><code>components</code></td>
                <td>Object</td>
                <td><span class="badge optional">否</span></td>
                <td>注入外部自定义组件。所有表单字段的 <code>components</code> 会被合并收集到渲染上下文中</td>
              </tr>
              <tr>
                <td><code>listenToCallBack</code></td>
                <td>Object</td>
                <td><span class="badge optional">否</span></td>
                <td>远程数据加载的生命周期回调：<br><code>{ brcb(params) => params, qrcb(res) => void, crtn(data) => options[] }</code><br>brcb: 请求前转换参数； qrcb: 响应后处理； crtn: 将响应数据转换为选项格式</td>
              </tr>
              <tr>
                <td><code>props</code></td>
                <td>Object</td>
                <td><span class="badge optional">否</span></td>
                <td>传递给控件的额外 Vue props（如 Cascader 的 <code>{ checkStrictly: true, expandTrigger: 'hover' }</code>）</td>
              </tr>
            </tbody>
          </table>
        </div>

        <div class="tips-box tips-box--warning">
          <h4>&#9888; 注意事项</h4>
          <ul>
            <li><code>formtype</code> 和 <code>render</code> 至少有其一：<code>formtype</code> 使用内置控件，<code>render</code> 自定义渲染</li>
            <li><code>prop</code> 支持函数时，会在组件初始化时调用一次以确定字段名（不会动态重新调用）</li>
            <li><code>isHiden</code> 返回 true 的字段会被完全移除出 DOM，不会参与布局计算</li>
            <li><code>attrs.disabled</code> 支持函数时，每次渲染都会重新调用获取最新值</li>
          </ul>
        </div>
      </div>

      <!-- 3.2 formtype 类型对照表 -->
      <div
        id="formtype-table"
        class="content-card"
      >
        <h3>3.2 formtype 内置控件类型对照表</h3>
        <div class="api-table-wrap">
          <table class="api-table">
            <thead><tr><th>formtype</th><th>对应 Element UI 组件</th><th>适用场景</th><th>特殊配置</th></tr></thead>
            <tbody>
              <tr><td><code>Input</code></td><td>el-input</td><td>文本输入</td><td>支持 <code>type: 'textarea'</code> 多行文本</td></tr>
              <tr><td><code>InputNumber</code></td><td>el-input-number</td><td>数字输入</td><td><code>attrs: { min: 0, max: 100, step: 1 }</code></td></tr>
              <tr><td><code>Select</code></td><td>el-select</td><td>下拉选择</td><td><code>dataOptions</code> 或 <code>apiParams</code> 提供数据源</td></tr>
              <tr><td><code>DatePicker</code></td><td>el-date-picker</td><td>日期选择</td><td><code>attrs: { type: 'datetime', valueFormat: 'yyyy-MM-dd HH:mm:ss' }</code></td></tr>
              <tr><td><code>TimePicker</code></td><td>el-time-picker</td><td>时间选择</td><td><code>attrs: { format: 'HH:mm:ss' }</code></td></tr>
              <tr><td><code>Cascader</code></td><td>el-cascader</td><td>级联选择</td><td>需 <code>dataOptions</code> 提供树形数据；支持 <code>props: { checkStrictly, expandTrigger }</code></td></tr>
              <tr><td><code>Radio</code></td><td>el-radio-group</td><td>单选按钮组</td><td>需 <code>dataOptions</code> 提供选项列表</td></tr>
              <tr><td><code>Checkbox</code></td><td>el-checkbox-group</td><td>多选按钮组</td><td>需 <code>dataOptions</code> 提供选项列表；model 值为数组</td></tr>
              <tr><td><code>Switch</code></td><td>el-switch</td><td>开关切换</td><td>model 值为 boolean</td></tr>
              <tr><td><code>Rate</code></td><td>el-rate</td><td>评分</td><td><code>attrs: { max: 5, showText: true }</code></td></tr>
              <tr><td><code>Upload</code></td><td>el-upload</td><td>文件上传</td><td>需 <code>httpRequest</code> 或 <code>action</code>；支持 <code>triggerRender</code> 自定义上传按钮</td></tr>
            </tbody>
          </table>
        </div>
      </div>

      <!-- 3.3 layoutFormProps -->
      <div class="content-card">
        <h3>3.3 layoutFormProps 布局配置详解</h3>
        <div class="api-table-wrap">
          <table class="api-table">
            <thead><tr><th>属性</th><th>类型</th><th>说明</th></tr></thead>
            <tbody>
              <tr><td><code>rowLayProps</code></td><td>Object</td><td><code>el-row</code> 的配置：<code>{ gutter: 10, type: 'flex', justify: 'start' }</code></td></tr>
              <tr>
                <td><code>fromLayProps</code></td><td>Object</td><td>
                  表单层级配置：
                  <ul style="margin:4px 0 0 16px">
                    <li><code>labelWidth</code> — 统一标签宽度，默认 'auto'</li>
                    <li><code>size</code> — 统一尺寸，默认 'mini'</li>
                    <li><code>minfoldRows</code> — 超过此行数自动折叠。如设为 2，则第 3 行开始折叠</li>
                    <li><code>isBtnHiden</code> — 隐藏表单按钮区（适用于弹窗内表单）</li>
                    <li><code>btnColSpan</code> — 按钮区占用的列数</li>
                  </ul>
                </td>
              </tr>
              <tr><td><code>setOptions</code></td><td>Boolean</td><td>在表格内嵌表单时，是否将表单查询条件作为表格请求参数（默认 true）</td></tr>
            </tbody>
          </table>
        </div>
      </div>

      <!-- 3.4 configBtn -->
      <div class="content-card">
        <h3>3.4 configBtn 按钮配置</h3>
        <div class="api-table-wrap">
          <table class="api-table">
            <thead><tr><th>属性</th><th>类型</th><th>说明</th></tr></thead>
            <tbody>
              <tr><td><code>name</code></td><td>String</td><td>按钮文本</td></tr>
              <tr><td><code>type</code></td><td>String</td><td>按钮类型：primary / success / warning / danger / text</td></tr>
              <tr><td><code>icon</code></td><td>String</td><td>Element UI 图标类名，如 <code>el-icon-search</code></td></tr>
              <tr><td><code>key</code></td><td>String</td><td>当 <code>triggerEvent: true</code> 时：<code>query</code> 触发表格刷新，<code>rest</code> 重置表单并刷新</td></tr>
              <tr><td><code>direction</code></td><td>String</td><td>仅 <code>btnColSpanRow: true</code> 时生效：<code>left</code> 左区 / <code>right</code>(默认) 右区</td></tr>
              <tr><td><code>triggerEvent</code></td><td>Boolean</td><td>是否触发内置事件：<code>query</code> 查询表格，<code>rest</code> 重置表单</td></tr>
              <tr><td><code>onClick</code></td><td>Function</td><td>点击回调：<code>(model, formRef, parentRefreshFn) => void</code></td></tr>
              <tr><td><code>click</code></td><td>Function</td><td>同 onClick，兼容旧版 API</td></tr>
              <tr><td><code>disabled</code></td><td>Boolean | Function</td><td>是否禁用，支持函数动态判断</td></tr>
              <tr><td><code>loading</code></td><td>Boolean</td><td>是否显示加载状态</td></tr>
              <tr><td><code>size</code></td><td>String</td><td>按钮尺寸</td></tr>
            </tbody>
          </table>
        </div>
      </div>

      <!-- 3.5 高级功能 -->
      <div class="content-card">
        <h3>3.5 高级功能</h3>

        <h4>远程数据源 (apiParams)</h4>
        <div class="code-block">
          <div class="code-header">
            <span class="code-lang">配置示例：Select 远程搜索</span>
          </div>
          <pre v-pre><code>{
  prop: 'cityId', label: '城市', span: 8, formtype: 'Select',
  attrs: { placeholder: '请选择城市', filterable: true, remote: true },
  apiParams: {
    url: '/api/cities',
    method: 'POST',
    model: { type: 'domestic' }  // 附加查询参数
  },
  listenToCallBack: {
    // 转换响应数据为选项格式
    crtn: (data) => data.map(d => ({ label: d.cityName, value: d.cityId }))
  }
}</code></pre>
        </div>

        <h4>级联刷新 (formItemRequestInstance)</h4>
        <p>当省份 Select 值改变后，需要联动刷新城市 Select 的选项：</p>
        <div class="code-block">
          <div class="code-header">
            <span class="code-lang">配置示例：省市区三级联动</span>
          </div>
          <pre v-pre><code>// 省份字段
{
  prop: 'province', label: '省份', span: 8, formtype: 'Select',
  dataOptions: [{ label: '浙江', value: 'zj' }, { label: '广东', value: 'gd' }],
  on: {
    change: (val) => {
      // 省份变化时，手动刷新城市和区县的选项
      this.$refs.myForm.formItemRequestInstance(['city', 'district'])
    }
  }
},
// 城市字段（数据源依赖省份）
{
  prop: 'city', label: '城市', span: 8, formtype: 'Select',
  apiParams: {
    url: '/api/cities',
    model: {}  // brcb 回调中动态注入 province 参数
  },
  listenToCallBack: {
    brcb: (params) => ({ ...params, province: this.searchModel.province })
  }
}</code></pre>
        </div>

        <h4>动态显示/隐藏字段</h4>
        <div class="code-block">
          <div class="code-header">
            <span class="code-lang">配置示例：条件字段</span>
          </div>
          <pre v-pre><code>{
  prop: 'rejectReason', label: '驳回原因', span: 12, formtype: 'Input',
  attrs: { type: 'textarea', rows: 3 },
  // 仅当审核状态为"驳回"时显示
  isHiden: (model) => model.auditStatus !== 'rejected'
}</code></pre>
        </div>

        <h4>自定义 Render 渲染</h4>
        <div class="code-block">
          <div class="code-header">
            <span class="code-lang">配置示例：自定义复杂控件</span>
          </div>
          <pre v-pre><code>{
  prop: 'tags', label: '标签', span: 12,
  render: (h, model, row) => {
    return h('div', { class: 'tag-editor' }, [
      ...model.tags.map(tag =>
        h('el-tag', { props: { closable: true, type: 'primary' },
                       on: { close: () => model.tags = model.tags.filter(t => t !== tag) } }, tag)
      ),
      h('el-input', {
        props: { value: '' },
        attrs: { placeholder: '输入后回车添加' },
        on: { 'keyup.enter': (e) => { model.tags.push(e.target.value); e.target.value = '' } }
      })
    ])
  }
}</code></pre>
        </div>
      </div>
    </section>

    <!-- ==================== 第四篇：EsTable 完全配置手册 ==================== -->
    <section class="section">
      <div class="section-header">
        <div class="section-icon blue">
          <i class="el-icon-s-data" />
        </div>
        <h2 class="section-title">
          第四篇：EsTable 完全配置手册
        </h2>
      </div>

      <!-- 4.0 Props -->
      <div class="content-card">
        <h3>4.0 Props 速查表</h3>
        <div class="api-table-wrap">
          <table class="api-table">
            <thead><tr><th>Prop</th><th>类型</th><th>默认值</th><th>说明</th></tr></thead>
            <tbody>
              <tr><td><code>columns</code></td><td>Array</td><td>[]</td><td>列配置数组，每个元素描述一列</td></tr>
              <tr><td><code>dataSource</code></td><td>Array</td><td>[]</td><td>表格数据源（支持 <code>.sync</code> 修饰符）</td></tr>
              <tr><td><code>options</code></td><td>Object</td><td>{}</td><td>表格选项配置（核心配置入口）</td></tr>
              <tr><td><code>pagination</code></td><td>Object</td><td>{}</td><td>分页配置：<code>{ current, pageSize, total }</code></td></tr>
              <tr><td><code>configBtn</code></td><td>Array</td><td>[]</td><td>表格顶部的操作按钮（复用 EsForm 的 configBtn 结构）</td></tr>
              <tr><td><code>showHeaderBar</code></td><td>Boolean</td><td>true</td><td>是否显示表格顶部插槽区域</td></tr>
              <tr><td><code>headBarClass</code></td><td>String | Object</td><td>''</td><td>表格顶部区域的样式类</td></tr>
              <tr>
                <td
                  colspan="4"
                  class="inherit-note"
                >
                  <em>继承全部 Element UI <code>el-table</code> Props（data, border, stripe, size, row-key, tree-props, lazy, span-method 等）</em>
                </td>
              </tr>
            </tbody>
          </table>
        </div>
      </div>

      <!-- 4.1 columns -->
      <div class="content-card">
        <h3>4.1 columns 列属性全解</h3>
        <div class="api-table-wrap">
          <table class="api-table">
            <thead><tr><th>属性</th><th>类型</th><th>说明</th></tr></thead>
            <tbody>
              <tr><td><code>key</code> / <code>prop</code></td><td>String</td><td>数据字段名，支持点号嵌套（如 <code>user.dept.name</code>），自动取值渲染</td></tr>
              <tr><td><code>label</code></td><td>String</td><td>列标题</td></tr>
              <tr><td><code>type</code></td><td>String</td><td>特殊列类型：<code>selection</code>(多选)、<code>expand</code>(展开行)、<code>index</code>(序号)</td></tr>
              <tr><td><code>width</code></td><td>Number | String</td><td>列宽，如 <code>120</code> 或 <code>'20%'</code></td></tr>
              <tr><td><code>fixed</code></td><td>String</td><td>固定列：<code>left</code> 或 <code>right</code></td></tr>
              <tr><td><code>render</code></td><td>Function</td><td>自定义单元格渲染：<code>(h, { row, index, columnIndex, instance }) => VNode</code></td></tr>
              <tr><td><code>scopedSlots</code></td><td>Object</td><td>作用域插槽：<code>{ customRender: 'slotName' }</code>，需在父组件提供同名 slot</td></tr>
              <tr><td><code>groups</code></td><td>Array</td><td>多级表头子列，递归结构，子列格式同 columns</td></tr>
              <tr><td><code>hidCol</code></td><td>Boolean</td><td>隐藏此列（不渲染 DOM）</td></tr>
              <tr><td><code>align</code></td><td>String</td><td>对齐方式：left / center / right</td></tr>
            </tbody>
          </table>
        </div>
      </div>

      <!-- 4.2 options -->
      <div class="content-card">
        <h3>4.2 options 选项属性全解</h3>

        <div class="api-table-wrap">
          <table class="api-table">
            <thead>
              <tr>
                <th style="width:18%">
                  属性
                </th><th style="width:12%">
                  类型
                </th><th style="width:12%">
                  默认值
                </th><th>说明</th>
              </tr>
            </thead>
            <tbody>
              <tr class="api-section">
                <td colspan="4">
                  <strong>基础设置</strong>
                </td>
              </tr>
              <tr><td><code>border</code></td><td>Boolean</td><td>false</td><td>是否显示边框</td></tr>
              <tr><td><code>size</code></td><td>String</td><td>'small'</td><td>表格尺寸：mini / small / medium</td></tr>
              <tr><td><code>loading</code></td><td>Boolean</td><td>false</td><td>表格加载动画</td></tr>
              <tr><td><code>headerCellStyle</code></td><td>Object</td><td>{ background: '#f5f7fa' }</td><td>表头单元格样式</td></tr>
              <tr><td><code>highlightCurrentRow</code></td><td>Boolean</td><td>true</td><td>高亮当前行</td></tr>
              <tr><td><code>rowKey</code></td><td>String</td><td>—</td><td>行唯一键值（多选缓存和树形结构必备）</td></tr>

              <tr class="api-section">
                <td colspan="4">
                  <strong>多选相关</strong>
                </td>
              </tr>
              <tr><td><code>multiSelect</code></td><td>Boolean</td><td>false</td><td>启用多选功能（会自动添加 selection 列）</td></tr>
              <tr><td><code>cachePageSelection</code></td><td>Boolean</td><td>true</td><td>跨页保持选择状态（需设置 <code>rowKey</code>）</td></tr>

              <tr class="api-section">
                <td colspan="4">
                  <strong>展开行</strong>
                </td>
              </tr>
              <tr><td><code>expand</code></td><td>Boolean</td><td>false</td><td>启用展开行功能</td></tr>
              <tr><td><code>expandRowKeys</code></td><td>Array</td><td>[]</td><td>默认展开的行 key 列表</td></tr>
              <tr><td><code>expandRender</code></td><td>Function</td><td>—</td><td>展开行内容渲染：<code>(h, { row, index, column }) => VNode</code></td></tr>

              <tr class="api-section">
                <td colspan="4">
                  <strong>树形数据</strong>
                </td>
              </tr>
              <tr><td><code>treeProps</code></td><td>Object</td><td>—</td><td>树形配置：<code>{ children: 'children', hasChildren: 'hasChildren' }</code></td></tr>
              <tr><td><code>lazy</code></td><td>Boolean</td><td>false</td><td>懒加载子节点</td></tr>
              <tr><td><code>lazyLoad</code></td><td>Function</td><td>—</td><td>懒加载回调：<code>(row, treeNode, resolve) => void</code></td></tr>
              <tr><td><code>defaultExpandAll</code></td><td>Boolean</td><td>false</td><td>默认展开全部节点</td></tr>

              <tr class="api-section">
                <td colspan="4">
                  <strong>合并单元格</strong>
                </td>
              </tr>
              <tr><td><code>spanMethod</code></td><td>Function</td><td>—</td><td>合并行/列：<code>({ row, column, rowIndex, columnIndex }) => { rowspan, colspan }</code></td></tr>

              <tr class="api-section">
                <td colspan="4">
                  <strong>序号列</strong>
                </td>
              </tr>
              <tr><td><code>snIndex</code></td><td>Boolean</td><td>false</td><td>显示序号列（会自动计算跨页序号）</td></tr>

              <tr class="api-section">
                <td colspan="4">
                  <strong>尺寸与布局</strong>
                </td>
              </tr>
              <tr><td><code>tabHeight</code></td><td>Number | String</td><td>—</td><td>表格高度（px 数值 或 <code>'100%'</code> 继承父容器）</td></tr>
              <tr><td><code>heightType</code></td><td>String</td><td>'auto'</td><td>高度模式：<code>auto</code> / <code>height</code> / <code>max-height</code></td></tr>

              <tr class="api-section">
                <td colspan="4">
                  <strong>自动数据请求</strong>
                </td>
              </tr>
              <tr><td><code>isInitRun</code></td><td>Boolean</td><td>false</td><td>组件挂载时是否自动发起首次数据请求</td></tr>
              <tr><td><code>apiParams</code></td><td>Object</td><td>—</td><td>数据请求配置：<code>{ url, method, model, headers, options }</code></td></tr>
              <tr><td><code>actionUrl</code></td><td>String</td><td>—</td><td>数据请求 URL（旧版 API，推荐使用 apiParams.url）</td></tr>
              <tr><td><code>httpRequest</code></td><td>Function</td><td>—</td><td>自定义请求函数（优先级高于全局 <code>$httpRequest</code>）</td></tr>
              <tr><td><code>configTableOut</code></td><td>Object</td><td>—</td><td>响应字段映射：<code>{ total, pageSize, current, tableData }</code></td></tr>
              <tr><td><code>listenToCallBack</code></td><td>Object</td><td>—</td><td>请求生命周期：<code>{ brcb(params), qrcb(response) }</code></td></tr>
              <tr><td><code>entryQuery</code></td><td>Object</td><td>{}</td><td>附加查询参数（合并到每次请求）</td></tr>

              <tr class="api-section">
                <td colspan="4">
                  <strong>按钮与文本</strong>
                </td>
              </tr>
              <tr><td><code>configBtn</code></td><td>Array</td><td>—</td><td>表格顶部的操作按钮数组</td></tr>
              <tr><td><code>leftText</code></td><td>String</td><td>—</td><td>按钮栏左侧显示的文本（如"已选 3 条"）</td></tr>
            </tbody>
          </table>
        </div>
      </div>

      <!-- 4.3 自动请求机制 -->
      <div class="content-card">
        <h3>4.3 自动数据请求机制详解</h3>
        <p>EsTable 的核心价值之一是<strong>声明式数据获取</strong>：只需配置 <code>apiParams</code> 和 <code>isInitRun: true</code>，组件会自动完成数据请求、分页处理、表单联动等全部逻辑。</p>
        <div class="code-block">
          <div class="code-header">
            <span class="code-lang">完整自动请求配置示例</span>
          </div>
          <pre v-pre><code>tableOpts: {
  isInitRun: true,
  apiParams: {
    url: '/api/users',
    method: 'POST',
    model: { type: 'active' }  // 固定查询条件
  },
  // 响应字段映射：告诉组件如何从响应中取数据
  configTableOut: {
    total: 'total',          // response.total → 分页总数
    pageSize: 'pageSize',    // response.pageSize → 每页条数
    current: 'pageIndex',    // response.pageIndex → 当前页
    tableData: 'data'        // response.data → 表格数据数组
  },
  // 请求生命周期拦截
  listenToCallBack: {
    // 请求前：注入 token、合并表单查询条件
    brcb: (params) => ({ ...params, token: getToken() }),
    // 响应后：数据清洗
    qrcb: (res) => {
      res.data = res.data.map(row => ({ ...row, fullName: row.firstName + ' ' + row.lastName }))
      return res
    }
  }
}</code></pre>
        </div>
        <div class="tips-box tips-box--info">
          <h4>&#128161; 字段映射的优先级</h4>
          <ol>
            <li><code>options.configTableOut</code>（组件级配置，优先级最高）</li>
            <li>全局 <code>configQueryfieldOutput()</code>（Plugin 注册时配置）</li>
            <li>内置默认值 <code>{ total: 'records', pageSize: 'pageSize', current: 'pageNo', tableData: 'rows' }</code></li>
          </ol>
        </div>
      </div>

      <!-- 4.4 表格按钮 -->
      <div class="content-card">
        <h3>4.4 configBtn 表格操作按钮</h3>
        <p>EsTable 的 configBtn 与 EsForm 共享相同的按钮配置结构，额外支持：</p>
        <div class="api-table-wrap">
          <table class="api-table">
            <thead><tr><th>属性</th><th>类型</th><th>说明</th></tr></thead>
            <tbody>
              <tr><td><code>permissionValue</code></td><td>String</td><td>权限值，用于按钮级别的权限控制</td></tr>
              <tr><td><code>isHide</code></td><td>Function | Boolean</td><td>隐藏按钮：<code>() => !hasPermission('delete')</code></td></tr>
              <tr><td><code>direction</code></td><td>String</td><td>按钮位置：<code>left</code>(左侧) 或 <code>right</code>(右侧，默认)</td></tr>
              <tr><td><code>onClick</code></td><td>Function</td><td>点击回调：<code>(dataSource, refs, refreshFn) => void</code></td></tr>
            </tbody>
          </table>
        </div>
      </div>

      <!-- 4.5 高级功能 -->
      <div class="content-card">
        <h3>4.5 高级表格功能</h3>

        <h4>多级表头</h4>
        <div class="code-block">
          <div class="code-header">
            <span class="code-lang">多级表头配置</span>
          </div>
          <pre v-pre><code>columns: [
  { key: 'id', label: 'ID', width: 80 },
  {
    label: '个人信息',  // 父级表头
    groups: [
      { key: 'name', label: '姓名' },
      { key: 'age', label: '年龄' },
      { key: 'gender', label: '性别' }
    ]
  },
  {
    label: '工作信息',
    groups: [
      { key: 'department', label: '部门' },
      { key: 'position', label: '职位' }
    ]
  }
]</code></pre>
        </div>

        <h4>自定义列渲染（render 函数）</h4>
        <div class="code-block">
          <div class="code-header">
            <span class="code-lang">render 函数示例</span>
          </div>
          <pre v-pre><code>columns: [
  {
    key: 'status', label: '状态',
    render: (h, { row }) => {
      const map = { '1': { type: 'success', text: '启用' }, '0': { type: 'info', text: '禁用' } }
      const item = map[row.status] || { type: 'info', text: '未知' }
      return h('el-tag', { props: { type: item.type, size: 'small' } }, item.text)
    }
  },
  {
    key: 'action', label: '操作', width: 200, fixed: 'right',
    render: (h, { row }) => h('div', [
      h('el-button', { props: { type: 'text' }, on: { click: () => this.handleEdit(row) } }, '编辑'),
      h('el-button', { props: { type: 'text' }, on: { click: () => this.handleDelete(row) } }, '删除')
    ])
  }
]</code></pre>
        </div>

        <h4>跨页多选记忆</h4>
        <div class="code-block">
          <div class="code-header">
            <span class="code-lang">跨页选择配置</span>
          </div>
          <pre v-pre><code>tableOpts: {
  multiSelect: true,
  cachePageSelection: true,
  rowKey: 'id'  // 必须设置，用于跨页去重
}</code></pre>
        </div>

        <h4>树形表格 + 懒加载</h4>
        <div class="code-block">
          <div class="code-header">
            <span class="code-lang">树形表格配置</span>
          </div>
          <pre v-pre><code>tableOpts: {
  treeProps: { children: 'children', hasChildren: 'hasChildren' },
  lazy: true,
  lazyLoad: (row, treeNode, resolve) => {
    // row 为当前行数据，调用 resolve(childrenArray) 加载子节点
    axios.get(`/api/departments/${row.id}/children`).then(res => {
      resolve(res.data)
    })
  }
}</code></pre>
        </div>

        <h4>合并单元格</h4>
        <div class="code-block">
          <div class="code-header">
            <span class="code-lang">合并单元格配置</span>
          </div>
          <pre v-pre><code>tableOpts: {
  spanMethod: ({ row, column, rowIndex, columnIndex }) => {
    // 第一列：按部门合并（每 3 行合并为一个单元格）
    if (columnIndex === 0) {
      if (rowIndex % 3 === 0) return { rowspan: 3, colspan: 1 }
      return { rowspan: 0, colspan: 0 }
    }
  }
}</code></pre>
        </div>
      </div>
    </section>

    <!-- ==================== 第五篇：useDialog 完全配置手册 ==================== -->
    <section class="section">
      <div class="section-header">
        <div class="section-icon orange">
          <i class="el-icon-s-claim" />
        </div>
        <h2 class="section-title">
          第五篇：useDialog 完全配置手册
        </h2>
      </div>

      <div class="content-card">
        <h3>5.1 useDialog 使用模式</h3>
        <p><code>useDialog</code> 是一个<strong>工厂函数</strong>，调用后返回一个 <code>createDialog</code> 函数。每次调用 <code>createDialog(options)</code> 会在页面上动态创建一个 EsDialog 实例。</p>
        <div class="code-block">
          <div class="code-header">
            <span class="code-lang">基本用法</span>
          </div>
          <pre v-pre><code>import { useDialog } from '@es-plus/vue2'

export default {
  methods: {
    openEditDialog(row) {
      const dialog = useDialog()
      const { close } = dialog({
        title: '编辑用户',
        width: '600px',
        render: (h) => (
          &lt;es-form
            ref="editForm"
            form-item-list={this.editFormConfig}
            model={this.editModel}
          /&gt;
        ),
        configBtn: [
          { name: '取消', type: 'text', onClick: (vm, { close }) => close() },
          { name: '保存', type: 'primary', onClick: (vm, { close, getRefs }) => {
            const form = getRefs('editForm')
            form.validate((valid) => {
              if (valid) { this.handleSave(); close() }
            })
          }}
        ]
      })
    }
  }
}</code></pre>
        </div>
      </div>

      <div class="content-card">
        <h3>5.2 完整配置参数</h3>
        <div class="api-table-wrap">
          <table class="api-table">
            <thead>
              <tr>
                <th style="width:18%">
                  参数
                </th><th style="width:12%">
                  类型
                </th><th style="width:12%">
                  默认值
                </th><th>说明</th>
              </tr>
            </thead>
            <tbody>
              <tr><td><code>key</code></td><td>String</td><td>'__default__'</td><td>弹窗唯一标识。同一 key 的弹窗只会创建一次（第二次调用返回已缓存的实例，可用于防止重复弹窗或恢复已关闭弹窗）</td></tr>
              <tr><td><code>title</code></td><td>String</td><td>''</td><td>弹窗标题</td></tr>
              <tr><td><code>width</code></td><td>String</td><td>'50%'</td><td>弹窗宽度</td></tr>
              <tr><td><code>height</code></td><td>String</td><td>''</td><td>弹窗高度</td></tr>
              <tr><td><code>maxHeight</code></td><td>String</td><td>''</td><td>弹窗最大高度</td></tr>
              <tr><td><code>fullscreen</code></td><td>Boolean</td><td>false</td><td>是否全屏显示</td></tr>
              <tr><td><code>center</code></td><td>Boolean</td><td>true</td><td>标题是否居中</td></tr>
              <tr><td><code>closeOnClickModal</code></td><td>Boolean</td><td>false</td><td>点击遮罩是否关闭</td></tr>
              <tr><td><code>closeOnPressEscape</code></td><td>Boolean</td><td>false</td><td>按 ESC 是否关闭</td></tr>
              <tr><td><code>showClose</code></td><td>Boolean</td><td>true</td><td>是否显示右上角关闭按钮</td></tr>
              <tr><td><code>lockScroll</code></td><td>Boolean</td><td>true</td><td>弹窗打开时是否锁定 body 滚动</td></tr>
              <tr><td><code>modal</code></td><td>Boolean</td><td>true</td><td>是否显示遮罩层</td></tr>
              <tr><td><code>modalAppendToBody</code></td><td>Boolean</td><td>true</td><td>遮罩是否插入到 body</td></tr>
              <tr><td><code>appendToBody</code></td><td>Boolean</td><td>true</td><td>弹窗本体是否插入到 body</td></tr>
              <tr><td><code>destroyOnClose</code></td><td>Boolean</td><td>true</td><td>关闭时销毁 DOM（涉及内存释放，一般保持 true）</td></tr>
              <tr><td><code>showDefaultButtons</code></td><td>Boolean</td><td>false</td><td>是否显示默认的取消/确认按钮</td></tr>
              <tr><td><code>isDraggable</code></td><td>Boolean</td><td>false</td><td>是否启用拖拽功能</td></tr>
              <tr><td><code>hiddenFullBtn</code></td><td>Boolean</td><td>false</td><td>是否隐藏全屏按钮</td></tr>
              <tr><td><code>loading</code></td><td>Boolean</td><td>false</td><td>是否显示加载状态</td></tr>
              <tr><td><code>render</code></td><td>Function</td><td>—</td><td>弹窗内容渲染函数：<code>(createElement) => VNode</code>。支持 JSX</td></tr>
              <tr><td><code>configBtn</code></td><td>Array</td><td>[]</td><td>弹窗底部按钮配置</td></tr>
              <tr><td><code>onSubmit</code></td><td>Function</td><td>—</td><td>默认按钮"确认"的回调（需 <code>showDefaultButtons: true</code>）</td></tr>
              <tr><td><code>onOpen</code></td><td>Function</td><td>—</td><td>弹窗打开时的回调</td></tr>
              <tr><td><code>onClosed</code></td><td>Function</td><td>—</td><td>弹窗关闭后的回调</td></tr>
            </tbody>
          </table>
        </div>
      </div>

      <div class="content-card">
        <h3>5.3 configBtn 回调参数</h3>
        <p>useDialog 的 configBtn 中，<code>onClick</code> 回调接收三个参数：</p>
        <table class="api-table">
          <thead><tr><th>参数</th><th>类型</th><th>说明</th></tr></thead>
          <tbody>
            <tr><td><code>vm</code></td><td>VueComponent</td><td>render 函数返回的最外层组件实例（可通过 vm.$refs 访问内部 ref）</td></tr>
            <tr><td><code>{ close }</code></td><td>Object</td><td><code>close()</code> 方法用于关闭弹窗并销毁实例</td></tr>
            <tr><td><code>{ getRefs }</code></td><td>Object</td><td><code>getRefs(refName)</code> 获取内部组件的 ref 实例</td></tr>
            <tr><td><code>{ dialogVm }</code></td><td>Object</td><td>EsDialog 组件的 Vue 实例</td></tr>
          </tbody>
        </table>
      </div>

      <div class="content-card">
        <h3>5.4 实例缓存机制</h3>
        <p>useDialog 通过 <code>key</code> 参数支持实例缓存。相同 <code>key</code> 的弹窗只会创建一个 Vue 实例，重复调用会返回已缓存的实例（而不是创建新弹窗）。</p>
        <div class="tips-box tips-box--success">
          <h4>&#128161; 缓存使用技巧</h4>
          <ul>
            <li><strong>不同内容弹窗</strong>：使用不同的 <code>key</code>，如 <code>'edit-' + row.id</code></li>
            <li><strong>防止重复弹窗</strong>：使用固定 <code>key</code>，第二次调用不会创建新窗口</li>
            <li><strong>相同 key 返回</strong>：<code>{ close, instance }</code>，可以通过 <code>instance.$emit('update:visible', true)</code> 重新显示</li>
          </ul>
        </div>
      </div>
    </section>

    <!-- ==================== 第六篇：组件联动模式 ==================== -->
    <section class="section">
      <div class="section-header">
        <div class="section-icon green">
          <i class="el-icon-connection" />
        </div>
        <h2 class="section-title">
          第六篇：组件联动模式
        </h2>
      </div>

      <div class="content-card">
        <h3>6.1 EsForm + EsTable 查询联动</h3>
        <p>EsForm 嵌套在 EsTable 的默认插槽中时，表单的查询/重置按钮会自动触发表格的数据刷新。</p>
        <div class="code-block">
          <div class="code-header">
            <span class="code-lang">查询联动模板</span>
          </div>
          <pre v-pre><code>&lt;es-table
  :columns="columns"
  :options="tableOpts"
  :pagination="pagination"
  :data-source.sync="dataSource"
&gt;
  &lt;!-- 插槽中的 EsForm 会自动被 EsTable 检测到 --&gt;
  &lt;es-form
    :form-item-list="searchForm"
    :model="searchModel"
    :config-btn="[
      { name: '查询', key: 'query', triggerEvent: true, type: 'primary', icon: 'el-icon-search' },
      { name: '重置', key: 'rest', triggerEvent: true, icon: 'el-icon-refresh' }
    ]"
  /&gt;
&lt;/es-table&gt;</code></pre>
        </div>
        <div class="tips-box tips-box--info">
          <h4>&#128161; 联动原理</h4>
          <ol>
            <li>EsTable 通过 <code>findForm(child.$children)</code> 递归查找子组件树中 <code>$options.name === 'EsForm'</code> 的组件</li>
            <li>EsForm 按钮设置 <code>triggerEvent: true</code> + <code>key: 'query'</code> 时，调用 <code>$parent.httpRquestInstace(model)</code></li>
            <li>EsTable 自动将表单的 <code>model</code> 数据合并到 <code>apiParams</code> 请求参数中</li>
          </ol>
        </div>
      </div>

      <div class="content-card">
        <h3>6.2 useDialog + EsForm + EsTable 完整 CRUD</h3>
        <p>这是企业开发中最常用的组合模式：表格展示数据 + 表单搜索过滤 + 弹窗编辑新增。</p>
        <div class="code-block">
          <div class="code-header">
            <span class="code-lang">完整 CRUD 示例</span>
          </div>
          <pre v-pre><code>
  export default {
  methods: {
    // 打开新增/编辑弹窗
    openFormDialog(row = null) {
      const isEdit = !!row
      const dialog = useDialog()
      this.dialogInstance = dialog({
        key: isEdit ? `edit-${row.id}` : 'add',
        title: isEdit ? '编辑' : '新增',
        width: '800px',
        render: (h) => (
          &lt;es-form
            ref="crudForm"
            form-item-list={this.getFormConfig(isEdit)}
            model={isEdit ? { ...row } : this.getDefaultModel()}
          /&gt;
        ),
        configBtn: [
          { name: '取消', type: 'text', onClick: (vm, { close }) => close() },
          { name: '保存', type: 'primary', loading: this.saving,
            onClick: async (vm, { close, getRefs }) => {
              const form = getRefs('crudForm')
              const valid = await form.validate().catch(() => false)
              if (valid) {
                await this.handleSave()
                this.$message.success('保存成功')
                close()
                // 刷新表格
                this.$refs.mainTable.httpRquestInstace()
              }
            }
          }
        ]
      })
    }
  }
}</code></pre>
        </div>
      </div>

      <div class="content-card">
        <h3>6.3 组件通信模式总结</h3>
        <div class="comm-diagram">
          <div
            v-for="(item, i) in commPatterns"
            :key="i"
            class="comm-item"
          >
            <div class="comm-number">
              {{ i + 1 }}
            </div>
            <div class="comm-body">
              <strong>{{ item.title }}</strong>
              <p>{{ item.desc }}</p>
              <code v-pre>{{ item.code }}</code>
            </div>
          </div>
        </div>
      </div>
    </section>

    <!-- ==================== 附录 ==================== -->
    <section class="section">
      <div class="section-header">
        <div class="section-icon blue">
          <i class="el-icon-collection-tag" />
        </div>
        <h2 class="section-title">
          附录：配置项速查总表
        </h2>
      </div>

      <div class="content-card">
        <h3>A. 全局配置项</h3>
        <div class="api-table-wrap">
          <table class="api-table">
            <thead><tr><th>配置项</th><th>组件</th><th>类型</th><th>必填</th><th>说明</th></tr></thead>
            <tbody>
              <tr><td><code>$httpRequest</code></td><td>EsTable</td><td>Function</td><td>&#10003;</td><td>表格数据请求方法</td></tr>
              <tr><td><code>$httpRequest</code></td><td>EsForm</td><td>Function</td><td>&#10003;</td><td>表单远程数据请求方法</td></tr>
              <tr><td><code>paginationLayout</code></td><td>EsTable</td><td>Function</td><td></td><td>分页布局：返回 <code>{ layout, pageSizes, isSmall, background }</code></td></tr>
              <tr><td><code>configQueryfieldOutput</code></td><td>EsTable</td><td>Function</td><td></td><td>表格响应字段映射：返回 <code>{ total, pageSize, current, tableData }</code></td></tr>
              <tr><td><code>fieldFieldOutput</code></td><td>EsForm</td><td>Function</td><td></td><td>表单响应字段映射：返回 <code>{ total, pageSize, current, listData }</code></td></tr>
            </tbody>
          </table>
        </div>
      </div>

      <div class="content-card">
        <h3>B. formtype 内置控件速查</h3>
        <div class="type-grid">
          <div
            v-for="ft in formTypes"
            :key="ft.name"
            class="type-card"
          >
            <div class="type-name">
              {{ ft.name }}
            </div>
            <div class="type-comp">
              {{ ft.comp }}
            </div>
            <div class="type-desc">
              {{ ft.desc }}
            </div>
          </div>
        </div>
      </div>
    </section>
  </div>
</template>

<script>
export default {
  name: 'EsEuiDeveloperGuide',
  data() {
    return {
      pipeSteps: [
        { name: 'brcb(params)', desc: '请求前参数转换。接收合并后的请求参数，返回最终参数' },
        { name: 'httpRquestInstace()', desc: '调用 $httpRequest 或 options.httpRequest 发起 HTTP 请求' },
        { name: 'formatConfigout(res)', desc: '按 configTableOut / configFormOut 映射响应字段' },
        { name: 'qrcb(res)', desc: '响应后数据回调。可在渲染前修改数据结构' },
        { name: '更新 dataSource', desc: '表格数据 + 分页信息更新到组件状态，触发重新渲染' }
      ],
      keyMechanisms: [
        { title: '查询/重置自动联动', desc: 'EsForm 按钮设置 triggerEvent: true + key: query/rest，自动触发 EsTable 的数据刷新，无需手动调用方法。' },
        { title: '表单参数自动合并', desc: 'EsTable 查找插槽中的 EsForm 实例，自动将表单 model 合并到每次 API 请求的 formParams 中。' },
        { title: '分页状态自动维护', desc: '配置 pagination + apiParams 后，翻页、切换每页条数时自动携带正确的 pageIndex / pageSize 参数请求数据。' },
        { title: '响应字段自动映射', desc: 'configTableOut 配置将不同后端的响应格式映射为统一的 tableData + 分页字段，前端代码零适配。' }
      ],
      commPatterns: [
        { title: '表单查询 → 表格刷新', desc: '通过 triggerEvent 自动触发，无需手动写查询逻辑', code: 'key: "query", triggerEvent: true' },
        { title: '表格选择 → 弹窗操作', desc: 'handleSelectionChange 记录选中行，传入弹窗', code: '@selection-change="handleSelectionChange"' },
        { title: '弹窗保存 → 表格刷新', desc: '关闭弹窗后调用表格的 httpRquestInstace() 刷新', code: 'this.$refs.mainTable.httpRquestInstace()' },
        { title: '弹窗保存 → 表单刷新', desc: '关闭新增弹窗后刷新查询表单的重置方法', code: 'this.$refs.searchForm.resetFields()' }
      ],
      formTypes: [
        { name: 'Input', comp: 'el-input', desc: '文本输入框' },
        { name: 'InputNumber', comp: 'el-input-number', desc: '数字输入框' },
        { name: 'Select', comp: 'el-select', desc: '下拉选择器' },
        { name: 'DatePicker', comp: 'el-date-picker', desc: '日期选择器' },
        { name: 'TimePicker', comp: 'el-time-picker', desc: '时间选择器' },
        { name: 'Cascader', comp: 'el-cascader', desc: '级联选择器' },
        { name: 'Radio', comp: 'el-radio-group', desc: '单选按钮组' },
        { name: 'Checkbox', comp: 'el-checkbox-group', desc: '多选按钮组' },
        { name: 'Switch', comp: 'el-switch', desc: '开关' },
        { name: 'Rate', comp: 'el-rate', desc: '评分' },
        { name: 'Upload', comp: 'el-upload', desc: '文件上传' }
      ]
    }
  }
}
</script>

<style lang="scss" scoped>
$primary: #409eff;
$success: #67c23a;
$warning: #e6a23c;
$danger: #f56c6c;
$text-primary: #1a1a1a;
$text-secondary: #4a5568;
$text-tertiary: #718096;
$border-color: #e2e8f0;
$bg-light: #f7fafc;

.dev-guide-page {
  max-width: 1000px;
  margin: 0 auto;
  padding: 40px 24px;
  color: $text-primary;
  line-height: 1.8;
}

// Hero
.hero-section {
  text-align: center;
  padding: 60px 20px;
  background: linear-gradient(135deg, #1a1a2e 0%, #16213e 50%, #0f3460 100%);
  border-radius: 20px;
  margin-bottom: 50px;
  color: white;
  .hero-badge {
    display: inline-flex; align-items: center; gap: 8px;
    padding: 8px 20px; background: rgba(255,255,255,0.12);
    border-radius: 50px; font-size: 14px; margin-bottom: 20px;
  }
  .hero-title { font-size: 38px; font-weight: 700; margin: 0 0 16px; }
  .hero-desc { max-width: 600px; color: #fff; margin: 0 auto; font-size: 16px; opacity: 0.85;  p {
      color: #fff;
  }}
}

// Section
.section { margin-bottom: 50px; }
.section-header {
  display: flex; align-items: center; gap: 12px; margin-bottom: 20px;
  .section-icon {
    width: 40px; height: 40px; border-radius: 10px;
    display: flex; align-items: center; justify-content: center;
    font-size: 18px; color: white;
    &.blue { background: linear-gradient(135deg, #667eea 0%, #764ba2 100%); }
    &.purple { background: linear-gradient(135deg, #f093fb 0%, #f5576c 100%); }
    &.green { background: linear-gradient(135deg, #4facfe 0%, #00f2fe 100%); }
    &.orange { background: linear-gradient(135deg, #fa709a 0%, #fee140 100%); }
  }
  .section-title { font-size: 24px; font-weight: 600; margin: 0; }
}
.section-desc { font-size: 15px; color: $text-secondary; margin: 0 0 24px; }

// Content Card
.content-card {
  background: white; border-radius: 12px; border: 1px solid $border-color;
  padding: 28px; margin-bottom: 24px;
  &:hover { box-shadow: 0 4px 20px rgba(0,0,0,0.06); }
  h3 {
    font-size: 18px; font-weight: 600; margin: 0 0 12px;
    padding-bottom: 8px; border-bottom: 2px solid $primary;
  }
  h4 { font-size: 16px; font-weight: 600; margin: 24px 0 12px; color: $text-primary; }
  p { font-size: 14px; color: $text-secondary; margin: 0 0 12px; line-height: 1.7; }
}

// Architecture Diagram
.arch-diagram {
  margin: 20px 0; border: 1px solid $border-color; border-radius: 12px; overflow: hidden;
  &.small { max-width: 700px; margin: 16px auto; }
  .arch-layer {
    padding: 16px 20px;
    .layer-label { font-weight: 600; font-size: 14px; margin-bottom: 8px; }
    .layer-items { display: flex; flex-wrap: wrap; gap: 8px; }
    .layer-item {
      padding: 4px 12px; border-radius: 6px;
      font-size: 12px; font-family: 'Consolas', monospace;
    }
    .layer-detail { font-size: 13px; color: $text-secondary; line-height: 1.6; white-space: pre-line; margin-top: 8px; }
    &.config-layer {
      background: #f0f7ff;
      .layer-label { color: $primary; }
      .layer-item { background: #d6e4ff; color: #1e40af; }
    }
    &.engine-layer {
      background: #fdf2f8;
      .layer-label { color: #db2777; }
      .layer-item { background: #fce7f3; color: #9d174d; }
    }
    &.ui-layer {
      background: #f0fdf4;
      .layer-label { color: #16a34a; }
      .layer-item { background: #dcfce7; color: #15803d; }
    }
  }
  .arch-arrow {
    text-align: center; padding: 10px; font-size: 16px;
    color: $text-tertiary; background: $bg-light; font-weight: 500;
  }
}

// Pipe Diagram
.pipe-diagram {
  display: flex; gap: 0; margin: 16px 0; flex-wrap: wrap;
  .pipe-step {
    flex: 1; min-width: 140px; text-align: center; padding: 16px 8px;
    background: $bg-light; border: 1px solid $border-color;
    position: relative;
    &:not(:last-child)::after {
      content: '→'; position: absolute; right: -12px; top: 50%;
      transform: translateY(-50%); font-size: 24px; color: $primary; z-index: 1;
    }
    .pipe-num {
      width: 28px; height: 28px; border-radius: 50%;
      background: $primary; color: white; display: flex;
      align-items: center; justify-content: center;
      font-size: 14px; font-weight: 600; margin: 0 auto 8px;
    }
    .pipe-name { font-weight: 600; font-size: 13px; color: $text-primary; font-family: 'Consolas', monospace; }
    .pipe-desc { font-size: 12px; color: $text-tertiary; margin-top: 4px; }
  }
}

// Code Block
.code-block {
  background: #1e1e1e; border-radius: 10px; overflow: hidden; margin: 16px 0;
  .code-header {
    display: flex; justify-content: space-between; align-items: center;
    padding: 10px 14px; background: #2d2d2d; border-bottom: 1px solid #3d3d3d;
    .code-lang { font-size: 12px; color: #9cdcfe; font-weight: 500; }
  }
  pre {
    margin: 0; padding: 16px; overflow-x: auto; font-size: 13px; line-height: 1.65;
    code { font-family: 'Fira Code', 'Consolas', monospace; }
  }
}

// API Table
.api-table-wrap { overflow-x: auto; margin: 16px 0; }
.api-table {
  width: 100%; border-collapse: collapse; font-size: 13px;
  th, td {
    padding: 10px 14px; text-align: left; border-bottom: 1px solid $border-color;
    vertical-align: top;
  }
  th {
    font-weight: 600; color: $text-primary; background: $bg-light;
    white-space: nowrap;
  }
  td { color: $text-secondary; line-height: 1.6; }
  tbody tr:hover { background: $bg-light; }
  .inherit-note { color: $text-tertiary; font-size: 12px; }
  .api-section td { background: #f8fafc; color: $text-primary; font-size: 13px; padding: 8px 14px; }
}

// Badges
.badge {
  display: inline-block; padding: 2px 8px; border-radius: 4px; font-size: 12px; font-weight: 500;
  &.required { background: #fff1f0; color: #ff4d4f; }
  &.optional { background: #f6ffed; color: #52c41a; }
  &.conditional { background: #fff7e6; color: #fa8c16; }
}

// Tips
.tips-box {
  padding: 16px 20px; border-radius: 10px; margin: 16px 0;
  h4 { margin: 0 0 8px !important; font-size: 15px !important; }
  ul, ol { margin: 0; padding-left: 20px; font-size: 13px; color: $text-secondary; line-height: 1.8; }
  code { background: rgba(0,0,0,0.06); padding: 1px 6px; border-radius: 4px; font-size: 12px; }
}
.tips-box--info { background: #f0f7ff; border-left: 4px solid $primary; }
.tips-box--success { background: #f6ffed; border-left: 4px solid $success; }
.tips-box--warning { background: #fffbe6; border-left: 4px solid $warning; }
.tip-card {
  display: flex; gap: 12px; padding: 16px 20px; border-radius: 10px; margin-top: 16px;
  &--info { background: #f0f7ff; border-left: 4px solid $primary; }
  .tip-icon { flex-shrink: 0; color: $primary; font-size: 18px; }
  .tip-content { font-size: 14px; color: $text-secondary; line-height: 1.6; strong { color: $text-primary; margin-right: 8px; } }
}

// Info Grid
.info-grid { display: grid; grid-template-columns: 1fr 1fr; gap: 16px; }
.info-item {
  display: flex; gap: 12px; padding: 16px; background: $bg-light; border-radius: 10px;
  .info-item-icon {
    width: 28px; height: 28px; border-radius: 50%; background: $primary;
    color: white; display: flex; align-items: center; justify-content: center;
    font-size: 14px; font-weight: 600; flex-shrink: 0; margin-top: 2px;
  }
  strong { font-size: 14px; color: $text-primary; }
  p { font-size: 13px; color: $text-secondary; margin: 4px 0 0; line-height: 1.6; }
}

// Type Grid
.type-grid { display: grid; grid-template-columns: repeat(auto-fill, minmax(140px, 1fr)); gap: 12px; margin-top: 12px; }
.type-card {
  padding: 12px; background: $bg-light; border-radius: 8px; text-align: center; border: 1px solid $border-color;
  .type-name { font-weight: 600; font-size: 14px; color: $primary; font-family: 'Consolas', monospace; }
  .type-comp { font-size: 12px; color: $text-tertiary; margin: 4px 0; }
  .type-desc { font-size: 12px; color: $text-secondary; }
}

// Comm Diagram
.comm-diagram { display: flex; flex-direction: column; gap: 12px; }
.comm-item {
  display: flex; gap: 16px; padding: 16px; background: $bg-light; border-radius: 10px; border-left: 4px solid $primary;
  .comm-number {
    width: 32px; height: 32px; border-radius: 50%; background: $primary;
    color: white; display: flex; align-items: center; justify-content: center;
    font-size: 16px; font-weight: 600; flex-shrink: 0;
  }
  .comm-body {
    strong { font-size: 14px; color: $text-primary; display: block; margin-bottom: 4px; }
    p { font-size: 13px; color: $text-secondary; margin: 0 0 6px; }
    code { font-size: 12px; color: $primary; background: white; padding: 2px 8px; border-radius: 4px; }
  }
}

// Responsive
@media (max-width: 768px) {
  .dev-guide-page { padding: 20px 16px; }
  .hero-section { padding: 40px 20px; .hero-title { font-size: 28px; } }
  .content-card { padding: 20px; }
  .pipe-diagram { flex-direction: column; .pipe-step::after { display: none; } }
  .info-grid { grid-template-columns: 1fr; }
  .type-grid { grid-template-columns: repeat(auto-fill, minmax(120px, 1fr)); }
}
</style>
