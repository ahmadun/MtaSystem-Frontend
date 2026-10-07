import axios from "axios";

const API_BASE = import.meta.env.VITE_API_ENDPOINT;

const apiClient = axios.create({
  baseURL: API_BASE,
  headers: { "Content-Type": "application/json" }
});

let refreshPromise = null;

const clearSession = () => {
  localStorage.removeItem("accessToken");
  localStorage.removeItem("refreshToken");
  delete axios.defaults.headers.common.Authorization;
  window.location.href = "/session/signin";
};

export const refreshAccessToken = () => {
  if (refreshPromise) return refreshPromise;

  const refreshToken = localStorage.getItem("refreshToken");
  if (!refreshToken) return Promise.reject(new Error("No refresh token available"));

  refreshPromise = axios.post(`${API_BASE}/Auth/refresh`, { refreshToken })
    .then(({ data: response }) => {
      if (!response.success || !response.data?.token) {
        throw new Error("Failed to refresh token");
      }

      // A logout or a newer login must not be undone by an in-flight refresh.
      if (localStorage.getItem("refreshToken") !== refreshToken) {
        throw new Error("Session changed during token refresh");
      }

      const token = response.data.token;
      localStorage.setItem("accessToken", token);
      axios.defaults.headers.common.Authorization = `Bearer ${token}`;
      return token;
    })
    .catch((error) => {
      if (error.response?.status === 401 && localStorage.getItem("refreshToken") === refreshToken) {
        clearSession();
      }
      throw error;
    })
    .finally(() => {
      refreshPromise = null;
    });

  return refreshPromise;
};

apiClient.interceptors.request.use((config) => {
  const token = localStorage.getItem("accessToken");
  if (token) config.headers.Authorization = `Bearer ${token}`;
  return config;
});

apiClient.interceptors.response.use(
  (response) => response,
  async (error) => {
    const originalRequest = error.config;

    if (error.response?.status === 401 && originalRequest && !originalRequest._retry &&
        localStorage.getItem("refreshToken")) {
      originalRequest._retry = true;
      try {
        const currentToken = localStorage.getItem("accessToken");
        const token = currentToken && originalRequest.headers.Authorization !== `Bearer ${currentToken}`
          ? currentToken
          : await refreshAccessToken();
        originalRequest.headers.Authorization = `Bearer ${token}`;
        return apiClient(originalRequest);
      } catch (refreshError) {
        // Keep the session on temporary network or server failures.
        if (refreshError.response?.status !== 401) throw refreshError;
      }
    }

    const message =
      error.response?.data?.message ||
      error.response?.data?.errors?.[0] ||
      error.message ||
      "An unexpected error occurred";

    const enhancedError = new Error(message);
    enhancedError.response = error.response;
    return Promise.reject(enhancedError);
  }
);

export default apiClient;
