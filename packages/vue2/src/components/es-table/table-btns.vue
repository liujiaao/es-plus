<template>
  <div v-if="showContainer" class="flex-float btns">
    <div class="left-text">
      {{ leftText }}
    </div>

    <div class="btn-container_block">
      <!-- 左侧按钮组 -->
      <div class="btn-left">
        <template v-for="(item, index) in processedBtnLeft">
          <div v-if="!item.isHide" :key="item.name || index" :style="buttonContainerStyle(index)">
            <render-dom
              v-if="item.render && typeof item.render === 'function'"
              :render="item.render"
            />
            <el-button
              v-else
              :type="item.type || ''"
              :size="resolveBtnSize(item)"
              :icon="getCompIcon(item.icon)"
              :loading="item.loading || false"
              v-bind="filterOptions(item)"
              :disabled="getDisabledState(item)"
              @click="() => item.click && item.click(instance)"
            >
              {{ item.name }}
            </el-button>
          </div>
        </template>
      </div>

      <!-- 右侧按钮组 -->
      <div class="btn-right">
        <template v-for="(item, index) in processedBtnRight">
          <div v-if="!item.isHide" :key="item.name || index" :style="buttonContainerStyle(index)">
            <render-dom
              v-if="item.render && typeof item.render === 'function'"
              :render="item.render"
            />
            <el-button
              v-else
              :type="item.type || ''"
              :size="resolveBtnSize(item)"
              :icon="getCompIcon(item.icon)"
              :loading="item.loading || false"
              v-bind="filterOptions(item)"
              :disabled="getDisabledState(item)"
              @click="() => item.click && item.click(instance)"
            >
              {{ item.name }}
            </el-button>
          </div>
        </template>
      </div>
    </div>
  </div>
</template>

<script lang="ts">
/**
 * EsTable 工具栏按钮组件 —— Vue 2 版本
 *
 * 与 Vue 3 版本的差异：
 *   - 不使用 <script setup>
 *   - 图标用 el-icon-* class 字符串（getCompIcon 转换 Element Plus 风格）
 *   - 按钮 v-bind 时排除 icon/render/click/permissionValue 等已单独处理或非 DOM 属性
 *
 * 按钮配置约定：
 *   - code === 1: 渲染到左侧
 *   - code === 2: 渲染到右侧
 *   - permissionValue: 配合全局 esPlus.permission(value) 做权限过滤
 *   - isHide: boolean | () => boolean，函数形式会被解析
 *   - render: 用户自定义渲染函数
 *   - click(instance): 点击回调，注入 EsTable 实例
 */

import { defineComponent, computed, inject, h } from '../../vue-compat'
import { getGlobalConfig, getButtonPosition, type BtnConfig } from '@es-plus/core'
import { getCompIcon } from '../../utils/icon'
import { mapSize } from '../../utils/size'

/**
 * 工具栏按钮的运行时形状（在 BtnConfig 基础上加 isHide）
 *
 * BtnConfig 上的 `[key: string]: unknown` 索引签名会让 vue-tsc 在模板里
 * 把 item.name / item.icon / item.click 全部窄化成 unknown。这里显式
 * 用一个最小契约（只覆盖模板真正会用到的字段）来阻断那条索引签名，
 * 让 :key / :icon / @click 在生成 .d.ts 时通过类型校验。
 */
type RenderableBtn = {
  name?: string
  icon?: string
  click?: (...args: unknown[]) => void
  type?: string
  size?: string
  loading?: boolean
  disabled?: boolean | ((...args: unknown[]) => boolean)
  render?: (...args: unknown[]) => unknown
  isHide?: boolean
  permissionValue?: string
  code?: 1 | 2
}

// 函数式 render 包装组件
const RenderDom = defineComponent({
  name: 'RenderDomTbBtn',
  props: {
    render: { type: Function, required: true },
  },
  setup(props: any) {
    return () => {
      if (!props.render || typeof props.render !== 'function') return null
      try {
        return props.render()
      } catch {
        return null
      }
    }
  },
})

export default defineComponent({
  name: 'EsTableBtns',
  components: { RenderDom },
  props: {
    leftText: { type: String, default: '' },
    btnConfig: {
      type: Array as () => BtnConfig[],
      default: () => [],
    },
    instance: {
      type: Object as () => Record<string, unknown>,
      default: () => ({}),
    },
  },
  setup(props) {
    const esPlus =
      inject<Record<string, unknown>>('$EsPlus', null as unknown as Record<string, unknown>) ??
      (getGlobalConfig() as Record<string, unknown>) ??
      {}

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
          processed.isHide = (item.isHide as () => boolean)()
        } else {
          processed.isHide = item.isHide || false
        }

        return processed
      })
    }

    const processedBtnLeft = computed<RenderableBtn[]>(() => {
      return processButtonConfig(
        (props.btnConfig || []).filter((item) => getButtonPosition(item as BtnConfig) === 'left') as Array<Record<string, unknown>>
      ).filter((item) => !item.isHide) as RenderableBtn[]
    })

    const processedBtnRight = computed<RenderableBtn[]>(() => {
      return processButtonConfig(
        (props.btnConfig || []).filter((item) => getButtonPosition(item as BtnConfig) === 'right') as Array<Record<string, unknown>>
      ).filter((item) => !item.isHide) as RenderableBtn[]
    })

    const showContainer = computed(() => {
      return (
        !!props.leftText ||
        processedBtnLeft.value.length > 0 ||
        processedBtnRight.value.length > 0
      )
    })

    const getDisabledState = (item: Record<string, unknown>): boolean => {
      if (typeof item.disabled === 'function') {
        return (item.disabled as () => boolean)()
      }
      return (item.disabled as boolean) || false
    }

    const buttonContainerStyle = (index: number) => {
      return {
        display: 'inline-block',
        marginLeft: index !== 0 ? '8px' : '0px',
      }
    }

    /**
     * 过滤掉非 el-button 原生 props 的字段，避免 v-bind 透传出错
     */
    const filterOptions = (item: Record<string, unknown>) => {
      const {
        render: _r,
        click: _c,
        icon: _i,
        permissionValue: _p,
        code: _co,
        isHide: _ih,
        name: _n,
        size: _s,
        ...rest
      } = item
      return rest
    }

    /**
     * 解析按钮尺寸：先按用户传入值经 mapSize 翻译为 Element UI v2 语义；
     * 用户未传时默认 mini，与 EsForm 的默认值保持一致，避免 EsTable 工具栏按钮
     * 比表单控件视觉上"大一截"。
     */
    const resolveBtnSize = (item: { size?: string }): string => {
      const mapped = mapSize(item.size)
      return mapped || 'mini'
    }

    return {
      processedBtnLeft,
      processedBtnRight,
      showContainer,
      getDisabledState,
      buttonContainerStyle,
      getCompIcon,
      filterOptions,
      resolveBtnSize,
    }
  },
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
