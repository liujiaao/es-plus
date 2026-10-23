<template>
  <div class="docs-container">
    <!-- Hero Section -->
    <section class="modern-hero">
      <div class="hero-badge">
        <i class="el-icon-s-platform" />
        <span>核心组件</span>
      </div>
      <h1 class="hero-title">EsCrudPage 配置化 CRUD 页</h1>
      <p class="hero-desc">
        一份 schema 生成「查询表单 + 表格 + 分页 + 新增/编辑弹窗」的完整列表页，
        三个渲染端（Vue 2 / Element Plus / Ant Design Vue）共用同一份配置
      </p>
    </section>

    <!-- 使用示例 -->
    <section id="crud-examples" class="modern-section">
      <div class="section-header">
        <div class="section-icon" style="background: linear-gradient(135deg, var(--es-brand-primary) 0%, var(--es-brand-accent) 100%);">
          <i class="el-icon-s-order" />
        </div>
        <h2 class="section-title">使用示例</h2>
      </div>

      <CodePlayground
        v-for="ex in crudExamples"
        :key="ex.key"
        :title="ex.title"
        :description="ex.description"
        :code="getRawCode('crud', ex.key)"
      >
        <template #preview>
          <component :is="getComponent('crud', ex.key)" v-if="getComponent('crud', ex.key)" />
          <div v-else class="placeholder-preview">
            <el-alert :title="'示例: ' + ex.title" type="info" :closable="false" />
          </div>
        </template>
      </CodePlayground>
    </section>

    <!-- Schema 结构 -->
    <section id="crud-schema" class="modern-section">
      <div class="section-header">
        <div class="section-icon orange">
          <i class="el-icon-set-up" />
        </div>
        <h2 class="section-title">Schema 结构</h2>
      </div>
      <p class="section-desc">
        schema 的每个顶层键分别交给一个子组件：<code>formItems</code> 交给 EsForm，
        <code>columns</code> / <code>tableOptions</code> / <code>pagination</code> 交给 EsTable，
        <code>dialogs</code> 交给 useDialog。它们组合起来就是一张完整的列表页。
      </p>

      <div class="modern-table-wrapper">
        <table class="modern-table">
          <thead>
            <tr>
              <th>字段</th>
              <th>说明</th>
              <th>类型</th>
              <th>默认值</th>
            </tr>
          </thead>
          <tbody>
            <tr>
              <td>formItems</td>
              <td>查询表单字段配置（透传给 EsForm 的 formItemList）；为空则不渲染查询表单</td>
              <td>FormItemOption[]</td>
              <td>—</td>
            </tr>
            <tr>
              <td>formLayout</td>
              <td>查询表单布局：<code>labelWidth</code>、<code>minFoldRows</code></td>
              <td>Object</td>
              <td>—</td>
            </tr>
            <tr>
              <td>toolbarBtns</td>
              <td>
                工具栏按钮（渲染在 EsForm 的按钮区）。<strong>不声明时</strong>按推导出的 actions
                自动生成「新增」等按钮；<strong>显式声明 operationColumn 时</strong>不再派生
              </td>
              <td>CrudBtnConfig[]</td>
              <td>—</td>
            </tr>
            <tr>
              <td>tableBtns</td>
              <td>表格工具栏按钮，渲染在 EsTable 上方的 configBtn 区，可用 <code>position</code> 指定左右</td>
              <td>TableBtnConfig[]</td>
              <td>—</td>
            </tr>
            <tr>
              <td>columns</td>
              <td>表格列配置</td>
              <td>TableColumn[]</td>
              <td>必填</td>
            </tr>
            <tr>
              <td>tableOptions</td>
              <td>表格选项（border / stripe / rowkey / httpRequest …），与 EsTable 的 options 同源</td>
              <td>Object</td>
              <td>{}</td>
            </tr>
            <tr>
              <td>pagination</td>
              <td>分页配置 { pageIndex, pageSize, total }，经 <code>:pagination.sync</code> 双向绑定</td>
              <td>Object</td>
              <td>—</td>
            </tr>
            <tr>
              <td>operationColumn</td>
              <td>
                操作列配置。<code>undefined</code> = 按 actions 自动推导（列里已有 <code>btns</code>
                或 <code>prop</code> 为 <code>action</code>/<code>operate</code> 时不再追加）；
                <code>false</code> = 不显示；对象 = 按给的定义渲染
              </td>
              <td>Object | false</td>
              <td>—</td>
            </tr>
            <tr>
              <td>dialogs</td>
              <td>多弹窗配置，键名即按钮 <code>dialogKey</code> 取的值（详见下方 Dialogs 配置）</td>
              <td>Record&lt;string, CrudDialogConfig&gt;</td>
              <td>—</td>
            </tr>
            <tr>
              <td>actions</td>
              <td>
                <em>已废弃</em>，用 toolbarBtns + operationColumn 替代。仍是决定「内建语义」的最高优先级来源：
                显式 actions &gt; dialogs 键推导 &gt; dialogFormItems 兼容 &gt; 只读
              </td>
              <td>CrudAction[]</td>
              <td>—</td>
            </tr>
            <tr>
              <td>dialogFormItems / dialogOptions / queryBtns</td>
              <td><em>已废弃</em>，用 dialogs / toolbarBtns 替代</td>
              <td>—</td>
              <td>—</td>
            </tr>
          </tbody>
        </table>
      </div>
      <el-alert
        type="warning"
        :closable="false"
        style="margin-top: 16px"
        title="行内按钮请用 operationColumn，不要手写一列 btns"
        description="手写 columns 里的 btns 会绕过组件的事件接线：EsTable 只调用按钮上的 clickEvent，dialogKey / confirm / click 全部静默失效（页面不报错，点了没反应）。交给 operationColumn 声明，组件会把每个按钮接上 clickEvent，dialogKey、confirm、click 才生效。"
      />
    </section>

    <!-- Props / Events / 暴露方法 -->
    <section id="crud-api" class="modern-section">
      <div class="section-header">
        <div class="section-icon cyan">
          <i class="el-icon-document" />
        </div>
        <h2 class="section-title">API 文档</h2>
      </div>

      <h3>Props</h3>
      <div class="modern-table-wrapper">
        <table class="modern-table">
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
              <td>schema</td>
              <td>页面配置（必填）</td>
              <td>CrudPageSchema</td>
              <td>—</td>
            </tr>
            <tr>
              <td>httpRequest</td>
              <td>表格取数函数，会覆盖 <code>schema.tableOptions.httpRequest</code></td>
              <td>Function</td>
              <td>—</td>
            </tr>
            <tr>
              <td>autoLoad</td>
              <td>挂载后是否立即取数</td>
              <td>Boolean</td>
              <td>true</td>
            </tr>
          </tbody>
        </table>
      </div>
      <p class="section-desc">
        组件设了 <code>inheritAttrs: false</code>，其余属性经 <code>v-bind="$attrs"</code> 落到内层 EsTable。
      </p>

      <h3>Events</h3>
      <div class="modern-table-wrapper">
        <table class="modern-table">
          <thead>
            <tr>
              <th>事件名</th>
              <th>说明</th>
              <th>回调参数</th>
            </tr>
          </thead>
          <tbody>
            <tr>
              <td>query</td>
              <td>查询表单触发表格重新取数</td>
              <td>(queryModel)</td>
            </tr>
            <tr>
              <td>row-click</td>
              <td>表格行点击（内层 EsTable 的 row-click 转发）</td>
              <td>(row)</td>
            </tr>
            <tr>
              <td>add</td>
              <td>点击「新增」（带 <code>dialogKey</code> 时同时打开对应弹窗）</td>
              <td>()</td>
            </tr>
            <tr>
              <td>edit / delete / view</td>
              <td>操作列的内建行按钮被点击</td>
              <td>(row)</td>
            </tr>
            <tr>
              <td>export</td>
              <td>点击导出按钮</td>
              <td>(queryModel)</td>
            </tr>
            <tr>
              <td>btn-click</td>
              <td>其余按钮的通用事件；表单内旧式确认按钮会带 <code>add-confirm</code> / <code>edit-confirm</code> 之类的 key</td>
              <td>(key, payload)</td>
            </tr>
            <tr>
              <td>dialog-open</td>
              <td>弹窗即将打开</td>
              <td>(key, row | undefined)</td>
            </tr>
            <tr>
              <td>dialog-confirm</td>
              <td>弹窗确认（配置了 <code>onConfirm</code> 时在它之后触发）</td>
              <td>(key, formData)</td>
            </tr>
            <tr>
              <td>dialog-cancel</td>
              <td>弹窗取消 / 关闭</td>
              <td>(key)</td>
            </tr>
          </tbody>
        </table>
      </div>

      <h3>暴露方法 / 属性</h3>
      <div class="modern-table-wrapper">
        <table class="modern-table">
          <thead>
            <tr>
              <th>名称</th>
              <th>说明</th>
              <th>类型</th>
            </tr>
          </thead>
          <tbody>
            <tr>
              <td>refresh()</td>
              <td>刷新<strong>当前页</strong>（内部 keepPage: true，不会跳回第 1 页）</td>
              <td>() =&gt; Promise</td>
            </tr>
            <tr>
              <td>getSelectedRows()</td>
              <td>取表格当前勾选行</td>
              <td>() =&gt; Array</td>
            </tr>
            <tr>
              <td>openDialog(key, row?)</td>
              <td>按 dialogs 的键打开弹窗，row 作为回填数据</td>
              <td>Function</td>
            </tr>
            <tr>
              <td>closeDialog(key)</td>
              <td>关闭并销毁该弹窗实例（配置了 cacheKey 的只清自己那条缓存）</td>
              <td>Function</td>
            </tr>
            <tr>
              <td>tableRef</td>
              <td>内层 EsTable 组件的引用</td>
              <td>Object</td>
            </tr>
            <tr>
              <td>formRef</td>
              <td>内层查询表单 EsForm 的引用</td>
              <td>Object</td>
            </tr>
            <tr>
              <td>queryModel</td>
              <td>查询表单的响应式数据对象</td>
              <td>Object</td>
            </tr>
          </tbody>
        </table>
      </div>
    </section>

    <!-- CrudBtnConfig 配置 -->
    <section id="crud-btns" class="modern-section">
      <div class="section-header">
        <div class="section-icon blue">
          <i class="el-icon-thumb" />
        </div>
        <h2 class="section-title">CrudBtnConfig 按钮配置</h2>
      </div>
      <p class="section-desc">
        <code>toolbarBtns</code> 的每一项；<code>tableBtns</code>（TableBtnConfig）键相同，
        另有 <code>position</code> / <code>code</code> 决定渲染在表格上方的左侧还是右侧。
      </p>

      <div class="modern-table-wrapper">
        <table class="modern-table">
          <thead>
            <tr>
              <th>字段</th>
              <th>说明</th>
              <th>类型</th>
              <th>默认值</th>
            </tr>
          </thead>
          <tbody>
            <tr>
              <td>name</td>
              <td>按钮文本</td>
              <td>String</td>
              <td>必填</td>
            </tr>
            <tr>
              <td>key</td>
              <td>按钮标识；<code>query</code> / <code>add</code> / <code>export</code> 有内建语义，其余经 <code>btn-click</code> 派发</td>
              <td>String</td>
              <td>—</td>
            </tr>
            <tr>
              <td>type</td>
              <td>按钮风格：primary / success / warning / danger（映射到 el-button）</td>
              <td>String</td>
              <td>—</td>
            </tr>
            <tr>
              <td>size</td>
              <td>按钮尺寸；tableBtns 缺省 small</td>
              <td>String</td>
              <td>—</td>
            </tr>
            <tr>
              <td>icon</td>
              <td>图标名称</td>
              <td>String</td>
              <td>—</td>
            </tr>
            <tr>
              <td>position</td>
              <td>左右位置：left / right（tableBtns 用它分组；toolbarBtns 由 EsForm 按钮区布局决定）</td>
              <td>String</td>
              <td>left</td>
            </tr>
            <tr>
              <td>code</td>
              <td>位置旧写法：2 视为 right，其余视为 left（position 优先）</td>
              <td>1 | 2</td>
              <td>—</td>
            </tr>
            <tr>
              <td>direction</td>
              <td>按钮排列方向：left / right（弹窗与表格的按钮底座读取；toolbarBtns 不读取）</td>
              <td>String</td>
              <td>—</td>
            </tr>
            <tr>
              <td>loading</td>
              <td>加载态（禁用点击并显示 loading）</td>
              <td>Boolean</td>
              <td>false</td>
            </tr>
            <tr>
              <td>disabled</td>
              <td>禁用状态，支持函数动态判断</td>
              <td>Boolean | Function</td>
              <td>false</td>
            </tr>
            <tr>
              <td>permissionValue</td>
              <td>按钮级权限编码，无权限时不渲染</td>
              <td>String</td>
              <td>—</td>
            </tr>
            <tr>
              <td>triggerEvent</td>
              <td>仅 toolbarBtns：<code>key</code> 为 query / rest 时点击触发一次表格刷新</td>
              <td>Boolean</td>
              <td>false</td>
            </tr>
            <tr>
              <td>click</td>
              <td>
                <code>(model, formRef?) =&gt; void</code>；tableBtns 中的 click 会被 CRUD 页接管
                （改走 dialogKey / actionType）
              </td>
              <td>Function</td>
              <td>—</td>
            </tr>
            <tr>
              <td>dialogKey</td>
              <td>点击时打开 dialogs 里对应的弹窗</td>
              <td>String</td>
              <td>—</td>
            </tr>
            <tr>
              <td>actionType</td>
              <td>语义动作（如 export / import），无 key 时兜底作语义键</td>
              <td>String</td>
              <td>—</td>
            </tr>
            <tr>
              <td>confirm</td>
              <td>点击前的二次确认（true 用默认文案）</td>
              <td>String | Boolean</td>
              <td>—</td>
            </tr>
          </tbody>
        </table>
      </div>
    </section>

    <!-- OperationColumnConfig 配置 -->
    <section id="crud-operation-column" class="modern-section">
      <div class="section-header">
        <div class="section-icon purple">
          <i class="el-icon-menu" />
        </div>
        <h2 class="section-title">OperationColumnConfig 操作列配置</h2>
      </div>
      <p class="section-desc">
        <code>operationColumn</code> 的对象形态；<code>false</code> 表示不渲染操作列。
      </p>

      <div class="modern-table-wrapper">
        <table class="modern-table">
          <thead>
            <tr>
              <th>字段</th>
              <th>说明</th>
              <th>类型</th>
              <th>默认值</th>
            </tr>
          </thead>
          <tbody>
            <tr>
              <td>label</td>
              <td>列标题</td>
              <td>String</td>
              <td>操作</td>
            </tr>
            <tr>
              <td>width</td>
              <td>列宽，缺省按按钮数自动计算（<code>btns.length * 80 + 20</code>）</td>
              <td>Number | String</td>
              <td>—</td>
            </tr>
            <tr>
              <td>fixed</td>
              <td>固定方向</td>
              <td>Boolean | String</td>
              <td>right</td>
            </tr>
            <tr>
              <td>btns</td>
              <td>行操作按钮列表</td>
              <td>RowBtnConfig[]</td>
              <td>必填</td>
            </tr>
          </tbody>
        </table>
      </div>
    </section>

    <!-- RowBtnConfig 配置 -->
    <section id="crud-row-btns" class="modern-section">
      <div class="section-header">
        <div class="section-icon green">
          <i class="el-icon-s-operation" />
        </div>
        <h2 class="section-title">RowBtnConfig 行按钮配置</h2>
      </div>
      <p class="section-desc">
        <code>operationColumn.btns</code> 的每一项，渲染成操作列里的按钮。
      </p>

      <div class="modern-table-wrapper">
        <table class="modern-table">
          <thead>
            <tr>
              <th>字段</th>
              <th>说明</th>
              <th>类型</th>
              <th>默认值</th>
            </tr>
          </thead>
          <tbody>
            <tr>
              <td>name</td>
              <td>按钮文字</td>
              <td>String</td>
              <td>必填</td>
            </tr>
            <tr>
              <td>key</td>
              <td>按钮标识（用于 btn-click 事件与内建 edit / view / delete 语义）</td>
              <td>String</td>
              <td>—</td>
            </tr>
            <tr>
              <td>type</td>
              <td>按钮类型</td>
              <td>String</td>
              <td>—</td>
            </tr>
            <tr>
              <td>icon</td>
              <td>图标</td>
              <td>String</td>
              <td>—</td>
            </tr>
            <tr>
              <td>permissionValue</td>
              <td>权限标识</td>
              <td>String</td>
              <td>—</td>
            </tr>
            <tr>
              <td>dialogKey</td>
              <td>点击时打开的弹窗 key，自动将当前行数据传入</td>
              <td>String</td>
              <td>—</td>
            </tr>
            <tr>
              <td>confirm</td>
              <td>点击前确认提示（如删除确认）</td>
              <td>String | Boolean</td>
              <td>—</td>
            </tr>
            <tr>
              <td>hidden</td>
              <td>是否隐藏，支持 <code>(row) =&gt; boolean</code> 动态判断</td>
              <td>Boolean | Function</td>
              <td>—</td>
            </tr>
            <tr>
              <td>click</td>
              <td>
                自定义点击处理 <code>(row, { refresh, getSelectedRows, openDialog }) =&gt; void</code>；
                提供后不再走 dialogKey
              </td>
              <td>Function</td>
              <td>—</td>
            </tr>
          </tbody>
        </table>
      </div>
    </section>

    <!-- Dialogs 配置 -->
    <section id="crud-dialogs" class="modern-section">
      <div class="section-header">
        <div class="section-icon" style="background: linear-gradient(135deg, #f093fb 0%, #f5576c 100%);">
          <i class="el-icon-chat-dot-square" />
        </div>
        <h2 class="section-title">Dialogs 配置</h2>
      </div>
      <p class="section-desc">
        <code>dialogs</code> 的每个键对应一个弹窗实例。按钮上的 <code>dialogKey</code> 决定打开哪一个，
        而键名恰为 <code>add</code> / <code>edit</code> / <code>view</code> 时，还会被当作内建语义，
        参与 actions 推导（从而自动生成对应按钮）。
      </p>
      <div class="modern-table-wrapper">
        <table class="modern-table">
          <thead>
            <tr>
              <th>字段</th>
              <th>说明</th>
              <th>类型</th>
            </tr>
          </thead>
          <tbody>
            <tr>
              <td>title</td>
              <td>弹窗标题，可传函数 <code>(row) =&gt; string</code> 按行生成</td>
              <td>String | Function</td>
            </tr>
            <tr>
              <td>width</td>
              <td>弹窗宽度</td>
              <td>String | Number</td>
            </tr>
            <tr>
              <td>formItems / formLayout</td>
              <td>弹窗内表单的字段与布局；与 EsForm 的配置同源</td>
              <td>Array / Object</td>
            </tr>
            <tr>
              <td>render</td>
              <td>完全自定义内容：<code>(h, { row, model, registerRef, close, refresh }) =&gt; VNode</code></td>
              <td>Function</td>
            </tr>
            <tr>
              <td>configBtn</td>
              <td>自定义底部按钮，<code>action</code> 可取 confirm / cancel / custom</td>
              <td>DialogBtnConfig[]</td>
            </tr>
            <tr>
              <td>isHiddenFooter</td>
              <td>隐藏默认底部按钮（自绘导航时用）</td>
              <td>Boolean</td>
            </tr>
            <tr>
              <td>maxHeight / fullscreen / isDraggable</td>
              <td>弹窗样式与交互</td>
              <td>String | Number / Boolean / Boolean</td>
            </tr>
            <tr>
              <td>showClose / destroyOnClose / modal / closeOnClickModal / closeOnPressEscape / hiddenFullBtn / appendTo / cacheKey</td>
              <td>弹窗底座属性，由白名单逐键透传给 useDialog；<code>cacheKey</code> 复用时保留内部状态</td>
              <td>—</td>
            </tr>
            <tr>
              <td>hasCustomRender</td>
              <td>
                AI 生成器注解键：生成器据此转成 <code>TODO(es-plus)</code> 占位并告警。
                运行时白名单刻意不转发它，<strong>不是弹窗 prop</strong>
              </td>
              <td>Boolean</td>
            </tr>
            <tr>
              <td>onOpen / onConfirm / onClose</td>
              <td>
                生命周期回调。<code>onConfirm(data, { close, refresh, getRefs, row })</code> 抛错或返回 rejected
                Promise 时弹窗不关闭
              </td>
              <td>Function</td>
            </tr>
          </tbody>
        </table>
      </div>

      <el-alert
        type="info"
        :closable="false"
        style="margin-top: 16px"
        title="按钮回调的键名是 click，不是 onClick"
        description="配置式的 BtnConfig / DialogBtnConfig 只认 click 键；写成 onClick 不会报错，但也永远不会被调用。行内操作按钮的签名是 click(row, { refresh, getSelectedRows, openDialog })。"
      />
    </section>
  </div>
</template>

<script>
import CodePlayground from '@/components/CodePlayground.vue'
import { crudExamples, getComponent, getRawCode } from '@/examples'

export default {
  name: 'EsCrudPageDocs',
  components: { CodePlayground },
  data() {
    return {
      crudExamples
    }
  },
  methods: {
    getComponent,
    getRawCode
  }
}
</script>

<style scoped>
.placeholder-preview {
  padding: 16px;
}
</style>
