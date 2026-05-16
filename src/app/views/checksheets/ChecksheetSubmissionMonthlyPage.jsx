import { useEffect, useMemo, useState } from "react";
import { useNavigate, useParams, useSearchParams } from "react-router-dom";
import {
  Alert,
  Box,
  Button,
  Chip,
  Dialog,
  DialogActions,
  DialogContent,
  DialogTitle,
  IconButton,
  MenuItem,
  Paper,
  ButtonGroup,
  Stack,
  Table,
  TableBody,
  TableCell,
  TableContainer,
  TableHead,
  TableRow,
  TextField,
  ToggleButton,
  Tooltip,
  Typography
} from "@mui/material";
import ArrowBackOutlinedIcon from "@mui/icons-material/ArrowBackOutlined";
import CheckOutlinedIcon from "@mui/icons-material/CheckOutlined";
import DeleteOutlineIcon from "@mui/icons-material/DeleteOutline";
import { AdapterDateFns } from "@mui/x-date-pickers/AdapterDateFnsV3";
import { DatePicker, LocalizationProvider } from "@mui/x-date-pickers";
import { ConfirmationDialog } from "app/components";
import useAuth from "app/hooks/useAuth";
import {
  useApproveDailyInspectionStep,
  useApproveRepairRecord,
  useChecksheetSubmissionMonthlyView,
  useCreateInspectionRecord,
  useCreateRepairRecord,
  useDeleteInspectionRecord,
  useDeleteRepairRecord,
  useUpdateInspectionRecord
} from "app/hooks/useChecksheets";

const FIXED_OPTIONS = ["OK", "NG", "FIX"];
const MONTH_DAY_COLUMN_WIDTH = 64;
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

function toMonthInputValue(dateString) {
  if (!dateString) {
    const now = new Date();
    return `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, "0")}`;
  }

  return String(dateString).slice(0, 7);
}

function monthValueToDate(monthValue) {
  if (!monthValue) {
    return null;
  }

  const [year, month] = monthValue.split("-").map(Number);
  if (!year || !month) {
    return null;
  }

  return new Date(year, month - 1, 1);
}

function dateToMonthValue(date) {
  if (!(date instanceof Date) || Number.isNaN(date.getTime())) {
    return "";
  }

  return `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, "0")}`;
}

function parseMonthInput(value) {
  const [year, month] = value.split("-").map(Number);
  return { year, month };
}

function getDateStringForEntry(entry, daySummary, monthValue, fallbackDate) {
  if (daySummary?.inspectionDate) {
    return daySummary.inspectionDate;
  }

  if (entry?.inspectionDate) {
    return entry.inspectionDate;
  }

  const day = Number(String(entry?.key ?? "").replace("day:", ""));
  if (monthValue && day > 0) {
    return `${monthValue}-${String(day).padStart(2, "0")}`;
  }

  return fallbackDate ?? `${monthValue}-01`;
}

function createDefaultEntryValues(items) {
  return items.reduce((accumulator, item) => {
    accumulator[item.templateItemId] = {
      templateItemId: item.templateItemId,
      resultValue: "",
      remark: ""
    };
    return accumulator;
  }, {});
}

function normalizeInspectionEntryMode(value) {
  return String(value || "").trim().toLowerCase() === "board" ? "board" : "date";
}

function normalizeBoardCode(value) {
  return String(value ?? "").trim().toUpperCase();
}

function buildInspectionNote(note) {
  const cleanNote = String(note ?? "").trim();
  return cleanNote || null;
}

function getBoardCodeFromEntry(entry) {
  return normalizeBoardCode(
    entry?.boardCode ??
    entry?.boardNumber ??
    entry?.boardNo ??
    entry?.sampleCode ??
    entry?.sampleNumber
  );
}

function getEntryColumnKey(entry, inspectionEntryMode = "date") {
  if (inspectionEntryMode === "board") {
    const boardCode = getBoardCodeFromEntry(entry);
    if (boardCode) {
      return `board:${boardCode}`;
    }
  }

  const day = Number(entry?.day);
  return day ? `day:${day}` : "";
}

function getEntryColumnLabel(entry, inspectionEntryMode = "date") {
  if (inspectionEntryMode === "board") {
    const boardCode = getBoardCodeFromEntry(entry);
    if (boardCode) {
      return boardCode;
    }
  }

  const day = Number(entry?.day);
  return day ? String(day) : "-";
}

function getCellForColumn(item, columnKey, inspectionEntryMode = "date") {
  return item?.days?.find((cell) => getEntryColumnKey(cell, inspectionEntryMode) === columnKey) ?? null;
}

function createEntryValuesForColumn(items, columnKey, inspectionEntryMode = "date") {
  const initial = createDefaultEntryValues(items);

  items.forEach((item) => {
    const cell = getCellForColumn(item, columnKey, inspectionEntryMode);
    initial[item.templateItemId] = {
      templateItemId: item.templateItemId,
      resultValue: cell?.resultValue ?? "",
      remark: cell?.remark ?? ""
    };
  });

  return initial;
}

function getRecordIdForColumn(items, columnKey, inspectionEntryMode = "date") {
  for (const item of items) {
    const recordId = getCellForColumn(item, columnKey, inspectionEntryMode)?.recordId;
    if (recordId) {
      return recordId;
    }
  }

  return null;
}

function getEntryColumnData(entry, inspectionEntryMode) {
  const key = getEntryColumnKey(entry, inspectionEntryMode);
  if (!key) {
    return null;
  }

  return {
    key,
    label: getEntryColumnLabel(entry, inspectionEntryMode),
    boardCode: inspectionEntryMode === "board" ? getBoardCodeFromEntry(entry) : "",
    inspectionDate: entry?.inspectionDate ?? null
  };
}

