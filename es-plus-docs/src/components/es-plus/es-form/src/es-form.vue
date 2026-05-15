<template>
  <el-form :ref="setFormRef" v-bind="fromProps" class="es-form">
    <div class="flex-center">
      <el-row v-bind="rowLayout">
        <template v-for="(item, index) in formItem" :key="item.prop">
          <el-col v-show="!item?.isfold" :span="item.span">
            <el-form-item :label="item.label" v-bind="initFormItemOptions(item.formItemOptions || {})" :prop="item.prop" @click.stop.prevent="() => {}">
              <template v-if="item.formtype">
                <RenderDomForm :row="item" :render="formInputComponents(item)" :index="index" :model="model" />
              </template>
              <template v-else>
                <RenderDomForm :row="item" :render="item.render" :index="index" :model="model" />
              </template>
            </el-form-item>
          </el-col>
        </template>
        <template v-if="!isBtnHiden">
          <template v-if="isRenderBtn">
            <RenderBtn :row="{ isfold, folded, getBtnColSpan, getRowColsAlgorithm, changefolded, refsForm: formInstance }" :form-model="model" :form-item-list="formItem" :render="renderBtn" />
          </template>
          <el-col v-else :span="btnColSpanRow ? 24 : getBtnColSpan">
            <div class="buttonOperate leftRightBtn" v-if="btnColSpanRow && configBtn.length">
              <div class="btn-left">
                <el-form-item label-width="0px" class="btn-formItem">
                  <el-button
                    v-for="(it, inx) in colRightLeftList.colLeftBtn"
                    v-bind="filterOptions(it)"
                    :icon="getCompIcon(it.icon)"
                    :disabled="typeof it.disabled === 'function' ? it.disabled() || false : it.disabled || false"
                    @click="() => it.click(model, refs, getTableInstant.httpRequestInstance)"
                    :key="it.key || inx"
                  >
                    {{ it.name }}
                  </el-button>
                </el-form-item>
              </div>
              <div class="btn-right">
                <el-form-item label-width="0px" class="btn-formItem">
                  <el-button
                    v-for="(it, inx) in colRightLeftList.colRightBtn"
                    v-bind="filterOptions(it)"
                    :icon="getCompIcon(it.icon)"
                    :disabled="typeof it.disabled === 'function' ? it.disabled() || false : it.disabled || false"
                    @click="() => clickBtn(it)"
                    :key="it.key || inx"
                  >
                    {{ it.name }}
                  </el-button>
                  <el-button v-if="isfold" link type="primary" :icon="getCompIcon(folded ? 'ArrowDown' : 'ArrowUp')" style="padding-left: 0; border: none" @click="changefolded">
                    {{ folded ? '展开' : '收起' }}
                  </el-button>
                  <el-dropdown placement="bottom-start" v-if="getSetOptionsStatus">
                    <el-button link type="primary" style="margin-left: 2px; margin-right: 5px; outline: none" :icon="getCompIcon('Tools')" />
                    <template #dropdown>
                      <el-dropdown-menu>
                        <el-dropdown-item @click="handleCustomerForm">自定义查询</el-dropdown-item>
                        <el-dropdown-item @click="handleTableItemOption">自定义表格</el-dropdown-item>
                        <el-dropdown-item @click="handleRefresh">重置(刷新)</el-dropdown-item>
                      </el-dropdown-menu>
                    </template>
                  </el-dropdown>
                </el-form-item>
              </div>
            </div>
            <el-form-item
              v-if="!btnColSpanRow && configBtn.length"
              :label="' '"
              :label-width="fromProps.labelBtnWidth ? fromProps.labelBtnWidth : fromProps.labelWidth"
              :class="{ formItemCols: btnColSpanRow ? true : getBtnColSpan === 24 }"
              class="btn-formItem"
            >
              <div class="buttonOperate" :style="{ 'text-align': getBtnColSpan === 24 ? 'right' : 'left' }">
                <template v-if="configBtn.length">
                  <el-button
                    v-for="(it, inx) in configBtn"
                    v-bind="filterOptions(it)"
                    :icon="getCompIcon(it.icon)"
                    :disabled="typeof it.disabled === 'function' ? it.disabled() || false : it.disabled || false"
                    @click="
                      () => {
                        it.click(model, refs, getTableInstant.httpRequestInstance)
                      }
                    "
                    :key="it.key || inx"
                  >
                    {{ it.name }}
                  </el-button>
                </template>
                <!-- <template v-else>
                  <el-button type="primary" icon="Search" @click="confirm"> 查询 </el-button>
                  <el-button icon="RefreshLeft" @click="reset"> 重置 </el-button>
                </template> -->
                <el-button v-if="isfold" type="primary" link :icon="getCompIcon(folded ? 'ArrowDown' : 'ArrowUp')" style="padding-left: 0; border: none" @click="changefolded">
                  {{ folded ? '展开' : '收起' }}
                </el-button>
                <el-dropdown placement="bottom-start" v-if="getSetOptionsStatus">
                  <el-button link type="primary" style="margin-left: 2px; margin-right: 5px; outline: none" :icon="getCompIcon('Tools')" />
                  <template #dropdown>
                    <el-dropdown-menu>
                      <el-dropdown-item @click="handleCustomerForm">自定义查询</el-dropdown-item>
                      <el-dropdown-item @click="handleTableItemOption">自定义表格</el-dropdown-item>
                      <el-dropdown-item @click="handleRefresh">重置(刷新)</el-dropdown-item>
                    </el-dropdown-menu>
                  </template>
                </el-dropdown>
              </div>
            </el-form-item>
          </el-col>
        </template>
      </el-row>
    </div>
  </el-form>
