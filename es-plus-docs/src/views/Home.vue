<template>
  <div class="home-page">
    <!-- Hero Section -->
    <div class="hero-section">
      <div class="hero-content">
        <div class="hero-badge">{{ t('home.badge') }}</div>
        <!-- H1 = 品牌 + 定位语（与 AntDV / Vue2 站同一结构）。
             此前定位语在 <p> 里，H1 只有一个词，三站各写各的。 -->
        <h1 class="hero-title">
          {{ t('home.title') }}
          <span class="hero-title-sub">{{ t('home.tagline1') }}</span>
        </h1>
        <p class="hero-description">
          <span class="hero-subtitle">{{ t('home.tagline2') }}</span>
        </p>
        <!-- Landing 最多两个主 CTA（主色 + 次色），其余降级为文字链接（路线图 2.1） -->
        <div class="hero-actions">
          <el-button type="primary" size="large" @click="goToGuide">
            <el-icon class="btn-icon"><Document /></el-icon>
            {{ t('home.ctaQuickStart') }}
          </el-button>
          <el-button size="large" class="cta-secondary" @click="goToAiCrud">
            <el-icon class="btn-icon"><MagicStick /></el-icon>
            {{ t('home.ctaAiCrud') }}
          </el-button>
        </div>
        <p class="hero-links">
          <a class="hero-link" href="#/playground" @click.prevent="goToPlayground">
            <el-icon class="btn-icon"><Monitor /></el-icon>{{ t('home.ctaPlayground') }}
          </a>
          <a
            class="hero-link"
            href="https://github.com/liujiaao/es-plus"
            target="_blank"
            rel="noopener"
          >
            <el-icon class="btn-icon"><svg viewBox="0 0 24 24" width="14" height="14"><path fill="currentColor" d="M12 2C6.477 2 2 6.477 2 12c0 4.42 2.87 8.17 6.84 9.5.5.08.66-.23.66-.5v-1.69c-2.77.6-3.36-1.34-3.36-1.34-.46-1.16-1.11-1.47-1.11-1.47-.91-.62.07-.6.07-.6 1 .07 1.53 1.03 1.53 1.03.87 1.52 2.34 1.07 2.91.83.09-.65.35-1.09.63-1.34-2.22-.25-4.55-1.11-4.55-4.92 0-1.11.38-2 1.03-2.71-.1-.25-.45-1.29.1-2.64 0 0 .84-.27 2.75 1.02.79-.22 1.65-.33 2.5-.33.85 0 1.71.11 2.5.33 1.91-1.29 2.75-1.02 2.75-1.02.55 1.35.2 2.39.1 2.64.65.71 1.03 1.6 1.03 2.71 0 3.82-2.34 4.66-4.57 4.91.36.31.69.92.69 1.85V21c0 .27.16.59.67.5C19.14 20.16 22 16.42 22 12A10 10 0 0012 2z"/></svg></el-icon>{{ t('home.ctaGithub') }}
          </a>
        </p>
        <div class="hero-stats">
          <div class="stat-item">
            <span class="stat-value">{{ t('home.stat1Value') }}</span>
            <span class="stat-label">{{ t('home.stat1Label') }}</span>
          </div>
          <div class="stat-item">
            <span class="stat-value">{{ t('home.stat2Value') }}</span>
            <span class="stat-label">{{ t('home.stat2Label') }}</span>
          </div>
          <div class="stat-item">
            <span class="stat-value">{{ t('home.stat3Value') }}</span>
            <span class="stat-label">{{ t('home.stat3Label') }}</span>
          </div>
        </div>
      </div>
      <!-- 首屏证据：不是截图文案，是真的跑一遍生成器（路线图 2.3） -->
      <HeroTriRender class="hero-demo" />
    </div>

    <!-- 三个可验证承诺（文案单一真源 docs/brand/slogan.json） -->
    <div class="promises-section">
      <div class="promises-grid">
        <div class="promise-card" v-for="p in promises" :key="p.key">
          <h3 class="promise-title">{{ p.title }}</h3>
          <div class="promise-claim">{{ p.claim }}</div>
          <p class="promise-desc">{{ p.desc }}</p>
        </div>
      </div>
    </div>

    <!-- L2 头号案例：零事件代码的 CRUD -->
    <div class="l2-case-section">
      <h2 class="section-title">🎯 头号案例 · 零事件代码的 CRUD</h2>
      <p class="section-subtitle">
        原生「查询 → 重置 → 翻页」要写 4 个事件函数，还容易踩「拿最新表单值」的坑。
        es-plus 用 <code>EsForm 嵌套 EsTable</code> + <code>triggerEvent: true</code>，把整条联动链路收敛为 <strong>0 行事件代码</strong>。
      </p>
      <!-- 这里不重复贴代码：完整两版源码与实测降幅在下方「一份配置」一节，全页只有一处代码面 -->
      <div class="l2-glue">
        <div class="l2-glue-item">
          <span class="l2-glue-figure">{{ oneConfig.breakdown.native.glueLines }} 行</span>
          <span class="l2-glue-label">原生：查询 / 重置 / 翻页 / 取数的事件函数</span>
        </div>
        <span class="l2-glue-arrow">→</span>
        <div class="l2-glue-item">
          <span class="l2-glue-figure good">{{ oneConfig.breakdown.esplus.glueLines }} 行</span>
          <span class="l2-glue-label">ES-Plus：仅剩编辑 / 删除两个业务动作（联动链路 0 行）</span>
        </div>
      </div>
    </div>

    <!-- Comparison Section -->
    <div class="comparison-section">
      <h2 class="section-title">{{ t('home.comparisonTitle') }}</h2>
      <p class="section-subtitle">{{ t('home.comparisonSubtitle') }}</p>
      <!-- 两段代码来自品牌单源（docs/brand/one-config/*.vue），行数徽章是实测值而非组件默认值 -->
      <CodeDiff
        :left-title="t('home.traditionalBadge')"
        :right-title="t('home.esPlusBadge')"
        :left-lines="`${oneConfig.breakdown.native.totalLines}${t('home.linesSuffix')}`"
        :right-lines="`${oneConfig.breakdown.esplus.totalLines}${t('home.linesSuffix')}`"
        :left-code="oneConfig.code.native.text"
        :right-code="oneConfig.code.esplus.text"
      />
      <div class="comparison-stats">
        <div v-for="m in comparisonStats" :key="m.label" class="comp-stat">
          <span class="comp-stat-value">{{ m.value }}</span>
          <span class="comp-stat-label">{{ m.label }}</span>
        </div>
      </div>
      <p class="comparison-note">
        {{ t('home.comparisonNote') }}
      </p>
    </div>

    <!-- Cross-Renderer Section (三端通用 — 结构性护城河) -->
    <div class="cross-section">
      <h2 class="section-title">{{ t('home.crossTitle') }}</h2>
      <p class="section-subtitle">{{ t('home.crossSubtitle') }}</p>
      <!-- 三端切换器：同一份 Schema 源码 + 三端渲染快照（docs/改造三端站点.md §5.4） -->
      <TriRenderTabs />
    </div>

    <!-- AI Live Demo (moved up — let users feel the value first) -->
    <AiLiveDemo />

    <!-- Features Section -->
    <div class="features-section">
      <h2 class="section-title">{{ t('home.featuresTitle') }}</h2>
      <div class="features-grid">
        <div class="feature-card">
          <div class="feature-icon-wrapper blue">
            <el-icon :size="28"><Edit /></el-icon>
          </div>
          <h3 class="feature-title">{{ t('home.feature1Title') }}</h3>
          <p class="feature-desc">{{ t('home.feature1Desc') }}</p>
        </div>

        <div class="feature-card">
          <div class="feature-icon-wrapper green">
            <el-icon :size="28"><Connection /></el-icon>
          </div>
          <h3 class="feature-title">{{ t('home.feature2Title') }}</h3>
          <p class="feature-desc">{{ t('home.feature2Desc') }}</p>
        </div>

        <div class="feature-card">
          <div class="feature-icon-wrapper purple">
            <el-icon :size="28"><SetUp /></el-icon>
          </div>
          <h3 class="feature-title">{{ t('home.feature3Title') }}</h3>
          <p class="feature-desc">{{ t('home.feature3Desc') }}</p>
        </div>

        <div class="feature-card">
          <div class="feature-icon-wrapper orange">
            <el-icon :size="28"><MagicStick /></el-icon>
          </div>
          <h3 class="feature-title">{{ t('home.feature4Title') }}</h3>
          <p class="feature-desc">{{ t('home.feature4Desc') }}</p>
        </div>
      </div>
    </div>

    <!-- Components Section -->
    <div class="components-section">
      <h2 class="section-title">{{ t('home.componentsTitle') }}</h2>
      <div class="components-grid">
        <router-link to="/components/es-form" class="component-card">
          <div class="component-icon">
            <el-icon :size="40"><DocumentChecked /></el-icon>
          </div>
          <div class="component-info">
            <h3>EsForm <span class="component-tag">{{ t('home.componentTagForm') }}</span></h3>
            <p>{{ t('home.esFormDesc') }}</p>
            <div class="component-links">
              <span class="link">{{ t('home.viewDocs') }}</span>
            </div>
          </div>
        </router-link>

        <router-link to="/components/es-table" class="component-card">
          <div class="component-icon">
            <el-icon :size="40"><List /></el-icon>
          </div>
          <div class="component-info">
            <h3>EsTable <span class="component-tag">{{ t('home.componentTagTable') }}</span></h3>
            <p>{{ t('home.esTableDesc') }}</p>
            <div class="component-links">
              <span class="link">{{ t('home.viewDocs') }}</span>
            </div>
          </div>
        </router-link>

        <router-link to="/advanced/use-dialog" class="component-card">
          <div class="component-icon">
            <el-icon :size="40"><ChatDotRound /></el-icon>
          </div>
          <div class="component-info">
            <h3>useDialog <span class="component-tag">{{ t('home.componentTagDialog') }}</span></h3>
            <p>{{ t('home.useDialogDesc') }}</p>
            <div class="component-links">
              <span class="link">{{ t('home.viewDocs') }}</span>
            </div>
          </div>
        </router-link>

        <router-link to="/components/es-crud-page" class="component-card">
          <div class="component-icon">
            <el-icon :size="40"><Grid /></el-icon>
          </div>
          <div class="component-info">
            <h3>EsCrudPage <span class="component-tag">{{ t('home.componentTagCrud') }}</span></h3>
            <p>{{ t('home.esCrudPageDesc') }}</p>
            <div class="component-links">
              <span class="link">{{ t('home.viewDocs') }}</span>
            </div>
          </div>
        </router-link>
      </div>
    </div>

    <!-- Get Started Section -->
    <div class="get-started-section">
      <h2 class="section-title">{{ t('home.getStartedTitle') }}</h2>
      <div class="install-steps">
        <div class="step">
          <div class="step-number">1</div>
          <div class="step-content">
            <h4>{{ t('home.step1Title') }}</h4>
            <div class="code-block">
              <code>npm install @es-plus/vue3 element-plus @element-plus/icons-vue</code>
            </div>
          </div>
        </div>
        <div class="step">
          <div class="step-number">2</div>
          <div class="step-content">
            <h4>{{ t('home.step2Title') }}</h4>
            <div class="code-block">
              <code>import { EsForm, EsTable, useDialog } from '@es-plus/vue3'</code>
            </div>
          </div>
        </div>
        <div class="step">
          <div class="step-number">3</div>
          <div class="step-content">
            <h4>{{ t('home.step3Title') }}</h4>
            <div class="code-block">
              <code>&lt;es-form :model="model" :form-item-list="items" /&gt;</code>
            </div>
          </div>
        </div>
      </div>
    </div>

  </div>
</template>

<script setup>
import { computed } from 'vue'
import { useRouter } from 'vue-router'
import { useI18n } from 'vue-i18n'
import { useHead } from '@unhead/vue'
import { Document, Monitor, Edit, Connection, SetUp, Grid, DocumentChecked, List, ChatDotRound, MagicStick } from '@element-plus/icons-vue'
import AiLiveDemo from '@/components/home/AiLiveDemo.vue'
// 品牌文案单一真源：由 scripts/sync-brand.mjs 从 docs/brand/slogan.json 分发，禁止手改本文件
import brand from '@/brand/slogan.json'
// 「一份配置」对比的实测数据（通用单源：docs/brand/one-config-diff.json，由 gen-one-config-diff.mjs 实测生成）
import oneConfigDiff from '@/brand/one-config-diff.json'
import CodeDiff from '@/components/doc/CodeDiff.vue'
import TriRenderTabs from '@/components/home/TriRenderTabs.vue'
// 首屏「改配置 → 三端变」小部件：真跑生成器，不是截图（路线图 2.3）
import HeroTriRender from '@/components/home/HeroTriRender.vue'

const { t, locale } = useI18n()

// 三站对齐的三个可验证承诺，按当前语言取文案
const promises = computed(() => {
  const en = locale.value === 'en-US'
  return brand.promises.map((p) => ({
    key: p.key,
    title: en ? p.titleEn : p.title,
    claim: en ? p.claimEn : p.claim,
    desc: en ? p.descEn : p.desc,
  }))
})

// ── 「一份配置」对比：两段源码与全部数字都来自品牌单源 ──
// 单源：docs/brand/one-config/{native,esplus}.vue → scripts/gen-one-config-diff.mjs 实测
// → docs/brand/one-config-diff.json → scripts/sync-brand.mjs 分发到本站 src/brand/。
// 因此这里没有硬编码的行数：徽章与降幅都是实测值，改源码即改数字。
const oneConfig = oneConfigDiff

const comparisonStats = computed(() => {
  const m = oneConfig.metrics
  // 数字取自实测产出，标签走 i18n（JSON 里的 label 只有中文，不能直接上英文页）
  return [
    { value: `-${m.markupPlusGlue.reduction}%`, label: t('home.compStatGlue') },
    { value: `-${m.wholeFile.reduction}%`, label: t('home.compStatLines') },
    { value: '0', label: t('home.compStatEvents') },
  ]
})

const esplusCode = `<es-table :columns="columns" :options="options">
  <es-form :model="query" :form-item-list="items" :config-btn="btns" />
</es-table>

// ── es-plus script：0 行事件代码 ──
const query = reactive({ name: '', status: '' })
const items = [
  { prop: 'name', label: '用户名', formtype: 'Input', span: 6 },
  { prop: 'status', label: '状态', formtype: 'Select', span: 6, dataOptions: statusOptions },
]
const btns = [
  { name: '查询', key: 'query', triggerEvent: true },
  { name: '重置', key: 'rest', triggerEvent: true },
]
const columns = [
  { prop: 'name', label: '用户名' },
  { prop: 'status', label: '状态' },
]
const options = { apiParams: { url: '/api/users' } }
// 0 行事件代码：查询/重置/分页全自动联动（triggerEvent）
`

useHead({
  title: '中后台 CRUD 的配置层',
  meta: [
    { name: 'description', content: 'ES-Plus — 中后台 CRUD 的配置层：一份 JSON 配置，Vue 2 / Vue 3 / Ant Design Vue 三端通用，AI 生成即编译。' },
    { property: 'og:title', content: 'ES-Plus · 中后台 CRUD 的配置层' },
    { property: 'og:description', content: '中后台 CRUD 的配置层：一份配置 · 三个渲染器 · 生成即编译。' },
  ],
})

const router = useRouter()

const goToGuide = () => {
  router.push('/guide/getting-started')
}

const goToPlayground = () => {
  router.push('/playground')
}

const goToAiCrud = () => {
  router.push('/ai-crud')
}
</script>

<style lang="scss" scoped>
.home-page {
  min-height: calc(100vh - var(--header-height));
}

// Hero Section
.hero-section {
  display: grid;
  /* 右侧证据区明显宽于文字：三端差异行（行号 + 高亮 + import）才读得下，
     左侧文案到 409px 仍有富余（最长一行副标题约 370px）—— 路线图 2.1/2.3 */
  grid-template-columns: minmax(0, 0.78fr) minmax(0, 1.22fr);
  gap: 56px;
  align-items: center;
  min-height: 600px;
  padding: 72px 48px;
  /* 首屏去侧栏（T1）后宽度全归自己，与下面几个区块同一条 1200px 中线对齐 ——
     否则 hero 比正文宽出 80px，滚动时左边线会「跳」一下。 */
  max-width: 1200px;
  margin: 0 auto;
  // background: linear-gradient(135deg, var(--es-fill) 0%, #ffffff 100%);
}

