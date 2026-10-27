<template>
  <div class="es-nf">
    <p class="es-nf-code" aria-hidden="true">404</p>
    <h1 class="es-nf-title">{{ copy.title }}</h1>
    <p class="es-nf-desc">{{ copy.desc }}</p>

    <!-- 回显走错的地址：用户才知道自己点的是哪条链接（跨站链接最容易写错） -->
    <p class="es-nf-path">
      <span class="es-nf-path-label">{{ copy.pathLabel }}</span>{{ attemptedPath }}
    </p>

    <div class="es-nf-actions">
      <button type="button" class="es-nf-btn es-nf-btn--primary" @click="searchVisible = true">
        <span>{{ copy.search }}</span>
        <kbd class="es-nf-kbd">Ctrl K</kbd>
      </button>
      <router-link to="/" class="es-nf-btn es-nf-btn--ghost">{{ copy.home }}</router-link>
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

    <!-- 搜索直接用站内那份（全站索引 + 键盘操作），不另做一份 404 专用搜索框 -->
    <DocSearch v-model:visible="searchVisible" />
  </div>
</template>

<script setup>
/**
 * 统一 404（路线图 1.8）。
 *
 * 此前这一页只有「404 / 页面不存在 / 返回首页」三行，且与另两站的三张 404 互不相干。
 * 现在三站共用同一份文案与入口数据（utils/site-not-found.js）、同一套外观
 * （docs-notfound.css），主站额外提供站内搜索 —— 走错路的人第一反应是「搜一下」，
 * 而不是退回首页重找。
 */
import { computed, ref } from 'vue'
import { useRoute } from 'vue-router'
import { useI18n } from 'vue-i18n'
import DocSearch from '@/components/doc/DocSearch.vue'
import {
  notFoundCopy,
  buildNotFoundLinks,
  buildNotFoundSites,
  formatNotFoundPath,
} from '@/utils/site-not-found.js'
// 逐页 title / description：单一来源在 utils/page-meta.ts（check:page-meta 静态核对）。
import { usePageMeta } from '@/utils/page-meta'

usePageMeta('not-found')

const route = useRoute()
const { locale } = useI18n()

const copy = computed(() => notFoundCopy(locale.value))
const links = computed(() => buildNotFoundLinks({ siteKey: 'es-plus-docs', locale: locale.value }))
const sites = computed(() => buildNotFoundSites({ siteKey: 'es-plus-docs', locale: locale.value }))
const attemptedPath = computed(() => formatNotFoundPath(route.fullPath))

const searchVisible = ref(false)
</script>
