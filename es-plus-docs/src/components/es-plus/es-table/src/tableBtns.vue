<template>
  <div v-if="showContainer" class="flex-float btns">
    <div class="left-text">
      {{ leftText }}
    </div>

    <div class="btn-container_block">
      <!-- 左侧按钮组 -->
      <div class="btn-left">
        <template v-for="(item, index) in processedBtnLeft" :key="item.name">
          <div v-if="!item.isHide" :style="buttonContainerStyle(index)">
            <render-dom v-if="item.render && typeof item.render === 'function'" :render="item.render" />
            <el-button v-else :type="item.type" :size="item.size || 'small'" :icon="item.icon" :loading="item.loading || false" v-bind="item" :disabled="getDisabledState(item)" @click="()=>item.click(instance)">
              {{ item.name }}
            </el-button>
          </div>
        </template>
      </div>

      <!-- 右侧按钮组 -->
      <div class="btn-right">
        <template v-for="(item, index) in processedBtnRight" :key="item.name">
          <div v-if="!item.isHide" :style="buttonContainerStyle(index)">
            <render-dom v-if="item.render && typeof item.render === 'function'" :render="item.render" />
            <el-button v-else :type="item.type" :size="item.size || 'small'" v-bind="item" :icon="item.icon" :loading="item.loading || false" :disabled="getDisabledState(item)" @click="() =>item.click(instance)">
              {{ item.name }}
            </el-button>
          </div>
        </template>
      </div>
    </div>
  </div>
</template>

<script>
import { defineComponent, computed, h } from 'vue'
import { ElButton } from 'element-plus'
// import { useStore } from 'vuex'

// 函数式组件定义
const RenderDom = (props) => {
  if (!props.render || typeof props.render !== 'function') {
    console.warn('RenderDom: render function is required')
    return null
  }
  
  try {
    return props.render()
  } catch (error) {
    console.error('RenderDom: Error executing render function', error)
    return null
  }
}

RenderDom.props = {
  render: { type: Function, required: true }
}

export default defineComponent({
  name: 'TableBtns',
  components: {
    ElButton,
    RenderDom
  },
  props: {
    leftText: {
      type: String,
      default: ''
    },
    btnConfig: {
      type: Array,
      default: () => []
    },
    instance: {
      type: Object,
      default: () => ({})
    }
  },
  setup(props) {
    // const store = useStore()

    // 检查是否显示容器
    const showContainer = computed(() => {
      return props.leftText || processedBtnLeft.value.length > 0 || processedBtnRight.value.length > 0
    })

    // 权限检查方法
    const hasPermission = (btnList, pvalue) => {
      // 未配置权限值则认为有权限
      if (!pvalue) return true

      // 没有菜单数据则认为无权限
      if (!btnList || btnList.length === 0) return false

      return btnList.some((btn) => btn.permissionValue === pvalue)
    }

    // 处理按钮配置
    const processButtonConfig = (config) => {
      const btnList = []

      return config.map((item) => {
        // 创建新对象避免修改原始配置
        const processed = { ...item }

        // 检查权限
        const hasPerm = hasPermission(btnList, item.permissionValue)

        // 处理隐藏状态
        if (!hasPerm) {
          processed.isHide = true
        } else if (typeof item.isHide === 'function') {
          processed.isHide = item.isHide()
        } else {
          processed.isHide = item.isHide || false
        }

        return processed
      })
    }

    // 处理左侧按钮
    const processedBtnLeft = computed(() => {
      return processButtonConfig(props.btnConfig.filter((item) => item.code === 1)).filter((item) => !item.isHide)
    })

    // 处理右侧按钮
    const processedBtnRight = computed(() => {
      return processButtonConfig(props.btnConfig.filter((item) => item.code === 2)).filter((item) => !item.isHide)
    })

    // 获取按钮禁用状态
    const getDisabledState = (item) => {
      if (typeof item.disabled === 'function') {
        return item.disabled()
      }
      return item.disabled || false
    }

    // 按钮容器样式
    const buttonContainerStyle = (index) => {
      return {
        display: 'inline-block',
        marginLeft: index !== 0 ? '8px' : '0px'
      }
    }

    return {
      showContainer,
      processedBtnLeft,
      processedBtnRight,
      getDisabledState,
      buttonContainerStyle
    }
  }
})
</script>

<style lang="scss" scoped>
.btns {
  padding: 0;
  padding-bottom: 5px;
  display: flex;
  justify-content: space-between;
  align-items: center;
}

.left-text {
  color: rgb(125, 125, 125);
  font-size: 14px;
  flex-grow: 1;
}

.btn-container_block {
  display: flex;
  justify-content: space-between;
  align-items: center;
  width: 100%;

  .btn-left {
    display: flex;
    justify-content: flex-start;
    align-items: center;
    flex-wrap: wrap;
  }

  .btn-right {
    display: flex;
    justify-content: flex-end;
    align-items: center;
    flex-wrap: wrap;
  }
}

/* 响应式调整 */
@media (max-width: 768px) {
  .btns {
    flex-direction: column;
    align-items: flex-start;
  }

  .btn-container_block {
    flex-direction: column;
    align-items: flex-start;
    gap: 10px;

    .btn-left,
    .btn-right {
      width: 100%;
      justify-content: flex-start;
    }
  }
}
</style>
