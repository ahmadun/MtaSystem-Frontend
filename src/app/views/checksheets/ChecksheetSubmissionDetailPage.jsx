import { useEffect, useMemo, useState } from "react";
import { useNavigate, useParams } from "react-router-dom";
import {
  Alert,
  Box,
  Button,
  Chip,
  Dialog,
  DialogActions,
  DialogContent,
  DialogTitle,
  FormControlLabel,
  IconButton,
  MenuItem,
  Paper,
  RadioGroup,
  Radio,
  Stack,
  Table,
  TableBody,
  TableCell,
  TableContainer,
  TableHead,
  TableRow,
  TextField,
  Typography,
  ButtonGroup
} from "@mui/material";
import CalendarMonthOutlinedIcon from "@mui/icons-material/CalendarMonthOutlined";
import DeleteOutlineIcon from "@mui/icons-material/DeleteOutline";
import SendOutlinedIcon from "@mui/icons-material/SendOutlined";
import { AdapterDateFns } from "@mui/x-date-pickers/AdapterDateFnsV3";
import { DatePicker, LocalizationProvider } from "@mui/x-date-pickers";
import { ConfirmationDialog } from "app/components";
import useAuth from "app/hooks/useAuth";
import {
  useApproveDailyInspectionStep,
  useApproveRepairRecord,
  useApprovalRequest,
  useApprovalTemplates,
  useChecksheetMachines,
  useChecksheetSubmission,
  useChecksheetSubmissionMonthlyView,
  useCreateInspectionRecord,
  useCreateRepairRecord,
  useDeleteInspectionRecord,
  useDeleteRepairRecord,
  useCreateApprovalRequest,
  useCancelApprovalRequest,
  useDeleteChecksheetSubmission,
  useUpdateChecksheetSubmission,
  useUpdateInspectionRecord
} from "app/hooks/useChecksheets";

const FIXED_OPTIONS = ["OK", "NG", "FIX"];
function formatSubmissionStatus(status) {
  return typeof status === "string" ? status.toUpperCase() : "-";
}

function createEmptyRepairForm() {
  return {
    repairFormKey: "",
    repairDate: "",
    damageDescription: "",
    repairDescription: "",
    note: ""
  };
}

function createRepairFormsState(repairForms) {
  return (repairForms ?? []).reduce((accumulator, repairForm) => {
    accumulator[repairForm.formKey] = {
      repairFormKey: repairForm.formKey,
      repairDate: "",
      damageDescription: "",
      repairDescription: "",
      note: ""
    };
    return accumulator;
  }, {});
}

function createInitialEntryValues(items) {
  return items.reduce((accumulator, item) => {
    const itemId = item.id ?? item.templateItemId;
    accumulator[itemId] = {
      templateItemId: itemId,
      resultValue: "",
      remark: ""
    };
    return accumulator;
  }, {});
}

function createEntryValuesFromRecord(items, record) {
  const initialValues = createInitialEntryValues(items);

  if (!record) {
    return initialValues;
  }

  record.values.forEach((value) => {
    if (!initialValues[value.templateItemId]) {
      return;
    }

    initialValues[value.templateItemId] = {
      templateItemId: value.templateItemId,
      resultValue: value.resultValue ?? "",
      remark: value.remark ?? ""
    };
  });

  return initialValues;
}

function parseYearMonth(dateString) {
  if (!dateString) return null;
  const [year, month] = String(dateString).split("-").map(Number);
  if (!year || !month) return null;
  return { year, month };
}

function dateValueToDate(dateValue) {
  if (!dateValue) {
    return null;
  }

  const [year, month, day] = String(dateValue).split("-").map(Number);
  if (!year || !month || !day) {
    return null;
  }

  return new Date(year, month - 1, day);
}

function dateToDateValue(date) {
  if (!(date instanceof Date) || Number.isNaN(date.getTime())) {
    return "";
  }

  return `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, "0")}-${String(date.getDate()).padStart(2, "0")}`;
}

function formatMonthPeriod(dateValue) {
  if (!dateValue) {
    return "-";
  }

  const parsedDate = new Date(`${String(dateValue).slice(0, 7)}-01T00:00:00`);
  if (Number.isNaN(parsedDate.getTime())) {
    return String(dateValue).slice(0, 7) || "-";
  }

  return new Intl.DateTimeFormat("en-US", {
    month: "long",
    year: "numeric"
  }).format(parsedDate);
}

function normalizeChecksheetMode(mode, fallback = "") {
  const normalizedMode = String(mode || "").toLowerCase().trim();

  if (["monthly", "regular", "reguler"].includes(normalizedMode)) {
    return "regular";
  }

  if (normalizedMode === "daily") {
    return "daily";
  }

  return fallback ? normalizeChecksheetMode(fallback, "") : normalizedMode;
}

function mapRecordTypeToUi(recordType) {
  return normalizeChecksheetMode(recordType, "daily");
}

function normalizeInspectionEntryMode(value) {
  return String(value || "").trim().toLowerCase() === "board" ? "board" : "date";
}

function getLatestRecordForMode(records, mode) {
  const normalizedMode = normalizeChecksheetMode(mode);
  return [...(records ?? [])]
    .filter((record) => mapRecordTypeToUi(record.recordType) === normalizedMode)
    .sort((left, right) => {
      const leftDate = left.inspectionDate ? new Date(left.inspectionDate).getTime() : 0;
      const rightDate = right.inspectionDate ? new Date(right.inspectionDate).getTime() : 0;
      return rightDate - leftDate || right.id - left.id;
    })[0] ?? null;
}

function getRecordForModeAndDate(records, mode, inspectionDate) {
  if (!inspectionDate) {
    return null;
  }

  const normalizedMode = normalizeChecksheetMode(mode);
  return [...(records ?? [])]
    .filter((record) =>
      mapRecordTypeToUi(record.recordType) === normalizedMode &&
      String(record.inspectionDate ?? "") === String(inspectionDate)
    )
    .sort((left, right) => right.id - left.id)[0] ?? null;
}

function normalizeBoardCode(value) {
  return String(value ?? "").trim().toUpperCase();
}

