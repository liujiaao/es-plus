<template>
  <div class="wf" data-testid="workflows-page">
    <header class="wf-hero">
      <span class="wf-badge">S3 工具工作流</span>
      <h1>12 次真调用：从探测到出页，再到体检、接管与拆装</h1>
      <p>
        本页每一步的入参与出参都来自 <strong>真 handler</strong>（不是示例文案）：生成器把冻结入参按工具
        自己的 zod shape 解析后调用，记录逐字节落盘，<code>npm run check:ai-workflows</code> 重算并比对。
        覆盖 <strong>{{ data.zeroCaseTools.length }} 个此前只有文档、没有页面演示的工具</strong>，外加
        <code>generate_crud</code> 的 <strong>surfaces 路径</strong>（现有案例走的是 CLI 的 NL→config 路径）。
      </p>
      <p class="wf-claim">
        <span class="wf-chip">claim: compile</span>
        「出参是真实调用结果」由守卫机械证明；<strong>模型那一步不在记录里</strong> —— W1 纠偏用的
        「改写后的配置」是冻结输入（<code>refine_config</code> 本身不调模型）。
      </p>
      <ul class="wf-tools" data-testid="workflows-tools">
        <li v-for="t in data.tools" :key="t" :class="{ zero: data.zeroCaseTools.includes(t) }">
          <code>{{ t }}</code>
        </li>
      </ul>
    </header>

    <section v-for="wf in data.workflows" :key="wf.id" class="wf-flow" :data-testid="'workflow-' + wf.id">
      <h2>
        <span class="wf-id">{{ wf.id.toUpperCase() }}</span>
        {{ wf.title }}
        <span class="wf-count">{{ wf.steps.length }} 步</span>
      </h2>
      <p class="wf-oneliner">{{ wf.oneLiner }}</p>
      <ol class="wf-chain">
        <li v-for="t in wf.tools" :key="t"><code>{{ t }}</code></li>
      </ol>

      <article
        v-for="(step, i) in wf.steps"
        :key="step.tool"
        class="wf-step"
        :class="{ 'is-error': !step.ok }"
        :data-testid="`workflow-${wf.id}-step-${i}`"
      >
        <header class="wf-step-head">
          <span class="wf-step-no">{{ i + 1 }}</span>
          <code class="wf-step-tool">{{ step.tool }}</code>
          <span class="wf-step-state" :class="step.ok ? 'ok' : 'err'">
            {{ step.ok ? 'ok' : 'expected error' }}
          </span>
          <span class="wf-step-bytes">{{ step.bytes }} B{{ step.truncated ? ' · 预览截断' : '' }}</span>
        </header>
        <p v-if="step.note" class="wf-step-note">{{ step.note }}</p>
        <details class="wf-step-args">
          <summary>入参</summary>
          <pre>{{ pretty(step.args) }}</pre>
        </details>
        <pre class="wf-step-out" :data-testid="`workflow-${wf.id}-out-${i}`">{{ step.result }}</pre>
        <p v-if="step.truncated" class="wf-step-more">
          完整出参 {{ step.bytes }} 字节；此处是前 {{ step.result.length }} 字符的预览。
        </p>
      </article>
    </section>

    <footer class="wf-foot">
      数据单源：<code>docs/cases/generated/ai-workflows.js</code>（由
      <code>scripts/gen-ai-workflows.mjs</code> 生成，<code>npm run check:ai-workflows</code> 重算并逐字节比对，
      确定性、覆盖、预期失败与三站接线都在同一条守卫里）。
    </footer>
  </div>
</template>

<script setup>
import { AI_WORKFLOWS as data } from '@/cases/generated/ai-workflows.js'

const pretty = (value) => JSON.stringify(value, null, 2)
// 逐页 title / description：单一来源在 utils/page-meta.ts（check:page-meta 静态核对）。
// 放在脚本末尾不影响求值 —— ESM 的 import 声明会被提升，这样文件级注释与 import 分组都不被打断。
import { usePageMeta } from '@/utils/page-meta'

usePageMeta('ai-gallery-workflows')
</script>

