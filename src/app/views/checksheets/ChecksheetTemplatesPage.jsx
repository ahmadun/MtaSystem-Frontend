import { useEffect, useMemo, useState } from "react";
import { useLocation, useNavigate, useParams } from "react-router-dom";
import {
  Alert,
  Box,
  Button,
  Chip,
  Dialog,
  DialogActions,
  DialogContent,
  DialogTitle,
  Divider,
  IconButton,
  MenuItem,
  Paper,
  Stack,
  Table,
  TableBody,
  TableCell,
  TableContainer,
  TableHead,
  TablePagination,
  TableRow,
  TextField,
  Tooltip,
  Typography
} from "@mui/material";
import { flexRender, getCoreRowModel, useReactTable } from "@tanstack/react-table";
import AddIcon from "@mui/icons-material/Add";
import AddCircleOutlineIcon from "@mui/icons-material/AddCircleOutline";
import CloudUploadIcon from "@mui/icons-material/CloudUpload";
import ContentCopyOutlinedIcon from "@mui/icons-material/ContentCopyOutlined";
import DeleteOutlineIcon from "@mui/icons-material/DeleteOutline";
import EditOutlinedIcon from "@mui/icons-material/EditOutlined";
import KeyboardArrowDownIcon from "@mui/icons-material/KeyboardArrowDown";
import KeyboardArrowUpIcon from "@mui/icons-material/KeyboardArrowUp";
import RefreshIcon from "@mui/icons-material/Refresh";
import { authRoles } from "app/auth/authRoles";
import useAuth from "app/hooks/useAuth";
import { ConfirmationDialog } from "app/components";
import {
  useChecksheetTemplate,
  useChecksheetTemplates,
  useCreateChecksheetTemplate,
  useDeleteChecksheetTemplate,
  useUploadChecksheetTemplateImage,
  useUpdateChecksheetTemplate
} from "app/hooks/useChecksheets";

const COLUMN_TYPES = [
  { value: "text", label: "Text" },
  { value: "textarea", label: "Textarea" },
  { value: "image", label: "Image" }
];

const ITEM_CELL_TYPES_KEY = "__cellTypes";

const ITEM_VALUE_TYPES = [
  { value: "fixed", label: "Fixed (OK/NG/FIX)" },
  { value: "free_text", label: "Free Text" },
  { value: "number", label: "Number" },
  { value: "jig_no_check", label: "Jig No Check" }
];

const CHECKSHEET_MODES = [
  { value: "daily", label: "Daily" },
  { value: "regular", label: "Regular" }
];

const INSPECTION_ENTRY_MODES = [
  { value: "date", label: "Date" },
  { value: "board", label: "Board Code" },
  { value: "weekly", label: "Weekly" },
  { value: "free_text", label: "Free Text Options" }
];

const MIN_COLUMN_WIDTH = 60;
const MAX_COLUMN_WIDTH = 480;

function clampColumnWidth(value) {
  const numericValue = Number(value);
  if (!Number.isFinite(numericValue)) {
    return null;
  }

  return Math.min(MAX_COLUMN_WIDTH, Math.max(MIN_COLUMN_WIDTH, Math.round(numericValue)));
}

function getDefaultColumnWidth(column) {
  const columnKey = String(column?.columnKey ?? "").trim().toLowerCase();
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

function resolveColumnWidth(column) {
  return clampColumnWidth(column?.widthPx) ?? getDefaultColumnWidth(column);
}

function formatInspectionEntryMode(value) {
  if (value === "board") return "Board Code";
  if (value === "weekly") return "Weekly";
  if (value === "free_text") return "Free Text Options";
  return "Date";
}

function blankColumn(sortOrder) {
  return {
    columnKey: `column_${sortOrder + 1}`,
    label: "",
    columnType: "text",
    isRequired: false,
    enableRowSpan: false,
    enableColSpan: false,
    widthPx: 140,
    sortOrder,
    optionsJson: ""
  };
}

function normalizeColumnKey(label, fallbackIndex) {
  const normalized = String(label ?? "")
    .toLowerCase()
    .trim()
    .replace(/[^a-z0-9]+/g, "_")
    .replace(/^_+|_+$/g, "");

  return normalized || `column_${fallbackIndex + 1}`;
}

function getUniqueColumnKey(baseKey, columns, currentIndex) {
  const normalizedBaseKey = String(baseKey || `column_${currentIndex + 1}`).trim();
  const existingKeys = new Set(
    columns
      .map((column, index) => (index === currentIndex ? "" : String(column.columnKey ?? "").trim().toLowerCase()))
      .filter(Boolean)
  );

  if (!existingKeys.has(normalizedBaseKey.toLowerCase())) {
    return normalizedBaseKey;
  }

  let suffix = 2;
  let nextKey = `${normalizedBaseKey}_${suffix}`;
  while (existingKeys.has(nextKey.toLowerCase())) {
    suffix += 1;
    nextKey = `${normalizedBaseKey}_${suffix}`;
  }

  return nextKey;
}

function getUniqueColumnKeyForLabel(label, columns, currentIndex) {
  return getUniqueColumnKey(normalizeColumnKey(label, currentIndex), columns, currentIndex);
}

function ensureUniqueColumnKeys(columns) {
  const usedKeys = new Set();

  return columns.map((column, index) => {
    const baseKey = String(column.columnKey ?? "").trim() || normalizeColumnKey(column.label, index);
    let nextKey = baseKey;
    let suffix = 2;

    while (usedKeys.has(nextKey.toLowerCase())) {
      nextKey = `${baseKey}_${suffix}`;
      suffix += 1;
    }

    usedKeys.add(nextKey.toLowerCase());
    return { ...column, columnKey: nextKey };
  });
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

function serializeColumnOptions(column) {
  const baseOptions = parseColumnOptions(column.optionsJson);
  const widthPx = resolveColumnWidth(column);

  return JSON.stringify({
    ...baseOptions,
    enableRowSpan: column.enableRowSpan ?? false,
    enableColSpan: column.enableColSpan ?? false,
    widthPx
  });
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
            valueType: ITEM_VALUE_TYPES.some((item) => item.value === option?.valueType) ? option.valueType : "free_text"
          };
        })
        .filter((option) => option.label)
      : [];
  } catch {
    return [];
  }
}

function serializeInspectionEntryOptions(options) {
  const normalized = [];
  (options ?? []).forEach((option) => {
    const label = String(option?.label ?? "").trim();
    if (!label || normalized.some((item) => item.label.toLowerCase() === label.toLowerCase())) {
      return;
    }

    normalized.push({
      label,
      valueType: ITEM_VALUE_TYPES.some((item) => item.value === option?.valueType) ? option.valueType : "free_text"
    });
  });
  return normalized.length ? JSON.stringify(normalized) : null;
}

function normalizeColumnType(columnType) {
  return COLUMN_TYPES.some((option) => option.value === columnType) ? columnType : "text";
}

