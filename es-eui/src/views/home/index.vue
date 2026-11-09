<template>
  <div class="home">
    <!-- Hero 区域（审计 P0-1 / §6.3-3）：
         此前是整屏高饱和蓝青渐变 + 光斑 + 浮动 logo + 渐变字，属 2018 年的营销落地页形态。
         现在与另两站同构 —— 白底、实心黑标题、价值主张先行、右侧本站真实渲染的产品实拍。 -->
    <div class="hero">
      <div class="container">
        <div class="hero-content">
          <div class="hero-copy">
            <!-- 品牌名降级为胶囊标签：H1 留给「这是什么」，读屏大纲与 SEO 的标题权重
                 才落在产品定位而不是品牌名上（三站同一条规则）。 -->
            <span class="hero-eyebrow">{{ brand.name }} · 配置层</span>

            <h1 class="hero-title">
              {{ brand.positioning }}
            </h1>

            <p class="hero-lead">
              {{ brand.slogan.subtitle }}
            </p>

            <!-- 本站身份写在这句里：H1 三站一致，差异在渲染端 -->
            <p class="hero-desc">
              本站是 <strong>Vue 2 + Element UI</strong> 渲染端：同一份 JSON Schema 在 Vue 2 / Vue 3 / Ant Design Vue 三端渲染出一致界面，换一行 import 即切换。
            </p>

            <div class="hero-renderer">
              <span class="renderer-badge">本站渲染器：Vue 2 + Element UI</span>
            </div>

            <!-- 操作按钮 -->
            <div class="hero-actions">
              <router-link
                to="/guide"
                class="btn btn-primary"
                data-track="cta-start"
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

            <!-- 统计信息 —— 三个数字都是可核对的事实：
                 渲染端数取自三站切换器的 SITES 数组；表单控件数取自 core 的 VALID_FORM_TYPES；
                 代码降幅取自品牌单源 docs/brand/one-config-diff.json 的实测值。
                 由 scripts/check-site-claims.mjs 守住（此前这里写的是 5 / 20 / 80%，
                 其中控件数与降幅都与源码不符，且本站介绍页自己写的是 16 种）。 -->
            <div class="hero-stats">
              <div class="stat-item">
                <span
                  class="stat-number"
                  data-count="3"
                >0</span> 端
                <span class="stat-label">共用同一份配置</span>
              </div>
              <div class="stat-item">
                <span
                  class="stat-number"
                  data-count="16"
                >0</span> 种
                <span class="stat-label">表单控件</span>
              </div>
              <div class="stat-item">
                <span
                  class="stat-number"
                  data-count="76.5"
                >0</span>%
                <span class="stat-label">模板与事件胶水代码减少</span>
              </div>
            </div>
          </div>

          <!-- 产品实拍（路线图 2.1 / 2.2）：首屏右侧是本站**真实渲染**的旗舰案例。
               此前的首屏是一整屏渐变 + 粒子，用户看完不知道「配置出来的 CRUD 长什么样」。
               图由 scripts/gen-product-shots.mjs 现拍，三站同一份字节，check:product-assets 守卫。 -->
          <figure class="hero-shot">
            <img
              src="/product/eui-flagship-approval-light.png"
              alt="Vue 2 + Element UI 渲染端实拍：合同审批工作台的查询区、数据表格与行内审批按钮"
              width="1600"
              height="1000"
            />
            <figcaption>
              本站渲染端实拍 ·
              <router-link to="/flagship-approval">合同审批工作台</router-link>
              —— 一份纯 JSON，0 个函数
            </figcaption>
          </figure>
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
          <h2 class="section-title">头号案例 · 零事件代码的 CRUD</h2>
          <p class="section-desc">
            原生「查询 → 重置 → 翻页」要写 4 个事件函数，还容易踩「拿最新表单值」的坑。
            es-plus 用 <strong>EsForm 嵌套 EsTable</strong> + <code>triggerEvent: true</code>，把整条联动链路收敛为 <strong>0 行事件代码</strong>。
          </p>
        </div>
        <!-- 两段代码来自品牌单源（docs/brand/one-config/*.vue），行数徽章是实测值。
             样例源码是 Vue 3 + Element Plus 语法（品牌单源全站共用一份）；本站是 Vue 2 + Element UI，
             所以标题里显式标注渲染端，避免读者照着 `<script setup>` 抄到 Vue 2 页面里。 -->
        <CodeDiff
          left-title="传统写法（Vue 3 + Element Plus）"
          right-title="ES-Plus（Vue 3 + Element Plus）"
          :left-lines="oneConfig.breakdown.native.totalLines + ' 行'"
          :right-lines="oneConfig.breakdown.esplus.totalLines + ' 行'"
          :left-code="oneConfig.code.native.text"
          :right-code="oneConfig.code.esplus.text"
        />
        <!-- 口径说明：本站是 Vue 2 渲染端，而品牌单源的对比样例用的是 Vue 3 + Element Plus
             语法。不写这句，读者会照着 `<script setup>` 抄到 Vue 2 页面里。 -->
        <p class="l2-note">
          两段样例都用 Element Plus 语法，比较的是「同一页面、同一功能范围」的代码量（品牌单源实测）。
          本站是 <strong>Vue 2 + Element UI 渲染端</strong>：同一份配置只需把 import 换成
          <code>@es-plus/vue2</code>，字段 / 列 / 按钮配置一字不改 —— 三端实际渲染效果见下方「三端通用」。
        </p>
      </div>
    </div>

    <!-- 三端通用：同一份 Schema 源码 + 三端渲染快照 -->
    <div class="tri-section">
      <div class="container">
        <div class="section-header">
          <h2 class="section-title">三端通用</h2>
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
          href="https://main.esplus-ai.com/#/ai-crud"
          target="_blank"
          rel="noopener"
          class="ai-entry-card"
        >
          <h3>AI 一句话生成 CRUD</h3>
          <p>在 Claude Code / Cursor 里说一句话，生成可编译的三端通用 CRUD 页面。在线体验见主站 AiCrud。</p>
        </a>
      </div>
    </div>

    <!-- 组件能力（能力层）：承诺讲「是什么」，这里讲「拿什么做」 -->
    <div class="features">
      <div class="container">
        <div class="section-header">
          <h2 class="section-title">
            四个组件，覆盖 CRUD 全流程
          </h2>
          <p class="section-desc">
            表格、表单、弹窗与它们的联动 —— 每一层都由 JSON 配置驱动，不需要写模板与事件胶水。
          </p>
        </div>
        
        <div class="feature-list">
          <!-- 卡片不再逐个延迟入场（原来 index*0.1s，第 12 张要等 1.1s 才出现）：
               一次 240ms 的入场就够，延迟堆叠只会让页面显得慢 -->
          <div
            v-for="(feature, index) in features"
            :key="index"
            class="feature-item"
            :class="{ 'fade-in': true }"
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
  </div>
</template>

<script>
// 品牌文案单一真源：由 scripts/sync-brand.mjs 从 docs/brand/slogan.json 分发，禁止手改本文件
import brand from '@/brand/slogan.json'
// 「一份配置」对比的实测数据（单源 docs/brand/one-config-diff.json）
import oneConfig from '@/brand/one-config-diff.json'
import CodeDiff from '@/components/CodeDiff.vue'
import TriRenderTabs from '@/components/TriRenderTabs.vue'

export default {
  name: 'Home',
  components: { CodeDiff, TriRenderTabs },
  data() {
    return {
      brand,
      activeStep: 0,
      // L2 头号案例的并排 diff 不再内联节选伪代码（旧的节选带「...」省略，
      // 配的 ~250/~30 行徽章其实是 CodeDiff 的默认 prop，与任何真实代码都对不上）。
      // 完整两版源码与实测行数来自品牌单源 docs/brand/one-config-diff.json。
      oneConfig,
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
          desc: 'JSON 配置替代模板代码：模板与事件胶水代码实测减少 76.5%，所有配置集中管理，修改一目了然'
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
      // 优势数据 —— 全部是可核对的事实，不写无法验证的「3x 维护速度」这类数字。
      // 由 scripts/check-site-claims.mjs 逐项校验（口径见该脚本头部注释）。
      // 降幅写 76.5% 而不是取整的 77%：三站必须显示同一组数字（审计 P0-3）。
      advantages: [
        { number: '76.5%', label: '模板与事件胶水代码减少', desc: '查询 / 重置 / 翻页 / 取数全部由配置接管' },
        { number: '16', label: '表单控件', desc: '与 Vue 3 / Ant Design Vue 端共用同一份配置与同一套字段' },
        { number: '3', label: '渲染端共用一份配置', desc: 'Vue 2 + Element UI、Vue 3 + Element Plus、Vue 3 + Ant Design Vue' },
        { number: '0', label: '联动链路事件代码', desc: 'triggerEvent 自动接管，只剩编辑 / 删除两个业务动作需要手写' }
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
          desc: '配置化表单生成，支持16种控件类型，自动验证，大幅提升表单开发效率',
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
        { prop: 'name', label: '用户名' },
        { prop: 'status', label: '状态' }
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
        // data-count 允许小数（76.5）：取整会让本站显示 77%，而主站与 slogan.json 是 76.5%，
        // 三站同一组数字是这次审计的硬要求（P0-3）。小数位数由字面量本身决定。
        const raw = num.getAttribute('data-count')
        const target = parseFloat(raw)
        const decimals = String(raw).includes('.') ? 1 : 0
        const duration = 2000
        const step = target / (duration / 16)
        let current = 0

        const timer = setInterval(() => {
          current += step
          if (current >= target) {
            num.textContent = target.toFixed(decimals)
            clearInterval(timer)
          } else {
            num.textContent = current.toFixed(decimals)
          }
        }, 16)
      })
    }
  }
}
</script>

<style lang="scss" scoped>
// 变量：颜色一律走 design-tokens（scripts/check-design-tokens 会把新增 hex 标红）。
// 这里不再定义 $text-primary / $text-secondary 之类的近似色 —— 它们此前是
// #1a1a1a / #4a5568 两个令牌外的自造值，与 --es-text-primary / -secondary 只差一点，
// 结果同一页出现两种「主文字色」。

// Hero 区域（审计 P0-1 / §6.3-3）
// 白底 + 双栏（价值主张 / 本站产品实拍），与主站、AntDV 站同构。
// 删掉的：整屏蓝青渐变、三颗模糊光斑、浮动 logo、渐变裁切标题、假打字机光标、滚动提示鼠标 ——
// 这些是 2018 年营销落地页的语汇，也是「三站三张脸」里最不认得出是同一个产品的一张。
.hero {
  background: var(--es-bg);
  border-bottom: 1px solid var(--es-border-lighter);

  .hero-content {
    display: grid;
    grid-template-columns: minmax(0, 0.95fr) minmax(0, 1.05fr);
    align-items: center;
    gap: var(--es-space-7);
    padding: var(--es-space-8) 0 var(--es-space-7);

    /* 窄屏：一列，文案居中，图仍然紧跟在首屏（路线图 2.1 要求 1 屏内出现证据） */
    @media (max-width: 1023px) {
      grid-template-columns: 1fr;
      gap: var(--es-space-6);
      text-align: center;
      padding: var(--es-space-6) 0;
    }
  }

  .hero-copy {
    min-width: 0;
  }

  /* 品牌名从 72px 渐变字降级成 13px 胶囊标签：H1 留给「这是什么」 */
  .hero-eyebrow {
    display: inline-block;
    margin-bottom: var(--es-space-3);
    font-size: var(--es-text-sm);
    font-weight: 600;
    letter-spacing: 0.08em;
    text-transform: uppercase;
    color: var(--es-accent-text);
  }

  .hero-title {
    margin: 0 0 var(--es-space-3);
    /* 40px = --es-display-sm：子站 H1 比主站（56px）小一档，三站读起来是同一套阶梯 */
    font-size: var(--es-display-sm);
    line-height: var(--es-leading-tight);
    letter-spacing: -0.02em;
    font-weight: 800;
    color: var(--es-text-primary);
    /* 390px 下这行标题会断成「…的配置」+ 孤零零一个「层」；
       平衡断行让两行长度接近（不支持的浏览器自然忽略） */
    text-wrap: balance;

    @media (max-width: 767px) {
      font-size: var(--es-text-4xl);
    }
  }

  .hero-lead {
    margin: 0 0 var(--es-space-3);
    font-size: var(--es-text-xl);
    font-weight: 500;
    line-height: var(--es-leading-snug);
    color: var(--es-text-regular);

    @media (max-width: 767px) {
      font-size: var(--es-text-lg);
    }
  }

  .hero-desc {
    margin: 0 0 var(--es-space-4);
    max-width: 620px;
    font-size: var(--es-text-md);
    line-height: var(--es-leading-relaxed);
    color: var(--es-text-secondary);

    strong {
      color: var(--es-text-primary);
      font-weight: 600;
    }
  }

  .hero-renderer {
    margin-bottom: var(--es-space-5);
  }

  .renderer-badge {
    display: inline-block;
    padding: 4px 14px;
    font-size: var(--es-text-sm);
    font-weight: 500;
    color: var(--es-brand-strong);
    background: var(--es-brand-tint);
    border: 1px solid var(--es-border-lighter);
    border-radius: var(--es-radius-full);
  }

  .hero-actions {
    display: flex;
    flex-wrap: wrap;
    gap: var(--es-space-3);
    margin-bottom: var(--es-space-6);

    @media (max-width: 1023px) {
      justify-content: center;
    }
  }

  .hero-stats {
    display: flex;
    gap: var(--es-space-7);
    margin: 0;
    padding-top: var(--es-space-5);
    border-top: 1px solid var(--es-border-lighter);

    @media (max-width: 1023px) {
      justify-content: center;
      text-align: center;
      gap: var(--es-space-6);
    }

    /* 390px 下三项并排：数字缩一号，读得清也不把产品实拍挤出首屏 */
    @media (max-width: 767px) {
      display: grid;
      grid-template-columns: repeat(3, minmax(0, 1fr));
      gap: var(--es-space-3);
      text-align: left;
    }

    .stat-item {
      min-width: 0;
    }

    .stat-number {
      font-size: var(--es-text-4xl);
      font-weight: 700;
      line-height: 1.1;
      color: var(--es-text-primary);
      font-variant-numeric: tabular-nums;

      @media (max-width: 767px) {
        font-size: var(--es-text-2xl);
      }
    }

    .stat-label {
      display: block;
      margin-top: var(--es-space-1);
      font-size: var(--es-text-sm);
      line-height: 1.45;
      color: var(--es-text-secondary);

      @media (max-width: 767px) {
        font-size: var(--es-text-xs);
      }
    }
  }

  /* 产品实拍：白底卡片 + 圆角 + 阴影，让浏览器截图读起来像「产品窗口」而不是一张图 */
  .hero-shot {
    margin: 0;
    min-width: 0;
    border-radius: var(--es-radius-md);
    overflow: hidden;
    background: var(--es-bg);
    border: 1px solid var(--es-border-light);
    box-shadow: var(--es-shadow-lg);

    img {
      display: block;
      width: 100%;
      height: auto;
    }

    figcaption {
      padding: var(--es-space-3) var(--es-space-4);
      border-top: 1px solid var(--es-border-lighter);
      font-size: var(--es-text-sm);
      color: var(--es-text-secondary);
      text-align: left;

      a {
        color: var(--es-brand-strong);
        text-decoration: none;

        &:hover { text-decoration: underline; }
      }
    }
  }
}

