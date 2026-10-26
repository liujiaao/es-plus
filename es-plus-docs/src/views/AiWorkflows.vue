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
  background: #eef2ff;
  color: #4338ca;
}
.wf-hero h1 {
  margin: 12px 0 8px;
  font-size: 26px;
}
.wf-hero p {
  color: #4b5563;
  line-height: 1.7;
  margin: 8px 0;
}
.wf-claim {
  background: #f9fafb;
  border-left: 3px solid #9ca3af;
  padding: 8px 12px;
}
.wf-chip {
  display: inline-block;
  margin-right: 8px;
  font-size: 12px;
  padding: 1px 8px;
  border-radius: 8px;
  background: #fff7ed;
  color: #9a3412;
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
  color: #6b7280;
}
.wf-tools li.zero {
  border-color: #bfdbfe;
  color: #1d4ed8;
  background: #eff6ff;
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
  color: #6b7280;
  margin-right: 8px;
}
.wf-count {
  font-size: 12px;
  color: #9ca3af;
  margin-left: 8px;
}
.wf-oneliner {
  color: #4b5563;
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
  color: #374151;
}
.wf-chain li:not(:last-child)::after {
  content: ' →';
  color: #9ca3af;
}
.wf-step {
  border: 1px solid #e5e7eb;
  border-radius: 8px;
  padding: 12px 14px;
  margin-bottom: 14px;
  background: #fff;
}
.wf-step.is-error {
  border-color: #fca5a5;
  background: #fffafa;
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
  background: #f3f4f6;
  color: #374151;
  font-size: 12px;
}
.wf-step-tool {
  font-weight: 600;
  color: #111827;
}
.wf-step-state {
  font-size: 11px;
  padding: 1px 8px;
  border-radius: 8px;
}
.wf-step-state.ok {
  background: #ecfdf5;
  color: #047857;
}
.wf-step-state.err {
  background: #fef2f2;
  color: #b91c1c;
}
.wf-step-bytes {
  margin-left: auto;
  font-size: 11px;
  color: #9ca3af;
}
.wf-step-note {
  color: #4b5563;
  font-size: 13px;
  margin: 8px 0;
}
.wf-step-args summary {
  cursor: pointer;
  font-size: 12px;
  color: #6b7280;
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
  color: #9ca3af;
  margin: 6px 0 0;
}
.wf-foot {
  margin-top: 32px;
  font-size: 12px;
  color: #6b7280;
  line-height: 1.7;
}
</style>
