import { API_ENDPOINTS } from '../config';

const getAuthHeader = () => {
  const token = localStorage.getItem('token');
  return token ? { Authorization: `Bearer ${token}` } : {};
};

const handleResponse = async (response) => {
  const data = await response.json().catch(() => ({}));
  if (!response.ok) {
    if (response.status === 401) {
      localStorage.removeItem('token');
      window.dispatchEvent(new CustomEvent('auth:logout'));
    }
    const error = new Error(data.detail || 'Request failed');
    error.response = { data };
    error.status = response.status;
    throw error;
  }
  return data;
};

export const login = async (email, password) => {
  const response = await fetch(API_ENDPOINTS.AUTH.LOGIN, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ email, password }),
  });
  const data = await handleResponse(response);
  localStorage.setItem('token', data.access_token);
  return data;
};

export const register = async (email, password) => {
  const response = await fetch(API_ENDPOINTS.AUTH.REGISTER, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ email, password }),
  });
  return handleResponse(response);
};

export const verifyEmail = async (token) => {
  const response = await fetch(`${API_ENDPOINTS.AUTH.VERIFY_EMAIL}?token=${encodeURIComponent(token)}`);
  return handleResponse(response);
};

export const resendVerification = async (email) => {
  const response = await fetch(API_ENDPOINTS.AUTH.RESEND_VERIFICATION, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ email }),
  });
  return handleResponse(response);
};

export const resendVerificationMe = async () => {
  const response = await fetch(API_ENDPOINTS.USER_RESEND_VERIFICATION, {
    method: 'POST',
    headers: getAuthHeader(),
  });
  return handleResponse(response);
};

export const getCurrentUser = async () => {
  const response = await fetch(API_ENDPOINTS.AUTH.ME, { headers: getAuthHeader() });
  return handleResponse(response);
};

export const updateCurrentUser = async (data) => {
  const response = await fetch(API_ENDPOINTS.AUTH.ME, {
    method: 'PATCH',
    headers: { ...getAuthHeader(), 'Content-Type': 'application/json' },
    body: JSON.stringify(data),
  });
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

// Billing
export const fetchBillingPlans = async () => {
  const response = await fetch(API_ENDPOINTS.BILLING.PLANS);
  return handleResponse(response);
};

export const fetchBillingUsage = async () => {
  const response = await fetch(API_ENDPOINTS.BILLING.USAGE, { headers: getAuthHeader() });
  return handleResponse(response);
};

export const fetchBillingInvoices = async () => {
  const response = await fetch(API_ENDPOINTS.BILLING.INVOICES, { headers: getAuthHeader() });
  return handleResponse(response);
};

export const syncBillingFromStripe = async () => {
  const response = await fetch(API_ENDPOINTS.BILLING.SYNC, {
    method: 'POST',
    headers: getAuthHeader(),
  });
  return handleResponse(response);
};

export const createCheckout = async (priceId) => {
  const response = await fetch(API_ENDPOINTS.BILLING.CHECKOUT, {
    method: 'POST',
    headers: { ...getAuthHeader(), 'Content-Type': 'application/json' },
    body: JSON.stringify({ price_id: priceId }),
  });
  return handleResponse(response);
};

export const createPortal = async () => {
  const response = await fetch(API_ENDPOINTS.BILLING.PORTAL, {
    method: 'POST',
    headers: getAuthHeader(),
  });
  return handleResponse(response);
};

export const upgradeToPro = async () => {
  const response = await fetch(API_ENDPOINTS.BILLING.UPGRADE, {
    method: 'POST',
    headers: { ...getAuthHeader(), 'Content-Type': 'application/json' },
    body: JSON.stringify({ to_plan: 'pro' }),
  });
  return handleResponse(response);
};

export const startTrial = async () => {
  const response = await fetch(API_ENDPOINTS.BILLING.TRIAL, {
    method: 'POST',
    headers: getAuthHeader(),
  });
  return handleResponse(response);
};
