<template>
  <div class="code-playground">
    <div class="playground-header">
      <div class="playground-header-left">
        <h3 class="playground-title">{{ title }}</h3>
        <p v-if="description" class="playground-desc">{{ description }}</p>
      </div>
      <div class="playground-actions">
        <el-button size="mini" plain @click="expanded = !expanded">
          <i :class="expanded ? 'el-icon-arrow-up' : 'el-icon-arrow-down'" />
          {{ expanded ? '收起代码' : '展开代码' }}
        </el-button>
      </div>
    </div>

    <div class="playground-preview">
      <slot name="preview" />
    </div>

    <div v-show="expanded" class="playground-code">
      <div ref="codeHost" v-html="codeHtml" />
    </div>
  </div>
</template>

<script>
/**
 * 示例卡片（es-eui / Vue 2 端）。
 *
 * 代码区结构与主站、es-pc 完全一致：都由 `utils/code-block.js` 产出（语言标签 /
 * 文件名 / 复制 / 行号），外观来自 docs-content.css 的「代码块」段。路线图 1.6
 * 之前这里是裸 `<pre>`：无语言标签、无行号，复制按钮还长在卡片头部（与另外两站的
 * 位置不同），同一个示例在三站长得不一样。
 *
 * 这一端没有 highlight.js，代码按纯文本渲染 —— chrome 一致，只是没有 token 着色。
 */
import { enhanceCodeBlocks, inferLang, renderCodeBlockHtml } from '@/utils/code-block.js'

export default {
  name: 'CodePlayground',
  props: {
    title: { type: String, default: '' },
    description: { type: String, default: '' },
    code: { type: String, default: '' }
  },
  data() {
    return {
      expanded: false
    }
  },
  computed: {
    codeHtml() {
      return renderCodeBlockHtml({
        raw: this.code,
        lang: inferLang(this.code),
        // 外层的「展开代码」就是折叠入口，代码块自身不再叠一层
        collapsible: false
      })
    }
  },
  watch: {
    codeHtml() {
      this.$nextTick(this.enhance)
    }
  },
  mounted() {
    this.enhance()
  },
  methods: {
    enhance() {
      enhanceCodeBlocks(this.$refs.codeHost)
    }
  }
}
</script>

<style lang="scss" scoped>
.code-playground {
  margin-bottom: 24px;
  border: 1px solid #e4e7ed;
  border-radius: 8px;
  overflow: hidden;
  /* 锚点落点（#demo-xxx）留出顶部固定栏高度；路由里已按 88px 偏移，这里兜底 */
  scroll-margin-top: 88px;
}

.playground-header {
  display: flex;
  justify-content: space-between;
  align-items: flex-start;
  padding: 16px 20px;
  background: var(--es-bg-subtle, #f5f7fa);
  border-bottom: 1px solid #e4e7ed;
}

.playground-header-left {
  flex: 1;
  min-width: 0;
  padding-right: 16px;
}

.playground-title {
  margin: 0 0 4px 0;
  font-size: 16px;
  font-weight: 600;
  color: var(--es-text-primary, #303133);
}

.playground-desc {
  margin: 0;
  font-size: 13px;
  color: var(--es-text-secondary, #909399);
  line-height: 1.5;
}

.playground-actions {
  flex-shrink: 0;
  display: flex;
  gap: 8px;
}

.playground-preview {
  padding: 20px;
}

/* 代码块的外观由 docs-content.css（三站共用）负责；这里只去掉卡片内的重复描边 ——
   卡片本身已有圆角与边框，代码块再画一圈就成双线。 */
.playground-code {
  border-top: 1px solid #e4e7ed;

  ::v-deep .code-block-wrapper {
    margin: 0;
    border: 0;
    border-radius: 0;
    box-shadow: none;
  }
}
</style>
