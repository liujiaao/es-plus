<template>
  <div>
    <div class="flex-float-top wrap">
      <div class="flex1 edit-box">
        <!-- 工具栏按钮 -->
        <div class="source-code-bar">
          <button
            type="button"
            class="source-btn"
            @click="toggleSourceMode"
          >
            {{ isSourceMode ? '返回编辑' : '查看源代码' }}
          </button>
          <button
            type="button"
            class="source-btn"
            style="margin-left: 8px;"
            @click="togglePreviewMode"
          >
            {{ isPreviewMode ? '关闭预览' : '手机预览' }}
          </button>
        </div>
        <!-- 工具栏和编辑器 -->
        <div :class="['editor-wrapper', { 'is-hidden': isSourceMode || isPreviewMode }]">
          <Toolbar
            class="toolbar-box" 
            :editor="editor"
            :default-config="toolbarConfig"
            mode="default"
          />
          <Editor
            style="height: 400px; overflow-y: hidden;"
            :default-config="editorConfig"
            mode="default"
            @on-created="onCreated"
            @on-change="onEditorChange"
          />
        </div>
        <!-- 源代码编辑区 -->
        <textarea
          v-show="isSourceMode"
          ref="sourceTextarea"
          :value="sourceHtml"
          class="source-textarea"
          placeholder="编辑 HTML 源代码..."
          @input="onSourceInput"
        />
        <!-- 手机预览区 -->
        <div
          v-show="isPreviewMode"
          class="mobile-preview-container"
        >
          <div class="mobile-frame">
            <div class="mobile-screen">
              <div
                class="mobile-content"
                v-html="html"
              ></div>
            </div>
          </div>
        </div>
      </div>  
    </div>
  </div>
</template>

<script>
import { Editor, Toolbar } from '@wangeditor/editor-for-vue'
import { Boot } from '@wangeditor/editor'

