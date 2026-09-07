<template>
  <div>
    <el-button
      type="primary"
      @click="openMainDialog"
    >
      打开主弹窗
    </el-button>
  </div>
</template>

<script>
import { useDialog, EsForm, EsTable } from '@es-plus/vue2'

const createDialog = useDialog()

export default {
  name: 'NestedDialogDemo',
  data() {
    return {
      mainFormData: {
        projectName: '',
        description: '',
        members: []
      },
      memberList: [
        { id: 1, name: '张三', role: '开发', email: 'zhangsan@example.com' },
        { id: 2, name: '李四', role: '测试', email: 'lisi@example.com' },
        { id: 3, name: '王五', role: '设计', email: 'wangwu@example.com' }
      ],
      mainFormConfig: [
        {
          prop: 'projectName',
          label: '项目名称',
          span: 24,
          formtype: 'Input',
          attrs: {
            placeholder: '请输入项目名称'
          }
        },
        {
          prop: 'description',
          label: '项目描述',
          span: 24,
          formtype: 'Input',
          attrs: {
            placeholder: '请输入项目描述',
            type: 'textarea',
            rows: 3
          }
        }
      ],
      mainLayoutProps: {
        fromLayProps: {
          labelWidth: '100px',
          size: 'small'
        }
      }
    }
  },
  computed: {
    memberTableColumns() {
      return [
        { prop: 'name', label: '姓名', width: 120 },
        { prop: 'role', label: '角色', width: 100 },
        { prop: 'email', label: '邮箱' },
        {
          prop: 'action',
          label: '操作',
          width: 100,
          render: (h, row) => {
            return h('el-button', {
              props: { size: 'mini', type: 'text', style: { color: '#f56c6c' } },
              on: { click: () => this.removeMember(row) }
            }, '移除')
          }
        }
      ]
    }
  },
  created() {
    this.memberForm = {
      name: '',
      role: '',
      email: ''
    }
    this.memberFormConfig = [
      {
        prop: 'name',
        label: '姓名',
        span: 24,
        formtype: 'Input',
        attrs: {
          placeholder: '请输入姓名'
        }
      },
      {
        prop: 'role',
        label: '角色',
        span: 24,
        formtype: 'Select',
        attrs: {
          placeholder: '请选择角色'
        },
        dataOptions: [
          { label: '开发', value: '开发' },
          { label: '测试', value: '测试' },
          { label: '设计', value: '设计' },
          { label: '产品', value: '产品' }
        ]
      },
      {
        prop: 'email',
        label: '邮箱',
        span: 24,
        formtype: 'Input',
        attrs: {
          placeholder: '请输入邮箱'
        }
      }
    ]
  },
  methods: {
    openMainDialog() {
      createDialog({
        title: '项目管理',
        width: '800px',
        isDraggable: true,
        render: (h) => {
          return h('div', { style: { padding: '20px' } }, [
            h(EsForm, {
              props: {
                formItemList: this.mainFormConfig,
                model: this.mainFormData,
                layoutFormProps: this.mainLayoutProps
              }
            }),
            h('div', { style: { marginBottom: '10px' } }, [
              h('el-button', {
                props: { type: 'primary', size: 'mini', icon: 'el-icon-plus' },
                on: { click: () => this.openMemberDialog() }
              }, '添加成员')
            ]),
            h(EsTable, {
              props: {
                dataSource: this.memberList,
                columns: this.memberTableColumns,
                options: {
                  border: true,
                  size: 'small'
                }
              }
            })
          ])
        },
        configBtn: [
          {
            name: '取消',
            key: 'cancel',
            onClick: (vm, { close }) => close()
          },
          {
            name: '保存',
            type: 'primary',
            key: 'save',
            onClick: (vm, { close }) => {
              this.$message.success('保存成功')
              close()
            }
          }
        ]
      })
    },
    openMemberDialog() {
      createDialog({
        title: '添加成员',
        width: '500px',
        render: (h) => {
          return h('div', { style: { padding: '20px' } }, [
            h(EsForm, {
              props: {
                formItemList: this.memberFormConfig,
                model: this.memberForm,
                layoutFormProps: {
                  fromLayProps: {
                    labelWidth: '80px',
                    size: 'small'
                  }
                }
              }
            })
          ])
        },
        configBtn: [
          {
            name: '取消',
            key: 'cancel',
            onClick: (vm, { close }) => close()
          },
          {
            name: '添加',
            type: 'primary',
            key: 'add',
            onClick: (vm, { close }) => {
              if (!this.memberForm.name || !this.memberForm.role || !this.memberForm.email) {
                this.$message.warning('请填写完整信息')
                return
              }
              this.memberList.push({
                id: Date.now(),
                ...this.memberForm
              })
              this.memberForm = { name: '', role: '', email: '' }
              this.$message.success('添加成功')
              close()
            }
          }
        ]
      })
    },
    removeMember(row) {
      const index = this.memberList.findIndex(item => item.id === row.id)
      if (index > -1) {
        this.memberList.splice(index, 1)
        this.$message.success('移除成功')
      }
    }
  }
}
</script>