// 三承诺（品牌单一真源）
.promises {
  padding: var(--es-space-7) 0 0;
  background: var(--es-bg);

  .promises-grid {
    display: grid;
    grid-template-columns: repeat(3, 1fr);
    gap: var(--es-space-5);

    @media (max-width: 767px) {
      grid-template-columns: 1fr;
    }
  }

  .promise-card {
    padding: var(--es-space-6) var(--es-space-5);
    border: 1px solid var(--es-border-lighter);
    border-radius: var(--es-radius-md);
    background: var(--es-bg);
    text-align: left;
    transition:
      border-color var(--es-duration-base) var(--es-ease),
      box-shadow var(--es-duration-base) var(--es-ease),
      transform var(--es-duration-base) var(--es-ease);

    &:hover {
      transform: translateY(-2px);
      border-color: var(--es-brand-primary);
      box-shadow: var(--es-shadow-md);
    }
  }

  .promise-title {
    margin: 0 0 var(--es-space-2);
    font-size: var(--es-text-xl);
    font-weight: 700;
    color: var(--es-text-primary);
  }

  .promise-claim {
    display: inline-block;
    padding: 3px 12px;
    margin-bottom: var(--es-space-3);
    font-size: var(--es-text-sm);
    font-weight: 600;
    color: var(--es-brand-strong);
    background: var(--es-brand-tint);
    border-radius: var(--es-radius-full);
  }

  .promise-desc {
    margin: 0;
    font-size: var(--es-text-base);
    line-height: var(--es-leading-relaxed);
    color: var(--es-text-secondary);
  }
}

