import { apiRequest } from './api';

export const authService = {
  login: async (email) => {
    const data = await apiRequest('/auth/login', {
      method: 'POST',
      body: JSON.stringify({ email })
    });
    if (data.token) {
      localStorage.setItem('civicflow_token', data.token);
    }
    return data;
  },

  register: async (userData) => {
    const data = await apiRequest('/auth/register', {
      method: 'POST',
      body: JSON.stringify(userData)
    });
    if (data.token) {
      localStorage.setItem('civicflow_token', data.token);
    }
    return data;
  },

  getMe: async () => {
    return await apiRequest('/auth/me');
  },

  updateProfile: async (data) => {
    return await apiRequest('/auth/me', {
      method: 'PUT',
      body: JSON.stringify(data)
    });
  },

  logout: () => {
    localStorage.removeItem('civicflow_token');
  }
};
