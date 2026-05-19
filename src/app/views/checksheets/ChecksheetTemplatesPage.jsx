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
  Typography
} from "@mui/material";
import { flexRender, getCoreRowModel, useReactTable } from "@tanstack/react-table";
import AddIcon from "@mui/icons-material/Add";
import DeleteOutlineIcon from "@mui/icons-material/DeleteOutline";
import EditOutlinedIcon from "@mui/icons-material/EditOutlined";
import { authRoles } from "app/auth/authRoles";
import useAuth from "app/hooks/useAuth";
import { ConfirmationDialog } from "app/components";
import {
  useChecksheetTemplate,
  useChecksheetTemplates,
  useCreateChecksheetTemplate,
  useDeleteChecksheetTemplate,
  useUpdateChecksheetTemplate
} from "app/hooks/useChecksheets";

const COLUMN_TYPES = [
  { value: "text", label: "Text" },
  { value: "textarea", label: "Textarea" }
];

const ITEM_VALUE_TYPES = [
  { value: "fixed", label: "Fixed (OK/NG/FIX)" },
  { value: "free_text", label: "Free Text" },
  { value: "number", label: "Number" }
];

const CHECKSHEET_MODES = [
  { value: "daily", label: "Daily" },
  { value: "regular", label: "Regular" }
];

const INSPECTION_ENTRY_MODES = [
  { value: "date", label: "Date" },
  { value: "board", label: "Board Code" }
];

