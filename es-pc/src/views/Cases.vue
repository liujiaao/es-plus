<template>
  <div class="cases-page">
    <div class="cases-hero">
      <h1>核心案例</h1>
      <p>
        按 <strong>L1–L5 学习梯度</strong>组织：从 30 秒上手，到零事件联动、复杂痛点、vxe 极限场景，
        再到 render 逃生舱。每个案例回答「<strong>原生怎么写 vs es-plus 怎么写</strong>」。
      </p>
    </div>

    <!-- 旗舰案例：把单个组件案例串成完整业务闭环；三站加载同一份纯 JSON schema -->
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

    <section v-for="level in levels" :key="level.id" class="level">
      <div class="level-header">
        <span class="level-badge" :class="level.id.toLowerCase()">{{ level.title }}</span>
        <span class="level-goal">{{ level.goal }}</span>
      </div>
      <a-row :gutter="[16, 16]">
        <a-col :span="12" v-for="c in level.cases" :key="c.id">
          <a-card class="case-card" hoverable @click="$router.push(c.links[SITE_KEY])">
            <div class="case-title">
              <span class="case-no">{{ circled(c.id) }}</span>
              {{ c.title }}
            </div>
            <p class="case-pain"><strong>痛点：</strong>{{ c.pain }}</p>
            <p class="case-win"><strong>优势：</strong>{{ c.win }}</p>
            <!-- 三端互链：同一案例在另两端都有对应页面 —— 这正是 es-plus 的头号卖点。
                 整卡可点（跳本端路由），所以这里 @click.stop 免得点跨端链接时同时触发整卡跳转。
                 地址来自 utils/sites 的三站清单，与顶栏切换器同一份，受 check:site-nav 守护。 -->
            <div class="case-links" @click.stop>
              <router-link :to="c.links[SITE_KEY]" class="case-link">本端 · {{ siteShort }} →</router-link>
              <a
                v-for="s in otherSites"
                :key="s.key"
                :href="crossSiteUrl(s.key, c.links[s.key])"
                class="case-link case-link-cross"
                rel="noopener"
              >{{ s.short }} ↗</a>
            </div>
          </a-card>
        </a-col>
      </a-row>
    </section>
  </div>
</template>

<script setup>
// 案例目录单一真源：由 scripts/sync-cases.mjs 从 docs/cases/cases.json 分发，禁止手改本文件
import cases from '@/cases/cases.json'
// 实测数字：由 scripts/gen-cases-metrics.mjs 生成，sync-cases 分发，禁止手改
import metrics from '@/cases/cases-metrics.json'
// 跨端互链：与顶栏切换器共用同一份三站清单（受 check:site-nav 守护）
import { SITES, SITE_KEY, siteOf, crossSiteUrl } from '@/utils/sites'

const levels = cases.levels
/** 另两端（本端走站内路由，不用绝对地址） */
const otherSites = SITES.filter((s) => s.key !== SITE_KEY)
const siteShort = siteOf(SITE_KEY)?.short ?? SITE_KEY

const circled = (n) => '①②③④⑤⑥⑦⑧⑨⑩⑪⑫⑬⑭⑮'[n - 1]

/** 对比表的四个口径，顺序即列顺序（与 cases-metrics.json 的键一致） */
const COMPARE_KEYS = ['lines', 'events', 'functions', 'vIf']
/** 0 表示两侧持平；负数表示 es-plus 侧更多（如实显示成 +x%） */
const delta = (v) => (v === 0 ? '—' : v > 0 ? `−${v}%` : `+${Math.abs(v)}%`)
</script>

<style scoped>
.cases-page {
  max-width: 1200px;
}

.cases-hero {
  text-align: center;
  padding: 24px 0 32px;
}

.cases-hero h1 {
  font-size: 32px;
  font-weight: 700;
  color: #1a1a2e;
  margin-bottom: 12px;
}

.cases-hero p {
  color: #666;
  line-height: 1.8;
  max-width: 720px;
  margin: 0 auto;
}

/* 成本对照：实测数字表 */
.compare {
  margin: 0 0 36px;
  padding: 18px 20px 16px;
  border: 1px solid #f0f0f0;
  border-radius: 10px;
  background: #fafafa;
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
    color: #1a1a2e;
  }
}

.compare-note {
  font-size: 12px;
  color: #999;
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
    border-bottom: 1px solid #f0f0f0;
    text-align: center;
    white-space: nowrap;
  }

  th {
    font-weight: 600;
    color: #666;
    font-size: 12px;
  }

  .compare-scene {
    text-align: left;
    color: #1a1a2e;
  }

  .compare-native {
    color: #999;
  }

  .compare-arrow {
    margin: 0 6px;
    color: #d9d9d9;
  }
}

