<template>
  <div class="not-found">
    <div class="not-found-content">
      <h1>404</h1>
      <p>页面不存在</p>
      <router-link to="/" class="back-home">返回首页</router-link>
    </div>
  </div>
</template>

<style scoped>
.not-found {
  display: flex;
  align-items: center;
  justify-content: center;
  min-height: 60vh;
  text-align: center;
}

.not-found-content h1 {
  font-size: 80px;
  font-weight: 700;
  color: var(--el-color-primary);
  margin: 0;
  line-height: 1;
}

.not-found-content p {
  font-size: 18px;
  color: var(--el-text-color-secondary);
  margin: 16px 0 32px;
}

.back-home {
  display: inline-block;
  padding: 10px 24px;
  background: var(--el-color-primary);
  color: #fff;
  border-radius: 6px;
  text-decoration: none;
  font-size: 14px;
  transition: opacity 0.2s;
}

.back-home:hover {
  opacity: 0.85;
}
</style>
