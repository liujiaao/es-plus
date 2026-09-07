<template>
  <div>
    <el-button type="primary" @click="openOne">打开一个弹窗</el-button>
    <span style="margin-left: 12px; color: #909399; font-size: 13px;">
      连续点击可同时打开多个互不干扰的弹窗实例（当前已打开 {{ count }} 个）
    </span>
  </div>
</template>

<script lang="jsx">
/**
 * 多实例弹窗 —— 同一个 useDialog 可同时存在多个实例
 *
 * 关键点：
 *   1. useDialog 默认 onlyInstance: false，每次调用返回的函数都会新建一个实例，
 *      多个实例可同时存在、互不干扰（各自维护 visible 与内容）
 *   2. 每个实例有独立的 close/destroy，关闭其一不影响其它
 *   3. 适合「详情弹窗上再叠加子弹窗」「批量并列查看」等场景
 */
import { defineComponent, ref } from '@vue/composition-api'
import { useDialog } from '@es-plus/vue2'

export default defineComponent({
  name: 'DialogMultiInstance',
  setup() {
    const count = ref(0)
    // 复用同一个 factory；每次调用创建一个新实例（onlyInstance 默认 false）
    const dialogFactory = useDialog(null, { onlyInstance: false })

    const openOne = () => {
      count.value += 1
      const seq = count.value
      const offset = (seq - 1) * 30

      const { close } = dialogFactory({
        title: `弹窗实例 #${seq}`,
        width: '360px',
        // 错位显示，直观体现多个实例并存
        top: `${80 + offset}px`,
        isHiddenFooter: true,
        // eslint-disable-next-line no-unused-vars -- h 供 JSX 使用（setup 内无 this.$createElement）
        render: (h) => (
          <div style="padding: 8px 4px;">
            <p style="margin: 0 0 16px;">
              这是第 <b>{seq}</b> 个弹窗实例，可继续点击按钮打开更多，它们互相独立。
            </p>
            <div style="text-align: right;">
              <el-button size="small" on-click={() => close()}>关闭本实例</el-button>
            </div>
          </div>
        ),
        onClosed: () => {
          count.value = Math.max(0, count.value - 1)
        }
      })
    }

    return { count, openOne }
  }
})
</script>
