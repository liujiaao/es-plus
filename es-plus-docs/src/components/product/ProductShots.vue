<template>
  <section class="shots-block">
    <div class="shots-head">
      <div>
        <span class="shots-eyebrow">{{ t('home.shotsEyebrow') }}</span>
        <h2 class="shots-title">{{ t('home.shotsTitle') }}</h2>
        <p class="shots-subtitle">{{ t('home.shotsSubtitle') }}</p>
      </div>
      <div class="shots-switch">
        <button
          class="shots-theme"
          type="button"
          :aria-pressed="shotDark"
          @click="shotDark = !shotDark"
        >
          {{ shotDark ? t('home.shotsSeeLight') : t('home.shotsSeeDark') }}
        </button>
      </div>
    </div>

    <!-- 横向滚动的一组切换按钮（不是 tablist：只有一张图、没有面板）。
         8 个页签在 1150px 下会折行并留下孤立按钮，横向滚动则永远是一行。 -->
    <div class="shots-tabs" role="group" :aria-label="t('home.shotsTabsLabel')">
      <button
        v-for="page in shotPages"
        :key="page.route"
        class="shots-tab"
        type="button"
        :aria-pressed="shotPage === page.route"
        :class="{ active: shotPage === page.route }"
        @click="shotPage = page.route"
      >
        {{ page.title }}
      </button>
    </div>

    <figure class="shots-figure">
      <img
        :key="currentShotSrc"
        :src="currentShotSrc"
        :alt="`${currentShot.title}：${currentShot.caption}`"
        :width="currentViewport.width"
        :height="currentViewport.height"
        loading="lazy"
      />
      <figcaption>
        <strong>{{ currentShot.title }}</strong>
        <span>{{ currentShot.caption }}</span>
      </figcaption>
    </figure>
  </section>
</template>

<script setup>
/**
 * 产品实拍图廊（无头浏览器对着真实页面拍摄，清单是 docs/product/shots.json）。
 *
 * 原先长在首页：8 个页签 + 一张 1200px 大图 = 1,175px，而首页同时还有首屏
 * 旗舰实拍和三端并排 —— 同一屏里三处「截图证据」互相稀释。现在整套图廊
 * 挪到 /cases（那页本来就是「看真实产物」），首页只留首屏一张 + 三端三张。
 */
import { computed, ref } from 'vue'
import { useI18n } from 'vue-i18n'
// 产品实拍清单：由 scripts/sync-product.mjs 从 docs/product/shots.json 分发，禁止手改
import shotsManifest from '@/product/shots.json'

const { t } = useI18n()

const shotsViewport = shotsManifest.viewport
const docsShots = computed(() => shotsManifest.shots.filter((s) => s.site === 'es-plus-docs'))
// 路由顺序由清单决定，但首页截图不能当第一张证据 —— 默认落在旗舰案例上
const shotPages = computed(() => {
  const seen = new Map()
  for (const s of docsShots.value) {
    if (!seen.has(s.route)) seen.set(s.route, { route: s.route, title: s.title.replace('（深色）', '') })
  }
  return [...seen.values()]
})
const preferredShot = '/flagship-approval'
const shotPage = ref(
  shotPages.value.some((p) => p.route === preferredShot) ? preferredShot : shotPages.value[0]?.route || '/',
)
const shotDark = ref(false)
const currentShot = computed(() => {
  const theme = shotDark.value ? 'dark' : 'light'
  const inPage = docsShots.value.filter((s) => s.route === shotPage.value)
  // 清单缺一张时退回浅色，不让页面出现破图
  return inPage.find((s) => s.theme === theme) || inPage[0]
})
// 清单里的 file 是可选的（默认 docs/product/<id>.png），页面不能假设它存在；
// 分发到站点后路径前缀换成 public 的 /product/
const currentShotSrc = computed(() => `/${(currentShot.value.file || `docs/product/${currentShot.value.id}.png`).replace(/^docs\//, '')}`)
// 每张图可以有自己的视口（宽表页更宽）：写死全局视口会让旗舰页那张图的占位比例不对
const currentViewport = computed(() => currentShot.value.viewport || shotsViewport)
</script>

<style lang="scss" scoped>
.shots-block {
  margin: 0 0 40px;
}

.shots-head {
  display: flex;
  align-items: flex-end;
  justify-content: space-between;
  gap: 24px;
  margin-bottom: 16px;
}

.shots-eyebrow {
  display: inline-block;
  margin-bottom: 6px;
  font-size: 12px;
  font-weight: 600;
  letter-spacing: 0.08em;
  text-transform: uppercase;
  color: var(--es-accent-text);
}

.shots-title {
  margin: 0 0 8px;
  font-size: 20px;
  color: var(--es-text-primary);
}

.shots-subtitle {
  max-width: 760px;
  margin: 0;
  font-size: 13px;
  line-height: 1.8;
  color: var(--es-text-secondary);
}

.shots-switch {
  flex-shrink: 0;
}

.shots-tabs {
  display: flex;
  gap: 8px;
  margin: 0 0 16px;
  overflow-x: auto;
  padding-bottom: 4px;
  scrollbar-width: thin;
}

.shots-tab,
.shots-theme {
  flex: 0 0 auto;
  padding: 6px 14px;
  border-radius: var(--es-radius-full);
  border: 1px solid var(--es-border-lighter);
  background: var(--es-bg);
  color: var(--es-text-regular);
  font-size: var(--es-text-sm);
  line-height: 1.6;
  cursor: pointer;
  white-space: nowrap;
  transition:
    color var(--es-duration-fast) var(--es-ease),
    border-color var(--es-duration-fast) var(--es-ease),
    background-color var(--es-duration-fast) var(--es-ease);
}

.shots-tab:hover,
.shots-theme:hover {
  border-color: var(--es-brand-primary);
  color: var(--es-brand-strong);
}

.shots-tab.active {
  background: var(--es-brand-primary);
  border-color: var(--es-brand-primary);
  color: #fff;
}

.shots-figure {
  margin: 0;
  border: 1px solid var(--es-border-light);
  border-radius: var(--es-radius-md);
  overflow: hidden;
  background: var(--es-bg);
  box-shadow: var(--es-shadow-md);
}

.shots-figure img {
  display: block;
  width: 100%;
  height: auto;
  animation: shot-fade var(--es-duration-slow) var(--es-ease);
}

@keyframes shot-fade {
  from { opacity: 0.4; }
  to { opacity: 1; }
}

.shots-figure figcaption {
  display: flex;
  flex-wrap: wrap;
  gap: 10px;
  padding: 12px 16px;
  border-top: 1px solid var(--es-border-lighter);
  font-size: var(--es-text-sm);
  line-height: var(--es-leading-normal);
  color: var(--es-text-secondary);
}

.shots-figure figcaption strong {
  color: var(--es-text-primary);
}

@media (prefers-reduced-motion: reduce) {
  .shots-figure img {
    animation: none;
  }
}

@media (max-width: 768px) {
  .shots-head {
    flex-direction: column;
    align-items: flex-start;
  }
}
</style>
