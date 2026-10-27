<template>
  <div class="fd" data-testid="fragment-dashboard">
    <header class="fd-hero">
      <span class="fd-badge">A8 片段拼装</span>
      <h1>三个片段拼成一个分析页：宿主只管取数与编排</h1>
      <p class="fd-nl">「{{ data.nl }}」</p>
      <p class="fd-lede">
        页面里<strong>没有任何 schema</strong>：筛选表单、结果表格、详情弹窗来自三个片段工具，产物一行未改；
        布局、取数、图表由宿主自己写 —— 图表是原生 <code>&lt;svg&gt;</code>，完全不经 es-plus。
      </p>
      <p class="fd-claim">
        <span class="fd-chip-label">claim（与 manifest 逐站一致）</span>
        <span v-for="(claim, site) in data.sites" :key="site" class="fd-chip">{{ site }}: {{ claim }}</span>
      </p>
      <p class="fd-compile">
        本端 <strong>claim: compile</strong> —— 这一页不运行片段：vue2 目标的片段从 <code>vue</code> 导入
        <code>defineComponent</code> / <code>reactive</code>（Vue 2.7 语义），而本站是 Vue 2.6 +
        composition-api 插件。故这里展示三端产物原文，并由 <code>npm run check:fragment-dashboard</code>
        对 9 个片段逐个做语法解析。真跑的是主文档站与 es-pc。
      </p>
    </header>

    <section class="fd-section">
      <h2>产物：同一份字段表，三种目标各一份可独立编译的 SFC</h2>
      <div class="fd-tabs">
        <button
          v-for="target in targets"
          :key="target"
          type="button"
          :class="{ active: target === pickedTarget }"
          :data-testid="'fd-target-' + target"
          @click="pickedTarget = target"
        >
          {{ target }}
          <em>{{ targetNote(target) }}</em>
        </button>
      </div>
      <p class="fd-evidence" data-testid="fd-compile-evidence">
        编译证据：{{ keys.length }} 个片段 × {{ targets.length }} 个目标 = {{ keys.length * targets.length }} 份产物
        全部通过 esbuild 语法解析（只解析 <code>&lt;script&gt;</code>，模板与依赖不在断言里）。
      </p>
      <div class="fd-sources">
        <article v-for="key in keys" :key="key" :data-testid="'fd-source-' + key">
          <h3>
            {{ data.fragments[key].label }}
            <code>{{ data.fragments[key].tool }}</code>
            <span class="fd-src-meta">
              {{ data.fragments[key].file }} · {{ data.fragments[key].lines }} 行 ·
              {{ data.targets[pickedTarget].bytes[key] }} 字节
            </span>
          </h3>
          <pre>{{ sources[pickedTarget][key] }}</pre>
        </article>
      </div>
    </section>

    <section class="fd-section">
      <h2>片段 → 宿主：三个接线点</h2>
      <table class="fd-wiring" data-testid="fd-wiring">
        <thead>
          <tr><th>片段</th><th>接线点</th><th>为什么必须由宿主接</th></tr>
        </thead>
        <tbody>
          <tr v-for="w in data.host.wiring" :key="w.fragment">
            <td><code>{{ w.fragment }}</code></td>
            <td><code>{{ w.point }}</code></td>
            <td>{{ w.why }}</td>
          </tr>
        </tbody>
      </table>
      <p class="fd-note">{{ data.host.dataPath }}</p>
      <p class="fd-note">{{ data.host.chart }}</p>
    </section>

    <section class="fd-section">
      <h2>当前边界（片段拼装还缺什么）</h2>
      <ul class="fd-gaps" data-testid="fd-gaps">
        <li v-for="gap in data.knownGaps" :key="gap">{{ gap }}</li>
      </ul>
      <p class="fd-note">
        这些不是「以后再说」的注脚：页面上的接线方式就是它们的结果 —— 片段今天能拼回页面，
        但拼装契约是底层组件的属性名，而不是片段自己的 props / emits。
      </p>
    </section>
  </div>
</template>

<script>
/**
 * A8 片段拼装仪表盘（es-eui：Vue 2 + Element UI）。
 *
 * 与主文档站/ es-pc 同一份数据（`fragment-dashboard.json` + 源码模块），但**不渲染片段**：
 * 本端 claim 只有 compile。原因写在页面上（Vue 2.6 vs 面向 Vue 2.7 的产物），
 * 不藏成「看起来能跑」。
 */
