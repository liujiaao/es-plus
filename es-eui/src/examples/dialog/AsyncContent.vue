<template>
  <div>
    <el-button type="primary" @click="open">打开异步内容弹窗</el-button>
    <span style="margin-left: 12px; color: #909399; font-size: 13px;">
      打开后模拟请求 1.2s，加载态由 dialog 的 loading 控制
    </span>
  </div>
</template>

<script lang="jsx">
/**
 * 异步内容弹窗 —— 打开后加载远程数据，加载态用内置 loading 遮罩
 *
 * 关键点：
 *   1. useDialog 返回 { instance, close }，instance 是 EsDialog 组件实例，
 *      可通过 instance.loading 直接切换 body 的 v-loading 遮罩
 *   2. render 读取 detail（ref）形成响应式依赖，数据到达后自动重渲染
 *   3. 打开即发请求（此处 setTimeout 模拟），完成后关闭 loading 并填充内容
 */
import { defineComponent, ref } from '@vue/composition-api'
import { useDialog } from '@es-plus/vue2'

export default defineComponent({
  name: 'DialogAsyncContent',
  setup() {
    const open = () => {
      const detail = ref(null)

      const { instance, close } = useDialog()({
        title: '用户详情',
        width: '460px',
        loading: true,
        isHiddenFooter: true,
        // eslint-disable-next-line no-unused-vars -- h 供 JSX 使用（setup 内无 this.$createElement）
        render: (h) => {
          if (!detail.value) {
            // 加载期间由 loading 遮罩覆盖，这里给个占位高度
            return <div style="height: 120px;" />
          }
          const d = detail.value
          return (
            <div style="padding: 4px 8px; line-height: 2.2;">
              <div>姓名：<b>{d.name}</b></div>
              <div>部门：<b>{d.dept}</b></div>
              <div>邮箱：<b>{d.email}</b></div>
              <div>入职时间：<b>{d.entryDate}</b></div>
              <div style="text-align: right; margin-top: 16px;">
                <el-button size="small" on-click={() => close()}>关闭</el-button>
              </div>
            </div>
          )
        }
      })

      // 模拟异步请求
      setTimeout(() => {
        detail.value = {
          name: '张三',
          dept: '研发部',
          email: 'zhangsan@example.com',
          entryDate: '2021-03-15'
        }
        // 关闭加载态
        if (instance) instance.loading = false
      }, 1200)
    }

    return { open }
  }
})
</script>
