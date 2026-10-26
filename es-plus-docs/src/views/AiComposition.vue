<template>
  <div class="cg" data-testid="composition-page">
    <header class="cg-hero">
      <span class="cg-badge">S2 组合画廊</span>
      <h1>同一份意图表，三端一份配置</h1>
      <p>
        18 例组合语料 = <strong>6 个逻辑案例 × 3 端</strong>。左侧是「你写的」意图表
        <code>surfaces</code>，右侧是 <code>composeCrudConfig</code> 归并出的
        <strong>成员关系</strong>与生成产物。组合事实由 <code>compositionFacts()</code> 计算 ——
        与门禁 <code>npm run check:composition</code> 是<strong>同一个函数</strong>。
      </p>
      <p class="cg-claim">
        <span class="cg-chip">claim: measure + compile</span>
        本页不运行生成的页面；「三端可交互」的主张在 S1 案例里由 e2e 承担。这里只证明两件事：
        度量对得上（每个字段在几个面出现）、产物编译得过。
      </p>
    </header>

    <div class="cg-controls">
      <label>
        形状
        <select v-model="shape" data-testid="composition-shape" @change="onShapeChange">
          <option v-for="s in shapes" :key="s" :value="s">{{ s }}</option>
        </select>
      </label>
      <label>
        案例
        <select v-model="baseId" data-testid="composition-base">
          <option v-for="b in basesOfShape" :key="b.baseId" :value="b.baseId">{{ b.name }}（{{ b.baseId }}）</option>
        </select>
      </label>
      <label>
        渲染端
        <select v-model="target" data-testid="composition-target">
          <option v-for="t in targets" :key="t" :value="t">{{ t }}</option>
        </select>
      </label>
    </div>

    <template v-if="current">
      <div class="cg-grid">
        <section class="cg-panel">
          <h2>意图表 surfaces</h2>
          <p class="cg-sub"><code>{{ current.name }}</code> · <code>{{ current.apiUrl }}</code></p>
          <div v-for="face in presentFaces" :key="face" class="cg-face">
            <h3>{{ FACE_LABEL[face] }} <span class="cg-count">{{ surfaceFields(face).length }}</span></h3>
            <ul class="cg-fields">
              <li
                v-for="f in surfaceFields(face)"
                :key="face + ':' + propOf(f)"
                :data-testid="'composition-field-' + propOf(f)"
                :data-faces="facesOf(propOf(f))"
              >
                <code>{{ propOf(f) }}</code>
                <span v-if="f.label" class="cg-label">{{ f.label }}</span>
                <em v-if="f.formtype">{{ f.formtype }}</em>
                <span class="cg-faces" :class="'faces-' + facesOf(propOf(f))">{{ faceBadge(face, propOf(f)) }}</span>
              </li>
            </ul>
          </div>
        </section>

        <section class="cg-panel">
          <h2>
            组合事实
            <span
              class="cg-verdict"
              :class="current.factsMatchExpect ? 'ok' : 'bad'"
              data-testid="composition-verdict"
            >{{ current.factsMatchExpect ? '全部命中' : '有偏差' }}</span>
          </h2>
          <p class="cg-sub">语料声明（expect）与本次组合结果逐项对照</p>
          <table class="cg-table">
            <thead><tr><th>事实</th><th>语料声明</th><th>实际</th><th /></tr></thead>
            <tbody>
              <tr v-for="row in current.checks" :key="row.key" :data-testid="'composition-check-' + row.key">
                <td>{{ row.label }}</td>
                <td><code>{{ brief(row.want) }}</code></td>
                <td><code>{{ brief(row.got) }}</code></td>
                <td :class="row.pass ? 'ok' : 'bad'">{{ row.pass ? '✓' : '✗' }}</td>
              </tr>
            </tbody>
          </table>

          <template v-if="current.facts.membership">
            <h3>成员关系：同一个字段在几个面出现</h3>
            <table class="cg-table">
              <thead><tr><th>字段</th><th v-for="f in MEMBER_FACES" :key="f">{{ f }}</th></tr></thead>
              <tbody>
                <tr v-for="(faces, prop) in current.facts.membership" :key="prop">
                  <td><code>{{ prop }}</code></td>
                  <td v-for="f in MEMBER_FACES" :key="f" :class="faces.includes(f) ? 'ok' : 'muted'">
                    {{ faces.includes(f) ? '✓' : '·' }}
                  </td>
                </tr>
              </tbody>
            </table>
          </template>
        </section>
      </div>

      <section class="cg-panel">
        <h2>三端对照 <span class="cg-chip">{{ base.shape }}</span></h2>
        <p class="cg-note" data-testid="composition-target-note">{{ base.note }}</p>
        <table class="cg-table">
          <thead>
            <tr><th>渲染端</th><th>导入的渲染端包</th><th>组合产物</th><th>宿主装配块</th><th>产物字节</th><th>生成提示</th></tr>
          </thead>
          <tbody>
            <tr v-for="t in targets" :key="t">
              <td><code>{{ t }}</code></td>
              <td><code>{{ base.rendererByTarget[t] || '—' }}</code></td>
              <td :class="base.generatedEqualIgnoringTargetImports ? 'ok' : 'bad'">
                {{ base.generatedEqualIgnoringTargetImports ? '三端一致' : '有差异' }}
              </td>
              <td :class="base.kind === 'page' ? 'muted' : base.hostEntryEqualIgnoringTargetImports ? 'ok' : 'muted'">
                {{ base.kind === 'page' ? '—' : base.hostEntryEqualIgnoringTargetImports ? '三端一致' : '按端不同' }}
              </td>
              <td>{{ base.codeBytesByTarget[t] }}</td>
              <td>{{ (base.warningsByTarget[t] || []).length }}</td>
            </tr>
          </tbody>
        </table>
        <details v-if="(base.warningsByTarget[target] || []).length" class="cg-warnings" data-testid="composition-warnings">
          <summary>生成提示 {{ (base.warningsByTarget[target] || []).length }} 条 · 自动归一，不是错误</summary>
          <ul>
            <li v-for="(w, i) in base.warningsByTarget[target]" :key="i">{{ w }}</li>
          </ul>
        </details>
        <p class="cg-sub cg-hint">
          「三端一致」的判据是<b>忽略渲染端包名后逐字节相同</b>：<code>@es-plus/vue3</code> /
          <code>@es-plus/vue2</code> / <code>@es-plus/adapter-antdv</code> 是唯一允许的端间差异。
          「生成提示」里的 <code>自动归一</code> 来自弹窗表单项：输入只给了部分键，
          生成器按顶层字段确定性补齐（可重放），不是失败。
        </p>
      </section>

      <section class="cg-panel">
        <h2>
          生成产物
          <span class="cg-sub">{{ current.product.kind === 'page' ? 'pageSchema' : 'dialog composable' }}</span>
        </h2>
        <p class="cg-actions">
          <button type="button" @click="showCode = !showCode">{{ showCode ? '收起源码' : '展开源码' }}</button>
          <button type="button" @click="downloadProduct">下载产物</button>
        </p>
        <template v-if="current.product.kind === 'page'">
          <h3>pageSchema</h3>
          <pre data-testid="composition-page-schema">{{ pretty(current.product.pageSchema) }}</pre>
          <template v-if="showCode">
            <h3>生成源码</h3>
            <pre>{{ current.product.code }}</pre>
          </template>
        </template>
        <template v-else>
          <div v-for="f in current.product.fragments" :key="f.name">
            <h3>{{ f.name }} <em>{{ f.lang }}</em></h3>
            <pre>{{ f.code }}</pre>
          </div>
          <template v-if="showCode && current.product.hostEntry">
            <h3>宿主装配块（前门预检，按端不同）</h3>
            <pre>{{ current.product.hostEntry.code }}</pre>
          </template>
        </template>
      </section>
    </template>

    <footer class="cg-foot">
      数据单源：<code>docs/cases/generated/composition-gallery.js</code>（由
      <code>scripts/gen-composition-gallery.mjs</code> 生成，<code>npm run check:composition-gallery</code>
      重算并逐字节比对）。语料：<code>__tests__/golden/composition/*.json</code>。
    </footer>
  </div>
</template>

<script setup>
/**
 * S2 组合画廊（主文档站 / es-pc 共用同一份字节）。
 *
 * 页面刻意只做「渲染」：组合事实、逐项对照、产物都是生成器算好的（与评测同一个函数）。
 * 浏览器里不再重算任何判据 —— 否则同一件事会有第三份实现，而与评测漂移时页面仍会
 * 自信地显示「全绿」。三站同形：不引入 UI 库组件，全部用原生控件与本地 CSS 变量。
 */
