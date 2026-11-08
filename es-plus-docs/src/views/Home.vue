<template>
  <div class="home-page" :class="{ 'is-reveal-ready': revealReady }">
    <!-- ── 1. Hero ────────────────────────────────────────────────────────
         审计 P0-1/2：此前 H1 是 72px 的「ES-Plus」，真正的价值主张被压成
         里面的 20px 灰字；首屏唯一的「证据」是一个 11px 的代码面板。
         现在 H1 用两行说清产品是什么、做什么（一份 JSON 配置 → 整页 CRUD），
         降幅 76.5% 放进副题，首屏下方是旗舰页实拍。
         品牌名交给顶栏 logo —— 用户第一眼该看到「它能替我做什么」。
         2026-11-08 第三轮：撤掉「少写 76.5% CRUD 代码」式的促销句 + 蓝色巨号数字。
         百分比当标题会读成广告横幅；H1 说清产品，数字留给副题和底部统计条。 -->
    <section class="hero-section">
      <!-- 首屏光晕：品牌蓝的极浅径向渐变 + 渐隐点阵。只做背景，不承载文字；
           纯装饰，读屏与打印都忽略。色用 rgba 而不是新增 hex（设计令牌守卫）。 -->
      <div class="hero-aura" aria-hidden="true"></div>

      <div class="hero-copy" data-reveal>
        <span class="eyebrow">{{ t('home.badge') }}</span>
        <h1 class="hero-title">
          <span class="hero-title-line">{{ t('home.heroTitleLine1') }}</span>
          <span class="hero-title-line">{{ t('home.heroTitleLine2') }}</span>
        </h1>
        <p class="hero-lead">{{ t('home.tagline2') }}</p>

        <!-- Landing 最多两个主 CTA（主色 + 次色），其余降级为文字链接 -->
        <div class="hero-actions">
          <el-button type="primary" size="large" class="cta-primary" data-track="cta-start" @click="goToGuide">
            <el-icon class="btn-icon"><Document /></el-icon>
            {{ t('home.ctaQuickStart') }}
          </el-button>
          <el-button size="large" class="cta-secondary" @click="goToAiCrud">
            <el-icon class="btn-icon"><MagicStick /></el-icon>
            {{ t('home.ctaAiCrud') }}
          </el-button>
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
        </div>
      </div>

      <!-- 首屏证据：本站真实渲染的旗舰案例（无头浏览器现拍，不是设计稿）。
           全宽放在文案下方 —— 双栏时右栏只有 546px，图里的表格读不清，
           而「产品长什么样」是这一屏要回答的唯一问题。
           不再套假浏览器窗口（圆点 + 地址条）：那是第二层装饰，
           主流产品首页的做法是「大标题 + 一张干净的大图」，框架交给圆角和阴影。 -->
      <figure class="hero-shot" data-reveal>
        <div class="hero-shot-body">
          <img
            src="/product/docs-flagship-approval-light.png"
            :alt="t('home.heroShotAlt')"
            width="1600"
            height="1000"
            loading="eager"
          />
        </div>
        <figcaption>
          <strong>{{ t('home.heroShotTitle') }}</strong>
          <span>{{ t('home.heroShotCaption') }}</span>
        </figcaption>
      </figure>

      <!-- 数字放在首屏底部横条：它们是「价值主张的注脚」，不是另一段文案 -->
      <dl class="hero-stats">
        <div class="stat-item">
          <dt class="stat-label">{{ t('home.stat1Label') }}</dt>
          <dd class="stat-value">{{ t('home.stat1Value') }}</dd>
        </div>
        <div class="stat-item">
          <dt class="stat-label">{{ t('home.stat2Label') }}</dt>
          <dd class="stat-value is-accent">{{ t('home.stat2Value') }}</dd>
        </div>
        <div class="stat-item">
          <dt class="stat-label">{{ t('home.stat3Label') }}</dt>
          <dd class="stat-value">{{ t('home.stat3Value') }}</dd>
        </div>
      </dl>
    </section>

    <!-- ── 2. 证据：三条可验证承诺 + 零事件案例 + 实测代码对比 ─────────── -->
    <section class="proof-section">
      <header class="section-head" data-reveal>
        <span class="eyebrow">{{ t('home.proofEyebrow') }}</span>
        <h2 class="section-title">{{ t('home.comparisonTitle') }}</h2>
        <p class="section-subtitle">{{ t('home.comparisonSubtitle') }}</p>
      </header>

      <div class="promises-grid" data-reveal>
        <div class="promise-card" v-for="p in promises" :key="p.key">
          <h3 class="promise-title">{{ p.title }}</h3>
          <div class="promise-claim">{{ p.claim }}</div>
          <p class="promise-desc">{{ p.desc }}</p>
        </div>
      </div>

      <!-- L2 头号案例：不重复贴代码，只给实测的「胶水代码」行数 -->
      <div class="l2-case" data-reveal>
        <h3 class="subsection-title">{{ t('home.l2Title') }}</h3>
        <p class="subsection-desc">{{ t('home.l2Desc') }}</p>
        <div class="l2-glue">
          <div class="l2-glue-item">
            <span class="l2-glue-figure">{{ oneConfig.breakdown.native.glueLines }} {{ t('home.l2Unit') }}</span>
            <span class="l2-glue-label">{{ t('home.l2NativeLabel') }}</span>
          </div>
          <span class="l2-glue-arrow" aria-hidden="true">→</span>
          <div class="l2-glue-item">
            <span class="l2-glue-figure good">{{ oneConfig.breakdown.esplus.glueLines }} {{ t('home.l2Unit') }}</span>
            <span class="l2-glue-label">{{ t('home.l2EsLabel') }}</span>
          </div>
        </div>
      </div>

      <div class="comparison-stats" data-reveal>
        <div v-for="m in comparisonStats" :key="m.label" class="comp-stat">
          <span class="comp-stat-value">{{ m.value }}</span>
          <span class="comp-stat-label">{{ m.label }}</span>
        </div>
      </div>

      <!-- 两段代码来自品牌单源（docs/brand/one-config/*.vue），行数徽章是实测值。
           默认折叠：整页两段源码在 1200px 下是 690px 高，首页承不下；
           折叠条本身把结论写全（151 行 → 90 行），展开才看逐行对照。 -->
      <div class="diff-disclosure" data-reveal>
        <button
          class="diff-toggle"
          type="button"
          :aria-expanded="diffOpen"
          aria-controls="home-diff-panes"
          @click="diffOpen = !diffOpen"
        >
          <span class="diff-toggle-icon" aria-hidden="true">{{ diffOpen ? '−' : '+' }}</span>
          <span class="diff-toggle-text">
            {{ t('home.diffToggle', {
              native: oneConfig.breakdown.native.totalLines,
              es: oneConfig.breakdown.esplus.totalLines,
            }) }}
          </span>
          <span class="diff-toggle-hint">{{ diffOpen ? t('home.diffCollapse') : t('home.diffExpand') }}</span>
        </button>
        <div v-show="diffOpen" id="home-diff-panes">
          <CodeDiff
            :left-title="t('home.traditionalBadge')"
            :right-title="t('home.esPlusBadge')"
            :left-lines="`${oneConfig.breakdown.native.totalLines}${t('home.linesSuffix')}`"
            :right-lines="`${oneConfig.breakdown.esplus.totalLines}${t('home.linesSuffix')}`"
            :left-code="oneConfig.code.native.text"
            :right-code="oneConfig.code.esplus.text"
          />
        </div>
      </div>

      <p class="comparison-note" data-reveal>
        {{ t('home.comparisonNote') }}
      </p>
    </section>

    <!-- ── 3. 三端：同一份配置，三端同时变 ──────────────────────────────── -->
    <section class="cross-section">
      <header class="section-head" data-reveal>
        <span class="eyebrow">{{ t('home.crossEyebrow') }}</span>
        <h2 class="section-title">{{ t('home.crossTitle') }}</h2>
        <p class="section-subtitle">{{ t('home.crossSubtitle') }}</p>
      </header>

      <!-- 三端对照：同一份 schema 在三个渲染包下的真实渲染（三张实拍并排）。
           此前的 TriRenderTabs 是 1182px 的文字墙，HeroTriRender 是 590px 的
           可交互面板 —— 两者都已移到 /cases：那页才是「逐字段看证据」的地方。
           首页这一屏只回答一个问题：同一份配置，三端长什么样。 -->
      <div class="renderer-row" data-reveal>
        <figure v-for="r in rendererShots" :key="r.id" class="renderer-card">
          <div class="renderer-card-head">
            <span class="renderer-dot" aria-hidden="true"></span>
            {{ r.label }}
          </div>
          <img :src="r.src" :alt="r.alt" width="1600" height="1000" loading="lazy" />
          <figcaption>{{ r.title }}</figcaption>
        </figure>
      </div>
      <p class="renderer-more" data-reveal>
        <router-link to="/cases">{{ t('home.rendererMore') }}</router-link>
      </p>
    </section>

    <!-- 产品实拍图廊移到 /cases：首页已有首屏旗舰实拍 + 三端并排三张，
         同一屏里第四处「截图证据」只会互相稀释（详见 ProductShots.vue 注释）。 -->

    <!-- ── 4. AI：一句话生成 ───────────────────────────────────────────────
         录屏（3 × WebM，542px）移到 /cases：那里本来就是「看它真的跑起来」
         的页面，首页留一个可操作的生成器就够了 —— 两段「动起来」的证据
         并排放在同一屏，读者反而不知道该点哪个。 -->
    <section class="ai-section">
      <AiLiveDemo />
    </section>

    <!-- ── 5. 上手：组件入口 + 三步安装 ─────────────────────────────────── -->
    <section class="start-section">
      <header class="section-head" data-reveal>
        <span class="eyebrow">{{ t('home.startEyebrow') }}</span>
        <h2 class="section-title">{{ t('home.componentsTitle') }}</h2>
        <p class="section-subtitle">{{ t('home.startSubtitle') }}</p>
      </header>

      <!-- 4 张卡固定 4 列（2×2 在平板）：3 列会让第 4 张落单，读起来像布局 bug -->
      <div class="components-grid" data-reveal>
        <router-link to="/components/es-form" class="component-card">
          <div class="component-icon">
            <el-icon :size="22"><DocumentChecked /></el-icon>
          </div>
          <h3>EsForm <span class="component-tag">{{ t('home.componentTagForm') }}</span></h3>
          <p>{{ t('home.esFormDesc') }}</p>
          <span class="link">{{ t('home.viewDocs') }}</span>
        </router-link>

        <router-link to="/components/es-table" class="component-card">
          <div class="component-icon">
            <el-icon :size="22"><List /></el-icon>
          </div>
          <h3>EsTable <span class="component-tag">{{ t('home.componentTagTable') }}</span></h3>
          <p>{{ t('home.esTableDesc') }}</p>
          <span class="link">{{ t('home.viewDocs') }}</span>
        </router-link>

        <router-link to="/advanced/use-dialog" class="component-card">
          <div class="component-icon">
            <el-icon :size="22"><ChatDotRound /></el-icon>
          </div>
          <h3>useDialog <span class="component-tag">{{ t('home.componentTagDialog') }}</span></h3>
          <p>{{ t('home.useDialogDesc') }}</p>
          <span class="link">{{ t('home.viewDocs') }}</span>
        </router-link>

        <router-link to="/components/es-crud-page" class="component-card">
          <div class="component-icon">
            <el-icon :size="22"><Grid /></el-icon>
          </div>
          <h3>EsCrudPage <span class="component-tag">{{ t('home.componentTagCrud') }}</span></h3>
          <p>{{ t('home.esCrudPageDesc') }}</p>
          <span class="link">{{ t('home.viewDocs') }}</span>
        </router-link>
      </div>

      <div class="get-started" data-reveal>
        <div class="get-started-head">
          <h3 class="subsection-title">{{ t('home.getStartedTitle') }}</h3>
        </div>
        <div class="install-steps">
          <div class="step" v-for="(step, i) in installSteps" :key="step.title">
            <div class="step-number">{{ i + 1 }}</div>
            <h4>{{ step.title }}</h4>
            <div class="code-block">
              <code>{{ step.code }}</code>
            </div>
          </div>
        </div>
      </div>
    </section>
  </div>
</template>

<script setup>
import { computed, onBeforeUnmount, onMounted, ref } from 'vue'
import { useRouter } from 'vue-router'
import { useI18n } from 'vue-i18n'
import { useHead } from '@unhead/vue'
import { softwareApplication, useJsonLd } from '@/utils/json-ld'
import { Document, Monitor, Grid, DocumentChecked, List, ChatDotRound, MagicStick } from '@element-plus/icons-vue'
import AiLiveDemo from '@/components/home/AiLiveDemo.vue'
// 品牌文案单一真源：由 scripts/sync-brand.mjs 从 docs/brand/slogan.json 分发，禁止手改本文件
import brand from '@/brand/slogan.json'
// 「一份配置」对比的实测数据（通用单源：docs/brand/one-config-diff.json，由 gen-one-config-diff.mjs 实测生成）
import oneConfigDiff from '@/brand/one-config-diff.json'
import CodeDiff from '@/components/doc/CodeDiff.vue'
// 首屏「改配置 → 三端变」小部件：真跑生成器，不是截图（路线图 2.3）
// 产品实拍清单：由 scripts/sync-product.mjs 从 docs/product/shots.json 分发，禁止手改
import shotsManifest from '@/product/shots.json'

const { t, locale } = useI18n()

// ── 进入视口再浮现（动效只用于状态变化，不做无限循环装饰）──
// 先给根节点打 is-reveal-ready，CSS 才隐藏 [data-reveal]：JS 没跑起来时
// 内容默认可见，不能因为动效把正文锁在 opacity:0。
const revealReady = ref(false)
let observer = null
onMounted(() => {
  const reduce = window.matchMedia('(prefers-reduced-motion: reduce)').matches
  if (reduce || !('IntersectionObserver' in window)) return
  revealReady.value = true
  observer = new IntersectionObserver(
    (entries) => {
      for (const entry of entries) {
        if (!entry.isIntersecting) continue
        entry.target.classList.add('is-visible')
        observer.unobserve(entry.target)
      }
    },
    { threshold: 0.12, rootMargin: '0px 0px -60px 0px' },
  )
  document.querySelectorAll('.home-page [data-reveal]').forEach((el) => observer.observe(el))
})
onBeforeUnmount(() => observer?.disconnect())

// ── 产品实拍：首页只取三端旗舰页（完整图廊是 /cases 的 ProductShots）──
// 清单里的 file 是可选的（默认 docs/product/<id>.png），页面不能假设它存在；
// 分发到站点后路径前缀换成 public 的 /product/
const shotUrl = (shot) => `/${(shot.file || `docs/product/${shot.id}.png`).replace(/^docs\//, '')}`

// 三端对照用的三张实拍：同一份 schema、同一个路由，在三个渲染包下的真实产物。
// 只取做进清单的那三张（缺一张就少一格，不拿设计稿补位）。
const RENDERER_SHOTS = [
  { id: 'docs-flagship-approval-light', labelKey: 'home.rendererVue3' },
  { id: 'pc-flagship-approval-light', labelKey: 'home.rendererAntdv' },
  { id: 'eui-flagship-approval-light', labelKey: 'home.rendererVue2' },
]
const rendererShots = computed(() =>
  RENDERER_SHOTS.map(({ id, labelKey }) => {
    const shot = shotsManifest.shots.find((s) => s.id === id)
    if (!shot) return null
    return {
      id,
      label: t(labelKey),
      src: shotUrl(shot),
      alt: shot.title,
      title: shot.title,
    }
  }).filter(Boolean),
)

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
const oneConfig = oneConfigDiff
// 整页两段源码默认折叠：结论写在折叠条上，展开才看逐行对照
const diffOpen = ref(false)

const comparisonStats = computed(() => {
  const m = oneConfig.metrics
  // 数字取自实测产出，标签走 i18n（JSON 里的 label 只有中文，不能直接上英文页）
  return [
    { value: `-${m.markupPlusGlue.reduction}%`, label: t('home.compStatGlue') },
    { value: `-${m.wholeFile.reduction}%`, label: t('home.compStatLines') },
    { value: '0', label: t('home.compStatEvents') },
  ]
})

const installSteps = computed(() => [
  { title: t('home.step1Title'), code: 'npm install @es-plus/vue3 element-plus @element-plus/icons-vue' },
  { title: t('home.step2Title'), code: "import { EsForm, EsTable, useDialog } from '@es-plus/vue3'" },
  { title: t('home.step3Title'), code: '<es-form :model="model" :form-item-list="items" />' },
])

useHead({
  title: '中后台 CRUD 的配置层',
  meta: [
    { name: 'description', content: 'ES-Plus — 中后台 CRUD 的配置层：一份 JSON 配置，Vue 2 / Vue 3 / Ant Design Vue 三端通用，AI 生成即编译。' },
    { property: 'og:title', content: 'ES-Plus · 中后台 CRUD 的配置层' },
    { property: 'og:description', content: '中后台 CRUD 的配置层：一份配置 · 三个渲染器 · 生成即编译。' },
  ],
})

// 结构化数据：首页要回答的是「这是什么软件」，不是「这是什么文章」
useJsonLd(() =>
  softwareApplication({
    title: '中后台 CRUD 的配置层',
    description: 'ES-Plus — 中后台 CRUD 的配置层：一份 JSON 配置，Vue 2 / Vue 3 / Ant Design Vue 三端通用，AI 生成即编译。',
    path: '/',
  }),
)

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
/* ── 首页网格（审计 §3.7）───────────────────────────────────────────────
   所有 section 共用 --es-landing-max（1200）与 --es-landing-pad（48）：
   此前 hero 1200 / 对比 1440 / 快速开始 800 三种宽度并存，左边缘在
   168px 与 288px 之间来回跳。现在只有「满宽色带」可以例外，色带内部
   仍套同一个 1200 容器。 */
