<template>
  <div class="i18n-page">
    <!-- Hero Section -->
    <section class="hero-section">
      <div class="hero-badge">
        <i class="el-icon-s-flag" />
        <span>国际化</span>
      </div>
      <h1 class="hero-title">
        多语言支持
      </h1>
      <p class="hero-desc">
        ES-Plus 提供完整的国际化解决方案，支持多语言切换、自定义语言包和动态语言加载。
        让你的中后台应用轻松适配全球化需求。
      </p>
    </section>

    <!-- Features -->
    <section class="section">
      <div class="section-header">
        <div class="section-icon blue">
          <i class="el-icon-collection" />
        </div>
        <h2 class="section-title">
          国际化特性
        </h2>
      </div>

      <div class="feature-grid">
        <div class="feature-card">
          <div class="feature-icon">
            <i class="el-icon-s-check" />
          </div>
          <h3>内置语言包</h3>
          <p>内置中英文语言包，开箱即用，支持 Element UI 语言同步切换</p>
        </div>
        <div class="feature-card">
          <div class="feature-icon">
            <i class="el-icon-edit" />
          </div>
          <h3>自定义扩展</h3>
          <p>支持自定义语言包扩展和覆盖，满足业务个性化需求</p>
        </div>
        <div class="feature-card">
          <div class="feature-icon">
            <i class="el-icon-refresh" />
          </div>
          <h3>动态切换</h3>
          <p>支持运行时动态切换语言，无需刷新页面即可生效</p>
        </div>
        <div class="feature-card">
          <div class="feature-icon">
            <i class="el-icon-download" />
          </div>
          <h3>按需加载</h3>
          <p>支持语言包异步加载，减少首屏加载时间</p>
        </div>
      </div>
    </section>

    <!-- Quick Start -->
    <section class="section">
      <div class="section-header">
        <div class="section-icon purple">
          <i class="el-icon-time" />
        </div>
        <h2 class="section-title">
          快速开始
        </h2>
      </div>

      <div class="step-list">
        <div class="step-item">
          <div class="step-marker">
            1
          </div>
          <div class="step-content">
            <h4>安装 vue-i18n</h4>
            <p>ES-Plus 使用 vue-i18n 作为国际化基础库，请先安装：</p>
            <div class="code-block">
              <div class="code-header">
                <span class="code-lang">bash</span>
                <button
                  class="copy-btn"
                  @click="copyCode('install')"
                >
                  <i class="el-icon-document-copy" />
                  复制
                </button>
              </div>
              <pre v-pre><code>npm install vue-i18n --save</code></pre>
            </div>
          </div>
        </div>

        <div class="step-item">
          <div class="step-marker">
            2
          </div>
          <div class="step-content">
            <h4>配置国际化</h4>
            <p>在项目中创建 i18n 配置文件：</p>
            <div class="code-block">
              <div class="code-header">
                <span class="code-lang">javascript</span>
                <button
                  class="copy-btn"
                  @click="copyCode('i18nConfig')"
                >
                  <i class="el-icon-document-copy" />
                  复制
                </button>
              </div>
              <pre v-pre><code>// src/i18n/index.js
import Vue from 'vue'
import VueI18n from 'vue-i18n'
import ElementLocale from 'element-ui/lib/locale'

// 引入 Element UI 语言包
import enElement from 'element-ui/lib/locale/lang/en'
import zhElement from 'element-ui/lib/locale/lang/zh-CN'

Vue.use(VueI18n)

// 合并语言包
const messages = {
  en: {
    ...enElement,
    // 业务自定义语言包
    app: {
      title: 'ES-Plus Admin',
      welcome: 'Welcome'
    }
  },
  'zh-CN': {
    ...zhElement,
    // 业务自定义语言包
    app: {
      title: 'ES-Plus 管理系统',
      welcome: '欢迎使用'
    }
  }
}

const i18n = new VueI18n({
  locale: localStorage.getItem('es-lang') || 'zh-CN',
  fallbackLocale: 'zh-CN',
  messages
})

// 同步 Element UI 语言
ElementLocale.i18n((key, value) => i18n.t(key, value))

