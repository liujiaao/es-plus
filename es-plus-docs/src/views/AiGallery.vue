<template>
  <div class="ai-gallery">
    <!-- 详情：一个通用宿主渲染单个案例（/ai-gallery/:id）。 -->
    <template v-if="caseId">
      <div class="ai-gallery-nav">
        <router-link to="/ai-gallery" class="ai-gallery-back">← 全部 AI 案例</router-link>
        <span v-if="entry" class="ai-gallery-hint">
          本页由 <code>src/cases/generated/registry.js</code>（manifest 生成）驱动，宿主代码不含业务规则
        </span>
      </div>
      <!-- :key 绑 caseId：/ai-gallery/a → /ai-gallery/b 复用同一路由组件，不重建宿主的话
           <es-crud-page> 会拿旧的 schema 实例配新的 columns —— 表头变了、行还是上一个案例的
           （实测表现：新列全渲染成「-」）。三端一致，语出 es-eui 的同名写法。 -->
      <ai-case-host v-if="entry" :key="caseId" :case-id="caseId" />
      <el-empty v-else :description="`没有 id 为「${caseId}」的案例`">
        <router-link to="/ai-gallery"><el-button type="primary">返回画廊</el-button></router-link>
      </el-empty>
    </template>

    <!-- 列表：按能力簇分组（分组标题来自 manifest.clusters，单一真源）。 -->
    <template v-else>
      <header class="ai-gallery-hero">
        <span class="ai-gallery-badge">AI 案例画廊</span>
        <h1>一句话 → 页面：每个案例都是一份可下载的纯 JSON</h1>
        <p>
          全部条目来自单源 <code>docs/cases/ai-cases.json</code>。每个案例展示三样东西：
          <strong>模型写出的配置</strong>（可下载）、<strong>确定性生成器编译出的页面</strong>
          （就在下面这一份 schema 上跑）、以及<strong>宿主补了什么</strong>（请求、权限、副作用）。
          徽章是该案例在三个站点上的 claim —— 「三端可交互」需要 e2e 或专属守卫背书。
        </p>
        <p class="ai-gallery-legend">
          可机械重放：<span class="ai-gallery-chip ok">是</span> 表示产物 = 编译(冻结配置)，
          <code>npm run check:ai-cases</code> 会重算这条等式；<span class="ai-gallery-chip">否</span>
          表示该案例只由专属守卫承担主张（原因写在条目上）。
        </p>
      </header>

      <!-- S2 组合画廊：组合（多面归并）不是一个案例页能表达的 —— 一页 18 例
           （6 个逻辑案例 × 3 端），组合事实与产物由评测同一个函数算好。 -->
      <router-link to="/ai-gallery/composition" class="ai-gallery-comp">
        <span class="ai-gallery-comp-tag">S2</span>
        <strong>组合画廊</strong>
        <span class="ai-gallery-comp-desc">
          同一份意图表如何归并成成员关系、派生动作与弹窗，三端产物逐字节对照（18 例）
        </span>
        <em>打开 →</em>
      </router-link>

      <!-- S3 工具工作流：9 次真工具调用的入参与出参（此前只有文案、没有页面）。 -->
      <router-link to="/ai-gallery/workflows" class="ai-gallery-comp">
        <span class="ai-gallery-comp-tag">S3</span>
        <strong>工具工作流</strong>
        <span class="ai-gallery-comp-desc">
          探测→出页→纠偏、脚手架→体检、接管既有表单、片段拆装：12 次真 handler 调用，11 个此前只有文档的工具全覆盖
        </span>
        <em>打开 →</em>
      </router-link>

      <section v-for="group in groups" :key="group.key" class="ai-gallery-group">
        <h2>
          <span class="ai-gallery-cluster">{{ group.key }}</span>
          {{ group.label }}
        </h2>
        <div class="ai-gallery-grid">
          <article v-for="item in group.items" :key="item.id" class="ai-card">
            <div class="ai-card-head">
              <span class="ai-card-claim" :class="`claim-${item.claim}`">{{ CLAIM_LABEL[item.claim] }}</span>
              <span class="ai-card-replay" :class="{ ok: item.replay === 'frozen-config' }">
                {{ item.replay === 'frozen-config' ? '可机械重放' : '专属守卫背书' }}
              </span>
            </div>
            <h3>{{ item.title }}</h3>
            <p class="ai-card-id"><code>{{ item.id }}</code></p>
            <p class="ai-card-tokens">
              <span v-for="t in item.tokens" :key="t" class="ai-card-token">{{ t }}</span>
            </p>
            <p class="ai-card-actions">
              <router-link :to="item.route">
                <el-button size="small" type="primary">{{ item.host.kind === 'generic' ? '打开案例' : '打开专属页' }}</el-button>
              </router-link>
              <el-button size="small" @click="download(`${item.id}.json`, item.schema)">
                下载 schema
              </el-button>
              <el-button v-if="item.config" size="small" @click="download(`${item.id}.config.json`, item.config)">
                下载配置
              </el-button>
            </p>
          </article>
        </div>
      </section>
    </template>
  </div>
