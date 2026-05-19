import { useEffect, useMemo, useState } from "react";
import {
  Alert,
  Box,
  Button,
  Card,
  CardContent,
  Chip,
  Dialog,
  DialogActions,
  DialogContent,
  DialogTitle,
  FormControlLabel,
  Grid2,
  IconButton,
  InputAdornment,
  MenuItem,
  Paper,
  Skeleton,
  Stack,
  Switch,
  Table,
  TableBody,
  TableCell,
  TableContainer,
  TableHead,
  TablePagination,
  TableRow,
  TableSortLabel,
  TextField,
  Tooltip,
  Typography
} from "@mui/material";
import {
  flexRender,
  getCoreRowModel,
  getSortedRowModel,
  useReactTable
} from "@tanstack/react-table";
import AddIcon from "@mui/icons-material/Add";
import EditOutlinedIcon from "@mui/icons-material/EditOutlined";
import DeleteOutlineIcon from "@mui/icons-material/DeleteOutline";
import LockResetOutlinedIcon from "@mui/icons-material/LockResetOutlined";
import SearchIcon from "@mui/icons-material/Search";
import GroupOutlinedIcon from "@mui/icons-material/GroupOutlined";
import PersonOffOutlinedIcon from "@mui/icons-material/PersonOffOutlined";
import KeyOutlinedIcon from "@mui/icons-material/KeyOutlined";
import VerifiedUserOutlinedIcon from "@mui/icons-material/VerifiedUserOutlined";
import { useFormik } from "formik";
import * as Yup from "yup";
import { useDebounce } from "use-debounce";
import { getEmployeeByCode } from "/src/api/account";
import useAuth from "app/hooks/useAuth";
import { authRoles } from "app/auth/authRoles";
import { ConfirmationDialog } from "app/components";
import {
  useCreateUser,
  useDeleteUser,
  useResetUserPassword,
  useUser,
  useUsers,
  useUpdateUser
} from "app/hooks/useUsers";

const ROLE_OPTIONS = ["SuperAdmin", "Admin", "Manager", "Employee"];

const getUserSchema = (isEdit) =>
  Yup.object({
    employeeId: Yup.number().nullable(),
    employeeCode: Yup.string()
      .matches(/^\d{0,6}$/, "NIK must be up to 6 digits")
      .nullable(),
    username: Yup.string().required("Username is required").max(100),
    email: Yup.string().email("Enter a valid email").required("Email is required"),
    password: isEdit
      ? Yup.string().notRequired()
      : Yup.string()
          .required("Password is required")
          .min(8, "Password must be at least 8 characters")
          .matches(/[A-Z]/, "Password must contain at least one uppercase letter")
          .matches(/[a-z]/, "Password must contain at least one lowercase letter")
          .matches(/[0-9]/, "Password must contain at least one digit"),
    role: Yup.string().oneOf(ROLE_OPTIONS).required("Role is required"),
    isActive: Yup.boolean(),
    mustChangePassword: Yup.boolean()
  });

const resetPasswordSchema = Yup.object({
  newPassword: Yup.string()
    .required("New password is required")
    .min(8, "Password must be at least 8 characters")
    .matches(/[A-Z]/, "Password must contain at least one uppercase letter")
    .matches(/[a-z]/, "Password must contain at least one lowercase letter")
    .matches(/[0-9]/, "Password must contain at least one digit"),
  mustChangePassword: Yup.boolean()
});

function formatDate(value) {
  if (!value) return "Never";

  return new Date(value).toLocaleString("en-US", {
    year: "numeric",
    month: "short",
    day: "numeric",
    hour: "2-digit",
    minute: "2-digit"
  });
}

function SummaryCard({ title, value, caption, icon, color = "primary" }) {
  return (
    <Card variant="outlined" sx={{ height: "100%", borderRadius: 3 }}>
      <CardContent>
        <Stack direction="row" justifyContent="space-between" spacing={2}>
          <Box>
            <Typography variant="body2" color="text.secondary">
              {title}
            </Typography>
            <Typography variant="h4" fontWeight={700} sx={{ mt: 0.5 }}>
              {value}
            </Typography>
            <Typography variant="caption" color="text.secondary" sx={{ display: "block", mt: 0.75 }}>
              {caption}
            </Typography>
          </Box>
          <Box
            sx={{
              width: 48,
              height: 48,
              borderRadius: 2,
              display: "grid",
              placeItems: "center",
              bgcolor: `${color}.main`,
              color: `${color}.contrastText`
            }}
          >
            {icon}
          </Box>
        </Stack>
      </CardContent>
    </Card>
  );
}

