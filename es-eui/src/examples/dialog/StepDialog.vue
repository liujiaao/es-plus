<template>
  <div>
    <el-button type="primary" @click="open">打开分步表单弹窗</el-button>
  </div>
</template>

<script lang="jsx">
/**
 * 分步表单弹窗 —— el-steps + 分步 EsForm + 分步校验
 *
 * 关键点：
 *   1. 把 el-steps、EsForm、导航按钮全部放在 body render 中，并设 isHiddenFooter，
 *      这样导航按钮与表单同属 body 的 render-jsx，inst.getRefs() 能取到命名 ref
 *      （renderFooter 使用独立的 refs 对象，取不到 body 的表单实例）
 *   2. currentStep 定义在每次 open 的作用域内，render 读取它形成响应式依赖，
 *      currentStep 变化时 render-jsx 自动重渲染，切换步骤对应的表单项
 *   3. 每步用独立的 form-item-list 与 rules，「下一步」前先 validate() 当前步
 *   4. Vue 2 JSX 事件用 on-click；表单双向绑定由 EsForm 内部处理
 */
import { defineComponent, reactive, ref } from '@vue/composition-api'
import { useDialog } from '@es-plus/vue2'
import { Message } from 'element-ui'

const stepTitles = ['基本信息', '联系方式', '确认提交']

export default defineComponent({
  name: 'DialogStepDialog',
  setup() {
    const open = () => {
      const currentStep = ref(0)
      const model = reactive({ name: '', gender: 'male', phone: '', email: '', remark: '' })

      const stepItems = [
        [
          { prop: 'name', label: '姓名', span: 24, formtype: 'Input', attrs: { placeholder: '请输入姓名' } },
          {
            prop: 'gender',
            label: '性别',
            span: 24,
            formtype: 'Radio',
            dataOptions: [
              { label: '男', value: 'male' },
              { label: '女', value: 'female' }
            ]
          }
        ],
        [
          { prop: 'phone', label: '手机号', span: 24, formtype: 'Input', attrs: { placeholder: '请输入手机号' } },
          { prop: 'email', label: '邮箱', span: 24, formtype: 'Input', attrs: { placeholder: '请输入邮箱' } },
          { prop: 'remark', label: '备注', span: 24, formtype: 'Input', attrs: { type: 'textarea', rows: 3 } }
        ],
        []
      ]

      const stepRules = [
        {
          name: [{ required: true, message: '请输入姓名', trigger: 'blur' }]
        },
        {
          phone: [
            { required: true, message: '请输入手机号', trigger: 'blur' },
            { pattern: /^1\d{10}$/, message: '手机号格式不正确', trigger: 'blur' }
          ],
          email: [{ type: 'email', message: '邮箱格式不正确', trigger: 'blur' }]
        },
        {}
      ]

      const { close } = useDialog()({
        title: '分步表单',
        width: '640px',
        isHiddenFooter: true,
        render: (h, inst) => {
          const step = currentStep.value
          return (
            <div>
              <el-steps active={step} finish-status="success" align-center style="margin-bottom: 28px;">
                {stepTitles.map((t) => (
                  <el-step key={t} title={t} />
                ))}
              </el-steps>

              {step < 2 ? (
                <es-form
                  ref="stepForm"
                  model={model}
                  form-item-list={stepItems[step]}
                  rules={stepRules[step]}
                  layout-form-props={{ fromLayProps: { labelWidth: '80px', size: 'small' } }}
                />
              ) : (
                <div style="padding: 4px 8px; line-height: 2;">
                  <div>姓名：<b>{model.name}</b></div>
                  <div>性别：<b>{model.gender === 'male' ? '男' : '女'}</b></div>
                  <div>手机号：<b>{model.phone}</b></div>
                  <div>邮箱：<b>{model.email || '—'}</b></div>
                  <div>备注：<b>{model.remark || '—'}</b></div>
                </div>
              )}

              <div style="text-align: right; margin-top: 24px;">
                {step > 0 && (
                  <el-button on-click={() => { currentStep.value -= 1 }}>上一步</el-button>
                )}
                {step < 2 && (
                  <el-button
                    type="primary"
                    on-click={async () => {
                      const form = inst.getRefs().stepForm
                      const ok = await form?.validate()
                      if (ok) currentStep.value += 1
                    }}
                  >
                    下一步
                  </el-button>
                )}
                {step === 2 && (
                  <el-button
                    type="primary"
                    on-click={() => {
                      Message.success('提交成功')
                      close()
                    }}
                  >
                    提交
                  </el-button>
                )}
              </div>
            </div>
          )
        }
      })
    }

    return { open }
  }
})
</script>
