import { useEffect, useMemo, useState } from "react";
import {
  Alert,
  Box,
  Button,
  ButtonGroup,
  Chip,
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
import { ConfirmationDialog } from "app/components";
import {
  useChecksheetHolidays,
  useCreateChecksheetHoliday,
  useDeleteChecksheetHoliday,
  useGenerateChecksheetWeekendHolidays,
  useUpdateChecksheetHoliday
} from "app/hooks/useChecksheets";

const WEEKDAY_LABELS = ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"];
const AUTO_HOLIDAY_DAYS = new Set([0, 6]);

function toDateInputValue(value) {
  return value ? String(value).slice(0, 10) : "";
}

function getCurrentMonthValue() {
  const now = new Date();
  return `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, "0")}`;
}

function parseMonthValue(monthValue) {
  const [year, month] = String(monthValue || "").split("-").map(Number);
  return { year: year || undefined, month: month || undefined };
}

function formatMonthTitle(monthValue) {
  const { year, month } = parseMonthValue(monthValue);
  if (!year || !month) return "-";
  return new Intl.DateTimeFormat("en-US", { month: "long", year: "numeric" }).format(new Date(year, month - 1, 1));
}

function addMonths(monthValue, delta) {
  const { year, month } = parseMonthValue(monthValue);
  if (!year || !month) return getCurrentMonthValue();
  const date = new Date(year, month - 1 + delta, 1);
  return `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, "0")}`;
}

function getCalendarDays(monthValue) {
  const { year, month } = parseMonthValue(monthValue);
  if (!year || !month) return [];

  const daysInMonth = new Date(year, month, 0).getDate();
  const firstDay = new Date(year, month - 1, 1).getDay();
  const cells = Array.from({ length: firstDay }, (_, index) => ({ key: `blank-${index}`, isBlank: true }));

  for (let day = 1; day <= daysInMonth; day += 1) {
    const date = new Date(year, month - 1, day);
    cells.push({
      key: `${monthValue}-${String(day).padStart(2, "0")}`,
      day,
      dateValue: `${monthValue}-${String(day).padStart(2, "0")}`,
      weekday: date.getDay()
    });
  }

  while (cells.length % 7 !== 0) {
    cells.push({ key: `blank-${cells.length}`, isBlank: true });
  }

  return cells;
}

function HolidayDialog({ open, mode, initialData, onClose, onSubmit, isPending }) {
  const [form, setForm] = useState({
    holidayDate: "",
    holidayName: "",
    description: "",
    isActive: true
  });

  useEffect(() => {
    setForm({
      holidayDate: toDateInputValue(initialData?.holidayDate),
      holidayName: initialData?.holidayName ?? "",
      description: initialData?.description ?? "",
      isActive: initialData?.isActive ?? true
    });
  }, [initialData, open]);

  const canSubmit = form.holidayDate && form.holidayName.trim();

  return (
    <Dialog open={open} onClose={isPending ? undefined : onClose} fullWidth maxWidth="sm">
      <DialogTitle>{mode === "edit" ? "Edit Holiday" : "Add Holiday"}</DialogTitle>
      <DialogContent dividers>
        <Stack spacing={2} sx={{ pt: 0.5 }}>
          <TextField
            label="Holiday Date"
            type="date"
            value={form.holidayDate}
            onChange={(event) => setForm((current) => ({ ...current, holidayDate: event.target.value }))}
            InputLabelProps={{ shrink: true }}
            disabled={isPending}
          />
          <TextField
            label="Holiday Name"
            value={form.holidayName}
            onChange={(event) => setForm((current) => ({ ...current, holidayName: event.target.value }))}
            disabled={isPending}
          />
          <TextField
            label="Description"
            value={form.description}
            onChange={(event) => setForm((current) => ({ ...current, description: event.target.value }))}
            multiline
            minRows={3}
            disabled={isPending}
          />
          <Stack direction="row" spacing={1} alignItems="center">
            <Switch
              checked={form.isActive}
              onChange={(event) => setForm((current) => ({ ...current, isActive: event.target.checked }))}
              disabled={isPending}
            />
            <Typography>{form.isActive ? "Active" : "Inactive"}</Typography>
          </Stack>
        </Stack>
      </DialogContent>
      <DialogActions>
        <Button onClick={onClose} disabled={isPending}>Cancel</Button>
        <Button
          variant="contained"
          disabled={!canSubmit || isPending}
          onClick={() => onSubmit({
            holidayDate: form.holidayDate,
            holidayName: form.holidayName.trim(),
            description: form.description.trim() || null,
            isActive: form.isActive
          })}
        >
          {isPending ? "Saving..." : "Save"}
        </Button>
      </DialogActions>
    </Dialog>
  );
}

export default function ChecksheetHolidaysPage() {
  const [dialogState, setDialogState] = useState({ open: false, mode: "create", data: null });
  const [deleteTarget, setDeleteTarget] = useState(null);
  const [monthValue, setMonthValue] = useState(getCurrentMonthValue());
  const [status, setStatus] = useState("all");
  const [page, setPage] = useState(1);
  const [pageSize, setPageSize] = useState(10);
  const { year, month } = useMemo(() => parseMonthValue(monthValue), [monthValue]);
  const monthParams = { year, month };
  const { data: monthData, isLoading: isMonthLoading, isError, error, isFetching } = useChecksheetHolidays({
    page: 1,
    pageSize: 370,
    ...monthParams
  });
  const { data: listData, isLoading: isListLoading } = useChecksheetHolidays({
    page,
    pageSize,
    ...monthParams,
    isActive: status === "all" ? undefined : status === "active"
  });
  const monthHolidays = monthData?.items ?? [];
  const holidays = listData?.items ?? [];
  const totalCount = listData?.totalCount ?? 0;
  const createHoliday = useCreateChecksheetHoliday();
  const generateWeekendHolidays = useGenerateChecksheetWeekendHolidays();
  const updateHoliday = useUpdateChecksheetHoliday(dialogState.data?.id);
  const deleteHoliday = useDeleteChecksheetHoliday();
  const calendarDays = useMemo(() => getCalendarDays(monthValue), [monthValue]);
  const holidaysByDate = useMemo(
    () => new Map(monthHolidays.map((holiday) => [toDateInputValue(holiday.holidayDate), holiday])),
    [monthHolidays]
  );

  useEffect(() => {
    setPage(1);
  }, [monthValue, status]);

  const handleAutoFillHolidays = () => {
    generateWeekendHolidays.mutate({ year, month });
  };

  if (isError) {
    return <Box sx={{ p: 3 }}><Alert severity="error">{error.message}</Alert></Box>;
  }

  return (
    <Box sx={{ p: 3 }}>
      <Stack spacing={3}>
        <Stack direction={{ xs: "column", md: "row" }} justifyContent="space-between" alignItems={{ xs: "stretch", md: "flex-start" }} spacing={2}>
          <Box>
            <Typography variant="h5" fontWeight={700}>Calendar Management</Typography>
            <Typography variant="body2" color="text.secondary">
              Manage holiday dates used by checksheet monthly views.
            </Typography>
          </Box>
          <Stack direction={{ xs: "column", sm: "row" }} spacing={1}>
            <Button
              variant="outlined"
              onClick={handleAutoFillHolidays}
              disabled={isMonthLoading || !year || !month || generateWeekendHolidays.isPending}
            >
              {generateWeekendHolidays.isPending ? "Generating..." : "Set Sat & Sun Holidays"}
            </Button>
            <Button variant="contained" startIcon={<AddIcon />} onClick={() => setDialogState({ open: true, mode: "create", data: null })}>
              Add Holiday
            </Button>
          </Stack>
        </Stack>

        <Paper variant="outlined" sx={{ p: 2 }}>
          <Stack direction={{ xs: "column", md: "row" }} spacing={2} alignItems={{ xs: "stretch", md: "center" }}>
            <ButtonGroup variant="outlined" size="small">
              <Button onClick={() => setMonthValue(addMonths(monthValue, -1))}>Prev</Button>
              <Button onClick={() => setMonthValue(getCurrentMonthValue())}>Today</Button>
              <Button onClick={() => setMonthValue(addMonths(monthValue, 1))}>Next</Button>
            </ButtonGroup>
            <TextField
              label="Month"
              type="month"
              size="small"
              value={monthValue}
              onChange={(event) => setMonthValue(event.target.value)}
              InputLabelProps={{ shrink: true }}
              sx={{ minWidth: 200 }}
            />
            <TextField
              select
              label="List Status"
              size="small"
              value={status}
              onChange={(event) => setStatus(event.target.value)}
              sx={{ minWidth: 180 }}
            >
              <MenuItem value="all">All</MenuItem>
              <MenuItem value="active">Active</MenuItem>
              <MenuItem value="inactive">Inactive</MenuItem>
            </TextField>
            {isFetching && !isMonthLoading ? (
              <Typography variant="body2" color="text.secondary">Refreshing...</Typography>
            ) : null}
          </Stack>
        </Paper>

        <Paper variant="outlined" sx={{ overflow: "hidden" }}>
          <Stack spacing={0}>
            <Box sx={{ px: 2.5, py: 2, borderBottom: 1, borderColor: "divider" }}>
              <Typography variant="h6" fontWeight={700}>{formatMonthTitle(monthValue)}</Typography>
            </Box>
            <Box sx={{ display: "grid", gridTemplateColumns: "repeat(7, minmax(0, 1fr))", bgcolor: "#f8fafc", borderBottom: 1, borderColor: "divider" }}>
              {WEEKDAY_LABELS.map((label) => (
                <Box key={label} sx={{ px: 1.5, py: 1, textAlign: "center", fontWeight: 700, fontSize: 12, color: label === "Sun" ? "#b91c1c" : "text.secondary" }}>
                  {label}
                </Box>
              ))}
            </Box>
            <Box sx={{ display: "grid", gridTemplateColumns: "repeat(7, minmax(0, 1fr))" }}>
              {calendarDays.map((day) => {
                const holiday = day.dateValue ? holidaysByDate.get(day.dateValue) : null;
                const isActiveHoliday = !!holiday?.isActive;
                const isAutoHolidayDay = !day.isBlank && AUTO_HOLIDAY_DAYS.has(day.weekday);

                return (
                  <Box
                    key={day.key}
                    component={day.isBlank ? "div" : "button"}
                    type={day.isBlank ? undefined : "button"}
                    onClick={day.isBlank ? undefined : () => setDialogState({ open: true, mode: holiday ? "edit" : "create", data: holiday ?? { holidayDate: day.dateValue, isActive: true } })}
                    sx={{
                      minHeight: 112,
                      p: 1.25,
                      border: 0,
                      borderRight: 1,
                      borderBottom: 1,
                      borderColor: "divider",
                      bgcolor: day.isBlank ? "#f8fafc" : isActiveHoliday ? "#fee2e2" : isAutoHolidayDay ? "#fff7ed" : "#fff",
                      textAlign: "left",
                      cursor: day.isBlank ? "default" : "pointer",
                      font: "inherit",
                      color: "inherit",
                      "&:hover": day.isBlank ? {} : { bgcolor: isActiveHoliday ? "#fecaca" : "#f1f5f9" }
                    }}
                  >
                    {!day.isBlank ? (
                      <Stack spacing={1} sx={{ height: "100%" }}>
                        <Stack direction="row" justifyContent="space-between" alignItems="center" spacing={1}>
                          <Typography fontWeight={700} color={isActiveHoliday || day.weekday === 0 ? "#b91c1c" : "text.primary"}>
                            {day.day}
                          </Typography>
                          {isAutoHolidayDay ? (
                            <Chip label={day.weekday === 6 ? "Sat" : "Sun"} size="small" variant="outlined" sx={{ height: 22 }} />
                          ) : null}
                        </Stack>
                        {holiday ? (
                          <Box>
                            <Typography variant="body2" fontWeight={700} sx={{ color: holiday.isActive ? "#991b1b" : "text.secondary" }}>
                              {holiday.holidayName}
                            </Typography>
                            <Typography variant="caption" color="text.secondary">
                              {holiday.isActive ? "Active" : "Inactive"}
                            </Typography>
                          </Box>
                        ) : null}
                      </Stack>
                    ) : null}
                  </Box>
                );
              })}
            </Box>
          </Stack>
        </Paper>

        <TableContainer component={Paper} variant="outlined">
          <Table size="small">
            <TableHead>
              <TableRow>
                <TableCell sx={{ pl: 3, fontWeight: 700 }}>Date</TableCell>
                <TableCell sx={{ fontWeight: 700 }}>Holiday</TableCell>
                <TableCell sx={{ fontWeight: 700 }}>Description</TableCell>
                <TableCell sx={{ fontWeight: 700 }}>Status</TableCell>
                <TableCell align="right" sx={{ pr: 3, fontWeight: 700 }}>Action</TableCell>
              </TableRow>
            </TableHead>
            <TableBody>
              {isListLoading ? (
                <TableRow>
                  <TableCell colSpan={5} align="center" sx={{ py: 6, px: 3 }}>Loading holidays...</TableCell>
                </TableRow>
              ) : holidays.length > 0 ? (
                holidays.map((holiday) => (
                  <TableRow key={holiday.id} hover>
                    <TableCell sx={{ pl: 3, whiteSpace: "nowrap" }}>{toDateInputValue(holiday.holidayDate)}</TableCell>
                    <TableCell>
                      <Typography fontWeight={600}>{holiday.holidayName}</Typography>
                    </TableCell>
                    <TableCell>{holiday.description || "-"}</TableCell>
                    <TableCell>
                      <Chip label={holiday.isActive ? "Active" : "Inactive"} size="small" color={holiday.isActive ? "success" : "default"} variant="outlined" />
                    </TableCell>
                    <TableCell align="right" sx={{ pr: 3 }}>
                      <IconButton onClick={() => setDialogState({ open: true, mode: "edit", data: holiday })}>
                        <EditOutlinedIcon />
                      </IconButton>
                      <IconButton color="error" onClick={() => setDeleteTarget({ id: holiday.id, name: holiday.holidayName })}>
                        <DeleteOutlineIcon />
                      </IconButton>
                    </TableCell>
                  </TableRow>
                ))
              ) : (
                <TableRow>
                  <TableCell colSpan={5} align="center" sx={{ py: 6, px: 3 }}>No holidays found.</TableCell>
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

      <HolidayDialog
        open={dialogState.open}
        mode={dialogState.mode}
        initialData={dialogState.data}
        isPending={createHoliday.isPending || updateHoliday.isPending}
        onClose={() => setDialogState({ open: false, mode: "create", data: null })}
        onSubmit={(payload) => {
          const options = { onSuccess: () => setDialogState({ open: false, mode: "create", data: null }) };
          if (dialogState.mode === "edit") {
            updateHoliday.mutate(payload, options);
            return;
          }
          createHoliday.mutate(payload, options);
        }}
      />

      <ConfirmationDialog
        open={!!deleteTarget}
        title="Delete Holiday"
        text={`Delete "${deleteTarget?.name}" from Calendar Management?`}
        confirmText="Delete"
        confirmColor="error"
        isLoading={deleteHoliday.isPending}
        onConfirmDialogClose={() => setDeleteTarget(null)}
        onYesClick={() => {
          if (!deleteTarget) return;
          deleteHoliday.mutate(deleteTarget.id, { onSuccess: () => setDeleteTarget(null) });
        }}
      />
    </Box>
  );
}