.home-page {
  --landing-max: var(--es-landing-max);
  --landing-pad: var(--es-landing-pad);
  min-height: calc(100vh - var(--header-height));
  background: var(--es-bg);
  color: var(--es-text-primary);
  overflow-x: clip;
}

/* 首屏标题的显示字体栈（只给 H1 用，正文仍走 --es-font-sans）。
   Windows 上雅黑的 700 在 56px 下笔画过粗、字面发闷；等线（DengXian，Win8 起自带）
   的开口更大、笔画更轻，同字号的观感明显更接近主流产品站。拉丁仍优先
   Segoe UI Variable Display，Mac 走系统 SF + PingFang —— 全部是系统字体，
   与 design-tokens「不引入 Web Font」的决策一致；缺字体时逐级回落到雅黑。
   若另外两站也要用，再提升为 design token。 */
$font-display: -apple-system, BlinkMacSystemFont, 'Segoe UI Variable Display', 'Segoe UI',
  'PingFang SC', 'DengXian', 'Microsoft YaHei', 'Noto Sans SC', sans-serif;


.home-page > section {
  padding-left: var(--landing-pad);
  padding-right: var(--landing-pad);
}

.section-head {
  max-width: var(--landing-max);
  margin: 0 auto var(--es-space-5);
}

/* 段落眉标：一行小字，不加短横线等前置装饰。
   首页的层级靠字号和留白拉开，不靠记号。 */
