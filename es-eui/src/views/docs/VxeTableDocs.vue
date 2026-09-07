<template>
  <div class="docs-container">
    <!-- Hero Section -->
    <section class="modern-hero">
      <div class="hero-badge">
        <i class="el-icon-s-data" />
        <span>高性能引擎</span>
      </div>
      <h1 class="hero-title">高性能 vxe-table 表格</h1>
      <p class="hero-desc">
        通过 options.engine: "vxe" 一行切换至 vxe-table 高性能引擎，获得行内编辑、树形数据、导出、工具栏、
        服务端分页等企业级能力，同时保持 es-plus 配置化与联动范式不变。
      </p>
    </section>

    <!-- 使用示例 -->
    <section class="modern-section">
      <div class="section-header">
        <div class="section-icon" style="background: linear-gradient(135deg, #667eea 0%, #764ba2 100%);">
          <i class="el-icon-s-grid" />
        </div>
        <h2 class="section-title">使用示例</h2>
      </div>
      <CodePlayground
        v-for="ex in vxeTableExamples"
        :key="ex.key"
        :title="ex.title"
        :description="ex.description"
        :code="getRawCode('vxe-table', ex.key)"
      >
        <template #preview>
          <component :is="getComponent('vxe-table', ex.key)" v-if="getComponent('vxe-table', ex.key)" />
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

      <h3>TableOptions（vxe 引擎新增项）</h3>
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
            <td>engine</td>
            <td>切换至 vxe-table 高性能引擎，列配置 / 联动 / render 函数零改动</td>
            <td>"vxe"</td>
          </tr>
          <tr>
            <td>spanMethod</td>
            <td>行列动态合并，与 el-table 同签名；{rowspan:0} 表示该格被上方格覆盖。不可与 vxeConfig.mergeCells 同用</td>
            <td>({ rowIndex, columnIndex }) => { rowspan, colspan }</td>
          </tr>
          <tr>
            <td>showFooter / footerMethod</td>
            <td>显示合计行（tfoot），footerMethod 返回二维数组，每个子数组对应一行合计，下标与列一一对应</td>
            <td>Boolean / ({ columns, data }) => any[][]</td>
          </tr>
          <tr>
            <td>editConfig</td>
            <td>mode:"cell" 单元格编辑 | "row" 整行编辑；trigger:"click"|"dblclick"|"manual"；设置后 keepSource 自动为 true</td>
            <td>{ mode, trigger, showStatus? }</td>
          </tr>
          <tr>
            <td>printConfig</td>
            <td>true 使用默认打印配置，或传 { columns, style, sheetName } 自定义。启用后 print 按钮才生效</td>
            <td>Boolean | Object</td>
          </tr>
          <tr>
            <td>toolbarConfig</td>
            <td>工具栏：zoom 全屏，custom 自定义列，export 导出，print 打印，refresh 刷新</td>
            <td>{ zoom?, custom?, export?, print?, refresh? }</td>
          </tr>
          <tr>
            <td>exportConfig</td>
            <td>type:"csv"（默认）| "xlsx"（需插件）；exportConfig:true 使用默认配置</td>
            <td>Boolean | Object</td>
          </tr>
          <tr>
            <td>columnConfig / keyboardConfig / mouseConfig</td>
            <td>resizable 拖拽列宽；isArrow/isEnter/isTab 键盘导航；selected 单元格选中（类 Excel）</td>
            <td>Object</td>
          </tr>
          <tr>
            <td>treeConfig</td>
            <td>transform:true 自动将扁平 [{id,parentId}] 构造树形；某列需设置 treeNode:true 作为展开列</td>
            <td>{ transform?, rowField?, parentField?, children? }</td>
          </tr>
          <tr>
            <td>proxyConfig</td>
            <td>vxe 接管分页：ajax.query({ page }) 返回后端数据；response 映射响应字段；autoLoad:true 挂载自动请求</td>
            <td>{ autoLoad?, response?, ajax: { query } }</td>
          </tr>
          <tr>
            <td>vxeConfig</td>
            <td>逃生舱：深度合并至 vxe-grid 原生配置，优先级高于一等公民字段，可设 mergeHeaderItems / mergeFooterItems / pagerConfig 等</td>
            <td>VxeGridProps</td>
          </tr>
          <tr>
            <td>vxeOn</td>
            <td>逃生舱：注入 vxe 原生事件，键名为 kebab-case，如 "cell-click"、"edit-closed"、"zoom"</td>
            <td>Record&lt;string, Function&gt;</td>
          </tr>
        </tbody>
      </table>

      <h3>TableColumn（vxe 引擎新增项）</h3>
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
            <td>groups</td>
            <td>多级表头：子列数组，支持任意嵌套。父列只设 label（不设 prop），子列设 prop+label</td>
            <td>TableColumn[]</td>
          </tr>
          <tr>
            <td>editRender</td>
            <td>列编辑器：name 支持内置 $input/$select/$switch/$textarea；props 传给编辑组件；options 下拉选项</td>
            <td>{ name, props?, options? }</td>
          </tr>
          <tr>
            <td>vxeColumn</td>
            <td>逃生舱：原生 vxe-column 任意配置，如 rules（校验）、formatter（原生格式化）、treeNode:true</td>
            <td>VxeColumnProps</td>
          </tr>
          <tr>
            <td>type</td>
            <td>selection 复选框列 / index 序号列 / expand 展开行</td>
            <td>String</td>
          </tr>
        </tbody>
      </table>

      <h3>暴露方法 / vxe 实例访问</h3>
      <table class="table-props">
        <thead>
          <tr>
            <th>方法名</th>
            <th>说明</th>
          </tr>
        </thead>
        <tbody>
          <tr>
            <td>vxeEngineRef.vxeInstance()</td>
            <td>获取原始 vxe-grid 实例，可调用全部 vxe API（getUpdateRecords / insertAt / remove / validate / revertData / commitProxy / zoom / print 等）</td>
          </tr>
          <tr>
            <td>httpRequestInstance()</td>
            <td>手动触发数据请求（用于增删改后刷新当前页）</td>
          </tr>
          <tr>
            <td>getSelectionRows() / clearSelection()</td>
            <td>获取 / 清空多选选中行</td>
          </tr>
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
          <li><strong>rowkey 必填</strong>：vxe 引擎下必须设置 rowkey，否则跨页多选无法保留选中行</li>
          <li><strong>CRUD 访问路径</strong>：通过 tableRef.value.vxeEngineRef.vxeInstance() 拿到 vxe-grid，直接调用 getUpdateRecords / insertAt / validate 等方法</li>
          <li><strong>编辑追踪</strong>：keepSource:true（设置 editConfig 后自动开启）才能让 getUpdateRecords() 识别已改行</li>
          <li><strong>原生能力</strong>：es-plus 未封装的 vxe 配置放 vxeConfig（深合并），原生事件放 vxeOn（kebab-case）</li>
          <li><strong>服务端分页</strong>：proxyConfig 场景下 pagerConfig 通过 vxeConfig 传入；搜索按钮 click 手动 commitProxy("query")</li>
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
        <router-link to="/component/estable" class="next-card">
          <div class="next-icon purple">
            <i class="el-icon-s-grid" />
          </div>
          <div class="next-info">
            <h3>EsTable 表格组件</h3>
            <p>了解默认 el-table 引擎的完整能力</p>
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
import { vxeTableExamples, getComponent, getRawCode } from '@/examples'

export default {
  name: 'VxeTableDocs',
  components: { CodePlayground },
  data() {
    return {
      vxeTableExamples
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

  h1 {
    font-size: 32px;
    margin-bottom: 10px;
    color: #303133;
  }

  h2 {
    font-size: 24px;
    margin: 40px 0 15px;
    padding-bottom: 10px;
    border-bottom: 2px solid #409eff;
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

  .tips-box {
    padding: 16px 20px;
    border-radius: 8px;
    margin: 20px 0;

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
