<template>
  <div>
    <el-button type="primary" @click="openNativeFormDialog">打开表单弹窗</el-button>
  </div>
</template>

<script>
import Vue from 'vue'
import { useDialog } from '@es-plus/vue2'

const dialog = useDialog()

export default {
  methods: {
    openNativeFormDialog() {
      const formData = Vue.observable({
        name: '',
        email: ''
      })
      let formRef = null

      dialog({
        title: '原生表单弹窗',
        key: 'nativeFormDialog',
        width: '500px',
        render: (h) => {
          return (
            <el-form
              ref="nativeForm"
              props={{ model: formData }}
              label-width="80px"
              size="small"
            >
              <el-form-item
                label="姓名"
                prop="name"
                rules={[{ required: true, message: '请输入姓名', trigger: 'blur' }]}
              >
                <el-input
                  attrs={{ value: formData.name }}
                  on={{
                    input: (val) => {
                      formData.name = val
                      if (formRef) formRef.clearValidate('name')
                    }
                  }}
                  placeholder="请输入姓名"
                />
              </el-form-item>
              <el-form-item
                label="邮箱"
                prop="email"
                rules={[
                  { required: true, message: '请输入邮箱', trigger: 'blur' },
                  { type: 'email', message: '邮箱格式错误', trigger: 'blur' }
                ]}
              >
                <el-input
                  attrs={{ value: formData.email }}
                  on={{
                    input: (val) => {
                      formData.email = val
                      if (formRef) formRef.clearValidate('email')
                    }
                  }}
                  placeholder="请输入邮箱"
                />
              </el-form-item>
            </el-form>
          )
        },
        configBtn: [
          {
            name: '取消',
            key: 'cancel',
            click: (instance, { close }) => close()
          },
          {
            name: '确定',
            type: 'primary',
            key: 'confirm',
            click: (instance, { close, getRefs }) => {
              formRef = getRefs('nativeForm')
              formRef.validate((valid) => {
                if (valid) {
                  this.$message.success(`提交成功: ${formData.name} / ${formData.email}`)
                  close()
                }
              })
            }
          }
        ]
      })
    }
  }
}
</script>
