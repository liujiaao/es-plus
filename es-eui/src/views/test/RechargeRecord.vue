<template>
  <section class="recharge-record">
    <es-table
      ref="tableRef"
      :columns="columns"
      :options="options"
      :data-source.sync="tableData"
      :pagination.sync="pagination"
      :class="['dong-table']"
      @row-click="handleRowClick"
    >
          <es-form
        :model="queryForm"
        :form-item-list="formItems"
        :config-btn="queryBtns"
        :layout-form-props="layoutFormProps"
        :class="['dong-form']"
      />
    </es-table>

  </section>
</template>

<script lang="jsx">
/**
 * 充值记录测试页 —— 演示 @es-plus/vue2 在 Vue 2.6 + @vue/composition-api 下
 * 的「表格 ↔ 表单」接口请求联动能力。
 *
 * 联动机制：
 *  1. 表单内置「查询/重置」按钮设置 triggerEvent: true，会自动调起表格请求
 *  2. EsTable 的 options.apiParams 配置请求 URL，自动拼装 formParams（合并 form model + 分页）
 *  3. 全局 $httpRequest（main.js 中注册）负责发送实际 HTTP 请求
 *  4. configTableOut 把后端返回字段映射到 EsTable 内部约定（total / data / pageSize / current）
 *  5. listenToCallBack.brcb 在请求前拦截参数（处理日期范围、状态、空值清洗）
 *  6. listenToCallBack.qrcb 在响应后处理（这里仅打日志，不修改数据）
 *
 * 使用 DummyJSON 公开 API（https://dummyjson.com/users）模拟后端，并通过 brcb 把内部
 * 字段名翻译成 DummyJSON 的 limit/skip/q 参数；qrcb 中输出原始响应供调试。
 *
 * 注意：JSX 必须放在 setup() 外的模块级函数里。
 * Vue 2 的 @vue/babel-preset-jsx 会扫描 setup() 函数体内的 JSX 并在其顶部注入
 * `var _h = this.$createElement`，但 Composition API 的 setup() 调用时 this 是
 * undefined，会抛 "Cannot read properties of undefined (reading '$createElement')"。
 * 所以本文件采取的策略：
 *   - 模块级声明 renderDetail(h, row)，参数 h 已显式绑定，babel 安全
 *   - setup() 内部仅写普通 JS（columns/options 等），不出现任何 JSX 字面量
 *   - columns 里需要自定义渲染的列改用 h(...) 调用，不用 JSX
 */
import { defineComponent, reactive, ref } from '@vue/composition-api'
import { useDialog } from '@es-plus/vue2'
import RechargeForm from './components/RechargeForm.vue'

const statusMap = { 1: '成功', 2: '失败', 3: '处理中' }
const statusTypeMap = { 1: 'success', 2: 'danger', 3: 'warning' }

// 详情弹窗的渲染函数（模块级，避开 setup 内部 JSX 编译陷阱）
const renderDetail = (h, row) => (
  <el-descriptions column={1} border>
    <el-descriptions-item label="客户姓名">{row.customerName}</el-descriptions-item>
    <el-descriptions-item label="手机号">{row.phone}</el-descriptions-item>
    <el-descriptions-item label="充值金额">{row.amount + ' 元'}</el-descriptions-item>
    <el-descriptions-item label="充值方式">{row.method}</el-descriptions-item>
    <el-descriptions-item label="充值状态">{statusMap[row.status] || '未知'}</el-descriptions-item>
    <el-descriptions-item label="交易单号">{row.orderNo}</el-descriptions-item>
    <el-descriptions-item label="充值时间">{row.rechargeTime}</el-descriptions-item>
  </el-descriptions>
)

// 把 DummyJSON 的 user 数据映射成「充值记录」语义，便于演示
function mapUserToRecharge(user) {
  // 根据 id 派生稳定的状态/金额，避免每次 render 数据漂移
  const status = (user.id % 3) + 1
  const methodMap = { 0: '微信支付', 1: '支付宝', 2: '银行卡', 3: '余额' }
  const amount = (user.id * 37 % 5000 + 100).toFixed(2)
  return {
    id: user.id,
    customerName: `${user.lastName}${user.firstName}`,
    phone: user.phone,
    amount,
    method: methodMap[user.id % 4],
    status,
    orderNo: `RC${String(user.id).padStart(8, '0')}`,
    rechargeTime: user.birthDate
  }
}

