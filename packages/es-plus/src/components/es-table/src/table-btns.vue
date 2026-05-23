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

<script setup lang="ts">
import { computed, h, inject } from 'vue'
import { ElButton } from 'element-plus'

const props = defineProps<{
  leftText?: string
  btnConfig?: Array<Record<string, unknown>>
  instance?: Record<string, unknown>
}>()

const RenderDom = (props: { render: () => unknown }) => {
  if (!props.render || typeof props.render !== 'function') return null
  try {
    return props.render()
  } catch {
    return null
  }
}

RenderDom.props = {
  render: { type: Function, required: true }
}

const esPlus = inject<Record<string, unknown>>('$EsPlus', {})

const hasPermission = (_btnList: unknown[], pvalue?: string) => {
  if (!pvalue) return true
  const permFn = esPlus.permission
  if (typeof permFn === 'function') return (permFn as (v: string) => boolean)(pvalue)
  return true
}

const processButtonConfig = (config: Array<Record<string, unknown>>) => {
  return config.map((item) => {
    const processed = { ...item }
    const hasPerm = hasPermission([], item.permissionValue as string)

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

const processedBtnLeft = computed(() => {
  return processButtonConfig((props.btnConfig || []).filter((item) => item.code === 1)).filter((item) => !item.isHide)
})

const processedBtnRight = computed(() => {
  return processButtonConfig((props.btnConfig || []).filter((item) => item.code === 2)).filter((item) => !item.isHide)
})

const showContainer = computed(() => {
  return props.leftText || processedBtnLeft.value.length > 0 || processedBtnRight.value.length > 0
})

const getDisabledState = (item: Record<string, unknown>) => {
  if (typeof item.disabled === 'function') {
    return item.disabled()
  }
  return item.disabled || false
}

const buttonContainerStyle = (index: number) => {
  return {
    display: 'inline-block',
    marginLeft: index !== 0 ? '8px' : '0px'
  }
}
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
  // flex-grow: 1;
}

.btn-container_block {
  display: flex;
  justify-content: space-between;
  align-items: center;
  flex: 1;

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