.section-head .eyebrow {
  display: inline-flex;
  align-items: center;
  gap: var(--es-space-2);
}

.eyebrow {
  display: inline-block;
  margin-bottom: var(--es-space-3);
  font-size: var(--es-text-xs);
  font-weight: 600;
  letter-spacing: 0.08em;
  text-transform: uppercase;
  color: var(--es-accent-text);
}

.section-title {
  font-size: var(--es-text-4xl);
  line-height: var(--es-leading-tight);
  font-weight: 700;
  letter-spacing: -0.02em;
  color: var(--es-text-primary);
  margin: 0 0 var(--es-space-3);
  text-wrap: balance;
}

.section-subtitle {
  max-width: 680px;
  margin: 0;
  font-size: var(--es-text-md);
  line-height: var(--es-leading-relaxed);
  color: var(--es-text-secondary);
}

.subsection-title {
  font-size: var(--es-text-xl);
  line-height: var(--es-leading-snug);
  font-weight: 700;
  color: var(--es-text-primary);
  margin: 0 0 var(--es-space-2);
}

.subsection-desc {
  max-width: 820px;
  margin: 0 0 var(--es-space-5);
  font-size: var(--es-text-base);
  line-height: var(--es-leading-relaxed);
  color: var(--es-text-secondary);

  code {
    padding: 2px 6px;
    background: var(--es-fill);
    color: var(--es-link);
    border-radius: var(--es-radius-xs);
    font-family: var(--es-font-mono);
    font-size: 0.92em;
  }
}

