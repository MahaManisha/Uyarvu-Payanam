import axiosInstance from '../config/axios'

/**
 * graduateExamService — single API client for the Graduate Exams module.
 * Shared by the admin panel (mutation + read) and the student Government
 * Career pages (read-only). The backend is the single source of truth.
 */
export const graduateExamService = {
  /* ── Organizations ─────────────────────────────────────────── */
  getOrganizations: async (params = {}) => {
    const response = await axiosInstance.get('/graduate-exams/organizations', { params })
    return response.data
  },
  getOrganization: async (id) => {
    const response = await axiosInstance.get(`/graduate-exams/organizations/${id}`)
    return response.data
  },
  createOrganization: async (data) => {
    const response = await axiosInstance.post('/graduate-exams/organizations', data)
    return response.data
  },
  updateOrganization: async (id, data) => {
    const response = await axiosInstance.put(`/graduate-exams/organizations/${id}`, data)
    return response.data
  },
  deleteOrganization: async (id) => {
    const response = await axiosInstance.delete(`/graduate-exams/organizations/${id}`)
    return response.data
  },

  /* ── Examinations ──────────────────────────────────────────── */
  getExams: async (params = {}) => {
    const response = await axiosInstance.get('/graduate-exams', { params })
    return response.data
  },
  getExam: async (idOrSlug) => {
    const response = await axiosInstance.get(`/graduate-exams/${idOrSlug}`)
    return response.data
  },
  createExam: async (data) => {
    const response = await axiosInstance.post('/graduate-exams', data)
    return response.data
  },
  updateExam: async (id, data) => {
    const response = await axiosInstance.put(`/graduate-exams/${id}`, data)
    return response.data
  },
  deleteExam: async (id) => {
    const response = await axiosInstance.delete(`/graduate-exams/${id}`)
    return response.data
  },
  /**
   * Run the Central Government sync (admin only). Fetches Central-only exams
   * from the EasyShiksha source and upserts them idempotently, returning
   * {success, source, totalFound, created, updated, unchanged, failed, lastChecked}.
   */
  syncCentralExams: async (params = {}) => {
    const response = await axiosInstance.post('/graduate-exams/central/sync', {}, { params })
    return response.data
  },
}