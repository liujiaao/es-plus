<template>
  <div class="example-dialog-cached">
    <el-button type="primary" @click="open">缓存实例（cacheKey）</el-button>
    <span class="tip">在输入框里写点东西 → 关闭 → 再点一次，内容还在</span>
  </div>
</template>

<script lang="jsx">
/**
 * 实例缓存弹窗 —— cacheKey 让「关闭」不等于「销毁」
 *
 * 关键点：
 *   1. 传 cacheKey 时，关闭只把 visible 置 false，组件实例留在内存里；
 *      再次用同一 cacheKey 打开会复用该实例 —— 表单草稿、滚动位置、tab 选中都还在
 *   2. 缓存实例 10 分钟内没再被打开才真正销毁（每次打开会重新计时）
 *   3. 不传 cacheKey 的弹窗关闭即销毁，这是默认行为，适合纯展示内容
 *
 * 适用：多步表单中途关掉去查资料、审批填写到一半切走、弹窗内嵌有状态的编辑器
 */
import { defineComponent } from '@vue/composition-api'
import { useDialog } from '@es-plus/vue2'

export default defineComponent({
  name: 'DialogCachedInstance',
  setup() {
    const dialog = useDialog()

    const open = () => {
      // 草稿状态放在 render 内部组件里，才能证明「实例复用了、状态没丢」；
      // 若放在 open() 外部，看起来一样但其实是外部状态，说服不了人
      dialog({
        title: '缓存实例（cacheKey）',
        width: '480px',
        cacheKey: 'eui-cached-draft',
        render: (h) => h(DraftBox),
        configBtn: [{ name: '关闭', key: 'close', click: (_, { close }) => close() }]
      })
    }

    return { open }
  }
})

// 草稿组件：text 是它自己的本地 state，实例被复用时不会重新初始化
const DraftBox = {
  name: 'DraftBox',
  data() {
    return { text: '' }
  },
  render(h) {
    return (
      <div style="padding: 20px;">
        <p style="margin-bottom: 10px; color: #606266;">
          关闭后再点一次「缓存实例」，下面输入的内容还在 —— 实例被 cacheKey 缓存住了（10 分钟未再打开才回收）。
        </p>
        <el-input
          value={this.text}
          placeholder="随便输入点什么，关闭再打开看看"
          on-input={(v) => { this.text = v }}
        />
        <p style="margin-top: 10px; color: #909399;">当前输入：{this.text || '（空）'}</p>
      </div>
    )
  }
}
</script>

<style scoped>
.example-dialog-cached {
  display: flex;
  align-items: center;
  gap: 12px;
}
.tip {
  color: #909399;
  font-size: 13px;
}
</style>
