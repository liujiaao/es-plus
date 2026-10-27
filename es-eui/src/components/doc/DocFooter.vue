<template>
  <footer class="es-footer">
    <div class="es-footer-inner">
      <div class="es-footer-grid">
        <div class="es-footer-brand">
          <span
            class="es-footer-logo"
            aria-hidden="true"
          >ES</span>
          <p class="es-footer-tagline">ES-Plus · {{ brand.positioning }}</p>
          <p class="es-footer-note">{{ brand.slogan.subtitle }}</p>
        </div>

        <nav
          v-for="col in columns"
          :key="col.title"
          class="es-footer-col"
          :aria-label="col.title"
        >
          <h2 class="es-footer-col-title">{{ col.title }}</h2>
          <ul class="es-footer-list">
            <li
              v-for="link in col.links"
              :key="link.href"
            >
              <!-- 外链新窗口打开；站内链接走 router-link，不带整页刷新。
                   Vue 2 模板里没有 null 的 :aria-current 会渲染成 aria-current="null"，
                   所以用 v-if 分叉而不是绑 null。 -->
              <a
                v-if="link.external"
                :href="link.href"
                target="_blank"
                rel="noopener"
                :aria-current="link.current ? 'page' : undefined"
              >{{ link.text }}</a>
              <router-link
                v-else
                :to="link.href"
              >{{ link.text }}</router-link>
            </li>
          </ul>
        </nav>
      </div>

      <div class="es-footer-meta">
        <template v-for="(part, i) in metaParts">
          <span
            v-if="i > 0"
            :key="`sep-${i}`"
            class="es-footer-meta-sep"
            aria-hidden="true"
          >·</span>
          <span :key="`part-${i}`">{{ part }}</span>
        </template>
      </div>
    </div>
  </footer>
</template>

<script>
/**
 * 三站统一页脚（路线图 1.8）。
 *
 * 栏位、链接与站内路径全部来自 `utils/site-footer.js`（单源 docs/theme/site-footer.js），
 * 外观来自 `docs-footer.css`。三个站点渲染的是同一份数据 —— 这正是本批要解决的问题：
 * 同一个产品在三站给出三种页脚，读者根本不知道别处还有什么。
 *
 * Vue 2 站无 i18n，固定中文。
 */
import { buildFooterColumns, buildFooterMeta } from '@/utils/site-footer'
// 品牌文案单一真源：由 scripts/sync-brand.mjs 从 docs/brand/slogan.json 分发
import brand from '@/brand/slogan.json'

export default {
  name: 'DocFooter',
  data() {
    return {
      brand,
      columns: buildFooterColumns({ siteKey: 'es-eui', locale: 'zh' }),
      metaParts: buildFooterMeta({
        locale: 'zh',
        positioningZh: brand.positioning,
        rendererZh: 'Vue 2 + Element UI'
      })
    }
  }
}
</script>
