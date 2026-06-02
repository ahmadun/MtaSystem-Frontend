import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useSnackbar } from "notistack";
import {
  cancelApprovalRequest,
  appendChecksheetTemplateItems,
  appendChecksheetSubmissionTemplateItems,
  createChecksheetArea,
  createChecksheetMaster,
  createChecksheetGroup,
  createRepairmanChecker,
  createChecksheetStepApprover,
  createChecksheetLine,
  createChecksheetMachine,
  createApprovalRequest,
  approveDailyInspectionStep,
  approveRepairRecord,
  cancelRepairRecordApproval,
  createApprovalTemplate,
  getApprovalTemplate,
  getDashboard,
  getChecksheetAreas,
  getChecksheetMasters,
  getChecksheetGroups,
  getRepairmanCheckers,
  getChecksheetStepApprovers,
  getChecksheetLines,
  getChecksheetMachine,
  getChecksheetMachines,
  getChecksheetMachineCodeOptions,
  getChecksheetHolidays,
  exportChecksheetMachineLabels,
  exportChecksheetSubmissionMonthlyView,
  deleteChecksheetArea,
  deleteChecksheetMaster,
  deleteChecksheetGroup,
  deleteRepairmanChecker,
  deleteChecksheetStepApprover,
  deleteChecksheetLine,
  deleteChecksheetMachine,
  deleteChecksheetSubmission,
  createChecksheetSubmission,
  createChecksheetTemplate,
  createInspectionRecord,
  createRepairRecord,
  deleteChecksheetTemplate,
  deleteInspectionRecord,
  deleteRepairRecord,
  getApprovalRequest,
  getApprovalTemplates,
  getChecksheetSubmission,
  getChecksheetLineStartStatus,
  getChecksheetSubmissionMonthlyView,
  getChecksheetMonthlyResults,
  getChecksheetSubmissions,
  getRepairHistory,
  getChecksheetTemplate,
  getChecksheetTemplates,
  getPendingApprovalRequests,
  getPendingRepairRecords,
  respondApprovalRequest,
  updateChecksheetArea,
  updateChecksheetTemplate,
  updateChecksheetMaster,
  updateChecksheetGroup,
  createChecksheetMachineCodeOption,
  updateChecksheetMachineCodeOption,
  deleteChecksheetMachineCodeOption,
  createChecksheetHoliday,
  generateChecksheetWeekendHolidays,
  updateChecksheetHoliday,
  deleteChecksheetHoliday,
  updateRepairmanChecker,
  updateChecksheetStepApprover,
  updateChecksheetLine,
  updateChecksheetMachine,
  upsertChecksheetMachineModeTemplate,
  updateChecksheetSubmission,
  updateInspectionRecord,
  updateApprovalTemplate,
  patchApprovalTemplate,
  updateRepairRecord,
  uploadChecksheetTemplateImage
} from "@api/checksheets";

export const CHECKSHEET_KEYS = {
  all: ["checksheets"],
  templatesBase: ["checksheets", "templates"],
  dashboard: (params) => ["dashboard", params],
  templates: (params) => ["checksheets", "templates", params],
  template: (id) => ["checksheets", "templates", id],
  submissions: (params) => ["checksheets", "submissions", params],
  monthlyResults: (params) => ["checksheets", "monthly-results", params],
  lineStartStatus: (params) => ["checksheets", "line-start-status", params],
  submission: (id, params) => ["checksheets", "submission", id, params],
  submissionBase: (id) => ["checksheets", "submission", id],
  submissionMonthlyView: (id, params) => ["checksheets", "submission", id, "monthly-view", params],
  repairHistory: (params) => ["checksheets", "repair-history", params],
  approvalTemplates: (params) => ["checksheets", "approval-templates", params],
  approvalTemplate: (id) => ["checksheets", "approval-template", id],
  approvalRequest: (submissionId, requestId) => ["checksheets", "approval-request", submissionId, requestId],
  pendingApprovals: (params) => ["checksheets", "pending-approvals", params],
  pendingRepairs: (params) => ["checksheets", "pending-repairs", params]
};

export const useDashboard = (params = {}, options = {}) =>
  useQuery({
    queryKey: CHECKSHEET_KEYS.dashboard(params),
    queryFn: () => getDashboard(params).then((res) => res.data),
    keepPreviousData: true,
    staleTime: 30_000,
    ...options
  });

