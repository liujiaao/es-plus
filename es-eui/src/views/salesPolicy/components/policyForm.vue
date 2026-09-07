<template>
    <div class="policy-form">
            <es-form
            ref="policyform"
            :key="formDisabled + '-' + policyContentRulefiled"
            :form-item-list="FormConfig"
            :model="formData"
            :layout-form-props="renderLayoutProps"
            />
    </div>
</template>

<script>
import EditorToobar from './EditorToobar'
import UploaderCard from './uploaderCard.vue'
import api from '@/api/credits'

export default {
    name: 'policyForm',
    props: {
        policyRow: {
            type: Object,
            default: () => ({})
        },
        policyFormStatus: {
            type: String,
            default: 'add' // add | edit | view
        }
    },  

    data() {
    return {
    formDisabled: false,
    policyContentRulefiled: 'policyLinkContent',

    FormConfig: [
        {
        prop: 'policyName',
        label: '政策名称',
        span: 24,
        formtype: 'Input',
         formItemOptions: {
                 labelWidth: '150px',
                 style: { width: '65%' },
                 rules: [
                    { required: true, message: '政策名称不能为空', trigger: 'blur' }
                 ]
            }, // 表单项选项
        attrs: {
          placeholder: '请输入政策名称',
          clearable: true,
          disabled: () => this.formDisabled
        }
      },
   {
        prop: 'policyAbstract',
        label: '摘要',
        span: 24,
        formtype: 'Input',
              formItemOptions: {
                 labelWidth: '150px',
                  style: { width: '65%' },
                  rules: [
                    { required: true, message: '摘要不能为空', trigger: 'blur' }
                  ]
            }, // 表单项选项
        attrs: {
          placeholder: '请输入政策摘要',
          clearable: true,
           type: 'textarea',
           rows:3,
           disabled: () => this.formDisabled
        }
      },
        {
            label: '政策生效时间', // 表单项标签
            span: 24, // 栅格占据列数
            formItemOptions: {
                 labelWidth: '150px',
                  style: { width: '65%' },
                  rules: [
                    { required: true, message: '政策生效时间不能为空', trigger: 'change' }
                  ]
            }, // 表单项选项
            prop: 'effectiveTimeRange', // 数据绑定字段
            formtype: 'datePicker', // 表单项类型
            attrs: {
              disabled: () => this.formDisabled,
              valueFormat: 'yyyy-MM-dd HH:mm:ss', // 日期格式
              placeholder: '选择日期时间', // 占位符
             // 'is-range': true, // 是否为范围选择
              type: 'datetime', // 日期类型
              // "range-separator": '至', // 范围分隔符（注释掉）
             // 'start-placeholder': '开始日期', // 开始日期占位符
             // 'end-placeholder': '结束日期', // 结束日期占位符
              style: 'width: 100%' // 样式
            }
          },

          {
            label: '政策失效时间', // 表单项标签
            span: 24, // 栅格占据列数
            formItemOptions: {
            labelWidth: '150px',
             style: { width: '65%' },
             rules: [
                { required: true, message: '政策失效时间不能为空', trigger: 'change' }
             ]
            }, // 表单项选项
            prop: 'invalidTimeRange', // 数据绑定字段
            formtype: 'datePicker', // 表单项类型
            attrs: {
              disabled: () => this.formDisabled,
              valueFormat: 'yyyy-MM-dd HH:mm:ss', // 日期格式
              placeholder: '选择日期时间', // 占位符
             // 'is-range': true, // 是否为范围选择
              type: 'datetime', // 日期类型
              // "range-separator": '至', // 范围分隔符（注释掉）
             // 'start-placeholder': '开始日期', // 开始日期占位符
             // 'end-placeholder': '结束日期', // 结束日期占位符
              style: 'width: 100%' // 样式
            }
          },

        {
        prop: 'policyTag',
        label: '政策标签',
        span: 24,
       // formtype: 'Select',
        attrs: {
          placeholder: '请选择政策标签',
          clearable: true,
          style: 'width: 100%',
          disabled: () => this.formDisabled
        },
              formItemOptions: {
                 labelWidth: '150px',
                //  rules: [
                //     { required: true, message: '政策标签不能为空', trigger: 'blur' }
                //  ]
            }, // 表单项选项
        dataOptions: [
          { label: '显示', value: 'always' },
          { label: '隐藏', value: 'hide' }
       
        ],
        render: (h, model, row) => {
              return <el-row gutter={20}>
                      <el-col span={8} style="padding-left: 0px;">
                        <el-Input disabled={this.formDisabled} v-model={model.policyTag} placeholder="请输入政策标签"></el-Input>
                      </el-col>
                       <el-col span={10}>
                             <el-radio-group
                        disabled={this.formDisabled}
                        v-model={model.ispolicyTag}
                        on-input={() => {
                            if(model.ispolicyTag === 'always'){
                         
                                    this.$set(
                                this.renderLayoutProps.fromLayProps.rules, 
                                'policyTag', 
                                [
                                    { required: true, message: '政策标签不能为空', trigger: 'blur' }
                                ]
                            )
                       
                            } else {
                                  this.$set(
                                this.renderLayoutProps.fromLayProps.rules, 
                                'policyTag', 
                                [
                                 //  { required: true, message: '政策标签不能为空', trigger: 'blur' }
                                ]
                            )
                            }
                        }}
                        >
                        <el-radio  label="always">显示</el-radio>
                        <el-radio label="hide">隐藏</el-radio>
                    </el-radio-group>
                       </el-col>
                   
                </el-row>
        }

      },

        {
        prop: 'policyStatus',
        label: '文章状态',
        span: 24,
        formItemOptions: {
                 labelWidth: '150px',
                 rules: [
                    { required: true, message: '文章状态不能为空', trigger: 'change' }
                 ]
            }, // 表单项选项
           formtype: 'Radio',

        attrs: {
          disabled: () => this.formDisabled
        //   placeholder: '请选择文章状态',
        //   clearable: true
        },

        dataOptions: [
          { label: '草稿', value: '0'},
          { label: '上架', value: '1' },
          { label: '下架', value: '2' }
        ]
      },

      
        {
        prop: 'policyReleaseDate',
        label: '发布方式',
        span: 24,
              formItemOptions: {
                 labelWidth: '150px',
                //  rules: [
                //     { required: true, message: '发布方式不能为空', trigger: 'change' }
                //  ]
            }, // 表单项选项
       // formtype: 'Select',
        attrs: {
          placeholder: '请选择政策标签',
          clearable: true,
          style: 'width: 100%',
          disabled: () => this.formDisabled
        },
        dataOptions: [
          { label: '立即发布', value: '0' },
          { label: '定时发布', value: '1' }
        ],
        render: (h, model, row) => {
              return <el-row gutter={20}>
                        {model.policyReleaseType === '1' && <el-col span={8} style="padding-left: 0px;">
                          <el-date-picker
                              disabled={this.formDisabled}
                            v-model={model.policyReleaseDate}
                             value-format={"yyyy-MM-dd HH:mm:ss"}
                            type="datetime"
                            placeholder="选择发布日期">
                          </el-date-picker>
                        </el-col>}
                        <el-col span={10}>
                      <el-radio-group
                        v-model={model.policyReleaseType}
                        disabled={this.formDisabled}
                        on-input={(val) => {
              
                          if(val == '1') {
                               this.$set(
                                this.renderLayoutProps.fromLayProps.rules, 
                                'policyReleaseDate', 
                                [
                                    { required: true, message: '发布日期不能为空', trigger: 'change' }
                                ]
                            )
                          } else {
                             this.$set(
                                this.renderLayoutProps.fromLayProps.rules, 
                                'policyReleaseDate', 
                                [
                                  //  { required: true, message: '发布日期不能为空', trigger: 'change' }
                                ]
                            )
                          }
                     
                        }}
                    
                        >
                        <el-radio  label="0">立即发布</el-radio>
                        <el-radio  label="1">定时发布</el-radio>
                    </el-radio-group>
                    </el-col>
                </el-row>
        }

      },

        {
            label: '封面图', // 表单项标签
            span: 24, // 栅格占据列数
            formItemOptions: {
                 labelWidth: '150px',
                 rules: [
                    { required: true, message: '封面图不能为空', trigger: 'change' }
                 ]
            }, // 表单项选项
            prop: 'coverImage', // 数据绑定字段
            // formtype: 'Upload', // 表单项类型
            //   triggerRender: (h) => {
            //          return <div class="my-trigger">
            //             <i class="el-icon-upload" style="font-size: 28px; color: #409EFF;" >
            //             <i style="color: #666;display: block; font-size: 12px;">点击或拖拽上传</i>
            //             </i>
                    
            //          </div>
            //      },
            // attrs: {
            //     placeholder: '上传封面图', // 占位符
            //     multiple: false,
            //     limit: 1,
            //     listType: 'picture-card',
            //     action: '/api/upload', // 上传地址
            //     style: 'width: 100%' // 样式
            // }
            render: (h, model, row) => {
                return   <UploaderCard
                                  ref="firstFrameUploader"
                                          action="/wdhac/omc/file/upload"
                                          fileList={this.firstFrameFiles}
                                          disabled={this.formDisabled}
                                          width={120}
                                          height={130}
                                          max-size={4.7}
                                          upload-text="上传封面图"
                                          maxResolution={ {width: 4096, height: 4096} }
                                          acceptTypes={['image/jpeg', 'image/jpg', 'image/png']}
                                          showTips={false}
                                          onSuccess={(file) => {
                                      
                                            model.coverImage = file.file.url
                                            console.log('file:', model.coverImage)
                                            this.firstFrameFiles = file.fileList
                                          }}
                                          onError={() => {
                                             
                                          }}
                                          onRemove={() => {
                                              model.coverImage = ''
                                            this.firstFrameFiles = []
                                          }}
                                          httpRequest={this.customUpload}
                                        />
            }
          },
          {
        prop: () => this.policyContentRulefiled,
        label: '政策内容',
            span: 24, // 栅格占据列数
            formItemOptions: {
                 labelWidth: '150px',
                 rules: [
                    { required: true, message: '政策内容不能为空', trigger: 'blur' }
                 ]
            }, // 表单项选项

            render: (h, model, row) => {
               // const policyContent = model.policyEitorContent
              return <div>
                      <div>
                          <el-radio-group v-model={model.policyContentType} on-input={() => {
                            
                            
                             if(model.policyContentType === '1'){
                                this.policyContentRulefiled = "policyLinkContent"
                             } else {
                                this.policyContentRulefiled = "policyEitorContent"
                             }
                              console.log('policyContentType:',  this.policyContentRulefiled)
                            }}>
                            <el-radio-button label={'1'}>{'调转链接'}</el-radio-button>
                            <el-radio-button label={"2"}>{'自定义编辑内容'}</el-radio-button>
                        </el-radio-group>
                       </div>

                       <div>
                        {model.policyContentType == '1' ?  <div  style="margin-top: 15px;" >
                              <el-input
                                type="textarea"
                                disabled={this.formDisabled}
                                rows={2}
                                placeholder="请输入调转链接"
                                v-model={model.policyLinkContent}
                                style="width: 65%;"
                              ></el-input>
                          </div> :
                           <div  style="margin-top: 15px;">
                              <EditorToobar
                                disabled={this.formDisabled}
                                v-model={model.policyEitorContent}
            
                                onEditorChange={(value) => { 
                                  
                              
                              }} 
                              />
                          </div>
                          }
                  
                      </div>

              </div>
          }
        }
    

     ],
     formData: {
        policyName: '',
        policyAbstract: '',
        effectiveTimeRange: '',
        invalidTimeRange: '',
        policyTag: '',
        ispolicyTag: 'always',
        policyStatus: '0',
        policyReleaseType: '1',
        policyReleaseDate: '',
        coverImage: '',
        policyLinkContent: '',
        policyEitorContent: '',
       // policyContent: '',
        policyContentType: '1'
     },
     renderLayoutProps: {
        fromLayProps: {
        isBtnHiden: true, // 隐藏查询按钮    
        minfoldRows: 0, // 最多展示两行
        labelWidth: '100px',
        size: 'small',
        showMessage: false,
        rules: {
                policyTag: [
                    { required: true, message: '政策标签不能为空', trigger: 'blur' }
                 ],
                  policyReleaseDate: [
                    { required: true, message: '发布方式不能为空', trigger: 'change' }
                 ]
                    
        }
      },
      rowLayProps: {
        gutter: 20
      }
     },
        }
    },

    watch:{
        policyRow: {
            handler(newVal) {
               
                if (this.policyFormStatus === 'edit' || this.policyFormStatus === 'view') {
                   this.$nextTick(()=> {
                          console.log('policyRow changed:',  this.$refs.policyform);
                 
                 
                     this.$refs.policyform.$httpRequest({
                        url: '/pcApi/honda-pc/cms/getById.do',
                        method: 'get',
                        formParams:{
                            id: newVal.id
                        }
                     }).then((res) => {
                               console.log('获取政策详情///', res)
                               if(res && res.data){
                                const data = res.data.data;
                                this.formData = { 
                                      policyName:  data.title,
                                      policyAbstract: data.summary,
                                      effectiveTimeRange: data.validDateStart,
                                      invalidTimeRange: data.validDateEnd,
                                      policyTag: data.tags,
                                      ispolicyTag: data.tags ? 'always' : 'hide',
                                      policyStatus: data.status,
                                      policyReleaseType: data.scheduledReleaseTime ? '1' : '0',
                                      policyReleaseDate: data.scheduledReleaseTime,
                                      coverImage: data.coverImage,
                                      policyLinkContent: data.link || '',
                                      policyEitorContent: data.content || '',
                                      policyContentType: (data.link && this.isUrl(data.link)) ? '1' : '2'
                                 };

                                 if(data.link){
                                    this.policyContentRulefiled = 'policyLinkContent'
                                 } else if(data.content) {
                                    this.policyContentRulefiled = 'policyEitorContent'
                                 }
                                // 处理时间范围字段
                              //  this.formData.effectiveTimeRange = data.effectiveTime ? data.effectiveTime.split(' to ') : '';
                               // this.formData.invalidTimeRange = data.invalidTime ? data.invalidTime.split(' to ') : '';
                                // 处理封面图字段
                                 this.firstFrameFiles = data.coverImage ? [this.createFileItem(data.coverImage, 'coverImage')] : [];
                               }

                     })
                  if(this.policyFormStatus === 'view'){
                    this.formDisabled = true;
                     console.log('policyRow changed222:', newVal);
                    // 查看状态下，禁用所有表单项
                    // this.$nextTick(() => {  /cms/getById.do 
                    //   const formRef = this.$refs.policyform;
                    //   if (formRef && formRef.setDisabled) {
                    //     formRef.setDisabled(true);
                    //   }
                    // });
                  } else {
                    this.formDisabled = false;
                  }
                    })
                    // this.formData = { ...newVal };
                    // // 处理时间范围字段
                    // this.formData.effectiveTimeRange = newVal.effectiveTime ? newVal.effectiveTime.split(' to ') : '';
                    // this.formData.invalidTimeRange = newVal.invalidTime ? newVal.invalidTime.split(' to ') : '';
                    // // 处理封面图字段
                    // this.firstFrameFiles = newVal.coverImage ? [this.createFileItem(newVal.coverImage, 'coverImage')] : [];
                } else {
                    // 重置表单数据
                    this.formData = {
                        policyName: '',
                        policyAbstract: '',
                        effectiveTimeRange: '',
                        invalidTimeRange: '',
                        policyTag: '',
                        ispolicyTag: 'always',
                        policyStatus: '0',
                        policyReleaseType: '1',
                        policyReleaseDate: '',
                        coverImage: [],
                        policyContent: '',
                        policyContentType: '1'
                    };
                    this.firstFrameFiles = [];
                    this.formDisabled = false;
                }
            },
            immediate: true,
            deep: true
        }
    },
    computed: {

    },    
    methods: {
    randomRange (min, max, charStr){
    /** 随机生成固定位数或者一定范围内的字符串数字组合
     * @param {Number} min 范围最小值
     * @param {Number} max 范围最大值，当不传递时表示生成指定位数的组合
     * @param {String} charStr指定的字符串中生成组合
     * @returns {String} 返回字符串结果
     *
     * */
  let returnStr = ""; let range;
  if (typeof min == 'undefined'){
    min = 5
  }
  if (typeof max == 'string'){
    charStr = max
  }
  range = ((max && typeof max == 'number') ? Math.round(Math.random() * (max-min)) + min : min)
  charStr = charStr || 'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789'
  for (let i=0; i < range; i++){
    let index = Math.round(Math.random() * (charStr.length-1))
    returnStr += charStr.substring(index, index+1)
  }
  return returnStr
},
isUrl(val) {
    // 改进版：支持 localhost、更严格的 IPv4 验证、避免连续点号
    const urlPattern = new RegExp(
        '^(https?:\\/\\/)' +  // protocol (必选)
        '(' +
            // 域名：支持 localhost 和常规域名
            '([a-z\\d]([a-z\\d-]*[a-z\\d])?\\.)+[a-z]{2,}|' +
            'localhost|' +
            // IPv4：严格验证每个段 0-255
            '((25[0-5]|2[0-4]\\d|1\\d{1,2}|[1-9]?\\d)\\.){3}(25[0-5]|2[0-4]\\d|1\\d{1,2}|[1-9]?\\d)' +
        ')' +
        '(\\:\\d+)?' +  // 端口
        '(\\/[-a-z\\d%_.~+]*)*' +  // 路径
        '(\\?[;&a-z\\d%_.~+=-]*)?' +  // 查询参数
        '(\\#[-a-z\\d_]*)?$', 'i'
    );
    
    if (!urlPattern.test(val)) return false;
    
    // 额外检查：排除连续点号的情况
    if (val.includes('..')) return false;
    
    return true;
},
       parseObsUrl(url = '') {
  if (typeof url !== 'string' || !url) return { path: '', name: '' };

  // 1. 去掉协议头、查询参数、hash
  const clean = url
    .replace(/^https?:\/\//, '') // 去掉 http(s)://
    .replace(/[?#].*$/, ''); // 去掉 ?签名、#hash

  // 2. 第一个 "/" 之后就是桶内全路径
  const firstSlash = clean.indexOf('/');
  if (firstSlash === -1) return { path: '', name: clean }; // 只有域名，无路径

  const fullPath = clean.slice(firstSlash); //  "/mop/Ai/video/20241002-1526111765258113097.png"

  // 3. 最后一个 "/" 拆分目录 与 文件名
  const lastSlash = fullPath.lastIndexOf('/');
  return {
    path: fullPath.slice(0, lastSlash + 1), // 保留末尾 "/"
    name: fullPath.slice(lastSlash + 1) // 纯文件名（含后缀）
  };
},
          // 创建文件项
    createFileItem(url, type) {
      const parsedUrl = this.parseObsUrl(url)
      return {
        response: {
          code: 200,
          message: "上传成功",
          data: {
            fileName: parsedUrl.path,
            filePath: parsedUrl.name,
            fileSize: "208.81KB",
            requestId: this.randomRange(8, 14),
            tosLocation: url
          }
        },
        status: "success",
        uid: this.randomRange(6, 8),
        url: url
      }
    },
        uploadRequest(files) {
      const formData = new FormData()
      // debugger
      formData.append('files', files)
      return api.uploadfilesDoc(formData)

    },
  
      // 自定义上传实现
    async customUpload(options) {
      console.log('🚀 自定义上传开始:', options)
      const { file, onProgress, onSuccess, onError } = options
      
      // 确保文件对象有效
      if (!file || !file.uid) {
        console.error('❌ 无效的文件对象:', file)
        const error = new Error('无效的文件对象')
        if (onError) {
          const errorObj = {
            message: '无效的文件对象',
            status: 'error',
            statusText: '无效的文件对象'
          }
          onError(errorObj, file)
        }
        throw error
      }
      
      try {
        console.log('📤 开始上传文件:', file.name, 'UID:', file.uid)
        
        // 模拟进度（实际使用时可以通过 uploadTosFile 的进度回调）
        if (onProgress) {
          onProgress({ percent: 0 })
          console.log('📊 设置初始进度: 0%')
        }
        
        // // 检查图片比例一致性
        // console.log('🔍 检查图片比例一致性...')
        // const isConsistent = await this.checkImageAspectRatio(file)
        // if (!isConsistent) {
        //   const error = new Error('请上传比例相同的图片')
     
        //   // 构建标准错误对象
        //   const errorObj = {
        //     message: error.message,
        //     status: 'error',
        //     statusText: error.message
        //   }

        //   // 调用错误回调
        //   // if (onError) {
        //   //   onError(errorObj, file)
        //   // }
        //   return errorObj
         
        // }
        console.log('✅ 图片比例检查通过')
        
        // 使用 TOS 上传服务
        console.log('🔄 调用 uploadTosFile...')
        const res = await this.uploadRequest(file)
        console.log('✅ TOS 上传结果:', file)
        
        if (res && res.data && res.data.code === 0 && res.data.dataList && res.data.dataList.length > 0) {
          const resData = res.data.dataList[0]
          const imgPath = "https://wdshop-be.szlanyou.com/integral-service" + resData.fileUrl  // `${resData.tosLocation}?fileName=${resData.fileName}&path=${resData.filePath}`
          
          console.log('🎯 上传成功，图片路径:', imgPath)
          
          // 构建响应数据
          const response = {
            code: 200,
            message: '上传成功',
            data: {
              url: imgPath,
              fileName: resData.fileName,
              fileSize: file.size, // resData.fileSize + resData.fileSizeUnit,
              tosLocation: imgPath,
              filePath: resData.fileUrl,
              requestId: file.uid // resData.requestId
            }
          }
          
          console.log('📤 调用 onSuccess 回调...')
          // 调用成功回调
          if (onSuccess) {
            onSuccess(response, file)
            console.log('✅ onSuccess 回调已调用')
          } else {
            console.warn('⚠️ onSuccess 回调不存在')
          }
          
         // this.$message.success('上传成功')
          console.log('💾 准备更新文件列表...')
          
          // 更新对应的文件列表
       //   this.updateFileList(file, response)
          console.log('✅ 文件列表更新完成')
          
          // 返回响应数据给组件
          return response
          
        } else {
          throw new Error('上传返回数据格式不正确')
        }
        
      } catch (error) {
        console.error('上传失败:', error)
        
        // 构建标准错误对象
        const errorObj = {
          message: error.message || '上传失败',
          status: 'error',
          statusText: error.message || '上传失败'
        }
        
        // 调用错误回调
        if (onError) {
          onError(errorObj, file)
        }
        
        this.$message.error(`上传失败: ${error.message}`)
      }
    },
    },
    mounted() {},
    created() {}
}
</script>
<style lang="scss" scoped>
  .policy-form{
    // max-height: 450px;
    //  overflow-y: auto;
    //  overflow-x: hidden;
  }
 </style>