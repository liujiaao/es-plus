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
  created() {
    // Defer to mounted to avoid EsForm height calc loop with embedded table
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
                { key: 'product', label: '产品', width: 200 },
                {
                  key: 'quantity',
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
                  key: 'price',
                  label: '单价',
                  width: 150,
                  render: (h, { row: item }) => (
                    <el-input
                      v-model={item.price}
                      size="small"
                      style="width: 100px;"
                    >
                      <template slot="prepend">¥</template>
                    </el-input>
                  )
                },
                {
                  key: 'subtotal',
                  label: '小计',
                  render: (h, { row: item }) => (
                    <span style="color: #f56c6c; font-weight: bold;">
                      ¥{item.quantity * item.price}
                    </span>
                  )
                },
                {
                  key: 'action',
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
      console.log('订单数据:', this.formWithTableData)
      this.$message.success('提交成功')
    },
    resetFormWithTable() {
      this.formWithTableData = {
        orderNo: '',
        customer: '',
        items: []
      }
    }
  }
}
</script>