function blankColumn(sortOrder) {
  return {
    columnKey: `column_${sortOrder + 1}`,
    label: "",
    columnType: "text",
    isRequired: false,
    enableRowSpan: false,
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

  return JSON.stringify({
    ...baseOptions,
    enableRowSpan: column.enableRowSpan ?? false
  });
}

function normalizeColumnType(columnType) {
  return COLUMN_TYPES.some((option) => option.value === columnType) ? columnType : "text";
}

function syncItemKeys(items, previousKey, nextKey) {
  if (!previousKey || previousKey === nextKey) {
    return items;
  }

  return items.map((item) => {
    const nextItem = { ...item };
    nextItem[nextKey] = item[previousKey] ?? "";
    delete nextItem[previousKey];
    return nextItem;
  });
}

function createItemFromColumns(columns, sortOrder) {
  const next = { sortOrder, valueType: "fixed" };
  columns.forEach((column, index) => {
    next[column.columnKey] = column.columnKey === "itemNo" ? String(sortOrder + 1) : index === 1 ? "" : "";
  });
  return next;
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
      { columnKey: "itemNo", label: "No.", columnType: "text", isRequired: true, enableRowSpan: false, sortOrder: 0, optionsJson: "" },
      { columnKey: "itemName", label: "Inspection Item", columnType: "textarea", isRequired: true, enableRowSpan: false, sortOrder: 1, optionsJson: "" },
      { columnKey: "method", label: "Method", columnType: "textarea", isRequired: false, enableRowSpan: false, sortOrder: 2, optionsJson: "" }
    ];

    return {
      name: "",
      checksheetMode: "daily",
      inspectionEntryMode: "date",
      description: "",
      isActive: true,
      columns,
      items: [createItemFromColumns(columns, 0)],
      dailyApprovalSteps: [blankDailyApprovalStep(1)],
      regularApprovalSteps: [blankRegularApprovalStep(1)]
    };
  }

  return {
    name: template.name ?? "",
    checksheetMode: template.checksheetMode ?? "daily",
    inspectionEntryMode: template.inspectionEntryMode ?? "date",
    description: template.description ?? "",
    isActive: template.isActive ?? true,
    columns: (template.columns ?? []).map((column, index) => ({
      columnKey: column.columnKey,
      label: column.label,
      columnType: normalizeColumnType(column.columnType),
      isRequired: column.isRequired,
      enableRowSpan: column.enableRowSpan ?? parseColumnOptions(column.optionsJson).enableRowSpan ?? false,
      sortOrder: index,
      optionsJson: column.optionsJson ?? ""
    })),
    items: (template.items ?? []).map((item, index) => ({
      sortOrder: index,
      valueType: item.valueType ?? "fixed",
      ...item.data
    })),
    dailyApprovalSteps: (template.dailyApprovalSteps?.length
      ? template.dailyApprovalSteps
      : [blankDailyApprovalStep(1)]
    ).map((step, index) => ({
      stepName: step.stepName ?? "",
      stepOrder: index + 1,
      approverUserIds: getApproverUserIds(step)
    })),
    regularApprovalSteps: (template.regularApprovalSteps?.length
      ? template.regularApprovalSteps
      : [blankRegularApprovalStep(1)]
    ).map((step, index) => ({
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

  useEffect(() => {
    if (!isEnabled) return;
    setForm(buildInitialForm(detailQuery.data ?? null));
  }, [isEnabled, detailQuery.data]);

  const mutation = isEdit ? updateMutation : createMutation;
  const activeApprovalSteps = form.checksheetMode === "regular" ? form.regularApprovalSteps : form.dailyApprovalSteps;

  const handleClose = () => {
    if (mutation.isPending) return;
    onClose();
  };

  const handleSubmit = async () => {
    const payload = {
      name: form.name.trim(),
      checksheetMode: form.checksheetMode,
      inspectionEntryMode: form.inspectionEntryMode,
      description: form.description.trim() || null,
      isActive: form.isActive,
      columns: form.columns.map((column, index) => ({
        ...column,
        columnKey: normalizeColumnKey(column.label, index),
        label: column.label.trim(),
        sortOrder: index,
        enableRowSpan: column.enableRowSpan ?? false,
        optionsJson: serializeColumnOptions(column)
      })),
      items: form.items.map((item, index) => {
        const data = {};
        form.columns.forEach((column) => {
          data[column.columnKey] = item[column.columnKey] ?? "";
        });
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
    form.items.length > 0;

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
      md: "minmax(220px, 1.4fr) minmax(150px, 0.9fr) minmax(110px, 0.7fr) minmax(130px, 0.8fr) auto"
    },
    alignItems: "start"
  };

  const itemHeaderSx = {
    display: "grid",
    gap: 1.5,
    gridTemplateColumns: { xs: "minmax(0, 1fr)", md: "minmax(0, 1fr) auto" },
    alignItems: "center"
  };

  const itemFieldsGridSx = {
    display: "grid",
    gap: 1.5,
    gridTemplateColumns: { xs: "minmax(0, 1fr)", md: "repeat(2, minmax(0, 1fr))" },
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
              onChange={(event) => setForm((current) => ({ ...current, inspectionEntryMode: event.target.value }))}
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
                          const nextKey = normalizeColumnKey(nextLabel, index);

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
              <Typography variant="h6">Template Items</Typography>
              <Button size="small" startIcon={<AddIcon />} onClick={() => setForm((current) => ({ ...current, items: [...current.items, createItemFromColumns(current.columns, current.items.length)] }))}>Add Item</Button>
            </Stack>
            <Stack spacing={1.5}>
              {form.items.map((item, index) => (
                <Paper key={index} variant="outlined" sx={{ p: 2 }}>
                  <Stack spacing={1.5}>
                    <Box sx={itemHeaderSx}>
                      <Typography variant="subtitle2">Item #{index + 1}</Typography>
                      <Stack direction="row" spacing={1} alignItems="center">
                        <TextField
                          select
                          label="Answer Type"
                          value={item.valueType ?? "fixed"}
                          onChange={(event) =>
                            setForm((current) => ({
                              ...current,
                              items: current.items.map((currentItem, itemIndex) =>
                                itemIndex === index ? { ...currentItem, valueType: event.target.value } : currentItem
                              )
                            }))
                          }
                          sx={{ minWidth: 220 }}
                        >
                          {ITEM_VALUE_TYPES.map((option) => (
                            <MenuItem key={option.value} value={option.value}>{option.label}</MenuItem>
                          ))}
                        </TextField>
                        <IconButton color="error" disabled={form.items.length <= 1} onClick={() => setForm((current) => ({ ...current, items: current.items.filter((_, itemIndex) => itemIndex !== index) }))}>
                          <DeleteOutlineIcon />
                        </IconButton>
                      </Stack>
                    </Box>
                    <Box sx={itemFieldsGridSx}>
                      {form.columns.map((column) => (
                        <TextField
                          key={`${column.columnKey}-${index}`}
                          label={column.label}
                          multiline={column.columnType === "textarea"}
                          minRows={column.columnType === "textarea" ? 2 : undefined}
                          value={item[column.columnKey] ?? ""}
                          onChange={(event) =>
                            setForm((current) => ({
                              ...current,
                              items: current.items.map((currentItem, itemIndex) => itemIndex === index ? { ...currentItem, [column.columnKey]: event.target.value } : currentItem)
                            }))
                          }
                          fullWidth
                        />
                      ))}
                    </Box>
                  </Stack>
                </Paper>
              ))}
            </Stack>
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
                      disabled={activeApprovalSteps.length <= 1}
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
            label={row.original.inspectionEntryMode === "board" ? "Board Code" : "Date"}
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
        <Stack direction={{ xs: "column", md: "row" }} justifyContent="space-between" spacing={2}>
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
