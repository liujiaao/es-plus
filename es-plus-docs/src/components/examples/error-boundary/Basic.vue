<template>
  <div class="eb-workbench">
    <div class="eb-bar">
      <el-button size="small" type="danger" plain data-testid="eb-break-revenue" @click="breakWidget('revenue')">
        让指标卡抛错
      </el-button>
      <el-button size="small" type="danger" plain data-testid="eb-break-trend" @click="breakWidget('trend')">
        让趋势图抛错
      </el-button>
      <span class="eb-isolation">
        边界外仍然可用：
        <el-button size="small" data-testid="outside-counter" @click="outsideClicks++">
          普通按钮 · 已点 {{ outsideClicks }} 次
        </el-button>
      </span>
    </div>

    <!-- ① 自定义降级 UI：fallback 插槽拿到 { error, reset } -->
    <es-error-boundary @error="logError">
      <BrokenWidget :broken="revenueBroken" :message="REVENUE_ERROR">
        <div class="eb-widget__title">实时营收</div>
        <div class="eb-kpi">
          <strong>¥128,400</strong>
          <span class="eb-up">+12.8%</span>
        </div>
      </BrokenWidget>

      <template #fallback="{ error, reset }">
        <div class="eb-fallback" data-testid="eb-fallback">
          <p class="eb-fallback__title">指标卡已被错误边界围住</p>
          <p class="eb-fallback__msg">{{ error && error.message }}</p>
          <el-button size="small" type="primary" data-testid="eb-retry" @click="repairRevenue(reset)">
            修复数据并重试
          </el-button>
        </div>
      </template>
    </es-error-boundary>

    <!-- ② 零配置降级：只给 fallback-text；恢复走 ref.reset() -->
    <es-error-boundary
      ref="trendBoundary"
      fallback-text="趋势图已降级：数据源不可用（未提供 fallback 插槽时的默认文案）"
      @error="logError"
    >
      <BrokenWidget :broken="trendBroken" :message="TREND_ERROR">
        <div class="eb-widget__title">近 7 日趋势</div>
        <div class="eb-bars">
          <i v-for="(height, index) in [38, 52, 44, 68, 58, 76, 88]" :key="index" :style="{ height: `${height}%` }" />
        </div>
      </BrokenWidget>
    </es-error-boundary>
    <el-button v-if="trendBroken" size="small" data-testid="eb-retry-trend" @click="repairTrend">
      修复趋势图
    </el-button>

    <div class="eb-log">
      <div class="eb-log__head">error 事件（{{ logs.length }}）</div>
      <p v-if="!logs.length" class="eb-log__empty">尚未捕获到错误</p>
      <p v-for="(item, index) in logs" :key="index" class="eb-log__row" data-testid="eb-log-row">
        <code>{{ item.info }}</code>
        <span>{{ item.message }}</span>
      </p>
    </div>

    <p class="eb-note">
      <code>&lt;es-error-boundary&gt;</code> 只捕获<strong>子树</strong>在渲染 / 生命周期 / 侦听器里抛出的错误
      （自身渲染出错需要再往外包一层）。捕获后返回 <code>false</code> 阻止错误继续冒泡到
      <code>app.config.errorHandler</code>，因此故障只影响这一块，整页不会白屏。
      <code>reset()</code> 只清错误态 —— 必须先修好导致错误的数据再调用，否则重新渲染会立刻再次降级。
      与 EsTable 逐单元格 render 的 try/catch 互补：后者兜单个格子，本边界兜整棵子树。
    </p>
  </div>
</template>

<script setup lang="ts">
import { defineComponent, h, ref } from 'vue'
import { EsErrorBoundary } from '@es-plus/vue3'

const REVENUE_ERROR = '指标接口返回空数组：同比无法计算'
const TREND_ERROR = '趋势数据缺列：series 字段为 null'

/**
 * 一个「会坏的子组件」：broken 为 true 时在 render 里直接抛错。
 * 抛错点必须在边界内部的子组件里 —— 错误边界不捕获自身渲染错误。
 */