import api from '@/api/credits'
export default {
  name: 'MyEditor',
  components: { Editor, Toolbar },
  props: {
    disabled: {
      type: Boolean,
      default: false
    },
    value: {
      type: String,
      default: ''
    }
  },
  data() {
      return {
          editor: {},
          typeList:true,
          html: '',
          modelList:{},
          isSourceMode: false,  // 是否源代码编辑模式
          isPreviewMode: false, // 是否手机预览模式
          sourceHtml: '',       // 源代码编辑时的独立数据
          defaultContent: [],   // 编辑器默认内容（ Slate JSON 格式）
          toolbarConfig: {},  // 使用默认工具栏配置
          editorConfig: {
              placeholder: '请输入内容...',
              // 编辑器样式配置 - 确保移动端适配
              styleWithCSS: true,
              // 自定义样式
              EXTEND_CONF: {
                // 编辑区域样式
                editAreaClassName: 'editor-mobile-style',
                // 配置允许的标签和属性，保留自定义样式
                parseHtmlConf: {
                  allowTags: [
                    'div', 'span', 'p', 'br', 'hr',
                    'h1', 'h2', 'h3', 'h4', 'h5', 'h6',
                    'ul', 'ol', 'li',
                    'blockquote', 'pre', 'code',
                    'b', 'i', 'u', 's', 'strong', 'em',
                    'a', 'img', 'video', 'audio', 'iframe',
                    'table', 'thead', 'tbody', 'tr', 'th', 'td',
                    'sup', 'sub', 'font', 'center', 'strike',
                    'section', 'article', 'header', 'footer', 'nav',
                    'label', 'input', 'button', 'form', 'textarea'
                  ],
                  allowAttrs: {
                    '*': ['style', 'class', 'id', 'name', 'data-*'],
                    'a': ['href', 'target', 'rel', 'title'],
                    'img': ['src', 'alt', 'width', 'height', 'style', 'title'],
                    'video': ['src', 'width', 'height', 'controls', 'style', 'poster', 'autoplay', 'loop'],
                    'audio': ['src', 'controls'],
                    'iframe': ['src', 'width', 'height', 'frameborder', 'allowfullscreen'],
                    'td': ['colspan', 'rowspan', 'width', 'height', 'style', 'align', 'valign'],
                    'th': ['colspan', 'rowspan', 'width', 'height', 'style', 'align', 'valign'],
                    'font': ['color', 'size', 'face'],
                    'input': ['type', 'value', 'placeholder', 'checked', 'disabled', 'readonly'],
                    'button': ['type', 'disabled'],
                    'form': ['action', 'method', 'target'],
                    'label': ['for']
                  },
                  ignoreStyle: false,  // 保留内联样式
                  ignoreEmptyElement: false  // 不忽略空元素
                }
              },
              // 所有的菜单配置，都要在 MENU_CONF 属性下
              MENU_CONF: {
                uploadVideo: {
                  server: '/api/integral-service/integral/file/uploadFiles',
                  fieldName: 'files',
                  maxFileSize: 1024 * 1024 * 100, // 100MB
                    // 最多可上传几个文件，默认为 5
                  maxNumberOfFiles: 1,
                  allowedFileTypes: ['video/*'],
                  onSuccess:(file, res)=>{  // TS 语法
                    // onSuccess(file, res) {          // JS 语法
                        console.log(`${file.name} 上传成功`, res)
                    },
                  onFailed:(file, res)=>{  // TS 语法
                    this.$message(`${file.name} 上传失败`);
                  },
                  onError:(file, err, res)=>{  // TS 语法 
                    this.$message(`${file.name} 上传出错`);
                  },  
                  customInsert(res, insertFn) {                  // JS 语法
                      // res 即服务端的返回结果
                      // 从 res 中找到insertFn(url ,alt, href)  ，然后插入视频
                      // 视频地址需要一个绝对地址。https://
                      console.log("自定义插入视频",res)
                      if(res.code==0&&res.dataList&&res.dataList.length>0){
                        insertFn("https://wdshop-be.szlanyou.com/integral-service"+res.dataList[0].fileUrl) 
                      }
                  },
                },
                uploadImage:{
                  fieldName: 'files',
                  server:'/api/integral-service/integral/file/uploadFiles',
                  onSuccess:(file, res)=>{  // TS 语法
                    // onSuccess(file, res) {          // JS 语法
                        console.log(`${file.name} 上传成功`, res)
                    },
                  onFailed:(file, res)=>{  // TS 语法
                    this.$message(`${file.name} 上传失败`);
                  },
                  onError:(file, err, res)=>{  // TS 语法 
                    this.$message(`${file.name} 上传出错`);
                  },  
                  customInsert(res, insertFn) {                  // JS 语法
                      // res 即服务端的返回结果
                      // 从 res 中找到insertFn(url ,alt, href)  ，然后插入图片
                      // 图片地址需要一个绝对地址。https://
                      console.log("自定义插入图片",res)
                      if(res.code==0&&res.dataList&&res.dataList.length>0){
                        insertFn("https://wdshop-be.szlanyou.com/integral-service"+res.dataList[0].fileUrl) 
                      }
                  },
                },
      
              }
          },
          imageUrl:[],
          imageUrlname:'',
          imageUrl1:[],
          fileList:[
            {name:'',url:''}
          ],
          imageUrl2:'',
          imgUrlL:[],
      }
  },
  computed:{
    uploadUrlBase(){
      const url = process.env.NODE_ENV === 'development' ? process.env.BASE_API : process.env.VUE_APP_URL;
      if(url&&url.indexOf("http")===0){
        return url.replace(/\/$/,'')
      }else{ 
        return url
      }
    }, 
    roleId() {
      const rId = !isNaN(parseInt(this.$store.state.userLogin.userInfo.roleId)) ? parseInt(this.$store.state.userLogin.userInfo.roleId) : 0
      return rId
    },
  },
  watch: {
    value: {
      immediate: true,
      handler(newVal) {
        
        if (newVal !== this.html) {
          this.html = newVal
          // 如果编辑器已初始化，更新编辑器内容
          if (this.editor) {
            this.setEditorContent(newVal)
          }
        }
      }
    },
    html:{
      handler(newVal) {
         if (this.editor) {
        console.log('Html changed to:', newVal)
        if(newVal !== '<p><br></p>' && newVal !== this.value){
            this.$emit('editorChange', newVal)
           this.$emit('input', newVal)
          }
    
         }
      },
      deep: true
     // immediate: true
    }
  },
  mounted() {
    this.disableHandler()
    // this.geteditGet()
    // this.roleIdList()
  },
  beforeUnmount() {
      const editor = this.editor
      if (editor == null) return
      editor.destroy() // 组件销毁时，及时销毁 editor ，重要！！！
  },
  methods: {
    uploadRequest(files) {
      const formData = new FormData()
      // debugger
      formData.append('files', files.file)
     api.uploadfilesDoc(formData).then(res => {
           if(res.data.code === 0) {
              const listUrl =  res.data.dataList.map(item => {
                  return {...item, uid:files.file.uid }
                })
             this.imgUrlL.push.apply(this.imgUrlL, listUrl)
             console.log("this.imgUrlL",this.imgUrlL);
            }
           
       })

    },


    urlList(item){
      // window.location.href = item
      //  其他浏览器
     let url = item.url // window.URL.createObjectURL(item.url)
     let link = document.createElement('a')
     link.style.display = 'none'
     link.href = url
     link.setAttribute('download', item.fileType)
     document.body.appendChild(link)
     link.click()
     document.body.removeChild(link)
     window.URL.revokeObjectURL(link.href);
    },

      onclickType(){
        this.typeList = false
        this.editor.enable()
      },
      onclickType1(){
        this.typeList = true 
        // 取消恢复之前的数据
        // this.editor.disable()
    
      },
      btnList(){
        this.typeList = true 
       //  this.getedit(this.html,this.imgUrlL,this.imageUrl)
       if(this.disabled) {
             this.editor.disable()
       }
       
     },
      // 初始化编辑器
      onCreated(editor) {
          this.editor = Object.seal(editor) // 【注意】一定要用 Object.seal() 否则会报错
          // 如果有初始内容，设置编辑器内容
          if (this.html) {
            // 同步 sourceHtml
            this.sourceHtml = this.html
            // 延迟设置，确保编辑器已完全初始化
            setTimeout(() => {
             this.setEditorContent(this.html)
            }, 100)
          }
          if(this.disabled){
            this.editor.disable()        
            }
        // this.editor.disable()
      },
      // 
      onChange(editor) {
         // console.log('onChange', editor.getHtml()) // onChange 时获取编辑器最新内容
      },
      // 编辑器内容变化时
      onEditorChange(editor) {
        // 只在非源代码模式下更新 html，且不是正在切换模式的过程中
        if (!this.isSourceMode && !this._isSwitchingMode) {
          const newHtml = editor.getHtml()
          // 只有当内容真正变化时才更新
          if (newHtml !== this.html) {
            this.html = newHtml
          }
        }
      },
      // 设置编辑器内容（统一方法）
      setEditorContent(content) {
        if (!this.editor || !content) {
          console.log('setEditorContent: editor or content is empty')
          return
        }
        
        console.log('setEditorContent input:', content.substring(0, 200))
        
        setTimeout(() => {
          if (!this.editor) {
            console.log('setEditorContent: editor is null')
            return
          }
          
          try {
            // 使用 setHtml 设置内容
            if (this.editor.setHtml) {
              this.editor.setHtml(content)
              console.log('Content set via setHtml')
            } else if (this.editor.dangerouslyInsertHtml) {
              this.editor.selectAll()
              this.editor.dangerouslyInsertHtml(content)
              console.log('Content set via dangerouslyInsertHtml')
            }
            
            // 验证设置后的内容
            setTimeout(() => {
              const afterSet = this.editor.getHtml()
              console.log('Content after set:', afterSet.substring(0, 200))
            }, 50)
            
            // 同步 html 数据
            this.html = content
          } catch (err) {
            console.error('Error setting editor content:', err)
          }
        }, 100)
      },
      // 获取编辑器内容（统一方法）
      getEditorContent() {
        if (this.editor && this.editor.getHtml) {
          const content = this.editor.getHtml()
      
          return content
        }

        return this.html
      },
      // 切换源代码编辑模式
      async toggleSourceMode() {
          this._isSwitchingMode = true
          const newMode = !this.isSourceMode
          
          if (newMode) {
            // 切换到源代码模式
            // 强制获取编辑器最新内容（编辑器会净化 HTML）
            if (this.editor) {
              this.sourceHtml = this.editor.getHtml()
            }
            console.log('To source mode, content length:', this.sourceHtml.length)
            this.isPreviewMode = false
            this.isSourceMode = true
            await this.$nextTick()
            this.$refs.sourceTextarea && this.$refs.sourceTextarea.focus()
          } else {
            // 切回编辑模式
            console.log('To edit mode, sourceHtml length:', this.sourceHtml.length)
            this.isSourceMode = false
            this.isPreviewMode = false
            this.html = this.sourceHtml
            // 等待 DOM 更新，编辑器变为可见
            await this.$nextTick()
            // 设置编辑器内容
            this.setEditorContent(this.sourceHtml)
          }
          
          // 清除切换标志
          setTimeout(() => {
            this._isSwitchingMode = false
          }, 150)
      },
      // 源代码编辑框输入时同步数据
      onSourceInput(e) {
        this.sourceHtml = e.target.value
      },
      // 切换手机预览模式
      async togglePreviewMode() {
          this._isSwitchingMode = true
          const newMode = !this.isPreviewMode
          
          if (newMode) {
            // 切换到手机预览模式
            // 先强制同步当前编辑器内容到 sourceHtml
            if (this.isSourceMode) {
              this.sourceHtml = this.$refs.sourceTextarea.value
              this.isSourceMode = false
            } else if (this.editor) {
              // 强制获取编辑器最新内容
              this.sourceHtml = this.editor.getHtml()
            }
            this.html = this.sourceHtml
            this.isPreviewMode = true
          } else {
            // 从预览模式切回编辑模式
            this.isPreviewMode = false
            this.html = this.sourceHtml
            // 等待 DOM 更新，编辑器变为可见
            await this.$nextTick()
            // 设置编辑器内容
            this.setEditorContent(this.sourceHtml)
          }
          
          // 清除切换标志
          setTimeout(() => {
            this._isSwitchingMode = false
          }, 150)
      },
      // 获取移动端适配的 HTML 内容
      getMobileHtml() {
        const style = `
          <style>
            .mobile-content { 
              max-width: 100%; 
              overflow-x: hidden;
              font-size: 14px;
              line-height: 1.6;
              word-wrap: break-word;
              word-break: break-all;
              box-sizing: border-box;
            }
            .mobile-content img { 
              max-width: 100% !important; 
              width: auto !important;
              height: auto !important; 
              display: block;
            }
            .mobile-content video,
            .mobile-content iframe { 
              max-width: 100% !important; 
              width: 100% !important;
              height: auto !important; 
              display: block;
            }
            .mobile-content table { 
              max-width: 100%; 
              width: 100%;
              border-collapse: collapse;
              font-size: 12px;
              display: block;
              overflow-x: auto;
            }
            .mobile-content th, 
            .mobile-content td { 
              border: 1px solid #ddd; 
              padding: 6px 8px; 
            }
            .mobile-content pre {
              max-width: 100%;
              overflow-x: auto;
              white-space: pre-wrap;
              word-wrap: break-word;
              background-color: #f5f5f5;
              padding: 12px;
              border-radius: 4px;
            }
          </style>
        `
        return `<div class="mobile-content">${this.html}</div>${style}`
      },
      // 获取富文本
      printEditorHtml() {
          const editor = this.editor
          if (editor == null) return
          console.log(editor.getHtml())
      },
      disableHandler() {
          const editor = this.editor 
          if (editor == null) return
       //   editor.disable()
      },
      goodImgSuccess(res,file,fileList){    
      if (res&&res.code === 0) {    
        console.log("file11111",res)
        // console.log("imageUrl===",this.imageUrl)
        this.modelList = res.model
      }else{ 
        this.$message.error(res&&res.message || "error")
      }
    },
    imgError(err){
      this.$message({
        message:"上传失败",
        type:"warning"
      })
    }, 
    handleChange(file, fileList){
      const imgsize=Number(file.size)
      console.log(imgsize,'s');  
      // if(imgsize>=1048576){ 
      //   this.$message.error("文件大小不能超过1M")
      //   return false
      // } 
    },
    handleRemove(file, fileList){
          this.imgUrlL = this.imgUrlL.filter(it => it.uid !== file.uid)
         
    },


 },
}
// /integral/file/download?fileName=/202212/ba7d7253a4104681ac9032c0f29baefe.xlsx

