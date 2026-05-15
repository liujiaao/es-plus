// 实现插件
export default class DomResizeObserver {
  constructor(options = {}) {
    this.options = {
      pollingInterval: 100,
      useMutationObserver: true,
      debounceDelay: 16, // 默认16ms防抖延迟（约60fps）
      throttleDelay: 100, // 默认100ms节流延迟
      maxRetries: 3, // 最大重试次数
      retryDelay: 50, // 重试延迟
      enableDebug: false, // 调试模式
      ...options
    }

    this.observers = new Map()
    this.callbacks = new Map()
    this.debounceTimers = new Map()
    this.throttleTimers = new Map()
    this.retryCounts = new Map()
    this.lastDimensions = new Map()
    this.mutationBatch = new Map()
    this.isProcessing = new Set()

    // 使用原生ResizeObserver（如果可用）
    if (typeof ResizeObserver !== 'undefined') {
      this.useNative = true
      this.observer = new ResizeObserver((entries) => {
        try {
          // 批量处理entries，避免频繁触发
          this.batchProcessEntries(entries)
        } catch (error) {
          console.error('[ResizeObserver] Error in observer callback:', error)
          // 防止无限循环，如果错误频繁发生，考虑断开观察
          this.handleObserverError(error)
        }
      })
    }
    // 降级方案
    else {
      this.useNative = false
      this.observeFallback = this.observeFallback.bind(this)
      this.unobserveFallback = this.unobserveFallback.bind(this)
    }
  }

  // 批量处理entries，防止性能问题
  batchProcessEntries(entries) {
    const batchedEntries = new Map()

    entries.forEach(entry => {
      const element = entry.target
      if (!batchedEntries.has(element)) {
        batchedEntries.set(element, entry)
      }
    })

    batchedEntries.forEach((entry, element) => {
      this.processResize(entry, element)
    })
  }

  // 处理尺寸变化，包含防抖和节流机制
  processResize(entry, element) {
    if (this.isProcessing.has(element)) return

    const { width, height } = entry.contentRect
    const elementKey = this.getElementKey(element)
    const lastDimensions = this.lastDimensions.get(elementKey)

    // 增强的微小变化检测 - 针对表单折叠/展开场景优化
    const minWidthChange = 5  // 最小宽度变化阈值
    const minHeightChange = 10 // 最小高度变化阈值（表单折叠/展开通常变化较大）

    // 检查是否真的发生了变化（避免微小变化导致的无限循环）
    if (lastDimensions &&
      Math.abs(width - lastDimensions.width) < minWidthChange &&
      Math.abs(height - lastDimensions.height) < minHeightChange) {
      this.log('info', `Filtered out minor change: ${width}x${height} (last: ${lastDimensions.width}x${lastDimensions.height})`)
      return
    }

    // 针对表单折叠/展开的特殊处理
    const isFormCollapse = this.detectFormCollapse(width, height, lastDimensions)
    if (isFormCollapse) {
      this.log('info', `Detected form collapse/expand, applying special handling`)
      // 表单折叠/展开时使用更长的防抖延迟
      const extendedDebounceDelay = Math.max(this.options.debounceDelay, 300)
      this.debounceResize(element, () => {
        this.executeCallbacks(element, { width, height })
      }, extendedDebounceDelay)
      return
    }

    // 正常防抖处理
    if (this.options.debounceDelay > 0) {
      this.debounceResize(element, () => {
        this.executeCallbacks(element, { width, height })
      })
    } else {
      // 节流处理
      this.throttleResize(element, () => {
        this.executeCallbacks(element, { width, height })
      })
    }
  }

  // 检测是否为表单折叠/展开
  detectFormCollapse(width, height, lastDimensions) {
    if (!lastDimensions) return false

    // 检测高度显著变化（表单折叠/展开的特征）
    const heightChange = Math.abs(height - lastDimensions.height)
    const heightChangeRatio = heightChange / Math.max(lastDimensions.height, 1)

    // 如果高度变化超过30%且变化量大于50px，认为是表单折叠/展开
    return heightChangeRatio > 0.3 && heightChange > 50
  }

