<template>
  <div>
    <es-form
      :form-item-list="formItemList"
      :model="formData"
      :config-btn="configBtn"
    />
    <p class="tip">
      打开「需要邮箱」后，邮箱字段出现并要求必填；关闭后字段隐藏且不再参与校验 ——
      规则随 <code>formData.requireEmail</code> 实时变化，无需重建表单实例。
    </p>
  </div>
</template>

<script>
/**
 * 动态校验规则：formItemList 用 computed 派生，
 * 规则数组跟着 formData 变化，EsForm 侦听到新列表后按新规则重新渲染/校验。
 */
export default {
  name: 'FormDynamicRule',
  data() {
    return {
      formData: {
        name: '',
        email: '',
        requireEmail: false
      },
      configBtn: [
        {
          name: '校验并提交',
          type: 'primary',
          click: (model, formRef) => {
            formRef.validate((valid) => {
              if (valid) this.$message.success('校验通过，提交数据：' + JSON.stringify(model))
              else this.$message.error('请检查表单填写')
            })
          }
        }
      ]
    }
  },
  computed: {
    formItemList() {
      // 显式读一次 requireEmail：规则数组是在 computed 求值时算出来的，
      // 不读这个开关就不会建立依赖 —— 列表永远缓存首帧的 []，开关拨了也不重算。
      const requireEmail = this.formData.requireEmail
      return [
        {
          prop: 'name',
          label: '姓名',
          span: 12,
          formtype: 'Input',
          formItemOptions: {
            rules: [{ required: true, message: '请输入姓名' }]
          }
        },
        {
          prop: 'requireEmail',
          label: '需要邮箱',
          span: 12,
          formtype: 'Switch'
        },
        {
          prop: 'email',
          label: '邮箱',
          span: 12,
          formtype: 'Input',
          isHidden: () => !this.formData.requireEmail,
          formItemOptions: {
            rules: requireEmail
              ? [
                  { required: true, message: '请输入邮箱' },
                  { type: 'email', message: '邮箱格式错误' }
                ]
              : []
          }
        }
      ]
    }
  }
}
</script>

<style scoped>
.tip {
  margin-top: 8px;
  font-size: 12px;
  color: #909399;
}
</style>