function UserFormDialog({ open, onClose, userId }) {
  const isEdit = !!userId;
  const { data: user, isLoading } = useUser(userId, { enabled: open && !!userId });
  const createMutation = useCreateUser();
  const updateMutation = useUpdateUser(userId);
  const [employeeFullname, setEmployeeFullname] = useState("");
  const [employeeLoading, setEmployeeLoading] = useState(false);

  const formik = useFormik({
    initialValues: {
      employeeId: user?.employeeId ?? "",
      employeeCode: user?.employeeCode ?? "",
      username: user?.username ?? "",
      email: user?.email ?? "",
      password: "",
      role: user?.role ?? "Employee",
      isActive: user?.isActive ?? true,
      mustChangePassword: user?.mustChangePassword ?? false
    },
    enableReinitialize: true,
    validationSchema: getUserSchema(isEdit),
    onSubmit: async (values, { resetForm }) => {
      const payload = {
        employeeId: values.employeeCode.trim()
          ? null
          : user?.employeeId ?? null,
        employeeCode: values.employeeCode.trim() || null,
        username: values.username.trim(),
        email: values.email.trim(),
        role: values.role,
        mustChangePassword: values.mustChangePassword
      };

      if (isEdit) {
        await updateMutation.mutateAsync({
          ...payload,
          isActive: values.isActive
        });
      } else {
        await createMutation.mutateAsync({
          ...payload,
          password: values.password
        });
      }

      resetForm();
      onClose();
    }
  });

  useEffect(() => {
    if (!open) {
      setEmployeeFullname("");
      return;
    }

    setEmployeeFullname(user?.employeeName ?? "");
  }, [open, user?.employeeName]);

  const handleEmployeeCodeBlur = async (event) => {
    const code = event.target.value?.trim();
    setEmployeeFullname("");

    if (!code) return;

    setEmployeeLoading(true);

    try {
      const data = await getEmployeeByCode(code);
      const fullName = data?.data?.fullName ?? data?.data?.fullname ?? data?.data?.name ?? "";

      setEmployeeFullname(fullName);
      if (!fullName) formik.setFieldError("employeeCode", "Employee not found.");
    } catch {
      setEmployeeFullname("");
      formik.setFieldError("employeeCode", "Employee not found.");
    } finally {
      setEmployeeLoading(false);
    }
  };

  const isPending = createMutation.isPending || updateMutation.isPending;

  return (
    <Dialog open={open} onClose={isPending ? undefined : onClose} fullWidth maxWidth="sm">
      <form onSubmit={formik.handleSubmit}>
        <DialogTitle>{isEdit ? "Edit User" : "Create User"}</DialogTitle>
        <DialogContent>
          {isEdit && isLoading ? (
            <Stack spacing={1.5} sx={{ mt: 1 }}>
              <Skeleton variant="rounded" height={56} />
              <Skeleton variant="rounded" height={56} />
              <Skeleton variant="rounded" height={56} />
            </Stack>
          ) : (
            <Stack spacing={2} sx={{ mt: 1 }}>
              <TextField
                label="NIK"
                name="employeeCode"
                placeholder="Max 6 digits"
                value={formik.values.employeeCode}
                onChange={(event) => {
                  const value = event.target.value.replace(/\D/g, "").slice(0, 6);
                  formik.setFieldValue("employeeCode", value);
                  setEmployeeFullname("");
                }}
                onBlur={(event) => {
                  formik.handleBlur(event);
                  handleEmployeeCodeBlur(event);
                }}
                error={formik.touched.employeeCode && !!formik.errors.employeeCode}
                helperText={formik.touched.employeeCode && formik.errors.employeeCode}
                fullWidth
                inputProps={{ maxLength: 6, inputMode: "numeric", pattern: "[0-9]*" }}
              />
              <TextField
                label="Fullname"
                value={employeeFullname}
                InputProps={{ readOnly: true }}
                placeholder={employeeLoading ? "Loading..." : ""}
                fullWidth
              />
              <TextField
                label="Username"
                name="username"
                value={formik.values.username}
                onChange={formik.handleChange}
                onBlur={formik.handleBlur}
                error={formik.touched.username && !!formik.errors.username}
                helperText={formik.touched.username && formik.errors.username}
                fullWidth
                required
              />
              <TextField
                label="Email"
                name="email"
                type="email"
                value={formik.values.email}
                onChange={formik.handleChange}
                onBlur={formik.handleBlur}
                error={formik.touched.email && !!formik.errors.email}
                helperText={formik.touched.email && formik.errors.email}
                fullWidth
                required
              />
              {!isEdit && (
                <TextField
                  label="Password"
                  name="password"
                  type="password"
                  value={formik.values.password}
                  onChange={formik.handleChange}
                  onBlur={formik.handleBlur}
                  error={formik.touched.password && !!formik.errors.password}
                  helperText={formik.touched.password && formik.errors.password}
                  fullWidth
                  required
                />
              )}
              <TextField
                select
                label="Role"
                name="role"
                value={formik.values.role}
                onChange={formik.handleChange}
                onBlur={formik.handleBlur}
                error={formik.touched.role && !!formik.errors.role}
                helperText={formik.touched.role && formik.errors.role}
                fullWidth
              >
                {ROLE_OPTIONS.map((role) => (
                  <MenuItem key={role} value={role}>
                    {role}
                  </MenuItem>
                ))}
              </TextField>
              {isEdit && (
                <FormControlLabel
                  control={
                    <Switch
                      name="isActive"
                      checked={formik.values.isActive}
                      onChange={formik.handleChange}
                    />
                  }
                  label="User is active"
                />
              )}
              <FormControlLabel
                control={
                  <Switch
                    name="mustChangePassword"
                    checked={formik.values.mustChangePassword}
                    onChange={formik.handleChange}
                  />
                }
                label="Require password change on next login"
              />
            </Stack>
          )}
        </DialogContent>
        <DialogActions>
          <Button onClick={onClose} disabled={isPending}>
            Cancel
          </Button>
          <Button type="submit" variant="contained" disabled={isPending || (isEdit && isLoading)}>
            {isPending ? "Saving..." : isEdit ? "Save Changes" : "Create User"}
          </Button>
        </DialogActions>
      </form>
    </Dialog>
  );
}