/* ── 1. Hero ───────────────────────────────────────────────────────── */
/* 主张在上、产品图在下：双栏时右栏只有 546px，图里的表格读不清。
   单栏 + 全宽（1200）之后首屏图的宽度翻倍，行高也回到一条水平线。 */
.hero-section {
  position: relative;
  max-width: var(--landing-max);
  margin: 0 auto;
  padding-top: var(--es-space-9);
  padding-bottom: var(--es-space-9);
}

.hero-copy,
.hero-shot,
.hero-stats {
  position: relative;
  z-index: 1;
}

/* 首屏只剩一层很淡的品牌色雾面：不放点阵、不做第二重装饰。
   主流产品首页（Stripe / Linear / Vercel）的「大气」来自留白和字号，
   而不是背景花样 —— 装饰一多，视线先落在花纹上，标题反而被稀释。 */
.hero-aura {
  position: absolute;
  top: calc(-1 * var(--es-space-8));
  left: 50%;
  width: 100vw;
  height: 620px;
  transform: translateX(-50%);
  pointer-events: none;
  background: radial-gradient(52% 48% at 50% 0%, rgba(59, 130, 246, 0.1), rgba(59, 130, 246, 0) 72%);
  mask-image: linear-gradient(to bottom, rgba(0, 0, 0, 0.9), transparent 80%);
  -webkit-mask-image: linear-gradient(to bottom, rgba(0, 0, 0, 0.9), transparent 80%);
}

