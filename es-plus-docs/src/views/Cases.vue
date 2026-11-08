<template>
  <div class="cases-page">
    <div class="cases-hero">
      <h1>核心案例</h1>
      <p>
        按 <strong>L1–L5 学习梯度</strong>组织：从 30 秒上手，到零事件联动、复杂痛点、vxe/virtual 极限场景，
        再到 render 逃生舱。每个案例回答「<strong>原生怎么写 vs es-plus 怎么写</strong>」。
      </p>
    </div>

    <!-- 旗舰案例：单个组件案例讲「一个能力」，这一页讲它们串成完整业务闭环。
         放在梯度之前 —— 它是三站对照「一份 JSON 三端跑」最直观的入口。 -->
    <div class="cta-stack">
      <router-link to="/flagship-approval" class="flagship-cta">
        <span class="flagship-cta-badge">旗舰案例</span>
        <span class="flagship-cta-body">
          <span class="flagship-cta-title">合同审批工作台：一份纯 JSON 驱动的完整审批闭环</span>
          <span class="flagship-cta-desc">
            查询联动 · 跨页勾选 · 批量审批 · 行级/列级权限 · 审批详情与驳回 —— 三端加载同一份
            schema（0 个函数），请求与权限由宿主注入
          </span>
        </span>
        <img
          class="flagship-cta-shot"
          src="/product/docs-flagship-approval-light.png"
          alt="合同审批工作台实拍：查询区、跨页勾选的表格与行内审批按钮"
          width="1600"
          height="1000"
          loading="lazy"
        />
        <span class="flagship-cta-arrow">→</span>
      </router-link>

      <!-- 一句话生成的产物页：旗舰页证明「手写 JSON 三端跑」，这一页证明「AI 写的 JSON
           也直接能跑」—— 同一套渲染器、同样的 0 个函数。 -->
      <router-link to="/ai-generated" class="flagship-cta ai-cta">
        <span class="flagship-cta-badge ai-cta-badge">AI 生成</span>
        <span class="flagship-cta-body">
          <span class="flagship-cta-title">一句话 → 采购申请审批页：生成产物未经手工修改</span>
          <span class="flagship-cta-desc">
            条件必填（reactions）· 行按钮权限（permissionValue）· 操作列 · 码值标签（dataOptions）
            —— 模型只写 schema，宿主只注入请求与权限
          </span>
        </span>
        <img
          class="flagship-cta-shot"
          src="/product/docs-ai-generated-light.png"
          alt="AI 生成页实拍：没有手写代码的采购申请审批表格与查询区"
          width="1440"
          height="900"
          loading="lazy"
        />
        <span class="flagship-cta-arrow">→</span>
      </router-link>

      <!-- 画廊：上面两页各讲一个案例，这一页把 manifest 里的全部 AI 案例按能力簇列出来，
           产物（schema / 冻结配置）可直接下载。 -->
      <router-link to="/ai-gallery" class="flagship-cta ai-cta">
        <span class="flagship-cta-badge ai-cta-badge">AI 画廊</span>
        <span class="flagship-cta-body">
          <span class="flagship-cta-title">全部 AI 案例：按能力簇分组，产物可下载、可重放</span>
          <span class="flagship-cta-desc">
            每个案例标注 claim 与「是否可机械重放」（产物 = 编译(冻结配置)）—— 清单来自
            <code>docs/cases/ai-cases.json</code> 单一真源，新增案例不必改页面
          </span>
        </span>
        <span class="flagship-cta-arrow">→</span>
      </router-link>

      <!-- 片段拼装：上面几页都是「一份 schema 驱动整页」，这一页反过来 ——
           没有 schema，宿主自己搭布局，片段工具负责表单/表格/弹窗。 -->
      <router-link to="/fragment-dashboard" class="flagship-cta fragment-cta">
        <span class="flagship-cta-badge fragment-cta-badge">片段拼装</span>
        <span class="flagship-cta-body">
          <span class="flagship-cta-title">片段拼装仪表盘：非 CRUD 页面里嵌三个生成片段</span>
          <span class="flagship-cta-desc">
            筛选表单 · 结果表格 · 详情弹窗来自 <code>generate_form</code> / <code>generate_table</code> /
            <code>generate_dialog</code> 的原样产物；取数、布局与原生 SVG 图表由宿主自己写
          </span>
        </span>
        <span class="flagship-cta-arrow">→</span>
      </router-link>

      <!-- 三栏对照：上面几页演示「能做什么」，这一页回答「省了什么」——
           四个口径由度量脚本从三个真实文件实算，不写死百分比。 -->
      <router-link to="/native-vs-ai" class="flagship-cta nva-cta">
        <span class="flagship-cta-badge nva-cta-badge">三栏对照</span>
        <span class="flagship-cta-body">
          <span class="flagship-cta-title">同一件事三种写法：原生 / 手写 es-plus / AI 产物</span>
          <span class="flagship-cta-desc">
            非空行 · 事件绑定 · 自写函数 · v-if 分支，四个口径同一把尺子实测；三栏源码原样展示，
            AI 栏现场跑在 <code>/ai-gallery/employee-roster</code>
          </span>
        </span>
        <span class="flagship-cta-arrow">→</span>
      </router-link>
    </div>

    <!-- 成本对照：下面每个案例的 pain/win 是文字，这一块给的是**实测**数字 ——
         由 scripts/gen-cases-metrics.mjs 从 docs/examples/{native,es}/*.vue 算出来，
         Cases 页只负责展示，不写死任何百分比（改示例即改数字）。 -->
    <section class="compare">
      <div class="compare-header">
        <h2>原生 vs es-plus：实测成本</h2>
        <span class="compare-note">
          同一场景、两侧各一份完整实现（无省略号），数字来自
          <code>scripts/gen-cases-metrics.mjs</code>：
          非空行（含数据与 schema，不藏配置成本）/ 模板事件绑定 / 自写函数 / v-if 分支
        </span>
      </div>
      <div class="compare-table-wrap">
        <table class="compare-table">
          <thead>
            <tr>
              <th>场景</th>
              <th>非空行</th>
              <th>事件绑定</th>
              <th>自写函数</th>
              <th>v-if 分支</th>
            </tr>
          </thead>
          <tbody>
            <tr v-for="s in metrics.scenarios" :key="s.id">
              <td class="compare-scene">{{ s.title }}</td>
              <td v-for="m in COMPARE_KEYS" :key="m" :class="`compare-cell-${m}`">
                <span class="compare-native">{{ s.native[m] }}</span>
                <span class="compare-arrow">→</span>
                <strong>{{ s.es[m] }}</strong>
                <em class="compare-delta" :class="{ 'compare-plus': s.reduction[m] < 0 }">
                  {{ delta(s.reduction[m]) }}
                </em>
              </td>
            </tr>
          </tbody>
        </table>
      </div>
      <p class="compare-caveat">
        <strong>读法：</strong>降幅 = (原生 − es-plus) / 原生；<span class="compare-plus">+x%</span>
        表示该口径上 es-plus 反而更多 —— 像「码值列」这种小场景，声明本身的行数并不比三条
        <code>v-if</code> 少，省掉的是分支与手写映射，以及换端 / 换引擎时这份声明不用重写。
        另：这里的口径比首页的「模板 + 事件胶水减少 76.5%」更严 —— 那一项只数模板与事件胶水，
        这里把数据与 schema 的行也一起数，所以数字看起来更保守。
      </p>
    </section>

    <!-- 可交互证据（原首页首屏组件）：改三个字段，三端产物同时变。真跑生成器，
         不是截图。放在图廊之前 —— 先动手改一次，再看三端真实页面。 -->
    <section class="interactive-block">
      <HeroTriRender />
    </section>

    <!-- 产品实拍图廊（原在首页）：无头浏览器对着真实页面拍摄，浅/深各一套。
         首页只留首屏一张 + 三端并排三张，完整图廊在这里展开。 -->
    <ProductShots />

    <!-- 逐字段配对的完整证据（原在首页）：Schema 源码 + 三端同名示例的
         中位差 + 差异最小的一对逐行 diff。首页只留三张实拍并排，这里给
         「凭什么说三端只有个位数行差异」的原始材料。 -->
    <section class="parity-block">
      <TriRenderTabs />
    </section>

    <!-- 三段真实录屏（原在首页）：这里本来就是「看它真的跑起来」的页面，
         和上面几个可点进去的案例放在一起才有上下文。全部由无头浏览器对着
         运行中的页面录下（只裁掉加载等待），封面是每段最后一帧。 -->
    <section class="recordings">
      <div class="recordings-header">
        <span class="recordings-eyebrow">30 秒</span>
        <h2>看它怎么工作</h2>
        <p>
          三段都由无头浏览器对着真实页面录下来（只裁掉加载等待），无配音、无补帧。
          封面是每段结束时的画面 —— 先看到结果，再点播放看过程。
        </p>
      </div>
      <div class="recordings-grid">
        <figure v-for="video in demoVideos" :key="video.id" class="recording-card">
          <video
            :src="videoUrl(video.file)"
            :poster="videoUrl(video.poster)"
            :width="video.width"
            :height="video.height"
            preload="none"
            muted
            loop
            playsinline
            controls
            :aria-label="`${video.title}：${video.caption}`"
          ></video>
          <figcaption>
            <strong>{{ video.title }}</strong>
            <span class="recording-caption">{{ video.caption }}</span>
            <span class="recording-meta">
              {{ Math.round(video.durationMs / 1000) }} 秒 · {{ video.width }}×{{ video.height }} · WebM
            </span>
          </figcaption>
        </figure>
      </div>
    </section>

    <section v-for="level in levels" :key="level.id" class="level">
      <div class="level-header">
        <span class="level-badge" :class="level.id.toLowerCase()">{{ level.title }}</span>
        <span class="level-goal">{{ level.goal }}</span>
      </div>
      <div class="case-grid">
        <div v-for="c in level.cases" :key="c.id" class="case-card">
          <div class="case-title">
            <span class="case-no">{{ circled(c.id) }}</span>
            {{ c.title }}
          </div>
          <p class="case-pain"><strong>痛点：</strong>{{ c.pain }}</p>
          <p class="case-win"><strong>优势：</strong>{{ c.win }}</p>
          <!-- 三端互链：同一案例在另两端都有对应页面 —— 这正是 es-plus 的头号卖点
               （同一份配置 → 三端），而案例库是最该展示它的地方。
               本端用站内路由，另两端用绝对地址（地址来自 utils/sites 的三站清单，
               与顶栏切换器同一份，受 check:site-nav 守护）。 -->
          <div class="case-links">
            <router-link :to="c.links[SITE_KEY]" class="case-link">本端 · Vue 3 · EP →</router-link>
            <a
              v-for="s in otherSites"
              :key="s.key"
              :href="crossSiteUrl(s.key, c.links[s.key])"
              class="case-link case-link-cross"
              rel="noopener"
            >{{ s.short }} ↗</a>
          </div>
        </div>
      </div>
    </section>
  </div>
</template>

<script setup lang="ts">
// 案例目录单一真源：由 scripts/sync-cases.mjs 从 docs/cases/cases.json 分发，禁止手改本文件
import cases from '@/cases/cases.json'
// 实测数字：由 scripts/gen-cases-metrics.mjs 生成，sync-cases 分发，禁止手改
import metrics from '@/cases/cases-metrics.json'
// 跨端互链：与顶栏切换器共用同一份三站清单（受 check:site-nav 守护）
import { SITES, SITE_KEY, crossSiteUrl } from '@/utils/sites'
// 产品实拍图廊（原首页组件）：浅/深两套真实页面截图，清单来自 docs/product/shots.json
import ProductShots from '@/components/product/ProductShots.vue'
// 可交互「改三个字段 → 三端同时变」（原首页组件）：真跑生成器，不是截图
import HeroTriRender from '@/components/home/HeroTriRender.vue'
// 三端逐字段配对的完整证据（原首页组件，现在只在这一页展开）
import TriRenderTabs from '@/components/home/TriRenderTabs.vue'
// 录屏清单（单源 docs/product/videos.json，由 scripts/sync-product.mjs 分发）
import videosManifest from '@/product/videos.json'

const levels = cases.levels
/** 另两端（本端用站内路由，不走绝对地址） */
const otherSites = SITES.filter((s) => s.key !== SITE_KEY)

