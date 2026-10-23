/**
 * Centralized API & Socket URL Resolver
 * Guarantees that the API base URL always ends with '/api' and never has double slashes,
 * regardless of whether VITE_API_URL was set with or without '/api' or trailing slash.
 */

function sanitizeBaseUrl(url) {
  if (!url) return '';
  return String(url).trim().replace(/\/+$/, '');
}

export function getApiBaseUrl() {
  const envUrl = sanitizeBaseUrl(
    import.meta.env.VITE_API_URL || 
    import.meta.env.VITE_API_BASE_URL || 
    'http://localhost:5000/api'
  );

  if (!envUrl) return 'http://localhost:5000/api';
  return envUrl.endsWith('/api') ? envUrl : `${envUrl}/api`;
}

export function getSocketBaseUrl() {
  const apiBase = getApiBaseUrl();
  return apiBase.replace(/\/api\/?$/, '');
}

export const API_BASE_URL = getApiBaseUrl();
export const SOCKET_BASE_URL = getSocketBaseUrl();
export default API_BASE_URL;
