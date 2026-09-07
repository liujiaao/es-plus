<template>
  <div>
    <el-button type="primary" @click="open">打开审批弹窗</el-button>
    <span style="margin-left: 12px; color: #909399; font-size: 13px;">
      「提交」按钮根据审批决定动态启用：未选择时禁用；选「驳回」需填写原因
    </span>
  </div>
</template>

<script lang="jsx">
/**
 * 动态按钮弹窗 —— configBtn 的 disabled 支持函数形式，随内容实时启停
 *
 * 关键点：
 *   1. configBtn 项的 disabled 可为函数 () => boolean，EsDialog 在渲染 footer 时调用它；
 *      函数内读取响应式 ref，ref 变化会驱动 EsDialog 重渲染并重新求值 disabled
 *   2. body render 的单选/文本框修改 decision/reason，footer 按钮即时联动禁用态
 *   3. click 回调签名：click(currentRef, { close, getRefs, dialogInstance })
 */
import { defineComponent, ref } from '@vue/composition-api'
import { useDialog } from '@es-plus/vue2'
import { Message } from 'element-ui'

const resultLabel = { approve: '通过', reject: '驳回', return: '退回修改' }

export default defineComponent({
  name: 'DialogDynamicBtn',
  setup() {
    const open = () => {
      const decision = ref('')
      const reason = ref('')

      useDialog()({
        title: '审批处理',
        width: '480px',
        // eslint-disable-next-line no-unused-vars -- h 供 JSX 使用（setup 内无 this.$createElement）
        render: (h) => (
          <div style="padding: 4px 8px;">
            <div style="margin-bottom: 12px; color: #606266;">请选择审批决定：</div>
            <el-radio-group
              value={decision.value}
              on-input={(v) => { decision.value = v }}
            >
              <el-radio label="approve">通过</el-radio>
              <el-radio label="reject">驳回</el-radio>
              <el-radio label="return">退回修改</el-radio>
            </el-radio-group>
            {decision.value === 'reject' && (
              <el-input
                type="textarea"
                rows={3}
                value={reason.value}
                on-input={(v) => { reason.value = v }}
                placeholder="驳回必须填写原因"
                style="margin-top: 14px;"
              />
            )}
          </div>
        ),
        configBtn: [
          {
            name: '取消',
            key: 'cancel',
            click: (_, { close }) => close()
          },
          {
            name: '提交',
            type: 'primary',
            key: 'submit',
            // 函数形式 disabled：未做决定，或选驳回但没写原因时禁用
            disabled: () =>
              !decision.value || (decision.value === 'reject' && !reason.value.trim()),
            click: (_, { close }) => {
              Message.success(`已${resultLabel[decision.value]}`)
              close()
            }
          }
        ]
      })
    }

    return { open }
  }
})
</script>
