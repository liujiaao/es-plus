import { createVNode, getCurrentInstance, render } from 'vue'
import EsDialog from '../component.vue'

// Simplified element selector with fallback
const getAppendToElement = (appendTo) => {
  if (typeof appendTo === 'string') {
    return document.querySelector(appendTo) || document.body
  }
  return appendTo instanceof HTMLElement ? appendTo : document.body
}

// More efficient instance initialization
const initInstance = (Component, props, container, appContext) => {
  console.log('[useDialog-ly-eui] 创建弹窗实例 - appContext:', appContext)

  const vNode = createVNode(Component, props)

  // 确保语言环境正确传递 - 核心解决方案
  if (appContext) {
    vNode.appContext = appContext

    // 创建完整的语言环境配置
    const createLocaleContext = () => {
      const zhCn = {
        name: 'zh-cn',
        el: {
          colorpicker: {
            confirm: '确定',
            clear: '清空'
          },
          datepicker: {
            now: '此刻',
            today: '今天',
            cancel: '取消',
            clear: '清空',
            confirm: '确定',
            selectDate: '选择日期',
            selectTime: '选择时间',
            startDate: '开始日期',
            startTime: '开始时间',
            endDate: '结束日期',
            endTime: '结束时间',
            prevYear: '前一年',
            nextYear: '后一年',
            prevMonth: '上个月',
            nextMonth: '下个月',
            year: '年',
            month1: '1 月',
            month2: '2 月',
            month3: '3 月',
            month4: '4 月',
            month5: '5 月',
            month6: '6 月',
            month7: '7 月',
            month8: '8 月',
            month9: '9 月',
            month10: '10 月',
            month11: '11 月',
            month12: '12 月',
            week: '周次',
            weeks: {
              sun: '日',
              mon: '一',
              tue: '二',
              wed: '三',
              thu: '四',
              fri: '五',
              sat: '六'
            },
            months: {
              jan: '一月',
              feb: '二月',
              mar: '三月',
              apr: '四月',
              may: '五月',
              jun: '六月',
              jul: '七月',
              aug: '八月',
              sep: '九月',
              oct: '十月',
              nov: '十一月',
              dec: '十二月'
            }
          },
          select: {
            loading: '加载中',
            noMatch: '无匹配数据',
            noData: '无数据',
            placeholder: '请选择'
          },
          cascader: {
            noMatch: '无匹配数据',
            loading: '加载中',
            placeholder: '请选择',
            noData: '暂无数据'
          },
          pagination: {
            goto: '前往',
            pagesize: '条/页',
            total: '共 {total} 条',
            pageClassifier: '页',
            page: '页',
            prev: '上一页',
            next: '下一页',
            currentPage: '第 {pager} 页',
            prevPages: '向前 {pager} 页',
            nextPages: '向后 {pager} 页'
          },
          messagebox: {
            title: '提示',
            confirm: '确定',
            cancel: '取消',
            error: '输入的数据不合法!'
          },
          upload: {
            deleteTip: '按 delete 键可删除',
            delete: '删除',
            preview: '查看图片',
            continue: '继续上传'
          },
          table: {
            emptyText: '暂无数据',
            confirmFilter: '筛选',
            resetFilter: '重置',
            clearFilter: '全部',
            sumText: '合计'
          },
          tree: {
            emptyText: '暂无数据'
          },
          transfer: {
            noMatch: '无匹配数据',
            noData: '无数据',
            titles: ['列表 1', '列表 2'],
            filterPlaceholder: '请输入搜索内容',
            noCheckedFormat: '共 {total} 项',
            hasCheckedFormat: '已选 {checked}/{total} 项'
          },
          image: {
            error: '加载失败'
          },
          pageHeader: {
            title: '返回'
          },
          popconfirm: {
            confirmButtonText: '确定',
            cancelButtonText: '取消'
          }
        }
      }

      return zhCn
    }

    // 确保 provides 对象存在
    if (!vNode.appContext.provides) {
      vNode.appContext.provides = {}
    }

    // 注入 Element Plus 语言环境
    vNode.appContext.provides['elLocale'] = createLocaleContext()

    // 同时设置全局属性作为后备
    if (!vNode.appContext.config) {
      vNode.appContext.config = {}
    }
    if (!vNode.appContext.config.globalProperties) {
      vNode.appContext.config.globalProperties = {}
    }

    // 设置语言环境到全局属性
    vNode.appContext.config.globalProperties.$ELEMENT = {
      locale: createLocaleContext()
    }

    console.log('[useDialog-ly-eui] 语言环境已注入:', vNode.appContext.provides['elLocale'])

    // 确保语言环境能被子组件获取
    if (!vNode.appContext.provides['elLocale']) {
      vNode.appContext.provides['elLocale'] = createLocaleContext()
    }
  }

  render(vNode, container)

  const target = getAppendToElement(props.appendTo)
  target.appendChild(container)
  return vNode
}

// Optimized hook implementation
export const useDialog = (Component, opt = {}) => {
  Component = Component || EsDialog
  opt = Object.assign({ onlyInstance: false }, opt)

  if (opt.onlyInstance) {
    const instance = getCurrentInstance()
    const appContext = instance?.appContext || null
    const container = document.createElement('div')

    const close = () => {
      render(null, container)
      container.remove()
    }

    const DialogComponent = (options) => {
      // Set default visibility
      if (options.visible === undefined) {
        options.visible = true
      }

      // Cleaner event handling
      const originalOnClosed = options.onClosed
      const originalOnSubmit = options.onSubmit

      options.onClosed = (...args) => {
        originalOnClosed?.(...args)
        close()
      }

      options.onSubmit = (closeFn = close) => {
        originalOnSubmit?.(closeFn)
      }

      // Create and return component instance
      return initInstance(Component, options, container, appContext)
    }

    DialogComponent.close = close
    return DialogComponent
  } else {
    const container = document.createElement('div')
    container.className = 'dailog-containers'
    const instance = getCurrentInstance()
    const appContext = instance?.appContext || null
    let vNode = null

    const close = () => {
      if (vNode && vNode.component) {
        vNode.component.props.visible = false
      }
    }

    const destroy = () => {
      if (vNode) {
        render(null, container)
        container.remove()
        vNode = null
      }
    }

    const DialogComponent = (options) => {
      // 更新现有实例
      if (vNode && vNode.component) {
        Object.assign(vNode.component.props, options)
        vNode.component.props.visible = true
        return vNode
      }

      // 设置默认属性
      const dialogOptions = {
        visible: true,
        width: '50%',
        destroyOnClose: true,
        ...options
      }

      // 处理事件
      const { onClosed: originalOnClosed, onSubmit: originalOnSubmit } = dialogOptions

      dialogOptions.onClosed = () => {
        originalOnClosed?.()
        close()
      }

      dialogOptions.onSubmit = (closeFn = close) => {
        originalOnSubmit?.(closeFn)
      }
      vNode = initInstance(Component, dialogOptions, container, appContext)
      return vNode
    }
    DialogComponent.close = close
    DialogComponent.destroy = destroy
    return DialogComponent
  }
}

export default useDialog
