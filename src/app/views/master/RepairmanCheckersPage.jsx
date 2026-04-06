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
  useCreateRepairmanChecker,
  useDeleteRepairmanChecker,
  useRepairmanCheckers,
  useUpdateRepairmanChecker
} from "app/hooks/useChecksheets";
import { useUserOptions } from "app/hooks/useUsers";

const LEVEL_OPTIONS = [
  { value: "assy", label: "ASSY" },
  { value: "qa", label: "QA" },
  { value: "mta", label: "MTA / Coordinator" }
];

function RepairmanCheckerDialog({ open, mode, initialData, userOptions, onClose, onSubmit, isPending }) {
  const [form, setForm] = useState({
    userId: initialData?.userId ?? "",
    checkerLevel: initialData?.checkerLevel ?? "assy",
    isActive: initialData?.isActive ?? true
  });

  useEffect(() => {
    setForm({
      userId: initialData?.userId ?? "",
      checkerLevel: initialData?.checkerLevel ?? "assy",
      isActive: initialData?.isActive ?? true
    });
  }, [initialData]);

  return (
    <Dialog open={open} onClose={isPending ? undefined : onClose} fullWidth maxWidth="sm">
      <DialogTitle>{mode === "edit" ? "Edit Repairman Checker" : "Create Repairman Checker"}</DialogTitle>
      <DialogContent dividers>
        <Stack spacing={2}>
          <TextField
            select
            label="User"
            value={form.userId}
            onChange={(event) => setForm((current) => ({ ...current, userId: Number(event.target.value) }))}
          >
            {userOptions.map((user) => (
              <MenuItem key={user.userId} value={user.userId}>
                {user.fullName || user.username} ({user.username})
              </MenuItem>
            ))}
          </TextField>
          <TextField
            select
            label="Checker Level"
            value={form.checkerLevel}
            onChange={(event) => setForm((current) => ({ ...current, checkerLevel: event.target.value }))}
          >
            {LEVEL_OPTIONS.map((option) => (
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
          disabled={isPending || !form.userId || !form.checkerLevel}
          onClick={() => onSubmit(form)}
        >
          {isPending ? "Saving..." : "Save"}
        </Button>
      </DialogActions>
    </Dialog>
  );
}

export default function RepairmanCheckersPage() {
  const [dialogState, setDialogState] = useState({ open: false, mode: "create", data: null });
  const [deleteTarget, setDeleteTarget] = useState(null);
  const [page, setPage] = useState(1);
  const [pageSize, setPageSize] = useState(10);
  const { data, isLoading, isError, error, isFetching } = useRepairmanCheckers({ page, pageSize });
  const checkers = useMemo(() => data?.items ?? [], [data?.items]);
  const totalCount = data?.totalCount ?? 0;
  const { data: users = [] } = useUserOptions({ top: 200 });
  const createChecker = useCreateRepairmanChecker();
  const updateChecker = useUpdateRepairmanChecker(dialogState.data?.id);
  const deleteChecker = useDeleteRepairmanChecker();

  const columns = useMemo(
    () => [
      {
        id: "user",
        header: "User",
        cell: ({ row }) => (
          <>
            <Typography fontWeight={600}>{row.original.fullName || row.original.username}</Typography>
            <Typography variant="caption" color="text.secondary">{row.original.username}</Typography>
          </>
        )
      },
      {
        accessorKey: "email",
        header: "Email"
      },
      {
        id: "level",
        header: "Level",
        cell: ({ row }) => row.original.checkerLevel?.toUpperCase?.() || "-"
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
    data: checkers,
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

  if (isError) {
    return <Box sx={{ p: 3 }}><Alert severity="error">{error.message}</Alert></Box>;
  }

  return (
    <Box sx={{ p: 3 }}>
      <Stack spacing={3}>
        <Stack direction={{ xs: "column", md: "row" }} justifyContent="space-between" spacing={2}>
          <Box>
            <Typography variant="h5" fontWeight={700}>Repairman Checker Master</Typography>
            <Typography variant="body2" color="text.secondary">
              Register which users can approve repair records at ASSY, QA, and MTA coordinator levels.
            </Typography>
          </Box>
          <Button variant="contained" startIcon={<AddIcon />} onClick={() => setDialogState({ open: true, mode: "create", data: null })}>
            Add Checker
          </Button>
        </Stack>

        <Box>
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
                {isLoading ? (
                  <TableRow>
                    <TableCell colSpan={columns.length} align="center" sx={{ py: 6, px: 3 }}>
                      Loading repairman checkers...
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
                      No repairman checker registrations found.
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
        </Box>
      </Stack>

      <RepairmanCheckerDialog
        open={dialogState.open}
        mode={dialogState.mode}
        initialData={dialogState.data}
        userOptions={users}
        isPending={createChecker.isPending || updateChecker.isPending}
        onClose={() => setDialogState({ open: false, mode: "create", data: null })}
        onSubmit={(payload) => {
          const action = dialogState.mode === "edit"
            ? updateChecker.mutateAsync(payload)
            : createChecker.mutateAsync(payload);

          action.then(() => setDialogState({ open: false, mode: "create", data: null }));
        }}
      />

      <ConfirmationDialog
        open={!!deleteTarget}
        title="Delete Repairman Checker"
        text={`Delete "${deleteTarget?.name}" from Repairman Checker master?`}
        confirmText="Delete"
        confirmColor="error"
        isLoading={deleteChecker.isPending}
        onConfirmDialogClose={() => setDeleteTarget(null)}
        onYesClick={() => deleteChecker.mutate(deleteTarget.id, { onSuccess: () => setDeleteTarget(null) })}
      />
    </Box>
  );
}
