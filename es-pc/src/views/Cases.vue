<template>
  <div class="cases-page">
    <div class="cases-hero">
      <h1>🎯 核心案例</h1>
      <p>
        按 <strong>L1–L5 学习梯度</strong>组织：从 30 秒上手，到零事件联动、复杂痛点、vxe/virtual 极限场景，
        再到 render 逃生舱。每个案例回答「<strong>原生怎么写 vs es-plus 怎么写</strong>」。
      </p>
    </div>

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
// 跨端互链：与顶栏切换器共用同一份三站清单（受 check:site-nav 守护）
import { SITES, SITE_KEY, siteOf, crossSiteUrl } from '@/utils/sites'

const levels = cases.levels
/** 另两端（本端走站内路由，不用绝对地址） */
const otherSites = SITES.filter((s) => s.key !== SITE_KEY)
const siteShort = siteOf(SITE_KEY)?.short ?? SITE_KEY

const circled = (n) => '①②③④⑤⑥⑦⑧⑨⑩⑪⑫⑬⑭⑮'[n - 1]
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

.level {
  margin-bottom: 40px;
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