.hero-content {
  max-width: 560px;
}

.hero-badge {
  display: inline-block;
  padding: 6px 16px;
  background: linear-gradient(135deg, var(--primary-color), var(--brand-accent));
  color: white;
  border-radius: 20px;
  font-size: 14px;
  font-weight: 500;
  margin-bottom: 24px;
}

.hero-title {
  font-size: 72px;
  font-weight: 800;
  background: linear-gradient(135deg, var(--primary-color), var(--brand-accent));
  -webkit-background-clip: text;
  -webkit-text-fill-color: transparent;
  margin-bottom: 16px;
  letter-spacing: -2px;
}

/* H1 内的定位语：h1 本身是渐变裁切（text-fill transparent），
   子元素必须显式恢复填充色，否则整行只剩渐变块而没有字。 */
.hero-title-sub {
  display: block;
  margin-top: 12px;
  font-size: 20px;
  font-weight: 500;
  letter-spacing: 0;
  background: none;
  -webkit-text-fill-color: currentColor;
  color: var(--text-color-regular);
}

.hero-description {
  font-size: 22px;
  color: var(--text-color-regular);
  margin-bottom: 32px;
  line-height: 1.6;
}

.hero-subtitle {
  color: var(--text-color-secondary);
  font-size: 18px;
}

