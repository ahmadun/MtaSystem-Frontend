import { useMemo, useState } from "react";
import { useNavigate, useParams } from "react-router-dom";
import {
  Alert,
  Box,
  Button,
  IconButton,
  MenuItem,
  Paper,
  Stack,
  Table,
  TableBody,
  TableCell,
  TableContainer,
  TableHead,
  TableRow,
  TextField,
  Tooltip,
  Typography
} from "@mui/material";
import AddIcon from "@mui/icons-material/Add";
import CloudUploadIcon from "@mui/icons-material/CloudUpload";
import DeleteOutlineIcon from "@mui/icons-material/DeleteOutline";
import SaveOutlinedIcon from "@mui/icons-material/SaveOutlined";
import useAuth from "app/hooks/useAuth";
import {
  useAppendChecksheetSubmissionTemplateItems,
  useChecksheetSubmission,
  useUploadChecksheetTemplateImage
} from "app/hooks/useChecksheets";

const ITEM_VALUE_TYPES = [
  { value: "fixed", label: "Fixed (OK/NG/FIX)" },
  { value: "free_text", label: "Free Text" },
  { value: "number", label: "Number" },
  { value: "jig_no_check", label: "Jig No Check" }
];

const COLUMN_TYPES = [
  { value: "text", label: "Text" },
  { value: "textarea", label: "Textarea" },
  { value: "image", label: "Image" }
];

const ITEM_CELL_TYPES_KEY = "__cellTypes";

function createItemFromColumns(columns, sortOrder) {
  const next = { sortOrder, valueType: "fixed" };
  columns.forEach((column) => {
    next[column.columnKey] = column.columnKey === "itemNo" ? String(sortOrder + 1) : "";
  });
  return next;
}

function isItemNumberColumn(column) {
  const columnKey = String(column?.columnKey ?? "").trim().toLowerCase();
  const label = String(column?.label ?? "").trim().toLowerCase();
  return ["no", "itemno", "item_no"].includes(columnKey) || ["no.", "no"].includes(label);
}

function createItemFromSource(columns, sourceItem, sortOrder) {
  if (!sourceItem) {
    return createItemFromColumns(columns, sortOrder);
  }

  const sourceData = sourceItem.data ?? sourceItem;
  const next = {
    sortOrder,
    valueType: sourceItem.valueType ?? "fixed"
  };

  columns.forEach((column) => {
    const sourceValue = sourceData[column.columnKey] ?? "";
    next[column.columnKey] = isItemNumberColumn(column) && !column.enableRowSpan
      ? String(sortOrder + 1)
      : sourceValue;
  });

  const cellTypes = sourceData[ITEM_CELL_TYPES_KEY] ?? sourceItem[ITEM_CELL_TYPES_KEY];
  if (cellTypes) {
    next[ITEM_CELL_TYPES_KEY] = serializeAllItemCellTypes(cellTypes);
  }

  return next;
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
  return parseItemCellTypes(item?.data?.[ITEM_CELL_TYPES_KEY] ?? item?.[ITEM_CELL_TYPES_KEY]);
}

function getEffectiveCellType(column, item) {
  return getItemCellTypes(item)[column.columnKey] ?? normalizeColumnType(column.columnType);
}

function getColumnImageOptions(existingItems, newItems, columnKey) {
  return [
    ...new Set(
      [...existingItems, ...newItems]
        .map((item) => String(item?.data?.[columnKey] ?? item?.[columnKey] ?? "").trim())
        .filter(isImageCellValue)
        .map(getImageUrl)
    )
  ];
}

function ReadOnlyCell({ column, item, value }) {
  const explicitCellType = getItemCellTypes(item)[column.columnKey] ?? null;

  if (explicitCellType && explicitCellType !== "image") {
    return value || "-";
  }

  if ((explicitCellType ?? column.columnType) === "image" || isImageCellValue(value)) {
    const imageUrl = getImageUrl(value);
    return imageUrl ? (
      <Box
        component="img"
        src={imageUrl}
        alt={column.label}
        sx={{
          display: "block",
          maxWidth: 220,
          maxHeight: 140,
          border: 1,
          borderColor: "divider",
          borderRadius: 1,
          bgcolor: "background.default"
        }}
      />
    ) : "-";
  }

  return value || "-";
}