function buildInspectionNote(note, boardCode) {
  const cleanNote = String(note ?? "").trim();
  return cleanNote || null;
}

function getRecordBoardCode(record) {
  return normalizeBoardCode(
    record?.boardCode ??
    record?.boardNumber ??
    record?.boardNo ??
    record?.sampleCode ??
    record?.sampleNumber
  );
}

function getRecordForModeAndBoardCode(records, mode, boardCode) {
  const normalizedBoardCode = normalizeBoardCode(boardCode);
  if (!normalizedBoardCode) {
    return null;
  }

  const normalizedMode = normalizeChecksheetMode(mode);
  return [...(records ?? [])]
    .filter((record) =>
      mapRecordTypeToUi(record.recordType) === normalizedMode &&
      getRecordBoardCode(record) === normalizedBoardCode
    )
    .sort((left, right) => right.id - left.id)[0] ?? null;
}

function toTitleCase(value) {
  return String(value)
    .replace(/([a-z0-9])([A-Z])/g, "$1 $2")
    .replace(/[_-]+/g, " ")
    .replace(/\s+/g, " ")
    .trim()
    .replace(/^./, (char) => char.toUpperCase());
}

function getApproverDisplayName(person) {
  return person?.fullName || person?.approvedByFullName || person?.username || person?.approvedByUsername || "-";
}

function getStepAccessNames(step) {
  const approvers = step?.approvers ?? [];
  if (approvers.length > 0) {
    return approvers.map(getApproverDisplayName).join(", ");
  }

  return getApproverDisplayName(step?.approver);
}

function stepIncludesCurrentUser(step, userId) {
  const normalizedUserId = Number(userId);
  if (!normalizedUserId) {
    return false;
  }

  const singleApproverId = Number(step?.approver?.userId);
  if (singleApproverId && singleApproverId === normalizedUserId) {
    return true;
  }

  return (step?.approvers ?? []).some((approver) => Number(approver?.userId) === normalizedUserId);
}

function parseColumnOptions(optionsJson) {
  if (!optionsJson) {
    return {};
  }

  try {
    return JSON.parse(optionsJson);
  } catch {
    return {};
  }
}

function normalizeMergeValue(value) {
  return String(value ?? "").trim();
}

function buildRowSpanMap(items, columns) {
  const mergeState = {};

  columns.forEach((column) => {
    const columnOptions = parseColumnOptions(column.optionsJson);
    if (!(column.enableRowSpan ?? columnOptions.enableRowSpan)) {
      return;
    }

    const columnKey = column.columnKey;
    mergeState[columnKey] = {};

    let groupStartIndex = 0;
    let previousValue = normalizeMergeValue(items[0]?.data?.[columnKey]);

    for (let rowIndex = 1; rowIndex <= items.length; rowIndex += 1) {
      const currentValue = normalizeMergeValue(items[rowIndex]?.data?.[columnKey]);
      const isGroupBoundary = rowIndex === items.length || currentValue !== previousValue || !previousValue;

      if (isGroupBoundary) {
        const rowSpan = rowIndex - groupStartIndex;

        mergeState[columnKey][groupStartIndex] = {
          hidden: false,
          rowSpan
        };

        for (let hiddenIndex = groupStartIndex + 1; hiddenIndex < rowIndex; hiddenIndex += 1) {
          mergeState[columnKey][hiddenIndex] = {
            hidden: rowSpan > 1,
            rowSpan: 1
          };
        }

        groupStartIndex = rowIndex;
        previousValue = currentValue;
      }
    }
  });

  return mergeState;
}

