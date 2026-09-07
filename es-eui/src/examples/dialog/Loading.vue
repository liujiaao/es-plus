<template>
  <div>
    <el-button @click="openLoading">加载状态</el-button>
  </div>
</template>

<script>
import { useDialog } from '@es-plus/vue2'

export default {
  methods: {
    openLoading() {
      const { instance } = useDialog()({
        title: '加载中',
        loading: true,
        render: () => '数据加载中...'
      })

      setTimeout(() => {
        instance.loading = false
        instance.render = () => '数据加载完成'
      }, 2000)
    }
  }
}
</script>