import { computed, ref } from 'vue'
import { COMPOSITION_GALLERY } from '@/cases/generated/composition-gallery.js'

const model = COMPOSITION_GALLERY
const shapes = model.shapes
const targets = model.targets
const FACE_ORDER = ['query', 'table', 'form', 'dialog']
const FACE_LABEL = { query: '查询条件', table: '列表列', form: '表单', dialog: '弹窗' }
const MEMBER_FACES = ['query', 'table', 'form']

const shape = ref('full')
const basesOfShape = computed(() => model.bases.filter((b) => b.shape === shape.value))
const baseId = ref(basesOfShape.value[0]?.baseId ?? '')
const target = ref('vue3')
const showCode = ref(false)

const base = computed(
  () => model.bases.find((b) => b.baseId === baseId.value) ?? basesOfShape.value[0] ?? null
)
const current = computed(() =>
  base.value ? model.cases.find((c) => c.baseId === base.value.baseId && c.target === target.value) ?? null : null
)
const presentFaces = computed(() =>
  FACE_ORDER.filter((f) => (current.value?.surfaces?.[f] ?? []).length > 0)
)

function onShapeChange() {
  baseId.value = basesOfShape.value[0]?.baseId ?? ''
}

const propOf = (f) => (typeof f === 'string' ? f : f.prop)
const surfaceFields = (face) => current.value?.surfaces?.[face] ?? []

