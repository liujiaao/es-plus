<template>
  <div class="intro-page">
    <!-- Hero Section -->
    <section class="hero-section">
      <div class="hero-badge">
        <i class="el-icon-s-promotion" />
        <span>Vue 2.0 + Element UI</span>
      </div>
      <h1 class="hero-title">
        <span class="gradient-text">ES-Plus</span>
        <span class="title-sub">中后台 CRUD 的配置层</span>
      </h1>
      <p class="hero-desc">
        一套基于 Vue 2.0 和 Element UI 的中后台 CRUD 配置层，帮助开发者快速构建中后台管理系统。
        一份 JSON 配置，Vue 2 / Vue 3 / Ant Design Vue 三端通用，AI 生成即编译。
      </p>
      <div class="hero-stats">
        <div class="stat-item">
          <div class="stat-num">
            5+
          </div>
          <div class="stat-label">
            核心组件
          </div>
        </div>
        <div class="stat-item">
          <div class="stat-num">
            14
          </div>
          <div class="stat-label">
            控件类型
          </div>
        </div>
        <div class="stat-item">
          <div class="stat-num">
            0
          </div>
          <div class="stat-label">
            依赖负担
          </div>
        </div>
      </div>
    </section>

    <!-- Design Philosophy Section -->
    <section class="section philosophy-section">
      <h2 class="section-title">
        <span class="title-icon"><i class="el-icon-s-opportunity" /></span>
        设计理念
      </h2>
      <div class="philosophy-content">
        <div class="philosophy-intro">
          <p class="intro-text">
            ES-Plus 是一款基于 <strong>Vue 2 + Element UI</strong> 的<strong>企业级中后台业务组件库</strong>，专注于解决 CRUD 场景下的开发效率问题。通过“配置化驱动”的设计理念，将繁琐的模板代码转化为简洁的 JSON 配置，让开发者从繁重的重复劳动中解放出来。
          </p>
        </div>

        <div class="core-components">
          <h3 class="subsection-title">
            <i class="el-icon-s-grid" />
            核心组件
          </h3>
          <div class="components-grid">
            <div class="component-item">
              <div class="component-icon blue">
                <i class="el-icon-s-data" />
              </div>
              <div class="component-info">
                <strong>EsTable</strong> - 增强型表格组件，支持配置化列定义、自动数据请求、分页管理、跨分页选择缓存
              </div>
            </div>
            <div class="component-item">
              <div class="component-icon purple">
                <i class="el-icon-s-order" />
              </div>
              <div class="component-info">
                <strong>EsForm</strong> - 增强型表单组件，支持配置化字段定义、动态选项、联动逻辑、表单折叠
              </div>
            </div>
            <div class="component-item">
              <div class="component-icon green">
                <i class="el-icon-s-claim" />
              </div>
              <div class="component-info">
                <strong>EsDialog</strong> - 增强型弹窗组件，支持函数式调用、拖拽、全屏、嵌套管理
              </div>
            </div>
            <div class="component-item">
              <div class="component-icon orange">
                <i class="el-icon-magic-stick" />
              </div>
              <div class="component-info">
                <strong>useDialog</strong> - 弹窗管理 Hook，命令式创建弹窗，无需手动维护状态
              </div>
            </div>
          </div>
        </div>

        <div class="why-section">
          <h3 class="subsection-title">
            <i class="el-icon-question" />
            为什么要封装 ES-Plus
          </h3>
          <div class="highlight-box danger">
            <p><strong>最根本的原因：交付团队拥有大量存量的 Vue 2 老旧项目。</strong></p>
            <p>这是 ES-Plus 诞生的核心驱动力。在我们交付团队的日常工作中，存在大量的存量 Vue 2 项目，这些项目经过多年迭代，代码已经非常庞大且难以维护。每当有新需求来临时，开发者需要在这些“老旧”的代码库中艰难地添加新功能。</p>
          </div>
          <div class="reason-list">
            <div class="reason-item">
              <div class="reason-icon">
                <i class="el-icon-s-platform" />
              </div>
              <div class="reason-content">
                <h4>基础UI库 vs 业务组件库</h4>
                <p>Element UI 是基础UI库，提供最原子的表单控件、表格、弹窗等。但仅靠砖块无法直接建成一栋楼。ES-Plus 站在 Element UI 的肩膀上，进一步解决“怎么高效组织”的问题。</p>
              </div>
            </div>
            <div class="reason-item">
              <div class="reason-icon">
                <i class="el-icon-s-check" />
              </div>
              <div class="reason-content">
                <h4>统一规范</h4>
                <p>团队内部存在大量的"重复造轮子"现象。张三喜欢用 slot，李四喜欢用 render 函数，没有统一规范导致代码可读性差、维护成本高。ES-Plus 统一这种混乱局面。</p>
              </div>
            </div>
            <div class="reason-item">
              <div class="reason-icon">
                <i class="el-icon-document" />
              </div>
              <div class="reason-content">
                <h4>配置化而非可视化拖拽</h4>
                <p>我们追求的是"声明式配置"的简洁与高效。一行 JSON 配置，胜过一百行模板代码——这才是 ES-Plus 的核心理念。</p>
              </div>
            </div>
          </div>
        </div>

        <div class="goals-section">
          <h3 class="subsection-title">
            <i class="el-icon-s-flag" />
            四个核心目标
          </h3>
          <div class="goals-grid">
            <div class="goal-card">
              <div class="goal-num">
                01
              </div>
              <h4>让 CRUD 页面开发像写配置一样简单</h4>
              <p>开发者不再需要为每一个列表页、每一个表单编写大量的模板代码，只要掌握了 ES-Plus 的配置规范，一个复杂的 CRUD 页面可以在几分钟内完成。</p>
            </div>
            <div class="goal-card">
              <div class="goal-num">
                02
              </div>
              <h4>让业务联动逻辑开箱即用</h4>
              <p>搜索表单触发表格刷新、分页参数自动携带、选择状态跨页保留——这些在传统方案中需要几十行代码才能实现的交互，在 ES-Plus 中只需要配置一个属性。</p>
            </div>
            <div class="goal-card">
              <div class="goal-num">
                03
              </div>
              <h4>让团队代码风格高度统一</h4>
              <p>当所有页面都使用 ES-Plus 的配置规范来开发时，代码结构自然就统一了。无论是张三写的用户管理页还是李四写的订单管理页，都遵循着相同的配置范式。</p>
            </div>
            <div class="goal-card">
              <div class="goal-num">
                04
              </div>
              <h4>让技术沉淀可持续复用</h4>
              <p>ES-Plus 不仅仅是一个组件库，更是一个可复用的"中后台开发方法论"。当团队积累了一套成熟的配置规范后，可以在不同的项目间复用。</p>
            </div>
          </div>
        </div>

        <div class="principles-section">
          <h3 class="subsection-title">
            <i class="el-icon-collection-tag" />
            封装原则：务实而不炫技
          </h3>
          <div class="principles-list">
            <div class="principle-item">
              <div class="principle-icon">
                <i class="el-icon-s-promotion" />
              </div>
              <div class="principle-content">
                <h4>站在巨人肩膀上</h4>
                <p>ES-Plus 完全基于 Element UI 开发，不重新发明任何 UI 样式或交互模式。开发者学会 Element UI = 学会 ES-Plus 的一半。</p>
              </div>
            </div>
            <div class="principle-item">
              <div class="principle-icon">
                <i class="el-icon-set-up" />
              </div>
              <div class="principle-content">
                <h4>配置优先，插槽保底</h4>
                <p>优先通过配置解决问题，当配置无法满足时才提供插槽或 render 函数。</p>
              </div>
            </div>
            <div class="principle-item">
              <div class="principle-icon">
                <i class="el-icon-refresh" />
              </div>
              <div class="principle-content">
                <h4>复杂留给自己，简单留给用户</h4>
                <p>数据请求、字段映射、状态管理这些"脆活累活"全部在组件内部消化，对外只暴露简洁的配置接口。</p>
              </div>
            </div>
            <div class="principle-item">
              <div class="principle-icon">
                <i class="el-icon-magic-stick" />
              </div>
              <div class="principle-content">
                <h4>保持轻量，不做全家桶</h4>
                <p>ES-Plus 只专注于"表格、表单、弹窗"三个核心场景，不追求大而全，而是追求小而精。</p>
              </div>
            </div>
          </div>
        </div>

        <div class="solution-section">
          <h3 class="subsection-title">
            <i class="el-icon-s-cooperation" />
            ES-Plus 的解决对策
          </h3>
          <div class="highlight-box info">
            <p>ES-Plus 的核心解决思路可以概括为三个关键词：<strong>配置化、联动化、抽象化</strong>。</p>
          </div>
          <div class="solution-content">
            <div class="solution-item">
              <h4><span class="solution-tag">配置化</span></h4>
              <p>把原本需要写在模板里的声明式代码，转化为 JSON 格式的配置对象。表格有多少列、表单有多少个字段，全部通过配置项来声明；弹窗的标题、宽度、是否可拖拽，通过 <code>useDialog</code> 的参数对象来一次性搞定。</p>
            </div>
            <div class="solution-item">
              <h4><span class="solution-tag">联动化</span></h4>
              <p>ES-Plus 内部已经封装好了中后台系统中最常见的那些交互场景，开发者不再需要手动编写 watch、emit 和回调。搜索表单的查询按钮会自动触发表格的数据刷新，重置按钮会自动清空表单并刷新表格，分页切换时会自动带上当前的搜索条件。</p>
            </div>
            <div class="solution-item">
              <h4><span class="solution-tag">抽象化</span></h4>
              <p>ES-Plus 对底层能力的统一封装。数据请求是每个页面都要做的事情，ES-Plus 提供了一个统一的 <code>httpRequest</code> 配置项，开发者只需要配置接口地址和请求参数，组件会自动处理请求、响应、加载状态、错误处理全流程；接口返回的字段名各不一致，ES-Plus 就提供了 <code>configTableOut</code> 字段映射配置。</p>
            </div>
          </div>
        </div>
      </div>
    </section>

    <!-- Features Section -->
    <section class="section">
      <h2 class="section-title">
        <span class="title-icon"><i class="el-icon-star-on" /></span>
        核心特性
      </h2>
      <div class="features-grid">
        <div
          v-for="(feature, index) in features"
          :key="index"
          class="feature-card"
        >
          <div
            class="feature-icon"
            :class="feature.color"
          >
            <i :class="feature.icon" />
          </div>
          <h3 class="feature-title">
            {{ feature.title }}
          </h3>
          <p class="feature-desc">
            {{ feature.desc }}
          </p>
        </div>
      </div>
    </section>

    <!-- Components Section -->
    <section class="section">
      <h2 class="section-title">
        <span class="title-icon"><i class="el-icon-s-grid" /></span>
        组件概览
      </h2>
      <div class="components-list">
        <div
          v-for="(comp, index) in components"
          :key="index"
          class="component-card"
        >
          <div class="comp-header">
            <div
              class="comp-icon"
              :class="comp.color"
            >
              <i :class="comp.icon" />
            </div>
            <div class="comp-info">
              <h3 class="comp-name">
                {{ comp.name }}
              </h3>
              <p class="comp-tag">
                {{ comp.tag }}
              </p>
            </div>
          </div>
          <p class="comp-desc">
            {{ comp.desc }}
          </p>
          <ul class="comp-features">
            <li
              v-for="(item, i) in comp.features"
              :key="i"
            >
              <i class="el-icon-check" />
              {{ item }}
            </li>
          </ul>
        </div>
      </div>
    </section>

    <!-- Compatibility Section -->
    <section class="section">
      <h2 class="section-title">
        <span class="title-icon"><i class="el-icon-info-filled" /></span>
        兼容性
      </h2>
      <div class="compat-cards">
        <div class="compat-item">
          <div class="compat-icon vue">
            <i class="el-icon-s-flag" />
          </div>
          <div class="compat-info">
            <div class="compat-name">
              Vue
            </div>
            <div class="compat-version">
              2.6+
            </div>
          </div>
        </div>
        <div class="compat-item">
          <div class="compat-icon element">
            <i class="el-icon-s-management" />
          </div>
          <div class="compat-info">
            <div class="compat-name">
              Element UI
            </div>
            <div class="compat-version">
              2.15+
            </div>
          </div>
        </div>
        <div class="compat-item">
          <div class="compat-icon browser">
            <i class="el-icon-monitor" />
          </div>
          <div class="compat-info">
            <div class="compat-name">
              浏览器
            </div>
            <div class="compat-version">
              现代浏览器
            </div>
          </div>
        </div>
      </div>
    </section>

    <!-- Version History -->
    <section class="section">
      <h2 class="section-title">
        <span class="title-icon"><i class="el-icon-time" /></span>
        版本记录
      </h2>
      <div class="version-timeline">
        <div
          v-for="(ver, index) in versions"
          :key="index"
          class="timeline-item"
        >
          <div class="timeline-dot" />
          <div class="timeline-content">
            <div class="version-header">
              <span class="version-tag">{{ ver.version }}</span>
              <span class="version-date">{{ ver.date }}</span>
            </div>
            <p class="version-desc">
              {{ ver.content }}
            </p>
          </div>
        </div>
      </div>
    </section>

    <!-- Quick Start CTA -->
    <section class="cta-section">
      <div class="cta-content">
        <h2>开始使用 ES-Plus</h2>
        <p>只需几分钟即可集成到您的项目中</p>
        <router-link
          to="/guide/quickstart"
          class="cta-btn"
        >
          <i class="el-icon-right" />
          快速上手
        </router-link>
      </div>
    </section>
  </div>
