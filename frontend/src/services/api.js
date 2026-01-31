import { API_ENDPOINTS } from '../config';

const getAuthHeader = () => {
  const token = localStorage.getItem('token');
  return token ? { Authorization: `Bearer ${token}` } : {};
};

const handleResponse = async (response) => {
  const data = await response.json();
  if (!response.ok) {
    const error = new Error(data.detail || 'Request failed');
    error.response = { data };
    throw error;
  }
  return data;
};

export const login = async (username, password) => {
  const response = await fetch(API_ENDPOINTS.AUTH.LOGIN, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ username, password }),
  });
  const data = await handleResponse(response);
  localStorage.setItem('token', data.access_token);
  return data;
};

export const register = async (username, email, password) => {
  const response = await fetch(API_ENDPOINTS.AUTH.REGISTER, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ username, email, password }),
  });
  return handleResponse(response);
};

export const getCurrentUser = async () => {
  const response = await fetch(API_ENDPOINTS.AUTH.ME, { headers: getAuthHeader() });
  return handleResponse(response);
};

export const logout = () => {
  localStorage.removeItem('token');
};

// Config keys
export const fetchConfigKeys = async () => {
  const response = await fetch(API_ENDPOINTS.CONFIG_KEYS, { headers: getAuthHeader() });
  return handleResponse(response);
};

export const createConfigKey = async (data) => {
  const response = await fetch(API_ENDPOINTS.CONFIG_KEYS, {
    method: 'POST',
    headers: { ...getAuthHeader(), 'Content-Type': 'application/json' },
    body: JSON.stringify(data),
  });
  return handleResponse(response);
};

export const updateConfigKey = async (keyId, data) => {
  const response = await fetch(`${API_ENDPOINTS.CONFIG_KEYS}/${keyId}/`, {
    method: 'PUT',
    headers: { ...getAuthHeader(), 'Content-Type': 'application/json' },
    body: JSON.stringify(data),
  });
  return handleResponse(response);
};

export const deleteConfigKey = async (keyId) => {
  const response = await fetch(`${API_ENDPOINTS.CONFIG_KEYS}/${keyId}/`, {
    method: 'DELETE',
    headers: getAuthHeader(),
  });
  return handleResponse(response);
};

// Health (no auth)
export const checkApiHealth = async () => {
  const response = await fetch(API_ENDPOINTS.HEALTH.API, { cache: 'no-store' });
  const data = await response.json().catch(() => ({}));
  return { ok: response.ok, status: response.status, data };
};

export const checkProxyHealth = async () => {
  const response = await fetch(API_ENDPOINTS.HEALTH.PROXY, { cache: 'no-store' });
  const data = await response.json().catch(() => ({}));
  return { ok: response.ok, status: response.status, data };
};

// Usage timeline (auth required)
export const fetchUsageTimeline = async (groupBy = 'day', period = '30d') => {
  const params = new URLSearchParams({ group_by: groupBy, period });
  const response = await fetch(`${API_ENDPOINTS.USAGE_TIMELINE}?${params}`, { headers: getAuthHeader() });
  return handleResponse(response);
};

// Usage summary (total + per key, for debugging empty chart)
export const fetchUsageSummary = async () => {
  const response = await fetch(API_ENDPOINTS.USAGE_SUMMARY, { headers: getAuthHeader() });
  return handleResponse(response);
};
