import Vue from 'vue'
import Vuex from 'vuex'

Vue.use(Vuex)

export default new Vuex.Store({
  state: {
    theme: 'light'
  },
  mutations: {
    SET_THEME(state, theme) {
      state.theme = theme
    }
  },
  actions: {
    setTheme({ commit }, theme) {
      commit('SET_THEME', theme)
    }
  }
})
