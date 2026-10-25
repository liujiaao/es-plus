<template>
  <div class="cases-page">
    <div class="cases-hero">
      <h1>🎯 核心案例</h1>
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
    </div>

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
// 跨端互链：与顶栏切换器共用同一份三站清单（受 check:site-nav 守护）
import { SITES, SITE_KEY, crossSiteUrl } from '@/utils/sites'

const levels = cases.levels
/** 另两端（本端用站内路由，不走绝对地址） */
const otherSites = SITES.filter((s) => s.key !== SITE_KEY)

const circled = (n: number) => '①②③④⑤⑥⑦⑧⑨⑩⑪⑫⑬⑭⑮'[n - 1]
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
    font-size: 32px;
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
  transition: all 0.3s;

  &:hover {
    transform: translateY(-2px);
    box-shadow: 0 12px 28px rgba(0, 0, 0, 0.08);
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

/* AI 产物页与旗舰页视觉同构，只换徽章色：一眼能看出「同一件事的两种来源」。 */
.ai-cta-badge {
  background: linear-gradient(135deg, #6f42c1, #a855f7);
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

.level-badge {
  display: inline-block;
  padding: 4px 14px;
  border-radius: 20px;
  font-size: 14px;
  font-weight: 700;
  color: #fff;

  &.l1 { background: linear-gradient(135deg, #67c23a, #95d475); }
  &.l2 { background: linear-gradient(135deg, var(--brand-accent), #67c23a); }
  &.l3 { background: linear-gradient(135deg, #e6a23c, #f4a460); }
  &.l4 { background: linear-gradient(135deg, #6f42c1, #a855f7); }
  &.l5 { background: linear-gradient(135deg, #f56c6c, #e6a23c); }
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
  transition: all 0.3s;

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

.case-pain strong { color: #f56c6c; flex-shrink: 0; }
.case-win strong { color: #67c23a; flex-shrink: 0; }

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
