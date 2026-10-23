<template>
  <div class="docs-container">
    <!-- Hero Section -->
    <section class="modern-hero">
      <div class="hero-badge">
        <i class="el-icon-s-data" />
        <span>核心组件</span>
      </div>
      <h1 class="hero-title">EsTable 表格组件</h1>
      <p class="hero-desc">
        企业级高性能表格组件，支持自动数据请求、分页管理、列渲染、条件查询联动等特性，
        取数、翻页、查询联动的胶水代码全部交给配置接管
      </p>
    </section>

    <!-- 使用示例 -->
    <section class="modern-section">
      <div class="section-header">
        <div class="section-icon" style="background: linear-gradient(135deg, var(--es-brand-primary) 0%, var(--es-brand-accent) 100%);">
          <i class="el-icon-s-grid" />
        </div>
        <h2 class="section-title">使用示例</h2>
      </div>
      <CodePlayground
        v-for="ex in tableExamples"
        :key="ex.key"
        :title="ex.title"
        :description="ex.description"
        :code="getRawCode('table', ex.key)"
      >
        <template #preview>
          <component :is="getComponent('table', ex.key)" v-if="getComponent('table', ex.key)" />
          <div v-else class="placeholder-preview">
            <el-alert :title="'示例: ' + ex.title" type="info" :closable="false" />
          </div>
        </template>
      </CodePlayground>
    </section>

    <!-- API Documentation Section -->
    <section class="modern-section">
      <div class="section-header">
        <div class="section-icon orange">
          <i class="el-icon-document" />
        </div>
        <h2 class="section-title">API 文档</h2>
      </div>

      <h3>Props</h3>
    <table class="table-props">
      <thead>
        <tr>
          <th>参数</th>
          <th>说明</th>
          <th>类型</th>
          <th>默认值</th>
        </tr>
      </thead>
      <tbody>
        <tr>
          <td>dataSource</td>
          <td>表格数据源（接口请求场景下表格内部自管 tableData，外部仅需单向传入即可）</td>
          <td>Array</td>
          <td>[]</td>
        </tr>
        <tr>
          <td>columns</td>
          <td>列配置数组</td>
          <td>Array</td>
          <td>[]</td>
        </tr>
        <tr>
          <td>pagination</td>
          <td>分页配置 { pageIndex, pageSize, total }</td>
          <td>Object</td>
          <td>{}</td>
        </tr>
        <tr>
          <td>options</td>
          <td>表格选项配置（详见下方 Options 配置）</td>
          <td>Object</td>
          <td>{}</td>
        </tr>
        <tr>
          <td>initTabHeight</td>
          <td>初始表格高度（px）；容器高度变化时由 ResizeObserver 接管</td>
          <td>Number</td>
          <td>400</td>
        </tr>
        <tr>
          <td>showHeaderBar</td>
          <td>是否显示表格顶部插槽区域（default 插槽 / 工具栏按钮所在行）</td>
          <td>Boolean</td>
          <td>true</td>
        </tr>
        <tr>
          <td>headBarClass</td>
          <td>顶部区域的样式类（字符串或对象，原样透传给元素 class）</td>
          <td>String | Object</td>
          <td>''</td>
        </tr>
      </tbody>
    </table>

    <h3>Options 配置</h3>
    <table class="table-props">
      <thead>
        <tr>
          <th>参数</th>
          <th>说明</th>
          <th>类型</th>
          <th>默认值</th>
        </tr>
      </thead>
      <tbody>
        <tr>
          <td>border</td>
          <td>是否显示边框</td>
          <td>Boolean</td>
          <td>false</td>
        </tr>
        <tr>
          <td>stripe</td>
          <td>斑马纹</td>
          <td>Boolean</td>
          <td>false</td>
        </tr>
        <tr>
          <td>size</td>
          <td>表格尺寸：large / medium / small / mini</td>
          <td>String</td>
          <td>'small'</td>
        </tr>
        <tr>
          <td>headerCellStyle</td>
          <td>表头单元格样式</td>
          <td>Object</td>
          <td>-</td>
        </tr>
        <tr>
          <td>headerCellClassName</td>
          <td>表头单元格类名</td>
          <td>String / Function</td>
          <td>-</td>
        </tr>
        <tr>
          <td>highlightCurrentRow</td>
          <td>高亮当前行</td>
          <td>Boolean</td>
          <td>true</td>
        </tr>
        <tr>
          <td>showHeader</td>
          <td>是否显示表头</td>
          <td>Boolean</td>
          <td>true</td>
        </tr>
        <tr>
          <td>emptyText</td>
          <td>空数据时的占位文本</td>
          <td>String</td>
          <td>-</td>
        </tr>
        <tr>
          <td>multiSelect</td>
          <td>是否支持多选</td>
          <td>Boolean</td>
          <td>false</td>
        </tr>
        <tr>
          <td>expand</td>
          <td>启用展开行</td>
          <td>Boolean</td>
          <td>false</td>
        </tr>
        <tr>
          <td>snIndex</td>
          <td>显示序号列</td>
          <td>Boolean</td>
          <td>false</td>
        </tr>
        <tr>
          <td>loading</td>
          <td>加载态</td>
          <td>Boolean</td>
          <td>false</td>
        </tr>
        <tr>
          <td>cachePageSelection</td>
          <td>跨页记忆选中项（需配 rowkey）</td>
          <td>Boolean</td>
          <td>true</td>
        </tr>
        <tr>
          <td>heightType</td>
          <td>高度类型：'auto' | 'height' | 'maxHeight'</td>
          <td>String</td>
          <td>'auto'</td>
        </tr>
        <tr>
          <td>tabHeight</td>
          <td>表格容器高度，配合 heightType 使用</td>
          <td>Number / String</td>
          <td>-</td>
        </tr>
        <tr>
          <td>height</td>
          <td>固定高度（tabHeight 的别名，heightType: 'height' 时生效）</td>
          <td>Number / String</td>
          <td>-</td>
        </tr>
        <tr>
          <td>rowkey</td>
          <td>行唯一标识字段名（跨页选择 / 虚拟滚动必填）</td>
          <td>String</td>
          <td>-</td>
        </tr>
        <tr>
          <td>rowClassName</td>
          <td>行类名，支持 ({ row, rowIndex }) =&gt; String</td>
          <td>String / Function</td>
          <td>-</td>
        </tr>
        <tr>
          <td>rowStyle</td>
          <td>行内样式，支持 ({ row, rowIndex }) =&gt; Object</td>
          <td>Object / Function</td>
          <td>-</td>
        </tr>
        <tr>
          <td>defaultSort</td>
          <td>默认排序 { prop, order: 'ascending' | 'descending' }</td>
          <td>Object</td>
          <td>-</td>
        </tr>
        <tr>
          <td>spanMethod</td>
          <td>合并单元格 ({ row, column, rowIndex, columnIndex }) =&gt; [rowspan, colspan]</td>
          <td>Function</td>
          <td>-</td>
        </tr>
        <tr>
          <td>cellClassName</td>
          <td>单元格类名</td>
          <td>String / Function</td>
          <td>-</td>
        </tr>
        <tr>
          <td>cellStyle</td>
          <td>单元格样式</td>
          <td>Object / Function</td>
          <td>-</td>
        </tr>
        <tr>
          <td>isInitRun</td>
          <td>初始化时是否自动请求</td>
          <td>Boolean</td>
          <td>false</td>
        </tr>
        <tr>
          <td>actionUrl</td>
          <td>请求地址（apiParams.url 的简写）</td>
          <td>String</td>
          <td>-</td>
        </tr>
        <tr>
          <td>apiParams</td>
          <td>自动请求配置 { url, method, model, headers, options }</td>
          <td>Object</td>
          <td>-</td>
        </tr>
        <tr>
          <td>httpRequest</td>
          <td>自定义请求函数 (params) =&gt; Promise</td>
          <td>Function</td>
          <td>-</td>
        </tr>
        <tr>
          <td>listenToCallBack</td>
          <td>请求生命周期 { brcb: (params)=&gt;{}, qrcb: (res)=&gt;{} }</td>
          <td>Object</td>
          <td>-</td>
        </tr>
        <tr>
          <td>configTableOut</td>
          <td>响应字段映射 { total, pageSize, current, tableData }</td>
          <td>Object</td>
          <td>-</td>
        </tr>
        <tr>
          <td>entryQuery</td>
          <td>并入每次请求体的固定参数</td>
          <td>Object</td>
          <td>-</td>
        </tr>
        <tr>
          <td>refetchKeepPage</td>
          <td>请求式刷新时保留当前页码</td>
          <td>Boolean</td>
          <td>false</td>
        </tr>
        <tr>
          <td>localPagination</td>
          <td>本地分页（对已加载数据切片，不发请求）</td>
          <td>Boolean</td>
          <td>false</td>
        </tr>
        <tr>
          <td>configBtn</td>
          <td>表格顶部操作按钮（它是 TableOptions 的键，不是组件 prop）</td>
          <td>BtnConfig[]</td>
          <td>-</td>
        </tr>
        <tr>
          <td>leftText</td>
          <td>头部栏左侧文本</td>
          <td>String</td>
          <td>-</td>
        </tr>
        <tr>
          <td>virtual</td>
          <td>虚拟滚动</td>
          <td>Boolean</td>
          <td>false</td>
        </tr>
        <tr>
          <td>engine</td>
          <td>渲染引擎：default / virtual / vxe</td>
          <td>String</td>
          <td>'default'</td>
        </tr>
        <tr>
          <td>rowHeight</td>
          <td>虚拟滚动的行高</td>
          <td>Number</td>
          <td>50</td>
        </tr>
        <tr>
          <td>estimatedRowHeight</td>
          <td>动态行高预估值</td>
          <td>Number</td>
          <td>-</td>
        </tr>
        <tr>
          <td>overscanCount</td>
          <td>可视区外预渲染行数</td>
          <td>Number</td>
          <td>2</td>
        </tr>
        <tr>
          <td>showFooter</td>
          <td>vxe：显示表尾</td>
          <td>Boolean</td>
          <td>false</td>
        </tr>
        <tr>
          <td>footerMethod</td>
          <td>vxe：表尾计算 ({ columns, data }) =&gt; 二维数组</td>
          <td>Function</td>
          <td>-</td>
        </tr>
        <tr>
          <td>footerData</td>
          <td>vxe：静态表尾数据（二维数组）</td>
          <td>Array</td>
          <td>-</td>
        </tr>
        <tr>
          <td>editConfig</td>
          <td>vxe：行内编辑配置</td>
          <td>Object</td>
          <td>-</td>
        </tr>
        <tr>
          <td>keepSource</td>
          <td>vxe：保留原始行数据（配合 revertData）</td>
          <td>Boolean</td>
          <td>-</td>
        </tr>
        <tr>
          <td>treeConfig</td>
          <td>vxe：树形表格配置</td>
          <td>Object</td>
          <td>-</td>
        </tr>
        <tr>
          <td>proxyConfig</td>
          <td>vxe：数据代理配置</td>
          <td>Object</td>
          <td>-</td>
        </tr>
        <tr>
          <td>expandConfig</td>
          <td>vxe：展开行为配置（与列上的 expandConfig「展开内容」不是同一概念）</td>
          <td>Object</td>
          <td>-</td>
        </tr>
        <tr>
          <td>seqConfig</td>
          <td>vxe：序号列配置</td>
          <td>Object</td>
          <td>-</td>
        </tr>
        <tr>
          <td>printConfig</td>
          <td>vxe：打印配置</td>
          <td>Object / Boolean</td>
          <td>-</td>
        </tr>
        <tr>
          <td>exportConfig</td>
          <td>vxe：导出配置</td>
          <td>Object / Boolean</td>
          <td>-</td>
        </tr>
        <tr>
          <td>toolbarConfig</td>
          <td>vxe：工具栏配置</td>
          <td>Object / Boolean</td>
          <td>-</td>
        </tr>
        <tr>
          <td>columnConfig</td>
          <td>vxe：列配置面板</td>
          <td>Object</td>
          <td>-</td>
        </tr>
        <tr>
          <td>keyboardConfig</td>
          <td>vxe：键盘导航配置</td>
          <td>Object</td>
          <td>-</td>
        </tr>
        <tr>
          <td>mouseConfig</td>
          <td>vxe：鼠标行为配置</td>
          <td>Object</td>
          <td>-</td>
        </tr>
        <tr>
          <td>clipboardConfig</td>
          <td>vxe：剪贴板配置</td>
          <td>Object</td>
          <td>-</td>
        </tr>
        <tr>
          <td>validConfig</td>
          <td>vxe：校验提示配置</td>
          <td>Object</td>
          <td>-</td>
        </tr>
      </tbody>
    </table>

    <h3>Column 配置</h3>
    <table class="table-props">
      <thead>
        <tr>
          <th>参数</th>
          <th>说明</th>
          <th>类型</th>
        </tr>
      </thead>
      <tbody>
        <tr>
          <td>prop</td>
          <td>数据字段名</td>
          <td>String</td>
        </tr>
        <tr>
          <td>key</td>
          <td>列唯一标识（与 prop 二选一）</td>
          <td>String</td>
        </tr>
        <tr>
          <td>label</td>
          <td>列标题</td>
          <td>String</td>
        </tr>
        <tr>
          <td>labelKey</td>
          <td>国际化 key，配置了全局 t 函数时优先于 label</td>
          <td>String</td>
        </tr>
        <tr>
          <td>width</td>
          <td>列宽度</td>
          <td>String / Number</td>
        </tr>
        <tr>
          <td>minWidth</td>
          <td>最小列宽</td>
          <td>String / Number</td>
        </tr>
        <tr>
          <td>align</td>
          <td>对齐方式：left / center / right</td>
          <td>String</td>
        </tr>
        <tr>
          <td>fixed</td>
          <td>固定列：'left' | 'right' | true（等价 left）</td>
          <td>Boolean / String</td>
        </tr>
        <tr>
          <td>type</td>
          <td>内置列类型：index / selection / expand</td>
          <td>String</td>
        </tr>
        <tr>
          <td>sortable</td>
          <td>可排序；'custom' 表示由后端排序</td>
          <td>Boolean / String</td>
        </tr>
        <tr>
          <td>formatter</td>
          <td>(row) =&gt; String，格式化函数</td>
          <td>Function</td>
        </tr>
        <tr>
          <td>render</td>
          <td>自定义渲染函数 (h, { row, value, index }) =&gt; VNode</td>
          <td>Function</td>
        </tr>
        <tr>
          <td>scopedSlots</td>
          <td>{ customRender: '插槽名' }</td>
          <td>Object</td>
        </tr>
        <tr>
          <td>groups</td>
          <td>多级分组表头的子列</td>
          <td>TableColumn[]</td>
        </tr>
        <tr>
          <td>expandConfig</td>
          <td>展开行内容 { title?, fields }，仅 type: 'expand' 列消费</td>
          <td>Object</td>
        </tr>
        <tr>
          <td>ellipsis</td>
          <td>超出省略并显示 Tooltip</td>
          <td>Boolean</td>
        </tr>
        <tr>
          <td>emptyPlaceholder</td>
          <td>空值占位文本（null / undefined / 空串时显示）</td>
          <td>String</td>
        </tr>
        <tr>
          <td>hidCol</td>
          <td>是否隐藏该列（保留配置不渲染）</td>
          <td>Boolean</td>
        </tr>
        <tr>
          <td>permissionValue</td>
          <td>列级权限编码：无权限时该列不渲染（未配置全局 permission 时放行）</td>
          <td>String</td>
        </tr>
        <tr>
          <td>btns</td>
          <td>操作列按钮 [{ name, type?, icon?, permissionValue?, hidden?, clickEvent? }]</td>
          <td>Array</td>
        </tr>
        <tr>
          <td>editRender</td>
          <td>vxe：行内编辑渲染器，需配合 options.editConfig</td>
          <td>Object</td>
        </tr>
        <tr>
          <td>footerFormatter</td>
          <td>vxe：表尾单元格格式化，配合 options.showFooter</td>
          <td>Function</td>
        </tr>
      </tbody>
    </table>

    <h3>Methods</h3>
    <p class="section-desc">
      通过 <code>this.$refs.table.xxx()</code> 调用（与 Vue 3 / Ant Design 端同名同义）。
      带「vxe」标注的只在 <code>options.engine: 'vxe'</code> 下有行为，其余引擎返回空值。
    </p>
    <table class="table-props">
      <thead>
        <tr>
          <th>方法名</th>
          <th>说明</th>
          <th>参数</th>
        </tr>
      </thead>
      <tbody>
        <tr><td>httpRequestInstance</td><td>手动触发数据请求（默认回到第 1 页；keepPage: true 保留当前页）</td><td>(model?, { keepPage }?)</td></tr>
        <tr><td>requestError</td><td>最近一次自动加载的错误（成功后清空）</td><td>-</td></tr>
        <tr><td>getSelectionRows</td><td>取当前勾选行</td><td>-</td></tr>
        <tr><td>clearSelection</td><td>清空选中（透传底层 el-table）</td><td>-</td></tr>
        <tr><td>clearAllSelection</td><td>清空全部选中（含固定列与 vxe 引擎）</td><td>-</td></tr>
        <tr><td>toggleRowSelection</td><td>切换某一行的选中状态</td><td>(row, selected?)</td></tr>
        <tr><td>refresh</td><td>刷新当前页（保留页码重新取数）</td><td>(model?)</td></tr>
        <tr><td>reload</td><td>重新加载并回到第 1 页</td><td>(model?)</td></tr>
        <tr><td>doLayout</td><td>重新计算表格布局（列宽/固定列错位时调用）</td><td>-</td></tr>
        <tr><td>scrollToRow</td><td>滚动到指定行</td><td>(index)</td></tr>
        <tr><td>getUpdateRecords</td><td>vxe：取已修改行</td><td>-</td></tr>
        <tr><td>getInsertRecords</td><td>vxe：取新增行</td><td>-</td></tr>
        <tr><td>getRemoveRecords</td><td>vxe：取删除行</td><td>-</td></tr>
        <tr><td>revertData</td><td>vxe：还原行数据（不传则还原全部）</td><td>(rows?)</td></tr>
        <tr><td>clearActived</td><td>vxe：关闭所有已激活的单元格编辑态</td><td>-</td></tr>
        <tr><td>clearValidate</td><td>vxe：清除行内校验提示</td><td>-</td></tr>
        <tr><td>validate</td><td>vxe：触发行内校验，返回 Promise</td><td>(rows?)</td></tr>
        <tr><td>vxeInstance</td><td>vxe：取底层 vxe-grid 实例</td><td>-</td></tr>
      </tbody>
    </table>

    <h3>Events</h3>
    <table class="table-props">
      <thead>
        <tr>
          <th>事件名</th>
          <th>说明</th>
          <th>回调参数</th>
        </tr>
      </thead>
      <tbody>
        <tr><td>update:pagination</td><td>分页变化（配合 <code>:pagination.sync</code>）</td><td>(pagination)</td></tr>
        <tr><td>pagination-current-change</td><td>翻页</td><td>(pagination)</td></tr>
        <tr><td>size-change</td><td>每页条数变化</td><td>(pagination, size)</td></tr>
        <tr><td>change-table-sort</td><td>排序变化（vxe 引擎下参数为 sortInfo 对象）</td><td>(column)</td></tr>
        <tr><td>request-error</td><td>自动加载失败（错误同时可从 <code>requestError</code> 读到）</td><td>(error)</td></tr>
      </tbody>
    </table>

    </section>

    <!-- Development Guidelines Section -->
    <section class="modern-section">
      <div class="section-header">
        <div class="section-icon cyan">
          <i class="el-icon-s-management" />
        </div>
        <h2 class="section-title">开发规范与建议</h2>
      </div>

      <div class="tips-box tips-box--info">
      <h4>📋 开发规范</h4>
      <ol>
        <li><strong>字段命名</strong>：后端返回字段与前端不一致时，使用 configTableOut 映射，不修改后端接口</li>
        <li><strong>请求封装</strong>：统一配置 httpRequest，集中处理 Token、错误提示、Loading</li>
        <li><strong>按钮操作</strong>：操作列通过 instance.httpRequestInstance() 刷新表格，不直接修改数据源</li>
        <li><strong>日期范围</strong>：使用 brcb 回调将日期范围拆分为 start/end 两个字段传给后端</li>
        <li><strong>性能优化</strong>：大数据量时设置 tabHeight 固定表格高度；万行级请切到 vxe 引擎（engine: 'vxe'）——Element UI 的 el-table 本身没有虚拟滚动</li>
      </ol>
    </div>
    </section>

    <!-- Next Steps Section -->
    <section class="modern-section">
      <div class="section-header">
        <div class="section-icon green">
          <i class="el-icon-right" />
        </div>
        <h2 class="section-title">下一步</h2>
      </div>
      <p class="section-desc">继续学习其他组件，掌握更多功能：</p>

      <div class="next-links">
        <router-link to="/component/esform" class="next-card">
          <div class="next-icon purple">
            <i class="el-icon-s-order" />
          </div>
          <div class="next-info">
            <h3>EsForm 表单组件</h3>
            <p>学习配置化表单的各种控件类型</p>
          </div>
          <i class="el-icon-arrow-right" />
        </router-link>

        <router-link to="/component/esdialog" class="next-card">
          <div class="next-icon orange">
            <i class="el-icon-s-claim" />
          </div>
          <div class="next-info">
            <h3>useDialog 弹窗</h3>
            <p>掌握函数式弹窗的使用方法</p>
          </div>
          <i class="el-icon-arrow-right" />
        </router-link>

        <router-link to="/component/combination" class="next-card">
          <div class="next-icon cyan">
            <i class="el-icon-link" />
          </div>
          <div class="next-info">
            <h3>组合联动</h3>
            <p>了解组件间的组合使用方式</p>
          </div>
          <i class="el-icon-arrow-right" />
        </router-link>
      </div>
    </section>
  </div>
