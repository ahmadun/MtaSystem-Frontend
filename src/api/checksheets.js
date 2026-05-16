import apiClient from "./client";

export const getChecksheetTemplates = async (params) => {
  const response = await apiClient.get("/checksheet-templates", { params });
  return response.data;
};

export const getDashboard = async (params) => {
  const response = await apiClient.get("/dashboard", { params });
  return response.data;
};

export const getChecksheetMasters = async () => {
  const response = await apiClient.get("/checksheet-masters");
  return response.data;
};

export const getChecksheetAreas = async () => {
  const response = await apiClient.get("/checksheet-masters/areas");
  return response.data;
};

export const createChecksheetMaster = async (data) => {
  const response = await apiClient.post("/checksheet-masters", data);
  return response.data;
};

export const updateChecksheetMaster = async (id, data) => {
  const response = await apiClient.put(`/checksheet-masters/${id}`, data);
  return response.data;
};

export const deleteChecksheetMaster = async (id) => {
  const response = await apiClient.delete(`/checksheet-masters/${id}`);
  return response.data;
};

export const createChecksheetArea = async (data) => {
  const response = await apiClient.post("/checksheet-masters/areas", data);
  return response.data;
};

export const updateChecksheetArea = async (areaCode, data) => {
  const response = await apiClient.put(`/checksheet-masters/areas/${areaCode}`, data);
  return response.data;
};

export const deleteChecksheetArea = async (areaCode) => {
  const response = await apiClient.delete(`/checksheet-masters/areas/${areaCode}`);
  return response.data;
};

export const getChecksheetLines = async () => {
  const response = await apiClient.get("/checksheet-masters/lines");
  return response.data;
};

export const getChecksheetGroups = async () => {
  const response = await apiClient.get("/checksheet-masters/groups");
  return response.data;
};

export const getRepairmanCheckers = async (params) => {
  const response = await apiClient.get("/checksheet-masters/repairman-checkers", { params });
  return response.data;
};

export const getChecksheetMachines = async (params) => {
  const response = await apiClient.get("/checksheet-masters/machines", { params });
  return response.data;
};

export const getChecksheetMachine = async (machineCode) => {
  const response = await apiClient.get(`/checksheet-masters/machines/${machineCode}`);
  return response.data;
};

export const exportChecksheetMachineLabels = async (data) => {
  const response = await apiClient.post("/checksheet-masters/machines/export-labels", data, {
    responseType: "blob"
  });
  return response;
};

export const createChecksheetLine = async (data) => {
  const response = await apiClient.post("/checksheet-masters/lines", data);
  return response.data;
};

export const updateChecksheetLine = async (lineCode, data) => {
  const response = await apiClient.put(`/checksheet-masters/lines/${lineCode}`, data);
  return response.data;
};

export const deleteChecksheetLine = async (lineCode) => {
  const response = await apiClient.delete(`/checksheet-masters/lines/${lineCode}`);
  return response.data;
};

export const createChecksheetGroup = async (data) => {
  const response = await apiClient.post("/checksheet-masters/groups", data);
  return response.data;
};

export const updateChecksheetGroup = async (groupCode, data) => {
  const response = await apiClient.put(`/checksheet-masters/groups/${groupCode}`, data);
  return response.data;
};

export const deleteChecksheetGroup = async (groupCode) => {
  const response = await apiClient.delete(`/checksheet-masters/groups/${groupCode}`);
  return response.data;
};

export const createRepairmanChecker = async (data) => {
  const response = await apiClient.post("/checksheet-masters/repairman-checkers", data);
  return response.data;
};

export const updateRepairmanChecker = async (id, data) => {
  const response = await apiClient.put(`/checksheet-masters/repairman-checkers/${id}`, data);
  return response.data;
};

export const deleteRepairmanChecker = async (id) => {
  const response = await apiClient.delete(`/checksheet-masters/repairman-checkers/${id}`);
  return response.data;
};

export const createChecksheetMachine = async (data) => {
  const response = await apiClient.post("/checksheet-masters/machines", data);
  return response.data;
};

export const updateChecksheetMachine = async (machineCode, data) => {
  const response = await apiClient.put(`/checksheet-masters/machines/${machineCode}`, data);
  return response.data;
};

export const upsertChecksheetMachineModeTemplate = async (machineCode, data) => {
  const response = await apiClient.put(`/checksheet-masters/machines/${machineCode}/mode-template`, data);
  return response.data;
};

export const deleteChecksheetMachine = async (machineCode) => {
  const response = await apiClient.delete(`/checksheet-masters/machines/${machineCode}`);
  return response.data;
};

export const getChecksheetTemplate = async (id) => {
  const response = await apiClient.get(`/checksheet-templates/${id}`);
  return response.data;
};

export const createChecksheetTemplate = async (data) => {
  const response = await apiClient.post("/checksheet-templates", data);
  return response.data;
};

