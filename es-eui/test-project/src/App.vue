<template>
  <div class="test-container">
    <el-container>
      <el-header>
        <h1>ES-EUI 组件库测试验证</h1>
        <p class="subtitle">
          生产环境测试项目 - 验证组件库功能
        </p>
      </el-header>
      <el-main>
        <el-row :gutter="20">
          <el-col :span="24">
            <el-card class="test-card">
              <template #header>
                <div>
                  <span>测试结果概览</span>
                </div>
              </template>
              <el-row :gutter="10">
                <el-col :span="6">
                  <el-tag :type="testResults.esDialog ? 'success' : 'danger'">
                    EsDialog: {{ testResults.esDialog ? '✓ 通过' : '✗ 失败' }}
                  </el-tag>
                </el-col>
                <el-col :span="6">
                  <el-tag :type="testResults.esForm ? 'success' : 'danger'">
                    EsForm: {{ testResults.esForm ? '✓ 通过' : '✗ 失败' }}
                  </el-tag>
                </el-col>
                <el-col :span="6">
                  <el-tag :type="testResults.esTable ? 'success' : 'danger'">
                    EsTable: {{ testResults.esTable ? '✓ 通过' : '✗ 失败' }}
                  </el-tag>
                </el-col>
                <el-col :span="6">
                  <el-tag :type="testResults.useDialogues ? 'success' : 'danger'">
                    useDialog: {{ testResults.useDialogues ? '✓ 通过' : '✗ 失败' }}
                  </el-tag>
                </el-col>
              </el-row>
            </el-card>
          </el-col>
        </el-row>

        <el-row
          :gutter="20"
          style="margin-top: 20px;"
        >
          <el-col :span="12">
            <el-card class="test-card">
              <template #header>
                <div>
                  <span>EsDialog 组件测试</span>
                  <el-button
                    type="primary"
                    size="small"
                    style="float: right;"
                    @click="testEsDialog"
                  >
                    打开测试对话框
                  </el-button>
                </div>
              </template>
              <p>点击按钮测试 EsDialog 组件是否正常工作</p>
              <el-alert
                v-if="testResults.esDialog"
                title="EsDialog 组件测试通过"
                type="success"
                :closable="false"
                show-icon
              >
              </el-alert>
            </el-card>
          </el-col>

          <el-col :span="12">
            <el-card class="test-card">
              <template #header>
                <div>
                  <span>useDialog 函数测试</span>
                  <el-button
                    type="success"
                    size="small"
                    style="float: right;"
                    @click="testUseDialog"
                  >
                    使用 useDialog 打开
                  </el-button>
                </div>
              </template>
              <p>点击按钮测试 useDialog 函数是否正常工作</p>
              <el-alert
                v-if="testResults.useDialogues"
                title="useDialog 函数测试通过"
                type="success"
                :closable="false"
                show-icon
              >
              </el-alert>
            </el-card>
          </el-col>
        </el-row>

        <el-row
          :gutter="20"
          style="margin-top: 20px;"
        >
          <el-col :span="24">
            <el-card class="test-card">
              <template #header>
                <div>
                  <span>EsForm 组件测试</span>
                </div>
              </template>
              <es-form
                ref="testForm"
                :form-config="formConfig"
                :form-data="formData"
                @submit="handleFormSubmit"
                @cancel="handleFormCancel"
              >
              </es-form>
              <el-alert
                v-if="testResults.esForm"
                title="EsForm 组件测试通过"
                type="success"
                :closable="false"
                show-icon
                style="margin-top: 10px;"
              >
              </el-alert>
            </el-card>
          </el-col>
        </el-row>

        <el-row
          :gutter="20"
          style="margin-top: 20px;"
        >
          <el-col :span="24">
            <el-card class="test-card">
              <template #header>
                <div>
                  <span>EsTable 组件测试</span>
                </div>
              </template>
              <es-table
                ref="testTable"
                :table-config="tableConfig"
                :table-data="tableData"
                @selection-change="handleSelectionChange"
                @row-click="handleRowClick"
              >
              </es-table>
              <el-alert
                v-if="testResults.esTable"
                title="EsTable 组件测试通过"
                type="success"
                :closable="false"
                show-icon
                style="margin-top: 10px;"
              >
              </el-alert>
            </el-card>
          </el-col>
        </el-row>
      </el-main>
    </el-container>

    <!-- EsDialog 测试对话框 -->
    <es-dialog
      v-model="dialogVisible"
      title="EsDialog 组件测试"
      width="500px"
      :draggable="true"
      @close="handleDialogClose"
    >
      <div style="padding: 20px;">
        <p>这是 EsDialog 组件的测试内容</p>
        <el-form>
          <el-form-item label="测试输入">
            <el-input
              v-model="dialogInput"
              placeholder="请输入测试内容"
            ></el-input>
          </el-form-item>
        </el-form>
      </div>
      <template #footer>
        <el-button @click="dialogVisible = false">
          取消
        </el-button>
        <el-button
          type="primary"
          @click="handleDialogConfirm"
        >
          确定
        </el-button>
      </template>
    </es-dialog>
  </div>
</template>