// /integral/file/download?fileName=/202301/57992e9a5209458aa9840906aed424be.docx
</script>

<style src="@wangeditor/editor/dist/css/style.css"></style>
<style scoped lang="scss">
.edit-box{
  border: 1px solid #ccc; margin-top: 10px;
  z-index:100
}
.source-code-bar {
  padding: 8px 12px;
  border-bottom: 1px solid #ccc;
  background-color: #f5f5f5;
}
.source-btn {
  padding: 4px 12px;
  font-size: 13px;
  color: #333;
  background-color: #fff;
  border: 1px solid #ccc;
  border-radius: 3px;
  cursor: pointer;
  &:hover {
    background-color: #f0f0f0;
  }
}
.source-textarea {
  width: 100%;
  height: 400px;
  padding: 12px;
  font-family: 'Courier New', monospace;
  font-size: 13px;
  line-height: 1.5;
  border: none;
  outline: none;
  resize: vertical;
  box-sizing: border-box;
}
// 手机预览模式
.mobile-preview-container {
  display: flex;
  justify-content: center;
  padding: 20px;
  background-color: #f0f2f5;
  min-height: 400px;
}
.mobile-frame {
  width: 375px;
  height: 667px;
  min-width: 375px; // 防止被压缩
  max-width: 375px; // 防止被撑大
  background-color: #fff;
  border: 12px solid #333;
  border-radius: 36px;
  overflow: hidden;
  position: relative;
  box-shadow: 0 4px 20px rgba(0, 0, 0, 0.15);
  &::before {
    content: '';
    position: absolute;
    top: 0;
    left: 50%;
    transform: translateX(-50%);
    width: 150px;
    height: 24px;
    background-color: #333;
    border-bottom-left-radius: 12px;
    border-bottom-right-radius: 12px;
    z-index: 10;
  }
}
.mobile-screen {
  width: 375px; // 固定手机宽度
  height: 100%;
  overflow-y: auto;
  overflow-x: hidden; // 禁止横向滚动
  background-color: #fff;
  box-sizing: border-box;
}
.mobile-content {
  padding: 16px;
  font-size: 14px;
  line-height: 1.6;
  word-wrap: break-word;
  word-break: break-all;
  box-sizing: border-box;
  width: 100%;
  max-width: 375px; // 限制最大宽度为手机宽度
  
  // 图片适配 - 使用 !important 覆盖内联样式
  img {
    max-width: 100% !important;
    width: auto !important;
    height: auto !important;
    display: block;
    margin: 8px 0;
  }
  
  // 视频适配
  video, iframe {
    max-width: 100% !important;
    width: 100% !important;
    height: auto !important;
    aspect-ratio: 16 / 9;
    display: block;
    margin: 8px 0;
  }
  
  // 表格横向滚动
  table {
    max-width: 100%;
    width: 100%;
    border-collapse: collapse;
    font-size: 12px;
    display: block;
    overflow-x: auto;
    white-space: nowrap;
    
    th, td {
      border: 1px solid #ddd;
      padding: 6px 8px;
      text-align: left;
    }
    th {
      background-color: #f5f5f5;
      font-weight: bold;
    }
  }
  
  // 代码块适配
  pre {
    max-width: 100%;
    overflow-x: auto;
    background-color: #f5f5f5;
    padding: 12px;
    border-radius: 4px;
    font-size: 12px;
    line-height: 1.4;
    margin: 8px 0;
    
    code {
      font-family: 'Courier New', monospace;
      white-space: pre;
      word-wrap: normal;
    }
  }
  
  // 段落和标题
  p {
    margin: 8px 0;
  }
  
  h1, h2, h3, h4, h5 {
    margin: 12px 0 8px;
    line-height: 1.3;
  }
  
  h1 { font-size: 20px; }
  h2 { font-size: 18px; }
  h3 { font-size: 16px; }
  h4 { font-size: 15px; }
  h5 { font-size: 14px; }
  
  // 列表
  ul, ol {
    padding-left: 20px;
    margin: 8px 0;
  }
  
  li {
    margin: 4px 0;
  }
  
  // 引用
  blockquote {
    border-left: 3px solid #ddd;
    margin: 8px 0;
    padding: 8px 12px;
    background-color: #f9f9f9;
    color: #666;
  }
  
  // 链接
  a {
    color: #1890ff;
    word-break: break-all;
  }
}
.avatar{
  width: 100%;
  display: block;
}
.text_list{
  color: aqua;
  margin-top: 10px;
}
.editor-wrapper {
  width: 100%;
  &.is-hidden {
    position: absolute;
    left: -9999px;
    top: -9999px;
    opacity: 0;
    pointer-events: none;
  }
}
.toolbar-box{
  border-bottom: 1px solid #ccc
}
.wrap{
  // padding:20px;
  .label{
    padding:10px;
  }
  span{
    color:red;
  }
}

// 编辑器内样式 - 确保移动端适配
::v-deep .editor-mobile-style {
  word-wrap: break-word;
  word-break: break-all;
  
  img, video {
    max-width: 100%;
    height: auto;
  }
  
  table {
    max-width: 100%;
    width: 100%;
  }
  
  pre {
    max-width: 100%;
    overflow-x: auto;
    white-space: pre-wrap;
    word-wrap: break-word;
  }
}

// 真实手机模式下的内容样式
.mobile-view-content {
  max-width: 100%;
  overflow-x: hidden;
  
  img, video, iframe {
    max-width: 100%;
    height: auto;
  }
  
  table {
    display: block;
    width: 100%;
    overflow-x: auto;
    -webkit-overflow-scrolling: touch;
  }
}
</style>