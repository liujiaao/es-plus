import axios from 'axios'
import { Message, Notification } from 'element-ui'
import store from '@/store'
import routes from '@/router'
const checkURL = (URL) => {
  let str = URL
  if (str === null) {
    return null
  }
  // 在JavaScript中，正则表达式只能使用"/"开头和结束，不能使用双引号
  let Expression = /http(s)?://// ([\w-]+\.)+[\w-]+(\/[\w- .\/?%&=]*)?/
  let objExp = new RegExp(Expression)
  if (str.indexOf('localhost')) {
    str = str.replace('localhost","127.0.0.1')
  }
  if (objExp.test(str) === true) {
    return true
  } else {
    return false
  }
}
console.log('process.env.BASE_URL', process.env.BASE_API)
const service = axios.create({
  baseURL: checkURL(process.env.BASE_API) ? process.env.BASE_API : 'https://dfac-wx.dfwxfw.com', // api的base_url
  contentType: 'application/json;charset=UTF-8',
  timeout: 10000 // request timeout
//  withCredentials: false
})
service.interceptors.request.use(config => {
  // Do something before request is sent
  // let token = store.state.userLogin.acToken ? store.state.userLogin.acToken : false
  // if(token && !config.headers.Authorization) {
  //   config.headers['Authorization'] = 'Bearer ' + token   // 让每个请求携带token-- ['X-Token']为自定义key 请根据实际情况自行修改
  // }
  return config
}, error => {
  // Do something with request error
  Promise.reject(error)
})

// respone interceptor
service.interceptors.response.use(
  response => {
    if (response.data.code === -1 && response.data.code) {
      Notification.error({
        title: '操作失败',
        message: response.data.message
      })
    }
    return response
  },

  error => {
    console.log('err' + error)// for debug
    if (error && error.response) {
      if (error.response.data.error === 'Unauthorized' || error.response.data.error === 'invalid_grant') {
        Notification.error({
          title: '提示',
          type: 'warning',
          message: '用户名或密码错误'
        })
      } else if (error.response.data.error === 'invalid_token') {
        Notification.error({
          title: '提示',
          message: 'token已失效或过期，请重新登录'
        })
        setTimeout(() => {
          store.commit('CLEAR_USER')
          routes.app.$router.go(0)
        }, 1000)
      } else {
        Message({
          message: error.message,
          type: 'error',
          duration: 5 * 1000
        })
      }
    } else {
      console.log("$$$$$$$",error.response.status)
      Message({
        message: '服务响应繁忙,请稍后刷新重试',
        type: 'warning',
        duration: 5 * 1000
      })
    }
    return Promise.reject(error)
  })

export default service