</template>

<script>
import CodePlayground from '@/components/CodePlayground.vue'
import { tableExamples, getComponent, getRawCode } from '@/examples'

export default {
  name: 'EsTableDocs',
  components: { CodePlayground },
  data() {
    return {
      tableExamples
    }
  },
  methods: {
    getComponent,
    getRawCode
  }
}
</script>

<style lang="scss">
.docs-container {
  padding: 20px;
  max-width: 1400px;
  margin: 0 auto;

  .docs-header {
    margin-bottom: 30px;

    .global-actions {
      margin-top: 15px;
      padding: 10px 0;
      border-bottom: 1px solid #e4e7ed;
    }
  }

  h1 {
    font-size: 32px;
    margin-bottom: 10px;
    color: #303133;
  }

  .component-desc {
    color: #28292d;
    font-size: 16px;
    line-height: 1.6;
    margin-bottom: 30px;
    padding: 15px 20px;
    background: #f5f7fa;
    border-left: 4px solid var(--es-brand-primary);
    border-radius: 4px;
  }

  h2 {
    font-size: 24px;
    margin: 40px 0 15px;
    padding-bottom: 10px;
    border-bottom: 2px solid var(--es-brand-primary);
    color: #303133;
  }

  h3 {
    font-size: 18px;
    color: #303133;
    margin: 30px 0 15px;
    padding-left: 12px;
    border-left: 4px solid #67c23a;
  }

  h4 {
    font-size: 15px;
    color: #303133;
    margin: 20px 0 10px;
  }

  p {
    color: #28292d;
    line-height: 1.8;
    margin-bottom: 15px;

    code {
      background: #f4f4f5;
      padding: 2px 8px;
      border-radius: 4px;
      font-family: 'Consolas', monospace;
      color: #e96900;
      font-size: 13px;
    }
  }

  .demo-block {
    border: 1px solid #ebeef5;
    border-radius: 8px;
    margin-bottom: 30px;
    overflow: hidden;
    box-shadow: 0 2px 12px 0 rgba(0, 0, 0, 0.05);

    &__header {
      padding: 15px 20px;
      background: #fafafa;
      border-bottom: 1px solid #ebeef5;
      display: flex;
      justify-content: space-between;
      align-items: center;
    }

    &__title {
      font-size: 16px;
      font-weight: 500;
      color: #303133;
    }

    &__badge {
      font-size: 12px;
      padding: 2px 10px;
      border-radius: 12px;
      background: var(--es-brand-primary);
      color: #fff;
    }

    &__body {
      padding: 20px;
      background: #fff;
    }

    &__code {
      background: #f5f7fa;
      overflow-x: auto;

      .code-header {
        display: flex;
        align-items: center;
        padding: 10px 15px;
        background: #e4e7ed;
        cursor: pointer;
        user-select: none;
        transition: background 0.2s;
        border-bottom: 1px solid #dcdfe6;

        &:hover {
          background: #d0d3d9;
        }

        i {
          margin-right: 8px;
          font-size: 14px;
          color: #606266;
        }

        span {
          font-size: 13px;
          color: #606266;
        }

        .copy-btn {
          margin-left: auto;
          padding: 4px 12px;
          font-size: 12px;
          color: var(--es-brand-primary);
          background: #fff;
          border: 1px solid var(--es-brand-primary);
          border-radius: 4px;
          cursor: pointer;
          transition: all 0.2s;
          display: flex;
          align-items: center;
          gap: 4px;

          &:hover {
            background: var(--es-brand-primary);
            color: #fff;
          }

          i {
            margin-right: 4px;
            color: inherit;
          }
        }
      }

      pre {
        margin: 0;
        padding: 15px 20px;
        font-family: 'Consolas', monospace;
        font-size: 13px;
        line-height: 1.6;
        color: #606266;
      }

      code {
        white-space: pre-wrap;
        word-wrap: break-word;
        background: transparent;
        color: #606266;
        padding: 0;
      }
    }
  }

  .tips-box {
    padding: 16px 20px;
    border-radius: 8px;
    margin: 20px 0;

    &--success {
      background: #f0f9eb;
      border: 1px solid #e1f3d8;
      h4 { color: #67c23a; }
    }

    &--warning {
      background: #fdf6ec;
      border: 1px solid #faecd8;
      h4 { color: #e6a23c; }
    }

    &--info {
      background: #f4f4f5;
      border: 1px solid #e9e9eb;
      h4 { color: #909399; }
    }

    h4 {
      margin: 0 0 10px 0;
      font-size: 15px;
    }

    ul, ol {
      margin: 0;
      padding-left: 20px;

      li {
        margin: 8px 0;
        color: #606266;
        line-height: 1.6;
      }
    }

    p {
      margin: 0;
      color: #606266;
    }
  }

  .table-props {
    width: 100%;
    border-collapse: collapse;
    margin: 20px 0;
    font-size: 14px;

    th, td {
      padding: 12px 16px;
      text-align: left;
      border: 1px solid #ebeef5;
    }

    th {
      background: #f5f7fa;
      font-weight: 600;
      color: #303133;
    }

    td {
      color: #606266;
    }

    code {
      background: #f4f4f5;
      padding: 2px 6px;
      border-radius: 3px;
      font-family: 'Consolas', monospace;
      color: #e96900;
      font-size: 12px;
    }

    tr:hover {
      background: #f5f7fa;
    }
  }
}
</style>
