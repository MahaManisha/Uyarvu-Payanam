import axiosInstance from '../../config/axios'

const higherStudiesService = {
  // Public: list published courses with search, filters, pagination
  list: async (params = {}) => {
    const response = await axiosInstance.get('/higher-studies', { params })
    return response.data
  },

  // Public: get one published course by ID
  getById: async (id) => {
    const response = await axiosInstance.get(`/higher-studies/${id}`)
    return response.data
  },

  // Save/bookmark a course
  save: async (contentId) => {
    const response = await axiosInstance.post('/user-actions/save', {
      contentId,
      contentType: 'HigherStudiesOpportunity',
    })
    return response.data
  },

  // Remove a saved course
  unsave: async (contentId) => {
    const response = await axiosInstance.delete(`/user-actions/unsave/${contentId}`)
    return response.data
  },

  // Get user's saved higher studies courses
  getSavedList: async () => {
    const response = await axiosInstance.get('/user-actions/saved-list', {
      params: { contentType: 'HigherStudiesOpportunity' },
    })
    return response.data
  },
}

export default higherStudiesService
