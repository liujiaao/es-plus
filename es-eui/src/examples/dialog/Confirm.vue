<template>
  <div>
    <el-button @click="openConfirm">确认弹窗</el-button>
  </div>
</template>

<script>
import { useDialog } from '@es-plus/vue2'

export default {
  methods: {
    openConfirm() {
      const { close } = useDialog()({
        title: '确认操作',
        render: () => '确定要执行此操作吗？',
        configBtn: [
          {
            name: '取消',
            key: 'cancel',
            click: (_, { close }) => close()
          },
          {
            name: '确定',
            type: 'primary',
            key: 'confirm',
            click: (_, { close }) => {
              this.$message.success('操作成功')
              close()
            }
          }
        ]
      })
    }
  }
}
</script>
