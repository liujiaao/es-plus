const path = require('path')
const { defineConfig } = require('@vue/cli-service')

module.exports = defineConfig({
    publicPath: process.env.PUBLIC_PATH || (process.env.NODE_ENV === 'production' ? '/es-eui/' : '/'),
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
                '@vue/composition-api': path.resolve(__dirname, 'node_modules/@vue/composition-api')
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