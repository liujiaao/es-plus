<template>
  <div class="example-form-upload">
    <es-form
      :model="formModel"
      :form-item-list="formItems"
      :config-btn="configBtn"
      :layout-form-props="layoutProps"
    />
  </div>
</template>

<script setup lang="ts">
import { reactive } from 'vue'
import { ElMessage } from 'element-plus'
import { Plus } from '@element-plus/icons-vue'
import EsForm from 'es-plus/components/es-form'

const formModel = reactive({
  gallery: [],
  description: ''
})

// 将 Base64 转换为 Blob
const dataURItoBlob = (dataURI: string) => {
  const byteString = atob(dataURI.split(',')[1])
  const mimeString = dataURI.split(',')[0].split(':')[1].split(';')[0]
  const ab = new ArrayBuffer(byteString.length)
  const ia = new Uint8Array(ab)
  for (let i = 0; i < byteString.length; i++) {
    ia[i] = byteString.charCodeAt(i)
  }
  return new Blob([ab], { type: mimeString })
}

const formItems = [
  {
    prop: 'description',
    label: '描述',
    span: 24,
    formtype: 'Input',
    attrs: {
      placeholder: '请输入描述信息'
    }
  },
  {
    prop: 'gallery',
    label: '相册',
    span: 24,
    formtype: 'Upload',
    // Upload 组件的属性配置
    props: {
      action: '/api/upload',
      accept: 'image/*',
      listType: 'picture-card',
      limit: 9,
      multiple: true,
      showFileList: true,
      onExceed: () => {
        ElMessage.warning('最多只能上传9张图片')
      }
    },
    // 自定义上传请求（必须在 props 外面）
    httpRequest: (options: { file: File }) => {
      return new Promise((resolve, reject) => {
        const file = options.file
        const reader = new FileReader()
        reader.readAsDataURL(file)
        reader.onload = () => {
          const base64Data = reader.result as string
          const blob = dataURItoBlob(base64Data)
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
    // 上传按钮渲染
    triggerRender: (h: any) => {
      return h('div', {
        style: {
          display: 'inline-block',
          width: '50px',
          height: '50px',
          
        }
      }, [
        h(Plus, {
          style: {
            fontSize: '28px',
            color: '#8c939d'
          }
        })
      ])
    },
    on: {
      success: (_response: any, file: any, fileList: any[]) => {
        console.log('上传成功:', file.name, fileList)
        formModel.gallery = [...fileList]
      },
      remove: (_file: any, fileList: any[]) => {
        formModel.gallery = [...fileList]
      },
      change: (_file: any, fileList: any[]) => {
        formModel.gallery = [...fileList]
      },
      preview: (file: any) => {
        if (file.url) {
          window.open(file.url, '_blank')
        }
      }
    }
  }
]

const configBtn = [
  {
    name: '提交',
    type: 'primary',
    direction: 'right',
    icon: 'Check',
    click: (model: Record<string, unknown>) => {
      const files = (model.gallery as any[]).map((f: any) => f.name).join(', ')
      ElMessage.success(`提交成功！已上传 ${files || 0} 个文件`)
      console.log('表单数据:', model)
    }
  },
  {
    name: '重置',
    direction: 'right',
    icon: 'RefreshLeft',
    click: (_: unknown, formRef: { resetFields: () => void } | null) => {
      formRef?.resetFields()
      ElMessage.info('已重置')
    }
  }
]

const layoutProps = {
  fromLayProps: {
    labelWidth: '100px',
    size: 'small'
  },
  rowLayProps: {
    gutter: 20
  }
}
</script>

<style scoped>
.example-form-upload {
  padding: 20px;
}
</style>
