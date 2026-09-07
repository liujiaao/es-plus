<template>
  <es-form
    ref="remoteRegionForm"
    :form-item-list="formItemList"
    :model="formData"
    :layout-form-props="layoutProps"
  />
</template>

<script>
export default {
  name: 'FormRemoteRegionLinkage',
  data() {
    return {
      formData: {
        province: '',
        city: '',
        district: ''
      },
      layoutProps: {
        fromLayProps: { labelWidth: '100px', size: 'small' },
        rowLayProps: { gutter: 20 }
      },
      formItemList: [
        {
          prop: 'province',
          label: '省份',
          span: 8,
          formtype: 'Select',
          attrs: {
            placeholder: '请选择省份',
            clearable: true,
            filterable: true
          },
          apiParams: {
            url: 'https://jsonplaceholder.typicode.com/users',
            method: 'GET',
            options: {
              method: 'GET'
            }
          },
          httpRequest: (config) => {
            return new Promise((resolve, reject) => {
              const xhr = new XMLHttpRequest()
              xhr.open('GET', config.url, true)
              xhr.onload = () => {
                if (xhr.status >= 200 && xhr.status < 300) {
                  try {
                    const data = JSON.parse(xhr.responseText)
                    resolve({ data })
                  } catch (e) {
                    resolve({ data: [] })
                  }
                } else {
                  reject(new Error('Request failed'))
                }
              }
              xhr.onerror = () => reject(new Error('Network error'))
              xhr.send()
            })
          },
          listenToCallBack: {
            crtn: (data) => {
              console.log('省份crtn回调data///', data)
              if (Array.isArray(data)) {
                return data.slice(0, 10).map((item, index) => ({
                  label: item.address?.city || '省份' + (index + 1),
                  value: 'province_' + (index + 1)
                }))
              }
              return []
            }
          },
          on: {
            change: (value) => {
              this.formData.city = ''
              this.formData.district = ''
              console.log('省份变化///', value)
              this.$refs.remoteRegionForm.formItmeRequestInstance(['city'])
            }
          }
        },
        {
          prop: 'city',
          label: '城市',
          span: 8,
          formtype: 'Select',
          apiParams: {
            url: 'https://jsonplaceholder.typicode.com/posts',
            method: 'GET'
          },
          listenToCallBack: {
            crtn: (data) => {
              console.log('城市crtn回调data///', data)
              if (Array.isArray(data)) {
                return data.slice(0, 8).map((item, index) => ({
                  label: item.title?.substring(0, 6) || '城市' + (index + 1),
                  value: 'city_' + item.id
                }))
              }
              return []
            }
          },
          attrs: {
            placeholder: '请选择城市',
            clearable: true,
            filterable: true,
            disabled: () => !this.formData.province
          },
          dataOptions: [],
          on: {
            change: (value) => {
              this.formData.district = ''
              this.$refs.remoteRegionForm.formItmeRequestInstance(['district'])
            }
          }
        },
        {
          prop: 'district',
          label: '区县',
          span: 8,
          formtype: 'Select',
          apiParams: {
            url: 'https://jsonplaceholder.typicode.com/posts',
            method: 'GET'
          },
          listenToCallBack: {
            crtn: (data) => {
              console.log('城市crtn回调data///', data)
              if (Array.isArray(data)) {
                return data.slice(0, 8).map((item, index) => ({
                  label: item.title?.substring(0, 6) || '城市' + (index + 1),
                  value: 'city_' + item.id
                }))
              }
              return []
            }
          },
          attrs: {
            placeholder: '请选择区县',
            clearable: true,
            filterable: true,
            disabled: () => !this.formData.city
          },
          dataOptions: []
        }
      ]
    }
  }
}
</script>
