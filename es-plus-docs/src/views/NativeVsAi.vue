<template>
  <div class="nva" data-testid="native-vs-ai">
    <header class="nva-hero">
      <span class="nva-badge">A9 三栏对照</span>
      <h1>同一件事，三种写法：原生 / 手写 es-plus / AI 产物，四个口径同一把尺子</h1>
      <p class="nva-nl">「{{ nvs.scene }}」—— 同一个场景，三种交付方式。</p>
      <p class="nva-lede">
        下面的数字<strong>不是文案</strong>：由 <code>scripts/gen-cases-metrics.mjs</code> 从三个
        <strong>真实文件</strong>实算（原生 <code>.vue</code> / 手写 es-plus <code>.vue</code> /
        AI 产物 <code>.json</code>），四个口径（非空行 / 事件绑定 / 自写函数 / v-if 分支）用同一个计数器。
        源码原样展示、<strong>不在此页执行</strong> —— AI 栏跑起来的样子在
        <router-link to="/ai-gallery/employee-roster">AI 画廊 · 员工花名册</router-link>，那里由它自己的 e2e 背书。
      </p>
      <p class="nva-claim">
        <span class="nva-claim-tag">claim: measure + compile</span>
        measure = 四个维度实测自文件（改示例即改数字，守卫 <code>cases:metrics:check</code> 重算比对）；
        compile = 三栏源码原样展示、不执行。<strong>本页不认领 execute</strong> —— 它没有「被执行的产物」，
        不把数字页说成交互演示。
      </p>
    </header>

    <!-- 三栏：每栏一个文件、四个维度、一句它到底做到了什么 -->
    <section class="nva-grid">
      <article v-for="col in columns" :key="col.key" class="nva-col" :data-testid="`nva-col-${col.key}`">
        <h2>
          {{ col.title }}
          <span class="nva-tag">{{ col.tag }}</span>
        </h2>
        <p class="nva-file"><code>{{ col.file }}</code></p>
        <dl class="nva-metrics">
          <div v-for="m in METRICS" :key="m.key" class="nva-metric">
            <dt>{{ m.label }}</dt>
            <dd :data-testid="`nva-${col.key}-${m.key}`">{{ col.metrics[m.key] }}</dd>
            <span v-if="m.key !== 'lines' && col.key !== 'native'" class="nva-delta">
              {{ col.metrics[m.key] === 0 ? '归零' : `原生 ${native.metrics[m.key]} → ${col.metrics[m.key]}` }}
            </span>
          </div>
        </dl>
        <p class="nva-note">{{ col.note }}</p>
        <p v-if="col.key === 'ai'" class="nva-features" :data-testid="`nva-${col.key}-features`">
          产物自述：查询项 {{ features.formItems }} · 列 {{ features.columns }} · 弹窗 {{ features.dialogs }} ·
          行按钮 {{ features.actions }} · 码值表 {{ features.dataOptions }} ·
          内嵌脚本串 {{ features.scriptStrings }}（数自 JSON 本身，不是文案）
        </p>
      </article>
    </section>

    <!-- 结论区：三个维度归零、一个维度不降 —— 都写出来，不挑好看的 -->
    <section class="nva-verdict">
      <h2>读法：<strong>三个维度归零，行数这一栏不降</strong></h2>
      <ul>
        <li>
          事件绑定 {{ native.metrics.events }} → {{ es.metrics.events }} → {{ ai.metrics.events }}：
          原生每一列、每个按钮各挂一次；手写 es-plus 只剩一处 <code>@btn-click</code>；AI 产物是纯 JSON，<strong>零事件绑定</strong>。
        </li>
        <li>
          自写函数 {{ native.metrics.functions }} → {{ es.metrics.functions }} → {{ ai.metrics.functions }}：
          原生要自己取数、重置、开弹窗、格式化；AI 产物的「逻辑」在渲染器里，页面作者写 0 个函数。
        </li>
        <li>
          v-if 分支 {{ native.metrics.vIf }} → {{ es.metrics.vIf }} → {{ ai.metrics.vIf }}：
          码值 → 彩色标签这类分支，声明式写法里用 <code>dataOptions[].tagType</code> 表达。
        </li>
        <li>
          非空行 {{ native.metrics.lines }} → {{ es.metrics.lines }} → <strong>{{ ai.metrics.lines }}</strong>：
          JSON 逐标量一行，<strong>行数不降反升</strong>。这一栏<strong>不当作优点</strong>
          —— 换个序列化风格数字就会变，物理行数不是复杂度信号。
        </li>
        <li>
          真正省下的另一件事是<strong>「一份产物三端跑」</strong>：AI 栏那份 schema 在
          es-plus-docs / es-pc / es-eui 三站副本逐字节一致；原生与手写示例都只写了一份 vue3 实现 ——
          换端要再写一遍的成本没有进上面任何一个数字。
        </li>
      </ul>
    </section>

    <!-- 源码：三栏原样文本，切栏看 -->
    <section class="nva-sources">
      <h2>三份源码（原样，未经手改）</h2>
      <div class="nva-tabs">
        <button
          v-for="col in columns"
          :key="col.key"
          type="button"
          :class="{ active: picked === col.key }"
          :data-testid="`nva-tab-${col.key}`"
          @click="picked = col.key"
        >
          {{ col.short }}
          <em>{{ col.metrics.lines }} 行</em>
        </button>
      </div>
      <pre :data-testid="`nva-source-${picked}`">{{ pickedColumn.text }}</pre>
    </section>

    <!-- 没有量化的事：三栏偏差方向、模型那一步、以及为什么第三栏不是同场景产物 -->
    <section class="nva-gaps">
      <h2>这一页没有证明的事（如实）</h2>
      <ul data-testid="nva-gaps">
        <li>
          <strong>第三栏不是严格同场景产物</strong>：{{ nvs.note }}
          本仓没有为 filter-table 调过模型，硬造一份就等于把「确定性工具产物」冒充成「模型产物」。
          这个偏差<strong>对 AI 不利</strong>（多做功能，行数却没省），所以口径仍可用。
        </li>
        <li>
          <strong>模型那一步不可重放</strong>：产物记录的是「模型写过这版配置」，不是「模型必然写出这版」。
          可机械重放的只有「产物 → 渲染」这一段（<code>check:ai-cases</code> 断言 4）。
        </li>
        <li>
          <strong>渲染器的成本不在任何一栏里</strong>：声明式写法的行数优势来自「把复杂度搬进渲染器」——
          渲染器是 es-plus 自己的代码库，按页摊薄，但确实存在。
        </li>
        <li>
          <strong>只对照了一个场景</strong>：<code>status-column</code> 这类小场景里声明式反而更长
          （见 <router-link to="/cases">核心案例</router-link> 的成本对照表，降幅会显示成 +x%）。
        </li>
      </ul>
    </section>
  </div>