// 录屏与产品截图同一套分发规则：单源 docs/product/videos.json，站点里读副本
const demoVideos = videosManifest.videos
/** docs/product/x → 站点 public 下的 /product/x */
const videoUrl = (p: string) => `/${p.replace(/^docs\//, '')}`

const circled = (n: number) => '①②③④⑤⑥⑦⑧⑨⑩⑪⑫⑬⑭⑮'[n - 1]

/** 对比表的四个口径，顺序即列顺序（与 cases-metrics.json 的键一致） */
const COMPARE_KEYS = ['lines', 'events', 'functions', 'vIf'] as const
/** 0 表示两侧持平；负数表示 es-plus 侧更多（如实显示成 +x%） */
const delta = (v: number) => (v === 0 ? '—' : v > 0 ? `−${v}%` : `+${Math.abs(v)}%`)
// 逐页 title / description：单一来源在 utils/page-meta.ts（check:page-meta 静态核对）。
// 放在脚本末尾不影响求值 —— ESM 的 import 声明会被提升，这样文件级注释与 import 分组都不被打断。
import { usePageMeta } from '@/utils/page-meta'

usePageMeta('cases')
</script>

<style lang="scss" scoped>
.cases-page {
  max-width: 1200px;
  margin: 0 auto;
  padding: 8px clamp(16px, 4vw, 48px) 56px;
}

