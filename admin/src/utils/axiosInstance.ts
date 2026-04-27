import axios from 'axios';

import { getAdminToken, getBackendURL } from './strapiCompat';

const instance = axios.create({
  baseURL: getBackendURL(),
  withCredentials: true,
});

instance.interceptors.request.use(
  async (config) => {
    const token = getAdminToken();
    const headers = (config.headers || {}) as Record<string, string>;

    headers.Accept = 'application/json';
    headers['Content-Type'] = 'application/json';

    if (token) {
      headers.Authorization = `Bearer ${token}`;
    }

    config.headers = headers as any;

    return config;
  },
  (error) => Promise.reject(error)
);

instance.interceptors.response.use(
  (response) => response,
  (error) => {
    // Note: do NOT reload the window on 401 — in Strapi v5 the admin token may
    // be stored as a cookie and refreshed by the host on demand, so a reload
    // turns into an infinite loop. Let the caller handle the error instead.
    throw error;
  }
);

export default instance;
