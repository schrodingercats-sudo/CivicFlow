const API_BASE_URL = import.meta.env.VITE_API_URL || '/api/v1';

export const apiRequest = async (endpoint, options = {}) => {
  const token = localStorage.getItem('civicflow_token');
  
  const headers = {
    'Content-Type': 'application/json',
    ...(token && { Authorization: `Bearer ${token}` }),
    ...options.headers
  };

  const response = await fetch(`${API_BASE_URL}${endpoint}`, {
    ...options,
    headers
  });

  const data = await response.json();

  if (!response.ok || !data.success) {
    throw new Error(data.message || 'API Request Failed');
  }

  return data.data;
};
