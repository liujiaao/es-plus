<template>
  <div class="tri-card">
    <div class="tri-head">
      <span class="tri-tag">{{ t('home.triRender.tag') }}</span>
      <span class="tri-hint">{{ t('home.triRender.hint') }}</span>
      <button
        type="button"
        class="tri-reset"
        :disabled="!dirty"
        :aria-label="t('home.triRender.reset')"
        @click="reset"
      >
        {{ t('home.triRender.reset') }}
      </button>
    </div>

    <div class="tri-fields">
      <label v-for="f in FIELDS" :key="f.key" class="tri-field">
        <span class="tri-field-label">{{ t(f.labelKey) }}</span>
        <input
          v-model="draft[f.key]"
          class="tri-input"
          type="text"
          :maxlength="f.maxlength"
          :aria-label="t(f.labelKey)"
        />
      </label>
    </div>

    <div class="tri-panes">
      <!-- 左边是输入：同一份配置（target 之外的字节三端完全一致） -->
      <div class="tri-pane">
        <div class="tri-pane-head">
          <span class="tri-pane-title">{{ t('home.triRender.configTitle') }}</span>
          <span class="tri-pane-meta">{{ configLineCount }} {{ t('home.triRender.lines') }}</span>
        </div>
        <pre class="tri-code tri-code--config"><code>{{ configJson }}</code></pre>
      </div>

      <!-- 右边是产物：每个渲染端贴「随输入变的那三行」+ 本端独有的 import 一行 -->
      <div class="tri-pane">
        <div class="tri-pane-head">
          <span class="tri-pane-title">{{ t('home.triRender.targetsTitle') }}</span>
        </div>
        <div v-for="tg in targets" :key="tg.key" class="tri-target">
          <div class="tri-target-head">
            <span class="tri-target-name">{{ tg.label }}</span>
            <span v-if="tg.error" class="tri-target-meta is-error">{{ t('home.triRender.error') }}</span>
            <span v-else class="tri-target-meta">
              {{ t('home.triRender.onlyHere') }} {{ tg.diffLines.length }} / {{ tg.total }}
              {{ t('home.triRender.lines') }}
            </span>
          </div>
          <div class="tri-code tri-code--target">
            <template v-if="!tg.error">
              <div v-for="line in tg.sync" :key="line.no" class="tri-line">
                <span class="tri-ln">{{ line.no }}</span>
                <span class="tri-src"><span
                  v-for="(seg, i) in line.segments"
                  :key="i"
                  :class="seg.mark ? 'tri-hit' : null"
                >{{ seg.text }}</span></span>
              </div>
              <div class="tri-line tri-line--pkg">
                <span class="tri-ln">→</span>
                <span class="tri-src"><span>{{ tg.pkgPrefix }}</span><span class="tri-hit">{{ tg.pkgSpec }}</span></span>
              </div>
            </template>
            <div v-else class="tri-line">
              <span class="tri-ln">!</span>
              <span class="tri-src is-error">{{ tg.error }}</span>
            </div>
          </div>
        </div>
      </div>
    </div>

    <p class="tri-foot">{{ t('home.triRender.foot') }}</p>
  </div>
</template>

<script setup>
/**
 * 首屏「改配置 → 三端变」小部件（路线图 2.3）。
 *
 * 为什么不是一张截图、也不是一段手写的对比代码：这个产品的卖点是「一份 JSON，
 * 三个渲染端」，能证明它的只有**真的跑一遍生成器**。这里直接调用站点自己的
 * `@es-plus/shared`（浏览器 façade，与 MCP / CLI 是同一份实现），把三份 SFC 现算出来。
 *
 * 每个渲染端只贴四行：三行是**随左侧输入变化**的（生成器从配置里搬过来的
 * 接口地址 / 查询字段 / 表格列，行号是本端产物里的真实行号），第四行是本端唯一的
 * import —— 三份产物 130+ 行里只有这一行不同，那句话才立得住。
 *
 * 早先版本只贴「本端独有的行」，结果改输入时右侧一动不动：独有行是 import，
 * 而 import 只由渲染端决定，与配置无关。演示必须让输入和输出在同一屏里联动。
 */
import { computed, reactive, watch } from 'vue'
import { useI18n } from 'vue-i18n'
import { generateFromConfig } from '@es-plus/shared'

const { t } = useI18n()

