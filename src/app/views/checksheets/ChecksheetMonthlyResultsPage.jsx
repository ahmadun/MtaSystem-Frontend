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
  useChecksheetLines,
  useChecksheetMasters,
  useChecksheetMonthlyResults
} from "app/hooks/useChecksheets";

function getMonthRange(monthValue) {
  if (!monthValue) {
    return { from: undefined, to: undefined };
  }

  const [year, month] = monthValue.split("-").map(Number);
  if (!year || !month) {
    return { from: undefined, to: undefined };
  }

  const from = `${year}-${String(month).padStart(2, "0")}-01`;
  const toDate = new Date(year, month, 0);
  const to = `${toDate.getFullYear()}-${String(toDate.getMonth() + 1).padStart(2, "0")}-${String(toDate.getDate()).padStart(2, "0")}`;
  return { from, to };
}

function monthValueToDate(monthValue) {
  if (!monthValue) {
    return null;
  }

  const [year, month] = monthValue.split("-").map(Number);
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

export default function ChecksheetMonthlyResultsPage() {
  const navigate = useNavigate();
  const [filters, setFilters] = useState({
    checksheetMasterId: "",
    lineCode: "",
    location: "",
    month: new Date().toISOString().slice(0, 7)
  });
  const [page, setPage] = useState(1);
  const [pageSize, setPageSize] = useState(10);
  const [sorting, setSorting] = useState([{ id: "reviewedAt", desc: true }]);
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

  const monthRange = useMemo(() => getMonthRange(filters.month), [filters.month]);

  const queryParams = useMemo(() => ({
    page,
    pageSize,
    sortBy: activeSort?.id,
    sortDirection: activeSort?.desc === false ? "asc" : "desc",
    checksheetMasterId: filters.checksheetMasterId || undefined,
    lineCode: filters.lineCode || undefined,
    location: filters.location || undefined,
    inspectionDateFrom: monthRange.from,
    inspectionDateTo: monthRange.to
  }), [
    activeSort?.desc,
    activeSort?.id,
    filters.checksheetMasterId,
    filters.lineCode,
    filters.location,
    monthRange.from,
    monthRange.to,
    page,
    pageSize
  ]);

  const { data, isLoading, isError, error, isFetching } = useChecksheetMonthlyResults(queryParams);
  const results = useMemo(() => data?.items ?? [], [data?.items]);
  const totalCount = data?.totalCount ?? 0;

  useEffect(() => {
    setPage(1);
  }, [filters.checksheetMasterId, filters.lineCode, filters.location, filters.month]);

  useEffect(() => {
    setPage(1);
  }, [sorting]);

  const columns = useMemo(
    () => [
      {
        id: "checksheet",
        enableSorting: false,
        header: "Checksheet",
        cell: ({ row }) => (
          <Stack spacing={0.35}>
            <Typography variant="body2" fontWeight={600}>
              {row.original.processCode} - {row.original.processName}
            </Typography>
            <Typography variant="caption" color="text.secondary">
              {row.original.checksheetName}
            </Typography>
          </Stack>
        )
      },
      {
        id: "machine",
        enableSorting: false,
        header: "Machine",
        cell: ({ row }) => (
          <Stack spacing={0.4}>
            <Typography fontWeight={600}>{row.original.machineCode}</Typography>
            <Typography variant="caption" color="text.secondary">
              {row.original.location} | {row.original.lineName}
            </Typography>
          </Stack>
        )
      },

      {
        id: "group",
        enableSorting: false,
        header: () => <Box sx={{ textAlign: "center" }}>Group</Box>,
        cell: ({ row }) => (
          <Box sx={{ display: "flex", justifyContent: "center" }}>
            <Chip
              size="small"
              variant="outlined"
              label={row.original.groupCodes?.join(", ") || "-"}
            />
          </Box>
        )
      },
      {
        id: "status",
        enableSorting: false,
        header: () => <Box sx={{ textAlign: "center" }}>Month-End Status</Box>,
        cell: ({ row }) => (
          <Box sx={{ display: "flex", justifyContent: "center" }}>
            <Chip
              size="small"
              label={String(row.original.status || "-").toUpperCase()}
              color={row.original.status === "approved" ? "success" : "warning"}
              variant={row.original.status === "approved" ? "filled" : "outlined"}
            />
          </Box>
        )
      },
      {
        id: "reviewedAt",
        accessorFn: (row) => row.approvedAt || row.submittedAt || "",
        header: "Last Review",
        cell: ({ row }) => formatDateTime(row.original.approvedAt || row.original.submittedAt)
      },
      {
        id: "action",
        enableSorting: false,
        header: () => <Box sx={{ textAlign: "right" }}>Action</Box>,
        cell: ({ row }) => (
          <Box sx={{ textAlign: "right" }}>
            <Button
              endIcon={<LaunchIcon />}
              onClick={() => {
                const [year, month] = String(row.original.resultMonth).split("-").map(Number);
                navigate(`/checksheets/submissions/${row.original.id}/monthly?year=${year}&month=${month}`);
              }}
            >
              Open Monthly
            </Button>
          </Box>
        )
      }
    ],
    [navigate]
  );

  const table = useReactTable({
    data: results,
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
          <Typography variant="h5" fontWeight={700}>Monthly Results</Typography>
          <Typography variant="body2" color="text.secondary">
            Query month-end results by machine, checksheet, and group for a specific month.
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

                <DatePicker
                  views={["year", "month"]}
                  openTo="month"
                  label="Month"
                  value={monthValueToDate(filters.month)}
                  onChange={(value) => {
                    setFilters((current) => ({
                      ...current,
                      month: dateToMonthValue(value)
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

        {isLoading ? (
          <Paper variant="outlined" sx={{ p: 4 }}>
            <Typography color="text.secondary">Loading monthly results...</Typography>
          </Paper>
        ) : isError ? (
          <Alert severity="error">{error.message}</Alert>
        ) : (
          <TableContainer
            component={Paper}
            variant="outlined"
            sx={{ opacity: isFetching ? 0.72 : 1, transition: "opacity 0.2s" }}
          >
            <Table>
              <TableHead>
                {table.getHeaderGroups().map((headerGroup) => (
                  <TableRow key={headerGroup.id}>
                    {headerGroup.headers.map((header, index) => {
                      const isFirstColumn = index === 0;
                      const isLastColumn = index === headerGroup.headers.length - 1;
                      const isCenterColumn = ["group", "count", "status"].includes(header.column.id);
                      const align = isCenterColumn ? "center" : isLastColumn ? "right" : "left";

                      return (
                        <TableCell
                          key={header.id}
                          align={align}
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
                      const isCenterColumn = ["group", "count", "status"].includes(cell.column.id);
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
                {results.length === 0 && (
                  <TableRow>
                    <TableCell colSpan={columns.length} align="center" sx={{ py: 6, px: 3 }}>
                      No monthly results found.
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