export default i18n</code></pre>
            </div>
          </div>
        </div>

        <div class="step-item">
          <div class="step-marker">
            3
          </div>
          <div class="step-content">
            <h4>在 main.js 中引入</h4>
            <div class="code-block">
              <div class="code-header">
                <span class="code-lang">javascript</span>
                <button
                  class="copy-btn"
                  @click="copyCode('mainImport')"
                >
                  <i class="el-icon-document-copy" />
                  复制
                </button>
              </div>
              <pre v-pre><code>import Vue from 'vue'
import App from './App.vue'
import i18n from './i18n'
import EsPlus from '@es-plus/vue2'

Vue.use(EsPlus, {
  i18n: (key, value) => i18n.t(key, value)
})

new Vue({
  i18n,
  render: h => h(App)
}).$mount('#app')</code></pre>
            </div>
          </div>
        </div>
      </div>
    </section>

    <!-- Language Switch -->
    <section class="section">
      <div class="section-header">
        <div class="section-icon green">
          <i class="el-icon-switch" />
        </div>
        <h2 class="section-title">
          语言切换
        </h2>
      </div>

      <div class="switch-demo">
        <div class="demo-preview">
          <h4>切换示例</h4>
          <div class="lang-buttons">
            <button 
              class="lang-btn" 
              :class="{ active: currentLang === 'zh-CN' }"
              @click="switchLang('zh-CN')"
            >
              <span class="flag">🇨🇳</span>
              简体中文
            </button>
            <button 
              class="lang-btn" 
              :class="{ active: currentLang === 'en' }"
              @click="switchLang('en')"
            >
              <span class="flag">🇺🇸</span>
              English
            </button>
          </div>
          <div class="preview-content">
            <p class="preview-text">
              {{ previewText }}
            </p>
            <p class="preview-label">
              当前语言: {{ currentLang }}
            </p>
          </div>
        </div>

        <div class="code-block">
          <div class="code-header">
            <span class="code-lang">vue</span>
            <button
              class="copy-btn"
              @click="copyCode('switchComponent')"
            >
              <i class="el-icon-document-copy" />
              复制
            </button>
          </div>
          <pre v-pre><code>&lt;template&gt;
  &lt;div class="lang-switcher"&gt;
    &lt;el-dropdown @command="handleLangChange"&gt;
      &lt;el-button type="primary"&gt;
        &lt;i class="el-icon-s-flag" /&gt;
        {{ currentLangText }}
      &lt;/el-button&gt;
      &lt;el-dropdown-menu slot="dropdown"&gt;
        &lt;el-dropdown-item command="zh-CN"&gt;
          简体中文
        &lt;/el-dropdown-item&gt;
        &lt;el-dropdown-item command="en"&gt;
          English
        &lt;/el-dropdown-item&gt;
      &lt;/el-dropdown-menu&gt;
    &lt;/el-dropdown&gt;
  &lt;/div&gt;
&lt;/template&gt;

&lt;script&gt;
export default {
  data() {
    return {
      currentLang: localStorage.getItem('es-lang') || 'zh-CN'
    }
  },
  methods: {
    handleLangChange(lang) {
      this.$i18n.locale = lang
      localStorage.setItem('es-lang', lang)
      this.$message.success(lang === 'zh-CN' ? '语言切换成功' : 'Language switched')
    }
  }
}
&lt;/script&gt;</code></pre>
        </div>
      </div>
    </section>

    <!-- Custom Locale -->
    <section class="section">
      <div class="section-header">
        <div class="section-icon orange">
          <i class="el-icon-document-add" />
        </div>
        <h2 class="section-title">
          自定义语言包
        </h2>
      </div>

      <div class="code-block">
        <div class="code-header">
          <span class="code-lang">javascript</span>
          <button
            class="copy-btn"
            @click="copyCode('customLocale')"
          >
            <i class="el-icon-document-copy" />
            复制
          </button>
        </div>
        <pre v-pre><code>// src/i18n/locale/zh-CN.js
export default {
  // ES-Plus 组件文案覆盖
  es: {
    table: {
      emptyText: '暂无数据',
      confirmDelete: '确定要删除这条记录吗？',
      batchDelete: '确定要删除选中的 {count} 条记录吗？'
    },
    form: {
      pleaseSelect: '请选择',
      pleaseInput: '请输入',
      validateError: '表单验证失败，请检查输入'
    },
    dialog: {
      confirm: '确定',
      cancel: '取消',
      close: '关闭'
    }
  },
  // 业务文案
  app: {
    title: 'ES-Plus 管理系统',
    logout: '退出登录',
    switchLangSuccess: '语言切换成功'
  }
}

