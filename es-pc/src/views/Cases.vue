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
          <a-card class="case-card" hoverable @click="$router.push(c.links.antdv)">
            <div class="case-title">
              <span class="case-no">{{ circled(c.id) }}</span>
              {{ c.title }}
            </div>
            <p class="case-pain"><strong>痛点：</strong>{{ c.pain }}</p>
            <p class="case-win"><strong>优势：</strong>{{ c.win }}</p>
            <span class="case-link">查看案例 →</span>
          </a-card>
        </a-col>
      </a-row>
    </section>
  </div>
</template>

<script setup>
// 案例目录单一真源：由 scripts/sync-cases.mjs 从 docs/cases/cases.json 分发，禁止手改本文件
import cases from '@/cases/cases.json'

const levels = cases.levels

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

.case-link {
  display: inline-block;
  margin-top: 8px;
  font-size: 13px;
  color: var(--es-brand-primary);
  font-weight: 500;
}
</style>
