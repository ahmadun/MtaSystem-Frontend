import { useEffect, useMemo, useState } from "react";
import {
  Alert,
  Autocomplete,
  Box,
  Button,
  Card,
  CardContent,
  Chip,
  Dialog,
  DialogActions,
  DialogContent,
  DialogTitle,
  Divider,
  InputAdornment,
  IconButton,
  MenuItem,
  Paper,
  Skeleton,
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
import { alpha } from "@mui/material/styles";
import { flexRender, getCoreRowModel, useReactTable } from "@tanstack/react-table";
import AddIcon from "@mui/icons-material/Add";
import DeleteOutlineIcon from "@mui/icons-material/DeleteOutline";
import SearchRoundedIcon from "@mui/icons-material/SearchRounded";
import useAuth from "app/hooks/useAuth";
import { useCreateApprovalTemplate, useApprovalTemplates } from "app/hooks/useChecksheets";
import { useUserOptions } from "app/hooks/useUsers";

const DEFAULT_STEP = { stepName: "", stepOrder: 1, approvalMode: "any_one", approverUserIds: [] };

function createInitialForm() {
  return {
    name: "",
    description: "",
    steps: [{ ...DEFAULT_STEP }]
  };
}

function formatDateTime(value) {
  if (!value) return "-";

  return new Date(value).toLocaleString("en-US", {
    year: "numeric",
    month: "short",
    day: "numeric",
    hour: "2-digit",
    minute: "2-digit"
  });
}

function getUserOptionLabel(option) {
  if (!option) return "";
  const userCode = option.employeeCode || option.username;
  if (option.employeeName) return `${userCode} - ${option.employeeName}`;
  if (option.email) return `${userCode} (${option.email})`;
  return option.username || option.label || "";
}

function CreateApprovalTemplateDialog({ open, onClose }) {
  const createMutation = useCreateApprovalTemplate();
  const { data: userOptions = [], isLoading: isUsersLoading } = useUserOptions({ Top: 200 }, { enabled: open });
  const [form, setForm] = useState(createInitialForm);

  useEffect(() => {
    if (open) {
      setForm(createInitialForm());
    }
  }, [open]);

  const stepCount = form.steps.length;
  const totalApprovers = useMemo(
    () => form.steps.reduce((count, step) => count + (step.approverUserIds?.length ?? 0), 0),
    [form.steps]
  );

  const canSubmit =
    form.name.trim().length > 0 &&
    form.steps.length > 0 &&
    form.steps.every((step) => step.stepName.trim() && (step.approverUserIds?.length ?? 0) > 0);

  const handleStepChange = (index, nextStep) => {
    setForm((current) => ({
      ...current,
      steps: current.steps.map((item, itemIndex) => (itemIndex === index ? { ...item, ...nextStep } : item))
    }));
  };

  const handleAddStep = () => {
    setForm((current) => ({
      ...current,
      steps: [...current.steps, { ...DEFAULT_STEP, stepOrder: current.steps.length + 1 }]
    }));
  };

  const handleRemoveStep = (index) => {
    setForm((current) => ({
      ...current,
      steps: current.steps
        .filter((_, itemIndex) => itemIndex !== index)
        .map((step, itemIndex) => ({ ...step, stepOrder: itemIndex + 1 }))
    }));
  };

  const handleSubmit = async () => {
    await createMutation.mutateAsync({
      name: form.name.trim(),
      description: form.description.trim() || null,
      steps: form.steps.map((step, index) => ({
        stepName: step.stepName.trim(),
        stepOrder: index + 1,
        approvalMode: step.approvalMode,
        approverUserIds: step.approverUserIds.map(Number)
      }))
    });
    onClose();
  };

  return (
    <Dialog open={open} onClose={createMutation.isPending ? undefined : onClose} fullWidth maxWidth="lg">
      <DialogTitle>Create Approval Template</DialogTitle>
      <DialogContent dividers sx={{ p: 0 }}>
        <Stack spacing={0}>
          <Box sx={{ px: 3, py: 2.5, bgcolor: (theme) => alpha(theme.palette.primary.main, 0.04) }}>
            <Stack spacing={1}>
              <Stack direction="row" spacing={1} flexWrap="wrap" useFlexGap>
                <Chip size="small" label={`${stepCount} step${stepCount === 1 ? "" : "s"}`} />
                <Chip size="small" label={`${totalApprovers} approver assignment${totalApprovers === 1 ? "" : "s"}`} variant="outlined" />
              </Stack>
            </Stack>
          </Box>

          <Stack spacing={3} sx={{ p: 3 }}>
            <Paper variant="outlined" sx={{ borderRadius: 3, p: 2.5 }}>
              <Stack spacing={2}>
                <Typography variant="h6" fontWeight={700}>
                  Template Details
                </Typography>
                <Stack direction={{ xs: "column", md: "row" }} spacing={2}>
                  <TextField
                    label="Template Name"
                    placeholder="Month-end approval"
                    value={form.name}
                    onChange={(event) => setForm((current) => ({ ...current, name: event.target.value }))}
                    fullWidth
                  />
                  <TextField
                    label="Description"
                    placeholder="Used when operators submit the monthly checksheet."
                    value={form.description}
                    onChange={(event) => setForm((current) => ({ ...current, description: event.target.value }))}
                    multiline
                    minRows={2}
                    fullWidth
                  />
                </Stack>
              </Stack>
            </Paper>

            <Paper variant="outlined" sx={{ borderRadius: 3, p: 2.5 }}>
              <Stack spacing={2}>
                <Stack direction={{ xs: "column", sm: "row" }} justifyContent="space-between" spacing={1.5}>
                  <Box>
                    <Typography variant="h6" fontWeight={700}>
                      Approval Steps
                    </Typography>
                    <Typography variant="body2" color="text.secondary" sx={{ mt: 0.5 }}>
                      Keep each step focused so approvers understand exactly where they belong in the chain.
                    </Typography>
                  </Box>
                  <Button startIcon={<AddIcon />} variant="outlined" onClick={handleAddStep}>
                    Add Step
                  </Button>
                </Stack>

                <Stack spacing={2}>
                  {form.steps.map((step, index) => {
                    const selectedApprovers = userOptions.filter((option) => step.approverUserIds.includes(option.userId));

                    return (
                      <Card key={index} variant="outlined" sx={{ borderRadius: 3 }}>
                        <CardContent sx={{ "&:last-child": { pb: 2.5 } }}>
                          <Stack spacing={2}>
                            <Stack direction="row" justifyContent="space-between" alignItems="center" spacing={2}>
                              <Stack direction="row" spacing={1} alignItems="center">
                                <Chip label={`Step ${index + 1}`} color="primary" size="small" />
                                <Typography variant="subtitle1" fontWeight={700}>
                                  {step.stepName.trim() || "Untitled approval step"}
                                </Typography>
                              </Stack>
                              <IconButton color="error" disabled={form.steps.length <= 1} onClick={() => handleRemoveStep(index)}>
                                <DeleteOutlineIcon />
                              </IconButton>
                            </Stack>

                            <Box
                              sx={{
                                display: "grid",
                                gap: 2,
                                gridTemplateColumns: {
                                  xs: "1fr",
                                  md: "minmax(220px, 1.1fr) 180px minmax(260px, 1.4fr)"
                                }
                              }}
                            >
                              <TextField
                                label="Step Name"
                                placeholder="Leader Assy"
                                value={step.stepName}
                                onChange={(event) => handleStepChange(index, { stepName: event.target.value })}
                                fullWidth
                              />
                              <TextField
                                select
                                label="Approval Mode"
                                value={step.approvalMode}
                                onChange={(event) => handleStepChange(index, { approvalMode: event.target.value })}
                                fullWidth
                              >
                                <MenuItem value="any_one">Any One</MenuItem>
                                <MenuItem value="all">All Must Approve</MenuItem>
                              </TextField>
                              <Autocomplete
                                multiple
                                options={userOptions}
                                loading={isUsersLoading}
                                value={selectedApprovers}
                                onChange={(_, options) =>
                                  handleStepChange(index, {
                                    approverUserIds: options.map((option) => option.userId)
                                  })
                                }
                                isOptionEqualToValue={(option, value) => option.userId === value.userId}
                                getOptionLabel={getUserOptionLabel}
                                renderInput={(params) => <TextField {...params} label="Approvers" placeholder="Select approvers" />}
                              />
                            </Box>

                            <Alert severity="info" sx={{ borderRadius: 2 }}>
                              {step.approvalMode === "all"
                                ? "Every selected approver must approve before the request can move forward."
                                : "Any one selected approver can complete this step."}
                            </Alert>
                          </Stack>
                        </CardContent>
                      </Card>
                    );
                  })}
                </Stack>
              </Stack>
            </Paper>
          </Stack>
        </Stack>
      </DialogContent>
      <DialogActions sx={{ px: 3, py: 2 }}>
        <Button onClick={onClose} disabled={createMutation.isPending}>
          Cancel
        </Button>
        <Button variant="contained" onClick={handleSubmit} disabled={createMutation.isPending || !canSubmit}>
          {createMutation.isPending ? "Saving..." : "Create Template"}
        </Button>
      </DialogActions>
    </Dialog>
  );
}

export default function ApprovalTemplatesPage() {
  const { user } = useAuth();
  const canManage = ["SuperAdmin", "Admin"].includes(user?.role);
  const [dialogOpen, setDialogOpen] = useState(false);
  const [page, setPage] = useState(1);
  const [pageSize, setPageSize] = useState(10);
  const [searchInput, setSearchInput] = useState("");
  const [globalFilter, setGlobalFilter] = useState("");

  useEffect(() => {
    const timeoutId = window.setTimeout(() => {
      setPage(1);
      setGlobalFilter(searchInput.trim());
    }, 350);

    return () => window.clearTimeout(timeoutId);
  }, [searchInput]);

  const { data, isLoading, isError, error, isFetching } = useApprovalTemplates({
    page,
    pageSize,
    search: globalFilter || undefined
  });
  const templates = useMemo(() => data?.items ?? [], [data?.items]);
  const totalCount = data?.totalCount ?? 0;

  const columns = useMemo(
    () => [
      {
        id: "template",
        header: "Template",
        cell: ({ row }) => (
          <>
            <Typography fontWeight={700}>{row.original.name}</Typography>
            <Typography variant="body2" color="text.secondary" sx={{ mt: 0.5 }}>
              {row.original.description || "No description provided."}
            </Typography>
          </>
        )
      },
      {
        id: "status",
        header: "Status",
        cell: ({ row }) => (
          <Chip
            size="small"
            label={row.original.isActive ? "Active" : "Inactive"}
            color={row.original.isActive ? "success" : "default"}
            variant={row.original.isActive ? "filled" : "outlined"}
          />
        )
      },
      {
        id: "flow",
        header: "Flow",
        cell: ({ row }) => (
          <Chip
            size="small"
            variant="outlined"
            label={`${row.original.stepCount ?? 0} step${row.original.stepCount === 1 ? "" : "s"}`}
          />
        )
      },
      {
        accessorKey: "updatedAt",
        header: () => <Box sx={{ textAlign: "right", pr: 1 }}>Updated</Box>,
        cell: ({ row }) => <Box sx={{ textAlign: "right", whiteSpace: "nowrap", pr: 1 }}>{formatDateTime(row.original.updatedAt)}</Box>
      }
    ],
    []
  );

  const table = useReactTable({
    data: templates,
    columns,
    getCoreRowModel: getCoreRowModel(),
    manualPagination: true,
    rowCount: totalCount,
    state: {
      globalFilter,
      pagination: {
        pageIndex: Math.max(0, page - 1),
        pageSize
      }
    }
  });

  return (
    <Box sx={{ p: 3 }}>
      <Stack spacing={3}>
        <Stack
          direction={{ xs: "column", md: "row" }}
          justifyContent="space-between"
          spacing={2}
          alignItems={{ xs: "flex-start", md: "center" }}
        >
          <Box>
            <Typography variant="h5" fontWeight={700}>
              Approval Templates
            </Typography>
            <Typography variant="body2" color="text.secondary" sx={{ mt: 0.5 }}>
              Manage reusable approval flows for checksheet submissions so routing stays consistent across teams.
            </Typography>
          </Box>
          <Stack direction="row" spacing={1.25} alignItems="center" flexWrap="wrap" useFlexGap>
            {canManage && (
              <Button variant="contained" startIcon={<AddIcon />} onClick={() => setDialogOpen(true)}>
                New Approval Template
              </Button>
            )}
          </Stack>
        </Stack>

        <Box>
          <Stack spacing={2}>
            <Stack direction={{ xs: "column", sm: "row" }} justifyContent="space-between" spacing={1.5} alignItems={{ xs: "flex-start", sm: "center" }}>

              <Stack direction="row" spacing={1.25} alignItems="center" flexWrap="wrap" useFlexGap>
                <TextField
                  value={searchInput}
                  onChange={(event) => setSearchInput(event.target.value)}
                  placeholder="Search templates"
                  size="small"
                  sx={{ minWidth: { xs: "100%", sm: 500 } }}
                  slotProps={{
                    startAdornment: (
                      <InputAdornment position="start">
                        <SearchRoundedIcon fontSize="small" />
                      </InputAdornment>
                    )
                  }}
                />
                {isFetching && !isLoading ? <Chip size="small" label="Refreshing..." variant="outlined" /> : null}
              </Stack>
            </Stack>

            {isLoading ? (
              <Stack spacing={1.5}>
                {Array.from({ length: 4 }).map((_, index) => (
                  <Skeleton key={index} variant="rounded" height={72} />
                ))}
              </Stack>
            ) : isError ? (
              <Alert severity="error">{error.message}</Alert>
            ) : templates.length === 0 ? (
              <Box
                sx={{
                  py: 6,
                  px: 3,
                  textAlign: "center",
                  borderRadius: 3,
                  border: "1px dashed",
                  borderColor: "divider",
                  bgcolor: "background.default"
                }}
              >
                <Typography variant="h6" fontWeight={700}>
                  {globalFilter ? "No matching approval templates" : "No approval templates yet"}
                </Typography>
                <Typography variant="body2" color="text.secondary" sx={{ mt: 1, maxWidth: 520, mx: "auto" }}>
                  {globalFilter
                    ? `No templates matched "${globalFilter}". Try a different keyword.`
                    : "Create your first template to standardize who approves checksheet submissions and in what order they respond."}
                </Typography>
                {canManage ? (
                  <Button sx={{ mt: 2 }} variant="contained" startIcon={<AddIcon />} onClick={() => setDialogOpen(true)}>
                    {globalFilter ? "Create Template" : "Create First Template"}
                  </Button>
                ) : null}
              </Box>
            ) : (
              <TableContainer component={Paper}>
                <Table>
                  <TableHead>
                    {table.getHeaderGroups().map((headerGroup) => (
                      <TableRow key={headerGroup.id}>
                        {headerGroup.headers.map((header, index) => {
                          const isFirstColumn = index === 0;
                          const isLastColumn = index === headerGroup.headers.length - 1;

                          return (
                            <TableCell
                              key={header.id}
                              align={isLastColumn ? "right" : "left"}
                              sx={{
                                pl: isFirstColumn ? 1 : 2,
                                pr: isLastColumn ? 1 : 2
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

                          return (
                            <TableCell
                              key={cell.id}
                              align={isLastColumn ? "right" : "left"}
                              sx={{
                                py: 2.25,
                                pl: isFirstColumn ? 1 : 2,
                                pr: isLastColumn ? 1 : 2
                              }}
                            >
                              {flexRender(cell.column.columnDef.cell, cell.getContext())}
                            </TableCell>
                          );
                        })}
                      </TableRow>
                    ))}
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
        </Box>
      </Stack>

      {canManage ? <CreateApprovalTemplateDialog open={dialogOpen} onClose={() => setDialogOpen(false)} /> : null}
    </Box>
  );
}