/**
 * 三个可编辑字段 —— 与路线图 2.3 的验收口径一致（「可改 3 个字段」）。
 * 三个都落在生成器**真正写进产物**的键上：apiUrl 进 `apiParams.url`，
 * 查询字段名进 formItems 的 label，表格列名进 columns 的 label。
 * （`title` 不进 SFC，试过 —— 改了只有 JSON 变，右边三端毫无反应。）
 */
const FIELDS = [
  { key: 'apiUrl', labelKey: 'home.triRender.apiUrl', maxlength: 28 },
  { key: 'queryLabel', labelKey: 'home.triRender.queryLabel', maxlength: 12 },
  { key: 'columnLabel', labelKey: 'home.triRender.columnLabel', maxlength: 12 },
]

const defaults = computed(() => ({
  apiUrl: t('home.triRender.defaultApiUrl'),
  queryLabel: t('home.triRender.defaultQueryLabel'),
  columnLabel: t('home.triRender.defaultColumnLabel'),
}))

const draft = reactive({ ...defaults.value })

const dirty = computed(() => FIELDS.some((f) => draft[f.key] !== defaults.value[f.key]))
const reset = () => Object.assign(draft, defaults.value)

/**
 * 切语言时默认值跟着变（否则英文页里躺着三个中文默认值，看着像半成品）。
 * 只同步「用户没动过」的字段：已经敲进去的内容不因为切换语言被清掉。
 */
watch(defaults, (next, prev) => {
  for (const f of FIELDS) {
    if (!draft[f.key] || draft[f.key] === prev[f.key]) draft[f.key] = next[f.key]
  }
})

/** 渲染端清单：与三站清单同一组称呼（顶栏切换器、页脚、案例卡都是这三个名字） */
const TARGETS = [
  { key: 'vue3', label: 'Vue 3 · Element Plus' },
  { key: 'vue2', label: 'Vue 2 · Element UI' },
  { key: 'antdv', label: 'Vue 3 · Ant Design Vue' },
]

const pick = (value, fallback) => (String(value || '').trim() || fallback)

/** 输入配置。`mode: 'sfc'` 而不是 'schema'：schema 模式下三端产物逐字节相同 ——
 *  那正是卖点，但首屏里看起来像「什么都没变」。sfc 模式才现出三端那一行 import 的差异。
 *
 * 两个字段刻意一「只查询」一「只表格」（inQuery / inTable 反向），这样两个 label
 * 分别只落在 formItems 和 columns 里，三行示例互不重叠。 */
const config = computed(() => {
  const d = defaults.value
  return {
    name: 'UserManage',
    apiUrl: pick(draft.apiUrl, d.apiUrl),
    mode: 'sfc',
    actions: ['add', 'edit', 'delete'],
    fields: [
      {
        prop: 'userName',
        label: pick(draft.queryLabel, d.queryLabel),
        formtype: 'Input',
        inQuery: true,
        inTable: false,
        querySpan: 8,
      },
      {
        prop: 'status',
        label: pick(draft.columnLabel, d.columnLabel),
        formtype: 'Input',
        inQuery: false,
        inTable: true,
        formSpan: 12,
      },
    ],
  }
})

const configJson = computed(() => JSON.stringify(config.value, null, 2))
const configLineCount = computed(() => configJson.value.split('\n').length)

/** 把一行按「命中的输入值」切成片段，命中段交给 .tri-hit 高亮 —— 改一个字，
 *  三个面板里同时亮起同一处，联动是看得见的，不是文案说的。 */
const toSegments = (line, values) => {
  const spans = []
  for (const value of values) {
    for (let at = line.indexOf(value); at >= 0; at = line.indexOf(value, at + value.length)) {
      spans.push([at, at + value.length])
    }
  }
  spans.sort((a, b) => a[0] - b[0])

  const merged = []
  for (const span of spans) {
    const last = merged[merged.length - 1]
    if (last && span[0] <= last[1]) last[1] = Math.max(last[1], span[1])
    else merged.push([...span])
  }

  const segments = []
  let at = 0
  for (const [start, end] of merged) {
    if (start > at) segments.push({ text: line.slice(at, start), mark: false })
    segments.push({ text: line.slice(start, end), mark: true })
    at = end
  }
  if (at < line.length) segments.push({ text: line.slice(at), mark: false })
  return segments
}

/**
 * 三份 SFC。生成失败不吞：把错误原文贴在该渲染端那一格（配置校验错误对读者
 * 同样是有效信息 —— 它们恰好说明了「配置是受约束的」）。
 */
