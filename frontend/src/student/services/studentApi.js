import axios from 'axios'
import { API_BASE_URL } from '../../config/apiConfig'

const studentApi = axios.create({
  baseURL: API_BASE_URL,
  timeout: 15000,
})

studentApi.interceptors.request.use((config) => {
  const token = localStorage.getItem('studentToken')
  if (token) config.headers.Authorization = `Bearer ${token}`
  return config
})

studentApi.interceptors.response.use(
  (res) => res,
  (err) => {
    if (err.response?.status === 401) {
      localStorage.removeItem('studentToken')
      localStorage.removeItem('studentData')
      window.location.href = '/student/signin'
    }
    return Promise.reject(err)
  }
)

export default studentApi