.hero-copy {
  min-width: 0;
  max-width: 840px;
  margin: 0 auto;
  /* 居中：首屏只有「一句话 + 两个动作」，左对齐会在 1200 容器里留出半屏空白，
     读起来像没写完；居中后 H1 就是整屏唯一的焦点（Linear / Vercel 的做法）。 */
  text-align: center;
}

/* 眉标只列三个渲染端，用正文灰。
   此前是全大写 + 0.08em 字距 + 品牌青色：品牌名本来就不是全大写写法
   （Vue 3 / Ant Design Vue），被 text-transform 强行大写后与中文混排，
   读起来像一张「技术规格贴纸」，而且字号 12px 加宽字距在中文字形上会散架。 */
.hero-copy .eyebrow {
  display: inline-block;
  margin-bottom: var(--es-space-3);
  font-size: var(--es-text-sm);
  font-weight: 500;
  letter-spacing: 0;
  text-transform: none;
  color: var(--es-text-tertiary);
}

.hero-title {
  margin: 0 0 var(--es-space-4);
  /* 56px = token 的 --es-display；此前的 72px 是阶梯外的自造字号 */
  font-size: var(--es-display);
  font-family: $font-display;
  /* 两行标题的行距要密于单行令牌值（1.25）：两行各 70px 时重心会被拉散。
     1.18 是 display 字号的常规取值，line-height 不进制 design-tokens 守卫。 */
  line-height: 1.18;
  font-weight: 700;
  letter-spacing: -0.02em;
  color: var(--es-text-primary);

  /* 断行是文案的一部分（「一份 JSON 配置，/ 生成整页 CRUD」），
     交给 text-wrap: balance 会在不同宽度下切出「生成整页 / CRUD」这种残句。 */
  .hero-title-line {
    display: block;
  }
}

.hero-lead {
  /* 780px：这句中文在 20px 下实测 730px 宽 —— 留 50px 余量让它保持一行，
     否则断点落在「接 / 管」这种词中间，末尾只剩「管。」两个字。 */
  max-width: 780px;
  margin: 0 auto var(--es-space-5);
  font-size: var(--es-text-xl);
  line-height: var(--es-leading-snug);
  /* 副题是「一句话解释」，不是第二行标题：常规字重 + 次要色，
     视线落点仍然只留在 H1 和下面的产品实拍上。 */
  font-weight: 400;
  color: var(--es-text-secondary);
}

.hero-actions {
  display: flex;
  flex-wrap: wrap;
  align-items: center;
  justify-content: center;
  gap: var(--es-space-3) var(--es-space-4);
  margin-bottom: var(--es-space-5);
}

/* 主 CTA 给一点厚度：纯色块在浅底上容易被读成「表单提交按钮」 */
.cta-primary {
  border-color: transparent;
  background: linear-gradient(180deg, var(--es-brand-primary), var(--es-brand-strong));
  box-shadow: 0 6px 16px rgba(37, 99, 235, 0.26);
  transition:
    transform var(--es-duration-base) var(--es-ease),
    box-shadow var(--es-duration-base) var(--es-ease);

  &:hover {
    transform: translateY(-1px);
    box-shadow: 0 10px 24px rgba(37, 99, 235, 0.3);
  }
}

.cta-secondary {
  background: var(--es-bg);
  border-color: var(--es-border);
}

.btn-icon {
  margin-right: 6px;
}

.hero-link {
  display: inline-flex;
  align-items: center;
  color: var(--es-text-secondary);
  font-size: var(--es-text-base);
  text-decoration: none;
  transition: color var(--es-duration-base) var(--es-ease);

  &:hover {
    color: var(--es-link);
    text-decoration: underline;
    text-underline-offset: 3px;
  }
}

/* 首屏实拍：只留圆角、1px 描边和一层柔和投影，不套浏览器外壳。
   图内顶部是案例页自己的标题与说明，桌面端裁掉它（见下方 media），
   留下的部分就是「产品本体」。 */
.hero-shot {
  margin: var(--es-space-6) 0 0;
  border: 1px solid var(--es-border-light);
  border-radius: var(--es-radius-lg);
  overflow: hidden;
  background: var(--es-bg);
  box-shadow:
    0 1px 2px rgba(15, 23, 42, 0.05),
    0 24px 56px -24px rgba(15, 23, 42, 0.22),
    0 40px 90px -40px rgba(37, 99, 235, 0.22);
}

.hero-shot img {
  display: block;
  width: 100%;
  height: auto;
}

/* 桌面端把实拍裁到「产品本体」那一段（角色切换 → 查询条 → 表格 → 分页）：
   图的上方是这张案例页自己的标题与说明，和页面 H1 说的是同一件事，
   全量铺开会让首屏读成「文档里贴了一张文档」。裁切用百分比，随容器等比。
   1200 以下不裁 —— 断点与首页去侧栏的那条一致（min-width: 1201），
   更窄时整张图已经只有 ~800px 宽，再裁成 3:1 就只剩一条读不清的缝。 */
@media (min-width: 1201px) {
  .hero-shot-body {
    aspect-ratio: 1600 / 525;
    overflow: hidden;
  }

  .hero-shot-body img {
    margin-top: -15.625%;
  }
}

.hero-shot figcaption {
  display: flex;
  flex-wrap: wrap;
  gap: var(--es-space-2);
  padding: var(--es-space-3) var(--es-space-5);
  border-top: 1px solid var(--es-border-lighter);
  font-size: var(--es-text-sm);
  line-height: var(--es-leading-normal);
  color: var(--es-text-secondary);
}