function ResetPasswordDialog({ open, onClose, user }) {
  const mutation = useResetUserPassword(user?.userId);

  const formik = useFormik({
    initialValues: {
      newPassword: "",
      mustChangePassword: true
    },
    enableReinitialize: true,
    validationSchema: resetPasswordSchema,
    onSubmit: async (values, { resetForm }) => {
      await mutation.mutateAsync(values);
      resetForm();
      onClose();
    }
  });

  return (
    <Dialog open={open} onClose={mutation.isPending ? undefined : onClose} fullWidth maxWidth="sm">
      <form onSubmit={formik.handleSubmit}>
        <DialogTitle>Reset Password</DialogTitle>
        <DialogContent>
          <Stack spacing={2} sx={{ mt: 1 }}>
            <Alert severity="info">
              Resetting the password for <strong>{user?.username}</strong>.
            </Alert>
            <TextField
              label="New Password"
              name="newPassword"
              type="password"
              value={formik.values.newPassword}
              onChange={formik.handleChange}
              onBlur={formik.handleBlur}
              error={formik.touched.newPassword && !!formik.errors.newPassword}
              helperText={formik.touched.newPassword && formik.errors.newPassword}
              fullWidth
              required
            />
            <FormControlLabel
              control={
                <Switch
                  name="mustChangePassword"
                  checked={formik.values.mustChangePassword}
                  onChange={formik.handleChange}
                />
              }
              label="Require the user to change the password after sign-in"
            />
          </Stack>
        </DialogContent>
        <DialogActions>
          <Button onClick={onClose} disabled={mutation.isPending}>
            Cancel
          </Button>
          <Button type="submit" variant="contained" disabled={mutation.isPending}>
            {mutation.isPending ? "Resetting..." : "Reset Password"}
          </Button>
        </DialogActions>
      </form>
    </Dialog>
  );
}

function EmptyState({ onCreate }) {
  return (
    <Paper variant="outlined" sx={{ py: 10, borderRadius: 3, textAlign: "center" }}>
      <Typography variant="h6" color="text.secondary">
        No users found
      </Typography>
      <Typography variant="body2" color="text.disabled" sx={{ mt: 1 }}>
        Create the first user account to start managing access.
      </Typography>
      <Button variant="contained" startIcon={<AddIcon />} sx={{ mt: 2 }} onClick={onCreate}>
        Create User
      </Button>
    </Paper>
  );
}

