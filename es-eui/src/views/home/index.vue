<template>
  <div class="home">
    <!-- Hero 区域 -->
    <div class="hero">
      <!-- 动态背景 -->
      <div class="hero-bg">
        <div class="gradient-orb orb-1"></div>
        <div class="gradient-orb orb-2"></div>
        <div class="gradient-orb orb-3"></div>
        <div class="particles">
          <span
            v-for="i in 20"
            :key="i"
            class="particle"
          ></span>
        </div>
      </div>
      
      <div class="container">
        <div class="hero-content">
          <!-- Logo 动画 -->
          <div class="hero-logo">
            <div class="logo-icon">
              <span class="logo-text">ES</span>
            </div>
          </div>
          
          <!-- 主标题 -->
          <h1 class="hero-title">
            <span class="gradient-text">ES-Plus</span>
          </h1>
          
          <!-- 副标题 -->
          <p class="hero-desc">
            <span class="typing-text">中后台 CRUD 的配置层 · Vue 2 + Element UI</span>
          </p>

          <!-- 描述 -->
          <p class="hero-subdesc">
            一份 JSON 配置，Vue 2 / Vue 3 / Ant Design Vue 三端通用，AI 生成即编译
          </p>
          
          <!-- 统计信息 -->
          <div class="hero-stats">
            <div class="stat-item">
              <span
                class="stat-number"
                data-count="5"
              >0</span>+
              <span class="stat-label">核心组件</span>
            </div>
            <div class="stat-item">
              <span
                class="stat-number"
                data-count="20"
              >0</span>+
              <span class="stat-label">控件类型</span>
            </div>
            <div class="stat-item">
              <span
                class="stat-number"
                data-count="80"
              >0</span>%
              <span class="stat-label">效率提升</span>
            </div>
          </div>
          
          <!-- 操作按钮 -->
          <div class="hero-actions">
            <router-link
              to="/guide"
              class="btn btn-primary"
            >
              <span>开始使用</span>
              <i class="el-icon-right"></i>
            </router-link>
            <router-link
              to="/component/installation"
              class="btn btn-default"
            >
              <span>查看组件</span>
              <i class="el-icon-arrow-right"></i>
            </router-link>
          </div>
          
          <!-- 滚动提示 -->
          <div class="scroll-hint">
            <div class="mouse">
              <div class="wheel"></div>
            </div>
            <span>向下滚动</span>
          </div>
        </div>
      </div>
    </div>

    <!-- 三个可验证承诺（文案单一真源 docs/brand/slogan.json） -->
    <div class="promises">
      <div class="container">
        <div class="promises-grid">
          <div
            v-for="p in brand.promises"
            :key="p.key"
            class="promise-card"
          >
            <h3 class="promise-title">{{ p.title }}</h3>
            <div class="promise-claim">{{ p.claim }}</div>
            <p class="promise-desc">{{ p.desc }}</p>
          </div>
        </div>
      </div>
    </div>

    <!-- L2 头号案例：零事件代码的 CRUD -->
    <div class="l2-case">
      <div class="container">
        <div class="section-header">
          <h2 class="section-title">🎯 头号案例 · 零事件代码的 CRUD</h2>
          <p class="section-desc">
            原生「查询 → 重置 → 翻页」要写 4 个事件函数，还容易踩「拿最新表单值」的坑。
            es-plus 用 <strong>EsForm 嵌套 EsTable</strong> + <code>triggerEvent: true</code>，把整条联动链路收敛为 <strong>0 行事件代码</strong>。
          </p>
        </div>
        <CodeDiff :left-code="nativeCode" :right-code="esplusCode" />
      </div>
    </div>

    <!-- 三端通用：同一份 Schema 源码 + 三端渲染快照 -->
    <div class="tri-section">
      <div class="container">
        <div class="section-header">
          <h2 class="section-title">🌐 三端通用</h2>
          <p class="section-desc">
            同一份 JSON Schema 在 Vue 2 / Vue 3 / Ant Design Vue 三端渲染出一致界面，
            <strong>换一行 import 即切换</strong>。
          </p>
        </div>
        <TriRenderTabs />
      </div>
    </div>

    <!-- AI 一句话生成 CRUD 入口（指向主站 AiCrud） -->
    <div class="ai-entry">
      <div class="container">
        <a
          href="https://liujiaao.github.io/es-plus/#/ai-crud"
          target="_blank"
          rel="noopener"
          class="ai-entry-card"
        >
          <h3>🤖 AI 一句话生成 CRUD</h3>
          <p>在 Claude Code / Cursor 里说一句话，生成可编译的三端通用 CRUD 页面。在线体验见主站 AiCrud。</p>
        </a>
      </div>
    </div>

    <!-- 特性展示 -->
    <div class="features">
      <div class="container">
        <div class="section-header">
          <span class="section-badge">核心特性</span>
          <h2 class="section-title">
            为什么选择 ES-Plus
          </h2>
          <p class="section-desc">
            精心设计的组件，让中后台开发更简单高效
          </p>
        </div>
        
        <div class="feature-list">
          <div
            v-for="(feature, index) in features"
            :key="index"
            class="feature-item"
            :class="{ 'fade-in': true }"
            :style="{ animationDelay: index * 0.1 + 's' }"
          >
            <div
              class="feature-icon"
              :class="feature.color"
            >
              <i :class="feature.icon"></i>
            </div>
            <div class="feature-content">
              <h3>{{ feature.title }}</h3>
              <p>{{ feature.desc }}</p>
            </div>
            <div class="feature-hover"></div>
          </div>
        </div>
      </div>
    </div>

    <!-- 痛点与解决方案 -->
    <div class="pain-points-section">
      <div class="container">
        <div class="section-header">
          <!-- <span class="section-badge">为什么选择 ES-Plus</span> -->
          <h2 class="section-title">
            告别重复劳动，专注业务创新
          </h2>
          <p class="section-desc">
            深度理解中后台开发痛点，用配置化思维重新定义开发效率
          </p>
        </div>

        <!-- 痛点 vs 解决方案对比 -->
        <div class="pain-solution-grid">
          <!-- 左侧痛点 -->
          <div class="pain-cards">
            <h3 class="subsection-title pain-title">
              <i class="el-icon-warning-outline"></i>
              传统开发痛点
            </h3>
            <div
              v-for="(pain, index) in painPoints"
              :key="index"
              class="pain-card"
            >
              <div class="pain-icon">
                <i :class="pain.icon"></i>
              </div>
              <div class="pain-content">
                <h4>{{ pain.title }}</h4>
                <p>{{ pain.desc }}</p>
              </div>
            </div>
          </div>

          <!-- 中间箭头 -->
          <div class="solution-arrow">
            <div class="arrow-line">
              <i class="el-icon-right"></i>
            </div>
            <span class="arrow-text">ES-Plus 解决</span>
          </div>

          <!-- 右侧解决方案 -->
          <div class="solution-cards">
            <h3 class="subsection-title solution-title">
              <i class="el-icon-success"></i>
              ES-Plus 方案
            </h3>
            <div
              v-for="(sol, index) in solutions"
              :key="index"
              class="solution-card"
            >
              <div class="solution-icon">
                <i :class="sol.icon"></i>
              </div>
              <div class="solution-content">
                <h4>{{ sol.title }}</h4>
                <p>{{ sol.desc }}</p>
              </div>
            </div>
          </div>
        </div>

        <!-- 代码对比展示 -->
        <div class="code-compare-section">
          <h3 class="compare-title">
            <span class="compare-badge traditional">传统方式 300+ 行</span>
            <span class="vs-text">VS</span>
            <span class="compare-badge eseui">ES-Plus 50+ 行</span>
          </h3>
          <div class="code-compare-grid">
            <!-- 传统方式代码 -->
            <div class="code-block-wrapper">
              <div class="code-window traditional">
                <div class="code-header">
                  <div class="window-dots">
                    <span class="dot red"></span>
                    <span class="dot yellow"></span>
                    <span class="dot green"></span>
                  </div>
                  <span class="code-title">Traditional.vue（片段）</span>
                </div>
                <div class="code-body">
                  <pre><code class="language-vue">&lt;!-- 模板代码冗长 --&gt;
