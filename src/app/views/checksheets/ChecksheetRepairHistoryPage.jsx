import { useEffect, useMemo, useState } from "react";
import { useNavigate } from "react-router-dom";
import {
  Alert,
  Autocomplete,
  Box,
  Button,
  Chip,
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
import LaunchIcon from "@mui/icons-material/Launch";
import {
  useChecksheetAreas,
  useChecksheetLines,
  useChecksheetMasters,
  useRepairHistory
} from "app/hooks/useChecksheets";

const APPROVAL_STATUS_OPTIONS = [
  { value: "", label: "All" },
  { value: "pending", label: "Not Finished Yet" },
  { value: "completed", label: "Completed" }
];

const WRAP_CELL_SX = {
  whiteSpace: "normal",
  wordBreak: "break-word",
  overflowWrap: "anywhere",
  verticalAlign: "top"
};

function formatDateTime(value) {
  if (!value) return "-";

  return new Intl.DateTimeFormat("en-US", {
    year: "numeric",
    month: "short",
    day: "numeric",
    hour: "2-digit",
    minute: "2-digit",
    hour12: false
  }).format(new Date(value));
}

export default function ChecksheetRepairHistoryPage() {
  const navigate = useNavigate();
  const [filters, setFilters] = useState({
    checksheetMasterId: "",
    lineCode: "",
    location: "",
    approvalStatus: ""
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
  const { data, isLoading, isError, error, isFetching } = useRepairHistory({
    page,
    pageSize,
    sortBy: activeSort?.id,
    sortDirection: activeSort?.desc === false ? "asc" : "desc",
    checksheetMasterId: filters.checksheetMasterId || undefined,
    lineCode: filters.lineCode || undefined,
    location: filters.location || undefined,
    approvalStatus: filters.approvalStatus || undefined
  });

  const records = useMemo(() => data?.items ?? [], [data?.items]);
  const totalCount = data?.totalCount ?? 0;

  useEffect(() => {
    setPage(1);
  }, [filters.checksheetMasterId, filters.lineCode, filters.location, filters.approvalStatus]);

  useEffect(() => {
    setPage(1);
  }, [sorting]);

  const columns = useMemo(
    () => [
      {
        id: "machine",
        accessorFn: (row) => row.machineCode ?? "",
        header: "Machine",
        size: 180,
        cell: ({ row }) => (
          <Stack spacing={0.5}>
            <Typography fontWeight={600}>{row.original.machineCode}</Typography>
            <Typography variant="caption" color="text.secondary">
              {row.original.location} | {row.original.lineName}
            </Typography>
          </Stack>
        )
      },
      {
        id: "entryDate",
        accessorKey: "createdAt",
        header: "Entry Date",
        size: 170,
        cell: ({ getValue }) => (
          <Typography variant="body2" sx={{ whiteSpace: "nowrap" }}>
            {formatDateTime(getValue())}
          </Typography>
        )
      },
      {
        id: "repair",
        accessorFn: (row) => `${row.damageDescription ?? ""} ${row.repairDescription ?? ""}`,
        header: "Repair",
        size: 390,
        cell: ({ row }) => (
          <Stack spacing={1}>
            <Box>
              <Typography variant="caption" color="text.secondary" sx={{ display: "block", mb: 0.25 }}>
                Damage
              </Typography>
              <Typography variant="body2" fontWeight={600} sx={WRAP_CELL_SX}>
                {row.original.damageDescription || "-"}
              </Typography>
            </Box>
            <Box>
              <Typography variant="caption" color="text.secondary" sx={{ display: "block", mb: 0.25 }}>
                Repair
              </Typography>
              <Typography variant="body2" color="text.secondary" sx={WRAP_CELL_SX}>
                {row.original.repairDescription || "-"}
              </Typography>
            </Box>
            {row.original.note ? (
              <Box>
                <Typography variant="caption" color="text.secondary" sx={{ display: "block", mb: 0.25 }}>
                  Note
                </Typography>
                <Typography variant="body2" sx={WRAP_CELL_SX}>
                  {row.original.note}
                </Typography>
              </Box>
            ) : null}
          </Stack>
        )
      },
      {
        accessorKey: "repairedByName",
        header: "Repaired By",
        size: 140,
        cell: ({ getValue }) => getValue() || "-"
      },
      {
        accessorKey: "checkedByAssyName",
        header: "ASSY",
        size: 120,
        cell: ({ getValue }) => getValue() || "-"
      },
      {
        accessorKey: "checkedByQaName",
        header: "QA",
        size: 120,
        cell: ({ getValue }) => getValue() || "-"
      },
      {
        accessorKey: "checkedByCoordinatorName",
        header: "MTA",
        size: 120,
        cell: ({ getValue }) => getValue() || "-"
      },
      {
        id: "approval",
        accessorKey: "approvalStatus",
        header: () => <Box sx={{ textAlign: "center" }}>Approval</Box>,
        size: 150,
        cell: ({ row }) => {
          const isCompleted = row.original.approvalStatus === "completed";
          const nextLevel = row.original.nextPendingLevel?.toUpperCase?.() || "-";

          return (
            <Stack spacing={0.75} sx={{ minWidth: 0, alignItems: "center" }}>
              <Chip
                size="small"
                label={isCompleted ? "Completed" : "In Progress"}
                color={isCompleted ? "success" : "warning"}
                variant={isCompleted ? "filled" : "outlined"}
                sx={{ width: "fit-content", fontWeight: 600 }}
              />
              <Typography variant="caption" color="text.secondary">
                {isCompleted ? "All signer levels approved" : "Waiting approval"}
              </Typography>
              {!isCompleted ? (
                <Chip
                  size="small"
                  label={nextLevel}
                  color="info"
                  variant="outlined"
                  sx={{ width: "fit-content", fontWeight: 600 }}
                />
              ) : null}
            </Stack>
          );
        }
      },
      {
        id: "action",
        enableSorting: false,
        size: 110,
        header: () => <Box sx={{ textAlign: "right" }}>Action</Box>,
        cell: ({ row }) => (
          <Box sx={{ textAlign: "right" }}>
            <Button
              endIcon={<LaunchIcon />}
              onClick={() => navigate(`/checksheets/submissions/${row.original.submissionId}`)}
            >
              Open
            </Button>
          </Box>
        )
      }
    ],
    [navigate]
  );

  const table = useReactTable({
    data: records,
    columns,
    state: { sorting },
    onSortingChange: setSorting,
    manualSorting: true,
    enableSortingRemoval: false,
    getCoreRowModel: getCoreRowModel()
  });

  return (
    <Box sx={{ p: 3 }}>
      <Stack spacing={3}>
        <Box>
          <Typography variant="h5" fontWeight={700}>Repair History</Typography>
          <Typography variant="body2" color="text.secondary">
            View all repair entry records with server-side filtering by approval status, line, location, and checksheet master.
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

              <TextField
                select
                size="small"
                label="Approval Status"
                value={filters.approvalStatus}
                onChange={(event) => setFilters((current) => ({ ...current, approvalStatus: event.target.value }))}
                sx={{ minWidth: 180, maxWidth: 220 }}
              >
                {APPROVAL_STATUS_OPTIONS.map((option) => (
                  <MenuItem key={option.label} value={option.value}>{option.label}</MenuItem>
                ))}
              </TextField>
            </Stack>
          </Stack>
        </Paper>

        {isLoading ? (
          <Paper variant="outlined" sx={{ p: 4 }}>
            <Typography color="text.secondary">Loading repair history...</Typography>
          </Paper>
        ) : isError ? (
          <Alert severity="error">{error.message}</Alert>
        ) : (
          <TableContainer
            component={Paper}
            variant="outlined"
            sx={{ overflowX: "auto", opacity: isFetching ? 0.72 : 1, transition: "opacity 0.2s" }}
          >
            <Table sx={{ minWidth: 1400, tableLayout: "fixed" }}>
              <TableHead>
                {table.getHeaderGroups().map((headerGroup) => (
                  <TableRow key={headerGroup.id}>
                    {headerGroup.headers.map((header, index) => {
                      const isFirstColumn = index === 0;
                      const isLastColumn = index === headerGroup.headers.length - 1;
                      const isApprovalColumn = header.column.id === "approval";
                      const align = isApprovalColumn ? "center" : isLastColumn ? "right" : "left";

                      return (
                        <TableCell
                          key={header.id}
                          align={align}
                          sx={{
                            ...WRAP_CELL_SX,
                            width: header.column.columnDef.size,
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
                      const isApprovalColumn = cell.column.id === "approval";
                      const align = isApprovalColumn ? "center" : isLastColumn ? "right" : "left";

                      return (
                        <TableCell
                          key={cell.id}
                          align={align}
                          sx={{
                            ...WRAP_CELL_SX,
                            width: cell.column.columnDef.size,
                            pl: isFirstColumn ? 3 : 2,
                            pr: isLastColumn ? 3 : 2
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
                    <TableCell colSpan={9} align="center" sx={{ py: 6, px: 3 }}>
                      No repair history found.
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
    </Box>
  );
}
