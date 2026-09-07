<template>
  <div style="max-width: 760px;">
    <el-steps :active="step" finish-status="success" align-center style="margin-bottom: 28px;">
      <el-step title="账户信息" />
      <el-step title="企业资料" />
      <el-step title="核对提交" />
    </el-steps>

    <!-- 用 v-show 保留已填表单实例，切换步骤不丢数据 -->
    <div v-show="step === 0">
      <es-form ref="form0" :model="model" :form-item-list="step0Items" :layout-form-props="layout" :rules="step0Rules" />
    </div>
    <div v-show="step === 1">
      <es-form ref="form1" :model="model" :form-item-list="step1Items" :layout-form-props="layout" :rules="step1Rules" />
    </div>

    <div v-if="step === 2" style="padding: 4px 8px; line-height: 2.2;">
      <div>账号：<b>{{ model.account }}</b></div>
      <div>邮箱：<b>{{ model.email }}</b></div>
      <div>企业名称：<b>{{ model.company }}</b></div>
      <div>统一社会信用代码：<b>{{ model.creditCode }}</b></div>
      <div>所属行业：<b>{{ industryLabel }}</b></div>
    </div>

    <div style="text-align: right; margin-top: 24px;">
      <el-button v-if="step > 0" @click="prev">上一步</el-button>
      <el-button v-if="step < 2" type="primary" @click="next">下一步</el-button>
      <el-button v-if="step === 2" type="success" @click="submit">提交</el-button>
    </div>
  </div>
</template>

<script lang="jsx">
/**
 * 分步表单（组合）—— el-steps + 多个 EsForm 分步校验 + 核对提交
 *
 * 关键点：
 *   1. 多个 EsForm 共用一个 model，各步用独立 form-item-list 与 rules
 *   2. 用模板 ref（form0/form1）拿到 EsForm 实例，「下一步」前 await validate() 当前步
 *   3. v-show 保留表单实例，切换步骤不清空已填数据；末步用 v-if 渲染核对信息
 */
import { defineComponent, reactive, ref, computed } from '@vue/composition-api'
import { Message } from 'element-ui'

const industryOptions = [
  { label: '互联网', value: 'internet' },
  { label: '制造业', value: 'manufacturing' },
  { label: '金融', value: 'finance' }
]

export default defineComponent({
  name: 'CombinationStepForm',
  setup() {
    const step = ref(0)
    const form0 = ref(null)
    const form1 = ref(null)

    const model = reactive({
      account: '',
      email: '',
      company: '',
      creditCode: '',
      industry: ''
    })

    const step0Items = [
      { prop: 'account', label: '账号', span: 24, formtype: 'Input', attrs: { placeholder: '请输入账号' } },
      { prop: 'email', label: '邮箱', span: 24, formtype: 'Input', attrs: { placeholder: '请输入邮箱' } }
    ]
    const step0Rules = {
      account: [{ required: true, message: '请输入账号', trigger: 'blur' }],
      email: [
        { required: true, message: '请输入邮箱', trigger: 'blur' },
        { type: 'email', message: '邮箱格式不正确', trigger: 'blur' }
      ]
    }

    const step1Items = [
      { prop: 'company', label: '企业名称', span: 24, formtype: 'Input', attrs: { placeholder: '请输入企业名称' } },
      { prop: 'creditCode', label: '信用代码', span: 24, formtype: 'Input', attrs: { placeholder: '统一社会信用代码' } },
      {
        prop: 'industry',
        label: '所属行业',
        span: 24,
        formtype: 'Select',
        attrs: { style: 'width:100%', placeholder: '请选择行业' },
        dataOptions: industryOptions
      }
    ]
    const step1Rules = {
      company: [{ required: true, message: '请输入企业名称', trigger: 'blur' }],
      creditCode: [{ required: true, message: '请输入信用代码', trigger: 'blur' }],
      industry: [{ required: true, message: '请选择行业', trigger: 'change' }]
    }

    const layout = { fromLayProps: { labelWidth: '120px', size: 'small' } }

    const industryLabel = computed(
      () => industryOptions.find((o) => o.value === model.industry)?.label || '—'
    )

    const next = async () => {
      const formRef = step.value === 0 ? form0.value : form1.value
      const ok = await formRef?.validate()
      if (ok) step.value += 1
    }
    const prev = () => { step.value -= 1 }
    const submit = () => {
      Message.success('提交成功')
      step.value = 0
    }

    return {
      step, form0, form1, model,
      step0Items, step0Rules, step1Items, step1Rules,
      layout, industryLabel, next, prev, submit
    }
  }
})
</script>
