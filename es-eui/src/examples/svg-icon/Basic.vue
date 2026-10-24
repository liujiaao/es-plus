<template>
  <div class="si-workbench">
    <!--
      演示用雪碧图：真实项目里由 svg-sprite-loader 在构建时注入，这里内联一份 <symbol>，
      保证示例在任何环境（含离线）都能直接跑。容器用 width/height:0 + overflow:hidden 藏起来 ——
      display:none 在部分浏览器里会让 <use> 引用失效。
    -->
    <svg class="si-sprite" aria-hidden="true" focusable="false">
      <symbol id="icon-es-bolt" viewBox="0 0 24 24">
        <path d="M13 2 4 14h6l-1 8 9-12h-6z" />
      </symbol>
      <symbol id="icon-es-heart" viewBox="0 0 24 24">
        <path d="M12 21s-7-4.6-9.3-8.5A5.3 5.3 0 0 1 12 6.2a5.3 5.3 0 0 1 9.3 6.3C19 16.4 12 21 12 21z" />
      </symbol>
      <symbol id="icon-es-grid" viewBox="0 0 24 24">
        <path d="M3 3h7v7H3zM14 3h7v7h-7zM3 14h7v7H3zM14 14h7v7h-7z" />
      </symbol>
    </svg>

    <div class="si-row">
      <span class="si-label">尺寸 = 字号</span>
      <svg-icon icon-class="es-bolt" data-testid="icon-16" style="font-size: 16px" />
      <svg-icon icon-class="es-bolt" data-testid="icon-24" style="font-size: 24px" />
      <svg-icon icon-class="es-bolt" data-testid="icon-32" style="font-size: 32px" />
      <svg-icon icon-class="es-bolt" data-testid="icon-48" style="font-size: 48px" />
      <span class="si-hint">宽高都是 1em，字号多大图标就多大</span>
    </div>

    <div class="si-row">
      <span class="si-label">颜色 = currentColor</span>
      <svg-icon icon-class="es-heart" data-testid="icon-red" style="font-size: 28px; color: #f56c6c" />
      <svg-icon icon-class="es-heart" data-testid="icon-green" style="font-size: 28px; color: #67c23a" />
      <svg-icon icon-class="es-heart" data-testid="icon-blue" style="font-size: 28px; color: #409eff" />
      <el-button size="mini" type="primary">
        <svg-icon icon-class="es-heart" style="margin-right: 4px" />放在按钮里
      </el-button>
      <span class="si-hint">fill: currentColor —— 放进按钮/标签就自动跟随主题与禁用态</span>
    </div>

    <div class="si-row">
      <span class="si-label">className 追加类名</span>
      <svg-icon icon-class="es-grid" class-name="si-badge" data-testid="icon-badge" style="font-size: 26px" />
      <span class="si-hint">className="si-badge" 追加到根节点，装饰性样式不必改组件</span>
    </div>

    <div class="si-row">
      <span class="si-label">外部图片模式</span>
      <svg-icon :icon-class="externalUrl" class-name="si-external" data-testid="icon-external" style="font-size: 32px; color: #409eff" />
      <code class="si-url">{{ externalUrl }}</code>
    </div>

    <p class="si-note">
      <code>iconClass</code> 不以协议开头时渲染 <code>&lt;svg&gt;&lt;use xlink:href="#icon-{iconClass}"&gt;</code>，
      图标本体来自页面里的雪碧图；以 <code>http(s):</code> / <code>mailto:</code> / <code>tel:</code> / <code>open</code>
      开头时切到外部图片模式（mask 染成 currentColor）。大小、颜色、附加类名三件事全部由宿主决定，
      组件只负责输出那一个 <code>1em</code> 的图标。
    </p>
  </div>
</template>

<script>
export default {
  name: 'SvgIconBasic',
  data() {
    return {
      // 外部图片模式要求 iconClass 以协议开头，所以这里取「本站绝对地址」——
      // 文件来自 public/icons/star-badge.svg（构建时原样拷进产物根目录）。
      externalUrl: `${window.location.origin}${process.env.BASE_URL}icons/star-badge.svg`,
    }
  },
}
</script>

<style>
/* 案例内类名统一 si- 前缀，避免污染全局 */
.si-workbench {
  border: 1px solid #ebeef5;
  border-radius: 8px;
  padding: 12px;
}
.si-sprite {
  position: absolute;
  width: 0;
  height: 0;
  overflow: hidden;
}
.si-row {
  display: flex;
  flex-wrap: wrap;
  align-items: center;
  gap: 10px 14px;
  padding: 10px 0;
  border-bottom: 1px dashed #f2f3f5;
}
.si-row:last-of-type {
  border-bottom: 0;
}
.si-label {
  width: 128px;
  flex: none;
  font-size: 12px;
  color: #909399;
}
.si-hint {
  font-size: 12px;
  color: #909399;
}
.si-badge {
  padding: 0.3em;
  border-radius: 50%;
  color: #409eff;
  background: #ecf5ff;
  box-sizing: content-box;
}
.si-url {
  font-size: 11px;
  color: #909399;
  font-family: 'Fira Code', monospace;
  word-break: break-all;
}
.si-note {
  margin: 10px 0 0;
  font-size: 12px;
  line-height: 1.8;
  color: #909399;
}
.si-note code {
  background: #f5f5f5;
  padding: 1px 5px;
  border-radius: 3px;
  font-family: 'Fira Code', monospace;
  color: #d63384;
}
</style>