.hero-actions {
  display: flex;
  gap: 16px;
  /* 只留一点点：下面紧跟一行次级文字链接，两者是同一组入口 */
  margin-bottom: 12px;
}

.btn-icon {
  margin-right: 6px;
}

.hero-stats {
  display: flex;
  gap: 48px;
}

.stat-item {
  display: flex;
  flex-direction: column;
}

.stat-value {
  font-size: 28px;
  font-weight: 700;
  color: var(--text-color-primary);
}

.stat-label {
  font-size: 14px;
  color: var(--text-color-secondary);
}

// Hero 右侧证据区（路线图 2.3）：此前是一个 11px 的静态代码窗口，
// 既读不清也不证明任何事 —— 现在是可交互的三端生成器。
.hero-demo {
  width: 100%;
  align-self: center;
}

/* 两个主 CTA 之下的次级入口：文字链接（路线图 2.1） */
.hero-links {
  display: flex;
  flex-wrap: wrap;
  gap: 20px;
  margin: 0 0 40px;
}

.hero-link {
  display: inline-flex;
  align-items: center;
  color: var(--es-text-secondary);
  font-size: 14px;
  text-decoration: none;
  transition: color 0.18s;

  &:hover {
    color: var(--es-link);
    text-decoration: underline;
    text-underline-offset: 3px;
  }
}

