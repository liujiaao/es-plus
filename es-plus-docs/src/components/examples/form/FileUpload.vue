<template>
  <div class="example-form-file-upload">
    <es-form
      ref="formRef"
      :model="formModel"
      :form-item-list="formItems"
      :config-btn="configBtn"
      :layout-form-props="layoutProps"
    />

    <el-dialog v-model="txtPreviewVisible" title="文本内容预览" width="600px" :close-on-click-modal="true">
      <pre class="txt-preview-content">{{ txtPreviewContent }}</pre>
    </el-dialog>
  </div>
</template>

<script setup lang="ts">
import { ref, reactive } from 'vue'
import { ElMessage } from 'element-plus'
import { UploadFilled, PictureFilled, Document, FolderOpened, View, Download, Delete } from '@element-plus/icons-vue'
import { EsForm } from 'es-plus'
import type { BtnConfig } from 'es-plus'

const formRef = ref()
const formModel = reactive<{ files: any[] }>({ files: [] })
const txtPreviewVisible = ref(false)
const txtPreviewContent = ref('')

const formatFileSize = (bytes: number): string => {
  if (!bytes || bytes === 0) return '0 B'
  const k = 1024
  const sizes = ['B', 'KB', 'MB', 'GB']
  const i = Math.floor(Math.log(bytes) / Math.log(k))
  return parseFloat((bytes / Math.pow(k, i)).toFixed(2)) + ' ' + sizes[i]
}

const getExtension = (filename: string): string =>
  (filename || '').split('.').pop()?.toLowerCase() || ''

const imageExtensions = ['jpg', 'jpeg', 'png', 'gif', 'webp', 'svg', 'bmp', 'ico']
const officeExtensions = ['xls', 'xlsx', 'doc', 'docx', 'ppt', 'pptx']

const isPreviewable = (filename: string): boolean => {
  const ext = getExtension(filename)
  return imageExtensions.includes(ext) || ext === 'pdf' || ext === 'txt' || officeExtensions.includes(ext)
}

const isZipFile = (filename: string): boolean => {
  const ext = getExtension(filename)
  return ext === 'zip' || ext === 'rar' || ext === '7z' || ext === 'gz'
}

const getFileIconComponent = (filename: string) => {
  const ext = getExtension(filename)
  if (imageExtensions.includes(ext)) return PictureFilled
  if (ext === 'zip' || ext === 'rar' || ext === '7z') return FolderOpened
  return Document
}

const getFileIconClass = (filename: string): string => {
  const ext = getExtension(filename)
  if (imageExtensions.includes(ext)) return 'type-image'
  if (ext === 'pdf') return 'type-pdf'
  if (ext === 'xls' || ext === 'xlsx') return 'type-xls'
  if (ext === 'doc' || ext === 'docx') return 'type-doc'
  if (ext === 'ppt' || ext === 'pptx') return 'type-ppt'
  if (ext === 'txt') return 'type-txt'
  if (ext === 'zip' || ext === 'rar' || ext === '7z') return 'type-zip'
  return 'type-other'
}

const handlePreview = (file: any) => {
  const ext = getExtension(file.name || '')
  const url = file.url || file.link
  if (!url) {
    ElMessage.warning('文件地址不存在')
    return
  }
  if (imageExtensions.includes(ext) || ext === 'pdf') {
    window.open(url, '_blank')
    return
  }
  if (ext === 'txt') {
    if (file.raw) {
      const reader = new FileReader()
      reader.readAsText(file.raw)
      reader.onload = () => {
        txtPreviewContent.value = reader.result as string
        txtPreviewVisible.value = true
      }
      reader.onerror = () => ElMessage.error('读取文件失败')
    } else {
      fetch(url)
        .then(res => res.text())
        .then(text => {
          txtPreviewContent.value = text
          txtPreviewVisible.value = true
        })
        .catch(() => ElMessage.error('读取文件失败'))
    }
    return
  }
  if (officeExtensions.includes(ext)) {
    ElMessage.info(`"${file.name}" 为 Office 文档，浏览器无法直接预览，请使用下载功能`)
    return
  }
}

const handleDownload = (file: any) => {
  const url = file.url || file.link
  if (!url) {
    ElMessage.warning('文件地址不存在')
    return
  }
  const a = document.createElement('a')
  a.href = url
  a.download = file.name || 'download'
  document.body.appendChild(a)
  a.click()
  document.body.removeChild(a)
  ElMessage.success(`正在下载: ${file.name}`)
}

