<template>
  <div class="uploader-card-container">
    <div
      v-if="showFileList && internalFileList.length > 0"
      class="file-list"
    >
      <div 
        v-for="(file, index) in internalFileList" 
        :key="file.uid || index"
        class="file-item"
        :style="uploadCardStyle"
      >
        <img 
          :src="file.url" 
          class="file-image"
          :alt="file.name"
        />
        <div class="file-actions">
          <i 
            class="el-icon-zoom-in"
            title="查看"
            @click="handlePreview(file)"
          ></i>
          <i 
            v-if="!disabled"
            class="el-icon-delete"
            title="删除"
            @click="handleRemove(file, internalFileList)"
          ></i>
        </div>
        <div
          v-show="file.status === 'uploading'"
          class="file-status"
        >
          <el-progress 
            type="circle" 
            :percentage="file.percentage || 0" 
            :width="60"
          />
        </div>
      </div>
    </div>
    <!-- :before-upload="beforeUpload" -->
    <el-upload
      v-else
      :action="action"
      :file-list="internalFileList"
      :accept="accept"
      :multiple="multiple"
      :limit="limit"
      :disabled="disabled || loading"
      @success="handleSuccess"
      :headers="headers"
      @error="handleError"
      :data="data"
      @progress="handleProgress"
      :show-file-list="false"
      @change="handleChange"
      list-type="picture-card"
      @exceed="handleExceed"
      :style="uploadCardStyle"
      @remove="handleRemove"
      class="uploader-card"
      @preview="handlePreview"
      :http-request="httpRequest ? customUploadHandler : undefined"
    >
      <div
        v-if="loading"
        class="upload-loading"
      >
        <i class="el-icon-loading"></i>
        <span class="upload-progress">{{ Math.round(uploadProgress) }}%</span>
      </div>
      
      <div
        v-else-if="showUploadBtn"
        class="upload-trigger"
      >
        <i class="el-icon-plus"></i>
        <span class="upload-text">{{ uploadText }}</span>
      </div>
    </el-upload>
    <div
      v-if="showTips"
      class="upload-tips"
    >
      <p class="tips-text">
        {{ tipsText }}
      </p>
    </div>
    
    <!-- 图片预览对话框 -->
    <!-- <el-dialog
      :visible.sync="previewVisible"
      title="图片预览"
      :width="String(previewWidth)"
      top="5vh"
    >
      <div class="preview-container">
        <img 
          :src="previewImageUrl" 
          :style="{
            maxWidth: '100%',
            maxHeight: previewHeight + 'px',
            display: 'block',
            margin: '0 auto'
          }"
          alt="预览图片"
        />
      </div>
      <div slot="footer" class="dialog-footer">
        <el-button @click="closePreview">关闭</el-button>
      </div>
    </el-dialog> -->

    <!-- 使用 el-image 组件的预览功能 -->
    <!-- <el-image
      v-show="previewImageUrl"
      ref="previewImage"
   
      :src="previewImageUrl || ''"
      :preview-src-list="previewList.length ? previewList : []"
      :z-index="999999999"
    /> -->
  </div>
</template>

