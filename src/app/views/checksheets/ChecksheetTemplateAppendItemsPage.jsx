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
  Typography
} from "@mui/material";
import AddIcon from "@mui/icons-material/Add";
import CloudUploadIcon from "@mui/icons-material/CloudUpload";
import DeleteOutlineIcon from "@mui/icons-material/DeleteOutline";
import SaveOutlinedIcon from "@mui/icons-material/SaveOutlined";
import useAuth from "app/hooks/useAuth";
import {
  useAppendChecksheetTemplateItems,
  useChecksheetSubmission,
  useUploadChecksheetTemplateImage
} from "app/hooks/useChecksheets";

const ITEM_VALUE_TYPES = [
  { value: "fixed", label: "Fixed (OK/NG/FIX)" },
  { value: "free_text", label: "Free Text" },
  { value: "number", label: "Number" },
  { value: "jig_no_check", label: "Jig No Check" }
];

function createItemFromColumns(columns, sortOrder) {
  const next = { sortOrder, valueType: "fixed" };
  columns.forEach((column) => {
    next[column.columnKey] = column.columnKey === "itemNo" ? String(sortOrder + 1) : "";
  });
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

function getColumnImageOptions(existingItems, newItems, columnKey) {
  return [
    ...new Set(
      [...existingItems, ...newItems]
        .map((item) => String(item?.data?.[columnKey] ?? item?.[columnKey] ?? "").trim())
        .filter(Boolean)
    )
  ];
}

function ReadOnlyCell({ column, value }) {
  if (column.columnType === "image") {
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

function NewItemField({ column, item, itemIndex, existingItems, newItems, setNewItems }) {
  const uploadMutation = useUploadChecksheetTemplateImage();
  const value = item[column.columnKey] ?? "";

  const updateValue = (nextValue) => {
    setNewItems((current) =>
      current.map((currentItem, currentIndex) =>
        currentIndex === itemIndex ? { ...currentItem, [column.columnKey]: nextValue } : currentItem
      )
    );
  };

  if (column.columnType !== "image") {
    return (
      <TextField
        label={column.label}
        value={value}
        multiline={column.columnType === "textarea"}
        minRows={column.columnType === "textarea" ? 2 : undefined}
        onChange={(event) => updateValue(event.target.value)}
        size="small"
        fullWidth
      />
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
      <Typography variant="caption" color="text.secondary">
        {column.label}
      </Typography>
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
  const appendMutation = useAppendChecksheetTemplateItems(template?.id);
  const isDraft = submission?.status === "draft";
  const isOwner = Number(user?.id ?? 0) === Number(submission?.createdByUserId ?? 0);
  const canAppend = !!template?.id && isDraft && isOwner;

  const addRow = () => {
    setNewItems((current) => [...current, createItemFromColumns(columns, maxSortOrder + current.length + 1)]);
  };

  const handleSave = async () => {
    if (!canAppend || newItems.length === 0) return;

    await appendMutation.mutateAsync({
      items: newItems.map((item, index) => {
        const data = {};
        columns.forEach((column) => {
          data[column.columnKey] = item[column.columnKey] ?? "";
        });
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
            <Table size="small" sx={{ tableLayout: "auto", minWidth: Math.max(720, columns.length * 180) }}>
              <TableHead>
                <TableRow>
                  {columns.map((column) => (
                    <TableCell key={column.columnKey} sx={{ fontWeight: 700, verticalAlign: "middle" }}>
                      {column.label}
                    </TableCell>
                  ))}
                  <TableCell sx={{ fontWeight: 700, verticalAlign: "middle" }}>Answer Type</TableCell>
                </TableRow>
              </TableHead>
              <TableBody>
                {existingItems.map((item) => (
                  <TableRow key={item.id}>
                    {columns.map((column) => (
                      <TableCell key={column.columnKey} sx={{ verticalAlign: "middle" }}>
                        <ReadOnlyCell column={column} value={item.data?.[column.columnKey]} />
                      </TableCell>
                    ))}
                    <TableCell sx={{ verticalAlign: "middle" }}>{item.valueType}</TableCell>
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