</template>

<script setup>
/**
 * AI 案例画廊（主文档站）。
 *
 * 职责刻意很薄：**列清单**（来自生成的 registry）+ **打开案例**（通用宿主）+ **下载产物**。
 * 它不判断任何主张 —— claim 徽章是 manifest 里写死的值，由 `check:ai-cases` 守住边界
 * （不超过 AN-09 的能力格子、execute 必须有 e2e 或专属守卫）。这里只负责如实显示。
 */
import { computed } from 'vue'
import { useRoute } from 'vue-router'
import AiCaseHost from '@/components/AiCaseHost.vue'
import { AI_CASE_LIST, AI_CASES, AI_CLUSTERS } from '@/cases/generated/registry.js'

const route = useRoute()
const caseId = computed(() => (route.params.id ? String(route.params.id) : ''))
const entry = computed(() => (caseId.value ? AI_CASES[caseId.value] ?? null : null))

const CLAIM_LABEL = { execute: '三端可交互', compile: '产物可编译', measure: '仅被度量' }

const groups = computed(() =>
  Object.entries(AI_CLUSTERS)
    .map(([key, label]) => ({
      key,
      label,
      items: AI_CASE_LIST.filter((c) => c.clusters[0] === key).map((c) => ({
        ...c,
        route: c.host.kind === 'generic' ? `/ai-gallery/${c.id}` : c.host.route,
      })),
    }))
    .filter((g) => g.items.length > 0)
)

/** 下载纯 JSON 产物（内存 Blob，不需要把文件发布到 public/）。 */
function download(name, data) {
  if (!data) return
  const blob = new Blob([`${JSON.stringify(data, null, 2)}\n`], { type: 'application/json' })
  const url = URL.createObjectURL(blob)
  const a = document.createElement('a')
  a.href = url
  a.download = name
  a.click()
  URL.revokeObjectURL(url)
}
// 详情页（/ai-gallery/:id）的标题跟着案例走；列表页回落到表里的默认项。
import { PAGE_META, usePageMeta } from '@/utils/page-meta'

usePageMeta(() => {
  const item = entry.value
  if (!item) return PAGE_META['ai-gallery']
  return {
    title: item.title,
    description: `AI 案例画廊：${item.title} —— 附配置、产物与复现步骤。`,
  }
})
</script>

<style lang="scss" scoped>
.ai-gallery {
  max-width: 1200px;
  margin: 0 auto;
  padding: 8px clamp(12px, 3vw, 32px) 48px;
}