// L2 头号案例
.l2-case {
  padding: var(--es-space-7) 0;
  background: var(--es-bg-page);
}

// 三端通用
.tri-section {
  padding: var(--es-space-7) 0;
  background: var(--es-bg);
}

// 分节标题（三处共用同一套度量，此前 32/36/40 三种字号各写一遍）
.l2-case,
.tri-section,
.features,
.pain-points-section,
.quick-start {
  .section-header {
    text-align: center;
    margin-bottom: var(--es-space-6);

    .section-badge {
      display: inline-block;
      margin-bottom: var(--es-space-3);
      padding: 3px 12px;
      font-size: var(--es-text-xs);
      font-weight: 600;
      color: var(--es-brand-strong);
      background: var(--es-brand-tint);
      border-radius: var(--es-radius-full);
    }

    .section-title {
      margin: 0 0 var(--es-space-3);
      font-size: var(--es-text-2xl);
      font-weight: 700;
      line-height: var(--es-leading-tight);
      color: var(--es-text-primary);
    }

    .section-desc {
      max-width: 720px;
      margin: 0 auto;
      font-size: var(--es-text-md);
      line-height: var(--es-leading-relaxed);
      color: var(--es-text-secondary);
    }
  }
}

// 「一份配置」的口径说明：本站是 Vue 2 渲染端，样例源码是 Element Plus 语法
.l2-note {
  margin: var(--es-space-4) 0 0;
  padding: var(--es-space-3) var(--es-space-4);
  background: var(--es-bg);
  border-left: 3px solid var(--es-brand-primary);
  border-radius: var(--es-radius-xs);
  color: var(--es-text-secondary);
  font-size: var(--es-text-sm);
  line-height: var(--es-leading-relaxed);

  code {
    padding: 2px 6px;
    background: var(--es-brand-tint);
    color: var(--es-brand-strong);
    border-radius: var(--es-radius-xs);
    font-family: var(--es-font-mono);
    font-size: var(--es-text-xs);
  }
}