.hero-shot figcaption strong {
  color: var(--es-text-primary);
}

/* 首屏底部数字条：三格等宽 + 一条顶部分隔线。
   列与列之间不再画竖线 —— 留白本身就是分隔符。 */
.hero-stats {
  display: grid;
  grid-template-columns: repeat(3, minmax(0, 1fr));
  gap: var(--es-space-8);
  margin: var(--es-space-8) 0 0;
  padding-top: var(--es-space-5);
  border-top: 1px solid var(--es-border-lighter);
  text-align: center;
}

.stat-item {
  display: flex;
  flex-direction: column-reverse;
  gap: var(--es-space-1);
}

.stat-value {
  margin: 0;
  font-size: var(--es-text-3xl);
  line-height: 1.1;
  font-weight: 700;
  letter-spacing: -0.02em;
  color: var(--es-text-primary);
  font-variant-numeric: tabular-nums;

  &.is-accent {
    color: var(--es-brand-strong);
  }
}

.stat-label {
  font-size: var(--es-text-sm);
  color: var(--es-text-secondary);
}

/* ── 2. 证据 ───────────────────────────────────────────────────────── */
.proof-section {
  padding-top: var(--es-space-9);
  padding-bottom: var(--es-space-9);
  background: var(--es-bg-page);
}

.proof-section > * {
  max-width: var(--landing-max);
  margin-left: auto;
  margin-right: auto;
}

.promises-grid {
  display: grid;
  grid-template-columns: repeat(3, minmax(0, 1fr));
  gap: var(--es-space-6);
  margin-bottom: var(--es-landing-gap-sm);
}

/* 三张承诺不做成卡片：一条顶部分隔线 + 标题 + 一段话。
   加框会把并列的三件事切成三个小盒子，页面也立刻多出 6 条边线；
   去掉之后它们是「同一屏里的三列」，和主流产品首页的 feature 区一致。 */
.promise-card {
  padding-top: var(--es-space-4);
  border-top: 1px solid var(--es-border);
}

.promise-title {
  margin: 0 0 var(--es-space-2);
  font-size: var(--es-text-lg);
  font-weight: 700;
  color: var(--es-text-primary);
}

.promise-claim {
  display: inline-block;
  margin-bottom: var(--es-space-3);
  padding: 3px 10px;
  font-size: var(--es-text-sm);
  font-weight: 600;
  /* 强调色文字走 --es-accent-text：--es-brand-accent 在白底只有 2.43:1 */
  color: var(--es-accent-text);
  background: var(--es-info-tint);
  border-radius: var(--es-radius-full);
}

.promise-desc {
  margin: 0;
  font-size: var(--es-text-base);
  line-height: var(--es-leading-relaxed);
  color: var(--es-text-secondary);
}

.l2-case {
  margin-bottom: var(--es-landing-gap-sm);
}

.l2-glue {
  display: flex;
  flex-wrap: wrap;
  align-items: center;
  gap: var(--es-space-4);
}

.l2-glue-item {
  display: flex;
  flex-direction: column;
  gap: 4px;
  min-width: 220px;
  padding: var(--es-space-4) var(--es-space-5);
  border: 1px solid var(--es-border-lighter);
  border-radius: var(--es-radius-md);
  background: var(--es-bg);
}

.l2-glue-figure {
  font-size: var(--es-text-2xl);
  font-weight: 800;
  color: var(--es-danger-text);

  &.good {
    color: var(--es-success-text);
  }
}

.l2-glue-label {
  font-size: var(--es-text-sm);
  color: var(--es-text-secondary);
  line-height: var(--es-leading-normal);
}

.l2-glue-arrow {
  font-size: var(--es-text-xl);
  color: var(--es-text-secondary);
}

/* 折叠条：一整行可点，左侧 +/− 与右侧提示都在说「这里还有东西」 */
.diff-disclosure {
  margin: 0 0 var(--es-space-5);
  border: 1px solid var(--es-border-lighter);
  border-radius: var(--es-radius-md);
  background: var(--es-bg);
  overflow: hidden;
}

.diff-toggle {
  display: flex;
  align-items: center;
  gap: var(--es-space-3);
  width: 100%;
  padding: 14px var(--es-space-5);
  border: none;
  background: transparent;
  font: inherit;
  text-align: left;
  cursor: pointer;
  color: var(--es-text-primary);
  transition: background-color var(--es-duration-fast) var(--es-ease);

  &:hover {
    background: var(--es-bg-page);
  }

  &:focus-visible {
    outline: 2px solid var(--es-link);
    outline-offset: -2px;
  }
}

.diff-toggle-icon {
  display: inline-flex;
  align-items: center;
  justify-content: center;
  width: 22px;
  height: 22px;
  flex: 0 0 auto;
  border-radius: var(--es-radius-full);
  background: var(--es-brand-tint);
  color: var(--es-brand-strong);
  font-size: 15px;
  font-weight: 700;
  line-height: 1;
}

.diff-toggle-text {
  flex: 1 1 auto;
  font-size: var(--es-text-base);
  font-weight: 500;
}

.diff-toggle-hint {
  flex: 0 0 auto;
  font-size: var(--es-text-sm);
  color: var(--es-link);
}

#home-diff-panes {
  border-top: 1px solid var(--es-border-lighter);
  padding: var(--es-space-5);
}

.comparison-stats {
  display: flex;
  flex-wrap: wrap;
  justify-content: center;
  gap: var(--es-space-8);
  margin-top: var(--es-space-6);
}

.comp-stat {
  display: flex;
  flex-direction: column;
  align-items: center;
}

