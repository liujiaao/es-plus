<template>
  <div class="es-nf">
    <p
      class="es-nf-code"
      aria-hidden="true"
    >
      404
    </p>
    <h1 class="es-nf-title">{{ copy.title }}</h1>
    <p class="es-nf-desc">{{ copy.desc }}</p>

    <p class="es-nf-path">
      <span class="es-nf-path-label">{{ copy.pathLabel }}</span>{{ attemptedPath }}
    </p>

    <div class="es-nf-actions">
      <router-link
        to="/"
        class="es-nf-btn es-nf-btn--primary"
      >
        {{ copy.home }}
      </router-link>
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
        <router-link
          v-for="link in links"
          :key="link.href"
          :to="link.href"
          class="es-nf-link"
        >
          <span>{{ link.text }}</span>
          <span
            class="es-nf-link-arrow"
            aria-hidden="true"
          >→</span>
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
          <span
            class="es-nf-link-arrow"
            aria-hidden="true"
          >↗</span>
        </a>
      </div>
    </section>
  </div>
</template>

<script>
/**
 * 统一 404（路线图 1.8）。
 *
 * 此前本站自己画了一张（72px 品牌蓝数字 + 两个 el-button），与另两站各画各的。
 * 现在三站共用同一份文案与入口数据（utils/site-not-found.js）与同一套外观
 * （docs-notfound.css）。
 *
 * 本站没有站内搜索（全站索引只在主文档站），所以「搜索文档」是一个指向主站的真实
 * 链接，而不是一个点了没反应的输入框。
 *
 * 历史（保留）：此前路由表没有通配兜底 —— vue-router（hash 模式）匹配不到就什么都
 * 不渲染，表现是整页空白。跨站链接写错时用户看到的就是白屏。
 */
import {
  notFoundCopy,
  buildNotFoundLinks,
  buildNotFoundSites,
  formatNotFoundPath
} from '@/utils/site-not-found'

export default {
  name: 'NotFound',
  data() {
    return {
      copy: notFoundCopy('zh'),
      links: buildNotFoundLinks({ siteKey: 'es-eui', locale: 'zh' }),
      sites: buildNotFoundSites({ siteKey: 'es-eui', locale: 'zh' })
    }
  },
  computed: {
    attemptedPath() {
      return formatNotFoundPath(this.$route.fullPath)
    }
  }
}
</script>
