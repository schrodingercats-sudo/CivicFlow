const API_BASE_URL = import.meta.env.VITE_API_URL || '/api/v1';

// Simple in-memory cache for GET requests
const cache = new Map();
const CACHE_TTL = {
  '/departments': 300000,      // 5 minutes — rarely changes
  '/workers': 30000,           // 30 seconds — changes on add/edit/delete
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

  // Targeted cache invalidation on mutations
  // /departments is stable (rarely changes), /workers clears on any mutation
  if (method !== 'GET') {
    const STABLE_KEYS = ['/departments'];
    for (const key of cache.keys()) {
      if (!STABLE_KEYS.some(s => key.startsWith(s))) {
        cache.delete(key);
      }
    }
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

  const raw = await response.text();
  let data;
  try {
    data = raw ? JSON.parse(raw) : { success: false, message: 'Empty response' };
  } catch (_e) {
    const msg = response.status === 403
      ? `CORS or forbidden (${response.status}). Please check the server configuration.`
      : `Invalid response from server (HTTP ${response.status})`;
    throw new Error(msg);
  }

  if (!response.ok || !data.success) {
    if (response.status === 429) {
      if (typeof window !== 'undefined') {
        window.dispatchEvent(new CustomEvent('civicflow-rate-limit', {
          detail: {
            message: data.message || 'Too Many Requests (Rate limit exceeded).',
            retryAfter: data.retryAfter || 30,
            compliance: data.compliance || 'SOC-2 CC6.6'
          }
        }));
      }
      throw new Error(data.message || 'Too Many Requests (429): Rate limit exceeded to prevent server flooding.');
    }
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

// ── SOC 2 & Compliance Services ──
export const complianceService = {
  getSoc2Status: () => apiRequest('/compliance/soc2-status'),
  getAuditLogs: (params = {}) => {
    const query = new URLSearchParams(params).toString();
    return apiRequest(`/compliance/audit-logs${query ? `?${query}` : ''}`);
  },
  downloadAuditLogUrl: `${API_BASE_URL}/compliance/download-audit-log`
};

// ── Worker Field History Services ──
export const workerHistoryService = {
  getWorkerHistory: (workerId) => apiRequest(`/workers/${workerId}/history`),
  getComplaintWorkerHistory: (complaintId) => apiRequest(`/complaints/${complaintId}/worker-history`)
};
