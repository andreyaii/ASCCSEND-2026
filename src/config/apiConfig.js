export const API_BASE_URL = import.meta.env?.VITE_API_URL
  || 'https://script.google.com/macros/s/AKfycbwf0SaLnQN7skN0sjwbEFPNNl6nX6Wb6ondSaL35ojVxYWPT-uVs6d4DlSCEAc7Pm74/exec';

let authToken = null;
const pendingGetRequests = new Map();
export const getAuthToken = () => authToken;
export const setAuthToken = (token) => { authToken = token || null; };

export class ApiError extends Error {
  constructor(message, status) {
    super(message);
    this.status = status;
  }
}

export async function request(action, options = {}) {
  const method = (options.method || 'GET').toUpperCase();
  let url = API_BASE_URL;
  const query = new URLSearchParams({ action });
  const token = options.authenticated ? getAuthToken() : null;

  if (options.authenticated && !token) {
    throw new ApiError('Your session has expired. Please sign in again.', 401);
  }

  const fetchOptions = {
    method,
    headers: { ...options.headers }
  };

  if (method === 'GET') {
    Object.entries(options.query || {}).forEach(([key, value]) => {
      if (value !== undefined && value !== null) query.set(key, String(value));
    });
    if (token) query.set('sessionToken', token);
    url += `?${query.toString()}`;
  } else {
    // For POST/PUT, pass text/plain to avoid CORS preflight issues with Google Apps Script
    fetchOptions.headers['Content-Type'] = 'text/plain;charset=utf-8';
    fetchOptions.body = JSON.stringify({
      action,
      ...(options.body || {}),
      ...(token ? { sessionToken: token } : {})
    });
  }

  const execute = async () => {
    const res = await fetch(url, fetchOptions);

    if (!res.ok) {
      throw new ApiError((await res.text()) || 'Request failed', res.status);
    }

    const json = await res.json();
    if (json.success === false) {
      throw new ApiError(json.message || 'API operation failed', 400);
    }

    return json;
  };

  if (method !== 'GET' || options.deduplicate === false) return execute();
  if (pendingGetRequests.has(url)) return pendingGetRequests.get(url);

  const pendingRequest = execute();
  pendingGetRequests.set(url, pendingRequest);
  try {
    return await pendingRequest;
  } finally {
    if (pendingGetRequests.get(url) === pendingRequest) pendingGetRequests.delete(url);
  }
}