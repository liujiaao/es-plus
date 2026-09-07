<template>
  <div style="max-width: 720px;">
    <es-form
      :model="model"
      :form-item-list="formItems"
      :layout-form-props="layoutFormProps"
    />
    <div style="margin-top: 8px; padding: 10px 16px; background: #f5f7fa; border-radius: 4px; color: #606266;">
      小计 = 单价 × 数量，应付 = 小计 × 折扣，均由 watch 自动计算（灰色只读字段）。
    </div>
  </div>
</template>

<script lang="jsx">
/**
 * 计算字段 —— 演示字段联动自动计算
 *
 * 关键点：
 *   1. 选择商品后，watch 自动回填单价/单位（productMap）
 *   2. 单价、数量、折扣任一变化 → watch 重新计算 小计 / 应付金额
 *   3. 派生字段用 attrs.disabled 置为只读，仅展示计算结果
 *   4. 借助 EsForm 内置的 v-model 写回（默认 input 事件），无需手写 on 处理器
 */
import { defineComponent, reactive, watch } from '@vue/composition-api'

const productMap = {
  A: { price: 199, unit: '件' },
  B: { price: 59, unit: '盒' },
  C: { price: 1299, unit: '台' }
}

export default defineComponent({
  name: 'FormComputedFields',
  setup() {
    const model = reactive({
      productId: '',
      unit: '',
      price: 0,
      qty: 1,
      discount: 100,
      subtotal: 0,
      total: 0
    })

    const recalc = () => {
      const subtotal = (Number(model.price) || 0) * (Number(model.qty) || 0)
      model.subtotal = subtotal
      model.total = Math.round((subtotal * (Number(model.discount) || 0)) / 100)
    }

    // 商品变化：回填单价/单位后重算
    watch(
      () => model.productId,
      (id) => {
        const p = productMap[id]
        if (p) {
          model.price = p.price
          model.unit = p.unit
        }
        recalc()
      }
    )
    // 数量/折扣变化：重算
    watch(() => [model.qty, model.discount, model.price], recalc)

    const formItems = [
      {
        prop: 'productId',
        label: '商品',
        formtype: 'Select',
        span: 12,
        attrs: { placeholder: '请选择商品', clearable: true, style: 'width:100%' },
        dataOptions: [
          { label: 'A - 保温杯', value: 'A' },
          { label: 'B - 茶叶礼盒', value: 'B' },
          { label: 'C - 空气净化器', value: 'C' }
        ]
      },
      { prop: 'unit', label: '单位', formtype: 'Input', span: 12, attrs: { disabled: true } },
      { prop: 'price', label: '单价(元)', formtype: 'Input', span: 12, attrs: { disabled: true } },
      { prop: 'qty', label: '数量', formtype: 'Input', span: 12, attrs: { type: 'number', min: 1 } },
      {
        prop: 'discount',
        label: '折扣(%)',
        formtype: 'Slider',
        span: 24,
        props: { min: 0, max: 100, step: 5 }
      },
      { prop: 'subtotal', label: '小计(元)', formtype: 'Input', span: 12, attrs: { disabled: true } },
      { prop: 'total', label: '应付金额(元)', formtype: 'Input', span: 12, attrs: { disabled: true } }
    ]

    const layoutFormProps = {
      fromLayProps: { labelWidth: '100px', size: 'small' },
      rowLayProps: { gutter: 20 }
    }

    return { model, formItems, layoutFormProps }
  }
})
</script>
