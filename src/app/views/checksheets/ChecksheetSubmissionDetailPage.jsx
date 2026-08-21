import { useEffect, useMemo, useState } from "react";
import { useNavigate, useParams } from "react-router-dom";
import {
  Alert,
  Box,
  Button,
  Chip,
  Checkbox,
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
import AddIcon from "@mui/icons-material/Add";
import DeleteOutlineIcon from "@mui/icons-material/DeleteOutline";
import SendOutlinedIcon from "@mui/icons-material/SendOutlined";
import { AdapterDateFns } from "@mui/x-date-pickers/AdapterDateFnsV3";
import { DatePicker, LocalizationProvider } from "@mui/x-date-pickers";
import { ConfirmationDialog } from "app/components";
import { getChecksheetSubmissions } from "@api/checksheets";
import useAuth from "app/hooks/useAuth";
import {
  useApproveDailyInspectionStep,
  useApproveRepairRecord,
  useApprovalRequest,
  useApprovalTemplates,
  useChecksheetMachines,
  useChecksheetMasters,
  useChecksheetSubmission,
  useChecksheetSubmissionMonthlyView,
  useCreateChecksheetSubmission,
  useCreateInspectionRecord,
  useCreateRepairRecord,
  useDeleteInspectionRecord,
  useDeleteRepairRecord,
  useCreateApprovalRequest,
  useCancelApprovalRequest,
  useCancelRepairRecordApproval,
  useDeleteChecksheetSubmission,
  useUpdateChecksheetSubmission,
  useUpdateInspectionRecord
} from "app/hooks/useChecksheets";

const FIXED_OPTIONS = ["OK", "NG", "FIX", "-"];
const JIG_NO_CHECK_VALUE_TYPE = "jig_no_check";
const REPAIR_CODE_OPTIONS = ["D", "R", "P"];
const REPAIR_JUDGMENT_OPTIONS = ["OK", "NG"];
const ITEM_CELL_TYPES_KEY = "__cellTypes";
const TEMPLATE_CELL_TYPES = ["text", "textarea", "image"];

function getImageUrl(value) {
  if (!value) return "";

  if (typeof value === "object") {
    return getImageUrl(value.url ?? value.relativeUrl ?? value.path ?? value.fileUrl);
  }

  const rawValue = String(value).trim().replace(/^["']|["']$/g, "");
  if (!rawValue) {
    return "";
  }

  if (rawValue.startsWith("{")) {
    try {
      const parsed = JSON.parse(rawValue);
      return getImageUrl(parsed);
    } catch {
      return "";
    }
  }

  if (/^(data:|blob:)/i.test(rawValue)) {
    return rawValue;
  }

  if (/^https?:\/\//i.test(rawValue)) {
    try {
      const parsedUrl = new URL(rawValue);
      return getImageUrl(`${parsedUrl.pathname}${parsedUrl.search}`);
    } catch {
      return rawValue;
    }
  }

  const normalizedPath = rawValue
    .replace(/\\/g, "/")
    .replace(/^\/api\/uploads\//, "/uploads/")
    .replace(/^api\/uploads\//, "uploads/");

  if (normalizedPath.startsWith("/uploads/")) {
    return normalizedPath;
  }

  if (normalizedPath.startsWith("uploads/")) {
    return `/${normalizedPath}`;
  }

  return normalizedPath;
}

function isImageCellValue(value) {
  const url = getImageUrl(value);
  return /\.(png|jpe?g|gif|webp)(\?.*)?$/i.test(url) || url.includes("/uploads/checksheet-template-items/");
}

function parseItemCellTypes(value) {
  if (!value) {
    return {};
  }

  if (typeof value === "object" && !Array.isArray(value)) {
    return Object.entries(value).reduce((next, [columnKey, cellType]) => {
      if (TEMPLATE_CELL_TYPES.includes(cellType)) {
        next[columnKey] = cellType;
      }
      return next;
    }, {});
  }

  try {
    return parseItemCellTypes(JSON.parse(value));
  } catch {
    return {};
  }
}

function getExplicitCellType(column, item) {
  return parseItemCellTypes(item?.data?.[ITEM_CELL_TYPES_KEY])[column.columnKey] ?? null;
}

function isTemplateImageCell(column, item, value) {
  const explicitCellType = getExplicitCellType(column, item);

  if (explicitCellType) {
    return explicitCellType === "image";
  }

  return column.columnType === "image" || isImageCellValue(value);
}

function TemplateItemCellContent({ column, item, value }) {
  const explicitCellType = getExplicitCellType(column, item);

  if (explicitCellType && explicitCellType !== "image") {
    return value || "-";
  }

  if (!isTemplateImageCell(column, item, value)) {
    return value || "-";
  }


  const imageUrl = getImageUrl(value);
  if (!imageUrl) {
    return "-";
  }

  return (
    <Box
      component="img"
      src={imageUrl}
      alt={column.label}
      sx={{
        width: "auto",
        height: "auto",
        maxWidth: "none",
        maxHeight: "none",
        display: "block",
        border: 1,
        borderColor: "divider",
        borderRadius: 1,
        bgcolor: "background.default"
      }}
    />
  );
}

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

function getMachineEntryDetails(source, fallback = {}) {
  return [
    { label: "Stand No.", value: source?.standNo || fallback?.standNo },
    { label: "Sub Assy No.", value: source?.subAssyNo || fallback?.subAssyNo },
    {
      label: "Machine Code",
      value: (source?.machineCodes?.length ? source.machineCodes : fallback?.machineCodes ?? []).join(", ")
    }
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

function getMonthRange(dateValue) {
  if (!dateValue) {
    return { from: undefined, to: undefined };
  }

  const [year, month] = String(dateValue).slice(0, 7).split("-").map(Number);
  if (!year || !month) {
    return { from: undefined, to: undefined };
  }

  const from = `${year}-${String(month).padStart(2, "0")}-01`;
  const toDate = new Date(year, month, 0);
  const to = `${toDate.getFullYear()}-${String(toDate.getMonth() + 1).padStart(2, "0")}-${String(toDate.getDate()).padStart(2, "0")}`;
  return { from, to };
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

function getLatestSubmission(submissions) {
  return [...(submissions ?? [])].sort((left, right) => {
    const leftDate = left.inspectionDate ? new Date(left.inspectionDate).getTime() : 0;
    const rightDate = right.inspectionDate ? new Date(right.inspectionDate).getTime() : 0;
    return rightDate - leftDate || Number(right.id ?? 0) - Number(left.id ?? 0);
  })[0] ?? null;
}

async function findExistingMonthlySubmissions(machineCode, inspectionDate) {
  const { from, to } = getMonthRange(inspectionDate);
  const response = await getChecksheetSubmissions({
    page: 1,
    pageSize: 100,
    machineCode,
    inspectionDateFrom: from,
    inspectionDateTo: to
  });
  const responseItems = response?.items ?? response?.data?.items ?? [];
  const requestedMonth = String(inspectionDate ?? "").slice(0, 7);

  return responseItems.filter((item) =>
    item.machineCode === machineCode &&
    String(item.inspectionDate ?? "").slice(0, 7) === requestedMonth
  );
}

function mapRecordTypeToUi(recordType) {
  return normalizeChecksheetMode(recordType, "daily");
}

function normalizeInspectionEntryMode(value) {
  const normalized = String(value || "").trim().toLowerCase();
  if (normalized === "board") return "board";
  if (normalized === "weekly") return "weekly";
  if (normalized === "free_text") return "free_text";
  return "date";
}

function parseInspectionEntryOptions(optionsJson) {
  if (!optionsJson) {
    return [];
  }

  try {
    const parsed = JSON.parse(optionsJson);
    return Array.isArray(parsed)
      ? parsed
        .map((option) => {
          if (typeof option === "string") {
            return { label: option.trim(), valueType: "free_text" };
          }

          return {
            label: String(option?.label ?? "").trim(),
            valueType: ["fixed", "free_text", "number", "jig_no_check"].includes(option?.valueType) ? option.valueType : "free_text"
          };
        })
        .filter((option) => option.label)
      : [];
  } catch {
    return [];
  }
}

function getWeekOfMonth(dateValue) {
  const day = Number(String(dateValue ?? "").slice(8, 10));
  return day > 0 ? Math.ceil(day / 7) : 1;
}

function getWeekStartDateValue(dateValue) {
  const normalizedDate = String(dateValue ?? "");
  const monthValue = normalizedDate.slice(0, 7);
  if (!monthValue) {
    return "";
  }

  const week = getWeekOfMonth(normalizedDate);
  return `${monthValue}-${String(((week - 1) * 7) + 1).padStart(2, "0")}`;
}

function getWeeklyEntryOptions(dateValue) {
  const monthValue = String(dateValue ?? "").slice(0, 7);
  if (!monthValue) {
    return [];
  }

  const [year, month] = monthValue.split("-").map(Number);
  if (!year || !month) {
    return [];
  }

  const daysInMonth = new Date(year, month, 0).getDate();
  const weekCount = Math.ceil(daysInMonth / 7);

  return Array.from({ length: weekCount }, (_, index) => {
    const week = index + 1;
    return {
      value: `${monthValue}-${String(((week - 1) * 7) + 1).padStart(2, "0")}`,
      label: `Week ${week}`
    };
  });
}

function isRecordForTemplate(record, templateId) {
  return !templateId || !record.templateId || Number(record.templateId) === Number(templateId);
}

function getLatestRecordForMode(records, mode, templateId) {
  const normalizedMode = normalizeChecksheetMode(mode);
  return [...(records ?? [])]
    .filter((record) => mapRecordTypeToUi(record.recordType) === normalizedMode && isRecordForTemplate(record, templateId))
    .sort((left, right) => {
      const leftDate = left.inspectionDate ? new Date(left.inspectionDate).getTime() : 0;
      const rightDate = right.inspectionDate ? new Date(right.inspectionDate).getTime() : 0;
      return rightDate - leftDate || right.id - left.id;
    })[0] ?? null;
}

function getRecordForModeAndDate(records, mode, inspectionDate, templateId) {
  if (!inspectionDate) {
    return null;
  }

  const normalizedMode = normalizeChecksheetMode(mode);
  return [...(records ?? [])]
    .filter((record) =>
      mapRecordTypeToUi(record.recordType) === normalizedMode &&
      isRecordForTemplate(record, templateId) &&
      String(record.inspectionDate ?? "") === String(inspectionDate)
    )
    .sort((left, right) => right.id - left.id)[0] ?? null;
}

function getRecordForModeAndWeek(records, mode, inspectionDate, templateId) {
  if (!inspectionDate) {
    return null;
  }

  const normalizedMode = normalizeChecksheetMode(mode);
  const selectedMonth = String(inspectionDate).slice(0, 7);
  const selectedWeek = getWeekOfMonth(inspectionDate);

  return [...(records ?? [])]
    .filter((record) =>
      mapRecordTypeToUi(record.recordType) === normalizedMode &&
      isRecordForTemplate(record, templateId) &&
      String(record.inspectionDate ?? "").slice(0, 7) === selectedMonth &&
      getWeekOfMonth(record.inspectionDate) === selectedWeek
    )
    .sort((left, right) => right.id - left.id)[0] ?? null;
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

  if (!rows.length) {
    return [];
  }

  return rows.map((row) => `Jig No. ${row.pointNo} : ${row.pointValue}`);
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

function getRecordForModeAndBoardCode(records, mode, boardCode, templateId) {
  const normalizedBoardCode = normalizeBoardCode(boardCode);
  if (!normalizedBoardCode) {
    return null;
  }

  const normalizedMode = normalizeChecksheetMode(mode);
  return [...(records ?? [])]
    .filter((record) =>
      mapRecordTypeToUi(record.recordType) === normalizedMode &&
      isRecordForTemplate(record, templateId) &&
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

const MIN_TEMPLATE_COLUMN_WIDTH = 60;
const MAX_TEMPLATE_COLUMN_WIDTH = 480;
const ENTRY_COLUMN_WIDTH = 220;
const REMARK_COLUMN_WIDTH = 240;

function clampTemplateColumnWidth(value) {
  const numericValue = Number(value);
  if (!Number.isFinite(numericValue)) {
    return null;
  }

  return Math.min(MAX_TEMPLATE_COLUMN_WIDTH, Math.max(MIN_TEMPLATE_COLUMN_WIDTH, Math.round(numericValue)));
}

function getDefaultTemplateColumnWidth(column) {
  const columnKey = String(column?.columnKey ?? column?.key ?? "").trim().toLowerCase();
  const label = String(column?.label ?? "").trim().toLowerCase();

  if (column?.columnType === "image") {
    return 220;
  }

  if (["no", "itemno", "item_no"].includes(columnKey) || ["no.", "no"].includes(label)) {
    return 72;
  }

  if (
    column?.columnType === "textarea" ||
    ["itemname", "item_name", "method", "criteria", "tujuan", "konten", "item", "metodepengecekan", "penilaian"].includes(columnKey)
  ) {
    return 220;
  }

  return 140;
}

function getTemplateColumnWidth(column) {
  const columnOptions = parseColumnOptions(column?.optionsJson);
  return clampTemplateColumnWidth(columnOptions.widthPx) ?? getDefaultTemplateColumnWidth(column);
}

function getTemplateColumnCellSx(column, columnIndex, width) {
  const isImageColumn = column?.columnType === "image";

  return {
    pl: columnIndex === 0 ? 3 : 2,
    width: isImageColumn ? "max-content" : width,
    minWidth: isImageColumn ? width : width,
    maxWidth: isImageColumn ? "none" : width,
    whiteSpace: isImageColumn ? "nowrap" : "normal",
    overflowWrap: "anywhere",
    wordBreak: "break-word"
  };
}

function isColumnSpanEnabled(column) {
  const columnOptions = parseColumnOptions(column?.optionsJson);
  return columnOptions.enableColSpan ?? false;
}

function normalizeHeaderLabel(value) {
  return String(value ?? "").trim();
}

function buildHeaderGroups(columns, columnWidths) {
  const groups = [];
  let columnIndex = 0;

  while (columnIndex < columns.length) {
    const column = columns[columnIndex];
    const label = normalizeHeaderLabel(column?.label);
    const canMerge = isColumnSpanEnabled(column);
    let colSpan = 1;
    let width = columnWidths[columnIndex] ?? getTemplateColumnWidth(column);

    if (canMerge && label) {
      let nextIndex = columnIndex + 1;

      while (
        nextIndex < columns.length &&
        isColumnSpanEnabled(columns[nextIndex]) &&
        normalizeHeaderLabel(columns[nextIndex]?.label) === label
      ) {
        width += columnWidths[nextIndex] ?? getTemplateColumnWidth(columns[nextIndex]);
        colSpan += 1;
        nextIndex += 1;
      }
    }

    groups.push({
      column,
      columnIndex,
      colSpan,
      width
    });
    columnIndex += colSpan;
  }

  return groups;
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
  const [selectedTemplateId, setSelectedTemplateId] = useState("");
  const {
    data: baseSubmission,
    isLoading: isBaseLoading,
    isError: isBaseError,
    error: baseError
  } = useChecksheetSubmission(submissionId);
  const checksheetMode = normalizeChecksheetMode(selectedMode || baseSubmission?.checksheetMode || "");
  const { data: submission, isLoading, isError, error } = useChecksheetSubmission(submissionId, {
    params: checksheetMode ? { checksheetMode, ...(selectedTemplateId ? { templateId: selectedTemplateId } : {}) } : undefined,
    enabled: !!submissionId && !!checksheetMode,
    placeholderData: (previousData) => previousData ?? baseSubmission
  });
  const { data: approvalTemplates } = useApprovalTemplates({ page: 1, pageSize: 100, isActive: true });
  const createInspectionMutation = useCreateInspectionRecord(submissionId);
  const { data: checksheetMasters = [] } = useChecksheetMasters();
  const { data: machinesPage } = useChecksheetMachines({ page: 1, pageSize: 100 });
  const createSubmissionMutation = useCreateChecksheetSubmission();
  const updateSubmissionMutation = useUpdateChecksheetSubmission(submissionId);
  const deleteSubmissionMutation = useDeleteChecksheetSubmission();
  const createRepairMutation = useCreateRepairRecord(submissionId);
  const approveRepairMutation = useApproveRepairRecord();
  const cancelRepairApprovalMutation = useCancelRepairRecordApproval();
  const deleteInspectionMutation = useDeleteInspectionRecord(submissionId);
  const deleteRepairMutation = useDeleteRepairRecord(submissionId);
  const createApprovalMutation = useCreateApprovalRequest(submissionId);
  const cancelApprovalMutation = useCancelApprovalRequest(submissionId);
  const approveDailyStepMutation = useApproveDailyInspectionStep(submissionId);
  const [approvalTemplateId, setApprovalTemplateId] = useState("");
  const [inspectionDate, setInspectionDate] = useState("");
  const [boardCode, setBoardCode] = useState("");
  const [selectedInspectionMachineCodes, setSelectedInspectionMachineCodes] = useState([]);
  const [inspectionShift, setInspectionShift] = useState("1");
  const [inspectionNote, setInspectionNote] = useState("");
  const [entryValues, setEntryValues] = useState({});
  const availableRepairForms = useMemo(
    () => (submission?.availableRepairForms?.length ? submission.availableRepairForms : [{ formKey: "repair-form-1", title: "Repair Entry", sortOrder: 1 }]),
    [submission?.availableRepairForms]
  );
  const [repairFormsState, setRepairFormsState] = useState({});
  const [activeRepairDialogKey, setActiveRepairDialogKey] = useState("");
  const [activeJigNoCheckItemId, setActiveJigNoCheckItemId] = useState(null);
  const [jigNoCheckRows, setJigNoCheckRows] = useState([createEmptyJigNoCheckRow()]);
  const [deleteTarget, setDeleteTarget] = useState(null);
  const [repairApprovalTarget, setRepairApprovalTarget] = useState(null);
  const [repairApprovalCancelTarget, setRepairApprovalCancelTarget] = useState(null);
  const [cancelSubmissionOpen, setCancelSubmissionOpen] = useState(false);
  const [standNavigationTarget, setStandNavigationTarget] = useState(null);
  const [standNavigationPendingMachineCode, setStandNavigationPendingMachineCode] = useState("");

  const inspectionRecords = submission?.inspectionRecords ?? [];
  const latestInspectionRecord = useMemo(
    () => getLatestRecordForMode(inspectionRecords, checksheetMode, selectedTemplateId),
    [inspectionRecords, checksheetMode, selectedTemplateId]
  );
  const inspectionEntryMode = useMemo(
    () => normalizeInspectionEntryMode(submission?.template?.inspectionEntryMode),
    [submission?.template?.inspectionEntryMode]
  );
  const selectedInspectionRecord = useMemo(
    () => {
      if (inspectionEntryMode === "board" || inspectionEntryMode === "free_text") {
        return getRecordForModeAndBoardCode(inspectionRecords, checksheetMode, boardCode, selectedTemplateId);
      }

      if (inspectionEntryMode === "weekly") {
        return getRecordForModeAndWeek(inspectionRecords, checksheetMode, inspectionDate, selectedTemplateId);
      }

      return getRecordForModeAndDate(inspectionRecords, checksheetMode, inspectionDate, selectedTemplateId);
    },
    [boardCode, checksheetMode, inspectionDate, inspectionEntryMode, inspectionRecords, selectedTemplateId]
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
      return base ? { ...base, checksheetMode, ...(selectedTemplateId ? { templateId: selectedTemplateId } : {}) } : null;
    },
    [checksheetMode, inspectionDate, latestInspectionRecord?.inspectionDate, selectedInspectionRecord?.inspectionDate, selectedTemplateId, submission?.inspectionDate]
  );
  const { data: monthlyView } = useChecksheetSubmissionMonthlyView(submissionId, monthlyParams, {
    enabled: !!submissionId && !!monthlyParams?.year && !!monthlyParams?.month,
    placeholderData: (previousData) => previousData
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
  const templateColumnWidths = useMemo(
    () => templateColumns.map((column) => getTemplateColumnWidth(column)),
    [templateColumns]
  );
  const templateHeaderGroups = useMemo(
    () => buildHeaderGroups(templateColumns, templateColumnWidths),
    [templateColumns, templateColumnWidths]
  );
  const inspectionTableMinWidth = useMemo(
    () => Math.max(
      860,
      templateColumnWidths.reduce((total, width) => total + width, 0) + ENTRY_COLUMN_WIDTH + REMARK_COLUMN_WIDTH
    ),
    [templateColumnWidths]
  );
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
  const machines = useMemo(() => machinesPage?.items ?? machinesPage ?? [], [machinesPage]);
  const currentMachine = machines.find((item) => item.machineCode === submission?.machineCode);
  const currentMaster = checksheetMasters.find((item) =>
    Number(item.id) === Number(submission?.checksheetMasterId ?? currentMachine?.checksheetMasterId)
  );
  const useStandNoNavigation = !!currentMaster?.useStandNo;
  const multiProductNo = submission?.multiProductNo || currentMachine?.multiProductNo || "-";
  const processName = submission?.processName || currentMachine?.processName || "-";
  const checksheetName = submission?.checksheetName || currentMachine?.checksheetName || "-";
  const templateDescription = String(submission?.template?.description ?? "").trim();
  const availableInspectionMachineCodes = useMemo(
    () => (submission?.machineCodes?.length ? submission.machineCodes : currentMachine?.machineCodes ?? []),
    [currentMachine?.machineCodes, submission?.machineCodes]
  );
  const machineEntryDetails = getMachineEntryDetails(submission, currentMachine);
  const standNavigationOptions = useMemo(
    () => {
      if (!useStandNoNavigation || !submission) {
        return [];
      }

      const masterId = Number(submission.checksheetMasterId ?? currentMachine?.checksheetMasterId);
      const lineCode = submission.lineCode ?? currentMachine?.lineCode;
      const processCode = submission.processCode ?? currentMachine?.processCode;

      return machines
        .filter((machine) =>
          machine.isActive !== false &&
          String(machine.standNo ?? "").trim() &&
          Number(machine.checksheetMasterId) === masterId &&
          String(machine.lineCode ?? "") === String(lineCode ?? "") &&
          String(machine.processCode ?? "") === String(processCode ?? "")
        )
        .sort((left, right) =>
          String(left.standNo ?? "").localeCompare(String(right.standNo ?? ""), undefined, { numeric: true, sensitivity: "base" }) ||
          String(left.machineCode ?? "").localeCompare(String(right.machineCode ?? ""))
        );
    },
    [currentMachine?.checksheetMasterId, currentMachine?.lineCode, currentMachine?.processCode, machines, submission, useStandNoNavigation]
  );
  const weeklyEntryOptions = useMemo(
    () => getWeeklyEntryOptions(inspectionDate || latestInspectionRecord?.inspectionDate || submission?.inspectionDate),
    [inspectionDate, latestInspectionRecord?.inspectionDate, submission?.inspectionDate]
  );
  const freeTextEntryOptions = useMemo(
    () => parseInspectionEntryOptions(submission?.template?.inspectionEntryOptionsJson),
    [submission?.template?.inspectionEntryOptionsJson]
  );
  const selectedInspectionEntryOption = useMemo(
    () => freeTextEntryOptions.find((option) => option.label === boardCode) ?? null,
    [boardCode, freeTextEntryOptions]
  );
  const machineModes = useMemo(() => {
    const modes = currentMachine?.modes?.length ? currentMachine.modes : [submission?.checksheetMode ?? "daily"];
    return [...new Set(modes.map((mode) => normalizeChecksheetMode(mode)).filter(Boolean))];
  }, [currentMachine?.modes, submission?.checksheetMode]);
  const modeTemplateOptions = useMemo(
    () => (currentMachine?.modeTemplates ?? [])
      .filter((item) => normalizeChecksheetMode(item.checksheetMode) === checksheetMode && item.templateId)
      .sort((left, right) => String(left.templateName ?? "").localeCompare(String(right.templateName ?? ""))),
    [checksheetMode, currentMachine?.modeTemplates]
  );
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
    if (!checksheetMode || modeTemplateOptions.length === 0) {
      setSelectedTemplateId("");
      return;
    }

    setSelectedTemplateId((current) =>
      modeTemplateOptions.some((item) => String(item.templateId) === String(current))
        ? current
        : String(modeTemplateOptions[0].templateId)
    );
  }, [checksheetMode, modeTemplateOptions]);

  useEffect(() => {
    if (inspectionEntryMode === "board") {
      setBoardCode(getRecordBoardCode(latestInspectionRecord) || "");
      return;
    }

    if (inspectionEntryMode === "free_text") {
      const latestEntry = getRecordBoardCode(latestInspectionRecord);
      setBoardCode(
        freeTextEntryOptions.find((option) => normalizeBoardCode(option.label) === latestEntry)?.label ??
        freeTextEntryOptions[0]?.label ??
        ""
      );
      setInspectionDate(submission?.inspectionDate ?? latestInspectionRecord?.inspectionDate ?? "");
      return;
    }

    setBoardCode("");
    if (inspectionEntryMode === "weekly") {
      setInspectionDate(getWeekStartDateValue(latestInspectionRecord?.inspectionDate ?? submission?.inspectionDate ?? ""));
      return;
    }

    setInspectionDate(latestInspectionRecord?.inspectionDate ?? submission?.inspectionDate ?? "");
  }, [checksheetMode, freeTextEntryOptions, inspectionEntryMode, latestInspectionRecord?.id, latestInspectionRecord?.inspectionDate, submission?.inspectionDate]);

  useEffect(() => {
    setInspectionShift(selectedInspectionRecord?.shift ?? submission?.shift ?? "1");
    setInspectionNote(selectedInspectionRecord?.note ?? "");
    setSelectedInspectionMachineCodes(
      selectedInspectionRecord?.machineCodes?.length
        ? selectedInspectionRecord.machineCodes
        : availableInspectionMachineCodes
    );
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
    selectedInspectionRecord?.machineCodes,
    selectedInspectionRecord?.updatedAt,
    inspectionDate,
    boardCode,
    inspectionValueSignature,
    availableInspectionMachineCodes,
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
  const hasRequiredInspectionEntry = inspectionEntryMode !== "free_text" || !!boardCode.trim();
  const getEffectiveValueType = (item) =>
    inspectionEntryMode === "free_text"
      ? selectedInspectionEntryOption?.valueType ?? "free_text"
      : item.valueType ?? "fixed";
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

  const handleOpenJigNoCheckDialog = (itemId) => {
    const rows = parseJigNoCheckValue(getEntryValue(itemId, "resultValue"));
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

  const toggleInspectionMachineCode = (machineCode) => {
    setSelectedInspectionMachineCodes((current) =>
      current.includes(machineCode)
        ? current.filter((item) => item !== machineCode)
        : [...current, machineCode]
    );
  };

  const handleSaveInspectionRecord = () => {
    const resolvedInspectionDate = inspectionEntryMode === "board"
      ? selectedInspectionRecord?.inspectionDate || submission?.inspectionDate || null
      : inspectionEntryMode === "weekly"
        ? inspectionDate || selectedInspectionRecord?.inspectionDate || submission?.inspectionDate || null
        : inspectionDate || selectedInspectionRecord?.inspectionDate || submission?.inspectionDate || null;
    const isEntryCodeMode = inspectionEntryMode === "board" || inspectionEntryMode === "free_text";
    const payload = {
      recordType: checksheetMode,
      templateId: selectedTemplateId ? Number(selectedTemplateId) : undefined,
      inspectionDate: resolvedInspectionDate,
      boardCode: isEntryCodeMode ? (inspectionEntryMode === "board" ? normalizeBoardCode(boardCode) : boardCode.trim()) || null : null,
      machineCodes: inspectionEntryMode === "board" ? selectedInspectionMachineCodes : [],
      shift: inspectionShift || null,
      note: buildInspectionNote(inspectionNote),
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

  const headerDetails = [
    { label: "Month Period", value: formatMonthPeriod(submission.inspectionDate) },
    { label: "Shift", value: submission.shift },
    { label: "Group", value: submission.groupCodes?.join(", ") || "-" },
    { label: "Process", value: processName },
    { label: "Checksheet", value: checksheetName },
    ...machineEntryDetails
  ];

  const resolveCreateSubmissionGroupCodes = (machine) => {
    const currentGroupCodes = submission.groupCodes ?? [];
    const machineGroupCodes = machine?.groupCodes ?? [];
    const matchingGroup = currentGroupCodes.find((groupCode) => machineGroupCodes.includes(groupCode));

    if (matchingGroup) {
      return [matchingGroup];
    }

    if (machineGroupCodes.length === 1) {
      return [machineGroupCodes[0]];
    }

    return currentGroupCodes.length ? [currentGroupCodes[0]] : [];
  };

  const handleStandNavigationChange = async (machineCode) => {
    const targetMachine = standNavigationOptions.find((machine) => machine.machineCode === machineCode);
    if (!targetMachine || targetMachine.machineCode === submission.machineCode) {
      return;
    }

    setStandNavigationPendingMachineCode(machineCode);
    try {
      const existingSubmissions = await findExistingMonthlySubmissions(targetMachine.machineCode, submission.inspectionDate);
      const latestSubmission = getLatestSubmission(existingSubmissions);

      if (latestSubmission?.id) {
        navigate(`/checksheets/submissions/${latestSubmission.id}`);
        return;
      }

      setStandNavigationTarget(targetMachine);
    } finally {
      setStandNavigationPendingMachineCode("");
    }
  };

  const handleCreateStandSubmission = async () => {
    if (!standNavigationTarget) {
      return;
    }

    const targetModes = standNavigationTarget.modes ?? [];
    const targetMode = targetModes.includes(checksheetMode)
      ? checksheetMode
      : normalizeChecksheetMode(targetModes[0] ?? checksheetMode, checksheetMode);
    const response = await createSubmissionMutation.mutateAsync({
      machineCode: standNavigationTarget.machineCode,
      checksheetMode: targetMode,
      inspectionDate: submission.inspectionDate,
      shift: submission.shift,
      groupCodes: resolveCreateSubmissionGroupCodes(standNavigationTarget)
    });

    setStandNavigationTarget(null);
    if (response?.data?.id) {
      navigate(`/checksheets/submissions/${response.data.id}`);
    }
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
                  {submission.location} | {submission.lineName} | {multiProductNo}
                </Typography>
                {templateDescription ? (
                  <Typography variant="body2" color="text.secondary" sx={{ mt: 0.75, maxWidth: 760, whiteSpace: "pre-line" }}>
                    {templateDescription}
                  </Typography>
                ) : null}
              </Box>
              <Stack direction="row" spacing={1} flexWrap="wrap">
                <Chip label={submission.checksheetMode.toUpperCase()} />
                <Chip
                  label={formatSubmissionStatus(submission.status)}
                  color={submission.status === "approved" ? "success" : submission.status === "submitted" ? "warning" : submission.status === "rejected" ? "error" : "default"}
                />
              </Stack>
            </Stack>

            <Box
              sx={{
                mt: 2.5,
                display: "grid",
                gridTemplateColumns: {
                  xs: "1fr",
                  sm: "repeat(2, minmax(0, 1fr))",
                  lg: "repeat(3, minmax(0, 1fr))"
                },
                columnGap: 3,
                rowGap: 1.75,
                py: 0.5
              }}
            >
              {headerDetails.map((detail) => {
                const canNavigateStand = detail.label === "Stand No." && useStandNoNavigation && standNavigationOptions.length > 0;

                return (
                  <Box key={detail.label} sx={{ minWidth: 0 }}>
                    <Typography variant="caption" color="text.secondary" sx={{ display: "block", mb: 0.5, fontWeight: 600 }}>
                      {canNavigateStand ? "Stand No." : detail.label}
                    </Typography>
                    {canNavigateStand ? (
                      <TextField
                        select
                        size="small"
                        value={submission.machineCode}
                        onChange={(event) => handleStandNavigationChange(event.target.value)}
                        disabled={!!standNavigationPendingMachineCode || createSubmissionMutation.isPending}
                        fullWidth
                      >
                        {standNavigationOptions.map((machine) => (
                          <MenuItem key={machine.machineCode} value={machine.machineCode}>
                            {machine.standNo}
                          </MenuItem>
                        ))}
                      </TextField>
                    ) : (
                      <Typography variant="body2" fontWeight={600} sx={{ overflowWrap: "anywhere" }}>
                        {detail.value || "-"}
                      </Typography>
                    )}
                  </Box>
                );
              })}
            </Box>

            <Stack direction={{ xs: "column", md: "row" }} spacing={2} sx={{ mt: 2 }} alignItems={{ md: "center" }}>
              <Stack spacing={0.5}>
                <RadioGroup
                  row
                  value={checksheetMode}
                  onChange={(event) => {
                    const nextMode = event.target.value;
                    setSelectedMode(nextMode);
                    setSelectedTemplateId("");
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
              {modeTemplateOptions.length > 1 && (
                <TextField
                  select
                  size="small"
                  label="Checksheet"
                  value={selectedTemplateId}
                  onChange={(event) => setSelectedTemplateId(event.target.value)}
                  sx={{ minWidth: { xs: "100%", md: 320 } }}
                >
                  {modeTemplateOptions.map((item) => (
                    <MenuItem key={`${item.checksheetMode}-${item.templateId}`} value={String(item.templateId)}>
                      {item.templateName || `Template ${item.templateId}`}
                    </MenuItem>
                  ))}
                </TextField>
              )}
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
                onClick={() => navigate(`/checksheets/submissions/${submission.id}/monthly?checksheetMode=${checksheetMode}${selectedTemplateId ? `&templateId=${selectedTemplateId}` : ""}`)}
              >
                Open Monthly Detail
              </Button>
              {isDraft && isOwner && (
                <Button
                  variant="outlined"
                  startIcon={<AddIcon />}
                  onClick={() => navigate(`/checksheets/submissions/${submission.id}/template-items`)}
                >
                  Add Template Rows
                </Button>
              )}
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
              <Stack
                direction={{ xs: "column", md: "row" }}
                spacing={2}
                sx={
                  inspectionEntryMode === "board"
                    ? { width: { xs: "100%", md: "auto" }, maxWidth: "100%", minWidth: 0 }
                    : { width: { xs: "100%", md: 320 }, minWidth: 0 }
                }
              >
                {inspectionEntryMode === "board" ? (
                  <Stack direction={{ xs: "column", md: "row" }} spacing={1.5} alignItems={{ md: "flex-start" }} sx={{ minWidth: 0 }}>
                    {availableInspectionMachineCodes.length > 0 && (
                      <Box sx={{ maxWidth: { xs: "100%", md: 360 }, overflow: "hidden" }}>
                        <Stack direction="row" spacing={0.5} flexWrap="nowrap" useFlexGap sx={{ whiteSpace: "nowrap" }}>
                          {availableInspectionMachineCodes.map((machineCode) => (
                            <FormControlLabel
                              key={machineCode}
                              control={
                                <Checkbox
                                  size="small"
                                  checked={selectedInspectionMachineCodes.includes(machineCode)}
                                  onChange={() => toggleInspectionMachineCode(machineCode)}
                                />
                              }
                              label={machineCode}
                              sx={{ mr: 0, flexShrink: 0, "& .MuiFormControlLabel-label": { fontSize: 13 } }}
                            />
                          ))}
                        </Stack>
                      </Box>
                    )}
                    <TextField
                      label="Board Code / Number"
                      value={boardCode}
                      onChange={(event) => setBoardCode(normalizeBoardCode(event.target.value))}
                      placeholder="A1"
                      size="small"
                      sx={{ width: { xs: "100%", md: 180 }, flexShrink: 0 }}
                    />
                  </Stack>
                ) : inspectionEntryMode === "free_text" ? (
                  <TextField
                    select
                    label="Inspection Entry"
                    value={boardCode}
                    onChange={(event) => setBoardCode(event.target.value)}
                    size="small"
                    fullWidth
                    sx={{ flex: 1, minWidth: 0 }}
                  >
                    {freeTextEntryOptions.map((option) => (
                      <MenuItem key={option.label} value={option.label}>{option.label}</MenuItem>
                    ))}
                  </TextField>
                ) : inspectionEntryMode === "weekly" ? (
                  <TextField
                    select
                    label="Inspection Week"
                    value={inspectionDate}
                    onChange={(event) => setInspectionDate(event.target.value)}
                    size="small"
                    fullWidth
                    sx={{ flex: 1, minWidth: 0 }}
                  >
                    {weeklyEntryOptions.map((option) => (
                      <MenuItem key={option.value} value={option.value}>{option.label}</MenuItem>
                    ))}
                  </TextField>
                ) : (
                  <DatePicker
                    label="Inspection Date"
                    value={dateValueToDate(inspectionDate)}
                    onChange={(value) => setInspectionDate(dateToDateValue(value))}
                    format="yyyy-MM-dd"
                    sx={{ flex: 1, minWidth: 0 }}
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
                  sx={{ width: { xs: "100%", md: 96 }, flexShrink: 0 }}
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
              <TableContainer component={Paper} variant="outlined" sx={{ width: "100%", overflowX: "auto" }}>
                <Table
                  size="small"
                  sx={{
                    minWidth: inspectionTableMinWidth,
                    tableLayout: "auto",
                    "& .MuiTableCell-root": {
                      borderRight: 1,
                      borderColor: "divider",
                      verticalAlign: "middle",
                      whiteSpace: "normal",
                      overflowWrap: "anywhere",
                      wordBreak: "break-word"
                    },
                    "& .MuiTableCell-root:last-of-type": {
                      borderRight: 0
                    },
                    "& .MuiTableHead-root .MuiTableCell-root": {
                      fontWeight: 700,
                      textAlign: "center"
                    },
                    "& .MuiTableCell-root[data-merged='true']": {
                      verticalAlign: "middle"
                    }
                  }}
                >
                  <TableHead>
                    <TableRow>
                      {templateHeaderGroups.map(({ column, columnIndex, colSpan, width }) => (
                        <TableCell
                          key={column.id ?? column.columnKey}
                          colSpan={colSpan}
                          sx={getTemplateColumnCellSx(column, columnIndex, width)}
                        >
                          {column.label}
                        </TableCell>
                      ))}
                      <TableCell sx={{ width: ENTRY_COLUMN_WIDTH, minWidth: ENTRY_COLUMN_WIDTH, pl: 2 }}>Entry</TableCell>
                      <TableCell sx={{ width: REMARK_COLUMN_WIDTH, minWidth: REMARK_COLUMN_WIDTH, pl: 2 }}>Remark</TableCell>
                    </TableRow>
                  </TableHead>
                  <TableBody>
                    {templateItems.map((item, rowIndex) => {
                      const effectiveValueType = getEffectiveValueType(item);
                      return (
                      <TableRow key={item.id} hover>
                        {templateColumns.map((column, columnIndex) => {
                          const mergeCell = rowSpanMap[column.columnKey]?.[rowIndex];
                          const cellValue = item.data?.[column.columnKey];
                          const isImageCell = isTemplateImageCell(column, item, cellValue);

                          if (mergeCell?.hidden) {
                            return null;
                          }

                          return (
                            <TableCell
                              key={`${item.id}-${column.columnKey}`}
                              rowSpan={mergeCell?.rowSpan ?? 1}
                              data-merged={(mergeCell?.rowSpan ?? 1) > 1 ? "true" : undefined}
                              sx={{
                                ...getTemplateColumnCellSx(column, columnIndex, templateColumnWidths[columnIndex]),
                                ...(isImageCell
                                  ? {
                                    width: "max-content",
                                    minWidth: "max-content",
                                    maxWidth: "none",
                                    whiteSpace: "nowrap",
                                    overflowWrap: "normal",
                                    wordBreak: "normal"
                                  }
                                  : {}),
                                verticalAlign: "middle",
                              }}
                            >
                              <TemplateItemCellContent column={column} item={item} value={cellValue} />
                            </TableCell>
                          );
                        })}
                        <TableCell sx={{ width: ENTRY_COLUMN_WIDTH, minWidth: ENTRY_COLUMN_WIDTH, pl: 2 }}>
                          {effectiveValueType === "fixed" ? (
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
                          ) : effectiveValueType === "number" ? (
                            <TextField
                              value={getEntryValue(item.id, "resultValue")}
                              onChange={(event) => handleInspectionValueChange(item.id, { resultValue: sanitizeNumberInput(event.target.value) })}
                              placeholder="Enter number"
                              size="small"
                              fullWidth
                              disabled={!isDraft || isInspectionMutationPending}
                              inputProps={{ inputMode: "decimal", pattern: "[0-9]*[.]?[0-9]*" }}
                            />
                          ) : effectiveValueType === JIG_NO_CHECK_VALUE_TYPE ? (
                            (() => {
                              const jigNoCheckLines = formatJigNoCheckValue(getEntryValue(item.id, "resultValue"));
                              return (
                                <Button
                                  variant={jigNoCheckLines.length ? "contained" : "outlined"}
                                  size="small"
                                  fullWidth
                                  disabled={!isDraft || isInspectionMutationPending}
                                  onClick={() => handleOpenJigNoCheckDialog(item.id)}
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
                                        <Typography key={`${item.id}-jig-no-check-${lineIndex}`} variant="caption" component="span">
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
                              value={getEntryValue(item.id, "resultValue")}
                              onChange={(e) => handleInspectionValueChange(item.id, { resultValue: e.target.value })}
                              placeholder="Enter value"
                              size="small"
                              fullWidth
                              disabled={!isDraft || isInspectionMutationPending}
                            />
                          )}
                        </TableCell>
                        <TableCell sx={{ width: REMARK_COLUMN_WIDTH, minWidth: REMARK_COLUMN_WIDTH, pl: 2 }}>
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
                      );
                    })}
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
                disabled={!isDraft || !hasRequiredInspectionEntry || !hasAnyInspectionValue || isInspectionMutationPending}
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
                      <strong>Board Code:</strong> {getRecordBoardCode(selectedInspectionRecord) || "-"} | <strong>Shift:</strong> {currentDaySummary?.shift || selectedInspectionRecord.shift || "-"} | <strong>Machine Record:</strong> {selectedInspectionRecord.machineCodes?.join(", ") || "-"}
                    </>
                  ) : inspectionEntryMode === "weekly" ? (
                    <>
                      <strong>Week:</strong> Week {getWeekOfMonth(selectedInspectionRecord.inspectionDate)} | <strong>Shift:</strong> {currentDaySummary?.shift || selectedInspectionRecord.shift || "-"}
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
                onClick={() => navigate(`/checksheets/submissions/${submission.id}/monthly?checksheetMode=${checksheetMode}${selectedTemplateId ? `&templateId=${selectedTemplateId}` : ""}`)}
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
                        {records.length === 0 && <Typography variant="body2" color="text.secondary">No repair records yet for this section.</Typography>}
                      </Stack>
                    </Stack>
                  </Paper>
                );
              })}
            </Stack>
          </Paper>
        </Stack>

        <Dialog
          open={!!standNavigationTarget}
          onClose={createSubmissionMutation.isPending ? undefined : () => setStandNavigationTarget(null)}
          fullWidth
          maxWidth="sm"
        >
          <DialogTitle>Create Checksheet Transaction</DialogTitle>
          <DialogContent dividers>
            <Stack spacing={2}>
              <Alert severity="info">
                No transaction exists for stand {standNavigationTarget?.standNo || "-"} in {formatMonthPeriod(submission.inspectionDate)}.
              </Alert>
              <Stack spacing={0.5}>
                <Typography variant="body2">
                  <strong>Stand No.:</strong> {standNavigationTarget?.standNo || "-"}
                </Typography>
                <Typography variant="body2">
                  <strong>Machine Code:</strong> {standNavigationTarget?.machineCode || "-"}
                </Typography>
                <Typography variant="body2">
                  <strong>Line:</strong> {standNavigationTarget?.lineName || submission.lineName || "-"}
                </Typography>
              </Stack>
            </Stack>
          </DialogContent>
          <DialogActions>
            <Button onClick={() => setStandNavigationTarget(null)} disabled={createSubmissionMutation.isPending}>
              Cancel
            </Button>
            <Button
              variant="contained"
              disabled={createSubmissionMutation.isPending || !resolveCreateSubmissionGroupCodes(standNavigationTarget).length}
              onClick={handleCreateStandSubmission}
            >
              {createSubmissionMutation.isPending ? "Creating..." : "Create And Open"}
            </Button>
          </DialogActions>
        </Dialog>

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
