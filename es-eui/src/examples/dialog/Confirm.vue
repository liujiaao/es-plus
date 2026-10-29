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
 *   2. beforeClose(done)：不调用 done() 就不关闭。X 按钮 / 遮罩点击 / ESC，以及
 *      configBtn 里拿到的 close()，走的是同一道闸门（close → handleClose → runBeforeClose）；
 *      确实需要绕过时用弹窗实例暴露的 doClose()
 *   3. 三端（Vue3+Element / Vue3+AntD / Vue2+Element）语义一致
 */
import { defineComponent } from '@vue/composition-api'
import { useDialog } from '@es-plus/vue2'
import Message from 'element-ui/lib/message'
import MessageBox from 'element-ui/lib/message-box'
import Icon from 'element-ui/lib/icon'

export default defineComponent({
  name: 'DialogConfirm',
  setup() {
    const dialog = useDialog()

    const confirmDelete = () => {
      dialog({
        title: '确认删除',
        width: '400px',
        render: (h) => (
          <div class="dialog-confirm__row">
            <Icon type="el-icon-warning" class="dialog-confirm__icon dialog-confirm__icon--danger" />
            <div>
              <p class="dialog-confirm__title">确定要删除这条数据吗？</p>
              <p class="dialog-confirm__desc">删除后数据将无法恢复，请谨慎操作。</p>
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
          <div class="dialog-confirm__row">
            <Icon type="el-icon-success" class="dialog-confirm__icon dialog-confirm__icon--warning" />
            <div>
              <p class="dialog-confirm__title">确定要发布这篇文章吗？</p>
              <p class="dialog-confirm__desc">发布后将对所有用户可见。</p>
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
          <div class="dialog-confirm__body">
            <p class="dialog-confirm__hint">在上面的输入框里写点东西，再点右上角 X 试试。</p>
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
              // close() 也要过 beforeClose：先把 dirty 清掉，否则「已保存」后还会再问一遍未保存
              dirty = false
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

<!--
  弹窗内容是**裸 render 函数**渲染的（不是编译后的模板插槽），调用发生在弹窗宿主组件里、
  再传送到 body —— vnode 上没有本文件的 `data-v-xxx`，`<style scoped>` 里的
  `.dialog-confirm__row` 永远匹配不上（三端同因，docs / pc 的弹窗示例同样处理）。
  所以这里用全局样式，靠 `dialog-confirm__` 前缀保证唯一。
-->
<style>
.dialog-confirm__row {
  display: flex;
  align-items: center;
  padding: 20px;
}

.dialog-confirm__icon {
  font-size: 40px;
  margin-right: 16px;
}

.dialog-confirm__icon--danger {
  color: #f56c6c;
}

.dialog-confirm__icon--warning {
  color: #e6a23c;
}

.dialog-confirm__title {
  font-size: 16px;
  margin-bottom: 8px;
}

.dialog-confirm__desc {
  color: #909399;
  font-size: 14px;
}

.dialog-confirm__body {
  padding: 20px;
}

.dialog-confirm__hint {
  margin-bottom: 10px;
  color: #606266;
}
</style>
