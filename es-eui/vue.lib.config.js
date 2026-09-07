const path = require('path')

module.exports = {
    transpileDependencies: true,
    lintOnSave: false,
    productionSourceMap: false,

    outputDir: 'dist',

    configureWebpack: {
        output: {
            libraryExport: 'default'
        },
        externals: {
            vue: {
                root: 'Vue',
                commonjs: 'vue',
                commonjs2: 'vue',
                amd: 'vue'
            },
            'element-ui': {
                root: 'ELEMENT',
                commonjs: 'element-ui',
                commonjs2: 'element-ui',
                amd: 'element-ui'
            }
        }
    },

    css: {
        extract: true
    },

    chainWebpack: config => {
        // 删除 prefetch 插件
        config.plugins.delete('prefetch')

        // 删除 preload 插件
        config.plugins.delete('preload')

        // 删除 html 插件
        config.plugins.delete('html')
        config.plugins.delete('html-index')

        // 配置 resolve 别名
        config.resolve.alias
            .set('@', path.resolve(__dirname, 'src'))
            .set('@components', path.resolve(__dirname, 'src/components'))
            .set('@utils', path.resolve(__dirname, 'src/utils'))
            .set('@views', path.resolve(__dirname, 'src/views'))
            .set('@assets', path.resolve(__dirname, 'src/assets'))
            .set('@store', path.resolve(__dirname, 'src/store'))
    }
}
