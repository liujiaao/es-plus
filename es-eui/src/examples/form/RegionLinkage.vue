<template>
  <es-form
    ref="regionForm"
    :form-item-list="formItemList"
    :model="formData"
    :layout-form-props="layoutProps"
    :config-btn="configBtn"
  />
</template>

<script>
export default {
  name: 'FormRegionLinkage',
  data() {
    return {
      formData: {
        region: [],
        address: ''
      },
      layoutProps: {
        fromLayProps: { labelWidth: '100px', size: 'small' },
        rowLayProps: { gutter: 20 }
      },
      configBtn: [
        {
          name: '提交',
          type: 'primary',
          click: (model) => {
            this.$message.success('提交成功！')
            console.log('表单数据:', model)
          }
        },
        {
          name: '重置',
          click: (model, formRef) => {
            formRef.resetFields()
          }
        }
      ],
      formItemList: [
        {
          prop: 'region',
          label: '省市区',
          span: 24,
          formtype: 'Cascader',
          attrs: {
            placeholder: '请选择省市区',
            props: {
              value: 'code',
              label: 'name',
              children: 'children',
              checkStrictly: false
            },
            clearable: true,
            filterable: true
          },
          dataOptions: [
            {
              code: '110000',
              name: '北京市',
              children: [
                {
                  code: '110100',
                  name: '市辖区',
                  children: [
                    { code: '110101', name: '东城区' },
                    { code: '110102', name: '西城区' },
                    { code: '110105', name: '朝阳区' },
                    { code: '110106', name: '丰台区' },
                    { code: '110107', name: '石景山区' },
                    { code: '110108', name: '海淀区' }
                  ]
                }
              ]
            },
            {
              code: '310000',
              name: '上海市',
              children: [
                {
                  code: '310100',
                  name: '市辖区',
                  children: [
                    { code: '310101', name: '黄浦区' },
                    { code: '310104', name: '徐汇区' },
                    { code: '310105', name: '长宁区' },
                    { code: '310106', name: '静安区' },
                    { code: '310107', name: '普陀区' },
                    { code: '310109', name: '虹口区' }
                  ]
                }
              ]
            },
            {
              code: '440000',
              name: '广东省',
              children: [
                {
                  code: '440100',
                  name: '广州市',
                  children: [
                    { code: '440103', name: '荔湾区' },
                    { code: '440104', name: '越秀区' },
                    { code: '440105', name: '海珠区' },
                    { code: '440106', name: '天河区' },
                    { code: '440111', name: '白云区' }
                  ]
                },
                {
                  code: '440300',
                  name: '深圳市',
                  children: [
                    { code: '440303', name: '罗湖区' },
                    { code: '440304', name: '福田区' },
                    { code: '440305', name: '南山区' },
                    { code: '440306', name: '宝安区' },
                    { code: '440307', name: '龙岗区' }
                  ]
                }
              ]
            }
          ],
          on: {
            change: (value) => {
              console.log('省市区选择变化:', value)
            }
          }
        },
        {
          prop: 'address',
          label: '详细地址',
          span: 24,
          formtype: 'Input',
          attrs: {
            placeholder: '请输入详细地址',
            type: 'textarea',
            rows: 2
          }
        }
      ]
    }
  }
}
</script>
