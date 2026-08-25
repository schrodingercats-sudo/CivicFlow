const API_BASE_URL = import.meta.env.VITE_API_URL || '/api/v1';

// Simple in-memory cache for GET requests
const cache = new Map();
const CACHE_TTL = {
  '/departments': 300000,   // 5 minutes — rarely changes
  '/workers': 120000,       // 2 minutes
  '/analytics/summary': 30000, // 30 seconds
};

const getCacheTTL = (endpoint) => {
  for (const [key, ttl] of Object.entries(CACHE_TTL)) {
    if (endpoint.startsWith(key)) return ttl;
  }
  return 0; // no caching by default
};

export const apiRequest = async (endpoint, options = {}) => {
  const token = localStorage.getItem('civicflow_token');
  const method = options.method?.toUpperCase() || 'GET';
  
  // Check cache for GET requests
  if (method === 'GET') {
    const ttl = getCacheTTL(endpoint);
    if (ttl > 0) {
      const cached = cache.get(endpoint);
      if (cached && Date.now() - cached.timestamp < ttl) {
        return cached.data;
      }
    }
  }

  // Invalidate cache on mutating requests
  if (method !== 'GET') {
    cache.clear();
  }

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

  // Store in cache for GET requests
  if (method === 'GET') {
    const ttl = getCacheTTL(endpoint);
    if (ttl > 0) {
      cache.set(endpoint, { data: data.data, timestamp: Date.now() });
    }
  }

  return data.data;
};

// Prefetch helper — call on app init for critical data
export const prefetchData = async () => {
  try {
    await apiRequest('/departments');
  } catch (e) { /* silent */ }
};