</template>

<script setup lang="ts">
/**
 * A9 三栏对照（主文档站与 es-pc 共用同一份文件，逐字节相同）。
 *
 * 页面本身**不含任何数字**：四个口径读 `cases-metrics.json`（度量单源），三栏源码读
 * `native-vs-ai-sources.js`（同一次度量落盘的原文）—— 改示例 → 两者同时变，页面不动。
 *
 * 为什么不做「三栏现场各跑一遍」：
 *   1. 原生示例依赖 Element Plus，es-pc 端没有这个库，跑起来只能一半绿；
 *   2. 示例文件在 `docs/examples/` 里，不进任何站点构建（它们是度量单源，不是站点代码）。
 * AI 栏的现场演示放在 AI 画廊的 A1 案例页 —— 有它自己的 e2e，不在这里重复一遍。
 */
import { computed, ref } from 'vue'
import metricsJson from '@/cases/cases-metrics.json'
import { NATIVE_VS_AI } from '@/cases/generated/native-vs-ai-sources.js'

interface ColumnMetrics {
  lines: number
  events: number
  functions: number
  vIf: number
}

const SCENE = 'filter-table'
const scenario = (metricsJson.scenarios as Array<Record<string, any>>).find((s) => s.id === SCENE)
const nvs = NATIVE_VS_AI[SCENE]

const METRICS = [
  { key: 'lines', label: '非空行' },
  { key: 'events', label: '事件绑定' },
  { key: 'functions', label: '自写函数' },
  { key: 'vIf', label: 'v-if 分支' },
] as const

const nativeResult: ColumnMetrics = scenario!.native
const esResult: ColumnMetrics = scenario!.es
const aiResult: ColumnMetrics = scenario!.ai
/** AI 产物的「自述能力」：从 JSON 本身数出来，用来支撑「第三栏是超集」这句话。 */
const features = scenario!.ai.features as Record<string, number>

const native = { metrics: nativeResult }
const es = { metrics: esResult }
const ai = { metrics: aiResult }

const columns = computed(() => [
  {
    key: 'native',
    title: '① 原生手写',
    short: '原生',
    tag: 'Element Plus',
    file: nvs.columns.native.file,
    text: nvs.columns.native.text,
    metrics: nativeResult,
    note: '查询项、列、状态标签的 v-if、分页、行内查看全部手写；每列、每个按钮各挂一次事件。',
  },
  {
    key: 'es',
    title: '② 手写 es-plus',
    short: '手写 es-plus',
    tag: 'schema 内联',
    file: nvs.columns.es.file,
    text: nvs.columns.es.text,
    metrics: esResult,
    note: '同一功能范围改写成一份 schema + 取数/动作两个函数；事件只剩 btn-click 一处，码值标签由 dataOptions 声明。',
  },
  {
    key: 'ai',
    title: '③ AI 产物',
    short: 'AI 产物',
    tag: nvs.columns.ai.meta.model ?? 'model',
    file: nvs.columns.ai.file,
    text: nvs.columns.ai.text,
    metrics: aiResult,
    note: `模型 ${nvs.columns.ai.meta.model} 生成于 ${nvs.columns.ai.meta.generatedAt}（${nvs.columns.ai.meta.attempts} 次尝试，${nvs.columns.ai.meta.mode} 模式）；纯 JSON，三站共用同一份。`,
  },
])