<style scoped>
.wf {
  max-width: 1040px;
  margin: 0 auto;
  padding: 24px 16px 64px;
}
.wf-badge {
  display: inline-block;
  font-size: 12px;
  padding: 2px 10px;
  border-radius: 10px;
  background: var(--es-info-tint);
  color: var(--es-link);
}
.wf-hero h1 {
  margin: 12px 0 8px;
  font-size: 26px;
}
.wf-hero p {
  color: var(--es-text-regular);
  line-height: 1.7;
  margin: 8px 0;
}
.wf-claim {
  background: var(--es-bg-subtle);
  border-left: 3px solid #9ca3af;
  padding: 8px 12px;
}
.wf-chip {
  display: inline-block;
  margin-right: 8px;
  font-size: 12px;
  padding: 1px 8px;
  border-radius: 8px;
  background: var(--es-warning-tint);
  color: var(--es-warning-text);
}
.wf-tools {
  display: flex;
  flex-wrap: wrap;
  gap: 6px;
  list-style: none;
  padding: 0;
  margin: 12px 0;
}
.wf-tools li {
  font-size: 12px;
  padding: 2px 8px;
  border: 1px solid #e5e7eb;
  border-radius: 6px;
  color: var(--es-text-tertiary);
}
.wf-tools li.zero {
  border-color: var(--es-brand-primary-light);
  color: var(--es-link-hover);
  background: var(--es-info-tint);
}
.wf-flow {
  margin-top: 36px;
  border-top: 1px solid #e5e7eb;
  padding-top: 20px;
}
.wf-flow h2 {
  font-size: 19px;
  margin: 0 0 6px;
}
.wf-id {
  font-size: 12px;
  color: var(--es-text-tertiary);
  margin-right: 8px;
}
.wf-count {
  font-size: 12px;
  color: var(--es-text-secondary);
  margin-left: 8px;
}
.wf-oneliner {
  color: var(--es-text-regular);
  margin: 4px 0 12px;
}
.wf-chain {
  display: flex;
  flex-wrap: wrap;
  gap: 8px;
  list-style: none;
  padding: 0;
  margin: 0 0 16px;
}
.wf-chain li {
  font-size: 12px;
  color: var(--es-text-regular);
}
.wf-chain li:not(:last-child)::after {
  content: ' →';
  color: var(--es-text-secondary);
}
.wf-step {
  border: 1px solid #e5e7eb;
  border-radius: 8px;
  padding: 12px 14px;
  margin-bottom: 14px;
  background: var(--es-bg);
}
.wf-step.is-error {
  border-color: #fca5a5;
  background: var(--es-bg);
}
.wf-step-head {
  display: flex;
  align-items: center;
  gap: 10px;
  flex-wrap: wrap;
}
.wf-step-no {
  width: 20px;
  height: 20px;
  line-height: 20px;
  text-align: center;
  border-radius: 50%;
  background: var(--es-fill);
  color: var(--es-text-regular);
  font-size: 12px;
}
.wf-step-tool {
  font-weight: 600;
  color: var(--es-text-primary);
}
.wf-step-state {
  font-size: 11px;
  padding: 1px 8px;
  border-radius: 8px;
}
.wf-step-state.ok {
  background: var(--es-success-tint);
  color: var(--es-success-text);
}
.wf-step-state.err {
  background: var(--es-danger-tint);
  color: var(--es-danger-text);
}
.wf-step-bytes {
  margin-left: auto;
  font-size: 11px;
  color: var(--es-text-secondary);
}
.wf-step-note {
  color: var(--es-text-regular);
  font-size: 13px;
  margin: 8px 0;
}
.wf-step-args summary {
  cursor: pointer;
  font-size: 12px;
  color: var(--es-text-tertiary);
}
.wf-step-out,
.wf-step-args pre {
  background: #0f172a;
  color: #e2e8f0;
  border-radius: 6px;
  padding: 10px 12px;
  font-size: 12px;
  line-height: 1.55;
  overflow: auto;
  max-height: 320px;
  white-space: pre-wrap;
  word-break: break-word;
}
.wf-step-args pre {
  max-height: 220px;
  margin: 8px 0 10px;
}
.wf-step-more {
  font-size: 11px;
  color: var(--es-text-secondary);
  margin: 6px 0 0;
}
.wf-foot {
  margin-top: 32px;
  font-size: 12px;
  color: var(--es-text-tertiary);
  line-height: 1.7;
}
</style>
