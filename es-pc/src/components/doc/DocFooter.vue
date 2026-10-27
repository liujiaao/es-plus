<template>
  <footer class="es-footer">
    <div class="es-footer-inner">
      <div class="es-footer-grid">
        <div class="es-footer-brand">
          <span class="es-footer-logo" aria-hidden="true">ES</span>
          <p class="es-footer-tagline">ES-Plus · {{ brand.positioning }}</p>
          <p class="es-footer-note">{{ brand.slogan.subtitle }}</p>
        </div>

        <nav v-for="col in columns" :key="col.title" class="es-footer-col" :aria-label="col.title">
          <h2 class="es-footer-col-title">{{ col.title }}</h2>
          <ul class="es-footer-list">
            <li v-for="link in col.links" :key="link.href">
              <a
                v-if="link.external"
                :href="link.href"
                target="_blank"
                rel="noopener"
                :aria-current="link.current ? 'page' : null"
              >{{ link.text }}</a>
              <router-link v-else :to="link.href">{{ link.text }}</router-link>
            </li>
          </ul>
        </nav>
      </div>

      <div class="es-footer-meta">
        <template v-for="(part, i) in metaParts" :key="part">
          <span v-if="i > 0" class="es-footer-meta-sep" aria-hidden="true">·</span>
          <span>{{ part }}</span>
        </template>
      </div>
    </div>
  </footer>
</template>

<script setup>
/**
 * 三站统一页脚（路线图 1.8）。
 *
 * 结构与主站、Vue 2 站逐字一致；数据来自 `utils/site-footer.js`（单源
 * docs/theme/site-footer.js），外观来自 `docs-footer.css`。本站只提供「我是谁」——
 * 渲染端名与站内路径映射由数据模块按 siteKey 给出。
 */
import { computed } from 'vue'
import { buildFooterColumns, buildFooterMeta } from '@/utils/site-footer.js'
import brand from '@/brand/slogan.json'

const columns = computed(() => buildFooterColumns({ siteKey: 'es-pc', locale: 'zh' }))

const metaParts = computed(() =>
  buildFooterMeta({
    locale: 'zh',
    positioningZh: brand.positioning,
    rendererZh: 'Vue 3 + Ant Design Vue',
  })
)
</script>
