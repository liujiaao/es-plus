import { readFileSync, writeFileSync } from 'node:fs'
const f = 'es-eui/src/views/cases.vue'
let s = readFileSync(f, 'utf8')
const before = `  methods: {
    circled(n) {`
const after = `  methods: {
    // 模块级导入的函数在 Vue 2 模板里同样访问不到（与 SITE_KEY 同一根因）——
    // 必须挂到实例上。该函数是纯函数、不依赖 this，直接简写挂载即可。
    crossSiteUrl,
    circled(n) {`
if (!s.includes(before)) throw new Error('未匹配 methods 段')
writeFileSync(f, s.replace(before, after))
console.log('  ✅ 已把 crossSiteUrl 挂到实例')
