import { useEffect, useMemo, useState } from "react";
import {
  Alert,
  Box,
  Button,
  Chip,
  Dialog,
  DialogActions,
  DialogContent,
  DialogTitle,
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
  ToggleButton,
  ToggleButtonGroup,
  Typography
} from "@mui/material";
import { flexRender, getCoreRowModel, useReactTable } from "@tanstack/react-table";
import CheckOutlinedIcon from "@mui/icons-material/CheckOutlined";
import { useNavigate } from "react-router-dom";
import { usePendingApprovalRequests, useRespondApprovalRequest } from "app/hooks/useChecksheets";

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

export default function PendingApprovalsPage() {
  const navigate = useNavigate();
  const respondMutation = useRespondApprovalRequest();
  const [target, setTarget] = useState(null);
  const [decision, setDecision] = useState("approved");
  const [comment, setComment] = useState("");
  const [page, setPage] = useState(1);
  const [pageSize, setPageSize] = useState(10);
  const [sorting, setSorting] = useState([{ id: "requestedAt", desc: true }]);
  const activeSort = sorting[0];

  const { data, isLoading, isError, error, isFetching } = usePendingApprovalRequests({
    page,
    pageSize,
    sortBy: activeSort?.id,
    sortDirection: activeSort?.desc === false ? "asc" : "desc"
  });
  const items = useMemo(() => data?.data ?? [], [data?.data]);
  const totalCount = data?.total ?? 0;

  useEffect(() => {
    setPage(1);
  }, [sorting]);

  const columns = useMemo(
    () => [
      {
        accessorKey: "checksheetTitle",
        header: "Checksheet",
        enableSorting: false
      },
      {
        id: "checksheetName",
        header: "Checksheet Name",
        enableSorting: false,
        cell: ({ row }) => (
          <Stack spacing={0.25} sx={{ maxWidth: 320 }}>
            <Typography
              variant="body2"
              fontWeight={600}
              sx={{ whiteSpace: "normal", wordBreak: "normal", overflowWrap: "break-word" }}
            >
              {[row.original.processCode, row.original.processName].filter(Boolean).join(" - ") || "-"}
            </Typography>
            <Typography
              variant="caption"
              color="text.secondary"
              sx={{ whiteSpace: "normal", wordBreak: "normal", overflowWrap: "break-word" }}
            >
              {row.original.checksheetName || "-"}
            </Typography>
          </Stack>
        )
      },
      {
        accessorKey: "requestTitle",
        header: "Request",
        enableSorting: false
      },
      {
        id: "requestedAt",
        accessorKey: "requestCreatedAt",
        header: "Requested At",
        cell: ({ getValue }) => (
          <Typography variant="body2" sx={{ whiteSpace: "nowrap" }}>
            {formatDateTime(getValue())}
          </Typography>
        )
      },
      {
        id: "step",
        header: "Step",
        enableSorting: false,
        cell: ({ row }) => (
          <Stack spacing={0.25}>
            <Typography fontWeight={600}>{row.original.stepName}</Typography>
            <Typography variant="caption" color="text.secondary">
              Step {row.original.stepOrder}
            </Typography>
          </Stack>
        )
      },
      {
        id: "mode",
        header: () => <Box sx={{ textAlign: "center" }}>Mode</Box>,
        enableSorting: false,
        cell: ({ row }) => (
          <Box sx={{ textAlign: "center" }}>
            <Chip
              size="small"
              label={row.original.approvalMode === "all" ? "All Must Approve" : "Any One"}
              color={row.original.approvalMode === "all" ? "secondary" : "primary"}
              variant="outlined"
            />
          </Box>
        )
      },
      {
        id: "actions",
        enableSorting: false,
        header: () => <Box sx={{ textAlign: "right", pr: 1.5 }}>Actions</Box>,
        cell: ({ row }) => (
          <Stack direction="row" spacing={1} justifyContent="flex-end" sx={{ pr: 1.5 }}>
            <Button onClick={() => navigate(`/checksheets/submissions/${row.original.checksheetSubmissionId}/monthly`)}>Open</Button>
            <Button variant="contained" onClick={() => setTarget(row.original)}>
              Respond
            </Button>
          </Stack>
        )
      }
    ],
    [navigate]
  );

  const table = useReactTable({
    data: items,
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
            Pending My Approval
          </Typography>
          <Typography variant="body2" color="text.secondary">
            Review month-end checksheet submissions assigned to your current approval step.
          </Typography>
        </Box>

        {isLoading ? (
          <Paper variant="outlined" sx={{ p: 4 }}>
            <Typography color="text.secondary">Loading pending approvals...</Typography>
          </Paper>
        ) : isError ? (
          <Alert severity="error">{error.message}</Alert>
        ) : (
          <TableContainer
            component={Paper}
            variant="outlined"
            sx={{ opacity: isFetching ? 0.72 : 1, transition: "opacity 0.2s", overflowX: "auto" }}
          >
            <Table sx={{ minWidth: 1000 }}>
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
                {items.length === 0 && (
                  <TableRow>
                    <TableCell colSpan={columns.length} align="center" sx={{ py: 6, px: 3 }}>
                      No approvals pending your action.
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

      <Dialog open={!!target} onClose={respondMutation.isPending ? undefined : () => setTarget(null)} fullWidth maxWidth="sm">
        <DialogTitle>Respond Approval</DialogTitle>
        <DialogContent dividers>
          <Stack spacing={2}>
            <ToggleButtonGroup
              exclusive
              fullWidth
              value={decision}
              onChange={(_, value) => {
                if (value) {
                  setDecision(value);
                }
              }}
              disabled={respondMutation.isPending}
              sx={{
                "& .MuiToggleButton-root": {
                  py: 1.25,
                  fontWeight: 700,
                  textTransform: "none"
                }
              }}
            >
              <ToggleButton value="approved" color="success">
                <CheckOutlinedIcon fontSize="small" sx={{ mr: 0.75 }} />
                Approve
              </ToggleButton>
              <ToggleButton value="rejected" color="error">
                Reject
              </ToggleButton>
            </ToggleButtonGroup>
            <TextField label="Comment" value={comment} onChange={(event) => setComment(event.target.value)} multiline minRows={3} />
          </Stack>
        </DialogContent>
        <DialogActions>
          <Button onClick={() => setTarget(null)} disabled={respondMutation.isPending}>
            Cancel
          </Button>
          <Button
            variant="contained"
            onClick={() =>
              respondMutation.mutate(
                {
                  requestId: target.requestId,
                  stepId: target.stepId,
                  data: { decision, comment: comment.trim() || null }
                },
                {
                  onSuccess: () => {
                    setTarget(null);
                    setDecision("approved");
                    setComment("");
                  }
                }
              )
            }
            disabled={respondMutation.isPending}
          >
            {respondMutation.isPending ? "Saving..." : "Submit"}
          </Button>
        </DialogActions>
      </Dialog>
    </Box>
  );
}
