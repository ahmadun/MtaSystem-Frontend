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
  ToggleButtonGroup,
  Tooltip,
  Typography
} from "@mui/material";
import AddIcon from "@mui/icons-material/Add";
import ArrowBackOutlinedIcon from "@mui/icons-material/ArrowBackOutlined";
import CheckOutlinedIcon from "@mui/icons-material/CheckOutlined";
import DeleteOutlineIcon from "@mui/icons-material/DeleteOutline";
import FileDownloadOutlinedIcon from "@mui/icons-material/FileDownloadOutlined";
import { AdapterDateFns } from "@mui/x-date-pickers/AdapterDateFnsV3";
import { DatePicker, LocalizationProvider } from "@mui/x-date-pickers";
import { ConfirmationDialog } from "app/components";
import useAuth from "app/hooks/useAuth";
import {
  useApproveDailyInspectionStep,
  useApproveRepairRecord,
  useCancelRepairRecordApproval,
  useChecksheetSubmissionMonthlyView,
  useCreateInspectionRecord,
  useCreateRepairRecord,
  useDeleteInspectionRecord,
  useDeleteRepairRecord,
  useExportChecksheetSubmissionMonthlyView,
  useRespondApprovalRequest,
  useUpdateInspectionRecord
} from "app/hooks/useChecksheets";

const FIXED_OPTIONS = ["OK", "NG", "FIX"];
const JIG_NO_CHECK_VALUE_TYPE = "jig_no_check";
const MONTH_DAY_COLUMN_WIDTH = 64;
const REPAIR_CODE_OPTIONS = ["D", "R", "P"];
const REPAIR_JUDGMENT_OPTIONS = ["OK", "NG"];
function formatSubmissionStatus(status) {
  return typeof status === "string" ? status.toUpperCase() : "-";
}

function getNextRepairApprovalLevel(record) {
  if (!record) return "-";
  if (!record.checkedByAssyUserId) return "ASSY";
  if (!record.checkedByQaUserId) return "QA";
  if (!record.checkedByCoordinatorUserId) return "MTA";
  return "COMPLETED";
}

function getLastRepairApprovalLevel(record) {
  if (!record) return "-";
  if (record.checkedByCoordinatorUserId) return "MTA";
  if (record.checkedByQaUserId) return "QA";
  if (record.checkedByAssyUserId) return "ASSY";
  return "-";
}

function getMachineEntryDetails(source) {
  return [
    { label: "Stand No.", value: source?.standNo },
    { label: "Sub Assy No.", value: source?.subAssyNo },
    { label: "Machine Code", value: (source?.machineCodes ?? []).join(", ") }
  ].filter((item) => String(item.value ?? "").trim());
}

function createEmptyRepairProduct(stage = "before", sortOrder = 1) {
  return {
    stage,
    productSerial: "",
    judgment: "OK",
    sortOrder
  };
}

function createEmptyRepairForm() {
  return {
    repairFormKey: "",
    repairDate: "",
    repairCode: "",
    repairTimeMinutes: "",
    repairResult: "",
    pointNo: "",
    jigNo: "",
    jigCode: "",
    damageDescription: "",
    repairDescription: "",
    note: "",
    beforeProducts: [createEmptyRepairProduct("before", 1)],
    afterProducts: [createEmptyRepairProduct("after", 1)]
  };
}