// 在 i18n/index.js 中引入
import customZh from './locale/zh-CN'
import customEn from './locale/en'

const messages = {
  en: {
    ...enElement,
    ...esEuiEn,
    ...customEn
  },
  'zh-CN': {
    ...zhElement,
    ...esEuiZh,
    ...customZh
  }
}</code></pre>
      </div>

      <div class="tip-box info">
        <i class="el-icon-info-filled" />
        <p><strong>提示</strong>：自定义语言包可以覆盖 ES-Plus 默认文案，也可以添加业务专属的多语言内容。</p>
      </div>
    </section>

    <!-- Async Load -->
    <section class="section">
      <div class="section-header">
        <div class="section-icon blue">
          <i class="el-icon-download" />
        </div>
        <h2 class="section-title">
          异步加载语言包
        </h2>
      </div>
      <p class="section-desc">
        对于大型应用，建议按需异步加载语言包以减少首屏加载时间：
      </p>

      <div class="code-block">
        <div class="code-header">
          <span class="code-lang">javascript</span>
          <button
            class="copy-btn"
            @click="copyCode('asyncLoad')"
          >
            <i class="el-icon-document-copy" />
            复制
          </button>
        </div>
        <pre v-pre><code>// src/i18n/index.js
import Vue from 'vue'
import VueI18n from 'vue-i18n'

Vue.use(VueI18n)

const i18n = new VueI18n({
  locale: 'zh-CN',
  messages: {} // 初始为空
})

// 异步加载语言包
export async function loadLocaleMessages(locale) {
  // 已加载过的语言包直接返回
  if (Object.keys(i18n.getLocaleMessage(locale)).length > 0) {
    return Promise.resolve()
  }
  
  // 动态导入语言包
  const messages = await import(
    /* webpackChunkName: "locale-[request]" */
    `./locale/${locale}.js`
  )
  
  i18n.setLocaleMessage(locale, messages.default)
  return Promise.resolve()
}

// 切换语言时异步加载
export async function switchLanguage(locale) {
  await loadLocaleMessages(locale)
  i18n.locale = locale
  localStorage.setItem('es-lang', locale)
  document.querySelector('html').setAttribute('lang', locale)
}

export default i18n</code></pre>
      </div>
    </section>

    <!-- Component Usage -->
    <section class="section">
      <div class="section-header">
        <div class="section-icon purple">
          <i class="el-icon-s-grid" />
        </div>
        <h2 class="section-title">
          在组件中使用
        </h2>
      </div>

      <div class="usage-tabs">
        <div class="tab-header">
          <div 
            class="tab-item" 
            :class="{ active: activeTab === 'template' }"
            @click="activeTab = 'template'"
          >
            模板中使用
          </div>
          <div 
            class="tab-item" 
            :class="{ active: activeTab === 'script' }"
            @click="activeTab = 'script'"
          >
            脚本中使用
          </div>
          <div 
            class="tab-item" 
            :class="{ active: activeTab === 'jsx' }"
            @click="activeTab = 'jsx'"
          >
            JSX 中使用
          </div>
        </div>

        <div class="tab-content">
          <div
            v-show="activeTab === 'template'"
            class="tab-pane"
          >
            <div class="code-block">
              <div class="code-header">
                <span class="code-lang">vue</span>
                <button
                  class="copy-btn"
                  @click="copyCode('usageTemplate')"
                >
                  <i class="el-icon-document-copy" />
                  复制
                </button>
              </div>
              <pre v-pre><code>&lt;!-- 使用 $t 方法 --&gt;
&lt;template&gt;
  &lt;div&gt;
    &lt;h1&gt;{{ $t('app.title') }}&lt;/h1&gt;
    &lt;p&gt;{{ $t('app.welcome') }}&lt;/p&gt;
    
    &lt;!-- 支持插值 --&gt;
    &lt;span&gt;共 100 条&lt;/span&gt;
    
    &lt;!-- Element UI 组件 --&gt;
    &lt;el-button&gt;确定&lt;/el-button&gt;
    &lt;el-button&gt;取消&lt;/el-button&gt;
  &lt;/div&gt;