.ai-gallery-hero {
  padding: 16px 0;
  border-bottom: 1px solid var(--border-color-lighter);

  h1 {
    font-size: 24px;
    margin: 8px 0 10px;
    color: var(--text-color-primary);
  }

  p {
    color: var(--text-color-regular);
    line-height: 1.9;
    margin: 6px 0;
  }
}

.ai-gallery-badge {
  display: inline-block;
  padding: 2px 10px;
  border-radius: 10px;
  font-size: 12px;
  color: #fff;
  background: linear-gradient(135deg, #6f42c1, #a855f7);
}

.ai-gallery-legend {
  font-size: 13px;
  color: var(--text-color-secondary);
}

.ai-gallery-comp {
  display: flex;
  align-items: center;
  flex-wrap: wrap;
  gap: 10px;
  margin: 14px 0 4px;
  padding: 10px 14px;
  border: 1px solid var(--border-color-lighter);
  border-radius: 8px;
  background: var(--bg-color-page, #f9fafb);
  color: inherit;
  text-decoration: none;

  &:hover {
    border-color: #6f42c1;
  }

  .ai-gallery-comp-tag {
    padding: 1px 8px;
    border-radius: 8px;
    font-size: 12px;
    color: #fff;
    background: linear-gradient(135deg, #6f42c1, #a855f7);
  }

  .ai-gallery-comp-desc {
    font-size: 13px;
    color: var(--text-color-secondary);
  }

  em {
    margin-left: auto;
    font-style: normal;
    color: #6f42c1;
  }
}

.ai-gallery-chip {
  padding: 0 6px;
  border-radius: 4px;
  background: var(--bg-color-page, #f5f7fa);
  font-size: 12px;

  &.ok {
    color: #15803d;
    background: #dcfce7;
  }
}

.ai-gallery-group {
  margin-top: 26px;

  h2 {
    font-size: 16px;
    color: var(--text-color-primary);
    margin: 0 0 12px;
  }
}

.ai-gallery-cluster {
  display: inline-block;
  min-width: 34px;
  margin-right: 6px;
  font-family: var(--code-font-family, monospace);
  color: var(--primary-color);
}

.ai-gallery-grid {
  display: grid;
  grid-template-columns: repeat(auto-fill, minmax(320px, 1fr));
  gap: 14px;
}

.ai-card {
  border: 1px solid var(--border-color-lighter);
  border-radius: 8px;
  padding: 14px 16px;
  background: var(--bg-color, #fff);

  h3 {
    font-size: 15px;
    margin: 8px 0 4px;
    color: var(--text-color-primary);
  }
}

.ai-card-head {
  display: flex;
  justify-content: space-between;
  gap: 8px;
  font-size: 12px;
}

.ai-card-claim {
  padding: 1px 8px;
  border-radius: 8px;
  color: #fff;
  background: #6f42c1;

  &.claim-compile {
    background: #0369a1;
  }

  &.claim-measure {
    background: #6b7280;
  }
}

.ai-card-replay {
  color: var(--text-color-secondary);

  &.ok {
    color: #15803d;
  }
}

.ai-card-id,
.ai-card-tokens {
  margin: 4px 0;
  font-size: 12px;
  color: var(--text-color-secondary);
}

.ai-card-token {
  display: inline-block;
  margin-right: 6px;
  padding: 0 6px;
  border-radius: 4px;
  background: var(--bg-color-page, #f5f7fa);
  font-family: var(--code-font-family, monospace);
}

.ai-card-actions {
  margin: 10px 0 0;
  display: flex;
  gap: 8px;
  flex-wrap: wrap;
}

.ai-gallery-nav {
  display: flex;
  align-items: center;
  gap: 12px;
  padding: 10px 0;
  border-bottom: 1px solid var(--border-color-lighter);
  margin-bottom: 8px;
}

.ai-gallery-back {
  font-size: 13px;
  color: var(--primary-color);
  text-decoration: none;
}

.ai-gallery-hint {
  font-size: 12px;
  color: var(--text-color-secondary);
}
</style>