const targets = computed(() => {
  // 只认这三处：配置里的其它字符串（name / mode）不会出现在产物里，拿去匹配只会误命中
  const values = [config.value.apiUrl, ...config.value.fields.map((f) => f.label)]
  const codes = {}
  for (const tg of TARGETS) {
    try {
      codes[tg.key] = generateFromConfig({ ...config.value, target: tg.key }).code.split('\n')
    } catch (error) {
      codes[tg.key] = null
      codes[`${tg.key}:error`] = String(error?.message || error)
    }
  }

  return TARGETS.map((tg) => {
    const lines = codes[tg.key]
    if (!lines) {
      return { ...tg, error: codes[`${tg.key}:error`], diffLines: [], total: 0, sync: [] }
    }

    // 输入值在本端产物里的首次落点：一个字段一行，行号取本端的真实行号。
    // 按行号排序 —— 读起来才像一段代码摘录，而不是三个字段的查询结果。
    const sync = []
    for (const value of values) {
      const at = lines.findIndex((line) => line.includes(value))
      if (at >= 0 && !sync.some((s) => s.no === at + 1)) {
        sync.push({ no: at + 1, segments: toSegments(lines[at], values) })
      }
    }
    sync.sort((a, b) => a.no - b.no)

    // 本端独有的行：只用于计数与那一行 import
    const others = new Set(
      TARGETS.filter((o) => o.key !== tg.key && codes[o.key])
        .flatMap((o) => codes[o.key])
        .map((line) => line.trim())
        .filter(Boolean)
    )
    const diffLines = lines.filter((line) => line.trim() && !others.has(line.trim()))

    const pkgLine = diffLines.find((line) => /from\s+['"]@es-plus\//.test(line)) || ''
    const pkgSpec = (pkgLine.match(/from\s+['"]([^'"]+)['"]/) || [])[1] || ''

    return {
      ...tg,
      error: '',
      diffLines,
      total: lines.length,
      sync,
      pkgPrefix: pkgSpec ? 'import … from ' : '',
      pkgSpec: pkgSpec ? `'${pkgSpec}'` : '',
    }
  })
})
</script>

<style lang="scss" scoped>
.tri-card {
  display: flex;
  flex-direction: column;
  gap: 14px;
  padding: 18px;
  border: 1px solid var(--es-border);
  border-radius: var(--es-radius-sm);
  background: var(--es-bg);
  font-family: var(--es-font-sans);
  /* 首屏在 1200px 以下整段居中（数值/文案居中是合理的），但代码面里的字段名
     居中会读成标题 —— 部件内部一律左对齐 */
  text-align: left;
  /* 命中高亮：亮色压蓝底，暗色压浅蓝底（.dark 覆盖在下方） */
  --tri-hit-bg: rgba(59, 130, 246, 0.18);
  --tri-hit-fg: #1d4ed8;
}

/* 深色高亮：`.dark` 挂在 <html> 上，scoped 样式够不着，只能走 :global ——
   所以整条选择器（含 .tri-card）一起写成全局的，否则 Vue 的 scoped 插件会把
   `.tri-card` 丢掉，只留一个 `.dark { --tri-hit-bg }` 的悬空声明（踩过）。 */
:global(.dark .tri-card) {
  --tri-hit-bg: rgba(96, 165, 250, 0.26);
  --tri-hit-fg: #dbeafe;
}

.tri-head {
  display: flex;
  align-items: center;
  gap: 10px;
  flex-wrap: wrap;
}

.tri-tag {
  padding: 2px 8px;
  border-radius: 4px;
  background: var(--es-brand-primary);
  color: #fff;
  font-size: var(--es-text-xs);
  font-weight: 600;
  white-space: nowrap;
}

.tri-hint {
  flex: 1 1 200px;
  min-width: 0;
  color: var(--es-text-secondary);
  font-size: var(--es-text-sm);
  line-height: 1.5;
}

.tri-reset {
  padding: 4px 12px;
  border: 1px solid var(--es-border);
  border-radius: 6px;
  background: var(--es-bg);
  color: var(--es-text-primary);
  font-family: inherit;
  font-size: var(--es-text-xs);
  cursor: pointer;
  transition: border-color var(--es-duration-base) var(--es-ease), color var(--es-duration-base) var(--es-ease);

  &:hover:not(:disabled) {
    border-color: var(--es-brand-primary);
    color: var(--es-brand-primary);
  }

  &:disabled {
    opacity: 0.45;
    cursor: default;
  }
}

.tri-fields {
  display: grid;
  grid-template-columns: repeat(3, minmax(0, 1fr));
  gap: 10px;
}

.tri-field {
  display: flex;
  flex-direction: column;
  gap: 5px;
  min-width: 0;
}

.tri-field-label {
  color: var(--es-text-secondary);
  font-size: var(--es-text-xs);
}

.tri-input {
  width: 100%;
  padding: 7px 10px;
  border: 1px solid var(--es-border);
  border-radius: 6px;
  background: var(--es-bg);
  color: var(--es-text-primary);
  font-family: inherit;
  font-size: var(--es-text-sm);
  line-height: 1.4;

  &:focus {
    border-color: var(--es-brand-primary);
  }
}

.tri-panes {
  display: grid;
  grid-template-columns: minmax(0, 0.78fr) minmax(0, 1.22fr);
  gap: 14px;
  align-items: start;
}

.tri-pane {
  min-width: 0;
}

.tri-pane-head {
  display: flex;
  align-items: baseline;
  justify-content: space-between;
  gap: 8px;
  margin-bottom: 6px;
}

.tri-pane-title {
  color: var(--es-text-primary);
  font-size: var(--es-text-xs);
  font-weight: 600;
}

.tri-pane-meta {
  color: var(--es-text-secondary);
  font-size: var(--es-text-xs);
  white-space: nowrap;
}

/* 代码面：跟随主题（亮色 GitHub 风 / 暗色 one-dark），与全站代码块同一组 token。
   高度收在首屏里 —— 首屏不该被滚动条占满。 */
.tri-code {
  margin: 0;
  padding: 10px 12px;
  border-radius: 6px;
  background: var(--es-doc-code-block-bg, var(--es-code-bg));
  color: var(--es-doc-code-block-text, var(--es-text-primary));
  font-family: var(--es-font-mono);
  font-size: 11.5px;
  line-height: 1.65;
  white-space: pre;
}

/* 与右列三端面板大致等高：JSON 是输入，读得全才看得出「改的是同一份配置」 */
.tri-code--config {
  max-height: 300px;
  overflow: auto;
}

.tri-code--target {
  padding: 8px 10px;
}

.tri-target + .tri-target {
  margin-top: 10px;
}

.tri-target-head {
  display: flex;
  align-items: baseline;
  justify-content: space-between;
  gap: 8px;
  margin-bottom: 4px;
}

.tri-target-name {
  color: var(--es-text-primary);
  font-size: var(--es-text-xs);
  font-weight: 600;
}

.tri-target-meta {
  color: var(--es-text-secondary);
  font-size: var(--es-text-xs);
  white-space: nowrap;

  &.is-error {
    color: var(--es-danger);
  }
}

/* 行号槽 + 源码：flex 两列，长行在这里换行而不是横向滚动 */
.tri-line {
  display: flex;
  align-items: baseline;
  gap: 8px;
  min-width: 0;
}

.tri-ln {
  flex: 0 0 auto;
  width: 22px;
  color: var(--es-text-secondary);
  font-variant-numeric: tabular-nums;
  text-align: right;
  user-select: none;
}

.tri-src {
  flex: 1 1 auto;
  min-width: 0;
  white-space: pre-wrap;
  overflow-wrap: anywhere;

  &.is-error {
    color: var(--es-danger);
  }
}

.tri-hit {
  padding: 0 1px;
  border-radius: 2px;
  background: var(--tri-hit-bg);
  color: var(--tri-hit-fg);
}

/* 本端独有的那一行 import：与上面三行之间拉开一点距离，说明它是另一个集合 */
.tri-line--pkg {
  margin-top: 4px;
  padding-top: 5px;
  border-top: 1px dashed var(--es-border);
}

.tri-foot {
  margin: 0;
  color: var(--es-text-secondary);
  font-size: var(--es-text-xs);
  line-height: 1.6;
}

@media (max-width: 992px) {
  .tri-panes {
    grid-template-columns: minmax(0, 1fr);
  }

  /* 单列时右列已经很长了，输入面板不必再抢屏 */
  .tri-code--config {
    max-height: 168px;
  }
}

@media (max-width: 560px) {
  .tri-card {
    padding: 14px;
  }

  .tri-fields {
    grid-template-columns: minmax(0, 1fr);
  }
}
</style>
