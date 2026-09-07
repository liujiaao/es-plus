import axios from 'axios'
import { Message, Notification } from 'element-ui'
import store from '@/store'
import routes from '@/router'
import { Loading } from 'element-ui';

// create an axios instance
const apiurl = process.env.VUE_APP_URL
const service = axios.create({
  baseURL: process.env.NODE_ENV === 'development' ? process.env.BASE_API : apiurl,
  contentType: 'application/json;charset=UTF-8',
  timeout: 60000,
  // withCredentials: true
})

// request interceptor
let loadingInstance = null
let errorInstance = null
service.interceptors.request.use(config => {
  if (config.isLoading) {
    loadingInstance = Loading.service({
      fullscreen: false,
      background: "rgba(0, 0, 0, 0.8)"
    });
  }
  errorInstance = config.showError
  return config
}, error => {
  console.log(error)
  return Promise.reject(error)
})

// respone interceptor
service.interceptors.response.use(
  response => {
    setTimeout(_ => {
      loadingInstance?.close && loadingInstance.close();
    }, 500)
    if (response.data.returncode === 'ERROR') {
      Notification.error({
        title: '操作失败',
        message: response.data.errormessage
      })
    }
    if (errorInstance) {
      if (response.data.code !== 0 && response.data.code !== 200) {
        Notification.warning({
          title: '操作失败',
          message: response.data.message || "服务错误"
        })
        return Promise.reject(response.data)
      }
    }
    return response
  },
  error => {
    loadingInstance?.close && loadingInstance.close();
    if (error && error.response) {
      if (error.response.status === 401) {
        // 401 错误处理 - 安全地检查 routes.app
        if (routes.app && routes.app.$router) {
          setTimeout(() => {
            if (store && store.commit) {
              store.commit('CLEAR_USER')
            }
            routes.app.$router.go(0)
          }, 1000)
        }
      } else if (error.response.status === 400) {
        Message({
          message: error.response.data.message || '请求参数错误',
          type: 'error',
          duration: 3 * 1000
        })
      } else if (error.response.status === 500) {
        Message({
          message: error.response.data.message || '服务器错误',
          type: 'error',
          duration: 3 * 1000
        })
      }
    }
    console.log('err:' + error)
    return Promise.reject(error)
  }
)

export default service