.cases-hero {
  text-align: center;
  padding: 32px 0 24px;
  margin-bottom: 8px;
  border-bottom: 1px solid var(--border-color-lighter);

  h1 {
    font-size: var(--es-text-32);
    font-weight: 700;
    color: var(--text-color-primary);
    margin-bottom: 12px;
  }

  p {
    color: var(--text-color-regular);
    line-height: 1.8;
    max-width: 720px;
    margin: 0 auto;
  }
}

/* 成本对照：实测数字表 */
.compare {
  margin: 0 0 36px;
  padding: 18px 20px 16px;
  border: 1px solid var(--border-color-lighter);
  border-radius: 10px;
  background: var(--bg-color-page, var(--es-bg-subtle));
}

.compare-header {
  display: flex;
  align-items: baseline;
  flex-wrap: wrap;
  gap: 8px 14px;
  margin-bottom: 14px;

  h2 {
    font-size: 17px;
    margin: 0;
    color: var(--text-color-primary);
  }
}

.compare-note {
  font-size: 12px;
  color: var(--text-color-secondary);
  line-height: 1.7;

  code {
    font-size: 11px;
  }
}

.compare-table-wrap {
  overflow-x: auto;
}

.compare-table {
  width: 100%;
  border-collapse: collapse;
  font-size: 13px;

  th,
  td {
    padding: 9px 10px;
    border-bottom: 1px solid var(--border-color-lighter);
    text-align: center;
    white-space: nowrap;
  }

  th {
    font-weight: 600;
    color: var(--text-color-regular);
    font-size: 12px;
  }

  .compare-scene {
    text-align: left;
    color: var(--text-color-primary);
  }

  .compare-native {
    color: var(--text-color-secondary);
  }

  .compare-arrow {
    margin: 0 6px;
    color: var(--es-text-disabled);
  }
}