// AI 一句话生成 CRUD 入口
.ai-entry {
  padding: var(--es-space-6) 0;
  background: var(--es-bg);
}

.ai-entry-card {
  display: block;
  padding: var(--es-space-6);
  background: var(--es-brand-tint);
  border: 1px solid var(--es-border-lighter);
  border-radius: var(--es-radius-md);
  text-align: center;
  text-decoration: none;
  transition:
    border-color var(--es-duration-base) var(--es-ease),
    box-shadow var(--es-duration-base) var(--es-ease),
    transform var(--es-duration-base) var(--es-ease);

  &:hover {
    transform: translateY(-2px);
    border-color: var(--es-brand-primary);
    box-shadow: var(--es-shadow-md);
  }

  h3 {
    margin: 0 0 var(--es-space-2);
    font-size: var(--es-text-xl);
    font-weight: 700;
    color: var(--es-text-primary);
  }

  p {
    margin: 0;
    color: var(--es-text-secondary);
    font-size: var(--es-text-base);
    line-height: var(--es-leading-relaxed);
  }
}

// 组件能力
.features {
  padding: var(--es-space-7) 0;
  background: var(--es-bg);

  .feature-list {
    display: grid;
    grid-template-columns: repeat(4, 1fr);
    gap: var(--es-space-5);

    @media (max-width: 992px) {
      grid-template-columns: repeat(2, 1fr);
    }

    @media (max-width: 767px) {
      grid-template-columns: 1fr;
    }
  }

  .feature-item {
    position: relative;
    padding: var(--es-space-6) var(--es-space-5);
    border-radius: var(--es-radius-md);
    background: var(--es-bg);
    border: 1px solid var(--es-border-lighter);
    transition:
      border-color var(--es-duration-base) var(--es-ease),
      box-shadow var(--es-duration-base) var(--es-ease),
      transform var(--es-duration-base) var(--es-ease);
    overflow: hidden;
    /* 入场 240ms 一次性：卡片滚进视口时不该再无限动 */
    animation: fadeInUp var(--es-duration-slow) var(--es-ease) forwards;
    opacity: 0;

    &:hover {
      transform: translateY(-3px);
      box-shadow: var(--es-shadow-md);
      border-color: var(--es-brand-primary);

      .feature-icon {
        transform: scale(1.06);
      }
    }

    .feature-hover {
      display: none;
    }

    /* 图标原来四种颜色各配一种渐变（蓝 / 紫 / 绿 / 橙），同一类东西被分成了四种。
       审计 §6.6：一个页面最多一个强调色 —— 统一为品牌色浅底 + 品牌色图标。 */
    .feature-icon {
      width: 44px;
      height: 44px;
      margin: 0 0 var(--es-space-4);
      border-radius: var(--es-radius-sm);
      display: flex;
      align-items: center;
      justify-content: center;
      background: var(--es-brand-tint);
      transition: transform var(--es-duration-base) var(--es-ease);

      &.blue,
      &.purple,
      &.green,
      &.orange {
        background: var(--es-brand-tint);
      }

      i {
        font-size: 22px;
        color: var(--es-brand-strong);
      }
    }

    h3 {
      margin: 0 0 var(--es-space-2);
      font-size: var(--es-text-md);
      font-weight: 600;
      color: var(--es-text-primary);
    }

    p {
      margin: 0;
      font-size: var(--es-text-base);
      line-height: var(--es-leading-relaxed);
      color: var(--es-text-secondary);
    }
  }
}