export const useChecksheetMasters = (options = {}) =>
  useQuery({
    queryKey: ["checksheets", "masters", "checksheet-masters"],
    queryFn: () => getChecksheetMasters().then((res) => res.data),
    staleTime: 30_000,
    ...options
  });

export const useChecksheetAreas = (options = {}) =>
  useQuery({
    queryKey: ["checksheets", "masters", "areas"],
    queryFn: () => getChecksheetAreas().then((res) => res.data),
    staleTime: 30_000,
    ...options
  });

export const useChecksheetLines = (options = {}) =>
  useQuery({
    queryKey: ["checksheets", "masters", "lines"],
    queryFn: () => getChecksheetLines().then((res) => res.data),
    staleTime: 30_000,
    ...options
  });

export const useChecksheetGroups = (options = {}) =>
  useQuery({
    queryKey: ["checksheets", "masters", "groups"],
    queryFn: () => getChecksheetGroups().then((res) => res.data),
    staleTime: 30_000,
    ...options
  });

export const useChecksheetMachineCodeOptions = (options = {}) =>
  useQuery({
    queryKey: ["checksheets", "masters", "machine-code-options"],
    queryFn: () => getChecksheetMachineCodeOptions().then((res) => res.data),
    staleTime: 30_000,
    ...options
  });

export const useChecksheetHolidays = (params = {}, options = {}) =>
  useQuery({
    queryKey: ["checksheets", "masters", "holidays", params],
    queryFn: () => getChecksheetHolidays(params).then((res) => res.data),
    keepPreviousData: true,
    staleTime: 30_000,
    ...options
  });

export const useRepairmanCheckers = (params = {}, options = {}) =>
  useQuery({
    queryKey: ["checksheets", "masters", "repairman-checkers", params],
    queryFn: () => getRepairmanCheckers(params).then((res) => res.data),
    keepPreviousData: true,
    staleTime: 30_000,
    ...options
  });

export const useChecksheetStepApprovers = (params = {}, options = {}) =>
  useQuery({
    queryKey: ["checksheets", "masters", "step-approvers", params],
    queryFn: () => getChecksheetStepApprovers(params).then((res) => res.data),
    keepPreviousData: true,
    staleTime: 30_000,
    ...options
  });

export const useChecksheetMachines = (params = {}, options = {}) =>
  useQuery({
    queryKey: ["checksheets", "masters", "machines", params],
    queryFn: () => getChecksheetMachines(params).then((res) => res.data),
    keepPreviousData: true,
    staleTime: 30_000,
    ...options
  });

export const useChecksheetMachine = (machineCode, options = {}) =>
  useQuery({
    queryKey: ["checksheets", "masters", "machines", machineCode],
    queryFn: () => getChecksheetMachine(machineCode).then((res) => res.data),
    enabled: !!machineCode,
    staleTime: 30_000,
    ...options
  });

export const useCreateChecksheetMaster = () =>
  useSnackbarMutation(createChecksheetMaster, [CHECKSHEET_KEYS.all], "Checksheet master created successfully");

export const useUpdateChecksheetMaster = (id) =>
  useSnackbarMutation((data) => updateChecksheetMaster(id, data), [CHECKSHEET_KEYS.all], "Checksheet master updated successfully");

export const useDeleteChecksheetMaster = () =>
  useSnackbarMutation(deleteChecksheetMaster, [CHECKSHEET_KEYS.all], "Checksheet master deleted successfully");

export const useCreateChecksheetArea = () =>
  useSnackbarMutation(createChecksheetArea, [CHECKSHEET_KEYS.all], "Area created successfully");

export const useUpdateChecksheetArea = (areaCode) =>
  useSnackbarMutation((data) => updateChecksheetArea(areaCode, data), [CHECKSHEET_KEYS.all], "Area updated successfully");

export const useDeleteChecksheetArea = () =>
  useSnackbarMutation(deleteChecksheetArea, [CHECKSHEET_KEYS.all], "Area deleted successfully");

export const useCreateChecksheetLine = () =>
  useSnackbarMutation(createChecksheetLine, [CHECKSHEET_KEYS.all], "Line created successfully");

export const useUpdateChecksheetLine = (lineCode) =>
  useSnackbarMutation((data) => updateChecksheetLine(lineCode, data), [CHECKSHEET_KEYS.all], "Line updated successfully");

export const useDeleteChecksheetLine = () =>
  useSnackbarMutation(deleteChecksheetLine, [CHECKSHEET_KEYS.all], "Line deleted successfully");

export const useCreateChecksheetGroup = () =>
  useSnackbarMutation(createChecksheetGroup, [CHECKSHEET_KEYS.all], "Group created successfully");