.compare-delta {
  margin-left: 8px;
  font-style: normal;
  font-size: 12px;
  color: var(--primary-color, var(--es-brand-primary));

  &.compare-plus {
    color: var(--warning-color, var(--es-warning));
  }
}

.compare-caveat {
  margin: 12px 0 0;
  font-size: 12px;
  line-height: 1.9;
  color: var(--text-color-secondary);

  code {
    font-size: 11px;
  }

  .compare-plus {
    color: var(--warning-color, var(--es-warning));
  }
}

/* 可交互证据：组件自带卡片，这里只负责与页面节奏对齐 */
.interactive-block {
  margin: 0 0 40px;
}

/* 逐字段配对证据：组件自带卡片与间距，这里只负责和页面的节奏对齐 */
.parity-block {
  margin: 0 0 40px;
}

/* 录屏：三栏，封面即结果；窄屏单列（视频宽度小于 320px 时表头就读不清了） */
.recordings {
  margin: 0 0 40px;
}

.recordings-header {
  margin-bottom: 16px;

  h2 {
    margin: 0 0 8px;
    font-size: 20px;
    color: var(--text-color-primary);
  }

  p {
    max-width: 760px;
    margin: 0;
    font-size: 13px;
    line-height: 1.8;
    color: var(--text-color-secondary);
  }
}

