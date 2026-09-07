<template>
  <div>
    <el-button type="primary" @click="openMasterDetailDialog">打开主子表弹窗</el-button>
    <div v-if="lastOrder" class="selected-info">
      最近订单：{{ lastOrder.supplier }} - {{ lastOrder.total }}（{{ lastOrder.detailCount }} 条明细）
    </div>
  </div>
</template>

<script>
import Vue from 'vue'
import { useDialog } from '@es-plus/vue2'

const dialog = useDialog()

export default {
  data() {
    return {
      lastOrder: null
    }
  },
  methods: {
    openMasterDetailDialog() {
      const formData = Vue.observable({
        supplier: '',
        orderDate: '',
        remark: ''
      })
      const detailList = Vue.observable([])

      dialog({
        title: '采购订单录入',
        width: '900px',
        render: (h) => {
          const total = detailList.reduce((sum, item) => sum + item.qty * item.price, 0)
          return (
            <div style="padding: 10px;">
              <es-form
                ref="masterForm"
                form-item-list={[
                  {
                    prop: 'supplier',
                    label: '供应商',
                    span: 8,
                    formtype: 'Select',
                    attrs: { placeholder: '请选择供应商', style: 'width: 100%' },
                    dataOptions: [
                      { label: '供应商A', value: '供应商A' },
                      { label: '供应商B', value: '供应商B' },
                      { label: '供应商C', value: '供应商C' }
                    ],
                    formItemOptions: { rules: [{ required: true, message: '请选择供应商' }] }
                  },
                  {
                    prop: 'orderDate',
                    label: '订单日期',
                    span: 8,
                    formtype: 'DatePicker',
                    attrs: { placeholder: '请选择日期', valueFormat: 'yyyy-MM-dd' },
                    formItemOptions: { rules: [{ required: true, message: '请选择日期' }] }
                  },
                  {
                    prop: 'remark',
                    label: '备注',
                    span: 8,
                    formtype: 'Input',
                    attrs: { placeholder: '请输入备注' }
                  }
                ]}
                model={formData}
                layout-form-props={{
                  fromLayProps: { labelWidth: '80px', size: 'small' },
                  rowLayProps: { gutter: 15 }
                }}
              />
              <el-divider content-position="left">
                <span style="font-size: 13px; color: #606266;">
                  订单明细（共 {detailList.length} 行，合计 ¥{total.toFixed(2)}）
                </span>
              </el-divider>
              <div style="marginBottom: 10px;">
                <el-button
                  type="primary"
                  size="mini"
                  icon="el-icon-plus"
                  on-click={() => this.addDetail(detailList)}
                >
                  添加明细
                </el-button>
              </div>
              <es-table
                data-source={detailList}
                columns={[
                  {
                    key: 'product',
                    label: '产品',
                    width: 200,
                    render: (h, { row }) => (
                      <el-input
                        v-model={row.product}
                        size="mini"
                        placeholder="产品名称"
                        style="width: 100%;"
                      />
                    )
                  },
                  {
                    key: 'qty',
                    label: '数量',
                    width: 120,
                    render: (h, { row }) => (
                      <el-input-number
                        v-model={row.qty}
                        size="mini"
                        min={1}
                        style="width: 100px;"
                      />
                    )
                  },
                  {
                    key: 'price',
                    label: '单价',
                    render: (h, { row }) => (
                      <el-input-number
                        v-model={row.price}
                        size="mini"
                        min={0}
                        precision={2}
                        style="width: 100px;"
                      />
                    )
                  },
                  {
                    key: 'subtotal',
                    label: '小计',
                    render: (h, { row }) => (
                      <span style="color: #f56c6c; font-weight: bold;">
                        ¥{(row.qty * row.price).toFixed(2)}
                      </span>
                    )
                  },
                  {
                    key: 'action',
                    label: '操作',
                    width: 80,
                    render: (h, { index }) => (
                      <el-button
                        type="text"
                        size="mini"
                        style="color: #f56c6c;"
                        on-click={() => this.removeDetail(detailList, index)}
                      >
                        删除
                      </el-button>
                    )
                  }
                ]}
                options={{ border: true, size: 'small' }}
              />
            </div>
          )
        },
        configBtn: [
          {
            name: '取消',
            key: 'cancel',
            click: (vm, { close }) => close()
          },
          {
            name: '提交订单',
            type: 'primary',
            key: 'submit',
            click: async (vm, { close, getRefs }) => {
              const formRef = getRefs('masterForm')
              const valid = await formRef.validate()
              if (!valid) return
              if (detailList.length === 0) {
                this.$message.warning('请至少添加一条明细')
                return
              }
              const emptyProduct = detailList.some(item => !item.product.trim())
              if (emptyProduct) {
                this.$message.warning('产品名称不能为空')
                return
              }
              const total = detailList.reduce((sum, item) => sum + item.qty * item.price, 0)
              this.lastOrder = {
                supplier: formData.supplier,
                total: total.toFixed(2),
                detailCount: detailList.length
              }
              this.$message.success('订单提交成功')
              close()
            }
          }
        ]
      })
    },
    addDetail(detailList) {
      detailList.push({ id: Date.now(), product: '', qty: 1, price: 0 })
    },
    removeDetail(detailList, index) {
      detailList.splice(index, 1)
    },
    calculateTotal(detailList) {
      return detailList.reduce((sum, item) => sum + item.qty * item.price, 0)
    }
  }
}
</script>