<script>
export default {
  name: 'UploaderCard',
  components: {
  },
  props: {
    // 上传接口地址
    action: {
      type: String,
      required: true
    },
    // 已上传的文件列表
    fileList: {
      type: Array,
      default: () => []
    },
    // 最大文件大小 (MB)
    maxSize: {
      type: Number,
      default: 4.7
    },
    // 允许的文件类型
    accept: {
      type: String,
      default: 'image/jpeg,image/jpg,image/png'
    },
    // 文件类型数组，用于校验
    acceptTypes: {
      type: Array,
      default: () => ['image/jpeg', 'image/jpg', 'image/png']
    },
    // 最大分辨率
    maxResolution: {
      type: Object,
      default: () => ({ width: 4096, height: 4096 })
    },
    // 上传视口宽度
    width: {
      type: Number,
      default: 120
    },
    // 上传视口高度
    height: {
      type: Number,
      default: 130
    },
    // 是否多选
    multiple: {
      type: Boolean,
      default: false
    },
    // 最大上传数量
    limit: {
      type: Number,
      default: 1
    },
    // 是否显示提示文字
    showTips: {
      type: Boolean,
      default: true
    },
    // 自定义请求头
    headers: {
      type: Object,
      default: () => ({})
    },
    // 上传时附带的额外参数
    data: {
      type: Object,
      default: () => ({})
    },
    // 是否禁用
    disabled: {
      type: Boolean,
      default: false
    },
    // 是否显示已上传文件列表
    showFileList: {
      type: Boolean,
      default: true
    },
    // 图片预览宽度
    previewWidth: {
      type: Number,
      default: 400
    },
    // 图片预览高度
    previewHeight: {
      type: Number,
      default: 300
    },
    // 自定义上传方法，覆盖默认上传行为
    httpRequest: {
      type: Function,
      default: null
    },
    uploadText: {
       type: String,
       default: '上传'
    }
  },
  data() {
    return {
      // 内部文件列表
      internalFileList: [],
      // 上传加载状态
      loading: false,
      // 预览对话框显示状态
      previewVisible: false,
      // 当前预览的图片URL
      previewImageUrl: '',
      // 上传进度
      uploadProgress: 0,
      previewList: []
    }
  },
  computed: {
    // 计算上传按钮是否应该显示
    showUploadBtn() {
      return this.internalFileList.length < this.limit
    },
    // 计算提示文字
    tipsText() {
      const maxSizeText = this.maxSize >= 1 ? `${this.maxSize}MB` : `${this.maxSize * 1024}KB`
      return `支持 ${this.getAcceptTypeText()} 格式；分辨率：最大 ${this.maxResolution.width} * ${this.maxResolution.height}；文件大小：最大 ${maxSizeText}；`
    },
    // 计算样式
    uploadCardStyle() {
      return {
        width: `${this.width}px`,
        height: `${this.height}px`
      }
    },
    // 调试计算属性
    debugInfo() {
      return {
        showFileList: this.showFileList,
        internalFileListLength: this.internalFileList.length,
        fileList: this.internalFileList,
        hasHttpRequest: !!this.httpRequest
      }
    }
  },
  watch: {
    fileList: {
      handler(newVal) {
        console.log('fileList prop changed:', newVal)
        this.internalFileList = newVal.map(file => ({
          ...file,
          url: file.url || file.response?.data?.url || file.response?.url || file.path
        }))

      },
      immediate: true,
      deep: true
    },
    // internalFileList: {
    //   handler(newVal) {
    //     this.$emit('update:fileList', newVal)
    //   },
    //   deep: true
    // }
  },
  methods: {
    // 获取接受的文件类型文本
    getAcceptTypeText() {
      const typeMap = {
        'image/jpeg': 'JPEG',
        'image/jpg': 'JPG',
        'image/png': 'PNG',
        'image/gif': 'GIF',
        'image/bmp': 'BMP'
      }
      return this.acceptTypes.map(type => typeMap[type] || type.split('/')[1].toUpperCase()).join('、')
    },

    // 文件选择前的校验
   async beforeUpload(file) {
      console.log('文件上传前校验:', file)
      
      // 文件类型校验
      const isValidType = this.validateFileType(file)
      if (!isValidType) {
        const errorMsg = `文件格式不正确，请上传 ${this.getAcceptTypeText()} 格式的文件`
        // this.$message.error(errorMsg)
        this.$emit('validate-error', { type: 'type', message: errorMsg, file })
        return {status: false, msg: errorMsg}
      }

      // 文件大小校验
      const isValidSize = this.validateFileSize(file)
      if (!isValidSize) {
        const maxSizeText = this.maxSize >= 1 ? `${this.maxSize}MB` : `${this.maxSize * 1024}KB`
        const errorMsg = `文件大小不能超过 ${maxSizeText}`
       // this.$message.error(errorMsg)
        this.$emit('validate-error', { type: 'size', message: errorMsg, file })
        return {status: false, msg: errorMsg}
      }

      // 图片分辨率校验
      if (this.isImageFile(file)) {
         console.log('jinglai//', this.validateImageResolution(file))
        return await this.validateImageResolution(file)
      }

      // 如果是自定义上传，手动添加文件到列表
      if (this.httpRequest) {
        console.log('📝 自定义上传模式，手动添加文件到列表')
        this.addFileToList(file)
      }

      return {status: true, msg: ''}
    },

    // 验证文件类型
    validateFileType(file) {
      const fileType = file.type
      const fileName = file.name.toLowerCase()
      
      // 检查文件类型
      if (this.acceptTypes.includes(fileType)) {
        return true
      }
      
      // 检查后缀名作为备选方案
      const acceptExtensions = this.acceptTypes.map(type => {
        const ext = type.split('/')[1]
        return ext === 'jpeg' ? ['jpeg', 'jpg'] : [ext]
      }).flat()
      
      return acceptExtensions.some(ext => fileName.endsWith(`.${ext}`))
    },

    // 验证文件大小
    validateFileSize(file) {
      const fileSizeMB = file.size / (1024 * 1024)
      return fileSizeMB <= this.maxSize
    },

    // 判断是否为图片文件
    isImageFile(file) {
      return file.type.startsWith('image/')
    },

    // 验证图片分辨率
    validateImageResolution(file) {
      return new Promise((resolve) => {
        const img = new Image()
        const reader = new FileReader()
        
        reader.onload = (e) => {
          img.src = e.target.result
          img.onload = () => {
            const { width, height } = img
            const { maxResolution } = this
            
            if (width > maxResolution.width || height > maxResolution.height) {
              const errorMsg = `图片分辨率不能超过 ${maxResolution.width} * ${maxResolution.height}，当前分辨率为 ${width} * ${height}`
            //  this.$message.error(errorMsg)
              this.$emit('validate-error', { 
                type: 'resolution', 
                message: errorMsg, 
                file,
                currentResolution: { width, height }
              })
              resolve({status:false, msg:errorMsg})
            } else {
              resolve({status:true, msg: ''})
            }
          }
          img.onerror = () => {
            const errorMsg = '图片格式不正确或文件已损坏'
           // this.$message.error(errorMsg)
            this.$emit('validate-error', { type: 'corrupt', message: errorMsg, file })
            resolve({status: false, msg: errorMsg})
          }
        }
        reader.onerror = () => {
          const errorMsg = '读取文件失败'
         // this.$message.error(errorMsg)
          this.$emit('validate-error', { type: 'read', message: errorMsg, file })
          resolve({status: false, msg: errorMsg})
        }
        reader.readAsDataURL(file)
      })
    },

    // 文件上传成功处理
    handleSuccess(response, file, fileList) {
      console.log('🎯 UploaderCard: 文件上传成功:', response, file, fileList)
      this.loading = false
      this.uploadProgress = 0
      
      // 确保响应数据有效
      if (!response) {
        console.error('❌ 上传响应数据无效:', response)
        this.$message.error('上传响应数据无效')
        return
      }
      
      // 构建文件对象
      const fileObj = {
        ...file,
        url: response.data?.url || response.url || response.path || file.url,
        response: response,
        status: 'success' // 确保状态为成功
      }
      
      console.log('📁 构建的文件对象:', fileObj)
      
      // 如果是自定义上传，确保文件在列表中
      if (this.httpRequest) {
        console.log('📝 自定义上传模式，更新文件列表')
        const existingIndex = this.internalFileList.findIndex(f => f.uid === file.uid)
        
        if (existingIndex >= 0) {
          // 更新现有文件
          this.internalFileList = this.internalFileList.map((f, index) =>
            index === existingIndex ? fileObj : f
          )
        } else {
          // 添加新文件
          this.internalFileList = [...this.internalFileList, fileObj]
        }
      } else {
        // 标准上传模式
        this.internalFileList = fileList.map(item => {
          if (item.uid === file.uid) {
            return fileObj
          }
          return item
        })
      }
      
      console.log('📋 更新后的文件列表:', this.internalFileList)
      this.$emit('update:fileList', this.internalFileList)
      this.$message.success('上传成功')
      
      // 触发 success 事件，确保传递正确的参数格式
      console.log('📤 准备触发 success 事件')
      this.$emit('success', {
        response,
        file: fileObj,
        fileList: this.internalFileList
      })
      
      // 触发 change 事件
      this.$emit('change', { file: fileObj, fileList: this.internalFileList })
      
      console.log('✅ UploaderCard: 上传成功处理完成')
    },

    // 文件上传失败处理
    handleError(error, file, fileList) {
      console.error('文件上传失败:', error, file, fileList)
      this.loading = false
      this.uploadProgress = 0
      
      let errorMessage = '上传失败'
      if (error && error.message) {
        errorMessage = error.message
      } else if (error && error.statusText) {
        errorMessage = error.statusText
      } else if (typeof error === 'string') {
        errorMessage = error
      } else if (error && typeof error === 'object') {
        errorMessage = JSON.stringify(error)
      }
      
      // 确保 file 对象存在且有效
      if (!file || !file.uid) {
        console.warn('上传失败: file 对象无效', file)
        return
      }
      
      // 确保 fileList 是数组
      if (!Array.isArray(fileList)) {
        fileList = this.internalFileList
      }
      
     this.$message.error(errorMessage)
      this.$emit('error', { error: errorMessage, file, fileList: fileList || this.internalFileList })
    },

    // 文件上传进度处理
    handleProgress(event, file, fileList) {
      this.uploadProgress = event.percent
      this.$emit('progress', { percent: event.percent, file, fileList })
    },

    // 文件状态改变处理
    handleChange(file, fileList) {
      console.log('📝 UploaderCard: 文件状态改变:', file, fileList)
      console.log('📝 UploaderCard: 当前 internalFileList:', this.internalFileList)
      console.log('📝 UploaderCard: fileList 参数:', fileList)
      
      // 确保文件对象有正确的 URL
      const updatedFileList = fileList.map(item => ({
        ...item,
        url: item.url || item.response?.data?.url || item.response?.url || item.path
      }))
      
      console.log('📝 UploaderCard: 更新前的文件列表:', this.internalFileList)
      this.internalFileList = updatedFileList
      console.log('📝 UploaderCard: 更新后的文件列表:', this.internalFileList)
      
      this.$emit('change', { file, fileList: updatedFileList })
      
      console.log('📋 UploaderCard: 更新后的内部文件列表:', this.internalFileList)
    },

    // 文件超出限制处理
    handleExceed(files, fileList) {
      const errorMsg = `最多只能上传 ${this.limit} 个文件，已选择 ${fileList.length} 个文件`
      this.$message.warning(errorMsg)
      this.$emit('exceed', { files, fileList, message: errorMsg })
    },

    // 文件移除处理
    handleRemove(file, fileList) {
      console.log('文件移除:', file, fileList)
      this.internalFileList = []
      this.$emit('update:fileList', this.internalFileList)
      this.$emit('remove', { file, fileList })
      this.$emit('delete', file) // 兼容旧版本
    },

    // 图片预览处理
    handlePreview(file) {
      this.previewImageUrl = file.url || file.response?.data?.url || file.response?.url || file.path
      this.previewList = [this.previewImageUrl]
      console.log('图片预览:', this.previewImageUrl)
          // 使用自定义弹窗预览图片
      this.$msgbox({
        title: '图片预览',
        message: this.$createElement('img', {
          attrs: {
            src: this.previewImageUrl,
            style: 'max-width: 100%; max-height: 80vh; display: block; margin: 0 auto;'
          }
        }),
        showConfirmButton: false,
        showCancelButton: false,
        closeOnClickModal: true,
        closeOnPressEscape: true,
        customClass: 'image-preview-msgbox',
        callback: () => {
          this.onClose()
        }
      })
      // 使用 el-image 的预览功能 - 延迟触发以确保组件渲染
      // this.$nextTick(() => {
      //   setTimeout(() => {
      //     const previewImage = this.$refs.previewImage
      //     console.log('previewImage:', previewImage)
      //     if (previewImage) {
      //       // 调用 el-image 的 showViewer 方法
      //       if (previewImage.showViewer) {
      //         console.log('Using showViewer method')
      //         previewImage.showViewer()
      //       } else if (previewImage.$el) {
      //         // 降级方案：点击图片元素
      //         console.log('Falling back to click on img')
      //         const imgEl = previewImage.$el.querySelector('img')
      //         if (imgEl) imgEl.click()
      //       } else {
      //         console.log('No showViewer or $el available')
      //       }
      //     } else {
      //       console.log('previewImage ref not found')
      //     }
      //   }, 200)
      // })
      // this.$emit('preview', { file, url: this.previewImageUrl })
    },

       // 预览关闭
    onClose() {
       this.previewImageUrl = ''
        this.previewList = []
       this.previewVisible = false
    },

    // 关闭预览
    closePreview() {
      this.previewVisible = false
      this.previewImageUrl = ''
    },

    // 清空文件列表
    clearFiles() {
      this.internalFileList = []
      this.$emit('clear')
    },

    // 获取文件列表
    getFileList() {
      return this.internalFileList
    },

    // 设置文件列表
    setFileList(files) {
      this.internalFileList = files.map(file => ({
        ...file,
        url: file.url || file.response?.data?.url || file.response?.url || file.path
      }))
    },

    // 获取上传状态
    getUploadStatus() {
      return {
        loading: this.loading,
        progress: this.uploadProgress,
        fileCount: this.internalFileList.length
      }
    },

    // 添加文件到列表（用于自定义上传）
    addFileToList(file) {
      console.log('📁 添加文件到列表:', file)
      
      // 检查文件是否已存在
      const existingFile = this.internalFileList.find(f => f.uid === file.uid)
      if (existingFile) {
        console.log('📁 文件已存在，不重复添加')
        return
      }
      
      // 创建文件对象
      const fileObj = {
        ...file,
        status: 'uploading',
        percentage: 0
      }
      
      // 添加到文件列表
      this.internalFileList = [...this.internalFileList, fileObj]
      console.log('📁 文件已添加到列表，当前列表:', this.internalFileList)
    },

    // 自定义上传处理器（用于 http-request）
    async customUploadHandler(options) {
      console.log('🚀 UploaderCard: 自定义上传处理器被调用', options)
      
      // 设置加载状态
      this.loading = true
      
      try {
        
        // 调用用户提供的自定义上传方法
        if (this.httpRequest) {
            const {status, msg} = await this.beforeUpload(options.file)
            console.log('upload//', status, msg)
            if (!status) {
                throw new Error(msg)
            }
          const result = await this.httpRequest(options)
          console.log('✅ UploaderCard: 自定义上传成功', result)
          
          // 确保返回有效的响应数据
          if (!result) {
            throw new Error('自定义上传方法未返回有效的响应数据')
          }
          if (result.status && result.status === 'error') {
             throw new Error(result.statusText)
          }
          
          // 处理上传成功
          this.handleSuccess(result, options.file, this.internalFileList)
          
          // 返回结果给 Element-UI
          return result
        } else {
          throw new Error('未提供自定义上传方法')
        }
      } catch (error) {
        console.error('❌ UploaderCard: 自定义上传失败', error)
        this.handleError(error, options.file, this.internalFileList)
        throw error
      } finally {
        this.loading = false
      }
    }
  }
}
</script>

<style lang="scss" scoped>
@import './uploaderCard.scss';

// 深度选择器覆盖 Element UI 样式
 ::v-deep .el-upload--picture-card {
  width: 100% !important;
  height: 100% !important;
  line-height: inherit !important;
}

.file-image{
  object-fit:contain;
}
</style>

<style lang="scss">
// 全局样式：提高图片预览弹窗层级
.image-viewer-wrapper,
.el-image-viewer__wrapper,
.el-image-viewer__mask {
  z-index: 999999999 !important;
}
</style>
