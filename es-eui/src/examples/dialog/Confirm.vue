<template>
  <div class="example-dialog-confirm">
    <el-button type="danger" @click="confirmDelete">删除确认</el-button>
    <el-button type="warning" @click="confirmPublish">发布确认</el-button>
    <el-button @click="confirmBeforeClose">关闭前拦截</el-button>
    <span class="tip">
      第三个按钮：先在输入框里写点东西，再点右上角 X —— 会先问你「内容还没保存」，选「留下」就关不掉
    </span>
  </div>
</template>

<script lang="jsx">
/**
 * 确认弹窗 —— configBtn 自定义按钮语义 + beforeClose 关闭闸门
 *
 * 关键点：
 *   1. 确认逻辑写在按钮的 click 里，close() 由回调参数给出（不依赖 this）
 *   2. beforeClose(done)：不调用 done() 就不关闭。X 按钮 / 遮罩点击 / ESC 三条关闭路径
 *      都会先经过它；configBtn 里的 close() 是显式关闭，按设计绕过闸门
 *   3. 三端（Vue3+Element / Vue3+AntD / Vue2+Element）语义一致
 */
import { defineComponent } from '@vue/composition-api'
import { useDialog } from '@es-plus/vue2'
import { Message, MessageBox, Icon } from 'element-ui'

export default defineComponent({
  name: 'DialogConfirm',
  setup() {
    const dialog = useDialog()

    const confirmDelete = () => {
      dialog({
        title: '确认删除',
        width: '400px',
        render: (h) => (
          <div style="display: flex; align-items: center; padding: 20px;">
            <Icon type="el-icon-warning" style="font-size: 40px; color: #f56c6c; margin-right: 16px;" />
            <div>
              <p style="font-size: 16px; margin-bottom: 8px;">确定要删除这条数据吗？</p>
              <p style="color: #909399; font-size: 14px;">删除后数据将无法恢复，请谨慎操作。</p>
            </div>
          </div>
        ),
        configBtn: [
          { name: '取消', key: 'cancel', click: (_, { close }) => close() },
          {
            name: '确定删除',
            type: 'danger',
            key: 'confirm',
            click: (_, { close }) => {
              Message.success('删除成功')
              close()
            }
          }
        ]
      })
    }

    const confirmPublish = () => {
      dialog({
        title: '确认发布',
        width: '400px',
        render: (h) => (
          <div style="display: flex; align-items: center; padding: 20px;">
            <Icon type="el-icon-success" style="font-size: 40px; color: #e6a23c; margin-right: 16px;" />
            <div>
              <p style="font-size: 16px; margin-bottom: 8px;">确定要发布这篇文章吗？</p>
              <p style="color: #909399; font-size: 14px;">发布后将对所有用户可见。</p>
            </div>
          </div>
        ),
        configBtn: [
          { name: '取消', key: 'cancel', click: (_, { close }) => close() },
          {
            name: '立即发布',
            type: 'primary',
            key: 'confirm',
            click: (_, { close }) => {
              Message.success('发布成功')
              close()
            }
          }
        ]
      })
    }

    const confirmBeforeClose = () => {
      // 只要输入过内容就算「有未保存改动」；关闭前拦一道
      let dirty = false
      dialog({
        title: '关闭前拦截',
        width: '460px',
        beforeClose: (done) => {
          if (!dirty) return done()
          MessageBox.confirm('内容还没保存，确定要关闭吗？', '提示', {
            confirmButtonText: '关闭',
            cancelButtonText: '留下',
            type: 'warning'
          })
            .then(() => done())
            .catch(() => { /* 用户选择留在弹窗里 */ })
        },
        render: (h) => (
          <div style="padding: 20px;">
            <p style="margin-bottom: 10px; color: #606266;">在上面的输入框里写点东西，再点右上角 X 试试。</p>
            <el-input
              type="textarea"
              rows={4}
              placeholder="随便写点什么…"
              on-input={() => { dirty = true }}
            />
          </div>
        ),
        configBtn: [
          { name: '取消', key: 'cancel', click: (_, { close }) => close() },
          {
            name: '保存并关闭',
            type: 'primary',
            key: 'save',
            click: (_, { close }) => {
              Message.success('已保存')
              close()
            }
          }
        ]
      })
    }

    return { confirmDelete, confirmPublish, confirmBeforeClose }
  }
})
</script>

<style scoped>
.example-dialog-confirm {
  display: flex;
  align-items: center;
  gap: 12px;
}
.tip {
  color: #909399;
  font-size: 13px;
}
</style>