export default function ChecksheetSubmissionDetailPage() {
  const { id } = useParams();
  const navigate = useNavigate();
  const { user } = useAuth();
  const submissionId = Number(id);
  const [selectedMode, setSelectedMode] = useState("");
  const {
    data: baseSubmission,
    isLoading: isBaseLoading,
    isError: isBaseError,
    error: baseError
  } = useChecksheetSubmission(submissionId);
  const checksheetMode = normalizeChecksheetMode(selectedMode || baseSubmission?.checksheetMode || "");
  const { data: submission, isLoading, isError, error } = useChecksheetSubmission(submissionId, {
    params: checksheetMode ? { checksheetMode } : undefined,
    enabled: !!submissionId && !!checksheetMode
  });
  const { data: approvalTemplates } = useApprovalTemplates({ page: 1, pageSize: 100, isActive: true });
  const createInspectionMutation = useCreateInspectionRecord(submissionId);
  const { data: machinesPage } = useChecksheetMachines({ page: 1, pageSize: 100 });
  const updateSubmissionMutation = useUpdateChecksheetSubmission(submissionId);
  const deleteSubmissionMutation = useDeleteChecksheetSubmission();
  const createRepairMutation = useCreateRepairRecord(submissionId);
  const approveRepairMutation = useApproveRepairRecord();
  const deleteInspectionMutation = useDeleteInspectionRecord(submissionId);
  const deleteRepairMutation = useDeleteRepairRecord(submissionId);
  const createApprovalMutation = useCreateApprovalRequest(submissionId);
  const cancelApprovalMutation = useCancelApprovalRequest(submissionId);
  const approveDailyStepMutation = useApproveDailyInspectionStep(submissionId);
  const [approvalTemplateId, setApprovalTemplateId] = useState("");
  const [inspectionDate, setInspectionDate] = useState("");
  const [boardCode, setBoardCode] = useState("");
  const [inspectionShift, setInspectionShift] = useState("1");
  const [inspectionNote, setInspectionNote] = useState("");
  const [entryValues, setEntryValues] = useState({});
  const availableRepairForms = useMemo(
    () => (submission?.availableRepairForms?.length ? submission.availableRepairForms : [{ formKey: "repair-form-1", title: "Repair Entry", sortOrder: 1 }]),
    [submission?.availableRepairForms]
  );
  const [repairFormsState, setRepairFormsState] = useState({});
  const [activeRepairDialogKey, setActiveRepairDialogKey] = useState("");
  const [deleteTarget, setDeleteTarget] = useState(null);
  const [cancelSubmissionOpen, setCancelSubmissionOpen] = useState(false);

  const inspectionRecords = submission?.inspectionRecords ?? [];
  const latestInspectionRecord = useMemo(
    () => getLatestRecordForMode(inspectionRecords, checksheetMode),
    [inspectionRecords, checksheetMode]
  );
  const inspectionEntryMode = useMemo(
    () => normalizeInspectionEntryMode(submission?.template?.inspectionEntryMode),
    [submission?.template?.inspectionEntryMode]
  );
  const selectedInspectionRecord = useMemo(
    () => {
      if (inspectionEntryMode === "board") {
        return getRecordForModeAndBoardCode(inspectionRecords, checksheetMode, boardCode);
      }

      return getRecordForModeAndDate(inspectionRecords, checksheetMode, inspectionDate);
    },
    [boardCode, checksheetMode, inspectionDate, inspectionEntryMode, inspectionRecords]
  );
  const updateInspectionMutation = useUpdateInspectionRecord(submissionId, selectedInspectionRecord?.id);
  const monthlyParams = useMemo(
    () => {
      const base = parseYearMonth(
        selectedInspectionRecord?.inspectionDate ||
        inspectionDate ||
        latestInspectionRecord?.inspectionDate ||
        submission?.inspectionDate
      );
      return base ? { ...base, checksheetMode } : null;
    },
    [checksheetMode, inspectionDate, latestInspectionRecord?.inspectionDate, selectedInspectionRecord?.inspectionDate, submission?.inspectionDate]
  );
  const { data: monthlyView } = useChecksheetSubmissionMonthlyView(submissionId, monthlyParams, {
    enabled: !!submissionId && !!monthlyParams?.year && !!monthlyParams?.month
  });
  const currentApprovalRequestId = submission?.currentApprovalRequestId ?? null;
  const { data: currentApprovalRequest } = useApprovalRequest(submissionId, currentApprovalRequestId, {
    enabled: !!submissionId && !!currentApprovalRequestId && !!user?.id
  });
  const templateColumns = useMemo(() => {
    if ((submission?.template?.columns?.length ?? 0) > 0) {
      return submission.template.columns;
    }

    const firstItem = monthlyView?.items?.[0];
    if (!firstItem?.itemData) {
      return [];
    }

    return Object.keys(firstItem.itemData).map((key, index) => ({
      id: `${key}-${index}`,
      columnKey: key,
      label: toTitleCase(key)
    }));
  }, [monthlyView?.items, submission?.template?.columns]);
  const templateItems = useMemo(() => {
    return submission?.template?.items ?? [];
  }, [submission?.template?.items]);
  const rowSpanMap = useMemo(() => buildRowSpanMap(templateItems, templateColumns), [templateItems, templateColumns]);
  const isOwner = Number(user?.id ?? 0) === Number(submission?.createdByUserId ?? 0);
  const isDraft = submission?.status === "draft";
  const hasRespondedToCurrentApprovalRequest = useMemo(
    () =>
      (currentApprovalRequest?.steps ?? []).some((step) =>
        (step.responses ?? []).some((response) => Number(response.userId) === Number(user?.id ?? 0))
      ),
    [currentApprovalRequest?.steps, user?.id]
  );
  const canCancelSubmission =
    !!currentApprovalRequestId &&
    ["submitted", "approved", "rejected"].includes(submission?.status) &&
    (isOwner || hasRespondedToCurrentApprovalRequest);
  const machines = useMemo(() => machinesPage?.items ?? [], [machinesPage?.items]);
  const currentMachine = machines.find((item) => item.machineCode === submission?.machineCode);
  const machineModes = useMemo(() => {
    const modes = currentMachine?.modes?.length ? currentMachine.modes : [submission?.checksheetMode ?? "daily"];
    return [...new Set(modes.map((mode) => normalizeChecksheetMode(mode)).filter(Boolean))];
  }, [currentMachine?.modes, submission?.checksheetMode]);
  const isInspectionMutationPending = createInspectionMutation.isPending || updateInspectionMutation.isPending || approveDailyStepMutation.isPending;
  const currentDaySummary = useMemo(
    () => (selectedInspectionRecord?.id ? monthlyView?.daySummaries?.find((entry) => entry.recordId === selectedInspectionRecord.id) ?? null : null),
    [monthlyView?.daySummaries, selectedInspectionRecord?.id]
  );
  const approvalSteps = useMemo(
    () =>
      [...(
        checksheetMode === "regular"
          ? monthlyView?.regularApprovalSteps ?? submission?.template?.regularApprovalSteps ?? []
          : monthlyView?.dailyApprovalSteps ?? submission?.template?.dailyApprovalSteps ?? []
      )].sort((left, right) => left.stepOrder - right.stepOrder),
    [
      checksheetMode,
      monthlyView?.dailyApprovalSteps,
      monthlyView?.regularApprovalSteps,
      submission?.template?.dailyApprovalSteps,
      submission?.template?.regularApprovalSteps
    ]
  );
  const recordValueMap = useMemo(() => {
    const map = new Map();
    (selectedInspectionRecord?.values ?? []).forEach((value) => {
      map.set(value.templateItemId, {
        resultValue: value.resultValue ?? "",
        remark: value.remark ?? ""
      });
    });
    return map;
  }, [selectedInspectionRecord?.values]);
  const templateItemIds = useMemo(() => templateItems.map((item) => item.id ?? item.templateItemId).join(","), [templateItems]);
  const inspectionValueSignature = useMemo(
    () =>
      (selectedInspectionRecord?.values ?? [])
        .map((value) => `${value.templateItemId}:${value.resultValue ?? ""}:${value.remark ?? ""}`)
        .join("|"),
    [selectedInspectionRecord?.values]
  );

  useEffect(() => {
    if (!selectedMode && baseSubmission?.checksheetMode) {
      setSelectedMode(normalizeChecksheetMode(baseSubmission.checksheetMode));
    }
  }, [baseSubmission?.checksheetMode, selectedMode]);

  useEffect(() => {
    if (inspectionEntryMode === "board") {
      setBoardCode(getRecordBoardCode(latestInspectionRecord) || "");
      return;
    }

    setBoardCode("");
    setInspectionDate(latestInspectionRecord?.inspectionDate ?? submission?.inspectionDate ?? "");
  }, [checksheetMode, inspectionEntryMode, latestInspectionRecord?.id, latestInspectionRecord?.inspectionDate, submission?.inspectionDate]);

  useEffect(() => {
    setInspectionShift(selectedInspectionRecord?.shift ?? submission?.shift ?? "1");
    setInspectionNote(selectedInspectionRecord?.note ?? "");
    setEntryValues(
      createEntryValuesFromRecord(
        templateItems,
        selectedInspectionRecord
      )
    );
  }, [
    selectedInspectionRecord?.id,
    selectedInspectionRecord?.inspectionDate,
    selectedInspectionRecord?.shift,
    selectedInspectionRecord?.note,
    selectedInspectionRecord?.updatedAt,
    inspectionDate,
    boardCode,
    inspectionValueSignature,
    submission?.shift,
    templateItemIds
  ]);

  useEffect(() => {
    setRepairFormsState(createRepairFormsState(availableRepairForms));
  }, [availableRepairForms]);

  const hasAnyInspectionValue = useMemo(
    () => Object.values(entryValues).some((value) => value.resultValue?.trim() || value.remark?.trim()),
    [entryValues]
  );
  const activeRepairFormDefinition = useMemo(
    () => availableRepairForms.find((repairForm) => repairForm.formKey === activeRepairDialogKey) ?? null,
    [activeRepairDialogKey, availableRepairForms]
  );
  const repairRecordsByFormKey = useMemo(() => {
    return (submission?.repairRecords ?? []).reduce((accumulator, record) => {
      const key = record.repairFormKey || "repair-form-1";
      if (!accumulator[key]) {
        accumulator[key] = [];
      }
      accumulator[key].push(record);
      return accumulator;
    }, {});
  }, [submission?.repairRecords]);

  if (isBaseLoading || isLoading) {
    return <Box sx={{ p: 3 }}><Typography color="text.secondary">Loading checksheet...</Typography></Box>;
  }

  if (isBaseError || isError || !submission) {
    return <Box sx={{ p: 3 }}><Alert severity="error">{baseError?.message || error?.message || "Checksheet not found."}</Alert></Box>;
  }

  const handleInspectionValueChange = (itemId, patch) => {
    setEntryValues((current) => ({
      ...current,
      [itemId]: {
        templateItemId: itemId,
        resultValue: current[itemId]?.resultValue ?? "",
        remark: current[itemId]?.remark ?? "",
        ...patch
      }
    }));
  };

  const getEntryValue = (itemId, field) => {
    const localValue = entryValues[itemId]?.[field];
    if (localValue !== undefined) {
      return localValue;
    }

    return recordValueMap.get(itemId)?.[field] ?? "";
  };

  const handleSaveInspectionRecord = () => {
    const resolvedInspectionDate = inspectionEntryMode === "board"
      ? selectedInspectionRecord?.inspectionDate || submission?.inspectionDate || null
      : inspectionDate || selectedInspectionRecord?.inspectionDate || submission?.inspectionDate || null;
    const payload = {
      recordType: checksheetMode,
      inspectionDate: resolvedInspectionDate,
      boardCode: inspectionEntryMode === "board" ? normalizeBoardCode(boardCode) || null : null,
      shift: inspectionShift || null,
      note: buildInspectionNote(inspectionNote, boardCode),
      values: templateItems
        .map((item) => ({
          templateItemId: item.id,
          resultValue: getEntryValue(item.id, "resultValue"),
          remark: getEntryValue(item.id, "remark")
        }))
        .filter((value) => value.resultValue?.trim() || value.remark?.trim())
    };

    const mutation = selectedInspectionRecord ? updateInspectionMutation : createInspectionMutation;
    mutation.mutate(payload);
  };

  const updateRepairFormValue = (repairFormKey, patch) => {
    setRepairFormsState((current) => ({
      ...current,
      [repairFormKey]: {
        ...(current[repairFormKey] ?? createEmptyRepairForm()),
        repairFormKey,
        ...patch
      }
    }));
  };

  const handleSaveRepairRecord = (repairFormKey) => {
    const currentRepairForm = repairFormsState[repairFormKey] ?? createEmptyRepairForm();
    createRepairMutation.mutate(
      {
        repairFormKey,
        repairDate: currentRepairForm.repairDate || null,
        damageDescription: currentRepairForm.damageDescription.trim(),
        repairDescription: currentRepairForm.repairDescription.trim(),
        note: currentRepairForm.note.trim() || null
      },
      {
        onSuccess: () => {
          setRepairFormsState((current) => ({
            ...current,
            [repairFormKey]: {
              repairFormKey,
              ...createEmptyRepairForm()
            }
          }));
          setActiveRepairDialogKey((current) => (current === repairFormKey ? "" : current));
        }
      }
    );
  };

  const handleCloseRepairDialog = () => {
    if (createRepairMutation.isPending) {
      return;
    }

    setActiveRepairDialogKey("");
  };

  const canApproveInspectionStep = (step) => {
    if (!currentDaySummary?.recordId) return false;
    if (!user?.id) return false;
    if (!stepIncludesCurrentUser(step, user.id)) return false;

    const alreadyApproved = currentDaySummary.approvals?.some((approval) => approval.stepId === step.id);
    if (alreadyApproved) return false;

    return approvalSteps
      .filter((entry) => entry.stepOrder < step.stepOrder)
      .every((entry) => currentDaySummary.approvals?.some((approval) => approval.stepId === entry.id));
  };

  return (
    <LocalizationProvider dateAdapter={AdapterDateFns}>
      <Box sx={{ p: 3 }}>
        <Stack spacing={3}>
          <Paper variant="outlined" sx={{ p: 3 }}>
            <Stack direction={{ xs: "column", lg: "row" }} justifyContent="space-between" spacing={2}>
              <Box>
                <Typography variant="h5" fontWeight={700}>{submission.machineCode}</Typography>
                <Typography variant="body2" color="text.secondary">
                  {submission.location} | {submission.lineName}
                </Typography>
              </Box>
              <Stack direction="row" spacing={1} flexWrap="wrap">
                <Chip label={submission.checksheetMode.toUpperCase()} />
                <Chip
                  label={formatSubmissionStatus(submission.status)}
                  color={submission.status === "approved" ? "success" : submission.status === "submitted" ? "warning" : submission.status === "rejected" ? "error" : "default"}
                />
              </Stack>
            </Stack>

            <Stack direction={{ xs: "column", md: "row" }} spacing={3} sx={{ mt: 2 }} flexWrap="wrap">
              <Typography variant="body2"><strong>Month Period:</strong> {formatMonthPeriod(submission.inspectionDate)}</Typography>
              <Typography variant="body2"><strong>Shift:</strong> {submission.shift}</Typography>
              <Typography variant="body2"><strong>Group:</strong> {submission.groupCodes?.join(", ") || "-"}</Typography>
              <Typography variant="body2"><strong>Template:</strong> {submission.template?.name || "-"}</Typography>
            </Stack>

            <Stack direction={{ xs: "column", md: "row" }} spacing={2} sx={{ mt: 2 }} alignItems={{ md: "center" }}>
              <Stack spacing={0.5}>
                <RadioGroup
                  row
                  value={checksheetMode}
                  onChange={(event) => {
                    const nextMode = event.target.value;
                    setSelectedMode(nextMode);
                    updateSubmissionMutation.mutate({
                      machineCode: submission.machineCode,
                      checksheetMode: nextMode,
                      inspectionDate: submission.inspectionDate,
                      shift: submission.shift,
                      groupCodes: submission.groupCodes ?? []
                    });
                  }}
                  sx={{ gap: 1.5, flexWrap: "wrap" }}
                >
                  {machineModes.map((mode) => (
                    <Paper
                      key={mode}
                      variant="outlined"
                      sx={{
                        px: 0.5,
                        borderRadius: 2,
                        borderColor: checksheetMode === mode ? "primary.main" : "divider",
                        bgcolor: checksheetMode === mode ? "primary.50" : "background.paper"
                      }}
                    >
                      <FormControlLabel
                        value={mode}
                        disabled={!isDraft || updateSubmissionMutation.isPending}
                        control={<Radio size="small" />}
                        label={String(mode).toUpperCase()}
                        sx={{
                          m: 0,
                          px: 1,
                          py: 0.25,
                          minHeight: 40,
                          "& .MuiFormControlLabel-label": {
                            fontSize: 14,
                            fontWeight: 600,
                            letterSpacing: 0.4
                          }
                        }}
                      />
                    </Paper>
                  ))}
                </RadioGroup>
              </Stack>
              {!isDraft && (
                <Typography variant="caption" color="text.secondary">
                  Mode can only be changed in DRAFT status.
                </Typography>
              )}
            </Stack>

            <Stack direction={{ xs: "column", md: "row" }} spacing={2} sx={{ mt: 3 }}>
              <Button
                variant="contained"
                startIcon={<CalendarMonthOutlinedIcon />}
                onClick={() => navigate(`/checksheets/submissions/${submission.id}/monthly`)}
              >
                Open Monthly Detail
              </Button>
              {isDraft && isOwner && (
                <Button
                  color="error"
                  variant="outlined"
                  startIcon={<DeleteOutlineIcon />}
                  disabled={deleteSubmissionMutation.isPending}
                  onClick={() => setDeleteTarget({ type: "submission", id: submission.id })}
                >
                  Delete Transaction
                </Button>
              )}
            </Stack>
          </Paper>

          <Paper variant="outlined" sx={{ p: 3 }}>
            <Typography variant="h6" sx={{ mb: 2 }}>Summary</Typography>
            <Stack direction={{ xs: "column", md: "row" }} spacing={2} flexWrap="wrap">
              <Chip label={`${submission.inspectionRecords?.length ?? 0} inspection records`} variant="outlined" />
              <Chip label={`${submission.repairRecords?.length ?? 0} repair records`} variant="outlined" />
            </Stack>
          </Paper>

          <Paper variant="outlined" sx={{ p: 3 }}>
            <Stack direction={{ xs: "column", md: "row" }} justifyContent="space-between" spacing={2} sx={{ mb: 2 }}>
              <Box>
                <Typography variant="h6">Inspection Entry</Typography>
              </Box>
              <Stack direction={{ xs: "column", md: "row" }} spacing={2} sx={{ minWidth: { md: 320 } }}>
                {inspectionEntryMode === "board" ? (
                  <TextField
                    label="Board Code / Number"
                    value={boardCode}
                    onChange={(event) => setBoardCode(normalizeBoardCode(event.target.value))}
                    placeholder="A1"
                    size="small"
                    fullWidth
                  />
                ) : (
                  <DatePicker
                    label="Inspection Date"
                    value={dateValueToDate(inspectionDate)}
                    onChange={(value) => setInspectionDate(dateToDateValue(value))}
                    format="yyyy-MM-dd"
                    slotProps={{
                      textField: {
                        size: "small",
                        fullWidth: true
                      }
                    }}
                  />
                )}
                <TextField
                  select
                  label="Shift"
                  value={inspectionShift}
                  onChange={(event) => setInspectionShift(event.target.value)}
                  size="small"
                  fullWidth
                >
                  {["1", "2", "3"].map((shift) => (
                    <MenuItem key={shift} value={shift}>Shift {shift}</MenuItem>
                  ))}
                </TextField>
              </Stack>
            </Stack>

            <TextField
              label="Note"
              value={inspectionNote}
              onChange={(event) => setInspectionNote(event.target.value)}
              multiline
              minRows={2}
              fullWidth
              sx={{ mb: 2 }}
            />

            <Box sx={{ overflowX: "auto", mx: -1.5, px: 1.5 }}>
              <TableContainer component={Paper} variant="outlined" sx={{ minWidth: 480 }}>
                <Table
                  size="small"
                  sx={{
                    "& .MuiTableCell-root": {
                      borderRight: 1,
                      borderColor: "divider",
                      verticalAlign: "top"
                    },
                    "& .MuiTableCell-root:last-of-type": {
                      borderRight: 0
                    },
                    "& .MuiTableHead-root .MuiTableCell-root": {
                      fontWeight: 700
                    },
                    "& .MuiTableCell-root[data-merged='true']": {
                      verticalAlign: "middle"
                    }
                  }}
                >
                  <TableHead>
                    <TableRow>
                      {templateColumns.map((column, columnIndex) => (
                        <TableCell key={column.id} sx={{ pl: columnIndex === 0 ? 3 : 2 }}>{column.label}</TableCell>
                      ))}
                      <TableCell sx={{ width: 150, minWidth: 150, pl: 2 }}>Entry</TableCell>
                      <TableCell sx={{ minWidth: 160, pl: 1 }}>Remark</TableCell>
                    </TableRow>
                  </TableHead>
                  <TableBody>
                    {templateItems.map((item, rowIndex) => (
                      <TableRow key={item.id} hover>
                        {templateColumns.map((column, columnIndex) => {
                          const mergeCell = rowSpanMap[column.columnKey]?.[rowIndex];

                          if (mergeCell?.hidden) {
                            return null;
                          }

                          return (
                            <TableCell
                              key={`${item.id}-${column.columnKey}`}
                              rowSpan={mergeCell?.rowSpan ?? 1}
                              data-merged={(mergeCell?.rowSpan ?? 1) > 1 ? "true" : undefined}  // ✅ add this
                              sx={{
                                pl: columnIndex === 0 ? 3 : 2,
                                verticalAlign: "middle"
                              }}
                            >
                              {item.data?.[column.columnKey] || "-"}
                            </TableCell>
                          );
                        })}
                        <TableCell sx={{ width: 150, minWidth: 150, pl: 2 }}>
                          {(item.valueType ?? "fixed") === "fixed" ? (
                            <ButtonGroup
                              size="small"
                              disabled={!isDraft || isInspectionMutationPending}
                              sx={{ flexShrink: 0, whiteSpace: "nowrap" }}
                            >
                              {FIXED_OPTIONS.map((option) => {
                                const isSelected = getEntryValue(item.id, "resultValue") === option;
                                return (
                                  <Button
                                    key={`${item.id}-${option}`}
                                    variant={isSelected ? "contained" : "outlined"}
                                    onClick={() => handleInspectionValueChange(item.id, { resultValue: option })}
                                    sx={{
                                      px: 1,
                                      fontSize: 12,
                                      fontWeight: 600,
                                      minWidth: 40,
                                      whiteSpace: "nowrap"
                                    }}
                                  >
                                    {option}
                                  </Button>
                                );
                              })}
                            </ButtonGroup>
                          ) : (
                            <TextField
                              value={getEntryValue(item.id, "resultValue")}
                              onChange={(e) => handleInspectionValueChange(item.id, { resultValue: e.target.value })}
                              placeholder="Enter value"
                              size="small"
                              fullWidth
                              disabled={!isDraft || isInspectionMutationPending}
                            />
                          )}
                        </TableCell>
                        <TableCell sx={{ pl: 1 }}>
                          <TextField
                            value={getEntryValue(item.id, "remark")}
                            onChange={(event) => handleInspectionValueChange(item.id, { remark: event.target.value })}
                            placeholder="Remark"
                            size="small"
                            fullWidth
                            disabled={!isDraft || isInspectionMutationPending}
                          />
                        </TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              </TableContainer>
            </Box>

            <Stack direction={{ xs: "column", md: "row" }} justifyContent="flex-end" spacing={2} sx={{ mt: 2 }}>
              {isDraft && selectedInspectionRecord && (
                <Button
                  color="error"
                  variant="outlined"
                  disabled={isInspectionMutationPending || deleteInspectionMutation.isPending}
                  onClick={() => setDeleteTarget({ type: "inspection", id: selectedInspectionRecord.id })}
                >
                  Delete Inspection Entry
                </Button>
              )}
              <Button
                variant="contained"
                disabled={!isDraft || !hasAnyInspectionValue || isInspectionMutationPending}
                onClick={handleSaveInspectionRecord}
              >
                {isInspectionMutationPending ? "Saving..." : selectedInspectionRecord ? "Save Changes" : "Save Inspection Record"}
              </Button>
            </Stack>
          </Paper>

          <Paper variant="outlined" sx={{ p: 3 }}>
            <Typography variant="h6" sx={{ mb: 1 }}>
              {checksheetMode === "regular" ? "Regular Approval" : "Daily Approval"}
            </Typography>

            {selectedInspectionRecord?.id ? (
              <Stack spacing={1.5}>
                <Typography variant="body2">
                  {inspectionEntryMode === "board" ? (
                    <>
                      <strong>Board Code:</strong> {getRecordBoardCode(selectedInspectionRecord) || "-"} | <strong>Shift:</strong> {currentDaySummary?.shift || selectedInspectionRecord.shift || "-"}
                    </>
                  ) : (
                    <>
                      <strong>Date:</strong> {selectedInspectionRecord.inspectionDate || "-"} | <strong>Shift:</strong> {currentDaySummary?.shift || selectedInspectionRecord.shift || "-"}
                    </>
                  )}
                </Typography>

                {approvalSteps.length > 0 ? (
                  approvalSteps.map((step) => {
                    const approval = currentDaySummary?.approvals?.find((entry) => entry.stepId === step.id);
                    const canApprove = canApproveInspectionStep(step);

                    return (
                      <Paper key={step.id} variant="outlined" sx={{ p: 2 }}>
                        <Stack direction={{ xs: "column", md: "row" }} justifyContent="space-between" spacing={2} alignItems={{ md: "center" }}>
                          <Box>
                            <Typography fontWeight={600}>{step.stepName}</Typography>
                            <Typography variant="body2" color="text.secondary">
                              Access: {getStepAccessNames(step)}
                            </Typography>
                          </Box>

                          {approval ? (
                            <Chip label={`Approved by ${getApproverDisplayName(approval)}`} color="success" variant="outlined" />
                          ) : canApprove ? (
                            <Button
                              variant="outlined"
                              disabled={approveDailyStepMutation.isPending}
                              onClick={() => approveDailyStepMutation.mutate({ recordId: currentDaySummary.recordId, stepId: step.id })}
                            >
                              Approve
                            </Button>
                          ) : (
                            <Chip label={currentDaySummary?.recordId ? "Waiting previous step / assigned approver" : "Save record first"} variant="outlined" />
                          )}
                        </Stack>
                      </Paper>
                    );
                  })
                ) : (
                  <Typography variant="body2" color="text.secondary">
                    No {checksheetMode === "regular" ? "regular" : "daily"} approval steps are configured on this checksheet template.
                  </Typography>
                )}
              </Stack>
            ) : (
              <Typography variant="body2" color="text.secondary" sx={{ mb: 2 }}>
                Save a {checksheetMode === "regular" ? "regular" : "daily"} inspection record first to start approval.
              </Typography>
            )}
          </Paper>

          <Paper variant="outlined" sx={{ p: 3 }}>
            <Typography variant="h6" sx={{ mb: 2 }}>Month-End Submission</Typography>
            <Typography variant="body2" color="text.secondary" sx={{ mb: 2 }}>
              Use the separate monthly page for horizontal date review and final month-end approval submission.
            </Typography>
            <Stack direction={{ xs: "column", md: "row" }} spacing={2} alignItems={{ md: "center" }}>
              <Button
                variant="outlined"
                startIcon={<CalendarMonthOutlinedIcon />}
                onClick={() => navigate(`/checksheets/submissions/${submission.id}/monthly`)}
              >
                Open Monthly Page
              </Button>
              <TextField
                select
                size="small"
                label="Approval Template"
                value={approvalTemplateId}
                onChange={(event) => setApprovalTemplateId(event.target.value)}
                sx={{ minWidth: 280 }}
              >
                {(approvalTemplates?.items ?? []).map((template) => (
                  <MenuItem key={template.id} value={template.id}>{template.name}</MenuItem>
                ))}
              </TextField>
              <Button
                variant="contained"
                startIcon={<SendOutlinedIcon />}
                disabled={!isDraft || !approvalTemplateId || createApprovalMutation.isPending}
                onClick={() => createApprovalMutation.mutate({
                  templateId: Number(approvalTemplateId),
                  title: `${submission.machineCode} ${submission.inspectionDate} Shift ${submission.shift}`
                })}
              >
                {createApprovalMutation.isPending ? "Submitting..." : "Submit For Approval"}
              </Button>
              {canCancelSubmission && (
                <Button
                  color="warning"
                  variant="outlined"
                  disabled={cancelApprovalMutation.isPending}
                  onClick={() => setCancelSubmissionOpen(true)}
                >
                  {cancelApprovalMutation.isPending ? "Cancelling..." : "Cancel Approval"}
                </Button>
              )}
            </Stack>
            {canCancelSubmission && (
              <Typography variant="caption" color="text.secondary" sx={{ mt: 1.5, display: "block" }}>
                Cancel approval to stop the current request and return this transaction to DRAFT so the checksheet can be corrected and resubmitted.
              </Typography>
            )}
          </Paper>

          <Paper variant="outlined" sx={{ p: 3 }}>
            <Typography variant="h6" sx={{ mb: 2 }}>Repair Entry</Typography>
            <Stack spacing={2}>
              {availableRepairForms.map((repairFormDefinition) => {
                const records = repairRecordsByFormKey[repairFormDefinition.formKey] ?? [];

                return (
                  <Paper key={repairFormDefinition.formKey} variant="outlined" sx={{ p: 2.5 }}>
                    <Stack spacing={2}>
                      <Stack direction={{ xs: "column", md: "row" }} justifyContent="space-between" spacing={2} alignItems={{ md: "center" }}>
                        <Box>
                          <Typography variant="h6">{`${repairFormDefinition.sortOrder}. ${repairFormDefinition.title}`}</Typography>
                          <Typography variant="body2" color="text.secondary">
                            Review saved repair records and register a new one when needed.
                          </Typography>
                        </Box>
                        <Button
                          variant="contained"
                          disabled={!isDraft}
                          onClick={() => setActiveRepairDialogKey(repairFormDefinition.formKey)}
                        >
                          Add Repair Record
                        </Button>
                      </Stack>
                      <Stack spacing={1.5}>
                        <Typography variant="subtitle2">Saved Records</Typography>
                        {records.map((record) => (
                          <Paper key={record.id} variant="outlined" sx={{ p: 2 }}>
                            <Stack direction={{ xs: "column", md: "row" }} justifyContent="space-between" spacing={2}>
                              <Box>
                                <Typography fontWeight={600}>{record.damageDescription}</Typography>
                                <Typography variant="body2" color="text.secondary" sx={{ mt: 0.5 }}>
                                  {record.repairDescription}
                                </Typography>
                                {record.note && (
                                  <Typography variant="body2" color="text.secondary" sx={{ mt: 0.75 }}>
                                    Note: {record.note}
                                  </Typography>
                                )}
                                <Stack direction="row" spacing={1} useFlexGap flexWrap="wrap" sx={{ mt: 1.5 }}>
                                  <Chip size="small" variant="outlined" label={record.repairDate || "No repair date"} />
                                  <Chip size="small" variant="outlined" label={`By ${record.repairedByName || "-"}`} />
                                  <Chip
                                    size="small"
                                    color={record.checkedByAssyUserId ? "success" : "default"}
                                    variant={record.checkedByAssyUserId ? "filled" : "outlined"}
                                    label={`ASSY ${record.checkedByAssyName || "Pending"}`}
                                  />
                                  <Chip
                                    size="small"
                                    color={record.checkedByQaUserId ? "success" : "default"}
                                    variant={record.checkedByQaUserId ? "filled" : "outlined"}
                                    label={`QA ${record.checkedByQaName || "Pending"}`}
                                  />
                                  <Chip
                                    size="small"
                                    color={record.checkedByCoordinatorUserId ? "success" : "default"}
                                    variant={record.checkedByCoordinatorUserId ? "filled" : "outlined"}
                                    label={`MTA ${record.checkedByCoordinatorName || "Pending"}`}
                                  />
                                </Stack>
                              </Box>
                              <Stack direction="row" spacing={1} alignItems="center">
                                {(!record.checkedByAssyUserId || !record.checkedByQaUserId || !record.checkedByCoordinatorUserId) && (
                                  <Button
                                    variant="outlined"
                                    disabled={approveRepairMutation.isPending}
                                    onClick={() => approveRepairMutation.mutate({ submissionId, recordId: record.id })}
                                  >
                                    Approve Next Level
                                  </Button>
                                )}
                                {isDraft && (
                                  <IconButton color="error" onClick={() => setDeleteTarget({ type: "repair", id: record.id })}>
                                    <DeleteOutlineIcon />
                                  </IconButton>
                                )}
                              </Stack>
                            </Stack>
                          </Paper>
                        ))}
                        {records.length === 0 && <Typography variant="body2" color="text.secondary">No repair records yet for this section.</Typography>}
                      </Stack>
                    </Stack>
                  </Paper>
                );
              })}
            </Stack>
          </Paper>
        </Stack>

        <ConfirmationDialog
          open={!!deleteTarget}
          title="Delete Record"
          text={deleteTarget?.type === "submission" ? "Delete this DRAFT checksheet transaction?" : "Delete this checksheet record?"}
          confirmText="Delete"
          confirmColor="error"
          isLoading={deleteInspectionMutation.isPending || deleteRepairMutation.isPending || deleteSubmissionMutation.isPending}
          onConfirmDialogClose={() => setDeleteTarget(null)}
          onYesClick={() => {
            if (!deleteTarget) return;
            if (deleteTarget.type === "submission") {
              deleteSubmissionMutation.mutate(deleteTarget.id, {
                onSuccess: () => navigate("/checksheets/submissions")
              });
              return;
            }
            if (deleteTarget.type === "inspection") {
              deleteInspectionMutation.mutate(deleteTarget.id, { onSuccess: () => setDeleteTarget(null) });
              return;
            }
            deleteRepairMutation.mutate(deleteTarget.id, { onSuccess: () => setDeleteTarget(null) });
          }}
        />

        <ConfirmationDialog
          open={cancelSubmissionOpen}
          title="Cancel Approval"
          text="Cancel the current approval request and return this checksheet transaction to DRAFT so it can be edited again?"
          confirmText="Cancel Approval"
          confirmColor="warning"
          isLoading={cancelApprovalMutation.isPending}
          onConfirmDialogClose={() => setCancelSubmissionOpen(false)}
          onYesClick={() => {
            if (!currentApprovalRequestId) return;
            cancelApprovalMutation.mutate(currentApprovalRequestId, {
              onSuccess: () => setCancelSubmissionOpen(false)
            });
          }}
        />
        <Dialog open={!!activeRepairFormDefinition} onClose={handleCloseRepairDialog} fullWidth maxWidth="sm">
          <DialogTitle>
            {activeRepairFormDefinition
              ? `Add Repair Record: ${activeRepairFormDefinition.sortOrder}. ${activeRepairFormDefinition.title}`
              : "Add Repair Record"}
          </DialogTitle>
          <DialogContent dividers>
            <Stack spacing={2} sx={{ pt: 0.5 }}>
              <TextField
                label="Repair Date"
                type="date"
                value={activeRepairFormDefinition ? (repairFormsState[activeRepairFormDefinition.formKey] ?? createEmptyRepairForm()).repairDate : ""}
                onChange={(event) => {
                  if (!activeRepairFormDefinition) return;
                  updateRepairFormValue(activeRepairFormDefinition.formKey, { repairDate: event.target.value });
                }}
                InputLabelProps={{ shrink: true }}
                size="small"
                disabled={createRepairMutation.isPending}
              />
              <TextField
                label="Damage Description"
                value={activeRepairFormDefinition ? (repairFormsState[activeRepairFormDefinition.formKey] ?? createEmptyRepairForm()).damageDescription : ""}
                onChange={(event) => {
                  if (!activeRepairFormDefinition) return;
                  updateRepairFormValue(activeRepairFormDefinition.formKey, { damageDescription: event.target.value });
                }}
                multiline
                minRows={2}
                size="small"
                disabled={createRepairMutation.isPending}
              />
              <TextField
                label="Repair Description"
                value={activeRepairFormDefinition ? (repairFormsState[activeRepairFormDefinition.formKey] ?? createEmptyRepairForm()).repairDescription : ""}
                onChange={(event) => {
                  if (!activeRepairFormDefinition) return;
                  updateRepairFormValue(activeRepairFormDefinition.formKey, { repairDescription: event.target.value });
                }}
                multiline
                minRows={2}
                size="small"
                disabled={createRepairMutation.isPending}
              />
              <TextField
                label="Note"
                value={activeRepairFormDefinition ? (repairFormsState[activeRepairFormDefinition.formKey] ?? createEmptyRepairForm()).note : ""}
                onChange={(event) => {
                  if (!activeRepairFormDefinition) return;
                  updateRepairFormValue(activeRepairFormDefinition.formKey, { note: event.target.value });
                }}
                multiline
                minRows={2}
                size="small"
                disabled={createRepairMutation.isPending}
              />
            </Stack>
          </DialogContent>
          <DialogActions>
            <Button onClick={handleCloseRepairDialog} disabled={createRepairMutation.isPending}>
              Cancel
            </Button>
            <Button
              variant="contained"
              disabled={
                !activeRepairFormDefinition ||
                !(repairFormsState[activeRepairFormDefinition.formKey] ?? createEmptyRepairForm()).damageDescription.trim() ||
                !(repairFormsState[activeRepairFormDefinition.formKey] ?? createEmptyRepairForm()).repairDescription.trim() ||
                createRepairMutation.isPending
              }
              onClick={() => {
                if (!activeRepairFormDefinition) return;
                handleSaveRepairRecord(activeRepairFormDefinition.formKey);
              }}
            >
              {createRepairMutation.isPending ? "Saving..." : "Save Repair Record"}
            </Button>
          </DialogActions>
        </Dialog>
      </Box>
    </LocalizationProvider>
  );
}