.comp-stat-value {
  font-size: var(--es-text-4xl);
  font-weight: 800;
  line-height: 1.1;
  letter-spacing: -0.02em;
  color: var(--es-brand-strong);
  font-variant-numeric: tabular-nums;
}

.comp-stat-label {
  margin-top: 6px;
  font-size: var(--es-text-sm);
  color: var(--es-text-secondary);
}

/* 数字的口径说明：两个口径都给，避免只挑好看的那个 */
.comparison-note {
  max-width: 900px;
  margin: var(--es-space-4) auto 0;
  font-size: var(--es-text-sm);
  line-height: var(--es-leading-relaxed);
  color: var(--es-text-secondary);
  text-align: center;
}

/* ── 3. 三端 ───────────────────────────────────────────────────────── */
.cross-section {
  padding-top: var(--es-space-9);
  padding-bottom: var(--es-space-9);
}

.cross-section > * {
  max-width: var(--landing-max);
  margin-left: auto;
  margin-right: auto;
}

/* ── 产品实拍图廊 ──────────────────────────────────────────────────── */

/* 三端并排：每格是「浏览器窗口」的形状 —— 一条带圆点的标题栏 + 实拍内容，
   读起来像三个人同时打开了同一个页面，而不是三张并排的截图。 */
.renderer-row {
  display: grid;
  grid-template-columns: repeat(3, minmax(0, 1fr));
  gap: var(--es-space-4);
}

.renderer-card {
  margin: 0;
  border: 1px solid var(--es-border-lighter);
  border-radius: var(--es-radius-md);
  overflow: hidden;
  background: var(--es-bg);
  transition:
    transform var(--es-duration-base) var(--es-ease),
    box-shadow var(--es-duration-base) var(--es-ease),
    border-color var(--es-duration-base) var(--es-ease);

  &:hover {
    transform: translateY(-3px);
    border-color: var(--es-brand-primary);
    box-shadow: var(--es-shadow-md);
  }
}

.renderer-card-head {
  display: flex;
  align-items: center;
  gap: 8px;
  padding: 8px 12px;
  border-bottom: 1px solid var(--es-border-lighter);
  background: var(--es-bg-page);
  font-size: var(--es-text-sm);
  font-weight: 600;
  color: var(--es-text-regular);
}

.renderer-dot {
  width: 8px;
  height: 8px;
  border-radius: var(--es-radius-full);
  background: var(--es-brand-primary);
  flex: 0 0 auto;
}

.renderer-card img {
  display: block;
  width: 100%;
  height: auto;
  aspect-ratio: 16 / 10;
  object-fit: cover;
  object-position: top center;
}

.renderer-card figcaption {
  padding: 10px 12px;
  border-top: 1px solid var(--es-border-lighter);
  font-size: var(--es-text-xs);
  line-height: var(--es-leading-normal);
  color: var(--es-text-secondary);
}

.renderer-more {
  margin: var(--es-space-4) 0 0;
  text-align: right;
  font-size: var(--es-text-sm);

  a {
    color: var(--es-link);
    text-decoration: none;

    &:hover {
      text-decoration: underline;
      text-underline-offset: 3px;
    }
  }
}

/* ── 4. AI ─────────────────────────────────────────────────────────── */
/* 两段浅色带（证据 + AI）用同一种底色，但在 AI 段加一层顶部品牌光晕：
   它把「生成」这一屏和上一屏的「对照」分开，又不需要第三种底色。 */
.ai-section {
  padding-top: var(--es-space-9);
  padding-bottom: var(--es-space-9);
  background:
    radial-gradient(900px 320px at 50% 0%, rgba(59, 130, 246, 0.09), rgba(59, 130, 246, 0) 70%),
    var(--es-bg-page);
}

.ai-section > * {
  max-width: var(--landing-max);
  margin-left: auto;
  margin-right: auto;
}

/* ── 5. 上手 ───────────────────────────────────────────────────────── */
.start-section {
  padding-top: var(--es-space-9);
  padding-bottom: var(--es-space-9);
}

.start-section > * {
  max-width: var(--landing-max);
  margin-left: auto;
  margin-right: auto;
}

/* 4 张卡固定 4 列（1024 以下 2 列，768 以下 1 列），不再出现 3+1 的孤儿 */
.components-grid {
  display: grid;
  grid-template-columns: repeat(4, minmax(0, 1fr));
  gap: var(--es-space-4);
}

.component-card {
  display: flex;
  flex-direction: column;
  gap: var(--es-space-2);
  padding: var(--es-space-5);
  background: var(--es-bg);
  border: 1px solid var(--es-border-lighter);
  border-radius: var(--es-radius-md);
  text-decoration: none;
  transition:
    border-color var(--es-duration-base) var(--es-ease),
    box-shadow var(--es-duration-base) var(--es-ease);

  &:hover {
    border-color: var(--es-brand-primary);
    box-shadow: var(--es-shadow-md);
  }

  h3 {
    display: flex;
    align-items: center;
    flex-wrap: wrap;
    gap: 8px;
    margin: 0;
    font-size: var(--es-text-md);
    font-weight: 600;
    color: var(--es-text-primary);
  }

  p {
    margin: 0;
    font-size: var(--es-text-sm);
    line-height: var(--es-leading-relaxed);
    color: var(--es-text-secondary);
  }

  .link {
    margin-top: auto;
    padding-top: var(--es-space-2);
    font-size: var(--es-text-sm);
    font-weight: 500;
    color: var(--es-link);
  }
}

.component-icon {
  display: inline-flex;
  align-items: center;
  justify-content: center;
  width: 40px;
  height: 40px;
  margin-bottom: var(--es-space-1);
  background: var(--es-brand-tint);
  border-radius: var(--es-radius-sm);
  color: var(--es-brand-primary);
}

