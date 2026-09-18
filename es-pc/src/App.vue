<template>
  <a-config-provider :locale="zhCN" :theme="theme">
    <router-view />
  </a-config-provider>
</template>

<script setup>
import zhCN from 'ant-design-vue/es/locale/zh_CN'

/**
 * 把品牌主色接进 Ant Design Vue 的主题入口。
 *
 * 为什么必须显式传：ADV 4.x 是 cssinjs 主题，组件颜色只认 ConfigProvider 的
 * theme.token.colorPrimary；它**不读**任何 CSS 自定义属性。不传这一段，本站就是
 * 「自研组件品牌蓝 #3b82f6（走 --es-brand-primary）+ a-* 组件库默认蓝 #1677ff」，
 * 同一页两种蓝。
 *
 * 为什么运行时读 CSS 变量而不是在这里写死 '#3b82f6'：品牌色已有单一真源
 * （docs/tokens/design-tokens.css 的 --es-brand-primary，由 sync-tokens 分发到本站），
 * 再写一份常量就多了一个必然漂移的副本。这里直接读取计算值，把「改 token 文件」
 * 变成三站唯一需要做的事。
 *
 * design-tokens.css 在 main.js 中静态 import，先于 mount 生效，因此此处读取是可靠的。
 * 万一读不到（例如某次改动挪走了样式引入），dev 下给出告警 + 回退到 ADV 默认蓝，
 * 而不是静默变成两种蓝。
 */
const readBrandPrimary = () => {
  if (typeof window === 'undefined') return ''
  const value = getComputedStyle(document.documentElement)
    .getPropertyValue('--es-brand-primary')
    .trim()
  if (!value && import.meta.env.DEV) {
    console.warn(
      '[es-pc] 未读到 --es-brand-primary，AntDV 主题将退回库默认蓝 #1677ff。' +
        '请确认 styles/design-tokens.css 已被 main.js 引入（运行 npm run tokens:sync 生成）。',
    )
  }
  return value
}

const brandPrimary = readBrandPrimary()

const theme = {
  token: {
    colorPrimary: brandPrimary || '#1677ff',
  },
}
</script>
