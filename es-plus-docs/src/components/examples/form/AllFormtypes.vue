<template>
  <div class="example-all-formtypes">
    <es-form :model="formModel" :form-item-list="formItems" :layout-form-props="layoutProps" />
    <div class="value-preview">
      <span class="label">当前模型</span>
      <code>{{ JSON.stringify(formModel) }}</code>
    </div>
  </div>
</template>

<script setup>
import { ref } from 'vue'
import { EsForm } from '@es-plus/vue3'

// 一次覆盖 formtype 的全部 14 种取值：每个控件都是一行配置，没有手写 <el-xxx> 模板。
const formModel = ref({
  name: '',
  age: 18,
  city: '',
  birthday: '',
  meetingTime: '',
  volume: 30,
  themeColor: '#409eff',
  members: [],
  region: [],
  gender: '',
  hobbies: [],
  enabled: true,
  score: 3,
  attachments: []
})

const layoutProps = { formLayProps: { labelWidth: '90px' }, rowLayProps: { gutter: 16 } }

const cityOptions = [
  { label: '北京', value: 'beijing' },
  { label: '上海', value: 'shanghai' },
  { label: '广州', value: 'guangzhou' }
]

const memberOptions = [
  { label: '张三', value: 'zhangsan' },
  { label: '李四', value: 'lisi' },
  { label: '王五', value: 'wangwu' }
]

const regionOptions = [
  {
    label: '华东',
    value: 'east',
    children: [
      { label: '上海', value: 'shanghai' },
      { label: '江苏', value: 'jiangsu' }
    ]
  },
  {
    label: '华南',
    value: 'south',
    children: [{ label: '广东', value: 'guangdong' }]
  }
]

const formItems = [
  // ① Input
  { prop: 'name', label: '姓名', formtype: 'Input', span: 12, attrs: { placeholder: '请输入姓名', clearable: true } },
  // ② InputNumber
  { prop: 'age', label: '年龄', formtype: 'InputNumber', span: 12, attrs: { min: 0, max: 150, controlsPosition: 'right' } },
  // ③ Select
  { prop: 'city', label: '城市', formtype: 'Select', span: 12, dataOptions: cityOptions, attrs: { placeholder: '请选择城市', clearable: true } },
  // ④ DatePicker
  { prop: 'birthday', label: '出生日期', formtype: 'DatePicker', span: 12, attrs: { type: 'date', valueFormat: 'YYYY-MM-DD', placeholder: '请选择日期' } },
  // ⑤ TimePicker
  { prop: 'meetingTime', label: '会议时间', formtype: 'TimePicker', span: 12, attrs: { valueFormat: 'HH:mm', placeholder: '请选择时间' } },
  // ⑥ Slider
  { prop: 'volume', label: '音量', formtype: 'Slider', span: 12, attrs: { step: 10, showStops: true } },
  // ⑦ ColorPicker
  { prop: 'themeColor', label: '主题色', formtype: 'ColorPicker', span: 12 },
  // ⑧ Transfer（dataOptions → 穿梭框数据源）
  { prop: 'members', label: '成员', formtype: 'Transfer', span: 12, dataOptions: memberOptions, attrs: { titles: ['待选', '已选'] } },
  // ⑨ Cascader
  { prop: 'region', label: '区域', formtype: 'Cascader', span: 12, attrs: { options: regionOptions, placeholder: '请选择区域', props: { emitPath: false } } },
  // ⑩ Radio
  { prop: 'gender', label: '性别', formtype: 'Radio', span: 12, dataOptions: [{ label: '男', value: 'male' }, { label: '女', value: 'female' }] },
  // ⑪ Checkbox
  { prop: 'hobbies', label: '爱好', formtype: 'Checkbox', span: 12, dataOptions: [{ label: '阅读', value: 'read' }, { label: '运动', value: 'sport' }, { label: '音乐', value: 'music' }] },
  // ⑫ Switch
  { prop: 'enabled', label: '启用', formtype: 'Switch', span: 12, attrs: { activeText: '开', inactiveText: '关' } },
  // ⑬ Rate
  { prop: 'score', label: '评分', formtype: 'Rate', span: 12, attrs: { showScore: true } },
  // ⑭ Upload（演示用：不真实上传）
  { prop: 'attachments', label: '附件', formtype: 'Upload', span: 24, props: { autoUpload: false, limit: 3, listType: 'text' } }
]
</script>

<style scoped>
.example-all-formtypes {
  padding: 4px 0;
}
.value-preview {
  margin-top: 12px;
  padding: 10px 12px;
  background: #f5f7fa;
  border-radius: 4px;
  font-size: 12px;
  color: #606266;
  overflow-x: auto;
}
.value-preview .label {
  margin-right: 8px;
  color: #909399;
}
</style>
