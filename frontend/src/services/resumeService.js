import axiosInstance from '../config/axios'

const resumeService = {
  getDefault: async () => (await axiosInstance.get('/graduate/resume/default')).data,
  generate: async (payload) => (await axiosInstance.post('/graduate/resume/generate', payload)).data,
  analyzeAts: async (payload) => (await axiosInstance.post('/graduate/resume/ats', payload)).data,
  readiness: async (payload) => (await axiosInstance.post('/graduate/resume/readiness', payload)).data,
  list: async () => (await axiosInstance.get('/graduate/resumes')).data,
  create: async (payload) => (await axiosInstance.post('/graduate/resumes', payload)).data,
  get: async (id) => (await axiosInstance.get(`/graduate/resumes/${id}`)).data,
  update: async (id, payload) => (await axiosInstance.put(`/graduate/resumes/${id}`, payload)).data,
  remove: async (id) => (await axiosInstance.delete(`/graduate/resumes/${id}`)).data,
}

export default resumeService