// Promises Section (三承诺)
.promises-section {
  padding: 48px 48px 0;
  max-width: 1200px;
  margin: 0 auto;
}

.promises-grid {
  display: grid;
  grid-template-columns: repeat(3, 1fr);
  gap: 24px;
}

.promise-card {
  padding: 32px 28px;
  background: var(--bg-color);
  border: 1px solid var(--border-color-lighter);
  border-radius: 16px;
  text-align: center;
  transition: all 0.3s;

  &:hover {
    transform: translateY(-4px);
    box-shadow: 0 16px 40px rgba(0, 0, 0, 0.08);
    border-color: var(--primary-color);
  }
}

.promise-title {
  font-size: 22px;
  font-weight: 700;
  color: var(--text-color-primary);
  margin-bottom: 10px;
}

.promise-claim {
  display: inline-block;
  padding: 4px 14px;
  margin-bottom: 14px;
  font-size: 13px;
  font-weight: 600;
  color: var(--brand-accent);
  background: rgba(6, 182, 212, 0.08);
  border-radius: 20px;
}

.promise-desc {
  font-size: 14px;
  color: var(--text-color-secondary);
  line-height: 1.7;
  margin: 0;
}

// L2 头号案例
.l2-case-section {
  padding: 48px 48px;
  max-width: 1200px;
  margin: 0 auto;

  .section-title {
    margin-bottom: 20px;
  }

  .section-subtitle {
    text-align: center;
    font-size: 16px;
    color: var(--text-color-secondary);
    margin: -12px auto 40px;
    max-width: 720px;
    line-height: 1.7;

    code {
      padding: 2px 6px;
      background: var(--fill-color-light);
      color: var(--primary-color);
      border-radius: 4px;
      font-family: 'SFMono-Regular', Consolas, monospace;
      font-size: 14px;
    }
  }
}

