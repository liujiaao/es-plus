<template>
  <transition name="sidebar-overlay">
    <div v-if="mobileOpen" class="sidebar-overlay" @click="$emit('close')" />
  </transition>
  <aside class="app-sidebar" :class="{ 'mobile-open': mobileOpen }">
    <div class="sidebar-content">
      <div v-for="section in sections" :key="section.titleKey" class="nav-section">
        <div class="nav-title">{{ t(section.titleKey) }}</div>
        <ul class="nav-list">
          <li v-for="item in section.items" :key="item.path" class="nav-item">
            <router-link :to="item.path" class="nav-link">
              <span class="nav-icon"><el-icon><component :is="item.icon" /></el-icon></span>
              {{ t(item.labelKey) }}
            </router-link>
          </li>
        </ul>
      </div>
    </div>
  </aside>
</template>

<script setup lang="ts">
import { watch, markRaw } from 'vue'
import { useRoute } from 'vue-router'
import { useI18n } from 'vue-i18n'
import { Edit, Grid, ChatDotRound, Connection, Monitor, Switch, MagicStick, Lock, Document, SetUp, Promotion, Box, Reading, Tools } from '@element-plus/icons-vue'

const props = defineProps<{
  mobileOpen?: boolean
}>()

const emit = defineEmits(['close'])

const route = useRoute()
const { t } = useI18n()

// Navigate on mobile closes sidebar
watch(() => route.path, () => {
  if (props.mobileOpen) {
    emit('close')
  }
})

const sections = [
  {
    titleKey: 'sidebar.section.start',
    items: [
      { path: '/guide/getting-started', labelKey: 'sidebar.gettingStarted', icon: markRaw(Promotion) },
      { path: '/guide/installation', labelKey: 'sidebar.installation', icon: markRaw(Box) },
      { path: '/guide/usage', labelKey: 'sidebar.usage', icon: markRaw(Reading) },
    ],
  },
  {
    titleKey: 'sidebar.section.components',
    items: [
      { path: '/components/es-form', labelKey: 'sidebar.esForm', icon: markRaw(Edit) },
      { path: '/components/es-table', labelKey: 'sidebar.esTable', icon: markRaw(Grid) },
      { path: '/components/es-crud-page', labelKey: 'sidebar.esCrudPage', icon: markRaw(Document) },
    ],
  },
  {
    titleKey: 'sidebar.section.advanced',
    items: [
      { path: '/advanced/use-dialog', labelKey: 'sidebar.useDialog', icon: markRaw(ChatDotRound) },
      { path: '/advanced/linkage', labelKey: 'sidebar.linkage', icon: markRaw(Connection) },
    ],
  },
  {
    titleKey: 'sidebar.section.ai',
    items: [
      { path: '/guide/mcp-server', labelKey: 'sidebar.mcpServer', icon: markRaw(MagicStick) },
      { path: '/guide/cli', labelKey: 'sidebar.cli', icon: markRaw(Monitor) },
    ],
  },
  {
    titleKey: 'sidebar.section.crossFramework',
    items: [
      { path: '/guide/vue2', labelKey: 'sidebar.vue2', icon: markRaw(SetUp) },
      { path: '/guide/migration', labelKey: 'sidebar.migration', icon: markRaw(Switch) },
    ],
  },
  {
    titleKey: 'sidebar.section.reference',
    items: [
      { path: '/guide/permission-i18n', labelKey: 'sidebar.permissionI18n', icon: markRaw(Lock) },
      { path: '/guide/schema-setup', labelKey: 'sidebar.schemaSetup', icon: markRaw(Tools) },
      { path: '/guide/changelog', labelKey: 'sidebar.changelog', icon: markRaw(Document) },
    ],
  },
  {
    titleKey: 'sidebar.section.tools',
    items: [
      { path: '/ai-crud', labelKey: 'sidebar.aiCrud', icon: markRaw(MagicStick) },
      { path: '/playground', labelKey: 'sidebar.playground', icon: markRaw(Monitor) },
    ],
  },
]
</script>

<style lang="scss" scoped>
.app-sidebar {
  width: 260px;
  height: calc(100vh - var(--header-height));
  position: fixed;
  left: 0;
  top: var(--header-height);
  background-color: var(--bg-color);
  border-right: 1px solid var(--border-color-lighter);
  overflow-y: auto;
  z-index: 100;
  transition: transform 0.3s ease;
}

.sidebar-overlay {
  position: fixed;
  top: 0;
  left: 0;
  right: 0;
  bottom: 0;
  background: rgba(0, 0, 0, 0.5);
  z-index: 99;
}

.sidebar-overlay-enter-active,
.sidebar-overlay-leave-active {
  transition: opacity 0.3s ease;
}

.sidebar-overlay-enter-from,
.sidebar-overlay-leave-to {
  opacity: 0;
}

.sidebar-content {
  padding: 16px 0;
}

.nav-section {
  margin-bottom: 24px;
}

.nav-title {
  padding: 8px 20px;
  font-size: 13px;
  font-weight: 600;
  color: var(--text-color-secondary);
  text-transform: uppercase;
  letter-spacing: 0.5px;
}

.nav-list {
  list-style: none;
  padding: 0;
  margin: 0;
}

.nav-item {
  margin: 2px 0;
}

.nav-link {
  display: flex;
  align-items: center;
  padding: 10px 20px;
  color: var(--text-color-regular);
  text-decoration: none;
  font-size: 14px;
  transition: all 0.2s;
  border-left: 3px solid transparent;

  &:hover {
    color: var(--primary-color);
    background-color: var(--fill-color-light);
  }

  &.router-link-active {
    color: var(--primary-color);
    background-color: var(--primary-color-light);
    border-left-color: var(--primary-color);
    font-weight: 500;
  }
}

.nav-icon {
  display: flex;
  align-items: center;
  margin-right: 10px;
  color: inherit;
}

@media (max-width: 768px) {
  .app-sidebar {
    transform: translateX(-100%);
    z-index: 200;

    &.mobile-open {
      transform: translateX(0);
    }
  }
}
</style>