export const updateChecksheetTemplate = async (id, data) => {
  const response = await apiClient.put(`/checksheet-templates/${id}`, data);
  return response.data;
};

export const deleteChecksheetTemplate = async (id) => {
  const response = await apiClient.delete(`/checksheet-templates/${id}`);
  return response.data;
};

export const getChecksheetSubmissions = async (params) => {
  const response = await apiClient.get("/checksheet-submissions", { params });
  return response.data;
};

export const getRepairHistory = async (params) => {
  const response = await apiClient.get("/checksheet-submissions/repair-records", { params });
  return response.data;
};

export const getChecksheetMonthlyResults = async (params) => {
  const response = await apiClient.get("/checksheet-submissions/monthly-results", { params });
  return response.data;
};

export const getChecksheetSubmission = async (id, params) => {
  const response = await apiClient.get(`/checksheet-submissions/${id}`, { params });
  return response.data;
};

export const getChecksheetSubmissionMonthlyView = async (id, params) => {
  const response = await apiClient.get(`/checksheet-submissions/${id}/monthly-view`, { params });
  return response.data;
};

export const createChecksheetSubmission = async (data) => {
  const response = await apiClient.post("/checksheet-submissions", data);
  return response.data;
};

export const updateChecksheetSubmission = async (id, data) => {
  const response = await apiClient.put(`/checksheet-submissions/${id}`, data);
  return response.data;
};

export const deleteChecksheetSubmission = async (id) => {
  const response = await apiClient.delete(`/checksheet-submissions/${id}`);
  return response.data;
};

export const createInspectionRecord = async (submissionId, data) => {
  const response = await apiClient.post(`/checksheet-submissions/${submissionId}/inspection-records`, data);
  return response.data;
};

export const updateInspectionRecord = async (submissionId, recordId, data) => {
  const response = await apiClient.put(`/checksheet-submissions/${submissionId}/inspection-records/${recordId}`, data);
  return response.data;
};

export const approveDailyInspectionStep = async (submissionId, recordId, stepId) => {
  const response = await apiClient.post(`/checksheet-submissions/${submissionId}/inspection-records/${recordId}/approval-steps/${stepId}/approve`);
  return response.data;
};

export const deleteInspectionRecord = async (submissionId, recordId) => {
  const response = await apiClient.delete(`/checksheet-submissions/${submissionId}/inspection-records/${recordId}`);
  return response.data;
};

export const createRepairRecord = async (submissionId, data) => {
  const response = await apiClient.post(`/checksheet-submissions/${submissionId}/repair-records`, data);
  return response.data;
};

export const updateRepairRecord = async (submissionId, recordId, data) => {
  const response = await apiClient.put(`/checksheet-submissions/${submissionId}/repair-records/${recordId}`, data);
  return response.data;
};

export const approveRepairRecord = async (submissionId, recordId) => {
  const response = await apiClient.post(`/checksheet-submissions/${submissionId}/repair-records/${recordId}/approve`);
  return response.data;
};

export const deleteRepairRecord = async (submissionId, recordId) => {
  const response = await apiClient.delete(`/checksheet-submissions/${submissionId}/repair-records/${recordId}`);
  return response.data;
};

export const getPendingRepairRecords = async (params) => {
  const response = await apiClient.get("/checksheet-submissions/repair-records/pending", { params });
  return response.data;
};

export const getApprovalTemplates = async (params) => {
  const response = await apiClient.get("/approval-templates", { params });
  return response.data;
};

export const getApprovalTemplate = async (id) => {
  const response = await apiClient.get(`/approval-templates/${id}`);
  return response.data;
};

export const createApprovalTemplate = async (data) => {
  const response = await apiClient.post("/approval-templates", data);
  return response.data;
};

export const getSubmissionApprovalRequests = async (submissionId, params) => {
  const response = await apiClient.get(`/checksheet-submissions/${submissionId}/approval-requests`, { params });
  return response.data;
};

export const getApprovalRequest = async (submissionId, requestId) => {
  const response = await apiClient.get(`/checksheet-submissions/${submissionId}/approval-requests/${requestId}`);
  return response.data;
};

export const createApprovalRequest = async (submissionId, data) => {
  const response = await apiClient.post(`/checksheet-submissions/${submissionId}/approval-requests`, data);
  return response.data;
};

export const cancelApprovalRequest = async (submissionId, requestId) => {
  const response = await apiClient.patch(`/checksheet-submissions/${submissionId}/approval-requests/${requestId}/cancel`);
  return response.data;
};

export const getPendingApprovalRequests = async (params) => {
  const response = await apiClient.get("/approval-requests/pending-for-me", { params });
  return response.data;
};

export const respondApprovalRequest = async (requestId, stepId, data) => {
  const response = await apiClient.post(`/approval-requests/${requestId}/steps/${stepId}/respond`, data);
  return response.data;
};