function parseItemCellTypes(value) {
  if (!value) {
    return {};
  }

  if (typeof value === "object" && !Array.isArray(value)) {
    return Object.entries(value).reduce((next, [columnKey, cellType]) => {
      if (COLUMN_TYPES.some((option) => option.value === cellType)) {
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

function serializeItemCellTypes(cellTypes, columns) {
  const validColumnKeys = new Set(columns.map((column) => column.columnKey));
  const normalized = Object.entries(parseItemCellTypes(cellTypes)).reduce((next, [columnKey, cellType]) => {
    if (validColumnKeys.has(columnKey) && COLUMN_TYPES.some((option) => option.value === cellType)) {
      next[columnKey] = cellType;
    }
    return next;
  }, {});

  return Object.keys(normalized).length ? JSON.stringify(normalized) : null;
}

function serializeAllItemCellTypes(cellTypes) {
  const normalized = parseItemCellTypes(cellTypes);
  return Object.keys(normalized).length ? JSON.stringify(normalized) : "";
}

function getItemCellTypes(item) {
  return parseItemCellTypes(item?.[ITEM_CELL_TYPES_KEY]);
}

function getEffectiveCellType(column, item) {
  return getItemCellTypes(item)[column.columnKey] ?? normalizeColumnType(column.columnType);
}

function getImageUrl(value) {
  if (!value) return "";
  const rawValue = String(value).trim().replace(/^["']|["']$/g, "");
  if (!rawValue) return "";

  if (/^https?:\/\//i.test(rawValue)) {
    try {
      const parsedUrl = new URL(rawValue);
      return `${parsedUrl.pathname}${parsedUrl.search}`;
    } catch {
      return rawValue;
    }
  }

  const normalizedPath = rawValue
    .replace(/\\/g, "/")
    .replace(/^\/api\/uploads\//, "/uploads/")
    .replace(/^api\/uploads\//, "uploads/");

  return normalizedPath.startsWith("uploads/") ? `/${normalizedPath}` : normalizedPath;
}

function isImageCellValue(value) {
  const url = getImageUrl(value);
  return /\.(png|jpe?g|gif|webp)(\?.*)?$/i.test(url) || url.includes("/uploads/checksheet-template-items/");
}

function syncItemKeys(items, previousKey, nextKey) {
  if (!previousKey || previousKey === nextKey) {
    return items;
  }

  return items.map((item) => {
    const nextItem = { ...item };
    const cellTypes = getItemCellTypes(nextItem);

    if (cellTypes[previousKey]) {
      cellTypes[nextKey] = cellTypes[previousKey];
      delete cellTypes[previousKey];
      nextItem[ITEM_CELL_TYPES_KEY] = serializeAllItemCellTypes(cellTypes);
    }

    nextItem[nextKey] = item[previousKey] ?? "";
    delete nextItem[previousKey];
    return nextItem;
  });
}

function isItemNumberColumn(column) {
  const columnKey = String(column?.columnKey ?? "").trim().toLowerCase();
  const label = String(column?.label ?? "").trim().toLowerCase();
  return columnKey === "itemno" || columnKey === "no" || label === "no.";
}

function createItemFromColumns(columns, sortOrder) {
  const next = { sortOrder, valueType: "fixed" };
  columns.forEach((column, index) => {
    next[column.columnKey] = isItemNumberColumn(column) ? String(sortOrder + 1) : index === 1 ? "" : "";
  });
  return next;
}

function reindexItems(items) {
  return items.map((item, index) => ({ ...item, sortOrder: index }));
}

function refreshItemNumbers(items, columns) {
  return items.map((item, index) => {
    const nextItem = { ...item, sortOrder: index };
    columns.forEach((column) => {
      if (isItemNumberColumn(column)) {
        nextItem[column.columnKey] = String(index + 1);
      }
    });
    return nextItem;
  });
}

function duplicateItem(item, sortOrder) {
  return {
    ...item,
    sortOrder
  };
}

function getColumnImageOptions(items, columnKey) {
  return [
    ...new Set(
      items
        .map((item) => String(item[columnKey] ?? "").trim())
        .filter(isImageCellValue)
        .map(getImageUrl)
    )
  ];
}

function TemplateItemField({
  column,
  columnIndex,
  item,
  itemIndex,
  items,
  setForm,
  compact = false,
  isSelected = false,
  onSelect,
  onNavigate
}) {
  const uploadMutation = useUploadChecksheetTemplateImage();
  const value = item[column.columnKey] ?? "";
  const effectiveCellType = getEffectiveCellType(column, item);
  const fieldWidth = Math.max(resolveColumnWidth(column), compact ? 160 : 180);
  const cellInputId = `${itemIndex}-${columnIndex}`;
  const textFieldSx = compact ? {
    minWidth: fieldWidth,
    "& .MuiInputBase-root": {
      bgcolor: "background.paper"
    },
    "& .MuiInputBase-input": {
      fontSize: 13,
      lineHeight: 1.35
    }
  } : undefined;

  const updateValue = (nextValue) => {
    setForm((current) => ({
      ...current,
      items: current.items.map((currentItem, currentIndex) =>
        currentIndex === itemIndex ? { ...currentItem, [column.columnKey]: nextValue } : currentItem
      )
    }));
  };

  const updateCellType = (nextCellType) => {
    setForm((current) => ({
      ...current,
      items: current.items.map((currentItem, currentIndex) => {
        if (currentIndex !== itemIndex) {
          return currentItem;
        }

        const cellTypes = getItemCellTypes(currentItem);
        if (nextCellType === normalizeColumnType(column.columnType)) {
          delete cellTypes[column.columnKey];
        } else {
          cellTypes[column.columnKey] = nextCellType;
        }

        return {
          ...currentItem,
          [ITEM_CELL_TYPES_KEY]: serializeAllItemCellTypes(cellTypes)
        };
      })
    }));
  };

  const handleTextKeyDown = (event) => {
    if (!compact) return;

    if (event.key === "Tab") {
      event.preventDefault();
      onNavigate?.(event.shiftKey ? "previous" : "next");
      return;
    }

    if (event.key === "Enter" && effectiveCellType !== "textarea") {
      event.preventDefault();
      onNavigate?.("down");
    }
  };

  if (effectiveCellType !== "image") {
    return (
      <Box
        className="template-item-cell"
        onClick={onSelect}
        data-template-cell-input={cellInputId}
        sx={compact ? {
          position: "relative",
          minWidth: fieldWidth,
          pb: 0.25,
          "& .template-cell-action": {
            opacity: isSelected ? 1 : 0,
            pointerEvents: isSelected ? "auto" : "none",
            transition: "opacity 120ms ease"
          },
          "&:focus-within .template-cell-action": {
            opacity: 1,
            pointerEvents: "auto"
          },
          "& .MuiInputBase-root": {
            boxShadow: isSelected ? "0 0 0 2px rgba(25, 118, 210, 0.18)" : "none"
          }
        } : undefined}
      >
        <TextField
          label={compact ? undefined : column.label}
          placeholder={compact ? column.label : undefined}
          size={compact ? "small" : undefined}
          multiline={effectiveCellType === "textarea"}
          minRows={effectiveCellType === "textarea" ? (compact ? 2 : 2) : undefined}
          maxRows={compact && effectiveCellType === "textarea" ? 5 : undefined}
          value={value}
          onChange={(event) => updateValue(event.target.value)}
          onFocus={onSelect}
          onKeyDown={handleTextKeyDown}
          fullWidth
          sx={textFieldSx}
        />
        {compact ? (
          <Tooltip title="Attach image to this cell">
            <IconButton
              className="template-cell-action"
              size="small"
              onClick={() => updateCellType("image")}
              sx={{
                position: "absolute",
                top: 3,
                right: 3,
                width: 26,
                height: 26,
                bgcolor: "background.paper",
                border: 1,
                borderColor: "divider",
                boxShadow: 1,
                "&:hover": { bgcolor: "background.default" }
              }}
            >
              <CloudUploadIcon fontSize="small" />
            </IconButton>
          </Tooltip>
        ) : (
          <Box>
            <Button size="small" variant="outlined" startIcon={<CloudUploadIcon />} onClick={() => updateCellType("image")}>
              Attach Image
            </Button>
          </Box>
        )}
      </Box>
    );
  }

  const existingImages = getColumnImageOptions(items, column.columnKey);

  const handleImageChange = async (event) => {
    const file = event.target.files?.[0];
    event.target.value = "";
    if (!file) return;

    const result = await uploadMutation.mutateAsync(file);
    updateValue(result?.data?.url ?? "");
  };

  return (
    <Box
      className="template-item-cell template-image-cell"
      onClick={onSelect}
      onFocus={onSelect}
      tabIndex={compact ? 0 : undefined}
      sx={compact ? {
        position: "relative",
        minWidth: fieldWidth,
        outline: 0,
        boxShadow: isSelected ? "0 0 0 2px rgba(25, 118, 210, 0.18)" : "none",
        borderRadius: 1,
        "& .template-image-actions": {
          opacity: isSelected ? 1 : 0,
          pointerEvents: isSelected ? "auto" : "none",
          transition: "opacity 120ms ease"
        },
        "& .template-image-mode-action": {
          opacity: isSelected ? 1 : 0,
          pointerEvents: isSelected ? "auto" : "none",
          transition: "opacity 120ms ease"
        }
      } : undefined}
    >
      <Stack
        className={compact ? "template-image-mode-action" : undefined}
        direction="row"
        spacing={0.5}
        alignItems="center"
        justifyContent="space-between"
        sx={{
          mb: compact ? 0 : 1,
          position: compact ? "absolute" : "static",
          top: 3,
          right: 3,
          zIndex: 1
        }}
      >
        {!compact && (
          <Typography variant="caption" color="text.secondary" sx={{ flex: 1 }}>
            {column.label}
          </Typography>
        )}
        {compact ? (
          <Tooltip title="Use text input">
            <IconButton size="small" onClick={() => updateCellType(normalizeColumnType(column.columnType))} sx={{ width: 28, height: 28 }}>
              <EditOutlinedIcon fontSize="small" />
            </IconButton>
          </Tooltip>
        ) : (
          <Button size="small" onClick={() => updateCellType(normalizeColumnType(column.columnType))}>
            Use Text
          </Button>
        )}
      </Stack>
      {value ? (
        <Box
          component="img"
          src={value}
          alt={column.label}
          sx={{
            width: compact ? "100%" : "100%",
            maxWidth: "100%",
            height: compact ? 86 : "auto",
            maxHeight: compact ? 86 : 180,
            objectFit: "contain",
            border: 1,
            borderColor: "divider",
            borderRadius: 1,
            bgcolor: "background.default"
          }}
        />
      ) : (
        compact && (
          <Box
            sx={{
              height: 86,
              border: 1,
              borderStyle: "dashed",
              borderColor: "divider",
              borderRadius: 1,
              bgcolor: "background.default"
            }}
          />
        )
      )}
      <Stack
        className={compact ? "template-image-actions" : undefined}
        direction="row"
        spacing={0.75}
        alignItems="center"
        sx={compact ? {
          position: value ? "absolute" : "static",
          right: 6,
          bottom: 6,
          left: value ? 6 : "auto",
          p: value ? 0.5 : 0,
          mt: value ? 0 : 0.75,
          borderRadius: 1,
          bgcolor: value ? "rgba(255,255,255,0.94)" : "transparent",
          boxShadow: value ? 1 : 0
        } : undefined}
      >
        {compact ? (
          <Tooltip title={uploadMutation.isPending ? "Uploading..." : value ? "Replace image" : "Upload image"}>
            <span>
              <IconButton component="label" size="small" disabled={uploadMutation.isPending} sx={{ width: 30, height: 30 }}>
                <CloudUploadIcon fontSize="small" />
                <input type="file" accept="image/*" hidden onChange={handleImageChange} />
              </IconButton>
            </span>
          </Tooltip>
        ) : (
          <Button component="label" variant="outlined" size="small" startIcon={<CloudUploadIcon />} disabled={uploadMutation.isPending}>
            {uploadMutation.isPending ? "Uploading..." : value ? "Replace Image" : "Upload Image"}
            <input type="file" accept="image/*" hidden onChange={handleImageChange} />
          </Button>
        )}
        <TextField
          select
          size="small"
          label={compact ? undefined : "Use Existing"}
          placeholder={compact ? "Existing" : undefined}
          value=""
          onChange={(event) => updateValue(event.target.value)}
          disabled={uploadMutation.isPending || existingImages.length === 0}
          sx={{ minWidth: compact ? 96 : 180, flex: compact ? 1 : "initial" }}
        >
          <MenuItem value="" disabled>
            {compact ? "Existing" : "Select image"}
          </MenuItem>
          {existingImages.map((imageUrl, imageIndex) => (
            <MenuItem key={imageUrl} value={imageUrl}>
              <Stack direction="row" spacing={1} alignItems="center" sx={{ minWidth: 0 }}>
                <Box
                  component="img"
                  src={imageUrl}
                  alt={`Existing ${imageIndex + 1}`}
                  sx={{
                    width: 48,
                    height: 36,
                    objectFit: "contain",
                    border: 1,
                    borderColor: "divider",
                    borderRadius: 1,
                    bgcolor: "background.default",
                    flexShrink: 0
                  }}
                />
                <Typography variant="body2" noWrap>
                  Image {imageIndex + 1}
                </Typography>
              </Stack>
            </MenuItem>
          ))}
        </TextField>
        {value && (
          compact ? (
            <Tooltip title="Remove image">
              <span>
                <IconButton size="small" color="error" onClick={() => updateValue("")} disabled={uploadMutation.isPending} sx={{ width: 30, height: 30 }}>
                  <DeleteOutlineIcon fontSize="small" />
                </IconButton>
              </span>
            </Tooltip>
          ) : (
            <Button size="small" color="error" onClick={() => updateValue("")} disabled={uploadMutation.isPending}>
              Remove
            </Button>
          )
        )}
      </Stack>
    </Box>
  );
}

function blankDailyApprovalStep(stepOrder) {
  return {
    stepName: "",
    stepOrder,
    approverUserIds: []
  };
}

function blankRegularApprovalStep(stepOrder) {
  return {
    stepName: "",
    stepOrder,
    approverUserIds: []
  };
}

function getApproverUserIds(step) {
  if (Array.isArray(step.approverUserIds)) {
    return step.approverUserIds.map(Number).filter((userId) => userId > 0);
  }

  if (Array.isArray(step.approvers)) {
    return step.approvers.map((approver) => Number(approver?.userId)).filter((userId) => userId > 0);
  }

  const singleApproverUserId = Number(step.approver?.userId ?? step.approverUserId);
  return singleApproverUserId > 0 ? [singleApproverUserId] : [];
}

function buildInitialForm(template) {
  if (!template) {
    const columns = [
      { columnKey: "no", label: "No.", columnType: "text", isRequired: true, enableRowSpan: false, enableColSpan: false, widthPx: 72, sortOrder: 0, optionsJson: "" },
      { columnKey: "itemName", label: "Inspection Item", columnType: "textarea", isRequired: true, enableRowSpan: false, enableColSpan: false, widthPx: 260, sortOrder: 1, optionsJson: "" },
      { columnKey: "method", label: "Method", columnType: "textarea", isRequired: false, enableRowSpan: false, enableColSpan: false, widthPx: 220, sortOrder: 2, optionsJson: "" }
    ];

    return {
      name: "",
      checksheetMode: "daily",
      inspectionEntryMode: "date",
      inspectionEntryOptions: [{ label: "", valueType: "free_text" }],
      description: "",
      isActive: true,
      columns,
      items: [createItemFromColumns(columns, 0)],
      dailyApprovalSteps: [],
      regularApprovalSteps: []
    };
  }

  return {
    name: template.name ?? "",
    checksheetMode: template.checksheetMode ?? "daily",
    inspectionEntryMode: template.inspectionEntryMode ?? "date",
    inspectionEntryOptions: parseInspectionEntryOptions(template.inspectionEntryOptionsJson).length
      ? parseInspectionEntryOptions(template.inspectionEntryOptionsJson)
      : [{ label: "", valueType: "free_text" }],
    description: template.description ?? "",
    isActive: template.isActive ?? true,
    columns: ensureUniqueColumnKeys((template.columns ?? []).map((column, index) => {
      const columnOptions = parseColumnOptions(column.optionsJson);
      const normalizedColumn = {
        columnKey: column.columnKey,
        label: column.label,
        columnType: normalizeColumnType(column.columnType),
        isRequired: column.isRequired,
        enableRowSpan: column.enableRowSpan ?? columnOptions.enableRowSpan ?? false,
        enableColSpan: columnOptions.enableColSpan ?? false,
        widthPx: clampColumnWidth(columnOptions.widthPx),
        sortOrder: index,
        optionsJson: column.optionsJson ?? ""
      };

      return {
        ...normalizedColumn,
        widthPx: normalizedColumn.widthPx ?? getDefaultColumnWidth(normalizedColumn)
      };
    })),
    items: (template.items ?? []).map((item, index) => ({
      sortOrder: index,
      valueType: item.valueType ?? "fixed",
      ...item.data
    })),
    dailyApprovalSteps: (template.dailyApprovalSteps ?? []).map((step, index) => ({
      stepName: step.stepName ?? "",
      stepOrder: index + 1,
      approverUserIds: getApproverUserIds(step)
    })),
    regularApprovalSteps: (template.regularApprovalSteps ?? []).map((step, index) => ({
      stepName: step.stepName ?? "",
      stepOrder: index + 1,
      approverUserIds: getApproverUserIds(step)
    }))
  };
}

function TemplateEditor({ open = true, mode, templateId, onClose, onSaved, embedded = false }) {
  const isEdit = mode === "edit";
  const isEnabled = embedded || open;
  const detailQuery = useChecksheetTemplate(templateId, { enabled: isEnabled && isEdit && !!templateId });
  const createMutation = useCreateChecksheetTemplate();
  const updateMutation = useUpdateChecksheetTemplate(templateId);
  const [form, setForm] = useState(buildInitialForm(null));
  const [selectedItemIndex, setSelectedItemIndex] = useState(0);
  const [selectedColumnKey, setSelectedColumnKey] = useState(null);

  useEffect(() => {
    if (!isEnabled) return;
    setForm(buildInitialForm(detailQuery.data ?? null));
    setSelectedItemIndex(0);
    setSelectedColumnKey(null);
  }, [isEnabled, detailQuery.data]);

  const mutation = isEdit ? updateMutation : createMutation;
  const activeApprovalSteps = form.checksheetMode === "regular" ? form.regularApprovalSteps : form.dailyApprovalSteps;

  const handleClose = () => {
    if (mutation.isPending) return;
    onClose();
  };

  const handleSubmit = async () => {
    const formColumns = ensureUniqueColumnKeys(form.columns);
    const payloadColumns = formColumns.map((column, index) => ({
      ...column,
      columnKey: column.columnKey,
      label: column.label.trim(),
      sortOrder: index,
      enableRowSpan: column.enableRowSpan ?? false,
      enableColSpan: column.enableColSpan ?? false,
      optionsJson: serializeColumnOptions(column)
    }));

    const payload = {
      name: form.name.trim(),
      checksheetMode: form.checksheetMode,
      inspectionEntryMode: form.inspectionEntryMode,
      inspectionEntryOptionsJson: form.inspectionEntryMode === "free_text" ? serializeInspectionEntryOptions(form.inspectionEntryOptions) : null,
      description: form.description.trim() || null,
      isActive: form.isActive,
      columns: payloadColumns,
      items: form.items.map((item, index) => {
        const data = {};
        payloadColumns.forEach((column, columnIndex) => {
          const sourceKey = form.columns[columnIndex]?.columnKey;
          data[column.columnKey] = item[sourceKey] ?? item[column.columnKey] ?? "";
        });
        const cellTypesJson = serializeItemCellTypes(item[ITEM_CELL_TYPES_KEY], payloadColumns);
        if (cellTypesJson) {
          data[ITEM_CELL_TYPES_KEY] = cellTypesJson;
        }
        return { sortOrder: index, valueType: item.valueType ?? "fixed", data };
      }),
      dailyApprovalSteps: form.dailyApprovalSteps
        .map((step, index) => ({
          stepName: step.stepName.trim(),
          stepOrder: index + 1,
          approverUserIds: [...new Set((step.approverUserIds ?? []).map(Number).filter((userId) => userId > 0))]
        }))
        .filter((step) => step.stepName),
      regularApprovalSteps: form.regularApprovalSteps
        .map((step, index) => ({
          stepName: step.stepName.trim(),
          stepOrder: index + 1,
          approverUserIds: [...new Set((step.approverUserIds ?? []).map(Number).filter((userId) => userId > 0))]
        }))
        .filter((step) => step.stepName)
    };

    if (isEdit) {
      await updateMutation.mutateAsync(payload);
    } else {
      await createMutation.mutateAsync(payload);
    }

    await onSaved?.({ mode, templateId });
    onClose();
  };

  const canSubmit =
    form.name.trim() &&
    form.checksheetMode &&
    form.columns.length > 0 &&
    form.columns.every((column) => column.columnKey.trim() && column.label.trim()) &&
    (form.inspectionEntryMode !== "free_text" || form.inspectionEntryOptions.some((option) => option.label.trim())) &&
    form.items.length > 0;

  useEffect(() => {
    setSelectedItemIndex((currentIndex) => {
      if (form.items.length === 0) return 0;
      return Math.min(Math.max(currentIndex, 0), form.items.length - 1);
    });

    setSelectedColumnKey((currentColumnKey) => {
      if (!currentColumnKey) return null;
      return form.columns.some((column) => column.columnKey === currentColumnKey) ? currentColumnKey : null;
    });
  }, [form.items.length, form.columns]);

  const selectRow = (index) => {
    setSelectedItemIndex(index);
    setSelectedColumnKey(null);
  };

  const selectCell = (itemIndex, columnKey) => {
    setSelectedItemIndex(itemIndex);
    setSelectedColumnKey(columnKey);
  };

  const focusTemplateCell = (itemIndex, columnIndex) => {
    window.setTimeout(() => {
      const input = document.querySelector(`[data-template-cell-input="${itemIndex}-${columnIndex}"] textarea, [data-template-cell-input="${itemIndex}-${columnIndex}"] input`);
      input?.focus();
      input?.select?.();
    }, 0);
  };

  const navigateItemCell = (itemIndex, columnIndex, direction) => {
    if (!form.columns.length || !form.items.length) return;

    let nextItemIndex = itemIndex;
    let nextColumnIndex = columnIndex;

    if (direction === "next") {
      nextColumnIndex += 1;
      if (nextColumnIndex >= form.columns.length) {
        nextColumnIndex = 0;
        nextItemIndex = Math.min(itemIndex + 1, form.items.length - 1);
      }
    } else if (direction === "previous") {
      nextColumnIndex -= 1;
      if (nextColumnIndex < 0) {
        nextColumnIndex = form.columns.length - 1;
        nextItemIndex = Math.max(itemIndex - 1, 0);
      }
    } else if (direction === "down") {
      nextItemIndex = Math.min(itemIndex + 1, form.items.length - 1);
    }

    const nextColumn = form.columns[nextColumnIndex];
    if (!nextColumn) return;

    selectCell(nextItemIndex, nextColumn.columnKey);
    focusTemplateCell(nextItemIndex, nextColumnIndex);
  };

  const addItemAtEnd = () => {
    setForm((current) => {
      const nextIndex = current.items.length;
      setSelectedItemIndex(nextIndex);
      setSelectedColumnKey(current.columns[0]?.columnKey ?? null);
      return {
        ...current,
        items: reindexItems([...current.items, createItemFromColumns(current.columns, nextIndex)])
      };
    });
  };

  const insertItemAt = (index) => {
    setForm((current) => {
      const nextItems = [...current.items];
      nextItems.splice(index, 0, createItemFromColumns(current.columns, index));
      setSelectedItemIndex(index);
      setSelectedColumnKey(current.columns[0]?.columnKey ?? null);
      return { ...current, items: reindexItems(nextItems) };
    });
  };

  const duplicateItemAt = (index) => {
    setForm((current) => {
      const sourceItem = current.items[index];
      if (!sourceItem) return current;

      const nextItems = [...current.items];
      nextItems.splice(index + 1, 0, duplicateItem(sourceItem, index + 1));
      setSelectedItemIndex(index + 1);
      setSelectedColumnKey((currentColumnKey) => currentColumnKey ?? current.columns[0]?.columnKey ?? null);
      return { ...current, items: reindexItems(nextItems) };
    });
  };

  const moveItem = (index, direction) => {
    setForm((current) => {
      const targetIndex = index + direction;
      if (targetIndex < 0 || targetIndex >= current.items.length) {
        return current;
      }

      const nextItems = [...current.items];
      const [movedItem] = nextItems.splice(index, 1);
      nextItems.splice(targetIndex, 0, movedItem);
      setSelectedItemIndex(targetIndex);
      return { ...current, items: reindexItems(nextItems) };
    });
  };

  const deleteItemAt = (index) => {
    setForm((current) => {
      const nextItems = current.items.filter((_, itemIndex) => itemIndex !== index);
      setSelectedItemIndex(Math.max(0, Math.min(index, nextItems.length - 1)));
      setSelectedColumnKey(nextItems.length ? selectedColumnKey : null);
      return {
        ...current,
        items: reindexItems(nextItems)
      };
    });
  };

  const refreshItemNumberColumns = () => {
    setForm((current) => ({
      ...current,
      items: refreshItemNumbers(current.items, current.columns)
    }));
  };

  const rowActionColumnWidth = 64;
  const answerTypeColumnWidth = 180;
  const selectedItem = form.items[selectedItemIndex] ?? null;
  const selectedColumn = form.columns.find((column) => column.columnKey === selectedColumnKey) ?? null;
  const selectedCellType = selectedColumn && selectedItem ? getEffectiveCellType(selectedColumn, selectedItem) : null;
  const hasSelectedRow = !!selectedItem;
  const selectedContextText = hasSelectedRow
    ? `Row #${selectedItemIndex + 1}${selectedColumn ? ` - ${selectedColumn.label || selectedColumn.columnKey} (${selectedCellType})` : ""}`
    : "No row selected";
  const itemTableMinWidth = Math.max(
    760,
    rowActionColumnWidth + answerTypeColumnWidth + form.columns.reduce((total, column) => total + Math.max(resolveColumnWidth(column), 160), 0)
  );

  const formGridSx = {
    display: "grid",
    gap: 2,
    gridTemplateColumns: {
      xs: "minmax(0, 1fr)",
      md: "minmax(0, 1.8fr) minmax(180px, 0.9fr) minmax(160px, 0.8fr)"
    },
    alignItems: "start"
  };

  const columnGridSx = {
    display: "grid",
    gap: 1.5,
    gridTemplateColumns: {
      xs: "minmax(0, 1fr)",
      md: "minmax(220px, 1.4fr) minmax(150px, 0.75fr) minmax(110px, 0.55fr) minmax(120px, 0.55fr) minmax(130px, 0.65fr) minmax(150px, 0.75fr) auto"
    },
    alignItems: "start"
  };

  const innerContent = (
    <>
      {isEdit && detailQuery.isLoading ? (
        <Typography color="text.secondary">Loading template...</Typography>
      ) : (
        <Stack spacing={3}>
          <Box sx={formGridSx}>
            <TextField label="Template Name" value={form.name} onChange={(event) => setForm((current) => ({ ...current, name: event.target.value }))} fullWidth />
            <TextField
              select
              label="Checksheet Mode"
              value={form.checksheetMode}
              onChange={(event) => setForm((current) => ({ ...current, checksheetMode: event.target.value }))}
              sx={{ minWidth: 180 }}
            >
              {CHECKSHEET_MODES.map((option) => (
                <MenuItem key={option.value} value={option.value}>{option.label}</MenuItem>
              ))}
            </TextField>
            <TextField
              select
              label="Inspection Entry"
              value={form.inspectionEntryMode}
              onChange={(event) => setForm((current) => ({
                ...current,
                inspectionEntryMode: event.target.value,
                inspectionEntryOptions: event.target.value === "free_text" && !current.inspectionEntryOptions?.length
                  ? [{ label: "", valueType: "free_text" }]
                  : current.inspectionEntryOptions
              }))}
              sx={{ minWidth: 180 }}
            >
              {INSPECTION_ENTRY_MODES.map((option) => (
                <MenuItem key={option.value} value={option.value}>{option.label}</MenuItem>
              ))}
            </TextField>
            <TextField select label="Status" value={form.isActive ? "active" : "inactive"} onChange={(event) => setForm((current) => ({ ...current, isActive: event.target.value === "active" }))} sx={{ minWidth: 160 }}>
              <MenuItem value="active">Active</MenuItem>
              <MenuItem value="inactive">Inactive</MenuItem>
            </TextField>
          </Box>

          {form.inspectionEntryMode === "free_text" && (
            <Paper variant="outlined" sx={{ p: 2 }}>
              <Stack spacing={1.5}>
                <Stack direction="row" justifyContent="space-between" alignItems="center">
                  <Typography variant="subtitle2">Inspection Entry Options</Typography>
                  <Button
                    size="small"
                    startIcon={<AddIcon />}
                    onClick={() => setForm((current) => ({
                      ...current,
                      inspectionEntryOptions: [...(current.inspectionEntryOptions ?? []), { label: "", valueType: "free_text" }]
                    }))}
                  >
                    Add Option
                  </Button>
                </Stack>
                <Stack spacing={1}>
                  {(form.inspectionEntryOptions ?? [{ label: "", valueType: "free_text" }]).map((option, optionIndex) => (
                    <Stack key={`inspection-entry-option-${optionIndex}`} direction="row" spacing={1} alignItems="center">
                      <TextField
                        label={`Option ${optionIndex + 1}`}
                        value={option.label}
                        onChange={(event) => {
                          const nextValue = event.target.value;
                          setForm((current) => ({
                            ...current,
                            inspectionEntryOptions: (current.inspectionEntryOptions ?? [{ label: "", valueType: "free_text" }]).map((currentOption, currentIndex) =>
                              currentIndex === optionIndex ? { ...currentOption, label: nextValue } : currentOption
                            )
                          }));
                        }}
                        size="small"
                        fullWidth
                      />
                      <TextField
                        select
                        label="Answer Type"
                        value={option.valueType ?? "free_text"}
                        onChange={(event) => {
                          const nextValueType = event.target.value;
                          setForm((current) => ({
                            ...current,
                            inspectionEntryOptions: (current.inspectionEntryOptions ?? [{ label: "", valueType: "free_text" }]).map((currentOption, currentIndex) =>
                              currentIndex === optionIndex ? { ...currentOption, valueType: nextValueType } : currentOption
                            )
                          }));
                        }}
                        size="small"
                        sx={{ minWidth: 190 }}
                      >
                        {ITEM_VALUE_TYPES.map((typeOption) => (
                          <MenuItem key={typeOption.value} value={typeOption.value}>{typeOption.label}</MenuItem>
                        ))}
                      </TextField>
                      <IconButton
                        color="error"
                        onClick={() => setForm((current) => ({
                          ...current,
                          inspectionEntryOptions: (current.inspectionEntryOptions ?? [{ label: "", valueType: "free_text" }]).filter((_, currentIndex) => currentIndex !== optionIndex).length
                            ? (current.inspectionEntryOptions ?? [{ label: "", valueType: "free_text" }]).filter((_, currentIndex) => currentIndex !== optionIndex)
                            : [{ label: "", valueType: "free_text" }]
                        }))}
                      >
                        <DeleteOutlineIcon fontSize="small" />
                      </IconButton>
                    </Stack>
                  ))}
                </Stack>
              </Stack>
            </Paper>
          )}

          <TextField label="Description" value={form.description} onChange={(event) => setForm((current) => ({ ...current, description: event.target.value }))} multiline minRows={2} />

          <Box>
            <Stack direction="row" justifyContent="space-between" alignItems="center" sx={{ mb: 1.5 }}>
              <Typography variant="h6">Columns</Typography>
              <Button size="small" startIcon={<AddIcon />} onClick={() => setForm((current) => ({ ...current, columns: [...current.columns, blankColumn(current.columns.length)] }))}>Add Column</Button>
            </Stack>
            <Stack spacing={1.5}>
              {form.columns.map((column, index) => (
                <Paper key={index} variant="outlined" sx={{ p: 2 }}>
                  <Box sx={columnGridSx}>
                    <TextField
                      label="Label"
                      value={column.label}
                      onChange={(event) =>
                        setForm((current) => {
                          const nextLabel = event.target.value;
                          const previousKey = current.columns[index].columnKey;
                          const nextKey = getUniqueColumnKeyForLabel(nextLabel, current.columns, index);

                          return {
                            ...current,
                            columns: current.columns.map((item, itemIndex) =>
                              itemIndex === index ? { ...item, label: nextLabel, columnKey: nextKey } : item
                            ),
                            items: syncItemKeys(current.items, previousKey, nextKey)
                          };
                        })
                      }
                      fullWidth
                    />
                    <TextField select label="Type" value={column.columnType} onChange={(event) => setForm((current) => ({ ...current, columns: current.columns.map((item, itemIndex) => itemIndex === index ? { ...item, columnType: event.target.value } : item) }))} sx={{ minWidth: 150 }}>
                      {COLUMN_TYPES.map((option) => (
                        <MenuItem key={option.value} value={option.value}>{option.label}</MenuItem>
                      ))}
                    </TextField>
                    <TextField select label="Required" value={column.isRequired ? "yes" : "no"} onChange={(event) => setForm((current) => ({ ...current, columns: current.columns.map((item, itemIndex) => itemIndex === index ? { ...item, isRequired: event.target.value === "yes" } : item) }))} sx={{ minWidth: 110 }}>
                      <MenuItem value="yes">Yes</MenuItem>
                      <MenuItem value="no">No</MenuItem>
                    </TextField>
                    <TextField
                      label="Width (px)"
                      type="number"
                      value={column.widthPx ?? getDefaultColumnWidth(column)}
                      onChange={(event) => {
                        const nextWidth = event.target.value;
                        setForm((current) => ({
                          ...current,
                          columns: current.columns.map((item, itemIndex) =>
                            itemIndex === index ? { ...item, widthPx: nextWidth } : item
                          )
                        }));
                      }}
                      onBlur={() =>
                        setForm((current) => ({
                          ...current,
                          columns: current.columns.map((item, itemIndex) =>
                            itemIndex === index ? { ...item, widthPx: resolveColumnWidth(item) } : item
                          )
                        }))
                      }
                      inputProps={{ min: MIN_COLUMN_WIDTH, max: MAX_COLUMN_WIDTH, step: 10 }}
                      sx={{ minWidth: 120 }}
                    />
                    <TextField
                      select
                      label="Merge Same Rows"
                      value={column.enableRowSpan ? "yes" : "no"}
                      onChange={(event) =>
                        setForm((current) => ({
                          ...current,
                          columns: current.columns.map((item, itemIndex) =>
                            itemIndex === index ? { ...item, enableRowSpan: event.target.value === "yes" } : item
                          )
                        }))
                      }
                      sx={{ minWidth: 130 }}
                    >
                      <MenuItem value="yes">Yes</MenuItem>
                      <MenuItem value="no">No</MenuItem>
                    </TextField>
                    <TextField
                      select
                      label="Merge Same Columns"
                      value={column.enableColSpan ? "yes" : "no"}
                      onChange={(event) =>
                        setForm((current) => ({
                          ...current,
                          columns: current.columns.map((item, itemIndex) =>
                            itemIndex === index ? { ...item, enableColSpan: event.target.value === "yes" } : item
                          )
                        }))
                      }
                      sx={{ minWidth: 150 }}
                    >
                      <MenuItem value="yes">Yes</MenuItem>
                      <MenuItem value="no">No</MenuItem>
                    </TextField>
                    <IconButton color="error" disabled={form.columns.length <= 1} onClick={() => setForm((current) => ({ ...current, columns: current.columns.filter((_, itemIndex) => itemIndex !== index) }))}>
                      <DeleteOutlineIcon />
                    </IconButton>
                  </Box>
                </Paper>
              ))}
            </Stack>
          </Box>

          <Divider />

          <Box>
            <Stack direction="row" justifyContent="space-between" alignItems="center" sx={{ mb: 1.5 }}>
              <Box>
                <Typography variant="h6">Template Items</Typography>
                <Typography variant="body2" color="text.secondary">
                  Edit item rows in the same column structure used by checksheet submissions.
                </Typography>
              </Box>
              <Stack direction="row" spacing={1} alignItems="center">
                <Button size="small" variant="outlined" startIcon={<RefreshIcon />} onClick={refreshItemNumberColumns}>
                  Refresh No.
                </Button>
                <Button size="small" startIcon={<AddIcon />} onClick={addItemAtEnd}>Add Row</Button>
              </Stack>
            </Stack>
            <Paper
              variant="outlined"
              sx={{
                mb: 1,
                px: 1.25,
                py: 1,
                bgcolor: "#f8fafc"
              }}
            >
              <Stack direction={{ xs: "column", md: "row" }} spacing={1} alignItems={{ xs: "stretch", md: "center" }} justifyContent="space-between">
                <Stack spacing={0.25} sx={{ minWidth: 180 }}>
                  <Typography variant="caption" color="text.secondary">
                    Selected
                  </Typography>
                  <Typography variant="body2" fontWeight={700} noWrap>
                    {selectedContextText}
                  </Typography>
                </Stack>
                <Stack direction="row" spacing={0.5} alignItems="center" flexWrap="wrap" useFlexGap>
                  <Tooltip title="Insert row above">
                    <span>
                      <Button size="small" variant="outlined" startIcon={<AddCircleOutlineIcon />} disabled={!hasSelectedRow} onClick={() => insertItemAt(selectedItemIndex)}>
                        Above
                      </Button>
                    </span>
                  </Tooltip>
                  <Tooltip title="Insert row below">
                    <span>
                      <Button size="small" variant="outlined" startIcon={<AddIcon />} disabled={!hasSelectedRow} onClick={() => insertItemAt(selectedItemIndex + 1)}>
                        Below
                      </Button>
                    </span>
                  </Tooltip>
                  <Tooltip title="Duplicate selected row">
                    <span>
                      <Button size="small" variant="outlined" startIcon={<ContentCopyOutlinedIcon />} disabled={!hasSelectedRow} onClick={() => duplicateItemAt(selectedItemIndex)}>
                        Duplicate
                      </Button>
                    </span>
                  </Tooltip>
                  <Tooltip title="Move selected row up">
                    <span>
                      <IconButton size="small" disabled={!hasSelectedRow || selectedItemIndex === 0} onClick={() => moveItem(selectedItemIndex, -1)}>
                        <KeyboardArrowUpIcon fontSize="small" />
                      </IconButton>
                    </span>
                  </Tooltip>
                  <Tooltip title="Move selected row down">
                    <span>
                      <IconButton size="small" disabled={!hasSelectedRow || selectedItemIndex === form.items.length - 1} onClick={() => moveItem(selectedItemIndex, 1)}>
                        <KeyboardArrowDownIcon fontSize="small" />
                      </IconButton>
                    </span>
                  </Tooltip>
                  <Tooltip title="Delete selected row">
                    <span>
                      <IconButton size="small" color="error" disabled={!hasSelectedRow || form.items.length <= 1} onClick={() => deleteItemAt(selectedItemIndex)}>
                        <DeleteOutlineIcon fontSize="small" />
                      </IconButton>
                    </span>
                  </Tooltip>
                </Stack>
              </Stack>
            </Paper>
            <TableContainer component={Paper} variant="outlined" sx={{ overflowX: "auto", maxHeight: 620 }}>
              <Table
                size="small"
                stickyHeader
                sx={{
                  minWidth: itemTableMinWidth,
                  tableLayout: "auto",
                  "& .MuiTableCell-root": {
                    borderRight: 1,
                    borderColor: "divider",
                    verticalAlign: "top",
                    px: 1,
                    py: 0.75
                  },
                  "& .MuiTableCell-root:last-of-type": {
                    borderRight: 0
                  },
                  "& .MuiTableHead-root .MuiTableCell-root": {
                    bgcolor: "#f8fafc",
                    fontWeight: 700,
                    whiteSpace: "nowrap"
                  }
                }}
              >
                <TableHead>
                  <TableRow>
                    <TableCell
                      sx={{
                        position: "sticky",
                        left: 0,
                        zIndex: 5,
                        width: rowActionColumnWidth,
                        minWidth: rowActionColumnWidth,
                        bgcolor: "#f8fafc"
                      }}
                    >
                      Row
                    </TableCell>
                    <TableCell
                      sx={{
                        position: "sticky",
                        left: rowActionColumnWidth,
                        zIndex: 5,
                        width: answerTypeColumnWidth,
                        minWidth: answerTypeColumnWidth,
                        bgcolor: "#f8fafc"
                      }}
                    >
                      Answer Type
                    </TableCell>
                    {form.columns.map((column) => (
                      <TableCell
                        key={column.columnKey}
                        sx={{
                          width: Math.max(resolveColumnWidth(column), 160),
                          minWidth: Math.max(resolveColumnWidth(column), 160)
                        }}
                      >
                        {column.label || column.columnKey}
                      </TableCell>
                    ))}
                  </TableRow>
                </TableHead>
                <TableBody>
                  {form.items.map((item, index) => (
                    <TableRow
                      key={`template-item-row-${index}`}
                      hover
                      selected={index === selectedItemIndex}
                      sx={{
                        "&.Mui-selected > .MuiTableCell-root": {
                          bgcolor: "rgba(25, 118, 210, 0.06)"
                        },
                        "&.Mui-selected:hover > .MuiTableCell-root": {
                          bgcolor: "rgba(25, 118, 210, 0.09)"
                        }
                      }}
                    >
                      <TableCell
                        onClick={() => selectRow(index)}
                        sx={{
                          position: "sticky",
                          left: 0,
                          zIndex: 2,
                          width: rowActionColumnWidth,
                          minWidth: rowActionColumnWidth,
                          bgcolor: index === selectedItemIndex ? "rgba(25, 118, 210, 0.06)" : "background.paper",
                          cursor: "pointer"
                        }}
                      >
                        <Typography variant="caption" fontWeight={700}>
                          #{index + 1}
                        </Typography>
                      </TableCell>
                      <TableCell
                        onFocus={() => selectRow(index)}
                        onClick={() => selectRow(index)}
                        sx={{
                          position: "sticky",
                          left: rowActionColumnWidth,
                          zIndex: 2,
                          width: answerTypeColumnWidth,
                          minWidth: answerTypeColumnWidth,
                          bgcolor: index === selectedItemIndex ? "rgba(25, 118, 210, 0.06)" : "background.paper"
                        }}
                      >
                        <TextField
                          select
                          size="small"
                          value={item.valueType ?? "fixed"}
                          onChange={(event) =>
                            setForm((current) => ({
                              ...current,
                              items: current.items.map((currentItem, itemIndex) =>
                                itemIndex === index ? { ...currentItem, valueType: event.target.value } : currentItem
                              )
                            }))
                          }
                          fullWidth
                          sx={{
                            "& .MuiInputBase-input": {
                              fontSize: 13
                            }
                          }}
                        >
                          {ITEM_VALUE_TYPES.map((option) => (
                            <MenuItem key={option.value} value={option.value}>{option.label}</MenuItem>
                          ))}
                        </TextField>
                      </TableCell>
                      {form.columns.map((column, columnIndex) => (
                        <TableCell
                          key={`${column.columnKey}-${index}`}
                          sx={{
                            width: Math.max(resolveColumnWidth(column), 160),
                            minWidth: Math.max(resolveColumnWidth(column), 160)
                          }}
                        >
                          <TemplateItemField
                            column={column}
                            columnIndex={columnIndex}
                            item={item}
                            itemIndex={index}
                            items={form.items}
                            setForm={setForm}
                            compact
                            isSelected={selectedItemIndex === index && selectedColumnKey === column.columnKey}
                            onSelect={() => selectCell(index, column.columnKey)}
                            onNavigate={(direction) => navigateItemCell(index, columnIndex, direction)}
                          />
                        </TableCell>
                      ))}
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </TableContainer>
          </Box>

          <Divider />

          <Box>
            <Stack direction="row" justifyContent="space-between" alignItems="center" sx={{ mb: 1.5 }}>
              <Box>
                <Typography variant="h6">
                  {form.checksheetMode === "regular" ? "Regular Approval Steps" : "Daily Approval Steps"}
                </Typography>
                <Typography variant="body2" color="text.secondary">
                  Optional. These approval rows run sequentially. Allowed users are maintained by step order in Checksheet Approver Master.
                </Typography>
              </Box>
              <Button
                size="small"
                startIcon={<AddIcon />}
                onClick={() =>
                  setForm((current) => ({
                    ...current,
                    [current.checksheetMode === "regular" ? "regularApprovalSteps" : "dailyApprovalSteps"]: [
                      ...current[current.checksheetMode === "regular" ? "regularApprovalSteps" : "dailyApprovalSteps"],
                      current.checksheetMode === "regular"
                        ? blankRegularApprovalStep(current.regularApprovalSteps.length + 1)
                        : blankDailyApprovalStep(current.dailyApprovalSteps.length + 1)
                    ]
                  }))
                }
              >
                Add Step
              </Button>
            </Stack>

            <Stack spacing={1.5}>
              {activeApprovalSteps.map((step, index) => (
                <Paper key={`${form.checksheetMode}-step-${index}`} variant="outlined" sx={{ p: 2 }}>
                  <Box
                    sx={{
                      display: "grid",
                      gap: 1.5,
                      gridTemplateColumns: {
                        xs: "minmax(0, 1fr)",
                        md: "110px minmax(220px, 1fr) auto"
                      },
                      alignItems: "start"
                    }}
                  >
                    <TextField label="Order" value={index + 1} InputProps={{ readOnly: true }} />
                    <TextField
                      label="Step Description"
                      value={step.stepName}
                      onChange={(event) =>
                        setForm((current) => ({
                          ...current,
                          [current.checksheetMode === "regular" ? "regularApprovalSteps" : "dailyApprovalSteps"]: current[
                            current.checksheetMode === "regular" ? "regularApprovalSteps" : "dailyApprovalSteps"
                          ].map((item, itemIndex) => (itemIndex === index ? { ...item, stepName: event.target.value } : item))
                        }))
                      }
                      fullWidth
                    />
                    <IconButton
                      color="error"
                      onClick={() =>
                        setForm((current) => ({
                          ...current,
                          [current.checksheetMode === "regular" ? "regularApprovalSteps" : "dailyApprovalSteps"]: current[
                            current.checksheetMode === "regular" ? "regularApprovalSteps" : "dailyApprovalSteps"
                          ]
                            .filter((_, itemIndex) => itemIndex !== index)
                            .map((item, itemIndex) => ({ ...item, stepOrder: itemIndex + 1 }))
                        }))
                      }
                    >
                      <DeleteOutlineIcon />
                    </IconButton>
                  </Box>
                </Paper>
              ))}
              {activeApprovalSteps.length === 0 && (
                <Paper variant="outlined" sx={{ p: 2 }}>
                  <Typography variant="body2" color="text.secondary">
                    No approval steps configured.
                  </Typography>
                </Paper>
              )}
            </Stack>
          </Box>
        </Stack>
      )}
    </>
  );

  if (embedded) {
    return (
      <Box sx={{ p: 3 }}>
        <Stack spacing={3}>
          <Stack direction={{ xs: "column", md: "row" }} justifyContent="space-between" spacing={2}>
            <Box>
              <Typography variant="h5" fontWeight={700}>{isEdit ? "Edit Checksheet Template" : "Create Checksheet Template"}</Typography>
              <Typography variant="body2" color="text.secondary">
                Configure columns, template items, and approval steps on a dedicated page.
              </Typography>
            </Box>
            <Stack direction="row" spacing={1.5}>
              <Button onClick={handleClose}>Back</Button>
              <Button variant="contained" onClick={handleSubmit} disabled={!canSubmit || mutation.isPending}>
                {mutation.isPending ? "Saving..." : isEdit ? "Save Changes" : "Create Template"}
              </Button>
            </Stack>
          </Stack>
          <Paper variant="outlined" sx={{ p: { xs: 2, md: 3 } }}>
            {innerContent}
          </Paper>
        </Stack>
      </Box>
    );
  }

  return (
    <Dialog open={open} onClose={handleClose} fullWidth maxWidth="lg">
      <DialogTitle>{isEdit ? "Edit Checksheet Template" : "Create Checksheet Template"}</DialogTitle>
      <DialogContent dividers>{innerContent}</DialogContent>
      <DialogActions>
        <Button onClick={handleClose} disabled={mutation.isPending}>Cancel</Button>
        <Button variant="contained" onClick={handleSubmit} disabled={!canSubmit || mutation.isPending}>
          {mutation.isPending ? "Saving..." : isEdit ? "Save Changes" : "Create Template"}
        </Button>
      </DialogActions>
    </Dialog>
  );
}

export default function ChecksheetTemplatesPage() {
  const navigate = useNavigate();
  const location = useLocation();
  const { id } = useParams();
  const { user } = useAuth();
  const canManage = authRoles.sa.includes(user?.role);
  const [deleteTarget, setDeleteTarget] = useState(null);
  const [page, setPage] = useState(1);
  const [pageSize, setPageSize] = useState(10);
  const isFormRoute = location.pathname.endsWith("/new") || location.pathname.endsWith("/edit");
  const formMode = id ? "edit" : "create";
  const templateId = id ? Number(id) : null;
  const { data, isLoading, isError, error, refetch } = useChecksheetTemplates({ page, pageSize });
  const deleteMutation = useDeleteChecksheetTemplate();
  const templates = useMemo(() => data?.items ?? [], [data?.items]);
  const totalCount = data?.totalCount ?? 0;


  const columns = useMemo(
    () => [
      {
        id: "template",
        header: "Template",
        cell: ({ row }) => (
          <Box sx={{ minWidth: 280, maxWidth: 420 }}>
            <Typography
              fontWeight={600}
              sx={{
                whiteSpace: "normal",
                overflowWrap: "normal",
                wordBreak: "normal"
              }}
            >
              {row.original.name}
            </Typography>
            <Typography
              variant="caption"
              color="text.secondary"
              sx={{
                display: "block",
                whiteSpace: "normal",
                overflowWrap: "normal",
                wordBreak: "normal"
              }}
            >
              {row.original.description || "No description"}
            </Typography>
          </Box>
        )
      },
      {
        id: "mode",
        header: "Mode",
        cell: ({ row }) => (
          <Chip
            label={row.original.checksheetMode === "regular" ? "Regular" : "Daily"}
            size="small"
            variant="outlined"
          />
        )
      },
      {
        id: "entryMode",
        header: "Entry",
        cell: ({ row }) => (
          <Chip
            label={formatInspectionEntryMode(row.original.inspectionEntryMode)}
            size="small"
            variant="outlined"
          />
        )
      },
      {
        accessorKey: "itemCount",
        header: "Items"
      },
      {
        id: "status",
        header: "Status",
        cell: ({ row }) => (
          <Chip label={row.original.isActive ? "Active" : "Inactive"} size="small" color={row.original.isActive ? "success" : "default"} />
        )
      },
      {
        id: "updatedAt",
        header: "Updated",
        cell: ({ row }) => new Date(row.original.updatedAt).toLocaleString()
      },
      ...(canManage
        ? [{
          id: "actions",
          header: () => <Box sx={{ textAlign: "right", pr: 1.5 }}>Actions</Box>,
          cell: ({ row }) => (
            <Stack direction="row" spacing={1} justifyContent="flex-end" sx={{ pr: 1.5 }}>
              <IconButton onClick={() => navigate(`/master/checksheet-templates/${row.original.id}/edit`)}>
                <EditOutlinedIcon />
              </IconButton>
              <IconButton color="error" onClick={() => setDeleteTarget(row.original)}>
                <DeleteOutlineIcon />
              </IconButton>
            </Stack>
          )
        }]
        : [])
    ],
    [canManage, navigate]
  );

  const table = useReactTable({
    data: templates,
    columns,
    getCoreRowModel: getCoreRowModel()
  });

  if (isFormRoute) {
    return (
      <TemplateEditor
        embedded
        mode={formMode}
        templateId={templateId}
        onSaved={async ({ mode }) => {
          if (mode === "create") {
            setPage(1);
          }

          await refetch();
        }}
        onClose={() => navigate("/master/checksheet-templates")}
      />
    );
  }

  return (
    <Box sx={{ p: 3 }}>
      <Stack spacing={3}>
        <Stack direction={{ xs: "column", md: "row" }} justifyContent="space-between" alignItems={{ xs: "stretch", md: "flex-start" }} spacing={2}>
          <Box>
            <Typography variant="h5" fontWeight={700}>Checksheet Templates</Typography>
            <Typography variant="body2" color="text.secondary">
              Create, edit, and delete dynamic form templates for machine checksheets.
            </Typography>
          </Box>
          {canManage && (
            <Button variant="contained" startIcon={<AddIcon />} onClick={() => navigate("/master/checksheet-templates/new")}>
              New Template
            </Button>
          )}
        </Stack>

        {isLoading ? (
          <Paper variant="outlined" sx={{ p: 4 }}>
            <Typography color="text.secondary">Loading templates...</Typography>
          </Paper>
        ) : isError ? (
          <Alert severity="error">{error.message}</Alert>
        ) : (
          <TableContainer component={Paper} variant="outlined">
            <Table>
              <TableHead>
                {table.getHeaderGroups().map((headerGroup) => (
                  <TableRow key={headerGroup.id}>
                    {headerGroup.headers.map((header, index) => {
                      const isFirstColumn = index === 0;
                      const isLastColumn = index === headerGroup.headers.length - 1;
                      const isTemplateColumn = header.column.id === "template";
                      const isCenterColumn = ["mode", "entryMode"].includes(header.column.id);

                      return (
                        <TableCell
                          key={header.id}
                          align={isCenterColumn ? "center" : isLastColumn ? "right" : "left"}
                          sx={{
                            pl: isFirstColumn ? 3 : 2,
                            pr: isLastColumn ? 3 : 2,
                            ...(isTemplateColumn ? { minWidth: 320, width: 360 } : {}),
                            whiteSpace: "normal",
                            overflowWrap: "normal",
                            wordBreak: "normal",
                            verticalAlign: "top"
                          }}
                        >
                          {header.isPlaceholder ? null : flexRender(header.column.columnDef.header, header.getContext())}
                        </TableCell>
                      );
                    })}
                  </TableRow>
                ))}
              </TableHead>
              <TableBody>
                {table.getRowModel().rows.map((row) => (
                  <TableRow key={row.id} hover>
                    {row.getVisibleCells().map((cell, index) => {
                      const isFirstColumn = index === 0;
                      const isLastColumn = index === row.getVisibleCells().length - 1;
                      const isTemplateColumn = cell.column.id === "template";
                      const isCenterColumn = ["mode", "entryMode"].includes(cell.column.id);

                      return (
                        <TableCell
                          key={cell.id}
                          align={isCenterColumn ? "center" : isLastColumn ? "right" : "left"}
                          sx={{
                            pl: isFirstColumn ? 3 : 2,
                            pr: isLastColumn ? 3 : 2,
                            ...(isTemplateColumn ? { minWidth: 320, width: 360 } : {}),
                            whiteSpace: "normal",
                            overflowWrap: "normal",
                            wordBreak: "normal",
                            verticalAlign: "top"
                          }}
                        >
                          {flexRender(cell.column.columnDef.cell, cell.getContext())}
                        </TableCell>
                      );
                    })}
                  </TableRow>
                ))}
                {templates.length === 0 && (
                  <TableRow>
                    <TableCell colSpan={columns.length} align="center" sx={{ py: 6, px: 3 }}>
                      No checksheet templates yet.
                    </TableCell>
                  </TableRow>
                )}
              </TableBody>
            </Table>
            <TablePagination
              component="div"
              count={totalCount}
              page={Math.max(0, page - 1)}
              onPageChange={(_, nextPage) => setPage(nextPage + 1)}
              rowsPerPage={pageSize}
              onRowsPerPageChange={(event) => {
                setPageSize(Number(event.target.value));
                setPage(1);
              }}
              rowsPerPageOptions={[10, 20, 50, 100]}
            />
          </TableContainer>
        )}
      </Stack>

      <ConfirmationDialog
        open={!!deleteTarget}
        title="Delete Template"
        text={`Delete template "${deleteTarget?.name}"?`}
        confirmText="Delete"
        confirmColor="error"
        isLoading={deleteMutation.isPending}
        onConfirmDialogClose={() => setDeleteTarget(null)}
        onYesClick={() => {
          if (!deleteTarget) return;
          deleteMutation.mutate(deleteTarget.id, { onSuccess: () => setDeleteTarget(null) });
        }}
      />
    </Box>
  );
}