export const useUpdateChecksheetGroup = (groupCode) =>
  useSnackbarMutation((data) => updateChecksheetGroup(groupCode, data), [CHECKSHEET_KEYS.all], "Group updated successfully");

export const useDeleteChecksheetGroup = () =>
  useSnackbarMutation(deleteChecksheetGroup, [CHECKSHEET_KEYS.all], "Group deleted successfully");

export const useCreateChecksheetMachineCodeOption = () =>
  useSnackbarMutation(createChecksheetMachineCodeOption, [CHECKSHEET_KEYS.all], "Machine code option created successfully");

export const useUpdateChecksheetMachineCodeOption = (machineCode) =>
  useSnackbarMutation((data) => updateChecksheetMachineCodeOption(machineCode, data), [CHECKSHEET_KEYS.all], "Machine code option updated successfully");

export const useDeleteChecksheetMachineCodeOption = () =>
  useSnackbarMutation(deleteChecksheetMachineCodeOption, [CHECKSHEET_KEYS.all], "Machine code option deleted successfully");

export const useCreateChecksheetHoliday = () =>
  useSnackbarMutation(createChecksheetHoliday, [CHECKSHEET_KEYS.all, ["checksheets", "masters", "holidays"]], "Holiday created successfully");

export const useGenerateChecksheetWeekendHolidays = () =>
  useSnackbarMutation(generateChecksheetWeekendHolidays, [CHECKSHEET_KEYS.all, ["checksheets", "masters", "holidays"]], "Weekend holidays generated successfully");

export const useUpdateChecksheetHoliday = (id) =>
  useSnackbarMutation((data) => updateChecksheetHoliday(id, data), [CHECKSHEET_KEYS.all, ["checksheets", "masters", "holidays"]], "Holiday updated successfully");

export const useDeleteChecksheetHoliday = () =>
  useSnackbarMutation(deleteChecksheetHoliday, [CHECKSHEET_KEYS.all, ["checksheets", "masters", "holidays"]], "Holiday deleted successfully");

export const useCreateRepairmanChecker = () =>
  useSnackbarMutation(createRepairmanChecker, [CHECKSHEET_KEYS.all], "Repairman checker created successfully");

export const useUpdateRepairmanChecker = (id) =>
  useSnackbarMutation((data) => updateRepairmanChecker(id, data), [CHECKSHEET_KEYS.all], "Repairman checker updated successfully");

export const useDeleteRepairmanChecker = () =>
  useSnackbarMutation(deleteRepairmanChecker, [CHECKSHEET_KEYS.all], "Repairman checker deleted successfully");

export const useCreateChecksheetStepApprover = () =>
  useSnackbarMutation(createChecksheetStepApprover, [CHECKSHEET_KEYS.all], "Checksheet approver created successfully");

export const useUpdateChecksheetStepApprover = (id) =>
  useSnackbarMutation((data) => updateChecksheetStepApprover(id, data), [CHECKSHEET_KEYS.all], "Checksheet approver updated successfully");

export const useDeleteChecksheetStepApprover = () =>
  useSnackbarMutation(deleteChecksheetStepApprover, [CHECKSHEET_KEYS.all], "Checksheet approver deleted successfully");

export const useCreateChecksheetMachine = () =>
  useSnackbarMutation(createChecksheetMachine, [CHECKSHEET_KEYS.all], "Checksheet line created successfully");

export const useUpdateChecksheetMachine = (machineCode) =>
  useSnackbarMutation((data) => updateChecksheetMachine(machineCode, data), [CHECKSHEET_KEYS.all], "Checksheet line updated successfully");

export const useUpsertChecksheetMachineModeTemplate = () =>
  useSnackbarMutation(
    ({ machineCode, ...data }) => upsertChecksheetMachineModeTemplate(machineCode, data),
    [CHECKSHEET_KEYS.all],
    "Mode template assigned successfully"
  );

export const useDeleteChecksheetMachine = () =>
  useSnackbarMutation(deleteChecksheetMachine, [CHECKSHEET_KEYS.all], "Checksheet line deleted successfully");