<script>
export default {
  name: 'App',
  data() {
    return {
      testResults: {
        esDialog: false,
        esForm: false,
        esTable: false,
        useDialogues: false
      },
      dialogVisible: false,
      dialogInput: '',
      formData: {
        name: '',
        age: '',
        email: '',
        gender: 'male',
        hobbies: []
      },
      formConfig: {
        labelWidth: '100px',
        items: [
          {
            prop: 'name',
            label: '姓名',
            type: 'input',
            placeholder: '请输入姓名',
            rules: [
              { required: true, message: '请输入姓名', trigger: 'blur' }
            ]
          },
          {
            prop: 'age',
            label: '年龄',
            type: 'input',
            inputType: 'number',
            placeholder: '请输入年龄',
            rules: [
              { required: true, message: '请输入年龄', trigger: 'blur' }
            ]
          },
          {
            prop: 'email',
            label: '邮箱',
            type: 'input',
            placeholder: '请输入邮箱',
            rules: [
              { required: true, message: '请输入邮箱', trigger: 'blur' },
              { type: 'email', message: '请输入正确的邮箱格式', trigger: 'blur' }
            ]
          },
          {
            prop: 'gender',
            label: '性别',
            type: 'select',
            options: [
              { label: '男', value: 'male' },
              { label: '女', value: 'female' }
            ]
          },
          {
            prop: 'hobbies',
            label: '爱好',
            type: 'checkbox',
            options: [
              { label: '阅读', value: 'reading' },
              { label: '运动', value: 'sports' },
              { label: '音乐', value: 'music' },
              { label: '旅行', value: 'travel' }
            ]
          }
        ]
      },
      tableData: [
        { id: 1, name: '张三', age: 25, email: 'zhangsan@example.com', status: 'active' },
        { id: 2, name: '李四', age: 30, email: 'lisi@example.com', status: 'inactive' },
        { id: 3, name: '王五', age: 28, email: 'wangwu@example.com', status: 'active' },
        { id: 4, name: '赵六', age: 35, email: 'zhaoliu@example.com', status: 'active' },
        { id: 5, name: '钱七', age: 22, email: 'qianqi@example.com', status: 'inactive' }
      ],
      tableConfig: {
        border: true,
        stripe: true,
        selection: true,
        pagination: {
          pageSize: 10,
          currentPage: 1,
          total: 5
        },
        columns: [
          {
            prop: 'id',
            label: 'ID',
            width: 80
          },
          {
            prop: 'name',
            label: '姓名',
            width: 120
          },
          {
            prop: 'age',
            label: '年龄',
            width: 80
          },
          {
            prop: 'email',
            label: '邮箱',
            minWidth: 200
          },
          {
            prop: 'status',
            label: '状态',
            width: 100,
            formatter: (row) => {
              return row.status === 'active' ? '活跃' : '非活跃'
            }
          },
          {
            label: '操作',
            width: 150,
            buttons: [
              {
                text: '编辑',
                type: 'primary',
                size: 'small',
                handler: (row) => {
                  this.$message.success(`编辑用户: ${row.name}`)
                }
              },
              {
                text: '删除',
                type: 'danger',
                size: 'small',
                handler: (row) => {
                  this.$message.warning(`删除用户: ${row.name}`)
                }
              }
            ]
          }
        ]
      }
    }
  },
  mounted() {
    this.$nextTick(() => {
      // 检查组件是否正确注册
      this.checkComponents()
    })
  },
  methods: {
    checkComponents() {
      // 检查 EsDialog 组件
      if (this.$options.components.EsDialog) {
        this.testResults.esDialog = true
      }

      // 检查 EsForm 组件
      if (this.$options.components.EsForm) {
        this.testResults.esForm = true
      }

      // 检查 EsTable 组件
      if (this.$options.components.EsTable) {
        this.testResults.esTable = true
      }

      // 检查 useDialog 函数
      if (this.$useDialog) {
        this.testResults.useDialogues = true
      }
    },

    testEsDialog() {
      this.dialogVisible = true
      this.testResults.esDialog = true
      this.$message.success('EsDialog 组件测试通过')
    },

    testUseDialog() {
      try {
        if (this.$useDialog) {
          const dialog = this.$useDialog({
            title: 'useDialog 测试',
            content: '这是通过 useDialog 函数打开的对话框',
            width: '400px',
            onConfirm: () => {
              this.$message.success('useDialog 函数测试通过')
              this.testResults.useDialogues = true
              dialog.close()
            },
            onCancel: () => {
              dialog.close()
            }
          })
        } else {
          this.$message.warning('useDialog 函数未找到')
        }
      } catch (error) {
        console.error('useDialog 测试失败:', error)
        this.$message.error('useDialog 函数测试失败')
      }
    },

    handleDialogClose() {
      this.$message.info('对话框已关闭')
    },

    handleDialogConfirm() {
      this.$message.success(`对话框确认，输入内容: ${this.dialogInput}`)
      this.dialogVisible = false
    },

    handleFormSubmit(formData) {
      this.testResults.esForm = true
      this.$message.success('EsForm 组件测试通过，表单数据已提交')
      console.log('表单提交数据:', formData)
    },

    handleFormCancel() {
      this.$message.info('表单已取消')
    },

    handleSelectionChange(selection) {
      console.log('选中的行:', selection)
      this.$message.info(`已选择 ${selection.length} 行`)
    },

    handleRowClick(row) {
      console.log('点击的行:', row)
      this.$message.info(`点击了: ${row.name}`)
    }
  }
}
</script>

<style scoped>
.test-container {
  min-height: 100vh;
  background-color: #f5f7fa;
}

.el-header {
  background-color: #409eff;
  color: white;
  text-align: center;
  line-height: 60px;
  padding: 0 20px;
}

.el-header h1 {
  margin: 0;
  font-size: 24px;
}

.subtitle {
  margin: 0;
  font-size: 14px;
  opacity: 0.9;
}

.el-main {
  padding: 20px;
}

.test-card {
  margin-bottom: 20px;
}

.test-card >>> .el-card__header {
  background-color: #f8f9fa;
  border-bottom: 1px solid #e4e7ed;
}
</style>