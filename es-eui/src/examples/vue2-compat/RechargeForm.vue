<template>
  <es-form
    ref="formRef"
    :model="model"
    :form-item-list="formItems"
    :rules="rules"
    :layout-form-props="layoutFormProps"
  />
</template>

<script>
/**
 * 充值新增表单组件
 *
 * 设计要点：
 *   1. 用 Options API 编写（避开 Composition API + JSX + babel-sugar 的兼容性坑）
 *   2. 内部使用 @es-plus/vue2 的 <es-form>，与 index.vue 主页表单保持一致风格
 *   3. 凭证图片用 EsForm 内置的 formtype: 'Upload'，搭配 listType: 'picture-card'
 *   4. expose validate() / getModel() / resetModel() 给父组件（弹窗按钮通过
 *      $refs 调用，提交流程清晰）
 *
 * 与 mcp-server 的 generate-from-config 工具对齐：组件输出形态等价于该工具
 * 接收 { fields: [...] } 后产出的 SFC（差别仅在注释和默认值上）。
 */

const methodOptions = [
  { label: '微信支付', value: '微信支付' },
  { label: '支付宝', value: '支付宝' },
  { label: '银行卡', value: '银行卡' },
  { label: '余额', value: '余额' }
]

export default {
  name: 'RechargeForm',
  props: {
    /** 编辑场景下的初值（新增场景传 {} 或不传） */
    initial: {
      type: Object,
      default: () => ({})
    }
  },
  data() {
    return {
      model: this.buildInitialModel(),
      formItems: [
        {
          prop: 'customerName',
          label: '客户姓名',
          formtype: 'Input',
          span: 12,
          attrs: { clearable: true, placeholder: '请输入客户姓名', maxlength: 30 }
        },
        {
          prop: 'phone',
          label: '手机号',
          formtype: 'Input',
          span: 12,
          attrs: { clearable: true, placeholder: '请输入手机号', maxlength: 11 }
        },
        {
          prop: 'amount',
          label: '充值金额',
          formtype: 'InputNumber',
          span: 12,
          props: { min: 0.01, precision: 2, step: 100, controlsPosition: 'right' },
          attrs: { placeholder: '请输入充值金额', style: 'width:100%' }
        },
        {
          prop: 'method',
          label: '充值方式',
          formtype: 'Select',
          span: 12,
          attrs: { clearable: true, placeholder: '请选择充值方式', style: 'width:100%' },
          dataOptions: methodOptions
        },
        {
          prop: 'voucher',
          label: '凭证图片',
          formtype: 'Upload',
          span: 24,
          props: {
            listType: 'picture-card',
            accept: 'image/png,image/jpeg,image/jpg',
            limit: 3,
            // 演示用 mock httpRequest：返回带 link 字段的 fake 响应
            // 真实场景里替换成业务后端的上传接口（formData / 签名等）
          },
           // 自定义上传触发元素
          triggerRender: (h) => {
            return h('div', {
              style: {
                display: 'inline-block',
                width: '148px',
                height: '148px',
                lineHeight: '146px'
              }
            }, [
              h('i', {
                class: 'el-icon-plus',
                style: {
                  fontSize: '28px',
                  color: '#8c939d'
                }
              })
            ])
          },
            on: {
            // 上传成功回调
            success: (response, file, fileList) => {
              console.log('上传成功:', response)
            },
            // 删除文件回调
            remove: (file, fileList) => {
              //this.formData.gallery = [...fileList]
            },
            // 文件变化回调
            change: (file, fileList) => {
             // this.formData.gallery = [...fileList]
            },
            // 预览回调 - 点击放大镜按钮触发
            preview: (file) => {
              if (file.url) {
                console.log('预览文件:', file.url)
                // 示例：使用 Element UI 的图片预览功能
                this.$alert(`<img src="${file.url}" style="width:100%;"/>`, '图片预览', {
                  dangerouslyUseHTMLString: true,
                  closeOnClickModal: true
                })
              }
            }
          },
          // 自定义上传：不走 action 直传，自己处理 file，返回 link
          httpRequest: ({ file }) => {
            return new Promise((resolve) => {
              const reader = new FileReader()
              reader.onload = (e) => {
                // 真实环境改成 axios.post('/upload', formData) 之类
                resolve({ link: e.target.result, filename: file.name })
              }
              reader.readAsDataURL(file)
            })
          }
        },
        {
          prop: 'remark',
          label: '备注',
          formtype: 'Input',
          span: 24,
          attrs: {
            type: 'textarea',
            rows: 3,
            maxlength: 200,
            showWordLimit: true,
            placeholder: '请输入备注（可选）'
          }
        }
      ],
      rules: {
        customerName: [
          { required: true, message: '请输入客户姓名', trigger: 'blur' }
        ],
        phone: [
          { required: true, message: '请输入手机号', trigger: 'blur' },
          { pattern: /^1[3-9]\d{9}$/, message: '手机号格式不正确', trigger: 'blur' }
        ],
        amount: [
          { required: true, message: '请输入充值金额', trigger: 'blur' },
          { type: 'number', min: 0.01, message: '金额必须大于 0', trigger: 'blur' }
        ],
        method: [
          { required: true, message: '请选择充值方式', trigger: 'change' }
        ],
        voucher: [
          {
            required: true,
            validator: (_, value, cb) => {
              if (!Array.isArray(value) || value.length === 0) {
                return cb(new Error('请上传至少一张凭证图片'))
              }
              cb()
            },
            trigger: 'change'
          }
        ]
      },
      layoutFormProps: {
        formLayProps: {
          labelWidth: '90px',
           showMessage:false,
           statusIcon:false,
          // 弹窗里不需要查询表单的折叠/按钮区
          isBtnHidden: true
        }
      }
    }
  },
  watch: {
    initial: {
      immediate: false,
      deep: true,
      handler(val) {
        this.model = this.buildInitialModel(val)
      }
    }
  },
  methods: {
    buildInitialModel(src) {
      const seed = src || this.initial || {}
      return {
        customerName: seed.customerName || '',
        phone: seed.phone || '',
        amount: seed.amount ?? null,
        method: seed.method || '',
        voucher: Array.isArray(seed.voucher) ? [...seed.voucher] : [],
        remark: seed.remark || ''
      }
    },
    /** 给父组件调：返回 Promise<true|false> */
    validate() {
      const formInstance = this.$refs.formRef
      if (!formInstance) return Promise.resolve(false)
      // EsForm 内部封装了 el-form，直接调 validate；兼容 callback / promise 双签名
      return new Promise((resolve) => {
        const tryValidate = formInstance.validate || formInstance.$refs?.elFormRef?.validate
        if (typeof tryValidate !== 'function') return resolve(false)
        tryValidate.call(formInstance, (valid) => resolve(!!valid))
      })
    },
    /** 给父组件调：拿当前 model 快照 */
    getModel() {
      // 浅拷贝避免外部直接 mutate 内部状态
      return { ...this.model, voucher: [...this.model.voucher] }
    },
    /** 给父组件调：重置 */
    resetModel() {
      this.model = this.buildInitialModel()
      const formInstance = this.$refs.formRef
      const reset = formInstance?.resetFields || formInstance?.$refs?.elFormRef?.resetFields
      if (typeof reset === 'function') reset.call(formInstance)
    }
  }
}
</script>
