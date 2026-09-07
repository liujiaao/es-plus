<template>
  <es-table
    :data-source="data"
    :columns="columns"
    :pagination="pagination"
    :options="options"
  >
    <es-form
      :form-item-list="formConfig"
      :model="formData"
      :layout-form-props="layoutProps"
      :config-btn="configBtn"
    />
  </es-table>
</template>

<script>
export default {
  data() {
    return {
      data: [],
      columns: [
        { key: 'id', label: '编号', width: 80 },
        { key: 'title', label: '标题' },
        {
          key: 'userId',
          label: '用户ID',
          width: 100,
          render: (h, { row }) => (
            <el-tag size="mini">用户{row.userId}</el-tag>
          )
        },
        {
          key: 'body',
          label: '内容',
          render: (h, { row }) => <span>{row.body.substring(0, 50) + '...'}</span>
        }
      ],
      pagination: { pageIndex: 1, pageSize: 10, total: 0 },
      options: {
        isInitRun: true,
        border: true,
        heightType: 'maxHeight',
        apiParams: {
          url: 'https://jsonplaceholder.typicode.com/posts',
          method: 'get',
          model: {}
        },
        configTableOut: {
          total: 'total',
          pageSize: 'pageSize',
          current: 'pageIndex',
          tableData: 'data'
        },
        listenToCallBack: {
          brcb: (params) => {
            const result = {}
            if (params.userId && params.userId !== '') {
              result.userId = params.userId
            }
            if (params.title && params.title.trim()) {
              result.q = params.title.trim()
            }
            console.log('联动查询参数:', result)
            return result
          },
          qrcb: (res) => {
            console.log('响应数据结构:', res)
            if (Array.isArray(res.data)) {
              return {
                data: res.data.slice(0, 10),
                total: 100,
                pageSize: 10,
                pageIndex: 1
              }
            }
            return res
          }
        }
      },
      formData: {
        userId: '',
        title: ''
      },
      formConfig: [
        {
          prop: 'userId',
          label: '用户ID',
          span: 8,
          formtype: 'Select',
          attrs: { placeholder: '请选择用户', clearable: true },
          dataOptions: [
            { label: '全部', value: '' },
            { label: '用户1', value: '1' },
            { label: '用户2', value: '2' },
            { label: '用户3', value: '3' }
          ]
        },
        {
          prop: 'title',
          label: '标题搜索',
          span: 8,
          formtype: 'Input',
          attrs: { placeholder: '请输入标题关键词', clearable: true }
        },
        {
          prop: 'resetPlaceholder',
          label: '内容',
          span: 8,
          formtype: 'Input',
          attrs: { disabled: true }
        }
      ],
      layoutProps: {
        fromLayProps: { labelWidth: '80px', size: 'small' },
        rowLayProps: { gutter: 20 }
      },
      configBtn: [
        { name: '查询', type: 'primary', key: 'query', triggerEvent: true, icon: 'el-icon-search' },
        { name: '重置', key: 'rest', triggerEvent: true, icon: 'el-icon-refresh' }
      ]
    }
  }
}
</script>
