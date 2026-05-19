import apiClient from "./client";

const notFoundStatuses = new Set([404, 405]);

const tryRequest = async (requests) => {
  let lastError;

  for (const request of requests) {
    try {
      return await request();
    } catch (error) {
      lastError = error;

      if (!notFoundStatuses.has(error?.response?.status)) {
        throw error;
      }
    }
  }

  throw lastError ?? new Error("No compatible endpoint was found.");
};

const registerUser = async (data) => {
  const response = await apiClient.post("/Auth/register", data);
  return response.data;
};

const getEmployeeByCode = async (code) => {
  const response = await apiClient.get(`/Auth/employee-by-code/${encodeURIComponent(code)}`);
  return response.data;
};

const forgotPassword = async (data) =>
  tryRequest([
    () => apiClient.post("/Auth/forgot-password", data),
    () => apiClient.post("/Auth/forgotpassword", data)
  ]).then((response) => response.data);

const resetPassword = async (data) =>
  tryRequest([
    () => apiClient.post("/Auth/reset-password", data),
    () => apiClient.post("/Auth/resetpassword", data)
  ]).then((response) => response.data);

const changePassword = async (data) =>
  tryRequest([
    () => apiClient.post("/Auth/change-password", data),
    () => apiClient.post("/Auth/changePassword", data)
  ]).then((response) => response.data);

const getMyProfile = async () =>
  tryRequest([
    () => apiClient.get("/Users/me"),
    () => apiClient.get("/Profile"),
    () => apiClient.get("/Users/profile"),
    () => apiClient.get("/Auth/me")
  ]).then((response) => response.data);

const updateMyProfile = async (data) =>
  tryRequest([
    () => apiClient.put("/Users/me", data),
    () => apiClient.put("/Profile", data),
    () => apiClient.put("/Users/profile", data),
    () => apiClient.put("/Auth/profile", data)
  ]).then((response) => response.data);

export {
  changePassword,
  forgotPassword,
  getEmployeeByCode,
  getMyProfile,
  registerUser,
  resetPassword,
  updateMyProfile
};