// Comparison Section
.comparison-section {
  padding: 100px 48px;
  background: var(--bg-color);
}

.section-subtitle {
  text-align: center;
  font-size: 18px;
  color: var(--text-color-secondary);
  margin-top: -48px;
  margin-bottom: 48px;
}

.comparison-grid {
  display: grid;
  grid-template-columns: 1fr 1fr;
  gap: 32px;
  max-width: 1200px;
  margin: 0 auto;
}

.comparison-card {
  border-radius: 12px;
  overflow: hidden;
  border: 1px solid var(--border-color-lighter);
  transition: transform 0.3s, box-shadow 0.3s;

  &:hover {
    transform: translateY(-4px);
    box-shadow: 0 12px 32px rgba(0, 0, 0, 0.08);
  }

  &.traditional {
    border-color: #f56c6c33;
  }

  &.esplus {
    border-color: #67c23a33;
  }
}

.comparison-header {
  display: flex;
  align-items: center;
  justify-content: space-between;
  padding: 16px 20px;
  background: var(--bg-color-page);
  border-bottom: 1px solid var(--border-color-lighter);
}

.comparison-badge {
  font-size: 13px;
  font-weight: 600;
  padding: 4px 12px;
  border-radius: 4px;

  &.bad {
    background: var(--es-danger-tint);
    color: var(--es-danger);
  }

  &.good {
    background: var(--es-success-tint);
    color: var(--es-success);
  }
}

