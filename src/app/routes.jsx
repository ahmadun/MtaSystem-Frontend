import { lazy } from "react";
import { Navigate } from "react-router-dom";
import AuthGuard from "./auth/AuthGuard";
import RoleGuard from "./auth/RoleGuard";
import { authRoles } from "./auth/authRoles";
import Loadable from "./components/Loadable";
import MatxLayout from "./components/MatxLayout/MatxLayout";
import sessionRoutes from "./views/sessions/session-routes";
import materialRoutes from "app/views/material-kit/MaterialRoutes";
const DashboardPage = Loadable(lazy(() => import("app/views/dashboard/DashboardPage")));
const UsersPage = Loadable(lazy(() => import("app/views/users/UsersPage")));
const ChecksheetAreasPage = Loadable(lazy(() => import("app/views/master/ChecksheetAreasPage")));
const ChecksheetLineMastersPage = Loadable(lazy(() => import("app/views/master/ChecksheetLineMastersPage")));
const ChecksheetGroupsPage = Loadable(lazy(() => import("app/views/master/ChecksheetGroupsPage")));
const ChecksheetMachineCodeOptionsPage = Loadable(lazy(() => import("app/views/master/ChecksheetMachineCodeOptionsPage")));
const ChecksheetMastersPage = Loadable(lazy(() => import("app/views/master/ChecksheetMastersPage")));
const ChecksheetLinesPage = Loadable(lazy(() => import("app/views/master/ChecksheetLinesPage")));
const RepairmanCheckersPage = Loadable(lazy(() => import("app/views/master/RepairmanCheckersPage")));
const ChecksheetStepApproversPage = Loadable(lazy(() => import("app/views/master/ChecksheetStepApproversPage")));
const ChecksheetTemplatesPage = Loadable(lazy(() => import("app/views/checksheets/ChecksheetTemplatesPage")));
const ChecksheetSubmissionsPage = Loadable(lazy(() => import("app/views/checksheets/ChecksheetSubmissionsPage")));
const ChecksheetRepairHistoryPage = Loadable(lazy(() => import("app/views/checksheets/ChecksheetRepairHistoryPage")));
const ChecksheetMonthlyResultsPage = Loadable(lazy(() => import("app/views/checksheets/ChecksheetMonthlyResultsPage")));
const ChecksheetSubmissionDetailPage = Loadable(lazy(() => import("app/views/checksheets/ChecksheetSubmissionDetailPage")));
const ChecksheetSubmissionMonthlyPage = Loadable(lazy(() => import("app/views/checksheets/ChecksheetSubmissionMonthlyPage")));
const PendingApprovalsPage = Loadable(lazy(() => import("app/views/checksheets/PendingApprovalsPage")));
const PendingRepairApprovalsPage = Loadable(lazy(() => import("app/views/checksheets/PendingRepairApprovalsPage")));
const ApprovalTemplatesPage = Loadable(lazy(() => import("app/views/checksheets/ApprovalTemplatesPage")));

const adminRoles = authRoles.admin;
const superAdminRoles = authRoles.sa;
const withRoles = (element, roles) => <RoleGuard roles={roles}>{element}</RoleGuard>;

const routes = [
  { path: "/", element: <Navigate to="dashboard" /> },
  {
    element: (
      <AuthGuard>
        <MatxLayout />
      </AuthGuard>
    ),
    children: [
      ...materialRoutes,
      { path: "/dashboard", element: <DashboardPage /> },
      { path: "/users", element: withRoles(<UsersPage />, adminRoles) },
      { path: "/master/checksheet-areas", element: withRoles(<ChecksheetAreasPage />, superAdminRoles) },
      { path: "/master/checksheet-line-masters", element: withRoles(<ChecksheetLineMastersPage />, adminRoles) },
      { path: "/master/checksheet-groups", element: withRoles(<ChecksheetGroupsPage />, superAdminRoles) },
      { path: "/master/checksheet-machine-codes", element: withRoles(<ChecksheetMachineCodeOptionsPage />, adminRoles) },
      { path: "/master/checksheet-masters", element: withRoles(<ChecksheetMastersPage />, adminRoles) },
      { path: "/master/checksheet-lines", element: withRoles(<ChecksheetLinesPage />, adminRoles) },
      { path: "/master/repairman-checkers", element: withRoles(<RepairmanCheckersPage />, adminRoles) },
      { path: "/master/checksheet-step-approvers", element: withRoles(<ChecksheetStepApproversPage />, adminRoles) },
      { path: "/master/checksheet-templates", element: withRoles(<ChecksheetTemplatesPage />, superAdminRoles) },
      { path: "/master/checksheet-templates/new", element: withRoles(<ChecksheetTemplatesPage />, superAdminRoles) },
      { path: "/master/checksheet-templates/:id/edit", element: withRoles(<ChecksheetTemplatesPage />, superAdminRoles) },
      { path: "/checksheets/templates", element: <Navigate to="/master/checksheet-templates" replace /> },
      { path: "/checksheets/submissions", element: <ChecksheetSubmissionsPage /> },
      { path: "/checksheets/repairs", element: <ChecksheetRepairHistoryPage /> },
      { path: "/checksheets/monthly-results", element: <ChecksheetMonthlyResultsPage /> },
      { path: "/checksheets/submissions/:id", element: <ChecksheetSubmissionDetailPage /> },
      { path: "/checksheets/submissions/:id/monthly", element: <ChecksheetSubmissionMonthlyPage /> },
      { path: "/approvals/pending", element: <PendingApprovalsPage /> },
      { path: "/approvals/repairs", element: <PendingRepairApprovalsPage /> },
      { path: "/approvals/templates", element: withRoles(<ApprovalTemplatesPage />, adminRoles) }
    ]
  },

  ...sessionRoutes
];

export default routes;
