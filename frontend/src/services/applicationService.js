import axiosInstance from '../config/axios'

const applicationService = {
  list: async (status) => {
    const response = await axiosInstance.get('/applications', { params: status ? { status } : {} })
    return response.data
  },
  create: async (payload) => {
    const response = await axiosInstance.post('/applications', payload)
    return response.data
  },
  update: async (id, patch) => {
    const response = await axiosInstance.put(`/applications/${id}`, patch)
    return response.data
  },
  remove: async (id) => {
    const response = await axiosInstance.delete(`/applications/${id}`)
    return response.data
  },
}

export default applicationService
