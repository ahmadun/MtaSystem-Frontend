import { useEffect, useMemo, useState } from "react";
import {
  Alert,
  Autocomplete,
  Box,
  Button,
  Chip,
  Dialog,
  DialogActions,
  DialogContent,
  DialogTitle,
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
  TableSortLabel,
  TextField,
  Typography
} from "@mui/material";
import { flexRender, getCoreRowModel, useReactTable } from "@tanstack/react-table";
import { useNavigate } from "react-router-dom";
import {
  useApproveRepairRecord,
  useChecksheetAreas,
  useChecksheetLines,
  useChecksheetMasters,
  usePendingRepairRecords
} from "app/hooks/useChecksheets";

function formatDateTime(value) {
  if (!value) return "-";

  return new Intl.DateTimeFormat("en-US", {
    year: "numeric",
    month: "short",
    day: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
    hour12: false
  }).format(new Date(value));
}

export default function PendingRepairApprovalsPage() {
  const navigate = useNavigate();
  const approveMutation = useApproveRepairRecord();
  const [target, setTarget] = useState(null);
  const [filters, setFilters] = useState({
    checksheetMasterId: "",
    lineCode: "",
    location: ""
  });
  const [page, setPage] = useState(1);
  const [pageSize, setPageSize] = useState(10);
  const [sorting, setSorting] = useState([{ id: "entryDate", desc: true }]);
  const activeSort = sorting[0];
  const { data: checksheetMasters = [] } = useChecksheetMasters();
  const { data: lines = [] } = useChecksheetLines();
  const { data: areas = [] } = useChecksheetAreas();
  const selectedChecksheetMaster = useMemo(
    () => checksheetMasters.find((item) => String(item.id) === String(filters.checksheetMasterId)) ?? null,
    [checksheetMasters, filters.checksheetMasterId]
  );
  const selectedLine = useMemo(
    () => lines.find((line) => line.lineCode === filters.lineCode) ?? null,
    [filters.lineCode, lines]
  );

  const { data, isLoading, isError, error, isFetching } = usePendingRepairRecords({
    page,
    pageSize,
    sortBy: activeSort?.id,
    sortDirection: activeSort?.desc === false ? "asc" : "desc",
    checksheetMasterId: filters.checksheetMasterId || undefined,
    lineCode: filters.lineCode || undefined,
    location: filters.location || undefined
  });
  const records = useMemo(() => data?.items ?? [], [data?.items]);
  const totalCount = data?.totalCount ?? 0;

  useEffect(() => {
    setPage(1);
  }, [filters.checksheetMasterId, filters.lineCode, filters.location]);

  useEffect(() => {
    setPage(1);
  }, [sorting]);

  const columns = useMemo(
    () => [
      {
        id: "machine",
        enableSorting: false,
        header: "Machine",
        cell: ({ row }) => (
          <Stack spacing={0.5}>
            <Typography fontWeight={600}>{row.original.machineCode}</Typography>
            <Typography variant="caption" color="text.secondary">
              {row.original.location} | {row.original.lineName} | {row.original.inspectionDate} Shift {row.original.shift}
            </Typography>
          </Stack>
        )
      },
      {
        id: "entryDate",
        accessorKey: "createdAt",
        header: "Entry Date",
        cell: ({ getValue }) => (
          <Typography variant="body2" sx={{ whiteSpace: "nowrap" }}>
            {formatDateTime(getValue())}
          </Typography>
        )
      },
      {
        id: "lastUpdate",
        accessorKey: "updatedAt",
        header: "Last Update",
        cell: ({ getValue }) => (
          <Typography variant="body2" sx={{ whiteSpace: "nowrap" }}>
            {formatDateTime(getValue())}
          </Typography>
        )
      },
      {
        id: "repair",
        enableSorting: false,
        header: "Repair",
        cell: ({ row }) => (
          <Stack spacing={0.75}>
            <Typography fontWeight={600}>{row.original.damageDescription}</Typography>
            <Typography variant="body2" color="text.secondary">
              {row.original.repairDescription}
            </Typography>
          </Stack>
        )
      },
      {
        id: "currentApproval",
        enableSorting: false,
        header: "Current Approval",
        cell: ({ row }) => (
          <Chip
            size="small"
            label={row.original.nextPendingLevel?.toUpperCase?.() || "COMPLETED"}
            color={row.original.nextPendingLevel ? "warning" : "success"}
            variant={row.original.nextPendingLevel ? "outlined" : "filled"}
          />
        )
      },
      {
        id: "approvedBy",
        enableSorting: false,
        header: "Approved By",
        cell: ({ row }) => (
          <Stack direction="row" spacing={0.75} useFlexGap flexWrap="wrap" sx={{ minWidth: 240 }}>
            {[
              { label: "Repaired", value: row.original.repairedByName, color: "info" },
              { label: "ASSY", value: row.original.checkedByAssyName, color: "success" },
              { label: "QA", value: row.original.checkedByQaName, color: "success" },
              { label: "MTA", value: row.original.checkedByCoordinatorName, color: "success" }
            ].map((entry) => {
              const isDone = !!entry.value;

              return (
                <Chip
                  key={`${row.original.repairRecordId}-${entry.label}`}
                  size="small"
                  color={isDone ? entry.color : "warning"}
                  variant={isDone ? "outlined" : "filled"}
                  label={`${entry.label}: ${isDone ? entry.value : "Pending"}`}
                  sx={{ maxWidth: "100%" }}
                />
              );
            })}
          </Stack>
        )
      },
      {
        id: "actions",
        enableSorting: false,
        header: () => <Box sx={{ textAlign: "right", pr: 1.5 }}>Actions</Box>,
        cell: ({ row }) => (
          <Stack direction="row" spacing={1} justifyContent="flex-end" sx={{ pr: 1.5 }}>
            <Button onClick={() => navigate(`/checksheets/submissions/${row.original.submissionId}`)}>Open</Button>
            <Button variant="contained" onClick={() => setTarget(row.original)}>
              Approve
            </Button>
          </Stack>
        )
      }
    ],
    [navigate]
  );

  const table = useReactTable({
    data: records,
    columns,
    state: {
      sorting,
      pagination: {
        pageIndex: Math.max(0, page - 1),
        pageSize
      }
    },
    onSortingChange: setSorting,
    manualSorting: true,
    enableSortingRemoval: false,
    getCoreRowModel: getCoreRowModel(),
    manualPagination: true,
    rowCount: totalCount
  });

  return (
    <Box sx={{ p: 3 }}>
      <Stack spacing={3}>
        <Box>
          <Typography variant="h5" fontWeight={700}>
            Pending Repair Approvals
          </Typography>
          <Typography variant="body2" color="text.secondary">
            Review repair records that are not fully approved across ASSY, QA, and MTA coordinator levels.
          </Typography>
        </Box>

        <Paper variant="outlined" sx={{ p: 2.5 }}>
          <Stack spacing={2}>
            <Typography variant="subtitle2" fontWeight={700}>
              Filters
            </Typography>

            <Stack direction="row" spacing={1.5} useFlexGap flexWrap="wrap" alignItems="flex-start">
              <Autocomplete
                options={checksheetMasters}
                value={selectedChecksheetMaster}
                onChange={(_, option) =>
                  setFilters((current) => ({
                    ...current,
                    checksheetMasterId: option?.id ?? ""
                  }))
                }
                isOptionEqualToValue={(option, value) => String(option.id) === String(value.id)}
                getOptionLabel={(option) =>
                  option?.id ? `${option.processCode} - ${option.processName} - ${option.checksheetName}` : ""
                }
                sx={{ minWidth: 420, maxWidth: 560, flexGrow: 1 }}
                renderInput={(params) => <TextField {...params} size="small" label="Checksheet Master" placeholder="All" />}
              />

              <Autocomplete
                options={lines}
                value={selectedLine}
                onChange={(_, option) =>
                  setFilters((current) => ({
                    ...current,
                    lineCode: option?.lineCode ?? ""
                  }))
                }
                isOptionEqualToValue={(option, value) => option.lineCode === value.lineCode}
                getOptionLabel={(option) => (option?.lineCode ? `${option.lineCode} - ${option.lineName}` : "")}
                sx={{ minWidth: 220, maxWidth: 260 }}
                renderInput={(params) => <TextField {...params} size="small" label="Line" />}
              />

              <TextField
                select
                size="small"
                label="Location"
                value={filters.location}
                onChange={(event) => setFilters((current) => ({ ...current, location: event.target.value }))}
                sx={{ minWidth: 180, maxWidth: 220 }}
              >
                <MenuItem value="">All</MenuItem>
                {areas.map((area) => (
                  <MenuItem key={area.areaCode} value={area.areaCode}>
                    {area.areaCode} - {area.areaName}
                  </MenuItem>
                ))}
              </TextField>
            </Stack>
          </Stack>
        </Paper>

        {isLoading ? (
          <Paper variant="outlined" sx={{ p: 4 }}>
            <Typography color="text.secondary">Loading pending repair approvals...</Typography>
          </Paper>
        ) : isError ? (
          <Alert severity="error">{error.message}</Alert>
        ) : (
          <TableContainer
            component={Paper}
            variant="outlined"
            sx={{ opacity: isFetching ? 0.72 : 1, transition: "opacity 0.2s", overflowX: "auto" }}
          >
            <Table sx={{ minWidth: 1200 }}>
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
                            pl: isFirstColumn ? 3 : 2,
                            pr: isLastColumn ? 3 : 2
                          }}
                        >
                          {header.isPlaceholder ? null : header.column.getCanSort() ? (
                            <TableSortLabel
                              active={header.column.getIsSorted() !== false}
                              direction={header.column.getIsSorted() || "asc"}
                              onClick={header.column.getToggleSortingHandler()}
                            >
                              {flexRender(header.column.columnDef.header, header.getContext())}
                            </TableSortLabel>
                          ) : (
                            flexRender(header.column.columnDef.header, header.getContext())
                          )}
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
                            pl: isFirstColumn ? 3 : 2,
                            pr: isLastColumn ? 3 : 2,
                            verticalAlign: "top"
                          }}
                        >
                          {flexRender(cell.column.columnDef.cell, cell.getContext())}
                        </TableCell>
                      );
                    })}
                  </TableRow>
                ))}
                {records.length === 0 && (
                  <TableRow>
                    <TableCell colSpan={columns.length} align="center" sx={{ py: 6, px: 3 }}>
                      No pending repair approvals.
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

      <Dialog open={!!target} onClose={approveMutation.isPending ? undefined : () => setTarget(null)} fullWidth maxWidth="sm">
        <DialogTitle>Approve Repair Record</DialogTitle>
        <DialogContent dividers>
          <Stack spacing={2}>
            <Typography>
              Approve level <strong>{target?.nextPendingLevel?.toUpperCase?.() || "-"}</strong> for this repair record?
            </Typography>
            <Typography variant="body2" color="text.secondary">
              {target?.damageDescription}
            </Typography>
          </Stack>
        </DialogContent>
        <DialogActions>
          <Button onClick={() => setTarget(null)} disabled={approveMutation.isPending}>
            Cancel
          </Button>
          <Button
            variant="contained"
            disabled={approveMutation.isPending || !target}
            onClick={() =>
              approveMutation.mutate(
                { submissionId: target.submissionId, recordId: target.repairRecordId },
                { onSuccess: () => setTarget(null) }
              )
            }
          >
            {approveMutation.isPending ? "Saving..." : "Approve"}
          </Button>
        </DialogActions>
      </Dialog>
    </Box>
  );
}