&lt;/template&gt;</code></pre>
            </div>
          </div>

          <div
            v-show="activeTab === 'script'"
            class="tab-pane"
          >
            <div class="code-block">
              <div class="code-header">
                <span class="code-lang">javascript</span>
                <button
                  class="copy-btn"
                  @click="copyCode('usageScript')"
                >
                  <i class="el-icon-document-copy" />
                  复制
                </button>
              </div>
              <pre v-pre><code>export default {
  data() {
    return {
      message: 'Welcome'
    }
  },
  methods: {
    handleConfirm() {
      this.$confirm(
        '确定要删除吗？',
        '确认',
        {
          confirmButtonText: '确定',
          cancelButtonText: '取消'
        }
      )
    },
    
    // 动态语言切换
    async switchLanguage(lang) {
      await this.$i18n.setLocaleMessage(lang, newMessages)
      this.$i18n.locale = lang
    }
  }
}</code></pre>
            </div>
          </div>

          <div
            v-show="activeTab === 'jsx'"
            class="tab-pane"
          >
            <div class="code-block">
              <div class="code-header">
                <span class="code-lang">jsx</span>
                <button
                  class="copy-btn"
                  @click="copyCode('usageJsx')"
                >
                  <i class="el-icon-document-copy" />
                  复制
                </button>
              </div>
              <pre v-pre><code>// 在 useDialog 的 JSX 中使用
import { useDialog } from '@es-plus/vue2'

export default {
  methods: {
    openDialog() {
      useDialog({
        title: '确认',
        content: (
          &lt;div&gt;
            &lt;p&gt;确定要删除吗？&lt;/p&gt;
            &lt;el-button&gt;取消&lt;/el-button&gt;
            &lt;el-button type="primary"&gt;确定&lt;/el-button&gt;
          &lt;/div&gt;
        )
      })
    }
  }
}</code></pre>
            </div>
          </div>
        </div>
      </div>
    </section>

    <!-- API Reference -->
    <section class="section">
      <div class="section-header">
        <div class="section-icon blue">
          <i class="el-icon-document" />
        </div>
        <h2 class="section-title">
          API 参考
        </h2>
      </div>

      <div class="api-section">
        <h4>VueI18n 实例方法</h4>
        <div class="param-table-wrapper">
          <table class="param-table">
            <thead>
              <tr>
                <th>方法名</th>
                <th>说明</th>
                <th>参数</th>
              </tr>
            </thead>
            <tbody>
              <tr>
                <td>$t(key, values)</td>
                <td>翻译指定 key 的文案</td>
                <td>key: 语言包键名, values: 插值对象</td>
              </tr>
              <tr>
                <td>$tc(key, count)</td>
                <td>复数翻译</td>
                <td>key: 键名, count: 数量</td>
              </tr>
              <tr>
                <td>$te(key)</td>
                <td>检查 key 是否存在</td>
                <td>key: 语言包键名</td>
              </tr>
              <tr>
                <td>$i18n.locale</td>
                <td>获取/设置当前语言</td>
                <td>语言代码，如 'zh-CN', 'en'</td>
              </tr>
              <tr>
                <td>$i18n.setLocaleMessage(locale, message)</td>
                <td>动态设置语言包</td>
                <td>locale: 语言代码, message: 语言包对象</td>
              </tr>
            </tbody>
          </table>
        </div>
      </div>

      <div class="api-section">
        <h4>ES-Plus 语言包结构</h4>
        <div class="code-block">
          <div class="code-header">
            <span class="code-lang">javascript</span>
            <button
              class="copy-btn"
              @click="copyCode('localeStructure')"
            >
              <i class="el-icon-document-copy" />
              复制
            </button>
          </div>
          <pre v-pre><code>{
  es: {
    table: {
      emptyText: '暂无数据',
      loadingText: '加载中...',
      total: '共 {total} 条',
      selected: '已选择 {count} 项',
      confirmDelete: '确定删除？',
      batchDelete: '确定删除选中的 {count} 条记录？'
    },
    form: {
      pleaseSelect: '请选择',
      pleaseInput: '请输入',
      validateError: '验证失败',
      submitSuccess: '提交成功',
      submitError: '提交失败'
    },
    dialog: {
      confirm: '确定',
      cancel: '取消',
      close: '关闭',
      maximize: '最大化',
      restore: '还原'
    }
  }
}</code></pre>
        </div>
      </div>
    </section>
  </div>
</template>