/** 字段出现在几个面：有表形状读组合事实（归并后），片段形状按 surfaces 里实际的面数。 */
function facesOf(prop) {
  const membership = current.value?.facts?.membership
  if (membership && membership[prop]) return membership[prop].length
  return MEMBER_FACES.filter((f) => surfaceFields(f).some((x) => propOf(x) === prop)).length
}
function faceBadge(face, prop) {
  if (face === 'dialog') return '弹窗'
  const n = facesOf(prop)
  return n === 3 ? '三面' : n === 2 ? '两面' : '单面'
}

/** 紧凑展示：数组用「, 」、对象逐项展开 —— 成员关系读起来像 `name: query+table+form`。 */
function brief(v) {
  if (v === null || v === undefined) return '—'
  if (typeof v === 'boolean') return v ? '是' : '否'
  if (Array.isArray(v)) return v.length ? v.join(', ') : '（空）'
  if (typeof v === 'object') {
    return Object.entries(v)
      .map(([k, x]) => `${k}: ${Array.isArray(x) ? x.join('+') : String(x)}`)
      .join('; ')
  }
  return String(v)
}
const pretty = (v) => JSON.stringify(v, null, 2)

function downloadProduct() {
  const product = current.value?.product
  if (!product) return
  const [name, text] =
    product.kind === 'page'
      ? [`${current.value.id}.pageSchema.json`, pretty(product.pageSchema)]
      : [`${current.value.id}.fragments.txt`, product.fragments.map((f) => `// ${f.name}\n${f.code}`).join('\n')]
  const url = URL.createObjectURL(new Blob([text], { type: 'text/plain' }))
  const a = document.createElement('a')
  a.href = url
  a.download = name
  a.click()
  URL.revokeObjectURL(url)
}
</script>

<style scoped>
.cg {
  --cg-border: #e5e7eb;
  --cg-bg: #ffffff;
  --cg-panel: #f9fafb;
  --cg-text: #1f2937;
  --cg-muted: #6b7280;
  --cg-purple: #6f42c1;
  max-width: 1240px;
  margin: 0 auto;
  padding: 8px clamp(12px, 3vw, 32px) 48px;
  color: var(--cg-text);
}

