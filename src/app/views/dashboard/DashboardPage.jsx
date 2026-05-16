import { useMemo } from "react";
import { useNavigate } from "react-router-dom";
import ReactECharts from "echarts-for-react";
import {
  Alert,
  Box,
  Button,
  Chip,
  Divider,
  Grid,
  LinearProgress,
  Paper,
  Stack,
  Typography,
  useTheme
} from "@mui/material";
import { alpha } from "@mui/material/styles";
import AssignmentTurnedInIcon from "@mui/icons-material/AssignmentTurnedIn";
import BuildCircleIcon from "@mui/icons-material/BuildCircle";
import CheckCircleIcon from "@mui/icons-material/CheckCircle";
import FactCheckIcon from "@mui/icons-material/FactCheck";
import LaunchIcon from "@mui/icons-material/Launch";
import PendingActionsIcon from "@mui/icons-material/PendingActions";
import PrecisionManufacturingIcon from "@mui/icons-material/PrecisionManufacturing";
import VerifiedIcon from "@mui/icons-material/Verified";
import { useDashboard } from "app/hooks/useChecksheets";

const STATUS_COLORS = {
  draft: "#64748b",
  submitted: "#f59e0b",
  approved: "#16a34a",
  rejected: "#dc2626"
};

function formatDate(value) {
  if (!value) return "-";

  return new Intl.DateTimeFormat("en-US", {
    month: "short",
    day: "2-digit",
    year: "numeric"
  }).format(new Date(value));
}

function formatStatus(status) {
  return String(status || "-").toUpperCase();
}

function pointsToMap(points) {
  return points.reduce((result, point) => {
    result[String(point.label || "").toLowerCase()] = point.value;
    return result;
  }, {});
}

function StatCard({ icon, label, value, caption, color = "primary", onClick }) {
  const theme = useTheme();
  const mainColor = theme.palette[color]?.main ?? theme.palette.primary.main;

  return (
    <Paper
      variant="outlined"
      sx={{
        p: 2.5,
        height: "100%",
        borderRadius: 2,
        cursor: onClick ? "pointer" : "default",
        transition: "border-color 0.2s, box-shadow 0.2s",
        "&:hover": onClick
          ? {
            borderColor: `${color}.main`,
            boxShadow: "0 10px 24px rgba(15, 23, 42, 0.08)"
          }
          : undefined
      }}
      onClick={onClick}
    >
      <Stack spacing={1.5}>
        <Stack direction="row" justifyContent="space-between" alignItems="center" spacing={2}>
          <Box
            sx={{
              width: 42,
              height: 42,
              display: "grid",
              placeItems: "center",
              borderRadius: 2,
              color: mainColor,
              bgcolor: alpha(mainColor, 0.1)
            }}
          >
            {icon}
          </Box>
          {onClick ? <LaunchIcon fontSize="small" color="disabled" /> : null}
        </Stack>
        <Box>
          <Typography variant="h4" fontWeight={800} sx={{ lineHeight: 1.1 }}>
            {value}
          </Typography>
          <Typography variant="subtitle2" fontWeight={700} sx={{ mt: 0.75 }}>
            {label}
          </Typography>
          <Typography variant="caption" color="text.secondary">
            {caption}
          </Typography>
        </Box>
      </Stack>
    </Paper>
  );
}

function ChartPanel({ title, caption, children, action }) {
  return (
    <Paper variant="outlined" sx={{ p: 2.5, height: "100%", borderRadius: 2 }}>
      <Stack spacing={2} sx={{ height: "100%" }}>
        <Stack direction="row" justifyContent="space-between" alignItems="flex-start" spacing={2}>
          <Box>
            <Typography variant="subtitle1" fontWeight={800}>
              {title}
            </Typography>
            <Typography variant="caption" color="text.secondary">
              {caption}
            </Typography>
          </Box>
          {action}
        </Stack>
        {children}
      </Stack>
    </Paper>
  );
}