// 痛点与解决方案
// 红 / 绿两张对比卡是这次审计点名的「2018 年营销语汇」：问题与方案不该用两种
// 高饱和语义色喊出来。现在两边都是中性卡片，差别只体现在图标语义与文字上，
// 底色统一回到页面灰 —— 视线先落在「痛点 → 方案」的对应关系，而不是颜色。
.pain-points-section {
  padding: var(--es-space-7) 0;
  background: var(--es-bg-page);

  // 痛点与解决方案对比网格
  .pain-solution-grid {
    display: grid;
    grid-template-columns: 1fr auto 1fr;
    gap: var(--es-space-6);
    margin-bottom: var(--es-space-7);
    align-items: center;
  }

  .subsection-title {
    display: flex;
    align-items: center;
    gap: var(--es-space-2);
    margin: 0 0 var(--es-space-4);
    font-size: var(--es-text-md);
    font-weight: 600;
    color: var(--es-text-regular);

    i {
      font-size: 18px;
    }

    &.pain-title {
      color: var(--es-text-regular);
      i { color: var(--es-text-secondary); }
    }

    &.solution-title {
      color: var(--es-text-primary);
      i { color: var(--es-brand-strong); }
    }
  }

  .pain-cards, .solution-cards {
    .pain-card, .solution-card {
      display: flex;
      gap: var(--es-space-3);
      padding: var(--es-space-4);
      border-radius: var(--es-radius-md);
      margin-bottom: var(--es-space-3);
      background: var(--es-bg);
      border: 1px solid var(--es-border-lighter);
      transition:
        border-color var(--es-duration-base) var(--es-ease),
        box-shadow var(--es-duration-base) var(--es-ease);
    }

    .pain-card:hover {
      border-color: var(--es-border);
    }

    .solution-card:hover {
      border-color: var(--es-brand-primary);
      box-shadow: var(--es-shadow-sm);
    }

    .pain-icon,
    .solution-icon {
      width: 36px;
      height: 36px;
      border-radius: var(--es-radius-sm);
      display: flex;
      align-items: center;
      justify-content: center;
      flex-shrink: 0;

      i {
        font-size: 18px;
      }
    }

    .pain-icon {
      background: var(--es-fill);
      i { color: var(--es-text-secondary); }
    }

    .solution-icon {
      background: var(--es-brand-tint);
      i { color: var(--es-brand-strong); }
    }

    .pain-content, .solution-content {
      min-width: 0;

      h4 {
        margin: 0 0 var(--es-space-1);
        font-size: var(--es-text-base);
        font-weight: 600;
        color: var(--es-text-primary);
      }

      p {
        margin: 0;
        font-size: var(--es-text-sm);
        line-height: var(--es-leading-normal);
        color: var(--es-text-secondary);
      }
    }
  }

  // 中间箭头
  .solution-arrow {
    display: flex;
    flex-direction: column;
    align-items: center;
    justify-content: center;

    .arrow-line {
      width: 40px;
      height: 40px;
      background: var(--es-bg);
      border: 1px solid var(--es-border-light);
      border-radius: var(--es-radius-full);
      display: flex;
      align-items: center;
      justify-content: center;
      margin-bottom: var(--es-space-2);

      i {
        font-size: 18px;
        color: var(--es-brand-strong);
      }
    }

    .arrow-text {
      font-size: var(--es-text-xs);
      font-weight: 600;
      color: var(--es-text-secondary);
      white-space: nowrap;
    }
  }

  // 优势总结：此前是整块蓝青渐变 + 渐变裁切数字，现在是页面上的一个统计条
  .advantage-summary {
    display: grid;
    grid-template-columns: repeat(4, 1fr);
    gap: var(--es-space-6);
    padding: var(--es-space-6);
    background: var(--es-bg);
    border: 1px solid var(--es-border-lighter);
    border-radius: var(--es-radius-md);

    @media (max-width: 992px) {
      grid-template-columns: repeat(2, 1fr);
    }

    @media (max-width: 767px) {
      grid-template-columns: 1fr;
      gap: var(--es-space-5);
    }

    .advantage-item {
      min-width: 0;
    }

    .advantage-number {
      font-size: var(--es-text-3xl);
      font-weight: 700;
      line-height: 1.1;
      margin-bottom: var(--es-space-2);
      color: var(--es-text-primary);
      font-variant-numeric: tabular-nums;
    }

    .advantage-label {
      margin-bottom: var(--es-space-1);
      font-size: var(--es-text-base);
      font-weight: 600;
      color: var(--es-text-primary);
    }

    .advantage-desc {
      font-size: var(--es-text-sm);
      line-height: var(--es-leading-normal);
      color: var(--es-text-secondary);
    }
  }
}

