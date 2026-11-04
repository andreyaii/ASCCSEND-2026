// API integration is intentionally disabled: the app currently runs on local demo data.
export const API_BASE_URL = import.meta.env?.VITE_API_URL || 'http://localhost:4000/api';

// Mock auth tokens are in-memory only and must not be mistaken for real credentials.
let authToken = null;
export const getAuthToken = () => authToken;
export const setAuthToken = (token) => { authToken = token || null; };

export const getHeaders = () => ({
  'Content-Type': 'application/json',
  ...(getAuthToken() ? { Authorization: `Bearer ${getAuthToken()}` } : {}),
});

export class ApiError extends Error {
  constructor(message, status) {
    super(message);
    this.status = status;
  }
}

export async function request(path, options = {}) {
  const res = await fetch(`${API_BASE_URL}${path}`, { ...options, headers: { ...getHeaders(), ...options.headers } });
  if (!res.ok) throw new ApiError((await res.text()) || 'Request failed', res.status);
  return res.json();
}