function buildEntryColumns(view, inspectionEntryMode, filledOnly = false) {
  if (inspectionEntryMode !== "board") {
    return buildDateColumns(view, filledOnly);
  }

  const columnMap = new Map();

  (view?.daySummaries ?? []).forEach((entry) => {
    const column = getEntryColumnData(entry, inspectionEntryMode);
    if (!column || columnMap.has(column.key)) {
      return;
    }

    columnMap.set(column.key, column);
  });

  (view?.items ?? []).forEach((item) => {
    (item?.days ?? []).forEach((entry) => {
      const column = getEntryColumnData(entry, inspectionEntryMode);
      if (!column || columnMap.has(column.key)) {
        return;
      }

      columnMap.set(column.key, column);
    });
  });

  return Array.from(columnMap.values());
}

function buildDateColumns(view, filledOnly = false) {
  if (filledOnly) {
    return (view?.daySummaries ?? [])
      .filter((entry) => Number(entry?.day))
      .map((entry) => ({
        key: `day:${entry.day}`,
        label: String(entry.day),
        boardCode: "",
        inspectionDate: entry?.inspectionDate ?? null
      }));
  }

  const monthDays = view?.periodEnd ? Number(String(view.periodEnd).slice(8, 10)) : 31;
  return Array.from({ length: monthDays }, (_, index) => ({
    key: `day:${index + 1}`,
    label: String(index + 1),
    boardCode: "",
    inspectionDate: null
  }));
}


