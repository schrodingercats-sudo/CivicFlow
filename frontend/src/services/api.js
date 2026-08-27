import { useState, useEffect, useRef } from 'react';

const API_BASE_URL = import.meta.env.VITE_API_URL || '/api/v1';

// ── Multi-Tier SWR Cache (Memory + Persistent sessionStorage) ──
const memoryCache = new Map();
const STORAGE_PREFIX = 'cf_cache_v2_';

const CACHE_CONFIG = {
  '/departments': { ttl: 600000 },          // 10 minutes
  '/workers': { ttl: 60000 },               // 1 minute
  '/analytics/summary': { ttl: 30000 },     // 30 seconds
  '/compliance/audit-logs': { ttl: 15000 }, // 15 seconds
  '/complaints': { ttl: 30000 },            // 30 seconds
};

const getEndpointConfig = (endpoint) => {
  for (const [key, config] of Object.entries(CACHE_CONFIG)) {
    if (endpoint.startsWith(key)) return config;
  }
  return null;
};

// ── Persistent Storage Helpers ──
export const getCachedResponse = (endpoint) => {
  // 1. Memory Tier (Fastest, <0.1ms)
  if (memoryCache.has(endpoint)) {
    const entry = memoryCache.get(endpoint);
    if (entry && Date.now() - entry.timestamp < entry.ttl) {
      return entry.data;
    }
  }

  // 2. Persistent Session Storage Tier (Survives page reloads & tab navigation)
  try {
    const raw = sessionStorage.getItem(`${STORAGE_PREFIX}${endpoint}`);
    if (raw) {
      const entry = JSON.parse(raw);
      if (entry && Date.now() - entry.timestamp < entry.ttl) {
        // Backfill memory tier
        memoryCache.set(endpoint, entry);
        return entry.data;
      } else {
        sessionStorage.removeItem(`${STORAGE_PREFIX}${endpoint}`);
      }
    }
  } catch (_e) {}

  return null;
};

export const setCachedResponse = (endpoint, data, customTtl) => {
  const config = getEndpointConfig(endpoint);
  const ttl = customTtl || config?.ttl || 30000;
  const entry = { data, timestamp: Date.now(), ttl };

  memoryCache.set(endpoint, entry);
  try {
    sessionStorage.setItem(`${STORAGE_PREFIX}${endpoint}`, JSON.stringify(entry));
  } catch (_e) {}
};

export const clearCache = (prefix) => {
  if (prefix) {
    for (const key of memoryCache.keys()) {
      if (key.startsWith(prefix)) memoryCache.delete(key);
    }
    try {
      const keysToRemove = [];
      for (let i = 0; i < sessionStorage.length; i++) {
        const k = sessionStorage.key(i);
        if (k && k.startsWith(`${STORAGE_PREFIX}${prefix}`)) {
          keysToRemove.push(k);
        }
      }
      keysToRemove.forEach(k => sessionStorage.removeItem(k));
    } catch (_e) {}
  } else {
    memoryCache.clear();
    try {
      const keysToRemove = [];
      for (let i = 0; i < sessionStorage.length; i++) {
        const k = sessionStorage.key(i);
        if (k && k.startsWith(STORAGE_PREFIX)) {
          keysToRemove.push(k);
        }
      }
      keysToRemove.forEach(k => sessionStorage.removeItem(k));
    } catch (_e) {}
  }
};

// ── Core API Request Client with SWR ──
export const apiRequest = async (endpoint, options = {}) => {
  const token = localStorage.getItem('civicflow_token');
  const method = options.method?.toUpperCase() || 'GET';
  
  // Cache check for GET requests
  if (method === 'GET' && !options.skipCache) {
    const cached = getCachedResponse(endpoint);
    if (cached !== null) {
      return cached;
    }
  }

  // Auto-invalidate related cache on mutations
  if (method !== 'GET') {
    if (endpoint.startsWith('/complaints')) {
      clearCache('/complaints');
      clearCache('/analytics');
    } else if (endpoint.startsWith('/workers')) {
      clearCache('/workers');
    } else {
      clearCache();
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

  // Store in multi-tier cache for GET
  if (method === 'GET') {
    const config = getEndpointConfig(endpoint);
    if (config) {
      setCachedResponse(endpoint, data.data, config.ttl);
    }
  }

  return data.data;
};

// ── Smart Prefetch Helper (Pre-warms cache on hover or background) ──
export const prefetchEndpoint = async (endpoint) => {
  try {
    // If already cached and fresh, do nothing
    if (getCachedResponse(endpoint) !== null) return;
    await apiRequest(endpoint);
  } catch (_e) { /* silent background prefetch */ }
};

export const prefetchData = async () => {
  try {
    await Promise.allSettled([
      prefetchEndpoint('/departments'),
      prefetchEndpoint('/complaints?page=1&limit=10')
    ]);
  } catch (_e) {}
};

// ── Custom React Hook: useSWRData for True Zero-Latency UI Rendering ──
export const useSWRData = (endpoint, fetchFn, dependencies = []) => {
  const [data, setData] = useState(() => getCachedResponse(endpoint));
  const [loading, setLoading] = useState(() => getCachedResponse(endpoint) === null);
  const [error, setError] = useState(null);
  const lastHashRef = useRef(JSON.stringify(getCachedResponse(endpoint)));

  useEffect(() => {
    let isMounted = true;
    const cached = getCachedResponse(endpoint);

    if (cached !== null) {
      setData(cached);
      setLoading(false);
      lastHashRef.current = JSON.stringify(cached);
    } else {
      setLoading(true);
    }

    const revalidate = async () => {
      try {
        const freshData = await (fetchFn ? fetchFn() : apiRequest(endpoint, { skipCache: true }));
        if (!isMounted) return;

        const newHash = JSON.stringify(freshData);
        // Only trigger state update if data actually changed to prevent jitter/flicker
        if (newHash !== lastHashRef.current) {
          lastHashRef.current = newHash;
          setData(freshData);
          setCachedResponse(endpoint, freshData);
        }
        setError(null);
      } catch (err) {
        if (isMounted && cached === null) {
          setError(err);
        }
      } finally {
        if (isMounted) setLoading(false);
      }
    };

    revalidate();

    return () => {
      isMounted = false;
    };
  }, [endpoint, ...dependencies]);

  return { data, loading, error, mutate: (newData) => { setData(newData); setCachedResponse(endpoint, newData); } };
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