</template>

<script>
import { defineComponent, ref, nextTick, getCurrentInstance, toRaw, unref, computed, watch, inject, h } from 'vue'
import { 
  ElRow, 
  ElCol,
  ElFormItem,
  ElForm,
  ElRate,
  ElInput,
  ElSelect,
  ElOption,
  ElCheckbox,
  ElRadio,
  ElDatePicker,
  ElTimePicker,
  ElSwitch,
  ElSlider,
  ElCascader,
  ElColorPicker,
  ElTransfer,
  ElRadioGroup,
  ElCheckboxGroup,
  ElUpload,
  ElButton,
  ElDropdownMenu,
  ElDropdownItem,
  ElDropdown
} from 'element-plus'
import * as ElementPlusIconsVue from '@element-plus/icons-vue'
import zhCn from 'element-plus/es/locale/lang/zh-cn'
import useDialog from '../../es-dialog/src/utils/useDialog'

// 图标扩展
const extendIcons = () => {
  const icons = {}
  for (const [key, value] of Object.entries(ElementPlusIconsVue)) {
    icons[key] = value
  }
  return icons
}
const extentedIcon = extendIcons()

// 子组件定义
const RenderBtn = defineComponent({
  props: {
    row: Object,
    formItemList: Array,
    formModel: Object,
    render: Function,
    ellipsis: Boolean
  },
  setup(props) {
    return () => {
      const { formItemList, formModel, row } = props
      const renderContent = props.render?.(row, formModel, formItemList, h) || ''
      return typeof renderContent === 'string' ? h('span', renderContent) : renderContent
    }
  }
})

const RenderDomForm = defineComponent({
  props: {
    row: Object,
    index: Number,
    datakey: String,
    render: Function,
    model: Object,
    ellipsis: Boolean
  },
  setup(props) {
    return () => {
      const { row, index, model } = props
      const renderContent = props.render?.(h, model, { row, index }) || ''
      return typeof renderContent === 'string' ? h('span', renderContent) : renderContent
    }
  }
})