export default function UsersPage() {
  const { user: authUser } = useAuth();
  const deleteMutation = useDeleteUser();
  const [page, setPage] = useState(1);
  const [pageSize, setPageSize] = useState(10);
  const [search, setSearch] = useState("");
  const [sorting, setSorting] = useState([]);
  const [debouncedSearch] = useDebounce(search, 400);
  const [selectedUserId, setSelectedUserId] = useState(null);
  const [resetUser, setResetUser] = useState(null);
  const [dialogMode, setDialogMode] = useState(null);
  const [deleteTarget, setDeleteTarget] = useState(null);
  const { data: usersResponse, isLoading, isError, error, isFetching } = useUsers({
    Page: page,
    PageSize: pageSize,
    ...(debouncedSearch.trim() ? { Name: debouncedSearch.trim() } : {})
  });

  const canManageUsers = authRoles.admin.includes(authUser?.role);
  const pagedUsers = Array.isArray(usersResponse) ? null : usersResponse;
  // eslint-disable-next-line react-hooks/exhaustive-deps
  const users = Array.isArray(usersResponse) ? usersResponse : usersResponse?.items ?? [];
  const totalCount = pagedUsers?.totalCount ?? users.length;

  const stats = useMemo(
    () => ({
      total: totalCount,
      active: users.filter((item) => item.isActive).length,
      inactive: users.filter((item) => !item.isActive).length,
      recentlyLoggedIn: users.filter((item) => item.lastLogin).length
    }),
    [totalCount, users]
  );

  const columns = useMemo(
    () => [
      {
        id: "user",
        accessorFn: (row) => row.username ?? "",
        header: "User",
        cell: ({ row }) => (
          <Stack spacing={0.35}>
            <Typography variant="body2" fontWeight={700}>
              {row.original.username}
            </Typography>
            <Typography variant="caption" color="text.secondary">
              {row.original.email}
            </Typography>
          </Stack>
        )
      },
      {
        accessorKey: "role",
        header: "Role",
        cell: ({ getValue }) => (
          <Chip label={getValue() ?? "Unknown"} size="small" color="primary" variant="outlined" />
        )
      },
      {
        accessorKey: "isActive",
        header: "Status",
        cell: ({ getValue }) => (
          <Chip
            label={getValue() ? "Active" : "Inactive"}
            size="small"
            color={getValue() ? "success" : "default"}
          />
        )
      },
      {
        accessorKey: "lastLogin",
        header: "Last Login",
        cell: ({ getValue }) => (
          <Typography variant="body2" color="text.secondary">
            {formatDate(getValue())}
          </Typography>
        )
      },
      {
        id: "actions",
        enableSorting: false,
        header: () => <Box sx={{ textAlign: "right" }}>Actions</Box>,
        cell: ({ row }) => (
          <Box sx={{ textAlign: "right" }}>
            <Tooltip title="Edit user">
              <IconButton onClick={() => handleEdit(row.original.userId)}>
                <EditOutlinedIcon fontSize="small" />
              </IconButton>
            </Tooltip>
            <Tooltip title="Reset password">
              <IconButton onClick={() => setResetUser(row.original)}>
                <LockResetOutlinedIcon fontSize="small" />
              </IconButton>
            </Tooltip>
            <Tooltip title="Delete user">
              <IconButton
                color="error"
                onClick={() => handleDelete(row.original)}
                disabled={deleteMutation.isPending}
              >
                <DeleteOutlineIcon fontSize="small" />
              </IconButton>
            </Tooltip>
          </Box>
        )
      }
    ],
    [deleteMutation.isPending]
  );

  const table = useReactTable({
    data: users,
    columns,
    state: { sorting },
    onSortingChange: setSorting,
    getCoreRowModel: getCoreRowModel(),
    getSortedRowModel: getSortedRowModel()
  });

  const handleCreate = () => {
    setSelectedUserId(null);
    setDialogMode("form");
  };

  const handleEdit = (userId) => {
    setSelectedUserId(userId);
    setDialogMode("form");
  };

  const handleDelete = async (user) => {
    setDeleteTarget(user);
  };

  if (!canManageUsers) {
    return (
      <Box sx={{ p: 3 }}>
        <Alert severity="warning">Only SuperAdmin and Admin roles can access user management.</Alert>
      </Box>
    );
  }

  return (
    <Box sx={{ p: 3 }}>
      <Stack spacing={3}>
        <Stack
          direction={{ xs: "column", md: "row" }}
          spacing={2}
          justifyContent="space-between"
          alignItems={{ xs: "flex-start", md: "center" }}
        >
          <Box>
            <Typography variant="h5" fontWeight={700}>
              Users Management
            </Typography>
            <Typography variant="body2" color="text.secondary" sx={{ mt: 0.5 }}>
              Manage application access, roles, activation status, and password resets.
            </Typography>
          </Box>
          <Button variant="contained" startIcon={<AddIcon />} onClick={handleCreate}>
            New User
          </Button>
        </Stack>

        <Grid2 container spacing={2}>
          <Grid2 size={{ xs: 12, sm: 6, xl: 3 }}>
            <SummaryCard
              title="Total Users"
              value={stats.total}
              caption="Accounts available in the system"
              icon={<GroupOutlinedIcon />}
            />
          </Grid2>
          <Grid2 size={{ xs: 12, sm: 6, xl: 3 }}>
            <SummaryCard
              title="Active"
              value={stats.active}
              caption="Users currently allowed to sign in"
              icon={<VerifiedUserOutlinedIcon />}
              color="success"
            />
          </Grid2>
          <Grid2 size={{ xs: 12, sm: 6, xl: 3 }}>
            <SummaryCard
              title="Inactive"
              value={stats.inactive}
              caption="Accounts currently disabled"
              icon={<PersonOffOutlinedIcon />}
              color="warning"
            />
          </Grid2>
          <Grid2 size={{ xs: 12, sm: 6, xl: 3 }}>
            <SummaryCard
              title="Logged In"
              value={stats.recentlyLoggedIn}
              caption="Users with recorded login activity"
              icon={<KeyOutlinedIcon />}
              color="info"
            />
          </Grid2>
        </Grid2>

        <Paper variant="outlined" sx={{ p: 2, borderRadius: 3 }}>
          <Stack
            direction={{ xs: "column", md: "row" }}
            spacing={1.5}
            justifyContent="space-between"
            alignItems={{ xs: "stretch", md: "center" }}
          >
            <TextField
              placeholder="Search users by name"
              value={search}
              onChange={(event) => {
                setSearch(event.target.value);
                setPage(1);
              }}
              size="small"
              fullWidth
              sx={{ maxWidth: 420 }}
              InputProps={{
                startAdornment: (
                  <InputAdornment position="start">
                    <SearchIcon fontSize="small" />
                  </InputAdornment>
                )
              }}
            />
            <Typography variant="body2" color="text.secondary">
              Showing {users.length} on this page, {totalCount} total
            </Typography>
          </Stack>
        </Paper>

        {isLoading ? (
          <Stack spacing={1.5}>
            {Array.from({ length: 5 }).map((_, index) => (
              <Skeleton key={index} variant="rounded" height={64} />
            ))}
          </Stack>
        ) : isError ? (
          <Alert severity="error">{error?.message ?? "Failed to load users."}</Alert>
        ) : users.length === 0 ? (
          <EmptyState onCreate={handleCreate} />
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
                    {headerGroup.headers.map((header, index) => (
                      <TableCell
                        key={header.id}
                        sx={{
                          pl: index === 0 ? 2 : 1,
                          pr: index === headerGroup.headers.length - 1 ? 2 : 1,
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
                    ))}
                  </TableRow>
                ))}
              </TableHead>
              <TableBody>
                {table.getRowModel().rows.map((row) => (
                  <TableRow key={row.id} hover>
                    {row.getVisibleCells().map((cell, index) => (
                      <TableCell
                        key={cell.id}
                        sx={{
                          pl: index === 0 ? 2 : 1,
                          pr: index === row.getVisibleCells().length - 1 ? 2 : 1
                        }}
                      >
                        {flexRender(cell.column.columnDef.cell, cell.getContext())}
                      </TableCell>
                    ))}
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
              labelDisplayedRows={({ from, to, count }) => `${from}-${to} of ${count}`}
            />
          </TableContainer>
        )}
      </Stack>

      <UserFormDialog
        open={dialogMode === "form"}
        onClose={() => setDialogMode(null)}
        userId={selectedUserId}
      />

      <ResetPasswordDialog
        open={!!resetUser}
        onClose={() => setResetUser(null)}
        user={resetUser}
      />

      <ConfirmationDialog
        open={!!deleteTarget}
        title="Delete User"
        text={`Delete user "${deleteTarget?.username}"? This action cannot be undone.`}
        confirmText="Delete"
        confirmColor="error"
        isLoading={deleteMutation.isPending}
        onConfirmDialogClose={() => setDeleteTarget(null)}
        onYesClick={async () => {
          if (!deleteTarget) return;
          await deleteMutation.mutateAsync(deleteTarget.userId);
          setDeleteTarget(null);
        }}
      />
    </Box>
  );
}