function getResultColor(resultValue) {
  if (resultValue === "OK") return { bg: "#e8f5e9", color: "#1b5e20" };
  if (resultValue === "NG") return { bg: "#ffebee", color: "#b71c1c" };
  if (resultValue === "FIX") return { bg: "#fff8e1", color: "#8d6e00" };
  return { bg: "#f8fafc", color: "#64748b" };
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

function buildRowSpanMap(items, columns, valueAccessor) {
  const mergeState = {};

  columns.forEach((column) => {
    const columnOptions = parseColumnOptions(column.optionsJson);
    if (!(column.enableRowSpan ?? columnOptions.enableRowSpan)) {
      return;
    }

    const columnKey = column.columnKey ?? column.key;
    mergeState[columnKey] = {};

    let groupStartIndex = 0;
    let previousValue = normalizeMergeValue(valueAccessor(items[0], column));

    for (let rowIndex = 1; rowIndex <= items.length; rowIndex += 1) {
      const currentValue = normalizeMergeValue(valueAccessor(items[rowIndex], column));
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

function formatMonthTitle(monthValue) {
  const { year, month } = parseMonthInput(monthValue);
  return new Intl.DateTimeFormat("en-US", { month: "long", year: "numeric" }).format(new Date(year, month - 1, 1));
}

function toTitleCase(value) {
  return String(value)
    .replace(/([a-z0-9])([A-Z])/g, "$1 $2")
    .replace(/[_-]+/g, " ")
    .replace(/\s+/g, " ")
    .trim()
    .replace(/^./, (char) => char.toUpperCase());
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

function getApproverDisplayName(person) {
  return person?.fullName || person?.approvedByFullName || person?.username || person?.approvedByUsername || "-";
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

function renderApprovalChip(person) {
  const fullName = getApproverDisplayName(person);

  return (
    <Tooltip title={fullName}>
      <Chip
        label={fullName}
        size="small"
        sx={{
          maxWidth: "100%",
          height: 28,
          borderRadius: 999,
          bgcolor: "#f1f5f9",
          color: "#1e293b",
          justifyContent: "flex-start",
          "& .MuiChip-label": {
            display: "block",
            overflow: "hidden",
            textOverflow: "ellipsis",
            whiteSpace: "nowrap",
            px: 1,
            fontSize: 12
          }
        }}
      />
    </Tooltip>
  );
}

function getMonthlySheetColumnSx(columnKey, columnIndex) {
  const isNumberColumn = columnKey === "itemNo";
  const isLongTextColumn = ["itemName", "method", "criteria", "tujuan", "konten", "item", "metodePengecekan", "penilaian"].includes(columnKey);

  return {
    width: isNumberColumn ? 72 : isLongTextColumn ? 220 : 140,
    minWidth: isNumberColumn ? 72 : isLongTextColumn ? 160 : 120,
    maxWidth: isNumberColumn ? 72 : isLongTextColumn ? 220 : 160,
    pl: columnIndex === 0 ? 3 : 2,
    py: 1.25,
    whiteSpace: "normal",
    wordBreak: "break-word",
    overflowWrap: "anywhere",
    lineHeight: 1.35
  };
}

function getMonthDayCellSx(backgroundColor, interactive = false) {
  return {
    width: MONTH_DAY_COLUMN_WIDTH,
    minWidth: MONTH_DAY_COLUMN_WIDTH,
    maxWidth: MONTH_DAY_COLUMN_WIDTH,
    px: 0.5,
    py: 1,
    bgcolor: backgroundColor,
    whiteSpace: "nowrap",
    overflow: "hidden",
    textOverflow: "ellipsis",
    ...(interactive ? { cursor: "pointer" } : {})
  };
}

export default function ChecksheetSubmissionMonthlyPage() {
  const { id } = useParams();
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();
  const { user } = useAuth();
  const submissionId = Number(id);
  const requestedYear = Number(searchParams.get("year"));
  const requestedMonth = Number(searchParams.get("month"));
  const requestedMonthValue = requestedYear > 0 && requestedMonth >= 1 && requestedMonth <= 12
    ? `${requestedYear}-${String(requestedMonth).padStart(2, "0")}`
    : null;

  const [monthValue, setMonthValue] = useState(() => requestedMonthValue ?? toMonthInputValue());
  const { year, month } = useMemo(() => parseMonthInput(monthValue), [monthValue]);
  const bootstrapMonthlyQuery = useChecksheetSubmissionMonthlyView(
    submissionId,
    { year, month },
    { enabled: !!submissionId }
  );
  const bootstrapMode = normalizeChecksheetMode(bootstrapMonthlyQuery.data?.checksheetMode);
  const supportedModes = useMemo(() => {
    const modes = bootstrapMonthlyQuery.data?.availableModes ?? [];
    return [...new Set(modes.map((mode) => normalizeChecksheetMode(mode)).filter(Boolean))];
  }, [bootstrapMonthlyQuery.data?.availableModes]);
  const secondaryMode = useMemo(
    () => supportedModes.find((mode) => mode !== bootstrapMode) ?? null,
    [bootstrapMode, supportedModes]
  );
  const secondaryMonthlyQuery = useChecksheetSubmissionMonthlyView(
    submissionId,
    secondaryMode ? { year, month, checksheetMode: secondaryMode } : { year, month },
    { enabled: !!submissionId && !!secondaryMode }
  );

  const createInspectionMutation = useCreateInspectionRecord(submissionId);
  const deleteInspectionMutation = useDeleteInspectionRecord(submissionId);
  const approveDailyStepMutation = useApproveDailyInspectionStep(submissionId);
  const createRepairMutation = useCreateRepairRecord(submissionId);
  const approveRepairMutation = useApproveRepairRecord();
  const deleteRepairMutation = useDeleteRepairRecord(submissionId);

  const [selectedEntryKey, setSelectedEntryKey] = useState("");
  const [selectedMode, setSelectedMode] = useState("daily");
  const [inspectionShift, setInspectionShift] = useState("1");
  const [inspectionNote, setInspectionNote] = useState("");
  const [entryValues, setEntryValues] = useState({});
  const [repairFormsState, setRepairFormsState] = useState({});
  const [activeRepairDialogKey, setActiveRepairDialogKey] = useState("");
  const [deleteTarget, setDeleteTarget] = useState(null);

  useEffect(() => {
    if (!supportedModes.length) return;
    setSelectedMode((current) => (supportedModes.includes(current) ? current : bootstrapMode || supportedModes[0]));
  }, [bootstrapMode, supportedModes]);

  const availableModes = supportedModes;
  const monthlyViews = useMemo(() => {
    const viewMap = new Map();
    [bootstrapMonthlyQuery.data, secondaryMonthlyQuery.data].forEach((view) => {
      const mode = normalizeChecksheetMode(view?.checksheetMode);
      if (view && mode && !viewMap.has(mode)) {
        viewMap.set(mode, view);
      }
    });
    return Array.from(viewMap.entries()).map(([mode, view]) => ({ mode, view }));
  }, [bootstrapMonthlyQuery.data, secondaryMonthlyQuery.data]);
  const monthlyView = monthlyViews.find((entry) => entry.mode === selectedMode)?.view ?? bootstrapMonthlyQuery.data ?? secondaryMonthlyQuery.data ?? null;
  const referenceView = bootstrapMonthlyQuery.data ?? secondaryMonthlyQuery.data ?? null;
  const isMonthlyLoading = bootstrapMonthlyQuery.isLoading || secondaryMonthlyQuery.isLoading;
  const monthlyError = bootstrapMonthlyQuery.error || secondaryMonthlyQuery.error;
  const isMonthlyError = !referenceView && !isMonthlyLoading;

  useEffect(() => {
    if (requestedMonthValue) {
      setMonthValue(requestedMonthValue);
      return;
    }

    if (referenceView?.inspectionDate) {
      setMonthValue(toMonthInputValue(referenceView.inspectionDate));
    }
  }, [referenceView?.inspectionDate, requestedMonthValue]);

  const monthlyItems = useMemo(() => monthlyView?.items ?? [], [monthlyView?.items]);
  const checksheetMode = normalizeChecksheetMode(monthlyView?.checksheetMode, "daily");
  const inspectionEntryMode = useMemo(
    () => normalizeInspectionEntryMode(monthlyView?.inspectionEntryMode ?? referenceView?.inspectionEntryMode),
    [monthlyView?.inspectionEntryMode, referenceView?.inspectionEntryMode]
  );
  const dailyApprovalSteps = useMemo(
    () => [...(monthlyView?.dailyApprovalSteps ?? [])].sort((left, right) => left.stepOrder - right.stepOrder),
    [monthlyView?.dailyApprovalSteps]
  );
  const regularApprovalSteps = useMemo(
    () => [...(monthlyView?.regularApprovalSteps ?? [])].sort((left, right) => left.stepOrder - right.stepOrder),
    [monthlyView?.regularApprovalSteps]
  );
  const displayColumns = useMemo(() => {
    const templateColumns = referenceView?.templateColumns ?? [];
    if (templateColumns.length > 0) {
      return templateColumns.map((column) => ({
        key: column.columnKey,
        columnKey: column.columnKey,
        label: column.label,
        optionsJson: column.optionsJson,
        enableRowSpan: column.enableRowSpan
      }));
    }

    const firstItem = monthlyItems[0];
    if (!firstItem?.itemData) {
      return [];
    }

    return Object.keys(firstItem.itemData).map((key) => ({
      key,
      label: toTitleCase(key)
    }));
  }, [monthlyItems, referenceView?.templateColumns]);
  const monthlyRowSpanMap = useMemo(
    () => buildRowSpanMap(monthlyItems, displayColumns, (item, column) => item?.itemData?.[column.key]),
    [displayColumns, monthlyItems]
  );
  const entryColumns = useMemo(
    () => buildEntryColumns(monthlyView, inspectionEntryMode, false),
    [inspectionEntryMode, monthlyView]
  );
  const daySummaryMap = useMemo(
    () => new Map((monthlyView?.daySummaries ?? []).map((daySummary) => [getEntryColumnKey(daySummary, inspectionEntryMode), daySummary])),
    [inspectionEntryMode, monthlyView?.daySummaries]
  );
  const selectedEntry = useMemo(
    () => entryColumns.find((entry) => entry.key === selectedEntryKey) ?? entryColumns[0] ?? null,
    [entryColumns, selectedEntryKey]
  );
  const selectedDaySummary = selectedEntry ? daySummaryMap.get(selectedEntry.key) ?? null : null;
  const existingRecordId = useMemo(
    () => selectedDaySummary?.recordId ?? (selectedEntry ? getRecordIdForColumn(monthlyItems, selectedEntry.key, inspectionEntryMode) : null),
    [inspectionEntryMode, monthlyItems, selectedDaySummary?.recordId, selectedEntry]
  );
  const updateInspectionForRecordMutation = useUpdateInspectionRecord(submissionId, existingRecordId);
  const isDraft = monthlyView?.status === "draft";
  const isInspectionMutationPending =
    createInspectionMutation.isPending ||
    updateInspectionForRecordMutation.isPending ||
    deleteInspectionMutation.isPending ||
    approveDailyStepMutation.isPending;

  useEffect(() => {
    if (!monthlyView) return;
    setSelectedEntryKey((current) => (entryColumns.some((entry) => entry.key === current) ? current : entryColumns[0]?.key ?? ""));
  }, [entryColumns, monthlyView]);

  useEffect(() => {
    if (!monthlyItems.length) {
      setEntryValues({});
      setInspectionShift(referenceView?.shift ?? "1");
      setInspectionNote("");
      return;
    }

    setEntryValues(createEntryValuesForColumn(monthlyItems, selectedEntry?.key, inspectionEntryMode));
    setInspectionShift(selectedDaySummary?.shift ?? referenceView?.shift ?? "1");
    setInspectionNote(selectedDaySummary?.note ?? "");
  }, [inspectionEntryMode, monthlyItems, referenceView?.shift, selectedDaySummary?.note, selectedDaySummary?.shift, selectedEntry?.key]);

  const selectedDateString = getDateStringForEntry(selectedEntry, selectedDaySummary, monthValue, referenceView?.inspectionDate);
  const selectedBoardCode = selectedEntry?.boardCode ?? getBoardCodeFromEntry(selectedDaySummary);

  const hasAnyInspectionValue = useMemo(
    () => Object.values(entryValues).some((value) => value.resultValue?.trim() || value.remark?.trim()) || inspectionNote.trim().length > 0,
    [entryValues, inspectionNote]
  );
  const availableRepairForms = useMemo(
    () => (referenceView?.availableRepairForms?.length
      ? referenceView.availableRepairForms
      : [{ formKey: "repair-form-1", title: "Repair Entry", sortOrder: 1 }]),
    [referenceView?.availableRepairForms]
  );
  const activeRepairFormDefinition = useMemo(
    () => availableRepairForms.find((item) => item.formKey === activeRepairDialogKey) ?? null,
    [activeRepairDialogKey, availableRepairForms]
  );
  const repairRecordsByFormKey = useMemo(() => {
    return (referenceView?.repairRecords ?? []).reduce((accumulator, record) => {
      const key = record.repairFormKey || "repair-form-1";
      if (!accumulator[key]) {
        accumulator[key] = [];
      }
      accumulator[key].push(record);
      return accumulator;
    }, {});
  }, [referenceView?.repairRecords]);

  useEffect(() => {
    setRepairFormsState(createRepairFormsState(availableRepairForms));
  }, [availableRepairForms]);

  const summaryStats = useMemo(() => {
    const filledEntries = new Set();

    monthlyItems.forEach((item) => {
      item.days.forEach((cell) => {
        const normalizedKey = getEntryColumnKey(cell, inspectionEntryMode);
        if (cell.recordId && normalizedKey) {
          filledEntries.add(normalizedKey);
        }
      });
    });

    const totalDays = entryColumns.length;

    return {
      totalDays,
      filledDays: filledEntries.size,
      blankDays: Math.max(totalDays - filledEntries.size, 0)
    };
  }, [entryColumns.length, inspectionEntryMode, monthlyItems]);

  if (isMonthlyLoading) {
    return <Box sx={{ p: 3 }}><Typography color="text.secondary">Loading monthly detail...</Typography></Box>;
  }

  if (isMonthlyError || !monthlyView || !referenceView) {
    return (
      <Box sx={{ p: 3 }}>
        <Alert severity="error">{monthlyError?.message || "Monthly detail not found."}</Alert>
      </Box>
    );
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

  const refetchMonthlyViews = () => {
    bootstrapMonthlyQuery.refetch();
    if (secondaryMode) {
      secondaryMonthlyQuery.refetch();
    }
  };

  const handleSaveInspectionRecord = () => {
    const payload = {
      recordType: checksheetMode,
      inspectionDate: selectedDateString,
      shift: inspectionShift || null,
      note: inspectionNote.trim() || null,
      values: monthlyItems
        .map((item) => entryValues[item.templateItemId] ?? { templateItemId: item.templateItemId, resultValue: "", remark: "" })
        .filter((value) => value.resultValue?.trim() || value.remark?.trim())
    };

    payload.inspectionDate = selectedDateString;
    payload.boardCode = inspectionEntryMode === "board" ? selectedBoardCode || null : null;
    payload.note = buildInspectionNote(inspectionNote);

    if (existingRecordId) {
      updateInspectionForRecordMutation.mutate(payload, { onSuccess: refetchMonthlyViews });
      return;
    }

    createInspectionMutation.mutate(payload, { onSuccess: refetchMonthlyViews });
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

  const canApproveStepForDay = (daySummary, step, steps) => {
    if (!daySummary?.recordId) return false;
    if (!user?.id) return false;

    const alreadyApproved = daySummary.approvals?.some((approval) => approval.stepId === step.id);
    if (alreadyApproved) return false;

    if (!stepIncludesCurrentUser(step, user.id)) return false;

    return steps
      .filter((entry) => entry.stepOrder < step.stepOrder)
      .every((entry) => daySummary.approvals?.some((approval) => approval.stepId === entry.id));
  };

  const renderModeSheet = (modeView) => {
    const mode = (modeView?.checksheetMode ?? "daily").toLowerCase();
    const isModeRegular = mode === "regular";
    const modeInspectionEntryMode = normalizeInspectionEntryMode(modeView?.inspectionEntryMode ?? referenceView?.inspectionEntryMode);
    const modeItems = modeView?.items ?? [];
    const modeApprovalSteps = [
      ...(isModeRegular ? modeView?.regularApprovalSteps ?? [] : modeView?.dailyApprovalSteps ?? [])
    ].sort((left, right) => left.stepOrder - right.stepOrder);
    const modeDisplayColumns = (() => {
      const templateColumns = referenceView?.templateColumns ?? [];
      if (templateColumns.length > 0) {
        return templateColumns.map((column) => ({
          key: column.columnKey,
          columnKey: column.columnKey,
          label: column.label,
          optionsJson: column.optionsJson,
          enableRowSpan: column.enableRowSpan
        }));
      }
      const firstItem = modeItems[0];
      if (!firstItem?.itemData) {
        return [];
      }
      return Object.keys(firstItem.itemData).map((key) => ({
        key,
        label: toTitleCase(key)
      }));
    })();
    const modeRowSpanMap = buildRowSpanMap(modeItems, modeDisplayColumns, (item, column) => item?.itemData?.[column.key]);
    const modeEntryColumns = buildEntryColumns(modeView, modeInspectionEntryMode, isModeRegular);
    const modeDaySummaryMap = new Map((modeView?.daySummaries ?? []).map((daySummary) => [getEntryColumnKey(daySummary, modeInspectionEntryMode), daySummary]));
    const modeSelectedEntry = selectedMode === mode && modeEntryColumns.some((entry) => entry.key === selectedEntryKey)
      ? selectedEntryKey
      : modeEntryColumns[0]?.key ?? "";
    const modeFilledDays = new Set();
    modeItems.forEach((item) => {
      item.days.forEach((cell) => {
        const normalizedKey = getEntryColumnKey(cell, modeInspectionEntryMode);
        if (cell.recordId && normalizedKey) modeFilledDays.add(normalizedKey);
      });
    });
    const modeTotalDays = modeEntryColumns.length;

    return (
      <Paper key={`sheet-${mode}`} variant="outlined" sx={{ p: 3 }}>
        <Stack direction={{ xs: "column", md: "row" }} justifyContent="space-between" spacing={1} sx={{ mb: 2 }}>
          <Typography variant="h6">{mode === "daily" ? "Daily Monthly Sheet" : "Regular Monthly Sheet"}</Typography>
          <Stack direction="row" spacing={1}>
            <Chip label={`${modeFilledDays.size}/${modeTotalDays} filled`} variant="outlined" />
            <Chip label={`Mode: ${String(mode).toUpperCase()}`} variant="outlined" />
          </Stack>
        </Stack>
        <TableContainer
          component={Paper}
          variant="outlined"
          sx={{
            maxHeight: "72vh",
            overflowX: "auto",
          }}
        >
          <Table
            stickyHeader
            size="small"
            sx={{
              minWidth: Math.max(880, modeDisplayColumns.length * 140 + modeEntryColumns.length * MONTH_DAY_COLUMN_WIDTH),
              tableLayout: "fixed",
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
                {modeDisplayColumns.map((column, columnIndex) => (
                  <TableCell
                    key={`${mode}-${column.key}`}
                    sx={{
                      bgcolor: "#f8fafc",
                      ...getMonthlySheetColumnSx(column.key, columnIndex)
                    }}
                  >
                    {column.label}
                  </TableCell>
                ))}
                {modeEntryColumns.map((entry) => {
                  const isSelected = selectedMode === mode && entry.key === modeSelectedEntry;
                  return (
                    <TableCell
                      key={`${mode}-entry-${entry.key}`}
                      align="center"
                      onClick={() => {
                        setSelectedMode(mode);
                        setSelectedEntryKey(entry.key);
                      }}
                      sx={{
                        ...getMonthDayCellSx(isSelected ? "#dbeafe" : "#f8fafc", true),
                        fontWeight: isSelected ? 700 : 500
                      }}
                    >
                      {entry.label}
                    </TableCell>
                  );
                })}
              </TableRow>
            </TableHead>
            <TableBody>
              {modeItems.map((item, rowIndex) => (
                <TableRow key={`${mode}-${item.templateItemId}`} hover>
                  {modeDisplayColumns.map((column, columnIndex) => {
                    const mergeCell = modeRowSpanMap[column.key]?.[rowIndex];

                    if (mergeCell?.hidden) {
                      return null;
                    }

                    return (
                      <TableCell
                        key={`${mode}-${item.templateItemId}-${column.key}`}
                        rowSpan={mergeCell?.rowSpan ?? 1}
                        data-merged={(mergeCell?.rowSpan ?? 1) > 1 ? "true" : undefined}
                        sx={{
                          verticalAlign: "middle",
                          ...getMonthlySheetColumnSx(column.key, columnIndex)
                        }}
                      >
                        {(mergeCell?.rowSpan ?? 1) > 1 ? (
                          <Box sx={{ display: "flex", alignItems: "center", minHeight: "100%", height: "100%", width: "100%" }}>
                            {item.itemData?.[column.key] || "-"}
                          </Box>
                        ) : (
                          item.itemData?.[column.key] || "-"
                        )}
                      </TableCell>
                    );
                  })}
                  {modeEntryColumns.map((entry) => {
                    const cell = getCellForColumn(item, entry.key, modeInspectionEntryMode);
                    const palette = getResultColor(cell?.resultValue);
                    const isSelected = selectedMode === mode && entry.key === modeSelectedEntry;
                    return (
                      <TableCell
                        key={`${mode}-${item.templateItemId}-${entry.key}`}
                        align="center"
                        onClick={() => {
                          setSelectedMode(mode);
                          setSelectedEntryKey(entry.key);
                        }}
                        sx={getMonthDayCellSx(isSelected ? "#dbeafe" : palette.bg, true)}
                      >
                        <Tooltip title={cell?.remark || cell?.note || cell?.resultValue || "No entry"}>
                          <Typography
                            variant="caption"
                            fontWeight={700}
                            sx={{
                              color: isSelected ? "#0f172a" : palette.color,
                              display: "block",
                              whiteSpace: "nowrap",
                              overflow: "hidden",
                              textOverflow: "ellipsis"
                            }}
                          >
                            {cell?.resultValue || "-"}
                          </Typography>
                        </Tooltip>
                      </TableCell>
                    );
                  })}
                </TableRow>
              ))}
              <TableRow>
                <TableCell colSpan={modeDisplayColumns.length} sx={{ fontWeight: 700, bgcolor: "#f8fafc", pl: 3 }}>Shift</TableCell>
                {modeEntryColumns.map((entry) => {
                  const daySummary = modeDaySummaryMap.get(entry.key);
                  const isSelected = selectedMode === mode && entry.key === modeSelectedEntry;
                  return (
                    <TableCell
                      key={`${mode}-shift-${entry.key}`}
                      align="center"
                      onClick={() => {
                        setSelectedMode(mode);
                        setSelectedEntryKey(entry.key);
                      }}
                      sx={getMonthDayCellSx(isSelected ? "#dbeafe" : "#fff")}
                    >
                      {daySummary?.recordId ? daySummary.shift || "-" : "-"}
                    </TableCell>
                  );
                })}
              </TableRow>
              {modeApprovalSteps.map((step) => (
                <TableRow key={`${mode}-approval-row-${step.id}`}>
                  <TableCell colSpan={modeDisplayColumns.length} sx={{ fontWeight: 700, bgcolor: "#f8fafc", pl: 3 }}>{step.stepName}</TableCell>
                  {modeEntryColumns.map((entry) => {
                    const daySummary = modeDaySummaryMap.get(entry.key);
                    const approval = daySummary?.approvals?.find((entry) => entry.stepId === step.id);
                    const canApprove = canApproveStepForDay(daySummary, step, modeApprovalSteps);
                    const isSelected = selectedMode === mode && entry.key === modeSelectedEntry;
                    return (
                      <TableCell
                        key={`${mode}-approval-${step.id}-${entry.key}`}
                        align="center"
                        onClick={() => {
                          setSelectedMode(mode);
                          setSelectedEntryKey(entry.key);
                        }}
                        sx={getMonthDayCellSx(isSelected ? "#dbeafe" : "#fff")}
                      >
                        {approval ? (
                          renderApprovalChip(approval)
                        ) : canApprove ? (
                          <Tooltip title="Approve">
                            <span>
                              <IconButton
                                size="small"
                                color="primary"
                                disabled={approveDailyStepMutation.isPending}
                                onClick={() => approveDailyStepMutation.mutate({ recordId: daySummary.recordId, stepId: step.id })}
                                sx={{
                                  bgcolor: "primary.main",
                                  color: "primary.contrastText",
                                  borderRadius: 1.5,
                                  p: 0.5,
                                  "&:hover": {
                                    bgcolor: "primary.dark"
                                  },
                                  "&.Mui-disabled": {
                                    bgcolor: "action.disabledBackground",
                                    color: "action.disabled"
                                  }
                                }}
                              >
                                <CheckOutlinedIcon fontSize="small" />
                              </IconButton>
                            </span>
                          </Tooltip>
                        ) : "-"}
                      </TableCell>
                    );
                  })}
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </TableContainer>
      </Paper>
    );
  };

  return (
    <LocalizationProvider dateAdapter={AdapterDateFns}>
      <Box sx={{ p: 3 }}>
        <Stack spacing={3}>
          <Stack direction={{ xs: "column", md: "row" }} justifyContent="space-between" spacing={2}>
            <Box>
              <Typography variant="h5" fontWeight={700}>Monthly Inspection Detail</Typography>
              <Typography variant="body2" color="text.secondary">
                Daily results, shift, and simple day-by-day approvals are shown in one horizontal month sheet.
              </Typography>
            </Box>
            <Button
              variant="outlined"
              startIcon={<ArrowBackOutlinedIcon />}
              onClick={() => navigate(`/checksheets/submissions/${submissionId}`)}
            >
              Back To Detail
            </Button>
          </Stack>

          <Paper variant="outlined" sx={{ p: 3 }}>
            <Stack direction={{ xs: "column", lg: "row" }} justifyContent="space-between" spacing={2}>
              <Stack spacing={1}>
                <Typography variant="h6" fontWeight={700}>{monthlyView.machineCode}</Typography>
                <Typography variant="body2" color="text.secondary">
                  {monthlyView.location} | {monthlyView.lineName} | {monthlyView.multiProductNo || "-"}
                </Typography>
                <Stack direction={{ xs: "column", md: "row" }} spacing={3} flexWrap="wrap">
                  <Typography variant="body2"><strong>Group:</strong> {monthlyView.groupCodes?.join(", ") || "-"}</Typography>
                  <Typography variant="body2"><strong>Status:</strong> {formatSubmissionStatus(monthlyView.status)}</Typography>
                </Stack>
              </Stack>

              <Stack spacing={1.5} sx={{ minWidth: { lg: 260 } }}>
                <DatePicker
                  label="Month"
                  views={["year", "month"]}
                  openTo="month"
                  value={monthValueToDate(monthValue)}
                  onChange={(value) => {
                    const nextMonthValue = dateToMonthValue(value);
                    if (nextMonthValue) {
                      setMonthValue(nextMonthValue);
                    }
                  }}
                  format="yyyy-MM"
                  slotProps={{
                    textField: {
                      fullWidth: true,
                      size: "small"
                    },
                    mobilePaper: {
                      sx: { mx: 1 }
                    }
                  }}
                />
                <Stack direction="row" spacing={1} flexWrap="wrap">
                  <Chip label={`${summaryStats.filledDays}/${summaryStats.totalDays} filled`} variant="outlined" />
                  <Chip label={`${summaryStats.blankDays} blank`} variant="outlined" />
                  <Chip label={`Mode: ${checksheetMode}`} variant="outlined" />
                </Stack>
              </Stack>
            </Stack>
          </Paper>
          <Typography variant="h6">{formatMonthTitle(monthValue)}</Typography>
          {monthlyViews.map((entry) => renderModeSheet(entry.view))}

          {isDraft ? (
            <>
              <Paper variant="outlined" sx={{ p: 3 }}>
                <Typography variant="h6" sx={{ mb: 1 }}>Inspection Entry Editor</Typography>
                <Typography variant="body2" color="text.secondary" sx={{ mb: 2 }}>
                  {inspectionEntryMode === "board" ? `Selected board code: ${selectedBoardCode || "-"}` : `Selected date: ${selectedDateString}`}
                </Typography>
                <ToggleButton
                  size="small"
                  value={selectedMode}
                  selected
                  sx={{ mb: 2 }}
                  onChange={() => setSelectedMode((current) => (current === "daily" ? "regular" : "daily"))}
                  disabled={!availableModes.includes(selectedMode === "daily" ? "regular" : "daily")}
                >
                  Editing Mode: {selectedMode}
                </ToggleButton>

                <Stack direction="row" spacing={1} flexWrap="wrap" sx={{ mb: 2 }}>
                  {(selectedMode === "regular" ? regularApprovalSteps : dailyApprovalSteps).map((step) => {
                    const approval = selectedDaySummary?.approvals?.find((entry) => entry.stepId === step.id);
                    return (
                      <Chip
                        key={`${selectedMode}-selected-step-${step.id}`}
                        label={approval ? `${step.stepName}: ${getApproverDisplayName(approval)}` : `${step.stepName}: Pending`}
                        color={approval ? "success" : "default"}
                        variant="outlined"
                      />
                    );
                  })}
                  {(selectedMode === "regular" ? regularApprovalSteps : dailyApprovalSteps).length === 0 && (
                    <Chip
                      label={`No ${selectedMode === "regular" ? "regular" : "daily"} approval steps`}
                      variant="outlined"
                    />
                  )}
                </Stack>

                <TextField
                  select
                  label={inspectionEntryMode === "board" ? "Selected Board Code" : "Selected Day"}
                  value={selectedEntry?.key ?? ""}
                  onChange={(event) => setSelectedEntryKey(event.target.value)}
                  sx={{ mb: 2, minWidth: 180 }}
                  disabled={!isDraft || isInspectionMutationPending}
                >
                  {entryColumns.map((entry) => (
                    <MenuItem key={entry.key} value={entry.key}>{entry.label}</MenuItem>
                  ))}
                </TextField>

                <TextField
                  select
                  label="Shift"
                  value={inspectionShift}
                  onChange={(event) => setInspectionShift(event.target.value)}
                  sx={{ mb: 2, ml: 1, minWidth: 180 }}
                  disabled={!isDraft || isInspectionMutationPending}
                >
                  {["1", "2", "3"].map((shift) => (
                    <MenuItem key={shift} value={shift}>Shift {shift}</MenuItem>
                  ))}
                </TextField>

                <TextField
                  label="Note"
                  value={inspectionNote}
                  onChange={(event) => setInspectionNote(event.target.value)}
                  multiline
                  minRows={2}
                  fullWidth
                  sx={{ mb: 2 }}
                  disabled={!isDraft || isInspectionMutationPending}
                />
                <Box sx={{ overflowX: "auto", mx: -1.5, px: 1.5 }}>
                  <TableContainer component={Paper} variant="outlined" sx={{ minWidth: 600 }}>
                    <Table
                      size="small"
                      sx={{
                        "& .MuiTableCell-root": {
                          borderRight: 1,
                          borderColor: "divider",
                          verticalAlign: "top",
                          whiteSpace: "normal",
                          overflowWrap: "anywhere",
                          wordBreak: "break-word"
                        },
                        "& .MuiTableCell-root:last-of-type": { borderRight: 0 },
                        "& .MuiTableHead-root .MuiTableCell-root": { fontWeight: 700 },
                        "& .MuiTableCell-root[data-merged='true']": { verticalAlign: "middle" }
                      }}
                    >
                      <TableHead>
                        <TableRow>
                          {displayColumns.map((column, columnIndex) => (
                            <TableCell key={column.key} sx={{ minWidth: column.key === "itemNo" ? 80 : 180, pl: columnIndex === 0 ? 3 : 2 }}>
                              {column.label}
                            </TableCell>
                          ))}
                          <TableCell sx={{ width: 150, minWidth: 150, pl: 2 }}>Entry</TableCell>
                          <TableCell sx={{ width: 160, minWidth: 160, pl: 2 }}>Remark</TableCell>
                        </TableRow>
                      </TableHead>
                      <TableBody>
                        {monthlyItems.map((item, rowIndex) => (
                          <TableRow key={item.templateItemId} hover>
                            {displayColumns.map((column, columnIndex) => {
                              const mergeCell = monthlyRowSpanMap[column.key]?.[rowIndex];

                              if (mergeCell?.hidden) {
                                return null;
                              }

                              return (
                                <TableCell
                                  key={`${item.templateItemId}-${column.key}`}
                                  rowSpan={mergeCell?.rowSpan ?? 1}
                                  data-merged={(mergeCell?.rowSpan ?? 1) > 1 ? "true" : undefined}
                                  sx={{
                                    verticalAlign: "middle",
                                    whiteSpace: "normal",
                                    overflowWrap: "anywhere",
                                    wordBreak: "break-word",
                                    pl: columnIndex === 0 ? 3 : 2
                                  }}
                                >
                                  {(mergeCell?.rowSpan ?? 1) > 1 ? (
                                    <Box sx={{ display: "flex", alignItems: "center", minHeight: "100%", height: "100%" }}>
                                      {item.itemData?.[column.key] || "-"}
                                    </Box>
                                  ) : (
                                    item.itemData?.[column.key] || "-"
                                  )}
                                </TableCell>
                              );
                            })}
                            <TableCell sx={{ width: 150, minWidth: 150, pl: 2 }}>
                              {item.valueType === "fixed" ? (
                                <ButtonGroup
                                  size="small"
                                  disabled={!isDraft || isInspectionMutationPending}
                                  sx={{ flexShrink: 0 }}
                                >
                                  {FIXED_OPTIONS.map((option) => {
                                    const isSelected = (entryValues[item.templateItemId]?.resultValue ?? "") === option;
                                    return (
                                      <Button
                                        key={`${item.templateItemId}-${option}`}
                                        variant={isSelected ? "contained" : "outlined"}
                                        onClick={() => handleInspectionValueChange(item.templateItemId, { resultValue: option })}
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
                                  value={entryValues[item.templateItemId]?.resultValue ?? ""}
                                  onChange={(e) => handleInspectionValueChange(item.templateItemId, { resultValue: e.target.value })}
                                  placeholder="Enter value"
                                  size="small"
                                  fullWidth
                                  disabled={!isDraft || isInspectionMutationPending}
                                />
                              )}
                            </TableCell>
                            <TableCell sx={{ width: 160, minWidth: 160, pl: 2 }}>
                              <TextField
                                value={entryValues[item.templateItemId]?.remark ?? ""}
                                onChange={(e) => handleInspectionValueChange(item.templateItemId, { remark: e.target.value })}
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
                  {isDraft && existingRecordId && (
                    <Button
                      color="error"
                      variant="outlined"
                      disabled={deleteInspectionMutation.isPending}
                      onClick={() => setDeleteTarget({ type: "inspection", id: existingRecordId })}
                    >
                      {inspectionEntryMode === "board" ? "Delete Selected Board Entry" : "Delete Selected Day"}
                    </Button>
                  )}
                  <Button
                    variant="contained"
                    disabled={!isDraft || !hasAnyInspectionValue || isInspectionMutationPending}
                    onClick={handleSaveInspectionRecord}
                  >
                    {isInspectionMutationPending ? "Saving..." : existingRecordId ? "Save Entry Changes" : "Save Entry Record"}
                  </Button>
                </Stack>
              </Paper>
            </>
          ) : null}

          <Paper variant="outlined" sx={{ p: 3 }}>
            <Typography variant="h6" sx={{ mb: 2 }}>Repair Records</Typography>
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
                        {records.length === 0 && (
                          <Typography variant="body2" color="text.secondary">No repair records yet for this section.</Typography>
                        )}
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
          text="Delete this checksheet record?"
          confirmText="Delete"
          confirmColor="error"
          isLoading={deleteInspectionMutation.isPending || deleteRepairMutation.isPending}
          onConfirmDialogClose={() => setDeleteTarget(null)}
          onYesClick={() => {
            if (!deleteTarget) return;
            if (deleteTarget.type === "inspection") {
              deleteInspectionMutation.mutate(deleteTarget.id, { onSuccess: () => setDeleteTarget(null) });
              return;
            }
            deleteRepairMutation.mutate(deleteTarget.id, { onSuccess: () => setDeleteTarget(null) });
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