</template>

<script>
export default {
  name: 'GuideIntroduction',
  data() {
    return {
      features: [
        {
          icon: 'el-icon-document-checked',
          color: 'blue',
          title: '配置化开发',
          desc: '通过 JSON 配置快速生成表单和表格，大幅减少重复代码，提升开发效率'
        },
        {
          icon: 'el-icon-box',
          color: 'purple',
          title: '组件丰富',
          desc: '提供 EsTable、EsForm、useDialog 等核心组件，覆盖中后台常见场景'
        },
        {
          icon: 'el-icon-link',
          color: 'green',
          title: '联动支持',
          desc: '表格与表单无缝联动，查询、编辑一体化，数据流清晰可控'
        },
        {
          icon: 'el-icon-magic-stick',
          color: 'orange',
          title: '灵活扩展',
          desc: '支持自定义渲染、插槽扩展，满足各种个性化业务需求'
        },
        {
          icon: 'el-icon-collection-tag',
          color: 'cyan',
          title: 'TypeScript',
          desc: '完整的类型定义支持，提供更好的开发体验和代码提示'
        },
        {
          icon: 'el-icon-reading',
          color: 'pink',
          title: '文档完善',
          desc: '详尽的文档和示例，丰富的最佳实践指导，上手即会'
        }
      ],
      components: [
        {
          name: 'EsTable',
          tag: '表格组件',
          icon: 'el-icon-s-data',
          color: 'blue',
          desc: '基于 Element UI Table 封装的企业级表格组件，内置分页、排序、筛选等功能。',
          features: [
            '自动数据请求和分页处理',
            '列配置化定义，支持自定义渲染',
            '行内编辑和批量操作',
            '表格头部插槽，可嵌入查询表单',
            '跨页选择记忆'
          ]
        },
        {
          name: 'EsForm',
          tag: '表单组件',
          icon: 'el-icon-s-order',
          color: 'purple',
          desc: '配置化表单生成器，通过 JSON 配置即可生成复杂的表单界面。',
          features: [
            '支持 14 种控件类型',
            '级联选择、树形选择、上传组件',
            '动态表单和条件渲染',
            '自动验证和错误提示',
            '表单与表格联动'
          ]
        },
        {
          name: 'useDialog',
          tag: '弹窗组件',
          icon: 'el-icon-s-claim',
          color: 'green',
          desc: '函数式弹窗调用方式，支持 JSX 渲染，让弹窗使用更加灵活。',
          features: [
            '支持在弹窗中渲染任意组件',
            '获取弹窗内组件引用',
            '支持嵌套弹窗',
            '灵活的按钮配置',
            '命令式调用方式'
          ]
        }
      ],
      versions: [
        {
          version: 'v1.0.2',
          date: '2026-03',
          content: '初始版本，包含 EsTable、EsForm、useDialog 核心组件，提供完整的配置化开发能力'
        }
      ]
    }
  }
}
</script>