export const useExportChecksheetMachineLabels = () => {
  const { enqueueSnackbar } = useSnackbar();

  return useMutation({
    mutationFn: exportChecksheetMachineLabels,
    onSuccess: (response) => {
      const blob = new Blob([response.data], {
        type: response.headers["content-type"] || "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet"
      });
      const contentDisposition = response.headers["content-disposition"] || "";
      const fileNameMatch = contentDisposition.match(/filename="?([^"]+)"?/i);
      const fileName = fileNameMatch?.[1] || "checksheet-machine-labels.xlsx";
      const downloadUrl = window.URL.createObjectURL(blob);
      const link = document.createElement("a");
      link.href = downloadUrl;
      link.download = fileName;
      document.body.appendChild(link);
      link.click();
      link.remove();
      window.URL.revokeObjectURL(downloadUrl);

      enqueueSnackbar("Machine labels exported successfully", { variant: "success" });
    },
    onError: (error) => {
      enqueueSnackbar(error.message || "Export failed", { variant: "error" });
    }
  });
};

export const useExportChecksheetSubmissionMonthlyView = (submissionId) => {
  const { enqueueSnackbar } = useSnackbar();

  return useMutation({
    mutationFn: (params) => exportChecksheetSubmissionMonthlyView(submissionId, params),
    onSuccess: (response) => {
      const blob = new Blob([response.data], {
        type: response.headers["content-type"] || "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet"
      });
      const contentDisposition = response.headers["content-disposition"] || "";
      const fileNameMatch = contentDisposition.match(/filename="?([^"]+)"?/i);
      const fileName = fileNameMatch?.[1] || "checksheet-monthly.xlsx";
      const downloadUrl = window.URL.createObjectURL(blob);
      const link = document.createElement("a");
      link.href = downloadUrl;
      link.download = fileName;
      document.body.appendChild(link);
      link.click();
      link.remove();
      window.URL.revokeObjectURL(downloadUrl);

      enqueueSnackbar("Monthly checksheet exported successfully", { variant: "success" });
    },
    onError: (error) => {
      enqueueSnackbar(error.message || "Export failed", { variant: "error" });
    }
  });
};

const useSnackbarMutation = (mutationFn, invalidateQueryKeys, successMessage) => {
  const queryClient = useQueryClient();
  const { enqueueSnackbar } = useSnackbar();

  return useMutation({
    mutationFn,
    onSuccess: (res) => {
      invalidateQueryKeys.forEach((queryKey) => queryClient.invalidateQueries({ queryKey }));
      enqueueSnackbar(res?.message || successMessage, { variant: "success" });
    },
    onError: (error) => {
      enqueueSnackbar(error.message || "Request failed", { variant: "error" });
    }
  });
};

export const useChecksheetTemplates = (params = {}, options = {}) =>
  useQuery({
    queryKey: CHECKSHEET_KEYS.templates(params),
    queryFn: () => getChecksheetTemplates(params).then((res) => res.data),
    keepPreviousData: true,
    refetchOnMount: "always",
    staleTime: 30_000,
    ...options
  });

export const useChecksheetTemplate = (id, options = {}) =>
  useQuery({
    queryKey: CHECKSHEET_KEYS.template(id),
    queryFn: () => getChecksheetTemplate(id).then((res) => res.data),
    enabled: !!id,
    staleTime: 30_000,
    ...options
  });

export const useCreateChecksheetTemplate = () =>
  useSnackbarMutation(createChecksheetTemplate, [CHECKSHEET_KEYS.all, CHECKSHEET_KEYS.templatesBase], "Checksheet template created successfully");

export const useUpdateChecksheetTemplate = (id) =>
  useSnackbarMutation((data) => updateChecksheetTemplate(id, data), [CHECKSHEET_KEYS.all, CHECKSHEET_KEYS.templatesBase, CHECKSHEET_KEYS.template(id)], "Checksheet template updated successfully");

export const useAppendChecksheetTemplateItems = (id) =>
  useSnackbarMutation(
    (data) => appendChecksheetTemplateItems(id, data),
    [CHECKSHEET_KEYS.all, CHECKSHEET_KEYS.templatesBase, CHECKSHEET_KEYS.template(id)],
    "Template rows appended successfully"
  );

export const useAppendChecksheetSubmissionTemplateItems = (id) =>
  useSnackbarMutation(
    (data) => appendChecksheetSubmissionTemplateItems(id, data),
    [CHECKSHEET_KEYS.all, CHECKSHEET_KEYS.submissionBase(id)],
    "Rows appended to transaction successfully"
  );

export const useDeleteChecksheetTemplate = () =>
  useSnackbarMutation(deleteChecksheetTemplate, [CHECKSHEET_KEYS.all, CHECKSHEET_KEYS.templatesBase], "Checksheet template deleted successfully");

