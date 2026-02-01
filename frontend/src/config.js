const API_BASE_URL = process.env.REACT_APP_API_BASE_URL || 'http://localhost:8000';
export const PROXY_API_BASE_URL = process.env.REACT_APP_PROXY_API_BASE_URL || 'http://localhost:8080';

export const STRIPE_PUBLISHABLE_KEY = process.env.REACT_APP_STRIPE_PUBLISHABLE_KEY || 'localhost';
export const STRIPE_DONATION_LINK = process.env.REACT_APP_STRIPE_DONATION_LINK || '';

export const API_ENDPOINTS = {
  AUTH: {
    LOGIN: `${API_BASE_URL}/api/auth/login`,
    REGISTER: `${API_BASE_URL}/api/auth/register`,
    ME: `${API_BASE_URL}/api/users/me`,
  },
  CONFIG_KEYS: `${API_BASE_URL}/api/config-keys`,
  SANDBOX: `${PROXY_API_BASE_URL}/sandbox`,
  HEALTH: {
    API: `${API_BASE_URL}/api/health`,
    PROXY: `${PROXY_API_BASE_URL}/health`,
  },
  USAGE_TIMELINE: `${API_BASE_URL}/api/usage/timeline`,
  USAGE_SUMMARY: `${API_BASE_URL}/api/usage/summary`,
  BILLING: {
    PLANS: `${API_BASE_URL}/api/billing/plans`,
    USAGE: `${API_BASE_URL}/api/billing/usage`,
    INVOICES: `${API_BASE_URL}/api/billing/invoices`,
    SYNC: `${API_BASE_URL}/api/billing/sync`,
    CHECKOUT: `${API_BASE_URL}/api/billing/checkout`,
    PORTAL: `${API_BASE_URL}/api/billing/portal`,
    TRIAL: `${API_BASE_URL}/api/billing/trial`,
    UPGRADE: `${API_BASE_URL}/api/billing/upgrade`,
  },
};