const BrokenWidget = defineComponent({
  name: 'BrokenWidget',
  props: {
    broken: { type: Boolean, default: false },
    message: { type: String, default: '子组件渲染失败' },
  },
  setup(props, { slots }) {
    return () => {
      if (props.broken) throw new Error(props.message)
      return h('div', { class: 'eb-widget' }, slots.default ? slots.default() : [])
    }
  },
})

const revenueBroken = ref(false)
const trendBroken = ref(false)
const outsideClicks = ref(0)
// 组件实例上的 reset() 由 defineExpose 暴露；这里只用到这一个方法
const trendBoundary = ref<any>(null)
const logs = ref<{ info: string; message: string }[]>([])

const breakWidget = (target: 'revenue' | 'trend') => {
  if (target === 'revenue') revenueBroken.value = true
  else trendBroken.value = true
}

/** 先修数据、再清错误态 —— 反过来的话重渲染会立刻再抛一次 */
const repairRevenue = (reset?: () => void) => {
  revenueBroken.value = false
  reset?.()
}

const repairTrend = () => {
  trendBroken.value = false
  trendBoundary.value?.reset()
}

const logError = (err: unknown, info: string) => {
  logs.value.unshift({ info, message: err instanceof Error ? err.message : String(err) })
  if (logs.value.length > 4) logs.value.pop()
}
</script>

<style>
/* 案例内类名统一 eb- 前缀，避免污染全局；不用 scoped —— 故障组件的根节点由子组件渲染，
   scoped 属性不会落到它渲染出的元素上 */
.eb-workbench {
  border: 1px solid var(--es-border-lighter);
  border-radius: 8px;
  padding: 12px;
}
.eb-bar {
  display: flex;
  flex-wrap: wrap;
  align-items: center;
  gap: 8px 16px;
  margin-bottom: 12px;
}
.eb-isolation {
  margin-left: auto;
  font-size: 12px;
  color: var(--es-text-secondary);
}
.eb-widget {
  border: 1px solid var(--es-border-lighter);
  border-radius: 6px;
  padding: 12px 16px;
  margin-bottom: 10px;
  background: var(--es-info-tint);
}
.eb-widget__title {
  font-size: 12px;
  color: var(--es-text-secondary);
  margin-bottom: 8px;
}
.eb-kpi {
  display: flex;
  align-items: baseline;
  gap: 10px;
}
.eb-kpi strong {
  font-size: 26px;
  color: var(--es-text-primary);
  font-variant-numeric: tabular-nums;
}
.eb-up {
  font-size: 13px;
  color: var(--es-success);
}
.eb-bars {
  display: flex;
  align-items: flex-end;
  gap: 8px;
  height: 72px;
}
.eb-bars i {
  flex: 1;
  border-radius: 3px 3px 0 0;
  background: linear-gradient(180deg, #79bbff 0%, var(--es-brand-primary) 100%);
}
.eb-fallback {
  border: 1px solid #fbc4c4;
  background: var(--es-danger-tint);
  border-radius: 6px;
  padding: 12px 16px;
  margin-bottom: 10px;
}
.eb-fallback__title {
  margin: 0 0 4px;
  font-size: 13px;
  font-weight: 600;
  color: var(--es-danger);
}
.eb-fallback__msg {
  margin: 0 0 10px;
  font-size: 12px;
  color: #a33;
  font-family: 'Fira Code', monospace;
}
.eb-log {
  margin-top: 10px;
  border-top: 1px dashed var(--es-border-lighter);
  padding-top: 8px;
  font-size: 12px;
}
.eb-log__head {
  color: var(--es-text-secondary);
  margin-bottom: 4px;
}
.eb-log__empty {
  margin: 0;
  color: var(--es-text-disabled);
}
.eb-log__row {
  margin: 2px 0;
  color: var(--es-text-regular);
  display: flex;
  gap: 8px;
}
.eb-log__row code {
  color: var(--es-brand-primary);
  background: var(--es-info-tint);
  border-radius: 3px;
  padding: 0 5px;
  font-family: 'Fira Code', monospace;
}
.eb-note {
  margin: 10px 0 0;
  font-size: 12px;
  line-height: 1.8;
  color: var(--es-text-secondary);
}
.eb-note code {
  background: var(--es-fill);
  padding: 1px 5px;
  border-radius: 3px;
  font-family: 'Fira Code', monospace;
  color: #d63384;
}
</style>