.component-tag {
  padding: 1px 7px;
  background: var(--es-fill);
  color: var(--es-text-secondary);
  border-radius: var(--es-radius-xs);
  font-size: var(--es-text-xs);
  font-weight: 500;
}

/* 三步上手做成一块浅色面板：此前只用一条上边框和上文分隔，
   在白色段落里读起来像「另一个段落的开头」，不像一块可以照着做的清单。 */
.get-started {
  margin-top: var(--es-landing-gap-sm);
  padding: var(--es-space-6);
  border: 1px solid var(--es-border-lighter);
  border-radius: var(--es-radius-lg);
  background: var(--es-bg-page);
}

.get-started-head {
  margin-bottom: var(--es-space-4);
}

.install-steps {
  display: grid;
  grid-template-columns: repeat(3, minmax(0, 1fr));
  gap: var(--es-space-4);
}

.step {
  display: flex;
  flex-direction: column;
  gap: var(--es-space-2);
  padding: var(--es-space-4);
  border: 1px solid var(--es-border-lighter);
  border-radius: var(--es-radius-md);
  background: var(--es-bg);

  h4 {
    margin: 0;
    font-size: var(--es-text-base);
    font-weight: 600;
    color: var(--es-text-primary);
  }
}

.step-number {
  display: inline-flex;
  align-items: center;
  justify-content: center;
  width: 24px;
  height: 24px;
  border-radius: var(--es-radius-full);
  background: var(--es-brand-primary);
  box-shadow: 0 0 0 3px var(--es-brand-tint);
  color: var(--es-bg);
  font-size: var(--es-text-sm);
  font-weight: 700;
}

.code-block {
  margin-top: auto;
  padding: 10px 12px;
  background: #1e1e1e;
  border-radius: var(--es-radius-sm);
  overflow-x: auto;

  code {
    color: #abb2bf;
    font-family: var(--es-font-mono);
    font-size: var(--es-text-xs);
    line-height: 1.7;
    white-space: pre-wrap;
    word-break: break-all;
  }
}

/* ── 动效：进入视口浮现（只做一次，不做无限循环装饰）────────────────
   默认可见；只有 JS 打出 .is-reveal-ready 之后才隐藏待浮现的元素。 */
.is-reveal-ready [data-reveal] {
  opacity: 0;
  transform: translateY(14px);
  transition:
    opacity var(--es-duration-slow) var(--es-ease),
    transform var(--es-duration-slow) var(--es-ease);
  will-change: opacity, transform;
}

.is-reveal-ready [data-reveal].is-visible {
  opacity: 1;
  transform: none;
}

/* 首屏三段错开 90ms 出现：同一刻整块浮上来像页面刷新，错开才读得出层次。
   只加 delay，不加新的 duration（动效守卫只认令牌时长）。 */
.is-reveal-ready [data-reveal].hero-copy {
  transition-delay: 0ms;
}

.is-reveal-ready [data-reveal].hero-shot {
  transition-delay: 90ms;
}

.is-reveal-ready [data-reveal].hero-stats {
  transition-delay: 170ms;
}

@media (prefers-reduced-motion: reduce) {
  .is-reveal-ready [data-reveal] {
    opacity: 1;
    transform: none;
    transition: none;
  }

}

/* 打印/导出 PDF 时没有 IntersectionObserver 的滚动，浮现层会停在 opacity:0 */
@media print {
  .is-reveal-ready [data-reveal] {
    opacity: 1;
    transform: none;
    transition: none;
  }
}

/* ── 响应式 ───────────────────────────────────────────────────────── */
@media (max-width: 1024px) {
  .components-grid {
    grid-template-columns: repeat(2, minmax(0, 1fr));
  }

  .install-steps {
    grid-template-columns: minmax(0, 1fr);
  }
}

@media (max-width: 768px) {
  .home-page > section {
    padding-left: var(--es-space-5);
    padding-right: var(--es-space-5);
  }

  .hero-section {
    padding-top: var(--es-space-6);
  }

  /* 光晕在窄屏上收窄并压低，否则它会盖到第二屏的浅色带上 */
  .hero-aura {
    height: 480px;
  }

  .hero-copy .eyebrow {
    margin-bottom: var(--es-space-3);
  }

  .hero-title {
    font-size: var(--es-display-sm);
  }

  .hero-lead {
    font-size: var(--es-text-lg);
  }

  .section-title {
    font-size: var(--es-text-2xl);
  }


  .promises-grid,
  .components-grid,
  .renderer-row {
    grid-template-columns: minmax(0, 1fr);
  }

  .renderer-more {
    text-align: left;
  }

  .hero-stats {
    grid-template-columns: minmax(0, 1fr);
    gap: var(--es-space-3);
    margin-top: var(--es-space-5);
  }

  /* 单列时列间细线会变成三根孤立的短竖线 */
  .stat-item + .stat-item::before {
    display: none;
  }

  .get-started {
    padding: var(--es-space-5);
  }

  .hero-actions {
    .el-button {
      flex: 1 1 auto;
      min-width: 140px;
      white-space: normal;
      height: auto;
      padding: 12px 16px;
      line-height: 1.4;
    }
  }
}

@media (max-width: 480px) {
  .hero-title {
    font-size: var(--es-text-32);
  }

  .hero-actions .el-button {
    width: 100%;
    flex: 1 1 100%;
  }

  .comparison-stats {
    gap: var(--es-space-5);
  }

  .comp-stat-value {
    font-size: var(--es-text-3xl);
  }
}
</style>
