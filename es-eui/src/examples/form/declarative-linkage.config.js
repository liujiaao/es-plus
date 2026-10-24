/**
 * 报销单联动 —— 纯 JSON 配置（0 个函数、0 个 undefined）。
 *
 * docs / antdv / vue2 三站各存一份**字节级相同**的副本（三个独立工程，没有共享运行时），
 * 由 `scripts/check-declarative-demo.mjs` 断言：
 *   `JSON.parse(JSON.stringify(config))` 与原对象深等 —— 出现函数、undefined、NaN 即失败，
 *   并断言三份文件字节相同、都真的被对应示例 import。示例 `DeclarativeLinkage.vue` 只负责
 *   把这份数据喂给 EsForm，没有任何联动代码。
 *
 * 覆盖的声明式能力（实现见 `packages/core/src/reactions.ts` / `expr.ts`，三端等价求值）：
 *   1. fulfill.dataOptions —— 省 → 市 → 门店 三级选项，按 `when` 分支切换（字面量数组）
 *   2. fulfill.value      —— 大区自动等于省份；并声明式清洗失效的城市 / 门店
 *   3. fulfill.disabled   —— 大区带出后锁定
 *   4. fulfill.required   —— 选了城市才要求发票号；金额 > 5000 才要求说明
 *   5. isHidden 的 JSON 表达式 —— 非「部分退款」时隐藏退款原因
 *
 * 第 2 条的「清洗」值得说明：reactions 是 model 的纯函数、感知不到「刚刚变了」，
 * 所以切换省份后旧的杭州不会自己消失。这里用 `value` 表达不变式
 * 「city 必须 ∈ 当前省份的合法集合，否则置空」—— 一旦旧值失效，下一轮依赖重算就把它清掉，
 * 仍然没有任何回调。
 */

export const declarativeLinkageModel = {
  province: '',
  city: '',
  store: '',
  region: '',
  invoiceNo: '',
  amount: '',
  remark: '',
  refundType: 'none',
  refundReason: ''
}

export const declarativeLinkageItems = [
  {
    prop: 'province',
    label: '省份',
    formtype: 'Select',
    span: 8,
    attrs: { placeholder: '请选择省份' },
    dataOptions: [
      { label: '浙江', value: '浙江' },
      { label: '江苏', value: '江苏' }
    ]
  },
  {
    prop: 'city',
    label: '城市',
    formtype: 'Select',
    span: 8,
    attrs: { placeholder: '先选省份' },
    reactions: [
      {
        dependencies: ['province'],
        when: { '==': [{ var: 'province' }, '浙江'] },
        fulfill: {
          dataOptions: [
            { label: '杭州', value: '杭州' },
            { label: '宁波', value: '宁波' }
          ]
        }
      },
      {
        dependencies: ['province'],
        when: { '==': [{ var: 'province' }, '江苏'] },
        fulfill: {
          dataOptions: [
            { label: '南京', value: '南京' },
            { label: '苏州', value: '苏州' }
          ]
        }
      },
      {
        dependencies: ['province', 'city'],
        fulfill: {
          value: {
            if: [
              {
                in: [
                  { var: 'city' },
                  {
                    if: [
                      { '==': [{ var: 'province' }, '浙江'] },
                      ['杭州', '宁波'],
                      {
                        if: [
                          { '==': [{ var: 'province' }, '江苏'] },
                          ['南京', '苏州'],
                          []
                        ]
                      }
                    ]
                  }
                ]
              },
              { var: 'city' },
              ''
            ]
          }
        }
      }
    ]
  },
  {
    prop: 'store',
    label: '门店',
    formtype: 'Select',
    span: 8,
    attrs: { placeholder: '先选城市' },
    reactions: [
      {
        dependencies: ['city'],
        when: { '==': [{ var: 'city' }, '杭州'] },
        fulfill: {
          dataOptions: [
            { label: '西湖店', value: '西湖店' },
            { label: '滨江店', value: '滨江店' }
          ]
        }
      },
      {
        dependencies: ['city'],
        when: { '==': [{ var: 'city' }, '宁波'] },
        fulfill: {
          dataOptions: [
            { label: '天一店', value: '天一店' },
            { label: '东门口店', value: '东门口店' }
          ]
        }
      },
      {
        dependencies: ['city'],
        when: { '==': [{ var: 'city' }, '南京'] },
        fulfill: {
          dataOptions: [
            { label: '新街口店', value: '新街口店' },
            { label: '夫子庙店', value: '夫子庙店' }
          ]
        }
      },
      {
        dependencies: ['city'],
        when: { '==': [{ var: 'city' }, '苏州'] },
        fulfill: {
          dataOptions: [{ label: '观前街店', value: '观前街店' }]
        }
      },
      {
        dependencies: ['city', 'store'],
        fulfill: {
          value: {
            if: [
              {
                in: [
                  { var: 'store' },
                  {
                    if: [
                      { '==': [{ var: 'city' }, '杭州'] },
                      ['西湖店', '滨江店'],
                      {
                        if: [
                          { '==': [{ var: 'city' }, '宁波'] },
                          ['天一店', '东门口店'],
                          {
                            if: [
                              { '==': [{ var: 'city' }, '南京'] },
                              ['新街口店', '夫子庙店'],
                              {
                                if: [
                                  { '==': [{ var: 'city' }, '苏州'] },
                                  ['观前街店'],
                                  []
                                ]
                              }
                            ]
                          }
                        ]
                      }
                    ]
                  }
                ]
              },
              { var: 'store' },
              ''
            ]
          }
        }
      }
    ]
  },
  {
    prop: 'region',
    label: '所属大区',
    formtype: 'Input',
    span: 8,
    attrs: { placeholder: '选择省份后自动带出并锁定' },
    reactions: [
      {
        dependencies: ['province'],
        fulfill: {
          value: { var: 'province' },
          disabled: { notEmpty: [{ var: 'province' }] }
        }
      }
    ]
  },
  {
    prop: 'invoiceNo',
    label: '发票号',
    formtype: 'Input',
    span: 8,
    attrs: { placeholder: '选择城市后变为必填' },
    reactions: [
      {
        dependencies: ['city'],
        fulfill: {
          required: { notEmpty: [{ var: 'city' }] }
        }
      }
    ]
  },
  {
    prop: 'amount',
    label: '金额（元）',
    formtype: 'Input',
    span: 8,
    attrs: { type: 'number', placeholder: '超过 5000 需填写说明' }
  },
  {
    prop: 'remark',
    label: '说明',
    formtype: 'Input',
    span: 8,
    attrs: { placeholder: '金额超过 5000 时必填' },
    reactions: [
      {
        dependencies: ['amount'],
        fulfill: {
          required: { '>': [{ var: 'amount' }, 5000] }
        }
      }
    ]
  },
  {
    prop: 'refundType',
    label: '退款方式',
    formtype: 'Select',
    span: 8,
    attrs: { placeholder: '请选择退款方式' },
    dataOptions: [
      { label: '无需退款', value: 'none' },
      { label: '全额退款', value: 'full' },
      { label: '部分退款', value: 'partial' }
    ]
  },
  {
    prop: 'refundReason',
    label: '退款原因',
    formtype: 'Input',
    span: 8,
    attrs: { placeholder: '仅部分退款时可见且必填' },
    isHidden: { '!=': [{ var: 'refundType' }, 'partial'] },
    reactions: [
      {
        dependencies: ['refundType'],
        fulfill: {
          required: { '==': [{ var: 'refundType' }, 'partial'] }
        }
      }
    ]
  }
]
