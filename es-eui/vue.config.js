const path = require('path')
const { execFileSync } = require('child_process')
const { defineConfig } = require('@vue/cli-service')

/**
 * 「最后更新」的数据源：与主站 / es-pc 同一份 scripts/doc-meta.mjs。
 *
 * 这里要多走一趟子进程：本配置是 CJS，而 doc-meta.mjs 是 ESM（另两站的 vite 配置
 * 直接 import 它），Node 20 的 require() 读不了 ESM。与其把页面→源文件映射抄成
 * 第二份 .cjs（那正是要根除的漂移），不如让脚本输出 JSON。
 * 取不到数据时返回空对象：页面只是不显示「最后更新」，不影响构建。
 */
function docMetaFor(site) {
    try {
        const out = execFileSync(
            process.execPath,
            [path.resolve(__dirname, '../scripts/doc-meta.mjs'), '--json', site],
            { encoding: 'utf8' }
        )
        return JSON.parse(out)
    } catch (err) {
        console.warn(`[doc-meta] 取不到 ${site} 的页面日期，构建继续：${err.message}`)
        return {}
    }
}

module.exports = defineConfig({
    publicPath: process.env.PUBLIC_PATH || '/',
    // 禁用转译依赖，避免 babel 处理大量文件导致内存溢出
    transpileDependencies: false,
    // 完全禁用 source map 以减少内存占用
    productionSourceMap: false,
    parallel: false, // 禁用多线程并行处理，减少内存占用
    configureWebpack: {
        // 开发环境下禁用 source map 以减少内存使用
        devtool: false,
        // 排除不需要解析的大型文件（Sortable.js 131KB，不需要 webpack 解析）
        module: {
            noParse: /Sortable\.js$/
        },
        resolve: {
            // monorepo 场景下 @es-plus/vue2 通过 npm workspaces 软链到 packages/vue2/，
            // 而 packages/vue2/node_modules 内还装了一份用于本地构建的 vue（devDep）。
            // 关闭 symlinks 让 webpack 把符号链接当成普通路径，并把 vue / element-ui
            // 显式 pin 到 es-eui/node_modules，避免 setup() 与 inject() 跑在两个 Vue 实例上
            // 引发 "inject() can only be used inside setup()" 的伪警告。
            symlinks: false,
            alias: {
                '@': path.resolve(__dirname, 'src'),
                vue$: path.resolve(__dirname, 'node_modules/vue'),
                'element-ui$': path.resolve(__dirname, 'node_modules/element-ui'),
                '@vue/composition-api': path.resolve(__dirname, 'node_modules/@vue/composition-api'),
                // es-plus 指向 monorepo 本地包（dist/build），避免解析到 node_modules 里
                // 已发布的陈旧副本。@es-plus/vue2 是 TS SFC 包，es-eui 无 TS loader，
                // 故只能用其构建产物；由 prebuild/preserve 的 build:esplus 保证产物新鲜。
                '@es-plus/vue2/dist/style.css$': path.resolve(__dirname, '../packages/vue2/dist/style.css'),
                '@es-plus/vue2$': path.resolve(__dirname, '../packages/vue2/dist/es-plus-vue2.js'),
                '@es-plus/core$': path.resolve(__dirname, '../packages/core/build/index.js')
            }
        }
    },
    lintOnSave: false,
    devServer: {
        port: 8080,
        open: true,
        // 限制并发连接数以减少内存使用
        hot: true,
        client: {
            overlay: false
        }
    },
    chainWebpack: config => {
        // 只在非库打包模式下配置 html 插件
        if (config.plugins.has('html')) {
            config.plugin('html').tap(args => {
                args[0].title = 'Vue2 Project Template'
                return args
            })
        }

        // 与 es-plus-docs / es-pc 同一份注入：页面底部「最后更新：YYYY-MM-DD」。
        // 走 define 而不是 fs 落一个 JSON 产物：日期随源码变更而变，落盘文件
        // 既会进 git 也会在两次构建之间过期。
        config.plugin('define').tap(args => {
            args[0].__ES_DOC_META__ = JSON.stringify(docMetaFor('es-eui'))
            return args
        })

        // 优化 babel-loader，减少内存使用
        config.module
            .rule('js')
            .use('babel-loader')
            .tap(options => ({
                ...options,
                cacheDirectory: true,
                cacheCompression: false
            }))

        // raw-loader 通过内联语法 !!raw-loader! 使用，无需额外 rule 配置
    }
})