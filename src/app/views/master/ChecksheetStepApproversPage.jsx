import { useEffect, useMemo, useState } from "react";
import {
  Alert,
  Box,
  Button,
  Dialog,
  DialogActions,
  DialogContent,
  DialogTitle,
  IconButton,
  MenuItem,
  Paper,
  Stack,
  Switch,
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
import AddIcon from "@mui/icons-material/Add";
import DeleteOutlineIcon from "@mui/icons-material/DeleteOutline";
import EditOutlinedIcon from "@mui/icons-material/EditOutlined";
import { flexRender, getCoreRowModel, useReactTable } from "@tanstack/react-table";
import { ConfirmationDialog } from "app/components";
import {
  useChecksheetStepApprovers,
  useChecksheetMasters,
  useCreateChecksheetStepApprover,
  useDeleteChecksheetStepApprover,
  useUpdateChecksheetStepApprover
} from "app/hooks/useChecksheets";
import { useUserOptions } from "app/hooks/useUsers";

const STEP_OPTIONS = Array.from({ length: 10 }, (_, index) => ({
  value: index + 1,
  label: `Step ${index + 1}`
}));

function getUserCode(user) {
  return user?.employeeCode || user?.username || "-";
}

function getUserDisplayName(user) {
  const userCode = getUserCode(user);
  if (user?.fullName || user?.employeeName) {
    return `${userCode} - ${user.fullName || user.employeeName}`;
  }

  return userCode;
}

function getChecksheetMasterDisplayName(master) {
  if (!master) return "";
  return `${master.processCode} - ${master.processName} - ${master.checksheetName}`;
}

function StepApproverDialog({ open, mode, initialData, selectedMaster, userOptions, onClose, onSubmit, isPending }) {
  const [form, setForm] = useState({
    checksheetMasterId: initialData?.checksheetMasterId ?? selectedMaster?.id ?? "",
    userId: initialData?.userId ?? "",
    stepOrder: initialData?.stepOrder ?? 1,
    isActive: initialData?.isActive ?? true
  });

  useEffect(() => {
    setForm({
      checksheetMasterId: initialData?.checksheetMasterId ?? selectedMaster?.id ?? "",
      userId: initialData?.userId ?? "",
      stepOrder: initialData?.stepOrder ?? 1,
      isActive: initialData?.isActive ?? true
    });
  }, [initialData, selectedMaster]);

  return (
    <Dialog open={open} onClose={isPending ? undefined : onClose} fullWidth maxWidth="sm">
      <DialogTitle>{mode === "edit" ? "Edit Checksheet Approver" : "Create Checksheet Approver"}</DialogTitle>
      <DialogContent dividers>
        <Stack spacing={2}>
          <TextField
            label="Checksheet Master"
            value={getChecksheetMasterDisplayName(selectedMaster)}
            InputProps={{ readOnly: true }}
          />
          <TextField
            select
            label="User"
            value={form.userId}
            onChange={(event) => setForm((current) => ({ ...current, userId: Number(event.target.value) }))}
          >
            {userOptions.map((user) => (
              <MenuItem key={user.userId} value={user.userId}>
                {getUserDisplayName(user)}
              </MenuItem>
            ))}
          </TextField>
          <TextField
            select
            label="Allowed Step"
            value={form.stepOrder}
            onChange={(event) => setForm((current) => ({ ...current, stepOrder: Number(event.target.value) }))}
          >
            {STEP_OPTIONS.map((option) => (
              <MenuItem key={option.value} value={option.value}>
                {option.label}
              </MenuItem>
            ))}
          </TextField>
          <Stack direction="row" spacing={1} alignItems="center">
            <Switch checked={form.isActive} onChange={(event) => setForm((current) => ({ ...current, isActive: event.target.checked }))} />
            <Typography>{form.isActive ? "Active" : "Inactive"}</Typography>
          </Stack>
        </Stack>
      </DialogContent>
      <DialogActions>
        <Button onClick={onClose} disabled={isPending}>Cancel</Button>
        <Button
          variant="contained"
          disabled={isPending || !form.checksheetMasterId || !form.userId || !form.stepOrder}
          onClick={() => onSubmit(form)}
        >
          {isPending ? "Saving..." : "Save"}
        </Button>
      </DialogActions>
    </Dialog>
  );
}

export default function ChecksheetStepApproversPage() {
  const [selectedMasterId, setSelectedMasterId] = useState("");
  const [dialogState, setDialogState] = useState({ open: false, mode: "create", data: null });
  const [deleteTarget, setDeleteTarget] = useState(null);
  const [filters, setFilters] = useState({ stepOrder: "" });
  const [page, setPage] = useState(1);
  const [pageSize, setPageSize] = useState(10);
  const { data: checksheetMasters = [], isLoading: isLoadingMasters, isError: isMastersError, error: mastersError } = useChecksheetMasters();
  const selectedMaster = useMemo(
    () => checksheetMasters.find((master) => Number(master.id) === Number(selectedMasterId)) ?? null,
    [checksheetMasters, selectedMasterId]
  );
  const { data, isLoading, isError, error } = useChecksheetStepApprovers(
    {
      page,
      pageSize,
      checksheetMasterId: selectedMasterId || undefined,
      stepOrder: filters.stepOrder || undefined
    },
    { enabled: !!selectedMasterId }
  );
  const approvers = useMemo(() => data?.items ?? [], [data?.items]);
  const totalCount = data?.totalCount ?? 0;
  const { data: users = [] } = useUserOptions({ top: 200 });
  const createApprover = useCreateChecksheetStepApprover();
  const updateApprover = useUpdateChecksheetStepApprover(dialogState.data?.id);
  const deleteApprover = useDeleteChecksheetStepApprover();

  useEffect(() => {
    setPage(1);
  }, [filters.stepOrder, selectedMasterId]);

  const columns = useMemo(
    () => [
      {
        id: "user",
        header: "User",
        cell: ({ row }) => (
          <>
            <Typography fontWeight={600}>{getUserCode(row.original)}</Typography>
            <Typography variant="caption" color="text.secondary">{row.original.fullName || row.original.username}</Typography>
          </>
        )
      },
      {
        accessorKey: "email",
        header: "Email"
      },
      {
        id: "stepOrder",
        header: "Allowed Step",
        cell: ({ row }) => `Step ${row.original.stepOrder}`
      },
      {
        id: "status",
        header: "Status",
        cell: ({ row }) => (row.original.isActive ? "Active" : "Inactive")
      },
      {
        id: "action",
        header: () => <Box sx={{ textAlign: "right", pr: 1.5 }}>Action</Box>,
        cell: ({ row }) => (
          <Box sx={{ textAlign: "right", display: "flex", justifyContent: "flex-end", gap: 1, pr: 1.5 }}>
            <IconButton onClick={() => setDialogState({ open: true, mode: "edit", data: row.original })}>
              <EditOutlinedIcon />
            </IconButton>
            <IconButton color="error" onClick={() => setDeleteTarget({ id: row.original.id, name: row.original.fullName || row.original.username })}>
              <DeleteOutlineIcon />
            </IconButton>
          </Box>
        )
      }
    ],
    []
  );

  const table = useReactTable({
    data: approvers,
    columns,
    getCoreRowModel: getCoreRowModel(),
    manualPagination: true,
    rowCount: totalCount,
    state: {
      pagination: {
        pageIndex: Math.max(0, page - 1),
        pageSize
      }
    }
  });

  if (isError || isMastersError) {
    return <Box sx={{ p: 3 }}><Alert severity="error">{error?.message || mastersError?.message}</Alert></Box>;
  }

  return (
    <Box sx={{ p: 3 }}>
      <Stack spacing={3}>
        <Stack direction={{ xs: "column", md: "row" }} justifyContent="space-between" alignItems={{ xs: "stretch", md: "flex-start" }} spacing={2}>
          <Box>
            <Typography variant="h5" fontWeight={700}>Checksheet Approver Master</Typography>
            <Typography variant="body2" color="text.secondary">
              Select a Checksheet Master, then register which users can approve each daily or regular inspection step.
            </Typography>
          </Box>
          <Button
            variant="contained"
            startIcon={<AddIcon />}
            disabled={!selectedMasterId}
            onClick={() => setDialogState({ open: true, mode: "create", data: null })}
          >
            Add Approver
          </Button>
        </Stack>

        <Paper variant="outlined" sx={{ p: 2 }}>
          <Stack direction={{ xs: "column", md: "row" }} spacing={2}>
            <TextField
              select
              required
              size="small"
              label="Checksheet Master"
              value={selectedMasterId}
              disabled={isLoadingMasters}
              onChange={(event) => {
                setSelectedMasterId(event.target.value ? Number(event.target.value) : "");
                setFilters({ stepOrder: "" });
              }}
              sx={{ minWidth: 360, maxWidth: 560 }}
            >
              <MenuItem value="">Select Checksheet Master</MenuItem>
              {checksheetMasters.map((master) => (
                <MenuItem key={master.id} value={master.id}>
                  {getChecksheetMasterDisplayName(master)}
                </MenuItem>
              ))}
            </TextField>
            <TextField
              select
              size="small"
              label="Allowed Step"
              value={filters.stepOrder}
              disabled={!selectedMasterId}
              onChange={(event) => setFilters((current) => ({ ...current, stepOrder: event.target.value }))}
              sx={{ minWidth: 220, maxWidth: 280 }}
            >
              <MenuItem value="">All</MenuItem>
              {STEP_OPTIONS.map((option) => (
                <MenuItem key={option.value} value={option.value}>
                  {option.label}
                </MenuItem>
              ))}
            </TextField>
          </Stack>
        </Paper>

        <TableContainer component={Paper} variant="outlined">
          <Table size="small">
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
                        sx={{ pl: isFirstColumn ? 3 : 2, pr: isLastColumn ? 3 : 2 }}
                      >
                        {header.isPlaceholder ? null : flexRender(header.column.columnDef.header, header.getContext())}
                      </TableCell>
                    );
                  })}
                </TableRow>
              ))}
            </TableHead>
            <TableBody>
              {!selectedMasterId ? (
                <TableRow>
                  <TableCell colSpan={columns.length} align="center" sx={{ py: 6, px: 3 }}>
                    Select a Checksheet Master to manage its approvers.
                  </TableCell>
                </TableRow>
              ) : isLoading ? (
                <TableRow>
                  <TableCell colSpan={columns.length} align="center" sx={{ py: 6, px: 3 }}>
                    Loading checksheet approvers...
                  </TableCell>
                </TableRow>
              ) : table.getRowModel().rows.length > 0 ? (
                table.getRowModel().rows.map((row) => (
                  <TableRow key={row.id} hover>
                    {row.getVisibleCells().map((cell, index) => {
                      const isFirstColumn = index === 0;
                      const isLastColumn = index === row.getVisibleCells().length - 1;

                      return (
                        <TableCell
                          key={cell.id}
                          align={isLastColumn ? "right" : "left"}
                          sx={{ pl: isFirstColumn ? 3 : 2, pr: isLastColumn ? 3 : 2 }}
                        >
                          {flexRender(cell.column.columnDef.cell, cell.getContext())}
                        </TableCell>
                      );
                    })}
                  </TableRow>
                ))
              ) : (
                <TableRow>
                  <TableCell colSpan={columns.length} align="center" sx={{ py: 6, px: 3 }}>
                    No checksheet approver registrations found.
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
      </Stack>

      <StepApproverDialog
        open={dialogState.open}
        mode={dialogState.mode}
        initialData={dialogState.data}
        selectedMaster={selectedMaster}
        userOptions={users}
        isPending={createApprover.isPending || updateApprover.isPending}
        onClose={() => setDialogState({ open: false, mode: "create", data: null })}
        onSubmit={(payload) => {
          const action = dialogState.mode === "edit"
            ? updateApprover.mutateAsync(payload)
            : createApprover.mutateAsync(payload);

          action.then(() => setDialogState({ open: false, mode: "create", data: null }));
        }}
      />

      <ConfirmationDialog
        open={!!deleteTarget}
        title="Delete Checksheet Approver"
        text={`Delete "${deleteTarget?.name}" from Checksheet Approver master?`}
        confirmText="Delete"
        confirmColor="error"
        isLoading={deleteApprover.isPending}
        onConfirmDialogClose={() => setDeleteTarget(null)}
        onYesClick={() => deleteApprover.mutate(deleteTarget.id, { onSuccess: () => setDeleteTarget(null) })}
      />
    </Box>
  );
}