export default defineComponent({
  name: 'EsForm',
  components: { 
    RenderBtn,
    RenderDomForm,
    ElRow, 
    ElCol,
    ElFormItem,
    ElForm,
    ElRate,
    ElInput,
    ElSelect,
    ElOption,
    ElCheckbox,
    ElRadio,
    ElDatePicker,
    ElTimePicker,
    ElSwitch,
    ElSlider,
    ElCascader,
    ElColorPicker,
    ElTransfer,
    ElRadioGroup,
    ElCheckboxGroup,
    ElUpload,
    ElButton,
    ElDropdownMenu,
    ElDropdownItem,
    ElDropdown
  },
  inject: {
    bodyFormInstantce: {
      type: Function,
      default: () => () => {}
    },
    getTableInstantce: {
      type: [Object, Function],
      default: () => ({})
    }
  },
  props: {
    ...ElForm.props,
    layoutFormProps: {
      type: Object,
      default: () => ({})
    },
    formItemList: {
      type: Array,
      default: () => []
    },
    model: {
      type: Object,
      default: () => ({})
    },
    configBtn: {
      type: Array,
      default: () => []
    },
    renderBtn: {
      type: [Function, Boolean],
      default: false
    },
    btnColSpanRow: {
      type: Boolean,
      default: true
    }
  },
  setup(props, { emit }) {
    // 响应式数据
    const $esPlusForm = inject('$esPlusForm')
    const instance = getCurrentInstance()
    const tags = ref('IEpDownload')
    const refs = ref(null)
    const folded = ref(false)
    const formInstance = ref({})
    const formItemRowsList = ref(props.formItemList)
    const locale = ref(zhCn)
    // 获取弹窗注入的语言环境
    const injectedLocale = inject('elLocale', null)
    if (injectedLocale) {
      locale.value = injectedLocale
      console.log('[EsForm] 使用弹窗注入的语言环境:', injectedLocale.name)
    }
    
    const createDialogInstance = (() => (instance.ctx?.dialogInstantce ? instance.ctx.dialogInstantce() : useDialog))()
    const customerForm = createDialogInstance()
    const customerTable = createDialogInstance()

    const setFormRef = (el) => {
      if (el) {
        refs.value = el
      }
    }
    const getTableInstant = computed(() => {
      return typeof instance.ctx?.getTableInstantce === 'function' ? instance.ctx?.getTableInstantce() : instance.ctx?.getTableInstantce
    })

  
    // 计算属性
    const isParentTable = computed(() => {
      return !!(getTableInstant.value && Object.keys(getTableInstant.value).length)
    })

    const colRightLeftList = computed(() => ({
      colRightBtn: props.configBtn.filter((it) => it.direction === 'right' || !it.direction) || [],
      colLeftBtn: props.configBtn.filter((it) => it.direction === 'left') || []
    }))

    const formItemComponents = computed(() => {
      const components = {}
      formItemRowsList.value.forEach((el) => {
        if (el.components) {
          Object.assign(components, el.components)
        }
      })
      return components
    })

    const formItemListfilter = computed(() => {
      const list = formItemRowsList.value || []
      return list
        .map((it) => it ? ({ ...it, span: it.span || 6, dataOptions: it.dataOptions || [] }) : null)
        .filter((it) => {
          if (!it) return false
          if (it.isHiden && typeof it.isHiden === 'function') {
            return !it.isHiden(props.model, it, fromProps.value)
          }
          return true
        })
    })

    const isBtnHiden = computed(() => props.layoutFormProps?.fromLayProps?.isBtnHiden || false)

    const rowLayout = computed(() => props.layoutFormProps?.rowLayProps || {
      gutter: 20
    })

    const formLayout = computed(() => props.layoutFormProps?.fromLayProps || {})

    const fromProps = computed(() => ({ ...formLayout.value, model: props.model }))

    const getSetOptionsStatus = computed(() => props.layoutFormProps?.setOptions && isParentTable.value)

    const getRowColsAlgorithm = computed(() => {
      // 折行计算方式
      let pre = 0
      const groupArrayList = []
      const columnRows = []
      let rowColIndex = -1
      const formItems = formItemListfilter.value

      for (let i = 0; i < formItems.length; i++) {
        const item = formItems[i]
        pre += item.span
        if (pre > 24) {
          if (i === formItems.length - 1) {
            const statIndex = columnRows.length ? columnRows[columnRows.length - 1].endIndex : 0
            columnRows.push({ statIndex, endIndex: i })
            if (item.span <= 24) {
              columnRows.push({ statIndex: i, endIndex: i + 1 })
            }
          } else {
            const statIndex = columnRows.length ? columnRows[columnRows.length - 1].endIndex : 0
            const endIndex = i
            columnRows.push({ statIndex, endIndex })
          }
          pre = item.span
        } else {
          if (i === formItems.length - 1) {
            const statIndex = columnRows.length ? columnRows[columnRows.length - 1].endIndex : 0
            columnRows.push({ statIndex, endIndex: pre < 24 ? i + 1 : i + 1 })
          } else {
            if (pre === 24) {
              const statIndex = columnRows.length ? columnRows[columnRows.length - 1].endIndex : 0
              const endIndex = i + 1
              columnRows.push({ statIndex, endIndex })
              pre = 0
            }
          }
        }
      }

      columnRows.forEach((it) => {
        groupArrayList.push(formItems.slice(it.statIndex, it.endIndex))
      })

      const columRowIndexs = groupArrayList.map((it) => {
        return it.map((its) => (rowColIndex += 1))
      })

      const opts = {
        columnRow: columRowIndexs,
        rowNum: columRowIndexs.length,
        columnNodeIndex: columRowIndexs.map((it) => it[it.length - 1])
      }
      return opts
    })

    const formItem = computed(() => {
      const minFoldRow = props.layoutFormProps?.fromLayProps?.minfoldRows || 0
      const { columnNodeIndex } = getRowColsAlgorithm.value

      if (folded.value) {
        const lastFoldIndex = columnNodeIndex[minFoldRow - 1] ?? columnNodeIndex[columnNodeIndex.length - 1] ?? 9999
        return formItemListfilter.value.map((it, index) => ({
          ...it,
          isfold: index > lastFoldIndex
        }))
      }
      return formItemListfilter.value.map((it) => ({ ...it, isfold: false }))
    })

    const isRenderBtn = computed(() => typeof props.renderBtn === 'function')

    const isfold = computed(() => {
      const minFoldRow = props.layoutFormProps?.fromLayProps?.minfoldRows || 0
      return minFoldRow > 0 && minFoldRow < getRowColsAlgorithm.value.rowNum
    })

    const getBtnColSpan = computed(() => {
      const { rowNum, columnRow } = getRowColsAlgorithm.value
      const lastColumn = columnRow[rowNum - 1] || []
      const BtnColSpan = props?.layoutFormProps?.fromLayProps?.btnColSpan || 0
      const totalSpan = lastColumn.reduce((sum, idx) => sum + formItemListfilter.value[idx].span, 0)
      const hasSpan = 24 - totalSpan

      return !folded.value && BtnColSpan <= hasSpan ? hasSpan : 24
    })

    // 监听处理
    watch(
      isfold,
      (val) => {
        folded.value = val
      },
      { immediate: true }
    )

    /**
     * 自定义包装器：将 Promise 包装为始终返回 { status: 'fulfilled' 或 'rejected', value 或 error } 的对象
     * @param {Promise} promise 需要包装的原始 Promise
     * @returns {Promise} 包装后的 Promise，永远不会 reject
     */
    const wrapPromise = (promise) => {
      return promise
        .then((value) => ({
          status: 'fulfilled', // 标记成功状态
          value: value // 成功时的值
        }))
        .catch((error) => ({
          status: 'rejected', // 标记失败状态
          reason: error // 失败时的原因（错误对象或自定义信息）
        }))
    }
    const hasReturnStatement = (func) => {
      const funcString = func.toString()
      return /return\s+[^;]+;/.test(funcString) || /return;/.test(funcString)
    }

    const isListenToCallBackfn = (options) => {
      if (options.listenToCallBack && Object.prototype.toString.call(options.listenToCallBack).slice(8, -1) === 'Object' && Object.keys(options.listenToCallBack).length) {
        return options.listenToCallBack
      }
      return false
    }
    const getListenToCallBack = (eventName, params, option) => {
      const eventNameList = [
        { eventName: 'brcb', isReturn: true }, // 查询前参数过滤或处理
        { eventName: 'qrcb', isReturn: false } // 查询respons回调
      ]
      const hasEventNameIndex = eventNameList.findIndex((it) => it.eventName === eventName)
      const isListenToCallBack = isListenToCallBackfn(option)
      if (isListenToCallBack && isListenToCallBack[eventName] && hasEventNameIndex !== -1 && typeof isListenToCallBack[eventName] === 'function') {
        const callObj = eventNameList[hasEventNameIndex]
        if (callObj.isReturn) {
          return isListenToCallBack[eventName](params)
        } else {
          isListenToCallBack[eventName](params)
        }
      }
    }
    const queryTableListMethod = (params, options, option) => {
      // 查询列表实例方法
      const { success, fail, ..._params } = options || {}
      if (options.apiParams && Object.prototype.toString.call(options.apiParams).slice(8, -1) === 'Object' && Object.keys(options.apiParams).length && options.apiParams.url) {
        const formItemParams = getListenToCallBack('brcb', { ...params, ...toRaw(unref(options?.apiParams?.model || {})) }, option)
        const initFormParams =
          formItemParams && Object.prototype.toString.call(formItemParams).slice(8, -1) === 'Object' ? formItemParams : { ...params, ...toRaw(unref(options?.apiParams?.model || {})) }
        
           const requestOption = {...toRaw(unref(options?.apiParams?.options || {}))}
        if(options?.apiParams?.method) {
          requestOption.method = options?.apiParams?.method
        }
          if (options.httpRequest && typeof options.httpRequest === 'function') {
          // 自定义接口实例
          options
            .httpRequest({
              url: options?.apiParams?.url,
              headers: { ...(options?.apiParams?.headers || {}) },
              formParams: initFormParams,
              ...requestOption
            })
            .then((res) => {
              if (typeof success === 'function' && Object.prototype.toString.call(res).slice(8, -1) === 'Object' && Object.keys(res).length) {
                success(res)
              }
            })
            .catch((e) => {
              if (typeof fail === 'function') {
                fail(e)
              }
            })
        } else {
          if ($esPlusForm.$httpRequest) {
            // 插件配置接口实例
            $esPlusForm
              .$httpRequest({
                url: options?.apiParams?.url,
                headers: { ...(options?.apiParams?.headers || {}) },
                formParams: initFormParams,
                ...requestOption
              })
              .then((res) => {
                if (typeof success === 'function' && Object.prototype.toString.call(res).slice(8, -1) === 'Object' && Object.keys(res).length) {
                  success(res)
                }
              })
              .catch((e) => {
                // this.loadingStatus = false
                if (typeof fail === 'function') {
                  fail(e)
                }
              })
          }
        }
      }
    }

    const checkQueryFields = (obj) => {
      const checkListkey = ['total', 'pageSize', 'current', 'listData']
      if (Object.prototype.toString.call(obj).slice(8, -1) === 'Object') {
        return Object.keys(obj).every((it) => {
          return checkListkey.find((its) => its === it) && obj[it] && typeof obj[it] === 'string'
        })
      }
      return false
    }
    // 表单值列表查询输出字段配置
    const configFormfield = (options = {}) => {
      if (
        options?.configFormOut &&
        Object.prototype.toString.call(options.configFormOut).slice(8, -1) === 'Object' &&
        Object.keys(options.configFormOut).length &&
        checkQueryFields(options.configFormOut)
      ) {
        return options.configFormOut
      } else {
        if (props.fieldFieldOutput && typeof props?.fieldFieldOutput === 'function') {
          const configFields = props.fieldFieldOutput({
            total: 'records',
            pageSize: 'pageSize',
            current: 'pageNo',
            listData: 'rows'
          })
          const isPass = checkQueryFields(configFields)
          if (isPass) {
            return configFields
          } else {
            return {
              total: 'records',
              pageSize: 'pageSize',
              current: 'pageNo',
              listData: 'rows'
            }
          }
        } else {
          return {
            total: 'records',
            pageSize: 'pageSize',
            current: 'pageNo',
            listData: 'rows'
          }
        }
      }
    }

  /*  const findValueByKey = (obj, key) => {
      // eslint-disable-next-line no-prototype-builtins
      if (Object.prototype.toString.call(obj).slice(8, -1) === 'Object' && obj.hasOwnProperty(key)) {
        return obj[key]
      }
      for (const prop in obj) {
        // eslint-disable-next-line no-prototype-builtins
        if (obj.hasOwnProperty(prop) && Object.prototype.toString.call(obj[prop]).slice(8, -1) === 'Object') {
          const value = findValueByKey(obj[prop], key)
          if (value !== undefined) {
            return value
          }
        }
      }
      return undefined
    } */


   const findValueByKey = (obj, key, depth = 0) => {
      if (depth > 3) {
        return undefined
      }
      const currentValue = Object.prototype.toString.call(obj).slice(8, -1) === 'Object' && obj.hasOwnProperty(key)
        ? obj[key]
        : undefined

      for (const prop in obj) {
        if (obj.hasOwnProperty(prop) && Object.prototype.toString.call(obj[prop]).slice(8, -1) === 'Object') {
          const deepValue = findValueByKey(obj[prop], key, depth + 1)
          if (deepValue !== undefined) {
            return deepValue
          }
        }
      }
      return currentValue
    }

    // 配置值列表属性
    const formatConfigout = (row = {}, keyList = [], options = {}) => {
      const configfieldOut = configFormfield(options)
      const configDataOption = {}
      if (configfieldOut && Object.prototype.toString.call(configfieldOut).slice(8, -1) === 'Object' && Object.keys(configfieldOut).length) {
        for (const [key, value] of Object.entries(configfieldOut)) {
          const iskeyUse = keyList.findIndex((it) => it === key)
          if (row[value]) {
            if (iskeyUse !== -1) {
              if (key !== 'listData') {
                configDataOption[key] = typeof row[value] === 'number' ? row[value] : parseInt(row[value]) || 0
              } else {
                if (key === 'listData') {
                  configDataOption[key] = Array.isArray(row[value]) ? row[value] : []
                }
              }
            }
          } else {
            if (iskeyUse !== -1) {
              const resultData = findValueByKey(row, value)
              if (key === 'listData') {
                configDataOption[key] = Array.isArray(resultData) ? resultData : []
              } else {
                if (resultData) {
                  configDataOption[key] = typeof resultData === 'number' ? resultData : parseInt(resultData) || 0
                } else {
                  configDataOption[key] = 0
                }
              }
            }
          }
        }
      }
      return configDataOption
    }

    // 表单接口实例
    const httpRquestFormInstace = (model, options, rows) => {
      return new Promise((resolve, reject) => {
        nextTick(() => {
          queryTableListMethod(
            { pageIndex: 1, pageSize: 1000, ...(model || {}) },
            {
              ...(options || {}),
              success: (res) => {
                const configRows = formatConfigout(res, ['total', 'listData'], rows)
                resolve({ data: res, configRows })
              },
              fail: (err) => {
                reject(err)
              }
            },
            rows
          )
        })
      })
    }
    // 初始化值列表请求
    const getEveryFormQueryFiled = async (rowsList) => {
      try {
        if (!Array.isArray(rowsList)) return []
        const apiUrlList = rowsList.filter((it) => it && it.apiParams && Object.prototype.toString.call(it.apiParams).slice(8, -1) === 'Object' && it.apiParams.url)
        const apiReulst = []
        // 使用自定义包装器处理所有 Promise
        const wrappedPromises = apiUrlList.map((option) => {
          const { url, headers, model, options } = option.apiParams
          const { httpRequest } = option
          const promiseThen = httpRquestFormInstace({ ...(model || {}) }, { httpRequest, apiParams: option.apiParams, ...(options || {}) }, option)
          return wrapPromise(promiseThen)
        })
        // 执行所有 Promise 并处理结果
        const results = await Promise.all(wrappedPromises)

        results.forEach((item, index) => {
          if (item.status === 'fulfilled') {
            const { configRows } = item.value
            const newListOptions =
              apiUrlList[index]?.callOptionListFormat && typeof apiUrlList[index].callOptionListFormat === 'function' && hasReturnStatement(apiUrlList[index].callOptionListFormat)
                ? apiUrlList[index].callOptionListFormat(configRows?.listData || apiUrlList[index]?.dataOptions || [])
                : apiUrlList[index].callOptionListFormat

            apiReulst.push({ prop: apiUrlList[index].prop, listData: Array.isArray(newListOptions) ? newListOptions : configRows?.listData || apiUrlList[index]?.dataOptions || [] })
          } else {
            // console.error(`[失败] URL ${urls[index]}: ${result.reason}`);
          }
        })
        return apiReulst
      } catch (e) {
        console.log('errr', e)
        return []
      }
    }

    // 方法定义
    const initFormItemOptions = (props) => {
      if (isParentTable.value) {
        const { style, ...opt } = props
        return { style: { marginBottom: '10px', ...style }, ...opt }
      }
      return props
    }

    const getCompIcon = (key) => extentedIcon[key] || key

    const filterOptions = (it) => {
      const { icon, ...opt } = it
      return opt
    }

    const clickBtn = (it) => {
      if (it.triggerEvent && ['query', 'rest'].includes(it.key || '')) {
        queryTableRequest(props.model, refs.value, it.key)
      } else {
        it.click(props.model, refs.value, getTableInstant.value.httpRequestInstance)
      }
    }

    const queryTableRequest = (model, formRef, key) => {
      if (key === 'query' && isParentTable.value) {
        getTableInstant.value.httpRequestInstance(model)
      } else if (key === 'rest' && formRef) {
        formRef.resetFields()
      }
    }


    const formInputComponents = (item) => {
      const formPutList = new Map([
        [
          'Input',
          (h, model, { row }) => {
            return h(ElInput, {
              modelValue: model[row.prop],
              ...row.attrs,
              ...row.on,
              'onUpdate:modelValue': (val) => {
                model[row.prop] = val
              }
            })
          }
        ],
        [
          'Select',
          (h, model, { row }) => {
            return h(ElSelect, {
              modelValue: model[row.prop],
              ...row.attrs,
              ...row.on,
              'onUpdate:modelValue': (val) => {
                model[row.prop] = val
              }
            }, () => row.dataOptions?.map((item, index) =>
              h(ElOption, { key: index, value: item.value, label: item.label })
            ))
          }
        ],
        [
          'datePicker',
          (h, model, { row }) => {
            return h(ElDatePicker, {
              modelValue: model[row.prop],
              ...row.attrs,
              ...row.on,
              'onUpdate:modelValue': (val) => {
                model[row.prop] = val
              }
            })
          }
        ],
        [
          'timePicker',
          (h, model, { row }) => {
            return h(ElTimePicker, {
              modelValue: model[row.prop],
              ...row.attrs,
              ...row.on,
              'onUpdate:modelValue': (val) => {
                model[row.prop] = val
              }
            })
          }
        ],
        [
          'Slider',
          (h, model, { row }) => {
            return h(ElSlider, {
              modelValue: model[row.prop],
              ...row.attrs,
              ...row.on,
              'onUpdate:modelValue': (val) => {
                model[row.prop] = val
              }
            })
          }
        ],
        [
          'ColorPicker',
          (h, model, { row }) => {
            return h(ElColorPicker, {
              modelValue: model[row.prop],
              ...row.attrs,
              ...row.on,
              'onUpdate:modelValue': (val) => {
                model[row.prop] = val
              }
            })
          }
        ],
        [
          'Transfer',
          (h, model, { row }) => {
            return h(ElTransfer, {
              modelValue: model[row.prop],
              ...row.attrs,
              ...row.on,
              'onUpdate:modelValue': (val) => {
                model[row.prop] = val
              }
            })
          }
        ],
        [
          'Cascader',
          (h, model, { row }) => {
            return h(ElCascader, {
              modelValue: model[row.prop],
              options: row.dataOptions,
              ...row.attrs,
              ...row.on,
              'onUpdate:modelValue': (val) => {
                model[row.prop] = val
              }
            })
          }
        ],
        [
          'Radio',
          (h, model, { row }) => {
            return h(ElRadioGroup, {
              modelValue: model[row.prop],
              ...row.attrs,
              ...row.on,
              'onUpdate:modelValue': (val) => {
                model[row.prop] = val
              }
            }, () => row.dataOptions?.map((item, index) =>
              h(ElRadio, { key: index, label: item.value }, item.label)
            ))
          }
        ],
        [
          'Checkbox',
          (h, model, { row }) => {
            return h(ElCheckboxGroup, {
              modelValue: model[row.prop],
              ...row.attrs,
              ...row.on,
              'onUpdate:modelValue': (val) => {
                model[row.prop] = val
              }
            }, () => row.dataOptions?.map((item, index) =>
              h(ElCheckbox, { key: index, label: item.value }, item.label)
            ))
          }
        ],
        [
          'Switch',
          (h, model, { row }) => {
            return h(ElSwitch, {
              modelValue: model[row.prop],
              ...row.attrs,
              ...row.on,
              'onUpdate:modelValue': (val) => {
                model[row.prop] = val
              }
            })
          }
        ],
        [
          'Rate',
          (h, model, { row }) => {
            return h(ElRate, {
              modelValue: model[row.prop],
              ...row.attrs,
              ...row.on,
              'onUpdate:modelValue': (val) => {
                model[row.prop] = val
              }
            })
          }
        ],
        [
          'Upload',
          (h, model, { row }) => {
            return h(ElUpload, {
              ...row.attrs,
              ...row.on
            })
          }
        ]
      ])
      return formPutList.get(item.formtype) || (() => null)
    }

    const changefolded = () => {
      folded.value = !folded.value
    }
    const confirm = () => {
      emit('confirm', refs.value, props.model)
    }
    const reset = () => {
      emit('reset', refs.value, props.model)
    }

    // const handleRefresh = () => {}
    // const handleCustomerForm = () => {}
    // const handleTableItemOption = () => {}
    // 刷新重置当前表单和表格组件
    function handleRefresh() {}
    function getCustomerTableInfo() {
      const tableRows = {
        dataSource: [],
        columns: [
          {
            type: 'selection',
            width: 50
          },
          {
            label: '名称(列)',
            key: 'label'
          },
          {
            label: '属性(Key)',
            key: 'tableProp'
          },
          //  {
          //   label: '属性值(value)',
          //   key: 'tableValue',
          //  },
          {
            label: '列宽',
            width: 180,
            render: (text, row) => {
              return h('div', [
                h(ElInput, {
                  size: "small",
                  maxlength: 3,
                  formatter: (value) => value.replace(/^0|[^0-9]/g, ''),
                  modelValue: row.width,
                  'onUpdate:modelValue': (val) => {
                    row.width = val
                  }
                }, {
                  prepend: () => '宽度',
                  append: () => 'px'
                })
              ])
            }
          }
        ]
      }
      return tableRows
    }
    const formRows = ref({
      data: [],
      columns: [
        {
          type: 'selection',
          width: 50
        },
        {
          label: '名称(列)',
          key: 'label'
        },
        {
          label: '属性(Key)',
          key: 'prop'
        },
        //  {
        //   label: '属性值(value)',
        //   key: 'tableValue',
        //  },
        {
          label: '列宽',
          width: 180,
          render: (text, row) => {
            return h('div', [
              h(ElInput, {
                size: "small",
                maxlength: 3,
                formatter: (value) => value.replace(/^0|[^0-9]/g, ''),
                modelValue: row.width,
                'onUpdate:modelValue': (val) => {
                  row.width = val
                }
              }, {
                prepend: () => '宽度',
                append: () => 'px'
              })
            ])
          }
        }
      ]
    })
    // const handleRefresh = () => {}
    const handleCustomerForm = () => {
      const formRows = getformRowsFun()
      customerForm({
        title: '自定义查询',
        width: '800px',
        isDraggable: true,
        render: () =>
          h(EsTable, {
            dataSource: formRows.data,
            columns: formRows.columns,
            options: {
              multiSelect: true,
              expand: false,
              snIndex: false,
              loading: false,
              border: true,
              size: 'small'
            },
            pagination: {
              pageSize: 10,
              current: 1,
              total: formRows.data?.length || 0
            }
          }),
        configBtn: [
          {
            name: '取消',
            icon: 'Close',
            click: (e, f, close) => {
              close()
            }
          },
          {
            name: '确认',
            type: 'primary',
            icon: 'Check',
            click: (e, f, close) => {
              // console.log('确认', formRows.data)
              close()
            }
          }
        ],
        onSubmit: (e) => {
          e(false)
        },
        onClosed: (e) => {
          // close 回调 ， 如果需要的话
        }
      })
    }
    const getformRowsFun = () => {
      return {
        data: formItemRowsList.value.map((it) => ({
          ...it,
          label: it.label,
          prop: it.prop,
          isHiden: it.isHiden ? true : false,
          width: it.width
        })),
        columns: formRows.value.columns
      }
    }
    const handleTableItemOption = () => {
      const formRows = getCustomerTableInfo()
      customerTable({
        title: '自定义表格',
        width: '800px',
        render: () =>
          h(EsTable, {
            dataSource: formRows.dataSource,
            columns: formRows.columns
          }),
        onSubmit: (e) => {
          e(false)
          // 弹窗的回调处理，如果有的话
        },
        onClosed: (e) => {
          // close 回调 ， 如果需要的话
        }
      })
    }
    watch(
      () => props.formItemList,
      async (val) => {
        const list = Array.isArray(val) ? val : []
        const rows = await getEveryFormQueryFiled(list)
        console.log('rowRuest///', rows, list)
        formItemRowsList.value = list.map((it) => {
          if (!it) return null
          const reslutApiOption = rows.find((item) => item && item.prop === it.prop)
          return reslutApiOption ? { ...it, dataOptions: reslutApiOption.listData } : it
        }).filter(Boolean)
        console.log('rowRuest///222', formItemRowsList.value)
      },
      { immediate: true, deep: true }
    )
    // 生命周期
    nextTick(() => {
      formInstance.value = refs.value
      // console.log('formInstance///', instance?.ctx?.bodyFormInstantce, formInstance.value)
      instance?.ctx?.bodyFormInstantce?.(formInstance.value)
    })

    return {
      setFormRef,
      tags,
      refs,
      folded,
      formInstance,
      formItemRowsList,
      locale,
      isParentTable,
      colRightLeftList,
      formItemComponents,
      formItemListfilter,
      isBtnHiden,
      rowLayout,
      formLayout,
      fromProps,
      getSetOptionsStatus,
      getRowColsAlgorithm,
      formItem,
      isRenderBtn,
      isfold,
      getBtnColSpan,
      wrapPromise,
      hasReturnStatement,
      isListenToCallBackfn,
      getListenToCallBack,
      queryTableListMethod,
      checkQueryFields,
      configFormfield,
      findValueByKey,
      formatConfigout,
      httpRquestFormInstace,
      getEveryFormQueryFiled,
      initFormItemOptions,
      getCompIcon,
      filterOptions,
      clickBtn,
      queryTableRequest,
      formInputComponents,
      changefolded,
      confirm,
      reset,
      handleRefresh,
      getCustomerTableInfo,
      formRows,
      handleCustomerForm,
      getformRowsFun,
      handleTableItemOption,
      getTableInstant
    }
  }
})
</script>

<style lang="scss" scoped>
.es-form {
  :deep(.el-form-item) {
    margin-bottom: 18px;
  }
  
  :deep(.el-form-item__label) {
    font-weight: 500;
  }
  
  // .flex-center {
  //   display: flex;
  //   align-items: center;
  //   flex-wrap: wrap;
  // }
  
  .buttonOperate {
    display: flex;
    align-items: center;
    flex-wrap: wrap;
    gap: 8px;
  }
  
  .leftRightBtn {
    display: flex;
    justify-content: space-between;
    align-items: center;
    width: 100%;
    
    .btn-left,
    .btn-right {
      display: flex;
      align-items: center;
    }
  }
  
  .btn-formItem {
    margin-bottom: 0;
  }
  
  .formItemCols {
    width: 100%;
  }
}
</style>