&lt;div class="search-form"&gt;
  &lt;el-form :model="queryForm"&gt;
    &lt;el-form-item label="用户名"&gt;
      &lt;el-input v-model="queryForm.name" /&gt;
    &lt;/el-form-item&gt;
    &lt;el-form-item label="状态"&gt;
      &lt;el-select v-model="queryForm.status"&gt;
        &lt;el-option 
          v-for="item in statusOptions" 
          :key="item.value"
          :label="item.label"
          :value="item.value" /&gt;
      &lt;/el-select&gt;
    &lt;/el-form-item&gt;
    &lt;!-- 更多表单项... --&gt;
  &lt;/el-form&gt;
&lt;/div&gt;

&lt;el-table :data="tableData"&gt;
  &lt;el-table-column 
    v-for="col in columns" 
    :key="col.prop"
    :prop="col.prop"
    :label="col.label" /&gt;
&lt;/el-table&gt;

&lt;el-pagination 
  @current-change="handlePageChange"
  @size-change="handleSizeChange"
  :current-page="page"
  :page-size="pageSize"
  :total="total" /&gt;

&lt;script&gt;
// data 中大量状态管理
data() {
  return {
    queryForm: { name: '', status: '' },
    tableData: [],
    page: 1,
    pageSize: 10,
    total: 0,
    loading: false,
    // ... 更多状态
  }
},
methods: {
  // 手动处理请求、分页、联动
  async fetchData() {
    this.loading = true
    const res = await axios.get('/api/list', {
      params: { ...this.queryForm, 
        page: this.page, 
        pageSize: this.pageSize 
      }
    })
    this.tableData = res.data.data
    this.total = res.data.total
    this.loading = false
  },
  handleSearch() {
    this.page = 1
    this.fetchData()
  },
  // ... 更多方法
}
&lt;/script&gt;</code></pre>
                </div>
              </div>
            </div>

            <!-- ES-Plus 方式代码 -->
            <div class="code-block-wrapper">
              <div class="code-window eseui">
                <div class="code-header">
                  <div class="window-dots">
                    <span class="dot red"></span>
                    <span class="dot yellow"></span>
                    <span class="dot green"></span>
                  </div>
                  <span class="code-title">ES-Plus.vue（完整）</span>
                </div>
                <div class="code-body">
                  <pre><code class="language-vue">&lt;template&gt;
  &lt;!-- 配置化声明，代码量减少 80% --&gt;
  &lt;es-table
    :columns="columns"
    :options="tableOptions"
  &gt;
    &lt;es-form
      :form-item-list="searchItems"
      :model="searchForm"
      :config-btn="[
        { name: '查询', key: 'query', triggerEvent: true },
        { name: '重置', key: 'rest', triggerEvent: true }
      ]"
    /&gt;
  &lt;/es-table&gt;
&lt;/template&gt;