const formItems = [
  {
    prop: 'files',
    label: '文件上传',
    span: 24,
    formtype: 'Upload' as const,
    props: {
      action: '/api/upload',
      accept: 'image/*,.xls,.xlsx,.doc,.docx,.pdf,.ppt,.pptx,.txt,.zip,.rar,.7z',
      listType: 'text' as const,
      multiple: true,
      showFileList: true,
      limit: 10,
      onExceed: () => {
        ElMessage.warning('最多只能上传10个文件')
      }
    },
    // 只 resolve Promise，不调用 options.onSuccess，避免触发两次
    httpRequest: (options: any) => {
      return new Promise((resolve, reject) => {
        const file = options.file
        const reader = new FileReader()
        reader.readAsDataURL(file)
        reader.onload = () => {
          const base64Data = reader.result as string
          const byteString = atob(base64Data.split(',')[1])
          const mimeString = base64Data.split(',')[0].split(':')[1].split(';')[0]
          const ab = new ArrayBuffer(byteString.length)
          const ia = new Uint8Array(ab)
          for (let i = 0; i < byteString.length; i++) {
            ia[i] = byteString.charCodeAt(i)
          }
          const blob = new Blob([ab], { type: mimeString })
          const blobUrl = URL.createObjectURL(blob)
          resolve({ url: blobUrl, link: blobUrl, filename: file.name, size: file.size })
        }
        reader.onerror = () => reject(new Error('文件读取失败'))
      })
    },
    triggerRender: (h: any) => {
      return h(
        'div',
        { class: 'upload-trigger-area' },
        [
          h(UploadFilled, { style: { fontSize: '18px', marginRight: '6px', color: '#409eff' } }),
          h('span', { style: { fontSize: '14px', color: '#606266' } }, '点击上传文件'),
          h('span', { style: { fontSize: '12px', color: '#909399', marginLeft: '12px' } }, '支持图片、PDF、TXT、Word、Excel、PPT、ZIP 等格式')
        ]
      )
    },
    // 自定义文件列表项渲染
    fileRender: (h: any, file: any, onRemove: () => void) => {
      const iconComponent = getFileIconComponent(file.name)
      const iconClass = getFileIconClass(file.name)
      const isSuccess = file.status === 'success'

      return h('div', {
        class: 'upload-file-item',
      }, [
        // 文件图标
        h('span', { class: ['file-icon-wrap', iconClass] }, [h(iconComponent)]),

        // 文件信息
        h('div', { class: 'file-meta' }, [
          h('span', { class: 'file-name' }, file.name),
          isSuccess
            ? h('span', { class: 'file-size' }, formatFileSize(file.size))
            : h('span', { class: 'file-status' },
                file.status === 'uploading' ? `上传中 ${file.percentage || 0}%` : '等待上传')
        ]),

        // 操作按钮 (仅上传成功后显示)
        isSuccess
          ? h('div', { class: 'file-actions' }, [
              isPreviewable(file.name)
                ? h('span', {
                    class: 'file-action-btn preview-btn',
                    onClick: (e: Event) => { e.stopPropagation(); handlePreview(file) }
                  }, [
                    h('span', { class: 'btn-icon' }, [h(View)]),
                    '预览'
                  ])
                : null,
              isZipFile(file.name)
                ? h('span', { class: 'file-action-btn preview-btn disabled' }, [
                    h('span', { class: 'btn-icon' }, [h(View)]),
                    '预览'
                  ])
                : null,
              h('span', {
                class: 'file-action-btn download-btn',
                onClick: (e: Event) => { e.stopPropagation(); handleDownload(file) }
              }, [
                h('span', { class: 'btn-icon' }, [h(Download)]),
                '下载'
              ]),
              h('span', {
                class: 'file-action-btn delete-btn',
                onClick: (e: Event) => { e.stopPropagation(); onRemove() }
              }, [
                h('span', { class: 'btn-icon' }, [h(Delete)]),
                '删除'
              ])
            ])
          : null
      ])
    },
    on: {
      success: (response: any, file: any) => {
        // Element Plus 把 httpRequest resolve 值传给 response
        // 手动把 url 绑定到 file 对象上，供 preview/download 使用
        file.url = response.url
        file.link = response.link
        // 同步到 formModel
        const all = file.raw?.parentList || []
        formModel.files = all
          .filter((f: any) => f.status === 'success')
          .map((f: any) => ({ name: f.name, size: f.size, url: f.url, link: f.url, raw: f.raw, status: f.status }))
      },
      remove: (_file: any, uploadFiles: any[]) => {
        formModel.files = uploadFiles
          .filter((f: any) => f.status === 'success')
          .map((f: any) => ({ name: f.name, size: f.size, url: f.url, link: f.url, raw: f.raw, status: f.status }))
      }
    }
  }
]