.compare-delta {
  margin-left: 8px;
  font-style: normal;
  font-size: 12px;
  color: var(--es-brand-primary);

  &.compare-plus {
    color: #fa8c16;
  }
}

.compare-caveat {
  margin: 12px 0 0;
  font-size: 12px;
  line-height: 1.9;
  color: #999;

  code {
    font-size: 11px;
  }

  .compare-plus {
    color: #fa8c16;
  }
}

.level {
  margin-bottom: 40px;
}

.cta-stack {
  display: flex;
  flex-direction: column;
  gap: 12px;
  margin: 0 0 32px;
}

.flagship-cta {
  display: flex;
  align-items: center;
  gap: 16px;
  padding: 18px 22px;
  border: 1px solid #d6e4ff;
  border-radius: 12px;
  background: linear-gradient(135deg, #f0f7ff, #ffffff 60%);
  text-decoration: none;
  transition: all 0.3s;
}

.flagship-cta:hover {
  transform: translateY(-2px);
  box-shadow: 0 12px 28px rgba(0, 0, 0, 0.08);
}

.flagship-cta-badge {
  flex-shrink: 0;
  padding: 3px 10px;
  border-radius: 10px;
  font-size: 12px;
  color: #fff;
  background: linear-gradient(135deg, var(--es-brand-primary), var(--es-brand-accent));
}

.ai-cta {
  border-color: #efdbff;
  background: linear-gradient(135deg, #f9f0ff, #ffffff 60%);
}

.ai-cta-badge {
  background: linear-gradient(135deg, #6f42c1, #a855f7);
}

/* 片段拼装页：不是「一份 schema 驱动」，故换第三种徽章色（青）区分来源。 */
.fragment-cta-badge {
  background: linear-gradient(135deg, #0e7490, #06b6d4);
}

/* 三栏对照页：主张是「实测数字」，与上面几页的「能力演示」不同，故换第四种徽章色（琥珀）。 */
.nva-cta-badge {
  background: linear-gradient(135deg, #b45309, #f59e0b);
}

.flagship-cta-body {
  display: flex;
  flex-direction: column;
  gap: 6px;
}

.flagship-cta-title {
  font-size: 16px;
  font-weight: 600;
  color: #1a1a2e;
}

.flagship-cta-desc {
  font-size: 13px;
  line-height: 1.7;
  color: #666;
}

.flagship-cta-arrow {
  margin-left: auto;
  font-size: 20px;
  color: var(--es-brand-primary);
}

.level-header {
  display: flex;
  align-items: center;
  gap: 12px;
  margin-bottom: 16px;
}

.level-badge {
  display: inline-block;
  padding: 4px 14px;
  border-radius: 20px;
  font-size: 14px;
  font-weight: 700;
  color: #fff;
}

.level-badge.l1 { background: linear-gradient(135deg, #52c41a, #95de64); }
.level-badge.l2 { background: linear-gradient(135deg, var(--es-brand-accent), #52c41a); }
.level-badge.l3 { background: linear-gradient(135deg, #faad14, #ffc53d); }
.level-badge.l4 { background: linear-gradient(135deg, #722ed1, #b37feb); }
.level-badge.l5 { background: linear-gradient(135deg, #ff4d4f, #faad14); }

.level-goal {
  font-size: 13px;
  color: #999;
}

.case-card {
  border-radius: 12px;
  height: 100%;
  cursor: pointer;
}

.case-title {
  display: flex;
  align-items: center;
  gap: 8px;
  font-size: 17px;
  font-weight: 600;
  color: #1a1a2e;
  margin-bottom: 10px;
}

.case-no {
  color: var(--es-brand-primary);
  font-weight: 700;
}

.case-pain,
.case-win {
  font-size: 14px;
  line-height: 1.6;
  color: #666;
  margin: 4px 0;
}

.case-pain strong { color: #f56c6c; }
.case-win strong { color: #52c41a; }

.case-links {
  display: flex;
  flex-wrap: wrap;
  align-items: center;
  gap: 12px;
  margin-top: 10px;
  padding-top: 10px;
  border-top: 1px dashed #f0f0f0;
}

.case-link {
  font-size: 13px;
  color: #1677ff;
  font-weight: 500;
  text-decoration: none;
}

/* 另两端的入口：弱一档但保持可点 */
.case-link-cross {
  color: #999;
  font-weight: 400;
}
</style>