.recordings-eyebrow {
  display: inline-block;
  margin-bottom: 6px;
  font-size: 12px;
  font-weight: 600;
  letter-spacing: 0.08em;
  text-transform: uppercase;
  color: var(--es-accent-text);
}

.recordings-grid {
  display: grid;
  grid-template-columns: repeat(3, minmax(0, 1fr));
  gap: 16px;
}

.recording-card {
  display: flex;
  flex-direction: column;
  margin: 0;
  border: 1px solid var(--border-color-lighter);
  border-radius: 10px;
  overflow: hidden;
  background: var(--bg-color);

  video {
    display: block;
    width: 100%;
    height: auto;
    background: var(--bg-color-page, var(--es-bg-subtle));
  }

  figcaption {
    display: flex;
    flex-direction: column;
    gap: 4px;
    padding: 12px 14px 14px;
    border-top: 1px solid var(--border-color-lighter);
    font-size: 13px;
    line-height: 1.6;
    color: var(--text-color-secondary);
  }

  strong {
    font-size: 14px;
    color: var(--text-color-primary);
  }
}

.recording-meta {
  font-size: 12px;
  color: var(--text-color-placeholder, var(--text-color-secondary));
  font-variant-numeric: tabular-nums;
}

@media (max-width: 900px) {
  .recordings-grid {
    grid-template-columns: minmax(0, 1fr);
  }
}

.level {
  margin-bottom: 40px;
}

.cta-stack {
  display: flex;
  flex-direction: column;
  gap: 12px;
  margin: 8px 0 32px;
}

.flagship-cta {
  display: flex;
  align-items: center;
  gap: 16px;
  padding: 18px 22px;
  border: 1px solid var(--primary-color-light);
  border-radius: 12px;
  background: linear-gradient(135deg, var(--primary-color-light), transparent 60%);
  text-decoration: none;
  transition: color var(--es-duration-slow) var(--es-ease), background-color var(--es-duration-slow) var(--es-ease), border-color var(--es-duration-slow) var(--es-ease), box-shadow var(--es-duration-slow) var(--es-ease), transform var(--es-duration-slow) var(--es-ease), opacity var(--es-duration-slow) var(--es-ease);

  &:hover {
    transform: translateY(-2px);
    box-shadow: 0 12px 28px rgba(0, 0, 0, 0.08);
  }
}

/* 案例卡缩略图：真实截图（docs/product/），裁掉下半屏只留能看到界面结构的上半部分。
   照片式裁切比「示意图」诚实 —— 它没法为了好看而虚构一个不存在的界面。 */
.flagship-cta-shot {
  flex: none;
  width: 168px;
  /* height 必须显式 auto：<img width height> 会变成 CSS 的等价声明，
     不写 auto 时高度就锁在上面的 900px（缩略图被拉成一竖条） */
  height: auto;
  aspect-ratio: 16 / 10;
  object-fit: cover;
  object-position: top left;
  border: 1px solid var(--border-color-lighter);
  border-radius: 8px;
  background: var(--bg-color);
}

@media (max-width: 768px) {
  .flagship-cta-shot {
    display: none;
  }
}

.flagship-cta-badge {
  flex-shrink: 0;
  padding: 3px 10px;
  border-radius: 10px;
  font-size: 12px;
  color: #fff;
  background: linear-gradient(135deg, var(--primary-color), var(--brand-accent));
}

