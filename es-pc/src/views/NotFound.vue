<template>
  <div class="es-nf">
    <p class="es-nf-code" aria-hidden="true">404</p>
    <h1 class="es-nf-title">{{ copy.title }}</h1>
    <p class="es-nf-desc">{{ copy.desc }}</p>

    <p class="es-nf-path">
      <span class="es-nf-path-label">{{ copy.pathLabel }}</span>{{ attemptedPath }}
    </p>

    <div class="es-nf-actions">
      <router-link to="/" class="es-nf-btn es-nf-btn--primary">{{ copy.home }}</router-link>
      <a
        href="https://liujiaao.github.io/es-plus/"
        target="_blank"
        rel="noopener"
        class="es-nf-btn es-nf-btn--ghost"
      >{{ copy.search }}</a>
    </div>

    <section class="es-nf-section">
      <h2 class="es-nf-section-title">{{ copy.linksTitle }}</h2>
      <div class="es-nf-links">
        <router-link v-for="link in links" :key="link.href" :to="link.href" class="es-nf-link">
          <span>{{ link.text }}</span>
          <span class="es-nf-link-arrow" aria-hidden="true">→</span>
        </router-link>
      </div>
    </section>

    <section class="es-nf-section">
      <h2 class="es-nf-section-title">{{ copy.sitesTitle }}</h2>
      <p class="es-nf-section-note">{{ copy.sitesNote }}</p>
      <div class="es-nf-links">
        <a
          v-for="site in sites"
          :key="site.href"
          :href="site.href"
          target="_blank"
          rel="noopener"
          class="es-nf-link"
        >
          <span>{{ site.text }}</span>
          <span class="es-nf-link-arrow" aria-hidden="true">↗</span>
        </a>
      </div>
    </section>
  </div>
</template>

<script setup>
/**
 * 统一 404（路线图 1.8）。
 *
 * 此前本站借的是 antdv `a-result` 的库存插图 —— 与另两站完全不同的第三张 404。
 * 现在三站共用同一份文案与入口数据（utils/site-not-found.js）与同一套外观
 * （docs-notfound.css）。
 *
 * 本站没有站内搜索（全站索引只在主文档站），所以「搜索文档」是一个指向主站的真实
 * 链接，而不是一个点了没反应的输入框。
 *
 * 历史（保留）：此前本站**没有** pathMatch 兜底路由 —— vue-router 匹配不到就什么都
 * 不渲染，表现是整页空白。案例目录这类跨站链接一旦写错，用户看到的就是白屏。
 */
import { computed } from 'vue'
import { useRoute } from 'vue-router'
import {
  notFoundCopy,
  buildNotFoundLinks,
  buildNotFoundSites,
  formatNotFoundPath,
} from '@/utils/site-not-found.js'

const route = useRoute()
const copy = notFoundCopy('zh')
const links = buildNotFoundLinks({ siteKey: 'es-pc', locale: 'zh' })
const sites = buildNotFoundSites({ siteKey: 'es-pc', locale: 'zh' })
const attemptedPath = computed(() => formatNotFoundPath(route.fullPath))
</script>