function getCurrentRowsColumnWidth(column) {
  if (isItemNumberColumn(column)) {
    return { xs: 96, sm: 112, md: 120 };
  }

  if (normalizeColumnType(column.columnType) === "image") {
    return { xs: 220, sm: 260, md: 280 };
  }

  return { xs: 180, sm: 220, md: 240 };
}

function getCurrentRowsMinWidth(columns) {
  const answerTypeWidth = 170;
  const totalColumnWidth = columns.reduce((total, column) => {
    const width = getCurrentRowsColumnWidth(column);
    return total + width.md;
  }, answerTypeWidth);

  return Math.max(760, totalColumnWidth);
}

function getCurrentRowsCellSx(column) {
  const width = getCurrentRowsColumnWidth(column);

  return {
    minWidth: width,
    width: { md: width.md },
    verticalAlign: "middle",
    whiteSpace: "normal",
    overflowWrap: "break-word"
  };
}

function NewItemField({ column, item, itemIndex, existingItems, newItems, setNewItems }) {
  const uploadMutation = useUploadChecksheetTemplateImage();
  const value = item[column.columnKey] ?? "";
  const effectiveCellType = getEffectiveCellType(column, item);

  const updateValue = (nextValue) => {
    setNewItems((current) =>
      current.map((currentItem, currentIndex) =>
        currentIndex === itemIndex ? { ...currentItem, [column.columnKey]: nextValue } : currentItem
      )
    );
  };

  const updateCellType = (nextCellType) => {
    setNewItems((current) =>
      current.map((currentItem, currentIndex) => {
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
    );
  };

  if (effectiveCellType !== "image") {
    return (
      <Box
        sx={{
          position: "relative",
          "& .append-cell-attach-image": {
            opacity: 0,
            pointerEvents: "none",
            transition: "opacity 120ms ease"
          },
          "&:focus-within .append-cell-attach-image": {
            opacity: 1,
            pointerEvents: "auto"
          }
        }}
      >
        <TextField
          label={column.label}
          value={value}
          multiline={effectiveCellType === "textarea"}
          minRows={effectiveCellType === "textarea" ? 2 : undefined}
          onChange={(event) => updateValue(event.target.value)}
          size="small"
          fullWidth
        />
        <Tooltip title="Attach image to this cell">
          <IconButton
            className="append-cell-attach-image"
            size="small"
            onClick={() => updateCellType("image")}
            sx={{
              position: "absolute",
              top: 5,
              right: 5,
              width: 28,
              height: 28,
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
      </Box>
    );
  }

  const imageUrl = getImageUrl(value);
  const existingImages = getColumnImageOptions(existingItems, newItems, column.columnKey);

  const handleImageChange = async (event) => {
    const file = event.target.files?.[0];
    event.target.value = "";
    if (!file) return;

    const result = await uploadMutation.mutateAsync(file);
    updateValue(result?.data?.url ?? "");
  };

  return (
    <Stack spacing={1}>
      <Stack direction={{ xs: "column", sm: "row" }} spacing={1} alignItems={{ sm: "center" }}>
        <Typography variant="caption" color="text.secondary" sx={{ flex: 1 }}>
          {column.label}
        </Typography>
        <Button size="small" onClick={() => updateCellType(normalizeColumnType(column.columnType))}>
          Use Text
        </Button>
      </Stack>
      {imageUrl && (
        <Box
          component="img"
          src={imageUrl}
          alt={column.label}
          sx={{
            display: "block",
            maxWidth: 220,
            maxHeight: 140,
            border: 1,
            borderColor: "divider",
            borderRadius: 1,
            bgcolor: "background.default"
          }}
        />
      )}
      <Stack direction={{ xs: "column", sm: "row" }} spacing={1}>
        <Button component="label" variant="outlined" size="small" startIcon={<CloudUploadIcon />} disabled={uploadMutation.isPending}>
          {uploadMutation.isPending ? "Uploading..." : imageUrl ? "Replace Image" : "Upload Image"}
          <input type="file" accept="image/*" hidden onChange={handleImageChange} />
        </Button>
        <TextField
          select
          size="small"
          label="Use Existing"
          value=""
          onChange={(event) => updateValue(event.target.value)}
          disabled={uploadMutation.isPending || existingImages.length === 0}
          sx={{ minWidth: 170 }}
        >
          <MenuItem value="" disabled>
            Select image
          </MenuItem>
          {existingImages.map((option, optionIndex) => (
            <MenuItem key={option} value={option}>
              Image {optionIndex + 1}
            </MenuItem>
          ))}
        </TextField>
      </Stack>
    </Stack>
  );
}

export default function ChecksheetTemplateAppendItemsPage() {
  const { id } = useParams();
  const navigate = useNavigate();
  const { user } = useAuth();
  const submissionId = Number(id);
  const { data: submission, isLoading, isError, error } = useChecksheetSubmission(submissionId);
  const template = submission?.template;
  const columns = template?.columns ?? [];
  const existingItems = template?.items ?? [];
  const maxSortOrder = useMemo(
    () => existingItems.reduce((max, item, index) => Math.max(max, Number(item.sortOrder ?? index)), -1),
    [existingItems]
  );
  const [newItems, setNewItems] = useState([]);
  const appendMutation = useAppendChecksheetSubmissionTemplateItems(submissionId);
  const isDraft = submission?.status === "draft";
  const isOwner = Number(user?.id ?? 0) === Number(submission?.createdByUserId ?? 0);
  const canAppend = !!template?.id && isDraft && isOwner;

  const addRow = () => {
    setNewItems((current) => {
      const nextSortOrder = maxSortOrder + current.length + 1;
      const sourceItem = current[current.length - 1] ?? existingItems[existingItems.length - 1] ?? null;
      return [...current, createItemFromSource(columns, sourceItem, nextSortOrder)];
    });
  };

  const handleSave = async () => {
    if (!canAppend || newItems.length === 0) return;

    await appendMutation.mutateAsync({
      items: newItems.map((item, index) => {
        const data = {};
        columns.forEach((column) => {
          data[column.columnKey] = item[column.columnKey] ?? "";
        });
        const cellTypesJson = serializeItemCellTypes(item[ITEM_CELL_TYPES_KEY], columns);
        if (cellTypesJson) {
          data[ITEM_CELL_TYPES_KEY] = cellTypesJson;
        }
        return {
          sortOrder: maxSortOrder + index + 1,
          valueType: item.valueType ?? "fixed",
          data
        };
      })
    });

    navigate(`/checksheets/submissions/${submissionId}`);
  };

  if (isLoading) {
    return (
      <Box sx={{ p: 3 }}>
        <Paper variant="outlined" sx={{ p: 4 }}>
          <Typography color="text.secondary">Loading checksheet template...</Typography>
        </Paper>
      </Box>
    );
  }

  if (isError) {
    return (
      <Box sx={{ p: 3 }}>
        <Alert severity="error">{error.message}</Alert>
      </Box>
    );
  }

  return (
    <Box sx={{ p: 3 }}>
      <Stack spacing={3}>
        <Stack direction={{ xs: "column", md: "row" }} justifyContent="space-between" spacing={2}>
          <Box>
            <Typography variant="h5" fontWeight={700}>Add Template Rows</Typography>
            <Typography variant="body2" color="text.secondary">
              {template?.name || "Checksheet template"} | {submission?.machineCode}
            </Typography>
          </Box>
          <Stack direction="row" spacing={1.5}>
            <Button onClick={() => navigate(`/checksheets/submissions/${submissionId}`)}>Back</Button>
            <Button
              variant="contained"
              startIcon={<SaveOutlinedIcon />}
              disabled={!canAppend || newItems.length === 0 || appendMutation.isPending}
              onClick={handleSave}
            >
              {appendMutation.isPending ? "Saving..." : "Save New Rows"}
            </Button>
          </Stack>
        </Stack>

        {!canAppend && (
          <Alert severity="warning">
            Template rows can only be added from your own DRAFT checksheet transaction.
          </Alert>
        )}

        <Paper variant="outlined" sx={{ p: 3 }}>
          <Typography variant="h6" sx={{ mb: 2 }}>Current Rows</Typography>
          <TableContainer sx={{ overflowX: "auto" }}>
            <Table size="small" sx={{ tableLayout: "auto", minWidth: getCurrentRowsMinWidth(columns) }}>
              <TableHead>
                <TableRow>
                  {columns.map((column) => (
                    <TableCell
                      key={column.columnKey}
                      sx={{
                        ...getCurrentRowsCellSx(column),
                        fontWeight: 700
                      }}
                    >
                      {column.label}
                    </TableCell>
                  ))}
                  <TableCell
                    sx={{
                      minWidth: { xs: 150, sm: 160, md: 170 },
                      width: { md: 170 },
                      fontWeight: 700,
                      verticalAlign: "middle",
                      whiteSpace: "normal",
                      overflowWrap: "break-word"
                    }}
                  >
                    Answer Type
                  </TableCell>
                </TableRow>
              </TableHead>
              <TableBody>
                {existingItems.map((item) => (
                  <TableRow key={item.id}>
                    {columns.map((column) => (
                      <TableCell key={column.columnKey} sx={getCurrentRowsCellSx(column)}>
                        <ReadOnlyCell column={column} item={item} value={item.data?.[column.columnKey]} />
                      </TableCell>
                    ))}
                    <TableCell
                      sx={{
                        minWidth: { xs: 150, sm: 160, md: 170 },
                        width: { md: 170 },
                        verticalAlign: "middle"
                      }}
                    >
                      {item.valueType}
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </TableContainer>
        </Paper>

        <Paper variant="outlined" sx={{ p: 3 }}>
          <Stack direction={{ xs: "column", md: "row" }} justifyContent="space-between" spacing={2} sx={{ mb: 2 }}>
            <Box>
              <Typography variant="h6">New Rows</Typography>
              <Typography variant="body2" color="text.secondary">
                Existing rows and columns are locked on this page.
              </Typography>
            </Box>
            <Button variant="outlined" startIcon={<AddIcon />} disabled={!canAppend} onClick={addRow}>
              Add Row
            </Button>
          </Stack>

          <Stack spacing={1.5}>
            {newItems.map((item, index) => (
              <Paper key={index} variant="outlined" sx={{ p: 2 }}>
                <Stack spacing={1.5}>
                  <Stack direction={{ xs: "column", md: "row" }} justifyContent="space-between" spacing={1}>
                    <Typography variant="subtitle2">New Row #{index + 1}</Typography>
                    <Stack direction="row" spacing={1} alignItems="center">
                      <TextField
                        select
                        label="Answer Type"
                        size="small"
                        value={item.valueType ?? "fixed"}
                        onChange={(event) =>
                          setNewItems((current) =>
                            current.map((currentItem, currentIndex) =>
                              currentIndex === index ? { ...currentItem, valueType: event.target.value } : currentItem
                            )
                          )
                        }
                        sx={{ minWidth: 220 }}
                      >
                        {ITEM_VALUE_TYPES.map((option) => (
                          <MenuItem key={option.value} value={option.value}>{option.label}</MenuItem>
                        ))}
                      </TextField>
                      <IconButton color="error" onClick={() => setNewItems((current) => current.filter((_, currentIndex) => currentIndex !== index))}>
                        <DeleteOutlineIcon />
                      </IconButton>
                    </Stack>
                  </Stack>
                  <Box
                    sx={{
                      display: "grid",
                      gap: 1.5,
                      gridTemplateColumns: { xs: "minmax(0, 1fr)", md: "repeat(2, minmax(0, 1fr))" }
                    }}
                  >
                    {columns.map((column) => (
                      <NewItemField
                        key={`${column.columnKey}-${index}`}
                        column={column}
                        item={item}
                        itemIndex={index}
                        existingItems={existingItems}
                        newItems={newItems}
                        setNewItems={setNewItems}
                      />
                    ))}
                  </Box>
                </Stack>
              </Paper>
            ))}
            {newItems.length === 0 && (
              <Alert severity="info">No new rows yet.</Alert>
            )}
          </Stack>
        </Paper>
      </Stack>
    </Box>
  );
}