function createRepairFormsState(repairForms) {
  return (repairForms ?? []).reduce((accumulator, repairForm) => {
    accumulator[repairForm.formKey] = {
      repairFormKey: repairForm.formKey,
      repairDate: "",
      repairCode: "",
      repairTimeMinutes: "",
      repairResult: "",
      pointNo: "",
      jigNo: "",
      jigCode: "",
      damageDescription: "",
      repairDescription: "",
      note: "",
      beforeProducts: [createEmptyRepairProduct("before", 1)],
      afterProducts: [createEmptyRepairProduct("after", 1)]
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

  const week = Number(String(entry?.key ?? "").replace("week:", ""));
  if (monthValue && week > 0) {
    return `${monthValue}-${String(((week - 1) * 7) + 1).padStart(2, "0")}`;
  }

  return fallbackDate ?? `${monthValue}-01`;
}

function getInspectionDateForColumn(entry, daySummary) {
  return daySummary?.inspectionDate ?? entry?.inspectionDate ?? null;
}

function getMachineCodesForColumn(entry, daySummary) {
  const machineCodes = daySummary?.machineCodes?.length ? daySummary.machineCodes : entry?.machineCodes ?? [];
  return machineCodes.length ? machineCodes.join(", ") : "-";
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
  const normalized = String(value || "").trim().toLowerCase();
  if (normalized === "board") return "board";
  if (normalized === "weekly") return "weekly";
  return "date";
}

function normalizeBoardCode(value) {
  return String(value ?? "").trim().toUpperCase();
}

function buildInspectionNote(note) {
  const cleanNote = String(note ?? "").trim();
  return cleanNote || null;
}

function sanitizeNumberInput(value) {
  const normalized = String(value ?? "").replace(/[^0-9.]/g, "");
  const [wholePart, ...decimalParts] = normalized.split(".");
  return decimalParts.length > 0 ? `${wholePart}.${decimalParts.join("")}` : wholePart;
}

function createEmptyJigNoCheckRow() {
  return {
    pointNo: "",
    pointValue: ""
  };
}

function parseJigNoCheckValue(value) {
  if (!value) {
    return [];
  }

  try {
    const parsedValue = JSON.parse(value);
    const rows = Array.isArray(parsedValue) ? parsedValue : parsedValue?.rows;

    if (!Array.isArray(rows)) {
      return [];
    }

    return rows.map((row) => ({
      pointNo: sanitizeNumberInput(row?.pointNo),
      pointValue: sanitizeNumberInput(row?.pointValue)
    }));
  } catch {
    return [];
  }
}

function serializeJigNoCheckValue(rows) {
  const cleanedRows = rows
    .map((row) => ({
      pointNo: sanitizeNumberInput(row.pointNo),
      pointValue: sanitizeNumberInput(row.pointValue)
    }))
    .filter((row) => row.pointNo || row.pointValue);

  return cleanedRows.length ? JSON.stringify(cleanedRows) : "";
}

function formatJigNoCheckValue(value) {
  const rows = parseJigNoCheckValue(value);

  return rows.map((row) => `Jig No. ${row.pointNo} : ${row.pointValue}`);
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
  if (inspectionEntryMode === "weekly") {
    return day ? `week:${day}` : "";
  }

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
  if (inspectionEntryMode === "weekly") {
    return day ? `Week ${day}` : "-";
  }

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
  if (inspectionEntryMode === "date") {
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
  const cancelRepairApprovalMutation = useCancelRepairRecordApproval();
  const deleteRepairMutation = useDeleteRepairRecord(submissionId);
  const exportMonthlyView = useExportChecksheetSubmissionMonthlyView(submissionId);
  const respondApprovalMutation = useRespondApprovalRequest();

  const [selectedEntryKey, setSelectedEntryKey] = useState("");
  const [selectedMode, setSelectedMode] = useState("daily");
  const [inspectionShift, setInspectionShift] = useState("1");
  const [inspectionNote, setInspectionNote] = useState("");
  const [entryValues, setEntryValues] = useState({});
  const [repairFormsState, setRepairFormsState] = useState({});
  const [activeRepairDialogKey, setActiveRepairDialogKey] = useState("");
  const [activeJigNoCheckItemId, setActiveJigNoCheckItemId] = useState(null);
  const [jigNoCheckRows, setJigNoCheckRows] = useState([createEmptyJigNoCheckRow()]);
  const [deleteTarget, setDeleteTarget] = useState(null);
  const [repairApprovalTarget, setRepairApprovalTarget] = useState(null);
  const [repairApprovalCancelTarget, setRepairApprovalCancelTarget] = useState(null);
  const [monthEndApprovalTarget, setMonthEndApprovalTarget] = useState(null);
  const [monthEndDecision, setMonthEndDecision] = useState("approved");
  const [monthEndComment, setMonthEndComment] = useState("");

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
  const orderedMonthlyViews = useMemo(
    () =>
      [...monthlyViews].sort((left, right) => {
        const order = { daily: 0, regular: 1 };
        return (order[left.mode] ?? 99) - (order[right.mode] ?? 99);
      }),
    [monthlyViews]
  );
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
  const machineEntryDetails = getMachineEntryDetails(monthlyView);
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
  const monthEndApprovalSteps = useMemo(
    () => [...(referenceView?.approvalSteps ?? [])].sort((left, right) => left.stepOrder - right.stepOrder),
    [referenceView?.approvalSteps]
  );
  const currentMonthEndApprovalStep = useMemo(
    () => monthEndApprovalSteps.find((step) => step.status === "in_progress") ?? null,
    [monthEndApprovalSteps]
  );
  const canRespondMonthEndApproval = useMemo(() => {
    if (!referenceView?.currentApprovalRequestId || !currentMonthEndApprovalStep || monthlyView?.status !== "submitted") {
      return false;
    }

    const currentUserId = Number(user?.id ?? 0);
    if (!currentUserId) {
      return false;
    }

    const isApprover = (currentMonthEndApprovalStep.approvers ?? []).some(
      (approver) => Number(approver.userId) === currentUserId
    );
    const hasResponded = (currentMonthEndApprovalStep.responses ?? []).some(
      (response) => Number(response.userId) === currentUserId
    );

    return isApprover && !hasResponded;
  }, [currentMonthEndApprovalStep, monthlyView?.status, referenceView?.currentApprovalRequestId, user?.id]);
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

  const handleOpenJigNoCheckDialog = (itemId) => {
    const rows = parseJigNoCheckValue(entryValues[itemId]?.resultValue ?? "");
    setActiveJigNoCheckItemId(itemId);
    setJigNoCheckRows(rows.length ? rows : [createEmptyJigNoCheckRow()]);
  };

  const handleCloseJigNoCheckDialog = () => {
    setActiveJigNoCheckItemId(null);
    setJigNoCheckRows([createEmptyJigNoCheckRow()]);
  };

  const updateJigNoCheckRow = (index, patch) => {
    setJigNoCheckRows((current) =>
      current.map((row, rowIndex) => (rowIndex === index ? { ...row, ...patch } : row))
    );
  };

  const addJigNoCheckRow = () => {
    setJigNoCheckRows((current) => [...current, createEmptyJigNoCheckRow()]);
  };

  const removeJigNoCheckRow = (index) => {
    setJigNoCheckRows((current) => {
      const nextRows = current.filter((_, rowIndex) => rowIndex !== index);
      return nextRows.length ? nextRows : [createEmptyJigNoCheckRow()];
    });
  };

  const handleSaveJigNoCheckValue = () => {
    if (!activeJigNoCheckItemId) {
      return;
    }

    handleInspectionValueChange(activeJigNoCheckItemId, {
      resultValue: serializeJigNoCheckValue(jigNoCheckRows)
    });
    handleCloseJigNoCheckDialog();
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
  const updateRepairProductValue = (repairFormKey, stage, index, patch) => {
    const key = stage === "after" ? "afterProducts" : "beforeProducts";
    setRepairFormsState((current) => {
      const currentForm = current[repairFormKey] ?? createEmptyRepairForm();
      const rows = currentForm[key]?.length ? currentForm[key] : [createEmptyRepairProduct(stage, 1)];

      return {
        ...current,
        [repairFormKey]: {
          ...currentForm,
          repairFormKey,
          [key]: rows.map((row, rowIndex) => (rowIndex === index ? { ...row, ...patch } : row))
        }
      };
    });
  };
  const addRepairProductRow = (repairFormKey, stage) => {
    const key = stage === "after" ? "afterProducts" : "beforeProducts";
    setRepairFormsState((current) => {
      const currentForm = current[repairFormKey] ?? createEmptyRepairForm();
      const rows = currentForm[key]?.length ? currentForm[key] : [];

      return {
        ...current,
        [repairFormKey]: {
          ...currentForm,
          repairFormKey,
          [key]: [...rows, createEmptyRepairProduct(stage, rows.length + 1)]
        }
      };
    });
  };
  const removeRepairProductRow = (repairFormKey, stage, index) => {
    const key = stage === "after" ? "afterProducts" : "beforeProducts";
    setRepairFormsState((current) => {
      const currentForm = current[repairFormKey] ?? createEmptyRepairForm();
      const rows = (currentForm[key] ?? []).filter((_, rowIndex) => rowIndex !== index);

      return {
        ...current,
        [repairFormKey]: {
          ...currentForm,
          repairFormKey,
          [key]: rows.length ? rows.map((row, rowIndex) => ({ ...row, sortOrder: rowIndex + 1 })) : [createEmptyRepairProduct(stage, 1)]
        }
      };
    });
  };

  const handleSaveRepairRecord = (repairFormKey) => {
    const currentRepairForm = repairFormsState[repairFormKey] ?? createEmptyRepairForm();
    const products = [
      ...(currentRepairForm.beforeProducts ?? []).map((product, index) => ({ ...product, stage: "before", sortOrder: index + 1 })),
      ...(currentRepairForm.afterProducts ?? []).map((product, index) => ({ ...product, stage: "after", sortOrder: index + 1 }))
    ].filter((product) => product.productSerial?.trim());
    createRepairMutation.mutate(
      {
        repairFormKey,
        repairDate: currentRepairForm.repairDate || null,
        repairCode: currentRepairForm.repairCode || null,
        repairTimeMinutes: currentRepairForm.repairTimeMinutes === "" ? null : Number(currentRepairForm.repairTimeMinutes),
        repairResult: currentRepairForm.repairResult.trim() || null,
        pointNo: currentRepairForm.pointNo.trim() || null,
        jigNo: currentRepairForm.jigNo.trim() || null,
        jigCode: currentRepairForm.jigCode.trim() || null,
        damageDescription: currentRepairForm.damageDescription.trim(),
        repairDescription: currentRepairForm.repairDescription.trim(),
        note: currentRepairForm.note.trim() || null,
        products
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
                    const jigNoCheckLines = (item.valueType ?? "fixed") === JIG_NO_CHECK_VALUE_TYPE
                      ? formatJigNoCheckValue(cell?.resultValue)
                      : [];
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
                        <Tooltip title={cell?.remark || cell?.note || jigNoCheckLines.join("\n") || cell?.resultValue || "No entry"}>
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
                            {jigNoCheckLines.length ? jigNoCheckLines.map((line, lineIndex) => (
                              <Box key={`${mode}-${item.templateItemId}-${entry.key}-${lineIndex}`} component="span" sx={{ display: "block" }}>
                                {line}
                              </Box>
                            )) : cell?.resultValue || "-"}
                          </Typography>
                        </Tooltip>
                      </TableCell>
                    );
                  })}
                </TableRow>
              ))}
              {modeInspectionEntryMode === "board" && (
                <>
                  <TableRow>
                    <TableCell colSpan={modeDisplayColumns.length} sx={{ fontWeight: 700, bgcolor: "#f8fafc", pl: 3 }}>
                      Machine Record
                    </TableCell>
                    {modeEntryColumns.map((entry) => {
                      const daySummary = modeDaySummaryMap.get(entry.key);
                      const isSelected = selectedMode === mode && entry.key === modeSelectedEntry;

                      return (
                        <TableCell
                          key={`${mode}-machine-record-${entry.key}`}
                          align="center"
                          onClick={() => {
                            setSelectedMode(mode);
                            setSelectedEntryKey(entry.key);
                          }}
                          sx={getMonthDayCellSx(isSelected ? "#dbeafe" : "#fff")}
                        >
                          {daySummary?.recordId ? getMachineCodesForColumn(entry, daySummary) : "-"}
                        </TableCell>
                      );
                    })}
                  </TableRow>
                  {isModeRegular && (
                    <TableRow>
                      <TableCell colSpan={modeDisplayColumns.length} sx={{ fontWeight: 700, bgcolor: "#f8fafc", pl: 3 }}>
                        Inspection Date
                      </TableCell>
                      {modeEntryColumns.map((entry) => {
                        const daySummary = modeDaySummaryMap.get(entry.key);
                        const inspectionDate = getInspectionDateForColumn(entry, daySummary);
                        const isSelected = selectedMode === mode && entry.key === modeSelectedEntry;

                        return (
                          <TableCell
                            key={`${mode}-inspection-date-${entry.key}`}
                            align="center"
                            onClick={() => {
                              setSelectedMode(mode);
                              setSelectedEntryKey(entry.key);
                            }}
                            sx={getMonthDayCellSx(isSelected ? "#dbeafe" : "#fff")}
                          >
                            {daySummary?.recordId || inspectionDate ? inspectionDate || "-" : "-"}
                          </TableCell>
                        );
                      })}
                    </TableRow>
                  )}
                </>
              )}
              {modeInspectionEntryMode === "weekly" && (
                <TableRow>
                  <TableCell colSpan={modeDisplayColumns.length} sx={{ fontWeight: 700, bgcolor: "#f8fafc", pl: 3 }}>
                    Inspection Date
                  </TableCell>
                  {modeEntryColumns.map((entry) => {
                    const daySummary = modeDaySummaryMap.get(entry.key);
                    const inspectionDate = getInspectionDateForColumn(entry, daySummary);
                    const isSelected = selectedMode === mode && entry.key === modeSelectedEntry;

                    return (
                      <TableCell
                        key={`${mode}-weekly-inspection-date-${entry.key}`}
                        align="center"
                        onClick={() => {
                          setSelectedMode(mode);
                          setSelectedEntryKey(entry.key);
                        }}
                        sx={getMonthDayCellSx(isSelected ? "#dbeafe" : "#fff")}
                      >
                        {inspectionDate || "-"}
                      </TableCell>
                    );
                  })}
                </TableRow>
              )}
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
          <Stack direction={{ xs: "column", md: "row" }} justifyContent="space-between" alignItems={{ xs: "stretch", md: "flex-start" }} spacing={2}>
            <Box>
              <Typography variant="h5" fontWeight={700}>Monthly Inspection Detail</Typography>
              <Typography variant="body2" color="text.secondary">
                Daily results, shift, and simple day-by-day approvals are shown in one horizontal month sheet.
              </Typography>
            </Box>
            <Stack direction={{ xs: "column", sm: "row" }} spacing={1.5} alignItems={{ xs: "stretch", sm: "center" }}>
              <Button
                variant="outlined"
                startIcon={<FileDownloadOutlinedIcon />}
                disabled={exportMonthlyView.isPending}
                onClick={() => exportMonthlyView.mutate({ year, month })}
              >
                {exportMonthlyView.isPending ? "Exporting..." : "Export Excel"}
              </Button>
              <Button
                variant="outlined"
                startIcon={<ArrowBackOutlinedIcon />}
                onClick={() => navigate(`/checksheets/submissions/${submissionId}`)}
              >
                Back To Detail
              </Button>
            </Stack>
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
                  <Typography variant="body2"><strong>Process:</strong> {monthlyView.processName || "-"}</Typography>
                  <Typography variant="body2"><strong>Checksheet:</strong> {monthlyView.checksheetName || "-"}</Typography>
                </Stack>
                {machineEntryDetails.length > 0 && (
                  <Stack direction={{ xs: "column", md: "row" }} spacing={3} flexWrap="wrap">
                    {machineEntryDetails.map((detail) => (
                      <Typography key={detail.label} variant="body2">
                        <strong>{detail.label}:</strong> {detail.value}
                      </Typography>
                    ))}
                  </Stack>
                )}
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
          {referenceView?.currentApprovalRequestId ? (
            <Paper variant="outlined" sx={{ p: 3 }}>
              <Stack direction={{ xs: "column", lg: "row" }} spacing={2.5} alignItems={{ xs: "stretch", lg: "flex-start" }}>
                <Stack spacing={1.5} sx={{ minWidth: { lg: 260 }, maxWidth: { lg: 320 } }}>
                  <Box>
                    <Typography variant="h6" fontWeight={700}>Month-End Approval</Typography>
                    <Typography variant="body2" color="text.secondary">
                      Current request #{referenceView.currentApprovalRequestId}
                    </Typography>
                  </Box>
                  <Stack direction="row" spacing={1} flexWrap="wrap" useFlexGap>
                    <Chip label={`Submission: ${formatSubmissionStatus(monthlyView.status)}`} variant="outlined" />
                    {currentMonthEndApprovalStep ? (
                      <Chip color="primary" label={`Current: Step ${currentMonthEndApprovalStep.stepOrder}`} />
                    ) : (
                      <Chip color={monthlyView.status === "approved" ? "success" : monthlyView.status === "rejected" ? "error" : "default"} label="No active step" />
                    )}
                  </Stack>
                </Stack>

                <Box
                  sx={{
                    flex: 1,
                    display: "grid",
                    gap: 1.5,
                    gridTemplateColumns: {
                      xs: "minmax(0, 1fr)",
                      sm: "repeat(auto-fit, minmax(180px, 220px))"
                    },
                    justifyContent: { xs: "stretch", sm: "end" }
                  }}
                >
                  {monthEndApprovalSteps.map((step) => {
                    const isCurrentStep = currentMonthEndApprovalStep?.id === step.id;
                    const isApproved = step.status === "approved";
                    const isRejected = step.status === "rejected";
                    const cardColor = isApproved ? "success.main" : isRejected ? "error.main" : isCurrentStep ? "primary.main" : "divider";

                    return (
                      <Paper
                        key={step.id}
                        variant="outlined"
                        sx={{
                          position: "relative",
                          minHeight: 132,
                          p: 1.5,
                          borderColor: cardColor,
                          overflow: "hidden"
                        }}
                      >
                        <Box sx={{ position: "absolute", top: 0, left: 0, right: 0, height: 4, bgcolor: cardColor }} />
                        <Stack spacing={1.5} sx={{ height: "100%" }}>
                          <Stack direction="row" spacing={0.75} alignItems="center" justifyContent="space-between">
                            <Chip size="small" label={`Step ${step.stepOrder}`} color={isCurrentStep ? "primary" : isApproved ? "success" : isRejected ? "error" : "default"} />
                            <Chip
                              size="small"
                              color={isApproved ? "success" : isRejected ? "error" : isCurrentStep ? "primary" : "default"}
                              icon={isApproved ? <CheckOutlinedIcon /> : undefined}
                              label={step.status ? formatSubmissionStatus(step.status) : "-"}
                              sx={{ fontWeight: 700, maxWidth: 96 }}
                            />
                          </Stack>
                          <Box sx={{ textAlign: "center" }}>
                            <Typography variant="subtitle2" fontWeight={800} sx={{ overflowWrap: "anywhere" }}>
                              {step.stepName}
                            </Typography>
                            <Stack spacing={0.5} alignItems="center" sx={{ mt: 1 }}>
                              {(step.approvers ?? []).map((approver) => (
                                <Typography key={approver.userId} variant="body2" color="text.secondary" sx={{ overflowWrap: "anywhere", textAlign: "center" }}>
                                  {approver.fullName || approver.username || `User ${approver.userId}`}
                                </Typography>
                              ))}
                            </Stack>
                          </Box>
                          <Box sx={{ flexGrow: 1 }} />
                          <Stack spacing={1} alignItems="center">
                            {(step.responses ?? []).length > 0 ? (
                              <Stack direction="row" spacing={0.75} flexWrap="wrap" justifyContent="center" useFlexGap>
                                {step.responses.map((response) => (
                                  <Chip
                                    key={response.id}
                                    size="small"
                                    color={response.decision === "approved" ? "success" : "error"}
                                    label={response.fullName || response.username || `User ${response.userId}`}
                                  />
                                ))}
                              </Stack>
                            ) : null}
                            {isCurrentStep && canRespondMonthEndApproval ? (
                              <Button
                                variant="contained"
                                startIcon={<CheckOutlinedIcon />}
                                onClick={() => {
                                  setMonthEndApprovalTarget(step);
                                  setMonthEndDecision("approved");
                                  setMonthEndComment("");
                                }}
                                disabled={respondApprovalMutation.isPending}
                                fullWidth
                                size="small"
                                sx={{ maxWidth: 160 }}
                              >
                                Approve
                              </Button>
                            ) : null}
                          </Stack>
                        </Stack>
                      </Paper>
                    );
                  })}
                </Box>
              </Stack>
            </Paper>
          ) : null}
          <Typography variant="h6">{formatMonthTitle(monthValue)}</Typography>
          {orderedMonthlyViews.map((entry) => renderModeSheet(entry.view))}

          {isDraft ? (
            <>
              <Paper variant="outlined" sx={{ p: 3 }}>
                <Typography variant="h6" sx={{ mb: 1 }}>Inspection Entry Editor</Typography>
                <Typography variant="body2" color="text.secondary" sx={{ mb: 2 }}>
                  {inspectionEntryMode === "board"
                    ? `Selected board code: ${selectedBoardCode || "-"}`
                    : inspectionEntryMode === "weekly"
                      ? `Selected week: ${selectedEntry?.label ?? "-"}`
                      : `Selected date: ${selectedDateString}`}
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
                  label={inspectionEntryMode === "board" ? "Selected Board Code" : inspectionEntryMode === "weekly" ? "Selected Week" : "Selected Day"}
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
                  <TableContainer component={Paper} variant="outlined" sx={{ width: "100%", overflowX: "auto" }}>
                    <Table
                      size="small"
                      sx={{
                        minWidth: Math.max(860, displayColumns.length * 180 + 460),
                        tableLayout: "fixed",
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
                            <TableCell
                              key={column.key}
                              sx={{
                                width: column.key === "itemNo" ? 90 : 180,
                                minWidth: column.key === "itemNo" ? 90 : 180,
                                pl: columnIndex === 0 ? 3 : 2
                              }}
                            >
                              {column.label}
                            </TableCell>
                          ))}
                          <TableCell sx={{ width: 220, minWidth: 220, pl: 2 }}>Entry</TableCell>
                          <TableCell sx={{ width: 240, minWidth: 240, pl: 2 }}>Remark</TableCell>
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
                                    width: column.key === "itemNo" ? 90 : 180,
                                    minWidth: column.key === "itemNo" ? 90 : 180,
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
                            <TableCell sx={{ width: 220, minWidth: 220, pl: 2 }}>
                              {(item.valueType ?? "fixed") === "fixed" ? (
                                <ButtonGroup
                                  size="small"
                                  disabled={!isDraft || isInspectionMutationPending}
                                  sx={{ flexShrink: 0, whiteSpace: "nowrap" }}
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
                              ) : (item.valueType ?? "fixed") === "number" ? (
                                <TextField
                                  value={entryValues[item.templateItemId]?.resultValue ?? ""}
                                  onChange={(event) => handleInspectionValueChange(item.templateItemId, { resultValue: sanitizeNumberInput(event.target.value) })}
                                  placeholder="Enter number"
                                  size="small"
                                  fullWidth
                                  disabled={!isDraft || isInspectionMutationPending}
                                  inputProps={{ inputMode: "decimal", pattern: "[0-9]*[.]?[0-9]*" }}
                                />
                              ) : (item.valueType ?? "fixed") === JIG_NO_CHECK_VALUE_TYPE ? (
                                (() => {
                                  const jigNoCheckLines = formatJigNoCheckValue(entryValues[item.templateItemId]?.resultValue ?? "");
                                  return (
                                    <Button
                                      variant={jigNoCheckLines.length ? "contained" : "outlined"}
                                      size="small"
                                      fullWidth
                                      disabled={!isDraft || isInspectionMutationPending}
                                      onClick={() => handleOpenJigNoCheckDialog(item.templateItemId)}
                                      sx={{
                                        justifyContent: "flex-start",
                                        textAlign: "left",
                                        textTransform: "none",
                                        whiteSpace: "normal"
                                      }}
                                    >
                                      {jigNoCheckLines.length ? (
                                        <Stack spacing={0.25} sx={{ alignItems: "flex-start" }}>
                                          {jigNoCheckLines.map((line, lineIndex) => (
                                            <Typography key={`${item.templateItemId}-jig-no-check-${lineIndex}`} variant="caption" component="span">
                                              {line}
                                            </Typography>
                                          ))}
                                        </Stack>
                                      ) : (
                                        "Input Point"
                                      )}
                                    </Button>
                                  );
                                })()
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
                            <TableCell sx={{ width: 240, minWidth: 240, pl: 2 }}>
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
                      {inspectionEntryMode === "board"
                        ? "Delete Selected Board Entry"
                        : inspectionEntryMode === "weekly"
                          ? "Delete Selected Week"
                          : "Delete Selected Day"}
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
                                {(repairFormDefinition.formatType === "extended" || record.repairCode || record.repairResult) && (
                                  <Stack spacing={1} sx={{ mt: 1 }}>
                                    <Stack direction="row" spacing={1} useFlexGap flexWrap="wrap">
                                      <Chip size="small" variant="outlined" label={`Code ${record.repairCode || "-"}`} />
                                      <Chip size="small" variant="outlined" label={`${record.repairTimeMinutes ?? "-"} min`} />
                                      <Chip size="small" variant="outlined" label={`Point ${record.pointNo || "-"}`} />
                                      <Chip size="small" variant="outlined" label={`Jig ${record.jigNo || "-"}`} />
                                      <Chip size="small" variant="outlined" label={`Jig Code ${record.jigCode || "-"}`} />
                                    </Stack>
                                    {record.repairResult && (
                                      <Typography variant="body2" color="text.secondary">
                                        Result: {record.repairResult}
                                      </Typography>
                                    )}
                                    {(record.products?.length ?? 0) > 0 && (
                                      <Stack direction={{ xs: "column", md: "row" }} spacing={1.5} sx={{ alignItems: "stretch" }}>
                                        {["before", "after"].map((stage) => {
                                          const productRows = record.products.filter((product) => product.stage === stage);
                                          return (
                                            <Box
                                              key={stage}
                                              sx={{
                                                flex: 1,
                                                minWidth: 260,
                                                border: 1,
                                                borderColor: "divider",
                                                borderRadius: 1,
                                                overflow: "hidden"
                                              }}
                                            >
                                              <Box sx={{ px: 1.5, py: 1, bgcolor: "grey.50", borderBottom: 1, borderColor: "divider" }}>
                                                <Typography variant="subtitle2">
                                                  {stage === "before" ? "Before Reparation" : "After Reparation"}
                                                </Typography>
                                              </Box>
                                              <Stack divider={<Box sx={{ borderTop: 1, borderColor: "divider" }} />}>
                                                {productRows.length > 0 ? productRows.map((product) => (
                                                  <Box
                                                    key={product.id || `${stage}-${product.sortOrder}`}
                                                    sx={{
                                                      display: "grid",
                                                      gridTemplateColumns: { xs: "1fr auto", sm: "minmax(0, 1fr) 76px" },
                                                      gap: 1.5,
                                                      alignItems: "center",
                                                      px: 1.5,
                                                      py: 1
                                                    }}
                                                  >
                                                    <Typography variant="body2" sx={{ overflowWrap: "anywhere" }}>
                                                      {product.productSerial || "-"}
                                                    </Typography>
                                                    <Chip
                                                      size="small"
                                                      label={product.judgment || "-"}
                                                      color={product.judgment === "NG" ? "error" : "success"}
                                                      variant="outlined"
                                                      sx={{ justifySelf: "end", minWidth: 56, fontWeight: 700 }}
                                                    />
                                                  </Box>
                                                )) : (
                                                  <Typography variant="body2" color="text.secondary" sx={{ px: 1.5, py: 1 }}>
                                                    No product rows.
                                                  </Typography>
                                                )}
                                              </Stack>
                                            </Box>
                                          );
                                        })}
                                      </Stack>
                                    )}
                                  </Stack>
                                )}
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
                                {(record.checkedByAssyUserId || record.checkedByQaUserId || record.checkedByCoordinatorUserId) && (
                                  <Button
                                    color="warning"
                                    variant="outlined"
                                    disabled={cancelRepairApprovalMutation.isPending}
                                    onClick={() => setRepairApprovalCancelTarget({ ...record, repairFormTitle: repairFormDefinition.title })}
                                  >
                                    Cancel Approval
                                  </Button>
                                )}
                                {(!record.checkedByAssyUserId || !record.checkedByQaUserId || !record.checkedByCoordinatorUserId) && (
                                  <Button
                                    variant="outlined"
                                    disabled={approveRepairMutation.isPending}
                                    onClick={() => setRepairApprovalTarget({ ...record, repairFormTitle: repairFormDefinition.title })}
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
        <Dialog
          open={!!repairApprovalTarget}
          onClose={approveRepairMutation.isPending ? undefined : () => setRepairApprovalTarget(null)}
          fullWidth
          maxWidth="sm"
        >
          <DialogTitle>Approve Repair Record</DialogTitle>
          <DialogContent dividers>
            <Stack spacing={2}>
              <Typography>
                Approve level <strong>{getNextRepairApprovalLevel(repairApprovalTarget)}</strong> for this repair record?
              </Typography>
              {repairApprovalTarget?.repairFormTitle ? (
                <Typography variant="body2" color="text.secondary">
                  {repairApprovalTarget.repairFormTitle}
                </Typography>
              ) : null}
              <Typography variant="body2" color="text.secondary">
                {repairApprovalTarget?.damageDescription}
              </Typography>
              {repairApprovalTarget?.repairDescription ? (
                <Typography variant="body2" color="text.secondary">
                  {repairApprovalTarget.repairDescription}
                </Typography>
              ) : null}
            </Stack>
          </DialogContent>
          <DialogActions>
            <Button onClick={() => setRepairApprovalTarget(null)} disabled={approveRepairMutation.isPending}>
              Cancel
            </Button>
            <Button
              variant="contained"
              disabled={approveRepairMutation.isPending || !repairApprovalTarget}
              onClick={() => {
                if (!repairApprovalTarget) return;
                approveRepairMutation.mutate(
                  { submissionId, recordId: repairApprovalTarget.id },
                  { onSuccess: () => setRepairApprovalTarget(null) }
                );
              }}
            >
              {approveRepairMutation.isPending ? "Saving..." : "Approve"}
            </Button>
          </DialogActions>
        </Dialog>
        <Dialog
          open={!!repairApprovalCancelTarget}
          onClose={cancelRepairApprovalMutation.isPending ? undefined : () => setRepairApprovalCancelTarget(null)}
          fullWidth
          maxWidth="sm"
        >
          <DialogTitle>Cancel Repair Approval</DialogTitle>
          <DialogContent dividers>
            <Stack spacing={2}>
              <Alert severity="warning">
                This will cancel only the latest completed repair approval level.
              </Alert>
              <Typography>
                Cancel level <strong>{getLastRepairApprovalLevel(repairApprovalCancelTarget)}</strong> for this repair record?
              </Typography>
              {repairApprovalCancelTarget?.repairFormTitle ? (
                <Typography variant="body2" color="text.secondary">
                  {repairApprovalCancelTarget.repairFormTitle}
                </Typography>
              ) : null}
              <Typography variant="body2" color="text.secondary">
                {repairApprovalCancelTarget?.damageDescription}
              </Typography>
              {repairApprovalCancelTarget?.repairDescription ? (
                <Typography variant="body2" color="text.secondary">
                  {repairApprovalCancelTarget.repairDescription}
                </Typography>
              ) : null}
            </Stack>
          </DialogContent>
          <DialogActions>
            <Button onClick={() => setRepairApprovalCancelTarget(null)} disabled={cancelRepairApprovalMutation.isPending}>
              Keep Approval
            </Button>
            <Button
              color="warning"
              variant="contained"
              disabled={cancelRepairApprovalMutation.isPending || !repairApprovalCancelTarget}
              onClick={() => {
                if (!repairApprovalCancelTarget) return;
                cancelRepairApprovalMutation.mutate(
                  { submissionId, recordId: repairApprovalCancelTarget.id },
                  { onSuccess: () => setRepairApprovalCancelTarget(null) }
                );
              }}
            >
              {cancelRepairApprovalMutation.isPending ? "Cancelling..." : "Cancel Approval"}
            </Button>
          </DialogActions>
        </Dialog>
        <Dialog open={!!activeJigNoCheckItemId} onClose={handleCloseJigNoCheckDialog} fullWidth maxWidth="sm">
          <DialogTitle>Input Jig No Check</DialogTitle>
          <DialogContent dividers>
            <Stack spacing={1.5} sx={{ pt: 0.5 }}>
              <Stack direction="row" justifyContent="space-between" alignItems="center">
                <Typography variant="subtitle2">Point Rows</Typography>
                <Button size="small" startIcon={<AddIcon />} onClick={addJigNoCheckRow}>
                  Add Row
                </Button>
              </Stack>
              {jigNoCheckRows.map((row, index) => (
                <Stack key={index} direction={{ xs: "column", sm: "row" }} spacing={1} alignItems={{ xs: "stretch", sm: "flex-start" }}>
                  <TextField
                    label="Point No"
                    type="number"
                    value={row.pointNo}
                    onChange={(event) => updateJigNoCheckRow(index, { pointNo: sanitizeNumberInput(event.target.value) })}
                    size="small"
                    fullWidth
                    inputProps={{ inputMode: "decimal", pattern: "[0-9]*[.]?[0-9]*" }}
                  />
                  <TextField
                    label="Point Value"
                    type="number"
                    value={row.pointValue}
                    onChange={(event) => updateJigNoCheckRow(index, { pointValue: sanitizeNumberInput(event.target.value) })}
                    size="small"
                    fullWidth
                    inputProps={{ inputMode: "decimal", pattern: "[0-9]*[.]?[0-9]*" }}
                  />
                  <IconButton
                    color="error"
                    onClick={() => removeJigNoCheckRow(index)}
                    disabled={jigNoCheckRows.length === 1}
                    sx={{ alignSelf: { xs: "flex-end", sm: "flex-start" } }}
                  >
                    <DeleteOutlineIcon />
                  </IconButton>
                </Stack>
              ))}
            </Stack>
          </DialogContent>
          <DialogActions>
            <Button onClick={handleCloseJigNoCheckDialog}>Cancel</Button>
            <Button
              variant="contained"
              onClick={handleSaveJigNoCheckValue}
              disabled={jigNoCheckRows.some((row) => (row.pointNo && !row.pointValue) || (!row.pointNo && row.pointValue))}
            >
              Save
            </Button>
          </DialogActions>
        </Dialog>
        <Dialog
          open={!!monthEndApprovalTarget}
          onClose={respondApprovalMutation.isPending ? undefined : () => setMonthEndApprovalTarget(null)}
          fullWidth
          maxWidth="sm"
        >
          <DialogTitle>Respond Month-End Approval</DialogTitle>
          <DialogContent dividers>
            <Stack spacing={2}>
              {monthEndApprovalTarget ? (
                <Alert severity="info">
                  Step {monthEndApprovalTarget.stepOrder}: {monthEndApprovalTarget.stepName}
                </Alert>
              ) : null}
              <ToggleButtonGroup
                exclusive
                fullWidth
                value={monthEndDecision}
                onChange={(_, value) => {
                  if (value) {
                    setMonthEndDecision(value);
                  }
                }}
                disabled={respondApprovalMutation.isPending}
                sx={{
                  "& .MuiToggleButton-root": {
                    py: 1.25,
                    fontWeight: 700,
                    textTransform: "none"
                  }
                }}
              >
                <ToggleButton value="approved" color="success">
                  <CheckOutlinedIcon fontSize="small" sx={{ mr: 0.75 }} />
                  Approve
                </ToggleButton>
                <ToggleButton value="rejected" color="error">
                  Reject
                </ToggleButton>
              </ToggleButtonGroup>
              <TextField
                label="Comment"
                value={monthEndComment}
                onChange={(event) => setMonthEndComment(event.target.value)}
                multiline
                minRows={3}
              />
            </Stack>
          </DialogContent>
          <DialogActions>
            <Button onClick={() => setMonthEndApprovalTarget(null)} disabled={respondApprovalMutation.isPending}>
              Cancel
            </Button>
            <Button
              variant="contained"
              onClick={() => {
                if (!monthEndApprovalTarget || !referenceView?.currentApprovalRequestId) return;

                respondApprovalMutation.mutate(
                  {
                    requestId: referenceView.currentApprovalRequestId,
                    stepId: monthEndApprovalTarget.id,
                    data: { decision: monthEndDecision, comment: monthEndComment.trim() || null }
                  },
                  {
                    onSuccess: () => {
                      setMonthEndApprovalTarget(null);
                      setMonthEndDecision("approved");
                      setMonthEndComment("");
                    }
                  }
                );
              }}
              disabled={respondApprovalMutation.isPending}
            >
              {respondApprovalMutation.isPending ? "Saving..." : "Submit"}
            </Button>
          </DialogActions>
        </Dialog>
        <Dialog open={!!activeRepairFormDefinition} onClose={handleCloseRepairDialog} fullWidth maxWidth="md">
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
              {activeRepairFormDefinition?.formatType === "extended" && (
                <>
                  <Stack direction={{ xs: "column", md: "row" }} spacing={1.5} alignItems="flex-start">
                    <TextField
                      select
                      label="Repair Code"
                      value={(repairFormsState[activeRepairFormDefinition.formKey] ?? createEmptyRepairForm()).repairCode}
                      onChange={(event) => updateRepairFormValue(activeRepairFormDefinition.formKey, { repairCode: event.target.value })}
                      size="small"
                      sx={{ minWidth: 160 }}
                      disabled={createRepairMutation.isPending}
                    >
                      {REPAIR_CODE_OPTIONS.map((code) => (
                        <MenuItem key={code} value={code}>{code}</MenuItem>
                      ))}
                    </TextField>
                    <TextField
                      label="Time (Minute)"
                      type="number"
                      value={(repairFormsState[activeRepairFormDefinition.formKey] ?? createEmptyRepairForm()).repairTimeMinutes}
                      onChange={(event) => updateRepairFormValue(activeRepairFormDefinition.formKey, { repairTimeMinutes: event.target.value })}
                      size="small"
                      inputProps={{ min: 0 }}
                      sx={{ minWidth: 180 }}
                      disabled={createRepairMutation.isPending}
                    />
                  </Stack>
                  <TextField
                    label="No. Point"
                    value={(repairFormsState[activeRepairFormDefinition.formKey] ?? createEmptyRepairForm()).pointNo}
                    onChange={(event) => updateRepairFormValue(activeRepairFormDefinition.formKey, { pointNo: event.target.value })}
                    size="small"
                    fullWidth
                    disabled={createRepairMutation.isPending}
                  />
                  <TextField
                    label="No. Jig"
                    value={(repairFormsState[activeRepairFormDefinition.formKey] ?? createEmptyRepairForm()).jigNo}
                    onChange={(event) => updateRepairFormValue(activeRepairFormDefinition.formKey, { jigNo: event.target.value })}
                    size="small"
                    fullWidth
                    disabled={createRepairMutation.isPending}
                  />
                  <TextField
                    label="Jig Code"
                    value={(repairFormsState[activeRepairFormDefinition.formKey] ?? createEmptyRepairForm()).jigCode}
                    onChange={(event) => updateRepairFormValue(activeRepairFormDefinition.formKey, { jigCode: event.target.value })}
                    size="small"
                    fullWidth
                    disabled={createRepairMutation.isPending}
                  />
                  <TextField
                    label="Repair Result"
                    value={(repairFormsState[activeRepairFormDefinition.formKey] ?? createEmptyRepairForm()).repairResult}
                    onChange={(event) => updateRepairFormValue(activeRepairFormDefinition.formKey, { repairResult: event.target.value })}
                    multiline
                    minRows={2}
                    size="small"
                    fullWidth
                    disabled={createRepairMutation.isPending}
                  />
                </>
              )}
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
              {activeRepairFormDefinition?.formatType === "extended" && (
                <Stack spacing={2}>
                  {[
                    { key: "beforeProducts", stage: "before", title: "Before Reparation" },
                    { key: "afterProducts", stage: "after", title: "After Reparation" }
                  ].map((section) => {
                    const currentRows = (repairFormsState[activeRepairFormDefinition.formKey] ?? createEmptyRepairForm())[section.key] ?? [];
                    return (
                      <Paper key={section.stage} variant="outlined" sx={{ p: 1.5 }}>
                        <Stack spacing={1.25}>
                          <Stack direction="row" justifyContent="space-between" alignItems="center">
                            <Typography variant="subtitle2">{section.title}</Typography>
                            <Button size="small" onClick={() => addRepairProductRow(activeRepairFormDefinition.formKey, section.stage)} disabled={createRepairMutation.isPending}>
                              Add Row
                            </Button>
                          </Stack>
                          {currentRows.map((product, index) => (
                            <Stack key={`${section.stage}-${index}`} direction={{ xs: "column", md: "row" }} spacing={1} alignItems={{ xs: "stretch", md: "flex-start" }}>
                              <TextField
                                label="Product Serial"
                                value={product.productSerial}
                                onChange={(event) => updateRepairProductValue(activeRepairFormDefinition.formKey, section.stage, index, { productSerial: event.target.value })}
                                size="small"
                                fullWidth
                                disabled={createRepairMutation.isPending}
                              />
                              <TextField
                                select
                                label="Judgment"
                                value={product.judgment}
                                onChange={(event) => updateRepairProductValue(activeRepairFormDefinition.formKey, section.stage, index, { judgment: event.target.value })}
                                size="small"
                                sx={{ minWidth: 130 }}
                                disabled={createRepairMutation.isPending}
                              >
                                {REPAIR_JUDGMENT_OPTIONS.map((judgment) => (
                                  <MenuItem key={judgment} value={judgment}>{judgment}</MenuItem>
                                ))}
                              </TextField>
                              <IconButton
                                color="error"
                                onClick={() => removeRepairProductRow(activeRepairFormDefinition.formKey, section.stage, index)}
                                disabled={createRepairMutation.isPending || currentRows.length === 1}
                                sx={{ mt: { md: 0.25 }, alignSelf: { xs: "flex-end", md: "flex-start" } }}
                              >
                                <DeleteOutlineIcon />
                              </IconButton>
                            </Stack>
                          ))}
                        </Stack>
                      </Paper>
                    );
                  })}
                </Stack>
              )}
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