  // 增强的防抖机制，支持自定义延迟
  debounceResize(element, callback, customDelay = null) {
    const elementKey = this.getElementKey(element)
    const delay = customDelay !== null ? customDelay : this.options.debounceDelay

    if (this.debounceTimers.has(elementKey)) {
      clearTimeout(this.debounceTimers.get(elementKey))
    }

    this.debounceTimers.set(elementKey, setTimeout(() => {
      this.debounceTimers.delete(elementKey)
      callback()
    }, delay))
  }

  // 节流机制
  throttleResize(element, callback) {
    const elementKey = this.getElementKey(element)

    if (this.throttleTimers.has(elementKey)) return

    callback()

    this.throttleTimers.set(elementKey, setTimeout(() => {
      this.throttleTimers.delete(elementKey)
    }, this.options.throttleDelay))
  }

  // 执行回调，包含错误处理和重试机制
  executeCallbacks(element, dimensions) {
    const elementKey = this.getElementKey(element)
    const callbacks = this.callbacks.get(element)

    if (!callbacks || callbacks.size === 0) return

    this.isProcessing.add(element)
    this.lastDimensions.set(elementKey, { ...dimensions })

    try {
      // 执行所有回调
      callbacks.forEach((cb) => {
        try {
          cb(dimensions)
        } catch (error) {
          this.log('error', `Callback error for element:`, error)
        }
      })

      // 重置重试计数
      this.retryCounts.set(elementKey, 0)

    } catch (error) {
      this.log('error', `Error executing callbacks:`, error)
      this.handleRetry(element, dimensions)
    } finally {
      this.isProcessing.delete(element)
    }
  }

  // 错误重试机制
  handleRetry(element, dimensions) {
    const elementKey = this.getElementKey(element)
    const retryCount = this.retryCounts.get(elementKey) || 0

    if (retryCount < this.options.maxRetries) {
      this.retryCounts.set(elementKey, retryCount + 1)

      setTimeout(() => {
        this.executeCallbacks(element, dimensions)
      }, this.options.retryDelay * (retryCount + 1))
    } else {
      this.log('warn', `Max retries reached for element, stopping observation`)
      this.unobserve(element)
    }
  }

  // 获取元素唯一标识
  getElementKey(element) {
    if (!element._resizeObserverKey) {
      element._resizeObserverKey = `element_${Math.random().toString(36).substr(2, 9)}`
    }
    return element._resizeObserverKey
  }

  // 调试日志
  log(level, ...args) {
    if (this.options.enableDebug) {
      console[level](`[DomResizeObserver]`, ...args)
    }
  }

  // 监听元素尺寸变化
  observe(element, callback) {
    if (!element || typeof callback !== 'function') return

    // 初始化元素数据
    if (!this.callbacks.has(element)) {
      this.callbacks.set(element, new Set())

      // 保存初始尺寸
      const rect = element.getBoundingClientRect()
      this.observers.set(element, {
        width: rect.width,
        height: rect.height,
        visible: this.isVisible(element)
      })
    }

    // 添加回调
    this.callbacks.get(element).add(callback)

    // 使用原生ResizeObserver
    if (this.useNative) {
      this.observer.observe(element)
    }
    // 使用降级方案
    else {
      this.observeFallback(element)
    }
  }

  // 取消监听
  unobserve(element, callback) {
    if (!this.callbacks.has(element)) return

    const callbacks = this.callbacks.get(element)

    // 移除特定回调
    if (callback) {
      callbacks.delete(callback)
    }
    // 移除所有回调
    else {
      callbacks.clear()
    }

    // 如果没有回调了，则完全移除
    if (callbacks.size === 0) {
      this.callbacks.delete(element)
      this.observers.delete(element)

      if (this.useNative) {
        this.observer.unobserve(element)
      } else {
        this.unobserveFallback(element)
      }
    }
  }