<script>
export default {
  name: 'GuideI18n',
  data() {
    return {
      currentLang: 'zh-CN',
      currentLangText: '语言',
      previewText: '欢迎使用',
      activeTab: 'template'
    }
  },
  created() {
    const savedLang = localStorage.getItem('es-lang') || 'zh-CN'
    this.currentLang = savedLang
    this.currentLangText = savedLang === 'zh-CN' ? '语言' : 'Language'
    this.previewText = savedLang === 'zh-CN' ? '欢迎使用' : 'Welcome'
  },
  methods: {
    switchLang(lang) {
      this.currentLang = lang
      this.currentLangText = lang === 'zh-CN' ? '语言' : 'Language'
      this.previewText = lang === 'zh-CN' ? '欢迎使用' : 'Welcome'
      localStorage.setItem('es-lang', lang)
      this.$message.success(lang === 'zh-CN' ? '已切换到简体中文' : 'Switched to English')
    },
    copyCode(type) {
      const codes = {
        install: 'npm install vue-i18n --save',
        i18nConfig: `// src/i18n/index.js
import Vue from 'vue'
import VueI18n from 'vue-i18n'
import ElementLocale from 'element-ui/lib/locale'
import enElement from 'element-ui/lib/locale/lang/en'
import zhElement from 'element-ui/lib/locale/lang/zh-CN'

Vue.use(VueI18n)

const messages = {
  en: { ...enElement },
  'zh-CN': { ...zhElement }
}

const i18n = new VueI18n({
  locale: 'zh-CN',
  fallbackLocale: 'zh-CN',
  messages
})

ElementLocale.i18n((key, value) => i18n.t(key, value))
export default i18n`,
        mainImport: `import Vue from 'vue'
import App from './App.vue'
import i18n from './i18n'
import EsPlus from '@es-plus/vue2'

Vue.use(EsPlus, {
  i18n: (key, value) => i18n.t(key, value)
})

new Vue({ i18n, render: h => h(App) }).$mount('#app')`,
        switchComponent: `// 语言切换组件
&lt;el-dropdown @command="handleLangChange"&gt;
  &lt;el-button type="primary"&gt;
    语言
  &lt;/el-button&gt;
  &lt;el-dropdown-menu slot="dropdown"&gt;
    &lt;el-dropdown-item command="zh-CN"&gt;简体中文&lt;/el-dropdown-item&gt;
    &lt;el-dropdown-item command="en"&gt;English&lt;/el-dropdown-item&gt;
  &lt;/el-dropdown-menu&gt;
&lt;/el-dropdown&gt;`,
        customLocale: `// 自定义语言包
export default {
  es: {
    table: {
      emptyText: '暂无数据',
      confirmDelete: '确定要删除吗？'
    },
    form: {
      pleaseSelect: '请选择'
    }
  }
}`,
        asyncLoad: `// 异步加载语言包
export async function loadLocaleMessages(locale) {
  if (Object.keys(i18n.getLocaleMessage(locale)).length > 0) {
    return Promise.resolve()
  }
  const messages = await import(\`./locale/\${locale}.js\`)
  i18n.setLocaleMessage(locale, messages.default)
}`,
        usageTemplate: `<!-- 模板中使用 --&gt;
&lt;h1&gt;ES-Plus 管理系统&lt;/h1&gt;
&lt;p&gt;欢迎使用 ES-Plus&lt;/p&gt;`,
        usageScript: `// 脚本中使用
this.$message.success('提交成功')
// 切换语言
this.$i18n.locale = 'en'`,
        usageJsx: `// JSX 中使用
content: (
  &lt;div&gt;确定&lt;/div&gt;
)`,
        localeStructure: `{
  es: {
    table: { emptyText: '暂无数据' },
    form: { pleaseSelect: '请选择' },
    dialog: { confirm: '确定' }
  }
}`
      }
      
      const code = codes[type]
      if (code) {
        if (this.$copyText) {
          this.$copyText(code).then(() => {
            this.$message.success('代码已复制到剪贴板')
          })
        } else {
          // 降级处理
          const textarea = document.createElement('textarea')
          textarea.value = code
          document.body.appendChild(textarea)
          textarea.select()
          document.execCommand('copy')
          document.body.removeChild(textarea)
          this.$message.success('代码已复制到剪贴板')
        }
      }
    }
  }
}
</script>

<style lang="scss" scoped>
.i18n-page {
  padding-bottom: 40px;
}

