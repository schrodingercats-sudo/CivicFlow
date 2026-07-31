import { apiRequest } from './api';

export const notificationService = {
  getNotifications: async () => {
    return await apiRequest('/notifications');
  },

  markAsRead: async (id) => {
    return await apiRequest(`/notifications/${id}/read`, { method: 'PATCH' });
  },

  markAllAsRead: async () => {
    return await apiRequest('/notifications/read-all', { method: 'PATCH' });
  },

  getNtfyTopics: async () => {
    return await apiRequest('/notifications/ntfy-topics');
  }
};
