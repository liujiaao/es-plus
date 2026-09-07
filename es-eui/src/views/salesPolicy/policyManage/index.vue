<template>
    <div class="policy-manage">
          <es-table
          :data-source.sync="dataSource"
          :columns="basicColumns"
          :pagination="paginationConfig"
          :options="{ 
            border: true,
            tabHeight: 500,
            heightType: 'height',
            size: 'mini',
            ...tableOptions
          }"
          >
            <es-form
            
            :form-item-list="FormConfig"
            :model="formData"
            :layout-form-props="renderLayoutProps"
            :config-btn="configBtnList"
            />
          </es-table>
    </div>
</template>
<script >
import { useDialog } from '@es-plus/vue2'
import PolicyForm from '../components/policyForm.vue'
import server from '@/assets/common/server/request'
const addPolicyFrom = useDialog()
const viewPolicyDialog = useDialog()
const editPolicyDialog = useDialog()
export default {
  name: 'policyManage',
  data() {
    return {
     tableOptions: {
        isInitRun: true, // 初始化时是否请求接口
         apiParams: {
            url: '/pcApi/honda-pc/cms/pageQuery.do'
          },
          configTableOut: {
            total: 'total',
            pageSize: 'pageSize',
            current: 'pageIndex',
            tableData: 'data'
          },
        /* 自定义请求实例配置
          httpRequest: (params) => {
            const { url, formParams, headers, ...options } = params
            console.log('httpRequest///', params) // 打印日志
              return server({
                  baseURL: '',
                method: 'post',
                url: url,
                data: formParams
              })
          }, 
          */
          listenToCallBack: {
            brcb: (formPrams) => {
              const { pageSize, pageIndex, ...params } = formPrams // 解构参数
              console.log('brcb///', formPrams) // 打印日志

              const { policyCode, policyTitle, policyStatus, policyTag, publishType, effectiveTimeRange, publishTimeRange } = params
              const timeDate = {
                 validDateStart: '',
                 validDateEnd: '',
                 scheduledReleaseTimeStart: '',
                 scheduledReleaseTimeEnd: ''
              }
              if(Array.isArray( effectiveTimeRange) && effectiveTimeRange.length === 2){
                  timeDate.validDateStart = effectiveTimeRange[0]
                  timeDate.validDateEnd = effectiveTimeRange[1]
              }
              if(Array.isArray(publishTimeRange) && publishTimeRange.length === 2){
                  timeDate.scheduledReleaseTimeStart = publishTimeRange[0]
                  timeDate.scheduledReleaseTimeEnd = publishTimeRange[1]
              }
            
             const formParmas ={ pageNum: pageIndex, 
                pageSize, 
                ...timeDate, 
                 id:policyCode || '',
                 title: policyTitle || '', 
                 status:policyStatus || '', 
                 tags:policyTag || '', 
                 type: 'policy',
                 publishingMethod:publishType || ''
                } // 返回格式化后的参数


                 console.log('请求参数、、', formParmas) // 打印日志

                 return formParmas

            },
            qrcb: (res) => {
              console.log('查询回调、、', res) // 打印日志
            }
          }
    },
    
     dataSource: [
       /* {
            policyName: 'POL001',
            policyTitle: '夏季促销政策',
            policyTag: '促销',
            policyStatus: '已发布',
            publishType: '系统发布',
            publishTime: '2024-06-01 10:00:00',
            effectiveTime: '2024-06-01 00:00:00',
            invalidTime: '2024-08-31 23:59:59',
            createTime: '2024-05-25 09:30:00',
            createUser: '张三'
         },
         {
            policyName: 'POL002',
            policyTitle: '新用户优惠政策',
            policyTag: '优惠',
            policyStatus: '未发布',
            publishType: '手动发布',
            publishTime: '2024-07-15 14:00:00',
            effectiveTime: '2024-07-15 00:00:00',
            invalidTime: '2024-12-31 23:59:59',
            createTime: '2024-06-10 11:20:00',
            createUser: '李四'
        } */
     ],
     basicColumns: [
          {
            key: 'id',
            label: '政策编号',
            fixed: 'left',
         },
         {
            key: 'title',
            label: '政策标题',
         },
        {
            key: 'tags',
            label: '政策标签',
         },
             {
            key: 'status',
            label: '文章状态',
            render: (h, { row }) => {
              const statusMap = {
                '0': '草稿',
                '1': '上架中',
                '2': '已下架'
              }
              return <el-tag type={row.status === '1' ? 'success' : 'info'}>{statusMap[row.status]}</el-tag>
            }
         },
         {
            key: 'publishingMethodName',
            label: '发布方式',
         },
         {
            key: 'scheduledReleaseTime',
            label: '发布时间',
         },
        {
            key: 'validDateStart',
            label: '政策生效时间',
            width: 150
         },
             {
            key: 'validDateEnd',
            label: '政策失效时间',
            width: 150
         },
             {
            key: 'createTime',
            label: '创建时间',
         },
               {
            key: 'createBy',
            label: '创建人',
         },
         {
            key: 'action',
            label: '操作',
            width: 200,
            fixed: 'right',
            render: (h, { row, index, instance }) => {
              return <div class="action-buttons">
                 <el-button size="mini" type="text" on-click={() => this.handleView(row, instance)}>查看</el-button>
                  <el-button size="mini" type="text" on-click={() => this.handleEdit(row, instance)}>编辑</el-button>
                  {(row.status == '0' || row.status == '2') && <el-button size="mini" type="text" on-click={() => this.handlePublish(row, instance)}>上架</el-button>}
                  {row.status == '1' && <el-button size="mini" type="text" on-click={() => this.handleUnpublish(row, instance)}>下架</el-button>}
                  {index != 0 && <el-button size="mini" type="text" on-click={() => this.handleMoveUp(row, instance, index)}>上移</el-button>}
                  {index != (this.dataSource.length - 1) && <el-button size="mini" type="text" on-click={() => this.handleMoveDown(row, instance, index)}>下移</el-button>}
                  <el-button size="mini" type="text" on-click={() => this.handleDelete(row, instance)}>删除</el-button>
              </div>
            }
         }

     ],
     paginationConfig: {
          pageIndex: 1,
          pageSize: 10,
          total: 0
     },
     FormConfig: [
          {
        prop: 'policyCode',
        label: '政策编号',
        span: 8,
        formtype: 'Input',
         formItemOptions: {
                 labelWidth: '150px',
            }, // 表单项选项
        attrs: {
          placeholder: '请输入政策编号',
          clearable: true
        }
      },
   {
        prop: 'policyTitle',
        label: '政策名称',
        span: 8,
        formtype: 'Input',
        attrs: {
          placeholder: '请输入政策标题',
          clearable: true
        }
      },
        {
        prop: 'policyStatus',
        label: '文章状态',
        span: 8,
        formtype: 'Select',
         formItemOptions: {
                 labelWidth: '150px',
            }, // 表单项选项
        attrs: {
          placeholder: '请选择文章状态',
          clearable: true
        },
        dataOptions: [
          { label: '全部', value: '' },
           { label: '草稿', value: '0'},
            { label: '上架中', value: '1' },
    
            { label: '已下架', value: '2' },
           
            // {label: '待发布', value: 'pending'}
        ]
      },

         {
            label: '政策生效时间范围', // 表单项标签
            span: 8, // 栅格占据列数
            formItemOptions: {
                 labelWidth: '150px',
            }, // 表单项选项
            prop: 'effectiveTimeRange', // 数据绑定字段
            formtype: 'datePicker', // 表单项类型
            attrs: {
              valueFormat: 'yyyy-MM-dd HH:mm:ss', // 日期格式
              placeholder: '选择日期时间', // 占位符
              'is-range': true, // 是否为范围选择
              type: 'datetimerange', // 日期类型
              // "range-separator": '至', // 范围分隔符（注释掉）
              'start-placeholder': '开始日期', // 开始日期占位符
              'end-placeholder': '结束日期', // 结束日期占位符
              style: 'width: 100%' // 样式
            }
          },
      {
        prop: 'policyTag',
        label: '政策标签',
        span: 8,
        formtype: 'Input',
        attrs: {
          placeholder: '请选择政策标签',
          clearable: true,
          style: 'width: 100%'
        }
      },

       {
            label: '发布时间范围', // 表单项标签
            span: 8, // 栅格占据列数
            formItemOptions: {
                 labelWidth: '150px',
            }, // 表单项选项
            prop: 'publishTimeRange', // 数据绑定字段
            formtype: 'datePicker', // 表单项类型
            attrs: {
              valueFormat: 'yyyy-MM-dd HH:mm:ss', // 日期格式
              placeholder: '选择日期时间', // 占位符
              'is-range': true, // 是否为范围选择
              type: 'datetimerange', // 日期类型
              // "range-separator": '至', // 范围分隔符（注释掉）
              'start-placeholder': '开始日期', // 开始日期占位符
              'end-placeholder': '结束日期', // 结束日期占位符
              style: 'width: 100%' // 样式
            }
          },
           {
        prop: 'publishType',
        label: '发布方式',
        span: 8,
        formtype: 'Select',
         formItemOptions: {
                 labelWidth: '150px',
            }, // 表单项选项
        attrs: {
          placeholder: '请选择发布方式',
          clearable: true
        },
        dataOptions: [
          { label: '全部', value: '' },
          { label: '定时发布', value: '1' },
          { label: '立即发布', value: '0' }
   
        ]
      },

     ],
     formData: {
         policyCode: '',
         policyTitle: '',
         policyStatus: '',
         policyTag: '',
         publishType: '',
         effectiveTimeRange: [],
         publishTimeRange: []
     },
     renderLayoutProps: {
        fromLayProps: {
        minfoldRows: 1, // 最多展示两行
        labelWidth: '100px',
        size: 'small'
      },
      rowLayProps: {
        gutter: 20
      }
     },
     configBtnList: [ 
        {direction: 'left',
         name:'新增', 
        icon:'el-icon-plus', 
        size: 'mini', type:'primary',
        onClick: (mode, formRef, httpRquestInstace) => {

          addPolicyFrom({
            title: '新增',
            width: '75%',
            key: 'policyFormDialog',
            isDraggable: true, // 是否可以拖动 非必传
            closeOnClickModal: false, // 点击蒙层是否可以关闭
            hiddenFullBtn: false, // 是否隐藏全屏按钮 非必传参数
            fullscreen: false, // 是否全屏 非必传参数
            configBtn: [
          {
            icon: 'CircleCheck',
            key: 'save',
            type: 'primary',
            size: 'mini',
            name: '提交',
            class: ['primaryBtn'],
            click: (instantce, { close, getRefs, dialogVm }) => {
              console.log('保存了///',  getRefs.policyform.$httpRequest)
              // 表单校验
              getRefs.policyform.validate((valid) => {
                if (valid) {
                  console.log('表单验证成功',  getRefs.policyform.$httpRequest )
                  const {formData} = instantce
                  const {
                      coverImage,
                      effectiveTimeRange, 
                      invalidTimeRange, 
                     // policyContent, 
                      policyLinkContent,
                      policyEitorContent,
                      policyContentType,
                      policyReleaseDate,
                      policyStatus, 
                      policyReleaseType,
                      policyTag,
                      policyName,  
                      ispolicyTag, 
                     policyAbstract} = formData

                     const formParams = {
                        title: policyName,
                        ispolicyTag,  // 是否显示标签
                        tags: policyTag,
                        status: policyStatus,
                        publishingMethod: policyReleaseType,
                        type: 'policy',
                        // contentType: policyContentType,
                        // content: policyContent,
                        coverImage: coverImage, //Array.isArray(coverImage) && coverImage.length > 0 ? coverImage[0] : '',
                        validDateStart: effectiveTimeRange,
                        validDateEnd: invalidTimeRange,
                        scheduledReleaseTime: policyReleaseDate,
                        summary: policyAbstract || ''
                     }

                     if(policyContentType === '1'){ // 链接类型|自定义类型
                       if(!this.isUrl(policyLinkContent)){
                          this.$message.error('请输入有效的政策链接地址')
                          return
                       }
                        formParams.link = policyLinkContent
                     } else {
                         if(!policyEitorContent || policyEitorContent.trim() === '<p><br></p>'){
                            this.$message.error('请输入政策内容')
                            return
                         }

                        formParams.content = policyEitorContent
                     }
                     if(policyReleaseType === '1'){ // 定时发布
                        formParams.scheduledReleaseTime = policyReleaseDate
                     } else {
                        formParams.scheduledReleaseTime = ''
                     }
                     if(formParams.ispolicyTag === 'always'){
                        formParams.tags = policyTag
                     } else {
                        formParams.tags = ''
                     }

                      console.log('新增政策参数、、', formParams)
                     getRefs.policyform.$httpRequest({
                        url: '/pcApi/honda-pc/cms/add.do',
                        method: 'post',
                        formParams:{...formParams}
                     }).then((res) => {
                        console.log('新增政策返回结果、、', res)
                        // 关闭弹窗
                        httpRquestInstace() // 表格刷新
                        close()
                        // 触发表格刷新
                      //  dialogVm.$emit('refreshTable')
                     }).catch((err) => {
                        console.log('新增政策返回错误、、', err)
                     })
                    
                
                } else {
                  console.log('表单验证失败')
                  // return false
                }
              })
            }
          },
          {
            icon: 'CircleClose',
            key: 'cancel',
            class: ['normalBtn'],
            size: 'mini',
            name: '取消',
            click: (instantce, { close }) => {
            //   console.log('取消了///', instantce)
              // 关闭弹窗
              close()
            }
          }
        ],
        render: (h, ctx) => {
          return <PolicyForm policyRow={{}} policyFormStatus={"add"}/>
          }
        })
       }
      },
         {type:'primary',
          size: 'mini', name:'查询',icon:'el-icon-search',
           key: 'query',
           triggerEvent: true // 是否自动触发查询
         },
         {type:'warning',  key: 'rest', size: 'mini',name:'重置',icon:'el-icon-refresh',  triggerEvent: true }]
    }
  },
  watch:{},
  computed: {},
  methods: {
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
handleMoveUp(row, instantce, index) {

          instantce.$httpRequest({
                        url: '/pcApi/honda-pc/cms/swapSort.do',
                        method: 'post',
                        formParams:{id: row.id, anotherId: this.dataSource[index - 1].id}
                     }).then((res) => {
                        console.log('编辑政策返回结果、、', res)
                        // 关闭弹窗
                        instantce.httpRquestInstace() // 表格刷新
                     
                   
                     }).catch((err) => {
                        console.log('新增政策返回错误、、', err)
                     })
},
handleMoveDown(row, instantce, index) {
           instantce.$httpRequest({
                        url: '/pcApi/honda-pc/cms/swapSort.do',
                        method: 'post',
                        formParams:{id: row.id, anotherId: this.dataSource[index + 1].id}
                     }).then((res) => {
                        console.log('编辑政策返回结果、、', res)
                        // 关闭弹窗
                        instantce.httpRquestInstace() // 表格刷新
                     
                   
                     }).catch((err) => {
                        console.log('新增政策返回错误、、', err)
                     })
},
     handleView(row, instantce){
        console.log('查看政策、、', row, instantce)
        viewPolicyDialog({
            title: '查看',
            width: '60%',
            key: 'viewPolicyDialog',
            isDraggable: true, // 是否可以拖动 非必传
            closeOnClickModal: false, // 点击蒙层是否可以关闭
            hiddenFullBtn: true, // 是否隐藏全屏按钮 非必传参数
            fullscreen: false, // 是否全屏 非必传参数
            configBtn: [
          {
            icon: 'CircleClose',
            key: 'cancel',
            class: ['normalBtn'],
            size: 'mini',
            name: '关闭',
            click: (instantce, { close }) => {
              // 关闭弹窗
              close()
            }
          }
        ], render: (h, ctx) => {
          return <PolicyForm policyRow={row} policyFormStatus={"view"} />
          }
        })
     },
     handleEdit(row, tableInstantce){
        console.log('编辑政策、、', row, tableInstantce)
        editPolicyDialog({
            title: '编辑',
            width: '75%',
            key: 'editPolicyDialog',
            isDraggable: true, // 是否可以拖动 非必传
            closeOnClickModal: false, // 点击蒙层是否可以关闭
            hiddenFullBtn: false, // 是否隐藏全屏按钮 非必传参数
            fullscreen: false, // 是否全屏 非必传参数
            configBtn: [
              {
            icon: 'CircleCheck',
            key: 'save',
            type: 'primary',
            size: 'mini',
            name: '提交',
            class: ['primaryBtn'],
            click: (instantce, { close, getRefs, dialogVm }) => {
        
              // 表单校验
              getRefs.policyform.validate((valid) => {
                if (valid) {
     
                  const {formData} = instantce
                  const {
                      coverImage,
                      effectiveTimeRange, 
                      invalidTimeRange, 
                      policyLinkContent,
                      policyEitorContent,
                      policyContentType,
                      policyReleaseDate,
                      policyStatus, 
                      policyReleaseType,
                      policyTag,
                      policyName,  
                      ispolicyTag, 
                     policyAbstract} = formData

                     const formParams = {
                        title: policyName,
                        ispolicyTag,  // 是否显示标签
                        tags: policyTag,
                        status: policyStatus,
                        publishingMethod: policyReleaseType,
                        type: 'policy',
                        id: row.id,
                        // contentType: policyContentType,
                        // content: policyContent,
                        coverImage: coverImage, //Array.isArray(coverImage) && coverImage.length > 0 ? coverImage[0] : '',
                        validDateStart: effectiveTimeRange,
                        validDateEnd: invalidTimeRange,
                        scheduledReleaseTime: policyReleaseDate,
                        summary: policyAbstract || ''
                     }

                     if(policyContentType === '1'){ // 链接类型|自定义类型
                       if(!this.isUrl(policyLinkContent)){
                          this.$message.error('请输入有效的政策链接地址')
                          return
                       }
                        formParams.link = policyLinkContent
                     } else {
                         if(!policyEitorContent || policyEitorContent.trim() === '<p><br></p>'){
                            this.$message.error('请输入政策内容')
                            return
                         }
                        formParams.content = policyEitorContent
                     }
                     if(policyReleaseType === '1'){ // 定时发布
                        formParams.scheduledReleaseTime = policyReleaseDate
                     } else {
                        formParams.scheduledReleaseTime = ''
                     }
                     if(formParams.ispolicyTag === 'always'){
                        formParams.tags = policyTag
                     } else {
                        formParams.tags = ''
                     }


                     getRefs.policyform.$httpRequest({
                        url: '/pcApi/honda-pc/cms/update.do',
                        method: 'post',
                        formParams:{...formParams}
                     }).then((res) => {
                  
                        // 关闭弹窗
                        tableInstantce.httpRquestInstace() // 表格刷新
                        close()
                        // 触发表格刷新
                   
                     }).catch((err) => {
                        console.log('新增政策返回错误、、', err)
                     })
                    
                
                } else {
                  console.log('表单验证失败')
                  // return false
                }
              })
            }
          },
          {
            icon: 'CircleClose',
            key: 'cancel',
            class: ['normalBtn'],
            size: 'mini',
            name: '关闭',
            click: (instantce, { close }) => {
              // 关闭弹窗
              close()
            }
          }
        ], render: (h, ctx) => {
          return <PolicyForm policyRow={row} policyFormStatus={"edit"} />
          }
        })
     },
      handlePublish(row, instantce){


          instantce.$httpRequest({
                        url: '/pcApi/honda-pc/cms/shelfUp.do',
                        method: 'post',
                        formParams:{id: row.id}
                     }).then((res) => {
                        console.log('编辑政策返回结果、、', res)
                        // 关闭弹窗
                        instantce.httpRquestInstace() // 表格刷新
                     
                   
                     }).catch((err) => {
                        console.log('新增政策返回错误、、', err)
                     })

      },
      handleUnpublish(row, instantce){
  
            instantce.$httpRequest({
                        url: '/pcApi/honda-pc/cms/shelfDown.do',
                        method: 'post',
                        formParams:{id: row.id}
                     }).then((res) => {
                  
                        instantce.httpRquestInstace() // 表格刷新
           
                   
                     }).catch((err) => {
                     
                     })
      },
      handleDelete(row, instantce){
   
            instantce.$httpRequest({
                        url: '/pcApi/honda-pc/cms/delete.do',
                        method: 'post',
                        formParams:{id: row.id}
                     }).then((res) => {
                      
               
                        instantce.httpRquestInstace() // 表格刷新
                   
                   
                     }).catch((err) => {
                        
                     })
      }
  },
  mounted() {},
  created() {}
}
</script>
<style lang="scss" scoped>
  .policy-manage{
    //  height: 500px;
    // background: pink;
  }
</style>