import axiosInstance from '../config/axios';

const graduateService = {
  getProfile: async () => {
    const response = await axiosInstance.get('/graduate/profile');
    return response.data;
  },

  saveStep: async (stepData) => {
    const response = await axiosInstance.post('/graduate/profile/step', stepData);
    return response.data;
  },

  completeOnboarding: async (data = {}) => {
    const response = await axiosInstance.post('/graduate/onboarding', data);
    return response.data;
  },

  getDashboard: async () => {
    const response = await axiosInstance.get('/graduate/dashboard');
    return response.data;
  },

  getOpportunities: async (category = 'ALL', search = '') => {
    const response = await axiosInstance.get('/graduate/opportunities', {
      params: { category, search }
    });
    return response.data;
  },

  getOpportunityById: async (id) => {
    const response = await axiosInstance.get(`/graduate/opportunities/${id}`);
    return response.data;
  },

  getGovernmentExams: async () => {
    const response = await axiosInstance.get('/graduate/government-exams');
    return response.data;
  },

  getHigherStudies: async () => {
    const response = await axiosInstance.get('/graduate/higher-studies');
    return response.data;
  },

  getApplications: async () => {
    const response = await axiosInstance.get('/graduate/applications');
    return response.data;
  },

  saveApplication: async (data) => {
    const response = await axiosInstance.post('/graduate/applications', data);
    return response.data;
  },

  setReminder: async (opportunityId) => {
    const response = await axiosInstance.post(`/graduate/opportunities/${opportunityId}/reminder`);
    return response.data;
  },

  refreshResearch: async (query = '') => {
    const response = await axiosInstance.post('/graduate/research/refresh', { query });
    return response.data;
  },

  getMentorRequests: async () => {
    const response = await axiosInstance.get('/graduate/mentor/requests');
    return response.data;
  },

  acceptMentorRequest: async (id) => {
    const response = await axiosInstance.post(`/graduate/mentor/requests/${id}/accept`);
    return response.data;
  },

  rejectMentorRequest: async (id) => {
    const response = await axiosInstance.post(`/graduate/mentor/requests/${id}/reject`);
    return response.data;
  },

  getActiveMentees: async () => {
    const response = await axiosInstance.get('/graduate/mentor/mentees');
    return response.data;
  },

  getRelationshipMessages: async (id) => {
    const response = await axiosInstance.get(`/graduate/mentor/relationships/${id}/messages`);
    return response.data;
  },

  sendRelationshipMessage: async (id, content) => {
    const response = await axiosInstance.post(`/graduate/mentor/relationships/${id}/messages`, { content });
    return response.data;
  },

  getMentorProfile: async () => {
    const response = await axiosInstance.get('/graduate/mentor/profile');
    return response.data;
  },

  updateMentorProfile: async (data) => {
    const response = await axiosInstance.put('/graduate/mentor/profile', data);
    return response.data;
  },

  getRoadmap: async () => {
    const response = await axiosInstance.get('/graduate/roadmap');
    return response.data;
  },

  getNotifications: async () => {
    const response = await axiosInstance.get('/graduate/notifications');
    return response.data;
  },

  getRecommendations: async () => {
    const response = await axiosInstance.get('/graduate/recommendations');
    return response.data;
  },

  chatAdvisor: async (payload) => {
    const response = await axiosInstance.post('/graduate/advisor/chat', payload);
    return response.data;
  },

  // ── Exam Intelligence & Exam-Specific Study Roadmap ───────────────────────
  getExams: async (category = 'ALL', search = '') => {
    const response = await axiosInstance.get('/graduate/exams', {
      params: { category, search }
    });
    return response.data;
  },

  getExamById: async (examId) => {
    const response = await axiosInstance.get(`/graduate/exams/${examId}`);
    return response.data;
  },

  getExamPattern: async (examId) => {
    const response = await axiosInstance.get(`/graduate/exams/${examId}/pattern`);
    return response.data;
  },

  getExamSyllabus: async (examId) => {
    const response = await axiosInstance.get(`/graduate/exams/${examId}/syllabus`);
    return response.data;
  },

  getExamPapers: async (examId) => {
    const response = await axiosInstance.get(`/graduate/exams/${examId}/papers`);
    return response.data;
  },

  researchExam: async (examId) => {
    const response = await axiosInstance.post(`/graduate/exams/${examId}/research`);
    return response.data;
  },

  getStudyPlan: async (examId) => {
    const response = await axiosInstance.get(`/graduate/exams/${examId}/study-plan`);
    return response.data;
  },

  saveStudyPlan: async (examId, data = {}) => {
    const response = await axiosInstance.post(`/graduate/exams/${examId}/study-plan`, data);
    return response.data;
  },

  getExamProgress: async (examId) => {
    const response = await axiosInstance.get(`/graduate/exams/${examId}/progress`);
    return response.data;
  },

  recordTopicProgress: async (examId, topicId, data = {}) => {
    const response = await axiosInstance.post(`/graduate/exams/${examId}/topic/${topicId}/progress`, data);
    return response.data;
  },

  submitMockTest: async (examId, data = {}) => {
    const response = await axiosInstance.post(`/graduate/exams/${examId}/mock/submit`, data);
    return response.data;
  }
};

export default graduateService;
