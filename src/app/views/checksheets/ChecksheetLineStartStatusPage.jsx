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
import LaunchIcon from "@mui/icons-material/Launch";
import { AdapterDateFns } from "@mui/x-date-pickers/AdapterDateFnsV3";
import { DatePicker, LocalizationProvider } from "@mui/x-date-pickers";
import { flexRender, getCoreRowModel, useReactTable } from "@tanstack/react-table";
import {
  useChecksheetAreas,
  useChecksheetLineStartStatus,
  useChecksheetLines,
  useChecksheetMasters
} from "app/hooks/useChecksheets";

const STATUS_OPTIONS = [
  { value: "all", label: "All" },
  { value: "started", label: "Started" },
  { value: "not_started", label: "Not Started" }
];

function defaultMonthValue() {
  return new Date().toISOString().slice(0, 7);
}

function monthValueToDate(monthValue) {
  if (!monthValue) {
    return null;
  }

  const [year, month] = String(monthValue).split("-").map(Number);
  if (!year || !month) {
    return null;
  }

  return new Date(year, month - 1, 1);
}

function dateToMonthValue(date) {
  if (!(date instanceof Date) || Number.isNaN(date.getTime())) {
    return "";
  }

  return `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, "0")}`;
}

function parseMonthParts(monthValue) {
  const [year, month] = String(monthValue || defaultMonthValue()).split("-").map(Number);
  const today = new Date();

  return {
    year: year || today.getFullYear(),
    month: month || today.getMonth() + 1
  };
}

function formatSubmissionStatus(status) {
  return status ? String(status).toUpperCase() : "-";
}

