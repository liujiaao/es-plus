<template>
  <div>
    <el-button @click="openComplexDialog">复杂内容弹窗</el-button>
  </div>
</template>

<script>
import { useDialog } from '@es-plus/vue2'

export default {
  data() {
    return {
      activeTab: 'basic',
      newTag: '',
      complexFormData: {
        projectName: '',
        description: '',
        type: '',
        tags: [],
        notify: true,
        autoSave: false
      }
    }
  },
  methods: {
    addTag() {
      if (this.newTag && !this.complexFormData.tags.includes(this.newTag)) {
        this.complexFormData.tags.push(this.newTag)
      }
      this.newTag = ''
    },
    removeTag(index) {
      this.complexFormData.tags.splice(index, 1)
    },
    openComplexDialog() {
      const { close } = useDialog()({
        title: '项目配置',
        width: '700px',
        // JSX 支持复杂的条件渲染和循环
        render: (h, ctx) => (
          <el-tabs value={this.activeTab} on-input={val => { this.activeTab = val }}>
            <el-tab-pane label="基本信息" name="basic">
              <es-form
                ref="basicForm"
                form-item-list={[
                  {
                    prop: 'projectName',
                    label: '项目名称',
                    span: 24,
                    formtype: 'Input',
                    formItemOptions: {
                      rules: [{ required: true, message: '请输入项目名称' }]
                    }
                  },
                  {
                    prop: 'type',
                    label: '项目类型',
                    span: 12,
                    formtype: 'Select',
                    dataOptions: [
                      { label: 'Web项目', value: 'web' },
                      { label: '移动App', value: 'app' },
                      { label: '小程序', value: 'miniapp' }
                    ]
                  },
                  {
                    prop: 'description',
                    label: '项目描述',
                    span: 24,
                    formtype: 'Input',
                    attrs: { type: 'textarea', rows: 4 }
                  }
                ]}
                model={this.complexFormData}
              />
            </el-tab-pane>

            <el-tab-pane label="标签设置" name="tags">
              <div style="margin-bottom: 10px;">
                <el-input
                  v-model={this.newTag}
                  placeholder="输入标签后按回车添加"
                  size="small"
                  native-on-keyup={(e) => {
                    if (e.keyCode === 13 && this.newTag) {
                      this.addTag()
                    }
                  }}
                />
              </div>
              <div style="display: flex; flex-wrap: wrap; gap: 8px;">
                {this.complexFormData.tags.map((tag, index) => (
                  <el-tag
                    key={index}
                    closable
                    size="small"
                    on-close={() => this.removeTag(index)}
                  >
                    {tag}
                  </el-tag>
                ))}
              </div>
            </el-tab-pane>

            <el-tab-pane label="高级设置" name="advanced">
              <es-form
                form-item-list={[
                  {
                    prop: 'notify',
                    label: '开启通知',
                    span: 12,
                    formtype: 'Switch'
                  },
                  {
                    prop: 'autoSave',
                    label: '自动保存',
                    span: 12,
                    formtype: 'Switch'
                  }
                ]}
                model={this.complexFormData}
              />
            </el-tab-pane>
          </el-tabs>
        ),
        configBtn: [
          {
            name: '取消',
            key: 'cancel',
            click: (_, { close }) => close()
          },
          {
            name: '保存配置',
            type: 'primary',
            key: 'save',
            click: async (_, { close, getRefs }) => {
              // 校验「基本信息」表单（项目名称必填）——通过命名 ref 取到 es-form 实例
              const basicForm = getRefs('basicForm')
              const valid = await basicForm?.validate()
              if (!valid) return
              console.log('配置数据：', this.complexFormData)
              this.$message.success('配置保存成功')
              close()
            }
          }
        ]
      })
    }
  }
}
</script>