&lt;script&gt;
export default {
  data() {
    return {
      // JSON 配置替代模板代码
      columns: [
        { key: 'name', label: '用户名' },
        { key: 'status', label: '状态' }
      ],
      searchItems: [
        {
          prop: 'name',
          label: '用户名',
          formtype: 'Input',
          span: 8
        },
        {
          prop: 'status',
          label: '状态',
          formtype: 'Select',
          span: 8,
          dataOptions: [
            { label: '全部', value: '' },
            { label: '启用', value: '1' },
            { label: '禁用', value: '0' }
          ]
        }
      ],
      // 自动处理请求、分页、联动
      tableOptions: {
        apiParams: { 
          url: '/api/users',
          method: 'POST'
        },
        configTableOut: {
          total: 'total',
          tableData: 'data'
        }
      }
    }
  }
}
&lt;/script&gt;</code></pre>
                </div>
              </div>
            </div>
          </div>
        </div>

        <!-- 核心优势总结 -->
        <div class="advantage-summary">
          <div
            v-for="(adv, index) in advantages"
            :key="index"
            class="advantage-item"
          >
            <div class="advantage-number">
              {{ adv.number }}
            </div>
            <div class="advantage-label">
              {{ adv.label }}
            </div>
            <div class="advantage-desc">
              {{ adv.desc }}
            </div>
          </div>
        </div>
      </div>
    </div>

    <!-- 快速开始 -->
    <div class="quick-start">
      <div class="container">
        <div class="section-header light">
          <span class="section-badge">三步上手</span>
          <h2 class="section-title">
            快速开始
          </h2>
          <p class="section-desc">
            简单三步，即可在项目中使用 ES-Plus
          </p>
        </div>
        
        <div class="install-steps">
          <div
            v-for="(step, index) in steps"
            :key="index"
            class="step"
            :class="{ 'active': activeStep >= index }"
            @click="setActiveStep(index)"
          >
            <div class="step-number">
              {{ index + 1 }}
            </div>
            <div class="step-content">
              <h4>{{ step.title }}</h4>
              <transition name="slide">
                <div
                  v-show="activeStep === index"
                  class="step-detail"
                >
                  <pre><code>{{ step.code }}</code></pre>
                </div>
              </transition>
            </div>
            <div
              v-if="index < steps.length - 1"
              class="step-line"
            ></div>
          </div>
        </div>
        
        <div class="quick-actions">
          <router-link
            to="/guide/quickstart"
            class="btn btn-primary btn-lg"
          >
            查看详细文档
            <i class="el-icon-arrow-right"></i>
          </router-link>
        </div>
      </div>
    </div>

    <!-- CTA 区域 -->
    <div class="cta-section">
      <div class="container">
        <div class="cta-content">
          <h2>准备好开始了吗？</h2>
          <p>加入使用 ES-Plus 的开发者行列，让中后台开发更高效</p>
          <div class="cta-actions">
            <router-link
              to="/guide"
              class="btn btn-primary btn-lg"
            >
              <i class="el-icon-rocket"></i>
              立即开始
            </router-link>
            <a
              href="https://github.com/liujiaao/es-eui"
              target="_blank"
              class="btn btn-outline btn-lg"
            >
              <i class="el-icon-link"></i>
              GitHub
            </a>
          </div>
        </div>
      </div>
    </div>
  </div>
</template>

<script>
// 品牌文案单一真源：由 scripts/sync-brand.mjs 从 docs/brand/slogan.json 分发，禁止手改本文件
import brand from '@/brand/slogan.json'
import CodeDiff from '@/components/CodeDiff.vue'
import TriRenderTabs from '@/components/TriRenderTabs.vue'