/* 五个入口用同一个强调色，靠**徽章上的字**区分来源（旗舰案例 / AI 生成 / AI 画廊 /
   片段拼装 / 三栏对照）。此前每种来源各配一种渐变 —— 紫、青、琥珀 —— 一屏之内
   出现四种强调色，读者只会觉得「这里想让每张卡都不一样」。
   设计口径见 docs/internal 审计 §6.6：一个页面最多一个强调色，AI 相关内容不再
   新增紫 / 琥珀 / 彩虹。 */
.ai-cta-badge,
.fragment-cta-badge,
.nva-cta-badge {
  background: linear-gradient(135deg, var(--primary-color), var(--brand-accent));
}

.flagship-cta-body {
  display: flex;
  flex-direction: column;
  gap: 6px;
}

.flagship-cta-title {
  font-size: 16px;
  font-weight: 600;
  color: var(--text-color-primary);
}

.flagship-cta-desc {
  font-size: 13px;
  line-height: 1.7;
  color: var(--text-color-secondary);
}

.flagship-cta-arrow {
  margin-left: auto;
  font-size: 20px;
  color: var(--primary-color);
}

.level-header {
  display: flex;
  align-items: center;
  gap: 12px;
  margin-bottom: 16px;
}

/* 梯度徽章（L1–L5）不是状态，是同一种东西的五个刻度：用一个品牌浅底 + 品牌字，
   级别靠「L1…L5 + 目标文案」读，不靠五种渐变。五项彩虹会让人以为难度是**颜色**编码的。 */
.level-badge {
  display: inline-block;
  padding: 4px 14px;
  border-radius: 20px;
  font-size: 14px;
  font-weight: 700;
  color: var(--es-brand-strong);
  background: var(--es-brand-tint);
  border: 1px solid var(--es-brand-primary-light);
}

.level-goal {
  font-size: 13px;
  color: var(--text-color-secondary);
}

.case-grid {
  display: grid;
  grid-template-columns: repeat(2, 1fr);
  gap: 16px;
}

.case-card {
  padding: 20px;
  background: var(--bg-color);
  border: 1px solid var(--border-color-lighter);
  border-radius: 12px;
  transition: color var(--es-duration-slow) var(--es-ease), background-color var(--es-duration-slow) var(--es-ease), border-color var(--es-duration-slow) var(--es-ease), box-shadow var(--es-duration-slow) var(--es-ease), transform var(--es-duration-slow) var(--es-ease), opacity var(--es-duration-slow) var(--es-ease);

  &:hover {
    transform: translateY(-3px);
    box-shadow: 0 12px 28px rgba(0, 0, 0, 0.08);
    border-color: var(--primary-color);
  }
}

.case-title {
  display: flex;
  align-items: center;
  gap: 8px;
  font-size: 17px;
  font-weight: 600;
  color: var(--text-color-primary);
  margin-bottom: 10px;
}

.case-no {
  color: var(--primary-color);
  font-weight: 700;
}

.case-pain,
.case-win {
  display: flex;
  gap: 6px;
  align-items: baseline;
  font-size: 13px;
  line-height: 1.6;
  color: var(--text-color-regular);
  margin: 6px 0;
  padding: 8px 10px;
  border-radius: 8px;
}

.case-pain { background: rgba(245, 108, 108, 0.06); }
.case-win { background: rgba(103, 194, 58, 0.08); }

.case-pain strong { color: var(--es-danger); flex-shrink: 0; }
.case-win strong { color: var(--es-success); flex-shrink: 0; }

.case-links {
  display: flex;
  flex-wrap: wrap;
  align-items: center;
  gap: 10px;
  margin-top: 10px;
  padding-top: 10px;
  border-top: 1px dashed var(--border-color-lighter);
}

.case-link {
  display: inline-block;
  font-size: 13px;
  color: var(--primary-color);
  font-weight: 500;
  text-decoration: none;

  &:hover { text-decoration: underline; }
}

/* 另两端的入口：视觉上从属于本端链接（弱一档），但保持可点、可辨 */
.case-link-cross {
  color: var(--text-color-secondary);
  font-weight: 400;
}

@media (max-width: 768px) {
  .case-grid {
    grid-template-columns: 1fr;
  }
}
</style>