.comparison-lines {
  font-size: 13px;
  font-weight: 600;
  color: var(--text-color-secondary);
}

.comparison-code {
  padding: 16px 20px;
  margin: 0;
  background: #1e1e1e;
  font-family: 'SFMono-Regular', Consolas, monospace;
  font-size: 12px;
  line-height: 1.7;
  color: #abb2bf;
  overflow-x: auto;
  max-height: 400px;
  overflow-y: auto;
}

.comparison-stats {
  display: flex;
  flex-wrap: wrap;
  justify-content: center;
  gap: 64px;
  margin-top: 44px;
}

/* 数字的口径说明：两个口径都给，避免只挑好看的那个 */
.comparison-note {
  max-width: 900px;
  margin: 20px auto 0;
  font-size: 13px;
  line-height: 1.8;
  color: var(--text-color-secondary);
  text-align: center;
}

/* L2 头号案例：不重复贴代码，只给实测的「胶水代码」行数 */
.l2-glue {
  display: flex;
  flex-wrap: wrap;
  align-items: center;
  justify-content: center;
  gap: 24px;
  margin-top: 28px;
}

.l2-glue-item {
  display: flex;
  flex-direction: column;
  align-items: center;
  gap: 6px;
  min-width: 220px;
  padding: 18px 24px;
  border: 1px solid var(--border-color-lighter);
  border-radius: 12px;
  background: var(--bg-color);
}

.l2-glue-figure {
  font-size: 32px;
  font-weight: 800;
  color: var(--es-danger);

  &.good {
    color: var(--es-success);
  }
}

.l2-glue-label {
  font-size: 13px;
  color: var(--text-color-secondary);
  text-align: center;
  line-height: 1.6;
}

.l2-glue-arrow {
  font-size: 24px;
  color: var(--text-color-secondary);
}

.comp-stat {
  display: flex;
  flex-direction: column;
  align-items: center;
}

.comp-stat-value {
  font-size: 48px;
  font-weight: 800;
  background: linear-gradient(135deg, var(--primary-color), var(--brand-accent));
  -webkit-background-clip: text;
  -webkit-text-fill-color: transparent;
}

.comp-stat-label {
  font-size: 14px;
  color: var(--text-color-secondary);
  margin-top: 8px;
}

// Cross-Renderer Section
.cross-section {
  padding: 100px 48px;
  max-width: 1200px;
  margin: 0 auto;
}

.cross-grid {
  display: grid;
  grid-template-columns: repeat(3, 1fr);
  gap: 32px;
  margin-top: 48px;
}

.cross-card {
  padding: 40px 32px;
  background: var(--bg-color);
  border: 1px solid var(--border-color-lighter);
  border-radius: 16px;
  text-align: center;
  transition: all 0.3s;

  &:hover {
    transform: translateY(-4px);
    box-shadow: 0 16px 40px rgba(0, 0, 0, 0.08);
    border-color: var(--primary-color);
  }

  h3 {
    font-size: 20px;
    font-weight: 600;
    color: var(--text-color-primary);
    margin-bottom: 12px;
  }
}

.cross-card-badge {
  display: inline-block;
  padding: 4px 12px;
  background: var(--primary-color-light);
  color: var(--primary-color);
  border-radius: 12px;
  font-size: 12px;
  font-weight: 600;
  margin-bottom: 16px;
}

.cross-pkg {
  display: inline-block;
  padding: 6px 16px;
  background: #1e1e1e;
  color: var(--es-success);
  border-radius: 6px;
  font-family: 'SFMono-Regular', Consolas, monospace;
  font-size: 14px;
  margin-bottom: 16px;
}

.cross-install {
  font-size: 13px;
  color: var(--text-color-secondary);
  font-family: 'SFMono-Regular', Consolas, monospace;
  word-break: break-all;
}

// Features Section
.features-section {
  padding: 100px 48px;
  max-width: 1200px;
  margin: 0 auto;
}

.section-title {
  text-align: center;
  font-size: 36px;
  font-weight: 700;
  color: var(--text-color-primary);
  margin-bottom: 64px;
}

