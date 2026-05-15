<template>
  <div class="example-form-computed">
    <es-form
      :model="formModel"
      :form-item-list="formItems"
      :config-btn="configBtn"
      :layout-form-props="layoutProps"
    />
  </div>
</template>

<script setup lang="ts">
import { reactive, computed } from 'vue'
import { ElMessage } from 'element-plus'
import EsForm from 'es-plus/components/es-form'

const productMap: Record<string, { name: string; price: number; unit: string }> = {
  laptop:  { name: '笔记本电脑', price: 5999, unit: '台' },
  phone:   { name: '智能手机',   price: 3999, unit: '部' },
  tablet:  { name: '平板电脑',   price: 2999, unit: '台' },
  watch:   { name: '智能手表',   price: 1299, unit: '块' }
}

const formModel = reactive({
  product: '',
  price: 0,
  unit: '',
  quantity: 1,
  discount: 100,
  subtotal: 0,
  total: 0
})

// 选品联动：选商品 → 自动填充单价/单位 → 重算金额
const onProductChange = (val: string) => {
  const info = productMap[val]
  if (info) {
    formModel.price = info.price
    formModel.unit = info.unit
  } else {
    formModel.price = 0
    formModel.unit = ''
  }
  recalc()
}

// 数量/折扣变化 → 重算
const recalc = () => {
  const qty = formModel.quantity || 0
  const disc = formModel.discount ?? 100
  formModel.subtotal = formModel.price * qty
  formModel.total = Math.round(formModel.subtotal * disc / 100)
}

const formItems = [
  {
    prop: 'product',
    label: '商品',
    span: 12,
    formtype: 'Select' as const,
    dataOptions: Object.entries(productMap).map(([k, v]) => ({ label: v.name, value: k })),
    attrs: { placeholder: '请选择商品', clearable: true },
    on: { change: onProductChange }
  },
  {
    prop: 'price',
    label: '单价',
    span: 6,
    formtype: 'Input' as const,
    attrs: { disabled: true, placeholder: '自动填充' }
  },
  {
    prop: 'unit',
    label: '单位',
    span: 6,
    formtype: 'Input' as const,
    attrs: { disabled: true, placeholder: '自动填充' }
  },
  {
    prop: 'quantity',
    label: '数量',
    span: 8,
    formtype: 'Input' as const,
    attrs: { type: 'number', min: 1, placeholder: '请输入数量' },
    on: { input: () => recalc() }
  },
  {
    prop: 'discount',
    label: '折扣(%)',
    span: 8,
    formtype: 'Slider' as const,
    attrs: { min: 50, max: 100, step: 5, showStops: true },
    on: { input: () => recalc() }
  },
  {
    prop: 'subtotal',
    label: '小计',
    span: 4,
    formtype: 'Input' as const,
    attrs: { disabled: true }
  },
  {
    prop: 'total',
    label: '折后总价',
    span: 4,
    formtype: 'Input' as const,
    attrs: { disabled: true }
  }
]

const configBtn = [
  {
    name: '确认下单',
    type: 'primary',
    direction: 'right',
    icon: 'Check',
    click: (model: Record<string, unknown>) => {
      if (!model.product) { ElMessage.warning('请选择商品'); return }
      ElMessage.success(`下单成功！折后总价 ¥${model.total}`)
      console.log('订单数据:', model)
    }
  },
  {
    name: '重置',
    direction: 'right',
    icon: 'RefreshLeft',
    click: (_: unknown, formRef: { resetFields: () => void } | null) => {
      formRef?.resetFields()
      recalc()
    }
  }
]

const layoutProps = {
  fromLayProps: { labelWidth: '90px', size: 'small' },
  rowLayProps: { gutter: 16 }
}
</script>

<style scoped>
.example-form-computed { padding: 20px; }
</style>