import FACTS from '@/cases/generated/fragment-dashboard.json'
import { FRAGMENT_SOURCES } from '@/cases/generated/fragment-dashboard-sources.js'

export default {
  name: 'FragmentDashboard',
  data() {
    return {
      data: FACTS,
      sources: FRAGMENT_SOURCES,
      targets: FACTS.frozenArgs.targets,
      keys: ['filter', 'table', 'dialog'],
      pickedTarget: 'vue2',
    }
  },
  methods: {
    targetNote(target) {
      const entry = this.data.targets[target]
      return entry ? entry.note : ''
    },
  },
}
</script>

<style lang="scss" scoped>
.fd {
  max-width: 1240px;
  margin: 0 auto;
  padding: 8px clamp(12px, 3vw, 32px) 56px;
  color: #1a1a2e;
}

.fd-hero {
  padding: 16px 0;
  border-bottom: 1px solid #ebeef5;

  h1 {
    font-size: 24px;
    margin: 8px 0 10px;
  }

  p {
    color: #606266;
    line-height: 1.9;
    margin: 6px 0;
  }
}

.fd-badge {
  display: inline-block;
  padding: 2px 10px;
  border-radius: 10px;
  font-size: 12px;
  color: #fff;
  background: linear-gradient(135deg, #6f42c1, #a855f7);
}

.fd-nl {
  font-style: italic;
  color: #909399;
}

.fd-claim {
  display: flex;
  flex-wrap: wrap;
  align-items: center;
  gap: 8px;
  font-size: 13px;
}

.fd-chip {
  padding: 1px 8px;
  border-radius: 8px;
  font-size: 12px;
  color: #0369a1;
  background: #e0f2fe;
}

.fd-chip-label {
  font-size: 12px;
  color: #909399;
}

.fd-compile {
  font-size: 13px;
  color: #78350f;
  background: #fffbeb;
  border: 1px solid #fde68a;
  border-radius: 8px;
  padding: 10px 12px;
}

.fd-section {
  margin-top: 28px;

  h2 {
    font-size: 16px;
    margin: 0 0 12px;
  }
}

.fd-tabs {
  display: flex;
  flex-wrap: wrap;
  gap: 8px;
  margin-bottom: 10px;

  button {
    padding: 6px 12px;
    border: 1px solid #dcdfe6;
    border-radius: 6px;
    background: #fff;
    cursor: pointer;
    font-size: 13px;

    em {
      margin-left: 6px;
      font-style: normal;
      font-size: 11px;
      color: #909399;
    }

    &.active {
      border-color: #6f42c1;
      color: #6f42c1;
      background: #faf7ff;
    }
  }
}

.fd-evidence {
  font-size: 12px;
  color: #909399;
  margin: 0 0 12px;
}

.fd-sources {
  display: grid;
  grid-template-columns: repeat(auto-fit, minmax(min(320px, 100%), 1fr));
  gap: 14px;

  article {
    border: 1px solid #ebeef5;
    border-radius: 8px;
    padding: 10px 12px;
    min-width: 0;
  }

  h3 {
    display: flex;
    flex-wrap: wrap;
    align-items: center;
    gap: 8px;
    font-size: 13px;
    margin: 0 0 8px;
  }

  pre {
    margin: 0;
    max-height: 320px;
    overflow: auto;
    font-size: 12px;
    line-height: 1.6;
    background: #f9fafb;
    padding: 10px;
    border-radius: 6px;
  }
}

.fd-src-meta {
  font-size: 11px;
  font-weight: normal;
  color: #909399;
}

.fd-wiring {
  width: 100%;
  border-collapse: collapse;
  font-size: 13px;

  /* 三列文字（片段/接线点/为什么）在 320px 下的 min-content 约 364px，
     比容器（296px）宽 —— 让表格自己横滑，页面宽度不变。 */
  @media (max-width: 768px) {
    display: block;
    max-width: 100%;
    overflow-x: auto;
  }

  th,
  td {
    border: 1px solid #ebeef5;
    padding: 8px 10px;
    text-align: left;
    vertical-align: top;
    line-height: 1.7;
  }

  th {
    background: #f9fafb;
    font-weight: 600;
  }
}

.fd-note {
  margin: 10px 0 0;
  font-size: 12px;
  line-height: 1.8;
  color: #909399;
}

.fd-gaps {
  margin: 0;
  padding-left: 20px;
  font-size: 13px;
  line-height: 1.9;
  color: #606266;
}
</style>