.features-grid {
  display: grid;
  grid-template-columns: repeat(4, 1fr);
  gap: 32px;
}

.feature-card {
  padding: 40px 32px;
  background: var(--bg-color);
  border: 1px solid var(--border-color-lighter);
  border-radius: 16px;
  text-align: center;
  transition: all 0.3s;
  
  &:hover {
    transform: translateY(-8px);
    box-shadow: 0 20px 40px rgba(0,0,0,0.08);
  }
}

.feature-icon-wrapper {
  display: flex;
  align-items: center;
  justify-content: center;
  width: 64px;
  height: 64px;
  margin: 0 auto 24px;
  border-radius: 16px;
  color: white;
  
  &.blue { background: linear-gradient(135deg, var(--brand-primary), var(--brand-accent)); }
  &.green { background: linear-gradient(135deg, var(--es-success), #95d475); }
  &.purple { background: linear-gradient(135deg, #6f42c1, #a855f7); }
  &.orange { background: linear-gradient(135deg, var(--es-warning), #f4a460); }
}

.feature-title {
  font-size: 20px;
  font-weight: 600;
  color: var(--text-color-primary);
  margin-bottom: 12px;
}

.feature-desc {
  font-size: 14px;
  color: var(--text-color-secondary);
  line-height: 1.8;
}

// Components Section
.components-section {
  padding: 100px 48px;
  background: var(--bg-color-page);
}

.components-grid {
  display: grid;
  grid-template-columns: repeat(3, 1fr);
  gap: 32px;
  max-width: 1200px;
  margin: 0 auto;
}

.component-card {
  display: flex;
  padding: 32px;
  background: var(--bg-color);
  border: 1px solid var(--border-color-lighter);
  border-radius: 16px;
  text-decoration: none;
  transition: all 0.3s;
  
  &:hover {
    transform: translateY(-4px);
    box-shadow: 0 16px 40px rgba(0,0,0,0.08);
    border-color: var(--primary-color);
  }
}

.component-icon {
  display: flex;
  align-items: center;
  justify-content: center;
  width: 72px;
  height: 72px;
  background: var(--primary-color-light);
  border-radius: 16px;
  color: var(--primary-color);
  margin-right: 24px;
  flex-shrink: 0;
}

.component-info {
  /* flex 子项默认 min-width:auto，窄屏下会被内容顶出卡片 */
  min-width: 0;

  h3 {
    font-size: 18px;
    font-weight: 600;
    color: var(--text-color-primary);
    margin-bottom: 12px;
    display: flex;
    align-items: center;
    gap: 8px;
    /* 组件名 + 标签在卡片变窄时允许换行，而不是把卡片撑宽 */
    flex-wrap: wrap;
  }
  
  p {
    font-size: 14px;
    color: var(--text-color-secondary);
    line-height: 1.6;
    margin-bottom: 16px;
  }
}

.component-tag {
  font-size: 12px;
  padding: 2px 8px;
  background: var(--primary-color-light);
  color: var(--primary-color);
  border-radius: 4px;
  font-weight: 500;
}

.component-links {
  .link {
    font-size: 14px;
    color: var(--primary-color);
    font-weight: 500;
  }
}

// AI Section
.ai-section {
  padding: 100px 48px;
  background: linear-gradient(135deg, var(--es-success-tint) 0%, var(--es-info-tint) 100%);
  text-align: center;
}

.ai-grid {
  display: grid;
  grid-template-columns: repeat(3, 1fr);
  gap: 32px;
  max-width: 1000px;
  margin: 0 auto;
}

.ai-card {
  padding: 40px 24px;
  background: var(--bg-color);
  border-radius: 16px;
  border: 1px solid var(--border-color-lighter);
  transition: all 0.3s;

  &:hover {
    transform: translateY(-4px);
    box-shadow: 0 12px 32px rgba(0, 0, 0, 0.08);
  }

  h3 {
    font-size: 18px;
    font-weight: 600;
    color: var(--text-color-primary);
    margin-bottom: 12px;
  }

  p {
    font-size: 14px;
    color: var(--text-color-secondary);
    line-height: 1.7;
  }
}

.ai-card-icon {
  display: flex;
  align-items: center;
  justify-content: center;
  width: 64px;
  height: 64px;
  margin: 0 auto 20px;
  border-radius: 16px;
  background: linear-gradient(135deg, var(--es-success), var(--es-brand-primary));
  color: white;
}

.ai-cta {
  margin-top: 48px;
}

// Get Started Section
.get-started-section {
  padding: 100px 48px;
  max-width: 800px;
  margin: 0 auto;
}

.install-steps {
  display: flex;
  flex-direction: column;
  gap: 32px;
}

.step {
  display: flex;
  align-items: flex-start;
  gap: 24px;
}

.step-number {
  width: 48px;
  height: 48px;
  display: flex;
  align-items: center;
  justify-content: center;
  background: linear-gradient(135deg, var(--primary-color), var(--brand-accent));
  color: white;
  border-radius: 50%;
  font-size: 20px;
  font-weight: 700;
  flex-shrink: 0;
}

.step-content {
  flex: 1;
  
  h4 {
    font-size: 18px;
    font-weight: 600;
    color: var(--text-color-primary);
    margin-bottom: 12px;
  }
}

.code-block {
  background: #1e1e1e;
  border-radius: 8px;
  padding: 16px 20px;
  
  code {
    color: #abb2bf;
    font-family: 'SFMono-Regular', Consolas, monospace;
    font-size: 14px;
  }
}

// Responsive
@media (max-width: 1200px) {
  .comparison-grid {
    grid-template-columns: 1fr;
  }

  .comparison-stats {
    gap: 48px;
  }

  .hero-section {
    /* minmax(0, 1fr)：单列 1fr 的 min-content 下限由按钮/标题决定，390px 下会把
       整页顶到 442px 宽（页面因此横向滚动）。列宽交给容器，内部再各自收缩。 */
    grid-template-columns: minmax(0, 1fr);
    text-align: center;
  }
  
  .hero-content {
    max-width: 100%;
  }
  
  .hero-actions {
    justify-content: center;
  }
  
  .hero-stats {
    justify-content: center;
  }
  
  .features-grid {
    grid-template-columns: repeat(2, 1fr);
  }
  
  .components-grid {
    /* minmax(0, 1fr)：卡片里 h3 是 flex 行（组件名 + 标签，默认不换行），
       min-content 约 314px，320px 视口下把整页顶出 14px 横向滚动。 */
    grid-template-columns: minmax(0, 1fr);
  }
}

@media (max-width: 768px) {
  .hero-section {
    padding: 48px 20px;
    gap: 32px;
    min-height: auto;
  }

  .hero-title {
    font-size: 40px;
    letter-spacing: -1px;
    line-height: 1.1;
  }

  .hero-description {
    font-size: 18px;
    line-height: 1.5;
    margin-bottom: 24px;
  }

  .hero-subtitle {
    font-size: 15px;
    display: block;
    margin-top: 4px;
  }

  .hero-links {
    justify-content: center;
    margin-bottom: 28px;
  }

  .hero-actions {
    flex-wrap: wrap;
    gap: 12px;
    margin-bottom: 10px;
    justify-content: center;

    .el-button {
      flex: 1 1 auto;
      min-width: 140px;
      /* Element Plus 按钮默认 nowrap：英文长标签（"5-minute Quick Start"）会顶宽整列 */
      white-space: normal;
      height: auto;
      padding: 12px 16px;
      line-height: 1.4;
    }
  }

  .hero-stats {
    flex-wrap: wrap;
    justify-content: center;
    gap: 20px 32px;
  }

  .stat-value {
    font-size: 22px;
  }

  .stat-label {
    font-size: 13px;
  }

  .hero-badge {
    font-size: 12px;
    padding: 4px 12px;
    margin-bottom: 16px;
  }

  /* 单列一律 minmax(0, 1fr)：1fr 的 min-content 下限会让长标题/长按钮顶宽整列 */
  .features-grid,
  .ai-grid,
  .cross-grid,
  .promises-grid {
    grid-template-columns: minmax(0, 1fr);
  }

  .features-section,
  .components-section,
  .get-started-section,
  .comparison-section,
  .cross-section,
  .ai-section,
  .promises-section,
  .l2-case-section {
    padding: 48px 20px;
  }

  /* 手机上卡片内边距与图标各收一档：320px 时留给正文的宽度从 112px 回到 176px */
  .component-card {
    padding: 20px;
  }

  .component-icon {
    width: 56px;
    height: 56px;
    margin-right: 16px;
  }

  .section-title {
    font-size: 24px !important;
  }
}

@media (max-width: 480px) {
  .hero-title {
    font-size: 32px;
  }

  .hero-description {
    font-size: 16px;
  }

  .hero-actions .el-button {
    width: 100%;
    flex: 1 1 100%;
  }

  .hero-stats {
    gap: 16px 24px;
  }
}
</style>