export default {
  name: 'Home',
  components: { CodeDiff, TriRenderTabs },
  data() {
    return {
      brand,
      activeStep: 0,
      // ── L2 头号案例「零事件代码的 CRUD」并排 diff 内容 ──
      nativeCode: `<el-form :model="query" inline>
  <el-form-item label="用户名"><el-input v-model="query.name" /></el-form-item>
  <el-form-item label="状态">
    <el-select v-model="query.status">
      <el-option v-for="i in statusOptions" :key="i.value" :label="i.label" :value="i.value" />
    </el-select>
  </el-form-item>
  <el-form-item>
    <el-button type="primary" @click="handleQuery">查询</el-button>
    <el-button @click="handleReset">重置</el-button>
  </el-form-item>
</el-form>

<el-table :data="list" v-loading="loading">
  <el-table-column prop="name" label="用户名" />
  <el-table-column prop="status" label="状态" />
</el-table>
<el-pagination :current-page="page" :page-size="pageSize" :total="total"
  @current-change="handlePage" @size-change="handleSize" />

// ── 原生 script：4 个事件函数 ──
data() {
  return { query: { name: '', status: '' }, list: [], loading: false, page: 1, pageSize: 10, total: 0 }
},
methods: {
  async fetchData() { /* 手写请求 + 赋值 */ },
  handleQuery() { this.page = 1; this.fetchData() },
  handleReset() { this.query = { name: '', status: '' }; this.page = 1; this.fetchData() },
  handlePage(p) { this.page = p; this.fetchData() },
  handleSize(s) { this.pageSize = s; this.page = 1; this.fetchData() }
}
`,
      esplusCode: `<es-table :columns="columns" :options="options">
  <es-form :model="query" :form-item-list="items" :config-btn="btns" />
</es-table>

// ── es-plus script：0 行事件代码 ──
data() {
  return {
    query: { name: '', status: '' },
    items: [
      { prop: 'name', label: '用户名', formtype: 'Input', span: 6 },
      { prop: 'status', label: '状态', formtype: 'Select', span: 6, dataOptions: statusOptions }
    ],
    btns: [
      { name: '查询', key: 'query', triggerEvent: true },
      { name: '重置', key: 'rest', triggerEvent: true }
    ],
    columns: [
      { prop: 'name', label: '用户名' },
      { prop: 'status', label: '状态' }
    ],
    options: { apiParams: { url: '/api/users' } }
  }
}
// 查询/重置/分页全自动联动（triggerEvent）
`,
      // 痛点数据
      painPoints: [
        {
          icon: 'el-icon-document-copy',
          title: '重复造轮子',
          desc: '每个CRUD页面都要写类似的表格、表单、分页代码，三四百行代码大部分时间在重复'
        },
        {
          icon: 'el-icon-link',
          title: '联动逻辑复杂',
          desc: '搜索触发刷新、分页保留条件、新增后自动刷新，每个联动都要手动写watch和回调'
        },
        {
          icon: 'el-icon-s-tools',
          title: '弹窗管理混乱',
          desc: 'visible变量散落各处，方法名千人千面，超过三个弹窗代码可读性急剧下降'
        },
        {
          icon: 'el-icon-refresh',
          title: '接口适配繁琐',
          desc: '后端返回字段名不统一，需要为每个接口写数据转换的适配层代码'
        }
      ],
      // 解决方案数据
      solutions: [
        {
          icon: 'el-icon-document-checked',
          title: '配置化开发',
          desc: 'JSON配置替代模板代码，代码量减少60%以上，所有配置集中管理，修改一目了然'
        },
        {
          icon: 'el-icon-magic-stick',
          title: '内置联动机制',
          desc: '查询/重置自动触发表格刷新，分页自动携带搜索条件，翻页保留选中状态——无需手动编码'
        },
        {
          icon: 'el-icon-s-claim',
          title: '函数式弹窗',
          desc: 'useDialog一行代码打开弹窗，拖拽/全屏/置顶内置支持，告别visible变量管理'
        },
        {
          icon: 'el-icon-data-line',
          title: '统一字段映射',
          desc: 'configTableOut统一配置字段映射，无论后端返回data还是rows都能轻松适配'
        }
      ],
      // 优势数据
      advantages: [
        { number: '60%', label: '代码量减少', desc: '配置化替代模板代码' },
        { number: '80%', label: '效率提升', desc: '专注业务而非重复劳动' },
        { number: '3x', label: '维护速度', desc: '统一规范降低协作成本' },
        { number: '0', label: '学习成本', desc: '基于Element UI无缝上手' }
      ],
      features: [
        {
          icon: 'el-icon-s-grid',
          title: 'EsTable 表格',
          desc: '支持分页、排序、筛选、行内编辑、批量操作等丰富功能，数据展示更灵活',
          color: 'blue'
        },
        {
          icon: 'el-icon-s-order',
          title: 'EsForm 表单',
          desc: '配置化表单生成，支持14种控件类型，自动验证，大幅提升表单开发效率',
          color: 'purple'
        },
        {
          icon: 'el-icon-s-promotion',
          title: 'useDialog 弹窗',
          desc: '函数式调用弹窗，支持JSX渲染，轻松实现复杂交互场景',
          color: 'green'
        },
        {
          icon: 'el-icon-link',
          title: '组件联动',
          desc: '表格与表单无缝联动，查询、编辑、弹窗一体化解决方案',
          color: 'orange'
        }
      ],
      steps: [
        {
          title: '安装组件库',
          code: 'npm install @es-plus/vue2 element-ui'
        },
        {
          title: '引入并注册',
          code: `import Vue from 'vue'
 import EsPlus from '@es-plus/vue2'
 import '@es-plus/vue2/dist/style.css'
  Vue.use(EsPlus, {
    EsTable: {
      methods: {
        $httpRequest({ url, formParams }) {
          return axios.post(url, formParams)
        }
      }
    }
  })`
        },
        {
          title: '开始使用',
          code: `<es-table
  :columns="[
        { key: 'name', label: '用户名' },
        { key: 'status', label: '状态' }
      ]"
  :options="{ 
    apiParams: { url: '/api/list' }
  }"
/>`
        }
      ]
    }
  },
  mounted() {
    this.initAnimations()
  },
  methods: {
    setActiveStep(index) {
      this.activeStep = index
    },
    initAnimations() {
      // 数字滚动动画
      const observer = new IntersectionObserver((entries) => {
        entries.forEach(entry => {
          if (entry.isIntersecting) {
            this.animateNumbers()
            observer.disconnect()
          }
        })
      })
      
      const stats = document.querySelector('.hero-stats')
      if (stats) observer.observe(stats)
    },
    animateNumbers() {
      const numbers = document.querySelectorAll('.stat-number')
      numbers.forEach(num => {
        const target = parseInt(num.getAttribute('data-count'))
        const duration = 2000
        const step = target / (duration / 16)
        let current = 0
        
        const timer = setInterval(() => {
          current += step
          if (current >= target) {
            num.textContent = target
            clearInterval(timer)
          } else {
            num.textContent = Math.floor(current)
          }
        }, 16)
      })
    }
  }
}
</script>

<style lang="scss" scoped>
// 变量定义
$primary: var(--es-brand-primary);
$primary-dark: #324157;
$text-primary: #1a1a1a;
$text-secondary: #4a5568;
$text-tertiary: #718096;
$bg-light: #f7fafc;

