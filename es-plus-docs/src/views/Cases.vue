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
      <div class="case-grid">
        <div v-for="c in level.cases" :key="c.id" class="case-card">
          <div class="case-title">
            <span class="case-no">{{ circled(c.id) }}</span>
            {{ c.title }}
          </div>
          <p class="case-pain"><strong>痛点：</strong>{{ c.pain }}</p>
          <p class="case-win"><strong>优势：</strong>{{ c.win }}</p>
          <router-link :to="c.links.vue3" class="case-link">查看案例 →</router-link>
        </div>
      </div>
    </section>
  </div>
</template>

<script setup lang="ts">
// 案例目录单一真源：由 scripts/sync-cases.mjs 从 docs/cases/cases.json 分发，禁止手改本文件
import cases from '@/cases/cases.json'

const levels = cases.levels

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

.case-link {
  display: inline-block;
  margin-top: 8px;
  font-size: 13px;
  color: var(--primary-color);
  font-weight: 500;
  text-decoration: none;

  &:hover { text-decoration: underline; }
}

@media (max-width: 768px) {
  .case-grid {
    grid-template-columns: 1fr;
  }
}
</style>
