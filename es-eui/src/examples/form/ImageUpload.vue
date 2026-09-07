<template>
  <es-form
    ref="uploadForm"
    :key="uploadKey"
    :form-item-list="formItemList"
    :model="formData"
    :layout-form-props="layoutProps"
  />
</template>

<script>
import { useDialog } from '@es-plus/vue2'

const dialogImageUrl = useDialog()

export default {
  name: 'FormImageUpload',
  data() {
    return {
      uploadKey: 0,
      formData: {
        avatar: [],
        name: ''
      },
      layoutProps: {
        fromLayProps: { labelWidth: '100px', size: 'small' },
        rowLayProps: { gutter: 20 }
      },
      formItemList: [
        {
          prop: 'name',
          label: '名称',
          span: 24,
          formtype: 'Input',
          attrs: {
            placeholder: '请输入名称'
          }
        },
        {
          prop: 'avatar',
          label: '头像',
          span: 24,
          formtype: 'Upload',
          props: {
            action: '/api/upload',
            accept: 'image/*',
            listType: 'picture-card',
            limit: 1,
            showFileList: true,
            onExceed: () => {
              this.$message.warning('最多只能上传1张图片')
            }
          },
          httpRequest: (options) => {
            return new Promise((resolve, reject) => {
              const file = options.file
              const reader = new FileReader()
              reader.readAsDataURL(file)
              reader.onload = () => {
                const base64Data = reader.result
                const blob = this.dataURItoBlob(base64Data)
                const blobUrl = URL.createObjectURL(blob)

                const result = {
                  success: true,
                  link: blobUrl,
                  url: blobUrl,
                  filename: file.name
                }
                resolve({ data: result })
              }
              reader.onerror = () => {
                reject(new Error('文件读取失败'))
              }
            })
          },
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
            success: (response, file, fileList) => {
              console.log('上传成功:', response, file, fileList)
            },
            remove: (file, fileList) => {
              this.formData.avatar = [...fileList]
            },
            change: (file, fileList) => {
              this.formData.avatar = [...fileList]
            },
            preview: (file) => {
              if (file.url) {
                console.log('预览文件:', file.url)
                dialogImageUrl({
                  title: '图片预览',
                  key: 'dialogImageUrl1',
                  render: () => <img width="100%" src={file.url} alt="" />
                })
              }
            }
          }
        }
      ]
    }
  },
  methods: {
    dataURItoBlob(dataURI) {
      const mimeString = dataURI.split(',')[0].split(':')[1].split(';')[0]
      const byteString = atob(dataURI.split(',')[1])
      const arrayBuffer = new ArrayBuffer(byteString.length)
      const uint8Array = new Uint8Array(arrayBuffer)
      for (let i = 0; i < byteString.length; i++) {
        uint8Array[i] = byteString.charCodeAt(i)
      }
      return new Blob([arrayBuffer], { type: mimeString })
    },
    createBlobUrl(blob) {
      return URL.createObjectURL(blob)
    }
  }
}
</script>
