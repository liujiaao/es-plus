<template>
  <div class="ai-gallery">
    <!-- 详情：一个通用宿主渲染单个案例（/ai-gallery/:id）。:key 保证换案例时整页重建
         （宿主的 entry 取自 data()，Vue2 不会因 prop 变化重新求值）。 -->
    <template v-if="caseId">
      <div class="ai-gallery-nav">
        <router-link to="/ai-gallery" class="ai-gallery-back">← 全部 AI 案例</router-link>
        <span v-if="entry" class="ai-gallery-hint">
          本页由 <code>src/cases/generated/registry.js</code>（manifest 生成）驱动，宿主代码不含业务规则
        </span>
      </div>
      <ai-case-host v-if="entry" :key="caseId" :case-id="caseId" />
      <div v-else class="ai-gallery-empty">
        <p>没有 id 为「{{ caseId }}」的案例</p>
        <router-link to="/ai-gallery"><el-button type="primary" size="small">返回画廊</el-button></router-link>
      </div>
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

      <section v-for="group in groups" :key="group.key" class="ai-gallery-group">
        <h2>
          <span class="ai-gallery-cluster">{{ group.key }}</span>
          {{ group.label }}
        </h2>
        <div class="ai-gallery-grid">
          <article v-for="item in group.items" :key="item.id" class="ai-card">
            <div class="ai-card-head">
              <span class="ai-card-claim" :class="'claim-' + item.claim">{{ claimLabel(item.claim) }}</span>
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
                <el-button size="mini" type="primary">{{ item.host.kind === 'generic' ? '打开案例' : '打开专属页' }}</el-button>
              </router-link>
              <el-button v-if="item.schema" size="mini" @click="download(item.id + '.json', item.schema)">
                下载 schema
              </el-button>
              <el-button v-if="item.config" size="mini" @click="download(item.id + '.config.json', item.config)">
                下载配置
              </el-button>
            </p>
          </article>
        </div>
      </section>
    </template>
  </div>
</template>

<script>
/**
 * AI 案例画廊（es-eui：Vue 2 + Element UI）。
 *
 * 与另两站同一份逻辑：列清单（manifest 生成的 registry）、打开案例（通用宿主）、
 * 下载产物。claim 徽章只是如实显示 manifest 的值 —— 边界由 `npm run check:ai-cases` 守。
 *
 * 站点差异只在框架层：Options API、el-button 的 `size="mini"`（Element UI 称呼）、
 * 以及没有 a-empty / el-empty 一致外形，故「案例不存在」用一小段文本兜底。
 */
import { AI_CASE_LIST, AI_CASES, AI_CLUSTERS } from '@/cases/generated/registry.js'
import AiCaseHost from '../components/ai-case-host.vue'

export default {
  name: 'AiGallery',
  components: { AiCaseHost },
  data() {
    return {
      groups: Object.keys(AI_CLUSTERS)
        .map((key) => ({
          key,
          label: AI_CLUSTERS[key],
          items: AI_CASE_LIST.filter((c) => c.clusters[0] === key).map((c) => ({
            ...c,
            route: c.host.kind === 'generic' ? '/ai-gallery/' + c.id : c.host.route,
          })),
        }))
        .filter((g) => g.items.length > 0),
    }
  },
  computed: {
    caseId() {
      return this.$route.params.id ? String(this.$route.params.id) : ''
    },
    entry() {
      return this.caseId ? AI_CASES[this.caseId] || null : null
    },
  },
  methods: {
    claimLabel(claim) {
      return { execute: '三端可交互', compile: '产物可编译', measure: '仅被度量' }[claim] || claim
    },
    /** 下载纯 JSON 产物（内存 Blob，不需要把文件发布到 public/）。 */
    download(name, data) {
      if (!data) return
      const blob = new Blob([JSON.stringify(data, null, 2) + '\n'], { type: 'application/json' })
      const url = URL.createObjectURL(blob)
      const a = document.createElement('a')
      a.href = url
      a.download = name
      a.click()
      URL.revokeObjectURL(url)
    },
  },
}
</script>

<style lang="scss" scoped>
.ai-gallery {
  max-width: 1200px;
  margin: 0 auto;
  padding: 8px clamp(12px, 3vw, 32px) 48px;
}

.ai-gallery-hero {
  padding: 16px 0;
  border-bottom: 1px solid #ebeef5;

  h1 {
    font-size: 24px;
    margin: 8px 0 10px;
    color: #1a1a2e;
  }

  p {
    color: #606266;
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
  color: #909399;
}

.ai-gallery-comp {
  display: flex;
  align-items: center;
  flex-wrap: wrap;
  margin: 14px 0 4px;
  padding: 10px 14px;
  border: 1px solid #ebeef5;
  border-radius: 8px;
  background: #fafafa;
  color: inherit;
  text-decoration: none;

  &:hover {
    border-color: #6f42c1;
  }

  .ai-gallery-comp-tag {
    margin-right: 10px;
    padding: 1px 8px;
    border-radius: 8px;
    font-size: 12px;
    color: #fff;
    background: linear-gradient(135deg, #6f42c1, #a855f7);
  }

  strong {
    margin-right: 10px;
  }

  .ai-gallery-comp-desc {
    font-size: 13px;
    color: #909399;
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
  background: #fafafa;
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
    color: #1a1a2e;
    margin: 0 0 12px;
  }
}

.ai-gallery-cluster {
  display: inline-block;
  min-width: 34px;
  margin-right: 6px;
  font-family: monospace;
  color: var(--es-brand-primary, #409eff);
}

.ai-gallery-grid {
  display: grid;
  grid-template-columns: repeat(auto-fill, minmax(320px, 1fr));
  gap: 14px;
}

.ai-card {
  border: 1px solid #ebeef5;
  border-radius: 8px;
  padding: 14px 16px;
  background: #fff;

  h3 {
    font-size: 15px;
    margin: 8px 0 4px;
    color: #1a1a2e;
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
  color: #909399;

  &.ok {
    color: #15803d;
  }
}

.ai-card-id,
.ai-card-tokens {
  margin: 4px 0;
  font-size: 12px;
  color: #909399;
}

.ai-card-token {
  display: inline-block;
  margin-right: 6px;
  padding: 0 6px;
  border-radius: 4px;
  background: #fafafa;
  font-family: monospace;
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
  border-bottom: 1px solid #ebeef5;
  margin-bottom: 8px;
}

.ai-gallery-back {
  font-size: 13px;
  color: var(--es-brand-primary, #409eff);
  text-decoration: none;
}

.ai-gallery-hint {
  font-size: 12px;
  color: #909399;
}

.ai-gallery-empty {
  padding: 40px 0;
  text-align: center;
  color: #909399;
}
</style>