export default function DashboardPage() {
  const theme = useTheme();
  const navigate = useNavigate();
  const dashboardQuery = useDashboard({ recentLimit: 6, topLineLimit: 8 });
  const dashboard = dashboardQuery.data;
  const summary = dashboard?.summary ?? {};
  const submissions = dashboard?.recentTransactions ?? [];
  const currentMonthRange = dashboard?.period ?? { from: "-", to: "-" };
  const totalSubmissions = summary.totalSubmissions ?? 0;
  const totalRepairs = summary.totalRepairs ?? 0;
  const pendingApprovalTotal = summary.pendingMyApprovals ?? 0;
  const pendingRepairTotal = summary.pendingRepairApprovals ?? 0;
  const machineTotal = summary.registeredMachines ?? 0;
  const approvedCurrentMonth = summary.currentMonthApproved ?? 0;
  const monthlyTotal = summary.currentMonthResults ?? 0;
  const approvalRate = summary.currentMonthApprovalRate ?? 0;
  const isError = dashboardQuery.isError;
  const isFetching = dashboardQuery.isFetching;

  const statusPoints = useMemo(() => dashboard?.submissionStatus ?? [], [dashboard?.submissionStatus]);
  const linePoints = useMemo(() => dashboard?.transactionsByLine ?? [], [dashboard?.transactionsByLine]);
  const monthlyStatusCounts = useMemo(() => pointsToMap(dashboard?.monthlyResultStatus ?? []), [dashboard?.monthlyResultStatus]);
  const repairApprovalCounts = useMemo(() => pointsToMap(dashboard?.repairApprovalStatus ?? []), [dashboard?.repairApprovalStatus]);

  const statusChartOption = useMemo(() => ({
    tooltip: { trigger: "item" },
    legend: { bottom: 0, left: "center" },
    series: [
      {
        name: "Submissions",
        type: "pie",
        radius: ["48%", "72%"],
        center: ["50%", "44%"],
        avoidLabelOverlap: true,
        label: { formatter: "{b}: {c}" },
        data: statusPoints.map((point) => ({
          name: formatStatus(point.label),
          value: point.value,
          itemStyle: { color: STATUS_COLORS[String(point.label).toLowerCase()] ?? theme.palette.info.main }
        }))
      }
    ]
  }), [statusPoints, theme.palette.info.main]);

  const lineChartOption = useMemo(() => ({
    tooltip: { trigger: "axis", axisPointer: { type: "shadow" } },
    grid: { left: 8, right: 12, top: 20, bottom: 8, containLabel: true },
    xAxis: {
      type: "value",
      axisLine: { show: false },
      splitLine: { lineStyle: { color: theme.palette.divider } }
    },
    yAxis: {
      type: "category",
      data: linePoints.map((point) => point.label),
      axisTick: { show: false },
      axisLine: { show: false }
    },
    series: [
      {
        name: "Transactions",
        type: "bar",
        data: linePoints.map((point) => point.value),
        barMaxWidth: 22,
        itemStyle: { color: theme.palette.primary.main, borderRadius: [0, 6, 6, 0] }
      }
    ]
  }), [linePoints, theme.palette.divider, theme.palette.primary.main]);

  const monthlyChartOption = useMemo(() => ({
    tooltip: { trigger: "axis", axisPointer: { type: "shadow" } },
    legend: { bottom: 0 },
    grid: { left: 8, right: 12, top: 20, bottom: 44, containLabel: true },
    xAxis: {
      type: "category",
      data: ["Draft", "Submitted", "Approved", "Rejected"],
      axisTick: { show: false },
      axisLine: { lineStyle: { color: theme.palette.divider } }
    },
    yAxis: {
      type: "value",
      splitLine: { lineStyle: { color: theme.palette.divider } }
    },
    series: [
      {
        name: "Current Month",
        type: "bar",
        data: [
          monthlyStatusCounts.draft ?? 0,
          monthlyStatusCounts.submitted ?? 0,
          monthlyStatusCounts.approved ?? 0,
          monthlyStatusCounts.rejected ?? 0
        ],
        barMaxWidth: 34,
        itemStyle: {
          color: (params) => [
            STATUS_COLORS.draft,
            STATUS_COLORS.submitted,
            STATUS_COLORS.approved,
            STATUS_COLORS.rejected
          ][params.dataIndex],
          borderRadius: [6, 6, 0, 0]
        }
      }
    ]
  }), [monthlyStatusCounts, theme.palette.divider]);

  const repairChartOption = useMemo(() => ({
    tooltip: { trigger: "item" },
    series: [
      {
        name: "Repairs",
        type: "pie",
        radius: ["52%", "76%"],
        center: ["50%", "50%"],
        label: { formatter: "{b}: {c}" },
        data: [
          { name: "Completed", value: repairApprovalCounts.completed ?? 0, itemStyle: { color: theme.palette.success.main } },
          { name: "In Progress", value: repairApprovalCounts.inprogress ?? 0, itemStyle: { color: theme.palette.warning.main } }
        ]
      }
    ]
  }), [repairApprovalCounts.completed, repairApprovalCounts.inprogress, theme.palette.success.main, theme.palette.warning.main]);

  return (
    <Box sx={{ p: 3 }}>
      <Stack spacing={3}>
        <Stack direction={{ xs: "column", md: "row" }} justifyContent="space-between" spacing={2}>
          <Box>
            <Typography variant="h5" fontWeight={800}>
              Dashboard
            </Typography>
            <Typography variant="body2" color="text.secondary">
              Operational summary for checksheet transactions, monthly approvals, and repair follow-up.
            </Typography>
          </Box>
          <Stack direction={{ xs: "column", sm: "row" }} spacing={1}>
            <Button variant="outlined" startIcon={<FactCheckIcon />} onClick={() => navigate("/checksheets/submissions")}>
              Transactions
            </Button>
            <Button variant="contained" startIcon={<VerifiedIcon />} onClick={() => navigate("/approvals/pending")}>
              My Approvals
            </Button>
          </Stack>
        </Stack>

        {isFetching ? <LinearProgress /> : null}
        {isError ? (
          <Alert severity="error">
            Some dashboard data could not be loaded. Open the related menu page to inspect the specific request.
          </Alert>
        ) : null}

        <Grid container spacing={2}>
          <Grid item xs={12} sm={6} lg={3}>
            <StatCard
              icon={<AssignmentTurnedInIcon />}
              label="Checksheet Transactions"
              value={totalSubmissions}
              caption={`${submissions.length} shown in latest sample`}
              color="primary"
              onClick={() => navigate("/checksheets/submissions")}
            />
          </Grid>
          <Grid item xs={12} sm={6} lg={3}>
            <StatCard
              icon={<CheckCircleIcon />}
              label="Month Approval Rate"
              value={`${approvalRate}%`}
              caption={`${approvedCurrentMonth} of ${monthlyTotal} monthly results approved`}
              color="success"
              onClick={() => navigate("/checksheets/monthly-results")}
            />
          </Grid>
          <Grid item xs={12} sm={6} lg={3}>
            <StatCard
              icon={<PendingActionsIcon />}
              label="Pending My Action"
              value={pendingApprovalTotal}
              caption="Approval requests assigned to you"
              color="warning"
              onClick={() => navigate("/approvals/pending")}
            />
          </Grid>
          <Grid item xs={12} sm={6} lg={3}>
            <StatCard
              icon={<BuildCircleIcon />}
              label="Pending Repairs"
              value={pendingRepairTotal}
              caption={`${totalRepairs} repair records in history`}
              color="error"
              onClick={() => navigate("/approvals/repairs")}
            />
          </Grid>
        </Grid>

        <Grid container spacing={2}>
          <Grid item xs={12} lg={4}>
            <ChartPanel title="Submission Status" caption="Latest transaction status distribution">
              {statusPoints.length === 0 ? (
                <Box sx={{ py: 8, textAlign: "center" }}>
                  <Typography color="text.secondary">No transaction data available.</Typography>
                </Box>
              ) : (
                <ReactECharts option={statusChartOption} style={{ height: 320 }} notMerge lazyUpdate />
              )}
            </ChartPanel>
          </Grid>
          <Grid item xs={12} lg={8}>
            <ChartPanel title="Transactions By Line" caption="Top production lines from the latest transactions">
              {linePoints.length === 0 ? (
                <Box sx={{ py: 8, textAlign: "center" }}>
                  <Typography color="text.secondary">No line data available.</Typography>
                </Box>
              ) : (
                <ReactECharts option={lineChartOption} style={{ height: 320 }} notMerge lazyUpdate />
              )}
            </ChartPanel>
          </Grid>
        </Grid>

        <Grid container spacing={2}>
          <Grid item xs={12} lg={8}>
            <ChartPanel title="Current Month Results" caption={`${currentMonthRange.from} to ${currentMonthRange.to}`}>
              <ReactECharts option={monthlyChartOption} style={{ height: 300 }} notMerge lazyUpdate />
            </ChartPanel>
          </Grid>
          <Grid item xs={12} md={6} lg={4}>
            <ChartPanel title="Repair Approval" caption="Repair history approval completion">
              <ReactECharts option={repairChartOption} style={{ height: 300 }} notMerge lazyUpdate />
            </ChartPanel>
          </Grid>
        </Grid>

        <Grid container spacing={2}>
          <Grid item xs={12} lg={8}>
            <Paper variant="outlined" sx={{ p: 2.5, borderRadius: 2 }}>
              <Stack spacing={2}>
                <Stack direction="row" justifyContent="space-between" alignItems="center" spacing={2}>
                  <Box>
                    <Typography variant="subtitle1" fontWeight={800}>
                      Recent Transactions
                    </Typography>
                    <Typography variant="caption" color="text.secondary">
                      Latest checksheet entries by inspection date
                    </Typography>
                  </Box>
                  <Button endIcon={<LaunchIcon />} onClick={() => navigate("/checksheets/submissions")}>
                    View All
                  </Button>
                </Stack>
                <Divider />
                <Stack divider={<Divider flexItem />} spacing={0}>
                  {submissions.slice(0, 6).map((item) => (
                    <Stack
                      key={item.id}
                      direction={{ xs: "column", md: "row" }}
                      justifyContent="space-between"
                      alignItems={{ xs: "flex-start", md: "center" }}
                      spacing={1.5}
                      sx={{ py: 1.5 }}
                    >
                      <Box sx={{ minWidth: 0 }}>
                        <Typography variant="body2" fontWeight={700} sx={{ overflowWrap: "anywhere" }}>
                          {[item.processCode, item.processName].filter(Boolean).join(" - ") || item.checksheetName || "-"}
                        </Typography>
                        <Typography variant="caption" color="text.secondary">
                          {item.machineCode || "-"} | {item.location || "-"} | {formatDate(item.inspectionDate)}
                        </Typography>
                      </Box>
                      <Stack direction="row" spacing={1} alignItems="center">
                        <Chip
                          size="small"
                          label={formatStatus(item.status)}
                          color={item.status === "approved" ? "success" : item.status === "submitted" ? "warning" : item.status === "rejected" ? "error" : "default"}
                          variant={item.status === "approved" ? "filled" : "outlined"}
                        />
                        <Button size="small" onClick={() => navigate(`/checksheets/submissions/${item.id}`)}>
                          Open
                        </Button>
                      </Stack>
                    </Stack>
                  ))}
                  {submissions.length === 0 ? (
                    <Box sx={{ py: 5, textAlign: "center" }}>
                      <Typography color="text.secondary">No recent transactions found.</Typography>
                    </Box>
                  ) : null}
                </Stack>
              </Stack>
            </Paper>
          </Grid>
          <Grid item xs={12} md={6} lg={4}>
            <Paper variant="outlined" sx={{ p: 2.5, height: "100%", borderRadius: 2 }}>
              <Stack spacing={2.25}>
                <Box>
                  <Typography variant="subtitle1" fontWeight={800}>
                    Master Coverage
                  </Typography>
                  <Typography variant="caption" color="text.secondary">
                    Machine setup available for inspection flow
                  </Typography>
                </Box>
                <Divider />
                <Stack spacing={2}>
                  <Stack direction="row" justifyContent="space-between" alignItems="center">
                    <Stack direction="row" spacing={1.25} alignItems="center">
                      <PrecisionManufacturingIcon color="primary" />
                      <Typography variant="body2" fontWeight={700}>
                        Registered Machines
                      </Typography>
                    </Stack>
                    <Typography variant="h6" fontWeight={800}>
                      {machineTotal}
                    </Typography>
                  </Stack>
                  <Stack direction="row" justifyContent="space-between" alignItems="center">
                    <Stack direction="row" spacing={1.25} alignItems="center">
                      <BuildCircleIcon color="warning" />
                      <Typography variant="body2" fontWeight={700}>
                        Repair Records
                      </Typography>
                    </Stack>
                    <Typography variant="h6" fontWeight={800}>
                      {totalRepairs}
                    </Typography>
                  </Stack>
                  <Stack direction="row" justifyContent="space-between" alignItems="center">
                    <Stack direction="row" spacing={1.25} alignItems="center">
                      <PendingActionsIcon color="error" />
                      <Typography variant="body2" fontWeight={700}>
                        Repair Waiting Approval
                      </Typography>
                    </Stack>
                    <Typography variant="h6" fontWeight={800}>
                      {pendingRepairTotal}
                    </Typography>
                  </Stack>
                </Stack>
                <Button variant="outlined" onClick={() => navigate("/master/checksheet-lines")}>
                  Manage Machine Lines
                </Button>
              </Stack>
            </Paper>
          </Grid>
        </Grid>
      </Stack>
    </Box>
  );
}