// 快速开始
// 此前是第二块整屏蓝青渐变（hero 一块、这里一块），把「三步上手」压成了营销收尾。
// 现在回到白底：步骤编号用品牌色浅底，代码块用深色，与文档页的代码块同一种观感。
.quick-start {
  padding: var(--es-space-7) 0 var(--es-space-8);
  background: var(--es-bg);

  .install-steps {
    max-width: 800px;
    margin: 0 auto var(--es-space-6);
  }

  .step {
    position: relative;
    padding-left: 56px;
    padding-bottom: var(--es-space-6);
    cursor: pointer;

    &:last-child {
      padding-bottom: 0;
    }

    &.active {
      .step-number {
        background: var(--es-brand-strong);
        color: #fff;
      }

      .step-content h4 {
        color: var(--es-text-primary);
      }
    }

    .step-number {
      position: absolute;
      left: 0;
      top: 0;
      width: 36px;
      height: 36px;
      background: var(--es-brand-tint);
      color: var(--es-brand-strong);
      border-radius: var(--es-radius-full);
      display: flex;
      align-items: center;
      justify-content: center;
      font-size: var(--es-text-base);
      font-weight: 600;
      transition:
        background-color var(--es-duration-base) var(--es-ease),
        color var(--es-duration-base) var(--es-ease);
    }

    .step-line {
      position: absolute;
      left: 17px;
      top: 36px;
      bottom: 0;
      width: 2px;
      background: var(--es-border-lighter);
    }

    .step-content {
      h4 {
        margin: 0 0 var(--es-space-3);
        font-size: var(--es-text-md);
        font-weight: 600;
        line-height: 36px;
        color: var(--es-text-secondary);
        transition: color var(--es-duration-base) var(--es-ease);
      }

      .step-detail {
        pre {
          background: #1e1e1e;
          border-radius: var(--es-radius-md);
          padding: var(--es-space-4);
          overflow-x: auto;
          margin: 0;

          code {
            color: #dcdfe4;
            font-family: var(--es-font-mono);
            font-size: var(--es-text-sm);
            line-height: var(--es-leading-normal);
          }
        }
      }
    }
  }

  .quick-actions {
    text-align: center;
  }
}