<style lang="scss" scoped>
// Variables
$primary-color: #409eff;
$text-primary: #1a1a1a;
$text-secondary: #4a5568;
$text-tertiary: #718096;
$border-color: #e2e8f0;
$bg-light: #f7fafc;

// Gradient colors
$gradient-blue: linear-gradient(135deg, #667eea 0%, #764ba2 100%);
$gradient-purple: linear-gradient(135deg, #f093fb 0%, #f5576c 100%);
$gradient-green: linear-gradient(135deg, #4facfe 0%, #00f2fe 100%);
$gradient-orange: linear-gradient(135deg, #fa709a 0%, #fee140 100%);
$gradient-cyan: linear-gradient(135deg, #30cfd0 0%, #330867 100%);
$gradient-pink: linear-gradient(135deg, #a8edea 0%, #fed6e3 100%);

.intro-page {
  max-width: 1200px;
  margin: 0 auto;
  padding: 40px 24px;
  color: $text-primary;
  line-height: 1.6;
}

// Hero Section
.hero-section {
  text-align: center;
  padding: 60px 20px;
  background: linear-gradient(135deg, #f5f7fa 0%, #c3cfe2 100%);
  border-radius: 20px;
  margin-bottom: 60px;
  position: relative;
  overflow: hidden;

  &::before {
    content: '';
    position: absolute;
    top: -50%;
    right: -20%;
    width: 600px;
    height: 600px;
    background: radial-gradient(circle, rgba(255,255,255,0.4) 0%, transparent 70%);
    pointer-events: none;
  }

  .hero-badge {
    display: inline-flex;
    align-items: center;
    gap: 8px;
    padding: 8px 20px;
    background: rgba(255,255,255,0.8);
    border-radius: 50px;
    font-size: 14px;
    color: $text-secondary;
    margin-bottom: 24px;
    backdrop-filter: blur(10px);
    box-shadow: 0 4px 15px rgba(0,0,0,0.05);

    i {
      color: $primary-color;
    }
  }

  .hero-title {
    margin: 0 0 20px;
    font-size: 48px;
    font-weight: 700;
    display: flex;
    flex-direction: column;
    align-items: center;
    gap: 8px;

    .gradient-text {
      background: linear-gradient(135deg, #667eea 0%, #764ba2 50%, #f093fb 100%);
      -webkit-background-clip: text;
      -webkit-text-fill-color: transparent;
      background-clip: text;
      letter-spacing: -2px;
    }

    .title-sub {
      font-size: 24px;
      font-weight: 400;
      color: $text-secondary;
    }
  }

  .hero-desc {
    max-width: 550px;
    margin: 0 auto;
    font-size: 16px;
    opacity: 0.9;
    line-height: 1.7;
  }

  .hero-stats {
    display: flex;
    justify-content: center;
    gap: 60px;

    .stat-item {
      text-align: center;

      .stat-num {
        font-size: 36px;
        font-weight: 700;
        background: $gradient-blue;
        -webkit-background-clip: text;
        -webkit-text-fill-color: transparent;
        background-clip: text;
      }

      .stat-label {
        font-size: 14px;
        color: $text-tertiary;
        margin-top: 4px;
      }
    }
  }
}

// Section Common Styles
.section {
  margin-bottom: 60px;
}

// Philosophy Section Styles
.philosophy-section {
  .philosophy-content {
    .philosophy-intro {
      background: linear-gradient(135deg, #f5f7fa 0%, #e4e7ed 100%);
      border-radius: 16px;
      padding: 32px;
      margin-bottom: 40px;
      border-left: 4px solid #409eff;

      .intro-text {
        font-size: 16px;
        line-height: 1.8;
        color: $text-secondary;
        margin: 0;

        strong {
          color: $primary-color;
        }
      }
    }
  }

  .subsection-title {
    display: flex;
    align-items: center;
    gap: 10px;
    font-size: 20px;
    font-weight: 600;
    margin: 40px 0 24px;
    color: $text-primary;
    padding-bottom: 12px;
    border-bottom: 1px solid $border-color;

    i {
      color: $primary-color;
      font-size: 22px;
    }
  }

  .core-components {
    .components-grid {
      display: grid;
      grid-template-columns: repeat(2, 1fr);
      gap: 16px;

      .component-item {
        display: flex;
        align-items: flex-start;
        gap: 16px;
        padding: 20px;
        background: white;
        border-radius: 12px;
        border: 1px solid $border-color;
        box-shadow: 0 2px 12px rgba(0,0,0,0.04);

        .component-icon {
          flex-shrink: 0;
          width: 44px;
          height: 44px;
          border-radius: 10px;
          display: flex;
          align-items: center;
          justify-content: center;
          color: white;
          font-size: 20px;

          &.blue { background: linear-gradient(135deg, #667eea 0%, #764ba2 100%); }
          &.purple { background: linear-gradient(135deg, #f093fb 0%, #f5576c 100%); }
          &.green { background: linear-gradient(135deg, #4facfe 0%, #00f2fe 100%); }
          &.orange { background: linear-gradient(135deg, #fa709a 0%, #fee140 100%); }
        }

        .component-info {
          font-size: 14px;
          line-height: 1.7;
          color: $text-secondary;

          strong {
            color: $text-primary;
            font-weight: 600;
          }
        }
      }
    }
  }

  .why-section {
    .highlight-box {
      background: #fff;
      border-radius: 12px;
      padding: 24px;
      margin-bottom: 24px;
      border: 1px solid $border-color;

      &.danger {
        border-left: 4px solid #f56c6c;
        background: linear-gradient(to right, #fef0f0, #fff);
      }

      &.info {
        border-left: 4px solid #409eff;
        background: linear-gradient(to right, #ecf5ff, #fff);
      }

      p {
        margin: 0 0 12px;
        line-height: 1.7;
        color: $text-secondary;

        &:last-child {
          margin-bottom: 0;
        }

        strong {
          color: $text-primary;
        }
      }
    }

    .reason-list {
      display: flex;
      flex-direction: column;
      gap: 16px;

      .reason-item {
        display: flex;
        align-items: flex-start;
        gap: 16px;
        padding: 20px;
        background: white;
        border-radius: 12px;
        border: 1px solid $border-color;

        .reason-icon {
          flex-shrink: 0;
          width: 40px;
          height: 40px;
          border-radius: 10px;
          background: linear-gradient(135deg, #667eea 0%, #764ba2 100%);
          display: flex;
          align-items: center;
          justify-content: center;
          color: white;
          font-size: 18px;
        }

        .reason-content {
          h4 {
            margin: 0 0 8px;
            font-size: 16px;
            font-weight: 600;
            color: $text-primary;
          }

          p {
            margin: 0;
            font-size: 14px;
            line-height: 1.7;
            color: $text-secondary;
          }
        }
      }
    }
  }

  .goals-section {
    .goals-grid {
      display: grid;
      grid-template-columns: repeat(2, 1fr);
      gap: 20px;

      .goal-card {
        background: white;
        border-radius: 12px;
        padding: 24px;
        border: 1px solid $border-color;
        box-shadow: 0 2px 12px rgba(0,0,0,0.04);

        .goal-num {
          font-size: 32px;
          font-weight: 700;
          color: $primary-color;
          opacity: 0.3;
          margin-bottom: 12px;
        }

        h4 {
          margin: 0 0 12px;
          font-size: 16px;
          font-weight: 600;
          color: $text-primary;
        }

        p {
          margin: 0;
          font-size: 14px;
          line-height: 1.7;
          color: $text-secondary;
        }
      }
    }
  }

  .principles-section {
    .principles-list {
      display: grid;
      grid-template-columns: repeat(2, 1fr);
      gap: 20px;

      .principle-item {
        display: flex;
        align-items: flex-start;
        gap: 16px;
        padding: 20px;
        background: white;
        border-radius: 12px;
        border: 1px solid $border-color;

        .principle-icon {
          flex-shrink: 0;
          width: 40px;
          height: 40px;
          border-radius: 10px;
          background: linear-gradient(135deg, #30cfd0 0%, #330867 100%);
          display: flex;
          align-items: center;
          justify-content: center;
          color: white;
          font-size: 18px;
        }

        .principle-content {
          h4 {
            margin: 0 0 8px;
            font-size: 15px;
            font-weight: 600;
            color: $text-primary;
          }

          p {
            margin: 0;
            font-size: 13px;
            line-height: 1.7;
            color: $text-secondary;
          }
        }
      }
    }
  }

  .solution-section {
    .solution-content {
      display: flex;
      flex-direction: column;
      gap: 20px;

      .solution-item {
        padding: 20px 24px;
        background: white;
        border-radius: 12px;
        border: 1px solid $border-color;

        h4 {
          margin: 0 0 12px;

          .solution-tag {
            display: inline-block;
            padding: 4px 12px;
            background: linear-gradient(135deg, #667eea 0%, #764ba2 100%);
            color: white;
            font-size: 14px;
            font-weight: 600;
            border-radius: 6px;
          }
        }

        p {
          margin: 0;
          font-size: 14px;
          line-height: 1.8;
          color: $text-secondary;

          code {
            background: #f5f7fa;
            padding: 2px 6px;
            border-radius: 4px;
            font-family: 'Courier New', monospace;
            font-size: 13px;
            color: #e83e8c;
          }
        }
      }
    }
  }
}

.section-title {
  display: flex;
  align-items: center;
  gap: 12px;
  font-size: 28px;
  font-weight: 600;
  margin: 0 0 32px;
  color: $text-primary;

  .title-icon {
    width: 40px;
    height: 40px;
    display: flex;
    align-items: center;
    justify-content: center;
    background: linear-gradient(135deg, #667eea 0%, #764ba2 100%);
    border-radius: 12px;
    color: white;
    font-size: 18px;
  }
}

// Features Grid
.features-grid {
  display: grid;
  grid-template-columns: repeat(3, 1fr);
  gap: 24px;

  .feature-card {
    background: white;
    border-radius: 16px;
    padding: 32px;
    box-shadow: 0 4px 20px rgba(0,0,0,0.04);
    border: 1px solid $border-color;
    transition: all 0.3s ease;

    &:hover {
      transform: translateY(-4px);
      box-shadow: 0 12px 40px rgba(0,0,0,0.08);
    }

    .feature-icon {
      width: 56px;
      height: 56px;
      border-radius: 16px;
      display: flex;
      align-items: center;
      justify-content: center;
      font-size: 24px;
      color: white;
      margin-bottom: 20px;

      &.blue { background: $gradient-blue; }
      &.purple { background: $gradient-purple; }
      &.green { background: $gradient-green; }
      &.orange { background: $gradient-orange; }
      &.cyan { background: $gradient-cyan; }
      &.pink { background: $gradient-pink; }
    }

    .feature-title {
      font-size: 18px;
      font-weight: 600;
      margin: 0 0 12px;
      color: $text-primary;
    }

    .feature-desc {
      font-size: 14px;
      color: $text-secondary;
      margin: 0;
      line-height: 1.7;
    }
  }
}

// Components List
.components-list {
  display: flex;
  flex-direction: column;
  gap: 24px;
}

.component-card {
  background: white;
  border-radius: 16px;
  padding: 32px;
  box-shadow: 0 4px 20px rgba(0,0,0,0.04);
  border: 1px solid $border-color;

  .comp-header {
    display: flex;
    align-items: center;
    gap: 16px;
    margin-bottom: 16px;

    .comp-icon {
      width: 48px;
      height: 48px;
      border-radius: 12px;
      display: flex;
      align-items: center;
      justify-content: center;
      font-size: 20px;
      color: white;

      &.blue { background: $gradient-blue; }
      &.purple { background: $gradient-purple; }
      &.green { background: $gradient-green; }
    }

    .comp-info {
      .comp-name {
        font-size: 20px;
        font-weight: 600;
        margin: 0 0 4px;
        color: $text-primary;
      }

      .comp-tag {
        font-size: 13px;
        color: $primary-color;
        background: rgba(64, 158, 255, 0.1);
        padding: 2px 10px;
        border-radius: 50px;
        display: inline-block;
        margin: 0;
      }
    }
  }

  .comp-desc {
    font-size: 15px;
    color: $text-secondary;
    margin: 0 0 20px;
    line-height: 1.7;
  }

  .comp-features {
    display: grid;
    grid-template-columns: repeat(2, 1fr);
    gap: 12px 24px;
    margin: 0;
    padding: 0;
    list-style: none;

    li {
      display: flex;
      align-items: center;
      gap: 8px;
      font-size: 14px;
      color: $text-secondary;

      i {
        color: #52c41a;
        font-size: 14px;
        font-weight: bold;
      }
    }
  }
}

// Compatibility Cards
.compat-cards {
  display: flex;
  gap: 24px;

  .compat-item {
    flex: 1;
    display: flex;
    align-items: center;
    gap: 16px;
    padding: 24px;
    background: white;
    border-radius: 16px;
    box-shadow: 0 4px 20px rgba(0,0,0,0.04);
    border: 1px solid $border-color;
    transition: all 0.3s ease;

    &:hover {
      transform: translateY(-2px);
      box-shadow: 0 8px 30px rgba(0,0,0,0.08);
    }

    .compat-icon {
      width: 48px;
      height: 48px;
      border-radius: 12px;
      display: flex;
      align-items: center;
      justify-content: center;
      font-size: 20px;
      color: white;

      &.vue { background: linear-gradient(135deg, #41b883 0%, #34495e 100%); }
      &.element { background: linear-gradient(135deg, #409eff 0%, #67c23a 100%); }
      &.browser { background: linear-gradient(135deg, #ff6b6b 0%, #feca57 100%); }
    }

    .compat-info {
      .compat-name {
        font-size: 16px;
        font-weight: 600;
        color: $text-primary;
        margin: 0 0 4px;
      }

      .compat-version {
        font-size: 14px;
        color: $text-tertiary;
      }
    }
  }
}

// Version Timeline
.version-timeline {
  position: relative;
  padding-left: 32px;

  &::before {
    content: '';
    position: absolute;
    left: 8px;
    top: 8px;
    bottom: 8px;
    width: 2px;
    background: linear-gradient(to bottom, #667eea, #764ba2);
    border-radius: 1px;
  }

  .timeline-item {
    position: relative;
    padding-bottom: 32px;

    &:last-child {
      padding-bottom: 0;
    }

    .timeline-dot {
      position: absolute;
      left: -28px;
      top: 4px;
      width: 16px;
      height: 16px;
      background: white;
      border: 3px solid #667eea;
      border-radius: 50%;
      box-shadow: 0 0 0 4px rgba(102, 126, 234, 0.1);
    }

    .timeline-content {
      background: white;
      border-radius: 12px;
      padding: 20px 24px;
      box-shadow: 0 2px 12px rgba(0,0,0,0.04);
      border: 1px solid $border-color;

      .version-header {
        display: flex;
        align-items: center;
        gap: 12px;
        margin-bottom: 8px;

        .version-tag {
          font-size: 16px;
          font-weight: 600;
          color: $primary-color;
          background: rgba(64, 158, 255, 0.1);
          padding: 4px 12px;
          border-radius: 8px;
        }

        .version-date {
          font-size: 14px;
          color: $text-tertiary;
        }
      }

      .version-desc {
        margin: 0;
        font-size: 14px;
        color: $text-secondary;
        line-height: 1.7;
      }
    }
  }
}

// CTA Section
.cta-section {
  margin-top: 80px;
  padding: 60px;
  background: linear-gradient(135deg, #667eea 0%, #764ba2 100%);
  border-radius: 20px;
  text-align: center;
  color: white;
  position: relative;
  overflow: hidden;

  &::before {
    content: '';
    position: absolute;
    top: -50%;
    left: -20%;
    width: 500px;
    height: 500px;
    background: radial-gradient(circle, rgba(255,255,255,0.1) 0%, transparent 70%);
  }

  .cta-content {
    position: relative;
    z-index: 1;

    h2 {
      font-size: 32px;
      font-weight: 700;
      margin: 0 0 12px;
    }

    p {
      font-size: 16px;
      opacity: 0.9;
      margin: 0 0 28px;
    }

    .cta-btn {
      display: inline-flex;
      align-items: center;
      gap: 8px;
      padding: 14px 32px;
      background: white;
      color: #667eea;
      font-size: 16px;
      font-weight: 600;
      border-radius: 50px;
      text-decoration: none;
      transition: all 0.3s ease;
      box-shadow: 0 4px 20px rgba(0,0,0,0.15);

      &:hover {
        transform: translateY(-2px);
        box-shadow: 0 8px 30px rgba(0,0,0,0.2);
      }

      i {
        font-size: 18px;
      }
    }
  }
}

// Responsive Design
@media (max-width: 992px) {
  .features-grid {
    grid-template-columns: repeat(2, 1fr);
  }

  .hero-section .hero-stats {
    gap: 40px;
  }
}

@media (max-width: 768px) {
  .intro-page {
    padding: 20px 16px;
  }

  .hero-section {
    padding: 40px 20px;

    .hero-title {
      font-size: 36px;

      .title-sub {
        font-size: 18px;
      }
    }

    .hero-stats {
      flex-direction: column;
      gap: 24px;
    }
  }

  .features-grid {
    grid-template-columns: 1fr;
  }

  .philosophy-section {
    .components-grid,
    .goals-grid,
    .principles-list {
      grid-template-columns: 1fr;
    }

    .reason-item,
    .principle-item {
      flex-direction: column;
      align-items: flex-start !important;
    }
  }

  .component-card .comp-features {
    grid-template-columns: 1fr;
  }

  .compat-cards {
    flex-direction: column;
  }

  .cta-section {
    padding: 40px 24px;
    margin-top: 40px;
  }
}
</style>