export default defineComponent({
  name: 'RechargeRecord',
  setup() {
    // ─── 查询表单 ──────────────────────────────
    const queryForm = reactive({
      customerName: '',
      phone: '',
      rechargeTime: [],
      status: '',
      method: '',
      amountMin: '',
      amountMax: '',
      orderNo: ''
    })

    // ─── 表格状态 ──────────────────────────────
    const tableData = ref([])
    const tableRef = ref(null)
    const pagination = ref({ current: 1, pageSize: 20, total: 0 })
    const dialog = useDialog()

    // ─── 表单字段配置 ───────────────────────────
    const formItems = [
      {
        prop: 'customerName',
        label: '客户姓名',
        // 自定义 render 演示：
        //   1. 第二参是 model（整个表单 model），不是 row
        //   2. 标签必须小写 el-input（element-ui 注册名）
        //   3. Vue 2 JSX 不能直接写 v-model={...}：
        //      - babel-sugar-v-model 会把它转成含 `this.$set(...)` 的 model attribute
        //      - babel-sugar-composition-api-render-instance@1.4.0 在处理 setup 是
        //        ObjectMethod 简写形式时有 bug（访问 n.node.value.body 而 ObjectMethod 无 .value）
        //      所以这里手动展开成 value + on-input
        render: (h, model) => (
          <el-input
            value={model.customerName}
            on-input={(v) => { model.customerName = v }}
            placeholder="请输入客户姓名"
            clearable
          />
        ),
        span: 6
      },
      {
        prop: 'phone',
        label: '手机号',
        formtype: 'Input',
        span: 6,
        attrs: { clearable: true, placeholder: '请输入手机号' }
      },
      {
        prop: 'rechargeTime',
        label: '充值时间',
        formtype: 'DatePicker',
        span: 6,
        attrs: {
          clearable: true,
          type: 'daterange',
          rangeSeparator: '-',
          startPlaceholder: '开始日期',
          endPlaceholder: '结束日期',
          valueFormat: 'yyyy-MM-dd',
          style: 'width:100%'
        }
      },
      {
        prop: 'status',
        label: '充值状态',
        formtype: 'Select',
        span: 6,
        attrs: { clearable: true, placeholder: '请选择充值状态',   style: 'width:100%' },
        dataOptions: [
          { label: '全部', value: '' },
          { label: '成功', value: 1 },
          { label: '失败', value: 2 },
          { label: '处理中', value: 3 }
        ]
      },
      // 第二行（折叠时隐藏，展开后可见）
      {
        prop: 'method',
        label: '充值方式',
        formtype: 'Select',
        span: 6,
        attrs: { clearable: true, placeholder: '请选择充值方式',   style: 'width:100%' },
        dataOptions: [
          { label: '微信支付', value: '微信支付' },
          { label: '支付宝', value: '支付宝' },
          { label: '银行卡', value: '银行卡' },
          { label: '余额', value: '余额' }
        ]
      },
      {
        prop: 'amountMin',
        label: '最小金额',
        formtype: 'Input',
        span: 6,
        attrs: { clearable: true, placeholder: '请输入最小金额', type: 'number' }
      },
      {
        prop: 'amountMax',
        label: '最大金额',
        formtype: 'Input',
        span: 6,
        attrs: { clearable: true, placeholder: '请输入最大金额', type: 'number' }
      },
      {
        prop: 'orderNo',
        label: '交易单号',
        formtype: 'Input',
        span: 6,
        attrs: { clearable: true, 
          placeholder: '请输入交易单号',

            style: 'width:100%'
         }
      }
    ]

    // ─── 查询/重置/新增按钮 ─────────────────────
    // triggerEvent: true 让 EsForm 内置 query/rest 按钮自动调起 EsTable 请求
    // direction: 'left' 让按钮显示在表单按钮区左侧（默认右侧）
    const queryBtns = [
      { name: '新增', type: 'primary', icon: 'el-icon-plus', direction: 'left', click: () => openCreate() },
      { name: '查询', type: 'primary', key: 'query', triggerEvent: true},
      { name: '重置', key: 'rest', triggerEvent: true }
    ]

    // ─── 新增弹窗 ──────────────────────────────
    // 弹窗 render 用 h(RechargeForm, ...) 调用形式（不写 JSX 字面量）—— 该函数在
    // setup 内被定义，避免触发 babel-sugar-composition-api-render-instance 的 ObjectMethod bug。
    function openCreate() {
      dialog({
        title: '新增充值记录',
        width: '720px',
        // 用 ref 拿到子组件实例，提交时调 validate / getModel
        render: (h) => h(RechargeForm, { ref: 'rechargeForm' }),
        configBtn: [
          { name: '取消', click: (_, { close }) => close() },
          {
            name: '提交',
            type: 'primary',
            click: async (instance, { close }) => {
              console.log('formName', instance.validate)
              const formCmp = instance
              if (!formCmp) return
              const valid = await formCmp.validate()
              if (!valid) return
              const payload = formCmp.getModel()
              // TODO: 替换为真实接口调用，例如：
              //   await requestAPI({ url: '/recharge/create', method: 'POST', data: payload })
              // eslint-disable-next-line no-console
              console.log('[新增充值记录] 提交参数:', payload)
              // 演示用：模拟提交成功后刷新表格
              if (tableRef.value && typeof tableRef.value.queryList === 'function') {
                tableRef.value.queryList()
              }
              close()
            }
          }
        ]
      })
    }

    // ─── 详情弹窗 ──────────────────────────────
    // setup 内部只调用模块级 renderDetail，不直接写 JSX
    function openDetail(row) {
      dialog({
        title: '充值详情',
        width: '500px',
        render: (h) => ( <el-descriptions column={1} border>
    <el-descriptions-item label="客户姓名">{row.customerName}</el-descriptions-item>
    <el-descriptions-item label="手机号">{row.phone}</el-descriptions-item>
    <el-descriptions-item label="充值金额">{row.amount + ' 元'}</el-descriptions-item>
    <el-descriptions-item label="充值方式">{row.method}</el-descriptions-item>
    <el-descriptions-item label="充值状态">{statusMap[row.status] || '未知'}</el-descriptions-item>
    <el-descriptions-item label="交易单号">{row.orderNo}</el-descriptions-item>
    <el-descriptions-item label="充值时间">{row.rechargeTime}</el-descriptions-item>
  </el-descriptions>),
        configBtn: [
          { name: '关闭', click: (instance, { close }) => close() }
        ]
      })
    }

    // ─── 列定义 ──────────────────────────────
    const columns = [
      { type: 'selection', width:55 , fixed: 'left'},
      { prop: 'customerName', label: '客户姓名' },
      { prop: 'phone', label: '手机号' },
      { prop: 'amount', label: '充值金额', align: 'right' },
      { prop: 'method', label: '充值方式' },
      {
        prop: 'status',
        label: '充值状态',
        render: (h, { row }) =>
          h('el-tag', { props: { type: statusTypeMap[row.status] || 'info', size: 'small' } }, [
            statusMap[row.status] || '未知'
          ])
      },
      { prop: 'orderNo', label: '交易单号' },
      { prop: 'rechargeTime', label: '充值时间' },
      {
        prop: 'operate',
        label: '操作',
        width: 100,
        fixed: 'right',
        btns: [
          { name: '查看', type: 'primary', clickEvent: (row) => openDetail(row) }
        ]
      }
    ]

    // ─── 表格工具栏按钮（左右两侧各一个） ──────
    // EsTable 通过 options.configBtn 配置工具栏按钮，每项用 position: 'left' | 'right'
    // 控制左右分布；未配 position 默认归左。每个按钮 click 回调签名 (selection)
    // 接收当前已勾选的行集合（需要表格 columns 含 selection 列才有值，本页没用）。
    const tableBtns = [
      {
        name: '刷新',
        position: 'left',
        icon: 'el-icon-refresh',
        click: (...res) => {
          const {formInstance, tableRef} = res[0]
          console.log('shuaxin///', tableRef.proxy.httpRequestInstance)
            tableRef.proxy.httpRequestInstance()
          // if (tableRef.value && typeof tableRef.value.queryList === 'function') {
          //   tableRef.value.queryList()
          // }
        }
      },
      {
        name: '导出',
        position: 'right',
        type: 'primary',
        icon: 'el-icon-download',
        click: (selection) => {
          // 演示：把当前页数据 / 选中行 dump 到 console，真实业务里调导出接口
          const rows = (Array.isArray(selection) && selection.length) ? selection : tableData.value
          // eslint-disable-next-line no-console
          console.log('[导出] 数据行数:', rows.length, rows)
        }
      }
    ]

    // ─── 表格选项（含 apiParams + 字段映射 + 拦截器） ──────
    const options = {
      border: true,
      stripe: true,
      highlightCurrentRow: true,
      headerCellStyle: { background: '#f5f7fa' },
      rowkey: 'id',
      isInitRun: true,
       height: '100%',
      heightType: 'height',
      // 工具栏按钮配置（位于表格上方，分左右）
      configBtn: tableBtns,
      // 1) 接口请求配置（DummyJSON 公开 API，用 GET）
      apiParams: {
        url: 'https://dummyjson.com/users',
        method: 'GET'

      },

      // 由于 main.js 中全局 $httpRequest 默认走业务后端 axios（POST），
      // 这里覆盖为 fetch + GET，演示「自定义 httpRequest」覆盖全局
      httpRequest: ({ url, formParams = {} }) => {
        console.log('fetching:', url, formParams)
        const search = new URLSearchParams()
        Object.keys(formParams).forEach((k) => {
          const v = formParams[k]
          if (v != null && v !== '') search.append(k, v)
        })
        const qs = search.toString()
        const fullUrl = qs ? `${url}?${qs}` : url
        return fetch(fullUrl).then((r) => r.json())
      },

      // 2) 后端返回字段 → 内部约定字段映射
      //    DummyJSON 返回 { users, total, skip, limit }
      configTableOut: {
        total: 'total',
        pageSize: 'limit',
        current: 'skip',
        tableData: 'users'
      },

      // 3) 请求/响应拦截器
      listenToCallBack: {
        // brcb：请求发出前拦截，把内部字段翻译成 DummyJSON 的 limit/skip 参数
        // 同时清洗空值并处理日期范围（演示用，DummyJSON 实际不支持日期过滤）
        brcb: (params) => {
          // params 包含 { ...formModel, pageIndex, pageSize }，即表单字段 + 分页参数
          const {
            pageIndex = 1,
            pageSize = 10,
            customerName,
            phone,
            status,
            rechargeTime,
            method,
            amountMin,
            amountMax,
            orderNo
          } = params

          // 翻译为后端字段：内部 pageIndex/pageSize → limit/skip
          const finalParams = {
            limit: pageSize,
            skip: (pageIndex - 1) * pageSize
          }

          // DummyJSON 仅支持 q（关键词搜索），姓名/手机号合并到 q
          const keyword = [customerName, phone].filter(Boolean).join(' ').trim()
          if (keyword) finalParams.q = keyword

          // 业务字段透传（DummyJSON 不会真正过滤，但演示拦截器接收完整表单值）
          if (Array.isArray(rechargeTime) && rechargeTime.length === 2) {
            finalParams.startDate = rechargeTime[0]
            finalParams.endDate = rechargeTime[1]
          }
          if (status !== '' && status != null) finalParams.status = status
          if (method) finalParams.method = method
          if (amountMin !== '' && amountMin != null) finalParams.amountMin = amountMin
          if (amountMax !== '' && amountMax != null) finalParams.amountMax = amountMax
          if (orderNo) finalParams.orderNo = orderNo

          // eslint-disable-next-line no-console
          console.log('[brcb] 入参 params:', params)
          // eslint-disable-next-line no-console
          console.log('[brcb] 翻译后请求参数:', finalParams)
          return finalParams
        },

        // qrcb：响应回来后拦截，把 DummyJSON 的 user 列表映射成「充值记录」结构
        qrcb: (res) => {
          // eslint-disable-next-line no-console
          console.log('[qrcb] 原始响应:', res)
          if (res && Array.isArray(res.users)) {
            return {
              ...res,
              users: res.users.map(mapUserToRecharge)
            }
          }
          return res
        }
      }
    }

    const layoutFormProps = {
      formLayProps: {
        labelWidth: '80px',
        // 折叠功能：默认显示 1 行，超过 1 行折叠隐藏；
        // 表单按钮区会自动出现「展开/收起」按钮，点击后表格高度应自动重算。
        minFoldRows: 1
      }
    }
   const handleRowClick = (row, column, event) => {
       console.log('row click333', row, column, event)
   }

    return {
      queryForm,
      tableData,
      tableRef,
      pagination,
      formItems,
      queryBtns,
      columns,
      options,
      layoutFormProps,
      handleRowClick
    }
  }
})
</script>

<style lang="scss" scoped>
.recharge-record {
  padding: 10px;
  background: #fff;
  border-radius: 10px 0px;
  height: calc(750px - 20px);
  // 不要在这里给 height —— 项目没全局 border-box，content-box 下
  // height + padding 会跟内层 es-table 的 tabHeight 互相对不上。
  // 让 .recharge-record 自适应它内部 es-table 的 750px + padding 即可。
}
</style>
