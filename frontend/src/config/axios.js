import axios from 'axios'
import { API_BASE_URL } from './apiConfig'

const axiosInstance = axios.create({
  baseURL: API_BASE_URL,
  headers: {
    'Content-Type': 'application/json'
  }
})

axiosInstance.interceptors.request.use(
  (config) => {
    // Context URL helps us determine which token to attach if both exist.
    const isClientAdmin = window.location.pathname.startsWith('/admin')
    const isAdminRoute = (config.url && config.url.startsWith('/admin')) || isClientAdmin
    const adminToken = localStorage.getItem('adminToken')
    const studentToken = localStorage.getItem('studentToken')

    // Choose token contextually. Admin token takes precedence for admin routes/panels
    if (isAdminRoute && adminToken) {
      config.headers.Authorization = `Bearer ${adminToken}`
    } else if (!isAdminRoute && studentToken) {
      config.headers.Authorization = `Bearer ${studentToken}`
    } else if (adminToken) {
      config.headers.Authorization = `Bearer ${adminToken}`
    } else if (studentToken) {
      config.headers.Authorization = `Bearer ${studentToken}`
    }

    return config
  },
  (error) => {
    return Promise.reject(error)
  }
)

axiosInstance.interceptors.response.use(
  (response) => response,
  (error) => {
    if (error.response?.status === 401) {
      // Determine context and redirect properly
      if (window.location.pathname.startsWith('/admin')) {
        localStorage.removeItem('adminToken')
        window.location.href = '/login'
      } else {
        localStorage.removeItem('studentToken')
        window.location.href = '/student/login'
      }
    }
    return Promise.reject(error)
  }
)

export default axiosInstance