export default function ChecksheetLineStartStatusPage() {
  const navigate = useNavigate();
  const [filters, setFilters] = useState({
    checksheetMasterId: "",
    lineCode: "",
    location: "",
    status: "all",
    month: defaultMonthValue()
  });
  const [page, setPage] = useState(1);
  const [pageSize, setPageSize] = useState(10);
  const [sorting, setSorting] = useState([{ id: "line", desc: false }]);
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
  const monthParts = useMemo(() => parseMonthParts(filters.month), [filters.month]);
  const queryParams = useMemo(() => ({
    page,
    pageSize,
    sortBy: activeSort?.id,
    sortDirection: activeSort?.desc ? "desc" : "asc",
    year: monthParts.year,
    month: monthParts.month,
    checksheetMasterId: filters.checksheetMasterId || undefined,
    lineCode: filters.lineCode || undefined,
    location: filters.location || undefined,
    status: filters.status || "all"
  }), [
    activeSort?.desc,
    activeSort?.id,
    filters.checksheetMasterId,
    filters.lineCode,
    filters.location,
    filters.status,
    monthParts.month,
    monthParts.year,
    page,
    pageSize
  ]);
  const { data, isLoading, isError, error, isFetching } = useChecksheetLineStartStatus(queryParams);
  const rows = useMemo(() => data?.rows?.items ?? [], [data?.rows?.items]);
  const totalCount = data?.rows?.totalCount ?? 0;
  const summary = data?.summary ?? { total: 0, started: 0, notStarted: 0, startedRate: 0 };

  useEffect(() => {
    setPage(1);
  }, [filters.checksheetMasterId, filters.lineCode, filters.location, filters.status, filters.month]);

  useEffect(() => {
    setPage(1);
  }, [sorting]);

  const columns = useMemo(
    () => [
      {
        id: "status",
        accessorFn: (row) => row.isStarted,
        header: () => <Box sx={{ textAlign: "center" }}>Status</Box>,
        cell: ({ row }) => (
          <Box sx={{ display: "flex", justifyContent: "center" }}>
            <Chip
              size="small"
              label={row.original.isStarted ? "STARTED" : "NOT STARTED"}
              color={row.original.isStarted ? "success" : "error"}
              variant={row.original.isStarted ? "filled" : "outlined"}
            />
          </Box>
        )
      },
      {
        id: "machine",
        accessorFn: (row) => row.machineCode ?? "",
        header: "Machine",
        cell: ({ row }) => (
          <Stack spacing={0.3}>
            <Typography fontWeight={600}>{row.original.machineCode}</Typography>
            <Typography variant="caption" color="text.secondary">
              {row.original.location} | {row.original.lineName}
            </Typography>
          </Stack>
        )
      },
      {
        id: "checksheet",
        accessorFn: (row) => row.processCode ?? "",
        header: "Checksheet",
        cell: ({ row }) => (
          <Stack spacing={0.3} sx={{ maxWidth: 360 }}>
            <Typography variant="body2" fontWeight={600} sx={{ whiteSpace: "normal", overflowWrap: "break-word" }}>
              {row.original.processCode} - {row.original.processName}
            </Typography>
            <Typography variant="caption" color="text.secondary" sx={{ whiteSpace: "normal", overflowWrap: "break-word" }}>
              {row.original.checksheetName}
            </Typography>
          </Stack>
        )
      },
      {
        id: "line",
        accessorFn: (row) => row.lineCode ?? "",
        header: "Line",
        cell: ({ row }) => `${row.original.lineCode} - ${row.original.lineName}`
      },
      {
        id: "mode",
        accessorFn: (row) => row.checksheetMode ?? "",
        header: () => <Box sx={{ textAlign: "center", ml: 3 }}>Mode</Box>,
        cell: ({ row }) => (
          <Box sx={{ display: "flex", justifyContent: "center" }}>
            <Chip size="small" variant="outlined" label={String(row.original.checksheetMode || "-").toUpperCase()} />
          </Box>
        )
      },
      {
        id: "group",
        accessorFn: (row) => row.groupCode ?? "",
        header: () => <Box sx={{ textAlign: "center", ml: 3 }}>Group</Box>,
        cell: ({ row }) => <Box sx={{ textAlign: "center" }}>{row.original.groupCode || "-"}</Box>
      },
      {
        id: "startedDate",
        accessorFn: (row) => row.startedDate ?? "",
        header: "Started Date",
        cell: ({ row }) => row.original.startedDate || "-"
      },
      {
        id: "submissionStatus",
        enableSorting: false,
        header: () => <Box sx={{ textAlign: "center" }}>Submission</Box>,
        cell: ({ row }) => (
          <Box sx={{ display: "flex", justifyContent: "center" }}>
            <Chip size="small" variant="outlined" label={formatSubmissionStatus(row.original.submissionStatus)} />
          </Box>
        )
      },
      {
        id: "action",
        enableSorting: false,
        header: () => <Box sx={{ textAlign: "right" }}>Action</Box>,
        cell: ({ row }) => (
          <Box sx={{ textAlign: "right" }}>
            <Button
              endIcon={<LaunchIcon />}
              disabled={!row.original.submissionId}
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
    data: rows,
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
          <Typography variant="h5" fontWeight={700}>Checksheet Started Status</Typography>
          <Typography variant="body2" color="text.secondary">
            Track active checksheet lines that have not been started for the selected month.
          </Typography>
        </Box>

        <Paper variant="outlined" sx={{ p: 2.5 }}>
          <LocalizationProvider dateAdapter={AdapterDateFns}>
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
                  label="Status"
                  value={filters.status}
                  onChange={(event) => setFilters((current) => ({ ...current, status: event.target.value }))}
                  sx={{ minWidth: 160, maxWidth: 190 }}
                >
                  {STATUS_OPTIONS.map((option) => (
                    <MenuItem key={option.value} value={option.value}>
                      {option.label}
                    </MenuItem>
                  ))}
                </TextField>

                <DatePicker
                  views={["year", "month"]}
                  openTo="month"
                  label="Month"
                  value={monthValueToDate(filters.month)}
                  onChange={(value) => {
                    setFilters((current) => ({
                      ...current,
                      month: dateToMonthValue(value) || defaultMonthValue()
                    }));
                  }}
                  format="MMMM yyyy"
                  slotProps={{
                    textField: {
                      size: "small",
                      sx: { minWidth: 190, maxWidth: 220 }
                    }
                  }}
                />
              </Stack>
            </Stack>
          </LocalizationProvider>
        </Paper>

        <Stack direction="row" spacing={1.5} flexWrap="wrap">
          <Chip label={`${summary.total} Total`} variant="outlined" />
          <Chip label={`${summary.started} Started`} color="success" variant="outlined" />
          <Chip label={`${summary.notStarted} Not Started`} color="error" variant="outlined" />
          <Chip label={`${summary.startedRate}% Started`} color="primary" variant="outlined" />
        </Stack>

        {isLoading ? (
          <Paper variant="outlined" sx={{ p: 4 }}>
            <Typography color="text.secondary">Loading checksheet started status...</Typography>
          </Paper>
        ) : isError ? (
          <Alert severity="error">{error.message}</Alert>
        ) : (
          <TableContainer
            component={Paper}
            variant="outlined"
            sx={{ opacity: isFetching ? 0.72 : 1, transition: "opacity 0.2s", overflowX: "auto" }}
          >
            <Table sx={{ minWidth: 1320 }}>
              <TableHead>
                {table.getHeaderGroups().map((headerGroup) => (
                  <TableRow key={headerGroup.id}>
                    {headerGroup.headers.map((header, index) => {
                      const isFirstColumn = index === 0;
                      const isLastColumn = index === headerGroup.headers.length - 1;
                      const isCenterColumn = ["status", "mode", "group", "submissionStatus"].includes(header.column.id);
                      const align = isCenterColumn ? "center" : isLastColumn ? "right" : "left";

                      return (
                        <TableCell
                          key={header.id}
                          align={align}
                          sx={{
                            pl: isFirstColumn ? 3 : 2,
                            pr: isLastColumn ? 3 : 2,
                            whiteSpace: "nowrap"
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
                      const isCenterColumn = ["status", "mode", "group", "submissionStatus"].includes(cell.column.id);
                      const align = isCenterColumn ? "center" : isLastColumn ? "right" : "left";

                      return (
                        <TableCell
                          key={cell.id}
                          align={align}
                          sx={{
                            verticalAlign: "top",
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
                {rows.length === 0 && (
                  <TableRow>
                    <TableCell colSpan={columns.length} align="center" sx={{ py: 6, px: 3 }}>
                      No checksheet started status rows found.
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
