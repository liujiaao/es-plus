<template>
  <footer class="es-footer">
    <div class="es-footer-inner">
      <div class="es-footer-grid">
        <div class="es-footer-brand">
          <span class="es-footer-logo" aria-hidden="true">ES</span>
          <p class="es-footer-tagline">ES-Plus · {{ positioning }}</p>
          <p class="es-footer-note">{{ note }}</p>
        </div>

        <nav v-for="col in columns" :key="col.title" class="es-footer-col" :aria-label="col.title">
          <h2 class="es-footer-col-title">{{ col.title }}</h2>
          <ul class="es-footer-list">
            <li v-for="link in col.links" :key="link.href">
              <!-- 外链新窗口打开；站内链接走 router-link，不带整页刷新 -->
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
 * 栏位、链接与站内路径全部来自 `utils/site-footer.js`（单源 docs/theme/site-footer.js），
 * 外观来自 `docs-footer.css`。三个站点渲染的是同一份数据 —— 这正是本批要解决的
 * 问题：同一个产品在三站给出三种页脚，读者根本不知道别处还有什么。
 *
 * 本站是唯一有双语的站点：`locale` 变化时整块跟着换语言。
 */
import { computed } from 'vue'
import { useI18n } from 'vue-i18n'
import { buildFooterColumns, buildFooterMeta } from '@/utils/site-footer.js'
import brand from '@/brand/slogan.json'

const { locale } = useI18n()

const en = computed(() => String(locale.value || '').toLowerCase().startsWith('en'))
const positioning = computed(() => (en.value ? brand.positioningEn : brand.positioning))
const note = computed(() => (en.value ? brand.slogan.subtitleEn : brand.slogan.subtitle))

const columns = computed(() =>
  buildFooterColumns({
    siteKey: 'es-plus-docs',
    locale: locale.value,
  })
)

const metaParts = computed(() =>
  buildFooterMeta({
    locale: locale.value,
    positioningZh: brand.positioning,
    positioningEn: brand.positioningEn,
    rendererZh: 'Vue 3 + Element Plus',
    rendererEn: 'Vue 3 + Element Plus',
  })
)
</script>

<style lang="scss" scoped>
@use '../../styles/breakpoints' as bp;

/* 侧栏是 fixed、一直画到视口底部：页脚整块左移一个侧栏宽，否则最左一列
   （品牌 + 定位）会永远压在侧栏底下、滚到底也看不见。与 AppContent 同一偏移。 */
.es-footer {
  margin-left: var(--es-sidebar-width);
}

@media (max-width: bp.$nav-collapse) {
  .es-footer {
    margin-left: 0;
  }
}
</style>