  // 断开所有监听
  disconnect() {
    if (this.useNative) {
      this.observer.disconnect()
    } else {
      for (const element of this.callbacks.keys()) {
        this.unobserveFallback(element)
      }
    }

    this.callbacks.clear()
    this.observers.clear()
  }

  // 降级方案：监听元素
  observeFallback(element) {
    const data = this.observers.get(element)
    if (data.interval) return // 已经在监听

    // 增强的防抖轮询检查
    data.interval = setInterval(() => {
      this.throttleResize(element, () => {
        this.checkElementDimensions(element, data)
      })
    }, this.options.pollingInterval)

    // 使用MutationObserver监听DOM变化，带防抖处理
    if (this.options.useMutationObserver && typeof MutationObserver !== 'undefined') {
      data.mutationObserver = new MutationObserver(() => {
        this.debounceResize(element, () => {
          this.checkElementDimensions(element, data)
        })
      })

      data.mutationObserver.observe(element, {
        attributes: true,
        childList: true,
        subtree: true,
        characterData: true,
        attributeFilter: ['style', 'class'] // 只监听关键属性变化
      })
    }
  }

  // 检查元素尺寸变化，包含增强的防抖动逻辑
  checkElementDimensions(element, data) {
    try {
      const rect = element.getBoundingClientRect()
      const visible = this.isVisible(element)

      // 增强的微小变化检测 - 针对表单折叠/展开场景优化
      const minWidthChange = 5  // 最小宽度变化阈值
      const minHeightChange = 10 // 最小高度变化阈值

      // 检查尺寸变化或可见性变化（包含增强的微小变化过滤）
      const widthChanged = Math.abs(rect.width - data.width) >= minWidthChange
      const heightChanged = Math.abs(rect.height - data.height) >= minHeightChange
      const visibilityChanged = visible !== data.visible

      // 检测是否为表单折叠/展开
      const isFormCollapse = this.detectFormCollapse(rect.width, rect.height, {
        width: data.width,
        height: data.height
      })

      if (widthChanged || heightChanged || visibilityChanged) {
        this.log('info', `Element dimensions changed: ${rect.width}x${rect.height}, visible: ${visible}, formCollapse: ${isFormCollapse}`)

        const callbacks = this.callbacks.get(element)
        if (callbacks) {
          if (isFormCollapse) {
            // 表单折叠/展开时使用特殊处理
            const extendedDebounceDelay = Math.max(this.options.debounceDelay, 300)
            this.debounceResize(element, () => {
              this.executeCallbacks(element, { width: rect.width, height: rect.height })
            }, extendedDebounceDelay)
          } else {
            // 正常处理
            this.executeCallbacks(element, { width: rect.width, height: rect.height })
          }
        }

        // 更新存储的尺寸
        data.width = rect.width
        data.height = rect.height
        data.visible = visible
      }
    } catch (error) {
      this.log('error', `Error checking element dimensions:`, error)
      this.handleRetry(element, { width: data.width, height: data.height })
    }
  }

  // 降级方案：取消监听
  unobserveFallback(element) {
    const data = this.observers.get(element)
    if (!data) return

    if (data.interval) {
      clearInterval(data.interval)
      delete data.interval
    }

    if (data.mutationObserver) {
      data.mutationObserver.disconnect()
      delete data.mutationObserver
    }
  }

  // 检查元素是否可见
  isVisible(element) {
    return element.offsetWidth > 0 && element.offsetHeight > 0 && window.getComputedStyle(element).display !== 'none'
  }

  // 处理观察者错误，防止无限循环
  handleObserverError(error) {
    this.errorCount = (this.errorCount || 0) + 1
    console.warn(`[ResizeObserver] Error count: ${this.errorCount}`)

    // 如果错误发生太频繁，断开观察以防止浏览器错误
    if (this.errorCount > 10) {
      console.error('[ResizeObserver] Too many errors, disconnecting observer')
      this.disconnect()
    }
  }
}

// 初始化插件
// const resizeObserver = new DomResizeObserver()
