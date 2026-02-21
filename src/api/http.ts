// src/api/http.ts
import axios from "axios";
import { API_BASE_URL } from "./config";
import { getToken, clearToken } from "../platform/authToken";

export const api = axios.create({
  baseURL: API_BASE_URL,
  timeout: 20000,
});

// ✅ token desde electronAPI (async)
api.interceptors.request.use(async (config) => {
  const token = await getToken();
  if (token) {
    config.headers = config.headers ?? {};
    config.headers.Authorization = `Bearer ${token}`;
  }
  return config;
});

// ✅ si 401: limpia token (AuthGate te manda a login)
api.interceptors.response.use(
  (r) => r,
  async (err) => {
    if (err?.response?.status === 401) {
      await clearToken();
      if (typeof window !== "undefined") {
        window.dispatchEvent(new Event("auth:unauthorized"));
      }
    }
    return Promise.reject(err);
  }
);
