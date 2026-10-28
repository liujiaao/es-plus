/**
 * 代码高亮：只注册文档真正用到的语言。
 *
 * 此前两处都写着 `import hljs from 'highlight.js'`（本目录的 doc-markdown.mjs 与
 * CodePlayground.vue）—— 那是**全集**入口：190 种语言，连 mathematica（144KB）、
 * isbl（103KB）、gml（76KB）、sqf（57KB）、1c 都在里面。实测这一个 chunk
 * 311.4KB gzip，占文档路由首屏的 20%，而文档里真正出现的 fence 语言只有 11 种
 * （typescript / bash / vue / json / javascript / ts / diff / js / yaml / tsx / xml / jsonc）。
 *
 * 判据不是「这些大概够了」：scripts/check-bundle-sources.mjs 会把每一篇文档
 * markdown 过一遍 fence，逐个断言 getLanguage(lang) 非空；再断言注册语言总数
 * ≤ 40 —— 谁把 import 换回全集入口（190），那条立刻红。内容里第一次出现新语言时
 * 守卫也会红，在这里加一行 registerLanguage 即可。
 */
import hljs from 'highlight.js/lib/core'
import bash from 'highlight.js/lib/languages/bash'
import css from 'highlight.js/lib/languages/css'
import diff from 'highlight.js/lib/languages/diff'
import javascript from 'highlight.js/lib/languages/javascript'
import json from 'highlight.js/lib/languages/json'
import plaintext from 'highlight.js/lib/languages/plaintext'
import typescript from 'highlight.js/lib/languages/typescript'
import xml from 'highlight.js/lib/languages/xml'
import yaml from 'highlight.js/lib/languages/yaml'

hljs.registerLanguage('bash', bash) // 自带 sh / zsh 别名
hljs.registerLanguage('css', css)
hljs.registerLanguage('diff', diff)
hljs.registerLanguage('javascript', javascript) // 自带 js / jsx 别名
hljs.registerLanguage('json', json)
hljs.registerLanguage('plaintext', plaintext) // 自带 text / txt 别名（CodePlayground 的兜底）
hljs.registerLanguage('typescript', typescript) // 自带 ts / tsx 别名
hljs.registerLanguage('xml', xml) // 自带 html / svg 别名
hljs.registerLanguage('yaml', yaml)

// 文档里的 ```vue 是 SFC：≈ HTML 模板 + 内嵌脚本/样式，用 xml 定义着色
// （highlight.js 的 common bundle 也不含 vue，这里显式挂一个同名语言）
hljs.registerLanguage('vue', xml)
// ```jsonc 是带注释的 JSON：json 定义已覆盖（非法字符由调用侧的 ignoreIllegals 容忍）
hljs.registerLanguage('jsonc', json)

export default hljs
export { hljs }