.cg-hero {
  padding: 16px 0;
  border-bottom: 1px solid var(--cg-border);
}
.cg-hero h1 {
  font-size: 24px;
  margin: 8px 0 10px;
}
.cg-hero p {
  margin: 6px 0;
  line-height: 1.9;
  color: var(--cg-muted);
}
.cg-badge {
  display: inline-block;
  padding: 2px 10px;
  border-radius: 10px;
  font-size: 12px;
  color: #fff;
  background: linear-gradient(135deg, #6f42c1, #a855f7);
}
.cg-claim {
  font-size: 13px;
}
.cg-chip {
  display: inline-block;
  margin-right: 6px;
  padding: 1px 8px;
  border-radius: 8px;
  font-size: 12px;
  color: #fff;
  background: #0369a1;
}

.cg-controls {
  display: flex;
  flex-wrap: wrap;
  gap: 16px;
  padding: 14px 0;
  border-bottom: 1px solid var(--cg-border);
}
.cg-controls label {
  display: flex;
  align-items: center;
  gap: 8px;
  font-size: 13px;
  color: var(--cg-muted);
}
.cg-controls select {
  padding: 4px 8px;
  border: 1px solid var(--cg-border);
  border-radius: 4px;
  background: var(--cg-bg);
  color: var(--cg-text);
}

.cg-grid {
  display: grid;
  grid-template-columns: minmax(0, 1fr) minmax(0, 1.2fr);
  gap: 16px;
}
@media (max-width: 900px) {
  .cg-grid {
    grid-template-columns: minmax(0, 1fr);
  }
}

.cg-panel {
  margin-top: 16px;
  padding: 14px 16px;
  border: 1px solid var(--cg-border);
  border-radius: 8px;
  background: var(--cg-bg);
}
.cg-panel h2 {
  display: flex;
  align-items: center;
  gap: 10px;
  margin: 0 0 8px;
  font-size: 16px;
}
.cg-panel h3 {
  margin: 14px 0 6px;
  font-size: 13px;
  color: var(--cg-muted);
}
.cg-sub {
  margin: 4px 0;
  font-size: 12px;
  color: var(--cg-muted);
}
.cg-hint {
  margin-top: 8px;
  line-height: 1.7;
}
.cg-note {
  margin: 6px 0 10px;
  padding: 8px 10px;
  border-radius: 6px;
  background: var(--cg-panel);
  font-size: 13px;
  line-height: 1.7;
}

.cg-face + .cg-face {
  margin-top: 12px;
}
.cg-count {
  display: inline-block;
  min-width: 18px;
  padding: 0 6px;
  border-radius: 8px;
  font-size: 11px;
  text-align: center;
  color: var(--cg-muted);
  background: var(--cg-panel);
}
.cg-fields {
  margin: 0;
  padding: 0;
  list-style: none;
}
.cg-fields li {
  display: flex;
  align-items: center;
  flex-wrap: wrap;
  gap: 8px;
  padding: 4px 0;
  border-bottom: 1px dashed var(--cg-border);
  font-size: 13px;
}
.cg-label {
  color: var(--cg-muted);
}
.cg-fields em,
.cg-panel h3 em {
  font-style: normal;
  font-size: 11px;
  color: #0369a1;
}
.cg-faces {
  margin-left: auto;
  padding: 0 6px;
  border-radius: 8px;
  font-size: 11px;
  color: var(--cg-muted);
  background: var(--cg-panel);
}
.cg-faces.faces-2 {
  color: #0369a1;
  background: #e0f2fe;
}
.cg-faces.faces-3 {
  color: #15803d;
  background: #dcfce7;
}

.cg-table {
  width: 100%;
  border-collapse: collapse;
  font-size: 12px;
}
.cg-table th,
.cg-table td {
  padding: 5px 8px;
  border-bottom: 1px solid var(--cg-border);
  text-align: left;
  vertical-align: top;
}
.cg-table th {
  font-weight: 600;
  color: var(--cg-muted);
  background: var(--cg-panel);
}
.cg-table code {
  word-break: break-all;
}
.ok {
  color: #15803d;
}
.bad {
  color: #b91c1c;
}
.muted {
  color: #9ca3af;
}
.cg-verdict {
  padding: 1px 8px;
  border-radius: 8px;
  font-size: 12px;
  color: #fff;
  background: #6b7280;
}
.cg-verdict.ok {
  background: #15803d;
}
.cg-verdict.bad {
  background: #b91c1c;
}
.cg-warnings {
  margin: 8px 0 0;
  font-size: 12px;
  color: #b45309;
}
.cg-warnings summary {
  cursor: pointer;
}
.cg-warnings ul {
  margin: 6px 0 0;
  padding-left: 18px;
}
.cg-actions {
  display: flex;
  gap: 8px;
  margin: 6px 0;
}
.cg-actions button {
  padding: 4px 10px;
  border: 1px solid var(--cg-border);
  border-radius: 4px;
  background: var(--cg-bg);
  color: var(--cg-text);
  cursor: pointer;
}
.cg-actions button:hover {
  border-color: var(--cg-purple);
  color: var(--cg-purple);
}
pre {
  max-height: 420px;
  margin: 6px 0;
  padding: 10px 12px;
  overflow: auto;
  border-radius: 6px;
  background: #f6f8fa;
  font-size: 12px;
  line-height: 1.6;
}
.cg-foot {
  margin-top: 20px;
  padding-top: 12px;
  border-top: 1px solid var(--cg-border);
  font-size: 12px;
  color: var(--cg-muted);
  line-height: 1.8;
}
</style>
