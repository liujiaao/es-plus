<template>
  <div class="cases-page">
    <div class="container">
      <div class="cases-hero">
        <h1 class="content-title">🎯 核心案例</h1>
        <p class="cases-subtitle">
          按 <strong>L1–L5 学习梯度</strong>组织：从 30 秒上手，到零事件联动、复杂痛点、vxe/virtual 极限场景，
          再到 render 逃生舱。每个案例回答「<strong>原生怎么写 vs es-plus 怎么写</strong>」。
        </p>
      </div>

      <section
        v-for="level in levels"
        :key="level.id"
        class="level"
      >
        <div class="level-header">
          <span
            class="level-badge"
            :class="level.id.toLowerCase()"
          >{{ level.title }}</span>
          <span class="level-goal">{{ level.goal }}</span>
        </div>
        <div class="case-grid">
          <!-- 卡片从 <router-link> 改为 <div>：要在卡里放三端互链，而 <router-link> 渲染成
               <a>，里面再嵌 <a>（跨端链接）是非法 HTML，点击行为也会互相干扰。 -->
          <div
            v-for="c in level.cases"
            :key="c.id"
            class="case-card"
          >
            <div class="case-title">
              <span class="case-no">{{ circled(c.id) }}</span>
              {{ c.title }}
            </div>
            <p class="case-pain"><strong>痛点：</strong>{{ c.pain }}</p>
            <p class="case-win"><strong>优势：</strong>{{ c.win }}</p>
            <!-- 三端互链：同一案例在另两端都有对应页面 —— 这正是 es-plus 的头号卖点，
                 而案例库是最该展示它的地方。地址来自 utils/sites 的三站清单
                 （与顶栏切换器同一份，受 check:site-nav 守护）。 -->
            <div class="case-links">
              <router-link :to="c.links[siteKey]" class="case-link">本端 · {{ siteShort }} →</router-link>
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
  </div>
</template>

<script>
// 案例目录单一真源：由 scripts/sync-cases.mjs 从 docs/cases/cases.json 分发，禁止手改本文件
import cases from '@/cases/cases.json'
// 跨端互链：与顶栏切换器共用同一份三站清单（受 check:site-nav 守护）
import { SITES, SITE_KEY, siteOf, crossSiteUrl } from '@/utils/sites'

export default {
  name: 'Cases',
  computed: {
    /** 另两端（本端走站内路由，不用绝对地址） */
    otherSites() {
      return SITES.filter((s) => s.key !== SITE_KEY)
    },
    siteShort() {
      return siteOf(SITE_KEY)?.short ?? SITE_KEY
    },
    // Vue 2 的模板表达式只能访问**实例属性**：模块级的 SITE_KEY 与 crossSiteUrl
    // 在模板里都取不到 —— 前者让 c.links[undefined] 拿不到链接，后者直接抛
    // "crossSiteUrl is not a function"。两者都必须挂到实例上。
    siteKey() {
      return SITE_KEY
    }
  },
  data() {
    return {
      levels: cases.levels
    }
  },
  methods: {
    // 模块级导入的函数在 Vue 2 模板里同样访问不到（与 SITE_KEY 同一根因），
    // 必须挂到实例上；该函数是纯函数、不依赖 this，直接简写挂载。
    crossSiteUrl,
    circled(n) {
      return '①②③④⑤⑥⑦⑧⑨⑩⑪⑫⑬⑭⑮'[n - 1]
    }
  }
}
</script>

<style scoped>
.cases-page {
  padding: 40px 20px;
}

.container {
  max-width: 960px;
  margin: 0 auto;
}

.cases-hero {
  text-align: center;
  margin-bottom: 32px;
}

.cases-subtitle {
  color: #606266;
  line-height: 1.8;
}

.level {
  margin-bottom: 36px;
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

.level-badge.l1 { background: linear-gradient(135deg, #67c23a, #95d475); }
.level-badge.l2 { background: linear-gradient(135deg, #06b6d4, #67c23a); }
.level-badge.l3 { background: linear-gradient(135deg, #e6a23c, #f4a460); }
.level-badge.l4 { background: linear-gradient(135deg, #6f42c1, #a855f7); }
.level-badge.l5 { background: linear-gradient(135deg, #f56c6c, #e6a23c); }

.level-goal {
  font-size: 13px;
  color: #909399;
}

.case-grid {
  display: grid;
  grid-template-columns: repeat(2, 1fr);
  gap: 16px;
}

.case-card {
  display: block;
  padding: 20px;
  background: #fff;
  border: 1px solid #e2e8f0;
  border-radius: 12px;
  text-decoration: none;
  transition: all 0.3s ease;
}

.case-card:hover {
  transform: translateY(-3px);
  box-shadow: 0 12px 28px rgba(0, 0, 0, 0.08);
  border-color: var(--es-brand-primary);
}

.case-title {
  display: flex;
  align-items: center;
  gap: 8px;
  font-size: 17px;
  font-weight: 600;
  color: #1a1a1a;
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
  color: #4a5568;
  margin: 4px 0;
}

.case-pain strong { color: #f56c6c; }
.case-win strong { color: #67c23a; }

.case-links {
  display: flex;
  flex-wrap: wrap;
  align-items: center;
  gap: 12px;
  margin-top: 10px;
  padding-top: 10px;
  border-top: 1px dashed #e2e8f0;
}

.case-link {
  font-size: 13px;
  color: var(--es-brand-primary);
  font-weight: 500;
  text-decoration: none;
}

/* 另两端的入口：弱一档但保持可点 */
.case-link-cross {
  color: #718096;
  font-weight: 400;
}

@media (max-width: 768px) {
  .case-grid {
    grid-template-columns: 1fr;
  }
}
</style>