export const useUploadChecksheetTemplateImage = () => {
  const { enqueueSnackbar } = useSnackbar();

  return useMutation({
    mutationFn: uploadChecksheetTemplateImage,
    onError: (error) => {
      enqueueSnackbar(error.message || "Image upload failed", { variant: "error" });
    }
  });
};

export const useChecksheetSubmissions = (params = {}, options = {}) =>
  useQuery({
    queryKey: CHECKSHEET_KEYS.submissions(params),
    queryFn: () => getChecksheetSubmissions(params).then((res) => res.data),
    keepPreviousData: true,
    staleTime: 30_000,
    ...options
  });

export const useChecksheetMonthlyResults = (params = {}, options = {}) =>
  useQuery({
    queryKey: CHECKSHEET_KEYS.monthlyResults(params),
    queryFn: () => getChecksheetMonthlyResults(params).then((res) => res.data),
    keepPreviousData: true,
    staleTime: 30_000,
    ...options
  });

export const useChecksheetLineStartStatus = (params = {}, options = {}) =>
  useQuery({
    queryKey: CHECKSHEET_KEYS.lineStartStatus(params),
    queryFn: () => getChecksheetLineStartStatus(params).then((res) => res.data),
    keepPreviousData: true,
    staleTime: 30_000,
    ...options
  });

export const useRepairHistory = (params = {}, options = {}) =>
  useQuery({
    queryKey: CHECKSHEET_KEYS.repairHistory(params),
    queryFn: () => getRepairHistory(params).then((res) => res.data),
    keepPreviousData: true,
    staleTime: 5_000,
    ...options
  });

export const useChecksheetSubmission = (id, options = {}) =>
  useQuery({
    queryKey: CHECKSHEET_KEYS.submission(id, options?.params),
    queryFn: () => getChecksheetSubmission(id, options?.params).then((res) => res.data),
    enabled: !!id,
    staleTime: 5_000,
    ...options
  });

export const useChecksheetSubmissionMonthlyView = (id, params, options = {}) =>
  useQuery({
    queryKey: CHECKSHEET_KEYS.submissionMonthlyView(id, params),
    queryFn: () => getChecksheetSubmissionMonthlyView(id, params).then((res) => res.data),
    enabled: !!id && !!params?.year && !!params?.month,
    staleTime: 5_000,
    ...options
  });

export const useCreateChecksheetSubmission = () =>
  useSnackbarMutation(createChecksheetSubmission, [CHECKSHEET_KEYS.all], "Checksheet submission created successfully");

export const useUpdateChecksheetSubmission = (id) =>
  useSnackbarMutation((data) => updateChecksheetSubmission(id, data), [CHECKSHEET_KEYS.all, CHECKSHEET_KEYS.submissionBase(id)], "Checksheet submission updated successfully");

export const useDeleteChecksheetSubmission = () =>
  useSnackbarMutation(deleteChecksheetSubmission, [CHECKSHEET_KEYS.all], "Checksheet transaction deleted successfully");

export const useCreateInspectionRecord = (submissionId) =>
  useSnackbarMutation((data) => createInspectionRecord(submissionId, data), [CHECKSHEET_KEYS.submissionBase(submissionId), ["checksheets", "submission", submissionId, "monthly-view"]], "Inspection record created successfully");

export const useUpdateInspectionRecord = (submissionId, recordId) =>
  useSnackbarMutation((data) => updateInspectionRecord(submissionId, recordId, data), [CHECKSHEET_KEYS.submissionBase(submissionId), ["checksheets", "submission", submissionId, "monthly-view"]], "Inspection record updated successfully");

export const useDeleteInspectionRecord = (submissionId) =>
  useSnackbarMutation((recordId) => deleteInspectionRecord(submissionId, recordId), [CHECKSHEET_KEYS.submissionBase(submissionId), ["checksheets", "submission", submissionId, "monthly-view"]], "Inspection record deleted successfully");

export const useApproveDailyInspectionStep = (submissionId) =>
  useSnackbarMutation(
    ({ recordId, stepId }) => approveDailyInspectionStep(submissionId, recordId, stepId),
    [CHECKSHEET_KEYS.submissionBase(submissionId), ["checksheets", "submission", submissionId, "monthly-view"]],
    "Daily approval recorded successfully"
  );

export const useCreateRepairRecord = (submissionId) =>
  useSnackbarMutation((data) => createRepairRecord(submissionId, data), [CHECKSHEET_KEYS.submissionBase(submissionId), ["checksheets", "pending-repairs"]], "Repair record created successfully");

