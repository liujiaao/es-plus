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
          <router-link
            v-for="c in level.cases"
            :key="c.id"
            :to="c.links.vue2"
            class="case-card"
          >
            <div class="case-title">
              <span class="case-no">{{ circled(c.id) }}</span>
              {{ c.title }}
            </div>
            <p class="case-pain"><strong>痛点：</strong>{{ c.pain }}</p>
            <p class="case-win"><strong>优势：</strong>{{ c.win }}</p>
            <span class="case-link">查看案例 →</span>
          </router-link>
        </div>
      </section>
    </div>
  </div>
</template>

<script>
// 案例目录单一真源：由 scripts/sync-cases.mjs 从 docs/cases/cases.json 分发，禁止手改本文件
import cases from '@/cases/cases.json'

export default {
  name: 'Cases',
  data() {
    return {
      levels: cases.levels
    }
  },
  methods: {
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
  border-color: #409eff;
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

.case-link {
  display: inline-block;
  margin-top: 8px;
  font-size: 13px;
  color: var(--es-brand-primary);
  font-weight: 500;
}

@media (max-width: 768px) {
  .case-grid {
    grid-template-columns: 1fr;
  }
}
</style>
