<template>
  <div class="eb-workbench">
    <div class="eb-bar">
      <el-button size="mini" type="danger" plain data-testid="eb-break-revenue" @click="breakWidget('revenue')">
        让指标卡抛错
      </el-button>
      <el-button size="mini" type="danger" plain data-testid="eb-break-trend" @click="breakWidget('trend')">
        让趋势图抛错
      </el-button>
      <span class="eb-isolation">
        边界外仍然可用：
        <el-button size="mini" data-testid="outside-counter" @click="outsideClicks++">
          普通按钮 · 已点 {{ outsideClicks }} 次
        </el-button>
      </span>
    </div>

    <!-- ① 自定义降级 UI：fallback 插槽拿到 { error, reset } -->
    <es-error-boundary @error="logError">
      <template #default>
        <broken-widget :broken="revenueBroken" :message="REVENUE_ERROR">
          <div class="eb-widget__title">实时营收</div>
          <div class="eb-kpi">
            <strong>¥128,400</strong>
            <span class="eb-up">+12.8%</span>
          </div>
        </broken-widget>
      </template>

      <template #fallback="{ error, reset }">
        <div class="eb-fallback" data-testid="eb-fallback">
          <p class="eb-fallback__title">指标卡已被错误边界围住</p>
          <p class="eb-fallback__msg">{{ error && error.message }}</p>
          <el-button size="mini" type="primary" data-testid="eb-retry" @click="repairRevenue(reset)">
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
      <template #default>
        <broken-widget :broken="trendBroken" :message="TREND_ERROR">
          <div class="eb-widget__title">近 7 日趋势</div>
          <div class="eb-bars">
            <i v-for="(height, index) in [38, 52, 44, 68, 58, 76, 88]" :key="index" :style="{ height: height + '%' }" />
          </div>
        </broken-widget>
      </template>
    </es-error-boundary>
    <el-button v-if="trendBroken" size="mini" data-testid="eb-retry-trend" @click="repairTrend">
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
      <code>Vue.config.errorHandler</code>，因此故障只影响这一块，整页不会白屏。
      <code>reset()</code> 只清错误态 —— 必须先修好导致错误的数据再调用，否则重新渲染会立刻再次降级。
      与 EsTable 逐单元格 render 的 try/catch 互补：后者兜单个格子，本边界兜整棵子树。
    </p>
  </div>
</template>

<script>
const REVENUE_ERROR = '指标接口返回空数组：同比无法计算'
const TREND_ERROR = '趋势数据缺列：series 字段为 null'

/**
 * 一个「会坏的子组件」：broken 为 true 时在 render 里直接抛错。
 * 抛错点必须在边界内部的子组件里 —— 错误边界不捕获自身渲染错误。
 */
const BrokenWidget = {
  name: 'BrokenWidget',
  props: {
    broken: { type: Boolean, default: false },
    message: { type: String, default: '子组件渲染失败' },
  },
  render(h) {
    if (this.broken) throw new Error(this.message)
    return h('div', { class: 'eb-widget' }, this.$slots.default)
  },
}

export default {
  name: 'ErrorBoundaryBasic',
  components: { BrokenWidget },
  data() {
    return {
      REVENUE_ERROR,
      TREND_ERROR,
      revenueBroken: false,
      trendBroken: false,
      outsideClicks: 0,
      logs: [],
    }
  },
  methods: {
    breakWidget(target) {
      if (target === 'revenue') this.revenueBroken = true
      else this.trendBroken = true
    },
    /** 先修数据、再清错误态 —— 反过来的话重渲染会立刻再抛一次 */
    repairRevenue(reset) {
      this.revenueBroken = false
      if (reset) reset()
    },
    repairTrend() {
      this.trendBroken = false
      this.$refs.trendBoundary.reset()
    },
    logError(err, info) {
      this.logs.unshift({ info, message: (err && err.message) || String(err) })
      if (this.logs.length > 4) this.logs.pop()
    },
  },
}
</script>

<style>
/* 案例内类名统一 eb- 前缀，避免污染全局 */
.eb-workbench {
  border: 1px solid #ebeef5;
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
  color: #909399;
}
.eb-widget {
  border: 1px solid #ebeef5;
  border-radius: 6px;
  padding: 12px 16px;
  margin-bottom: 10px;
  background: #fafcff;
}
.eb-widget__title {
  font-size: 12px;
  color: #909399;
  margin-bottom: 8px;
}
.eb-kpi {
  display: flex;
  align-items: baseline;
  gap: 10px;
}
.eb-kpi strong {
  font-size: 26px;
  color: #303133;
  font-variant-numeric: tabular-nums;
}
.eb-up {
  font-size: 13px;
  color: #67c23a;
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
  background: linear-gradient(180deg, #79bbff 0%, #409eff 100%);
}
.eb-fallback {
  border: 1px solid #fbc4c4;
  background: #fef0f0;
  border-radius: 6px;
  padding: 12px 16px;
  margin-bottom: 10px;
}
.eb-fallback__title {
  margin: 0 0 4px;
  font-size: 13px;
  font-weight: 600;
  color: #f56c6c;
}
.eb-fallback__msg {
  margin: 0 0 10px;
  font-size: 12px;
  color: #a33;
  font-family: 'Fira Code', monospace;
}
.eb-log {
  margin-top: 10px;
  border-top: 1px dashed #ebeef5;
  padding-top: 8px;
  font-size: 12px;
}
.eb-log__head {
  color: #909399;
  margin-bottom: 4px;
}
.eb-log__empty {
  margin: 0;
  color: #c0c4cc;
}
.eb-log__row {
  margin: 2px 0;
  color: #606266;
  display: flex;
  gap: 8px;
}
.eb-log__row code {
  color: #409eff;
  background: #ecf5ff;
  border-radius: 3px;
  padding: 0 5px;
  font-family: 'Fira Code', monospace;
}
.eb-note {
  margin: 10px 0 0;
  font-size: 12px;
  line-height: 1.8;
  color: #909399;
}
.eb-note code {
  background: #f5f5f5;
  padding: 1px 5px;
  border-radius: 3px;
  font-family: 'Fira Code', monospace;
  color: #d63384;
}
</style>
