
<template>
  <div class="code-block">
    <div class="code-block__body">
      <slot name="demo"></slot>
    </div>
    <div class="code-block__code">
      <pre><code>{{ code }}</code></pre>
    </div>
  </div>
</template>

<script>
export default {
  name: 'CodeBlock',
  props: {
    code: {
      type: String,
      required: true
    }
  }
}
</script>

<style scoped>
.code-block {
  border: 1px solid #ebeef5;
  border-radius: 4px;
  margin: 20px 0;
  overflow: hidden;
}

.code-block__body {
  padding: 20px;
  background: #fff;
}

.code-block__code {
  padding: 20px;
  background: #f5f7fa;
