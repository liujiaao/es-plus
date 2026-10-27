<template>
  <div class="code-demo">
    <!-- 实时预览 -->
    <div class="demo-preview">
      <div class="demo-preview-inner">
        <slot />
      </div>
    </div>

    <!-- 代码查看：卡片的「查看代码」就是这一层的折叠控制，所以代码块本身不再叠一层折叠
         （collapsible: false）—— 一个代码块只允许一个折叠入口。 -->
    <div class="demo-toolbar">
      <a-button type="link" size="small" @click="expanded = !expanded">
        {{ expanded ? '收起代码' : '查看代码' }}
      </a-button>
    </div>
    <div v-show="expanded" ref="codeHost" class="demo-code" v-html="codeHtml" />
  </div>
</template>

<script setup>
/**
 * 代码示例卡片（es-pc）。
 *
 * 代码区的结构与主站、es-eui 完全一致：都由 `utils/code-block.js` 产出
 * （语言标签 / 文件名 / 复制 / 行号），外观来自 docs-content.css 的「代码块」段。
 * 路线图 1.6 之前这里是「查看代码」开关 + 裸 `<pre>`：没有语言标签、没有复制、
 * 更没有行号，同一个示例在主站与 es-pc 上长得完全不像。
 *
 * 这一端没有 highlight.js，所以代码是纯文本（chrome 一致，只是没有 token 着色）；
 * 不给两端各装一份 120 KB 的高亮库是刻意的取舍。
 */
import { computed, nextTick, onMounted, ref, watch } from 'vue'
import { enhanceCodeBlocks, inferLang, renderCodeBlockHtml } from '@/utils/code-block.js'

const props = defineProps({
  source: { type: String, default: '' },
  /** 语言（不传则按内容猜；```vue / ```json 这类一眼可辨的都能猜对） */
  lang: { type: String, default: '' },
  /** 文件名 / 标题（可选，显示在语言标签右侧） */
  title: { type: String, default: '' },
})

const expanded = ref(false)
const codeHost = ref(null)

const codeHtml = computed(() =>
  renderCodeBlockHtml({
    raw: props.source,
    lang: props.lang || inferLang(props.source),
    title: props.title,
    // 外层「查看代码」已经是一次显式展开，不再叠第二层折叠
    collapsible: false,
  })
)

const enhance = () => nextTick(() => enhanceCodeBlocks(codeHost.value))

onMounted(enhance)
watch(codeHtml, enhance)
</script>

<style scoped>
.code-demo {
  margin: 16px 0;
  border: 1px solid var(--border-color-lighter, var(--es-border-lighter));
  border-radius: 8px;
  overflow: hidden;
}

.demo-preview {
  padding: 24px;
  background: var(--bg-color, #fff);
}

.demo-preview-inner {
  max-width: 100%;
  overflow-x: auto;
}

.demo-toolbar {
  padding: 8px 16px;
  border-top: 1px dashed var(--border-color-lighter, var(--es-border-lighter));
  background: var(--bg-color-page, var(--es-bg-subtle));
}

/* 代码块的 appearance 全部由 docs-content.css（三站共用）负责，这里只处理
   「卡片内的代码区」这一层容器：卡片圆角已由 .code-demo 裁切，代码块自身不要再描边。 */
.demo-code :deep(.code-block-wrapper) {
  margin: 0;
  border: 0;
  border-top: 1px solid var(--border-color-lighter, var(--es-border-lighter));
  border-radius: 0;
  box-shadow: none;
}
</style>