// 按钮样式
// 圆角 50px（胶囊）与渐变填充是 2018 年落地页的形态；现在是 8px 圆角 + 实心品牌蓝。
// 填充色用 --es-brand-strong（白字 5.17:1，AA）而不是 --es-brand-primary（3.68:1）：
// #3b82f6 只做填充装饰可以，承载 16px 白字不够。
.btn {
  display: inline-flex;
  align-items: center;
  gap: var(--es-space-2);
  padding: 10px 20px;
  border-radius: var(--es-radius-sm);
  text-decoration: none;
  font-size: var(--es-text-base);
  font-weight: 500;
  transition:
    background-color var(--es-duration-base) var(--es-ease),
    border-color var(--es-duration-base) var(--es-ease),
    color var(--es-duration-base) var(--es-ease),
    box-shadow var(--es-duration-base) var(--es-ease),
    transform var(--es-duration-base) var(--es-ease);
  cursor: pointer;
  border: 1px solid transparent;

  i {
    transition: transform var(--es-duration-base) var(--es-ease);
  }

  &:hover i {
    transform: translateX(3px);
  }

  &.btn-lg {
    padding: 12px 24px;
    font-size: var(--es-text-md);
  }

  &.btn-primary {
    background: var(--es-brand-strong);
    color: #fff;

    &:hover {
      background: #1d4ed8;
      box-shadow: var(--es-shadow-sm);
    }
  }

  &.btn-default {
    background: var(--es-bg);
    border-color: var(--es-border);
    color: var(--es-text-regular);

    &:hover {
      border-color: var(--es-brand-primary);
      color: var(--es-brand-strong);
    }
  }

  &.btn-outline {
    background: transparent;
    border-color: var(--es-border);
    color: var(--es-text-regular);

    &:hover {
      border-color: var(--es-brand-primary);
      color: var(--es-brand-strong);
    }
  }
}