const configBtn: BtnConfig[] = [
  {
    name: '提交',
    type: 'primary',
    direction: 'right',
    icon: 'Check',
    click: (model: Record<string, unknown>) => {
      const files = (model.files as any[]) || []
      if (files.length === 0) {
        ElMessage.warning('请先上传文件')
        return
      }
      const names = files.map((f: any) => f.name).join('、')
      ElMessage.success(`提交成功！已上传 ${files.length} 个文件: ${names}`)
      console.log('表单数据:', model)
    }
  },
  {
    name: '重置',
    direction: 'right',
    icon: 'RefreshLeft',
    click: (_: unknown, formRefInstance: { resetFields: () => void } | null) => {
      formRefInstance?.resetFields()
      formModel.files = []
      ElMessage.info('已重置')
    }
  }
]

const layoutProps = {
  fromLayProps: {
    labelWidth: '100px',
    size: 'small'
  },
  rowLayProps: { gutter: 20 }
}
</script>

<style scoped>
.example-form-file-upload {
  padding: 20px;
}

.txt-preview-content {
  max-height: 400px;
  overflow: auto;
  padding: 16px;
  background-color: #f5f7fa;
  border-radius: 4px;
  font-size: 13px;
  line-height: 1.6;
  white-space: pre-wrap;
  word-break: break-all;
  margin: 0;
}
</style>

<!-- h() 渲染函数生成的 DOM 不带 data-v-xxx，scoped 无法匹配，统一放非 scoped 块 -->
<style>
.example-form-file-upload .upload-trigger-area {
  display: inline-flex;
  align-items: center;
  padding: 8px 16px;
  border: 1px dashed #dcdfe6;
  border-radius: 6px;
  cursor: pointer;
  transition: border-color 0.2s;
  flex-direction: column;
}

.example-form-file-upload .upload-trigger-area:hover {
  border-color: #409eff;
}

.example-form-file-upload .upload-file-item {
  display: flex;
  align-items: center;
  padding: 6px 0;
  border-bottom: 1px solid #f0f0f0;
}

.example-form-file-upload .file-icon-wrap {
  flex-shrink: 0;
  display: inline-flex;
  align-items: center;
  justify-content: center;
  width: 18px;
  height: 18px;
  margin-right: 8px;
}

.example-form-file-upload .file-icon-wrap svg {
  width: 18px !important;
  height: 18px !important;
}

.example-form-file-upload .type-image { color: #67c23a; }
.example-form-file-upload .type-pdf { color: #f56c6c; }
.example-form-file-upload .type-xls { color: #409eff; }
.example-form-file-upload .type-doc { color: #409eff; }
.example-form-file-upload .type-ppt { color: #e6a23c; }
.example-form-file-upload .type-txt { color: #909399; }
.example-form-file-upload .type-zip { color: #b88230; }
.example-form-file-upload .type-other { color: #909399; }

.example-form-file-upload .file-meta {
  flex: 1;
  min-width: 0;
  display: flex;
  flex-direction: column;
  gap: 1px;
}

.example-form-file-upload .file-name {
  font-size: 13px;
  color: #303133;
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
}

.example-form-file-upload .file-size {
  font-size: 12px;
  color: #909399;
}

.example-form-file-upload .file-status {
  font-size: 12px;
  color: #e6a23c;
}

.example-form-file-upload .file-actions {
  flex-shrink: 0;
  display: flex;
  gap: 3px;
  margin-left: 10px;
}

.example-form-file-upload .file-action-btn {
  display: inline-flex;
  align-items: center;
  padding: 3px 6px;
  font-size: 12px;
  border-radius: 4px;
  cursor: pointer;
  border: 1px solid transparent;
  transition: all 0.2s;
  user-select: none;
}

.example-form-file-upload .btn-icon {
  display: inline-flex;
  align-items: center;
  width: 12px;
  height: 12px;
  margin-right: 2px;
}

.example-form-file-upload .btn-icon svg {
  width: 12px !important;
  height: 12px !important;
}

.example-form-file-upload .preview-btn {
  color: #409eff;
  background: #ecf5ff;
  border-color: #d9ecff;
}

.example-form-file-upload .preview-btn:hover {
  color: #fff;
  background: #409eff;
}

.example-form-file-upload .preview-btn.disabled {
  color: #c0c4cc;
  background: #f5f7fa;
  border-color: #e4e7ed;
  cursor: not-allowed;
}

.example-form-file-upload .download-btn {
  color: #67c23a;
  background: #f0f9eb;
  border-color: #e1f3d8;
}

.example-form-file-upload .download-btn:hover {
  color: #fff;
  background: #67c23a;
}

.example-form-file-upload .delete-btn {
  color: #f56c6c;
  background: #fef0f0;
  border-color: #fde2e2;
}

.example-form-file-upload .delete-btn:hover {
  color: #fff;
  background: #f56c6c;
}
</style>