const picked = ref<string>('native')
const pickedColumn = computed(() => columns.value.find((c) => c.key === picked.value) ?? columns.value[0])
// 逐页 title / description：单一来源在 utils/page-meta.ts（check:page-meta 静态核对）。
// 放在脚本末尾不影响求值 —— ESM 的 import 声明会被提升，这样文件级注释与 import 分组都不被打断。
import { usePageMeta } from '@/utils/page-meta'

usePageMeta('native-vs-ai')
</script>

<style lang="scss" scoped>
.nva {
  max-width: 1180px;
  margin: 0 auto;
  padding: 8px clamp(12px, 3vw, 32px) 56px;
  color: var(--text-color-primary, #1f1f1f);
}

.nva-hero {
  padding: 16px 0;
  border-bottom: 1px solid var(--border-color-lighter, #ebeef5);

  h1 {
    font-size: 23px;
    line-height: 1.45;
    margin: 8px 0 10px;
  }

  p {
    color: var(--text-color-regular, #606266);
    line-height: 1.9;
    margin: 6px 0;
  }
}

.nva-badge {
  display: inline-block;
  padding: 2px 10px;
  border-radius: 10px;
  font-size: 12px;
  color: #fff;
  background: linear-gradient(135deg, #b45309, #f59e0b);
}

.nva-nl {
  font-style: italic;
  color: var(--text-color-secondary, #909399);
}

.nva-claim-tag {
  display: inline-block;
  margin-right: 6px;
  padding: 1px 8px;
  border-radius: 8px;
  font-size: 12px;
  color: #92400e;
  background: #fef3c7;
}

.nva-grid {
  display: grid;
  grid-template-columns: repeat(auto-fit, minmax(260px, 1fr));
  gap: 14px;
  margin-top: 20px;
}

.nva-col {
  border: 1px solid var(--border-color-lighter, #ebeef5);
  border-radius: 8px;
  padding: 12px 14px;
  background: var(--bg-color, #fff);

  h2 {
    display: flex;
    align-items: center;
    flex-wrap: wrap;
    gap: 8px;
    font-size: 14px;
    margin: 0 0 6px;
  }
}

.nva-tag {
  padding: 1px 8px;
  border-radius: 8px;
  font-size: 11px;
  font-weight: normal;
  color: #92400e;
  background: #fef3c7;
}

.nva-file {
  margin: 0 0 10px;
  font-size: 12px;
  color: var(--text-color-secondary, #909399);
  word-break: break-all;
}

.nva-metrics {
  display: grid;
  grid-template-columns: repeat(2, 1fr);
  gap: 8px;
  margin: 0;
}

.nva-metric {
  padding: 8px 10px;
  border-radius: 6px;
  background: var(--bg-color-page, #f9fafb);

  dt {
    font-size: 12px;
    color: var(--text-color-secondary, #909399);
  }

  dd {
    margin: 2px 0 0;
    font-size: 22px;
    font-weight: 700;
    line-height: 1.2;
    color: #1a1a2e;
  }
}

.nva-delta {
  font-size: 11px;
  color: #909399;
}

.nva-note {
  margin: 10px 0 0;
  font-size: 12px;
  line-height: 1.8;
  color: var(--text-color-secondary, #909399);
}

.nva-features {
  margin: 8px 0 0;
  padding: 6px 8px;
  border-radius: 6px;
  font-size: 12px;
  line-height: 1.7;
  color: #92400e;
  background: #fffbeb;
}

.nva-verdict,
.nva-gaps {
  margin-top: 26px;

  h2 {
    font-size: 16px;
    margin: 0 0 10px;
  }

  ul {
    margin: 0;
    padding-left: 20px;
    font-size: 13px;
    line-height: 1.95;
    color: var(--text-color-regular, #606266);
  }
}

.nva-sources {
  margin-top: 26px;

  h2 {
    font-size: 16px;
    margin: 0 0 10px;
  }

  pre {
    margin: 0;
    max-height: 420px;
    overflow: auto;
    padding: 12px;
    border-radius: 6px;
    font-size: 12px;
    line-height: 1.6;
    background: var(--bg-color-page, #f9fafb);
  }
}

.nva-tabs {
  display: flex;
  gap: 8px;
  margin-bottom: 10px;

  button {
    padding: 6px 12px;
    border: 1px solid var(--border-color, #dcdfe6);
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
      border-color: #b45309;
      color: #b45309;
      background: #fffbeb;
    }
  }
}
</style>
