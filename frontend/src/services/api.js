import axios from 'axios';
import { getToken, setToken, clearToken } from './tokenStore';

const BASE_URL = process.env.REACT_APP_API_URL || 'http://localhost:3001';

const api = axios.create({
  baseURL: BASE_URL,
  headers: { 'Content-Type': 'application/json' },
  withCredentials: true, // required to send/receive the HttpOnly refresh cookie
});

api.interceptors.request.use((config) => {
  const token = getToken();
  if (token) config.headers.Authorization = `Bearer ${token}`;
  return config;
});

// Single in-flight refresh promise — prevents concurrent 401s from each spawning
// a separate refresh request.
let _refreshPromise = null;

api.interceptors.response.use(
  (response) => response,
  async (error) => {
    const original = error.config;

    if (error.response?.status === 401 && !original._retry) {
      original._retry = true;

      if (!_refreshPromise) {
        _refreshPromise = axios
          .post(`${BASE_URL}/api/auth/refresh`, {}, { withCredentials: true })
          .then((res) => {
            setToken(res.data.accessToken);
            return res.data.accessToken;
          })
          .catch(() => {
            clearToken();
            window.location.href = '/login';
            return null;
          })
          .finally(() => { _refreshPromise = null; });
      }

      const newToken = await _refreshPromise;
      if (newToken) {
        original.headers.Authorization = `Bearer ${newToken}`;
        return axios(original);
      }
    }

    return Promise.reject(error);
  }
);

export default api;