// 容器：首屏要放下「文案 + 产品实拍」两列，960 太窄（两列各不到 400px，
// 实拍缩成缩略图就看不出是什么）。其余段落跟着一起放宽，避免首屏与下方错位。
.container {
  max-width: 1120px;
  margin: 0 auto;
  padding: 0 20px;
}

// 动画定义：只剩入场（一次性）。原先的 float / particle-float / pulse / shimmer /
// blink / bounce / scroll 七个无限循环已按路线图 2.8 移除 —— 动效只描述状态变化。

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

// 响应式：各段自己的断点写在各段里（hero 两列、卡片网格），这里只留跨组件的两处
@media (max-width: 992px) {
  .pain-points-section {
    .pain-solution-grid {
      grid-template-columns: 1fr;
      gap: var(--es-space-4);
    }

    /* 竖排时中间那枚箭头从上指变成下指 */
    .solution-arrow {
      transform: rotate(90deg);

      .arrow-text {
        transform: rotate(-90deg);
      }
    }
  }
}

@media (max-width: 767px) {
  .container {
    padding: 0 var(--es-space-4);
  }

  /* 390px 下两个 CTA 并排会挤成两行窄条，铺满更利落 */
  .hero .hero-actions .btn {
    flex: 1 1 auto;
    justify-content: center;
  }
}

// 过渡动画：只动 opacity / transform（路线图 2.8：不对 all 做动画）
.slide-enter-active,
.slide-leave-active {
  transition: opacity var(--es-duration-base) var(--es-ease),
    transform var(--es-duration-base) var(--es-ease);
}

.slide-enter,
.slide-leave-to {
  opacity: 0;
  transform: translateY(-10px);
}
</style>