.hero-section {
  text-align: center;
  padding: 40px 0;
  border-bottom: 1px solid #ebeef5;
  margin-bottom: 40px;

  .hero-badge {
    display: inline-flex;
    align-items: center;
    gap: 8px;
    padding: 8px 16px;
    background: linear-gradient(135deg, #667eea 0%, #764ba2 100%);
    color: #fff;
    border-radius: 20px;
    font-size: 14px;
    margin-bottom: 20px;
  }

  .hero-title {
    font-size: 40px;
    font-weight: 700;
    color: #1a1a1a;
    margin-bottom: 16px;
  }

  .hero-desc {
    font-size: 16px;
    color: #606266;
    line-height: 1.6;
    max-width: 700px;
    margin: 0 auto;
  }
}

.section {
  margin-bottom: 50px;
}

.section-header {
  display: flex;
  align-items: center;
  gap: 12px;
  margin-bottom: 24px;

  .section-icon {
    width: 40px;
    height: 40px;
    border-radius: 10px;
    display: flex;
    align-items: center;
    justify-content: center;

    &.blue {
      background: linear-gradient(135deg, #667eea 0%, #764ba2 100%);
    }
    &.purple {
      background: linear-gradient(135deg, #f093fb 0%, #f5576c 100%);
    }
    &.green {
      background: linear-gradient(135deg, #43e97b 0%, #38f9d7 100%);
    }
    &.orange {
      background: linear-gradient(135deg, #fa709a 0%, #fee140 100%);
    }

    i {
      font-size: 20px;
      color: #fff;
    }
  }

  .section-title {
    font-size: 24px;
    font-weight: 600;
    color: #1a1a1a;
    margin: 0;
  }
}

.section-desc {
  font-size: 14px;
  color: #606266;
  margin-bottom: 20px;
  line-height: 1.6;
}

// Feature Grid
.feature-grid {
  display: grid;
  grid-template-columns: repeat(4, 1fr);
  gap: 20px;
}

.feature-card {
  text-align: center;
  padding: 24px;
  border-radius: 12px;
  border: 1px solid #ebeef5;
  background: #fff;
  transition: all 0.3s;

  &:hover {
    box-shadow: 0 4px 20px rgba(0,0,0,0.08);
    transform: translateY(-2px);
  }

  .feature-icon {
    width: 56px;
    height: 56px;
    background: linear-gradient(135deg, #667eea 0%, #764ba2 100%);
    border-radius: 16px;
    display: flex;
    align-items: center;
    justify-content: center;
    margin: 0 auto 16px;

    i {
      font-size: 24px;
      color: #fff;
    }
  }

  h3 {
    font-size: 16px;
    font-weight: 600;
    color: #1a1a1a;
    margin-bottom: 8px;
  }

  p {
    font-size: 13px;
    color: #606266;
    line-height: 1.5;
    margin: 0;
  }
}

// Step List
.step-list {
  padding-left: 20px;
}

.step-item {
  display: flex;
  gap: 20px;
  margin-bottom: 32px;

  &:last-child {
    margin-bottom: 0;
  }
}

.step-marker {
  width: 32px;
  height: 32px;
  background: linear-gradient(135deg, #667eea 0%, #764ba2 100%);
  color: #fff;
  border-radius: 50%;
  display: flex;
  align-items: center;
  justify-content: center;
  font-size: 14px;
  font-weight: 600;
  flex-shrink: 0;
}

.step-content {
  flex: 1;

  h4 {
    font-size: 16px;
    font-weight: 600;
    color: #1a1a1a;
    margin-bottom: 8px;
  }

  p {
    font-size: 14px;
    color: #606266;
    margin-bottom: 12px;
  }

  code {
    // background: #f5f7fa;
    padding: 2px 6px;
    border-radius: 4px;
    font-family: 'Consolas', monospace;
    color: #409eff;
  }
}

// Code Block
.code-block {
  background: #1e1e1e;
  border-radius: 8px;
  overflow: hidden;

  .code-header {
    display: flex;
    align-items: center;
    justify-content: space-between;
    padding: 12px 16px;
    background: #2d2d2d;

    .code-lang {
      font-size: 12px;
      color: #999;
      text-transform: uppercase;
    }

    .copy-btn {
      display: flex;
      align-items: center;
      gap: 4px;
      padding: 4px 12px;
      background: transparent;
      border: 1px solid #555;
      border-radius: 4px;
      color: #ccc;
      font-size: 12px;
      cursor: pointer;
      transition: all 0.3s;

      &:hover {
        border-color: #409eff;
        color: #409eff;
      }
    }
  }

  pre {
    margin: 0;
    padding: 16px;
    overflow-x: auto;

    code {
      font-family: 'Fira Code', 'Consolas', monospace;
      font-size: 13px;
      line-height: 1.6;
      color: #d4d4d4;
    }
  }
}

// Switch Demo
.switch-demo {
  display: grid;
  grid-template-columns: 1fr 1fr;
  gap: 24px;
  align-items: start;
}

.demo-preview {
  background: #f5f7fa;
  border-radius: 12px;
  padding: 24px;

  h4 {
    font-size: 16px;
    font-weight: 600;
    color: #1a1a1a;
    margin-bottom: 16px;
  }
}

.lang-buttons {
  display: flex;
  gap: 12px;
  margin-bottom: 20px;
}

.lang-btn {
  flex: 1;
  display: flex;
  align-items: center;
  justify-content: center;
  gap: 8px;
  padding: 12px;
  background: #fff;
  border: 2px solid #ebeef5;
  border-radius: 8px;
  cursor: pointer;
  transition: all 0.3s;
  font-size: 14px;
  color: #606266;

  .flag {
    font-size: 18px;
  }

  &:hover {
    border-color: #409eff;
    color: #409eff;
  }

  &.active {
    border-color: #409eff;
    background: #ecf5ff;
    color: #409eff;
  }
}

.preview-content {
  text-align: center;
  padding: 20px;
  background: #fff;
  border-radius: 8px;

  .preview-text {
    font-size: 18px;
    color: #1a1a1a;
    margin-bottom: 8px;
  }

  .preview-label {
    font-size: 12px;
    color: #909399;
  }
}

// Tip Box
.tip-box {
  display: flex;
  align-items: flex-start;
  gap: 12px;
  padding: 16px;
  border-radius: 8px;
  margin-top: 20px;
  background: #f0f9eb;
  border-left: 4px solid #67c23a;

  i {
    font-size: 20px;
    color: #67c23a;
    margin-top: 2px;
  }

  p {
    margin: 0;
    font-size: 14px;
    color: #606266;
    line-height: 1.6;

    strong {
      color: #1a1a1a;
    }
  }
}

// Usage Tabs
.usage-tabs {
  border: 1px solid #ebeef5;
  border-radius: 8px;
  overflow: hidden;
}

.tab-header {
  display: flex;
  background: #f5f7fa;
  border-bottom: 1px solid #ebeef5;
}

.tab-item {
  flex: 1;
  padding: 12px 24px;
  text-align: center;
  font-size: 14px;
  color: #606266;
  cursor: pointer;
  transition: all 0.3s;

  &:hover {
    color: #409eff;
  }

  &.active {
    color: #409eff;
    background: #fff;
    font-weight: 500;
  }

  & + .tab-item {
    border-left: 1px solid #ebeef5;
  }
}

.tab-content {
  .tab-pane {
    .code-block {
      border-radius: 0;
    }
  }
}

// API Section
.api-section {
  margin-bottom: 32px;

  h4 {
    font-size: 16px;
    font-weight: 600;
    color: #1a1a1a;
    margin-bottom: 16px;
  }
}

// Param Table
.param-table-wrapper {
  overflow-x: auto;
}

.param-table {
  width: 100%;
  border-collapse: collapse;
  font-size: 14px;

  th, td {
    padding: 12px 16px;
    text-align: left;
    border-bottom: 1px solid #ebeef5;
  }

  th {
    background: #f5f7fa;
    color: #1a1a1a;
    font-weight: 600;
  }

  td {
    color: #606266;

    code {
      background: #f5f7fa;
      padding: 2px 6px;
      border-radius: 4px;
      font-family: 'Consolas', monospace;
      color: #409eff;
    }
  }

  tr:hover td {
    background: #f5f7fa;
  }
}

@media (max-width: 768px) {
  .feature-grid {
    grid-template-columns: repeat(2, 1fr);
  }

  .switch-demo {
    grid-template-columns: 1fr;
  }

  .tab-header {
    flex-wrap: wrap;

    .tab-item {
      flex: none;
      width: 100%;
      border-left: none !important;
      border-bottom: 1px solid #ebeef5;
    }
  }
}
</style>
