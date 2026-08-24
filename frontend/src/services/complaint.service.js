import { apiRequest } from './api';

export const complaintService = {
  createComplaint: async (complaintData) => {
    return await apiRequest('/complaints', {
      method: 'POST',
      body: JSON.stringify(complaintData)
    });
  },

  getComplaints: async (params = {}) => {
    const query = new URLSearchParams(params).toString();
    return await apiRequest(`/complaints${query ? `?${query}` : ''}`);
  },

  getComplaintById: async (id) => {
    return await apiRequest(`/complaints/${id}`);
  },

  updateStatus: async (id, statusData) => {
    return await apiRequest(`/complaints/${id}/status`, {
      method: 'PATCH',
      body: JSON.stringify(statusData)
    });
  },

  withdrawComplaint: async (id, reason) => {
    return await apiRequest(`/complaints/${id}/withdraw`, {
      method: 'POST',
      body: JSON.stringify({ reason })
    });
  },

  rateComplaint: async (id, ratingData) => {
    return await apiRequest(`/complaints/${id}/rating`, {
      method: 'POST',
      body: JSON.stringify(ratingData)
    });
  },

  getDepartments: async () => {
    return await apiRequest('/departments');
  },

  getAdminStats: async () => {
    return await apiRequest('/analytics/summary');
  },

  deleteComplaint: async (id) => {
    return await apiRequest(`/complaints/${id}`, { method: 'DELETE' });
  }
};
