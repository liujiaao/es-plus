<template>
  <div>
    <es-form
      ref="orderForm"
      :form-item-list="formWithTableItems"
      :model="formWithTableData"
    />
    <div class="form-actions">
      <el-button type="primary" @click="submitFormWithTable">提交订单</el-button>
      <el-button @click="resetFormWithTable">重置</el-button>
    </div>
  </div>
</template>

<script>
export default {
  data() {
    return {
      formWithTableData: {
        orderNo: '',
        customer: '',
        items: [
          { id: 1, product: '产品A', quantity: 2, price: 100 },
          { id: 2, product: '产品B', quantity: 1, price: 200 }
        ]
      },
      formWithTableItems: []
    }
  },
  mounted() {
    this.$nextTick(() => {
      this.buildFormWithTableItems()
    })
  },
  methods: {
    buildFormWithTableItems() {
      this.formWithTableItems = [
        { prop: 'orderNo', label: '订单编号', span: 12, formtype: 'Input' },
        { prop: 'customer', label: '客户名称', span: 12, formtype: 'Input' },
        {
          prop: 'items',
          label: '订单明细',
          span: 24,
          render: (h, model, row) => (
            <es-table
              data-source={this.formWithTableData.items}
              columns={[
                { prop: 'product', label: '产品', width: 200 },
                {
                  prop: 'quantity',
                  label: '数量',
                  width: 150,
                  render: (h, { row: item }) => (
                    <el-input-number
                      v-model={item.quantity}
                      min={1}
                      size="small"
                      style="width: 100px;"
                    />
                  )
                },
                {
                  prop: 'price',
                  label: '单价',
                  width: 150,
                  render: (h, { row: item }) => (
                    <el-input-number
                      v-model={item.price}
                      min={0}
                      precision={2}
                      size="small"
                      style="width: 120px;"
                    />
                  )
                },
                {
                  prop: 'subtotal',
                  label: '小计',
                  render: (h, { row: item }) => (
                    <span style="color: #f56c6c; font-weight: bold;">
                      ¥{(item.quantity * item.price).toFixed(2)}
                    </span>
                  )
                },
                {
                  prop: 'action',
                  label: '操作',
                  width: 100,
                  render: (h, { index }) => (
                    <el-button
                      type="text"
                      size="small"
                      on-click={() => this.removeItem(index)}
                    >
                      删除
                    </el-button>
                  )
                }
              ]}
              options={{ border: true }}
            />
          )
        }
      ]
    },
    removeItem(index) {
      this.formWithTableData.items.splice(index, 1)
    },
    submitFormWithTable() {
      const items = this.formWithTableData.items
      if (!items.length) {
        this.$message.warning('请先添加订单明细')
        return
      }
      const total = items.reduce((sum, item) => sum + item.quantity * item.price, 0)
      this.$message.success(`提交成功：${items.length} 条明细，合计 ¥${total.toFixed(2)}`)
    },
    resetFormWithTable() {
      this.$refs.orderForm?.resetFields()
      this.formWithTableData.items = []
    }
  }
}
</script>
