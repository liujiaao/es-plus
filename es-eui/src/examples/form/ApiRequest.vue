<template>
  <es-form
    :form-item-list="formItemList"
    :model="formData"
    :layout-form-props="layoutProps"
  />
</template>

<script>
export default {
  name: 'FormApiRequest',
  data() {
    return {
      formData: {
        province: '',
        city: '',
        category: ''
      },
      layoutProps: {
        fromLayProps: { labelWidth: '100px', size: 'small' },
        rowLayProps: { gutter: 20 }
      },
      formItemList: [
        {
          prop: 'province',
          label: '远程选项',
          span: 8,
          formtype: 'Select',
          attrs: { placeholder: '请选择' },
          apiParams: {
            url: 'https://jsonplaceholder.typicode.com/posts',
            method: 'GET'
          },
          listenToCallBack: {
            crtn: (data) => {
              console.log('API 返回的数据为:', data)
              if (Array.isArray(data)) {
                return data.slice(0, 10).map(item => ({
                  label: item.title?.substring(0, 20) || item.name || '未知',
                  value: item.id
                }))
              }
              return []
            }
          }
        },
        {
          prop: 'city',
          label: '城市',
          span: 8,
          formtype: 'Select',
          attrs: { placeholder: '请选择城市' },
          dataOptions: [
            { label: '北京', value: 'beijing' },
            { label: '上海', value: 'shanghai' },
            { label: '广州', value: 'guangzhou' },
            { label: '深圳', value: 'shenzhen' }
          ]
        },
        {
          prop: 'category',
          label: '远程选项2',
          span: 8,
          formtype: 'Select',
          attrs: { placeholder: '请选择' },
          apiParams: {
            url: 'https://jsonplaceholder.typicode.com/users',
            method: 'GET'
          },
          listenToCallBack: {
            crtn: (data) => {
              if (Array.isArray(data)) {
                return data.slice(0, 10).map(item => ({
                  label: item.name || '未知',
                  value: item.id
                }))
              }
              return []
            }
          }
        }
      ]
    }
  }
}
</script>