// Hero 区域
.hero {
  position: relative;
  min-height: 100vh;
  display: flex;
  align-items: center;
  justify-content: center;
  background: linear-gradient(135deg, #667eea 0%, #764ba2 100%);
  overflow: hidden;
  color: #fff;
  
  // 动态背景
  .hero-bg {
    position: absolute;
    top: 0;
    left: 0;
    right: 0;
    bottom: 0;
    overflow: hidden;
  }
  
  .gradient-orb {
    position: absolute;
    border-radius: 50%;
    filter: blur(80px);
    opacity: 0.5;
    animation: float 20s infinite ease-in-out;
  }
  
  .orb-1 {
    width: 500px;
    height: 500px;
    background: #f093fb;
    top: -10%;
    left: -10%;
    animation-delay: 0s;
  }
  
  .orb-2 {
    width: 400px;
    height: 400px;
    background: #4facfe;
    bottom: -10%;
    right: -10%;
    animation-delay: -5s;
  }
  
  .orb-3 {
    width: 300px;
    height: 300px;
    background: #43e97b;
    top: 50%;
    left: 50%;
    transform: translate(-50%, -50%);
    animation-delay: -10s;
  }
  
  .particles {
    position: absolute;
    width: 100%;
    height: 100%;
  }
  
  .particle {
    position: absolute;
    width: 4px;
    height: 4px;
    background: rgba(255,255,255,0.3);
    border-radius: 50%;
    animation: particle-float 15s infinite;
  }
  
  @for $i from 1 through 20 {
    .particle:nth-child(#{$i}) {
      left: random(100) * 1%;
      top: random(100) * 1%;
      animation-delay: random(15) * -1s;
      animation-duration: 10s + random(10);
    }
  }
  
  .hero-content {
    position: relative;
    z-index: 1;
    text-align: center;
    padding: 40px 20px;
  }
  
  .hero-logo {
    margin-bottom: 30px;
    
    .logo-icon {
      width: 80px;
      height: 80px;
      margin: 0 auto;
      background: rgba(255,255,255,0.2);
      backdrop-filter: blur(10px);
      border-radius: 20px;
      display: flex;
      align-items: center;
      justify-content: center;
      border: 1px solid rgba(255,255,255,0.3);
      animation: pulse 2s infinite;
      
      .logo-text {
        font-size: 32px;
        font-weight: 700;
        background: linear-gradient(to right, #fff, #e0e7ff);
        -webkit-background-clip: text;
        -webkit-text-fill-color: transparent;
      }
    }
  }
  
  .hero-title {
    font-size: 72px;
    font-weight: 700;
    margin-bottom: 20px;
    letter-spacing: -2px;
    
    .gradient-text {
      background: linear-gradient(135deg, #fff 0%, #e0e7ff 50%, #c7d2fe 100%);
      -webkit-background-clip: text;
      -webkit-text-fill-color: transparent;
      animation: shimmer 3s infinite linear;
      background-size: 200% auto;
    }
  }
  
  .hero-desc {
    font-size: 24px;
    font-weight: 300;
    margin-bottom: 10px;
    opacity: 0.95;
    
    .typing-text {
      border-right: 3px solid rgba(255,255,255,0.7);
      animation: blink 0.8s infinite;
    }
  }
  
  .hero-subdesc {
    font-size: 16px;
    opacity: 0.8;
    margin-bottom: 30px;
    max-width: 600px;
    margin-left: auto;
    margin-right: auto;
    line-height: 1.6;
  }
  
  .hero-stats {
    display: flex;
    justify-content: center;
    gap: 60px;
    margin-bottom: 40px;
    
    .stat-item {
      text-align: center;
      
      .stat-number {
        font-size: 48px;
        font-weight: 700;
        color: #fff;
        line-height: 1;
      }
      
      .stat-label {
        display: block;
        font-size: 14px;
        opacity: 0.8;
        margin-top: 5px;
      }
    }
  }
  
  .hero-actions {
    display: flex;
    justify-content: center;
    gap: 20px;
    margin-bottom: 60px;
    
    .btn {
      display: inline-flex;
      align-items: center;
      gap: 8px;
      padding: 14px 32px;
      border-radius: 50px;
      text-decoration: none;
      font-size: 16px;
      font-weight: 500;
      transition: all 0.3s ease;
      
      &.btn-primary {
        background: #fff;
        color: #667eea;
        box-shadow: 0 4px 15px rgba(0,0,0,0.2);
        
        &:hover {
          transform: translateY(-3px);
          box-shadow: 0 8px 25px rgba(0,0,0,0.3);
          
          i {
            transform: translateX(4px);
          }
        }
        
        i {
          transition: transform 0.3s;
        }
      }
      
      &.btn-default {
        background: rgba(255,255,255,0.1);
        border: 2px solid rgba(255,255,255,0.3);
        color: #fff;
        backdrop-filter: blur(10px);
        
        &:hover {
          background: rgba(255,255,255,0.2);
          border-color: #fff;
          transform: translateY(-3px);
        }
      }
    }
  }
  
  .scroll-hint {
    position: absolute;
    bottom: 40px;
    left: 50%;
    transform: translateX(-50%);
    display: flex;
    flex-direction: column;
    align-items: center;
    gap: 10px;
    opacity: 0.7;
    animation: bounce 2s infinite;
    
    .mouse {
      width: 26px;
      height: 40px;
      border: 2px solid #fff;
      border-radius: 13px;
      position: relative;
      
      .wheel {
        width: 4px;
        height: 8px;
        background: #fff;
        border-radius: 2px;
        position: absolute;
        top: 8px;
        left: 50%;
        transform: translateX(-50%);
        animation: scroll 1.5s infinite;
      }
    }
    
    span {
      font-size: 12px;
    }
  }
}

// 三承诺（品牌单一真源）
.promises {
  padding: 48px 0 0;
  background: #fff;

  .promises-grid {
    display: grid;
    grid-template-columns: repeat(3, 1fr);
    gap: 24px;
  }

  .promise-card {
    padding: 32px 28px;
    border: 1px solid #e2e8f0;
    border-radius: 16px;
    text-align: center;
    transition: all 0.3s ease;

    &:hover {
      transform: translateY(-4px);
      box-shadow: 0 16px 40px rgba(102, 126, 234, 0.12);
      border-color: #667eea;
    }
  }

  .promise-title {
    font-size: 22px;
    font-weight: 700;
    color: $text-primary;
    margin-bottom: 10px;
  }

  .promise-claim {
    display: inline-block;
    padding: 4px 14px;
    margin-bottom: 14px;
    font-size: 13px;
    font-weight: 600;
    color: #0e7490;
    background: rgba(6, 182, 212, 0.08);
    border-radius: 20px;
  }

  .promise-desc {
    font-size: 14px;
    color: $text-secondary;
    line-height: 1.7;
    margin: 0;
  }
}

// L2 头号案例
.l2-case {
  padding: 48px 0;
  background: #f7fafc;

  .section-header {
    text-align: center;
    margin-bottom: 32px;

    .section-title {
      font-size: 36px;
      font-weight: 700;
      color: $text-primary;
      margin-bottom: 12px;
    }

    .section-desc {
      font-size: 16px;
      color: $text-secondary;
      line-height: 1.7;
      max-width: 720px;
      margin: 0 auto;

      code {
        padding: 2px 6px;
        background: #e2e8f0;
        color: $primary;
        border-radius: 4px;
        font-family: 'Consolas', monospace;
        font-size: 14px;
      }
    }
  }
}

// 三端通用
.tri-section {
  padding: 48px 0;
  background: #fff;

  .section-header {
    text-align: center;
    margin-bottom: 32px;

    .section-title {
      font-size: 36px;
      font-weight: 700;
      color: $text-primary;
      margin-bottom: 12px;
    }

    .section-desc {
      font-size: 16px;
      color: $text-secondary;
      line-height: 1.7;
      max-width: 720px;
      margin: 0 auto;
    }
  }
}

// AI 一句话生成 CRUD 入口
.ai-entry {
  padding: 40px 0;
  background: #fff;
}

.ai-entry-card {
  display: block;
  padding: 32px;
  background: linear-gradient(135deg, #f0f9eb 0%, #ecf5ff 100%);
  border: 1px solid #e6f4d8;
  border-radius: 16px;
  text-align: center;
  text-decoration: none;
  transition: all 0.3s ease;

  &:hover {
    transform: translateY(-3px);
    box-shadow: 0 12px 28px rgba(102, 126, 234, 0.15);
  }

  h3 {
    margin: 0 0 8px;
    font-size: 20px;
    font-weight: 700;
    color: $text-primary;
  }

  p {
    margin: 0;
    color: $text-secondary;
    font-size: 14px;
  }
}

// 特性展示
.features {
  padding: 80px 0;
  background: #fff;
  
  .section-header {
    text-align: center;
    margin-bottom: 60px;
   
    
    .section-badge {
      display: inline-block;
      padding: 6px 16px;
      background: linear-gradient(135deg, #667eea 0%, #764ba2 100%);
      color: #fff;
      border-radius: 20px;
      font-size: 12px;
      font-weight: 500;
      margin-bottom: 16px;
    }
    
    .section-title {
      font-size: 40px;
      font-weight: 700;
      color: $text-primary;
      margin-bottom: 16px;
    }
    
    .section-desc {
      font-size: 18px;
      color: $text-secondary;
    }
  }
  
  .feature-list {
    display: grid;
    grid-template-columns: repeat(4, 1fr);
    gap: 30px;
  }
  
  .feature-item {
    position: relative;
    text-align: center;
    padding: 40px 24px;
    border-radius: 20px;
    background: #fff;
    border: 1px solid #e2e8f0;
    transition: all 0.4s ease;
    overflow: hidden;
    animation: fadeInUp 0.8s ease forwards;
    opacity: 0;
    
    &:hover {
      transform: translateY(-10px);
      box-shadow: 0 20px 40px rgba(102, 126, 234, 0.15);
      border-color: transparent;
      
      .feature-hover {
        opacity: 1;
      }
      
      .feature-icon {
        transform: scale(1.1);
      }
    }
    
    .feature-hover {
      position: absolute;
      top: 0;
      left: 0;
      right: 0;
      bottom: 0;
      background: linear-gradient(135deg, rgba(102, 126, 234, 0.03) 0%, rgba(118, 75, 162, 0.03) 100%);
      opacity: 0;
      transition: opacity 0.3s;
      pointer-events: none;
    }
    
    .feature-icon {
      width: 80px;
      height: 80px;
      margin: 0 auto 24px;
      border-radius: 24px;
      display: flex;
      align-items: center;
      justify-content: center;
      transition: transform 0.3s;
      
      &.blue {
        background: linear-gradient(135deg, #667eea 0%, #764ba2 100%);
      }
      
      &.purple {
        background: linear-gradient(135deg, #f093fb 0%, #f5576c 100%);
      }
      
      &.green {
        background: linear-gradient(135deg, #4facfe 0%, #00f2fe 100%);
      }
      
      &.orange {
        background: linear-gradient(135deg, #fa709a 0%, #fee140 100%);
      }
      
      i {
        font-size: 36px;
        color: #fff;
      }
    }
    
    h3 {
      font-size: 20px;
      color: $text-primary;
      margin-bottom: 12px;
      font-weight: 600;
    }
    
    p {
      font-size: 14px;
      color: $text-secondary;
      line-height: 1.7;
    }
  }
}

// 痛点与解决方案
.pain-points-section {
   padding: 0px 0 120px 0;
  background: linear-gradient(180deg, #f7fafc 0%, #fff 100%);
  
  .section-header {
    text-align: center;
    margin-bottom: 60px;
       padding-top: 60px;
    .section-badge {
      display: inline-block;
      padding: 8px 20px;
      background: linear-gradient(135deg, #667eea 0%, #764ba2 100%);
      color: #fff;
      border-radius: 20px;
      font-size: 13px;
      font-weight: 500;
      margin-bottom: 16px;
    }
    
    .section-title {
      font-size: 40px;
      font-weight: 700;
      color: $text-primary;
      margin-bottom: 16px;
    }
    
    .section-desc {
      font-size: 18px;
      color: $text-secondary;
    }
  }
  
  // 痛点与解决方案对比网格
  .pain-solution-grid {
    display: grid;
    grid-template-columns: 1fr auto 1fr;
    gap: 40px;
    margin-bottom: 80px;
    align-items: center;
  }
  
  .subsection-title {
    font-size: 20px;
    font-weight: 600;
    margin-bottom: 24px;
    display: flex;
    align-items: center;
    gap: 10px;
    
    i {
      font-size: 24px;
    }
    
    &.pain-title {
      color: #f56c6c;
      i { color: #f56c6c; }
    }
    
    &.solution-title {
      color: #67c23a;
      i { color: #67c23a; }
    }
  }
  
  .pain-cards, .solution-cards {
    .pain-card, .solution-card {
      display: flex;
      gap: 16px;
      padding: 20px;
      border-radius: 12px;
      margin-bottom: 16px;
      transition: all 0.3s ease;
      
      &:hover {
        transform: translateX(5px);
      }
    }
    
    .pain-card {
      background: #fff;
      border-left: 4px solid #f56c6c;
      box-shadow: 0 2px 12px rgba(245, 108, 108, 0.1);
      
      &:hover {
        box-shadow: 0 8px 24px rgba(245, 108, 108, 0.15);
      }
      
      .pain-icon {
        width: 44px;
        height: 44px;
        background: rgba(245, 108, 108, 0.1);
        border-radius: 10px;
        display: flex;
        align-items: center;
        justify-content: center;
        flex-shrink: 0;
        
        i {
          font-size: 20px;
          color: #f56c6c;
        }
      }
    }
    
    .solution-card {
      background: #fff;
      border-left: 4px solid #67c23a;
      box-shadow: 0 2px 12px rgba(103, 194, 58, 0.1);
      
      &:hover {
        box-shadow: 0 8px 24px rgba(103, 194, 58, 0.15);
      }
      
      .solution-icon {
        width: 44px;
        height: 44px;
        background: rgba(103, 194, 58, 0.1);
        border-radius: 10px;
        display: flex;
        align-items: center;
        justify-content: center;
        flex-shrink: 0;
        
        i {
          font-size: 20px;
          color: #67c23a;
        }
      }
    }
    
    .pain-content, .solution-content {
      h4 {
        font-size: 16px;
        font-weight: 600;
        color: $text-primary;
        margin-bottom: 6px;
      }
      
      p {
        font-size: 14px;
        color: $text-secondary;
        line-height: 1.6;
        margin: 0;
      }
    }
  }
  
  // 中间箭头
  .solution-arrow {
    display: flex;
    flex-direction: column;
    align-items: center;
    justify-content: center;
    padding-top: 60px;
    
    .arrow-line {
      width: 60px;
      height: 60px;
      background: linear-gradient(135deg, #667eea 0%, #764ba2 100%);
      border-radius: 50%;
      display: flex;
      align-items: center;
      justify-content: center;
      margin-bottom: 12px;
      box-shadow: 0 4px 15px rgba(102, 126, 234, 0.3);
      animation: pulse 2s infinite;
      
      i {
        font-size: 28px;
        color: #fff;
      }
    }
    
    .arrow-text {
      font-size: 14px;
      font-weight: 600;
      color: #667eea;
      white-space: nowrap;
    }
  }
  
  // 代码对比区域
  .code-compare-section {
    margin-bottom: 60px;
    
    .compare-title {
      text-align: center;
      margin-bottom: 30px;
      display: flex;
      align-items: center;
      justify-content: center;
      gap: 20px;
      
      .compare-badge {
        padding: 8px 20px;
        border-radius: 20px;
        font-size: 14px;
        font-weight: 600;
        
        &.traditional {
          background: #fef0f0;
          color: #f56c6c;
          margin-left: -55px;
        }
        
        &.eseui {
          background: #f0f9eb;
          color: #67c23a;
        }
      }
      
      .vs-text {
        font-size: 18px;
        font-weight: 700;
        color: $text-tertiary;
      }
    }
    
    .code-compare-grid {
      display: grid;
      grid-template-columns: 1fr 1fr;
      gap: 30px;
    }
  }
  
  // 代码窗口样式
  .code-block-wrapper {
    .code-window {
      background: #1e1e1e;
      border-radius: 16px;
      overflow: hidden;
      box-shadow: 0 20px 40px rgba(0,0,0,0.15);
      height: 100%;
      
      &.traditional {
        border: 2px solid #fde2e2;
      }
      
      &.eseui {
        border: 2px solid #e1f3d8;
      }
      
      .code-header {
        display: flex;
        align-items: center;
        gap: 10px;
        padding: 14px 18px;
        background: #2d2d2d;
        
        .window-dots {
          display: flex;
          gap: 8px;
          
          .dot {
            width: 12px;
            height: 12px;
            border-radius: 50%;
            
            &.red { background: #ff5f56; }
            &.yellow { background: #ffbd2e; }
            &.green { background: #27c93f; }
          }
        }
        
        .code-title {
          color: #999;
          font-size: 13px;
          margin-left: 10px;
          font-family: 'Consolas', monospace;
        }
      }
      
      .code-body {
        padding: 16px;
        overflow-x: auto;
        max-height: 450px;
        overflow-y: auto;
        
        pre {
          margin: 0;
          
          code {
            font-family: 'Fira Code', 'Consolas', monospace;
            font-size: 12px;
            line-height: 1.5;
            color: #d4d4d4;
          }
        }
      }
    }
  }
  
  // 优势总结
  .advantage-summary {
    display: grid;
    grid-template-columns: repeat(4, 1fr);
    gap: 30px;
    margin-top: 60px;
    padding: 40px;
    background: linear-gradient(135deg, #667eea 0%, #764ba2 100%);
    border-radius: 20px;
    
    .advantage-item {
      text-align: center;
      color: #fff;
      
      .advantage-number {
        font-size: 48px;
        font-weight: 700;
        margin-bottom: 8px;
        background: linear-gradient(to right, #fff, #e0e7ff);
        -webkit-background-clip: text;
        -webkit-text-fill-color: transparent;
      }
      
      .advantage-label {
        font-size: 16px;
        font-weight: 600;
        margin-bottom: 6px;
      }
      
      .advantage-desc {
        font-size: 13px;
        opacity: 0.85;
      }
    }
  }
}

// 快速开始
.quick-start {
  padding: 120px 0;
  background: linear-gradient(135deg, #667eea 0%, #764ba2 100%);
  color: #fff;
  
  .section-header {
    text-align: center;
    margin-bottom: 60px;
    
    &.light {
      .section-badge {
        background: rgba(255,255,255,0.2);
            border-radius: 20px;
            display: inline-block;
            padding: 02px 20px;
      }
      
      .section-title {
        padding: 20px 0px;
        color: #fff;
        
        
      }
      
      .section-desc {
        color: rgba(255,255,255,0.8);
      }
    }
  }
  
  .install-steps {
    max-width: 800px;
    margin: 0 auto 50px;
    
    .step {
      position: relative;
      padding-left: 60px;
      padding-bottom: 40px;
      cursor: pointer;
      
      &:last-child {
        padding-bottom: 0;
      }
      
      &.active {
        .step-number {
          background: #fff;
          color: #667eea;
          transform: scale(1.1);
        }
        
        .step-content h4 {
          color: #fff;
        }
      }
      
      .step-number {
        position: absolute;
        left: 0;
        top: 0;
        width: 40px;
        height: 40px;
        background: rgba(255,255,255,0.2);
        border-radius: 50%;
        display: flex;
        align-items: center;
        justify-content: center;
        font-size: 16px;
        font-weight: 600;
        transition: all 0.3s;
      }
      
      .step-line {
        position: absolute;
        left: 20px;
        top: 40px;
        bottom: 0;
        width: 2px;
        background: rgba(255,255,255,0.2);
      }
      
      .step-content {
        h4 {
          font-size: 18px;
          margin-bottom: 12px;
          color: rgba(255,255,255,0.7);
          transition: color 0.3s;
        }
        
        .step-detail {
          pre {
            background: rgba(0,0,0,0.3);
            border-radius: 12px;
            padding: 20px;
            overflow-x: auto;
            
            code {
              color: #fff;
              font-family: 'Fira Code', Consolas, monospace;
              font-size: 14px;
              line-height: 1.6;
            }
          }
        }
      }
    }
  }
  
  .quick-actions {
    text-align: center;
  }
}

// CTA 区域
.cta-section {
  padding: 100px 0;
  background: #fff;
  
  .cta-content {
    text-align: center;
    max-width: 600px;
    margin: 0 auto;
    
    h2 {
      font-size: 36px;
      font-weight: 700;
      color: $text-primary;
      margin-bottom: 16px;
    }
    
    p {
      font-size: 18px;
      color: $text-secondary;
      margin-bottom: 40px;
    }
    
    .cta-actions {
      display: flex;
      justify-content: center;
      gap: 20px;
    }
  }
}

// 按钮样式
.btn {
  display: inline-flex;
  align-items: center;
  gap: 8px;
  padding: 12px 28px;
  border-radius: 50px;
  text-decoration: none;
  font-size: 15px;
  font-weight: 500;
  transition: all 0.3s ease;
  cursor: pointer;
  border: none;
  
  &.btn-lg {
    padding: 16px 32px;
    font-size: 16px;
  }
  
  &.btn-primary {
    background: linear-gradient(135deg, #667eea 0%, #764ba2 100%);
    color: #fff;
    box-shadow: 0 4px 15px rgba(102, 126, 234, 0.3);
    
    &:hover {
      transform: translateY(-2px);
      box-shadow: 0 8px 25px rgba(102, 126, 234, 0.4);
    }
  }
  
  &.btn-outline {
    background: transparent;
    border: 2px solid #667eea;
    color: #667eea;
    
    &:hover {
      background: #667eea;
      color: #fff;
    }
  }
}

// 容器
.container {
  max-width: 960px;
  margin: 0 auto;
  padding: 0 20px;
}

// 动画定义
@keyframes float {
  0%, 100% { transform: translate(0, 0); }
  25% { transform: translate(50px, -50px); }
  50% { transform: translate(0, -100px); }
  75% { transform: translate(-50px, -50px); }
}

@keyframes particle-float {
  0%, 100% { 
    transform: translateY(0) rotate(0deg);
    opacity: 0;
  }
  10% { opacity: 1; }
  90% { opacity: 1; }
  100% { 
    transform: translateY(-100vh) rotate(360deg);
    opacity: 0;
  }
}

@keyframes pulse {
  0%, 100% { transform: scale(1); }
  50% { transform: scale(1.05); }
}

@keyframes shimmer {
  0% { background-position: 0% center; }
  100% { background-position: 200% center; }
}

@keyframes blink {
  0%, 100% { border-color: transparent; }
  50% { border-color: rgba(255,255,255,0.7); }
}

@keyframes bounce {
  0%, 20%, 50%, 80%, 100% { transform: translateX(-50%) translateY(0); }
  40% { transform: translateX(-50%) translateY(-10px); }
  60% { transform: translateX(-50%) translateY(-5px); }
}

@keyframes scroll {
  0% { opacity: 1; top: 8px; }
  100% { opacity: 0; top: 20px; }
}

@keyframes fadeInUp {
  from {
    opacity: 0;
    transform: translateY(30px);
  }
  to {
    opacity: 1;
    transform: translateY(0);
  }
}

// 响应式
@media (max-width: 992px) {
  .hero {
    .hero-title {
      font-size: 52px;
    }
    
    .hero-stats {
      gap: 40px;
    }
  }
  
  .features {
    .feature-list {
      grid-template-columns: repeat(2, 1fr);
    }
  }
  
  .pain-points-section {
    .pain-solution-grid {
      grid-template-columns: 1fr;
      gap: 30px;
    }
    
    .solution-arrow {
      padding-top: 0;
      transform: rotate(90deg);
      
      .arrow-text {
        transform: rotate(-90deg);
      }
    }
    
    .code-compare-grid {
      grid-template-columns: 1fr;
    }
    
    .advantage-summary {
      grid-template-columns: repeat(2, 1fr);
    }
  }
}

@media (max-width: 768px) {
  .hero {
    .hero-title {
      font-size: 40px;
    }
    
    .hero-desc {
      font-size: 18px;
    }
    
    .hero-stats {
      flex-direction: column;
      gap: 20px;
    }
    
    .hero-actions {
      flex-direction: column;
      align-items: center;
    }
  }
  
  .features {
    padding: 80px 0;

    .feature-list {
      grid-template-columns: 1fr;
    }

    .section-title {
      font-size: 28px;
    }
  }

  .promises {
    .promises-grid {
      grid-template-columns: 1fr;
    }
  }
  
  .cta-section {
    .cta-actions {
      flex-direction: column;
      align-items: center;
    }
  }
}

// 过渡动画
.slide-enter-active,
.slide-leave-active {
  transition: all 0.3s ease;
}

.slide-enter,
.slide-leave-to {
  opacity: 0;
  transform: translateY(-10px);
}
</style>