export const useUpdateRepairRecord = (submissionId, recordId) =>
  useSnackbarMutation((data) => updateRepairRecord(submissionId, recordId, data), [CHECKSHEET_KEYS.submissionBase(submissionId), ["checksheets", "pending-repairs"]], "Repair record updated successfully");

export const useDeleteRepairRecord = (submissionId) =>
  useSnackbarMutation((recordId) => deleteRepairRecord(submissionId, recordId), [CHECKSHEET_KEYS.submissionBase(submissionId), ["checksheets", "pending-repairs"]], "Repair record deleted successfully");

export const usePendingRepairRecords = (params = {}, options = {}) =>
  useQuery({
    queryKey: CHECKSHEET_KEYS.pendingRepairs(params),
    queryFn: () => getPendingRepairRecords(params).then((res) => res.data),
    keepPreviousData: true,
    staleTime: 5_000,
    ...options
  });

export const useApproveRepairRecord = () =>
  useSnackbarMutation(
    ({ submissionId, recordId }) => approveRepairRecord(submissionId, recordId),
    [["checksheets", "pending-repairs"], CHECKSHEET_KEYS.all],
    "Repair approval recorded successfully"
  );

export const useCancelRepairRecordApproval = () =>
  useSnackbarMutation(
    ({ submissionId, recordId }) => cancelRepairRecordApproval(submissionId, recordId),
    [["checksheets", "pending-repairs"], CHECKSHEET_KEYS.all],
    "Repair approval cancelled successfully"
  );

export const useApprovalTemplates = (params = {}, options = {}) =>
  useQuery({
    queryKey: CHECKSHEET_KEYS.approvalTemplates(params),
    queryFn: () => getApprovalTemplates(params).then((res) => res.data),
    keepPreviousData: true,
    staleTime: 30_000,
    ...options
  });

export const useApprovalTemplate = (id, options = {}) =>
  useQuery({
    queryKey: CHECKSHEET_KEYS.approvalTemplate(id),
    queryFn: () => getApprovalTemplate(id).then((res) => res.data),
    enabled: !!id,
    staleTime: 30_000,
    ...options
  });

export const useCreateApprovalTemplate = () =>
  useSnackbarMutation(createApprovalTemplate, [CHECKSHEET_KEYS.all], "Approval template created successfully");

export const useUpdateApprovalTemplate = (id) =>
  useSnackbarMutation((data) => updateApprovalTemplate(id, data), [CHECKSHEET_KEYS.all, CHECKSHEET_KEYS.approvalTemplate(id)], "Approval template updated successfully");

export const usePatchApprovalTemplate = (id) =>
  useSnackbarMutation((data) => patchApprovalTemplate(id, data), [CHECKSHEET_KEYS.all, CHECKSHEET_KEYS.approvalTemplate(id)], "Approval template updated successfully");

export const useCreateApprovalRequest = (submissionId) =>
  useSnackbarMutation((data) => createApprovalRequest(submissionId, data), [CHECKSHEET_KEYS.submissionBase(submissionId), ["checksheets", "submission", submissionId, "monthly-view"], ["checksheets", "pending-approvals"]], "Approval request created successfully");

export const useCancelApprovalRequest = (submissionId) =>
  useSnackbarMutation((requestId) => cancelApprovalRequest(submissionId, requestId), [CHECKSHEET_KEYS.submissionBase(submissionId), ["checksheets", "submission", submissionId, "monthly-view"], ["checksheets", "pending-approvals"]], "Approval request cancelled successfully");

export const useApprovalRequest = (submissionId, requestId, options = {}) =>
  useQuery({
    queryKey: CHECKSHEET_KEYS.approvalRequest(submissionId, requestId),
    queryFn: () => getApprovalRequest(submissionId, requestId).then((res) => res.data),
    enabled: !!submissionId && !!requestId,
    staleTime: 5_000,
    ...options
  });

export const usePendingApprovalRequests = (params = {}, options = {}) =>
  useQuery({
    queryKey: CHECKSHEET_KEYS.pendingApprovals(params),
    queryFn: () => getPendingApprovalRequests(params).then((res) => res.data),
    keepPreviousData: true,
    staleTime: 5_000,
    ...options
  });

export const useRespondApprovalRequest = () =>
  useSnackbarMutation(
    ({ requestId, stepId, data }) => respondApprovalRequest(requestId, stepId, data),
    [["checksheets", "pending-approvals"], CHECKSHEET_KEYS.all],
    "Approval response submitted successfully"
  );
