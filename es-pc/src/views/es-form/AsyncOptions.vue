<template>
  <div class="example-form-async">
    <es-form
      ref="formRef"
      :model="formModel"
      :form-item-list="formItems"
      :config-btn="configBtn"
    />
  </div>
</template>

<script setup lang="ts">
import { EsForm } from '@es-plus/adapter-antdv'
import { ref, reactive, computed } from 'vue'
import { message } from 'ant-design-vue'
import { fetchMockUsers, fetchMockPosts, fetchMockAlbums } from '@/utils/mock-api'

const formRef = ref()

const formModel = reactive({
  province: '',
  city: '',
  district: ''
})

/**
 * 三级联动异步数据加载示例
 *
 * 核心配置说明：
 * - apiParams      : 配置请求的 URL、方法、请求头等
 * - httpRequest    : 自定义 HTTP 请求方法（可选，优先级高于全局配置）
 *                    必须返回 Promise，resolve 的值作为 API 原始响应
 * - listenToCallBack.crtn: 响应数据格式化回调，接收 API 原始响应
 *                          返回 [{ label, value }] 格式的选项数据
 * - on.change      : 选择变化回调，用于清空下级数据并触发联动加载
 * - formItmeRequestInstance: es-form 暴露的方法，用于手动触发指定表单项的接口请求
 *                           用法: formRef.value?.formItmeRequestInstance(['city'])
 */
const formItems = computed(() => [
  // ===== 省份选择 =====
  {
    prop: 'province',
    label: '省份',
    span: 8,
    formtype: 'Select',
    attrs: {
      placeholder: '请选择省份',
      allowClear: true,
      showSearch: true
    },
    // 接口请求配置：真实项目里指向后端地址（此处仅作配置示例）
    apiParams: {
      url: '/api/mock/users',
      method: 'GET'
    },
    // 自定义 HTTP 请求方法，返回 Promise，resolve 的值为 API 原始响应数据
    // 参数 config 包含 { url, headers, formParams, ... }；本示例用站内本地 mock，
    // 断网/被墙时也不会静默空白。真实项目可改为 fetch(config.url) 或封装的 request。
    httpRequest: () => fetchMockUsers(),
    // 响应数据格式化回调
    // crtn 接收 httpRequest resolve 的原始数据，返回 [{ label, value }] 格式
    listenToCallBack: {
      crtn: (data: unknown) => {
        if (Array.isArray(data)) {
          return data.slice(0, 10).map((item: any, index: number) => ({
            label: item.address?.city || item.name || `省份${index + 1}`,
            value: `province_${item.id || index + 1}`
          }))
        }
        return []
      }
    },
    on: {
      onChange: (_value: string) => {
        // 省份变化时清空城市和区县
        console.log('省份变化', _value)
        formModel.city = ''
        formModel.district = ''
        // 调用 formItmeRequestInstance 手动触发 city 表单项的接口请求
        formRef.value?.formItmeRequestInstance(['city'])
      }
    }
  },

  // ===== 城市选择 =====
  {
    prop: 'city',
    label: '城市',
    span: 8,
    formtype: 'Select',
    // 禁止初始化时自动加载，需手动通过 formItmeRequestInstance 触发
    isInitRun: false,
    attrs: {
      placeholder: '请选择城市',
      allowClear: true,
      showSearch: true,
      // 未选择省份时禁用城市选择
      disabled: !formModel.province
    },
    apiParams: {
      url: '/api/mock/posts',
      method: 'GET'
    },
    // 站内本地 mock，断网可用；真实项目替换为 fetch(config.url)
    httpRequest: () => fetchMockPosts(),
    listenToCallBack: {
      crtn: (data: unknown) => {
        if (Array.isArray(data)) {
          return data.slice(0, 8).map((item: any, index: number) => ({
            label: item.title?.substring(0, 8) || `城市${index + 1}`,
            value: `city_${item.id || index + 1}`
          }))
        }
        return []
      }
    },
    on: {
      onChange: (_value: string) => {
        // 城市变化时清空区县并触发加载
        formModel.district = ''
        formRef.value?.formItmeRequestInstance(['district'])
      }
    }
  },

  // ===== 区县选择 =====
  {
    prop: 'district',
    label: '区县',
    span: 8,
    formtype: 'Select',
    // 禁止初始化时自动加载，需手动通过 formItmeRequestInstance 触发
    isInitRun: false,
    attrs: {
      placeholder: '请选择区县',
      allowClear: true,
      showSearch: true,
      // 未选择城市时禁用区县选择
      disabled: !formModel.city
    },
    apiParams: {
      url: '/api/mock/albums',
      method: 'GET'
    },
    // 站内本地 mock，断网可用；真实项目替换为 fetch(config.url)
    httpRequest: () => fetchMockAlbums(),
    listenToCallBack: {
      crtn: (data: unknown) => {
        if (Array.isArray(data)) {
          return data.slice(0, 8).map((item: any, index: number) => ({
            label: item.title?.substring(0, 8) || `区县${index + 1}`,
            value: `district_${item.id || index + 1}`
          }))
        }
        return []
      }
    }
    // 区县为最后一级，无需 on.change 触发下级
  }
])

const configBtn: Record<string, any>[] = [
  {
    name: '提交',
    type: 'primary',
    direction: 'right',
    icon: 'Check',
    click: (model: Record<string, unknown>) => {
      message.success(`选择结果: ${JSON.stringify(model)}`)
    }
  },
  {
    name: '重置',
    direction: 'right',
    icon: 'RefreshLeft',
    click: (_: unknown, formRefInstance: { resetFields: () => void } | null) => {
      formRefInstance?.resetFields()
    }
  }
]
</script>

<style scoped>
.example-form-async {
  padding: 20px;
}
</style>
